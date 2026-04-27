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
    const { speakerName, speakerTitle, speakerPhoto, talkTitle, date, time: eventTime, address, groupName, brandColor, techlahomaSvg } = data;

    const r = std.createResponsive(ctx);
    const isHorizontalSplit = !isPortrait;

    // Timeline: Content (0-9s) | Outro (9-12s)
    const t = std.score({
      content: 0.75, // 9s
      outro: 0.25    // 3s
    });

    if (t.active === "outro") {
      const logoWidth = r({ portrait: 500, square: 400, default: 480 });
      const logoAnim = t.motion({ during: "outro", scale: 0.9 });
      return `
        <div style="${std.css({ width, height, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" })}">
          <img src="${techlahomaSvg}" style="${std.css({ width: logoWidth })}; ${logoAnim.style}" />
        </div>
      `;
    }

    // Background zoom (manual interpolation)
    const zoom = std.interpolate(t.within("content"), [0, 1], [1.0, 1.1]);

    const photoAnim = t.motion({ at: 0, duration: 0.1, exit: false });
    const contentAnim = t.motion({ 
      at: 0.05, 
      duration: 0.1, 
      x: isHorizontalSplit ? 100 : 0, 
      y: isHorizontalSplit ? 0 : 100, 
      exit: false 
    });

    const groupAnim = t.motion({ at: 0.1, duration: 0.1, exit: false });
    const labelAnim = t.motion({ at: 0.15, duration: 0.1, exit: false });
    const nameRoleAnim = t.motion({ at: 0.2, duration: 0.1, y: 20, exit: false });
    const talkAnim = t.motion({ at: 0.25, duration: 0.1, y: 20, exit: false });
    const logisticsAnim = t.motion({ at: 0.3, duration: 0.1, y: 20, exit: false });

    // Fade out everything at the end of content phase (8.5s - 9s)
    const fadeOut = std.interpolate(t.within("content", { at: 0.94, duration: 0.06 }), [0, 1], [1, 0], "easeInCubic");

    const padding = r({ portrait: 56, square: 60, default: 80 });
    const labelSize = r({ portrait: 24, square: 18, default: 20 });
    const nameSize = r({ portrait: 64, square: 48, default: 64 });
    const titleSize = r({ portrait: 28, square: 20, default: 28 });
    const talkSize = r({ portrait: 36, square: 28, default: 40 });
    const logisticsSize = r({ portrait: 28, square: 20, default: 24 });

    return `
      <div style="${std.css({ width, height, display: "flex", flexDirection: isHorizontalSplit ? "row" : "column", backgroundColor: brandColor, overflow: "hidden" })}">
        <div style="${std.css({ width: isHorizontalSplit ? "45%" : "100%", height: isHorizontalSplit ? "100%" : "40%", position: "relative", overflow: "hidden", opacity: photoAnim.opacity * fadeOut })}">
          <div style="${std.css({ position: "absolute", inset: -50, backgroundImage: `url(${speakerPhoto})`, backgroundSize: "cover", backgroundPosition: "center", transform: `scale(${zoom})` })}"></div>
        </div>

        <div style="${std.css({
          width: isHorizontalSplit ? "55%" : "100%", height: isHorizontalSplit ? "100%" : "60%", backgroundColor: brandColor, color: "white",
          display: "flex", flexDirection: "column", justifyContent: "center", padding: padding,
          opacity: contentAnim.opacity * fadeOut,
        })}; ${contentAnim.style}">
          <div style="${std.css({ alignSelf: "flex-start", fontSize: 14, fontWeight: 700, background: std.color.alpha("#ffffff", 0.15), padding: "8px 20px", borderRadius: 100, marginBottom: 40, textTransform: "uppercase", letterSpacing: "0.15em" })}; ${groupAnim.style}">${groupName}</div>
          <div style="${std.css({ fontSize: labelSize, fontWeight: 800, color: "#61dafb", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 20 })}; ${labelAnim.style}">Guest Speaker</div>

          <div style="${std.css({ marginBottom: 48 })}; ${nameRoleAnim.style}">
            <div style="${std.css({ fontSize: nameSize, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 8 })}">${speakerName}</div>
            <div style="${std.css({ fontSize: titleSize, fontWeight: 400, opacity: 0.9 })}">${speakerTitle}</div>
          </div>

          <div style="${std.css({ marginBottom: 48, borderLeft: "6px solid #61dafb", paddingLeft: 24 })}; ${talkAnim.style}">
            <div style="${std.css({ fontSize: 16, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, opacity: 0.7, marginBottom: 12 })}">Talk Topic</div>
            <div style="${std.css({ fontSize: talkSize, fontWeight: 700, lineHeight: 1.2 })}">"${talkTitle}"</div>
          </div>

          <div style="${std.css({ marginTop: "auto", paddingTop: 32, borderTop: `1px solid ${std.color.alpha("#ffffff", 0.2)}` })}; ${logisticsAnim.style}">
            <div style="${std.css({ fontSize: logisticsSize, fontWeight: 600, marginBottom: 8 })}">${date} · ${eventTime}</div>
            <div style="${std.css({ fontSize: logisticsSize * 0.8, fontWeight: 400, opacity: 0.7 })}">${address}</div>
          </div>
        </div>
      </div>
    `;
  },
});
