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

/** WAV silencieux (0,1 s) : le jouer via <audio> fait passer iOS en « lecture » et ignore l'interrupteur silencieux. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
let silentEl: HTMLAudioElement | null = null

function init() {
  if (ctx) return
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.8
  master.connect(ctx.destination)
}

/** À appeler depuis un geste utilisateur : crée/reprend le contexte audio (et contourne le mode silencieux d'iOS). */
export function unlockAudio() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
    if (!silentEl) {
      silentEl = new Audio(SILENT_WAV)
      silentEl.loop = true
      silentEl.setAttribute('playsinline', '')
    }
    void silentEl.play().catch(() => { /* refusé hors geste : sans gravité */ })
    init()
    if (ctx && ctx.state !== 'running') void ctx.resume()
  } catch {
    /* audio indisponible */
  }
}

if (typeof window !== 'undefined') {
  // Sur iOS, seuls certains événements (touchend, click) comptent comme « geste » : on les écoute tous
  // et on ne retire les écouteurs qu'une fois le contexte réellement démarré.
  const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const
  const tryUnlock = () => {
    unlockAudio()
    if (ctx && ctx.state === 'running') events.forEach(e => window.removeEventListener(e, tryUnlock))
  }
  events.forEach(e => window.addEventListener(e, tryUnlock, { passive: true }))
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
  if (muted || !ctx) return
  const run = () => {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
  if (ctx.state === 'running') run()
  else void ctx.resume().then(() => { if (ctx && ctx.state === 'running') run() }).catch(() => { /* ignore */ })
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

/** Début de partie : petit « whoosh » montant. */
export function playStart() {
  play(() => {
    tone(330, 0, 0.18, { type: 'triangle', to: 660, gain: 0.16 })
    tone(660, 0.14, 0.2, { type: 'sine', to: 990, gain: 0.14 })
  })
}

/** Fin de partie : jingle de résultat (plus joyeux si le score est bon). */
export function playFinish(good: boolean) {
  play(() => {
    const notes = good ? [523.25, 659.25, 783.99, 1046.5] : [440, 392, 349.23]
    notes.forEach((f, i) => tone(f, i * 0.12, 0.22, { type: 'triangle', gain: 0.2 }))
  })
}

/** Nouveau record : arpège brillant. */
export function playRecord() {
  play(() => {
    ;[784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'sine', gain: 0.17 }))
  })
}

/** Passage à la question suivante : léger « tick ». */
export function playNext() {
  play(() => tone(440, 0, 0.06, { type: 'sine', to: 560, gain: 0.08, attack: 0.004 }))
}
