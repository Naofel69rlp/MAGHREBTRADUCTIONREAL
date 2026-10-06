import { useEffect, useState } from 'react'
import type { GameConfig, GameResult, GameSummary, ThemeId } from './types'
import { GameProvider, useGame } from './store/GameContext'
import { playClick } from './lib/sounds'
import Onboarding from './components/Onboarding'
import Home from './components/Home'
import ThemeSelect from './components/ThemeSelect'
import Game from './components/Game'
import Result from './components/Result'
import Stats from './components/Stats'
import MuteButton from './components/MuteButton'

type View =
  | { name: 'home' }
  | { name: 'themes' }
  | { name: 'stats' }
  | { name: 'game'; config: GameConfig; run: number }
  | { name: 'result'; summary: GameSummary; run: number }

function Screens() {
  const { profile, finishGame } = useGame()
  const [view, setView] = useState<View>({ name: 'home' })

  // Son de clic sur tous les boutons (sauf ceux marqués data-nosound)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('button')
      if (btn && !btn.hasAttribute('data-nosound') && !(btn as HTMLButtonElement).disabled) playClick()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [view.name])

  // Déconnexion / réinitialisation : on revient à l'accueil à la prochaine connexion
  useEffect(() => { if (!profile) setView({ name: 'home' }) }, [profile])

  if (!profile) return <Onboarding />

  const play = (config: GameConfig, run = 0) => setView({ name: 'game', config, run })
  const home = () => setView({ name: 'home' })

  switch (view.name) {
    case 'themes':
      return <ThemeSelect onBack={home} onPick={(theme: ThemeId) => play({ mode: 'theme', theme })} />
    case 'stats':
      return <Stats onBack={home} />
    case 'game':
      return (
        <Game
          key={`${view.config.mode}-${view.config.theme ?? ''}-${view.run}`}
          config={view.config}
          onQuit={home}
          onFinish={(r: GameResult) => setView({ name: 'result', summary: finishGame(r), run: view.run })}
        />
      )
    case 'result':
      return <Result summary={view.summary} onHome={home} onReplay={() => play(view.summary.result.config, view.run + 1)} />
    default:
      return <Home onPlay={c => play(c)} onThemes={() => setView({ name: 'themes' })} onStats={() => setView({ name: 'stats' })} />
  }
}

export default function App() {
  return (
    <GameProvider>
      <MuteButton />
      <Screens />
    </GameProvider>
  )
}
