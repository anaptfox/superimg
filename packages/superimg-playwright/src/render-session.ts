import {
  createRenderPlan,
  executeRenderPlan,
  executeRenderPlanParallel,
  type ExecuteRenderPlanCallbacks,
} from "@superimg/core/engine";
import type {
  AudioValue,
  EncodingOptions,
  Rasterizer,
  RenderJob,
  RenderPlan,
  RenderExecutionOptions,
  RenderLimits,
  ResolvedAssetDeclaration,
  VideoEncoder,
} from "@superimg/types";
import { RenderExecutionError, raceWithExecution, resolveCaptureDefaults } from "@superimg/types";
import { resolve } from "node:path";
import { PlaywrightEngine } from "./playwright-engine.js";

export interface RenderSessionOptions {
  concurrency?: number;
  engine?: RenderSessionEngine<unknown>;
}

export interface RenderSessionRenderOptions extends RenderExecutionOptions {
  assetUrlResolver?: (absolutePath: string) => string;
  resolvedAssets?: ResolvedAssetDeclaration[];
  templateDir?: string;
  startFrame?: number;
  endFrame?: number;
  callbacks?: ExecuteRenderPlanCallbacks;
  limits?: RenderLimits;
}

export interface RenderSessionEngine<TFrame> {
  init(): Promise<void>;
  createAdapters(options?: { encoding?: EncodingOptions; audio?: AudioValue }): {
    renderer: Rasterizer<TFrame>;
    encoder: VideoEncoder<TFrame>;
  };
  createParallelRenderers?(count: number, options?: { dpr?: number; width?: number; height?: number }): Promise<Rasterizer<TFrame>[]>;
  registerAsset?(filePath: string): string;
  dispose(): Promise<void>;
}

export class RenderSession<TFrame = Buffer> {
  private readonly engine: RenderSessionEngine<TFrame>;
  private readonly ownsEngine: boolean;
  private readonly concurrency: number;
  private initialized = false;
  private closing = false;
  private closed = false;
  private renderTail: Promise<void> = Promise.resolve();

  constructor(options: RenderSessionOptions = {}) {
    this.engine = (options.engine ?? new PlaywrightEngine()) as RenderSessionEngine<TFrame>;
    this.ownsEngine = options.engine === undefined;
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  }

  async render(job: RenderJob, options: RenderSessionRenderOptions = {}): Promise<Uint8Array> {
    if (this.closing || this.closed) {
      throw new RenderExecutionError("aborted", "RenderSession is closed");
    }
    const previous = this.renderTail;
    let release!: () => void;
    this.renderTail = new Promise<void>((resolve) => { release = resolve; });
    try {
      await raceWithExecution(previous, options);
      return await this.renderNow(job, options);
    } finally {
      // An aborted queued job must not let the next job overtake its still-active
      // predecessor. Settle this queue link after both the predecessor and this
      // job, without delaying the caller's cancellation result.
      void previous.then(release, release);
    }
  }

  private async renderNow(job: RenderJob, options: RenderSessionRenderOptions): Promise<Uint8Array> {
    await raceWithExecution(this.ensureInitialized(), options);
    const plan = await this.createPlan(job, options);
    const execution = {
      ...(options.callbacks ?? {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
      ...(options.cleanupTimeoutMs !== undefined ? { cleanupTimeoutMs: options.cleanupTimeoutMs } : {}),
    };

    if (this.concurrency > 1 && this.engine.createParallelRenderers) {
      const { encoder } = this.engine.createAdapters({
        ...(plan.encoding !== undefined ? { encoding: plan.encoding } : {}),
        ...(plan.audio !== undefined ? { audio: plan.audio } : {}),
      });
      const capture = resolveCaptureDefaults(plan.encoding?.format, plan.encoding?.capture, plan.encoding?.video?.alpha === "keep");
      const renderers = await this.engine.createParallelRenderers(this.concurrency, { dpr: capture.dpr, width: plan.width, height: plan.height });
      return executeRenderPlanParallel(plan, renderers, encoder, execution);
    }

    const { renderer, encoder: singleEncoder } = this.engine.createAdapters({
      ...(plan.encoding !== undefined ? { encoding: plan.encoding } : {}),
      ...(plan.audio !== undefined ? { audio: plan.audio } : {}),
    });
    if (this.concurrency > 1) {
      return executeRenderPlan(plan, renderer, singleEncoder, execution);
    }
    return executeRenderPlan(plan, renderer, singleEncoder, execution);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closing = true;
    await this.renderTail;
    if (this.ownsEngine || this.initialized) {
      await this.engine.dispose();
    }
    this.initialized = false;
    this.closed = true;
    this.closing = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.engine.init();
    this.initialized = true;
  }

  private createPlan(job: RenderJob, options: RenderSessionRenderOptions): Promise<RenderPlan> {
    const registerAsset = options.assetUrlResolver ?? this.engine.registerAsset?.bind(this.engine);
    const assetResolver = registerAsset === undefined
      ? undefined
      : options.templateDir === undefined
        ? registerAsset
        : (name: string) => registerAsset(resolve(options.templateDir!, "assets", name));
    return createRenderPlan(job, {
      ...(assetResolver !== undefined ? { assetResolver } : {}),
      ...(options.resolvedAssets !== undefined ? { resolvedAssets: options.resolvedAssets } : {}),
      ...(options.startFrame !== undefined ? { startFrame: options.startFrame } : {}),
      ...(options.endFrame !== undefined ? { endFrame: options.endFrame } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
      ...(options.cleanupTimeoutMs !== undefined ? { cleanupTimeoutMs: options.cleanupTimeoutMs } : {}),
      ...(options.limits !== undefined ? { limits: options.limits } : {}),
    });
  }
}

export async function createRenderSession(options: RenderSessionOptions = {}): Promise<RenderSession> {
  const session = new RenderSession(options);
  return session;
}
