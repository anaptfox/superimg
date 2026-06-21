import { describe, expect, it } from "vitest";
import { defineGif, defineImage, defineScene, defineSvg } from "@superimg/types";
import { createRuntime, mount } from "./runtime.js";
import type { DomPresenter } from "./presenter.js";

class TestPresenter implements DomPresenter {
  element = document.createElement("div");
  records: Array<{ html: string; width: number; height: number }> = [];

  attach(container: HTMLElement): void {
    container.appendChild(this.element);
  }

  present(html: string, width: number, height: number): void {
    this.records.push({ html, width, height });
    this.element.innerHTML = html;
  }

  injectStyles(): void {}

  getElement(): HTMLElement {
    return this.element;
  }

  dispose(): void {
    this.element.remove();
  }
}

describe("runtime-web", () => {
  it("mounts image templates and updates data without recreating the presenter", () => {
    const template = defineImage({
      sample: { label: "initial" },
      config: { width: 800, height: 600 },
      render: (ctx) => `<main>${ctx.data.label}:${ctx.width}x${ctx.height}</main>`,
    });
    const container = document.createElement("div");
    const presenter = new TestPresenter();

    const runtime = createRuntime(template, { presenter });
    runtime.attach(container);
    const element = runtime.getElement();

    expect(runtime.getState().kind).toBe("image");
    expect(presenter.records.at(-1)?.html).toContain("initial:800x600");

    runtime.update({ sample: { label: "updated" } });

    expect(runtime.getElement()).toBe(element);
    expect(presenter.records.at(-1)?.html).toContain("updated:800x600");
  });

  it("mounts SVG, GIF, and video template kinds", () => {
    const templates = [
      defineSvg({
        config: { width: 200, height: 100, duration: 2 },
        render: (ctx) => `<svg width="${ctx.width}" height="${ctx.height}"></svg>`,
      }),
      defineGif({
        config: { width: 320, height: 180, fps: 12, duration: 1 },
        render: (ctx) => `<div>gif:${ctx.globalFrame}</div>`,
      }),
      defineScene({
        config: { width: 640, height: 360, fps: 24, duration: 1 },
        render: (ctx) => `<div>video:${ctx.globalFrame}</div>`,
      }),
    ] as const;

    for (const template of templates) {
      const container = document.createElement("div");
      const presenter = new TestPresenter();
      const runtime = mount(container, template, { presenter });

      expect(runtime.getState().kind).toBe(template.kind);
      expect(presenter.records).toHaveLength(1);

      runtime.dispose();
    }
  });

  it("clamps frame, progress, and seconds seeks", () => {
    const template = defineScene({
      config: { width: 100, height: 100, fps: 10, duration: 1 },
      render: (ctx) => `<div>${ctx.globalFrame}</div>`,
    });
    const runtime = createRuntime(template, { presenter: new TestPresenter() });
    runtime.attach(document.createElement("div"));

    runtime.seekFrame(999);
    expect(runtime.getState().currentFrame).toBe(9);

    runtime.seekProgress(-1);
    expect(runtime.getState().currentFrame).toBe(0);

    runtime.seekTimeSeconds(0.5);
    expect(runtime.getState().currentFrame).toBe(5);
  });

  it("removes the presenter element on dispose", () => {
    const template = defineScene({
      config: { width: 100, height: 100, fps: 10, duration: 1 },
      render: () => "<div>frame</div>",
    });
    const container = document.createElement("div");
    const presenter = new TestPresenter();
    const runtime = mount(container, template, { presenter });

    expect(container.contains(presenter.element)).toBe(true);

    runtime.dispose();

    expect(container.contains(presenter.element)).toBe(false);
  });
});
