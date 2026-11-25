//! Host-driven projections of a retained Program.

import type { CanvasSize, CompositionEntryData, CompositionSchedule, InteractiveCompositionRuntime, Program, SequenceProgram } from "@superimg/types";
import { SuperImgError } from "@superimg/types";
import { interactiveCompositionRuntimes, sequence, time } from "@superimg/core/composition";
import type { DomPlayer } from "./dom-player.js";
import type { LoadOptions, LoadResult, PlayerInput } from "./player-types.js";
import { loadErrorResult, supersededLoadResult } from "./player-load.js";
import { createPartProjector } from "./program-projector.js";

export interface ProgramPresentationOptions {
  readonly mode: "manual" | "timeline";
  readonly size: CanvasSize;
  readonly fps: number;
  readonly routes?: Readonly<Record<string, string>>;
  readonly initialId?: string;
  /** Keep host asset/font/source bindings when selecting another route. */
  readonly loadOptions?: LoadOptions;
  readonly inspection?: boolean;
  readonly prepare?: (media: PlayerInput, context: ProgramPrepareContext) => ProgramPreparedMedia | Promise<ProgramPreparedMedia>;
}

export interface ProgramPrepareContext {
  readonly mode: "manual" | "timeline";
  readonly routes: Readonly<Record<string, string>>;
  readonly partId: string | null;
  readonly loadOptions?: LoadOptions;
}

export interface ProgramPreparedMedia {
  readonly media: PlayerInput;
  readonly loadOptions?: LoadOptions;
}

export interface ProgramPendingOperation {
  readonly kind: "load" | "navigate" | "route";
  readonly partId: string | null;
  readonly routes: Readonly<Record<string, string>>;
}

export interface ProgramSnapshot {
  readonly mode: "manual" | "timeline";
  readonly currentId: string | null;
  readonly currentIndex: number;
  readonly routes: Readonly<Record<string, string>>;
  readonly data: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly interactive: Readonly<Record<string, unknown>>;
  /** Requested selection, distinct from the committed currentId/routes. */
  readonly pending: ProgramPendingOperation | null;
  /** Latest settled selection outcome; null while a newer operation is pending. */
  readonly result: LoadResult | null;
  readonly disposed: boolean;
}

export interface ProgramActionEvent {
  readonly path: string;
  readonly action: string;
  readonly nodeId: string;
  readonly frame: number;
  /** Identity of the mounted render that declared this action. */
  readonly presentation: {
    readonly generation: number;
    readonly revision: number;
    readonly frame: number;
    readonly sceneId: string;
  };
}

export interface ProgramEvents {
  action: ProgramActionEvent;
  state: ProgramSnapshot;
}

export interface ProgramSession {
  readonly mode: "manual" | "timeline";
  readonly parts: readonly { readonly id: string; readonly label?: string }[];
  readonly ready: Promise<LoadResult>;
  readonly currentId: string | null;
  readonly currentIndex: number;
  go(id: string): Promise<LoadResult>;
  next(): Promise<LoadResult>;
  previous(): Promise<LoadResult>;
  choose(path: string, selection: string): Promise<LoadResult>;
  setData(path: string, patch: Record<string, unknown>): Promise<void>;
  setScene(path: string, scene: unknown): Promise<void>;
  /** Operation-state changes, not per-frame clock events. Read snapshot() for initial state. */
  on<K extends keyof ProgramEvents>(event: K, listener: (event: ProgramEvents[K]) => void): () => void;
  snapshot(): ProgramSnapshot;
  dispose(): void;
}

export type ProgramPlayer = Pick<DomPlayer, "load" | "update" | "seek" | "getState"> &
  Partial<Pick<DomPlayer, "getPresentation" | "getCompositionSchedule" | "cancelPendingLoad">> &
  ({ readonly container: HTMLElement } | { readonly hostElement: HTMLElement });

/**
 * Present one retained Program with a host-controlled clock. Manual mode
 * treats top-level sequence entries as pages; timeline mode keeps one full
 * rendered projection and seeks named entries on the same Player.
 */
