import { expect, it } from "vitest";
import sharp from "sharp";
import { inspectArrangementPixels } from "./arrangement-pixels.js";

it("detects an actually blank PNG and keeps a sparse but nonblank canvas valid", async () => {
  const blank = await sharp({ create: { width: 24, height: 16, channels: 4, background: "white" } }).png().toBuffer();
  const sparse = await sharp(blank).composite([{ input: Buffer.from([0, 0, 0, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 4, top: 4 }]).png().toBuffer();
  expect(await inspectArrangementPixels(blank, 7)).toMatchObject([{ code: "EMPTY_RENDERED_CANVAS", severity: "error", details: { frame: 7, nodeId: "stage" } }]);
  expect(await inspectArrangementPixels(sparse, 7)).toEqual([]);
});
