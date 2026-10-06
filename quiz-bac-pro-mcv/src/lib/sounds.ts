/**
 * Sons synthétisés avec la Web Audio API (aucun fichier audio).
 * Rien n'est joué (ni même créé) avant la première interaction de l'utilisateur.
 */

const MUTE_KEY = 'mcv-quiz-muted'
const MUSIC_KEY = 'mcv-quiz-music'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let muted = readFlag(MUTE_KEY, false)
let musicOn = readFlag(MUSIC_KEY, true)
let musicWanted = false
const listeners = new Set<() => void>()

function readFlag(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? def : v === '1'
  } catch {
    return def
  }
}

function writeFlag(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? '1' : '0')
  } catch {
    /* ignore */
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
  // Compresseur : permet un volume global élevé (haut-parleurs de téléphone) sans saturation
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 6
  comp.connect(ctx.destination)
  master = ctx.createGain()
  master.gain.value = 1.6
  master.connect(comp)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0.5
  musicBus.connect(comp)
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
    if (ctx && ctx.state !== 'running') void ctx.resume().then(syncMusic).catch(() => { /* ignore */ })
    syncMusic()
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
  writeFlag(MUTE_KEY, m)
  syncMusic()
  listeners.forEach(l => l())
}

export function isMusicOn() {
  return musicOn
}

export function setMusicOn(v: boolean) {
  musicOn = v
  writeFlag(MUSIC_KEY, v)
  syncMusic()
  listeners.forEach(l => l())
}

/** Abonnement aux changements (son coupé / musique activée). */
export function onAudioChange(l: () => void) {
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

const SFX_BOOST = 2.4

function toneAt(dest: AudioNode, freq: number, t0: number, dur: number, o: ToneOpts = {}, boost = 1) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur)
  const peak = Math.min(0.95, (o.gain ?? 0.25) * boost)
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
  g.connect(dest)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function tone(freq: number, start: number, dur: number, o: ToneOpts = {}) {
  if (!ctx || !master) return
  toneAt(master, freq, ctx.currentTime + start, dur, o, SFX_BOOST)
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
    tone(260, 0, 0.3, { type: 'triangle', to: 170, gain: 0.2, lowpass: 900 })
    tone(130, 0, 0.3, { type: 'sine', to: 85, gain: 0.12 })
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

/* ------------------------------------------------------------------ */
/* Musique de fond : boucle originale façon « jeu télé », synthétisée   */
/* ------------------------------------------------------------------ */

const BPM = 132
const STEP = 60 / BPM / 4 // une double-croche
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)
// Progression Am – F – C – G (4 mesures de 16 pas)
const CHORDS = [
  { root: 45, notes: [57, 60, 64] }, // La mineur
  { root: 41, notes: [53, 57, 60] }, // Fa
  { root: 48, notes: [60, 64, 67] }, // Do
  { root: 43, notes: [55, 59, 62] }, // Sol
]
const ARP = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2]
const MELODY: (number | null)[] = [2, null, 2, null, 1, null, 2, null, 0, null, 1, null, 2, null, null, null]

let musicTimer: number | null = null
let nextTime = 0
let stepIndex = 0
let noiseBuf: AudioBuffer | null = null

function noiseBurst(t0: number, dur: number, freq: number, vol: number) {
  if (!ctx || !musicBus) return
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(musicBus)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

function scheduleStep(i: number, t: number) {
  if (!musicBus) return
  const bar = Math.floor(i / 16) % CHORDS.length
  const s = i % 16
  const chord = CHORDS[bar]
  // Basse : noires + contretemps
  if (s % 4 === 0) toneAt(musicBus, midi(chord.root), t, STEP * 3.5, { type: 'triangle', gain: 0.5 })
  if (s % 4 === 2) toneAt(musicBus, midi(chord.root + 12), t, STEP * 1.5, { type: 'triangle', gain: 0.28 })
  // Arpège
  toneAt(musicBus, midi(chord.notes[ARP[s]] + 12), t, STEP * 1.6, { type: 'square', gain: 0.07, lowpass: 2600 })
  // Mélodie
  const m = MELODY[s]
  if (m !== null) toneAt(musicBus, midi(chord.notes[m] + 24), t, STEP * 3, { type: 'triangle', gain: 0.22 })
  // Batterie
  if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) toneAt(musicBus, 150, t, 0.14, { type: 'sine', to: 45, gain: 0.8, attack: 0.002 })
  if (s === 4 || s === 12) noiseBurst(t, 0.13, 1800, 0.35)
  if (s % 2 === 0) noiseBurst(t, 0.04, 7000, s % 4 === 0 ? 0.16 : 0.1)
}

function musicTick() {
  if (!ctx) return
  while (nextTime < ctx.currentTime + 0.25) {
    scheduleStep(stepIndex, nextTime)
    nextTime += STEP
    stepIndex++
  }
}

function startMusic() {
  if (musicTimer !== null || !ctx) return
  nextTime = ctx.currentTime + 0.08
  stepIndex = 0
  musicTick()
  musicTimer = window.setInterval(musicTick, 60)
}

function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer)
    musicTimer = null
  }
}

/** Démarre/arrête la boucle selon : musique voulue par l'écran, préférence, mute, contexte audio actif. */
function syncMusic() {
  const should = musicWanted && musicOn && !muted && !!ctx && ctx.state === 'running'
  if (should) startMusic()
  else stopMusic()
}

/** Appelé par l'écran de jeu : la musique ne joue que pendant une partie. */
export function setMusicWanted(v: boolean) {
  musicWanted = v
  syncMusic()
}
