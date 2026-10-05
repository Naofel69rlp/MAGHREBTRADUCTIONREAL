let enabled = true

export function setVibrationEnabled(v: boolean) {
  enabled = v
}

export function vibrate(pattern: number | number[]) {
  if (!enabled) return
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    /* non supporté */
  }
}
