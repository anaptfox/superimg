/**
 * Math utilities for SuperImg templates
 *
 * Provides common mathematical functions for animations, transformations, and calculations.
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import Alea from './alea';

/**
 * Linear interpolation between two values.
 * @ai-hint t is NOT clamped — values outside [0,1] extrapolate. Clamp first if needed: `lerp(a, b, clamp(t, 0, 1))`.
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (typically 0-1, but not clamped)
 * @returns Interpolated value: `a + (b - a) * t`
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max.
 * @ai-hint Commonly used with time: `clamp(time / 1.5, 0, 1)` creates a 0→1 ramp over 1.5 s.
 * @param val - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Value restricted to [min, max]
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Inverse of lerp: given a value between a and b, return the normalized t in [0, 1].
 * @ai-hint Use to convert a value back to progress: `inverseLerp(0, 100, 50)` → 0.5
 * @param a - Start of range
 * @param b - End of range
 * @param value - Value within (or outside) the range
 * @returns Normalized position: (value - a) / (b - a). Not clamped. When a === b (degenerate range), returns 0.
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

/**
 * Map a value from one range to another, clamping output to [outMin, outMax].
 * @ai-hint Use when you want mapped values to never exceed the output range.
 * @param val - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped and clamped value
 */
export function mapClamp(
  val: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const t = inverseLerp(inMin, inMax, val);
  const clamped = Math.max(0, Math.min(1, t));
  return outMin + (outMax - outMin) * clamped;
}

/**
 * Map a value from one range to another.
 * @ai-hint Does NOT clamp — output can exceed [outMin, outMax] if input exceeds [inMin, inMax].
 * @param val - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped value: `outMin + (val - inMin) * (outMax - outMin) / (inMax - inMin)`
 */
export function map(
  val: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Generate a random number between min and max.
 * @ai-hint Not deterministic — different result every frame. For smooth randomness, use `noise()` instead.
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @returns Random float in [min, max)
 */
export function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns New shuffled array
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// Noise Functions (using simplex-noise)
// ============================================================================

let noise2DFn = createNoise2D();
let noise3DFn = createNoise3D();

/**
 * Set the noise seed for reproducible noise
 * @param seed - Seed value
 */
export function setNoiseSeed(seed: number): void {
  const prng = Alea(seed);
  noise2DFn = createNoise2D(prng);
  noise3DFn = createNoise3D(prng);
}

/**
 * Simple 1D noise function for smooth random values
 * Uses 2D noise with y=0 for 1D output
 * @param x - Input coordinate
 * @returns Noise value between -1 and 1
 */
export function noise(x: number): number {
  return noise2DFn(x, 0);
}

/**
 * 2D noise function for smooth random values
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Noise value between -1 and 1
 */
export function noise2D(x: number, y: number): number {
  return noise2DFn(x, y);
}

/**
 * 3D noise function for smooth random values
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @returns Noise value between -1 and 1
 */
export function noise3D(x: number, y: number, z: number): number {
  return noise3DFn(x, y, z);
}

/**
 * Convert degrees to radians
 * @param deg - Degrees
 * @returns Radians
 */
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param rad - Radians
 * @returns Degrees
 */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

// ============================================================================
// Animation & Graphics Utilities
// ============================================================================

/**
 * Hermite interpolation: smooth 0→1 transition between edge0 and edge1.
 * @ai-hint Used in shaders and smooth transitions. Returns 0 for x ≤ edge0, 1 for x ≥ edge1.
 * @param edge0 - Start of transition
 * @param edge1 - End of transition
 * @param x - Input value
 * @returns Value in [0, 1] with smooth edges
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Step function: returns 0 if x < edge, 1 otherwise.
 * @ai-hint Fundamental in graphics. Use for hard cutoffs.
 * @param edge - Threshold
 * @param x - Input value
 * @returns 0 or 1
 */
export function step(edge: number, x: number): number {
  return x < edge ? 0 : 1;
}

/**
 * Fractional part of x (x - floor(x)).
 * @ai-hint Common for looping animations: fract(time) gives 0→1 each cycle.
 * @param x - Input value
 * @returns Value in [0, 1)
 */
export function fract(x: number): number {
  return x - Math.floor(x);
}

/**
 * Sign of x: -1 if negative, 0 if zero, 1 if positive.
 * @param x - Input value
 * @returns -1, 0, or 1
 */
export function sign(x: number): number {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

/**
 * Wrap t to [0, length). Use for looping animations.
 * @ai-hint repeat(time, 2) gives 0→2, 0→2, ... for a 2-second loop.
 * @param t - Time or value
 * @param length - Period length
 * @returns Value in [0, length)
 */
export function repeat(t: number, length: number): number {
  return clamp(t - Math.floor(t / length) * length, 0, length);
}

/**
 * Oscillate between 0 and length (ping-pong). Use for back-and-forth motion.
 * @ai-hint pingPong(time, 1) goes 0→1→0→1... over time.
 * @param t - Time or value
 * @param length - Amplitude/period
 * @returns Value in [0, length]
 */
export function pingPong(t: number, length: number): number {
  const x = repeat(t, length * 2);
  return length - Math.abs(x - length);
}
