import { describe, expect, it } from "vitest";
import { SnapdomCaptureBackend } from "./capture.js";

describe("SnapDOM used-border fidelity", () => {
  it.each([2.625, 2.7272727])("preserves thin border ink in a DPR 1 capture when the reported DPR is %s", async (reportedDpr) => {
    // Mirrors SnapDOM #520's fractional-DPR regression. Changing the reported
    // DPR must not replace the live browser's used border width with the much
    // smaller authored width when the clone is rasterized on a different grid.
    // This exercises dependency DPR handling, not a real device's pixel grid.
    const ownDpr = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:0;top:0;box-sizing:border-box;width:160px;height:48px;background:white";
    const borders = [0.05, 0.5, 0.95].map((width, index) => {
      const box = document.createElement("div");
      box.style.cssText = `position:absolute;left:${12 + index * 48}px;top:8px;box-sizing:border-box;width:32px;height:28px;background:white;border:${width}px solid black`;
      root.append(box);
      return { box, authoredWidth: width };
    });
    document.body.append(root);
    const backend = new SnapdomCaptureBackend();
    try {
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => reportedDpr });
      const origin = root.getBoundingClientRect();
      const live = borders.map(({ box, authoredWidth }) => ({
        rect: box.getBoundingClientRect(),
        usedWidth: Number.parseFloat(getComputedStyle(box).borderLeftWidth),
        authoredWidth,
      }));
      // Establish the fixture's precondition: the browser snapped the thinnest
      // positive declaration up to its used width before SuperImg captures it.
      expect(live[0]!.usedWidth).toBeGreaterThan(live[0]!.authoredWidth);

      const image = await backend.capture(root, {
        width: 160,
        height: 48,
        dpr: 1,
        embedFonts: false,
        backgroundColor: "#ffffff",
      });
      expect([image.width, image.height]).toEqual([160, 48]);
      const sx = image.width / origin.width;
      const sy = image.height / origin.height;
      for (const { rect, usedWidth, authoredWidth } of live) {
        const y0 = Math.ceil((rect.top - origin.top) * sy + 3);
        const y1 = Math.floor((rect.bottom - origin.top) * sy - 3);
        const rows = y1 - y0;
        expect(rows).toBeGreaterThan(0);
        for (const edge of [rect.left, rect.right]) {
          const x = Math.floor((edge - origin.left) * sx);
          let inkRows = 0;
          let coverage = 0;
          for (let y = y0; y < y1; y += 1) {
            let darkest = 255;
            // Integrate across the edge's pixel phase instead of assuming the
            // antialiased border lands in one exact output column.
            for (let dx = -1; dx <= 1; dx += 1) {
              const offset = (y * image.width + x + dx) * 4;
              const red = image.data[offset]!;
              expect(image.data[offset + 3]).toBe(255);
              darkest = Math.min(darkest, red);
              coverage += 255 - red;
            }
            if (darkest < 245) inkRows += 1;
          }
          const label = `${authoredWidth}px border at x=${x}, used width ${usedWidth}px`;
          expect(inkRows, label).toBeGreaterThan(rows * 0.8);
          // Allow downsampling variance while requiring substantial ink from
          // the actual used width; merely retaining a nonzero pixel is weak.
          expect(coverage / rows, label).toBeGreaterThan(usedWidth * sx * 255 * 0.4);
        }
      }
    } finally {
      await backend.dispose();
      root.remove();
      if (ownDpr) Object.defineProperty(window, "devicePixelRatio", ownDpr);
      else Reflect.deleteProperty(window, "devicePixelRatio");
    }
  });
});
