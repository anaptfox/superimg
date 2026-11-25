//! SuperImg Dev Server - Main entry point (uses Player)

import "./index.css";

import { Player } from "@superimg/player";
import { createInteractivePlayer, type InteractivePlayerController } from "@foxworth/superimg/interactive/player";
import type { InteractiveDefinition } from "@foxworth/superimg/interactive/define";
import { createTimelineController } from "./timeline-controller";
import type { AudioValue, BackgroundValue } from "@superimg/types";
import {
  playPauseBtn,
  exportBtn,
  reloadBtn,
  timelineContainer,
  timelineProgress,
  timelinePlayhead,
  multiTrackTimelineEl,
  currentTimeEl,
  totalTimeEl,
  templateNameEl,
  loopBtn,
  btnFirst,
  btnPrev,
  btnNext,
  btnLast,
  previewContainer,
  settingsBtn,
  settingsPanel,
  helpBtn,
  helpPanel,
  pausedOverlay,
  errorPanelDismiss,
  playerView,
  previewSelection,
  previewVariant,
  previewEdition,
  previewSelectionStatus,
  collectionControls,
  collectionEntry,
  collectionRefresh,
  collectionStatus,
  interactiveControls,
  interactiveStep,
  interactiveStepNote,
  interactiveData,
  interactiveApplyData,
  interactiveReset,
  interactiveStatus,
} from "./dom";

import { initShortcuts } from "./shortcuts";
import { connectWebSocket } from "./server-sync";
import { exporting, initExportHandlers, openExportPanel, setExportMeta, setExportCollectionMode, mediaSessionToken } from "./export";
import { setupPreviewBackgroundSettings } from "./settings";
import { showErrorOverlay, hideErrorOverlay } from "./error-overlay";
import { formatError } from "@superimg/core/errors";
import type { MediaIR, SuperImgError } from "@superimg/types";
import {
  createMultiTrackTimeline,
  type MultiTrackTimelineController,
  type StudioSelection,
} from "./multi-track-timeline.js";
import {
  setStatus,
  showToast,
  showError,
  hideError,
  showLoading,
  hideLoading,
} from "./ui-feedback";
import {
  isStructuredBundleError,
  loadTemplate as loadTemplateImpl,
  templateSource,
  templateBundle,
  readConfigResponse,
  type BundleState,
  type LoadTemplateOptions,
} from "./template-loader";
import { getTemplateDisplayName, initHome, titleFromTemplateDir } from "./home";
import { setupAudioPreview, type AudioPreviewController } from "./audio-preview";
import { mountPreviewInspector } from "./preview-inspector";
import { loadPreviewCandidate, PreviewRequestGate } from "./preview-request";

interface DevConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  audio?: AudioValue;
  assetUrls?: Record<string, string>;
  fonts?: { css?: string; stylesheets?: string[] };
  templateDir?: string;
  editionId?: string;
  entryId?: string;
  variantId?: string;
  previewKind?: "media" | "interactive" | "collection-unavailable";
  mediaKind?: "video" | "gif" | "image" | "svg";
  sourceKind?: "media" | "collection" | "interactive";
  variants?: Array<string | { id: string; label?: string }>;
  editions?: Array<string | { id: string; label?: string }>;
  collection?: { snapshotId: string | null; generation: number; sourcePath?: string; entries: Array<{ id: string; dataDigest?: string }>; selectedEntryId?: string | null; stale?: boolean; staleRequest?: boolean };
}

const bundleState: BundleState = { current: null };

let player: Player | null = null;
let interactiveController: InteractivePlayerController<Record<string, unknown>> | null = null;
let interactiveDefinition: InteractiveDefinition<Record<string, unknown>> | null = null;
let interactiveDataPatch: Record<string, unknown> = {};
let interactiveStatusMessage = "Live interactive preview · export is unavailable for this projection.";
let interactiveListenerDisposer: (() => void) | null = null;
let selectedVariantId = "default";
let selectedEditionId = "default";
let startupVariantId = "default";
let startupEditionId = "default";
let selectedEntryId = "";
let collectionSnapshotId = "";
let collectionSnapshotGeneration = 0;
let collectionSnapshotValid = false;
const previewRequests = new PreviewRequestGate(() => player?.cancelPendingLoad());
let irRequestEpoch = 0;
let previewInspector: ReturnType<typeof mountPreviewInspector> | null = null;
let multiTrack: MultiTrackTimelineController | null = null;
let timelineController: ReturnType<typeof createTimelineController> | null = null;
let storeUnsubscribe: (() => void) | null = null;
let audioPreview: AudioPreviewController | null = null;
let lastMediaIR: MediaIR | null = null;
let loadedTemplate: {
  render: (ctx: unknown) => string;
  defaults?: Record<string, unknown>;
  config?: {
    fonts?: string[];
    inlineCss?: string[];
    stylesheets?: string[];
    background?: BackgroundValue;
  };
} | null = null;
let devConfig: DevConfig;
let templatePath = "/api/template";
let configPath = "/api/config";
let irPath = "/api/ir";
let audioElement: HTMLAudioElement | null = null;
let selectionRequestEpoch = 0;
let inspectorCoordinateKey = "";

function applyAcceptedStageSize(width: number, height: number, title = templateNameEl.textContent ?? "Media", fps = devConfig.fps, duration = devConfig.duration): void {
  previewContainer.style.setProperty("--stage-ar", String(width / Math.max(1, height)));
  previewContainer.style.width = "min(100cqw, calc(100cqh * var(--stage-ar)))";
  previewContainer.style.height = "min(100cqh, calc(100cqw / var(--stage-ar)))";
  setExportMeta({ title, width, height, fps, duration });
}

