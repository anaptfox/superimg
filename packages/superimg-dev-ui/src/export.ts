import {
  downloadBlob,
  createBrowserRuntimeAdapter,
} from "@superimg/browser-export";
import { createRuntime, inspectFile, startConversion, startExport } from "@superimg/core/runtime";
import { isAlphaCodecContainerCompatible } from "@superimg/types";
import { Player } from "@superimg/player";
import type { ConversionArtifact, ExportableMedia, JobEvent, PausableJob } from "@superimg/types";
import {
  exportPanel,
  settingsPanel,
  settingsBtn,
  helpPanel,
  helpBtn,
  exportStart,
  exportCancel,
  exportCloseBtn,
  exportDownload,
  exportSize,
  exportBar,
  exportPercent,
  exportPanelClose,
  exportTitle,
  exportSlate,
  exportRuntime,
  exportCodec,
  exportAudioCodec,
  exportQuality,
  exportAlpha,
  exportRegion,
  exportRegionX,
  exportRegionY,
  exportRegionWidth,
  exportRegionHeight,
  exportDpr,
  exportReconcile,
  exportCache,
  exportFile,
  exportVideoTrack,
  exportAudioTrack,
  exportVideoStart,
  exportVideoEnd,
  exportAudioStart,
  exportAudioEnd,
  exportResizeWidth,
  exportResizeHeight,
  exportPause,
} from "./dom";
import { setStatus, showToast } from "./ui-feedback";
import { createMediaJobClient, type MediaJobSnapshot } from "./media-jobs";

// Export panel state
export let exportFormat: "mp4" | "webm" | "mov" | "mkv" | "gif" | "png" | "jpeg" | "webp" | "svg" | "html" = "mp4";
export let exportAbortController: AbortController | null = null;
export let exportedBlob: Blob | null = null;
export let exporting = false;
let activeJob: MediaJobSnapshot | null = null;
let stopJobWatch: (() => void) | null = null;
let browserJob: PausableJob<ExportBundleOrConversion> | null = null;
let browserRuntime: ReturnType<typeof createRuntime> | null = null;
type ExportBundleOrConversion = Awaited<ReturnType<typeof startExport>["result"]> | ConversionArtifact;
let selectedUploads: readonly { id?: string; sourceId: string; tracks: readonly { id: string; kind: string }[]; input?: { kind: "bytes"; bytes: Uint8Array; mimeType?: string } }[] = [];
let updateUiCallback: (() => void) | null = null;
const jobs = createMediaJobClient();
export async function mediaSessionToken(): Promise<string> {
  return (await jobs.session()).token;
}
const LOCAL_NODE_JOB_KEY = "superimg.dev-ui.local-node-job";

let exportMeta = { title: "Media", slate: "", filename: "export" };
let exportModeKey = "";
let collectionExportMode = false;

