// Vérifie la cohérence de src/data/questions.json
import { readFileSync } from 'node:fs'
const qs = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url)))
const themes = ['bloc1','bloc2','bloc3','prospection','valorisation','calculs','droit','vocabulaire']
const ids = new Set()
let errors = 0
const err = (q, m) => { errors++; console.error(`✗ ${q.id}: ${m}`) }
for (const q of qs) {
  if (ids.has(q.id)) err(q, 'id en double'); ids.add(q.id)
  if (!themes.includes(q.theme)) err(q, 'thème inconnu')
  if (![1, 2, 3].includes(q.difficulte)) err(q, 'difficulté invalide')
  if (!Array.isArray(q.reponses) || q.reponses.length !== 4) err(q, '4 réponses attendues')
  else if (new Set(q.reponses).size !== 4) err(q, 'réponses en double')
  if (!Number.isInteger(q.bonneReponse) || q.bonneReponse < 0 || q.bonneReponse > 3) err(q, 'bonneReponse invalide')
  if (!q.question || !q.explication) err(q, 'question ou explication vide')
}
const byTheme = Object.fromEntries(themes.map(t => [t, qs.filter(q => q.theme === t).length]))
console.log(`${qs.length} questions`, byTheme)
if (qs.length < 200) { console.error('✗ moins de 200 questions'); errors++ }
process.exit(errors ? 1 : 0)
