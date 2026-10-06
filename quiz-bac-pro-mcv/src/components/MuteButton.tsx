import { useEffect, useState } from 'react'
import { isMusicOn, isMuted, onAudioChange, playClick, setMusicOn, setMuted } from '../lib/sounds'

const BTN =
  'flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card/90 text-2xl shadow-lg backdrop-blur active:scale-90'

/** Boutons son / musique, toujours accessibles (fixés en haut à droite). */
export default function MuteButton() {
  const [, force] = useState(0)
  useEffect(() => onAudioChange(() => force(n => n + 1)), [])
  const muted = isMuted()
  const music = isMusicOn()
  return (
    <div className="fixed right-3 top-3 z-50 flex gap-2">
      <button
        data-nosound
        aria-label={music ? 'Couper la musique' : 'Activer la musique'}
        aria-pressed={!music}
        onClick={() => { setMusicOn(!music); if (!muted) playClick() }}
        className={`${BTN} ${music && !muted ? '' : 'opacity-60'}`}
      >
        {music && !muted ? '🎵' : '🎶'}
        {(!music || muted) && <span className="absolute h-0.5 w-7 rotate-45 rounded bg-rose-500" />}
      </button>
      <button
        data-nosound
        aria-label={muted ? 'Activer le son' : 'Couper le son'}
        aria-pressed={muted}
        onClick={() => {
          if (muted) {
            setMuted(false)
            playClick()
          } else {
            setMuted(true)
          }
        }}
        className={BTN}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}
