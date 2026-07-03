import { define } from "superimg";

export default define({
  sample: {
    title: "Ship faster",
    subtitle: "Videos from code, not timelines",
    accentColor: "#a855f7",
  },

  config: {
    width: 1080,
    height: 1920,
    fps: 30,
    duration: "5s",
    fonts: ["Space+Grotesk:wght@500;700", "Inter:wght@400;600"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Space Grotesk', system-ui, sans-serif; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const t = ctx.director({ enter: "35%", hold: "50%", exit: "15%" });

    const titleAnim = t.motion({ during: "enter", at: "0%", for: "28%", y: 48, scale: 0.92, easing: "easeOutBack" });
    const subtitleAnim = t.motion({ during: "enter", at: "18%", for: "22%", y: 24, easing: "easeOutCubic" });
    const badgeAnim = t.motion({ during: "enter", at: "32%", for: "18%", scale: 0.85, easing: "easeOutCubic" });
    const glowPulse = 1 + Math.sin(t.in("hold") * Math.PI * 4) * 0.03;

    const accentGlow = std.color.alpha(accentColor, 0.25);
    const accentSoft = std.color.alpha(accentColor, 0.35);

    const bg = std.css({
      width,
      height,
      background: "radial-gradient(ellipse 90% 50% at 50% 15%, " + accentSoft + " 0%, transparent 60%), "
        + "radial-gradient(ellipse 70% 40% at 80% 85%, rgba(34,211,238,0.15) 0%, transparent 55%), "
        + "linear-gradient(180deg, #0a0a12 0%, #12121f 40%, #0f0f23 100%)",
      position: "relative",
    }, std.css.center());

    const glowStyle = std.css({
      position: "absolute",
      top: "12%",
      left: "50%",
      transform: "translateX(-50%)",
      width: 280,
      height: 280,
      borderRadius: "50%",
      background: "radial-gradient(circle, " + accentGlow + " 0%, transparent 70%)",
      filter: "blur(40px)",
      opacity: 0.6 * glowPulse,
    });

    const badgeStyle = std.css({
      display: "inline-block",
      padding: "8px 20px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.55)",
      marginBottom: 48,
    });

    const titleStyle = std.css({
      fontSize: 96,
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: "-0.03em",
      color: "#ffffff",
      textShadow: "0 8px 32px rgba(0,0,0,0.45)",
      marginBottom: 28,
    });

    const subtitleStyle = std.css({
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 32,
      fontWeight: 400,
      lineHeight: 1.45,
      color: "rgba(255,255,255,0.65)",
      maxWidth: 720,
      margin: "0 auto",
    });

    const accentLineStyle = std.css({
      marginTop: 72,
      width: 80,
      height: 4,
      borderRadius: 2,
      background: "linear-gradient(90deg, transparent, " + accentColor + ", transparent)",
      marginLeft: "auto",
      marginRight: "auto",
      opacity: subtitleAnim.opacity,
    });

    const contentWrap = std.css({ textAlign: "center", padding: "0 64px", position: "relative", zIndex: 1 });

    return `
      <div style="${bg}">
        <div style="${glowStyle}"></div>
        <div style="${contentWrap}">
          <div style="${badgeStyle}; ${badgeAnim.style}">SuperImg</div>
          <h1 style="${titleStyle}; ${titleAnim.style}">${title}</h1>
          <p style="${subtitleStyle}; ${subtitleAnim.style}">${subtitle}</p>
          <div style="${accentLineStyle}"></div>
        </div>
      </div>
    `;
  },
});