import { describe, it, expect } from "vitest";
import { renderWithTransition, transitions } from "../composition/transitions.js";

const resolved = (type: string, duration = 0.5) => ({
  type: type as "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "none",
  duration,
});

describe("renderWithTransition", () => {
  const html = "<div>scene</div>";

  it("returns html unchanged for none transition", () => {
    expect(renderWithTransition(html, resolved("none"), 0.5)).toBe(html);
  });

  it("fades in during enter phase", () => {
    const start = renderWithTransition(html, resolved("fade"), 0, "enter");
    const end = renderWithTransition(html, resolved("fade"), 1, "enter");
    expect(start).toContain("opacity:0");
    expect(end).not.toContain("opacity:0");
    expect(end).toContain("scene");
  });

  it("fades out during exit phase", () => {
    const start = renderWithTransition(html, resolved("fade"), 0, "exit");
    const end = renderWithTransition(html, resolved("fade"), 1, "exit");
    expect(start).not.toContain("opacity:0");
    expect(end).toContain("opacity:0");
  });

  it("applies easing to fade enter", () => {
    const linear = renderWithTransition(html, resolved("fade"), 0.5, "enter");
    const eased = renderWithTransition(
      html,
      { ...resolved("fade"), easing: "easeOutCubic" },
      0.5,
      "enter"
    );
    const linearOpacity = parseFloat(linear.match(/opacity:([\d.]+)/)![1]!);
    const easedOpacity = parseFloat(eased.match(/opacity:([\d.]+)/)![1]!);
    expect(easedOpacity).toBeGreaterThan(linearOpacity);
  });

  it("slides left on enter", () => {
    const start = renderWithTransition(html, resolved("slide-left"), 0, "enter");
    const end = renderWithTransition(html, resolved("slide-left"), 1, "enter");
    expect(start).toContain("translateX(100%)");
    expect(end).toContain("translateX(0%)");
  });

  it("slides right on exit", () => {
    const start = renderWithTransition(html, resolved("slide-right"), 0, "exit");
    const end = renderWithTransition(html, resolved("slide-right"), 1, "exit");
    expect(start).toContain("translateX(100%)");
    expect(end).toContain("translateX(0%)");
  });

  it("slides up on enter", () => {
    const start = renderWithTransition(html, resolved("slide-up"), 0, "enter");
    expect(start).toContain("translateY(100%)");
  });

  it("slides down on enter", () => {
    const start = renderWithTransition(html, resolved("slide-down"), 0, "enter");
    expect(start).toContain("translateY(-100%)");
  });

  it("clamps progress to 0–1", () => {
    const over = renderWithTransition(html, resolved("fade"), 2, "enter");
    const under = renderWithTransition(html, resolved("fade"), -1, "enter");
    const full = renderWithTransition(html, resolved("fade"), 1, "enter");
    expect(over).toBe(full);
    expect(under).toContain("opacity:0");
  });
});

describe("transitions presets", () => {
  it("creates fade preset", () => {
    expect(transitions.fade("500ms", "easeOutCubic")).toEqual({
      type: "fade",
      duration: "500ms",
      easing: "easeOutCubic",
    });
  });

  it("creates slide presets", () => {
    expect(transitions.slideLeft("1s").type).toBe("slide-left");
    expect(transitions.slideRight("1s").type).toBe("slide-right");
    expect(transitions.slideUp("1s").type).toBe("slide-up");
    expect(transitions.slideDown("1s").type).toBe("slide-down");
  });
});