import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GameResult, GameSummary, Profile, Question } from '../types'
import { applyAnswer, applyGameEnd, clearProfile, loadProfile, newProfile, saveProfile } from '../lib/profile'
import { setVibrationEnabled } from '../lib/haptics'
import {
  ApiError, apiLoad, apiLogin, apiRegister, apiSave, clearSession, getSession, setSession, type Session,
} from '../lib/account'

export type SyncStatus = 'idle' | 'saving' | 'ok' | 'error'

interface Ctx {
  profile: Profile | null
  session: Session | null
  syncStatus: SyncStatus
  createProfile: (pseudo: string) => void
  recordAnswer: (q: Question, correct: boolean, ms: number) => void
  finishGame: (result: GameResult) => GameSummary
  updateSettings: (patch: Partial<Profile['settings']>) => void
  resetAll: () => void
  register: (pseudo: string, password: string) => Promise<void>
  login: (pseudo: string, password: string) => Promise<void>
  logout: () => void
}

const GameCtx = createContext<Ctx | null>(null)
const SAVE_DELAY = 1500

export function GameProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const [session, setSess] = useState<Session | null>(() => getSession())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const ref = useRef(profile)
  const sessionRef = useRef(session)
  const saveTimer = useRef<number | null>(null)

  const pushToServer = useCallback(async (keepalive = false) => {
    const s = sessionRef.current
    const p = ref.current
    if (!s || !p) return
    setSyncStatus('saving')
    try {
      await apiSave(s.token, p, keepalive)
      setSyncStatus('ok')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // session expirée : on garde la progression locale, l'élève devra se reconnecter
        clearSession()
        sessionRef.current = null
        setSess(null)
      }
      setSyncStatus('error')
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (!sessionRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void pushToServer() }, SAVE_DELAY)
  }, [pushToServer])

  const commit = useCallback((p: Profile | null) => {
    ref.current = p
    setProfile(p)
    if (p) {
      saveProfile(p)
      scheduleSave()
    }
  }, [scheduleSave])

  const startSession = useCallback((s: Session) => {
    setSession(s)
    sessionRef.current = s
    setSess(s)
  }, [])

  // À l'ouverture : si connecté, on récupère la progression du compte (la plus avancée gagne)
  useEffect(() => {
    const s = sessionRef.current
    if (!s) return
    let cancelled = false
    apiLoad(s.token)
      .then(({ profile: remote }) => {
        if (cancelled) return
        const local = ref.current
        if (remote && (!local || remote.xp > local.xp)) {
          ref.current = remote
          setProfile(remote)
          saveProfile(remote)
          setSyncStatus('ok')
        } else {
          void pushToServer()
        }
      })
      .catch(e => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession()
          sessionRef.current = null
          setSess(null)
        }
        setSyncStatus('error')
      })
    return () => { cancelled = true }
  }, [pushToServer])

  // Sauvegarde immédiate quand l'élève quitte / masque la page
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && saveTimer.current && sessionRef.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
        void pushToServer(true)
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [pushToServer])

  useEffect(() => {
    if (!profile) return
    setVibrationEnabled(profile.settings.vibration)
    document.documentElement.classList.toggle('dark', profile.settings.theme === 'dark')
  }, [profile])

  // Thème par défaut avant la création du profil
  useEffect(() => {
    if (!profile) document.documentElement.classList.add('dark')
  }, [profile])

  const value = useMemo<Ctx>(() => ({
    profile,
    session,
    syncStatus,
    createProfile: pseudo => commit(newProfile(pseudo.trim())),
    recordAnswer: (q, correct, ms) => {
      if (ref.current) commit(applyAnswer(ref.current, q, correct, ms))
    },
    finishGame: result => {
      const { profile: p, summary } = applyGameEnd(ref.current!, result)
      commit(p)
      return summary
    },
    updateSettings: patch => {
      if (ref.current) commit({ ...ref.current, settings: { ...ref.current.settings, ...patch } })
    },
    resetAll: () => {
      const s = sessionRef.current
      if (s) {
        commit(newProfile(s.pseudo)) // connecté : on repart de zéro (le compte aussi)
      } else {
        clearProfile()
        commit(null)
      }
    },
    // Création de compte : la progression actuelle (invité) est envoyée au serveur
    register: async (pseudo, password) => {
      const base = { ...(ref.current ?? newProfile(pseudo.trim())), pseudo: pseudo.trim() }
      const r = await apiRegister(pseudo, password, base)
      startSession({ pseudo: r.pseudo, token: r.token })
      commit(base)
    },
    // Connexion : la progression du compte remplace celle de l'appareil
    login: async (pseudo, password) => {
      const r = await apiLogin(pseudo, password)
      startSession({ pseudo: r.pseudo, token: r.token })
      const p = r.profile ?? { ...(ref.current ?? newProfile(r.pseudo)), pseudo: r.pseudo }
      ref.current = p
      setProfile(p)
      saveProfile(p)
      setSyncStatus('ok')
    },
    // Déconnexion : on efface la progression de l'appareil (téléphones partagés)
    logout: () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      clearSession()
      sessionRef.current = null
      setSess(null)
      setSyncStatus('idle')
      clearProfile()
      commit(null)
    },
  }), [profile, session, syncStatus, commit, startSession])

  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>
}

export function useGame(): Ctx {
  const c = useContext(GameCtx)
  if (!c) throw new Error('useGame doit être utilisé dans GameProvider')
  return c
}

/** Profil garanti (écrans affichés après l'onboarding). */
export function useProfile(): Profile {
  const { profile } = useGame()
  if (!profile) throw new Error('Profil absent')
  return profile
}
