"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { Player, type PlayerRef } from "superimg/react";
import {
  karaokeTemplate,
  calculateKaraokeDuration,
  type KaraokeData,
} from "@/lib/template";

type Format = "horizontal" | "vertical" | "square";
type Status = "idle" | "loading" | "ready" | "error";

const ASPECT: Record<Format, string> = {
  horizontal: "16/9",
  vertical: "9/16",
  square: "1/1",
};

const DEFAULT_WPM = 128;
const DEFAULT_MAX_WORDS = 140;

export default function Page() {
  const playerRef = useRef<PlayerRef>(null);
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("vertical");
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [maxWords, setMaxWords] = useState(DEFAULT_MAX_WORDS);
  const [status, setStatus] = useState<Status>("idle");
  const [videoData, setVideoData] = useState<KaraokeData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const duration = useMemo(
    () => (videoData ? calculateKaraokeDuration(videoData) : undefined),
    [videoData],
  );

  const generate = useCallback(
    async (input: { url?: string; useFixture?: boolean }) => {
      if (!input.useFixture && !input.url?.trim()) return;

      setStatus("loading");
      setErrorMsg("");

      try {
        const res = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: input.url?.trim(),
            useFixture: input.useFixture,
            wpm,
            maxWords,
          }),
        });

        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? `API error: ${res.status}`);

        const data = payload as KaraokeData;
        setVideoData(data);
        playerRef.current?.update({
          data,
          duration: calculateKaraokeDuration(data),
          format,
        });
        playerRef.current?.play();
        setIsPlaying(true);
        setStatus("ready");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
        setStatus("error");
      }
    },
    [format, maxWords, wpm],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generate({ url });
  };

  const handleExport = async () => {
    if (exporting || !videoData) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: videoData, format }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const slug = videoData.title
        .slice(0, 40)
        .replace(/\s+/g, "-")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug || "blog"}-readalong.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Export failed");
      setStatus("error");
    } finally {
      setExporting(false);
    }
  };

  const handleFormatChange = (next: Format) => {
    setFormat(next);
    playerRef.current?.update({ format: next });
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
          SuperImg <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>Blog → Video</span>
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
            Paste a blog URL.
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #F8D84A, #FFE86B)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Get a read-along video.
            </span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", margin: 0, fontSize: 16 }}>
            Scrape the article, estimate word timings, preview live, export MP4.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/blog/your-post"
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
              disabled={!url.trim() || status === "loading"}
              style={{
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                background: status === "loading" ? "rgba(255,255,255,0.1)" : "white",
                color: status === "loading" ? "rgba(255,255,255,0.4)" : "#09090b",
                border: "none",
                borderRadius: 10,
                cursor: status === "loading" || !url.trim() ? "not-allowed" : "pointer",
                minWidth: 100,
              }}
            >
              {status === "loading" ? "Scraping…" : "Generate"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Format
              <select
                value={format}
                onChange={(e) => handleFormatChange(e.target.value as Format)}
                disabled={status === "loading"}
                style={{
                  padding: "8px 10px",
                  fontSize: 13,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  color: "#fafafa",
                }}
              >
                <option value="vertical">Vertical (9:16)</option>
                <option value="horizontal">Horizontal (16:9)</option>
                <option value="square">Square (1:1)</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Reading speed ({wpm} wpm)
              <input
                type="range"
                min={90}
                max={180}
                value={wpm}
                onChange={(e) => setWpm(Number(e.target.value))}
                disabled={status === "loading"}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Max words ({maxWords})
              <input
                type="range"
                min={40}
                max={420}
                step={10}
                value={maxWords}
                onChange={(e) => setMaxWords(Number(e.target.value))}
                disabled={status === "loading"}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => generate({ useFixture: true })}
            disabled={status === "loading"}
            style={{
              alignSelf: "flex-start",
              padding: "5px 12px",
              fontSize: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              color: "rgba(255,255,255,0.55)",
              cursor: status === "loading" ? "not-allowed" : "pointer",
            }}
          >
            Try sample text (offline)
          </button>

          {status === "error" && (
            <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{errorMsg}</p>
          )}
        </form>

        <div
          style={{
            width: "100%",
            maxWidth: format === "vertical" ? 360 : 640,
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
              aspectRatio: ASPECT[format],
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
                <p style={{ color: "rgba(255,255,255,0.4)", margin: 0, fontSize: 14, textAlign: "center", padding: "0 24px" }}>
                  Paste a blog URL or try the sample text
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
                  Fetching article and building timings…
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            <Player
              ref={playerRef}
              template={karaokeTemplate}
              data={videoData ?? undefined}
              duration={duration}
              format={format}
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
              {status === "ready" && videoData
                ? `"${videoData.title}" · ${videoData.words.length} words`
                : "No video yet"}
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
                      background: exporting ? "rgba(255,255,255,0.1)" : "#F8D84A",
                      color: exporting ? "rgba(255,255,255,0.4)" : "#09090b",
                      border: "none",
                      borderRadius: 6,
                      cursor: exporting ? "not-allowed" : "pointer",
                    }}
                  >
                    {exporting
                      ? "Exporting…"
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
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              ["1", "Paste a blog URL — the server fetches and extracts readable text (Mozilla Readability)"],
              ["2", "Word timings are estimated from your WPM setting and punctuation pauses"],
              ["3", "SuperImg Player renders the karaoke read-along live in your browser"],
              ["4", "Download MP4 renders server-side with Playwright and streams back the file"],
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