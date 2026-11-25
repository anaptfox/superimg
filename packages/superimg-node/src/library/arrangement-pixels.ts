//! Checks that can be established from the actual retained PNG bytes.
import sharp from "sharp";
import type { RuntimeFinding } from "@superimg/types";

/** A single visible colour over the whole frame cannot contain an arrangement.
 * This deliberately does not infer sparse layout or text contrast from colours. */
export async function inspectArrangementPixels(png: Uint8Array, frame: number): Promise<RuntimeFinding[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height || info.channels !== 4) throw new Error("Cannot inspect arrangement pixels");
  // Fully transparent pixels have the same appearance regardless of RGB bytes.
  const alpha = data[3];
  for (let i = 4; i < data.length; i += 4) {
    if (data[i + 3] !== alpha || (alpha !== 0 && (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2]))) return [];
  }
  return [{ code: "EMPTY_RENDERED_CANVAS", severity: "error", category: "render", message: "The rendered arrangement contains only a single colour.", details: { frame, width: info.width, height: info.height, nodeId: "stage" } }];
}
