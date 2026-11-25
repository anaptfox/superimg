//! Framework-neutral controller for one interactive definition + live host data.

import { Player, type LoadOptions, type LoadResult } from "@superimg/player";
import { SuperImgError } from "@superimg/types";
import type {
  CanvasSize,
  Marker,
} from "@superimg/types";
import type {
  GuideCheckpoint,
  InteractiveDefinition,
  SceneActionEvent,
  SceneSnapshot,
  SceneStyleRenderer,
  SceneRuntimeInput,
} from "./contracts.js";
import { ensureInteractiveActionPolicy, interactiveFrame, lowerInteractiveControllerDefinition } from "./definition.js";
import type { InteractiveRuntimeTemplate, InteractiveControllerData, InteractiveEvaluationInput } from "./definition.js";
import {
  InteractiveGuideController,
  type InteractiveStepListener,
} from "./guide-controller.js";
import { InteractiveSceneController } from "./scene-controller.js";
import { checkInteractiveScene } from "./check.js";

export interface CreateInteractivePlayerOptions {
  container: string | HTMLElement;
  size?: CanvasSize;
  autoplay?: boolean;
  playbackMode?: "once" | "loop";
  playerMode?: "render-only" | "dev";
  sceneRenderer?: SceneStyleRenderer;
  sceneStyle?: string;
  markers?: Marker[];
}

export interface InteractiveLoadOptions<TData> extends Pick<LoadOptions, "assets" | "assetResolver" | "fonts" | "performance"> {
  data: TData;
  autoplay?: boolean;
  sceneRenderer?: SceneStyleRenderer;
  sceneStyle?: string;
  markers?: Marker[];
}

export interface InteractiveUpdate<TData> {
  /** Root fields patch current data; nested records replace, matching setData(). */
  data?: TData;
  size?: CanvasSize;
  sceneStyle?: string | undefined;
}

export interface InteractivePlayerEvents {
  action: (event: SceneActionEvent) => void;
  stepchange: (step: GuideCheckpoint | null, index: number) => void;
  sceneupdate: (scene: SceneSnapshot) => void;
  error: (error: Error) => void;
}

/** Interactive-only façade over the passive media playback engine. */
export class InteractivePlayerController<TData = unknown> {
  readonly player: Player;
  readonly guide: InteractiveGuideController;
  readonly scene: InteractiveSceneController;
  private definition: InteractiveDefinition<TData> | null = null;
  private runtimeTemplate: InteractiveRuntimeTemplate<InteractiveControllerData<TData>> | null = null;
  private acceptedInput: InteractiveEvaluationInput<TData> | null = null;
  private requestedInput: InteractiveEvaluationInput<TData> | null = null;
  private attemptedScene: SceneRuntimeInput = {};
  private inputVersion = 0;
  private committedGeneration: number | null = null;
  private lastScene: SceneSnapshot | null = null;
  private actionDocument: Document | null = null;
  private actionIframe: HTMLIFrameElement | null = null;
  private actionGeneration: number | null = null;
  private actionDisposer: (() => void) | null = null;
  private loadVersion = 0;
  private disposed = false;
  private readonly options: CreateInteractivePlayerOptions;
  private readonly disposers: Array<() => void> = [];
  private readonly events: {
    [K in keyof InteractivePlayerEvents]?: Set<InteractivePlayerEvents[K]>;
  } = {};

  constructor(options: CreateInteractivePlayerOptions) {
    this.options = options;
    this.player = new Player({
      container: options.container,
      ...(options.size !== undefined ? { size: options.size } : {}),
      playbackMode: options.playbackMode ?? "once",
      playerMode: options.playerMode ?? "render-only",
    });
    const self = this;
    this.guide = new InteractiveGuideController({
      get currentFrame() {
        return self.player.currentFrame;
      },
      get fps() {
        return self.player.fps;
      },
      get duration() {
        return self.player.totalDurationSeconds;
      },
      seekFrame: async (frame) => {
        await self.player.seek({ frame });
      },
    });
    this.scene = new InteractiveSceneController({
      getSnapshot: () => this.acceptedScene(),
      setInput: (input) => { this.attemptedScene = input; },
      render: async () => {
        try { await this.update({}); }
        catch (error) {
          // Player.render historically gives scene commands this typed outcome.
          // MediaSession.update currently rejects supersession as a plain Error.
          if (error instanceof Error && (error as Error & { code?: string }).code === "MEDIA_SESSION_UPDATE_SUPERSEDED") {
            throw new SuperImgError("Presentation was superseded by a newer request.", "PLAYER_PRESENTATION_SUPERSEDED", {}, "Use the accepted presentation from the most recent request.");
          }
          throw error;
        }
      },
    });
    this.disposers.push(
      this.player.on("frame", (frame) => {
        if (this.player.getPresentation().generation === this.committedGeneration) this.guide.onFrame(frame);
      }),
      this.player.on("presentation", () => this.publishScene()),
      this.player.on("rendered", () => this.installActionDispatch()),
      this.player.on("error", (error) => {
        // A failed transaction can notify observers before update() rejects.
        // Reentrant recovery must start from accepted host/style/size inputs.
        // Do not discard a newer request that still owns presentation authority.
        if (this.player.getPresentation().isPending === false) this.requestedInput = this.acceptedInput;
        this.emit("error", error);
      }),
      this.guide.onStepChange((step, index) =>
        this.emit("stepchange", step, index),
      ),
    );
  }

