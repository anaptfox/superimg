import { defineScene } from "superimg";

export default defineScene({
  data: {
    podcastName: "The Build Log",
    episodeNumber: "042",
    episodeTitle: "Why we ditched microservices",
    speakerName: "Jane Doe",
    speakerTitle: "Principal Engineer @ TechCo",
    speakerPhoto: "https://i.pravatar.cc/600?img=47",
    brandColor: "#FF4D6D",
    accentColor: "#FFD166",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
    fonts: ["Inter:wght@400;500;600;700;800;900"],
    outputs: {
      youtube: { width: 1920, height: 1080 },
      reel: { width: 1080, height: 1920 },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, width, height, data, isPortrait } = ctx;
    const {
      podcastName,
      episodeNumber,
      episodeTitle,
      speakerName,
      speakerTitle,
      speakerPhoto,
      brandColor,
      accentColor,
    } = data;

    const r = std.createResponsive(ctx);

    // Phases: enter (1.8s) | hold (3s) | exit (1.2s)
    const t = std.score({ enter: 0.3, hold: 0.5, exit: 0.2 });

    // Local helper: progress within a sub-window of a phase, eased.
    const win = (phase: "enter" | "hold" | "exit", at: number, dur: number) => {
      const p = (t.within(phase) - at) / dur;
      return std.math.clamp(p, 0, 1);
    };

    // Staggered enter animations
    const photoP = win("enter", 0, 0.6);
    const photoSize = r({ portrait: 460, default: 520 }) as number;
    const photoScale = std.interpolate(photoP, [0, 1], [0.6, 1], "easeOutCubic");
    const photoOpacity = std.interpolate(photoP, [0, 1], [0, 1], "easeOutCubic");
    const photoGlow = std.interpolate(photoP, [0, 1], [0, 60], "easeOutCubic");

    const podcastP = win("enter", 0.2, 0.5);
    const podcastY = std.interpolate(podcastP, [0, 1], [-20, 0], "easeOutCubic");

    const epLabelP = win("enter", 0.35, 0.5);

    const nameP = win("enter", 0.5, 0.5);
    const nameY = std.interpolate(nameP, [0, 1], [40, 0], "easeOutCubic");

    const titleP = win("enter", 0.65, 0.5);
    const titleY = std.interpolate(titleP, [0, 1], [30, 0], "easeOutCubic");

    // Subtle hold-phase pulse on the photo glow
    const holdP = t.within("hold");
    const pulse = Math.sin(holdP * Math.PI * 2) * 0.5 + 0.5;
    const holdGlow = 60 + pulse * 20;
    const activeGlow = t.active === "hold" ? holdGlow : photoGlow;

    // Slow zoom across the whole scene to keep motion alive
    const overallZoom = std.interpolate(t.progress, [0, 1], [1.0, 1.05], "linear");

    // Exit — wipe down brand-colored curtain + subtle scale-out
    const exitP = t.within("exit");
    const exitFade = std.interpolate(exitP, [0, 1], [0, 1], "easeInCubic");
    const exitScale = std.interpolate(exitP, [0, 1], [1, 1.04], "easeInCubic");

    // Sizes per orientation
    const padding = r({ portrait: 80, default: 120 }) as number;
    const podcastSize = r({ portrait: 26, default: 22 }) as number;
    const epLabelSize = r({ portrait: 28, default: 26 }) as number;
    const nameSize = r({ portrait: 92, default: 96 }) as number;
    const titleSize = r({ portrait: 36, default: 38 }) as number;
    const epTitleSize = r({ portrait: 38, default: 42 }) as number;

    const photoEl = `
      <div style="${std.css({
        position: "relative",
        width: photoSize,
        height: photoSize,
        flexShrink: 0,
        transform: `scale(${photoScale})`,
        opacity: photoOpacity,
      })}">
        <div style="${std.css({
          position: "absolute",
          inset: -20,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${std.color.alpha(brandColor, 0.55)} 0%, ${std.color.alpha(brandColor, 0)} 70%)`,
          filter: `blur(${activeGlow}px)`,
        })}"></div>
        <div style="${std.css({
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          border: `5px solid ${brandColor}`,
          boxShadow: `0 0 80px ${std.color.alpha(brandColor, 0.5)}`,
        })}">
          <img src="${speakerPhoto}" style="${std.css({
            width: "100%",
            height: "100%",
            objectFit: "cover",
          })}" />
        </div>
      </div>
    `;

    const textEl = `
      <div style="${std.css({
        display: "flex",
        flexDirection: "column",
        alignItems: isPortrait ? "center" : "flex-start",
        textAlign: isPortrait ? "center" : "left",
        gap: 18,
        maxWidth: isPortrait ? "100%" : "50%",
      })}">
        <div style="${std.css({
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          fontSize: podcastSize,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          padding: "10px 20px",
          borderRadius: 999,
          background: std.color.alpha("#ffffff", 0.08),
          border: `1px solid ${std.color.alpha("#ffffff", 0.15)}`,
          opacity: podcastP,
          transform: `translateY(${podcastY}px)`,
        })}">
          <span style="${std.css({
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: brandColor,
            boxShadow: `0 0 10px ${brandColor}`,
          })}"></span>
          ${podcastName}
        </div>

        <div style="${std.css({
          fontSize: epLabelSize,
          fontWeight: 800,
          color: accentColor,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          opacity: epLabelP,
        })}">Episode ${episodeNumber}</div>

        <div style="${std.css({
          fontSize: nameSize,
          fontWeight: 900,
          color: "white",
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
          opacity: nameP,
          transform: `translateY(${nameY}px)`,
        })}">${speakerName}</div>

        <div style="${std.css({
          fontSize: titleSize,
          fontWeight: 500,
          color: "rgba(255,255,255,0.7)",
          opacity: titleP,
          transform: `translateY(${titleY}px)`,
        })}">${speakerTitle}</div>

        <div style="${std.css({
          marginTop: 24,
          paddingTop: 24,
          borderTop: `2px solid ${std.color.alpha("#ffffff", 0.15)}`,
          fontSize: epTitleSize,
          fontWeight: 700,
          color: "white",
          fontStyle: "italic",
          lineHeight: 1.2,
          opacity: titleP,
          transform: `translateY(${titleY}px)`,
          maxWidth: "100%",
        })}">"${episodeTitle}"</div>
      </div>
    `;

    return `
      <div style="${std.css({
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(circle at ${isPortrait ? "50% 25%" : "30% 50%"}, ${std.color.alpha(brandColor, 0.35)} 0%, #0B0F1A 60%, #050810 100%)`,
        transform: `scale(${overallZoom * exitScale})`,
        transformOrigin: "center center",
      })}">
        <div style="${std.css({
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${std.color.alpha("#ffffff", 0.04)} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          opacity: 0.6,
        })}"></div>

        <div style="${std.css({
          position: "absolute",
          inset: 0,
          padding: padding,
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: isPortrait ? 70 : 100,
        })}">
          ${photoEl}
          ${textEl}
        </div>

        <div style="${std.css({
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${brandColor} 0%, ${std.color.alpha(brandColor, 0.7)} 100%)`,
          opacity: exitFade,
        })}"></div>
      </div>
    `;
  },
});
