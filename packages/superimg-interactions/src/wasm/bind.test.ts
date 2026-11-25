import { describe, expect, it } from "vitest";
import {
  bindThumbnailGuest,
  loadThumbnailGuestBytes,
  loadThumbnailOverreachBytes,
} from "./bind.js";
import { THUMBNAIL_GUEST_INTERFACE, THUMBNAIL_IMPORT_FOOTPRINTS } from "./imports.js";
import { loadBoundaryThumbnailGuestRuntime } from "./boundary-runtime.test-helper.js";

describe("thumbnail guest import map", () => {
  it("names artifacts and thumbnails on the versioned instance, never publications", () => {
    expect(THUMBNAIL_GUEST_INTERFACE).toBe("boundary:guest/footprints@1.0.0");
    expect(THUMBNAIL_IMPORT_FOOTPRINTS).toEqual(["media.artifacts", "media.thumbnails"]);
    expect(THUMBNAIL_IMPORT_FOOTPRINTS).not.toContain("media.publications");
  });

  it("binds the copied Zig component by reading imports from its bytes", async () => {
    const runtime = await loadBoundaryThumbnailGuestRuntime();
    const bound = await bindThumbnailGuest(runtime, loadThumbnailGuestBytes());
    expect(bound).toMatchObject({
      status: "bound",
      used: ["media-artifacts", "media-thumbnails"],
    });
  });

  it("refuses the overreach component and names the unmapped instance import", async () => {
    const runtime = await loadBoundaryThumbnailGuestRuntime();
    const result = await bindThumbnailGuest(runtime, loadThumbnailOverreachBytes());
    expect(result.status).toBe("unrealized");
    if (result.status !== "unrealized") throw new Error("expected unrealized");
    expect(result.unmapped).toEqual([
      "boundary:guest/footprints@1.0.0#media-publications",
    ]);
    expect(result.report).toContain("boundary:guest/footprints@1.0.0#media-publications");
    expect(result.offered).toEqual(["media-artifacts", "media-thumbnails"]);
  });
});
