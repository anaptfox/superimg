import { describe, expect, it } from "vitest";
import { image, type JsonObject } from "@superimg/types";
import { Html } from "@superimg/core/template-runtime";
import {
  renderToHtml,
  type NativeRenderOptions,
} from "../runtime.html.js";

describe("runtime/html", () => {
  it("renders an already-realized media module synchronously", () => {
    const media = image<JsonObject>({
      size: { width: 320, height: 180 },
      sample: { greeting: "sample" },
      render: (ctx) =>
        Html({
          width: "fill",
          height: "fill",
          html: `<main data-width="${ctx.width}">${ctx.data.greeting}</main>`,
        }),
    });

    const html = renderToHtml({
      media,
      data: { greeting: "runtime" },
    });

    expect(html).toContain("runtime");
    expect(html).toContain('data-width="320"');
  });

  it("preserves bare-frame output", () => {
    const media = image<JsonObject>({
      size: { width: 64, height: 32 },
      render: () => Html({ html: "<span>bare</span>" }),
    });

    const html = renderToHtml({ media, composite: false });

    expect(html).toContain("<span>bare</span>");
    expect(html).not.toContain("<!DOCTYPE html>");
  });

  it("rejects author source instead of loading a compiler", () => {
    expect(() =>
      renderToHtml({
        media: "export default image({})" as unknown as NativeRenderOptions["media"],
      }),
    ).toThrow(/already-realized media module/u);
  });
});

const media = image({ render: () => Html({ html: "typed" }) });
const moduleInput: NativeRenderOptions["media"] = media;
void moduleInput;

// Source compilation belongs to compiler-enabled hosts, not runtime/html.
// @ts-expect-error runtime/html accepts only already-realized media modules.
const sourceInput: NativeRenderOptions["media"] = "export default image({})";
void sourceInput;
