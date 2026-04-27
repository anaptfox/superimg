import { defineScene, type RenderContext } from "superimg";

export type TransitionStyle = "wipe" | "split" | "flip" | "slide";

export interface CodeContent {
  code: string;
  language?: string;
  filename?: string;
  label?: string;
}

export interface BeforeAfterCodeData extends Record<string, unknown> {
  before: CodeContent;
  after: CodeContent;
  title: string;
  transition: TransitionStyle;
  theme: "light" | "dark";
  accentColor: string;
}

const TIMING = {
  titleFadeIn: { start: 0, end: 0.03 },
  transition: { start: 0.42, end: 0.5 },
  fadeOut: { start: 0.97, end: 1.0 },
};

function renderCodeWindow(
  content: CodeContent,
  baseFontSize: number,
  theme: { cardBg: string; border: string; headerBg: string; mutedText: string; text: string },
  std: any,
  shikiTheme: string
): string {
  const highlighted = std.code.highlight(content.code, { 
    lang: (content.language || "typescript") as any, 
    theme: shikiTheme as any 
  });

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
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        ">${content.filename || (content.language === 'html' ? 'index.html' : 'index.ts')}</div>
      </div>
      <div style="
        flex:1;
        padding:${baseFontSize * 0.7}px ${baseFontSize * 0.9}px;
        font-family:'SF Mono', 'Fira Code', monospace;
        font-size:${baseFontSize * 0.65}px;
        line-height:1.6;
        overflow:hidden;
        background:${theme.cardBg};
      ">
        ${highlighted}
      </div>
    </div>
  `;
}

export default defineScene<BeforeAfterCodeData>({
  data: {
    title: "Simplify your Code",
    before: { 
      code: "const res = await fetch('/api/user');\nconst data = await res.json();\nif (!res.ok) throw new Error();\nconsole.log(data.name);", 
      language: "javascript",
      filename: "raw-fetch.js",
      label: "MANUAL FETCH"
    },
    after: { 
      code: "const user = await sdk.users.get();\nconsole.log(user.name);", 
      language: "typescript",
      filename: "with-sdk.ts",
      label: "USING SDK"
    },
    transition: "wipe",
    theme: "dark",
    accentColor: "#3b82f6",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 10,
  },
  render(ctx: RenderContext<BeforeAfterCodeData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { title, transition, theme: themeKey, accentColor } = data;

    const isDark = themeKey === "dark";
    const bgColor = isDark ? "#0a0a0a" : "#fafafa";
    const bgGradient = isDark 
      ? `linear-gradient(135deg, #0a0a0a 0%, #171717 100%)`
      : `linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)`;
    
    const textColor = isDark ? "#ffffff" : "#0a0a0a";
    const mutedColor = isDark ? "#a1a1aa" : "#71717a";
    const cardBg = isDark ? "#121212" : "#ffffff";
    const border = isDark ? "#262626" : "#e5e5e5";
    const headerBg = isDark ? "#1c1c1c" : "#f3f4f6";
    const shikiTheme = isDark ? "dark-plus" : "github-light";

    const theme = { text: textColor, cardBg, border, headerBg, mutedText: mutedColor };

    const titleProgress = std.interpolate(sceneProgress, [TIMING.titleFadeIn.start, TIMING.titleFadeIn.end], [0, 1], "easeOutCubic");
    const transitionProgress = std.interpolate(sceneProgress, [TIMING.transition.start, TIMING.transition.end], [0, 1], "easeInOutCubic");
    const fadeOutProgress = std.interpolate(sceneProgress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeOutCubic");

    const globalOpacity = 1 - fadeOutProgress;

    const baseFontSize = Math.min(width, height) * 0.045;
    const horizontalPadding = width * 0.08;

    const [titleArea, labelArea, windowArea] = std.layout.stack(
      { x: 0, y: 0, width, height },
      [
        { height: title ? height * 0.15 : 0 },
        { height: baseFontSize * 2.5 },
        { fill: true },
      ],
      { gap: baseFontSize * 0.3 },
    );
    const codeArea = std.layout.inset(windowArea, {
      x: horizontalPadding,
      bottom: baseFontSize * 1.2,
    });
    const labelRow = std.layout.inset(labelArea, { x: horizontalPadding });

    const beforeLabel = data.before.label || "BEFORE";
    const afterLabel = data.after.label || "AFTER";

    let contentHtml = "";

    const codeBox = `top:${codeArea.y}px;left:${codeArea.x}px;width:${codeArea.width}px;height:${codeArea.height}px;`;
    const labelBox = `top:${labelRow.y}px;height:${labelRow.height}px;`;

    if (transition === "wipe") {
      const wipePosition = transitionProgress * 100;
      contentHtml = `
      <div style="position:absolute;${codeBox}overflow:hidden;">
        <div style="position:absolute;inset:0;clip-path:inset(0 ${100 - wipePosition}% 0 0);">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${wipePosition}%);">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="position:absolute;top:0;bottom:0;left:${wipePosition}%;width:4px;background:${accentColor};transform:translateX(-50%);box-shadow:0 0 30px ${accentColor};opacity:${transitionProgress > 0 && transitionProgress < 1 ? 1 : 0};z-index:10;"></div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;opacity:${transitionProgress};">${afterLabel}</div>
      <div style="position:absolute;${labelBox}right:${horizontalPadding}px;display:flex;align-items:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;opacity:${1 - transitionProgress};">${beforeLabel}</div>
    `;
    } else if (transition === "slide") {
      const beforeX = -transitionProgress * 120;
      const afterX = (1 - transitionProgress) * 120;
      contentHtml = `
      <div style="position:absolute;${codeBox}overflow:hidden;">
        <div style="position:absolute;inset:0;transform:translateX(${beforeX}%);opacity:${1 - transitionProgress};">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="position:absolute;inset:0;transform:translateX(${afterX}%);opacity:${transitionProgress};">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;right:${horizontalPadding}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * 0.8}px;font-weight:700;color:${transitionProgress < 0.5 ? mutedColor : accentColor};letter-spacing:0.15em;">${transitionProgress < 0.5 ? beforeLabel : afterLabel}</div>
    `;
    } else if (transition === "flip") {
      const rotateY = transitionProgress * 180;
      contentHtml = `
      <div style="position:absolute;${codeBox}perspective:2000px;">
        <div style="width:100%;height:100%;position:relative;transform-style:preserve-3d;transform:rotateY(${rotateY}deg);">
          <div style="position:absolute;inset:0;backface-visibility:hidden;">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
          <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
        </div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;right:${horizontalPadding}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * 0.8}px;font-weight:700;color:${rotateY < 90 ? mutedColor : accentColor};letter-spacing:0.15em;">${rotateY < 90 ? beforeLabel : afterLabel}</div>
    `;
    } else {
      const splitGap = baseFontSize;
      const halfWidth = (codeArea.width - splitGap) / 2;
      contentHtml = `
      <div style="position:absolute;${codeBox}display:flex;gap:${splitGap}px;">
        <div style="flex:1;transform:scale(${0.95 + (1 - transitionProgress) * 0.05});opacity:${0.6 + (1 - transitionProgress) * 0.4};">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="flex:1;transform:scale(${0.95 + transitionProgress * 0.05});opacity:${0.6 + transitionProgress * 0.4};">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;width:${halfWidth}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;">${beforeLabel}</div>
      <div style="position:absolute;${labelBox}right:${horizontalPadding}px;width:${halfWidth}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * 0.7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;">${afterLabel}</div>
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
          height:${titleArea.height}px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:0 ${horizontalPadding}px;
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
