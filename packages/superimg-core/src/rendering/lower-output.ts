//! Lower `render()` output to an HTML/SVG string at the runtime boundary.

import {
  isMediaElement,
  isRenderOutput,
  type Medium,
  type RenderOutput,
} from "@superimg/types";
import { lower } from "@superimg/stdlib/tree/lower";
import type { TextMeasurer } from "@superimg/stdlib/svg";

export function lowerRenderOutput(
  output: unknown,
  medium: Medium = "html",
  canvas?: { width?: number; height?: number; measurer?: TextMeasurer; onSerializationComplete?: (escaped: boolean) => void },
): string {
  if (isMediaElement(output)) {
    return lower(output, {
      medium,
      ...(canvas?.width !== undefined ? { width: canvas.width } : {}),
      ...(canvas?.height !== undefined ? { height: canvas.height } : {}),
      ...(canvas?.measurer !== undefined ? { measurer: canvas.measurer } : {}),
      ...(canvas?.onSerializationComplete ? { onSerializationComplete: canvas.onSerializationComplete } : {}),
    });
  }
  throw new TypeError(
    `render() returned ${typeof output} instead of a media tree`,
  );
}

export function asRenderOutput(output: unknown): RenderOutput {
  if (!isRenderOutput(output)) {
    throw new TypeError(
      `render() returned ${typeof output} instead of a media tree`,
    );
  }
  return output;
}
