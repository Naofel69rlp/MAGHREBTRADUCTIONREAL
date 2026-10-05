import { motion } from 'framer-motion'
import type { GameConfig } from '../types'
import { useProfile } from '../store/GameContext'
import { levelInfo } from '../data/levels'
import { THEMES } from '../data/themes'
import { effectiveStreak, masteryOf, playedToday, reviewCount } from '../lib/profile'
import { todayKey } from '../lib/game'
import StreakFlame from './StreakFlame'
import MasteryBar from './MasteryBar'
import XpBar from './XpBar'

interface Props {
  onPlay: (c: GameConfig) => void
  onThemes: () => void
  onStats: () => void
}

function streakMessage(streak: number, done: boolean): string {
  if (done) return streak > 1 ? `Série validée aujourd'hui : ${streak} jours d'affilée ! Reviens demain 💪` : 'Série lancée ! Reviens demain pour la continuer 💪'
  if (streak > 0) return `⚠️ Ta série de ${streak} jour${streak > 1 ? 's' : ''} est en danger ! Joue une partie pour la garder.`
  return 'Joue une partie aujourd\'hui pour lancer ta série 🔥'
}

export default function Home({ onPlay, onThemes, onStats }: Props) {
  const profile = useProfile()
  const info = levelInfo(profile.xp)
  const streak = effectiveStreak(profile)
  const done = playedToday(profile)
  const daily = profile.daily[todayKey()]
  const toReview = reviewCount(profile)

  const modes: { id: string; emoji: string; titre: string; desc: string; gradient: string; action: () => void; disabled?: boolean }[] = [
    { id: 'rapide', emoji: '⚡', titre: 'Partie rapide', desc: '10 questions, tous thèmes', gradient: 'from-violet-500 to-fuchsia-500', action: () => onPlay({ mode: 'rapide' }) },
    { id: 'theme', emoji: '🗂️', titre: 'Par thème', desc: 'Choisis un bloc', gradient: 'from-sky-500 to-cyan-400', action: onThemes },
    { id: 'chrono', emoji: '⏱️', titre: 'Contre-la-montre', desc: '60 secondes, un max de points', gradient: 'from-amber-500 to-orange-500', action: () => onPlay({ mode: 'chrono' }) },
    { id: 'survie', emoji: '❤️', titre: 'Survie', desc: '3 vies, jusqu\'au bout', gradient: 'from-rose-500 to-red-500', action: () => onPlay({ mode: 'survie' }) },
    {
      id: 'revision', emoji: '🔁', titre: 'Révision des erreurs',
      desc: toReview ? `${toReview} question${toReview > 1 ? 's' : ''} à revoir` : 'Rien à revoir, bravo !',
      gradient: 'from-emerald-500 to-teal-500', action: () => onPlay({ mode: 'revision' }), disabled: toReview === 0,
    },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-5">
      {/* Profil */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-4 pr-16">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 text-4xl shadow-md">
            {info.current.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black">{profile.pseudo}</p>
            <p className="font-extrabold text-violet-500">Niv. {info.level} · {info.current.titre}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1"><XpBar xp={profile.xp} /></div>
        </div>
      </motion.section>

      {/* Série */}
      <section className={`mt-4 flex items-center gap-3 rounded-3xl border p-3 ${done ? 'border-emerald-500/40 bg-emerald-500/10' : streak > 0 ? 'border-orange-500/50 bg-orange-500/10' : 'border-line bg-card'}`}>
        <StreakFlame days={streak} active={done} />
        <p className="text-sm font-extrabold leading-snug">{streakMessage(streak, done)}</p>
      </section>

      {/* Défi du jour */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => onPlay({ mode: 'defi' })}
        className="mt-4 w-full rounded-3xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600 p-5 text-left text-white shadow-xl shadow-fuchsia-500/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wider text-white/80">Défi du jour</p>
            <p className="mt-1 text-2xl font-black">5 questions, pour tout le monde 📆</p>
          </div>
          <span className="text-5xl">{daily ? '✅' : '🎁'}</span>
        </div>
        <p className="mt-2 font-bold text-white/90">
          {daily ? `Terminé : ${daily.score}/${daily.total} — rejouer sans XP ou reviens demain !` : 'Un seul essai qui rapporte de l\'XP. Relève-le !'}
        </p>
      </motion.button>

      {/* Modes */}
      <h2 className="mb-2 mt-6 text-lg font-black">Choisis ton mode</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {modes.map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileTap={{ scale: m.disabled ? 1 : 0.97 }}
            disabled={m.disabled}
            onClick={m.action}
            className={`flex min-h-[84px] items-center gap-4 rounded-3xl bg-gradient-to-br ${m.gradient} p-4 text-left text-white shadow-lg disabled:opacity-40 ${i === 4 ? 'sm:col-span-2' : ''}`}
          >
            <span className="text-4xl">{m.emoji}</span>
            <span>
              <span className="block text-xl font-black leading-tight">{m.titre}</span>
              <span className="block text-sm font-bold text-white/85">{m.desc}</span>
            </span>
          </motion.button>
        ))}
      </div>

      {/* Maîtrise */}
      <section className="card mt-6 p-4">
        <h2 className="mb-3 text-lg font-black">Ma maîtrise par thème</h2>
        <div className="space-y-3">
          {THEMES.map(t => {
            const m = masteryOf(profile, t.id)
            return <MasteryBar key={t.id} theme={t} {...m} />
          })}
        </div>
      </section>

      <button onClick={onStats} className="btn-big mt-5 bg-gradient-to-r from-slate-600 to-slate-500 text-base">
        📊 Mes stats, badges et records
      </button>
    </div>
  )
}
