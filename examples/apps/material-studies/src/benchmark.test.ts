import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBenchmark, type Acceptance, type BenchmarkPort } from './benchmark.ts';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function port(): BenchmarkPort {
  const records: Acceptance[] = [];
  let accepted = 0;
  return {
    studyId: 'sandglass', fidelity: 'full', pause() {}, async reset() {}, async settle() {},
    async frame() {
      accepted++;
      records.push({ inputVersion: accepted, requestedAt: performance.now(), acceptedAt: performance.now() + 5, generation: 1, revision: accepted, frame: 0, source: 'benchmark' });
    },
    acceptances: () => records,
    counters: () => ({ accepted, coalesced: 0, failures: 0 }),
    counts: () => ({ logical: 576, drawn: 576 }), runtimePerformance: () => null,
  };
}

describe('material benchmark records', () => {
  it('reports short runs as diagnostic and measures an idle hold without rendering', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('navigator', { userAgent: 'test-browser', platform: 'test-machine' });
    vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 900); vi.stubGlobal('devicePixelRatio', 1);
    const pending = runBenchmark(port(), { repetitions: 1, warmupMs: 1, durationMs: 100 });
    await vi.runAllTimersAsync(); const result = await pending;
    expect(result.measured).toBe(false); expect(result.meetsLiveBudget).toBe(false);
    expect(result.heldScenesIdle).toBe(true);
    expect(result.runs.map(run => run.mode)).toEqual(['hold', 'auto', 'interaction']);
    expect(result.runs[0]!.scheduled).toBe(0); expect(result.runs[0]!.accepted).toBe(0);
    expect(result.runs[1]!.inputLatencyMs.p95).toBe(5);
    expect(result.configuration.logicalCount).toBe(576);
  });
  it('cancels an active run without publishing a measured result', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const controller = new AbortController();
    const pending = runBenchmark(port(), { signal: controller.signal });
    const checked = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(50); controller.abort(); await checked;
  });
});