function bindAcceptedPlayerSession(): void {
  const activePlayer = player;
  const store = activePlayer?.store;
  if (!activePlayer || !store) return;
  const priorTrackSelection: StudioSelection | undefined = multiTrack?.getSelection();

  storeUnsubscribe?.();
  storeUnsubscribe = store.subscribe(updateUI);
  timelineController?.destroy();
  timelineController = createTimelineController(
    { progress: timelineProgress, playhead: timelinePlayhead, currentTime: currentTimeEl, totalTime: totalTimeEl },
    store,
  );
  timelineController.attach(timelineContainer);

  audioPreview?.dispose();
  audioPreview = setupAudioPreview(store, devConfig.audio);
  audioElement = audioPreview.element;

  multiTrack?.destroy();
  multiTrack = null;
  if (
    multiTrackTimelineEl &&
    devConfig.previewKind !== "interactive" &&
    devConfig.mediaKind !== "image" &&
    devConfig.mediaKind !== "svg"
  ) {
    multiTrackTimelineEl.hidden = false;
    multiTrackTimelineEl.classList.remove("hidden");
    multiTrack = createMultiTrackTimeline(store, {
      onSeekFrame: (frame) => {
        const currentStore = player?.store;
        if (currentStore) void currentStore.seekFrame(frame);
        setStatus(`Seek IR interval → frame ${frame}`);
      },
      onSelectionChange: (sel) => {
        if (sel.itemId) {
          setStatus(`Selected ${sel.itemId} · frame ${sel.frame}` +
            (sel.range ? ` · f${sel.range.startFrame}–f${sel.range.endFrame}` : ""));
        }
      },
    });
    multiTrack.mount(multiTrackTimelineEl);
    if (priorTrackSelection) multiTrack.setSelection(priorTrackSelection);
  } else if (multiTrackTimelineEl) {
    multiTrackTimelineEl.hidden = true;
    multiTrackTimelineEl.classList.add("hidden");
  }
  updateUI();
}

function shouldReloadSelectedProjection(): boolean {
  return devConfig?.previewKind === "interactive" ||
    selectedVariantId !== startupVariantId || selectedEditionId !== startupEditionId;
}

function invalidateCollectionSnapshotForHmr(): void {
  if (devConfig?.sourceKind !== "collection") return;
  collectionSnapshotValid = false;
  collectionStatus.textContent = "Source changed. Refresh to materialize a new collection snapshot.";
  updateUI();
}

function mountInspector(template: unknown): void {
  if (!player) return;
  previewInspector?.dispose();
  const coordinates = {
    entryId: devConfig.entryId ?? null,
    variantId: devConfig.variantId ?? selectedVariantId,
    editionId: devConfig.editionId ?? selectedEditionId,
  };
  inspectorCoordinateKey = JSON.stringify(coordinates);
  const inspectUrl = new URL(irPath, location.href);
  inspectUrl.pathname = inspectUrl.pathname.replace(/\/ir$/, "/inspect");
  previewInspector = mountPreviewInspector(player, templatePath, updateUI, templateSource(template), {
    coordinates,
    ...(devConfig.previewKind === "interactive" && interactiveController ? { interactive: interactiveController } : {}),
    ...(devConfig.previewKind === "interactive" ? {} : { inspectUrl: `${inspectUrl.pathname}${inspectUrl.search}` }),
  });
}

