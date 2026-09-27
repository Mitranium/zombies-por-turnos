import { isMuted } from './settings';

const MUSIC_VOLUME = 0.32;
const MUSIC_SRC = './audio/soundtrack.mp3';

let music: HTMLAudioElement | null = null;

export function startBgMusic(): void {
  if (!music) {
    music = new Audio(MUSIC_SRC);
    music.loop = true;
  }
  music.volume = isMuted() ? 0 : MUSIC_VOLUME;
  if (!isMuted() && music.paused) {
    void music.play().catch(() => {});
  }
}

/** Apply the current mute state to a soundtrack that may already be playing. */
export function syncMusicMute(): void {
  if (!music) return;
  music.volume = isMuted() ? 0 : MUSIC_VOLUME;
  if (isMuted()) music.pause();
  else void music.play().catch(() => {});
}
