/**
 * Timing and phase management utilities for SuperImg animations
 *
 * Provides helpers for managing animation phases and timelines.
 */

/**
 * Phase definition with start and end times
 */
export interface Phase {
  start: number;
  end: number;
}

/**
 * Phase phases map
 */
export type Phases = Record<string, Phase>;

/**
 * Result of getting a phase at a specific time
 */
export interface PhaseResult {
  name: string;
  progress: number;
}

/**
 * Phase manager for handling animation phases
 */
export class PhaseManager {
  private phases: Phases;
  private sortedPhases: Array<[string, Phase]>;

  constructor(phases: Phases) {
    this.phases = phases;
    // Sort phases by start time for efficient lookup
    this.sortedPhases = Object.entries(phases).sort(
      ([, a], [, b]) => a.start - b.start
    );
  }

  /**
   * Get the current phase and progress at a given time
   * @param time - Current time in seconds
   * @returns Phase result with name and progress (0-1)
   */
  get(time: number): PhaseResult {
    for (const [name, phase] of this.sortedPhases) {
      if (time >= phase.start && time < phase.end) {
        const duration = phase.end - phase.start;
        const progress = duration > 0 ? (time - phase.start) / duration : 1;
        return {
          name,
          progress: Math.max(0, Math.min(1, progress)),
        };
      }
    }

    // If no phase matches, return the last phase at progress 1
    if (this.sortedPhases.length > 0) {
      const lastPhase = this.sortedPhases[this.sortedPhases.length - 1];
      const [, phase] = lastPhase;
      if (time >= phase.end) {
        return {
          name: lastPhase[0],
          progress: 1,
        };
      }
    }

    // Fallback: return first phase at progress 0
    if (this.sortedPhases.length > 0) {
      return {
        name: this.sortedPhases[0][0],
        progress: 0,
      };
    }

    // No phases defined
    return { name: "unknown", progress: 0 };
  }

  /**
   * Get progress within a specific phase
   * @param time - Current time in seconds
   * @param phaseName - Name of the phase
   * @returns Progress (0-1) within the phase, or 0 if phase not found
   */
  getPhaseProgress(time: number, phaseName: string): number {
    const phase = this.phases[phaseName];
    if (!phase) {
      return 0;
    }

    if (time < phase.start) {
      return 0;
    }

    if (time >= phase.end) {
      return 1;
    }

    const duration = phase.end - phase.start;
    if (duration <= 0) {
      return 1;
    }

    const progress = (time - phase.start) / duration;
    return Math.max(0, Math.min(1, progress));
  }
}

/**
 * Create a phase manager from phase definitions
 * @param phases - Object mapping phase names to { start, end } times
 * @returns PhaseManager instance
 *
 * @example
 * ```ts
 * const phases = createPhaseManager({
 *   intro: { start: 0, end: 1.0 },
 *   bars: { start: 1.0, end: 5.5 },
 *   highlight: { start: 5.5, end: 7.0 },
 * });
 *
 * const { name, progress } = phases.get(2.0); // { name: 'bars', progress: 0.22... }
 * ```
 */
export function createPhaseManager(phases: Phases): PhaseManager {
  return new PhaseManager(phases);
}

/**
 * Get phase information at a specific time (convenience function)
 * @param time - Current time in seconds
 * @param phases - Object mapping phase names to { start, end } times
 * @returns Phase result with name and progress (0-1)
 *
 * @example
 * ```ts
 * const phases = {
 *   intro: { start: 0, end: 1.0 },
 *   bars: { start: 1.0, end: 5.5 },
 * };
 *
 * const { name, progress } = getPhase(2.0, phases); // { name: 'bars', progress: 0.22... }
 * ```
 */
export function getPhase(time: number, phases: Phases): PhaseResult {
  const manager = createPhaseManager(phases);
  return manager.get(time);
}

/**
 * Get progress within a specific phase (convenience function)
 * @param time - Current time in seconds
 * @param phaseName - Name of the phase
 * @param phases - Object mapping phase names to { start, end } times
 * @returns Progress (0-1) within the phase, or 0 if phase not found
 *
 * @example
 * ```ts
 * const phases = {
 *   intro: { start: 0, end: 1.0 },
 *   bars: { start: 1.0, end: 5.5 },
 * };
 *
 * const progress = phaseProgress(2.0, 'bars', phases); // 0.22...
 * ```
 */
export function phaseProgress(
  time: number,
  phaseName: string,
  phases: Phases
): number {
  const manager = createPhaseManager(phases);
  return manager.getPhaseProgress(time, phaseName);
}