function selectedPath(path: string): string {
  const url = new URL(path, location.href);
  // Explicit default coordinates override CLI startup defaults at the host.
  url.searchParams.set("variantId", selectedVariantId);
  url.searchParams.set("editionId", selectedEditionId);
  if (devConfig?.sourceKind === "collection" && collectionSnapshotId && selectedEntryId) {
    url.searchParams.set("snapshotId", collectionSnapshotId);
    url.searchParams.set("entryId", selectedEntryId);
    url.searchParams.set("generation", String(collectionSnapshotGeneration));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function initialSelectedPath(path: string, params: URLSearchParams): string {
  const url = new URL(path, location.href);
  for (const key of ["variantId", "editionId", "snapshotId", "entryId", "generation"] as const) {
    const value = params.get(key);
    if (value !== null) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function setChoiceOptions(select: HTMLSelectElement, ids: DevConfig["variants"], selected: string): void {
  const options = [{ id: "default", label: "Default" }, ...(ids ?? []).map((item) => typeof item === "string" ? { id: item, label: item } : item).filter((item) => item.id !== "default")];
  select.replaceChildren(...options.map((item) => new Option(item.label ?? item.id, item.id)));
  if (!options.some((item) => item.id === selected)) selected = "default";
  select.value = selected;
  select.disabled = options.length < 2;
}

function configurePreviewChoices(config: DevConfig): void {
  selectedVariantId = config.variantId ?? selectedVariantId;
  selectedEditionId = config.editionId ?? selectedEditionId;
  setChoiceOptions(previewVariant, config.variants, selectedVariantId);
  setChoiceOptions(previewEdition, config.editions, selectedEditionId);
  previewSelection.hidden = (config.variants?.length ?? 0) === 0 && (config.editions?.length ?? 0) === 0;
  const isCollection = config.sourceKind === "collection";
  collectionControls.hidden = !isCollection;
  if (!isCollection) return;
  collectionSnapshotId = config.collection?.snapshotId ?? "";
  collectionSnapshotGeneration = config.collection?.generation ?? 0;
  collectionSnapshotValid = Boolean(collectionSnapshotId) && !config.collection?.staleRequest && (config.collection?.entries.length ?? 0) > 0;
  const entries = config.collection?.entries ?? [];
  if (!entries.some((entry) => entry.id === selectedEntryId)) {
    selectedEntryId = config.collection?.selectedEntryId && entries.some((entry) => entry.id === config.collection?.selectedEntryId)
      ? config.collection.selectedEntryId
      : entries[0]?.id ?? "";
  }
  collectionEntry.replaceChildren(...entries.map((entry) => new Option(entry.id, entry.id)));
  if (selectedEntryId) collectionEntry.value = selectedEntryId;
  collectionEntry.disabled = entries.length === 0;
  collectionRefresh.disabled = false;
  collectionStatus.textContent = config.collection?.staleRequest
    ? "This page’s collection snapshot is stale. Refresh to materialize a current snapshot."
    : !collectionSnapshotId
    ? "No accepted collection snapshot. Refresh to materialize entries."
    : entries.length === 0 ? "Snapshot contains no entries." : `Snapshot ready · ${entries.length} entries`;
}

function populateInteractiveGuide(): void {
  const steps = interactiveController?.guide.steps ?? [];
  const selected = interactiveController?.guide.currentStep?.stepId;
  interactiveStep.replaceChildren(...steps.map((step) => new Option(`${step.label} · ${step.stepId}`, step.stepId)));
  interactiveStep.disabled = steps.length === 0;
  if (selected && steps.some((step) => step.stepId === selected)) interactiveStep.value = selected;
  const step = steps.find((item) => item.stepId === interactiveStep.value);
  interactiveStepNote.textContent = step?.note ?? step?.stepId ?? "No guide step is selected.";
}

function updateInteractiveUi(): void {
  const active = devConfig?.previewKind === "interactive" && interactiveController !== null;
  interactiveControls.hidden = !active;
  if (!active) return;
  populateInteractiveGuide();
  interactiveReset.disabled = exporting;
  interactiveApplyData.disabled = exporting;
  interactiveStep.disabled = exporting || interactiveStep.options.length === 0;
  interactiveStatus.textContent = interactiveStatusMessage;
  if (document.activeElement !== interactiveData) interactiveData.value = JSON.stringify(interactiveDataPatch, null, 2);
}

async function applyInteractiveData(): Promise<void> {
  if (!interactiveController) return;
  try {
    const parsed: unknown = JSON.parse(interactiveData.value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("Data patch must be a JSON object.");
    const patch = parsed as Record<string, unknown>;
    await interactiveController.setData(patch);
    interactiveDataPatch = { ...interactiveDataPatch, ...patch };
    interactiveStatusMessage = "Live data applied.";
  } catch (error) {
    interactiveStatusMessage = `Data not applied: ${error instanceof Error ? error.message : String(error)}`;
  }
  interactiveStatus.textContent = interactiveStatusMessage;
}

async function resetInteractiveData(): Promise<void> {
  if (!interactiveController || !interactiveDefinition) return;
  player?.pause();
  try {
    const result = await interactiveController.load(interactiveDefinition, {
      data: {},
      ...(devConfig.assetUrls ? { assetResolver: (filename: string) => devConfig.assetUrls?.[filename] ?? filename } : {}),
      ...(devConfig.fonts ? { fonts: devConfig.fonts } : {}),
    });
    if (result.status === "error") throw new Error(result.message);
    bindAcceptedPlayerSession();
    interactiveDataPatch = {};
    const initialStep = interactiveController.guide.steps[0];
    if (initialStep) await interactiveController.guide.goToStep(initialStep.stepId);
    await player?.seek({ frame: 0 });
    updateInteractiveUi();
    interactiveStatusMessage = "Preview reset to authored sample.";
  } catch (error) {
    interactiveStatusMessage = `Reset failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  interactiveStatus.textContent = interactiveStatusMessage;
}

async function applyPreviewSelection(): Promise<void> {
  const selectionRequest = ++selectionRequestEpoch;
  const previousVariant = selectedVariantId;
  const previousEdition = selectedEditionId;
  const previousEntry = selectedEntryId;
  const previousTemplatePath = templatePath;
  const previousConfigPath = configPath;
  const previousIrPath = irPath;
  const previousConfig = devConfig;
  selectedVariantId = previewVariant.value || "default";
  selectedEditionId = previewEdition.value || "default";
  if (devConfig?.sourceKind === "collection") selectedEntryId = collectionEntry.value || "";
  const nextTemplatePath = selectedPath(templatePath);
  const nextConfigPath = selectedPath(configPath);
  const nextIrPath = selectedPath(irPath);
  previewVariant.disabled = true;
  previewEdition.disabled = true;
  previewSelectionStatus.textContent = "Loading selection…";
  try {
    const response = await fetch(nextConfigPath);
    const nextConfig = await readConfigResponse<DevConfig>(response);
    if (selectionRequest !== selectionRequestEpoch) return;
    templatePath = nextTemplatePath;
    configPath = nextConfigPath;
    irPath = nextIrPath;
    devConfig = nextConfig;
    configurePreviewChoices(nextConfig);
    const accepted = await applyPreviewUpdate("intent", undefined, false);
    if (selectionRequest !== selectionRequestEpoch) return;
    if (accepted === true) {
      const url = new URL(location.href);
      url.searchParams.set("variantId", selectedVariantId);
      url.searchParams.set("editionId", selectedEditionId);
      if (devConfig.sourceKind === "collection") {
        url.searchParams.set("snapshotId", collectionSnapshotId);
        url.searchParams.set("entryId", selectedEntryId);
        url.searchParams.set("generation", String(collectionSnapshotGeneration));
      }
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
      previewSelectionStatus.textContent = "Selection accepted";
    }
    else if (accepted === false) {
      selectedVariantId = previousVariant;
      selectedEditionId = previousEdition;
      selectedEntryId = previousEntry;
      templatePath = previousTemplatePath;
      configPath = previousConfigPath;
      irPath = previousIrPath;
      devConfig = previousConfig;
      configurePreviewChoices(previousConfig);
      const url = new URL(location.href);
      url.searchParams.set("variantId", previousVariant);
      url.searchParams.set("editionId", previousEdition);
      if (previousConfig.sourceKind === "collection") {
        url.searchParams.set("snapshotId", collectionSnapshotId);
        url.searchParams.set("entryId", previousEntry);
        url.searchParams.set("generation", String(collectionSnapshotGeneration));
      }
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
      previewSelectionStatus.textContent = "Selection failed; previous preview kept";
    } else previewSelectionStatus.textContent = "Selection update superseded by a newer preview";
  } catch (error) {
    if (selectionRequest !== selectionRequestEpoch) return;
    selectedVariantId = previousVariant;
    selectedEditionId = previousEdition;
    selectedEntryId = previousEntry;
    templatePath = previousTemplatePath;
    configPath = previousConfigPath;
    irPath = previousIrPath;
    devConfig = previousConfig;
    configurePreviewChoices(previousConfig);
    previewVariant.value = previousVariant;
    previewEdition.value = previousEdition;
    collectionEntry.value = previousEntry;
    const message = error instanceof Error ? error.message : String(error);
    previewSelectionStatus.textContent = message;
    if (devConfig.sourceKind === "collection" && /stale.*snapshot|snapshot.*stale|409/i.test(message)) {
      collectionSnapshotValid = false;
      collectionStatus.textContent = "Snapshot is stale. Refresh to materialize a new collection snapshot.";
    }
  } finally {
    if (selectionRequest === selectionRequestEpoch) {
      previewVariant.disabled = (devConfig.variants?.length ?? 0) < 1;
      previewEdition.disabled = (devConfig.editions?.length ?? 0) < 1;
      collectionEntry.disabled = (devConfig.sourceKind !== "collection") || (devConfig.collection?.entries.length ?? 0) === 0;
    }
  }
}

async function refreshCollectionSnapshot(): Promise<void> {
  if (devConfig?.sourceKind !== "collection") return;
  collectionRefresh.disabled = true;
  collectionEntry.disabled = true;
  collectionStatus.textContent = "Refreshing collection snapshot…";
  collectionSnapshotValid = false;
  updateUI();
  try {
    const sessionToken = await mediaSessionToken();
    const collectionPath = devConfig.collection?.sourcePath;
    if (!collectionPath) throw new Error("The source does not expose a collection snapshot route.");
    const response = await fetch(`${collectionPath}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Superimg-Session": sessionToken },
      body: "{}",
    });
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; snapshotId?: string; generation?: number; entries?: Array<{ id: string; dataDigest?: string }>; selectedEntryId?: string };
    if (!response.ok) throw new Error(payload.error?.message ?? `Snapshot refresh failed (${response.status})`);
    const snapshot = payload as { snapshotId: string; generation: number; entries: Array<{ id: string; dataDigest?: string }>; selectedEntryId?: string };
    if (!snapshot.snapshotId || !Number.isSafeInteger(snapshot.generation) || !Array.isArray(snapshot.entries)) throw new Error("Server returned an invalid collection snapshot.");
    collectionSnapshotId = snapshot.snapshotId;
    collectionSnapshotGeneration = snapshot.generation;
    const entries = snapshot.entries;
    if (!entries.some((entry) => entry.id === selectedEntryId)) {
      selectedEntryId = snapshot.selectedEntryId && entries.some((entry) => entry.id === snapshot.selectedEntryId)
        ? snapshot.selectedEntryId
        : entries[0]?.id ?? "";
    }
    const url = new URL(location.href);
    if (selectedEntryId) url.searchParams.set("entryId", selectedEntryId);
    url.searchParams.set("snapshotId", collectionSnapshotId);
    url.searchParams.set("generation", String(collectionSnapshotGeneration));
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    collectionEntry.replaceChildren(...entries.map((entry) => new Option(entry.id, entry.id)));
    if (selectedEntryId) collectionEntry.value = selectedEntryId;
    collectionEntry.disabled = entries.length === 0;
    collectionSnapshotValid = false;
    collectionStatus.textContent = entries.length ? `Snapshot ready · ${entries.length} entries` : "Snapshot contains no entries.";
    if (!player) {
      if (selectedEntryId) location.reload();
      return;
    }
    if (selectedEntryId) {
      await applyPreviewSelection();
      collectionSnapshotValid = previewSelectionStatus.textContent === "Selection accepted";
      if (!collectionSnapshotValid) collectionStatus.textContent = "Snapshot refreshed, but its selected entry was not accepted. Retry or refresh.";
    }
  } catch (error) {
    collectionSnapshotValid = false;
    collectionStatus.textContent = `Snapshot refresh failed: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    collectionRefresh.disabled = false;
    updateUI();
  }
}

function updateUI() {
  if (!player) return;
  const state = player.store?.getState();
  const isPlaying = state?.isPlaying ?? false;
  playPauseBtn.dataset.playing = String(isPlaying);
  const inspecting = previewInspector?.mode === "inspection";
  playPauseBtn.disabled = exporting || inspecting;
  playPauseBtn.title = inspecting ? "Return to live in the inspector to play" : "Play / pause";
  for (const button of [btnFirst, btnPrev, btnNext, btnLast]) button.disabled = inspecting;
  timelineContainer.dataset.inspection = String(inspecting);
  timelineContainer.setAttribute("aria-disabled", String(inspecting));
  if (multiTrackTimelineEl) multiTrackTimelineEl.dataset.inspection = String(inspecting);
  exportBtn.disabled = exporting || devConfig?.previewKind === "interactive" || (devConfig?.sourceKind === "collection" && (!collectionSnapshotValid || !selectedEntryId));
  if (devConfig?.previewKind === "interactive" || (devConfig?.sourceKind === "collection" && !collectionSnapshotValid)) {
    exportBtn.title = devConfig.previewKind === "interactive"
      ? "Live interactive previews cannot be exported as authored media"
      : "Refresh the collection snapshot before exporting";
  } else exportBtn.title = "Open export settings";

  const loop = player.playbackMode === "loop";
  loopBtn.setAttribute("aria-pressed", String(loop));

  if (pausedOverlay) {
    pausedOverlay.classList.toggle("hidden", isPlaying || inspecting);
  }
  updateInteractiveUi();
  setExportCollectionMode(devConfig?.sourceKind === "collection", devConfig?.mediaKind);
}

/** Fetch Media IR from dev server and update multi-track lanes + player.mediaIR. */
export async function refreshMediaIR(options?: {
  preservePlayhead?: boolean;
  playheadFrame?: number;
  signal?: AbortSignal;
}): Promise<void> {
  if (!player || !multiTrack) return;
  const epoch = ++irRequestEpoch;
  const previewRevision = previewRequests.revision;
  const isCurrent = () => epoch === irRequestEpoch &&
    previewRevision === previewRequests.revision && !options?.signal?.aborted;
  try {
    const separator = irPath.includes("?") ? "&" : "?";
    const res = await fetch(`${irPath}${separator}t=${Date.now()}`, { signal: options?.signal ?? null });
    if (!isCurrent()) return;
    if (!res.ok) {
      // Keep last valid timeline when IR endpoint fails
      multiTrack.setStale(true, `IR fetch failed (${res.status})`);
      return;
    }
    const body = (await res.json()) as { media?: MediaIR; error?: unknown };
    if (!isCurrent()) return;
    if (!body.media || body.error) {
      multiTrack.setStale(true, "IR compile unavailable");
      return;
    }
    lastMediaIR = body.media;
    multiTrack.setStale(false);
    multiTrack.setMediaIR(body.media);
    try {
      player.setMediaIR(body.media);
    } catch {
      /* clock mismatch — still show lanes from IR for inspection */
      multiTrack.setStale(true, "IR clock mismatch with runtime");
    }
    if (options?.preservePlayhead && player.store) {
      const total = Math.max(1, player.totalFrames);
      const frame = Math.max(
        0,
        Math.min(
          total - 1,
          Math.floor(options.playheadFrame ?? player.currentFrame),
        ),
      );
      await player.store.seekFrame(frame);
      if (!isCurrent()) return;
      multiTrack.setSelection({ frame });
    }
  } catch {
    if (isCurrent()) multiTrack.setStale(true, "IR refresh failed");
  }
}

/**
 * Intent changed with compatible clock: reload template, preserve selection by id when possible.
 */
export async function applyIntentCompatibleUpdate(
  playheadFrame?: number,
): Promise<void> {
  await applyPreviewUpdate("intent", playheadFrame);
}

/** Clock/timing change: clamp playhead after reload. */
export async function applyClockChangeUpdate(
  playheadFrame?: number,
): Promise<void> {
  await applyPreviewUpdate("clock", playheadFrame);
}

/**
 * Compile error: keep last valid preview + timeline, mark stale, show diagnostics.
 * Never blank the preview.
 */
export function applyCompileErrorStale(message: string): void {
  const resume = previewRequests.invalidate();
  hideLoading();
  markCompileErrorStale(message);
  if (resume) player?.play();
}

function markCompileErrorStale(message: string): void {
  previewInspector?.setCompilation({ status: "failed", error: { code: "COMPILE_ERROR", message } });
  multiTrack?.setStale(true, message);
  showError(message);
  showToast(`Compile error (preview kept): ${message}`, "error");
  setStatus(`Stale preview · ${message}`);
}

export async function reloadTemplate(): Promise<void> {
  await applyPreviewUpdate("manual");
}

/**
 * Markup-only IR change: reload template but restore playhead.
 * Still uses player.load() (no swapTemplate API in V1).
 */
export async function applyMarkupUpdate(): Promise<void> {
  await applyPreviewUpdate("markup");
}

type PreviewUpdateKind = "manual" | "markup" | "intent" | "clock";

/** Every reload path shares one epoch from network preparation to UI acceptance. */
async function applyPreviewUpdate(kind: PreviewUpdateKind, playheadFrame?: number, retryIntentFailure = true): Promise<boolean | null> {
  if (!player) return false;
  const activePlayer = player;
  const request = previewRequests.begin(
    playheadFrame ?? activePlayer.currentFrame,
    activePlayer.isPlaying,
    playheadFrame !== undefined,
  );
  const retainedStepId = interactiveController?.guide.currentStep?.stepId;
  if (activePlayer.isPlaying) activePlayer.pause();
  previewInspector?.setCompilation({ status: "pending" });
  hideError();
  hideErrorOverlay();
  showLoading();
  try {
    const { template, result } = await loadPreviewCandidate(
      request,
      (signal) => loadTemplate(templatePath, { signal, fresh: kind === "manual" }),
      async (template) => {
        if (interactiveController && (template as { kind?: string }).kind === "interactive") {
          return interactiveController.load(template as InteractiveDefinition<Record<string, unknown>>, {
            data: interactiveDataPatch,
            ...(devConfig.assetUrls ? { assetResolver: (filename: string) => devConfig.assetUrls?.[filename] ?? filename } : {}),
            ...(devConfig.fonts ? { fonts: devConfig.fonts } : {}),
          });
        }
        const assetResolver = devConfig.assetUrls
          ? (filename: string) => devConfig.assetUrls?.[filename] ?? filename
          : undefined;
        return activePlayer.load(template as Parameters<Player["load"]>[0], {
          ...(assetResolver ? { assetResolver } : {}),
          ...(devConfig.fonts ? { fonts: devConfig.fonts } : {}),
        });
      },
    );
    if (result.status === "error") {
      markCompileErrorStale(result.message);
      const json = (result.details ?? {}) as unknown as Parameters<typeof showErrorOverlay>[0];
      if (json.code) showErrorOverlay({ ...json, name: json.name ?? "Error", message: json.message ?? result.message });
      return false;
    }
    bindAcceptedPlayerSession();
    loadedTemplate = template as typeof loadedTemplate;
    if ((template as { kind?: string }).kind === "interactive" && interactiveController) {
      interactiveDefinition = template as InteractiveDefinition<Record<string, unknown>>;
    }
    const clamped = Math.min(request.frame, Math.max(0, activePlayer.totalFrames - 1));
    await activePlayer.seek({ frame: clamped });
    if (interactiveController && interactiveDefinition) {
      const stepId = retainedStepId;
      if (stepId && interactiveController.guide.steps.some((step) => step.stepId === stepId)) {
        await interactiveController.guide.goToStep(stepId);
      }
      updateInteractiveUi();
    }
    request.checkpoint();
    previewInspector?.setSource(templateSource(template));
    applyAcceptedStageSize(result.width, result.height, undefined, result.fps, result.duration);
    const nextCoordinateKey = JSON.stringify({ entryId: devConfig.entryId ?? null, variantId: devConfig.variantId ?? selectedVariantId, editionId: devConfig.editionId ?? selectedEditionId });
    if (nextCoordinateKey !== inspectorCoordinateKey) mountInspector(template);
    const compiled = templateBundle(template);
    previewInspector?.setCompilation({ status: "succeeded", ...(templateSource(template) ? { source: templateSource(template)! } : {}), ...(compiled?.generation !== undefined ? { hostGeneration: compiled.generation } : {}), ...(compiled?.inputIdentity ? { inputIdentity: compiled.inputIdentity } : {}), ...(compiled?.projectionIdentity ? { projectionIdentity: compiled.projectionIdentity } : {}) });
    hideErrorOverlay();
    multiTrack?.setStale(false);
    if (devConfig.previewKind !== "interactive") {
      const irRefresh = refreshMediaIR({
        signal: request.signal,
        preservePlayhead: kind === "intent" || kind === "clock",
        playheadFrame: clamped,
      });
      if (kind === "intent" || kind === "clock") await irRefresh;
    }
    request.checkpoint();
    const messages = {
      manual: ["Template reloaded", "Template reloaded"],
      markup: ["Preview updated", "Markup update (playhead preserved)"],
      intent: ["Intent updated (selection preserved)", "Intent-compatible reload"],
      clock: ["Timing changed (playhead clamped)", `Clock change · frame ${clamped}`],
    } as const;
    showToast(messages[kind][0], kind === "manual" ? "success" : "info");
    setStatus(messages[kind][1]);
    return true;
  } catch (e) {
    if (!request.isCurrent()) return null;
    if (retryIntentFailure && (kind === "intent" || kind === "clock")) {
      // Retry under a new request while retaining the original playback intent.
      void applyPreviewUpdate("manual", request.frame);
      return false;
    }
    if (isStructuredBundleError(e)) {
      markCompileErrorStale(e.message);
      if (e.details) showErrorOverlay(e.details);
      return false;
    } else {
      const formatted = formatError(e);
      markCompileErrorStale(formatted.json.message);
      showErrorOverlay(formatted.json);
      return false;
    }
  } finally {
    if (request.isCurrent()) {
      hideLoading();
      previewRequests.finish(request);
      if (request.wasPlaying) activePlayer.play();
    }
  }
}

/** Public loadTemplate(path) — shares bundle state with reload / thumbnails. */
export async function loadTemplate(path: string, options?: LoadTemplateOptions) {
  return loadTemplateImpl(path, bundleState, options);
}

async function initPlayer() {
  try {
    setupPreviewBackgroundSettings();
    errorPanelDismiss?.addEventListener("click", hideError);
    setStatus("Loading config...");
    const params = new URLSearchParams(location.search);
    selectedVariantId = params.get("variantId") || "default";
    selectedEditionId = params.get("editionId") || "default";
    templatePath = initialSelectedPath(params.get("template") || "/api/template", params);

    const templatePathname = new URL(templatePath, location.href).pathname;
    if (templatePathname.startsWith("/api/videos/") && templatePathname.endsWith("/template")) {
      configPath = templatePath.replace("/template", "/config");
      irPath = templatePath.replace("/template", "/ir");
    } else {
      configPath = "/api/config";
      irPath = "/api/ir";
    }

    configPath = initialSelectedPath(configPath, params);
    irPath = initialSelectedPath(irPath, params);
    const configRes = await fetch(configPath);
    devConfig = await readConfigResponse<DevConfig>(configRes);
    selectedEntryId = params.get("entryId") ?? devConfig.collection?.selectedEntryId ?? "";
    configurePreviewChoices(devConfig);
    if (devConfig.sourceKind === "collection") {
      templatePath = selectedPath(templatePath);
      configPath = selectedPath(configPath);
      irPath = selectedPath(irPath);
    }
    startupVariantId = devConfig.variantId ?? selectedVariantId;
    startupEditionId = devConfig.editionId ?? selectedEditionId;
    const deck = playerView.querySelector<HTMLElement>(".si-deck");
    deck?.classList.toggle("si-deck--still", devConfig.mediaKind === "image" || devConfig.mediaKind === "svg");
    const templateTitle =
      titleFromTemplateDir(devConfig.templateDir) ?? getTemplateDisplayName(templatePath);
    templateNameEl.textContent = templateTitle;
    setExportMeta({
      title: templateTitle,
      width: devConfig.width,
      height: devConfig.height,
      fps: devConfig.fps,
      duration: devConfig.duration,
    });
    document.title = `${templateNameEl.textContent} · SuperImg`;
    previewContainer.style.setProperty(
      "--stage-ar",
      String(devConfig.width / Math.max(1, devConfig.height)),
    );
    previewContainer.style.width = "min(100cqw, calc(100cqh * var(--stage-ar)))";
    previewContainer.style.height = "min(100cqh, calc(100cqw / var(--stage-ar)))";
    previewContainer.style.maxWidth = "100%";
    previewContainer.style.maxHeight = "100%";

    if (devConfig.sourceKind === "collection" && (devConfig.collection?.staleRequest || devConfig.previewKind === "collection-unavailable" || (devConfig.collection?.entries.length ?? 0) === 0)) {
      collectionSnapshotValid = false;
      setExportCollectionMode(true, devConfig.mediaKind);
      collectionRefresh.addEventListener("click", () => { void refreshCollectionSnapshot(); });
      exportBtn.disabled = true;
      exportBtn.title = "Refresh the collection snapshot before exporting";
      setStatus("Collection snapshot needs refreshing");
      playerView.classList.add("visible");
      return;
    }

    showLoading();
    setStatus("Initializing preview...");
    if (devConfig.previewKind === "interactive") {
      interactiveController = createInteractivePlayer<Record<string, unknown>>({
        container: previewContainer,
        playbackMode: "loop",
        playerMode: "dev",
      });
      player = interactiveController.player as unknown as Player;
      interactiveListenerDisposer = interactiveController.on("stepchange", (step) => {
        if (step && interactiveStep.value !== step.stepId) interactiveStep.value = step.stepId;
        interactiveStepNote.textContent = step?.note ?? step?.stepId ?? "No guide step is selected.";
      });
      interactiveControls.hidden = false;
    } else {
      player = new Player({
        container: "#preview-container",
        playbackMode: "loop",
        playerMode: "dev",
      });
      interactiveControls.hidden = true;
    }

    const activePlayer = player!;
    activePlayer.on("play", updateUI);
    activePlayer.on("pause", updateUI);
    activePlayer.on("frame", (f) => setStatus(`Playing frame ${f}/${activePlayer.totalFrames}`));
    activePlayer.on("error", (err) => {
      const formatted = formatError(err as SuperImgError);
      showErrorOverlay(formatted.json);
    });

    setStatus("Loading template...");
    const initialRequest = previewRequests.begin(0, false);
    const assetResolver = devConfig.assetUrls
      ? (filename: string) => devConfig.assetUrls?.[filename] ?? filename
      : undefined;
    const loadOpts = {
      ...(assetResolver ? { assetResolver } : {}),
      ...(devConfig.fonts ? { fonts: devConfig.fonts } : {}),
    };
    const { template, result } = await loadPreviewCandidate(
      initialRequest,
      (signal) => loadTemplate(templatePath, { signal }),
      (template) => {
        if (interactiveController && (template as { kind?: string }).kind === "interactive") {
          interactiveDefinition = template as InteractiveDefinition<Record<string, unknown>>;
          interactiveDataPatch = {};
          return interactiveController.load(interactiveDefinition, { data: interactiveDataPatch, ...loadOpts });
        }
        return player!.load(template as Parameters<Player["load"]>[0], loadOpts);
      },
    );
    previewRequests.finish(initialRequest);

    if (result.status === "error") {
      const json = (result.details ?? {}) as unknown as Parameters<typeof showErrorOverlay>[0];
      if (json.code) showErrorOverlay({ ...json, name: json.name ?? "Error", message: json.message ?? result.message });
      throw new Error(result.message);
    }
    loadedTemplate = template as typeof loadedTemplate;
    if ((template as { kind?: string }).kind === "interactive") interactiveDefinition = template as InteractiveDefinition<Record<string, unknown>>;
    setExportMeta({
      title: templateTitle,
      width: result.width,
      height: result.height,
      fps: result.fps,
      duration: result.duration,
    });
    hideLoading();
    hideErrorOverlay();
    mountInspector(template);
    const compiled = templateBundle(template);
    previewInspector?.setCompilation({ status: "succeeded", ...(templateSource(template) ? { source: templateSource(template)! } : {}), ...(compiled?.generation !== undefined ? { hostGeneration: compiled.generation } : {}), ...(compiled?.inputIdentity ? { inputIdentity: compiled.inputIdentity } : {}), ...(compiled?.projectionIdentity ? { projectionIdentity: compiled.projectionIdentity } : {}) });

    bindAcceptedPlayerSession();
    if (devConfig.previewKind !== "interactive") void refreshMediaIR();

    playPauseBtn.addEventListener("click", () => {
      player?.store?.togglePlayPause();
    });
    previewVariant.addEventListener("change", () => { void applyPreviewSelection(); });
    previewEdition.addEventListener("change", () => { void applyPreviewSelection(); });
    collectionEntry.addEventListener("change", () => { void applyPreviewSelection(); });
    collectionRefresh.addEventListener("click", () => { void refreshCollectionSnapshot(); });
    window.addEventListener("superimg:collection-snapshot-stale", () => {
      collectionSnapshotValid = false;
      collectionStatus.textContent = "Snapshot is stale. Refresh to materialize a new collection snapshot.";
      updateUI();
    });
    interactiveStep.addEventListener("change", () => {
      const stepId = interactiveStep.value;
      if (!stepId || !interactiveController) return;
      void interactiveController.guide.goToStep(stepId).catch((error) => {
        interactiveStatus.textContent = `Guide navigation failed: ${error instanceof Error ? error.message : String(error)}`;
      });
    });
    interactiveApplyData.addEventListener("click", () => { void applyInteractiveData(); });
    interactiveReset.addEventListener("click", () => { void resetInteractiveData(); });
    exportBtn.addEventListener("click", () => {
      openExportPanel();
    });
    reloadBtn.addEventListener("click", () => {
      reloadTemplate();
    });
    loopBtn.addEventListener("click", () => {
      if (!player) return;
      player.playbackMode = player.playbackMode === "loop" ? "once" : "loop";
      updateUI();
    });
    btnFirst.addEventListener("click", () => { const store = player?.store; if (store) void store.seekFrame(0); });
    btnPrev.addEventListener("click", () => {
      const store = player?.store;
      if (!store) return;
      const s = store.getState();
      void store.seekFrame(Math.max(0, s.currentFrame - 1));
    });
    btnNext.addEventListener("click", () => {
      const store = player?.store;
      if (!store) return;
      const s = store.getState();
      void store.seekFrame(Math.min(s.totalFrames - 1, s.currentFrame + 1));
    });
    btnLast.addEventListener("click", () => {
      const store = player?.store;
      if (store) void store.seekFrame(store.getState().totalFrames - 1);
    });

    helpBtn?.addEventListener("click", () => {
      const expanded = helpBtn.getAttribute("aria-expanded") === "true";
      helpBtn.setAttribute("aria-expanded", String(!expanded));
      helpPanel?.classList.toggle("hidden");
      if (!expanded) {
        settingsBtn.setAttribute("aria-expanded", "false");
        settingsPanel.classList.add("hidden");
      }
    });

    previewContainer.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (previewInspector?.mode === "inspection") return;
      player?.store?.togglePlayPause();
    });

    initExportHandlers(
      () => player,
      () => loadedTemplate,
      () => {
        const { collection: _collectionMetadata, ...config } = devConfig;
        return {
          ...config,
          ...(devConfig.sourceKind === "collection" ? {
            collection: { snapshotId: collectionSnapshotId, generation: collectionSnapshotGeneration, entryId: selectedEntryId, valid: collectionSnapshotValid, ...(devConfig.collection?.sourcePath ? { sourcePath: devConfig.collection.sourcePath } : {}) },
          } : {}),
        };
      },
      updateUI,
    );

    window.addEventListener("pagehide", () => {
      const hadInteractiveController = interactiveController !== null;
      previewRequests.invalidate();
      previewInspector?.dispose();
      previewInspector = null;
      multiTrack?.destroy();
      multiTrack = null;
      timelineController?.destroy();
      timelineController = null;
      storeUnsubscribe?.();
      storeUnsubscribe = null;
      interactiveController?.dispose();
      interactiveListenerDisposer?.();
      interactiveListenerDisposer = null;
      interactiveController = null;
      if (!hadInteractiveController) player?.dispose();
      audioPreview?.dispose();
      audioPreview = null;
      audioElement?.pause();
      audioElement = null;
    }, { once: true });

    setStatus("Ready - Click Play to start preview");
    initShortcuts(() => previewInspector?.mode === "inspection" ? null : player, reloadTemplate, openExportPanel);
    connectWebSocket({
      reloadTemplate: () => { invalidateCollectionSnapshotForHmr(); return reloadTemplate(); },
      refreshMediaIR: () => { invalidateCollectionSnapshotForHmr(); return shouldReloadSelectedProjection() ? reloadTemplate() : refreshMediaIR(); },
      applyMarkupUpdate: () => { invalidateCollectionSnapshotForHmr(); return shouldReloadSelectedProjection() ? reloadTemplate() : applyMarkupUpdate(); },
      applyIntentCompatibleUpdate: (frame) => { invalidateCollectionSnapshotForHmr(); return shouldReloadSelectedProjection() ? reloadTemplate() : applyIntentCompatibleUpdate(frame); },
      applyClockChangeUpdate: (frame) => { invalidateCollectionSnapshotForHmr(); return shouldReloadSelectedProjection() ? reloadTemplate() : applyClockChangeUpdate(frame); },
      applyCompileErrorStale: (message) => {
        invalidateCollectionSnapshotForHmr();
        if (shouldReloadSelectedProjection()) void reloadTemplate();
        else applyCompileErrorStale(message);
      },
    });
    updateUI();
    playerView.classList.add("visible");
  } catch (error) {
    if (isStructuredBundleError(error)) {
      if (error.details) showErrorOverlay(error.details);
      showToast(`Error: ${error.message}`, "error");
      setStatus(`Error: ${error.message}`);
      return;
    }
    const formatted = formatError(error);
    showErrorOverlay(formatted.json);
    showToast(`Error: ${formatted.json.message}`, "error");
    setStatus(`Error: ${formatted.json.message}`);
    console.error(error);
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  const template = params.get("template");

  if (!template) {
    await initHome(bundleState);
  } else {
    await initPlayer();
  }
}

init();
