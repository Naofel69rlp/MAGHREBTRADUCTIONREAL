import { motion } from 'framer-motion'
import type { ThemeInfo } from '../data/themes'

interface Props {
  theme: ThemeInfo
  pct: number
  answered: number
  correct: number
}

export default function MasteryBar({ theme, pct, answered, correct }: Props) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm font-extrabold">
        <span className="truncate">{theme.emoji} {theme.court}</span>
        <span className="shrink-0 text-muted">
          {answered ? `${pct} %` : 'Pas encore joué'}
          {answered > 0 && <span className="ml-1 font-semibold">({correct}/{answered})</span>}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={`h-full rounded-full ${theme.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
