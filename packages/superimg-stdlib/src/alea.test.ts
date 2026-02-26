import { describe, it, expect } from "vitest";
import Alea from "./alea.js";

describe("Alea PRNG", () => {
  it("returns values in [0, 1) for same seed", () => {
    const rng = Alea("seed");
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic for same seed", () => {
    const rng1 = Alea("seed");
    const rng2 = Alea("seed");
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("produces different sequence for different seeds", () => {
    const rng1 = Alea("seed1");
    const rng2 = Alea("seed2");
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).not.toEqual(values2);
  });

  it("next is the same function reference", () => {
    const rng = Alea("seed");
    expect(rng.next).toBe(rng);
  });

  it("uint32() returns values in uint32 range", () => {
    const rng = Alea("seed");
    for (let i = 0; i < 100; i++) {
      const v = rng.uint32();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("fract53() returns values in [0, 1)", () => {
    const rng = Alea("seed");
    for (let i = 0; i < 100; i++) {
      const v = rng.fract53();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("exportState and importState round-trip", () => {
    const rng = Alea("seed");
    for (let i = 0; i < 5; i++) rng();
    const state = rng.exportState();
    expect(state).toHaveLength(4);
    const rng2 = Alea("other");
    rng2.importState(state);
    for (let i = 0; i < 20; i++) {
      expect(rng()).toBe(rng2());
    }
  });

  it("Alea.importState creates PRNG from state", () => {
    const rng = Alea("seed");
    for (let i = 0; i < 5; i++) rng();
    const state = rng.exportState();
    const rng2 = (Alea as any).importState(state);
    for (let i = 0; i < 20; i++) {
      expect(rng()).toBe(rng2());
    }
  });

  it("stores args", () => {
    const rng = Alea("seed", 123);
    expect(rng.args).toEqual(["seed", 123]);
  });

  it("has version", () => {
    const rng = Alea("seed");
    expect(rng.version).toBe("Alea 0.9");
  });
});
