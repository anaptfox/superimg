"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useVideoSession, Timeline } from "superimg-react";
import {
  useMcpToolResult,
  useIsChatGptApp,
  useRequestDisplayMode,
  useDisplayMode,
} from "@/app/hooks";

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function readFormat(
  value: unknown
): "horizontal" | "vertical" | "square" | undefined {
  return value === "horizontal" || value === "vertical" || value === "square"
    ? value
    : undefined;
}

const DEFAULT_CODE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    title: "Hello from ChatGPT",
    accentColor: "#667eea",
  },
  render(ctx) {
    const { width, height, sceneProgress: p, std, data } = ctx;
    const opacity = std.tween(0, 1, std.math.clamp(p * 3, 0, 1), "easeOutCubic");
    const y = std.tween(30, 0, std.math.clamp(p * 3, 0, 1), "easeOutCubic");

    return \`
      <div style="\${std.css({ width, height, background: "#0f0f23" })};\${std.css.center()}">
        <h1 style="\${std.css({
          fontSize: 72,
          color: data.accentColor,
          fontFamily: "system-ui, sans-serif",
          opacity,
          transform: "translateY(" + y + "px)",
        })}">\${data.title}</h1>
      </div>
    \`;
  },
});
`;

export default function WidgetEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isChatGptApp = useIsChatGptApp();
  const requestDisplayMode = useRequestDisplayMode();
  const displayMode = useDisplayMode();

  const toolOutput = useMcpToolResult();
  const sc: Record<string, unknown> | undefined = (toolOutput?.structuredContent ??
    toolOutput?.result?.structuredContent ??
    toolOutput ??
    undefined);
  const code = readString(sc?.["code"]) ?? DEFAULT_CODE;
  const title = readString(sc?.["title"]) ?? "SuperImg";
  const format = readFormat(sc?.["format"]) ?? "horizontal";
  const duration = readNumber(sc?.["duration"]) ?? 5;

  const session = useVideoSession({
    containerRef,
    initialFormat: format,
    duration,
  });

  // Compile template code
  useEffect(() => {
    if (code) session.compile(code);
  }, [code]);

  // Request fullscreen when inside ChatGPT
  useEffect(() => {
    if (isChatGptApp && displayMode !== "fullscreen") {
      requestDisplayMode("fullscreen");
    }
  }, [isChatGptApp]);

  // Auto-play once ready
  useEffect(() => {
    if (session.ready && !session.isPlaying) {
      session.play();
    }
  }, [session.ready]);

  const handleExport = useCallback(async () => {
    const blob = await session.exportMp4();
    if (blob) session.download(blob, `${title.toLowerCase().replace(/\s+/g, "-")}.mp4`);
  }, [session, title]);

  return (
    <div className="flex h-screen flex-col bg-[#0d0d0d] text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/80">{title}</span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              session.error
                ? "bg-red-500/20 text-red-400"
                : session.ready
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {session.error ? "Error" : session.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>
            {session.width}×{session.height}
          </span>
          <span>·</span>
          <span>{session.fps}fps</span>
          <span>·</span>
          <span>{duration}s</span>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <div
          ref={containerRef}
          className="max-h-full max-w-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
        />
      </div>

      {/* Timeline */}
      <div className="border-t border-white/10 px-4 py-3">
        <Timeline store={session.store} className="h-2 rounded" showTime />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
        <button
          onClick={() => session.togglePlayPause()}
          disabled={session.exporting}
          className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          {session.isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={handleExport}
          disabled={session.exporting || !session.template}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {session.exporting
            ? `Exporting ${Math.round(session.exportProgress * 100)}%`
            : "Export MP4"}
        </button>
      </div>

      {/* Error display */}
      {session.error && (
        <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-3">
          <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs text-red-400">
            {session.error.message}
          </pre>
        </div>
      )}

      {/* Standalone fallback (not in ChatGPT) */}
      {!isChatGptApp && (
        <div className="border-t border-white/10 px-4 py-2 text-center text-xs text-white/30">
          MCP endpoint: <code>/mcp</code> · Connect via ChatGPT Settings →
          Connectors
        </div>
      )}
    </div>
  );
}
