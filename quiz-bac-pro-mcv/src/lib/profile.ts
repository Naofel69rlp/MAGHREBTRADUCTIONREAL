import type { AnswerLog, GameResult, GameSummary, Profile, Question, ThemeId } from '../types'
import { THEMES } from '../data/themes'
import { BADGES } from '../data/badges'
import { levelOf } from '../data/levels'
import { completionBonus } from './xp'
import { todayKey, yesterdayKey } from './game'

const KEY = 'mcv-quiz-profile-v1'

export function newProfile(pseudo = ''): Profile {
  return {
    version: 1,
    pseudo,
    xp: 0,
    streak: { count: 0, best: 0, last: null },
    answered: 0,
    correct: 0,
    byTheme: Object.fromEntries(THEMES.map(t => [t.id, { answered: 0, correct: 0 }])) as Profile['byTheme'],
    q: {},
    records: {},
    badges: {},
    daily: {},
    counters: {
      games: 0, perfect: 0, bestCombo: 0, fast: 0, soncas: 0, calc: 0, redeemed: 0,
      night: 0, early: 0, chrono: 0, survie: 0, dailyDone: 0, dailyPerfect: 0,
    },
    settings: {
      vibration: true,
      theme: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
    },
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Profile
    if (p.version !== 1) return null
    // fusion avec les valeurs par défaut (nouveaux champs / nouveaux thèmes)
    const base = newProfile(p.pseudo)
    return {
      ...base, ...p,
      byTheme: { ...base.byTheme, ...p.byTheme },
      counters: { ...base.counters, ...p.counters },
      settings: { ...base.settings, ...p.settings },
    }
  } catch {
    return null
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* stockage plein ou bloqué */
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Série effective : une série non entretenue hier ou aujourd'hui est cassée. */
export function effectiveStreak(p: Profile): number {
  const { last, count } = p.streak
  return last === todayKey() || last === yesterdayKey() ? count : 0
}

export function playedToday(p: Profile): boolean {
  return p.streak.last === todayKey()
}

function touchStreak(p: Profile) {
  const today = todayKey()
  if (p.streak.last === today) return
  p.streak.count = p.streak.last === yesterdayKey() ? p.streak.count + 1 : 1
  p.streak.best = Math.max(p.streak.best, p.streak.count)
  p.streak.last = today
}

const SONCAS_RE = /SONCAS|mobile d'achat|mobile SONCAS/i

/** Enregistre une réponse (stats globales, par thème, répétition espacée, compteurs de badges). */
export function applyAnswer(profile: Profile, q: Question, correct: boolean, ms: number): Profile {
  const p = structuredClone(profile)
  touchStreak(p)
  p.answered++
  p.byTheme[q.theme].answered++
  const s = p.q[q.id] ?? { seen: 0, ok: 0, ko: 0, run: 0, review: false }
  s.seen++
  if (correct) {
    p.correct++
    p.byTheme[q.theme].correct++
    s.ok++
    s.run++
    if (s.review && s.run >= 3) {
      s.review = false
      p.counters.redeemed++
    }
    if (ms < 2500) p.counters.fast++
    if (q.theme === 'bloc1' && SONCAS_RE.test(q.question)) p.counters.soncas++
    if (q.theme === 'calculs') p.counters.calc++
  } else {
    s.ko++
    s.run = 0
    s.review = true
  }
  p.q[q.id] = s
  return p
}

export function applyGameEnd(profile: Profile, result: GameResult): { profile: Profile; summary: GameSummary } {
  const p = structuredClone(profile)
  const { config, answers } = result
  const total = answers.length
  const correct = answers.filter((a: AnswerLog) => a.correct).length
  const fixedLength = config.mode === 'rapide' || config.mode === 'theme' || config.mode === 'defi' || config.mode === 'revision'
  const perfect = fixedLength && total >= 5 && correct === total

  const today = todayKey()
  const dailyReplay = config.mode === 'defi' && !!p.daily[today]
  const xpAnswers = dailyReplay ? 0 : result.xp
  const xpBonus = total > 0 && !dailyReplay ? completionBonus(perfect) : 0

  const xpBefore = p.xp
  p.xp += xpAnswers + xpBonus

  // compteurs
  if (total > 0) {
    p.counters.games++
    if (perfect) p.counters.perfect++
    p.counters.bestCombo = Math.max(p.counters.bestCombo, result.bestCombo)
    const h = new Date().getHours()
    if (h < 5) p.counters.night++
    else if (h < 7) p.counters.early++
  }
  if (config.mode === 'chrono') p.counters.chrono = Math.max(p.counters.chrono, correct)
  if (config.mode === 'survie') p.counters.survie = Math.max(p.counters.survie, correct)
  if (config.mode === 'defi' && !dailyReplay && total > 0) {
    p.daily[today] = { score: correct, total }
    p.counters.dailyDone++
    if (perfect) p.counters.dailyPerfect++
  }

  // record personnel
  const previous = p.records[config.mode] ?? 0
  const isNew = correct > previous && correct > 0 && !dailyReplay
  if (isNew) p.records[config.mode] = correct

  // badges
  const newBadges: string[] = []
  for (const b of BADGES) {
    if (!p.badges[b.id] && b.test(p)) {
      p.badges[b.id] = today
      newBadges.push(b.id)
    }
  }

  return {
    profile: p,
    summary: {
      result, correct, total, xpAnswers, xpBonus,
      levelBefore: levelOf(xpBefore), levelAfter: levelOf(p.xp),
      xpBefore, xpAfter: p.xp, newBadges,
      record: { isNew, previous, value: Math.max(previous, correct) },
      perfect, dailyReplay,
    },
  }
}

export function masteryOf(p: Profile, theme: ThemeId) {
  const s = p.byTheme[theme]
  return { answered: s.answered, correct: s.correct, pct: s.answered ? Math.round((s.correct / s.answered) * 100) : 0 }
}

export function reviewCount(p: Profile): number {
  return Object.values(p.q).filter(s => s.review).length
}
