import { AnimatePresence, motion } from 'framer-motion'
import { comboLevel, comboMultiplier } from '../lib/xp'

const STYLES = [
  '',
  'from-amber-400 to-orange-500 shadow-orange-500/40',
  'from-orange-500 to-rose-500 shadow-rose-500/40',
  'from-fuchsia-500 to-violet-600 shadow-violet-500/50',
]
const SCALE = [1, 1, 1.15, 1.3]
const TEXT = ['', 'text-xl', 'text-2xl', 'text-3xl']

/** Affichage du combo : grossit et change de couleur à chaque palier (x2, x3, x5). */
export default function ComboBadge({ combo }: { combo: number }) {
  const lvl = comboLevel(combo)
  const next = combo < 3 ? 3 : combo < 5 ? 5 : combo < 10 ? 10 : null
  return (
    <div className="flex h-14 items-center justify-center">
      <AnimatePresence mode="wait">
        {lvl > 0 ? (
          <motion.div
            key={lvl}
            initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
            animate={{ scale: SCALE[lvl], rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14 }}
            className={`rounded-full bg-gradient-to-r px-5 py-1.5 font-black text-white shadow-lg ${STYLES[lvl]} ${TEXT[lvl]}`}
          >
            🔥 COMBO x{comboMultiplier(combo)} <span className="text-base opacity-80">· {combo} d'affilée</span>
          </motion.div>
        ) : (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-bold text-muted">
            {combo > 0 ? `Encore ${3 - combo} bonne${3 - combo > 1 ? 's' : ''} réponse${3 - combo > 1 ? 's' : ''} pour le combo x2 !` : 'Enchaîne les bonnes réponses pour lancer un combo'}
          </motion.p>
        )}
      </AnimatePresence>
      {lvl > 0 && next && <span className="sr-only">Prochain palier à {next}</span>}
    </div>
  )
}
