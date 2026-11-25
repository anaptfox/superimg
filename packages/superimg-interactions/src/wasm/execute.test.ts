import { describe, expect, it, vi } from "vitest";
import {
  executeThumbnailGuest,
  demoThumbnailSource,
} from "./execute.js";
import {
  loadThumbnailGuestBytes,
  loadThumbnailOverreachBytes,
} from "./bind.js";
import { loadBoundaryThumbnailGuestRuntime } from "./boundary-runtime.test-helper.js";

describe("thumbnail guest execute", () => {
  it("refuses overreach before instantiate", async () => {
    const runtime = await loadBoundaryThumbnailGuestRuntime();
    const execute = vi.spyOn(runtime, "execute");
    const { store } = demoThumbnailSource();
    const result = await executeThumbnailGuest({
      runtime,
      bytes: loadThumbnailOverreachBytes(),
      store,
      input: { artifactId: "original", maxWidth: 200 },
    });
    expect(result.status).toBe("unrealized");
    if (result.status !== "unrealized") {
      throw new Error("expected unrealized");
    }
    expect(result.unmapped).toEqual([
      "boundary:guest/footprints@1.0.0#media-publications",
    ]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("calls the Zig guest after bind", async () => {
    const runtime = await loadBoundaryThumbnailGuestRuntime();
    const { store } = demoThumbnailSource();
    const result = await executeThumbnailGuest({
      runtime,
      bytes: loadThumbnailGuestBytes(),
      store,
      input: { artifactId: "original", maxWidth: 200 },
    });
    expect(result.status).toBe("returned");
    if (result.status !== "returned") {
      throw new Error(`expected returned, got ${JSON.stringify(result)}`);
    }
    const payload = JSON.parse(result.payload) as {
      width: number;
      height: number;
    };
    expect(payload.width).toBe(200);
    expect(payload.height).toBe(150);
  });
});
