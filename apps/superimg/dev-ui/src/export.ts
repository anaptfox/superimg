import { CanvasRenderer, createRenderContext, buildCompositeHtml, exportToVideo, downloadBlob, Player } from "superimg";
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
} from "./dom";
import { setStatus, showToast } from "./ui-feedback";

// Export panel state
export let exportFormat: "mp4" | "webm" = "mp4";
export let exportAbortController: AbortController | null = null;
export let exportedBlob: Blob | null = null;
export let exporting = false;

export function openExportPanel() {
  exportPanel.dataset.state = "config";
  exportPanel.classList.remove("hidden");
  // Close other panels
  settingsPanel.classList.add("hidden");
  settingsBtn.setAttribute("aria-expanded", "false");
  helpPanel.classList.add("hidden");
  helpBtn.setAttribute("aria-expanded", "false");
}

export function closeExportPanel() {
  exportPanel.classList.add("hidden");
  exportAbortController?.abort();
  exportAbortController = null;
}

export function initExportHandlers(
  playerInfo: () => Player | null, 
  templateInfo: () => any, 
  configInfo: () => any, 
  updateUI: () => void
) {
  // Format pills
  document.querySelectorAll(".export-fmt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".export-fmt-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      exportFormat = (btn as HTMLButtonElement).dataset.format as "mp4" | "webm";
    });
  });

  // Start export
  exportStart.addEventListener("click", async () => {
    const player = playerInfo();
    const loadedTemplate = templateInfo();
    const devConfig = configInfo();

    if (!player || exporting || !loadedTemplate) return;
    exporting = true;
    exportAbortController = new AbortController();
    exportPanel.dataset.state = "exporting";
    exportBar.style.width = "0%";
    exportPercent.textContent = "0%";
    updateUI();

    try {
      const w = player.renderWidth;
      const h = player.renderHeight;
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = w;
      exportCanvas.height = h;

      const exportRenderer = new CanvasRenderer(exportCanvas);
      exportRenderer.setOptions({
        fonts: loadedTemplate?.config?.fonts,
        inlineCss: loadedTemplate?.config?.inlineCss,
        stylesheets: loadedTemplate?.config?.stylesheets,
      });
      await exportRenderer.warmup();

      const template = loadedTemplate;
      const fps = player.fps;
      const totalFrames = player.totalFrames;

      const renderAtExportSize = async (frame: number) => {
        if (exportAbortController?.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const mergedData = template.defaults ?? {};
        const ctx = createRenderContext(frame, fps, totalFrames, w, h, mergedData);
        const html = template.render(ctx);
        const compositeHtml = buildCompositeHtml(html, template.config?.background, w, h);
        await exportRenderer.renderFrame(() => compositeHtml, ctx);
      };

      const blob = await exportToVideo(
        exportCanvas,
        { fps: devConfig.fps, width: w, height: h, duration: devConfig.duration } as any, // Cast to any to bypass the missing format type
        renderAtExportSize,
        {
          onProgress: (f, t) => {
            if (exportAbortController?.signal.aborted) return;
            const pct = Math.round((f / t) * 100);
            exportBar.style.width = `${pct}%`;
            exportPercent.textContent = `${pct}%`;
            setStatus(`Exporting frame ${f}/${t}`);
          },
          onStatusChange: setStatus
        }
      );
      await exportRenderer.dispose();
      exportedBlob = blob;
      exportSize.textContent = `— ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
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
      exporting = false;
      exportAbortController = null;
      updateUI();
    }
  });

  // Cancel export
  exportCancel.addEventListener("click", () => {
    exportAbortController?.abort();
    exportPanel.dataset.state = "config";
  });

  // Close export panel buttons
  exportPanelClose.addEventListener("click", closeExportPanel);
  exportCloseBtn.addEventListener("click", closeExportPanel);

  // Download exported video
  exportDownload.addEventListener("click", () => {
    if (exportedBlob) {
      downloadBlob(exportedBlob, `export.${exportFormat}`);
    }
  });
}
