import { readFile } from "node:fs/promises";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface Article {
  title: string;
  source: string;
  text: string;
}

const BLOCK_TAGS = /<\/?(article|section|main|header|footer|nav|aside|p|br|h[1-6]|li|ul|ol|blockquote|pre|div)[^>]*>/gi;
const MIN_READABLE_CHARS = 120;

export async function loadArticle(input: { url?: string; textPath?: string }): Promise<Article> {
  if (input.textPath) {
    const raw = await readFile(input.textPath, "utf-8");
    return parseArticle(raw, input.textPath);
  }

  if (!input.url) {
    throw new Error("Provide a URL or text path.");
  }

  const response = await fetch(input.url, {
    headers: {
      "user-agent": "blog-to-video-superimg-example/0.1",
      accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${input.url}`);
  }

  const raw = await response.text();
  return parseArticle(raw, input.url);
}

function parseArticle(raw: string, source: string): Article {
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (!looksHtml) {
    const text = normalizeText(raw);
    return {
      title: firstLine(text) ?? "Untitled post",
      source,
      text,
    };
  }

  const readable = extractWithReadability(raw, source);
  if (readable && readable.text.length >= MIN_READABLE_CHARS) {
    return readable;
  }

  const title = pickTitle(raw) ?? titleFromSource(source);
  const articleHtml = pickArticleHtml(raw);
  const withoutNoise = articleHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(BLOCK_TAGS, "\n")
    .replace(/<[^>]+>/g, " ");

  const text = normalizeText(decodeHtml(withoutNoise));
  return { title, source, text };
}

function extractWithReadability(html: string, source: string): Article | null {
  try {
    const { document } = parseHTML(html);
    const parsed = new Readability(document).parse();
    const text = normalizeText(parsed?.textContent ?? "");
    if (!text) return null;

    return {
      title: parsed?.title?.trim() || pickTitle(html) || titleFromSource(source),
      source,
      text,
    };
  } catch {
    return null;
  }
}

function pickArticleHtml(html: string): string {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article) return article[1];

  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) return main[1];

  return html;
}

function pickTitle(html: string): string | undefined {
  const candidates = [
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i)?.[1],
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ];

  const title = candidates.find(Boolean);
  return title ? normalizeText(decodeHtml(title.replace(/<[^>]+>/g, " "))).replace(/\s+[|-]\s+.*$/, "") : undefined;
}

function titleFromSource(source: string): string {
  try {
    const url = new URL(source);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Blog post";
  }
}

function firstLine(text: string): string | undefined {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const radix = body[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? body.slice(2) : body.slice(1);
      const code = Number.parseInt(digits, radix);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return named[body.toLowerCase()] ?? entity;
  });
}