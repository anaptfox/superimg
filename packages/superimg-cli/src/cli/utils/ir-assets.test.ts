import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
import { image } from "@superimg/types";
import { inspectIRAssets } from "./ir-assets.js";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

it("inspects a rebased child file URL as a local owned asset", () => {
  const directory = mkdtempSync(join(tmpdir(), "superimg-file-asset-"));
  temporaryDirectories.push(directory);
  const assetPath = join(directory, "mark.svg");
  writeFileSync(assetPath, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const url = pathToFileURL(assetPath).href;
  const media = image({
    size: { width: 64, height: 64 },
    assets: { "chapter/mark": { url, type: "image" } },
    render: () => { throw new Error("asset inspection must not render frames"); },
  });

  const inspected = inspectIRAssets(join(directory, "story.media.ts"), media);
  expect(inspected.additionalIssues).toEqual([]);
  expect(inspected.additionalAssets).toContainEqual(expect.objectContaining({
    id: "asset:chapter/mark", src: "mark.svg", remote: false, contentHash: expect.any(String),
  }));
  expect(inspected.localAssets["asset:chapter/mark"]).toMatchObject({ path: assetPath, aliases: expect.arrayContaining([url]) });
});
