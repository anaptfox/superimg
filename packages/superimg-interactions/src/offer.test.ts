import { describe, expect, it } from "vitest";
import { MEDIA_INTERACTION_IDS } from "./contracts.js";
import { MEDIA_OFFER_EXPOSURE, projectMediaOffer } from "./offer.js";

describe("Media Offer", () => {
  it("offers check, inspect, describe, thumbnail, and arrange direct; snapshot, compile, export request", async () => {
    expect(MEDIA_OFFER_EXPOSURE).toEqual({
      check: "direct",
      inspect: "direct",
      describe: "direct",
      thumbnail: "direct",
      arrange: "direct",
      snapshot: "request",
      compile: "request",
      export: "request",
    });
    const projection = await projectMediaOffer();
    const byId = new Map(
      projection.manifest.interactions.map((interaction) => [
        interaction.interactionId,
        interaction.modes,
      ]),
    );
    expect(byId.get(MEDIA_INTERACTION_IDS.check)).toEqual(["direct"]);
    expect(byId.get(MEDIA_INTERACTION_IDS.inspect)).toEqual(["direct"]);
    expect(byId.get(MEDIA_INTERACTION_IDS.describe)).toEqual(["direct"]);
    expect(byId.get(MEDIA_INTERACTION_IDS.thumbnail)).toEqual(["direct"]);
    expect(byId.get(MEDIA_INTERACTION_IDS.arrange)).toEqual(["direct"]);
    expect(byId.get(MEDIA_INTERACTION_IDS.snapshot)).toEqual(["request"]);
    expect(byId.get(MEDIA_INTERACTION_IDS.compile)).toEqual(["request"]);
    expect(byId.get(MEDIA_INTERACTION_IDS.export)).toEqual(["request"]);
    expect(byId.has(MEDIA_INTERACTION_IDS.discover)).toBe(false);
    expect(
      [...byId.keys()].some((id) => id.includes("delete") || id.includes("remove")),
    ).toBe(false);
  });
});
