// Karaoke Example — Word-by-word and character-level text highlighting
// Demonstrates: transcript(), charProgress(), between(), fromElevenLabs adapter
// Great for lyric videos, captions, and speech-synced animations

import { defineScene } from "superimg";

// Sample transcript data (ElevenLabs format)
const sampleTranscript = [
  { text: "Welcome", start: 0.0, end: 0.4, type: "word" },
  { text: "to", start: 0.45, end: 0.55, type: "word" },
  { text: "the", start: 0.6, end: 0.7, type: "word" },
  { text: "future", start: 0.75, end: 1.1, type: "word" },
  { text: "of", start: 1.15, end: 1.25, type: "word" },
  { text: "video", start: 1.3, end: 1.7, type: "word" },
  { text: "generation", start: 1.75, end: 2.4, type: "word" },
];

export default defineScene({
  data: {
    transcript: sampleTranscript,
    accentColor: "#00d4ff",
    bgColor: "#0a0a1a",
  },

  config: {
    fps: 30,
    duration: 4,
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
      .word {
        transition: transform 0.1s ease-out;
      }
      .char {
        display: inline-block;
      }
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
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const { transcript: rawTranscript, accentColor, bgColor } = data;

    // Convert from ElevenLabs format and create sync
    const words = std.timeline.fromElevenLabs(rawTranscript);
    const t = std.timeline.transcript(words, time);

    // === Section 1: Word-level highlighting ===
    const wordCaptions = t.map((word, i) => {
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

    // === Section 2: Character-level karaoke ===
    const currentWord = t.current();
    let karaokeHtml = "";

    if (currentWord) {
      const charProg = t.charProgress();
      const fullChars = Math.floor(charProg);
      const partialChar = charProg - fullChars;

      karaokeHtml = currentWord.text.split("").map((char, i) => {
        let charColor: string;
        let charOpacity: number;

        if (i < fullChars) {
          // Fully highlighted
          charColor = accentColor;
          charOpacity = 1;
        } else if (i === fullChars) {
          // Currently being spoken (partial)
          charColor = std.color.mix(accentColor, "white", partialChar);
          charOpacity = 0.5 + (0.5 * partialChar);
        } else {
          // Not yet spoken
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

    // === Section 3: Phrase animation using between() ===
    const phrase = t.between(0, 3); // "Welcome to the future"
    const phraseOpacity = std.tween(0.2, 1, phrase.progress, "easeOutCubic");
    const phraseBg = std.color.alpha(accentColor, 0.1 + (0.1 * phrase.progress));
    const phraseScale = std.tween(0.95, 1, phrase.progress, "easeOutCubic");

    // Layout
    const containerStyle = std.css({
      width,
      height,
      background: bgColor,
    }, std.css.center());

    return `
      <div style="${containerStyle}">
        <div class="container">
          <!-- Word-level highlighting -->
          <div>
            <div class="label" style="color: white; margin-bottom: 16px;">
              Word Highlighting
            </div>
            <div class="caption" style="font-size: 48px;">
              ${wordCaptions}
            </div>
          </div>

          <!-- Character-level karaoke -->
          <div>
            <div class="label" style="color: white; margin-bottom: 16px;">
              Character Progress: ${t.charProgress().toFixed(1)}
            </div>
            <div class="caption" style="font-size: 72px;">
              ${karaokeHtml}
            </div>
          </div>

          <!-- Phrase animation with between() -->
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
