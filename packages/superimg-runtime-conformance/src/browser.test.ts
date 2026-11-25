import { init, type InitOptions, type Runtime } from "@foxworth/superimg/runtime";
import type { FontDeclaration } from "@superimg/types";
import inter400Url from "../../superimg-core/assets/fonts/Inter-400.ttf?url";
import inter500Url from "../../superimg-core/assets/fonts/Inter-500.ttf?url";
import inter700Url from "../../superimg-core/assets/fonts/Inter-700.ttf?url";
import { registerRuntimeConformance } from "./contract.js";

async function interFace(weight: number, url: string): Promise<FontDeclaration> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load bundled Inter ${weight} from ${url}`);
  return { family: "Inter", weight, style: "normal", src: new Uint8Array(await response.arrayBuffer()) };
}

const defaultFonts = Promise.all([
  interFace(400, inter400Url),
  interFace(500, inter500Url),
  interFace(700, inter700Url),
]);

registerRuntimeConformance({
  name: "browser",
  providerCollections: false,
  // Vitest's browser server does not expose the assembled runtime's relative
  // font URLs, so the harness fetches the same TTF bytes and passes them in.
  init: async (options?: InitOptions): Promise<Runtime> => init({
    ...options,
    defaultFonts: await defaultFonts,
  }),
});
