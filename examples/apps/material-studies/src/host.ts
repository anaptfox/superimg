/** The host has one producer, one render in flight, and one latest pending state. */
export type UpdateOutcome = 'accepted' | 'coalesced' | 'disposed';
export class LatestPump<T> {
  private pending: { value: T; resolve: (result: UpdateOutcome) => void } | undefined;
  private running = false;
  private disposed = false;
  private idleWaiters: Array<() => void> = [];
  accepted = 0;
  coalesced = 0;
  failures = 0;
  get busy(): boolean { return this.running; }
  constructor(private readonly apply: (value: T) => Promise<void>, private readonly onError: (error: unknown) => void) {}

  submit(value: T): Promise<UpdateOutcome> {
    if (this.disposed) return Promise.resolve('disposed');
    return new Promise((resolve) => {
      if (this.pending) { this.pending.resolve('coalesced'); this.coalesced++; }
      this.pending = { value, resolve };
      if (!this.running) void this.drain();
    });
  }

  idle(): Promise<void> {
    if (!this.running && !this.pending) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  dispose(): void {
    this.disposed = true;
    this.pending?.resolve('disposed');
    this.pending = undefined;
    if (!this.running) this.finishIdle();
  }

  private async drain(): Promise<void> {
    this.running = true;
    while (this.pending && !this.disposed) {
      const next = this.pending;
      this.pending = undefined;
      try {
        await this.apply(next.value);
        if (this.disposed) next.resolve('disposed');
        else { this.accepted++; next.resolve('accepted'); }
      } catch (error) {
        this.failures++;
        next.resolve('disposed');
        if (!this.disposed) this.onError(error);
      }
    }
    this.running = false;
    this.finishIdle();
  }

  private finishIdle(): void { for (const resolve of this.idleWaiters.splice(0)) resolve(); }
}

/** Import completion does not grant an obsolete selection a rendering surface. */
export class SelectionEpoch {
  private value = 0;
  begin(): number { return ++this.value; }
  current(ticket: number): boolean { return this.value === ticket; }
  dispose(): void { this.value++; }
}

export class HostClock {
  seconds = 0;
  playing = false;
  private suspensionCount = 0;
  private last = 0;
  private nextFrame = 0;
  constructor(public duration: number, readonly fps = 30) {}
  /** Live gestures may need a repair interval beyond the initial scrub range. */
  extendThrough(seconds: number): void { if (Number.isFinite(seconds)) this.duration = Math.max(this.duration, seconds); }
  play(now: number): void { this.playing = true; this.last = now; this.nextFrame = now; }
  pause(): void { this.playing = false; }
  seek(seconds: number): void { this.seconds = Math.max(0, Math.min(this.duration, seconds)); }
  get suspended(): boolean { return this.suspensionCount > 0; }
  suspend(): () => void {
    this.suspensionCount++;
    let released = false;
    return () => { if (!released) { released = true; this.suspensionCount--; this.last = 0; } };
  }
  tick(now: number): number | null {
    if (!this.playing || this.suspended) { this.last = now; return null; }
    if (!this.last) { this.last = now; this.nextFrame = now; }
    const delta = Math.min(250, Math.max(0, now - this.last));
    this.last = now;
    this.seconds = Math.min(this.duration, this.seconds + delta / 1000);
    if (this.duration - this.seconds < 1e-9) this.seconds = this.duration;
    if (now < this.nextFrame) return null;
    const interval = 1000 / this.fps;
    this.nextFrame += Math.max(1, Math.floor((now - this.nextFrame) / interval) + 1) * interval;
    if (this.seconds >= this.duration) this.pause();
    return this.seconds;
  }
}

export interface StrokePoint { x: number; y: number; at: number }
export interface BrushStroke { id: string; points: readonly StrokePoint[]; radius: number }

/** Normalized coordinates respect the actual contained 16:9 canvas. */
export function canvasPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): { x: number; y: number } | null {
  const scale = Math.min(rect.width / 1280, rect.height / 720);
  const width = 1280 * scale;
  const height = 720 * scale;
  const x = (clientX - rect.left - (rect.width - width) / 2) / width;
  const y = (clientY - rect.top - (rect.height - height) / 2) / height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

export function appendStrokePoint(points: readonly StrokePoint[], point: StrokePoint): readonly StrokePoint[] {
  const last = points.at(-1);
  if (last && (point.at - last.at < 1 / 30 || Math.hypot((point.x - last.x) * 1280, (point.y - last.y) * 720) < 6)) return points;
  return [...points, point];
}

/** Chunking bounds each record without deleting impulses that still affect the paint. */
export class StrokeRecorder {
  private chunk = 0;
  strokes: readonly BrushStroke[] = [];
  private active: BrushStroke | undefined;
  begin(id: string, radius: number, point: StrokePoint): void {
    this.active = { id, radius, points: [point] };
    this.strokes = [...this.strokes, this.active];
  }
  append(point: StrokePoint, final = false): void {
    if (!this.active) return;
    const old = this.active;
    const points = final ? [...old.points, point] : appendStrokePoint(old.points, point);
    if (points === old.points) return;
    if (points.length > 64) {
      // Start a new ordered chunk. The previous endpoint remains in its original record only.
      this.active = { id: `${old.id.split('/')[0]}/${++this.chunk}`, radius: old.radius, points: [point] };
      this.strokes = [...this.strokes, this.active];
    } else {
      this.active = { ...old, points };
      this.strokes = [...this.strokes.slice(0, -1), this.active];
    }
  }
  end(): void { this.active = undefined; }
  reset(): void { this.strokes = []; this.active = undefined; this.chunk = 0; }
}

export function fingerprint(value: unknown): string {
  const json = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i++) { hash ^= json.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}
