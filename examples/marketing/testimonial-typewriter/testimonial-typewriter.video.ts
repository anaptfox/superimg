import { defineScene } from "superimg";

export default defineScene({
  data: {
    question: "Why do you love Techlahoma?",
    quote: `I love Techlahoma because it creates real opportunities for connection, growth, and giving back. As a Techlahoma Ambassador, I've seen firsthand how this community uplifts individuals at every stage of their tech journey and brings resources to places, like my rural hometown, that might otherwise be overlooked.`,
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
    duration: 24,
    fonts: ["Inter:wght@400;500;600;700;800", "JetBrains+Mono:wght@400;500"],
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
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const { question, quote, name, title, photoUrl, techlahomaSvg, brandColor } = data;

    const r = std.createResponsive(ctx);

    // Timeline for a 24s scene
    const t = std.score({
      enter: 0.0625, // 1.5s
      hold: 0.875,   // 21s
      exit: 0.0625   // 1.5s
    });

    // Frame animation
    const frameAnim = t.motion({ scale: 0.2 });

    // Header animation (starts after frame enter)
    const headerAnim = t.motion({ at: 0.2, duration: 0.8 });

    // Photo + attribution (starts after header)
    const photoAnim = t.motion({ at: 0.4, duration: 0.8, x: 100 });
    const attrAnim = t.motion({ at: 0.5, duration: 0.6, exit: false });

    // Typewriter timing (manual progress over the hold phase)
    const typeStart = 4;
    const typeEnd = 20;
    const typeProgress = std.clamp01((time - typeStart) / (typeEnd - typeStart));
    const charsToShow = Math.floor(typeProgress * quote.length);
    const visibleText = `"${quote.substring(0, charsToShow)}`;
    const showCursor = time >= typeStart && time < typeEnd && Math.floor(time * 2) % 2 === 0;

    // Responsive sizing
    const borderWidth = r({ portrait: 16, default: 12 });
    const questionSize = r({ portrait: 32, square: 26, default: 28 });
    const quoteSize = r({ portrait: 26, square: 20, default: 24 });
    const nameSize = r({ portrait: 20, square: 16, default: 18 });
    const photoSize = r({ portrait: 140, square: 100, default: 120 });
    const padding = r({ portrait: 40, default: 48 });
    const innerPadding = r({ portrait: 32, default: 40 });
    const photoRight = r({ portrait: "50%", default: padding + innerPadding });
    const photoBottom = r({ portrait: padding + innerPadding + 80, default: padding + innerPadding });

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden", background: "#000", padding })}">
        <!-- Yellow border frame -->
        <div style="${std.css({ position: "absolute", inset: padding, border: `${borderWidth}px solid ${brandColor}`, borderRadius: 8 })};${frameAnim.style}"></div>

        <!-- Inner content area -->
        <div style="${std.css({ position: "absolute", top: padding + borderWidth + innerPadding, left: padding + borderWidth + innerPadding, right: padding + borderWidth + innerPadding, bottom: padding + borderWidth + innerPadding })}">
          <!-- Question header -->
          <div style="${std.css({ marginBottom: 24 })}; ${headerAnim.style}">
            <div style="${std.css({ fontSize: questionSize, fontWeight: 700, color: brandColor, marginBottom: 8 })}">${question}</div>
            <div style="${std.css({ width: 200, height: 2, background: "#fff" })}"></div>
          </div>

          <!-- Quote with typewriter effect -->
          <div style="${std.css({ fontSize: quoteSize, fontWeight: 400, color: "#fff", lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace", maxWidth: r({ portrait: "100%", default: `calc(100% - ${photoSize + 60}px)` }), paddingRight: r({ portrait: 0, default: 40 }) })}">
            ${visibleText}${charsToShow < quote.length ? "" : `"`}${showCursor ? `<span style="color: ${brandColor}; font-weight: 700;">|</span>` : ""}
          </div>
        </div>

        <!-- Photo -->
        <div style="${std.css({ position: "absolute", right: photoRight, bottom: photoBottom, width: photoSize, height: photoSize, borderRadius: "50%", overflow: "hidden", border: `3px solid ${brandColor}` })};${photoAnim.style}">
          <img src="${photoUrl}" style="${std.css({ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(100%)" })}" />
        </div>

        <!-- Attribution bar -->
        <div style="${std.css({ position: "absolute", bottom: padding + borderWidth, left: padding + borderWidth, right: padding + borderWidth, height: 56, background: brandColor, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", clipPath: `inset(0 ${100 - attrAnim.enter * 100}% 0 0)`, opacity: attrAnim.opacity * (1 - t.within("exit")) })}">
          <img src="${techlahomaSvg}" style="${std.css({ height: 24, filter: "brightness(0)" })}" />
          <div style="${std.css({ fontSize: nameSize, fontWeight: 600, color: "#000" })}">${name}, ${title}</div>
        </div>
      </div>
    `;
  },
});
