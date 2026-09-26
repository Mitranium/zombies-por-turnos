type SfxType =
  | 'click'
  | 'hit'
  | 'heal'
  | 'death'
  | 'claim'
  | 'combat'
  | 'dice'
  | 'special'
  | 'locked'
  | 'wave';

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

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

/** One shared second of white noise; every noise effect plays a slice of it. */
function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== audio.sampleRate) {
    const frames = audio.sampleRate;
    noiseBuffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  gain = 0.08,
  delay = 0,
  endFreq = freq,
): void {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  const start = audio.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
  osc.start(start);
  osc.stop(start + duration);
}

function noise(duration: number, gain = 0.04, cutoff = 900, delay = 0): void {
  const audio = getCtx();
  if (!audio) return;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const g = audio.createGain();
  const start = audio.currentTime + delay;
  source.buffer = getNoiseBuffer(audio);
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    g.disconnect();
  };
  source.start(start);
  source.stop(start + duration);
}

export function playSfx(type: SfxType): void {
  switch (type) {
    case 'click':
      tone(440, 0.05, 'triangle', 0.05);
      break;
    case 'hit':
      noise(0.12, 0.09, 620);
      tone(125, 0.13, 'sawtooth', 0.075, 0, 58);
      break;
    case 'heal':
      tone(520, 0.08, 'sine', 0.06);
      tone(660, 0.12, 'sine', 0.05);
      break;
    case 'death':
      noise(0.24, 0.08, 430);
      tone(105, 0.3, 'sawtooth', 0.1, 0, 38);
      break;
    case 'claim':
      tone(300, 0.1, 'triangle', 0.07);
      tone(450, 0.15, 'triangle', 0.06);
      break;
    case 'combat':
      tone(72, 0.24, 'sawtooth', 0.09, 0, 46);
      tone(96, 0.2, 'square', 0.04, 0.08, 62);
      break;
    case 'dice':
      noise(0.06, 0.04, 1800);
      tone(520, 0.035, 'square', 0.025);
      tone(390, 0.04, 'square', 0.02, 0.055);
      break;
    case 'special':
      noise(0.2, 0.065, 1500);
      tone(180, 0.22, 'sawtooth', 0.07, 0, 620);
      tone(720, 0.12, 'triangle', 0.045, 0.12, 260);
      break;
    case 'locked':
      tone(145, 0.07, 'square', 0.045);
      tone(105, 0.09, 'square', 0.04, 0.08);
      break;
    case 'wave':
      tone(294, 0.12, 'triangle', 0.055);
      tone(392, 0.12, 'triangle', 0.055, 0.1);
      tone(523, 0.2, 'triangle', 0.065, 0.2);
      break;
  }
}

export function unlockAudio(): void {
  getCtx();
}
