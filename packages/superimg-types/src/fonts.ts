/** URL, absolute or relative file path, or raw SFNT bytes. */
export type FontSource = string | Uint8Array | ArrayBuffer;

export interface FontDeclaration {
  family: string;
  weight?: number;
  style?: "normal" | "italic";
  src: FontSource;
}

/** Google Fonts CSS2 family spec, for example "Anton" or "JetBrains+Mono:wght@400;500". */
export interface GoogleFontDeclaration {
  kind: "google";
  spec: string;
}

export type FontInput = FontDeclaration | GoogleFontDeclaration;

export function googleFont(spec: string): GoogleFontDeclaration {
  return { kind: "google", spec };
}

export function isGoogleFontDeclaration(value: unknown): value is GoogleFontDeclaration {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "google"
    && typeof (value as { spec?: unknown }).spec === "string";
}

export function isFontDeclaration(value: unknown): value is FontDeclaration {
  return typeof value === "object" && value !== null && !isGoogleFontDeclaration(value)
    && typeof (value as { family?: unknown }).family === "string"
    && "src" in value;
}

/**
 * Runtime check for `fonts` entries. Bare strings are rejected so callers
 * switch to `googleFont("…")` or a `{ family, src }` declaration.
 */
export function fontDeclarationIssue(value: unknown): { code: "FONT_DECLARATION_INVALID"; message: string } | undefined {
  if (typeof value === "string") {
    const shown = value.trim().length > 0 ? value.trim() : value;
    return {
      code: "FONT_DECLARATION_INVALID",
      message: `Use googleFont(${JSON.stringify(shown)}) instead of a bare font string.`,
    };
  }
  if (isGoogleFontDeclaration(value)) {
    if (value.spec.trim().length === 0) {
      return {
        code: "FONT_DECLARATION_INVALID",
        message: 'googleFont("…") requires a non-empty Google Fonts spec.',
      };
    }
    return undefined;
  }
  if (isFontDeclaration(value)) {
    if (value.family.trim().length === 0) {
      return { code: "FONT_DECLARATION_INVALID", message: "Font declarations require a non-empty family." };
    }
    if (value.weight !== undefined && (!Number.isFinite(value.weight) || value.weight <= 0)) {
      return { code: "FONT_DECLARATION_INVALID", message: `Font weight for ${JSON.stringify(value.family)} must be a positive number.` };
    }
    if (value.style !== undefined && value.style !== "normal" && value.style !== "italic") {
      return { code: "FONT_DECLARATION_INVALID", message: `Font style for ${JSON.stringify(value.family)} must be "normal" or "italic".` };
    }
    if (typeof value.src === "string") {
      if (value.src.trim().length === 0) {
        return { code: "FONT_DECLARATION_INVALID", message: `Font ${JSON.stringify(value.family)} needs a non-empty src path or URL.` };
      }
      return undefined;
    }
    if (value.src instanceof Uint8Array) {
      if (value.src.byteLength === 0) {
        return { code: "FONT_DECLARATION_INVALID", message: `Font ${JSON.stringify(value.family)} needs non-empty src bytes.` };
      }
      return undefined;
    }
    if (value.src instanceof ArrayBuffer) {
      if (value.src.byteLength === 0) {
        return { code: "FONT_DECLARATION_INVALID", message: `Font ${JSON.stringify(value.family)} needs non-empty src bytes.` };
      }
      return undefined;
    }
  }
  return {
    code: "FONT_DECLARATION_INVALID",
    message: 'Font entries must be googleFont("…") or { family, src }.',
  };
}
