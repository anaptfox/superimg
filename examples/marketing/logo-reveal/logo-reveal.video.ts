import { defineScene, type RenderContext } from "superimg";

export type RevealStyle = "zoom" | "fade" | "glitch" | "particles" | "typewriter" | "split";

export interface LogoRevealVideoData extends Record<string, unknown> {
  logoUrl: string | null;
  logoText: string | null;
  tagline: string | null;
  style: RevealStyle;
  theme: "light" | "dark" | "custom";
  backgroundColor: string | null;
  accentColor: string;
}

function generateParticles(count: number, seed: number) {
  const particles: { x: number; y: number; size: number; delay: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seed;
    const distance = 50 + (i % 5) * 30;
    particles.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: 2 + (i % 4) * 2,
      delay: (i % 8) * 0.05,
    });
  }
  return particles;
}

export default defineScene<LogoRevealVideoData>({
  data: {
    logoText: "ACME",
    logoUrl: null,
    tagline: "Building the future",
    style: "zoom",
    theme: "dark",
    backgroundColor: null,
    accentColor: "#3b82f6",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
  },
  render(ctx: RenderContext<LogoRevealVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { logoUrl, logoText, tagline, style, theme, backgroundColor, accentColor } = data;

    const bgColor =
      theme === "custom" && backgroundColor
        ? backgroundColor
        : theme === "dark"
          ? "#0a0a0a"
          : "#ffffff";
    const textColor = theme === "dark" || theme === "custom" ? "#ffffff" : "#0a0a0a";

    const score = std.score({
      buildUp: 0.15,
      reveal: 0.35,
      settle: 0.1,
      tagline: 0.15,
      hold: 0.15,
      outro: 0.1,
    });
    const buildUpP = score.tween(0, 1, { during: "buildUp", easing: "easeOutCubic" });
    const revealP = score.within("reveal");
    const settleP = score.tween(0, 1, { during: "settle", easing: "easeOutCubic" });
    const taglineP = score.tween(0, 1, { during: "tagline", easing: "easeOutCubic" });
    const holdP = score.within("hold");
    const fadeP = score.tween(0, 1, { during: "outro", easing: "easeOutCubic" });

    const globalOp = 1 - fadeP;
    const fontSize = Math.min(width, height) * 0.08;
    const logoSize = Math.min(width, height) * 0.35;

    let logoTransform = "";
    let logoOpacity = 1;
    let effectsHtml = "";

    const logoImg = logoUrl
      ? `<img src="${logoUrl}" style="width:${logoSize}px;height:${logoSize}px;object-fit:contain;" />`
      : logoText
        ? `<span style="font-size:${fontSize * 1.5}px;font-weight:900;color:${textColor};letter-spacing:-0.02em;">${logoText}</span>`
        : "";

    if (style === "zoom") {
      const zoomP = std.interpolate(revealP, [0, 1], [0, 1], "easeOutBack");
      const scale = 0.3 + zoomP * 0.7;
      const overshoot = revealP < 1 ? 0 : (1 - settleP) * 0.05;
      logoTransform = `scale(${scale + overshoot})`;
      logoOpacity = Math.min(1, revealP * 2);
      if (revealP > 0.3 && revealP < 0.8) {
        const burstP = (revealP - 0.3) / 0.5;
        effectsHtml = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><div style="width:${logoSize * (1 + burstP * 2)}px;height:${logoSize * (1 + burstP * 2)}px;border-radius:50%;border:2px solid ${accentColor};opacity:${1 - burstP};"></div></div>`;
      }
    } else if (style === "fade") {
      logoOpacity = std.interpolate(revealP, [0, 1], [0, 1], "easeOutCubic");
      const floatY = (1 - revealP) * 20;
      logoTransform = `translateY(${floatY}px)`;
    } else if (style === "glitch") {
      const glitchP = revealP;
      logoOpacity = glitchP > 0.3 ? 1 : glitchP * 3;
      const glitchActive = glitchP > 0.1 && glitchP < 0.7;
      const glitchX = glitchActive ? Math.sin(glitchP * 50) * 10 * (1 - glitchP) : 0;
      const glitchY = glitchActive ? Math.cos(glitchP * 40) * 5 * (1 - glitchP) : 0;
      logoTransform = `translate(${glitchX}px, ${glitchY}px)`;
      if (glitchActive) {
        const splitAmount = (1 - glitchP) * 8;
        effectsHtml = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;mix-blend-mode:screen;"><div style="position:absolute;transform:translateX(${-splitAmount}px);opacity:0.5;filter:hue-rotate(-60deg);">${logoImg}</div><div style="position:absolute;transform:translateX(${splitAmount}px);opacity:0.5;filter:hue-rotate(60deg);">${logoImg}</div></div>`;
      }
    } else if (style === "particles") {
      const particleP = std.interpolate(revealP, [0, 1], [0, 1], "easeOutExpo");
      logoOpacity = particleP;
      logoTransform = `scale(${0.8 + particleP * 0.2})`;
      const particles = generateParticles(20, 0);
      const particlesHtml = particles
        .map((p) => {
          const pProgress = Math.max(0, (revealP - p.delay) / (1 - p.delay));
          const eased = std.interpolate(pProgress, [0, 1], [0, 1], "easeOutExpo");
          const x = p.x * (1 - eased);
          const y = p.y * (1 - eased);
          const opacity = pProgress > 0.8 ? (1 - pProgress) * 5 : 1;
          return `<div style="position:absolute;width:${p.size}px;height:${p.size}px;background:${accentColor};border-radius:50%;transform:translate(${x}px, ${y}px);opacity:${opacity * (1 - fadeP)};"></div>`;
        })
        .join("");
      effectsHtml = `<div style="position:absolute;top:50%;left:50%;pointer-events:none;">${particlesHtml}</div>`;
    } else if (style === "typewriter") {
      if (logoText) {
        const charCount = logoText.length;
        const visibleChars = Math.floor(revealP * charCount);
        const displayText = logoText.substring(0, visibleChars);
        const cursor = revealP < 1 ? "|" : "";
        logoOpacity = 1;
        logoTransform = "";
        effectsHtml = `<div style="font-size:${fontSize * 1.5}px;font-weight:900;font-family:monospace;color:${textColor};letter-spacing:0.05em;">${displayText}<span style="opacity:${Math.floor(sceneProgress * 10) % 2};">${cursor}</span></div>`;
      } else {
        logoOpacity = std.interpolate(revealP, [0, 1], [0, 1], "easeOutCubic");
      }
    } else if (style === "split") {
      const splitP = std.interpolate(revealP, [0, 1], [0, 1], "easeOutExpo");
      logoOpacity = splitP;
      const splitAmount = (1 - splitP) * 100;
      effectsHtml = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;"><div style="position:absolute;clip-path:inset(0 50% 0 0);transform:translateX(${-splitAmount}px);opacity:${splitP};">${logoImg}</div><div style="position:absolute;clip-path:inset(0 0 0 50%);transform:translateX(${splitAmount}px);opacity:${splitP};">${logoImg}</div></div>`;
    }

    const holdPulse = holdP > 0 ? 1 + Math.sin(holdP * Math.PI * 4) * 0.01 : 1;
    const showMainLogo = style !== "typewriter" || !logoText;
    const showSplitLogo = style === "split";

    const logoHtml =
      showMainLogo && !showSplitLogo
        ? `<div style="transform:${logoTransform} scale(${holdPulse});opacity:${logoOpacity};">${logoImg}</div>`
        : "";

    const taglineHtml = tagline
      ? `<div style="position:absolute;bottom:${height * 0.2}px;left:0;right:0;text-align:center;opacity:${taglineP};transform:translateY(${(1 - taglineP) * 15}px);"><span style="font-size:${fontSize * 0.4}px;color:${textColor};opacity:0.8;letter-spacing:0.1em;text-transform:uppercase;">${tagline}</span></div>`
      : "";

    const glowOpacity = buildUpP > 0 && revealP < 0.5 ? buildUpP * 0.6 : 0;

    return `
    <div style="width:${width}px;height:${height}px;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;opacity:${globalOp};">

      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center, ${accentColor}30 0%, transparent 50%);opacity:${glowOpacity + (revealP > 0.5 ? 0.1 : 0)};"></div>

      ${effectsHtml}

      ${logoHtml}

      ${taglineHtml}

    </div>
  `;
  },
});