export function setExportCollectionMode(active: boolean, mediaKind?: "video" | "gif" | "image" | "svg"): void {
  const key = `${active}:${mediaKind ?? ""}:${exportFormat}`;
  if (key === exportModeKey) return;
  exportModeKey = key;
  collectionExportMode = active;
  exportPanel.classList.toggle("si-collection-export", active);
  exportStart.textContent = active ? "Export frozen entry" : "Export video";
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".export-fmt-btn"));
  const fields = ["#export-codec", "#export-audio-codec", "#export-quality", "#export-alpha"]
    .map((selector) => document.querySelector<HTMLElement>(selector)?.closest(".si-field"))
    .filter((field): field is HTMLElement => Boolean(field));
  if (!active) {
    const standard = ["mp4", "webm", "mov", "mkv"];
    if (!standard.includes(exportFormat)) exportFormat = "mp4";
    buttons.forEach((button, index) => {
      button.hidden = index >= standard.length;
      const format = standard[index];
      if (format) { button.dataset.format = format; button.textContent = format.toUpperCase(); }
      else button.dataset.format = "";
      button.classList.toggle("active", button.dataset.format === exportFormat);
    });
    fields.forEach((field) => { field.hidden = false; });
    return;
  }
  const choices = mediaKind === "image" ? ["png", "html"]
    : mediaKind === "svg" ? ["svg", "html"]
      : mediaKind === "gif" ? ["gif"]
        : ["mp4", "webm", "mov", "mkv"];
  const labels: Record<string, string> = { mp4: "MP4", webm: "WebM", mov: "MOV", mkv: "MKV", gif: "GIF", png: "PNG", jpeg: "JPEG", webp: "WebP", svg: "SVG", html: "HTML" };
  buttons.forEach((button, index) => {
    const format = choices[index];
    button.hidden = format === undefined;
    button.classList.toggle("active", format === exportFormat);
    if (format) { button.dataset.format = format; button.textContent = labels[format] ?? format.toUpperCase(); }
    else button.dataset.format = "";
  });
  if (!choices.includes(exportFormat)) exportFormat = choices[0] as typeof exportFormat;
  buttons.forEach((button) => button.classList.toggle("active", button.dataset.format === exportFormat));
  const staticMedia = mediaKind === "image" || mediaKind === "svg";
  for (const selector of ["#export-codec", "#export-audio-codec", "#export-quality", "#export-alpha"]) {
    const field = document.querySelector<HTMLElement>(selector)?.closest<HTMLElement>(".si-field");
    if (field) field.hidden = staticMedia || mediaKind === "gif" || ["html", "svg", "png", "jpeg", "webp"].includes(exportFormat);
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}

export function setExportMeta(meta: { title: string; width: number; height: number; fps: number; duration: number }) {
  const duration = Number.isFinite(meta.duration)
    ? `${Number.isInteger(meta.duration) ? meta.duration : meta.duration.toFixed(1)}s`
    : "";
  exportMeta = {
    title: meta.title,
    slate: [ `${meta.width}×${meta.height}`, duration, `${meta.fps} fps` ].filter(Boolean).join(" · "),
    filename: slugify(meta.title),
  };
}

export function openExportPanel() {
  if (collectionExportMode) {
    exportPanel.dataset.state = "config";
  } else if (!activeJob && !browserJob) {
    exportPanel.dataset.state = "config";
    void restoreLocalNodeJob();
  }
  if (exportTitle) exportTitle.textContent = exportMeta.title;
  if (exportSlate) exportSlate.textContent = exportMeta.slate;
  exportPanel.classList.remove("hidden");
  // Close other panels
  settingsPanel.classList.add("hidden");
  settingsBtn.setAttribute("aria-expanded", "false");
  helpPanel.classList.add("hidden");
  helpBtn.setAttribute("aria-expanded", "false");
  if (!collectionExportMode) void refreshExportCapabilities();
}

export function closeExportPanel() {
  exportPanel.classList.add("hidden");
  if (browserJob) {
    exportAbortController?.abort();
    exportAbortController = null;
  }
}

async function restoreLocalNodeJob(): Promise<void> {
  if (activeJob || exportRuntime.value !== "node") return;
  const id = sessionStorage.getItem(LOCAL_NODE_JOB_KEY);
  if (!id) return;
  try {
    const snapshot = await jobs.get(id);
    activeJob = snapshot;
    applyJobEvent(snapshot);
    if (!["succeeded", "failed", "cancelled"].includes(snapshot.state)) exporting = true;
    stopJobWatch?.();
    stopJobWatch = jobs.watch(id, (event) => {
      applyJobEvent(event as MediaJobSnapshot);
      if (["succeeded", "failed", "cancelled"].includes((event as MediaJobSnapshot).state)) {
        stopJobWatch?.(); stopJobWatch = null; exportAbortController = null; updateUIIfReady();
      }
    }, () => updateUIIfReady());
  } catch {
    sessionStorage.removeItem(LOCAL_NODE_JOB_KEY);
  }
}

