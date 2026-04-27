import { defineScene } from "superimg";

interface QuoteChunk {
  text: string;
  highlights: string[];
}

export default defineScene({
  data: {
    question: "Why do you love Techlahoma?",
    quote: `I love Techlahoma because it creates real opportunities for connection, growth, and giving back. As a Techlahoma Ambassador, I've seen firsthand how this community uplifts individuals at every stage of their tech journey and brings resources to places, like my rural hometown, that might otherwise be overlooked.`,
    quoteChunks: [
      { text: `"I love Techlahoma because it creates real opportunities for CONNECTION, GROWTH, and GIVING BACK."`, highlights: ["CONNECTION", "GROWTH", "GIVING BACK"] },
      { text: `"As a TECHLAHOMA AMBASSADOR, I've seen firsthand how this community UPLIFTS individuals at every stage of their tech journey..."`, highlights: ["TECHLAHOMA AMBASSADOR", "UPLIFTS"] },
      { text: `"...and brings resources to places, like MY RURAL HOMETOWN, that might otherwise be OVERLOOKED."`, highlights: ["MY RURAL HOMETOWN", "OVERLOOKED"] },
    ] as QuoteChunk[],
    closingQuote: `"I love Techlahoma."`,
    name: "Leslie",
    title: "Web Developer",
    photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
    techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png",
    brandColor: "#FFD700",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 22,
    fonts: ["Inter:wght@400;500;600;700;800"],
    audio: { src: "../../_assets/lofi-bg.mp3", volume: 0.5, fadeIn: 0.5, fadeOut: 2, loop: true },
    outputs: {
      landscape: { width: 1920, height: 1080 },
      square: { width: 1080, height: 1080 },
      story: { width: 1080, height: 1920 },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, width, height, data, isPortrait } = ctx;
    const { question, quoteChunks, closingQuote, name, title, photoUrl, techlahomaSvg, brandColor } = data;

    const r = std.createResponsive(ctx);

    // Phases: Intro | Chunks (Content) | Outro
    const t = std.score({
      intro: 0.1,    // 2.2s
      content: 0.75, // 16.5s
      outro: 0.15    // 3.3s
    });

    // Diagonal wipe (first 1.5s)
    const wipeEased = t.within("intro", { at: 0, duration: 0.7 });
    const wipeOffset = std.interpolate(wipeEased, [0, 1], [-50, 100], "easeInOutCubic");

    // Header + photo animations
    const headerAnim = t.motion({ at: 0.6, duration: 0.4, exit: false });
    const photoAnim = t.motion({ at: 0.7, duration: 0.5, scale: 0.2 });
    const footerAnim = t.motion({ at: 0.8, duration: 0.5 });

    // Closing animation
    const closingAnim = t.motion({ during: "outro", y: 30 });

    const highlightText = (text: string, highlights: string[]) => {
      let result = text;
      highlights.forEach(h => { result = result.replace(h, `<span style="color: ${brandColor}; font-weight: 700;">${h}</span>`); });
      return result;
    };

    const renderQuoteChunk = () => {
      if (t.active === "intro") return "";
      if (t.active === "outro") {
        return `<div style="${std.css({ fontSize: r({ portrait: 48, square: 36, default: 42 }), fontWeight: 700, color: "#fff", textAlign: "center" })}; ${closingAnim.style}">${closingQuote}</div>`;
      }
      
      const chunkIndex = Math.floor(t.within("content") * quoteChunks.length);
      const chunk = quoteChunks[chunkIndex];
      const localP = (t.within("content") * quoteChunks.length) % 1;
      
      const fadeIn = std.clamp01(localP * 4);
      const fadeOut = std.clamp01((localP - 0.85) * 6.67);
      const opacity = std.interpolate(fadeIn, [0, 1], [0, 1], "easeOutCubic") * (1 - std.interpolate(fadeOut, [0, 1], [0, 1], "easeInCubic"));
      const y = std.interpolate(fadeIn, [0, 1], [20, 0], "easeOutCubic");

      return `<div style="${std.css({ fontSize: r({ portrait: 32, square: 24, default: 28 }), fontWeight: 500, color: "#fff", lineHeight: 1.5, opacity, transform: `translateY(${y}px)`, maxWidth: r({ portrait: "100%", default: "65%" }) })}">${highlightText(chunk.text, chunk.highlights)}</div>`;
    };

    const photoSize = r({ portrait: 200, square: 160, default: 180 });
    const padding = r({ portrait: 48, default: 60 });
    const photoPosition = isPortrait
      ? { bottom: "25%", right: "50%", transform: `translateX(50%)` }
      : { bottom: r({ square: "15%", default: "12%" }), right: r({ square: "10%", default: "8%" }) };

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden", background: "#000" })}">
        ${t.within("intro") < 1 ? `<div style="${std.css({ position: "absolute", inset: 0, background: brandColor, clipPath: `polygon(0 0, ${wipeOffset + 50}% 0, ${wipeOffset}% 100%, 0 100%)`, zIndex: 10 })}"></div>` : ""}

        <!-- Yellow diagonal footer -->
        <div style="${std.css({ position: "absolute", bottom: 0, left: 0, right: 0, height: r({ portrait: "18%", default: "15%" }), background: brandColor, clipPath: "polygon(0 40%, 100% 0, 100% 100%, 0 100%)", zIndex: 2 })}; ${footerAnim.style}">
          <div style="${std.css({ position: "absolute", bottom: r({ portrait: 40, default: 30 }), left: padding, display: "flex", alignItems: "center", gap: 20 })}">
            <img src="${techlahomaSvg}" style="${std.css({ height: r({ portrait: 36, default: 28 }), filter: "brightness(0)" })}" />
          </div>
          <div style="${std.css({ position: "absolute", bottom: r({ portrait: 40, default: 30 }), right: padding, fontSize: r({ portrait: 24, square: 20, default: 22 }), fontWeight: 600, color: "#000" })}">${name}, ${title}</div>
        </div>

        <!-- Question header -->
        <div style="${std.css({ position: "absolute", top: r({ portrait: 80, default: 60 }), left: padding })}; ${headerAnim.style}">
          <div style="${std.css({ fontSize: r({ portrait: 36, square: 28, default: 32 }), fontWeight: 700, color: brandColor, marginBottom: 8 })}">${question}</div>
          <div style="${std.css({ width: `${headerAnim.enter * 100}%`, maxWidth: 300, height: 3, background: "#fff" })}"></div>
        </div>

        <!-- Photo -->
        <div style="${std.css({ position: "absolute", ...photoPosition, width: photoSize, height: photoSize, borderRadius: "50%", overflow: "hidden", border: `4px solid ${brandColor}`, zIndex: 3 })}; ${photoAnim.style}">
          <img src="${photoUrl}" style="${std.css({ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(100%)" })}" />
        </div>

        <!-- Quote area -->
        <div style="${std.css({ position: "absolute", top: r({ portrait: "15%", default: "20%" }), left: padding, right: isPortrait ? padding : photoSize + padding + 40, display: "flex", flexDirection: "column", justifyContent: "center", height: r({ portrait: "40%", default: "50%" }), textAlign: isPortrait ? "center" : "left" })}">
          ${renderQuoteChunk()}
        </div>
      </div>
    `;
  },
});
