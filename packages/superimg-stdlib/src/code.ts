//! Syntax highlighting for code blocks (Shiki-powered)

import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Pre-bundled themes
import darkPlus from "@shikijs/themes/dark-plus";
import githubLight from "@shikijs/themes/github-light";
import githubDark from "@shikijs/themes/github-dark";
import dracula from "@shikijs/themes/dracula";
import nord from "@shikijs/themes/nord";

// Pre-bundled languages
import javascript from "@shikijs/langs/javascript";
import typescript from "@shikijs/langs/typescript";
import json from "@shikijs/langs/json";
import html from "@shikijs/langs/html";
import css from "@shikijs/langs/css";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import go from "@shikijs/langs/go";
import bash from "@shikijs/langs/bash";
import markdown from "@shikijs/langs/markdown";

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

const THEMES = [darkPlus, githubLight, githubDark, dracula, nord];
const LANGS = [
  javascript,
  typescript,
  json,
  html,
  css,
  python,
  rust,
  go,
  bash,
  markdown,
];

// Lazy-initialized highlighter (created on first use)
let highlighter: ReturnType<typeof createHighlighterCoreSync> | null = null;

function getHighlighter() {
  if (!highlighter) {
    highlighter = createHighlighterCoreSync({
      themes: THEMES,
      langs: LANGS,
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighter;
}

export interface HighlightOptions {
  /** Language to highlight as */
  lang: LangName;
  /** Theme name (default: 'dark-plus') */
  theme?: ThemeName;
  /** Show line numbers (default: false) */
  lineNumbers?: boolean;
}

/**
 * Highlight code with syntax highlighting.
 * Returns HTML string with inline styles.
 *
 * @example
 * ```typescript
 * // In render function
 * const html = ctx.std.code.highlight(`const x = 1;`, { lang: 'typescript' });
 *
 * // Direct import for static code (highlighted once at module load)
 * import { highlight } from '@superimg/stdlib/code';
 * const html = highlight(`const x = 1;`, { lang: 'typescript', theme: 'dracula' });
 * ```
 */
export function highlight(code: string, options: HighlightOptions): string {
  const { lang, theme = "dark-plus", lineNumbers = false } = options;
  const shiki = getHighlighter();

  const html = shiki.codeToHtml(code, {
    lang,
    theme,
  });

  if (lineNumbers) {
    return addLineNumbers(html);
  }

  return html;
}

/**
 * Add line numbers to highlighted HTML.
 */
function addLineNumbers(html: string): string {
  // Shiki outputs: <pre ...><code>...lines...</code></pre>
  // We wrap each line with a numbered span
  return html.replace(
    /(<code[^>]*>)([\s\S]*?)(<\/code>)/,
    (_, open, content, close) => {
      const lines = content.split("\n");
      const numbered = lines
        .map((line: string, i: number) => {
          const num = i + 1;
          const padding = String(lines.length).length;
          const lineNum = String(num).padStart(padding, " ");
          return `<span class="line"><span class="line-number" style="user-select:none;opacity:0.5;margin-right:1em;">${lineNum}</span>${line}</span>`;
        })
        .join("\n");
      return `${open}${numbered}${close}`;
    }
  );
}

/**
 * Get list of available themes.
 */
export function getThemes(): ThemeName[] {
  return ["dark-plus", "github-light", "github-dark", "dracula", "nord"];
}

/**
 * Get list of available languages.
 */
export function getLangs(): LangName[] {
  return [
    "javascript",
    "js",
    "typescript",
    "ts",
    "json",
    "html",
    "css",
    "python",
    "py",
    "rust",
    "go",
    "bash",
    "sh",
    "markdown",
    "md",
  ];
}
