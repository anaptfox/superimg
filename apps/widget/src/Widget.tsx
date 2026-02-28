import { useRef, useEffect, useCallback, useMemo } from "react";
import { useVideoSession, Timeline } from "superimg-react";
import {
  useMcpToolResult,
  useIsChatGptApp,
  useRequestDisplayMode,
  useDisplayMode,
  useOpenAIGlobal,
  useMaxHeight,
  useSendMessage,
} from "@/hooks";

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

export default function Widget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSentErrorRef = useRef<string | null>(null);
  const isChatGptApp = useIsChatGptApp();
  const requestDisplayMode = useRequestDisplayMode();
  const displayMode = useDisplayMode();
  const theme = useOpenAIGlobal("theme");
  const safeArea = useOpenAIGlobal("safeArea");
  const maxHeight = useMaxHeight();
  const sendMessage = useSendMessage();

  const toolOutput = useMcpToolResult();

  const isLoading = isChatGptApp && toolOutput === null;

  const code = readString(toolOutput?.code) ?? DEFAULT_CODE;
  const title = readString(toolOutput?.title) ?? "SuperImg";
  const format = readFormat(toolOutput?.format) ?? "horizontal";
  const duration = readNumber(toolOutput?.duration) ?? 5;
  const isFullscreen = displayMode === "fullscreen" || !isChatGptApp;
  const isInline = isChatGptApp && !isFullscreen;
  const safeBottom = safeArea?.bottom ?? 0;
  const isDark = theme !== "light";

  const colors = useMemo(
    () =>
      isDark
        ? {
            bg: "var(--openai-surface-background, #111315)",
            surface: "var(--openai-surface-primary, #1a1d21)",
            border: "var(--openai-border-subtle, rgba(255,255,255,0.14))",
            text: "var(--openai-text-primary, #f5f7fa)",
            textMuted: "var(--openai-text-secondary, rgba(245,247,250,0.72))",
            textSubtle:
              "var(--openai-text-tertiary, rgba(245,247,250,0.58))",
            shadow: "0 10px 28px rgba(0,0,0,0.45)",
            playButtonBg: "rgba(255,255,255,0.12)",
            playButtonHover: "rgba(255,255,255,0.2)",
            cardBorder: "rgba(255,255,255,0.18)",
          }
        : {
            bg: "var(--openai-surface-background, #f7f7f8)",
            surface: "var(--openai-surface-primary, #ffffff)",
            border: "var(--openai-border-subtle, rgba(0,0,0,0.12))",
            text: "var(--openai-text-primary, #111827)",
            textMuted: "var(--openai-text-secondary, rgba(17,24,39,0.78))",
            textSubtle: "var(--openai-text-tertiary, rgba(17,24,39,0.62))",
            shadow: "0 8px 24px rgba(15,23,42,0.14)",
            playButtonBg: "rgba(15,23,42,0.08)",
            playButtonHover: "rgba(15,23,42,0.14)",
            cardBorder: "rgba(15,23,42,0.16)",
          },
    [isDark]
  );

  const session = useVideoSession({
    containerRef,
    initialFormat: format,
    duration,
  });

  // Compile template code
  useEffect(() => {
    if (code) session.compile(code);
  }, [code]);

  // Auto-play once ready
  useEffect(() => {
    if (isFullscreen && session.ready && !session.isPlaying) {
      session.play();
    }
  }, [isFullscreen, session.isPlaying, session.ready]);

  // Keep inline/PiP card preview static and lightweight
  useEffect(() => {
    if (!isFullscreen && session.isPlaying) {
      session.pause();
    }
  }, [isFullscreen, session.isPlaying]);

  const handleExport = useCallback(async () => {
    const blob = await session.exportMp4();
    if (!blob) return;

    const filename = `${title.toLowerCase().replace(/\s+/g, "-")}.mp4`;
    session.download(blob, filename);
    sendMessage(
      `Exported "${title}" as MP4. Suggest 2 concise follow-up edits I can make next (for example pacing, colors, or typography).`
    );
  }, [sendMessage, session, title]);

  const handleOpenEditor = useCallback(() => {
    requestDisplayMode("fullscreen");
  }, [requestDisplayMode]);

  useEffect(() => {
    const errorMessage = session.error?.message?.trim();
    if (!errorMessage || errorMessage === hasSentErrorRef.current) return;
    hasSentErrorRef.current = errorMessage;
    sendMessage(
      `The SuperImg widget failed to compile/render with this error:\n${errorMessage}\nPlease provide a fixed template and briefly explain the root cause.`
    );
  }, [sendMessage, session.error]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-[220px] flex-col items-center justify-center"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        }}
      >
        <div
          className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-indigo-500"
          style={{ borderColor: colors.border, borderTopColor: "#6366f1" }}
        />
        <p className="text-sm" style={{ color: colors.textMuted }}>
          Generating video template...
        </p>
      </div>
    );
  }

  if (isInline) {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-3"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
          color: colors.text,
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-xs" style={{ color: colors.textSubtle }}>
              {session.width}x{session.height} · {session.fps}fps · {duration}s
            </p>
          </div>
          <span
            className="rounded px-2 py-0.5 text-xs"
            style={{
              backgroundColor: session.error
                ? "rgba(239,68,68,0.14)"
                : session.ready
                  ? "rgba(34,197,94,0.14)"
                  : "rgba(245,158,11,0.14)",
              color: session.error
                ? "#dc2626"
                : session.ready
                  ? "#16a34a"
                  : "#b45309",
            }}
          >
            {session.error ? "Error" : session.status}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border" style={{ borderColor: colors.border }}>
          <div className="aspect-video w-full" ref={containerRef} />
        </div>

        <button
          onClick={handleOpenEditor}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Open Editor
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-col"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        height: isChatGptApp ? "100dvh" : "100vh",
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderColor: colors.border }}
      >
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2 text-xs" style={{ color: colors.textSubtle }}>
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
          className="max-h-full max-w-full"
          aria-label={`${title} video preview`}
          style={{
            boxShadow: colors.shadow,
            width: "100%",
            height: "100%",
            aspectRatio: "16/9",
          }}
        />
      </div>

      {/* Timeline */}
      <div className="border-t px-4 py-3" style={{ borderColor: colors.border }}>
        <Timeline store={session.store} className="h-2 rounded" showTime />
      </div>

      {/* Controls */}
      <div
        className="flex items-center gap-3 border-t px-4 py-3"
        style={{
          borderColor: colors.border,
          paddingBottom: isChatGptApp ? 12 + safeBottom : 12,
        }}
      >
        <button
          onClick={() => session.togglePlayPause()}
          disabled={session.exporting}
          className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          style={{ backgroundColor: colors.playButtonBg }}
          aria-label={session.isPlaying ? "Pause video preview" : "Play video preview"}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = colors.playButtonHover;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = colors.playButtonBg;
          }}
        >
          {session.isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={handleExport}
          disabled={session.exporting || !session.template}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          aria-label="Export video as MP4"
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
        <div
          className="border-t px-4 py-2 text-center text-xs"
          style={{ borderColor: colors.border, color: colors.textSubtle }}
        >
          MCP endpoint: <code>/mcp</code> · Connect via ChatGPT Settings →
          Connectors
        </div>
      )}
    </div>
  );
}
