import { describe, expect, it } from "vitest";
import { define } from "@superimg/types";
import { IframePresenter } from "./dom-presenter.js";
import { createRuntime } from "./dom-runtime.js";

const sandboxOf = (el: HTMLElement) => el.getAttribute("sandbox");

describe("IframePresenter setLogicalSize", () => {
  it("updates scale wrapper dimensions without presenting HTML", async () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 960, height: 540, x: 0, y: 0, top: 0, left: 0, right: 960, bottom: 540, toJSON: () => ({}) }),
    });
    document.body.appendChild(container);

    const presenter = new IframePresenter();
    presenter.attach(container);
    await new Promise<void>((resolve) => {
      presenter.getElement().addEventListener("load", () => resolve(), { once: true });
    });

    presenter.setLogicalSize(1080, 1920);

    const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument;
    const scaleWrapper = doc?.getElementById("scale-wrapper");
    expect(scaleWrapper?.style.width).toBe("1080px");
    expect(scaleWrapper?.style.height).toBe("1920px");

    presenter.dispose();
    document.body.removeChild(container);
  });
});

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

describe("Media DOM runtime iframe sandbox", () => {
  const template = (config: Record<string, unknown>) =>
    define({
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
