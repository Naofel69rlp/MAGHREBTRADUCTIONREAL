import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { GameSummary } from '../types'
import { levelInfo, LEVELS } from '../data/levels'
import { BADGE_BY_ID } from '../data/badges'
import { playBadge, playLevelUp } from '../lib/sounds'
import { vibrate } from '../lib/haptics'
import AiExplain from './AiExplain'

interface Props {
  summary: GameSummary
  onReplay: () => void
  onHome: () => void
}

function burst(big = false) {
  const base = { disableForReducedMotion: true, colors: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#38bdf8'] }
  confetti({ ...base, particleCount: big ? 160 : 90, spread: big ? 100 : 70, origin: { y: 0.4 } })
  if (big) {
    setTimeout(() => confetti({ ...base, particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.6 } }), 250)
    setTimeout(() => confetti({ ...base, particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.6 } }), 250)
  }
}

function headline(ratio: number, perfect: boolean): string {
  if (perfect) return 'Sans faute ! 🤩'
  if (ratio >= 0.8) return 'Excellent ! 🔥'
  if (ratio >= 0.5) return 'Bien joué ! 👍'
  return 'Continue, tu progresses ! 💪'
}

export default function Result({ summary, onReplay, onHome }: Props) {
  const { correct, total, xpAnswers, xpBonus, levelBefore, levelAfter, xpBefore, xpAfter, newBadges, record, perfect, dailyReplay, result } = summary
  const levelUp = levelAfter > levelBefore
  const ratio = total ? correct / total : 0
  const before = levelInfo(xpBefore)
  const after = levelInfo(xpAfter)
  const isTimed = result.config.mode === 'chrono' || result.config.mode === 'survie'
  const mistakes = useMemo(() => result.answers.filter(a => !a.correct), [result.answers])

  // Animations / sons d'arrivée
  useEffect(() => {
    const timers: number[] = []
    const t = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
    if (levelUp) {
      t(() => { playLevelUp(); burst(true); vibrate([80, 50, 80, 50, 200]) }, 900)
      if (newBadges.length) t(playBadge, 2300)
    } else {
      if (record.isNew || perfect || ratio >= 0.8) t(() => burst(perfect || record.isNew), 500)
      if (newBadges.length) t(playBadge, 800)
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animation de la barre d'XP : si montée de niveau, elle se remplit puis repart du début
  const barKeyframes = levelUp
    ? [before.progress * 100, 100, 0, after.progress * 100]
    : [before.progress * 100, after.progress * 100]
  const barTimes = levelUp ? [0, 0.4, 0.41, 1] : [0, 1]

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="card p-6 text-center">
        <p className="text-2xl font-black">{headline(ratio, perfect)}</p>
        <motion.p
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
          className="mt-2 bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-7xl font-black text-transparent"
        >
          {isTimed ? correct : `${correct}/${total}`}
        </motion.p>
        <p className="font-bold text-muted">
          {isTimed ? `bonne${correct > 1 ? 's' : ''} réponse${correct > 1 ? 's' : ''} sur ${total}` : 'bonnes réponses'}
        </p>

        {record.isNew && (
          <motion.p
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: [0, 1.2, 1], rotate: 0 }}
            transition={{ delay: 0.5 }}
            className="mx-auto mt-3 inline-block rounded-full bg-amber-400 px-4 py-1.5 text-lg font-black text-amber-950"
          >
            🏆 Nouveau record ! {record.previous > 0 && <span className="text-sm font-bold">(avant : {record.previous})</span>}
          </motion.p>
        )}
        {!record.isNew && record.value > 0 && !dailyReplay && (
          <p className="mt-2 text-sm font-bold text-muted">Record personnel : {record.value}</p>
        )}

        {/* XP */}
        <div className="mt-5 rounded-2xl bg-bg p-4 text-left">
          {dailyReplay ? (
            <p className="text-center font-bold text-muted">Défi du jour déjà relevé : pas d'XP en plus. Reviens demain ! 📆</p>
          ) : (
            <>
              <div className="flex items-center justify-between font-extrabold">
                <span>⭐ XP gagné</span>
                <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-2xl text-amber-500">+{xpAnswers + xpBonus}</motion.span>
              </div>
              <p className="text-sm font-semibold text-muted">
                {xpAnswers} XP en réponses + {xpBonus} XP {perfect ? 'de bonus « sans faute »' : 'de participation'}
              </p>
            </>
          )}
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400"
              initial={{ width: `${barKeyframes[0]}%` }}
              animate={{ width: barKeyframes.map(v => `${v}%`) }}
              transition={{ duration: levelUp ? 2.2 : 1.2, delay: 0.4, times: barTimes, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-1 text-xs font-bold text-muted">
            Niv. {levelAfter} · {after.current.titre} — {xpAfter} XP{after.next ? ` / ${after.next.min}` : ''}
          </p>
        </div>

        {/* Montée de niveau */}
        {levelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.9, type: 'spring', stiffness: 220, damping: 12 }}
            className="mt-4 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 p-5 text-white shadow-xl"
          >
            <p className="text-sm font-black uppercase tracking-widest">Niveau supérieur !</p>
            <motion.p animate={{ scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="my-1 text-6xl">
              {LEVELS[levelAfter - 1].emoji}
            </motion.p>
            <p className="text-2xl font-black">{LEVELS[levelAfter - 1].titre}</p>
          </motion.div>
        )}
      </motion.div>

      {/* Badges */}
      {newBadges.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-lg font-black">🎖️ Badge{newBadges.length > 1 ? 's' : ''} débloqué{newBadges.length > 1 ? 's' : ''}</h2>
          <div className="space-y-2">
            {newBadges.map((id, i) => {
              const b = BADGE_BY_ID[id]
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (levelUp ? 1.6 : 0.6) + i * 0.2 }}
                  className="card flex items-center gap-3 border-amber-400/60 p-3"
                >
                  <span className="text-4xl">{b.emoji}</span>
                  <span>
                    <span className="block font-black">{b.nom}</span>
                    <span className="block text-sm font-semibold text-muted">{b.desc}</span>
                  </span>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* Récap des erreurs */}
      {mistakes.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-lg font-black">À retenir ({mistakes.length})</h2>
          <div className="space-y-2">
            {mistakes.map(a => (
              <details key={a.q.id} className="card p-4">
                <summary className="cursor-pointer font-extrabold">❌ {a.q.question}</summary>
                <p className="mt-2 text-sm font-bold text-emerald-500">✓ {a.q.reponses[a.q.bonneReponse]}</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">{a.q.explication}</p>
                <AiExplain q={a.q} chosen={a.chosen} />
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-3">
        <motion.button
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          onClick={onReplay}
          className="btn-big bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 py-5 text-2xl"
        >
          🔁 Rejouer
        </motion.button>
        <button onClick={onHome} className="btn-big bg-gradient-to-r from-slate-600 to-slate-500 text-base">🏠 Accueil</button>
      </div>
    </div>
  )
}
