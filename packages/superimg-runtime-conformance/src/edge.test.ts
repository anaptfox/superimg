import { describe, expect, it } from "vitest";
import { Html, image, googleFont } from "@foxworth/superimg";
import { init, type InitOptions, type Runtime } from "@foxworth/superimg/runtime";
import { renderToHtml } from "@foxworth/superimg/runtime/html";
import type { FontDeclaration } from "@superimg/types";
import inter400 from "../../superimg-core/assets/fonts/Inter-400.ttf";
import inter500 from "../../superimg-core/assets/fonts/Inter-500.ttf";
import inter700 from "../../superimg-core/assets/fonts/Inter-700.ttf";
import { registerRuntimeConformance } from "./contract.js";

function interFace(weight: number, bytes: ArrayBuffer): FontDeclaration {
  return { family: "Inter", weight, style: "normal", src: new Uint8Array(bytes) };
}

const defaultFonts = [
  interFace(400, inter400),
  interFace(500, inter500),
  interFace(700, inter700),
];

registerRuntimeConformance({
  name: "edge",
  providerCollections: false,
  init: (options?: InitOptions): Promise<Runtime> => init({ ...options, defaultFonts }),
});

describe("pure HTML runtime", () => {
  it("renders an authored value synchronously inside workerd", () => {
    const media = image({
      size: { width: 64, height: 32 },
      fonts: [googleFont("Inter:wght@400")],
      render: () => Html({ html: "<main>workerd html</main>" }),
    });
    expect(renderToHtml({ media })).toContain("workerd html");
  });
});
