import type { RenderOutput } from "@superimg/types";
import { Html, Vector, lower } from "@superimg/stdlib/tree";

export {
  makeTestContext,
  makeTestContextAtProgress,
  makeTestContextAtSeconds,
  compileFromString,
} from "./context.js";

export function boxedHtml(html: string): RenderOutput {
  return Html({ width: "fill", height: "fill", html });
}

export function boxedSvg(html: string, width = 1920, height = 1080): RenderOutput {
  return Vector(
    { width, height, viewBox: { x: 0, y: 0, width, height } },
    Html({ width: "fill", height: "fill", html }),
  );
}

/** Lower authored tree output for string-oriented assertions. */
export function asMarkup(output: RenderOutput): string {
  if (output.type === "Html" && typeof output.props.html === "string") {
    return output.props.html;
  }
  return lower(output);
}
