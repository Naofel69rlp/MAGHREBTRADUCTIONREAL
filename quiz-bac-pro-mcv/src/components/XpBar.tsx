import { motion } from 'framer-motion'
import { levelInfo } from '../data/levels'

export default function XpBar({ xp }: { xp: number }) {
  const info = levelInfo(xp)
  return (
    <div>
      <div className="h-4 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${info.progress * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs font-bold text-muted">
        <span>{xp} XP</span>
        <span>{info.next ? `Prochain : ${info.next.titre} (${info.next.min} XP)` : 'Niveau maximum !'}</span>
      </div>
    </div>
  )
}
