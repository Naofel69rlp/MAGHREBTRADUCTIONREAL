import { motion } from 'framer-motion'

export default function StreakFlame({ days, active }: { days: number; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 rounded-2xl px-3 py-2 font-black ${
        days > 0 ? 'bg-orange-500/15 text-orange-500' : 'bg-line/60 text-muted'
      }`}
      aria-label={`Série de ${days} jour${days > 1 ? 's' : ''}`}
    >
      <motion.span
        className={`text-2xl ${days > 0 && !active ? 'grayscale' : ''}`}
        animate={days > 0 && active ? { scale: [1, 1.25, 1], rotate: [0, -6, 6, 0] } : {}}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        🔥
      </motion.span>
      <span className="text-xl">{days}</span>
    </div>
  )
}
