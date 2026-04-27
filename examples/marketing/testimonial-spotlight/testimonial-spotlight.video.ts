import { defineScene } from "superimg";

export default defineScene({
  data: {
    question: "Why do you love Techlahoma?",
    quoteSentences: [
      "I love Techlahoma because it creates real opportunities for connection, growth, and giving back.",
      "As a Techlahoma Ambassador, I've seen firsthand how this community uplifts individuals at every stage of their tech journey",
      "and brings resources to places, like my rural hometown, that might otherwise be overlooked.",
    ],
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
    duration: 20,
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
    const { std, sceneTimeSeconds: time, width, height, data, isPortrait } = ctx;
    const { question, quoteSentences, name, title, photoUrl, techlahomaSvg, brandColor } = data;

    const r = std.createResponsive(ctx);

    // Phases: Intro (Photo grow + shift) | Content (Sentences) | Outro
    const t = std.score({
      intro: 0.2,   // 4s
      content: 0.65, // 13s
      outro: 0.15   // 3s
    });

    const photoSize = r({ portrait: 220, square: 180, default: 200 });
    
    // Photo grow (first 2s of intro)
    const photoGrow = t.within("intro", { at: 0, duration: 0.5 });
    const currentPhotoSize = std.interpolate(photoGrow, [0, 1], [10, photoSize], "easeOutCubic");
    const photoGlow = std.interpolate(photoGrow, [0, 1], [0, 20], "easeOutCubic");

    // Photo shift (2s-4s of intro)
    const shiftProgress = t.within("intro", { at: 0.5, duration: 0.5 });
    const photoShiftX = isPortrait ? 0 : std.interpolate(shiftProgress, [0, 1], [0, r({ square: 180, default: 280 })], "easeInOutCubic");
    const photoShiftY = isPortrait ? std.interpolate(shiftProgress, [0, 1], [0, -150], "easeInOutCubic") : 0;

    const headerAnim = t.motion({ window: [0.125, 1], y: 0 }); // Starts halfway through intro shift
    const attrAnim = t.motion({ window: [0.15, 1], y: 20 });
    const outroAnim = t.motion({ during: "outro", scale: 0.1 });

    // Sentences orchestration inside "content" phase
    const renderSentences = () => {
      return (quoteSentences as string[]).map((sentence: string, index: number) => {
        const at = index / quoteSentences.length;
        const dur = 1 / quoteSentences.length;
        const sP = t.within("content", { at, duration: dur });
        
        if (sP <= 0 && t.active !== "content") return "";
        
        const isCurrent = sP > 0 && sP < 1;
        const hasPassed = sP >= 1 || t.active === "outro";
        
        const fadeIn = std.clamp01(sP * 3);
        const opacity = isCurrent ? std.interpolate(fadeIn, [0, 1], [0, 1], "easeOutCubic") : (hasPassed ? 0.35 : 0);
        const y = isCurrent ? std.interpolate(fadeIn, [0, 1], [30, 0], "easeOutCubic") : 0;

        const isFirst = index === 0;
        const isLast = index === quoteSentences.length - 1;

        return `<div style="${std.css({ fontSize: r({ portrait: 30, square: 24, default: 28 }), fontWeight: 500, color: "#fff", lineHeight: 1.5, opacity, transform: `translateY(${y}px)`, marginBottom: 16 })}">${isFirst ? `"` : ""}${sentence}${isLast ? `"` : ""}</div>`;
      }).join("");
    };

    // Responsive sizing
    const questionSize = r({ portrait: 28, square: 24, default: 26 });
    const nameSize = r({ portrait: 22, square: 18, default: 20 });
    const padding = r({ portrait: 48, default: 60 });

    // Outro screen
    if (t.active === "outro") {
      return `
        <div style="${std.css({ width, height, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 })}">
          <div style="${std.css({ width: photoSize, height: photoSize, borderRadius: "50%", overflow: "hidden", border: `4px solid ${brandColor}`, boxShadow: `0 0 40px ${std.color.alpha(brandColor, 0.4)}` })}; ${outroAnim.style}">
            <img src="${photoUrl}" style="${std.css({ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(100%)" })}" />
          </div>
          <div style="${std.css({ fontSize: nameSize + 4, fontWeight: 600, color: brandColor })}; ${outroAnim.style}">${name}, ${title}</div>
          <img src="${techlahomaSvg}" style="${std.css({ width: r({ portrait: 300, default: 250 }) })}; ${outroAnim.style}" />
        </div>
      `;
    }

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden", background: "#000" })}">
        <!-- Photo -->
        <div style="${std.css({ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) translate(${photoShiftX}px, ${photoShiftY}px)`, width: currentPhotoSize, height: currentPhotoSize, borderRadius: "50%", overflow: "hidden", border: `3px solid ${brandColor}`, boxShadow: `0 0 ${photoGlow}px ${std.color.alpha(brandColor, 0.6)}` })}">
          <img src="${photoUrl}" style="${std.css({ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(100%)" })}" />
        </div>

        ${t.seconds >= 2 ? `
          <div style="${std.css({ position: "absolute", top: r({ portrait: 80, default: 60 }), left: padding })}; ${headerAnim.style}">
            <div style="${std.css({ fontSize: questionSize, fontWeight: 700, color: brandColor })}">${question}</div>
          </div>

          <div style="${std.css({ position: "absolute", bottom: r({ portrait: 100, default: 60 }), left: isPortrait ? "50%" : "auto", right: isPortrait ? "auto" : padding, transform: isPortrait ? "translateX(-50%)" : "none", display: "flex", alignItems: "center", gap: 16, background: brandColor, padding: "12px 24px", borderRadius: 8 })}; ${attrAnim.style}">
            <div style="${std.css({ fontSize: nameSize, fontWeight: 600, color: "#000" })}">${name}, ${title}</div>
          </div>

          <img src="${techlahomaSvg}" style="${std.css({ position: "absolute", bottom: r({ portrait: 40, default: 60 }), left: padding, height: r({ portrait: 28, default: 24 }), opacity: headerAnim.opacity * 0.8 })}" />
        ` : ""}

        ${t.active === "content" || t.within("intro") >= 1 ? `
          <div style="${std.css({ position: "absolute", top: r({ portrait: "30%", default: "25%" }), left: padding, right: isPortrait ? padding : photoSize + photoShiftX + padding + 60, maxWidth: r({ portrait: "100%", default: "55%" }) })}">
            ${renderSentences()}
          </div>
        ` : ""}
      </div>
    `;
  },
});
