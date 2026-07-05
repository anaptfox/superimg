import { describe, expect, it } from "vitest";
import { video as mediaVideo, youtube as mediaYoutube } from "@superimg/stdlib/media";
import { buildMediaGraph } from "./graph.js";

describe("buildMediaGraph", () => {
  it("collects deterministic local/direct video markers", () => {
    const clip = mediaVideo({ src: "/clips/a.mp4", at: 1, start: 2, playbackRate: 1.5 }, 30);
    const graph = buildMediaGraph(`<main>${clip.html}</main>`);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.deterministicClips[0]).toMatchObject({
      kind: "video",
      src: "/clips/a.mp4",
      deterministic: true,
      playbackRate: 1.5,
    });
    expect(graph.deterministicClips[0]?.time).toBeCloseTo(3.5);
  });

  it("collects YouTube as an external embed node", () => {
    const embed = mediaYoutube({ videoId: "abcdefghijk", at: 2, poster: "/poster.jpg" }, 30);
    const graph = buildMediaGraph(embed.html);

    expect(graph.externalEmbeds).toHaveLength(1);
    expect(graph.externalEmbeds[0]).toMatchObject({
      kind: "youtube",
      provider: "youtube",
      videoId: "abcdefghijk",
      poster: "/poster.jpg",
      deterministic: false,
    });
    expect(graph.deterministicClips).toHaveLength(0);
  });
});
