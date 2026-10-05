/**
 * Sons synthétisés avec la Web Audio API (aucun fichier audio).
 * Rien n'est joué (ni même créé) avant la première interaction de l'utilisateur.
 */

const MUTE_KEY = 'mcv-quiz-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readMuted()
const listeners = new Set<(m: boolean) => void>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function init() {
  if (ctx) return
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.7
  master.connect(ctx.destination)
}

/** À appeler depuis un geste utilisateur : crée/reprend le contexte audio. */
export function unlockAudio() {
  try {
    init()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* audio indisponible */
  }
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('keydown', once)
    window.removeEventListener('touchstart', once)
  }
  window.addEventListener('pointerdown', once, { passive: true })
  window.addEventListener('keydown', once)
  window.addEventListener('touchstart', once, { passive: true })
}

export function isMuted() {
  return muted
}

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  } catch {
    /* ignore */
  }
  listeners.forEach(l => l(m))
}

export function onMuteChange(l: (m: boolean) => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  /** Fréquence finale pour un glissando */
  to?: number
  attack?: number
  lowpass?: number
}

function tone(freq: number, start: number, dur: number, o: ToneOpts = {}) {
  if (!ctx || !master) return
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur)
  const peak = o.gain ?? 0.25
  const attack = o.attack ?? 0.01
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  let node: AudioNode = osc
  if (o.lowpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lowpass
    osc.connect(f)
    node = f
  }
  node.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function play(fn: () => void) {
  if (muted || !ctx || ctx.state !== 'running') return
  try {
    fn()
  } catch {
    /* ignore */
  }
}

const semitone = (n: number) => Math.pow(2, n / 12)

/** Bonne réponse : petit « ding » montant. */
export function playCorrect() {
  play(() => {
    tone(659.25, 0, 0.16, { type: 'triangle', gain: 0.22 })
    tone(987.77, 0.09, 0.3, { type: 'sine', gain: 0.22 })
  })
}

/** Mauvaise réponse : « bzz » grave et doux. */
export function playWrong() {
  play(() => {
    tone(190, 0, 0.28, { type: 'triangle', to: 130, gain: 0.2, lowpass: 600 })
    tone(95, 0, 0.28, { type: 'sine', to: 70, gain: 0.12 })
  })
}

/** Combo : arpège qui monte d'un cran (2 demi-tons) à chaque palier (1, 2, 3). */
export function playCombo(level: number) {
  play(() => {
    const root = 523.25 * semitone(Math.max(0, level - 1) * 2)
    ;[0, 4, 7, 12].forEach((st, i) => tone(root * semitone(st), i * 0.07, 0.2, { type: 'triangle', gain: 0.2 }))
    if (level >= 3) tone(root * semitone(19), 0.3, 0.4, { type: 'sine', gain: 0.18 })
  })
}

/** Tic-tac du chrono. */
export function playTick(high = false) {
  play(() => tone(high ? 1300 : 980, 0, 0.05, { type: 'square', gain: 0.07, attack: 0.002 }))
}

/** Montée de niveau : petite fanfare. */
export function playLevelUp() {
  play(() => {
    const seq: [number, number, number][] = [[523.25, 0, 0.14], [659.25, 0.13, 0.14], [783.99, 0.26, 0.14], [1046.5, 0.39, 0.5]]
    seq.forEach(([f, s, d]) => tone(f, s, d, { type: 'triangle', gain: 0.24 }))
    tone(1318.5, 0.39, 0.5, { type: 'sine', gain: 0.12 })
    tone(392, 0.39, 0.5, { type: 'sine', gain: 0.1 })
  })
}

/** Badge débloqué : carillon scintillant. */
export function playBadge() {
  play(() => {
    ;[880, 1174.66, 1567.98, 2093].forEach((f, i) => tone(f, i * 0.09, 0.35, { type: 'sine', gain: 0.16 }))
  })
}

/** Clic sur bouton. */
export function playClick() {
  play(() => tone(520, 0, 0.05, { type: 'sine', to: 700, gain: 0.1, attack: 0.003 }))
}
