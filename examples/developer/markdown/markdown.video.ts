import { defineScene, type RenderContext } from "superimg";

export interface MarkdownVideoData extends Record<string, unknown> {
  html: string;
  raw: string;
  wordCount: number;
  theme: "light" | "dark";
  fontSize: "small" | "medium" | "large";
  showWordCount: boolean;
}

const TIMING = {
  fadeIn: { start: 0, end: 0.1 },
  contentReveal: { start: 0.1, end: 0.9 },
  fadeOut: { start: 0.9, end: 1.0 },
};

export default defineScene<MarkdownVideoData>({
  data: {
    html: "<h1>🚀 Version 2.0 Released</h1><p>We've completely redesigned the dashboard with new features including <strong>real-time analytics</strong>, <code>API v2</code> support, and improved performance.</p>",
    raw: "# 🚀 Version 2.0 Released\n\nWe've completely redesigned the dashboard with new features including **real-time analytics**, `API v2` support, and improved performance.",
    wordCount: 24,
    theme: "dark",
    fontSize: "medium",
    showWordCount: false,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4.4,
  },
  render(ctx: RenderContext<MarkdownVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { html, wordCount, theme, fontSize, showWordCount } = data;

    const bgColor = theme === "dark" ? "#0f0f0f" : "#ffffff";
    const textColor = theme === "dark" ? "#ffffff" : "#000000";
    const accentColor = theme === "dark" ? "#3b82f6" : "#2563eb";

    const fontSizeMap: Record<string, string> = { small: "32px", medium: "48px", large: "64px" };
    const baseFontSize = fontSizeMap[fontSize] ?? "48px";
    const h1Size = fontSize === "small" ? "48px" : fontSize === "medium" ? "64px" : "80px";
    const h2Size = fontSize === "small" ? "40px" : fontSize === "medium" ? "56px" : "72px";
    const h3Size = fontSize === "small" ? "36px" : fontSize === "medium" ? "48px" : "64px";

    const fadeInProgress = std.interpolate(sceneProgress, [TIMING.fadeIn.start, TIMING.fadeIn.end], [0, 1], "easeOutCubic");
    const contentProgress = std.interpolate(sceneProgress, [TIMING.contentReveal.start, TIMING.contentReveal.end], [0, 1]);
    const fadeOutProgress = std.interpolate(sceneProgress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeOutCubic");

    const opacity = Math.min(fadeInProgress, 1 - fadeOutProgress);

    const totalChars = html.length;
    const visibleChars = Math.floor(contentProgress * totalChars);
    const displayHtml = html.substring(0, visibleChars);
    const cursor = contentProgress < 1 ? '<span style="animation: blink 0.5s infinite;">|</span>' : "";

    const borderColor = theme === "dark" ? "#2f3336" : "#e5e7eb";
    const mutedColor = theme === "dark" ? "#71767b" : "#6b7280";

    return `
    <style>
      @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
      .markdown-content h1 { font-size: ${h1Size}; font-weight: 700; margin-bottom: 24px; line-height: 1.2; }
      .markdown-content h2 { font-size: ${h2Size}; font-weight: 600; margin-bottom: 20px; line-height: 1.3; }
      .markdown-content h3 { font-size: ${h3Size}; font-weight: 600; margin-bottom: 16px; line-height: 1.3; }
      .markdown-content p { font-size: ${baseFontSize}; line-height: 1.6; margin-bottom: 16px; }
      .markdown-content code { background: rgba(255, 255, 255, 0.1); padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; }
      .markdown-content pre { background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; overflow-x: auto; }
      .markdown-content a { color: ${accentColor}; text-decoration: underline; }
      .markdown-content strong { font-weight: 700; }
      .markdown-content em { font-style: italic; }
    </style>
    <div style="width: ${width}px; height: ${height}px; background: ${bgColor}; display: flex; flex-direction: column; padding: 80px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; opacity: ${opacity};">
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
        <div class="markdown-content" style="color: ${textColor}; max-width: 100%;">
          ${displayHtml}${cursor}
        </div>
      </div>
      ${showWordCount ? `
        <div style="padding-top: 24px; border-top: 1px solid ${borderColor}; color: ${mutedColor}; font-size: 24px;">
          ${wordCount} words
        </div>
      ` : ""}
    </div>
  `;
  },
});
