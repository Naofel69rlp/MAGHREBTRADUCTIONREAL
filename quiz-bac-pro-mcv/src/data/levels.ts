export interface Level {
  titre: string
  min: number
  emoji: string
}

export const LEVELS: Level[] = [
  { titre: 'Stagiaire', min: 0, emoji: '🎒' },
  { titre: 'Vendeur junior', min: 150, emoji: '🛍️' },
  { titre: 'Vendeur confirmé', min: 400, emoji: '💼' },
  { titre: 'Conseiller expert', min: 800, emoji: '🎯' },
  { titre: 'Chef de rayon', min: 1400, emoji: '📦' },
  { titre: 'Manager commercial', min: 2200, emoji: '📈' },
  { titre: 'Directeur commercial', min: 3300, emoji: '🏆' },
  { titre: 'Légende de la vente', min: 4800, emoji: '👑' },
]

export interface LevelInfo {
  /** Numéro du niveau (1 à 8) */
  level: number
  current: Level
  next: Level | null
  /** Progression 0..1 vers le niveau suivant (1 au niveau max) */
  progress: number
  xpInLevel: number
  xpForNext: number
}

export function levelOf(xp: number): number {
  let lvl = 1
  LEVELS.forEach((l, i) => { if (xp >= l.min) lvl = i + 1 })
  return lvl
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelOf(xp)
  const current = LEVELS[level - 1]
  const next = LEVELS[level] ?? null
  const xpInLevel = xp - current.min
  const xpForNext = next ? next.min - current.min : 0
  return { level, current, next, progress: next ? xpInLevel / xpForNext : 1, xpInLevel, xpForNext }
}
