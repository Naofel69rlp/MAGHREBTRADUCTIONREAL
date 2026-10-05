export type ThemeId =
  | 'bloc1' | 'bloc2' | 'bloc3' | 'prospection' | 'valorisation' | 'calculs' | 'droit' | 'vocabulaire'

export type ModeId = 'rapide' | 'theme' | 'chrono' | 'survie' | 'defi' | 'revision'

export interface Question {
  id: string
  theme: ThemeId
  difficulte: 1 | 2 | 3
  question: string
  reponses: string[]
  bonneReponse: number
  explication: string
}

/** Statistiques par question (répétition espacée simple). */
export interface QStat {
  seen: number
  ok: number
  ko: number
  /** Bonnes réponses consécutives depuis la dernière erreur */
  run: number
  /** Question à revoir : ratée et pas encore réussie 3 fois de suite */
  review: boolean
}

export interface Counters {
  games: number
  perfect: number
  bestCombo: number
  fast: number
  soncas: number
  calc: number
  redeemed: number
  night: number
  early: number
  chrono: number
  survie: number
  dailyDone: number
  dailyPerfect: number
}

export interface Profile {
  version: 1
  pseudo: string
  xp: number
  streak: { count: number; best: number; last: string | null }
  answered: number
  correct: number
  byTheme: Record<ThemeId, { answered: number; correct: number }>
  q: Record<string, QStat>
  records: Partial<Record<ModeId, number>>
  badges: Record<string, string>
  daily: Record<string, { score: number; total: number }>
  counters: Counters
  settings: { vibration: boolean; theme: 'dark' | 'light' }
}

export interface AnswerLog {
  q: Question
  chosen: number | null
  correct: boolean
  ms: number
}

export interface GameConfig {
  mode: ModeId
  theme?: ThemeId
}

export interface GameResult {
  config: GameConfig
  answers: AnswerLog[]
  xp: number
  bestCombo: number
}

export interface GameSummary {
  result: GameResult
  correct: number
  total: number
  xpAnswers: number
  xpBonus: number
  levelBefore: number
  levelAfter: number
  xpBefore: number
  xpAfter: number
  newBadges: string[]
  record: { isNew: boolean; previous: number; value: number }
  perfect: boolean
  dailyReplay: boolean
}
