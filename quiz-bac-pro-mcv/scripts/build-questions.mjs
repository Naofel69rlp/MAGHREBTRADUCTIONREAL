// Génère src/data/questions.json à partir de questions-src/*.mjs
// Format source : [difficulté, question, BONNE réponse, mauvaise1, mauvaise2, mauvaise3, explication]
// La bonne réponse est placée à une position pseudo-aléatoire stable (seed) dans le JSON.
import { writeFileSync } from 'node:fs'
const themes = ['bloc1','bloc2','bloc3','prospection','valorisation','calculs','droit','vocabulaire']
const prefix = { bloc1:'b1', bloc2:'b2', bloc3:'b3', prospection:'pr', valorisation:'va', calculs:'ca', droit:'ed', vocabulaire:'vo' }
let seed = 12345
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const out = []
for (const theme of themes) {
  const rows = (await import(`../questions-src/${theme}.mjs`)).default
  rows.forEach((r, i) => {
    const [difficulte, question, bonne, m1, m2, m3, explication] = r
    const reponses = [m1, m2, m3]
    const idx = Math.floor(rnd() * 4)
    reponses.splice(idx, 0, bonne)
    out.push({ id: `${prefix[theme]}-${String(i + 1).padStart(3, '0')}`, theme, difficulte, question, reponses, bonneReponse: idx, explication })
  })
}
writeFileSync(new URL('../src/data/questions.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`${out.length} questions écrites`)
