import { describe, it, expect } from 'vitest';
import {
  lerp,
  inverseLerp,
  mapClamp,
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
  smoothstep,
  step,
  fract,
  sign,
  repeat,
  pingPong,
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

describe('inverseLerp', () => {
  it('returns 0 when value equals start', () => {
    expect(inverseLerp(0, 100, 0)).toBe(0);
  });

  it('returns 1 when value equals end', () => {
    expect(inverseLerp(0, 100, 100)).toBe(1);
  });

  it('returns 0.5 at midpoint', () => {
    expect(inverseLerp(0, 100, 50)).toBe(0.5);
  });

  it('extrapolates outside range', () => {
    expect(inverseLerp(0, 100, 150)).toBe(1.5);
    expect(inverseLerp(0, 100, -50)).toBe(-0.5);
  });

  it('handles a === b', () => {
    expect(inverseLerp(10, 10, 10)).toBe(0);
  });
});

describe('mapClamp', () => {
  it('maps and clamps within range', () => {
    expect(mapClamp(0.5, 0, 1, 0, 100)).toBe(50);
  });

  it('clamps output when input exceeds range', () => {
    expect(mapClamp(1.5, 0, 1, 0, 100)).toBe(100);
    expect(mapClamp(-0.5, 0, 1, 0, 100)).toBe(0);
  });

  it('handles negative ranges', () => {
    expect(mapClamp(0, -10, 10, 0, 100)).toBe(50);
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

describe('smoothstep', () => {
  it('returns 0 when x <= edge0', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0)).toBe(0);
  });

  it('returns 1 when x >= edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('returns 0.5 at midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });

  it('has smooth curve (Hermite interpolation)', () => {
    // Values near edges should be close to 0 or 1
    expect(smoothstep(0, 1, 0.1)).toBeLessThan(0.1);
    expect(smoothstep(0, 1, 0.9)).toBeGreaterThan(0.9);
  });
});

describe('step', () => {
  it('returns 0 below edge', () => {
    expect(step(0.5, 0.3)).toBe(0);
    expect(step(0.5, 0)).toBe(0);
  });

  it('returns 1 at/above edge', () => {
    expect(step(0.5, 0.5)).toBe(1);
    expect(step(0.5, 0.7)).toBe(1);
    expect(step(0.5, 1)).toBe(1);
  });
});

describe('fract', () => {
  it('returns fractional part', () => {
    expect(fract(1.5)).toBeCloseTo(0.5);
    expect(fract(2.75)).toBeCloseTo(0.75);
    expect(fract(3)).toBeCloseTo(0);
  });

  it('handles negative numbers', () => {
    expect(fract(-0.25)).toBeCloseTo(0.75);
    expect(fract(-1.5)).toBeCloseTo(0.5);
  });

  it('always returns value in [0, 1)', () => {
    for (let i = -10; i <= 10; i += 0.1) {
      const result = fract(i);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    }
  });
});

describe('sign', () => {
  it('returns 1 for positive', () => {
    expect(sign(5)).toBe(1);
    expect(sign(0.001)).toBe(1);
  });

  it('returns -1 for negative', () => {
    expect(sign(-5)).toBe(-1);
    expect(sign(-0.001)).toBe(-1);
  });

  it('returns 0 for zero', () => {
    expect(sign(0)).toBe(0);
  });
});

describe('repeat', () => {
  it('wraps to [0, length)', () => {
    expect(repeat(2.5, 2)).toBeCloseTo(0.5);
    expect(repeat(4, 2)).toBeCloseTo(0);
    expect(repeat(5, 2)).toBeCloseTo(1);
  });

  it('handles values within range', () => {
    expect(repeat(0.5, 2)).toBeCloseTo(0.5);
    expect(repeat(1.5, 2)).toBeCloseTo(1.5);
  });

  it('handles negative input', () => {
    expect(repeat(-0.5, 2)).toBeCloseTo(1.5);
    expect(repeat(-2, 2)).toBeCloseTo(0);
  });
});

describe('pingPong', () => {
  it('oscillates between 0 and length', () => {
    expect(pingPong(0, 1)).toBeCloseTo(0);
    expect(pingPong(0.5, 1)).toBeCloseTo(0.5);
    expect(pingPong(1, 1)).toBeCloseTo(1);
    expect(pingPong(1.5, 1)).toBeCloseTo(0.5);
    expect(pingPong(2, 1)).toBeCloseTo(0);
  });

  it('continues oscillating', () => {
    expect(pingPong(2.5, 1)).toBeCloseTo(0.5);
    expect(pingPong(3, 1)).toBeCloseTo(1);
    expect(pingPong(4, 1)).toBeCloseTo(0);
  });

  it('stays within bounds', () => {
    for (let t = 0; t <= 10; t += 0.1) {
      const result = pingPong(t, 2);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(2);
    }
  });
});
