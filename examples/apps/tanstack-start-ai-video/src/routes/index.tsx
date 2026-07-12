import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { clientTools, createChatClientOptions } from "@tanstack/ai-client";
import { Player, type PlayerRef } from "superimg/react";
import { TimelineSchema, type ProviderId, type TimelineData } from "#/lib/ai/schema";
import { previewAccentDef } from "#/lib/ai/tools";
import {
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  PROVIDER_OPTIONS,
} from "#/lib/ai/providers.shared";
import {
  timelineTemplate,
  calculateTimelineDuration,
} from "#/lib/template";
import { StreamingTimeline } from "#/components/StreamingTimeline";
import { ChatStream } from "#/components/ChatStream";

const SUGGESTIONS = [
  "History of JavaScript",
  "SpaceX milestones",
  "The evolution of smartphones",
  "Major AI breakthroughs",
  "Bitcoin price history",
];

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const playerRef = useRef<PlayerRef>(null);
  const [topic, setTopic] = useState("");
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [model, setModel] = useState(DEFAULT_MODELS[DEFAULT_PROVIDER]);
  const [accentPreview, setAccentPreview] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<TimelineData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const previewAccent = useMemo(
    () =>
      previewAccentDef.client((input) => {
        setAccentPreview(input.color);
        return { applied: true };
      }),
    [],
  );

  const tools = useMemo(() => clientTools(previewAccent), [previewAccent]);

  const chatOptions = useMemo(
    () =>
      createChatClientOptions({
        connection: fetchServerSentEvents("/api/chat"),
        tools,
        outputSchema: TimelineSchema,
        forwardedProps: { provider, model },
      }),
    [tools, provider, model],
  );

  const {
    messages,
    sendMessage,
    isLoading,
    error,
    partial,
    final,
    addToolApprovalResponse,
    clear,
  } = useChat(chatOptions);

  const duration = useMemo(
    () =>
      videoData ? calculateTimelineDuration(videoData.events.length) : undefined,
    [videoData],
  );

  useEffect(() => {
    if (!final) return;
    setVideoData(final);
    playerRef.current?.update({
      data: final,
      duration: calculateTimelineDuration(final.events.length),
    });
    playerRef.current?.play();
    setIsPlaying(true);
  }, [final]);

  const generate = useCallback(
    async (inputTopic: string) => {
      const trimmed = inputTopic.trim();
      if (!trimmed || isLoading) return;

      setAccentPreview(null);
      setVideoData(null);
      clear();

      await sendMessage(
        `Create an accurate chronological video timeline about: "${trimmed}". ` +
          `Use enrich_topic first, then preview_accent if helpful, then return structured timeline data.`,
      );
    },
    [clear, isLoading, sendMessage],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generate(topic);
  };

  const handleProviderChange = (next: ProviderId) => {
    setProvider(next);
    setModel(DEFAULT_MODELS[next]);
  };

  const handleExport = async () => {
    if (exporting || !videoData) return;
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: videoData }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const slug = (videoData.title || topic).slice(0, 40).replace(/\s+/g, "-").toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-timeline.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const status = isLoading ? "loading" : final ? "ready" : messages.length > 0 ? "streaming" : "idle";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>
          SuperImg{" "}
          <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
            × TanStack AI
          </span>
        </span>
        <a
          href="https://github.com/anaptfox/superimg"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}
        >
          GitHub →
        </a>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 24px",
          gap: 32,
          maxWidth: 960,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 52px)",
              fontWeight: 800,
              letterSpacing: "-2px",
              margin: "0 0 12px",
              lineHeight: 1.1,
            }}
          >
            Type a topic.
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #667eea, #a855f7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Stream a video.
            </span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", margin: 0, fontSize: 16 }}>
            TanStack AI + AG-UI SSE · structured output · tool approval · SuperImg Player
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
              disabled={isLoading}
              style={{
                padding: "10px 12px",
                fontSize: 13,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#fafafa",
              }}
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isLoading}
              style={{
                flex: 1,
                minWidth: 140,
                padding: "10px 12px",
                fontSize: 13,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#fafafa",
              }}
            >
              {(PROVIDER_OPTIONS.find((o) => o.id === provider)?.models ?? [model]).map(
                (m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ),
              )}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The rise of AI in 2025"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "12px 16px",
                fontSize: 15,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#fafafa",
                outline: "none",
                opacity: isLoading ? 0.6 : 1,
              }}
            />
            <button
              type="submit"
              disabled={!topic.trim() || isLoading}
              style={{
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                background: isLoading ? "rgba(255,255,255,0.1)" : "white",
                color: isLoading ? "rgba(255,255,255,0.4)" : "#09090b",
                border: "none",
                borderRadius: 10,
                cursor: isLoading || !topic.trim() ? "not-allowed" : "pointer",
                minWidth: 100,
              }}
            >
              {isLoading ? "Streaming…" : "Generate"}
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTopic(s);
                  generate(s);
                }}
                disabled={isLoading}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  color: "rgba(255,255,255,0.55)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>
              {error.message}. Is Ollama running? Try: <code>ollama serve</code>
            </p>
          )}
        </form>

        <div
          style={{
            width: "100%",
            maxWidth: 640,
            padding: "16px 18px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>
            AGENT STREAM
          </div>
          <ChatStream
            messages={messages}
            onApprove={(id) => addToolApprovalResponse({ id, approved: true })}
            onDeny={(id) => addToolApprovalResponse({ id, approved: false })}
          />
          <StreamingTimeline partial={partial} final={final} accentPreview={accentPreview} />
        </div>

        <div
          style={{
            width: "100%",
            background: "#0d0d0d",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16/9",
              background: "#0a0a14",
            }}
          >
            {status === "idle" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  background: "rgba(0,0,0,0.6)",
                  zIndex: 10,
                }}
              >
                <div style={{ fontSize: 40 }}>▶</div>
                <p style={{ color: "rgba(255,255,255,0.4)", margin: 0, fontSize: 14 }}>
                  Enter a topic — approve research, watch fields stream in
                </p>
              </div>
            )}

            {status === "loading" && !final && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  background: "rgba(0,0,0,0.7)",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid rgba(255,255,255,0.15)",
                    borderTop: "3px solid white",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <p style={{ color: "rgba(255,255,255,0.5)", margin: 0, fontSize: 14 }}>
                  {partial.title ? "Streaming timeline…" : "Waiting for structured output…"}
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            <Player
              ref={playerRef}
              template={timelineTemplate}
              data={videoData ?? undefined}
              duration={duration}
              format="horizontal"
              playbackMode="loop"
              loadMode="eager"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              {final ? `"${final.title}"` : videoData ? `"${videoData.title}"` : "No video yet"}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {final && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      isPlaying ? playerRef.current?.pause() : playerRef.current?.play()
                    }
                    style={{
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 500,
                      background: "rgba(255,255,255,0.08)",
                      border: "none",
                      borderRadius: 6,
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting}
                    style={{
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: exporting ? "rgba(255,255,255,0.1)" : "white",
                      color: exporting ? "rgba(255,255,255,0.4)" : "#09090b",
                      border: "none",
                      borderRadius: 6,
                      cursor: exporting ? "not-allowed" : "pointer",
                    }}
                  >
                    {exporting ? "Exporting…" : "Download MP4"}
                  </button>
                </>
              )}
            </div>
          </div>
          {exportError && (
            <p style={{ color: "#f87171", fontSize: 12, margin: "0 16px 12px" }}>{exportError}</p>
          )}
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 640,
            padding: "20px 24px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            How it works
          </p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              ["1", "useChat streams AG-UI SSE from /api/chat (no hosted gateway)"],
              ["2", "Server tool enrich_topic pauses for approval; client tool preview_accent updates UI"],
              ["3", "Structured output (TimelineSchema) streams into partial → final"],
              ["4", "SuperImg Player renders frames in the browser; Download MP4 renders server-side"],
            ].map(([n, text]) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "6px 0",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 16,
                    marginTop: 1,
                  }}
                >
                  {n}
                </span>
                <span
                  style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5 }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}