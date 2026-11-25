// The accepted type: Newsreader 500 for headlines, IBM Plex Sans 400/600 for
// everything else. Both are SIL OFL fonts shipped in ./assets/fonts with their
// licences and declared on the media so text is measured natively.
import type { FontDeclaration } from "@foxworth/superimg";

export const FONT = { serif: "Newsreader", sans: "IBM Plex Sans" } as const;

/** Font files in ./assets/fonts, resolved by the media file that declares them. */
export const fontFiles = [
  { family: FONT.serif, weight: 500, file: "Newsreader-Medium.ttf" },
  { family: FONT.sans, weight: 400, file: "IBMPlexSans-Regular.ttf" },
  { family: FONT.sans, weight: 600, file: "IBMPlexSans-SemiBold.ttf" },
] as const;

export const fontsAt = (resolve: (file: string) => string): FontDeclaration[] =>
  fontFiles.map(f => ({ family: f.family, weight: f.weight, src: resolve(f.file) }));
