import { useEffect, useState } from 'react'
import { isMuted, onMuteChange, playClick, setMuted } from '../lib/sounds'

/** Bouton mute, toujours accessible (fixé en haut à droite). */
export default function MuteButton() {
  const [muted, setM] = useState(isMuted())
  useEffect(() => onMuteChange(setM), [])
  return (
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
      className="fixed right-3 top-3 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card/90 text-2xl shadow-lg backdrop-blur active:scale-90"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