function updateUIIfReady(): void {
  updateUiCallback?.();
}

interface LoadedDevTemplate {
  render: (ctx: import("@superimg/types").RenderContext) => string;
  data?: Record<string, import("@superimg/types").JsonValue>;
  medium?: import("@superimg/types").Medium;
  config?: {
    fonts?: string[];
    inlineCss?: string[];
    stylesheets?: string[];
    background?: import("@superimg/types").BackgroundValue;
    width?: number;
  };
}

interface DevExportConfig {
  fps: number;
  duration: number;
  sourceId?: string;
  sourceKind?: "media" | "collection" | "interactive";
  previewKind?: "media" | "interactive" | "collection-unavailable";
  variantId?: string;
  editionId?: string;
  width?: number;
  height?: number;
  mediaKind?: "video" | "gif" | "image" | "svg";
  collection?: { snapshotId: string; generation: number; entryId: string; valid: boolean; sourcePath?: string };
  capabilities?: Record<string, unknown>;
}

function numberInput(input: HTMLInputElement): number | undefined {
  const value = Number(input.value);
  return input.value === "" || !Number.isFinite(value) ? undefined : value;
}

function encodingOptions(width?: number, height?: number, includeCapture = true, browserOnly = false): Record<string, unknown> {
  const codec = exportCodec.value;
  return {
    video: {
      ...(codec !== "auto" ? { codec } : {}),
      quality: exportQuality.value,
      alpha: exportAlpha.value,
    },
    audio: { ...(exportAudioCodec.value !== "auto" ? { codec: exportAudioCodec.value } : {}) },
    ...(includeCapture && width !== undefined && height !== undefined ? {
      capture: {
        region: exportRegion.value === "custom"
          ? { x: numberInput(exportRegionX) ?? 0, y: numberInput(exportRegionY) ?? 0, width: numberInput(exportRegionWidth) ?? width, height: numberInput(exportRegionHeight) ?? height }
          : { x: 0, y: 0, width, height },
        dpr: numberInput(exportDpr) ?? 1,
        ...(browserOnly ? { reconcile: exportReconcile.checked, cache: exportCache.checked } : {}),
      },
    } : {}),
  };
}

async function refreshExportCapabilities(): Promise<void> {
  if (collectionExportMode) return;
  try {
    const browser = exportRuntime.value === "browser";
    const caps = browser ? await browserEncodingCapabilities() : (await jobs.session()).capabilities as { animated?: readonly string[]; videoCodecs?: readonly string[]; alpha?: boolean };
    if (collectionExportMode) return;
    for (const button of document.querySelectorAll<HTMLButtonElement>(".export-fmt-btn")) {
      const format = button.dataset.format ?? "";
      const available = !caps.animated || caps.animated.includes(format);
      button.disabled = !available;
      if (!available && button.classList.contains("active")) {
        document.querySelector<HTMLButtonElement>('.export-fmt-btn:not([disabled])')?.click();
      }
    }
    const formatCodecs = (caps as { codecsByFormat?: Record<string, readonly string[]> }).codecsByFormat?.[exportFormat];
    const availableCodecs = formatCodecs ?? caps.videoCodecs;
    if (availableCodecs) {
      for (const option of Array.from(exportCodec.options)) {
        option.disabled = option.value !== "auto" && !availableCodecs.includes(option.value);
      }
    }
    if (exportCodec.selectedOptions[0]?.disabled) exportCodec.value = "auto";
    const audioCodecs = (caps as { audioCodecsByFormat?: Record<string, readonly string[]> }).audioCodecsByFormat?.[exportFormat];
    if (audioCodecs) {
      for (const option of Array.from(exportAudioCodec.options)) option.disabled = option.value !== "auto" && !audioCodecs.includes(option.value);
    }
    if (exportAudioCodec.selectedOptions[0]?.disabled) exportAudioCodec.value = "auto";
    const alphaCodecs = (caps as { alphaCodecsByFormat?: Record<string, readonly string[]> }).alphaCodecsByFormat?.[exportFormat];
    const selectedCodec = exportCodec.value;
    const alphaAvailable = caps.alpha !== false && (!alphaCodecs || (selectedCodec === "auto" && alphaCodecs.length > 0) || alphaCodecs.includes(selectedCodec));
    if (!alphaAvailable) exportAlpha.value = "discard";
    exportAlpha.disabled = !alphaAvailable;
    if (caps.alpha === false) exportAlpha.value = "discard";
  } catch {
    // The browser-only path remains available without the optional job host.
  }
}

