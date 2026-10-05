import { useState } from 'react'
import type { Question } from '../types'
import { askAI } from '../lib/ai'

/** Bouton « Explique-moi » : explication complémentaire par IA. */
export default function AiExplain({ q, chosen }: { q: Question; chosen: number | null }) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = async () => {
    setLoading(true)
    setError(null)
    try {
      setText(await askAI(q, chosen))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      {!text && (
        <button onClick={ask} disabled={loading} className="rounded-xl bg-violet-500/15 px-4 py-2 text-sm font-extrabold text-violet-500 disabled:opacity-60">
          {loading ? '🤖 Je réfléchis…' : '🤖 Explique-moi avec l\'IA'}
        </button>
      )}
      {error && <p className="mt-2 text-sm font-bold text-rose-500">{error}</p>}
      {text && <p className="mt-2 whitespace-pre-line rounded-xl bg-violet-500/10 p-3 text-sm font-semibold leading-relaxed">🤖 {text}</p>}
    </div>
  )
}
