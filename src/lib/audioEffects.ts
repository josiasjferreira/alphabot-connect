// Simple synthesized background sounds using Web Audio API
let sharedCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (Android WebView requires user gesture)
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
};

/** Call this once on any user tap/click to unlock audio on Android */
export const unlockAudio = (): void => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Create and immediately stop a silent buffer to unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {}
};

type ToneType = 'happy' | 'warm' | 'love' | 'celebrate' | 'magic';

const toneConfigs: Record<ToneType, { notes: number[]; duration: number; waveform: OscillatorType }> = {
  happy: { notes: [523, 659, 784, 659, 523], duration: 0.3, waveform: 'sine' },
  warm: { notes: [392, 440, 523, 587, 659], duration: 0.4, waveform: 'triangle' },
  love: { notes: [440, 554, 659, 554, 440, 554, 659], duration: 0.35, waveform: 'sine' },
  celebrate: { notes: [523, 659, 784, 880, 1047, 880, 784], duration: 0.2, waveform: 'square' },
  magic: { notes: [659, 784, 880, 1047, 1319], duration: 0.25, waveform: 'sine' },
};

export const playBackgroundTone = (type: ToneType, volume = 0.15): (() => void) => {
  try {
    const ctx = getAudioContext();
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.connect(ctx.destination);

    const config = toneConfigs[type];
    let time = ctx.currentTime;

    config.notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = config.waveform;
      osc.frequency.setValueAtTime(freq, time);
      
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(volume, time);
      noteGain.gain.exponentialRampToValueAtTime(0.01, time + config.duration);
      
      osc.connect(noteGain);
      noteGain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + config.duration);
      time += config.duration * 0.8;
    });

    return () => {};
  } catch {
    return () => {};
  }
};

export const animationSounds: Record<string, ToneType> = {
  wave: 'happy',
  welcome: 'warm',
  love: 'love',
  celebrate: 'celebrate',
  star: 'magic',
  custom: 'happy',
};