async function browserEncodingCapabilities(): Promise<{ animated: readonly string[]; videoCodecs: readonly string[]; audioCodecsByFormat: Record<string, readonly string[]>; codecsByFormat: Record<string, readonly string[]>; alphaCodecsByFormat: Record<string, readonly string[]>; alpha: boolean }> {
  const media = await import("mediabunny");
  const formats = { mp4: new media.Mp4OutputFormat(), webm: new media.WebMOutputFormat(), mov: new media.MovOutputFormat(), mkv: new media.MkvOutputFormat() } as const;
  const videoCandidates = ["avc", "vp9", "av1", "prores"] as const;
  const audioCandidates = ["aac", "opus", "dts"] as const;
  const codecsByFormat: Record<string, readonly string[]> = {}; const audioCodecsByFormat: Record<string, readonly string[]> = {}; const alphaCodecsByFormat: Record<string, readonly string[]> = {};
  for (const [name, format] of Object.entries(formats)) {
    const supported = format.getSupportedCodecs();
    const videos = (await Promise.all(videoCandidates.map(async (codec) => supported.includes(codec) && await media.canEncodeVideo(codec, { width: 64, height: 64 })))) .map((ok, index) => ok ? videoCandidates[index]! : undefined).filter((codec) => codec !== undefined);
    const audios = (await Promise.all(audioCandidates.map(async (codec) => supported.includes(codec) && await media.canEncodeAudio(codec, { numberOfChannels: 2, sampleRate: 48_000 })))) .map((ok, index) => ok ? audioCandidates[index]! : undefined).filter((codec) => codec !== undefined);
    codecsByFormat[name] = videos; audioCodecsByFormat[name] = audios;
    alphaCodecsByFormat[name] = (await Promise.all(videos.map(async (codec) => isAlphaCodecContainerCompatible(name as "mp4" | "webm" | "mov" | "mkv", codec) && await media.canEncodeVideo(codec, { width: 64, height: 64, alpha: "keep" }) ? codec : undefined))).filter((codec) => codec !== undefined);
  }
  const animated = Object.keys(formats).filter((format) => codecsByFormat[format]!.length > 0);
  return { animated, videoCodecs: videoCandidates.filter((codec) => Object.values(codecsByFormat).some((values) => values.includes(codec))), codecsByFormat, audioCodecsByFormat, alphaCodecsByFormat, alpha: Object.values(alphaCodecsByFormat).some((values) => values.length > 0) };
}

function applyJobEvent(event: MediaJobSnapshot): void {
  activeJob = { ...event, id: event.id ?? event.jobId };
  exportPause.disabled = ["finalizing", "succeeded", "failed", "cancelled"].includes(event.state);
  exportPause.textContent = event.state === "paused" ? "Resume" : "Pause";
  if (event.total && event.completed !== undefined) {
    const pct = Math.round((event.completed / event.total) * 100);
    exportBar.style.width = `${pct}%`;
    exportPercent.textContent = `${pct}%`;
  }
  setStatus(event.error ? `Export failed: ${event.error.message}` : `Job ${event.state}`);
  if (event.state === "succeeded") {
    exportPanel.dataset.state = "done";
    showToast("Export complete!", "success");
    exporting = false;
  } else if (event.state === "failed" || event.state === "cancelled") {
    exportPanel.dataset.state = "config";
    exporting = false;
  } else {
    exportPanel.dataset.state = "exporting";
    exporting = true;
  }
}

