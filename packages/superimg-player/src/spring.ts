//! Apple-style critically damped spring + rubber-band + momentum project.
//! Not a public host API — DriveController owns the constants.

export const DRIVE_RESPONSE = 0.35;
export const DRIVE_DAMPING = 1;
export const RUBBER_BAND_C = 0.55;
export const MOMENTUM_DECEL = 0.998;

export interface Spring {
  position: number;
  velocity: number;
  target: number;
  step(dtMs: number): void;
  interrupt(position: number, velocity: number): void;
  get atRest(): boolean;
}

export function createSpring(initial = 0): Spring {
  const omega = (2 * Math.PI) / DRIVE_RESPONSE;
  const twoZetaOmega = 2 * DRIVE_DAMPING * omega;
  const omega2 = omega * omega;
  let position = initial;
  let velocity = 0;
  let target = initial;

  return {
    get position() {
      return position;
    },
    set position(value: number) {
      position = value;
    },
    get velocity() {
      return velocity;
    },
    set velocity(value: number) {
      velocity = value;
    },
    get target() {
      return target;
    },
    set target(value: number) {
      target = value;
    },
    step(dtMs: number) {
      const dt = Math.min(Math.max(dtMs, 0), 32) / 1000;
      if (dt === 0) return;
      const error = position - target;
      const accel = -omega2 * error - twoZetaOmega * velocity;
      velocity += accel * dt;
      position += velocity * dt;
    },
    interrupt(nextPosition: number, nextVelocity: number) {
      position = nextPosition;
      velocity = nextVelocity;
    },
    get atRest() {
      return Math.abs(position - target) < 0.0008 && Math.abs(velocity) < 0.02;
    },
  };
}

/** Progressive resistance past a bound (Apple Designing Fluid Interfaces). */
export function rubberBand(overshoot: number, dimension: number, constant = RUBBER_BAND_C): number {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function clampRubber(value: number, min = 0, max = 1, dimension = 1): number {
  if (value < min) return min - rubberBand(min - value, dimension);
  if (value > max) return max + rubberBand(value - max, dimension);
  return value;
}

/** Exponential-decay projection (not v²/2a). */
export function momentumProject(velocity: number, decelerationRate = MOMENTUM_DECEL): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}
