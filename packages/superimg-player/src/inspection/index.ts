import { measureSurface, surfaceDocument } from "./geometry.js";
import { waitForResources } from "./readiness.js";
import { PreviewInspectionError, type InspectionPlayer, type PreviewControl, type PreviewInspection, type PreviewMode, type PreviewSnapshot, type PreviewSurfaceOptions, type PreviewTarget } from "./types.js";
export * from "./types.js";
export { captureAccepted, captureFreshness, type AcceptedCaptureAdapter, type AcceptedCaptureReport, type CaptureSnapshot, type CaptureFreshness, type PreviewCompilationState, type InspectionSourceIdentity } from "./capture.js";
const playerHost = (player: InspectionPlayer): HTMLElement => "hostElement" in player ? player.hostElement : player.container;

interface Mounted {
  options: PreviewSurfaceOptions;
  controls: Set<PreviewControl>;
  mode: PreviewMode;
  resumeInput: (() => void) | undefined;
  wasPlaying: boolean;
  readiness: PreviewSnapshot["readiness"];
  barrier: AbortController | undefined;
  request: number;
  unsubscribe: () => void;
}

export function createPreviewInspection(options: { readinessTimeoutMs?: number } = {}): PreviewInspection {
  const timeoutMs = options.readinessTimeoutMs ?? 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("readinessTimeoutMs must be finite and positive");
  const surfaces = new Map<string, Mounted>();
  let disposed = false;
  const error = (code: string, message: string, id: string): never => { throw new PreviewInspectionError(code, message, id); };
  const get = (id: string): Mounted => {
    if (disposed) return error("DISPOSED", "Inspection is disposed", id);
    const mounted = surfaces.get(id);
    if (!mounted) return error("UNKNOWN_SURFACE", `Unknown preview surface: ${id}`, id);
    if (mounted.options.player.getPresentation().disposed) return error("DISPOSED", "Player is disposed", id);
    return mounted;
  };
  const target = (input: PreviewTarget, control: PreviewControl): Mounted => {
    const mounted = get(input.surfaceId);
    if (!mounted.controls.has(control)) return error("CONTROL_NOT_ENABLED", `${control} is not enabled`, input.surfaceId);
    if (mounted.options.player.getPresentation().generation !== input.expectedGeneration) return error("STALE_GENERATION", "Player generation changed", input.surfaceId);
    return mounted;
  };
  const snapshot = (id: string, mounted: Mounted): PreviewSnapshot => {
    const { player, presentation, interactive } = mounted.options;
    const shown = player.getPresentation();
    const state = player.getState();
    const program = presentation?.snapshot();
    const frame = shown.accepted?.frame ?? null;
    const schedule = player.getCompositionSchedule?.();
    const parts = presentation?.parts ?? [];
    const activeLeaves = schedule?.leaves.filter((leaf) => frame !== null && frame >= leaf.startFrame && frame < leaf.endFrame) ?? [];
    const currentPart = program?.mode === "timeline"
      ? parts.find((part) => activeLeaves.some((leaf) => leaf.path === part.id || leaf.path.startsWith(`${part.id}/`)))?.id ?? null
      : program?.currentId ?? null;
    const guide = interactive?.guide;
    const stepId = guide?.steps && frame !== null
      ? guide.steps.find((step) => frame >= step.startFrame && frame < step.endFrame)?.stepId ?? null
      : shown.requestedFrame === frame ? guide?.currentStep?.stepId ?? null : null;
    const document = surfaceDocument(playerHost(player))?.document;
    const sidecar = document && shown.accepted ? mounted.options.sidecar?.({ document, frame: shown.accepted.frame, revision: shown.accepted.revision, generation: shown.generation }) : undefined;
    const measured = measureSurface(playerHost(player), state.width, state.height);
    return {
      schemaVersion: 1, surfaceId: id, generation: shown.generation, source: mounted.options.source ?? null,
      ...(mounted.options.compilation ? { compilation: structuredClone(mounted.options.compilation) } : {}),
      ...(mounted.options.coordinates ? { coordinates: { ...mounted.options.coordinates } } : {}),
      requestedFrame: shown.requestedFrame, presented: shown.accepted ? { frame: shown.accepted.frame, revision: shown.accepted.revision } : null,
      width: state.width, height: state.height, fps: state.fps, totalFrames: state.totalFrames,
      clock: { owner: mounted.mode === "inspection" ? "inspection" : player.getDriveKind?.() ?? "playback", isPlaying: state.isPlaying },
      currentPart, parts, routes: program?.mode === "timeline" ? schedule?.selectedRoutes ?? program.routes : program?.routes ?? schedule?.selectedRoutes ?? {},
      activeOccurrences: activeLeaves.map((leaf) => ({ path: leaf.path, startFrame: leaf.startFrame, endFrame: leaf.endFrame, localFrame: Math.floor(Math.min((frame ?? 0) - leaf.startFrame, (leaf.contentEndFrame ?? leaf.endFrame) - leaf.startFrame - 1) * (leaf.fps ?? state.fps) / state.fps), width: leaf.width, height: leaf.height })),
      stepId,
      semantic: sidecar?.semantic ? { ...(shown.accepted?.semantic ?? {}), $host: sidecar.semantic } : shown.accepted?.semantic ?? null,
      ...measured,
      nodes: sidecar?.nodes ? [...measured.nodes, ...sidecar.nodes] : measured.nodes,
      readiness: { ...mounted.readiness }, disposed: shown.disposed,
    };
  };
  const finish = async (id: string, mounted: Mounted, request: number): Promise<PreviewSnapshot> => {
    if (surfaces.get(id) !== mounted || mounted.request !== request) return error("PRESENTATION_SUPERSEDED", "Inspection request was superseded", id);
    const accepted = mounted.options.player.getPresentation();
    if (!accepted.accepted) return error("NOT_PRESENTED", "No accepted frame", id);
    const revision = accepted.accepted.revision;
    const generation = accepted.generation;
    const doc = surfaceDocument(playerHost(mounted.options.player));
    if (!doc) return error("SURFACE_UNAVAILABLE", "Committed same-origin Player document unavailable", id);
    const barrier = new AbortController();
    mounted.barrier?.abort();
    mounted.barrier = barrier;
    mounted.readiness = { status: "pending", error: null };
    try {
      await waitForResources(doc.document, id, timeoutMs, barrier.signal, mounted.options.readiness ? (signal) => mounted.options.readiness!({ document: doc.document, signal, frame: accepted.accepted!.frame }) : undefined);
      const current = mounted.options.player.getPresentation();
      if (!surfaces.has(id) || current.disposed || mounted.request !== request || generation !== current.generation || revision !== current.accepted?.revision) return error("PRESENTATION_SUPERSEDED", "Accepted presentation changed during resource readiness", id);
      mounted.readiness = { status: "ready", error: null };
      return snapshot(id, mounted);
    } catch (cause) {
      if (mounted.request === request) mounted.readiness = { status: "failed", error: cause instanceof Error ? cause.message : String(cause) };
      throw cause;
    } finally { if (mounted.barrier === barrier) mounted.barrier = undefined; }
  };
  const control = async (input: PreviewTarget, name: PreviewControl, perform: (mounted: Mounted) => Promise<unknown>): Promise<PreviewSnapshot> => {
    const mounted = target(input, name);
    if (mounted.mode !== "inspection") return error("CLOCK_NOT_OWNED", "Enter inspection mode before selecting exact media state", input.surfaceId);
    const request = ++mounted.request;
    mounted.barrier?.abort();
    try { await perform(mounted); }
    catch (cause) {
      if (cause instanceof PreviewInspectionError) throw cause;
      return error((cause as { code?: string })?.code === "PLAYER_PRESENTATION_SUPERSEDED" ? "PRESENTATION_SUPERSEDED" : "SELECTION_FAILED", cause instanceof Error ? cause.message : String(cause), input.surfaceId);
    }
    return finish(input.surfaceId, mounted, request);
  };
  const detach = (id: string, mounted: Mounted): void => {
    if (surfaces.get(id) !== mounted) return;
    surfaces.delete(id);
    mounted.request++;
    mounted.barrier?.abort();
    mounted.unsubscribe();
    mounted.resumeInput?.();
    if (mounted.wasPlaying && !mounted.options.player.getPresentation().disposed) mounted.options.player.play();
  };
  return {
    attach(surface) {
      if (disposed) return error("DISPOSED", "Inspection is disposed", surface.surfaceId);
      if (!surface.surfaceId || surfaces.has(surface.surfaceId)) return error("DUPLICATE_SURFACE", "Surface id must be nonempty and unique", surface.surfaceId);
      const mounted: Mounted = { options: surface, controls: new Set(surface.controls ?? []), mode: "live", resumeInput: undefined, barrier: undefined, wasPlaying: false, readiness: { status: "unverified", error: null }, request: 0, unsubscribe: () => undefined };
      mounted.unsubscribe = surface.player.on("presentation", (shown) => {
        mounted.readiness = { status: "unverified", error: null };
        mounted.barrier?.abort();
        if (shown.disposed) detach(surface.surfaceId, mounted);
        else if (mounted.mode === "inspection" && surface.player.getState().isPlaying) surface.player.pause();
      });
      surfaces.set(surface.surfaceId, mounted);
      return { dispose: () => detach(surface.surfaceId, mounted) };
    },
    list: () => Array.from(surfaces, ([surfaceId, mounted]) => ({ surfaceId, generation: mounted.options.player.getPresentation().generation, controls: [...mounted.controls] })),
    inspect: async ({ surfaceId }) => snapshot(surfaceId, get(surfaceId)),
    async setMode(input) {
      const mounted = target(input, "set-mode");
      if (input.mode !== "inspection" && input.mode !== "live") return error("INVALID_INPUT", "Unknown preview mode", input.surfaceId);
      if (mounted.mode !== input.mode) {
        mounted.request++;
        mounted.barrier?.abort();
        if (input.mode === "inspection") {
          const player = mounted.options.player;
          if (player.getDriveKind?.() && !player.suspendDrive && !mounted.options.suspendInput) return error("CLOCK_NOT_OWNED", "Host cannot suspend driven input", input.surfaceId);
          mounted.wasPlaying = player.getState().isPlaying;
          mounted.resumeInput = mounted.options.suspendInput?.() ?? player.suspendDrive?.();
          mounted.mode = "inspection";
          player.pause();
        } else {
          mounted.mode = "live";
          mounted.resumeInput?.(); mounted.resumeInput = undefined;
          if (mounted.wasPlaying) mounted.options.player.play();
          mounted.wasPlaying = false;
        }
      }
      return snapshot(input.surfaceId, mounted);
    },
    seek: (input) => control(input, "seek-frame", async (mounted) => {
      const total = mounted.options.player.getState().totalFrames;
      if (!Number.isInteger(input.frame) || input.frame < 0 || input.frame >= total) return error("FRAME_OUT_OF_RANGE", `Frame must be within 0..${total - 1}`, input.surfaceId);
      await mounted.options.player.seek({ frame: input.frame });
      if (mounted.options.player.getPresentation().accepted?.frame !== input.frame) return error("PRESENTATION_SUPERSEDED", "Requested frame was not accepted", input.surfaceId);
    }),
    selectPart: (input) => control(input, "select-part", async (mounted) => {
      const session = mounted.options.presentation;
      if (!session) return error("CONTROL_NOT_ENABLED", "Surface has no presentation", input.surfaceId);
      if (snapshot(input.surfaceId, mounted).currentPart !== input.partId) {
        const result = await session.go(input.partId);
        if (result.status !== "success") return error("SELECTION_FAILED", result.message, input.surfaceId);
      }
    }),
    selectRoute: (input) => control(input, "select-route", async (mounted) => {
      const session = mounted.options.presentation;
      if (!session) return error("CONTROL_NOT_ENABLED", "Surface has no presentation", input.surfaceId);
      if (session.snapshot().routes[input.path] !== input.selection) {
        const result = await session.choose(input.path, input.selection);
        if (result.status !== "success") return error("ROUTE_LOAD_FAILED", result.message, input.surfaceId);
      }
    }),
    selectStep: (input) => control(input, "select-step", async (mounted) => {
      const guide = mounted.options.interactive?.guide;
      if (!guide) return error("CONTROL_NOT_ENABLED", "Surface has no guide", input.surfaceId);
      if (snapshot(input.surfaceId, mounted).stepId !== input.stepId) await guide.goToStep(input.stepId);
    }),
    dispose() { for (const [id, mounted] of surfaces) detach(id, mounted); disposed = true; },
  };
}

export { describeSelectedPart, selectedPartTransform, type SelectedPart, type SelectedPartCompilation } from "./selected-part.js";
