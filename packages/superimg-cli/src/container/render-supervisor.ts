import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type {
  EncodingOptions,
  RenderExecutionOptions,
  RenderLimits,
} from "@superimg/types";
import {
  RenderExecutionError,
  createLinkedExecutionSignal,
  executionErrorFromSignal,
} from "@superimg/types";

export type RenderSupervisorRequest =
  | {
      type: "render";
      template: string;
      data?: Record<string, unknown>;
      encoding?: EncodingOptions;
      startFrame?: number;
      endFrame?: number;
      limits?: RenderLimits;
      maxOutputBytes?: number;
    }
  | {
      type: "info";
      template: string;
      limits?: RenderLimits;
    };

export interface RenderSupervisorOptions {
  concurrency: number;
  maxQueued: number;
  cancellationGraceMs: number;
  workerReadyTimeoutMs?: number;
  /** Override used by supervisor tests; production uses the bundled worker. */
  workerPath?: string;
}

interface Job {
  id: string;
  request: RenderSupervisorRequest;
  execution: ReturnType<typeof createLinkedExecutionSignal>;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  clientSettled: boolean;
  slot?: WorkerSlot;
  forceTimer?: ReturnType<typeof setTimeout>;
  onAbort(): void;
}

interface WorkerSlot {
  index: number;
  child: ChildProcess;
  ready: boolean;
  active?: Job;
}

interface WorkerMessage {
  type: "ready" | "renderResult" | "infoResult" | "error";
  jobId?: string;
  bytes?: Buffer | Uint8Array;
  info?: unknown;
  message?: string;
  code?: string;
}

export class RenderSupervisor {
  readonly #options: RenderSupervisorOptions;
  readonly #slots: WorkerSlot[] = [];
  readonly #queue: Job[] = [];
  #started = false;
  #closing = false;

