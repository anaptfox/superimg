"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { Player, type PlayerRef } from "superimg/react";
import { usePlaygroundExport } from "superimg/react/export";
import {
  timelineTemplate,
  calculateTimelineDuration,
  type TimelineData,
} from "@/lib/template";

const SUGGESTIONS = [
  "History of JavaScript",
  "SpaceX milestones",
  "The evolution of smartphones",
  "Major AI breakthroughs",
  "Bitcoin price history",
];

export default function Page() {
  const playerRef = useRef<PlayerRef>(null);
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [videoData, setVideoData] = useState<TimelineData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const duration = useMemo(
    () =>
      videoData
        ? calculateTimelineDuration(videoData.events.length)
        : undefined,
    [videoData],
  );

  const { exporting, exportProgress, exportMp4, download } = usePlaygroundExport({
    template: timelineTemplate,
    data: videoData ?? undefined,
    duration,
  });

  const generate = useCallback(async (inputTopic: string) => {
    const trimmed = inputTopic.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: TimelineData = await res.json();
      setVideoData(data);
      playerRef.current?.update({
        data,
        duration: calculateTimelineDuration(data.events.length),
      });
      playerRef.current?.play();
      setIsPlaying(true);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generate(topic);
  };

  const handleExport = async () => {
    if (exporting) return;
    const blob = await exportMp4();
    if (blob) {
      const filename = `${topic.slice(0, 40).replace(/\s+/g, "-").toLowerCase()}-timeline.mp4`;
      download(blob, filename);
    }
  };

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
          SuperImg <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>× AI SDK</span>
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
          gap: 40,
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
              Get a video.
            </span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", margin: 0, fontSize: 16 }}>
            AI generates the timeline. SuperImg renders every frame.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The rise of AI in 2025"
              disabled={status === "loading"}
              style={{
                flex: 1,
                padding: "12px 16px",
                fontSize: 15,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#fafafa",
                outline: "none",
                opacity: status === "loading" ? 0.6 : 1,
              }}
            />
            <button
              type="submit"
              disabled={!topic.trim() || status === "loading"}
              style={{
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                background: status === "loading" ? "rgba(255,255,255,0.1)" : "white",
                color: status === "loading" ? "rgba(255,255,255,0.4)" : "#09090b",
                border: "none",
                borderRadius: 10,
                cursor: status === "loading" || !topic.trim() ? "not-allowed" : "pointer",
                minWidth: 100,
                transition: "opacity 0.15s",
              }}
            >
              {status === "loading" ? "Generating…" : "Generate"}
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
                disabled={status === "loading"}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  color: "rgba(255,255,255,0.55)",
                  cursor: status === "loading" ? "not-allowed" : "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {status === "error" && (
            <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>
              {errorMsg}. Is Ollama running? Try: <code>ollama serve</code>
            </p>
          )}
        </form>

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
                  Enter a topic above to generate your video
                </p>
              </div>
            )}

            {status === "loading" && (
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
                  AI is generating your video data…
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
              {status === "ready" && videoData ? `"${videoData.title}"` : "No video yet"}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {status === "ready" && (
                <>
                  <button
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
                    {exporting
                      ? `Exporting ${Math.round((exportProgress ?? 0) * 100)}%…`
                      : "Download MP4"}
                  </button>
                </>
              )}
            </div>
          </div>
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
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            How it works
          </p>
          <div style={{ display: "flex", gap: 0, flexDirection: "column" }}>
            {[
              ["1", "You type a topic"],
              ["2", "AI SDK generates structured JSON (title, events, accent color)"],
              ["3", "SuperImg Player renders every frame in your browser — 30fps"],
              ["4", "Click Download MP4 to export headlessly to a file"],
            ].map(([n, text]) => (
              <div key={n} style={{ display: "flex", gap: 12, padding: "6px 0", alignItems: "flex-start" }}>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700, minWidth: 16, marginTop: 1 }}>{n}</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}