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
