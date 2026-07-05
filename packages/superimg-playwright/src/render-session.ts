import {
  createRenderPlan,
  executeRenderPlan,
  executeRenderPlanParallel,
  type ExecuteRenderPlanCallbacks,
} from "@superimg/core/engine";
import type {
  AudioValue,
  EncodingOptions,
  FrameRenderer,
  RenderJob,
  RenderPlan,
  ResolvedAssetDeclaration,
  VideoEncoder,
} from "@superimg/types";
import { PlaywrightEngine } from "./playwright-engine.js";

export interface RenderSessionOptions {
  concurrency?: number;
  engine?: RenderSessionEngine<unknown>;
}

export interface RenderSessionRenderOptions {
  assetBaseUrl?: string;
  resolvedAssets?: ResolvedAssetDeclaration[];
  templateDir?: string;
  startFrame?: number;
  endFrame?: number;
  callbacks?: ExecuteRenderPlanCallbacks;
}

export interface RenderSessionEngine<TFrame> {
  init(): Promise<void>;
  createAdapters(options?: { encoding?: EncodingOptions; audio?: AudioValue }): {
    renderer: FrameRenderer<TFrame>;
    encoder: VideoEncoder<TFrame>;
  };
  createParallelRenderers?(count: number): Promise<FrameRenderer<TFrame>[]>;
  getBaseUrl?(): string;
  dispose(): Promise<void>;
}

export class RenderSession<TFrame = Buffer> {
  private readonly engine: RenderSessionEngine<TFrame>;
  private readonly ownsEngine: boolean;
  private readonly concurrency: number;
  private initialized = false;

  constructor(options: RenderSessionOptions = {}) {
    this.engine = (options.engine ?? new PlaywrightEngine()) as RenderSessionEngine<TFrame>;
    this.ownsEngine = options.engine === undefined;
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  }

  async render(job: RenderJob, options: RenderSessionRenderOptions = {}): Promise<Uint8Array> {
    await this.ensureInitialized();
    const plan = await this.createPlan(job, options);

    if (this.concurrency > 1 && this.engine.createParallelRenderers) {
      const { encoder } = this.engine.createAdapters({
        ...(plan.encoding !== undefined ? { encoding: plan.encoding } : {}),
        ...(plan.audio !== undefined ? { audio: plan.audio } : {}),
      });
      const renderers = await this.engine.createParallelRenderers(this.concurrency);
      return executeRenderPlanParallel(plan, renderers, encoder, options.callbacks);
    }

    const { renderer, encoder: singleEncoder } = this.engine.createAdapters({
      ...(plan.encoding !== undefined ? { encoding: plan.encoding } : {}),
      ...(plan.audio !== undefined ? { audio: plan.audio } : {}),
    });
    if (this.concurrency > 1) {
      return executeRenderPlan(plan, renderer, singleEncoder, options.callbacks);
    }
    return executeRenderPlan(plan, renderer, singleEncoder, options.callbacks);
  }

  async close(): Promise<void> {
    if (this.ownsEngine || this.initialized) {
      await this.engine.dispose();
    }
    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.engine.init();
    this.initialized = true;
  }

  private createPlan(job: RenderJob, options: RenderSessionRenderOptions): Promise<RenderPlan> {
    return createRenderPlan(job, {
      ...(options.assetBaseUrl !== undefined
        ? { assetBaseUrl: options.assetBaseUrl }
        : this.engine.getBaseUrl
          ? { assetBaseUrl: this.engine.getBaseUrl() }
          : {}),
      ...(options.resolvedAssets !== undefined ? { resolvedAssets: options.resolvedAssets } : {}),
      ...(options.templateDir !== undefined ? { templateDir: options.templateDir } : {}),
      ...(options.startFrame !== undefined ? { startFrame: options.startFrame } : {}),
      ...(options.endFrame !== undefined ? { endFrame: options.endFrame } : {}),
    });
  }
}

export async function createRenderSession(options: RenderSessionOptions = {}): Promise<RenderSession> {
  const session = new RenderSession(options);
  return session;
}
