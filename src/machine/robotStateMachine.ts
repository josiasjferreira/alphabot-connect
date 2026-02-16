/**
 * Robot State Machine
 * 
 * States:
 *   IDLE       — Robot is powered on, connected, awaiting commands
 *   DELIVERY   — Robot is executing a delivery/navigation task
 *   CHARGING   — Robot is docked and charging
 *   ERROR      — Robot encountered a fault (hardware, connection, obstacle)
 *   RECEPTION  — Robot is at a reception point interacting with a user
 *
 * Valid transitions:
 *   IDLE       → DELIVERY, CHARGING, RECEPTION, ERROR
 *   DELIVERY   → IDLE, ERROR, RECEPTION
 *   CHARGING   → IDLE, ERROR
 *   ERROR      → IDLE
 *   RECEPTION  → IDLE, DELIVERY, ERROR
 */

export type RobotState = 'IDLE' | 'DELIVERY' | 'CHARGING' | 'ERROR' | 'RECEPTION';

export interface StateTransition {
  from: RobotState;
  to: RobotState;
  event: RobotEvent;
}

export type RobotEvent =
  | 'START_DELIVERY'
  | 'DELIVERY_COMPLETE'
  | 'START_CHARGING'
  | 'CHARGING_COMPLETE'
  | 'ARRIVE_RECEPTION'
  | 'LEAVE_RECEPTION'
  | 'FAULT'
  | 'RESET'
  | 'EMERGENCY_STOP';

/** Allowed transitions map: from → { event → to } */
const TRANSITIONS: Record<RobotState, Partial<Record<RobotEvent, RobotState>>> = {
  IDLE: {
    START_DELIVERY: 'DELIVERY',
    START_CHARGING: 'CHARGING',
    ARRIVE_RECEPTION: 'RECEPTION',
    FAULT: 'ERROR',
    EMERGENCY_STOP: 'ERROR',
  },
  DELIVERY: {
    DELIVERY_COMPLETE: 'IDLE',
    ARRIVE_RECEPTION: 'RECEPTION',
    FAULT: 'ERROR',
    EMERGENCY_STOP: 'ERROR',
  },
  CHARGING: {
    CHARGING_COMPLETE: 'IDLE',
    FAULT: 'ERROR',
    EMERGENCY_STOP: 'ERROR',
  },
  ERROR: {
    RESET: 'IDLE',
  },
  RECEPTION: {
    LEAVE_RECEPTION: 'IDLE',
    START_DELIVERY: 'DELIVERY',
    FAULT: 'ERROR',
    EMERGENCY_STOP: 'ERROR',
  },
};

export interface StateMachineResult {
  success: boolean;
  previousState: RobotState;
  newState: RobotState;
  event: RobotEvent;
  error?: string;
}

/**
 * Pure function: attempt a state transition.
 * Returns the result without side effects.
 */
export function transition(currentState: RobotState, event: RobotEvent): StateMachineResult {
  const allowed = TRANSITIONS[currentState];
  const nextState = allowed?.[event];

  if (!nextState) {
    return {
      success: false,
      previousState: currentState,
      newState: currentState,
      event,
      error: `Invalid transition: ${currentState} + ${event}`,
    };
  }

  return {
    success: true,
    previousState: currentState,
    newState: nextState,
    event,
  };
}

/**
 * Check if a given event is valid from the current state.
 */
export function canTransition(currentState: RobotState, event: RobotEvent): boolean {
  return !!TRANSITIONS[currentState]?.[event];
}

/**
 * Get all valid events from a given state.
 */
export function getAvailableEvents(state: RobotState): RobotEvent[] {
  const allowed = TRANSITIONS[state];
  return Object.keys(allowed) as RobotEvent[];
}

/** Human-readable labels for each state */
export const STATE_LABELS: Record<RobotState, { pt: string; en: string; icon: string }> = {
  IDLE: { pt: 'Ocioso', en: 'Idle', icon: '🟢' },
  DELIVERY: { pt: 'Em entrega', en: 'Delivering', icon: '🚀' },
  CHARGING: { pt: 'Carregando', en: 'Charging', icon: '🔋' },
  ERROR: { pt: 'Erro', en: 'Error', icon: '🔴' },
  RECEPTION: { pt: 'Recepção', en: 'Reception', icon: '👋' },
};
