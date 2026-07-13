import { describe, expect, it, vi } from "vitest";
import { define } from "@superimg/types";
import { compose } from "@superimg/core";
import type { DomPresenter } from "./dom-presenter.js";
import { createMediaSession } from "./session.js";

class TestPresenter implements DomPresenter {
  element = document.createElement("div");
  records: Array<{ html: string; width: number; height: number }> = [];
  inlineCss: string[] = [];

  attach(container: HTMLElement): void {
    container.appendChild(this.element);
  }

  present(html: string, width: number, height: number): void {
    this.records.push({ html, width, height });
    this.element.innerHTML = html;
  }

  setLogicalSize(): void {}

  injectStyles(inlineCss?: string[]): void {
    this.inlineCss = inlineCss ?? [];
  }

  getElement(): HTMLElement {
    return this.element;
  }

  dispose(): void {
    this.element.remove();
  }
}

class DelayedPresenter extends TestPresenter {
  async present(html: string, width: number, height: number): Promise<void> {
    const frame = Number(html.match(/data-frame="(\d+)"/)?.[1] ?? 0);
    await new Promise((resolve) => setTimeout(resolve, frame === 1 ? 20 : 1));
    super.present(html, width, height);
  }
}

const template = define({
  sample: { label: "hello" },
  config: {
    width: 640,
    height: 360,
    fps: 10,
    duration: 1,
    inlineCss: ["body{font-family:system-ui}"],
  },
  render: (ctx) => {
    const clip = ctx.std.media.youtube({
      videoId: "abcdefghijk",
      at: ctx.timeline.seconds,
      width: 320,
      height: 180,
    });
    return `<main data-frame="${ctx.globalFrame}"><strong>${ctx.data.label}</strong>${clip.html}</main>`;
  },
});

describe("MediaSession", () => {
  it("mounts, waits for readiness, and renders a media graph", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, data: { label: "ready" } });
    await session.mount(document.createElement("div"));
    await session.ready();

    const result = await session.renderFrame(5);

    expect(session.getState()).toMatchObject({
      isReady: true,
      currentFrame: 5,
      fps: 10,
      totalFrames: 10,
      width: 640,
      height: 360,
    });
    expect(result.graph.externalEmbeds).toHaveLength(1);
    expect(presenter.records.at(-1)?.html).toContain('data-frame="5"');
    expect(presenter.inlineCss.join("\n")).toContain("font-family");

    session.dispose();
  });

  it("exposes runtime medium and animation metadata", async () => {
    const presenter = new TestPresenter();
    const svgTemplate = define({ medium: "svg",
      config: { width: 400, height: 300, duration: "2s" },
      render: (ctx) => `<svg width="${ctx.width}" height="${ctx.height}"></svg>`,
    });
    const session = await createMediaSession(svgTemplate, { presenter });

    await session.mount(document.createElement("div"));

    expect(session.getState()).toMatchObject({
      medium: "svg",
      animated: false,
      totalFrames: 1,
      duration: 2,
      width: 400,
      height: 300,
    });

    session.dispose();
  });

  it("re-emits scene changes from composed templates", async () => {
    const sceneA = define({
      sample: {},
      config: { width: 320, height: 180, fps: 10, duration: 0.5 },
      render: (ctx) => `<main>A:${ctx.globalFrame}</main>`,
    });
    const sceneB = define({
      sample: {},
      config: { width: 320, height: 180, fps: 10, duration: 0.5 },
      render: (ctx) => `<main>B:${ctx.globalFrame}</main>`,
    });
    const template = compose([
      { id: "a", template: sceneA },
      { id: "b", template: sceneB },
    ]);
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    const sceneIds: string[] = [];
    session.on("scenechange", (scene) => sceneIds.push(scene.id));

    await session.mount(document.createElement("div"));
    await session.renderFrame(5);

    expect(sceneIds).toContain("a");
    expect(sceneIds).toContain("b");

    session.dispose();
  });

  it("keeps native video elements paused in deterministic playback mode", async () => {
    const mediaTemplate = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => {
        const clip = ctx.std.media.video({ src: "/clip.mp4", at: ctx.timeline.seconds });
        return clip.html;
      },
    });
    const presenter = new TestPresenter();
    const session = await createMediaSession(mediaTemplate, {
      presenter,
      playback: "deterministic",
    });
    await session.mount(document.createElement("div"));
    const video = presenter.element.querySelector("video") as HTMLVideoElement;
    const play = vi.fn(() => Promise.resolve());
    const pause = vi.fn();
    video.play = play;
    video.pause = pause;

    session.play();

    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();

    session.dispose();
  });

  it("prevents stale rapid renders from overwriting session state", async () => {
    const presenter = new DelayedPresenter();
    const session = await createMediaSession(template, { presenter });
    await session.mount(document.createElement("div"));

    await Promise.all([session.seekFrame(1), session.seekFrame(3)]);

    expect(session.getState().currentFrame).toBe(3);
    expect(presenter.records.at(-1)?.html).toContain('data-frame="3"');
    expect(presenter.records.filter((record) => record.html.includes('data-frame="1"'))).toHaveLength(0);

    session.dispose();
  });

  it("presents exactly one initial frame during mount", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });

    await session.mount(document.createElement("div"));

    expect(presenter.records).toHaveLength(1);
    session.dispose();
  });

  it("publishes state changes to subscribers", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    await session.mount(document.createElement("div"));
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    await session.seekFrame(4);
    session.play();
    session.pause();

    expect(listener).toHaveBeenCalled();
    expect(session.getState().isPlaying).toBe(false);

    unsubscribe();
    session.dispose();
  });
});
