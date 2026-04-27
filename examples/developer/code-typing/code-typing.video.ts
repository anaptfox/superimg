import { defineScene, type RenderContext } from "superimg";

type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "rust"
  | "go"
  | "json"
  | "bash"
  | "text";

type SupportedTheme = "dark-plus" | "github-light";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CodeSnippetData {
  code: string;
  language: string;
  filename?: string;
  highlightLines?: number[];
}

export interface CodeTypingData extends Record<string, unknown> {
  code: string;
  language: string;
  filename: string;
  highlightLines: number[];
  theme: "dark" | "light";
  showLineNumbers: boolean;
  fontSize: "small" | "medium" | "large";
}

const FONT_SIZE_MAP: Record<string, string> = {
  small: "20px",
  medium: "24px",
  large: "32px",
};

function getShikiTheme(theme: "dark" | "light"): SupportedTheme {
  return theme === "dark" ? "dark-plus" : "github-light";
}

export default defineScene<CodeTypingData>({
  data: {
    code: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`,
    language: "typescript",
    filename: "hello.ts",
    highlightLines: [2],
    theme: "dark",
    showLineNumbers: true,
    fontSize: "medium",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4.96,
  },
  render(ctx: RenderContext<CodeTypingData>) {
    const { std, width, height, data } = ctx;
    const {
      code,
      language,
      filename,
      highlightLines,
      theme,
      showLineNumbers,
      fontSize,
    } = data;

    const bgColor = theme === "dark" ? "#1e1e1e" : "#ffffff";
    const textColor = theme === "dark" ? "#d4d4d4" : "#24292e";
    const lineNumColor = theme === "dark" ? "#858585" : "#999999";
    const headerBg = theme === "dark" ? "#2d2d2d" : "#f3f3f3";
    const codeFontSize = FONT_SIZE_MAP[fontSize] ?? "24px";
    const shikiTheme = getShikiTheme(theme);

    function highlightLine(line: string, lang: SupportedLanguage): string {
      if (lang === "text" || !line.trim()) {
        return escapeHtml(line) || "&nbsp;";
      }
      try {
        const html = std.code.highlight(line, { lang: lang as never, theme: shikiTheme as never });
        const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
        if (match?.[1]) {
          const content = match[1].replace(/\n$/, "");
          return content || "&nbsp;";
        }
        return escapeHtml(line);
      } catch {
        return escapeHtml(line);
      }
    }

    const t = std.score({
      header: 0.1,
      code: 0.75,
      pulse: 0.15
    });

    const headerProgress = t.within("header", { easing: "easeOutCubic" });
    const codeProgress = t.within("code");
    const highlightProgress = t.within("pulse");

    const lines = code.split("\n");
    const totalChars = code.length;
    const visibleChars = Math.floor(codeProgress * totalChars);

    let charCount = 0;
    const visibleLines: string[] = [];
    for (const line of lines) {
      if (charCount >= visibleChars) break;
      const lineChars = line.length + 1;
      if (charCount + lineChars <= visibleChars) {
        visibleLines.push(highlightLine(line, language as SupportedLanguage));
      } else {
        const partialChars = visibleChars - charCount;
        visibleLines.push(
          highlightLine(line.substring(0, partialChars), language as SupportedLanguage)
        );
      }
      charCount += lineChars;
    }

    const cursor =
      codeProgress < 1 ? '<span class="cursor">|</span>' : "";

    const linesHtml = visibleLines
      .map((line, i) => {
        const lineNum = i + 1;
        const isHighlighted = highlightLines.includes(lineNum);
        const highlightOpacity = isHighlighted
          ? 0.15 + Math.sin(highlightProgress * Math.PI * 4) * 0.1
          : 0;
        const lineNumHtml = showLineNumbers
          ? `<span class="line-num">${lineNum}</span>`
          : "";
        return `<div class="line" style="background: rgba(255, 215, 0, ${highlightOpacity});">${lineNumHtml}<span class="line-content">${line}${i === visibleLines.length - 1 ? cursor : ""}</span></div>`;
      })
      .join("");

    return `
    <style>
      @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
      .cursor { animation: blink 0.5s infinite; color: ${theme === "dark" ? "#fff" : "#000"}; font-weight: bold; }
      .code-container { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
      .line { display: flex; padding: 2px 0; }
      .line-num { width: 50px; text-align: right; padding-right: 16px; color: ${lineNumColor}; user-select: none; flex-shrink: 0; }
      .line-content { flex: 1; white-space: pre; }
    </style>
    <div style="width: ${width}px; height: ${height}px; background: linear-gradient(180deg, #0f0f0f 0%, #1a1a2e 100%); display: flex; align-items: center; justify-content: center; padding: 60px; box-sizing: border-box;">
      <div style="width: 100%; max-width: 1000px; background: ${bgColor}; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); opacity: ${headerProgress}; transform: translateY(${(1 - headerProgress) * 20}px);">
        <div style="background: ${headerBg}; padding: 12px 20px; display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; gap: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #27ca40;"></div>
          </div>
          ${filename ? `<span style="color: ${lineNumColor}; font-size: 14px; font-family: -apple-system, sans-serif;">${escapeHtml(filename)}</span>` : ""}
          <span style="margin-left: auto; color: ${lineNumColor}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${language}</span>
        </div>
        <div class="code-container" style="padding: 24px; font-size: ${codeFontSize}; line-height: 1.6; color: ${textColor}; overflow: hidden;">
          ${linesHtml}
        </div>
      </div>
    </div>
  `;
  },
});
