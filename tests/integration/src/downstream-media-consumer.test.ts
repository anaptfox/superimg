import { describe, expect, it } from "vitest";
import {
  describeDownstreamMediaHost,
} from "./fixtures/downstream-media.js";

describe("downstream media facade", () => {
  it("privately mounts the three media Programs", async () => {
    const host = await describeDownstreamMediaHost();

    expect(host.media.interactionIds).toEqual([
      "media.arrange.still",
      "media.artifact.compile",
      "media.artifact.thumbnail",
      "media.collection.snapshot",
      "media.export",
      "media.narration.prepare",
      "media.narration.review",
      "media.project.discover",
      "media.source.check",
      "media.source.describe",
      "media.source.inspect",
      "media.speech.synthesize",
      "media.speech.voices",
    ]);
    expect(host.edit.interactionIds).toEqual([
      "media.edit.bindings",
      "media.edit.set-audio-clip-placement",
      "media.edit.set-composition-hold",
      "media.edit.set-node-property",
      "media.edit.set-node-text",
      "media.edit.set-node-transform",
      "media.edit.set-phase-boundary",
      "media.edit.trim-scene-end",
    ]);
    expect(host.render.interactionIds).toEqual(["media.package.render"]);
    expect(host.requestMediaInteractionIds).toEqual(["snapshot", "export"]);
    expect(host.authoringFacades).toEqual(["application/media"]);

    const allIds = [
      ...host.media.interactionIds,
      ...host.edit.interactionIds,
      ...host.render.interactionIds,
    ];
    expect(allIds.some((id) => id.startsWith("control."))).toBe(false);
    expect(new Set([
      host.media.programDigest,
      host.edit.programDigest,
      host.render.programDigest,
    ]).size).toBe(3);
  });
});
