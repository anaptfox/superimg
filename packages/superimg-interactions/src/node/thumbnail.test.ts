import { describe, expect, it } from "vitest";
import { MEDIA_INTERACTION_IDS } from "../contracts.js";
import { createMemoryRasterStore } from "../rasters.js";
import { createNodeMediaInteractionMount } from "./mount.js";

describe("media.artifact.thumbnail", () => {
  it("scales host-decoded pixels and writes thumbnail bytes", async () => {
    const rasters = createMemoryRasterStore();
    rasters.putArtifact("card", {
      width: 4,
      height: 2,
      rgba: new Uint8Array(4 * 2 * 4).fill(200),
    });
    const mount = createNodeMediaInteractionMount({
      projectRoot: process.cwd(),
      runtime: { dispose: async () => {} } as never,
      rasters,
    });
    const result = await mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.thumbnail,
      input: { artifactId: "card", maxWidth: 2 },
    }, {});
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect([...Buffer.from(result.bytes, "base64")]).toEqual([0, 0, 0, 2, 0, 0, 0, 1, ...new Array(8).fill(200)]);
    expect([...rasters.readThumbnail("card")!]).toEqual([...Buffer.from(result.bytes, "base64")]);
  });
});
