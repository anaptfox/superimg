//! Single entry point for rendering errors across CLI, dev UI, and MCP surfaces.

import {
  SuperImgError,
  TemplateRuntimeError,
  type SuperImgErrorJSON,
  type TimeContext,
} from "@superimg/types";
import pc from "picocolors";
import { getCodeFrame } from "./code-frame.js";
import { enrichError, type EnrichContext } from "./enrich.js";

export interface FormattedError {
  /** ANSI-colored output for CLI surfaces */
  ansi: string;
  /** Self-contained HTML fragment for dev UI overlay */
  html: string;
  /** Stable JSON shape for MCP / WebSocket transport */
  json: SuperImgErrorJSON;
  /** Plain-text fallback (no colors, no markup) */
  plain: string;
}

/**
 * Format any error for display across surfaces.
 *
 * If `err` is not already a SuperImgError, it's wrapped via `enrichError(err, ctx)`.
 * The optional `ctx.sourceMap` lets us map `<anonymous>` stack frames back to
 * the user's `.video.ts` source.
 */
export function formatError(
  err: unknown,
  ctx?: EnrichContext,
): FormattedError {
  const enriched = enrichError(err, ctx);
  return {
    ansi: renderAnsi(enriched),
    html: renderHtml(enriched),
    json: enriched.toJSON(),
    plain: renderPlain(enriched),
  };
}

// =============================================================================
// ANSI
// =============================================================================

function renderAnsi(err: SuperImgError): string {
  const lines: string[] = [];

  // Title bar
  lines.push("");
  lines.push(pc.bgRed(pc.white(pc.bold(` ${err.name} `))) + " " + pc.red(err.code));

  // Message
  lines.push("");
  lines.push(pc.bold(err.message));

  // Source location
  if (err.location) {
    const { file, line, column } = err.location;
    const colStr = column !== undefined ? `:${column + 1}` : "";
    lines.push("");
    lines.push(pc.dim("at ") + pc.cyan(`${file}:${line}${colStr}`));
  }

  // Code frame — if we have raw source it'd already be in err.codeFrame.
  // Re-highlight with ANSI when present (the stored frame is plain text).
  if (err.codeFrame) {
    lines.push("");
    lines.push(reHighlight(err.codeFrame));
  }

  // Frame / time context for runtime errors
  if (err instanceof TemplateRuntimeError) {
    const det = err.details as {
      frame?: number;
      timeContext?: TimeContext;
      dataSnapshot?: unknown;
    };
    if (det.frame !== undefined && det.timeContext) {
      lines.push("");
      lines.push(
        pc.dim("Frame ") +
          pc.yellow(String(det.frame)) +
          pc.dim(" at ") +
          pc.yellow(`${det.timeContext.sceneTimeSeconds.toFixed(3)}s`) +
          pc.dim(" (") +
          pc.yellow(`${(det.timeContext.sceneProgress * 100).toFixed(1)}%`) +
          pc.dim(" scene progress)"),
      );
    }
    if (det.dataSnapshot !== undefined) {
      lines.push("");
      lines.push(pc.dim("Data at failure:"));
      lines.push(indent(JSON.stringify(det.dataSnapshot, null, 2), "  "));
    }
  }

  // Suggestion
  if (err.suggestion) {
    lines.push("");
    lines.push(pc.green(pc.bold("→ Suggestion: ")) + err.suggestion);
  }

  // Docs link
  if (err.docsUrl) {
    lines.push(pc.dim("  Docs: ") + pc.dim(pc.underline(err.docsUrl)));
  }

  lines.push("");
  return lines.join("\n");
}

function reHighlight(codeFrame: string): string {
  // The stored frame is plain text. Highlight the marker line (starts with "> ")
  // and dim the gutter.
  return codeFrame
    .split("\n")
    .map((line) => {
      // Marker line: "> 42 |   bad code"
      if (/^>\s*\d+\s*\|/.test(line)) {
        return pc.red(line);
      }
      // Caret line: "    | ^^^^"
      if (/^\s*\|\s*\^/.test(line)) {
        return pc.red(line);
      }
      // Gutter line: "  41 |   ..."
      return pc.dim(line);
    })
    .join("\n");
}

function indent(s: string, prefix: string): string {
  return s
    .split("\n")
    .map((l) => prefix + l)
    .join("\n");
}

// =============================================================================
// HTML (self-contained, inline styles)
// =============================================================================

