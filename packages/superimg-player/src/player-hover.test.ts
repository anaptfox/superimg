/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoverController } from "./player-hover.js";

function makeTarget() {
  return {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
  };
}

describe("HoverController", () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
  });

  it("does nothing when behavior is none", () => {
    const target = makeTarget();
    const c = new HoverController(
      container,
      { behavior: "none", delayMs: 0 },
      () => target,
    );
    c.install();
    container.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    vi.runAllTimers();
    container.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(target.play).not.toHaveBeenCalled();
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.seek).not.toHaveBeenCalled();
    c.dispose();
  });

  it("play: enters after delay, leave pauses without seeking (default)", () => {
    const target = makeTarget();
    const c = new HoverController(
      container,
      { behavior: "play", delayMs: 100 },
      () => target,
    );
    c.install();

    container.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(target.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(target.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(target.play).toHaveBeenCalledTimes(1);

    container.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(target.pause).toHaveBeenCalledTimes(1);
    // Core fix: do not jump to empty intro frame 0 by default
    expect(target.seek).not.toHaveBeenCalled();
    c.dispose();
  });

  it("play + leaveBehavior reset: leave seeks frame 0", () => {
    const target = makeTarget();
    const c = new HoverController(
      container,
      { behavior: "play", delayMs: 0, leaveBehavior: "reset" },
      () => target,
    );
    c.install();

    container.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    vi.runAllTimers();
    container.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(target.pause).toHaveBeenCalled();
    expect(target.seek).toHaveBeenCalledWith({ frame: 0 });
    c.dispose();
  });

  it("play: leave before delay cancels pending play", () => {
    const target = makeTarget();
    const c = new HoverController(
      container,
      { behavior: "play", delayMs: 200 },
      () => target,
    );
    c.install();

    container.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    vi.advanceTimersByTime(50);
    container.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(target.play).not.toHaveBeenCalled();
    expect(target.pause).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it("preview-scrub: mousemove seeks progress; leave resets to frame 0", () => {
    const target = makeTarget();
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 100, top: 0, height: 50, right: 100, bottom: 50 }),
    });
    const c = new HoverController(
      container,
      { behavior: "preview-scrub", delayMs: 0 },
      () => target,
    );
    c.install();

    container.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 40, clientY: 10, bubbles: true }),
    );
    expect(target.seek).toHaveBeenCalledWith({ progress: 0.4 });

    container.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(target.pause).toHaveBeenCalled();
    expect(target.seek).toHaveBeenCalledWith({ frame: 0 });
    c.dispose();
  });

  it("suppress skips preview-scrub seeks", () => {
    const target = makeTarget();
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 100, top: 0, height: 50, right: 100, bottom: 50 }),
    });
    const c = new HoverController(
      container,
      { behavior: "preview-scrub", delayMs: 0 },
      () => target,
    );
    c.install();
    c.suppress(true);
    container.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 40, clientY: 10, bubbles: true }),
    );
    expect(target.seek).not.toHaveBeenCalled();
    c.dispose();
  });

  it("suspension cancels hover playback that was already scheduled", () => {
    const target = makeTarget();
    const controller = new HoverController(container, { behavior: "play", delayMs: 100 }, () => target);
    controller.install();
    container.dispatchEvent(new MouseEvent("mouseenter"));
    controller.suppress(true);
    vi.advanceTimersByTime(100);
    expect(target.play).not.toHaveBeenCalled();
    controller.suppress(false);
    container.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(100);
    expect(target.play).toHaveBeenCalledTimes(1);
    controller.dispose();
  });
});
