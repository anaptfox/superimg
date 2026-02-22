import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  hslToRgb,
  rgbToHsl,
  hsl,
  parseColor,
  darken,
  lighten,
  alpha,
  mix,
  saturate,
  desaturate,
  isLight,
} from './color';

describe('hexToRgb', () => {
  it('converts hex to RGB', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('handles hex without #', () => {
    expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe('rgbToHex', () => {
  it('converts RGB to hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
  });

  it('handles edge cases', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });
});

describe('hslToRgb', () => {
  it('converts HSL to RGB', () => {
    const rgb = hslToRgb(0, 100, 50); // Red
    expect(rgb.r).toBeGreaterThan(240);
    expect(rgb.g).toBeLessThan(20);
    expect(rgb.b).toBeLessThan(20);
  });

  it('handles grayscale', () => {
    const rgb = hslToRgb(0, 0, 50);
    expect(rgb.r).toBeCloseTo(rgb.g);
    expect(rgb.g).toBeCloseTo(rgb.b);
  });
});

describe('rgbToHsl', () => {
  it('converts RGB to HSL', () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBeGreaterThanOrEqual(0);
    expect(hsl.h).toBeLessThanOrEqual(360);
    expect(hsl.s).toBeGreaterThanOrEqual(0);
    expect(hsl.s).toBeLessThanOrEqual(100);
    expect(hsl.l).toBeGreaterThanOrEqual(0);
    expect(hsl.l).toBeLessThanOrEqual(100);
  });
});

describe('hsl', () => {
  it('returns correct HSL format string', () => {
    expect(hsl(180, 50, 50)).toBe('hsl(180, 50%, 50%)');
  });

  it('rounds fractional values', () => {
    expect(hsl(179.7, 50.3, 49.8)).toBe('hsl(180, 50%, 50%)');
  });

  it('handles zero values', () => {
    expect(hsl(0, 0, 0)).toBe('hsl(0, 0%, 0%)');
  });

  it('handles max values', () => {
    expect(hsl(360, 100, 100)).toBe('hsl(360, 100%, 100%)');
  });
});

describe('parseColor', () => {
  it('parses hex colors', () => {
    expect(parseColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses rgb colors', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses hsl colors', () => {
    const rgb = parseColor('hsl(0, 100%, 50%)');
    expect(rgb.r).toBeGreaterThan(240);
  });

  it('throws on invalid color', () => {
    expect(() => parseColor('invalid')).toThrow();
  });
});

describe('darken', () => {
  it('darkens a color', () => {
    const darkened = darken('#FFFFFF', 50);
    const rgb = hexToRgb(darkened);
    expect(rgb.r).toBeLessThan(255);
    expect(rgb.g).toBeLessThan(255);
    expect(rgb.b).toBeLessThan(255);
  });

  it('handles 0% darken', () => {
    expect(darken('#FF0000', 0)).toBe('#ff0000');
  });

  it('handles 100% darken', () => {
    const darkened = darken('#FF0000', 100);
    expect(darkened).toBe('#000000');
  });
});

describe('lighten', () => {
  it('lightens a color', () => {
    const lightened = lighten('#000000', 50);
    const rgb = hexToRgb(lightened);
    expect(rgb.r).toBeGreaterThan(0);
    expect(rgb.g).toBeGreaterThan(0);
    expect(rgb.b).toBeGreaterThan(0);
  });

  it('handles 0% lighten', () => {
    expect(lighten('#000000', 0)).toBe('#000000');
  });

  it('handles 100% lighten', () => {
    expect(lighten('#000000', 100)).toBe('#ffffff');
  });
});

describe('alpha', () => {
  it('adds alpha channel', () => {
    const result = alpha('#FF0000', 0.5);
    expect(result).toContain('rgba');
    expect(result).toContain('0.5');
  });

  it('handles 0 opacity', () => {
    const result = alpha('#FF0000', 0);
    expect(result).toContain('rgba(255, 0, 0, 0)');
  });

  it('handles 1 opacity', () => {
    const result = alpha('#FF0000', 1);
    expect(result).toContain('rgba(255, 0, 0, 1)');
  });
});

describe('mix', () => {
  it('mixes two colors', () => {
    const mixed = mix('#FF0000', '#0000FF', 0.5);
    const rgb = hexToRgb(mixed);
    expect(rgb.r).toBeGreaterThan(0);
    expect(rgb.b).toBeGreaterThan(0);
  });

  it('returns first color at weight 1', () => {
    expect(mix('#FF0000', '#0000FF', 1)).toBe('#ff0000');
  });

  it('returns second color at weight 0', () => {
    expect(mix('#FF0000', '#0000FF', 0)).toBe('#0000ff');
  });
});

describe('saturate', () => {
  it('increases saturation', () => {
    const saturated = saturate('#808080', 50);
    const { r, g, b } = hexToRgb(saturated);
    const hsl = rgbToHsl(r, g, b);
    expect(hsl.s).toBeGreaterThan(0);
  });
});

describe('desaturate', () => {
  it('decreases saturation', () => {
    const desaturated = desaturate('#FF0000', 50);
    const { r, g, b } = hexToRgb(desaturated);
    const hsl = rgbToHsl(r, g, b);
    expect(hsl.s).toBeLessThan(100);
  });
});

describe('isLight', () => {
  it('detects light colors', () => {
    expect(isLight('#FFFFFF')).toBe(true);
    expect(isLight('#FFFF00')).toBe(true);
  });

  it('detects dark colors', () => {
    expect(isLight('#000000')).toBe(false);
    expect(isLight('#000080')).toBe(false);
  });
});
