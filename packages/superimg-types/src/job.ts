export type JobState = "queued" | "running" | "pausing" | "paused" | "finalizing" | "succeeded" | "failed" | "cancelled";

export interface JobEvent {
  readonly schemaVersion: 0;
  readonly kind: "@foxworth/superimg/job";
  readonly jobId: string;
  readonly state: JobState;
  readonly completed?: number;
  readonly total?: number;
  readonly error?: Readonly<{ message: string; code?: string }>;
  readonly reason?: string;
  /** Exact selected-track decisions, emitted before conversion processing starts. */
  readonly tracks?: readonly import("./media.js").ConversionTrackPlan[];
}

/** In-memory cooperative job. Paused work is not durable across process disposal. */
export interface PausableJob<T> extends AsyncDisposable {
  readonly id: string;
  readonly state: JobState;
  readonly result: Promise<T>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(reason?: string): Promise<void>;
  dispose(): Promise<void>;
  subscribe(listener: (event: JobEvent) => void): () => void;
}
