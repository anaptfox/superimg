import { describe, it, expect } from "vitest";
import { layers } from "./layers";

describe("layers", () => {
  it("renders layers in declaration order with increasing z-index", () => {
    const L = layers({ width: 1920, height: 1080 });
    const html = L.render(
      L.bg("<div>bg</div>"),
      L.tint("rgba(0,0,0,0.5)"),
      L.content("<h1>Hello</h1>"),
    );
    expect(html).toContain('width:1920px');
    expect(html).toContain('height:1080px');
    expect(html).toContain("bg");
    expect(html).toContain("Hello");
    expect(html).toContain("rgba(0,0,0,0.5)");
  });

  it("uses transparent background in transparent mode", () => {
    const L = layers({ width: 100, height: 100, mode: "transparent" });
    const html = L.render(L.content("x"));
    expect(html).toContain("background:transparent");
  });

  it("positions overlay with anchor", () => {
    const L = layers({ width: 1920, height: 1080 });
    const html = L.render(
      L.overlay("<span>LT</span>", { anchor: "bottom-left", offset: { x: 60, y: 80 } }),
    );
    expect(html).toContain("bottom:80");
    expect(html).toContain("left:60");
  });

  it("skips layers when visible is false", () => {
    const L = layers({ width: 100, height: 100 });
    const html = L.render(
      L.content("shown"),
      L.fx("<div>fx-layer</div>", { visible: false }),
    );
    expect(html).toContain("shown");
    expect(html).not.toContain("fx-layer");
  });

  it("applies motion style to layer wrapper", () => {
    const L = layers({ width: 100, height: 100 });
    const motion = { style: "opacity:0.5;transform:translateY(10px)", opacity: 0.5 } as const;
    const html = L.render(L.content("x", { motion: motion as never }));
    expect(html).toContain("opacity:0.5");
    expect(html).toContain("translateY(10px)");
  });

  it("centers overlay with custom anchor origin", () => {
    const L = layers({ width: 1920, height: 1080 });
    const html = L.render(
      L.overlay("<span>centered</span>", {
        anchor: { x: "50%", y: "66%", origin: "center" },
      }),
    );
    expect(html).toContain("left:50%");
    expect(html).toContain("top:66%");
    expect(html).toMatch(/translate\(-50%,\s*-50%\)/);
  });

  it("merges centering transform with overlay motion", () => {
    const L = layers({ width: 1920, height: 1080 });
    const motion = { style: "opacity:1;transform:scale(0.9)", opacity: 1 } as const;
    const html = L.render(
      L.overlay("phone", {
        anchor: { x: "73%", y: "50%", origin: "center" },
        motion: motion as never,
      }),
    );
    expect(html).toMatch(/translate\(-50%,\s*-50%\)\s*scale\(0\.9\)/);
  });

  it("applies content inset", () => {
    const L = layers({ width: 1920, height: 1080 });
    const html = L.render(
      L.content("text", { inset: { top: "20%", left: "7%", right: "48%" } }),
    );
    expect(html).toContain("top:20%");
    expect(html).toContain("left:7%");
    expect(html).toContain("right:48%");
  });

  it("renders fx layers above content with high z-index", () => {
    const L = layers({ width: 100, height: 100 });
    const html = L.render(
      L.content("main"),
      L.fx("<div>fx</div>"),
    );
    const fxIdx = html.indexOf("z-index:1002");
    const contentIdx = html.indexOf("z-index:1");
    expect(fxIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(-1);
    expect(fxIdx).toBeGreaterThan(contentIdx);
  });

  it("assigns custom z-index via options.z", () => {
    const L = layers({ width: 100, height: 100 });
    const html = L.render(
      L.content("low", { z: 2 }),
      L.content("high", { z: 50 }),
    );
    const lowIdx = html.indexOf("z-index:2");
    const highIdx = html.indexOf("z-index:50");
    expect(lowIdx).toBeGreaterThan(-1);
    expect(highIdx).toBeGreaterThan(-1);
    expect(highIdx).toBeGreaterThan(lowIdx);
  });

  it("renders split mode panes in row layout", () => {
    const L = layers({ width: 1000, height: 600, mode: "split", ratio: 0.4, direction: "row" });
    const html = L.render(
      L.content("left", { pane: 0 }),
      L.content("right", { pane: 1 }),
    );
    expect(html).toContain("width:40%");
    expect(html).toContain("left:40%");
    expect(html).toContain("width:60%");
    expect(html).toContain("left");
    expect(html).toContain("right");
  });

  it("renders split mode panes in column layout", () => {
    const L = layers({ width: 800, height: 800, mode: "split", ratio: 0.25, direction: "column" });
    const html = L.render(
      L.content("top", { pane: 0 }),
      L.content("bottom", { pane: 1 }),
    );
    expect(html).toContain("height:25%");
    expect(html).toContain("top:25%");
    expect(html).toContain("height:75%");
  });

  it("renders media layer from montage result", () => {
    const L = layers({ width: 1920, height: 1080 });
    const montage = {
      currentIndex: 0,
      layers: [],
      html: '<div class="montage-slide">slide</div>',
      renderLayer: () => "",
    };
    const html = L.render(L.media(montage as never));
    expect(html).toContain("montage-slide");
    expect(html).toContain("pointer-events:none");
  });

  it("renders named slot layers", () => {
    const L = layers({ width: 100, height: 100 });
    const html = L.render(L.slot("cta", "<button>Go</button>"));
    expect(html).toContain("<button>Go</button>");
    expect(html).toContain("z-index:1");
  });

  it("uses overflow visible on root when configured", () => {
    const L = layers({ width: 100, height: 100, overflow: "visible" });
    const html = L.render(L.content("x"));
    expect(html).toContain("overflow:visible");
  });

  it("preserves declaration order for z-index stacking", () => {
    const L = layers({ width: 100, height: 100 });
    const html = L.render(
      L.bg("bg"),
      L.tint("rgba(0,0,0,0.3)"),
      L.content("main"),
      L.overlay("badge"),
    );
    const zValues = [...html.matchAll(/z-index:(\d+)/g)].map((m) => Number(m[1]));
    expect(zValues).toEqual([1, 2, 3, 4]);
  });

  it("handoff composes shared, transition, and pinned layers", () => {
    const L = layers({ width: 100, height: 100 });
    const html = L.handoff({
      shared: [L.bg("bg"), L.tint("rgba(0,0,0,0.5)")],
      transition: { html: "<div>split</div>" },
      pinned: [L.overlay("phone")],
    });
    expect(html).toContain("bg");
    expect(html).toContain("rgba(0,0,0,0.5)");
    expect(html).toContain("split");
    expect(html).toContain("phone");
    const splitIdx = html.indexOf("split");
    const phoneIdx = html.indexOf("phone");
    expect(splitIdx).toBeLessThan(phoneIdx);
  });
});