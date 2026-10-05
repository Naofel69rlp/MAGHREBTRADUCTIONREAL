import { motion } from 'framer-motion'
import type { ThemeId } from '../types'
import { THEMES } from '../data/themes'
import { ALL_QUESTIONS } from '../lib/game'
import { useProfile } from '../store/GameContext'
import { masteryOf } from '../lib/profile'

export default function ThemeSelect({ onPick, onBack }: { onPick: (t: ThemeId) => void; onBack: () => void }) {
  const profile = useProfile()
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-5">
      <button onClick={onBack} className="mb-3 rounded-xl px-2 py-2 text-lg font-extrabold text-muted">← Retour</button>
      <h1 className="text-3xl font-black">Choisis un thème</h1>
      <p className="mb-4 font-bold text-muted">10 questions du bloc de ton choix.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((t, i) => {
          const count = ALL_QUESTIONS.filter(q => q.theme === t.id).length
          const m = masteryOf(profile, t.id)
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(t.id)}
              className={`flex min-h-[96px] items-center gap-4 rounded-3xl bg-gradient-to-br ${t.gradient} p-4 text-left text-white shadow-lg`}
            >
              <span className="text-4xl">{t.emoji}</span>
              <span className="min-w-0">
                <span className="block text-lg font-black leading-tight">{t.nom}</span>
                <span className="block text-sm font-bold text-white/85">
                  {count} questions · {m.answered ? `${m.pct} % de réussite` : 'à découvrir'}
                </span>
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
