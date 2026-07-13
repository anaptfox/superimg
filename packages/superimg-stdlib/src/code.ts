//! Deterministic, synchronous syntax highlighting for rendered code blocks.
//!
//! Player frames need a synchronous pure function. Pulling the full Shiki
//! grammar/runtime graph into every Player made the base preview hundreds of
//! kilobytes larger, so the stdlib uses a compact lexer with stable inline
//! colors. Documentation sites can still use Shiki on the server.

export type ThemeName =
  | "dark-plus"
  | "github-light"
  | "github-dark"
  | "dracula"
  | "nord";

export type LangName =
  | "javascript"
  | "js"
  | "typescript"
  | "ts"
  | "json"
  | "html"
  | "css"
  | "python"
  | "py"
  | "rust"
  | "go"
  | "bash"
  | "sh"
  | "markdown"
  | "md";

export interface HighlightOptions {
  lang: LangName;
  theme?: ThemeName;
  lineNumbers?: boolean;
}

interface Palette {
  background: string;
  foreground: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  punctuation: string;
}

const PALETTES: Record<ThemeName, Palette> = {
  "dark-plus": {
    background: "#1e1e1e", foreground: "#d4d4d4", keyword: "#569cd6",
    string: "#ce9178", number: "#b5cea8", comment: "#6a9955", punctuation: "#d4d4d4",
  },
  "github-light": {
    background: "#ffffff", foreground: "#24292f", keyword: "#cf222e",
    string: "#0a3069", number: "#0550ae", comment: "#6e7781", punctuation: "#24292f",
  },
  "github-dark": {
    background: "#0d1117", foreground: "#c9d1d9", keyword: "#ff7b72",
    string: "#a5d6ff", number: "#79c0ff", comment: "#8b949e", punctuation: "#c9d1d9",
  },
  dracula: {
    background: "#282a36", foreground: "#f8f8f2", keyword: "#ff79c6",
    string: "#f1fa8c", number: "#bd93f9", comment: "#6272a4", punctuation: "#f8f8f2",
  },
  nord: {
    background: "#2e3440", foreground: "#d8dee9", keyword: "#81a1c1",
    string: "#a3be8c", number: "#b48ead", comment: "#616e88", punctuation: "#d8dee9",
  },
};

const KEYWORDS = new Set([
  "as", "async", "await", "break", "case", "catch", "class", "const", "continue",
  "def", "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "fn", "for", "from", "func", "function", "if", "impl", "import", "in", "interface",
  "let", "match", "mod", "new", "null", "package", "pub", "return", "self", "static",
  "struct", "switch", "this", "throw", "true", "try", "type", "undefined", "use", "var",
  "while", "with", "yield",
]);

const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|<!--[\s\S]*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[^\w\s]+)/g;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function span(color: string, value: string): string {
  return `<span style="color:${color}">${escapeHtml(value)}</span>`;
}

function tokenColor(token: string, palette: Palette): string | null {
  if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#") || token.startsWith("<!--")) {
    return palette.comment;
  }
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) return palette.string;
  if (/^\d/.test(token)) return palette.number;
  if (KEYWORDS.has(token)) return palette.keyword;
  if (/^[^\w\s]+$/.test(token)) return palette.punctuation;
  return null;
}

function highlightTokens(source: string, palette: Palette): string {
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    output += escapeHtml(source.slice(cursor, index));
    const token = match[0];
    const color = tokenColor(token, palette);
    output += color ? span(color, token) : escapeHtml(token);
    cursor = index + token.length;
  }
  return output + escapeHtml(source.slice(cursor));
}

export function highlight(code: string, options: HighlightOptions): string {
  const theme = options.theme ?? "dark-plus";
  const palette = PALETTES[theme];
  const content = highlightTokens(code, palette);
  const html = `<pre class="shiki ${theme}" style="background-color:${palette.background};color:${palette.foreground}" tabindex="0"><code>${content}</code></pre>`;
  return options.lineNumbers ? addLineNumbers(html) : html;
}

function addLineNumbers(html: string): string {
  return html.replace(
    /(<code[^>]*>)([\s\S]*?)(<\/code>)/,
    (_, open: string, content: string, close: string) => {
      const lines = content.split("\n");
      const padding = String(lines.length).length;
      const numbered = lines.map((line, index) => {
        const lineNumber = String(index + 1).padStart(padding, " ");
        return `<span class="line"><span class="line-number" style="user-select:none;opacity:0.5;margin-right:1em;">${lineNumber}</span>${line}</span>`;
      }).join("\n");
      return `${open}${numbered}${close}`;
    },
  );
}

export function getThemes(): ThemeName[] {
  return ["dark-plus", "github-light", "github-dark", "dracula", "nord"];
}

export function getLangs(): LangName[] {
  return [
    "javascript", "js", "typescript", "ts", "json", "html", "css", "python", "py",
    "rust", "go", "bash", "sh", "markdown", "md",
  ];
}
