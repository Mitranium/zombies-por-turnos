let music: HTMLAudioElement | null = null;

const MUSIC_SRC = './audio/soundtrack.mp3';

export function startBgMusic(): void {
  if (!music) {
    music = new Audio(MUSIC_SRC);
    music.loop = true;
  }
  music.volume = 0.32;
  if (music.paused) {
    void music.play().catch(() => {});
  }
}
