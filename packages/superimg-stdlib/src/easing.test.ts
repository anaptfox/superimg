import { describe, it, expect } from 'vitest';
import {
  clamp01,
  linear,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
} from './easing';

describe('clamp01', () => {
  it('clamps to [0, 1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });
});

describe('linear', () => {
  it('returns input value', () => {
    expect(linear(0)).toBe(0);
    expect(linear(0.5)).toBe(0.5);
    expect(linear(1)).toBe(1);
  });
});

describe('easeInCubic', () => {
  it('starts at 0', () => {
    expect(easeInCubic(0)).toBe(0);
  });

  it('ends at 1', () => {
    expect(easeInCubic(1)).toBe(1);
  });

  it('accelerates', () => {
    expect(easeInCubic(0.5)).toBeLessThan(0.5);
  });
});

describe('easeOutCubic', () => {
  it('starts at 0', () => {
    expect(easeOutCubic(0)).toBe(0);
  });

  it('ends at 1', () => {
    expect(easeOutCubic(1)).toBe(1);
  });

  it('decelerates', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('easeInOutCubic', () => {
  it('starts at 0', () => {
    expect(easeInOutCubic(0)).toBe(0);
  });

  it('ends at 1', () => {
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('is symmetric', () => {
    const a = easeInOutCubic(0.25);
    const b = easeInOutCubic(0.75);
    expect(Math.abs(a + b - 1)).toBeLessThan(0.01);
  });
});

describe('easeOutBack', () => {
  it('overshoots at end', () => {
    const value = easeOutBack(0.8);
    expect(value).toBeGreaterThan(0.8);
  });

  it('ends at 1', () => {
    expect(easeOutBack(1)).toBe(1);
  });
});

describe('easeOutElastic', () => {
  it('oscillates', () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5].map(easeOutElastic);
    // Should have some variation due to oscillation
    expect(new Set(values.map(v => v.toFixed(2))).size).toBeGreaterThan(1);
  });

  it('ends at 1', () => {
    expect(easeOutElastic(1)).toBe(1);
  });
});

describe('easeOutBounce', () => {
  it('bounces', () => {
    const values = [0.5, 0.6, 0.7, 0.8, 0.9].map(easeOutBounce);
    // Should have variation due to bouncing
    expect(new Set(values.map(v => v.toFixed(2))).size).toBeGreaterThan(1);
  });

  it('ends at 1', () => {
    expect(easeOutBounce(1)).toBe(1);
  });
});

describe('easing out-of-range inputs', () => {
  const easings = [
    linear,
    easeInCubic,
    easeOutCubic,
    easeInOutCubic,
    easeInQuart,
    easeOutQuart,
    easeInOutQuart,
    easeInExpo,
    easeOutExpo,
    easeInOutExpo,
    easeInBack,
    easeOutBack,
    easeInOutBack,
    easeInElastic,
    easeOutElastic,
    easeInOutElastic,
    easeInBounce,
    easeOutBounce,
    easeInOutBounce,
  ];

  it('returns 0 for t < 0', () => {
    for (const fn of easings) {
      expect(fn(-1)).toBeCloseTo(0, 10);
      expect(fn(-0.5)).toBeCloseTo(0, 10);
    }
  });

  it('returns 1 for t > 1', () => {
    for (const fn of easings) {
      expect(fn(1.5)).toBeCloseTo(1, 10);
      expect(fn(2)).toBeCloseTo(1, 10);
    }
  });

  it('output stays finite for all t in [0, 1]', () => {
    for (const fn of easings) {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const v = fn(t);
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('non-overshoot curves stay in [0, 1] for t in [0, 1]', () => {
    const nonOvershoot = [
      linear,
      easeInCubic,
      easeOutCubic,
      easeInOutCubic,
      easeInQuart,
      easeOutQuart,
      easeInOutQuart,
      easeInExpo,
      easeOutExpo,
      easeInOutExpo,
    ];
    for (const fn of nonOvershoot) {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const v = fn(t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
