import { describe, expect, it } from "vitest";
import { choose } from "./choose.js";
import { video } from "@superimg/types";
import { sequence } from "./sequence.js";
import { time } from "./time.js";
import { rebaseCompositionSources } from "./rebase.js";
import { Html } from "@superimg/stdlib/tree";

const size = { width: 1920, height: 1080 };
const options = { size, fps: 25, routes: { branch: "left" } };

function branchClip(assetUrl: string) {
  return video({
    size,
    fps: 25,
    duration: "2f",
    assets: { logo: { url: assetUrl, type: "image" } },
    render: (ctx) => Html({ width: "fill", height: "fill", html: ctx.asset("logo") }),
  });
}

describe("rebaseCompositionSources", () => {
  it("clones and rebases every branch and leaf resource before time()", () => {
    const voice = video({
      size,
      fps: 25,
      duration: "2f",
      fonts: [{ family: "Inter", src: "./fonts/inter.woff2" }],
      audio: { id: "voice", src: "./audio/voice.mp3" },
      render: () => Html({ width: "fill", height: "fill", html: "voice" }),
    });
    const original = sequence([
      { id: "voice", content: voice },
      { id: "branch", content: choose({ left: branchClip("./left.png"), right: branchClip("./right.png") }) },
    ]);
    const rebased = rebaseCompositionSources(original, {
      voice: "file:///project/media/voice/",
      "branch/left": "https://cdn.example.test/project/left/",
      "branch/right": "https://cdn.example.test/project/right/",
    });

    expect(rebased).not.toBe(original);
    expect(original.op).toBe("sequence");
    if (rebased.op !== "sequence") throw new Error("expected sequence");
    const rebasedVoice = rebased.parts[0]!.content as typeof voice;
    expect(rebasedVoice.config?.fonts).toEqual([{ family: "Inter", src: "file:///project/media/voice/fonts/inter.woff2" }]);
    expect(rebasedVoice.config?.audio).toMatchObject({ src: "file:///project/media/voice/audio/voice.mp3" });
    const nested = rebased.parts[1]!.content;
    if (!("op" in nested) || nested.op !== "choose") throw new Error("expected retained choice");
    expect(nested.paths.left && "config" in nested.paths.left ? nested.paths.left.config?.assets?.logo : undefined)
      .toMatchObject({ url: "https://cdn.example.test/project/left/left.png" });
    expect(nested.paths.right && "config" in nested.paths.right ? nested.paths.right.config?.assets?.logo : undefined)
      .toMatchObject({ url: "https://cdn.example.test/project/right/right.png" });

    const projected = time(rebased, options);
    expect(projected.config?.assets).toMatchObject({ "branch/left/logo": { url: "https://cdn.example.test/project/left/left.png" } });
    expect(projected.config?.fonts).toEqual([{ family: "Inter", src: "file:///project/media/voice/fonts/inter.woff2" }]);
  });

  it("requires an explicit base for relative resources and validates every supplied path", () => {
    const program = sequence([{ id: "thumb", content: branchClip("./logo.png") }]);
    expect(() => rebaseCompositionSources(program, {})).toThrow(/explicit sourceBase/);
    expect(() => rebaseCompositionSources(program, { thumb: "javascript:alert(1)" })).toThrow(/absolute HTTP\(S\) or file URL/);
    expect(() => rebaseCompositionSources(program, { thumb: "https://cdn.example.test/", typo: "https://cdn.example.test/" })).toThrow(/does not identify a leaf/);
  });

  it("rejects cyclic Programs", () => {
    const cyclic: { op: "sequence"; parts: unknown[] } = { op: "sequence", parts: [] };
    cyclic.parts.push({ id: "again", content: cyclic });
    expect(() => rebaseCompositionSources(cyclic as never, {})).toThrow(/cyclic Program graph/);
  });
});
