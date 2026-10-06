import type { Profile } from '../types'

const SESSION_KEY = 'mcv-quiz-session'

export interface Session {
  pseudo: string
  token: string
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function setSession(s: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function call<T>(body: Record<string, unknown>, keepalive = false): Promise<T> {
  let res: Response
  try {
    res = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
    })
  } catch {
    throw new ApiError('Pas de connexion au serveur.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || 'Le service de comptes est indisponible.', res.status)
  return data as T
}

export const apiRegister = (pseudo: string, password: string, profile: Profile | null) =>
  call<{ token: string; pseudo: string }>({ action: 'register', pseudo, password, profile })

export const apiLogin = (pseudo: string, password: string) =>
  call<{ token: string; pseudo: string; profile: Profile | null }>({ action: 'login', pseudo, password })

export const apiLoad = (token: string) => call<{ profile: Profile | null }>({ action: 'load', token })

export const apiSave = (token: string, profile: Profile, keepalive = false) =>
  call<{ ok: boolean }>({ action: 'save', token, profile }, keepalive)
