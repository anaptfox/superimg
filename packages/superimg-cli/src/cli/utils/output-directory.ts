import { extname } from "node:path";

const MEDIA_EXTENSIONS = /^(?:\.mp4|\.webm|\.mov|\.gif|\.png|\.jpe?g|\.webp|\.svg)$/i;

export function isMediaFilename(output: string | undefined): output is string {
  if (!output) return false;
  return MEDIA_EXTENSIONS.test(extname(output));
}

/** Export publishes a directory even if its name resembles a media file. */
export function warnIfMediaFilename(output: string | undefined): void {
  if (isMediaFilename(output)) {
    console.warn(`Warning: --output names a bundle directory, not a media file; ${JSON.stringify(output)} will be a directory containing the exported media.`);
  }
}
