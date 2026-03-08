/**
 * Hook para gerar dados mock de Tobii (gaze) e Muse (EEG) em tempo real
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { EEGBands, GazePoint, NeuroMode } from '@/shared-core/types/neuro';
import { SAFETY_LIMITS } from '@/shared-core/types/neuro';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

// Simple 1D Kalman filter for smoothing
function kalmanSmooth(prev: number, measurement: number, gain = 0.15): number {
  return prev + gain * (measurement - prev);
}

function generateEEG(prev: EEGBands): EEGBands {
  const noise = () => (Math.random() - 0.5) * 0.08;
  return {
    delta: clamp(kalmanSmooth(prev.delta, prev.delta + noise()), 0, 1),
    theta: clamp(kalmanSmooth(prev.theta, prev.theta + noise()), 0, 1),
    alpha: clamp(kalmanSmooth(prev.alpha, prev.alpha + noise()), 0, 1),
    beta: clamp(kalmanSmooth(prev.beta, prev.beta + noise()), 0, 1),
    gamma: clamp(kalmanSmooth(prev.gamma, prev.gamma + noise()), 0, 1),
    timestamp: Date.now(),
  };
}

function generateGaze(prev: GazePoint): GazePoint {
  const noise = () => (Math.random() - 0.5) * 0.06;
  return {
    x: clamp(kalmanSmooth(prev.x, prev.x + noise()), -1, 1),
    y: clamp(kalmanSmooth(prev.y, prev.y + noise()), -1, 1),
    pupilDiameter: clamp(prev.pupilDiameter + (Math.random() - 0.5) * 0.2, 2, 8),
    confidence: clamp(0.85 + Math.random() * 0.15, 0, 1),
    timestamp: Date.now(),
  };
}

export function useNeuroMock(active = true, interval = 50) {
  const [eeg, setEeg] = useState<EEGBands>({
    delta: 0.3, theta: 0.25, alpha: 0.4, beta: 0.35, gamma: 0.15, timestamp: Date.now(),
  });
  const [gaze, setGaze] = useState<GazePoint>({
    x: 0, y: 0, pupilDiameter: 4, confidence: 0.9, timestamp: Date.now(),
  });
  const [isArtifact, setIsArtifact] = useState(false);
  const eegRef = useRef(eeg);
  const gazeRef = useRef(gaze);

  useEffect(() => { eegRef.current = eeg; }, [eeg]);
  useEffect(() => { gazeRef.current = gaze; }, [gaze]);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const newEeg = generateEEG(eegRef.current);
      const newGaze = generateGaze(gazeRef.current);
      setEeg(newEeg);
      setGaze(newGaze);
      // Simulate artifact spikes rarely
      const maxBand = Math.max(newEeg.delta, newEeg.theta, newEeg.alpha, newEeg.beta, newEeg.gamma);
      setIsArtifact(maxBand > SAFETY_LIMITS.EEG_ARTIFACT_THRESHOLD);
    }, interval);
    return () => clearInterval(iv);
  }, [active, interval]);

  // Detect neuro intent from EEG+gaze
  const detectIntent = useCallback((): NeuroMode => {
    if (isArtifact) return 'emergency';
    if (eeg.beta > 0.6) return 'mind_walk';
    if (eeg.alpha > 0.5 && gaze.pupilDiameter > 5.5) return 'focus_gesture';
    if (Math.abs(gaze.x) > 0.4 || Math.abs(gaze.y) > 0.4) return 'gaze_nav';
    return 'manual';
  }, [eeg, gaze, isArtifact]);

  return { eeg, gaze, isArtifact, detectIntent };
}