export function present(
  player: ProgramPlayer,
  program: Program,
  options: ProgramPresentationOptions,
): ProgramSession {
  if (!Number.isInteger(options.fps) || options.fps <= 0) throw new RangeError("present() fps must be a positive integer.");

  const manualProgram: SequenceProgram = program.op === "sequence"
    ? program
    : sequence([{ id: "root", content: program }]);
  const parts = manualProgram.parts.map(({ id }) => ({ id }));
  if (parts.length === 0) throw new Error("A Program presentation requires at least one named part.");
  const initialId = options.initialId ?? parts[0]!.id;
  const initialIndex = parts.findIndex((part) => part.id === initialId);
  if (initialIndex < 0) throw new Error(`Unknown initial program part: ${initialId}`);
  const initialRoutes = { ...(options.routes ?? {}) };
  let routes: Record<string, string> = {};
  const data: Record<string, Record<string, unknown>> = {};
  const scopedData: Record<string, Record<string, unknown>> = {};
  const interactiveRuntimes = new Map<string, InteractiveCompositionRuntime>();
  const interactiveBindings = new Map<string, {
    readonly semanticPath: string;
    readonly sceneId?: string;
    readonly generation: number | undefined;
    readonly schedule: CompositionSchedule | undefined;
  }>();
  const interactiveScenes: Record<string, unknown> = {};
  const actionListeners = new Set<(event: ProgramActionEvent) => void>();
  const stateListeners = new Set<(event: ProgramSnapshot) => void>();
  let pending: ProgramPendingOperation | null = Object.freeze({ kind: "load", partId: initialId, routes: Object.freeze({ ...initialRoutes }) });
  let result: LoadResult | null = null;
  let initialized = false;
  let actionDisposers: Array<() => void> = [];
  let currentId: string | null = null;
  let currentIndex = -1;
  let disposed = false;
  let request = 0;
  let resolvedResult: LoadResult | undefined;
  let timelineSchedule: CompositionSchedule | undefined;
  const loadPlayer = {
    load: (input: PlayerInput, loadOptions?: LoadOptions) => player.load(input, mergeLoadOptions(options.loadOptions, loadOptions)),
    cancelPendingLoad: () => player.cancelPendingLoad?.(),
  };
  const projectorOptions = (selectedRoutes: Readonly<Record<string, string>>) => ({
    size: options.size, fps: options.fps, routes: selectedRoutes,
    ...(options.inspection ? { inspection: true } : {}),
    ...(options.prepare || Object.keys(interactiveScenes).length ? { prepare: async (part: import("./program-projector.js").ProgramPart) => {
      const preparationRequest = request;
      const loadOptions = mergeLoadOptions(options.loadOptions, part.loadOptions);
      const prepared = options.prepare ? await options.prepare(part.media, {
        mode: "manual", routes: Object.freeze({ ...selectedRoutes }), partId: part.id,
        ...(loadOptions ? { loadOptions } : {}),
      }) : { media: part.media };
      if (disposed || preparationRequest !== request) throw new SuperImgError(
        "Load was superseded by a newer request.", "PLAYER_LOAD_SUPERSEDED",
        {}, "Use the result of the most recent load request.",
      );
      applyInteractiveSceneInputs(manualInteractiveEntries(part));
      return prepared;
    } } : {}),
  });
  let projector = options.mode === "manual"
    ? createPartProjector(loadPlayer, manualProgram, { ...projectorOptions(initialRoutes), ...(options.initialId ? { initialId: options.initialId } : {}) })
    : null;

  const media = (selectedRoutes = routes) => time(program, {
    size: options.size,
    fps: options.fps,
    ...(Object.keys(selectedRoutes).length ? { routes: selectedRoutes } : {}),
    ...(options.inspection ? { inspection: true } : {}),
  });

  const bindInteractive = (entries: readonly { path: string; runtime: InteractiveCompositionRuntime; semanticPath: string; sceneId?: string }[], schedule?: CompositionSchedule) => {
    for (const dispose of actionDisposers.splice(0)) dispose();
    interactiveRuntimes.clear();
    interactiveBindings.clear();
    const generation = player.getPresentation?.().generation;
    for (const { path, runtime, semanticPath, sceneId } of entries) {
      interactiveRuntimes.set(path, runtime);
      const binding = { semanticPath, ...(sceneId !== undefined ? { sceneId } : {}), generation, schedule };
      interactiveBindings.set(path, binding);
      const host = "container" in player ? player.container : player.hostElement;
      actionDisposers.push(runtime.attachActions(host, () => player.getPresentation?.().accepted?.frame ?? player.getState().currentFrame, (event) => {
        if (disposed || interactiveBindings.get(path) !== binding) return;
        const shown = player.getPresentation?.();
        if (!shown || shown.isPending !== false) return;
        const snapshot = acceptedSemantic(binding, shown);
        const accepted = shown.accepted;
        if (!accepted || event.frame !== accepted.frame || !isActionScene(snapshot)) return;
        const node = snapshot.nodes.find((node) => node.id === event.nodeId);
        if (!node || !visibleActionNode(snapshot, node) || !node.actions.includes(event.action)) return;
        const qualified: ProgramActionEvent = Object.freeze({
          path, action: event.action, nodeId: event.nodeId, frame: accepted.frame,
          presentation: Object.freeze({ generation: shown.generation, revision: accepted.revision, frame: accepted.frame, sceneId: snapshot.sceneId }),
        });
        for (const listener of actionListeners) listener(qualified);
      }));
    }
  };

  const loadTimeline = async (selectedRoutes: Readonly<Record<string, string>>, token: number): Promise<LoadResult> => {
    const projection = media(selectedRoutes);
    const loadOptions = mergeLoadOptions(options.loadOptions, Object.keys(scopedData).length
      ? { data: { uses: scopedData } as CompositionEntryData } : undefined);
    player.cancelPendingLoad?.();
    let prepared: ProgramPreparedMedia;
    try {
      prepared = options.prepare ? await options.prepare(projection, {
        mode: "timeline", routes: Object.freeze({ ...selectedRoutes }), partId: null,
        ...(loadOptions ? { loadOptions } : {}),
      }) : { media: projection };
    } catch (error) {
      return disposed || token !== request ? supersededLoadResult() : loadErrorResult(error);
    }
    if (disposed || token !== request) return supersededLoadResult();
    applyInteractiveSceneInputs(interactiveCompositionRuntimes(prepared.media));
    const result = await player.load(prepared.media, mergeLoadOptions(loadOptions, prepared.loadOptions));
    if (disposed || token !== request) return supersededLoadResult();
    if (result.status === "success") {
      resolvedResult = result;
      timelineSchedule = player.getCompositionSchedule?.() ?? prepared.media.composition?.schedule;
      routes = { ...selectedRoutes };
      syncTimelineCurrent();
      bindInteractive(interactiveCompositionRuntimes(prepared.media).map((entry) => ({ ...entry, semanticPath: entry.path, sceneId: entry.path })), timelineSchedule);
    }
    return result;
  };

  const ready = (async (): Promise<LoadResult> => {
    try {
      const loaded = options.mode === "manual" ? await projector!.ready : await loadTimeline(initialRoutes, 0);
      if (disposed) return supersededLoadResult();
      if (loaded.status === "success") {
        resolvedResult = loaded;
        if (options.mode === "manual") {
          routes = { ...initialRoutes };
          currentId = projector!.currentId;
          currentIndex = initialIndex;
          const part = projector!.parts.find((candidate) => candidate.id === currentId);
          bindInteractive(manualInteractiveEntries(part), player.getCompositionSchedule?.() ?? part?.media.composition?.schedule);
          if (currentId) await applyManualScopedData(currentId);
        }
      }
      return settle(0, loaded);
    } catch (error) {
      return settle(0, loadErrorResult(error));
    } finally { initialized = true; }
  })();
  void ready.catch(() => undefined);

  const assertActive = () => { if (disposed) throw new Error("ProgramSession is disposed"); };
  const seekPart = async (index: number, token: number): Promise<LoadResult> => {
    assertActive();
    if (options.mode === "timeline") syncTimelineCurrent();
    const normalized = Math.max(0, Math.min(parts.length - 1, index));
    const part = parts[normalized]!;
    if (options.mode === "manual") {
      player.cancelPendingLoad?.();
      const result = await projector!.go(part.id);
      if (disposed || token !== request) return supersededLoadResult();
      if (result.status === "success") {
        resolvedResult = result;
        currentId = part.id;
        currentIndex = normalized;
        const selected = projector!.parts.find((candidate) => candidate.id === part.id);
        bindInteractive(manualInteractiveEntries(selected), player.getCompositionSchedule?.() ?? selected?.media.composition?.schedule);
        await applyManualScopedData(part.id);
      }
      return result;
    }
    assertActive();
    if (!resolvedResult) throw new Error("Program timeline is not loaded");
    player.cancelPendingLoad?.();
    const leaves = timelineSchedule?.leaves ?? [];
    const occurrences = leaves.filter((leaf) => leaf.path === part.id || leaf.path.startsWith(`${part.id}/`));
    const frame = occurrences.length ? Math.min(...occurrences.map((leaf) => leaf.startFrame)) : 0;
    await player.seek({ frame });
    if (disposed || token !== request) return supersededLoadResult();
    currentId = part.id;
    currentIndex = normalized;
    if (!resolvedResult) throw new Error("Program timeline is not loaded");
    return resolvedResult;
  };

  return {
    mode: options.mode,
    parts,
    ready,
    get currentId() { if (options.mode === "timeline") syncTimelineCurrent(); return currentId; },
    get currentIndex() { if (options.mode === "timeline") syncTimelineCurrent(); return currentIndex; },
    go(id) {
      const index = parts.findIndex((part) => part.id === id);
      if (index < 0) throw new Error(`Unknown program part: ${id}`);
      return navigate(index);
    },
    next: () => navigate(requestedIndex() + 1),
    previous: () => navigate(requestedIndex() - 1),
    choose(path, selection) {
      return operate("route", currentId ?? initialId, { ...routes, [path]: selection }, token => chooseRoute(path, selection, token));
    },
    async setData(path, patch) {
      assertActive();
      if (!path || !patch || typeof patch !== "object" || Array.isArray(patch)) throw new TypeError("setData() requires a qualified path and object patch.");
      if (options.mode === "manual" && path === currentId) {
        const nextData = { ...(data[path] ?? {}), ...patch };
        data[path] = nextData;
        await player.update({ data: nextData });
        return;
      }
      scopedData[path] = { ...(scopedData[path] ?? {}), ...patch };
      await player.update({ data: options.mode === "manual"
        ? { uses: pageScopedData(currentId) } as CompositionEntryData
        : { uses: scopedData } as CompositionEntryData });
    },
    async setScene(path, scene) {
      assertActive();
      const runtime = interactiveRuntimes.get(path);
      if (!runtime) throw new Error(`No interactive child at program path "${path}".`);
      interactiveScenes[path] = scene;
      runtime.setScene(scene);
      await player.seek({ frame: player.getState().currentFrame });
    },
    on(event, listener) {
      assertActive();
      if (event === "state") {
        const callback = listener as (state: ProgramSnapshot) => void;
        stateListeners.add(callback);
        return () => stateListeners.delete(callback);
      }
      if (event !== "action") throw new Error(`Unknown ProgramSession event: ${event}`);
      const callback = listener as (event: ProgramActionEvent) => void;
      actionListeners.add(callback);
      return () => actionListeners.delete(callback);
    },
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      request++;
      projector?.dispose();
      for (const dispose of actionDisposers.splice(0)) dispose();
      actionListeners.clear();
      interactiveRuntimes.clear();
      interactiveBindings.clear();
      if (pending) result = supersededLoadResult();
      pending = null;
      publish();
      stateListeners.clear();
    },
  };

  async function chooseRoute(path: string, selection: string, token: number): Promise<LoadResult> {
    assertActive();
    if (options.mode === "timeline") syncTimelineCurrent();
    const priorId = currentId;
    const priorFrame = player.getPresentation?.().accepted?.frame ?? player.getState().currentFrame;
    const previousSchedule = options.mode === "timeline" ? timelineSchedule : undefined;
    const previousLeaf = previousSchedule?.leaves.find((leaf) =>
      priorFrame >= leaf.startFrame && priorFrame < leaf.endFrame,
    );
    const localFrame = previousLeaf ? priorFrame - previousLeaf.startFrame : 0;
    const selectedRoutes = { ...routes, [path]: selection };
    try {
      if (options.mode === "timeline") {
        const result = await loadTimeline(selectedRoutes, token);
        if (result.status === "success" && priorId) {
          const nextLeaves = timelineSchedule?.leaves.filter((leaf) =>
            leaf.path === priorId || leaf.path.startsWith(`${priorId}/`),
          ) ?? [];
          const target = nextLeaves.find((leaf) => localFrame < leaf.endFrame - leaf.startFrame) ?? nextLeaves[0];
          if (target) {
            await player.seek({ frame: target.startFrame + Math.min(localFrame, target.endFrame - target.startFrame - 1) });
            if (disposed || token !== request) return supersededLoadResult();
            syncTimelineCurrent();
          }
        }
        return result;
      }
      const selectedId = currentId ?? initialId;
      const previousProjector = projector!;
      const candidate = createPartProjector(loadPlayer, manualProgram, { ...projectorOptions(selectedRoutes), initialId: selectedId });
      const result = await candidate.ready;
      if (disposed || token !== request) {
        candidate.dispose();
        return supersededLoadResult();
      }
      if (result.status === "success") {
        previousProjector.dispose();
        projector = candidate;
        routes = selectedRoutes;
        resolvedResult = result;
        currentId = candidate.currentId;
        currentIndex = parts.findIndex((part) => part.id === currentId);
        const selected = candidate.parts.find((part) => part.id === currentId);
        bindInteractive(manualInteractiveEntries(selected), player.getCompositionSchedule?.() ?? selected?.media.composition?.schedule);
        if (currentId) await applyManualScopedData(currentId);
      } else {
        candidate.dispose();
      }
      return result;
    } catch (error) {
      if (disposed || token !== request) return supersededLoadResult();
      throw error;
    }
  }

  function requestedIndex(): number {
    if (pending?.partId) return parts.findIndex(part => part.id === pending!.partId);
    if (options.mode === "timeline") syncTimelineCurrent();
    return currentIndex < 0 ? initialIndex : currentIndex;
  }

  function navigate(index: number): Promise<LoadResult> {
    const normalized = Math.max(0, Math.min(parts.length - 1, index));
    return operate("navigate", parts[normalized]!.id, routes, token => seekPart(normalized, token));
  }

  async function operate(kind: ProgramPendingOperation["kind"], partId: string | null,
    selectedRoutes: Readonly<Record<string, string>>, perform: (token: number) => Promise<LoadResult>): Promise<LoadResult> {
    assertActive();
    if (!initialized) await ready;
    assertActive();
    const token = ++request;
    pending = Object.freeze({ kind, partId, routes: Object.freeze({ ...selectedRoutes }) });
    result = null;
    publish();
    // A listener may issue a newer command or dispose while observing the request.
    if (disposed || token !== request) return supersededLoadResult();
    try { return settle(token, await perform(token)); }
    catch (error) { return settle(token, loadErrorResult(error)); }
  }

  function settle(token: number, outcome: LoadResult): LoadResult {
    if (disposed || token !== request) return supersededLoadResult();
    pending = null;
    result = Object.freeze({ ...outcome });
    publish();
    return outcome;
  }

  function publish(): void {
    const state = snapshot();
    for (const listener of stateListeners) {
      // Observation cannot change a successful engine operation into a failed load.
      try { listener(state); } catch (error) { console.error("Program state listener failed", error); }
    }
  }

  function snapshot(): ProgramSnapshot {
    if (options.mode === "timeline") syncTimelineCurrent();
    const shown = player.getPresentation?.();
    return Object.freeze({
      mode: options.mode, currentId, currentIndex, pending, result, disposed,
      routes: Object.freeze({ ...routes }),
      data: Object.freeze(Object.fromEntries(
        [...Object.entries(scopedData), ...Object.entries(data)].map(([path, value]) => [path, Object.freeze({ ...value })]),
      )),
      interactive: Object.freeze(Object.fromEntries([...interactiveBindings].flatMap(([path, binding]) => {
        const semantic = acceptedSemantic(binding, shown);
        return semantic === undefined ? [] : [[path, semantic]];
      }))),
    });
  }

  function syncTimelineCurrent(): void {
    const frame = player.getPresentation?.().accepted?.frame ?? player.getState().currentFrame;
    const schedule = timelineSchedule;
    if (!schedule) return;
    const active = schedule.leaves.find((leaf) => frame >= leaf.startFrame && frame < leaf.endFrame);
    if (!active) return;
    const topId = program.op === "sequence" ? active.path.split("/")[0]! : "root";
    const index = parts.findIndex((part) => part.id === topId);
    if (index >= 0) { currentId = topId; currentIndex = index; }
  }

  function manualInteractiveEntries(part: import("./program-projector.js").ProgramPart | undefined): { path: string; runtime: InteractiveCompositionRuntime; semanticPath: string; sceneId?: string }[] {
    if (!part) return [];
    const entries = part.interactiveRuntime ? [{ path: part.id, runtime: part.interactiveRuntime, semanticPath: "root" }] : [];
    return [
      ...entries,
      ...interactiveCompositionRuntimes(part.media).map(({ path, runtime }) => ({ path: `${part.id}/${path}`, runtime, semanticPath: path, sceneId: path })),
    ];
  }

  function applyInteractiveSceneInputs(entries: readonly { path: string; runtime: InteractiveCompositionRuntime }[]): void {
    for (const { path, runtime } of entries) {
      if (Object.hasOwn(interactiveScenes, path)) runtime.setScene(interactiveScenes[path]);
    }
  }

  function acceptedSemantic(binding: {
    readonly semanticPath: string;
    readonly sceneId?: string;
    readonly generation: number | undefined;
    readonly schedule: CompositionSchedule | undefined;
  }, shown: ReturnType<DomPlayer["getPresentation"]> | undefined): unknown {
    if (disposed || !shown || !shown.isReady || shown.disposed || shown.generation !== binding.generation || !shown.accepted) return undefined;
    const { accepted } = shown;
    if (binding.schedule && !binding.schedule.leaves.some((leaf) => leaf.path === binding.semanticPath && accepted.frame >= leaf.startFrame && accepted.frame < leaf.endFrame)) return undefined;
    const snapshot = accepted.semantic?.[binding.semanticPath];
    if (binding.sceneId !== undefined && (!isActionScene(snapshot) || snapshot.sceneId !== binding.sceneId)) return undefined;
    return snapshot;
  }

  function pageScopedData(pageId: string | null): Record<string, Record<string, unknown>> {
    if (!pageId) return {};
    const prefix = `${pageId}/`;
    return Object.fromEntries(Object.entries(scopedData).flatMap(([path, patch]) =>
      path.startsWith(prefix) ? [[path.slice(prefix.length), patch]] : [],
    ));
  }

  async function applyManualScopedData(pageId: string): Promise<void> {
    const uses = pageScopedData(pageId);
    if (Object.keys(uses).length) await player.update({ data: { uses } as CompositionEntryData });
  }
}