  constructor(options: RenderSupervisorOptions) {
    const concurrency = Number.isFinite(options.concurrency) ? options.concurrency : 1;
    const maxQueued = Number.isFinite(options.maxQueued) ? options.maxQueued : 0;
    const cancellationGraceMs = Number.isFinite(options.cancellationGraceMs)
      ? options.cancellationGraceMs
      : 2_000;
    this.#options = {
      ...options,
      concurrency: Math.max(1, Math.floor(concurrency)),
      maxQueued: Math.max(0, Math.floor(maxQueued)),
      cancellationGraceMs: Math.max(0, Math.floor(cancellationGraceMs)),
    };
  }

  get activeCount(): number {
    return this.#slots.filter((slot) => slot.active !== undefined).length;
  }

  get queuedCount(): number {
    return this.#queue.length;
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    await Promise.all(
      Array.from({ length: this.#options.concurrency }, (_, index) => this.#spawn(index)),
    );
  }

  run<T>(request: RenderSupervisorRequest, options: RenderExecutionOptions = {}): Promise<T> {
    if (!this.#started || this.#closing) {
      return Promise.reject(new RenderExecutionError("aborted", "Render supervisor is not accepting work"));
    }
    const available = this.#slots.some((slot) => slot.ready && !slot.active);
    if (!available && this.#queue.length >= this.#options.maxQueued) {
      return Promise.reject(new RenderExecutionError("queue_full", "Render queue is full"));
    }

    const execution = createLinkedExecutionSignal(options);
    return new Promise<T>((resolve, reject) => {
      const job: Job = {
        id: crypto.randomUUID(),
        request,
        execution,
        resolve,
        reject,
        clientSettled: false,
        onAbort: () => this.#cancel(job),
      };
      if (execution.signal.aborted) {
        this.#settleClient(job, undefined, executionErrorFromSignal(execution.signal));
        execution.dispose();
        return;
      }
      execution.signal.addEventListener("abort", job.onAbort, { once: true });
      this.#queue.push(job);
      this.#drain();
    });
  }

  async close(): Promise<void> {
    if (this.#closing) return;
    this.#closing = true;
    for (const job of this.#queue.splice(0)) {
      this.#settleClient(job, undefined, new RenderExecutionError("aborted", "Render supervisor is closing"));
      this.#cleanupJob(job);
    }
    for (const slot of this.#slots) {
      if (slot.active) this.#cancel(slot.active);
      slot.child.disconnect();
    }
    await Promise.allSettled(
      this.#slots.map((slot) => new Promise<void>((resolve) => {
        if (slot.child.exitCode !== null) resolve();
        else slot.child.once("exit", () => resolve());
      })),
    );
  }

  async #spawn(index: number): Promise<void> {
    const workerPath = this.#options.workerPath
      ?? fileURLToPath(new URL("./container-worker.js", import.meta.url));
    const child = fork(workerPath, [], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      serialization: "advanced",
      env: process.env,
    });
    const slot: WorkerSlot = { index, child, ready: false };
    const existing = this.#slots.findIndex((candidate) => candidate.index === index);
    if (existing >= 0) this.#slots[existing] = slot;
    else this.#slots.push(slot);

    const readyTimeoutMs = this.#options.workerReadyTimeoutMs ?? 30_000;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Render worker ${index} did not become ready within ${readyTimeoutMs}ms`));
      }, readyTimeoutMs);
      const onMessage = (raw: unknown) => {
        const message = raw as WorkerMessage;
        if (message.type !== "ready") return;
        clearTimeout(timeout);
        slot.ready = true;
        child.off("message", onMessage);
        resolve();
      };
      child.on("message", onMessage);
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timeout);
        if (!slot.ready) reject(new Error(`Render worker ${index} exited during startup (${code ?? signal})`));
      });
    });

    child.on("message", (raw) => this.#onMessage(slot, raw as WorkerMessage));
    child.on("exit", (code, signal) => this.#onExit(slot, code, signal));
    this.#drain();
  }

  #drain(): void {
    for (const slot of this.#slots) {
      if (!slot.ready || slot.active) continue;
      let job = this.#queue.shift();
      while (job?.execution.signal.aborted) {
        this.#settleClient(job, undefined, executionErrorFromSignal(job.execution.signal));
        this.#cleanupJob(job);
        job = this.#queue.shift();
      }
      if (!job) return;
      slot.active = job;
      job.slot = slot;
      slot.child.send({
        ...job.request,
        jobId: job.id,
        ...(job.execution.deadlineMs !== undefined ? { deadlineMs: job.execution.deadlineMs } : {}),
      });
    }
  }

  #cancel(job: Job): void {
    const error = executionErrorFromSignal(job.execution.signal);
    if (!job.slot) {
      const index = this.#queue.indexOf(job);
      if (index >= 0) this.#queue.splice(index, 1);
      this.#settleClient(job, undefined, error);
      this.#cleanupJob(job);
      return;
    }

    this.#settleClient(job, undefined, error);
    job.slot.child.send({ type: "cancel", jobId: job.id });
    job.forceTimer = setTimeout(() => {
      if (job.slot?.active === job) job.slot.child.kill("SIGKILL");
    }, this.#options.cancellationGraceMs);
  }

  #onMessage(slot: WorkerSlot, message: WorkerMessage): void {
    const job = slot.active;
    if (!job || message.jobId !== job.id) return;
    if (message.type === "renderResult") {
      const bytes = message.bytes instanceof Uint8Array
        ? new Uint8Array(message.bytes)
        : new Uint8Array();
      this.#settleClient(job, bytes);
      this.#release(slot, job);
    } else if (message.type === "infoResult") {
      this.#settleClient(job, message.info);
      this.#release(slot, job);
    } else if (message.type === "error") {
      const error = new Error(message.message ?? "Render worker failed") as Error & { code?: string };
      if (message.code) error.code = message.code;
      this.#settleClient(job, undefined, error);
      this.#release(slot, job);
    }
  }

  #onExit(slot: WorkerSlot, code: number | null, signal: NodeJS.Signals | null): void {
    slot.ready = false;
    const job = slot.active;
    if (job) {
      this.#settleClient(job, undefined, new Error(`Render worker exited (${code ?? signal ?? "unknown"})`));
      this.#release(slot, job, false);
    }
    if (!this.#closing) {
      void this.#spawn(slot.index).catch((error) => {
        console.error(`[superimg] failed to restart render worker ${slot.index}:`, error);
      });
    }
  }

  #settleClient(job: Job, value?: unknown, error?: unknown): void {
    if (job.clientSettled) return;
    job.clientSettled = true;
    if (error !== undefined) job.reject(error);
    else job.resolve(value);
  }

  #release(slot: WorkerSlot, job: Job, shouldDrain = true): void {
    if (slot.active !== job) return;
    slot.active = undefined;
    job.slot = undefined;
    this.#cleanupJob(job);
    if (shouldDrain) this.#drain();
  }

  #cleanupJob(job: Job): void {
    if (job.forceTimer !== undefined) clearTimeout(job.forceTimer);
    job.execution.signal.removeEventListener("abort", job.onAbort);
    job.execution.dispose();
  }
}
