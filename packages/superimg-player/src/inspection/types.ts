import type { CompositionSchedule } from "@superimg/types";
import type { LoadResult, PlayerPresentation } from "../player-types.js";
import type { ProgramSnapshot } from "../program.js";
import type { PreviewCompilationState } from "./capture.js";
import type { BrowserDocumentObservation } from "@superimg/core/html";

export type PreviewControl = "set-mode" | "seek-frame" | "select-part" | "select-route" | "select-step";
export type PreviewMode = "inspection" | "live";
export interface InspectionPlayerRuntime {
  getState(): { width: number; height: number; fps: number; totalFrames: number; isPlaying: boolean; isReady: boolean };
  getPresentation(): PlayerPresentation;
  getCompositionSchedule?(): CompositionSchedule | null;
  getDriveKind?(): "scroll" | "pointer" | null;
  suspendDrive?(): () => void;
  play(): void;
  pause(): void;
  seek(to: { frame: number }): Promise<void>;
  on(event: "presentation", listener: (value: PlayerPresentation) => void): () => void;
}
/** Both public Player facades expose their host without private-field access. */
export type InspectionPlayer = InspectionPlayerRuntime & (
  { readonly container: HTMLElement } | { readonly hostElement: HTMLElement }
);
/** Host-controlled Program inspection. Commands may coordinate additional host state. */
export interface InspectionPresentation {
  readonly parts: readonly { readonly id: string; readonly label?: string }[];
  snapshot(): Pick<ProgramSnapshot, "mode" | "currentId" | "routes">;
  go(id: string): Promise<LoadResult>;
  choose(path: string, selection: string): Promise<LoadResult>;
}
export interface PreviewTarget { surfaceId: string; expectedGeneration: number }
export interface PreviewSurfaceOptions {
  surfaceId: string;
  player: InspectionPlayer;
  presentation?: InspectionPresentation;
  interactive?: { guide: { goToStep(stepId: string): Promise<void>; readonly currentStep: { stepId: string } | null; readonly steps?: readonly { stepId: string; startFrame: number; endFrame: number }[] } };
  controls?: readonly PreviewControl[];
  source?: Readonly<{ id: string; revision?: string }>;
  /** Current host compilation intent; accepted source remains `source`. */
  compilation?: PreviewCompilationState;
  coordinates?: Readonly<{ entryId: string | null; variantId: string | null; editionId: string | null }>;
  /** Additional host-owned resource barrier, e.g. a canvas readiness token. */
  readiness?: (context: { document: Document; signal: AbortSignal; frame: number }) => Promise<void>;
  /** Required when a custom host clock cannot be suspended by the Player. */
  suspendInput?: () => (() => void);
  /** Host-supplied canvas semantics for this exact accepted presentation. Pixel coverage remains opaque. */
  sidecar?: (context: { document: Document; frame: number; revision: number; generation: number }) => { semantic?: Readonly<Record<string, unknown>>; nodes?: readonly PreviewNode[] };
}
export interface PreviewBounds { x: number; y: number; width: number; height: number }
export interface PreviewNode {
  id: string;
  occurrence: string | null;
  kind: string;
  actions: readonly string[];
  sceneId: string | null;
  bounds: PreviewBounds;
  authoredBounds: PreviewBounds | null;
}
export interface PreviewSnapshot {
  schemaVersion: 1;
  surfaceId: string;
  generation: number;
  source: PreviewSurfaceOptions["source"] | null;
  compilation?: PreviewCompilationState | null;
  coordinates?: PreviewSurfaceOptions["coordinates"];
  /** Bounded rendered-DOM evidence, separate from canonical authored nodes. */
  observations?: BrowserDocumentObservation | null;
  requestedFrame: number | null;
  presented: { frame: number; revision: number } | null;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  clock: { owner: "inspection" | "playback" | "scroll" | "pointer" | "host"; isPlaying: boolean };
  currentPart: string | null;
  parts: readonly { id: string; label?: string }[];
  routes: Readonly<Record<string, string>>;
  activeOccurrences: readonly { path: string; startFrame: number; endFrame: number; localFrame: number; width: number; height: number }[];
  stepId: string | null;
  semantic: Readonly<Record<string, unknown>> | null;
  nodes: readonly PreviewNode[];
  geometry: { coordinateSpace: "host-viewport"; iframePath: readonly string[]; dpr: number; surface: PreviewBounds; frame: PreviewBounds | null; content?: PreviewBounds | null };
  readiness: { status: "unverified" | "pending" | "ready" | "failed"; error: string | null };
  coverage: { dom: "measured" | "unavailable"; opaque: readonly { kind: string; bounds: PreviewBounds }[] };
  disposed: boolean;
}
export interface PreviewInspection {
  attach(options: PreviewSurfaceOptions): { dispose(): void };
  list(): readonly { surfaceId: string; generation: number; controls: readonly PreviewControl[] }[];
  inspect(input: { surfaceId: string }): Promise<PreviewSnapshot>;
  setMode(input: PreviewTarget & { mode: PreviewMode }): Promise<PreviewSnapshot>;
  seek(input: PreviewTarget & { frame: number }): Promise<PreviewSnapshot>;
  selectPart(input: PreviewTarget & { partId: string }): Promise<PreviewSnapshot>;
  selectRoute(input: PreviewTarget & { path: string; selection: string }): Promise<PreviewSnapshot>;
  selectStep(input: PreviewTarget & { stepId: string }): Promise<PreviewSnapshot>;
  dispose(): void;
}

export class PreviewInspectionError extends Error {
  constructor(readonly code: string, message: string, readonly surfaceId: string) {
    super(message);
    this.name = "PreviewInspectionError";
  }
}
