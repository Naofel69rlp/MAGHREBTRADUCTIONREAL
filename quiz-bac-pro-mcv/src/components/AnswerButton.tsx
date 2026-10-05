import { motion } from 'framer-motion'

export type AnswerState = 'idle' | 'correct' | 'wrong' | 'dim'

const STYLES: Record<AnswerState, string> = {
  idle: 'border-line bg-card hover:border-violet-400 active:scale-[0.98]',
  correct: 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
  wrong: 'border-rose-500 bg-rose-500 text-white animate-shake',
  dim: 'border-line bg-card opacity-45',
}

interface Props {
  letter: string
  text: string
  state: AnswerState
  disabled: boolean
  onClick: () => void
}

export default function AnswerButton({ letter, text, state, disabled, onClick }: Props) {
  return (
    <motion.button
      data-nosound
      layout
      animate={state === 'correct' ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base font-bold leading-snug transition-colors sm:text-lg ${STYLES[state]}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-black ${
          state === 'idle' || state === 'dim' ? 'bg-violet-500/15 text-violet-500' : 'bg-white/25 text-white'
        }`}
      >
        {state === 'correct' ? '✓' : state === 'wrong' ? '✗' : letter}
      </span>
      <span className="flex-1">{text}</span>
    </motion.button>
  )
}
