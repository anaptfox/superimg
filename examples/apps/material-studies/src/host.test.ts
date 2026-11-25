import { describe, expect, it } from 'vitest';
import { canvasPoint, HostClock, LatestPump, SelectionEpoch, StrokeRecorder } from './host.ts';

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

describe('material host lifecycle', () => {
  it('keeps one in flight and only the latest complete pending state', async () => {
    const gate = deferred(); const applied: number[] = [];
    const pump = new LatestPump<number>(async (value) => { applied.push(value); if (value === 1) await gate.promise; }, () => {});
    const first = pump.submit(1); const second = pump.submit(2); const third = pump.submit(3);
    expect(applied).toEqual([1]); expect(await second).toBe('coalesced');
    gate.resolve(); expect(await first).toBe('accepted'); expect(await third).toBe('accepted');
    await pump.idle(); expect(applied).toEqual([1, 3]); expect(pump.coalesced).toBe(1);
  });
  it('cancels pending work on dispose and ignores late acceptance', async () => {
    const gate = deferred(); const applied: number[] = [];
    const pump = new LatestPump<number>(async (value) => { applied.push(value); await gate.promise; }, () => {});
    const first = pump.submit(1); const second = pump.submit(2); pump.dispose();
    expect(await second).toBe('disposed'); gate.resolve(); expect(await first).toBe('disposed');
    await pump.idle(); expect(applied).toEqual([1]); expect(await pump.submit(3)).toBe('disposed');
  });
  it('rejects a stale lazy import and pending import after disposal', () => {
    const epoch = new SelectionEpoch(); const old = epoch.begin(); const latest = epoch.begin();
    expect(epoch.current(old)).toBe(false); expect(epoch.current(latest)).toBe(true);
    epoch.dispose(); expect(epoch.current(latest)).toBe(false);
  });
  it('freezes logical time before rendering or seeking and holds without work', () => {
    const clock = new HostClock(40); clock.play(100); expect(clock.tick(200)).toBeCloseTo(0.1);
    const release = clock.suspend(); clock.tick(900); expect(clock.seconds).toBeCloseTo(0.1);
    clock.seek(12); clock.tick(1000); expect(clock.seconds).toBe(12); release();
    clock.tick(1100); expect(clock.seconds).toBe(12); clock.pause(); expect(clock.tick(1200)).toBeNull();
  });
  it('maps pointers through letterboxing and rejects its bars', () => {
    const rect = { left: 10, top: 20, width: 1280, height: 900 };
    expect(canvasPoint(650, 470, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(canvasPoint(650, 30, rect)).toBeNull();
  });
  it('preserves a full repair interval for a gesture at the original live endpoint', () => {
    const clock = new HostClock(120); clock.seek(120);
    clock.extendThrough(120 + 4); clock.play(100);
    for (let now = 200; now <= 4100; now += 100) clock.tick(now);
    expect(clock.seconds).toBeCloseTo(124); expect(clock.playing).toBe(false);
    clock.extendThrough(119); expect(clock.duration).toBe(124);
    clock.extendThrough(Infinity); expect(clock.duration).toBe(124);
  });
  it('retains bounded stroke records and immutable sampled history', () => {
    const recorder = new StrokeRecorder(); recorder.begin('brush-1', .035, { x: 0, y: .5, at: 0 });
    for (let i = 1; i < 200; i++) recorder.append({ x: i / 200, y: .5, at: i / 20 });
    expect(recorder.strokes.every((stroke) => stroke.points.length <= 64)).toBe(true);
    expect(recorder.strokes.flatMap((stroke) => stroke.points)).toHaveLength(200);
    const old = recorder.strokes; recorder.append({ x: 1, y: .5, at: 11 }); expect(old.at(-1)!.points.at(-1)!.x).toBe(199 / 200);
  });
});
