import { basename } from "node:path";

/** Extract the stable source id from a canonical `*.media.ts` path. */
export function deriveVideoName(templatePath: string): string {
  return basename(templatePath).replace(/\.media\.(ts|js)$/, "");
}
