import { describe, expect, it } from "vitest";
import { sampleMorning, subjects } from "./model";

describe("Second Cup authored world", () => {
  it("reuses accepted design bindings while independent continuity survives the cut", () => {
    const early = sampleMorning(2), late = sampleMorning(7);
    expect(early.mugs.map(m => m.entityId)).toEqual(["breakfast", "counter"]);
    expect(early.mugs[0]!.binding).toEqual(late.mugs[0]!.binding);
    expect(early.mugs[0]!.data.design).toBe(early.mugs[1]!.data.design);
    expect(early.mugs.map(m => m.data.state.fill)).toEqual([1, 1]);
    expect(late.mugs.map(m => m.data.state.fill)).toEqual([.55, 1]);
    expect(late.mugs.map(m => m.data.state.tide)).toEqual([true, false]);
    expect(subjects.sample("counter", { state: { fill: 1, tide: false }, performance: early.mugs[1]!.data.performance }).data.state.fill).toBe(1);
  });
  it("changes fill during the authored out-of-frame ellipsis, not during a visible drain", () => {
    for (const time of [4.6, 4.75, 4.95]) {
      const frame = sampleMorning(time);
      expect(frame.mugs[0]!.data.performance.position[1]).toBeGreaterThan(34);
      expect(frame.mugs[0]!.data.state.fill).toBe(1);
    }
    const returned = sampleMorning(6.4);
    expect(returned.timestamp).toBe("8:19 AM");
    expect(returned.mugs[0]!.data.performance.position[1]).toBeCloseTo(.17);
    expect(returned.mugs[0]!.data.state.fill).toBe(.55);
  });
  it("samples every encoded frame finitely and reproduces out-of-order frames", () => {
    for (const square of [false, true]) {
      const held = sampleMorning(7.5, square); sampleMorning(1, square);
      expect(sampleMorning(7.5, square)).toEqual(held);
      for (let i = 0; i < 288; i++) {
        const f = sampleMorning(i / 287 * 12, square);
        const numbers = [...f.camera.position, ...f.camera.target, f.camera.focal,
          ...f.mugs.flatMap(m => [...m.data.performance.position, m.data.performance.tilt, m.data.state.fill])];
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
    }
    expect(sampleMorning(11, true).camera).not.toEqual(sampleMorning(11, false).camera);
  });
  it("keeps both complete mug envelopes in the final shot and clear of square copy", () => {
    const dot = (a: number[], b: number[]) => a.reduce((n, v, i) => n + v * b[i]!, 0);
    const normalized = (a: number[]) => a.map(v => v / Math.hypot(...a));
    const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
    for (const square of [false, true]) {
      const frame = sampleMorning(11, square), camera = frame.camera;
      const forward = normalized(camera.target.map((v, i) => v - camera.position[i]!));
      const right = normalized(cross(forward, [0, 1, 0])), up = cross(right, forward);
      const tan = 12 / camera.focal, aspect = square ? 1 : 1280 / 720;
      for (const mug of frame.mugs) {
        const p = mug.data.performance, angle = p.yaw * Math.PI / 180;
        for (const x of [-4.3, 7.2]) for (const y of [0, 9.6]) for (const z of [-4.3, 4.3]) {
          const point = [x * Math.cos(angle) + z * Math.sin(angle) + p.position[0]!, y + p.position[1]!, -x * Math.sin(angle) + z * Math.cos(angle) + p.position[2]!];
          const d = point.map((v, i) => v - camera.position[i]!), depth = dot(d, forward);
          const sx = .5 + dot(d, right) / (2 * depth * tan * aspect), sy = .5 - dot(d, up) / (2 * depth * tan);
          expect(sx).toBeGreaterThan(.05); expect(sx).toBeLessThan(.95);
          expect(sy).toBeGreaterThan(square ? .32 : .05); expect(sy).toBeLessThan(.95);
        }
      }
    }
  });
});
