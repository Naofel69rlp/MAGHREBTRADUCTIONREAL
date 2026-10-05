import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GameResult, GameSummary, Profile, Question } from '../types'
import { applyAnswer, applyGameEnd, clearProfile, loadProfile, newProfile, saveProfile } from '../lib/profile'
import { setVibrationEnabled } from '../lib/haptics'

interface Ctx {
  profile: Profile | null
  createProfile: (pseudo: string) => void
  recordAnswer: (q: Question, correct: boolean, ms: number) => void
  finishGame: (result: GameResult) => GameSummary
  updateSettings: (patch: Partial<Profile['settings']>) => void
  resetAll: () => void
}

const GameCtx = createContext<Ctx | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const ref = useRef(profile)

  const commit = useCallback((p: Profile | null) => {
    ref.current = p
    setProfile(p)
    if (p) saveProfile(p)
  }, [])

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
    createProfile: pseudo => commit(newProfile(pseudo.trim()))
    ,
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
      clearProfile()
      commit(null)
    },
  }), [profile, commit])

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
