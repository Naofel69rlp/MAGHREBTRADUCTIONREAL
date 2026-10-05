import type { GameConfig, Profile, Question } from '../types'
import questionsData from '../data/questions.json'

export const ALL_QUESTIONS = questionsData as Question[]

export type Rng = () => number

export function hashString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h >>> 0) || 1
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Mélange l'ordre des réponses en conservant l'index de la bonne réponse. */
export function shuffleAnswers(q: Question, rng: Rng = Math.random): Question {
  const order = shuffle([0, 1, 2, 3], rng)
  return { ...q, reponses: order.map(i => q.reponses[i]), bonneReponse: order.indexOf(q.bonneReponse) }
}

/** Tirage pondéré sans remise : les questions à revoir sortent plus souvent. */
function weightedSample(pool: Question[], n: number, profile: Profile | null, rng: Rng): Question[] {
  const items = pool.map(q => {
    const s = profile?.q[q.id]
    let w = 1
    if (s?.review) w += 3 + Math.min(s.ko, 3)
    else if (!s) w += 0.5 // légère préférence pour les questions jamais vues
    return { q, w }
  })
  const out: Question[] = []
  while (out.length < n && items.length) {
    const total = items.reduce((t, it) => t + it.w, 0)
    let r = rng() * total
    let idx = 0
    for (; idx < items.length - 1; idx++) {
      r -= items[idx].w
      if (r <= 0) break
    }
    out.push(items[idx].q)
    items.splice(idx, 1)
  }
  return out
}

export function todayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

/** Défi du jour : mêmes 5 questions (et mêmes positions de réponses) pour tout le monde à une date donnée. */
export function dailyQuestions(dateKey: string = todayKey()): Question[] {
  const rng = seededRng(hashString('mcv-defi-' + dateKey))
  const sorted = ALL_QUESTIONS.slice().sort((a, b) => a.id.localeCompare(b.id))
  return shuffle(sorted, rng).slice(0, 5).map(q => shuffleAnswers(q, rng))
}

export function reviewPool(profile: Profile): Question[] {
  return ALL_QUESTIONS.filter(q => profile.q[q.id]?.review)
}

export const QUICK_SIZE = 10

/** Construit la liste de questions d'une partie (jamais de doublon dans une même partie). */
export function buildQuestions(config: GameConfig, profile: Profile): Question[] {
  const rng = Math.random
  let picked: Question[]
  switch (config.mode) {
    case 'defi':
      return dailyQuestions()
    case 'theme':
      picked = weightedSample(ALL_QUESTIONS.filter(q => q.theme === config.theme), QUICK_SIZE, profile, rng)
      break
    case 'revision':
      picked = weightedSample(reviewPool(profile), QUICK_SIZE, profile, rng)
      break
    case 'chrono':
    case 'survie':
      picked = weightedSample(ALL_QUESTIONS, ALL_QUESTIONS.length, profile, rng)
      break
    default:
      picked = weightedSample(ALL_QUESTIONS, QUICK_SIZE, profile, rng)
  }
  return picked.map(q => shuffleAnswers(q, rng))
}
