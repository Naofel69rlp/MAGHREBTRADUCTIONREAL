export type Difficulty = 1 | 2 | 3

/** Palier de combo : 0 = aucun, 1 = x2 (3 d'affilée), 2 = x3 (5), 3 = x5 (10) */
export function comboLevel(streak: number): 0 | 1 | 2 | 3 {
  if (streak >= 10) return 3
  if (streak >= 5) return 2
  if (streak >= 3) return 1
  return 0
}

export function comboMultiplier(streak: number): 1 | 2 | 3 | 5 {
  return ([1, 2, 3, 5] as const)[comboLevel(streak)]
}

/** XP d'une bonne réponse : base selon difficulté + bonus de rapidité, × multiplicateur de combo. */
export function computeXp(difficulte: Difficulty, ms: number, comboBefore: number) {
  const base = 5 + difficulte * 5 // 10 / 15 / 20
  const speed = ms <= 3000 ? 5 : ms <= 6000 ? 3 : ms <= 10000 ? 1 : 0
  const mult = comboMultiplier(comboBefore)
  return { base, speed, mult, total: (base + speed) * mult }
}

/** Bonus de fin de partie : participation + partie sans faute. */
export function completionBonus(perfect: boolean): number {
  return perfect ? 30 : 10
}
