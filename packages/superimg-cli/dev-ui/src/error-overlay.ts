//! Vite-style full-screen error overlay for the dev UI.
//! Receives a FormattedError (the .json + .html shape from @superimg/core/errors)
//! and renders a dismissable modal with code frame, file path link, and suggestion.

import type { SuperImgErrorJSON } from "@superimg/types";

let overlayEl: HTMLDivElement | null = null;

const STYLES = `
.superimg-overlay-root {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #e8e8e8;
  backdrop-filter: blur(4px);
}

.superimg-overlay-card {
  background: #1a1a1a;
  border-left: 4px solid #ef4444;
  border-radius: 6px;
  max-width: 900px;
  width: 100%;
  max-height: 85vh;
  overflow: auto;
  padding: 28px 32px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.superimg-overlay-titlebar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}

.superimg-overlay-badge {
  background: #ef4444;
  color: #fff;
  padding: 3px 10px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 11px;
  letter-spacing: 0.6px;
}

.superimg-overlay-code {
  color: #ef4444;
  font-size: 11px;
  letter-spacing: 0.3px;
}

.superimg-overlay-message {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.5;
}

.superimg-overlay-location {
  color: #06b6d4;
  margin-bottom: 14px;
  font-size: 12px;
}

.superimg-overlay-location a {
  color: #06b6d4;
  text-decoration: underline;
  cursor: pointer;
}

.superimg-overlay-frame {
  background: #0d0d0d;
  padding: 14px 16px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  color: #d4d4d4;
  margin: 0 0 16px 0;
  white-space: pre;
  line-height: 1.5;
}

.superimg-overlay-meta {
  color: #fbbf24;
  font-size: 12px;
  margin-bottom: 8px;
}

.superimg-overlay-details {
  color: #999;
  font-size: 12px;
  margin-bottom: 14px;
}

.superimg-overlay-suggestion {
  color: #10b981;
  font-size: 13px;
  margin-top: 12px;
  padding: 12px 14px;
  background: rgba(16, 185, 129, 0.08);
  border-left: 3px solid #10b981;
  border-radius: 3px;
}

.superimg-overlay-docs {
  color: #666;
  font-size: 11px;
  margin-top: 10px;
}

.superimg-overlay-docs a {
  color: #888;
  text-decoration: underline;
}

.superimg-overlay-dismiss {
  color: #666;
  font-size: 11px;
  margin-top: 14px;
  text-align: right;
}
`;

function ensureStyles() {
  if (document.getElementById("superimg-overlay-styles")) return;
  const style = document.createElement("style");
  style.id = "superimg-overlay-styles";
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOverlayHtml(err: SuperImgErrorJSON): string {
  const parts: string[] = [];
  parts.push(`<div class="superimg-overlay-card" role="dialog" aria-modal="true" aria-label="Error">`);

  // Title bar
  parts.push(
    `<div class="superimg-overlay-titlebar"><span class="superimg-overlay-badge">${escapeHtml(err.name)}</span><span class="superimg-overlay-code">${escapeHtml(err.code)}</span></div>`,
  );

  // Message
  parts.push(`<div class="superimg-overlay-message">${escapeHtml(err.message)}</div>`);

  // Location with editor link
  if (err.location) {
    const { file, line, column } = err.location;
    const colSuffix = column !== undefined ? `:${column + 1}` : "";
    const editorUrl = `vscode://file/${encodeURI(file)}:${line}:${(column ?? 0) + 1}`;
    parts.push(
      `<div class="superimg-overlay-location"><a href="${escapeHtml(editorUrl)}">${escapeHtml(`${file}:${line}${colSuffix}`)}</a></div>`,
    );
  }

  // Code frame
  if (err.codeFrame) {
    parts.push(`<pre class="superimg-overlay-frame">${escapeHtml(err.codeFrame)}</pre>`);
  }

  // Frame / time context for runtime errors
  const det = (err.details ?? {}) as {
    frame?: number;
    timeContext?: {
      sceneTimeSeconds: number;
      sceneProgress: number;
    };
    dataSnapshot?: unknown;
  };
  if (det.frame !== undefined && det.timeContext) {
    parts.push(
      `<div class="superimg-overlay-meta">Frame ${det.frame} at ${det.timeContext.sceneTimeSeconds.toFixed(3)}s (${(det.timeContext.sceneProgress * 100).toFixed(1)}% scene progress)</div>`,
    );
  }

  if (det.dataSnapshot !== undefined) {
    parts.push(
      `<details class="superimg-overlay-details"><summary>Data at failure</summary><pre class="superimg-overlay-frame">${escapeHtml(JSON.stringify(det.dataSnapshot, null, 2))}</pre></details>`,
    );
  }

  // Suggestion
  if (err.suggestion) {
    parts.push(`<div class="superimg-overlay-suggestion">→ ${escapeHtml(err.suggestion)}</div>`);
  }

  // Docs
  if (err.docsUrl) {
    parts.push(
      `<div class="superimg-overlay-docs"><a href="${escapeHtml(err.docsUrl)}" target="_blank" rel="noreferrer">${escapeHtml(err.docsUrl)}</a></div>`,
    );
  }

  parts.push(
    `<div class="superimg-overlay-dismiss">Press Esc or fix the file to dismiss</div>`,
  );

  parts.push(`</div>`);
  return parts.join("");
}

/**
 * Show the error overlay with the given formatted error JSON.
 * Idempotent: replaces the existing overlay content if one is already showing.
 */
export function showErrorOverlay(err: SuperImgErrorJSON): void {
  ensureStyles();
  if (!overlayEl) {
    overlayEl = document.createElement("div");
    overlayEl.className = "superimg-overlay-root";
    overlayEl.addEventListener("click", (e) => {
      // Click on backdrop dismisses; click inside card does not.
      if (e.target === overlayEl) hideErrorOverlay();
    });
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlayEl);
  }
  overlayEl.innerHTML = buildOverlayHtml(err);
}

/** Hide the overlay, if any. Safe to call when not showing. */
export function hideErrorOverlay(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
    document.removeEventListener("keydown", onKeydown);
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") hideErrorOverlay();
}
