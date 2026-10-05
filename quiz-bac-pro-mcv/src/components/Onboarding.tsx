import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../store/GameContext'

export default function Onboarding() {
  const { createProfile } = useGame()
  const [pseudo, setPseudo] = useState('')
  const ok = pseudo.trim().length >= 2

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ok) createProfile(pseudo)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <motion.div
          animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
          className="text-7xl"
        >
          🛍️
        </motion.div>
        <h1 className="mt-4 text-4xl font-black leading-tight">
          MCV <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">Quiz</span>
        </h1>
        <p className="mt-2 font-bold text-muted">Bac Pro Métiers du Commerce et de la Vente · Option B · Terminale</p>
      </motion.div>

      <form onSubmit={submit} className="card mt-8 p-5">
        <label htmlFor="pseudo" className="block text-lg font-extrabold">Comment on t'appelle ?</label>
        <input
          id="pseudo"
          autoFocus
          maxLength={16}
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          placeholder="Ton pseudo"
          autoComplete="nickname"
          className="mt-3 w-full rounded-2xl border-2 border-line bg-bg px-4 py-4 text-xl font-bold placeholder:text-muted/60 focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={!ok}
          className="btn-big mt-4 bg-gradient-to-r from-violet-500 to-pink-500 disabled:opacity-40"
        >
          C'est parti ! 🚀
        </button>
        <p className="mt-3 text-center text-sm text-muted">
          Ta progression est enregistrée sur cet appareil. Joue chaque jour pour garder ta série 🔥
        </p>
      </form>
    </div>
  )
}
