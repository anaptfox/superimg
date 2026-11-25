import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { collectCompanionAssets } from "./example-companion-assets.js";

describe("example companion assets", () => {
  it("retains child asset paths without publishing source, server files, or generated output", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "superimg-companion-assets-"));
    const put = (relative: string) => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, relative);
    };

    try {
      put("poster.png");
      put("assets/timing.json");
      put("parts/intro/assets/logo.svg");
      put("parts/intro/cover.webp");
      put("parts/intro/clip.media.ts");
      put("parts/intro/secret.server.ts");
      put("parts/intro/README.md");
      put("parts/intro/config.json");
      put("output/capture.png");
      put(".private/secret.png");
      fs.symlinkSync(path.join(root, "assets"), path.join(root, "linked-assets"));

      expect(collectCompanionAssets(root).map((asset) => asset.relative)).toEqual([
        path.join("assets", "timing.json"),
        path.join("parts", "intro", "assets", "logo.svg"),
        path.join("parts", "intro", "cover.webp"),
        "poster.png",
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
