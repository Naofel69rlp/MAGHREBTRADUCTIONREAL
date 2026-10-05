import type { Question } from '../types'

/** Demande une explication à l'IA via la fonction Netlify (/api/ai). */
export async function askAI(q: Question, chosen: number | null, demande?: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q.question, reponses: q.reponses, bonneReponse: q.bonneReponse, explication: q.explication, chosen, demande }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "L'IA n'est pas disponible.")
  return data.text as string
}
