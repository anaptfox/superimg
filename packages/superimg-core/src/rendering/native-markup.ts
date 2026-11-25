import { SuperImgError } from "@superimg/types";

/** Detect the native executable tag without mistaking comments or script text for markup. */
export function assertNoNativeSurfaceMarkup(markup: string): void {
  const tokens = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b(?:"[^"]*"|'[^']*'|[^'">])*?>[\s\S]*?<\/\1\s*>|<script\b(?:"[^"]*"|'[^']*'|[^'">])*?>/gi;
  for (const match of markup.matchAll(tokens)) {
    const tag = match[0];
    if (!/^<script\b/i.test(tag)) continue;
    const opening = /^<script\b(?:"[^"]*"|'[^']*'|[^'">])*?>/i.exec(tag)?.[0];
    if (!opening) continue;
    const attributes = opening.slice(7).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g);
    if ([...attributes].some(attribute => attribute[1]?.toLowerCase() === "data-superimg-native")) {
      throw new SuperImgError("Native surfaces are not supported by this runtime", "NATIVE_SURFACE_UNSUPPORTED", {}, "Use the trusted Node runtime or development preview for this media.");
    }
  }
}
