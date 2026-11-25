import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { googleFont } from "@superimg/types";
import { resolveDevAssetUrls, addDiscoveredDevAssetUrls, resolveDevFonts } from "./dev-resources.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

describe("dev resource resolution", () => {
  it("serves declared file URLs and paths from source ownership, preserving explicit keys", () => {
    const registered: string[] = [];
    const register = (path: string) => {
      registered.push(path);
      return `/api/assets/${registered.length}`;
    };
    const filePath = resolve(repoRoot, "packages/superimg-core/assets/fonts/Inter-400.ttf");
    const fileUrl = pathToFileURL(filePath).href;
    const urls = resolveDevAssetUrls({
      localFile: { type: "image", url: fileUrl },
      relative: { type: "image", url: "assets/clip.webp" },
      absolute: { type: "video", url: "/private/media/clip.mp4" },
      remote: { type: "image", url: "https://cdn.example.test/remote.png" },
      protocolRelative: { type: "image", url: "//cdn.example.test/protocol-relative.png" },
      bytes: { type: "image", bytes: new Uint8Array([1, 2, 3]), mimeType: "image/test" },
    }, resolve(repoRoot, "project"), register);

    expect(registered).toEqual([
      filePath,
      resolve(repoRoot, "project/assets/clip.webp"),
      "/private/media/clip.mp4",
    ]);
    expect(urls.localFile).toBe("/api/assets/1");
    expect(urls[fileUrl]).toBe("/api/assets/1");
    expect(urls.relative).toBe("/api/assets/2");
    expect(urls.absolute).toBe("/api/assets/3");
    expect(urls.remote).toBe("https://cdn.example.test/remote.png");
    expect(urls.protocolRelative).toBe("//cdn.example.test/protocol-relative.png");
    expect(urls.bytes).toBe("data:image/test;base64,AQID");

    addDiscoveredDevAssetUrls(urls, [
      { src: "stale.jpg", sourceDir: resolve(repoRoot, "discovered"), key: "localFile" },
      { src: "assets/badge.svg", sourceDir: resolve(repoRoot, "discovered"), key: "badge" },
    ], register);
    expect(urls.localFile).toBe("/api/assets/1");
    expect(urls.badge).toBe("/api/assets/5");
  });

  it("loads source-relative font faces into browser-ready CSS bytes", async () => {
    const sourceDir = resolve(repoRoot, "packages/superimg-cli/src/cli");
    const fonts = await resolveDevFonts([
      { family: "InstalledFixture", src: "../../../superimg-core/assets/fonts/Inter-400.ttf" },
    ], sourceDir);
    expect(fonts?.css).toContain('@font-face{font-family:"InstalledFixture"');
    expect(fonts?.css).toContain("data:font/ttf;base64,");

    const mixed = await resolveDevFonts([
      { family: "InstalledFixture", src: "../../../superimg-core/assets/fonts/Inter-400.ttf" },
      googleFont("Roboto:wght@400"),
    ], sourceDir);
    expect(mixed?.css).toContain('@font-face{font-family:"InstalledFixture"');
    expect(mixed?.stylesheets).toEqual([
      "https://fonts.googleapis.com/css2?family=Roboto%3Awght%40400&display=swap",
    ]);
  });
});