  async load(
    definition: InteractiveDefinition<TData>,
    options: InteractiveLoadOptions<TData>,
  ): Promise<LoadResult> {
    const version = ++this.loadVersion;
    const sceneRenderer = options.sceneRenderer ?? this.options.sceneRenderer;
    const sceneStyle = options.sceneStyle ?? this.options.sceneStyle;
    const initial: InteractiveEvaluationInput<TData> = {
      hostData: { ...(definition.sample ?? {}), ...asRuntimeData(options.data) } as TData,
      scene: {},
      ...(sceneStyle !== undefined ? { sceneStyle } : {}),
    };
    const runtimeTemplate = lowerInteractiveControllerDefinition(definition, {
      ...(sceneRenderer !== undefined ? { sceneRenderer } : {}),
      ...(sceneStyle !== undefined ? { sceneStyle } : {}),
    }, initial, (input) => {
      if (this.runtimeTemplate === runtimeTemplate) this.acceptedInput = input;
    });
    // Validate the first evaluated scene inside Player's candidate transaction,
    // before its surface can replace the last accepted session.
    const render = runtimeTemplate.render;
    let checked = false;
    runtimeTemplate.render = (ctx) => {
      const output = render(ctx);
      if (!checked) {
        const check = checkInteractiveScene(runtimeTemplate.getInteractiveSnapshot(), definition.guide);
        if (!check.ok) throw new SuperImgError(
          check.issues.map((issue) => issue.message).join("; "),
          "INTERACTIVE_SCENE_INVALID",
          { issues: check.issues.map((issue) => ({ ...issue })) },
          "Declare every guide state and semantic node in render(ctx).",
        );
        checked = true;
      }
      return output;
    };
    const result = await this.player.load(runtimeTemplate, {
      data: { input: initial },
      ...(options.assets !== undefined ? { assets: options.assets } : {}),
      ...(options.assetResolver !== undefined ? { assetResolver: options.assetResolver } : {}),
      ...(options.fonts !== undefined ? { fonts: options.fonts } : {}),
      ...(options.performance !== undefined ? { performance: options.performance } : {}),
      ...((options.markers ?? this.options.markers) !== undefined
        ? { markers: options.markers ?? this.options.markers! }
        : {}),
    });
    if (version !== this.loadVersion || this.disposed) return result;
    if (result.status === "success") {
      this.definition = definition;
      this.runtimeTemplate = runtimeTemplate;
      this.acceptedInput = { ...initial, size: { width: result.width, height: result.height } };
      this.requestedInput = this.acceptedInput;
      this.attemptedScene = {};
      this.inputVersion++;
      this.scene.resetForDefinition();
      this.committedGeneration = this.player.getPresentation().generation;
      this.guide.load(definition.guide);
      this.installActionDispatch();
      this.guide.onFrame(this.player.getPresentation().accepted!.frame);
      this.publishScene();
      if (!this.disposed && version === this.loadVersion && (options.autoplay ?? this.options.autoplay ?? false)) this.player.play();
    }
    return result;
  }

  /** Patch root host fields and repaint; nested records replace wholesale. */
  async setData(data: TData): Promise<void> {
    await this.update({ data });
  }

  /** Present live data, style and explicit size as one accepted transaction. */
  async update(update: InteractiveUpdate<TData>): Promise<void> {
    const previous = this.requestedInput;
    const runtime = this.runtimeTemplate;
    if (!previous || !runtime) throw new Error("InteractivePlayer must load a definition before update()");
    const input: InteractiveEvaluationInput<TData> = {
      hostData: update.data !== undefined
        ? { ...asRuntimeData(previous.hostData), ...asRuntimeData(update.data) } as TData
        : previous.hostData,
      scene: this.attemptedScene,
      ...(update.size ? { size: { ...update.size } } : previous.size ? { size: previous.size } : {}),
      sceneStyle: Object.prototype.hasOwnProperty.call(update, "sceneStyle") ? update.sceneStyle : previous.sceneStyle,
    };
    const version = ++this.inputVersion;
    this.requestedInput = input;
    try {
      await this.player.update({ data: { input }, ...(input.size ? { size: input.size } : {}) });
    } catch (error) {
      if (this.runtimeTemplate === runtime && version === this.inputVersion) this.requestedInput = this.acceptedInput;
      throw error;
    }
  }

  on<K extends keyof InteractivePlayerEvents>(
    event: K,
    listener: InteractivePlayerEvents[K],
  ): () => void {
    let listeners = this.events[event] as Set<InteractivePlayerEvents[K]> | undefined;
    if (!listeners) {
      listeners = new Set<InteractivePlayerEvents[K]>();
      Object.assign(this.events, { [event]: listeners });
    }
    listeners.add(listener);
    return () => listeners?.delete(listener);
  }

