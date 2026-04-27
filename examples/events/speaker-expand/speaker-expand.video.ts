import { defineScene } from "superimg";

export default defineScene({
  data: {
    speakerName: "Jane Doe",
    speakerTitle: "Principal Engineer @ TechCo",
    speakerPhoto: "https://i.pravatar.cc/500?img=47",
    talkTitle: "Scaling with React Server Components",
    date: "March 18",
    time: "11 AM – 1 PM",
    address: "3 NE 8th St · Oklahoma City, OK",
    groupName: "OKC ReactJS",
    backgroundImage: "https://secure.meetupstatic.com/photos/event/8/6/9/7/highres_516994455.jpeg",
    brandColor: "#0f172a",
    techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 12,
    fonts: ["Inter:wght@400;500;600;700;800;900"],
    audio: { src: "../../_assets/lofi-bg.mp3", volume: 0.6, fadeIn: 0.5, fadeOut: 1.5, loop: true },
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
    const { speakerName, speakerTitle, speakerPhoto, talkTitle, date, time: eventTime, address, groupName, brandColor, backgroundImage, techlahomaSvg } = data;

    const mainDur = 9.0;
    const r = std.createResponsive(ctx);

    // score: main (75%) -> outro (25%)
    const t = std.score({ main: 0.75, outro: 0.25 });

    // === OUTRO PHASE ===
    if (t.active === "outro") {
      const logoWidth = r({ portrait: 500, square: 400, default: 480 });
      const logoAnim = t.motion({ during: "outro", scale: 0.1, duration: 1/3, exit: false });

      return `<div style="${std.css({ width, height, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" })}"><img src="${techlahomaSvg}" style="${std.css({ width: logoWidth, opacity: logoAnim.opacity })};${logoAnim.style}" /></div>`;
    }

    // === MAIN CONTENT ===
    const bg = std.backgrounds.kenBurns({ src: backgroundImage, progress: time / mainDur, zoomTo: 1.1, overlay: "rgba(0, 0, 0, 0.7)" });

    // Triggers within "main" phase (9s)
    const avatarAnim = t.motion({ during: "main", at: 0.5/9, duration: 0.6/9, scale: 0.5 });
    const profileAnim = t.motion({ during: "main", at: 0.8/9, duration: 0.5/9, y: 20 });
    const expandP = t.tween(0, 1, { during: "main", at: 3.0/9, duration: 0.6/9, easing: "easeInOutCubic" });
    const cardContentAnim = t.motion({ during: "main", at: 3.3/9, duration: 0.5/9, y: 20 });
    
    // Global fade out at end of main
    const fadeOutP = t.tween(0, 1, { during: "main", at: 8.5/9, duration: 0.5/9, easing: "easeInCubic" });
    const fadeOut = 1 - fadeOutP;

    const shiftYAmount = r({ portrait: -350, square: -250, default: -200 });
    const profileShiftY = std.interpolate(expandP, [0, 1], [0, shiftYAmount], "easeInOutCubic");
    const profileScale = std.interpolate(expandP, [0, 1], [1, 0.85], "easeInOutCubic");

    const cardHeightBase = r({ portrait: 700, square: 500, default: 480 });
    const cardHeight = std.interpolate(expandP, [0, 1], [0, cardHeightBase], "easeInOutCubic");
    const cardOpacity = std.interpolate(expandP, [0, 1], [0, 1], "easeInOutCubic");

    // Responsive sizing
    const avatarSize = r({ portrait: 360, square: 280, default: 280 });
    const nameSize = r({ portrait: 64, square: 48, default: 56 });
    const titleSize = r({ portrait: 28, square: 24, default: 28 });
    const cardWidth = r({ portrait: "90%", square: "80%", default: "60%" });
    const talkSize = r({ portrait: 40, square: 32, default: 40 });
    const logisticsSize = r({ portrait: 28, square: 20, default: 24 });
    const cardPadding = r({ portrait: "40px 60px 60px", default: "40px 60px 50px" });
    const cardMarginTop = r({ portrait: 120, square: 80, default: 60 });

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" })}">
        ${bg.html}
        <div style="${std.css({ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", width: "100%", opacity: fadeOut })}">

          <!-- Profile Block -->
          <div style="${std.css({ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${profileShiftY}px) scale(${profileScale})`, position: "relative", zIndex: 10 })}">
            <div style="${std.css({ width: avatarSize, height: avatarSize, borderRadius: "50%", backgroundImage: `url(${speakerPhoto})`, backgroundSize: "cover", border: "8px solid #cbd5e1", boxShadow: "0 16px 48px rgba(0,0,0,0.4)", opacity: avatarAnim.opacity, marginBottom: 32 })};${avatarAnim.style}"></div>
            <div style="${std.css({ textAlign: "center", color: "white", opacity: profileAnim.opacity, textShadow: "0 4px 12px rgba(0,0,0,0.8)" })};${profileAnim.style}">
              <div style="${std.css({ fontSize: nameSize, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 8 })}">${speakerName}</div>
              <div style="${std.css({ fontSize: titleSize, fontWeight: 500, color: "#61dafb" })}">${speakerTitle}</div>
            </div>
          </div>

          <!-- Expanding Card -->
          <div style="${std.css({ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: cardWidth, maxWidth: 1000, display: "flex", justifyContent: "center", marginTop: cardMarginTop })}">
            <div style="${std.css({
              width: "100%", height: cardHeight, background: std.color.alpha(brandColor, 0.95), borderRadius: 24,
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)", opacity: cardOpacity, overflow: "hidden",
              display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: cardPadding, textAlign: "center", color: "white",
            })}">
              <div style="${std.css({ opacity: cardContentAnim.opacity, display: "flex", flexDirection: "column", height: "100%", justifyContent: "flex-end" })};${cardContentAnim.style}">
                <div style="${std.css({ fontSize: 16, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, color: "#61dafb", marginBottom: 16 })}">${groupName} Presents</div>
                <div style="${std.css({ fontSize: talkSize, fontWeight: 800, lineHeight: 1.2, fontStyle: "italic", marginBottom: 32 })}">"${talkTitle}"</div>
                <div style="${std.css({ borderTop: `1px solid ${std.color.alpha("#ffffff", 0.2)}`, paddingTop: 24 })}">
                  <div style="${std.css({ fontSize: logisticsSize, fontWeight: 600, marginBottom: 8 })}">${date} · ${eventTime}</div>
                  <div style="${std.css({ fontSize: logisticsSize * 0.8, fontWeight: 400, opacity: 0.7 })}">${address}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
});
