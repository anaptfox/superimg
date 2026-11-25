import {
  isGoogleFontDeclaration,
  type FontDeclaration,
  type FontInput,
} from "@superimg/types";

function bytesIdentity(source: Uint8Array | ArrayBuffer): string {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  let identity = "";
  for (const byte of bytes) identity += byte.toString(16).padStart(2, "0");
  return identity;
}

function sourceIdentity(source: FontDeclaration["src"]): string {
  if (typeof source === "string") return `path\0${source.trim()}`;
  return `bytes\0${bytesIdentity(source)}`;
}

function localFaceIdentity(font: FontDeclaration): string {
  return `local\0${font.family}\0${font.weight ?? 400}\0${font.style ?? "normal"}`;
}

function fontIdentity(font: FontInput): string {
  if (isGoogleFontDeclaration(font)) return `google\0${font.spec}`;
  return `${localFaceIdentity(font)}\0${sourceIdentity(font.src)}`;
}

/** Lift selected child font declarations onto a timed projection root. */
export function liftCompositionFonts(leaves: readonly { readonly path: string; readonly content: { readonly config?: { readonly fonts?: readonly FontInput[] } } }[]): readonly FontInput[] {
  const fonts: FontInput[] = [];
  const seen = new Set<string>();
  const localSources = new Map<string, string>();

  for (const leaf of leaves) {
    for (const font of leaf.content.config?.fonts ?? []) {
      const identity = fontIdentity(font);
      if (seen.has(identity)) continue;
      if (!isGoogleFontDeclaration(font)) {
        if (typeof font.src === "string" && !/^(?:https?:|file:)/i.test(font.src.trim()) && !font.src.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(font.src)) {
          throw new TypeError(`composition: ${leaf.path}: font ${JSON.stringify(font.family)} has a relative src; pass it through prepareComposition with an explicit sourceBase for this occurrence, or use an absolute URL/file path or bytes`);
        }
        const face = localFaceIdentity(font);
        const source = sourceIdentity(font.src);
        const existing = localSources.get(face);
        if (existing !== undefined && existing !== source) {
          throw new TypeError(`composition: font face ${JSON.stringify(font.family)} at ${font.weight ?? 400}/${font.style ?? "normal"} has conflicting sources`);
        }
        localSources.set(face, source);
      }
      seen.add(identity);
      fonts.push(font);
    }
  }

  return Object.freeze(fonts);
}
