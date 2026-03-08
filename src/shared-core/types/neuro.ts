/**
 * shared-core/types/neuro.ts
 * Tipos para integração NeuroControl — Tobii (eye-tracking) + Muse (EEG)
 */

// ─── EEG Bands (Muse) ───

export interface EEGBands {
  delta: number;   // 0-1 (sleep)
  theta: number;   // 0-1 (drowsy/meditative)
  alpha: number;   // 0-1 (relaxed)
  beta: number;    // 0-1 (focused/active)
  gamma: number;   // 0-1 (high cognition)
  timestamp: number;
}

export interface EEGChannels {
  tp9: number;
  af7: number;
  af8: number;
  tp10: number;
}

// ─── Gaze (Tobii) ───

export interface GazePoint {
  x: number; // -1 to 1 (normalized screen)
  y: number; // -1 to 1
  pupilDiameter: number; // mm
  confidence: number; // 0-1
  timestamp: number;
}

// ─── Joint Control ───

export interface JointAngles {
  headPan: number;     // -90 to 90
  headTilt: number;    // -45 to 45
  leftShoulder: number;  // 0 to 180
  rightShoulder: number; // 0 to 180
  leftElbow: number;     // 0 to 135
  rightElbow: number;    // 0 to 135
  waist: number;         // -45 to 45
}

export const JOINT_LIMITS: Record<keyof JointAngles, [number, number]> = {
  headPan: [-90, 90],
  headTilt: [-45, 45],
  leftShoulder: [0, 180],
  rightShoulder: [0, 180],
  leftElbow: [0, 135],
  rightElbow: [0, 135],
  waist: [-45, 45],
};

export const JOINT_LABELS: Record<keyof JointAngles, string> = {
  headPan: 'Cabeça (Pan)',
  headTilt: 'Cabeça (Tilt)',
  leftShoulder: 'Ombro Esq.',
  rightShoulder: 'Ombro Dir.',
  leftElbow: 'Cotovelo Esq.',
  rightElbow: 'Cotovelo Dir.',
  waist: 'Cintura',
};

// ─── NeuroControl Modes ───

export type NeuroMode = 'manual' | 'gaze_nav' | 'mind_walk' | 'focus_gesture' | 'emergency';

export interface NeuroModeConfig {
  mode: NeuroMode;
  label: string;
  trigger: string;
  action: string;
  icon: string;
}

export const NEURO_MODES: NeuroModeConfig[] = [
  { mode: 'manual', label: 'Manual', trigger: 'Joystick/Sliders', action: 'Controle direto', icon: '🕹️' },
  { mode: 'gaze_nav', label: 'Gaze Nav', trigger: 'Tobii gaze vector', action: 'Robô segue olhar', icon: '👁️' },
  { mode: 'mind_walk', label: 'Mind Walk', trigger: 'Muse beta > threshold', action: 'Forward motion', icon: '🧠' },
  { mode: 'focus_gesture', label: 'Focus Gesture', trigger: 'Pupil dilate + alpha', action: 'Robô gesticula', icon: '✋' },
  { mode: 'emergency', label: 'Emergency', trigger: 'EEG artifact spike', action: 'Stop all', icon: '🚨' },
];

// ─── Safety ───

export const SAFETY_LIMITS = {
  MAX_WALK_SPEED: 0.5,     // m/s
  MAX_ROTATION_SPEED: 0.8, // rad/s
  COMMAND_RATE_LIMIT_MS: 50,
  EEG_ARTIFACT_THRESHOLD: 0.95,
  EMERGENCY_COOLDOWN_MS: 2000,
} as const;
