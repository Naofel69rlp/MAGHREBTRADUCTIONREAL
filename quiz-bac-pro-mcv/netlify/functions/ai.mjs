// Fonction Netlify : explique / corrige une réponse de quiz avec l'API Gemini.
// La clé reste côté serveur (variable d'environnement GEMINI_API_KEY).
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const clip = (s, n) => String(s ?? '').slice(0, n)

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  const key = process.env.GEMINI_API_KEY
  if (!key) return json({ error: 'Clé API non configurée sur le serveur.' }, 500)

  let b
  try { b = await req.json() } catch { return json({ error: 'Requête invalide' }, 400) }
  const reponses = Array.isArray(b.reponses) ? b.reponses.slice(0, 4).map(r => clip(r, 300)) : []
  if (!b.question || reponses.length !== 4) return json({ error: 'Question invalide' }, 400)

  const chosen = Number.isInteger(b.chosen) ? reponses[b.chosen] : null
  const prompt = `Tu es un professeur de Bac Pro Métiers du Commerce et de la Vente (option B, Terminale). Réponds en français simple, en 4 phrases maximum, de façon pédagogique.
Question : ${clip(b.question, 600)}
Réponses proposées : ${reponses.map((r, i) => `${i + 1}. ${r}`).join(' | ')}
Bonne réponse attendue : ${reponses[b.bonneReponse]}
${chosen ? `L'élève a répondu : ${chosen}` : ''}
Explication officielle : ${clip(b.explication, 500)}
${b.demande ? `Demande de l'élève : ${clip(b.demande, 300)}` : "Explique pourquoi la bonne réponse est correcte, et pourquoi la réponse de l'élève est fausse s'il s'est trompé. Donne un petit exemple concret ou une astuce pour retenir."}`

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } } }),
  })
  if (!r.ok) return json({ error: `Erreur IA (${r.status})` }, 502)
  const data = await r.json()
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? ''
  return json({ text: text.trim() || "Pas de réponse de l'IA." })
}
