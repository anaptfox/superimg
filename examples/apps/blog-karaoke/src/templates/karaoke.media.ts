import { define } from "superimg";

interface TimedWord {
  text: string;
  start: number;
  end: number;
  sentenceIndex: number;
}

interface KaraokeData {
  title: string;
  source: string;
  words: TimedWord[];
  duration: number;
  wpm: number;
}

interface WordChunk {
  words: TimedWord[];
  startIndex: number;
  start: number;
  end: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default define({
  sample: {
    title: "Automating blog read-alongs",
    source: "sample.txt",
    duration: 10,
    wpm: 165,
    words: [
      { text: "Turn", start: 0.8, end: 1.1, sentenceIndex: 0 },
      { text: "blog", start: 1.1, end: 1.4, sentenceIndex: 0 },
      { text: "posts", start: 1.4, end: 1.8, sentenceIndex: 0 },
      { text: "into", start: 1.8, end: 2.1, sentenceIndex: 0 },
      { text: "read-along", start: 2.1, end: 2.8, sentenceIndex: 0 },
      { text: "videos.", start: 2.8, end: 3.3, sentenceIndex: 0 },
    ],
  } satisfies KaraokeData,

  config: {
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 10,
    fonts: ["Atkinson Hyperlegible:wght@400;700;800", "Inter:wght@500;600;700;800;900"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Atkinson Hyperlegible', 'Inter', sans-serif; overflow: hidden; background: #0B0D0D; }
    `],
  },

  render(ctx) {
    const { std, width, height, data, timeline, isPortrait } = ctx;
    const karaoke = data as KaraokeData;
    const words = karaoke.words ?? [];
    const r = std.createResponsive(ctx);

    const chunks = buildChunks(words, isPortrait ? 4 : 5);
    const activeChunkIndex = Math.max(
      0,
      chunks.findIndex((chunk, index) => {
        const next = chunks[index + 1];
        return timeline.seconds >= chunk.start && timeline.seconds < (next?.start ?? chunk.end + 0.35);
      }),
    );

    const safeChunkIndex = activeChunkIndex === -1 ? 0 : Math.min(activeChunkIndex, Math.max(0, chunks.length - 1));
    const activeChunk = chunks[safeChunkIndex];
    const safeIndex = activeChunk?.startIndex ?? 0;
    const chunkProgress = activeChunk
      ? std.math.clamp((timeline.seconds - activeChunk.start) / Math.max(0.01, activeChunk.end - activeChunk.start), 0, 1)
      : 0;

    const visibleCount = isPortrait ? 9 : 12;
    const start = Math.max(0, safeChunkIndex - Math.floor(visibleCount * 0.42));
    const end = Math.min(chunks.length, start + visibleCount);
    const visibleChunks = chunks.slice(start, end);

    const intro = std.interpolate(timeline.progress, [0, 0.08, 0.92, 1], [0, 1, 1, 0], "easeOutCubic");
    const progressPct = chunks.length > 1 ? safeChunkIndex / (chunks.length - 1) : timeline.progress;
    const sourceLabel = (() => {
      try {
        return new URL(karaoke.source).hostname.replace(/^www\./, "");
      } catch {
        return karaoke.source.split("/").pop() ?? karaoke.source;
      }
    })();

    const pad = r({ portrait: 72, square: 68, default: 86 }) as number;
    const titleSize = r({ portrait: 42, square: 34, default: 38 }) as number;
    const wordSize = r({ portrait: 56, square: 42, default: 48 }) as number;
    const activeSize = r({ portrait: 58, square: 44, default: 50 }) as number;
    const metaSize = r({ portrait: 24, square: 20, default: 22 }) as number;

    const paragraphHtml = visibleChunks
      .map((chunk, offset) => {
        const index = start + offset;
        const isActive = index === safeChunkIndex;
        const isPast = index < safeChunkIndex;
        const distance = Math.abs(index - safeChunkIndex);
        const opacity = isActive ? 1 : isPast ? 0.5 : Math.max(0.72, 0.98 - distance * 0.05);
        const color = isActive ? "#080A0A" : isPast ? "rgba(255,255,255,0.58)" : "#FFFFFF";
        const text = chunk.words.map((word) => word.text).join(" ");

        return `
          <span style="${std.css({
            position: "relative",
            display: "inline",
            maxWidth: "100%",
            padding: isActive ? "0.02em 0.16em 0.08em" : "0",
            borderRadius: isActive ? 10 : 6,
            background: isActive ? "#FFE86B" : "transparent",
            color,
            fontSize: isActive ? activeSize : wordSize,
            fontWeight: isActive ? 800 : isPast ? 700 : 800,
            lineHeight: 1.34,
            opacity,
            textShadow: isActive ? "none" : "0 2px 14px rgba(0,0,0,0.92), 0 0 2px rgba(0,0,0,0.9)",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            boxShadow: isActive ? "0 8px 34px rgba(255,232,107,0.22)" : "none",
          })}">
            ${isActive ? `<span style="${std.css({
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.round(chunkProgress * 100)}%`,
              background: "rgba(255,255,255,0.3)",
              borderRadius: 10,
            })}"></span>` : ""}
            <span style="position: relative;">${escapeHtml(text)}</span>
          </span>${offset === visibleChunks.length - 1 ? "" : " "}
        `;
      })
      .join("");

    return `
      <div style="${std.css({
        width,
        height,
        position: "relative",
        overflow: "hidden",
        color: "#F6F2E8",
        background: "linear-gradient(135deg, #0B0D0D 0%, #17201E 48%, #211E18 100%)",
        opacity: intro,
      })}">
        <div style="${std.css({
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(246,242,232,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(246,242,232,0.035) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          opacity: 0.7,
        })}"></div>

        <div style="${std.css({
          position: "absolute",
          left: pad,
          right: pad,
          top: pad,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 32,
        })}">
          <div style="${std.css({
            maxWidth: isPortrait ? "100%" : "68%",
          })}">
            <div style="${std.css({
              color: "rgba(246,242,232,0.58)",
              fontSize: metaSize,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              marginBottom: 16,
            })}">Read-along</div>
            <div style="${std.css({
              fontSize: titleSize,
              fontWeight: 850,
              lineHeight: 1.1,
              letterSpacing: 0,
            })}">${escapeHtml(karaoke.title)}</div>
          </div>
          <div style="${std.css({
            display: isPortrait ? "none" : "block",
            color: "rgba(246,242,232,0.56)",
            fontSize: metaSize,
            fontWeight: 700,
            textAlign: "right",
            maxWidth: 360,
            lineHeight: 1.35,
          })}">${escapeHtml(sourceLabel)}</div>
        </div>

        <div style="${std.css({
          position: "absolute",
          left: pad,
          right: pad,
          top: isPortrait ? height * 0.22 : height * 0.24,
          bottom: isPortrait ? 210 : 160,
          padding: isPortrait ? "48px 42px" : "42px 54px",
          borderRadius: 18,
          background: "rgba(3,5,5,0.56)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.38)",
          display: "block",
          textAlign: "left",
          transform: `translateY(${std.interpolate(chunkProgress, [0, 1], [6, -2], "easeOutCubic")}px)`,
        })}">
          <div style="${std.css({
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
          })}">
            <p style="${std.css({
              margin: 0,
              color: "#FFFFFF",
              fontSize: wordSize,
              fontWeight: 800,
              lineHeight: 1.34,
              letterSpacing: 0,
            })}">
              ${paragraphHtml}
            </p>
          </div>
        </div>

        <div style="${std.css({
          position: "absolute",
          left: pad,
          right: pad,
          bottom: pad,
        })}">
          <div style="${std.css({
            display: "flex",
            justifyContent: "space-between",
            color: "rgba(246,242,232,0.54)",
            fontSize: metaSize,
            fontWeight: 750,
            marginBottom: 18,
          })}">
            <span>${safeChunkIndex + 1}/${chunks.length}</span>
            <span>${karaoke.wpm} wpm</span>
          </div>
          <div style="${std.css({
            position: "relative",
            width: "100%",
            height: 10,
            borderRadius: 999,
            background: "rgba(246,242,232,0.14)",
            overflow: "hidden",
          })}">
            <div style="${std.css({
              width: `${Math.round(progressPct * 100)}%`,
              height: "100%",
              borderRadius: 999,
              background: "#F8D84A",
              boxShadow: "0 0 30px rgba(248,216,74,0.45)",
            })}"></div>
          </div>
        </div>
      </div>
    `;
  },
});

function buildChunks(words: TimedWord[], maxWords: number): WordChunk[] {
  const chunks: WordChunk[] = [];
  let current: TimedWord[] = [];
  let startIndex = 0;

  words.forEach((word, index) => {
    if (current.length === 0) startIndex = index;
    current.push(word);

    const endsSentence = /[.!?]$/.test(word.text);
    const strongPause = /[,;:]$/.test(word.text);
    const reachedLimit = current.length >= maxWords;
    const goodPhrase = current.length >= 3 && strongPause;

    if (endsSentence || reachedLimit || goodPhrase) {
      chunks.push({
        words: current,
        startIndex,
        start: current[0].start,
        end: current[current.length - 1].end,
      });
      current = [];
    }
  });

  if (current.length > 0) {
    chunks.push({
      words: current,
      startIndex,
      start: current[0].start,
      end: current[current.length - 1].end,
    });
  }

  return chunks;
}
