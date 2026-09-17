import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

let player: AudioPlayer | null = null;

export async function playAudioUrl(url: string): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  } catch {
    /* ignore mode errors */
  }
  if (!player) {
    player = createAudioPlayer({ uri: url });
  } else {
    player.replace({ uri: url });
  }
  try {
    player.seekTo(0);
  } catch {
    /* ignore */
  }
  player.play();
}

export function stopAudio(): void {
  try {
    player?.pause();
  } catch {
    /* ignore */
  }
}
