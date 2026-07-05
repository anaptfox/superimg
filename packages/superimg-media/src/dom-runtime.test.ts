import { afterEach, describe, expect, it, vi } from "vitest";
import { define } from "@superimg/types";
import { createRuntime, mount, type RuntimeInput } from "./dom-runtime.js";
import type { DomPresenter } from "./dom-presenter.js";

class TestPresenter implements DomPresenter {
  element = document.createElement("div");
  records: Array<{ html: string; width: number; height: number }> = [];

  attach(container: HTMLElement): void {
    container.appendChild(this.element);
  }

  present(html: string, width: number, height: number): void {
    this.setLogicalSize(width, height);
    this.records.push({ html, width, height });
    this.element.innerHTML = html;
  }

  setLogicalSize(_width: number, _height: number): void {}

  injectStyles(): void {}

  getElement(): HTMLElement {
    return this.element;
  }

  dispose(): void {
    this.element.remove();
  }
}

class AsyncPresenter extends TestPresenter {
  async present(html: string, width: number, height: number): Promise<void> {
    await Promise.resolve();
    super.present(html, width, height);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("media DOM runtime", () => {
  it("mounts image templates and updates data without recreating the presenter", () => {
    const template = define({
      sample: { label: "initial" },
      config: { width: 800, height: 600 },
      render: (ctx) => `<main>${ctx.data.label}:${ctx.width}x${ctx.height}</main>`,
    });
    const container = document.createElement("div");
    const presenter = new TestPresenter();

    const runtime = createRuntime(template as unknown as RuntimeInput, { presenter });
    runtime.attach(container);
    const element = runtime.getElement();

    expect(runtime.getState().medium).toBe("html");
    expect(runtime.getState().animated).toBe(false);
    expect(presenter.records.at(-1)?.html).toContain("initial:800x600");

    runtime.update({ data: { label: "updated" } });

    expect(runtime.getElement()).toBe(element);
    expect(presenter.records.at(-1)?.html).toContain("updated:800x600");
  });

  it("mounts SVG, animated, and video templates", () => {
    const templates = [
      define({ medium: "svg",
        config: { width: 200, height: 100, duration: 2 },
        render: (ctx) => `<svg width="${ctx.width}" height="${ctx.height}"></svg>`,
      }),
      define({
        config: { width: 320, height: 180, fps: 12, duration: 1 },
        render: (ctx) => `<div>gif:${ctx.globalFrame}</div>`,
      }),
      define({
        config: { width: 640, height: 360, fps: 24, duration: 1 },
        render: (ctx) => `<div>video:${ctx.globalFrame}</div>`,
      }),
    ] as const;

    for (const template of templates) {
      const container = document.createElement("div");
      const presenter = new TestPresenter();
      const runtime = mount(container, template as unknown as RuntimeInput, { presenter });

      expect(runtime.getState().medium).toBe(template.medium);
      expect(runtime.getState().animated).toBe(template.animated);
      expect(presenter.records).toHaveLength(1);

      runtime.dispose();
    }
  });

  it("clamps frame, progress, and seconds seeks", () => {
    const template = define({
      config: { width: 100, height: 100, fps: 10, duration: 1 },
      render: (ctx) => `<div>${ctx.globalFrame}</div>`,
    });
    const runtime = createRuntime(template as unknown as RuntimeInput, { presenter: new TestPresenter() });
    runtime.attach(document.createElement("div"));

    runtime.seekFrame(999);
    expect(runtime.getState().currentFrame).toBe(9);

    runtime.seekProgress(-1);
    expect(runtime.getState().currentFrame).toBe(0);

    runtime.seekTimeSeconds(0.5);
    expect(runtime.getState().currentFrame).toBe(5);
  });

  it("awaits async presenters before emitting rendered", async () => {
    const template = define({
      config: { width: 100, height: 100, fps: 10, duration: 1 },
      render: (ctx) => `<div>${ctx.globalFrame}</div>`,
    });
    const presenter = new AsyncPresenter();
    const runtime = createRuntime(template as unknown as RuntimeInput, { presenter });
    const recordCounts: number[] = [];
    runtime.on("rendered", () => recordCounts.push(presenter.records.length));

    await runtime.render(0);

    expect(recordCounts).toEqual([1]);
  });

  it("renders the final frame before emitting ended", async () => {
    let now = 0;
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const template = define({
      config: { width: 100, height: 100, fps: 10, duration: 0.5 },
      render: (ctx) => `<div>${ctx.globalFrame}</div>`,
    });
    const presenter = new TestPresenter();
    const runtime = createRuntime(template as unknown as RuntimeInput, { presenter });
    const events: string[] = [];
    runtime.on("rendered", (payload) => events.push(`rendered:${payload.frame}`));
    runtime.on("ended", () => events.push("ended"));
    runtime.attach(document.createElement("div"));
    await runtime.render(0);

    runtime.play();
    now = 1000;
    callbacks.shift()?.(now);
    await Promise.resolve();
    await Promise.resolve();

    expect(events.at(-2)).toBe("rendered:4");
    expect(events.at(-1)).toBe("ended");
    expect(presenter.records.at(-1)?.html).toContain("<div>4</div>");
  });

  it("removes the presenter element on dispose", () => {
    const template = define({
      config: { width: 100, height: 100, fps: 10, duration: 1 },
      render: () => "<div>frame</div>",
    });
    const container = document.createElement("div");
    const presenter = new TestPresenter();
    const runtime = mount(container, template as unknown as RuntimeInput, { presenter });

    expect(container.contains(presenter.element)).toBe(true);

    runtime.dispose();

    expect(container.contains(presenter.element)).toBe(false);
  });
});
