type SfxType = 'click' | 'hit' | 'heal' | 'death' | 'claim' | 'phase' | 'combat';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'square', gain = 0.08): void {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audio.destination);
  osc.start();
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.stop(audio.currentTime + duration);
}

export function playSfx(type: SfxType): void {
  switch (type) {
    case 'click':
      tone(440, 0.05, 'triangle', 0.05);
      break;
    case 'hit':
      tone(120, 0.12, 'sawtooth', 0.1);
      tone(80, 0.08, 'square', 0.06);
      break;
    case 'heal':
      tone(520, 0.08, 'sine', 0.06);
      tone(660, 0.12, 'sine', 0.05);
      break;
    case 'death':
      tone(90, 0.25, 'sawtooth', 0.12);
      break;
    case 'claim':
      tone(300, 0.1, 'triangle', 0.07);
      tone(450, 0.15, 'triangle', 0.06);
      break;
    case 'phase':
      tone(220, 0.08, 'sine', 0.05);
      break;
    case 'combat':
      tone(70, 0.2, 'sawtooth', 0.09);
      break;
  }
}

export function unlockAudio(): void {
  getCtx();
}
