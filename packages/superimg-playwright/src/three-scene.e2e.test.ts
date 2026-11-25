import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import sharp from "sharp";
import { scene } from "@superimg/stdlib/compat/three";
import { PlaywrightRasterizer } from "./adapters.js";
import { preloadThreeModule } from "./three-preload.js";

describe("Three scene capture", () => {
  it("preserves painted pixels after GL cleanup across repeated frames", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const renderer = new PlaywrightRasterizer(page);
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.route("**/*", async route => { external.push(route.request().url()); await route.abort(); });
      await renderer.init({ width: 32, height: 32, format: "png" });
      await preloadThreeModule(page);
      // More frames than the usual simultaneous WebGL-context limit. Each frame
      // must remain visible after releasing its context, with no stale paint.
      for (let frame = 0; frame < 20; frame += 1) {
        const red = frame % 2 === 0;
        const png = await renderer.rasterize(scene({
          width: 32, height: 32, progress: frame / 19,
          setup: `scene.background = new THREE.Color(${red ? "0xff0000" : "0x0000ff"});`,
          animate: "",
        }));
        const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        const center = (16 * info.width + 16) * info.channels;
        expect([...data.subarray(center, center + 3)]).toEqual(red ? [255, 0, 0] : [0, 0, 255]);
      }
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    } finally {
      await renderer.dispose();
      await browser.close();
    }
  }, 60_000);
});
