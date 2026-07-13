// Karaoke Example — canonical ctx.track() transcript sync
// Demonstrates: ctx.track(), charProgress(), between(), and ctx.director() choreography.

import { define } from "superimg";

const sampleTranscript = [
  { text: "Welcome", start: 0.0, end: 0.4, type: "word" },
  { text: "to", start: 0.45, end: 0.55, type: "word" },
  { text: "the", start: 0.6, end: 0.7, type: "word" },
  { text: "future", start: 0.75, end: 1.1, type: "word" },
  { text: "of", start: 1.15, end: 1.25, type: "word" },
  { text: "video", start: 1.3, end: 1.7, type: "word" },
  { text: "generation", start: 1.75, end: 2.4, type: "word" },
];

export default define({
  sample: {
    transcript: sampleTranscript,
    accentColor: "#00d4ff",
    bgColor: "#0a0a1a",
  },

  config: {
    fps: 30,
    duration: "4s",
    fonts: ["Space+Grotesk:wght@400;700"],
    outputs: {
      landscape: { width: 1920, height: 1080 },
      square: { width: 1080, height: 1080 },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { overflow: hidden; }
      .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 60px;
      }
      .caption {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
      }
      .word { transition: transform 0.1s ease-out; }
      .char { display: inline-block; }
      .label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 2px;
        opacity: 0.5;
      }
      .phrase-box {
        padding: 20px 40px;
        border-radius: 12px;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
      }
    `],
  },

  render(ctx) {
    const { std, timeline, width, height, track, data } = ctx;
    const { transcript: rawTranscript, accentColor, bgColor } = data;

    const t = ctx.director({ enter: "0.6s", captions: "2.8s", exit: "0.6s" });
    const panel = t.motion({
      during: "enter",
      y: 24,
      exit: { y: -24 },
      exitEasing: "easeInCubic",
    });

    const words = (rawTranscript as typeof sampleTranscript)
      .filter((w) => !w.type || w.type === "word")
      .map((w) => ({ text: w.text, start: w.start, end: w.end }));

    const vo = track({ words });
    const transcript = vo.transcript();

    const wordCaptions = transcript.map((word) => {
      const scale = word.active ? 1.1 : 1;
      const opacity = word.progress > 0 ? 1 : 0.3;
      const color = word.active ? accentColor : "white";
      const y = word.active ? -4 : 0;

      return `<span class="word" style="${std.css({
        color,
        opacity,
        transform: `scale(${scale}) translateY(${y}px)`,
      })}">${word.text}</span>`;
    }).join("");

    const currentWord = transcript.current();
    let karaokeHtml = "";

    if (currentWord) {
      const charProg = transcript.charProgress();
      const fullChars = Math.floor(charProg);
      const partialChar = charProg - fullChars;

      karaokeHtml = currentWord.text.split("").map((char, i) => {
        let charColor: string;
        let charOpacity: number;

        if (i < fullChars) {
          charColor = accentColor;
          charOpacity = 1;
        } else if (i === fullChars) {
          charColor = std.color.mix(accentColor, "white", partialChar);
          charOpacity = 0.5 + (0.5 * partialChar);
        } else {
          charColor = "white";
          charOpacity = 0.3;
        }

        return `<span class="char" style="${std.css({
          color: charColor,
          opacity: charOpacity,
        })}">${char}</span>`;
      }).join("");
    } else {
      karaokeHtml = `<span style="opacity: 0.3">...</span>`;
    }

    const phrase = t.between(0, 3);
    const phraseOpacity = std.interpolate(phrase.progress, [0, 1], [0.2, 1], "easeOutCubic");
    const phraseBg = std.color.alpha(accentColor, 0.1 + (0.1 * phrase.progress));
    const phraseScale = std.interpolate(phrase.progress, [0, 1], [0.95, 1], "easeOutCubic");

    const containerStyle = std.css({
      width,
      height,
      background: bgColor,
    }, std.css.center());

    return `
      <div style="${containerStyle}">
        <div class="container" style="${panel.style}">
          <div>
            <div class="label" style="color: white; margin-bottom: 16px;">
              Word Highlighting · ${timeline.seconds.toFixed(2)}s
            </div>
            <div class="caption" style="font-size: 48px;">
              ${wordCaptions}
            </div>
          </div>

          <div>
            <div class="label" style="color: white; margin-bottom: 16px;">
              Character Progress: ${t.charProgress().toFixed(1)}
            </div>
            <div class="caption" style="font-size: 72px;">
              ${karaokeHtml}
            </div>
          </div>

          <div>
            <div class="label" style="color: white; margin-bottom: 16px;">
              Phrase Progress: ${(phrase.progress * 100).toFixed(0)}%
            </div>
            <div class="phrase-box" style="${std.css({
              background: phraseBg,
              opacity: phraseOpacity,
              transform: `scale(${phraseScale})`,
              fontSize: 32,
              color: "white",
            })}">
              ${phrase.text}
            </div>
          </div>
        </div>
      </div>
    `;
  },
});
