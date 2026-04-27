import { defineScene, type RenderContext } from "superimg";

/** Shorthand for phase objects with { s, e } keys (start, end). */
function phase(p: number, t: { s: number; e: number }): number {
  if (p < t.s) return 0;
  if (p > t.e) return 1;
  return (p - t.s) / (t.e - t.s);
}

export type UrlCardStyle = "card" | "minimal" | "browser" | "social";

export interface UrlVideoData extends Record<string, unknown> {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  favicon: string | null;
  domain: string;
  style: UrlCardStyle;
  theme: "light" | "dark";
  showQr: boolean;
}

const TIMING = {
  cardAppear: { s: 0, e: 0.15 },
  imageReveal: { s: 0.1, e: 0.3 },
  titleSlide: { s: 0.25, e: 0.45 },
  descFade: { s: 0.4, e: 0.55 },
  domainAppear: { s: 0.5, e: 0.62 },
  hold: { s: 0.62, e: 0.88 },
  fadeOut: { s: 0.92, e: 1.0 },
};

export default defineScene<UrlVideoData>({
  data: {
    url: "https://producthunt.com/posts/superimg",
    title: "SuperImg - Create stunning videos from templates",
    description: "Generate beautiful videos using HTML/CSS templates. Perfect for social media, marketing, and more.",
    image: "https://ph-static.imgix.net/ph-logo-1.png",
    siteName: "Product Hunt",
    favicon: "https://ph-static.imgix.net/ph-ios-icon.png",
    domain: "producthunt.com",
    style: "card",
    theme: "dark",
    showQr: false,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
  },
  render(ctx: RenderContext<UrlVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { url, title, description, image, siteName, favicon, domain, style, theme } = data;

    const bgColor = theme === "dark" ? "#0a0a0a" : "#f5f5f5";
    const cardBg = theme === "dark" ? "#18181b" : "#ffffff";
    const textColor = theme === "dark" ? "#ffffff" : "#0a0a0a";
    const mutedColor = theme === "dark" ? "#71717a" : "#a1a1aa";
    const borderColor = theme === "dark" ? "#27272a" : "#e4e4e7";
    const accentColor = "#3b82f6";

    const cardP = std.interpolate(phase(sceneProgress, [0, 1], [0, 1], TIMING.cardAppear), "easeOutBack");
    const imageP = std.interpolate(phase(sceneProgress, [0, 1], [0, 1], TIMING.imageReveal), "easeOutCubic");
    const titleP = std.interpolate(phase(sceneProgress, [0, 1], [0, 1], TIMING.titleSlide), "easeOutCubic");
    const descP = std.interpolate(phase(sceneProgress, [0, 1], [0, 1], TIMING.descFade), "easeOutCubic");
    const domainP = std.interpolate(phase(sceneProgress, [0, 1], [0, 1], TIMING.domainAppear), "easeOutCubic");
    const holdP = phase(sceneProgress, TIMING.hold);
    const fadeP = std.interpolate(phase(sceneProgress, [0, 1], [0, 1], TIMING.fadeOut), "easeOutCubic");

    const globalOp = 1 - fadeP;
    const fontSize = Math.min(width, height) * 0.04;
    const isVertical = height > width;

    const cardWidth = isVertical ? width * 0.88 : width * 0.7;
    const cardMaxHeight = isVertical ? height * 0.75 : height * 0.8;
    const imageHeight = image ? cardMaxHeight * 0.45 : 0;
    const contentPad = fontSize * 1.2;
    const borderRadius = fontSize * 0.6;

    const pulseScale = holdP > 0 && holdP < 1 ? 1 + Math.sin(holdP * Math.PI * 3) * 0.008 : 1;

    const THEME = { bg: bgColor, cardBg, text: textColor, muted: mutedColor, border: borderColor, accent: accentColor };

    let cardHtml = "";

    if (style === "browser") {
      const browserBarHeight = fontSize * 1.5;
      cardHtml = `
      <div style="
        width:${cardWidth}px;
        max-height:${cardMaxHeight}px;
        background:${THEME.cardBg};
        border-radius:${borderRadius}px;
        overflow:hidden;
        box-shadow:0 25px 80px rgba(0,0,0,0.4);
        transform:scale(${cardP * pulseScale}) translateY(${(1 - cardP) * 30}px);
        opacity:${cardP};
      ">
        <div style="
          height:${browserBarHeight}px;
          background:${THEME.border};
          display:flex;
          align-items:center;
          padding:0 ${fontSize * 0.5}px;
          gap:${fontSize * 0.3}px;
        ">
          <div style="width:10px;height:10px;border-radius:50%;background:#ff5f57;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#febc2e;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#28c840;"></div>
          <div style="
            flex:1;
            margin-left:${fontSize * 0.5}px;
            background:${THEME.bg};
            border-radius:${fontSize * 0.3}px;
            padding:${fontSize * 0.2}px ${fontSize * 0.5}px;
            font-size:${fontSize * 0.35}px;
            color:${THEME.muted};
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
          ">${url}</div>
        </div>
        ${image ? `
          <div style="
            width:100%;
            height:${imageHeight}px;
            overflow:hidden;
            clip-path:inset(0 0 ${(1 - imageP) * 100}% 0);
          ">
            <img src="${image}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
        ` : ""}
        <div style="padding:${contentPad}px;">
          <div style="
            font-size:${fontSize * 1.1}px;
            font-weight:700;
            color:${THEME.text};
            line-height:1.3;
            margin-bottom:${fontSize * 0.5}px;
            transform:translateX(${(1 - titleP) * 20}px);
            opacity:${titleP};
          ">${title}</div>
          ${description ? `
            <div style="
              font-size:${fontSize * 0.55}px;
              color:${THEME.muted};
              line-height:1.5;
              opacity:${descP};
              display:-webkit-box;
              -webkit-line-clamp:2;
              -webkit-box-orient:vertical;
              overflow:hidden;
            ">${description}</div>
          ` : ""}
        </div>
      </div>
    `;
    } else if (style === "minimal") {
      cardHtml = `
      <div style="
        width:${cardWidth}px;
        text-align:center;
        transform:scale(${cardP * pulseScale});
        opacity:${cardP};
      ">
        <div style="
          display:flex;
          align-items:center;
          justify-content:center;
          gap:${fontSize * 0.4}px;
          margin-bottom:${fontSize * 1}px;
          opacity:${domainP};
        ">
          ${favicon ? `<img src="${favicon}" style="width:${fontSize * 0.8}px;height:${fontSize * 0.8}px;border-radius:4px;" />` : ""}
          <span style="font-size:${fontSize * 0.5}px;color:${THEME.accent};font-weight:500;">${domain}</span>
        </div>
        <div style="
          font-size:${fontSize * 1.5}px;
          font-weight:800;
          color:${THEME.text};
          line-height:1.2;
          margin-bottom:${fontSize * 0.6}px;
          transform:translateY(${(1 - titleP) * 20}px);
          opacity:${titleP};
        ">${title}</div>
        ${description ? `
          <div style="
            font-size:${fontSize * 0.6}px;
            color:${THEME.muted};
            line-height:1.5;
            opacity:${descP};
            max-width:80%;
            margin:0 auto;
          ">${description}</div>
        ` : ""}
      </div>
    `;
    } else if (style === "social") {
      cardHtml = `
      <div style="
        width:${cardWidth}px;
        background:${THEME.cardBg};
        border:1px solid ${THEME.border};
        border-radius:${borderRadius}px;
        overflow:hidden;
        transform:scale(${cardP * pulseScale}) translateY(${(1 - cardP) * 30}px);
        opacity:${cardP};
      ">
        ${image ? `
          <div style="
            width:100%;
            height:${cardMaxHeight * 0.55}px;
            overflow:hidden;
            clip-path:inset(0 0 ${(1 - imageP) * 100}% 0);
          ">
            <img src="${image}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
        ` : ""}
        <div style="padding:${contentPad}px;">
          <div style="
            font-size:${fontSize * 0.4}px;
            color:${THEME.muted};
            text-transform:uppercase;
            letter-spacing:0.05em;
            margin-bottom:${fontSize * 0.4}px;
            opacity:${domainP};
          ">${domain}</div>
          <div style="
            font-size:${fontSize * 1}px;
            font-weight:700;
            color:${THEME.text};
            line-height:1.3;
            margin-bottom:${fontSize * 0.3}px;
            transform:translateX(${(1 - titleP) * 15}px);
            opacity:${titleP};
          ">${title}</div>
          ${description ? `
            <div style="
              font-size:${fontSize * 0.5}px;
              color:${THEME.muted};
              line-height:1.4;
              opacity:${descP};
              display:-webkit-box;
              -webkit-line-clamp:2;
              -webkit-box-orient:vertical;
              overflow:hidden;
            ">${description}</div>
          ` : ""}
        </div>
      </div>
    `;
    } else {
      const hasImage = !!image;
      cardHtml = `
      <div style="
        width:${cardWidth}px;
        background:${THEME.cardBg};
        border-radius:${borderRadius}px;
        overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,0.3);
        transform:scale(${cardP * pulseScale}) translateY(${(1 - cardP) * 40}px);
        opacity:${cardP};
      ">
        ${hasImage ? `
          <div style="
            width:100%;
            height:${imageHeight}px;
            overflow:hidden;
            position:relative;
          ">
            <div style="
              position:absolute;
              inset:0;
              background:url('${image}') center/cover;
              transform:scale(${1 + (1 - imageP) * 0.1});
              opacity:${imageP};
            "></div>
          </div>
        ` : ""}
        <div style="padding:${contentPad}px;">
          <div style="
            display:flex;
            align-items:center;
            gap:${fontSize * 0.3}px;
            margin-bottom:${fontSize * 0.6}px;
            opacity:${domainP};
          ">
            ${favicon ? `<img src="${favicon}" style="width:${fontSize * 0.6}px;height:${fontSize * 0.6}px;border-radius:3px;" />` : ""}
            <span style="font-size:${fontSize * 0.4}px;color:${THEME.muted};">${siteName}</span>
          </div>
          <div style="
            font-size:${fontSize * 1.1}px;
            font-weight:700;
            color:${THEME.text};
            line-height:1.3;
            margin-bottom:${fontSize * 0.4}px;
            transform:translateX(${(1 - titleP) * 20}px);
            opacity:${titleP};
          ">${title}</div>
          ${description ? `
            <div style="
              font-size:${fontSize * 0.5}px;
              color:${THEME.muted};
              line-height:1.5;
              opacity:${descP};
              display:-webkit-box;
              -webkit-line-clamp:3;
              -webkit-box-orient:vertical;
              overflow:hidden;
            ">${description}</div>
          ` : ""}
          <div style="
            margin-top:${fontSize * 0.6}px;
            padding-top:${fontSize * 0.5}px;
            border-top:1px solid ${THEME.border};
            font-size:${fontSize * 0.35}px;
            color:${THEME.accent};
            opacity:${domainP};
          ">${domain}</div>
        </div>
      </div>
    `;
    }

    return `
    <div style="width:${width}px;height:${height}px;background:${THEME.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;opacity:${globalOp};">
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%, ${THEME.accent}08 0%, transparent 50%);"></div>
      ${cardHtml}
    </div>
  `;
  },
});
