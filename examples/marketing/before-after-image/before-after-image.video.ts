import { defineScene, type RenderContext } from "superimg";

export type TransitionStyle = "wipe" | "split" | "flip" | "slide";

export interface ImageContent {
  url: string;
  label?: string;
}

export interface BeforeAfterImageData extends Record<string, unknown> {
  before: ImageContent;
  after: ImageContent;
  title: string;
  transition: TransitionStyle;
  theme: "light" | "dark";
  accentColor: string;
}

const TIMING = {
  titleFadeIn: { start: 0, end: 0.1 },
  transition: { start: 0.3, end: 0.7 },
  fadeOut: { start: 0.9, end: 1.0 },
};

function renderImageCard(
  content: ImageContent,
  baseFontSize: number,
  theme: { border: string }
): string {
  return `
    <div style="
      width:100%;
      height:100%;
      background:#000;
      border-radius:${baseFontSize * 0.5}px;
      overflow:hidden;
      box-shadow:0 20px 50px rgba(0,0,0,0.3);
      border:1px solid ${theme.border};
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <img src="${content.url}" style="width:100%;height:100%;object-fit:cover;" />
    </div>
  `;
}

export default defineScene<BeforeAfterImageData>({
  data: {
    title: "Website Redesign",
    before: { 
      url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=1920",
      label: "2023 DESIGN"
    },
    after: { 
      url: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&q=80&w=1920",
      label: "2024 DESIGN"
    },
    transition: "wipe",
    theme: "dark",
    accentColor: "#f97316",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
  },
  render(ctx: RenderContext<BeforeAfterImageData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { title, transition, theme: themeKey, accentColor } = data;

    const isDark = themeKey === "dark";
    const bgGradient = isDark 
      ? `linear-gradient(135deg, #111111 0%, #222222 100%)`
      : `linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%)`;
    
    const textColor = isDark ? "#ffffff" : "#111111";
    const mutedColor = isDark ? "#9ca3af" : "#6b7280";
    const border = isDark ? "#374151" : "#e5e7eb";

    const theme = { border };

    const titleProgress = std.interpolate(sceneProgress, [TIMING.titleFadeIn.start, TIMING.titleFadeIn.end], [0, 1], "easeOutCubic");
    const transitionProgress = std.interpolate(sceneProgress, [TIMING.transition.start, TIMING.transition.end], [0, 1], "easeInOutCubic");
    const fadeOutProgress = std.interpolate(sceneProgress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeOutCubic");

    const globalOpacity = 1 - fadeOutProgress;

    const baseFontSize = Math.min(width, height) * 0.045;
    const headerHeight = title ? height * 0.15 : 0;
    const labelHeight = baseFontSize * 2.5;
    const contentPadding = width * 0.1;
    const contentWidth = width - contentPadding * 2;
    const contentHeight = height - headerHeight - labelHeight - contentPadding;

    const beforeLabel = data.before.label || "BEFORE";
    const afterLabel = data.after.label || "AFTER";

    const contentTop = headerHeight + labelHeight * 0.5;

    let contentHtml = "";

    if (transition === "wipe") {
      const wipePosition = transitionProgress * 100;
      contentHtml = `
      <div style="position:absolute;top:${contentTop}px;left:${contentPadding}px;width:${contentWidth}px;height:${contentHeight}px;overflow:hidden;">
        <div style="position:absolute;inset:0;clip-path:inset(0 ${wipePosition}% 0 0);">${renderImageCard(data.before, baseFontSize, theme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${100 - wipePosition}%);">${renderImageCard(data.after, baseFontSize, theme)}</div>
        <div style="position:absolute;top:0;bottom:0;left:${wipePosition}%;width:4px;background:${accentColor};transform:translateX(-50%);box-shadow:0 0 30px ${accentColor};opacity:${transitionProgress > 0 && transitionProgress < 1 ? 1 : 0};z-index:10;"></div>
      </div>
      <div style="position:absolute;top:${headerHeight}px;left:${contentPadding}px;height:${labelHeight}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;opacity:${1 - transitionProgress};">${beforeLabel}</div>
      <div style="position:absolute;top:${headerHeight}px;right:${contentPadding}px;height:${labelHeight}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;opacity:${transitionProgress};">${afterLabel}</div>
    `;
    } else {
      // Default to wipe for now
      const wipePosition = transitionProgress * 100;
      contentHtml = `
      <div style="position:absolute;top:${contentTop}px;left:${contentPadding}px;width:${contentWidth}px;height:${contentHeight}px;overflow:hidden;">
        <div style="position:absolute;inset:0;clip-path:inset(0 ${wipePosition}% 0 0);">${renderImageCard(data.before, baseFontSize, theme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${100 - wipePosition}%);">${renderImageCard(data.after, baseFontSize, theme)}</div>
        <div style="position:absolute;top:0;bottom:0;left:${wipePosition}%;width:4px;background:${accentColor};transform:translateX(-50%);box-shadow:0 0 30px ${accentColor};opacity:${transitionProgress > 0 && transitionProgress < 1 ? 1 : 0};z-index:10;"></div>
      </div>
      <div style="position:absolute;top:${headerHeight}px;left:${contentPadding}px;height:${labelHeight}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;opacity:${1 - transitionProgress};">${beforeLabel}</div>
      <div style="position:absolute;top:${headerHeight}px;right:${contentPadding}px;height:${labelHeight}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;opacity:${transitionProgress};">${afterLabel}</div>
    `;
    }

    return `
    <div style="
      width:${width}px;
      height:${height}px;
      background:${bgGradient};
      font-family:ui-sans-serif,system-ui,sans-serif;
      position:relative;
      overflow:hidden;
      opacity:${globalOpacity};
    ">
      ${title ? `
        <div style="
          position:absolute;
          top:0;
          left:0;
          right:0;
          height:${headerHeight}px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:0 ${contentPadding}px;
          opacity:${titleProgress};
          transform:translateY(${(1 - titleProgress) * -20}px);
        ">
          <h1 style="font-size:${baseFontSize * 1.3}px;font-weight:800;color:${textColor};text-align:center;margin:0;letter-spacing:-0.02em;">${title}</h1>
        </div>
      ` : ""}
      ${contentHtml}
    </div>
  `;
  },
});
