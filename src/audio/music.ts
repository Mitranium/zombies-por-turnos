const MUSIC_VOLUME = 0.32;

// Asset lives in public/: resolve it against the deploy base so it keeps
// working when the app is served from a sub-path.
const MUSIC_SRC = `${import.meta.env.BASE_URL}audio/soundtrack.mp3`;

let music: HTMLAudioElement | null = null;

export function startBgMusic(): void {
  if (!music) {
    music = new Audio(MUSIC_SRC);
    music.loop = true;
    music.volume = MUSIC_VOLUME;
  }
  if (music.paused) {
    void music.play().catch(() => {});
  }
}

export function stopBgMusic(): void {
  if (!music) return;
  music.pause();
}

/** Whether the soundtrack is currently audible (used to pause/resume on tab hide). */
export function isBgMusicPlaying(): boolean {
  return music !== null && !music.paused;
}