  get sceneSnapshot(): SceneSnapshot {
    return this.scene.snapshot;
  }

  get isReady(): boolean {
    return this.player.isReady;
  }

  play(): void {
    this.player.play();
  }

  pause(): void {
    this.player.pause();
  }

  dispose(): void {
    this.disposed = true;
    this.loadVersion++;
    this.actionDisposer?.();
    this.actionDisposer = null;
    this.actionDocument = null;
    this.actionIframe = null;
    for (const dispose of this.disposers.splice(0)) dispose();
    this.player.dispose();
    for (const listeners of Object.values(this.events)) listeners?.clear();
    this.definition = null;
    this.runtimeTemplate = null;
    this.acceptedInput = null;
    this.requestedInput = null;
    this.committedGeneration = null;
  }

  private emit<K extends keyof InteractivePlayerEvents>(
    event: K,
    ...args: Parameters<InteractivePlayerEvents[K]>
  ): void {
    this.events[event]?.forEach((listener) => {
      (listener as (...values: Parameters<InteractivePlayerEvents[K]>) => void)(
        ...args,
      );
    });
  }

  private installActionDispatch(): void {
    const generation = this.player.getPresentation().generation;
    if (generation === this.actionGeneration && this.actionIframe?.isConnected &&
      this.actionIframe.contentDocument === this.actionDocument) return;
    const container = typeof this.options.container === "string"
      ? document.querySelector(this.options.container)
      : this.options.container;
    const iframe = container ? interactiveFrame(container) : null;
    if (!(iframe instanceof HTMLIFrameElement)) return;
    const documentRoot = iframe.contentDocument;
    if (!documentRoot) return;
    if (documentRoot === this.actionDocument && generation === this.actionGeneration) return;
    iframe.style.pointerEvents = "auto";
    ensureInteractiveActionPolicy(documentRoot);
    this.actionDisposer?.();
    this.actionDocument = documentRoot;
    this.actionIframe = iframe;
    this.actionGeneration = generation;
    const handler = (event: Event) => {
      const shown = this.player.getPresentation();
      if (this.disposed || shown.disposed || !shown.isReady || shown.isPending !== false ||
        shown.generation !== generation || shown.generation !== this.committedGeneration ||
        iframe.contentDocument !== documentRoot || !shown.accepted) return;
      const accepted = shown.accepted;
      const scene = accepted.semantic?.root as SceneSnapshot | undefined;
      if (!scene) return;
      const target = event.target as Element | null;
      const node = target?.closest?.("[data-si-node][data-si-actions]");
      if (!node) return;
      if (node.closest("[data-si-scene-id]")?.getAttribute("data-si-scene-id") !== scene.sceneId) return;
      const nodeId = node.getAttribute("data-si-node");
      const actions = (node.getAttribute("data-si-actions") ?? "").trim().split(/\s+/).filter(Boolean);
      const explicit = target?.closest?.("[data-si-action]")?.getAttribute("data-si-action") ?? null;
      const action = explicit && actions.includes(explicit) ? explicit : actions.length === 1 ? actions[0] : null;
      const declared = scene.nodes.find((value) => value.id === nodeId);
      if (!nodeId || !action || !declared?.actions.includes(action) || !visibleNode(scene, declared.id)) return;
      this.emit("action", Object.freeze({
        action, nodeId, frame: accepted.frame,
        presentation: Object.freeze({ generation, revision: accepted.revision, frame: accepted.frame, sceneId: scene.sceneId }),
      }));
    };
    documentRoot.addEventListener("click", handler, true);
    this.actionDisposer = () => documentRoot.removeEventListener("click", handler, true);
  }

  private acceptedScene(): SceneSnapshot {
    const scene = this.player.getPresentation().accepted?.semantic?.root as SceneSnapshot | undefined;
    if (!scene) throw new Error("InteractivePlayer has no accepted scene");
    return scene;
  }

  private publishScene(): void {
    const shown = this.player.getPresentation();
    if (this.disposed || !shown.isReady || shown.generation !== this.committedGeneration) return;
    const scene = shown.accepted?.semantic?.root as SceneSnapshot | undefined;
    if (scene && scene !== this.lastScene) {
      this.lastScene = scene;
      this.emit("sceneupdate", scene);
    }
  }
}

function visibleNode(scene: SceneSnapshot, id: string): boolean {
  const visited = new Set<string>();
  let current: string | null = id;
  while (current) {
    const node = scene.nodes.find((value) => value.id === current);
    if (!node || !node.visible || node.opacity <= 0 || visited.has(current)) return false;
    visited.add(current);
    current = node.parentId;
  }
  return true;
}

export function createInteractivePlayer<TData = unknown>(
  options: CreateInteractivePlayerOptions,
): InteractivePlayerController<TData> {
  return new InteractivePlayerController<TData>(options);
}

function asRuntimeData<TData>(data: TData): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Interactive live data must be an object");
  }
  return data as Record<string, unknown>;
}
