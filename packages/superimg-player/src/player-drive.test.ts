/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriveController } from "./player-drive.js";

function makeTarget() {
  return {
    seek: vi.fn(),
    currentProgress: 0,
    totalFrames: 11,
    beginGestureSeek: vi.fn(),
    endGestureSeek: vi.fn(),
  };
}

describe("DriveController", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 100, top: 0, height: 80, right: 100, bottom: 80 }),
    });
    Object.defineProperty(container, "offsetHeight", { value: 80 });
    document.body.appendChild(container);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce") ? false : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it("pointer down seeks 1:1 and begins a gesture", () => {
    const target = makeTarget();
    const drive = new DriveController(container, "pointer", () => target);
    drive.install();
    container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 40, bubbles: true }));
    expect(target.beginGestureSeek).toHaveBeenCalled();
    expect(target.seek).toHaveBeenCalledWith({ frame: 4 });
    drive.dispose();
    expect(target.endGestureSeek).toHaveBeenCalled();
  });

  it("scroll maps parent travel to a frame", () => {
    const section = document.createElement("div");
    Object.defineProperty(section, "offsetHeight", { value: 400 });
    Object.defineProperty(section, "getBoundingClientRect", {
      value: () => ({ top: -160, left: 0, width: 100, height: 400, right: 100, bottom: 240 }),
    });
    section.appendChild(container);
    document.body.appendChild(section);
    const target = makeTarget();
    const drive = new DriveController(container, "scroll", () => target);
    drive.install();
    expect(target.seek).toHaveBeenCalledWith({ frame: 5 });
    drive.dispose();
    section.remove();
  });

  it("cancels pointer momentum and releases capture when an active drag is cancelled", () => {
    const target = makeTarget();
    container.setPointerCapture = vi.fn();
    container.releasePointerCapture = vi.fn();
    const drive = new DriveController(container, "pointer", () => target);
    drive.install();
    container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 20, pointerId: 7 }));
    container.dispatchEvent(new PointerEvent("pointermove", { clientX: 60, pointerId: 7 }));
    target.endGestureSeek.mockClear();
    container.dispatchEvent(new PointerEvent("pointercancel", { clientX: 60, pointerId: 7 }));
    expect(target.endGestureSeek).toHaveBeenCalledTimes(1);
    expect(container.releasePointerCapture).toHaveBeenCalledWith(7);
    drive.dispose();
  });

  it("reduced motion holds frame 0 and ignores pointer", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
    const target = makeTarget();
    const drive = new DriveController(container, "pointer", () => target);
    drive.install();
    expect(target.seek).toHaveBeenCalledWith({ frame: 0 });
    target.seek.mockClear();
    container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 80, bubbles: true }));
    expect(target.beginGestureSeek).not.toHaveBeenCalled();
    drive.dispose();
  });

  it.each(["pointer", "scroll"] as const)("suspends %s input when reduced motion changes and restores it afterward", (source) => {
    let reduced = false;
    let onMotion: () => void = () => undefined;
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() { return reduced; }, media: query,
      addEventListener: (_name: string, listener: () => void) => { onMotion = listener; },
      removeEventListener: vi.fn(),
    }));
    let top = -160;
    const section = document.createElement("div");
    Object.defineProperties(section, {
      offsetHeight: { value: 400 },
      getBoundingClientRect: { value: () => ({ top, left: 0, width: 100, height: 400 }) },
    });
    section.append(container);
    document.body.append(section);
    container.setPointerCapture = vi.fn();
    container.releasePointerCapture = vi.fn();
    const target = makeTarget();
    const drive = new DriveController(container, source, () => target);
    try {
      drive.install();
      if (source === "pointer") container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 40, pointerId: 7 }));
      reduced = true;
      onMotion();
      expect(target.seek).toHaveBeenLastCalledWith({ frame: 0 });
      if (source === "pointer") expect(container.releasePointerCapture).toHaveBeenCalledWith(7);
      target.seek.mockClear();
      target.beginGestureSeek.mockClear();
      container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 80, pointerId: 8 }));
      container.dispatchEvent(new PointerEvent("pointermove", { clientX: 90, pointerId: 8 }));
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
      expect(target.seek).not.toHaveBeenCalled();
      expect(target.beginGestureSeek).not.toHaveBeenCalled();
      top = -256;
      reduced = false;
      onMotion();
      if (source === "pointer") container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 80, pointerId: 8 }));
      expect(target.seek).toHaveBeenLastCalledWith({ frame: 8 });
    } finally { drive.dispose(); section.remove(); }
  });

  it("installs pointer input after an initially reduced preference is disabled", () => {
    let reduced = true;
    let onMotion: () => void = () => undefined;
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() { return reduced; }, media: query,
      addEventListener: (_name: string, listener: () => void) => { onMotion = listener; },
      removeEventListener: vi.fn(),
    }));
    container.setPointerCapture = vi.fn();
    container.releasePointerCapture = vi.fn();
    const target = makeTarget();
    const drive = new DriveController(container, "pointer", () => target);
    try {
      drive.install();
      expect(target.seek).toHaveBeenLastCalledWith({ frame: 0 });
      target.seek.mockClear();
      container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 80, pointerId: 7 }));
      expect(target.seek).not.toHaveBeenCalled();
      reduced = false;
      onMotion();
      container.dispatchEvent(new PointerEvent("pointerdown", { clientX: 80, pointerId: 7 }));
      expect(target.seek).toHaveBeenLastCalledWith({ frame: 8 });
    } finally { drive.dispose(); }
  });
});
