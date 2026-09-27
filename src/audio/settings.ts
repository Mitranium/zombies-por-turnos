/**
 * Global sound on/off flag. Persisted separately from the player profile so a
 * corrupt or full storage never breaks the game: worst case the choice is
 * forgotten.
 */
const STORAGE_KEY = 'zpt-muted';

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readStoredMute();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage may be blocked (private mode); keeping the toggle working for
    // this session is enough.
  }
}
