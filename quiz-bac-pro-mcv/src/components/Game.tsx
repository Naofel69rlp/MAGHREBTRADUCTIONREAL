import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AnswerLog, GameConfig, GameResult } from '../types'
import { useGame, useProfile } from '../store/GameContext'
import { buildQuestions } from '../lib/game'
import { comboLevel, computeXp } from '../lib/xp'
import { playCombo, playCorrect, playTick, playWrong } from '../lib/sounds'
import { vibrate } from '../lib/haptics'
import { THEME_BY_ID } from '../data/themes'
import AnswerButton, { type AnswerState } from './AnswerButton'
import ComboBadge from './ComboBadge'

interface Props {
  config: GameConfig
  onFinish: (r: GameResult) => void
  onQuit: () => void
}

const CHRONO_MS = 60_000
const MAX_LIVES = 3
const LETTERS = ['A', 'B', 'C', 'D']
const MODE_LABEL: Record<GameConfig['mode'], string> = {
  rapide: 'Partie rapide', theme: 'Par thème', chrono: 'Contre-la-montre',
  survie: 'Survie', defi: 'Défi du jour', revision: 'Révision des erreurs',
}

export default function Game({ config, onFinish, onQuit }: Props) {
  const profile = useProfile()
  const { recordAnswer } = useGame()
  const [questions] = useState(() => buildQuestions(config, profile))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [combo, setCombo] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [xp, setXp] = useState(0)
  const [lastGain, setLastGain] = useState<{ xp: number; mult: number } | null>(null)
  const [remaining, setRemaining] = useState(CHRONO_MS)

  // Références : valeurs lues dans des callbacks asynchrones (timers)
  const indexRef = useRef(0)
  const livesRef = useRef(MAX_LIVES)
  const comboRef = useRef(0)
  const bestComboRef = useRef(0)
  const xpRef = useRef(0)
  const logRef = useRef<AnswerLog[]>([])
  const startRef = useRef(Date.now())
  const finishedRef = useRef(false)
  const timeoutsRef = useRef<number[]>([])

  const isChrono = config.mode === 'chrono'
  const isSurvie = config.mode === 'survie'
  const q = questions[index]

  const later = (fn: () => void, ms: number) => {
    timeoutsRef.current.push(window.setTimeout(fn, ms))
  }

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (logRef.current.length === 0) {
      onQuit()
      return
    }
    onFinish({ config, answers: logRef.current, xp: xpRef.current, bestCombo: bestComboRef.current })
  }, [config, onFinish, onQuit])

  const next = useCallback(() => {
    if (finishedRef.current) return
    const last = indexRef.current + 1 >= questions.length
    const dead = config.mode === 'survie' && livesRef.current <= 0
    if (last || dead) {
      finish()
      return
    }
    indexRef.current += 1
    setIndex(indexRef.current)
    setSelected(null)
    setLastGain(null)
    startRef.current = Date.now()
  }, [config.mode, finish, questions.length])

  // Les callbacks parents changent à chaque rendu : on lit toujours la dernière version via des refs
  const finishRef = useRef(finish)
  finishRef.current = finish
  const nextRef = useRef(next)
  nextRef.current = next

  // Nettoyage des timers
  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout) }, [])

  // Chrono global (mode contre-la-montre) + tic-tac sur les 5 dernières secondes
  useEffect(() => {
    if (!isChrono) return
    const end = Date.now() + CHRONO_MS
    let lastSec = Infinity
    const id = window.setInterval(() => {
      const left = Math.max(0, end - Date.now())
      setRemaining(left)
      const sec = Math.ceil(left / 1000)
      if (sec !== lastSec) {
        lastSec = sec
        if (sec <= 5 && sec > 0) playTick(sec === 1)
      }
      if (left <= 0) {
        clearInterval(id)
        finishRef.current()
      }
    }, 100)
    return () => clearInterval(id)
  }, [isChrono])

  const answer = (i: number) => {
    if (selected !== null || finishedRef.current) return
    const ms = Date.now() - startRef.current
    const correct = i === q.bonneReponse
    const comboBefore = comboRef.current
    const newCombo = correct ? comboBefore + 1 : 0

    if (correct) {
      const r = computeXp(q.difficulte, ms, comboBefore)
      xpRef.current += r.total
      setXp(xpRef.current)
      setLastGain({ xp: r.total, mult: r.mult })
      playCorrect()
      vibrate(30)
      if (comboLevel(newCombo) > comboLevel(comboBefore)) later(() => playCombo(comboLevel(newCombo)), 260)
    } else {
      setLastGain(null)
      playWrong()
      vibrate([60, 40, 60])
      if (isSurvie) {
        livesRef.current -= 1
        setLives(livesRef.current)
      }
    }
    comboRef.current = newCombo
    bestComboRef.current = Math.max(bestComboRef.current, newCombo)
    setCombo(newCombo)
    logRef.current.push({ q, chosen: i, correct, ms })
    recordAnswer(q, correct, ms)
    setSelected(i)

    // Contre-la-montre : on enchaîne vite (explications dans le récap de fin)
    if (isChrono) later(() => nextRef.current(), correct ? 550 : 900)
  }

  // Raccourcis clavier : 1-4 pour répondre, Entrée / espace pour continuer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4'].includes(e.key) && selected === null) answer(Number(e.key) - 1)
      else if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') && selected !== null && !isChrono) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!q) return null
  const theme = THEME_BY_ID[q.theme]
  const stateOf = (i: number): AnswerState => {
    if (selected === null) return 'idle'
    if (i === q.bonneReponse) return 'correct'
    if (i === selected) return 'wrong'
    return 'dim'
  }
  const wasCorrect = selected === q.bonneReponse
  const isLastQuestion = index + 1 >= questions.length || (isSurvie && lives <= 0)
  const timeFrac = remaining / CHRONO_MS
  const urgent = isChrono && remaining <= 5000

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-28 pt-4">
      {/* Barre du haut */}
      <header className="flex items-center gap-3 pr-14">
        <button onClick={finish} aria-label="Terminer la partie" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-xl font-black text-muted">
          ✕
        </button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs font-extrabold text-muted">
            <span>{MODE_LABEL[config.mode]}</span>
            <span>{isChrono ? `${Math.ceil(remaining / 1000)} s` : isSurvie ? `Question ${index + 1}` : `${index + 1} / ${questions.length}`}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-line">
            <motion.div
              className={`h-full rounded-full ${urgent ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-500 to-pink-500'}`}
              animate={{ width: `${(isChrono ? timeFrac : isSurvie ? 1 : (index + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }}
              transition={{ duration: isChrono ? 0.1 : 0.4, ease: 'linear' }}
            />
          </div>
        </div>
        {isSurvie && (
          <div className="flex gap-0.5 text-2xl" aria-label={`${lives} vie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <motion.span key={i} animate={i === lives ? { scale: [1, 1.6, 0], rotate: 20 } : {}} className={i < lives ? '' : 'opacity-25 grayscale'}>
                ❤️
              </motion.span>
            ))}
          </div>
        )}
        <div className="rounded-xl bg-amber-400/20 px-2.5 py-1 text-sm font-black text-amber-500">⭐ {xp}</div>
      </header>

      <ComboBadge combo={combo} />

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.main
          key={q.id + index}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-extrabold">
            <span className={`rounded-full bg-gradient-to-r ${theme.gradient} px-3 py-1 text-white`}>{theme.emoji} {theme.court}</span>
            <span className="text-amber-500" aria-label={`Difficulté ${q.difficulte} sur 3`}>
              {'★'.repeat(q.difficulte)}<span className="text-line">{'★'.repeat(3 - q.difficulte)}</span>
            </span>
          </div>
          <h1 className="card mb-4 p-5 text-xl font-extrabold leading-snug sm:text-2xl">{q.question}</h1>
          <div className="space-y-3">
            {q.reponses.map((r, i) => (
              <AnswerButton key={i} letter={LETTERS[i]} text={r} state={stateOf(i)} disabled={selected !== null} onClick={() => answer(i)} />
            ))}
          </div>

          {/* Explication (sauf contre-la-montre) */}
          <AnimatePresence>
            {selected !== null && !isChrono && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 rounded-2xl border-2 p-4 ${wasCorrect ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-rose-500/50 bg-rose-500/10'}`}
                role="status"
              >
                <p className="flex items-center justify-between text-lg font-black">
                  <span>{wasCorrect ? '✅ Bien joué !' : '❌ Raté…'}</span>
                  {lastGain && (
                    <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-amber-500">
                      +{lastGain.xp} XP{lastGain.mult > 1 && ` (x${lastGain.mult})`}
                    </motion.span>
                  )}
                </p>
                <p className="mt-1 font-semibold leading-relaxed">{q.explication}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {isChrono && selected !== null && lastGain && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: -4 }} className="mt-3 text-center text-xl font-black text-amber-500">
              +{lastGain.xp} XP{lastGain.mult > 1 && ` (x${lastGain.mult})`}
            </motion.p>
          )}
        </motion.main>
      </AnimatePresence>

      {/* Bouton Suivant */}
      {selected !== null && !isChrono && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pb-5 pt-8">
          <div className="mx-auto max-w-2xl">
            <button onClick={next} className="btn-big bg-gradient-to-r from-violet-500 to-pink-500">
              {isLastQuestion ? 'Voir mon score 🏁' : 'Suivant →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
