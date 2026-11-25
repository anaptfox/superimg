import type { MediaCapabilities } from "@superimg/types";

export const STDLIB_CAPABILITIES = [
  "math",
  "color",
  "date",
  "text",
  "layout",
  "svg",
  "viz",
  "subtitle",
  "backgrounds",
  "montage",
  "path",
  "reveal",
  "responsive",
  "carousel",
  "stack",
  "spring",
  "stagger",
  "timing",
  "phases",
  "motion",
  "safe-area",
  "oscillate",
  "ready",
  "layout-timeline",
  "interpolate",
  "code",
  "rough",
  "katex",
  "lottie",
  "mermaid",
  "three",
] as const;

export type StdlibCapability = (typeof STDLIB_CAPABILITIES)[number];

const STDLIB_CAPABILITY_SET: ReadonlySet<string> = new Set(STDLIB_CAPABILITIES);

export function declaredStdlibCapabilities(
  template: { readonly mediaCapabilities?: MediaCapabilities },
): StdlibCapability[] | undefined {
  const declared = template.mediaCapabilities;
  if (declared?.version !== 0) return undefined;

  const seen = new Set<StdlibCapability>();
  for (const entry of declared.names) {
    const name = typeof entry === "string" ? entry : entry.name;
    if (STDLIB_CAPABILITY_SET.has(name)) seen.add(name as StdlibCapability);
  }
  return STDLIB_CAPABILITIES.filter((name) => seen.has(name));
}
