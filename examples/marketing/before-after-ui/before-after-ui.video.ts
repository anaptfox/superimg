import { defineScene, type RenderContext } from "superimg";

export type TransitionStyle = "wipe" | "split" | "flip" | "slide";

export interface UIContent {
  html: string;
  css?: string;
  label?: string;
}

export interface BeforeAfterUIData extends Record<string, unknown> {
  before: UIContent;
  after: UIContent;
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

function renderUIWindow(
  content: UIContent,
  baseFontSize: number,
  theme: { cardBg: string; border: string; headerBg: string; mutedText: string; text: string }
): string {
  return `
    <div style="
      display:flex;
      flex-direction:column;
      width:100%;
      height:100%;
      background:${theme.cardBg};
      border-radius:${baseFontSize * 0.5}px;
      overflow:hidden;
      box-shadow:0 20px 50px rgba(0,0,0,0.3);
      border:1px solid ${theme.border};
    ">
      <div style="
        height:${baseFontSize * 1.4}px;
        background:${theme.headerBg};
        display:flex;
        align-items:center;
        padding:0 ${baseFontSize * 0.6}px;
        gap:${baseFontSize * 0.4}px;
        border-bottom:1px solid ${theme.border};
      ">
        <div style="display:flex;gap:${baseFontSize * 0.25}px;">
          <div style="width:${baseFontSize * 0.35}px;height:${baseFontSize * 0.35}px;border-radius:50%;background:#ff5f56;"></div>
          <div style="width:${baseFontSize * 0.35}px;height:${baseFontSize * 0.35}px;border-radius:50%;background:#ffbd2e;"></div>
          <div style="width:${baseFontSize * 0.35}px;height:${baseFontSize * 0.35}px;border-radius:50%;background:#27ca40;"></div>
        </div>
        <div style="
          font-size:${baseFontSize * 0.5}px;
          color:${theme.mutedText};
          margin-left:${baseFontSize * 0.5}px;
          font-family:ui-sans-serif,system-ui,sans-serif;
        ">Preview</div>
      </div>
      <div style="
        flex:1;
        display:flex;
        align-items:center;
        justify-content:center;
        background:${theme.cardBg};
        position:relative;
        overflow:hidden;
      ">
        ${content.css ? `<style>${content.css}</style>` : ""}
        <div style="transform: scale(1.5);">${content.html}</div>
      </div>
    </div>
  `;
}

export default defineScene<BeforeAfterUIData>({
  data: {
    title: "Modern UI Components",
    before: { 
      html: "<button style='padding:10px 20px; background:#eee; border:1px solid #ccc; border-radius:4px; font-family:sans-serif;'>Click Me</button>",
      label: "LEGACY HTML"
    },
    after: { 
      html: "<div style='padding:12px 24px; background:linear-gradient(to right, #3b82f6, #2563eb); color:white; border-radius:8px; font-weight:600; font-family:sans-serif; box-shadow:0 4px 12px rgba(37, 99, 235, 0.3); cursor:pointer;'>Action Button</div>",
      label: "MODERN COMPONENT"
    },
    transition: "wipe",
    theme: "dark",
    accentColor: "#10b981",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
  },
  render(ctx: RenderContext<BeforeAfterUIData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { title, transition, theme: themeKey, accentColor } = data;

    const isDark = themeKey === "dark";
    const bgGradient = isDark 
      ? `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`
      : `linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)`;
    
    const textColor = isDark ? "#ffffff" : "#0f172a";
    const mutedColor = isDark ? "#94a3b8" : "#64748b";
    const cardBg = isDark ? "#0f172a" : "#ffffff";
    const border = isDark ? "#334155" : "#e2e8f0";
    const headerBg = isDark ? "#1e293b" : "#f1f5f9";

    const theme = { text: textColor, cardBg, border, headerBg, mutedText: mutedColor };

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
        <div style="position:absolute;inset:0;clip-path:inset(0 ${wipePosition}% 0 0);">${renderUIWindow(data.before, baseFontSize, theme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${100 - wipePosition}%);">${renderUIWindow(data.after, baseFontSize, theme)}</div>
        <div style="position:absolute;top:0;bottom:0;left:${wipePosition}%;width:4px;background:${accentColor};transform:translateX(-50%);box-shadow:0 0 30px ${accentColor};opacity:${transitionProgress > 0 && transitionProgress < 1 ? 1 : 0};z-index:10;"></div>
      </div>
      <div style="position:absolute;top:${headerHeight}px;left:${contentPadding}px;height:${labelHeight}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;opacity:${1 - transitionProgress};">${beforeLabel}</div>
      <div style="position:absolute;top:${headerHeight}px;right:${contentPadding}px;height:${labelHeight}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;opacity:${transitionProgress};">${afterLabel}</div>
    `;
    } else if (transition === "split") {
      const splitGap = baseFontSize;
      const halfWidth = (contentWidth - splitGap) / 2;
      contentHtml = `
      <div style="position:absolute;top:${contentTop}px;left:${contentPadding}px;width:${contentWidth}px;height:${contentHeight}px;display:flex;gap:${splitGap}px;">
        <div style="flex:1;transform:scale(${0.95 + (1 - transitionProgress) * 0.05});opacity:${0.6 + (1 - transitionProgress) * 0.4};">${renderUIWindow(data.before, baseFontSize, theme)}</div>
        <div style="flex:1;transform:scale(${0.95 + transitionProgress * 0.05});opacity:${0.6 + transitionProgress * 0.4};">${renderUIWindow(data.after, baseFontSize, theme)}</div>
      </div>
      <div style="position:absolute;top:${headerHeight}px;left:${contentPadding}px;width:${halfWidth}px;height:${labelHeight}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;">${beforeLabel}</div>
      <div style="position:absolute;top:${headerHeight}px;right:${contentPadding}px;width:${halfWidth}px;height:${labelHeight}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;">${afterLabel}</div>
    `;
    } else {
      // Default to wipe for simplicity in this specialized template or add more later
      const wipePosition = transitionProgress * 100;
      contentHtml = `
      <div style="position:absolute;top:${contentTop}px;left:${contentPadding}px;width:${contentWidth}px;height:${contentHeight}px;overflow:hidden;">
        <div style="position:absolute;inset:0;clip-path:inset(0 ${wipePosition}% 0 0);">${renderUIWindow(data.before, baseFontSize, theme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${100 - wipePosition}%);">${renderUIWindow(data.after, baseFontSize, theme)}</div>
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
