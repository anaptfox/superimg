import { percentile } from './host.ts';
import type { Fidelity, StudyId } from './studies.ts';

export interface Acceptance {
  inputVersion: number;
  requestedAt: number;
  acceptedAt: number;
  generation: number;
  revision: number;
  frame: number;
  source: 'control' | 'clock' | 'benchmark' | 'inspection' | 'pointer';
}
export interface BenchmarkPort {
  readonly studyId: StudyId;
  readonly fidelity: Fidelity;
  pause(): void;
  reset(): Promise<void>;
  settle(): Promise<void>;
  frame(progress: number, mode: 'auto' | 'interaction'): Promise<void>;
  acceptances(): readonly Acceptance[];
  counters(): { accepted: number; coalesced: number; failures: number };
  counts(): { logical: number; drawn: number | null };
  runtimePerformance(): unknown;
}
export interface BenchmarkOptions {
  repetitions?: number;
  warmupMs?: number;
  durationMs?: number;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  /** Operator assertion: concurrent exports and other rendering loads have finished. */
  isolated?: boolean;
}

/** A measured run is never inferred from theoretical particle counts or stage sums. */
export async function runBenchmark(port: BenchmarkPort, options: BenchmarkOptions = {}) {
  const repetitions = options.repetitions ?? 3;
  const warmupMs = options.warmupMs ?? 10_000;
  const durationMs = options.durationMs ?? 60_000;
  const check = () => { if (options.signal?.aborted) throw new DOMException('Benchmark cancelled', 'AbortError'); };
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    check();
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Benchmark cancelled', 'AbortError')); };
    const timer = setTimeout(() => { options.signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    options.signal?.addEventListener('abort', onAbort, { once: true });
  });
  const runs = [];
  port.pause();
  for (const mode of ['hold', 'auto', 'interaction'] as const) {
    for (let run = 0; run < repetitions; run++) {
      check(); await port.reset();
      options.onProgress?.(`${port.fidelity} · ${mode} ${run + 1}/${repetitions} · warming up`);
      const warmStarted = performance.now();
      while (performance.now() - warmStarted < warmupMs) {
        check();
        if (mode !== 'hold') await port.frame(((performance.now() - warmStarted) / 1000 % 8) / 8, mode);
        await wait(1000 / 30);
      }
      const before = port.counters();
      const startedAt = performance.now();
      options.onProgress?.(`${port.fidelity} · ${mode} ${run + 1}/${repetitions} · measuring`);
      let nextAt = startedAt;
      let scheduled = 0;
      while (performance.now() - startedAt < durationMs) {
        check();
        const now = performance.now();
        if (mode !== 'hold') {
          // Deliberately do not await every input: the real latest-state pump decides coalescing.
          void port.frame(((now - startedAt) / 1000 % 8) / 8, mode).catch(() => {});
          scheduled++;
        }
        nextAt += 1000 / 30;
        await wait(Math.max(0, nextAt - performance.now()));
      }
      // Finish only the measured inputs, with no additional scene updates.
      await port.settle();
      const endedAt = performance.now();
      const samples = port.acceptances().filter((item) => item.requestedAt >= startedAt && item.requestedAt < startedAt + durationMs);
      const relevant = samples.filter((item) => item.source === 'benchmark');
      const intervals = samples.slice(1).map((item, index) => item.acceptedAt - samples[index]!.acceptedAt);
      const latencies = relevant.map((item) => item.acceptedAt - item.requestedAt);
      const after = port.counters();
      runs.push({ mode, run: run + 1, scheduled, startedAt, endedAt, durationMs,
        accepted: after.accepted - before.accepted, coalesced: after.coalesced - before.coalesced,
        failures: after.failures - before.failures, inputLatencyMs: { p50: percentile(latencies, .5), p95: percentile(latencies, .95) },
        acceptedIntervalMs: { p50: percentile(intervals, .5), p95: percentile(intervals, .95) },
        frameBudgetMs: 1000 / 30,
        missedFrameDeadlines: relevant.filter((item) => item.acceptedAt - item.requestedAt > 1000 / 30).length,
        longAcceptedIntervals: intervals.filter((ms) => ms > 1000 / 30).length,
        counts: port.counts(), runtimePerformance: port.runtimePerformance(), samples,
      });
    }
  }
  const active = runs.filter((run) => run.mode !== 'hold');
  const measured = repetitions === 3 && warmupMs === 10_000 && durationMs === 60_000;
  const meetsLiveBudget = measured && active.every((run) => (run.inputLatencyMs.p95 ?? Infinity) <= 100 && run.failures === 0 && run.accepted / (durationMs / 1000) >= 29);
  const heldScenesIdle = runs.filter((run) => run.mode === 'hold').every((run) => run.accepted === 0);
  return {
    schemaVersion: 1, study: port.studyId, fidelity: port.fidelity, measured, warmupMs, durationMs, repetitions,
    recordedAt: new Date().toISOString(),
    configuration: { userAgent: navigator.userAgent, platform: navigator.platform, viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, canvas: { width: 1280, height: 720 }, logicalCount: port.counts().logical, drawnCount: port.counts().drawn },
    target: { updatesPerSecond: 30, acceptanceFloorPerSecond: 29, inputLatencyP95Ms: 100 },
    environment: { isolation: options.isolated ? 'operator-confirmed' : 'unverified' },
    meetsLiveBudget, heldScenesIdle,
    defaultQualified: measured && meetsLiveBudget && heldScenesIdle && options.isolated === true,
    runs,
  };
}
