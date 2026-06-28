import { define } from "superimg";

export default define({
  sample: {
    title: "SuperImg",
    tagline: "Stunning videos from HTML & CSS",
    accentColor: "#667eea",
  },
  config: {
    width: 1200,
    height: 630,
    fonts: ["Space+Grotesk:wght@500;700", "Inter:wght@400;500"],
    outputs: {
      og: { width: 1200, height: 630, format: "png" },
      thumb: { width: 600, height: 315, format: "webp" },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
    `],
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, tagline, accentColor } = data;

    const root = std.css({
      width,
      height,
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
      background: `radial-gradient(ellipse 80% 70% at 85% 20%, ${std.color.alpha(accentColor, 0.35)} 0%, transparent 55%),
        radial-gradient(ellipse 60% 50% at 10% 90%, rgba(168,85,247,0.2) 0%, transparent 50%),
        linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #0f172a 100%)`,
      overflow: "hidden",
      position: "relative",
    });

    const grid = `
      <div style="${std.css({
        position: "absolute",
        inset: 0,
        opacity: 0.04,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      })}"></div>
    `;

    const logo = `
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <rect width="56" height="56" rx="14" fill="${std.color.alpha(accentColor, 0.2)}"/>
        <path d="M18 36V20l10 8 10-8v16" stroke="${accentColor}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    const accentLine = std.css({
      width: 120,
      height: 3,
      borderRadius: 2,
      background: `linear-gradient(90deg, ${accentColor}, ${std.color.alpha(accentColor, 0.3)})`,
      marginBottom: 28,
    });

    return `
      <div style="${root}">
        ${grid}
        <div style="${std.css(std.css.fill(), { display: "flex", alignItems: "center", padding: "0 80px", gap: 64 })}">
          <div style="${std.css({ flex: 1 })}">
            <div style="${accentLine}"></div>
            <h1 style="${std.css({
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#ffffff",
              marginBottom: 16,
            })}">${title}</h1>
            <p style="${std.css({
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 26,
              fontWeight: 400,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.4,
              maxWidth: 520,
            })}">${tagline}</p>
            <div style="${std.css({
              marginTop: 36,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 15,
              color: "rgba(255,255,255,0.5)",
            })}">
              <span style="color:${accentColor};">●</span> superimg.dev
            </div>
          </div>
          <div style="${std.css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: 32,
            borderRadius: 24,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          })}">
            ${logo}
            <span style="${std.css({ fontSize: 14, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" })}">Programmatic video</span>
          </div>
        </div>
      </div>
    `;
  },
});