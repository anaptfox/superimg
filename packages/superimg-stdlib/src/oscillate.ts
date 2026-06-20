/**
 * Continuous motion primitives — pure functions of time, render-safe.
 *
 * All functions accept time in seconds (from `ctx.sceneTimeSeconds`).
 * `period` can be a string ("1s", "500ms") or a number (seconds).
 */

import { repeat, pingPong } from "./math.js";

function parsePeriod(period: number | string): number {
  if (typeof period === "number") return period;
  const s = period.trim();
  if (s.endsWith("ms")) return parseFloat(s) / 1000;
  if (s.endsWith("s")) return parseFloat(s);
  throw new Error(`oscillate: period "${period}" must end with "s" or "ms"`);
}

export interface OscillateOpts {
  /** Period of one full cycle. e.g. "1s", "500ms", or 1 (seconds). */
  period: number | string;
  /** Start value of the oscillation. Default: -1 */
  from?: number;
  /** End value of the oscillation. Default: 1 */
  to?: number;
}

/**
 * Smooth sine oscillation between `from` and `to` over `period`.
 *
 * @example
 * // Float a card up and down
 * const floatY = std.oscillate(time, { period: "2s", from: -4, to: 4 });
 * const pulseScale = std.oscillate(time, { period: "1s", from: 0.98, to: 1.02 });
 */
export function oscillate(time: number, opts: OscillateOpts): number {
  const period = parsePeriod(opts.period);
  const from = opts.from ?? -1;
  const to = opts.to ?? 1;
  const t = (time / period) * Math.PI * 2;
  const sine = (Math.sin(t) + 1) / 2; // 0→1→0→... sine
  return from + (to - from) * sine;
}

export interface LoopOpts {
  /** Period of one sawtooth cycle. e.g. "2s" or 2. */
  period: number | string;
}

/**
 * 0→1 sawtooth that resets each period.
 *
 * @example
 * const spinAngle = std.loop(time, { period: "3s" }) * 360;
 */
export function loop(time: number, opts: LoopOpts): number {
  const period = parsePeriod(opts.period);
  return repeat(time, period) / period;
}

/**
 * 0→1→0 triangle that bounces each period.
 *
 * @example
 * const breathe = std.pingpong(time, { period: "2s" });
 */
export function pingpong(time: number, opts: LoopOpts): number {
  const period = parsePeriod(opts.period);
  return pingPong(time, period / 2) / (period / 2);
}

export interface WiggleOpts {
  /** Frequency multiplier — higher = faster variation. Default: 1 */
  freq?: number;
  /** Amplitude — output range is ±amp. Default: 1 */
  amp?: number;
}

/**
 * Seeded smooth noise — deterministic, no `Math.random()`.
 * Different seeds produce different patterns; same seed + time always gives the same value.
 *
 * @example
 * const jitterX = std.wiggle(time, 0, { freq: 2, amp: 8 });
 * const jitterY = std.wiggle(time, 1, { freq: 2, amp: 8 });
 */
export function wiggle(time: number, seed: number, opts?: WiggleOpts): number {
  const freq = opts?.freq ?? 1;
  const amp = opts?.amp ?? 1;
  // Seeded smooth noise via overlapping harmonics — deterministic, no global state
  const t = time * freq + seed * 1234.5678;
  return amp * (
    Math.sin(t * 1.0) * 0.500 +
    Math.sin(t * 1.7) * 0.250 +
    Math.sin(t * 3.1) * 0.125 +
    Math.sin(t * 5.3) * 0.063
  );
}