function renderHtml(err: SuperImgError): string {
  const esc = escapeHtml;
  const parts: string[] = [];

  parts.push(`<div class="superimg-error" style="${ROOT_STYLE}">`);
  parts.push(
    `<div style="${TITLE_BAR_STYLE}"><span style="${BADGE_STYLE}">${esc(err.name)}</span><span style="${CODE_STYLE}">${esc(err.code)}</span></div>`,
  );
  parts.push(`<div style="${MESSAGE_STYLE}">${esc(err.message)}</div>`);

  if (err.location) {
    const { file, line, column } = err.location;
    const colStr = column !== undefined ? `:${column + 1}` : "";
    const editorUrl = `vscode://file/${encodeURI(file)}:${line}:${(column ?? 0) + 1}`;
    parts.push(
      `<div style="${LOCATION_STYLE}"><a href="${esc(editorUrl)}" style="${LINK_STYLE}">${esc(`${file}:${line}${colStr}`)}</a></div>`,
    );
  }

  if (err.codeFrame) {
    parts.push(
      `<pre style="${CODE_FRAME_STYLE}">${esc(err.codeFrame)}</pre>`,
    );
  }

  if (err instanceof TemplateRuntimeError) {
    const det = err.details as {
      frame?: number;
      timeContext?: TimeContext;
      dataSnapshot?: unknown;
    };
    if (det.frame !== undefined && det.timeContext) {
      parts.push(
        `<div style="${META_STYLE}">Frame ${det.frame} at ${det.timeContext.sceneTimeSeconds.toFixed(3)}s (${(det.timeContext.sceneProgress * 100).toFixed(1)}% scene progress)</div>`,
      );
    }
    if (det.dataSnapshot !== undefined) {
      parts.push(
        `<details style="${DETAILS_STYLE}"><summary>Data at failure</summary><pre style="${CODE_FRAME_STYLE}">${esc(JSON.stringify(det.dataSnapshot, null, 2))}</pre></details>`,
      );
    }
  }

  if (err.suggestion) {
    parts.push(`<div style="${SUGGESTION_STYLE}">→ ${esc(err.suggestion)}</div>`);
  }

  if (err.docsUrl) {
    parts.push(
      `<div style="${DOCS_STYLE}"><a href="${esc(err.docsUrl)}" target="_blank" rel="noreferrer" style="${LINK_STYLE}">${esc(err.docsUrl)}</a></div>`,
    );
  }

  parts.push(`</div>`);
  return parts.join("");
}

const ROOT_STYLE =
  "font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:#1a1a1a;color:#e8e8e8;padding:24px;border-left:4px solid #ef4444;border-radius:6px;line-height:1.5;";
const TITLE_BAR_STYLE = "display:flex;gap:8px;align-items:center;margin-bottom:12px;";
const BADGE_STYLE =
  "background:#ef4444;color:#fff;padding:2px 8px;border-radius:3px;font-weight:bold;font-size:12px;letter-spacing:0.5px;";
const CODE_STYLE = "color:#ef4444;font-size:11px;letter-spacing:0.3px;";
const MESSAGE_STYLE = "color:#fff;font-weight:600;font-size:14px;margin-bottom:12px;";
const LOCATION_STYLE = "color:#06b6d4;margin-bottom:12px;font-size:12px;";
const LINK_STYLE = "color:#06b6d4;text-decoration:underline;cursor:pointer;";
const CODE_FRAME_STYLE =
  "background:#0d0d0d;padding:12px;border-radius:4px;overflow-x:auto;font-size:12px;color:#d4d4d4;margin:0 0 12px 0;white-space:pre;";
const META_STYLE = "color:#fbbf24;font-size:12px;margin-bottom:8px;";
const DETAILS_STYLE = "color:#999;font-size:12px;margin-bottom:12px;";
const SUGGESTION_STYLE = "color:#10b981;font-size:13px;margin-top:8px;";
const DOCS_STYLE = "color:#666;font-size:11px;margin-top:6px;";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================================================
// PLAIN
// =============================================================================

function renderPlain(err: SuperImgError): string {
  const lines: string[] = [];
  lines.push(`${err.name} [${err.code}]`);
  lines.push("");
  lines.push(err.message);

  if (err.location) {
    const { file, line, column } = err.location;
    const colStr = column !== undefined ? `:${column + 1}` : "";
    lines.push("");
    lines.push(`at ${file}:${line}${colStr}`);
  }

  if (err.codeFrame) {
    lines.push("");
    lines.push(err.codeFrame);
  }

  if (err instanceof TemplateRuntimeError) {
    const det = err.details as {
      frame?: number;
      timeContext?: TimeContext;
    };
    if (det.frame !== undefined && det.timeContext) {
      lines.push("");
      lines.push(
        `Frame ${det.frame} at ${det.timeContext.sceneTimeSeconds.toFixed(3)}s (${(det.timeContext.sceneProgress * 100).toFixed(1)}% scene progress)`,
      );
    }
  }

  if (err.suggestion) {
    lines.push("");
    lines.push(`Suggestion: ${err.suggestion}`);
  }

  if (err.docsUrl) {
    lines.push(`Docs: ${err.docsUrl}`);
  }

  return lines.join("\n");
}

// Re-export getCodeFrame so callers using format.ts directly don't need a
// second import for ad-hoc framing of arbitrary source.
export { getCodeFrame };
