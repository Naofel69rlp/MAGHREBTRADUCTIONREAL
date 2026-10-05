import { useState } from 'react'
import { useGame, useProfile } from '../store/GameContext'
import { THEMES } from '../data/themes'
import { BADGES } from '../data/badges'
import { levelInfo } from '../data/levels'
import { masteryOf, effectiveStreak } from '../lib/profile'
import MasteryBar from './MasteryBar'
import type { ModeId } from '../types'

const MODES: { id: ModeId; nom: string; unit: string }[] = [
  { id: 'rapide', nom: '⚡ Partie rapide', unit: '/ 10' },
  { id: 'theme', nom: '🗂️ Par thème', unit: '/ 10' },
  { id: 'chrono', nom: '⏱️ Contre-la-montre', unit: 'bonnes réponses' },
  { id: 'survie', nom: '❤️ Survie', unit: 'bonnes réponses' },
  { id: 'defi', nom: '📆 Défi du jour', unit: '/ 5' },
  { id: 'revision', nom: '🔁 Révision', unit: '/ 10' },
]

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-bold text-muted">{label}</p>
    </div>
  )
}

export default function Stats({ onBack }: { onBack: () => void }) {
  const profile = useProfile()
  const { updateSettings, resetAll } = useGame()
  const [confirmReset, setConfirmReset] = useState(false)
  const info = levelInfo(profile.xp)
  const rate = profile.answered ? Math.round((profile.correct / profile.answered) * 100) : 0
  const unlocked = BADGES.filter(b => profile.badges[b.id]).length

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-5">
      <button onClick={onBack} className="mb-3 rounded-xl px-2 py-2 text-lg font-extrabold text-muted">← Retour</button>
      <h1 className="text-3xl font-black">📊 Mes stats</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Questions répondues" value={profile.answered} />
        <Tile label="Taux de réussite" value={`${rate} %`} />
        <Tile label="Parties jouées" value={profile.counters.games} />
        <Tile label="Meilleure série" value={`${profile.streak.best} j 🔥`} />
      </div>
      <p className="mt-2 text-sm font-bold text-muted">
        Niveau {info.level} · {info.current.titre} · {profile.xp} XP · série actuelle : {effectiveStreak(profile)} jour(s)
      </p>

      <section className="card mt-5 p-4">
        <h2 className="mb-3 text-lg font-black">Réussite par thème</h2>
        <div className="space-y-3">
          {THEMES.map(t => <MasteryBar key={t.id} theme={t} {...masteryOf(profile, t.id)} />)}
        </div>
      </section>

      <section className="card mt-5 p-4">
        <h2 className="mb-3 text-lg font-black">🏆 Records</h2>
        <ul className="divide-y divide-line">
          {MODES.map(m => (
            <li key={m.id} className="flex items-center justify-between py-2 font-extrabold">
              <span>{m.nom}</span>
              <span className="text-violet-500">{profile.records[m.id] ? `${profile.records[m.id]} ${m.unit}` : '—'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-black">🎖️ Badges ({unlocked}/{BADGES.length})</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BADGES.map(b => {
            const got = profile.badges[b.id]
            return (
              <div key={b.id} className={`card p-3 text-center ${got ? 'border-amber-400/60' : 'opacity-60'}`}>
                <p className={`text-4xl ${got ? '' : 'grayscale'}`}>{got ? b.emoji : '🔒'}</p>
                <p className="mt-1 text-sm font-black leading-tight">{b.nom}</p>
                <p className="mt-1 text-xs font-semibold leading-snug text-muted">{b.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card mt-5 p-4">
        <h2 className="mb-3 text-lg font-black">⚙️ Réglages</h2>
        <label className="flex min-h-[48px] items-center justify-between font-extrabold">
          Vibrations
          <input type="checkbox" className="h-6 w-6 accent-violet-500" checked={profile.settings.vibration} onChange={e => updateSettings({ vibration: e.target.checked })} />
        </label>
        <label className="flex min-h-[48px] items-center justify-between font-extrabold">
          Mode sombre
          <input type="checkbox" className="h-6 w-6 accent-violet-500" checked={profile.settings.theme === 'dark'} onChange={e => updateSettings({ theme: e.target.checked ? 'dark' : 'light' })} />
        </label>
        {confirmReset ? (
          <div className="mt-3 rounded-2xl border-2 border-rose-500/50 p-3">
            <p className="font-bold">Effacer toute ta progression (niveau, badges, série) ?</p>
            <div className="mt-2 flex gap-2">
              <button onClick={resetAll} className="flex-1 rounded-xl bg-rose-500 py-3 font-black text-white">Oui, tout effacer</button>
              <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl bg-line py-3 font-black">Annuler</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="mt-3 w-full rounded-xl border-2 border-line py-3 font-extrabold text-muted">
            Réinitialiser ma progression
          </button>
        )}
      </section>
    </div>
  )
}
