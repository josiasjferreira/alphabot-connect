// Simple synthesized background sounds using Web Audio API
const audioCtx = () => new (window.AudioContext || (window as any).webkitAudioContext)();

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
    const ctx = audioCtx();
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

    return () => {
      try { ctx.close(); } catch {}
    };
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
