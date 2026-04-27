import { defineScene, type RenderContext } from "superimg";

export type TransitionStyle = "wipe" | "split" | "flip" | "slide";

export interface TerminalContent {
  text: string;
  label?: string;
}

export interface BeforeAfterTerminalData extends Record<string, unknown> {
  before: TerminalContent;
  after: TerminalContent;
  title: string;
  transition: TransitionStyle;
  theme: "dark"; // Terminal is usually dark
  accentColor: string;
}

const TIMING = {
  titleFadeIn: { start: 0, end: 0.1 },
  transition: { start: 0.3, end: 0.7 },
  fadeOut: { start: 0.9, end: 1.0 },
};

function renderTerminalWindow(
  content: TerminalContent,
  baseFontSize: number,
  theme: { cardBg: string; border: string; headerBg: string; mutedText: string; text: string }
): string {
  // Convert newlines to <br> and escape spaces for terminal look
  const formattedText = content.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/ /g, "&nbsp;");

  return `
    <div style="
      display:flex;
      flex-direction:column;
      width:100%;
      height:100%;
      background:#000000;
      border-radius:${baseFontSize * 0.5}px;
      overflow:hidden;
      box-shadow:0 20px 50px rgba(0,0,0,0.5);
      border:1px solid #333333;
    ">
      <div style="
        height:${baseFontSize * 1.4}px;
        background:#1a1a1a;
        display:flex;
        align-items:center;
        padding:0 ${baseFontSize * 0.6}px;
        gap:${baseFontSize * 0.4}px;
        border-bottom:1px solid #333333;
      ">
        <div style="display:flex;gap:${baseFontSize * 0.25}px;">
          <div style="width:${baseFontSize * 0.35}px;height:${baseFontSize * 0.35}px;border-radius:50%;background:#ff5f56;"></div>
          <div style="width:${baseFontSize * 0.35}px;height:${baseFontSize * 0.35}px;border-radius:50%;background:#ffbd2e;"></div>
          <div style="width:${baseFontSize * 0.35}px;height:${baseFontSize * 0.35}px;border-radius:50%;background:#27ca40;"></div>
        </div>
        <div style="
          font-size:${baseFontSize * 0.5}px;
          color:#666666;
          margin-left:${baseFontSize * 0.5}px;
          font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
        ">bash</div>
      </div>
      <div style="
        flex:1;
        padding:${baseFontSize}px;
        font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
        font-size:${baseFontSize * 0.6}px;
        line-height:1.5;
        overflow:hidden;
        background:#000000;
        color:#ffffff;
      ">
        <div style="color:#4ade80;margin-bottom:${baseFontSize * 0.5}px;">$ command execute</div>
        ${formattedText}
      </div>
    </div>
  `;
}

export default defineScene<BeforeAfterTerminalData>({
  data: {
    title: "Cleaner CLI Output",
    before: { 
      text: "Error: Uncaught TypeError: Cannot read property 'map' of undefined\n  at processData (index.js:42:12)\n  at async handleRequest (server.js:15:5)\n  at ... 12 more internal lines",
      label: "RAW STACK TRACE"
    },
    after: { 
      text: "✖ Error: Project configuration missing\n\nTo fix this, run:\n  $ superimg init\n\nDocs: https://superimg.dev/docs/config",
      label: "FRIENDLY OUTPUT"
    },
    transition: "wipe",
    theme: "dark",
    accentColor: "#4ade80",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
  },
  render(ctx: RenderContext<BeforeAfterTerminalData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { title, transition, accentColor } = data;

    const bgGradient = `linear-gradient(135deg, #020617 0%, #0f172a 100%)`;
    const textColor = "#ffffff";
    const mutedColor = "#64748b";

    const theme = { text: textColor, cardBg: "#000000", border: "#333333", headerBg: "#1a1a1a", mutedText: mutedColor };

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
        <div style="position:absolute;inset:0;clip-path:inset(0 ${wipePosition}% 0 0);">${renderTerminalWindow(data.before, baseFontSize, theme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${100 - wipePosition}%);">${renderTerminalWindow(data.after, baseFontSize, theme)}</div>
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
        <div style="position:absolute;inset:0;clip-path:inset(0 ${wipePosition}% 0 0);">${renderTerminalWindow(data.before, baseFontSize, theme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${100 - wipePosition}%);">${renderTerminalWindow(data.after, baseFontSize, theme)}</div>
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
      font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
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
          <h1 style="font-size:${baseFontSize * 1.3}px;font-weight:800;color:${textColor};text-align:center;margin:0;letter-spacing:-0.02em;font-family:ui-sans-serif,system-ui,sans-serif;">${title}</h1>
        </div>
      ` : ""}
      ${contentHtml}
    </div>
  `;
  },
});
