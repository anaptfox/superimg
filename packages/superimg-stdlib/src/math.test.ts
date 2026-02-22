import { describe, it, expect } from 'vitest';
import {
  lerp,
  clamp,
  map,
  random,
  randomInt,
  shuffle,
  noise,
  noise2D,
  noise3D,
  setNoiseSeed,
  degToRad,
  radToDeg,
} from './math';

describe('lerp', () => {
  it('returns start value at t=0', () => {
    expect(lerp(0, 100, 0)).toBe(0);
  });

  it('returns end value at t=1', () => {
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('handles negative ranges', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});

describe('clamp', () => {
  it('clamps below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns value in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('handles edge cases', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('map', () => {
  it('maps 0.5 from [0,1] to [0,100]', () => {
    expect(map(0.5, 0, 1, 0, 100)).toBe(50);
  });

  it('maps value from one range to another', () => {
    expect(map(5, 0, 10, 0, 100)).toBe(50);
  });

  it('handles negative ranges', () => {
    expect(map(0, -10, 10, 0, 100)).toBe(50);
  });
});

describe('random', () => {
  it('returns value within range', () => {
    for (let i = 0; i < 100; i++) {
      const val = random(0, 10);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(10);
    }
  });
});

describe('randomInt', () => {
  it('returns integer within range (inclusive)', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(0, 10);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });
});

describe('shuffle', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  it('does not mutate original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });
});

describe('noise', () => {
  it('returns values in [-1, 1] range', () => {
    for (let i = 0; i < 1000; i++) {
      const value = noise(i);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for same seed', () => {
    setNoiseSeed(42);
    const a = noise(100);
    setNoiseSeed(42);
    const b = noise(100);
    expect(a).toBe(b);
  });

  it('varies across different inputs', () => {
    setNoiseSeed(123);
    const values = new Set();
    for (let i = 0; i < 100; i++) {
      values.add(noise(i * 10).toFixed(3));
    }
    expect(values.size).toBeGreaterThan(10); // Should have variety
  });

  it('produces smooth values for nearby inputs', () => {
    setNoiseSeed(42);
    const a = noise(100);
    const b = noise(100.1);
    const diff = Math.abs(a - b);
    expect(diff).toBeLessThan(0.5); // Should be relatively smooth
  });
});

describe('noise2D', () => {
  it('returns values in [-1, 1] range', () => {
    for (let i = 0; i < 100; i++) {
      const value = noise2D(i, i * 2);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for same seed', () => {
    setNoiseSeed(42);
    const a = noise2D(10, 20);
    setNoiseSeed(42);
    const b = noise2D(10, 20);
    expect(a).toBe(b);
  });
});

describe('noise3D', () => {
  it('returns values in [-1, 1] range', () => {
    for (let i = 0; i < 50; i++) {
      const value = noise3D(i, i * 2, i * 3);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('degToRad', () => {
  it('converts degrees to radians', () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(degToRad(360)).toBeCloseTo(Math.PI * 2);
  });
});

describe('radToDeg', () => {
  it('converts radians to degrees', () => {
    expect(radToDeg(0)).toBe(0);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
    expect(radToDeg(Math.PI)).toBeCloseTo(180);
    expect(radToDeg(Math.PI * 2)).toBeCloseTo(360);
  });
});
