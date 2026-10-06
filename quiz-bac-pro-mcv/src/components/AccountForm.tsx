import { useState, type FormEvent } from 'react'
import { useGame } from '../store/GameContext'

interface Props {
  mode: 'register' | 'login'
  initialPseudo?: string
  /** Avertit que la progression locale sera remplacée par celle du compte (connexion) */
  warnReplace?: boolean
}

const INPUT =
  'mt-1 w-full rounded-2xl border-2 border-line bg-bg px-4 py-3.5 text-lg font-bold placeholder:text-muted/60 focus:border-violet-500'

/** Formulaire de création de compte / connexion. */
export default function AccountForm({ mode, initialPseudo = '', warnReplace }: Props) {
  const { register, login } = useGame()
  const [pseudo, setPseudo] = useState(initialPseudo)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = pseudo.trim().length >= 2 && password.length >= 6

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok || loading) return
    setLoading(true)
    setError(null)
    try {
      await (mode === 'register' ? register(pseudo, password) : login(pseudo, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-extrabold">
        Pseudo
        <input value={pseudo} onChange={e => setPseudo(e.target.value)} maxLength={16} autoComplete="username" placeholder="Ton pseudo" className={INPUT} />
      </label>
      <label className="block text-sm font-extrabold">
        Mot de passe {mode === 'register' && <span className="font-semibold text-muted">(6 caractères minimum)</span>}
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="••••••" className={INPUT}
        />
      </label>
      {warnReplace && mode === 'login' && (
        <p className="rounded-xl bg-amber-400/15 p-2 text-sm font-bold text-amber-500">
          ⚠️ La progression de cet appareil sera remplacée par celle de ton compte.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-rose-500/15 p-2 text-sm font-bold text-rose-500">{error}</p>}
      <button type="submit" disabled={!ok || loading} className="btn-big bg-gradient-to-r from-violet-500 to-pink-500 disabled:opacity-40">
        {loading ? '…' : mode === 'register' ? 'Créer mon compte ✨' : 'Me connecter 🔓'}
      </button>
      {mode === 'register' && (
        <p className="text-center text-xs font-semibold text-muted">
          Pas d'e-mail : note bien ton mot de passe, il ne peut pas être récupéré.
        </p>
      )}
    </form>
  )
}
