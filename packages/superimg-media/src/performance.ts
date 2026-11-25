//! Passive numeric diagnostics. No render output, user data, or callbacks retained.
export type RuntimePerformanceKind = "clock" | "render" | "update";
export type RuntimePerformanceStage = "queue" | "context" | "render" | "lower" | "composite" |
  "semantic" | "evaluate" | "geometry" | "sanitize" | "morph" | "present" | "resources" | "accept" | "callbacks";
export type RuntimePerformanceOutcome = "accepted" | "superseded" | "failed";

export interface RuntimePerformanceOptions {
  /** Completed samples retained, default 120, maximum 4096. */
  capacity?: number;
}
export interface RuntimePerformanceCounters {
  readonly requested: number;
  readonly evaluated: number;
  readonly superseded: number;
  readonly accepted: number;
  readonly failed: number;
}
export interface RuntimePerformanceRecord {
  readonly sequence: number;
  readonly kind: RuntimePerformanceKind;
  readonly inputRevision: number;
  readonly requestedFrame: number;
  readonly evaluatedFrame?: number;
  readonly acceptedFrame?: number;
  readonly acceptedRevision?: number;
  readonly requestedAt: number;
  readonly completedAt: number;
  readonly elapsedMs: number;
  readonly outcome: RuntimePerformanceOutcome;
  /** Timings overlap: evaluate includes context/render/lower, present includes sanitize/morph. */
  readonly timings: Readonly<Partial<Record<RuntimePerformanceStage, number>>>;
}
export interface RuntimePerformanceSnapshot {
  readonly capacity: number;
  readonly dropped: number;
  readonly counters: RuntimePerformanceCounters;
  readonly byKind: Readonly<Record<RuntimePerformanceKind, RuntimePerformanceCounters>>;
  readonly records: readonly RuntimePerformanceRecord[];
}
type Counters = { -readonly [K in keyof RuntimePerformanceCounters]: number };
const counters = (): Counters => ({ requested: 0, evaluated: 0, superseded: 0, accepted: 0, failed: 0 });

/** Internal per-request accumulator. Created only while diagnostics are enabled. */
export class FramePerformanceSample {
  readonly requestedAt = performance.now();
  readonly timings: Partial<Record<RuntimePerformanceStage, number>> = {};
  evaluatedFrame?: number;
  completed = false;
  constructor(readonly sequence: number, readonly kind: RuntimePerformanceKind,
    readonly requestedFrame: number, public inputRevision: number) {}
  start(): number { return performance.now(); }
  end(stage: RuntimePerformanceStage, start: number): void { this.timing(stage, performance.now() - start); }
  timing(stage: RuntimePerformanceStage, ms: number): void {
    this.timings[stage] = (this.timings[stage] ?? 0) + Math.max(0, ms);
  }
}

export class RuntimePerformanceProbe {
  private readonly capacity: number;
  private readonly records: RuntimePerformanceRecord[] = [];
  private readonly counts = counters();
  private readonly kinds = { clock: counters(), render: counters(), update: counters() };
  private next = 0;
  private dropped = 0;
  constructor(options: RuntimePerformanceOptions = {}) {
    const capacity = options.capacity ?? 120;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4096) {
      throw new RangeError("performance.capacity must be an integer from 1 to 4096");
    }
    this.capacity = capacity;
  }
  request(kind: RuntimePerformanceKind, frame: number, inputRevision: number): FramePerformanceSample {
    this.counts.requested++; this.kinds[kind].requested++;
    return new FramePerformanceSample(++this.next, kind, frame, inputRevision);
  }
  evaluated(sample: FramePerformanceSample, frame: number): void {
    this.counts.evaluated++; this.kinds[sample.kind].evaluated++; sample.evaluatedFrame = frame;
  }
  finish(sample: FramePerformanceSample, outcome: RuntimePerformanceOutcome,
    acceptedFrame?: number, acceptedRevision?: number): void {
    if (sample.completed) return;
    sample.completed = true;
    this.counts[outcome]++; this.kinds[sample.kind][outcome]++;
    const completedAt = performance.now();
    const record: RuntimePerformanceRecord = Object.freeze({
      sequence: sample.sequence, kind: sample.kind, inputRevision: sample.inputRevision,
      requestedFrame: sample.requestedFrame, requestedAt: sample.requestedAt, completedAt,
      elapsedMs: completedAt - sample.requestedAt, outcome,
      ...(sample.evaluatedFrame !== undefined ? { evaluatedFrame: sample.evaluatedFrame } : {}),
      ...(acceptedFrame !== undefined ? { acceptedFrame } : {}),
      ...(acceptedRevision !== undefined ? { acceptedRevision } : {}),
      timings: Object.freeze({ ...sample.timings }),
    });
    if (this.records.length === this.capacity) { this.records.shift(); this.dropped++; }
    this.records.push(record);
  }
  snapshot(): RuntimePerformanceSnapshot {
    return Object.freeze({ capacity: this.capacity, dropped: this.dropped,
      counters: Object.freeze({ ...this.counts }),
      byKind: Object.freeze({ clock: Object.freeze({ ...this.kinds.clock }),
        render: Object.freeze({ ...this.kinds.render }), update: Object.freeze({ ...this.kinds.update }) }),
      records: Object.freeze([...this.records]),
    });
  }
}
