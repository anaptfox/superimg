import { captureAccepted, captureFreshness, createPreviewInspection, describeSelectedPart, type InspectionPlayer, type PreviewSnapshot, type PreviewCompilationState, type SelectedPartCompilation } from "@foxworth/superimg/inspection";
import { inspectorBtn, inspectorPanel, inspectorPanelClose, inspectorCode } from "./dom";
import { comparableInspectorCaptures, pixelDifference, selectedNodeFindings, visibleNodeCrop, type InspectorCapture, type InspectorFindingsReport } from "./inspector-evidence";

interface InspectorHost {
  coordinates?: { entryId: string | null; variantId: string | null; editionId: string | null };
  inspectUrl?: string;
  sourceBindings?: () => SelectedPartCompilation | undefined;
  interactive?: { guide: { goToStep(stepId: string): Promise<void>; readonly currentStep: { stepId: string } | null; readonly steps?: readonly { stepId: string; startFrame: number; endFrame: number }[] } };
}
/** Ordinary JavaScript host with lazy capture; it does not require browser automation. */
export function mountPreviewInspector(player: InspectionPlayer, sourceId: string, onModeChange: () => void, source?: { id: string; revision: string }, host: InspectorHost = {}) {
  const inspection = createPreviewInspection();
  const surfaceId = "dev-preview";
  let acceptedSource: { id: string; revision?: string } = source ?? { id: sourceId };
  let compilation: PreviewCompilationState = source ? { status: "succeeded", source } : { status: "pending" };
  const attached = inspection.attach({ surfaceId, player, get source() { return acceptedSource; }, get compilation() { return compilation; }, coordinates: host.coordinates ?? { entryId: null, variantId: null, editionId: "default" }, ...(host.interactive ? { interactive: host.interactive } : {}), controls: host.interactive ? ["set-mode", "seek-frame", "select-step"] : ["set-mode", "seek-frame"] });
  const element = <T extends HTMLElement>(id: string) => inspectorPanel.querySelector<T>(`#${id}`)!;
  const form = element<HTMLFormElement>("inspector-frame-form"), fields = form.querySelector<HTMLFieldSetElement>("fieldset")!;
  const frame = element<HTMLInputElement>("inspector-frame"), live = element<HTMLButtonElement>("inspector-live");
  const refreshButton = element<HTMLButtonElement>("inspector-refresh"), summary = element("inspector-summary"), snapshotCode = element("inspector-snapshot"), status = element("inspector-status");
  const captureButton = element<HTMLButtonElement>("inspector-capture"), baselineButton = element<HTMLButtonElement>("inspector-baseline"), compareButton = element<HTMLButtonElement>("inspector-compare"), saveButton = element<HTMLButtonElement>("inspector-save");
  const captureStatus = element("inspector-capture-status"), image = element<HTMLImageElement>("inspector-image"), baselineImage = element<HTMLImageElement>("inspector-baseline-image"), diffCanvas = element<HTMLCanvasElement>("inspector-diff"), diffStatus = element("inspector-diff-status");
  const nodeSelect = element<HTMLSelectElement>("inspector-node"), nodeDetail = element("inspector-node-detail"), nodeCrop = element<HTMLCanvasElement>("inspector-node-crop"), findings = element("inspector-findings");
  let current: PreviewSnapshot | null = null, captured: InspectorCapture | null = null, baseline: InspectorCapture | null = null;
  let busy = false, disposed = false, refreshTimer: ReturnType<typeof setTimeout> | undefined, nodeRevision = "", findingsRequest = 0;
  let findingsReport: InspectorFindingsReport | undefined;
  const lifetime = new AbortController();
  const listeners: (() => void)[] = [];
  function listen(target: EventTarget, event: string, callback: EventListener) { target.addEventListener(event, callback); listeners.push(() => target.removeEventListener(event, callback)); }
  // External controls must update the same host chrome as inspector controls.
  const exposed = {
    ...inspection,
    async setMode(...args: Parameters<typeof inspection.setMode>) { const value = await inspection.setMode(...args); display(value); return value; },
    async seek(...args: Parameters<typeof inspection.seek>) { const value = await inspection.seek(...args); display(value); return value; },
  };
  Object.assign(window, { superimgInspection: exposed });

  function controls() {
    fields.disabled = busy; refreshButton.disabled = busy; captureButton.disabled = busy;
    live.disabled = busy || current?.clock.owner !== "inspection";
    baselineButton.disabled = busy || !captured || captured.report.status !== "accepted";
    compareButton.disabled = busy || !captured || !baseline;
    saveButton.disabled = busy || !captured;
  }
  function display(value: PreviewSnapshot) {
    const previousOwner = current?.clock.owner; current = value;
    inspectorPanel.dataset.mode = value.clock.owner;
    const fresh = captureFreshness(value);
    inspectorPanel.dataset.freshness = fresh.status;
    summary.textContent = `Presented ${value.presented?.frame ?? "—"} · requested ${value.requestedFrame ?? "—"} · ${value.clock.owner} · source ${fresh.status}`;
    frame.max = String(Math.max(0, value.totalFrames - 1));
    if (document.activeElement !== frame) frame.value = String(value.presented?.frame ?? 0);
    snapshotCode.textContent = JSON.stringify(value, null, 2);
    inspectorCode.textContent = player.getPresentation().accepted?.compositeHtml ?? "";
    status.textContent = `Resources: ${value.readiness.status} · generation ${value.generation} · revision ${value.presented?.revision ?? "—"}${compilation.error ? ` · ${compilation.error.message}` : ""}`;
    const revision = `${value.generation}:${value.presented?.revision}`;
    if (revision !== nodeRevision) {
      nodeRevision = revision;
      const selected = nodeSelect.value;
      nodeSelect.replaceChildren(new Option(`Choose a node (${value.nodes.length}${value.nodes.length > 800 ? "; first 800 listed" : ""})`, ""));
      for (const node of value.nodes.slice(0, 800)) nodeSelect.add(new Option(`${node.id}${node.occurrence ? ` · ${node.occurrence}` : ""}`, JSON.stringify([node.id, node.occurrence])));
      nodeSelect.value = selected;
    }
    controls(); void selectedNode().catch(error => { nodeDetail.textContent = String(error); });
    if (previousOwner !== value.clock.owner) onModeChange();
  }
  async function loadFindings(value: PreviewSnapshot) {
    findingsReport = undefined;
    if (!host.inspectUrl || !value.presented) { findings.textContent = "Technical coverage unavailable for this host."; return; }
    if (value.compilation?.status !== "succeeded") { findings.textContent = "Unverified: current compilation has not been accepted."; return; }
    const request = ++findingsRequest;
    try {
      const url = new URL(host.inspectUrl, location.href); url.searchParams.set("frame", String(value.presented.frame));
      const response = await fetch(url, { signal: lifetime.signal });
      const body = await response.json();
      if (disposed || request !== findingsRequest) return;
      const now = await inspection.inspect({ surfaceId });
      if (disposed || request !== findingsRequest) return;
      if (!response.ok || body.error) throw new Error(body.error?.message ?? `Inspection failed (${response.status})`);
      if (body.source?.revision !== value.source?.revision || body.frame !== value.presented.frame || now.generation !== value.generation || now.presented?.revision !== value.presented.revision || now.compilation?.status !== "succeeded" || value.compilation.hostGeneration === undefined || body.generation !== value.compilation.hostGeneration || now.compilation.hostGeneration !== value.compilation.hostGeneration) throw new Error("Findings do not match the accepted source, host generation and frame");
      findings.textContent = JSON.stringify({ findings: body.report.findings, coverage: body.report.coverage ?? body.report.metadata?.analysisCoverage ?? "unavailable", visual: "unreviewed" }, null, 2);
      findingsReport = structuredClone(body) as InspectorFindingsReport;
      void selectedNode().catch(error => { nodeDetail.textContent = String(error); });
    } catch (error) { if (!disposed && request === findingsRequest) { findingsReport = undefined; findings.textContent = `Unverified: ${error instanceof Error ? error.message : String(error)}`; void selectedNode().catch(error => { nodeDetail.textContent = String(error); }); } }
  }
  async function refresh() {
    if (disposed || busy) return;
    try { const value = await inspection.inspect({ surfaceId }); display(value); if (value.clock.owner === "inspection") void loadFindings(value); }
    catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  }
  async function select(selectedFrame: number | null) {
    if (busy || disposed) return;
    busy = true; controls(); status.textContent = selectedFrame === null ? "Restoring live preview…" : "Waiting for the selected frame and resources…";
    try {
      const before = await inspection.inspect({ surfaceId });
      const mode = await inspection.setMode({ surfaceId, expectedGeneration: before.generation, mode: selectedFrame === null ? "live" : "inspection" }); display(mode);
      if (selectedFrame !== null) { const accepted = await inspection.seek({ surfaceId, expectedGeneration: mode.generation, frame: selectedFrame }); display(accepted); void loadFindings(accepted); }
    } catch (error) {
      await inspection.inspect({ surfaceId }).then(display, () => undefined);
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally { busy = false; controls(); }
  }
  function release(value: InspectorCapture | null) { if (value && value !== captured && value !== baseline) URL.revokeObjectURL(value.url); }
  async function captureMedia() {
    if (busy || disposed) return;
    await select(current?.presented?.frame ?? 0);
    if (disposed || current?.clock.owner !== "inspection") return;
    busy = true; controls(); captureStatus.textContent = "Capturing accepted media and bounded DOM evidence…";
    let output: Awaited<ReturnType<typeof import("@foxworth/superimg/browser-export")["captureBrowserArtifactWithEvidence"]>> | undefined;
    try {
      const report = await captureAccepted({
        inspect: () => inspection.inspect({ surfaceId }),
        identity: async () => ({ browserVersion: navigator.userAgent, url: location.href, documentTimeOrigin: performance.timeOrigin, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio } }),
        capture: async () => {
          const hostElement = "hostElement" in player ? player.hostElement : player.container;
          const doc = Array.from(hostElement.querySelectorAll<HTMLIFrameElement>("iframe")).find(value => value.style.visibility !== "hidden" && value.contentDocument?.getElementById("root"))?.contentDocument;
          // The authored stage has explicit pixel dimensions. Capturing #root
          // alone loses its percentage-height containing block in SnapDOM.
          const stage = doc?.getElementById("scale-wrapper");
          if (!stage || !current) throw new Error("Committed media stage is unavailable");
          const { captureBrowserArtifactWithEvidence } = await import("@foxworth/superimg/browser-export");
          output = await captureBrowserArtifactWithEvidence(stage, { width: current.width, height: current.height, dpr: 1, format: "png", fast: true });
        },
      }, { ...(current.presented ? { expectedFrame: current.presented.frame } : {}), signal: lifetime.signal });
      if (!output) throw new Error(report.error?.message ?? "Capture produced no pixels");
      if (disposed) return;
      const previous = captured;
      captured = { backend: "snapdom", blob: output.output, url: URL.createObjectURL(output.output), report, evidence: output.evidence };
      release(previous); image.src = captured.url; image.hidden = false; diffCanvas.hidden = true;
      captureStatus.textContent = `${report.status} capture · source ${report.freshness.status} · DOM rasterization · visual unreviewed${report.issues.length ? ` · ${report.issues.join(", ")}` : ""}`;
      void selectedNode().catch(error => { nodeDetail.textContent = String(error); });
    } catch (error) { captureStatus.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; controls(); }
  }
  function useBaseline() {
    if (!captured || captured.report.status !== "accepted") return;
    const previous = baseline; baseline = captured; release(previous);
    baselineImage.src = baseline.url; baselineImage.hidden = false; diffCanvas.hidden = true;
    diffStatus.textContent = "Baseline selected. Capture the next revision at the same frame and size."; controls();
  }
  async function compare() {
    if (!captured || !baseline || busy) return;
    const reasons = comparableInspectorCaptures(baseline, captured);
    if (reasons.length) { diffStatus.textContent = `Not comparable: ${reasons.join(", ")}`; diffCanvas.hidden = true; return; }
    busy = true; controls();
    let a: ImageBitmap | undefined, b: ImageBitmap | undefined;
    try {
      a = await createImageBitmap(baseline.blob); b = await createImageBitmap(captured.blob);
      if (a.width !== b.width || a.height !== b.height) throw new Error("Image dimensions differ");
      const canvas = document.createElement("canvas"); canvas.width = a.width; canvas.height = a.height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(a, 0, 0); const left = context.getImageData(0, 0, a.width, a.height).data;
      context.clearRect(0, 0, a.width, a.height); context.drawImage(b, 0, 0);
      const difference = pixelDifference(left, context.getImageData(0, 0, b.width, b.height).data);
      diffCanvas.width = b.width; diffCanvas.height = b.height;
      diffCanvas.getContext("2d")!.putImageData(new ImageData(difference.pixels, b.width, b.height), 0, 0); diffCanvas.hidden = false;
      diffStatus.textContent = `${difference.changedPixels} / ${difference.totalPixels} media pixels changed. Visual review remains unreviewed.`;
    } catch (error) { diffStatus.textContent = error instanceof Error ? error.message : String(error); }
    finally { a?.close(); b?.close(); busy = false; controls(); }
  }
  async function selectedNode() {
    nodeCrop.hidden = true;
    if (!current || !nodeSelect.value) { nodeDetail.textContent = "No node selected"; return; }
    const [id, occurrence] = JSON.parse(nodeSelect.value) as [string, string | null];
    const node = current.nodes.find(item => item.id === id && item.occurrence === occurrence);
    const measured = current.observations?.nodes.find(item => item.id === id && item.occurrence === occurrence);
    const clippingAncestors: Array<Pick<NonNullable<typeof measured>, "id" | "occurrence" | "tag" | "bounds" | "clipping">> | null = measured?.parentIndex === undefined ? null : [];
    const observed = current.observations?.nodes ?? [], seen = new Set<number>();
    let parentIndex = measured?.parentIndex;
    while (clippingAncestors && parentIndex !== undefined && parentIndex !== null && Number.isSafeInteger(parentIndex) && parentIndex >= 0 && parentIndex < observed.length && !seen.has(parentIndex)) {
      seen.add(parentIndex);
      const parent = observed[parentIndex]!;
      clippingAncestors.push({ id: parent.id, occurrence: parent.occurrence, tag: parent.tag, bounds: parent.bounds, ...(parent.clipping ? { clipping: parent.clipping } : {}) });
      parentIndex = parent.parentIndex;
    }
    const binding = host.sourceBindings?.();
    const source = binding ? describeSelectedPart({ snapshot: current, target: { id, occurrence }, compilation: binding }) : { state: "inspect-only", reason: "source-binding-unavailable" };
    nodeDetail.textContent = JSON.stringify({ node: node ?? null, measured: measured ?? null, clippingAncestors, measurementCoverage: current.observations?.coverage ?? null, findings: selectedNodeFindings(current, { id, occurrence }, findingsReport), source, coverage: current.coverage, visual: "unreviewed" }, null, 2);
    if (!node?.authoredBounds || !captured || captured.report.after?.generation !== current.generation || captured.report.after.presented?.revision !== current.presented?.revision) return;
    const targetCapture = captured, selection = nodeSelect.value, shown = current;
    const bitmap = await createImageBitmap(captured.blob);
    try {
      if (disposed || targetCapture !== captured || selection !== nodeSelect.value || current?.generation !== shown.generation || current?.presented?.revision !== shown.presented?.revision) return;
      const crop = visibleNodeCrop(node.authoredBounds, shown, bitmap);
      if (!crop) return;
      const { x, y, width, height } = crop;
      nodeCrop.width = width; nodeCrop.height = height;
      nodeCrop.getContext("2d")!.drawImage(bitmap, x, y, width, height, 0, 0, width, height); nodeCrop.hidden = false;
    } finally { bitmap.close(); }
  }
  async function save() {
    if (!captured) return;
    const value = captured;
    const bytes = await value.blob.arrayBuffer();
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(value.blob); });
    const file = new Blob([JSON.stringify({ kind: "superimg-inspector-evidence", backend: value.backend, report: value.report, evidence: value.evidence, image: { sha256, dataUrl }, visual: "unreviewed" }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file), link = document.createElement("a"); link.href = url; link.download = "superimg-inspection.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function close() { inspectorBtn.setAttribute("aria-expanded", "false"); inspectorPanel.classList.remove("open"); inspectorPanel.inert = true; inspectorBtn.focus(); }
  listen(inspectorBtn, "click", () => { const expanded = inspectorBtn.getAttribute("aria-expanded") === "true"; if (expanded) close(); else { inspectorBtn.setAttribute("aria-expanded", "true"); inspectorPanel.classList.add("open"); inspectorPanel.inert = false; void refresh(); } });
  listen(inspectorPanelClose, "click", close);
  listen(form, "submit", event => { event.preventDefault(); void select(frame.valueAsNumber); });
  listen(live, "click", () => { void select(null); }); listen(refreshButton, "click", () => { void refresh(); });
  listen(captureButton, "click", () => { void captureMedia(); }); listen(baselineButton, "click", useBaseline); listen(compareButton, "click", () => { void compare(); });
  listen(nodeSelect, "change", () => { void selectedNode().catch(error => { nodeDetail.textContent = String(error); }); }); listen(saveButton, "click", () => { void save().catch(error => { captureStatus.textContent = String(error); }); });
  const unsubscribe = player.on("presentation", () => { if (!inspectorPanel.classList.contains("open") || refreshTimer || busy) return; refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh(); }, 100); });
  function dispose() {
    if (disposed) return; disposed = true; lifetime.abort(); clearTimeout(refreshTimer); unsubscribe(); listeners.forEach(remove => remove());
    window.removeEventListener("pagehide", dispose); attached.dispose(); inspection.dispose();
    if (captured) URL.revokeObjectURL(captured.url); if (baseline && baseline !== captured) URL.revokeObjectURL(baseline.url);
    if (Reflect.get(window, "superimgInspection") === exposed) Reflect.deleteProperty(window, "superimgInspection");
  }
  window.addEventListener("pagehide", dispose, { once: true });
  return { get mode() { return current?.clock.owner ?? "playback"; }, setSource(value: { id: string; revision: string } | undefined) { acceptedSource = value ?? { id: sourceId }; }, setCompilation(value: PreviewCompilationState) { compilation = structuredClone(value); void refresh(); }, dispose };
}
