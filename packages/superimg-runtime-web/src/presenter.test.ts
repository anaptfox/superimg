import { describe, expect, it } from "vitest";
import { defineImage } from "@superimg/types";
import { IframePresenter } from "./presenter.js";
import { createRuntime } from "./runtime.js";

const sandboxOf = (el: HTMLElement) => el.getAttribute("sandbox");

describe("IframePresenter sandbox", () => {
  it("defaults to a script-less sandbox (no allow-scripts → no escape warning)", () => {
    const presenter = new IframePresenter();
    expect(sandboxOf(presenter.getElement())).toBe("allow-same-origin");
  });

  it("adds allow-scripts only when explicitly requested", () => {
    const presenter = new IframePresenter({ allowScripts: true });
    const sandbox = sandboxOf(presenter.getElement());
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
  });
});

describe("WebRuntime → iframe sandbox", () => {
  const template = (config: Record<string, unknown>) =>
    defineImage({
      sample: {},
      config: { width: 800, height: 600, ...config },
      render: () => `<main>hi</main>`,
    });

  it("plain templates render script-free", () => {
    const runtime = createRuntime(template({}), {});
    expect(sandboxOf(runtime.getElement())).toBe("allow-same-origin");
  });

  it("Tailwind templates get allow-scripts (the CDN <script> needs it)", () => {
    const runtime = createRuntime(template({ tailwind: true }), {});
    expect(sandboxOf(runtime.getElement())).toContain("allow-scripts");
  });

  it("honors the explicit allowScripts escape hatch", () => {
    const runtime = createRuntime(template({}), { allowScripts: true });
    expect(sandboxOf(runtime.getElement())).toContain("allow-scripts");
  });
});