export function initExportHandlers(
  playerInfo: () => Player | null,
  templateInfo: () => LoadedDevTemplate | null,
  configInfo: () => DevExportConfig,
  updateUI: () => void,
) {
  updateUiCallback = updateUI;
  document.getElementById("export-new")?.addEventListener("click", () => {
    stopJobWatch?.(); stopJobWatch = null; activeJob = null; exportedBlob = null;
    sessionStorage.removeItem(LOCAL_NODE_JOB_KEY);
    exportPanel.dataset.state = "config"; exporting = false; updateUI();
  });
  // Format pills
  document.querySelectorAll(".export-fmt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".export-fmt-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".export-fmt-btn").forEach((button) => button.setAttribute("aria-pressed", String(button === btn)));
      exportFormat = (btn as HTMLButtonElement).dataset.format as typeof exportFormat;
      const currentConfig = configInfo();
      setExportCollectionMode(currentConfig.sourceKind === "collection", currentConfig.mediaKind);
      void refreshExportCapabilities();
    });
  });
  exportRuntime.addEventListener("change", () => {
    exportFile.value = ""; selectedUploads = [];
    exportVideoTrack.replaceChildren(new Option("No file selected", "")); exportAudioTrack.replaceChildren(new Option("None", ""));
    exportVideoTrack.disabled = true; exportAudioTrack.disabled = true;
    void refreshExportCapabilities();
  });
  exportCodec.addEventListener("change", () => void refreshExportCapabilities());

  exportFile.addEventListener("change", async () => {
    selectedUploads = [];
    exportVideoTrack.replaceChildren(new Option("Select a video track", ""));
    exportAudioTrack.replaceChildren(new Option("None", ""));
    const files = Array.from(exportFile.files ?? []);
    if (files.length === 0) return;
    let localRuntime: ReturnType<typeof createRuntime> | null = null;
    try {
      const browser = exportRuntime.value === "browser";
      localRuntime = browser ? createRuntime(createBrowserRuntimeAdapter({ document })) : null;
      const uploaded = await Promise.all(files.map(async (file, index) => {
        if (localRuntime) {
          const input = { kind: "bytes" as const, bytes: new Uint8Array(await file.arrayBuffer()), ...(file.type ? { mimeType: file.type } : {}) };
          const inspection = await inspectFile(localRuntime, input);
          return { sourceId: `selected-${index}`, tracks: inspection.tracks, input };
        }
        const result = await jobs.upload(file);
        const inspection = result.inspection as { tracks?: readonly { id: string; kind: string }[] } | undefined;
        return { id: result.id, sourceId: `selected-${index}`, tracks: inspection?.tracks ?? [] };
      }));
      selectedUploads = uploaded;
      for (const source of uploaded) {
        for (const track of source.tracks) {
          const option = new Option(`${source.sourceId} · ${track.kind} · ${track.id}`, `${source.sourceId}::${track.id}`);
          (track.kind === "video" ? exportVideoTrack : exportAudioTrack).append(option);
        }
      }
      exportVideoTrack.disabled = !uploaded.some((source) => source.tracks.some((track) => track.kind === "video"));
      exportAudioTrack.disabled = !uploaded.some((source) => source.tracks.some((track) => track.kind === "audio"));
    } catch (error) {
      showToast(`File inspection failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally { await localRuntime?.dispose(); }
  });
  document.getElementById("export-clear-file")?.addEventListener("click", () => {
    exportFile.value = "";
    selectedUploads = [];
    exportVideoTrack.replaceChildren(new Option("No file selected", ""));
    exportAudioTrack.replaceChildren(new Option("None", ""));
    exportVideoTrack.disabled = true;
    exportAudioTrack.disabled = true;
  });

  // Start export
  exportStart.addEventListener("click", async () => {
    const player = playerInfo();
    const loadedTemplate = templateInfo();
    const devConfig = configInfo();

    if (devConfig.sourceKind === "collection") {
      const status = document.getElementById("collection-export-status");
      if (!devConfig.collection?.valid || !devConfig.collection.snapshotId || !devConfig.collection.entryId) {
        if (status) { status.hidden = false; status.textContent = "No valid frozen collection entry. Close export and refresh the snapshot."; }
        return;
      }
      if (exporting) return;
      exporting = true;
      exportStart.disabled = true;
      if (status) { status.hidden = false; status.textContent = `Exporting frozen entry “${devConfig.collection.entryId}”…`; }
      updateUI();
      try {
        const session = await jobs.session();
        const sourcePath = devConfig.collection.sourcePath;
        if (!sourcePath) throw new Error("The source does not expose a collection export route.");
        const response = await fetch(`${sourcePath}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Superimg-Session": session.token },
          body: JSON.stringify({
            snapshotId: devConfig.collection.snapshotId,
            generation: devConfig.collection.generation,
            entryId: devConfig.collection.entryId,
            variantId: devConfig.variantId ?? "default",
            editionId: devConfig.editionId ?? "default",
            destinations: [`${devConfig.width ?? playerInfo()?.renderWidth ?? 1920}x${devConfig.height ?? playerInfo()?.renderHeight ?? 1080}.${exportFormat}`],
          }),
        });
        const receipt = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok) throw new Error(typeof receipt.message === "string" ? receipt.message : `Collection export failed (${response.status})`);
        const paths: string[] = [];
        const visit = (value: unknown): void => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) { value.forEach(visit); return; }
          for (const [key, item] of Object.entries(value)) {
            if ((key === "path" || key === "filename") && typeof item === "string") paths.push(item);
            else visit(item);
          }
        };
        visit(receipt.manifest);
        const publicationId = typeof receipt.publicationId === "string" ? receipt.publicationId : "publication";
        const outputPaths = [...new Set(paths)].map((path) => path.startsWith("output/") ? path : `output/${publicationId}/${path}`);
        if (status) status.textContent = `Exported frozen entry “${devConfig.collection.entryId}” · ${publicationId}${outputPaths.length ? ` · ${outputPaths.join(", ")}` : ` · ${String(receipt.manifestDigest ?? "receipt recorded")}`}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (status) status.textContent = `Collection export failed: ${message}`;
        if (/stale.*snapshot|snapshot.*stale|409/i.test(message)) {
          window.dispatchEvent(new CustomEvent("superimg:collection-snapshot-stale"));
        }
      } finally {
        exporting = false;
        exportStart.disabled = false;
        updateUI();
      }
      return;
    }
    if (devConfig.previewKind === "interactive") {
      const reason = devConfig.previewKind === "interactive"
        ? "A live interactive preview has no authored media export snapshot."
        : "This preview cannot be exported as authored media.";
      showToast(reason, "info");
      return;
    }

    if (exporting || (!selectedUploads.length && (!player || !loadedTemplate))) return;
    exporting = true;
    exportAbortController = new AbortController();
    exportPanel.dataset.state = "exporting";
    exportedBlob = null;
    exportBar.style.width = "0%";
    exportPercent.textContent = "0%";
    updateUI();

    if (exportRuntime.value === "node") {
      try {
        if (selectedUploads.length) {
          const video = selectedUploads.flatMap((source) => source.tracks.map((track) => ({ ...track, sourceId: source.sourceId }))).find((track) => track.kind === "video");
          if (!video) throw new Error("Selected file has no video track");
          const [videoSourceId, videoTrackId] = (exportVideoTrack.value || `${video.sourceId}::${video.id}`).split("::");
          const request = {
            kind: "conversion",
            request: {
              sources: selectedUploads.map((file) => ({ id: file.sourceId, fileId: file.id })),
              video: { sourceId: videoSourceId, trackId: videoTrackId, trim: { startSeconds: numberInput(exportVideoStart) ?? 0, ...(numberInput(exportVideoEnd) !== undefined ? { endSeconds: numberInput(exportVideoEnd) } : {}) } },
              audio: Array.from(exportAudioTrack.selectedOptions).filter((option) => option.value).map((option, index) => { const [sourceId, trackId] = option.value.split("::"); return { id: `selected-audio-${index}`, sourceId, trackId, trim: { startSeconds: numberInput(exportAudioStart) ?? 0, ...(numberInput(exportAudioEnd) !== undefined ? { endSeconds: numberInput(exportAudioEnd) } : {}) } }; }),
              format: exportFormat,
              encoding: encodingOptions(undefined, undefined, false),
              ...((numberInput(exportResizeWidth) !== undefined && numberInput(exportResizeHeight) !== undefined)
                ? { resize: { width: numberInput(exportResizeWidth), height: numberInput(exportResizeHeight) } }
                : {}),
            },
          };
          activeJob = await jobs.submit(request);
        } else {
          if (!player) throw new Error("No authored preview is available for export");
          if (!devConfig.sourceId) throw new Error("Dev server did not provide the discovered media source id");
          activeJob = await jobs.submit({
            kind: "export",
            sourceId: devConfig.sourceId,
            options: {
              for: [`${player.renderWidth}x${player.renderHeight}.${exportFormat}`],
              variantIds: [devConfig.variantId ?? "default"],
              editionIds: [devConfig.editionId ?? "default"],
              encoding: encodingOptions(player.renderWidth, player.renderHeight),
            },
          });
        }
        sessionStorage.setItem(LOCAL_NODE_JOB_KEY, activeJob.id);
        applyJobEvent(activeJob);
        stopJobWatch?.();
        stopJobWatch = jobs.watch(activeJob.id, (event) => {
          applyJobEvent(event as MediaJobSnapshot);
          if ((event as MediaJobSnapshot).state === "succeeded" || (event as MediaJobSnapshot).state === "failed" || (event as MediaJobSnapshot).state === "cancelled") {
            stopJobWatch?.();
            stopJobWatch = null;
            exportAbortController = null;
            updateUI();
          }
        });
        if (!exporting) {
          exportAbortController = null;
          updateUI();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown";
        showToast(`Export failed: ${message}`, "error");
        exportPanel.dataset.state = "config";
        exporting = false;
        exportAbortController = null;
        updateUI();
      }
      return;
    }

    try {
      exportedBlob = null;
      if (selectedUploads.length) {
        browserRuntime = createRuntime(createBrowserRuntimeAdapter({ document }));
        const video = selectedUploads.flatMap((source) => source.tracks.map((track) => ({ ...track, sourceId: source.sourceId }))).find((track) => track.kind === "video");
        if (!video) throw new Error("Selected file has no video track");
        const [sourceId, trackId] = (exportVideoTrack.value || `${video.sourceId}::${video.id}`).split("::");
        if (!sourceId || !trackId) throw new Error("Select a video track");
        const trim = (start: HTMLInputElement, end: HTMLInputElement) => ({ startSeconds: numberInput(start) ?? 0, ...(numberInput(end) === undefined ? {} : { endSeconds: numberInput(end)! }) });
        const audio = Array.from(exportAudioTrack.selectedOptions).filter((option) => option.value).map((option, index) => { const [audioSourceId, audioTrackId] = option.value.split("::"); if (!audioSourceId || !audioTrackId) throw new Error("Invalid audio track selection"); return { id: `selected-audio-${index}`, sourceId: audioSourceId, trackId: audioTrackId, trim: trim(exportAudioStart, exportAudioEnd) }; });
        const width = numberInput(exportResizeWidth); const height = numberInput(exportResizeHeight);
        browserJob = startConversion(browserRuntime, { sources: selectedUploads.map((source) => ({ id: source.sourceId, input: source.input! })), video: { sourceId, trackId, trim: trim(exportVideoStart, exportVideoEnd) }, audio, format: exportFormat as "mp4" | "webm" | "mov" | "mkv", encoding: encodingOptions(undefined, undefined, false, true) as never, ...(width === undefined || height === undefined ? {} : { resize: { width, height } }) }) as PausableJob<ExportBundleOrConversion>;
      } else {
        if (!player || !loadedTemplate) throw new Error("No authored preview is available for export");
      const w = player.renderWidth;
      const h = player.renderHeight;
      browserRuntime = createRuntime(createBrowserRuntimeAdapter({ document }));
      browserJob = startExport(browserRuntime, loadedTemplate as unknown as ExportableMedia, {
        for: [`${w}x${h}.${exportFormat}`],
        encoding: encodingOptions(w, h, true, true) as never,
      });
      }
      const job = browserJob;
      const applyBrowserEvent = (event: JobEvent) => {
        activeJob = { ...event, id: event.jobId } as MediaJobSnapshot;
        applyJobEvent(activeJob);
      };
      const unsubscribe = job.subscribe(applyBrowserEvent);
      try {
        const bundle = await job.result;
        if ("artifacts" in bundle) {
          const artifact = bundle.artifacts[0];
          if (!artifact) throw new Error("Browser export produced no artifact");
          exportedBlob = new Blob([await new Response(artifact.stream()).arrayBuffer()], { type: artifact.mimeType });
        } else {
          exportedBlob = new Blob([await new Response(bundle.open()).arrayBuffer()], { type: bundle.mimeType });
        }
      } finally {
        unsubscribe();
        await job.dispose();
        await browserRuntime.dispose();
        browserJob = null;
        browserRuntime = null;
      }
      exportSize.textContent = `— ${(exportedBlob!.size / 1024 / 1024).toFixed(1)} MB`;
      exportPanel.dataset.state = "done";
      showToast("Export complete!", "success");
      setStatus("Export complete!");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("Export cancelled");
      } else {
        const msg = e instanceof Error ? e.message : "Unknown";
        showToast(`Export failed: ${msg}`, "error");
        setStatus(`Export failed: ${msg}`);
      }
      exportPanel.dataset.state = "config";
    } finally {
      if (browserJob) await browserJob.dispose();
      if (browserRuntime) await browserRuntime.dispose();
      browserJob = null; browserRuntime = null;
      exporting = false;
      exportAbortController = null;
      updateUI();
    }
  });

  // Cancel export
  exportCancel.addEventListener("click", () => {
    if (activeJob && !browserJob) void jobs.command(activeJob.id, "cancel").catch((error) => showToast(error instanceof Error ? error.message : "Cancel failed", "error"));
    if (browserJob) void browserJob.cancel("cancelled");
    exportAbortController?.abort();
    exportPanel.dataset.state = "config";
  });
  exportPause.addEventListener("click", () => {
    if (browserJob) {
      void (browserJob.state === "paused" ? browserJob.resume() : browserJob.pause());
      return;
    }
    if (!activeJob) return;
    const command = activeJob.state === "paused" ? "resume" : "pause";
    void jobs.command(activeJob.id, command).catch((error) => showToast(error instanceof Error ? error.message : `${command} failed`, "error"));
  });

  // Close export panel buttons
  exportPanelClose.addEventListener("click", closeExportPanel);
  exportCloseBtn.addEventListener("click", closeExportPanel);
  exportPanel.addEventListener("click", (e) => {
    if (e.target === exportPanel) closeExportPanel();
  });

  // Download exported video
  exportDownload.addEventListener("click", () => {
    if (exportedBlob) {
      downloadBlob(exportedBlob, `${exportMeta.filename}.${exportFormat}`);
    } else if (activeJob?.state === "succeeded") {
      void jobs.artifact(activeJob.id, 0).then((blob) => downloadBlob(blob, activeJob?.artifacts?.[0]?.filename ?? `${exportMeta.filename}.${exportFormat}`));
    }
  });
}