interface ActionScene {
  readonly sceneId: string;
  readonly nodes: readonly {
    readonly id: string;
    readonly actions: readonly string[];
    readonly visible: boolean;
    readonly opacity?: number;
    readonly parentId?: string | null;
  }[];
}

/** Narrow the interactive-owned sidecar without adding a Player package dependency. */
function isActionScene(value: unknown): value is ActionScene {
  return !!value && typeof value === "object" &&
    "sceneId" in value && typeof value.sceneId === "string" && value.sceneId.length > 0 &&
    "nodes" in value && Array.isArray(value.nodes) && value.nodes.every((node: unknown) =>
      !!node && typeof node === "object" && "id" in node && typeof node.id === "string" &&
      "visible" in node && typeof node.visible === "boolean" && "actions" in node &&
      Array.isArray(node.actions) && node.actions.every((action: unknown) => typeof action === "string") &&
      (!("opacity" in node) || (typeof node.opacity === "number" && Number.isFinite(node.opacity))) &&
      (!("parentId" in node) || node.parentId === null || typeof node.parentId === "string"),
    );
}

function visibleActionNode(scene: ActionScene, target: ActionScene["nodes"][number]): boolean {
  const visited = new Set<string>();
  let node: ActionScene["nodes"][number] | undefined = target;
  while (node) {
    if (!node.visible || (node.opacity !== undefined && node.opacity <= 0) || visited.has(node.id)) return false;
    visited.add(node.id);
    if (!node.parentId) return true;
    const parentId: string = node.parentId;
    node = scene.nodes.find((parent) => parent.id === parentId);
  }
  return false;
}

function mergeLoadOptions(base: LoadOptions | undefined, extra: LoadOptions | undefined): LoadOptions | undefined {
  if (!base) return extra;
  if (!extra) return base;
  return { ...base, ...extra,
    ...(base.data || extra.data ? { data: { ...base.data, ...extra.data } } : {}),
    ...(base.assets || extra.assets ? { assets: { ...base.assets, ...extra.assets } } : {}),
  };
}
