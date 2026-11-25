import { describe, expect, it } from "vitest";
import { image, type CompositionSchedule, type Program } from "@superimg/types";
import { sequence } from "./sequence.js";
import { replaceOccurrence } from "./replace.js";
import { diffCompositionSchedules } from "./diff.js";
import { boxedHtml } from "../__tests__/__test-utils__/index.js";

const size = { width: 1920, height: 1080 };
const still = (label: string) => image({ size, render: () => boxedHtml(label) });

describe("retained composition edits and schedule diff", () => {
  it("replaces one nested occurrence and preserves the rest of the immutable tree", () => {
    const originalLeaf = still("old");
    const untouched = still("untouched");
    const nested = sequence([{ id: "take", content: originalLeaf, hold: "1s" }]);
    const program = sequence([
      { id: "chapter", content: nested },
      { id: "tail", content: untouched, hold: "1s" },
    ]);
    const replacement = still("new");

    const next = replaceOccurrence(program, "chapter/take", replacement);
    expect(next).not.toBe(program);
    expect(next.op).toBe("sequence");
    if (next.op !== "sequence") return;
    expect(next.parts[0]?.content).not.toBe(nested);
    expect(next.parts[1]).toBe(program.parts[1]);
    expect(next.parts[0]?.content).toMatchObject({ op: "sequence", parts: [{ id: "take", content: replacement, hold: "1s" }] });
    expect(program.parts[0]?.content).toBe(nested);
    expect(() => replaceOccurrence(program, "chapter/missing", replacement)).toThrow(/was not found/);
  });

  it("replaces through a choice branch and together placement without changing their identities", () => {
    const old = still("old");
    const replacement = still("replacement");
    const together: Program = {
      op: "together",
      end: "hold",
      parts: [{
        id: "panel",
        content: old,
        fit: "contain",
        rect: { x: 12, y: 24, width: 640, height: 360 },
      }],
    };
    const choice: Program = { op: "choose", paths: { preferred: together } };

    const next = replaceOccurrence(choice, "preferred/panel", replacement);
    expect(next).toMatchObject({
      op: "choose",
      paths: {
        preferred: {
          op: "together",
          parts: [{
            id: "panel",
            content: replacement,
            fit: "contain",
            rect: { x: 12, y: 24, width: 640, height: 360 },
          }],
        },
      },
    });
    expect(choice.paths.preferred).toBe(together);
    expect(() => replaceOccurrence(choice, "unknown/panel", replacement)).toThrow(/choice branch .* was not found/);
  });

  it("reports the edited leaf and later leaves shifted by a duration change", () => {
    const before: CompositionSchedule = {
      fps: 25,
      totalFrames: 50,
      leaves: [
        { path: "intro", startFrame: 0, endFrame: 25, totalFrames: 25, kind: "image", width: 1920, height: 1080 },
        { path: "demo", startFrame: 25, endFrame: 30, totalFrames: 5, kind: "video", width: 1920, height: 1080, fps: 25 },
        { path: "outro", startFrame: 30, endFrame: 50, totalFrames: 20, kind: "image", width: 1920, height: 1080 },
      ],
    };
    const after: CompositionSchedule = {
      fps: 25,
      totalFrames: 55,
      leaves: [
        { path: "intro", startFrame: 0, endFrame: 25, totalFrames: 25, kind: "image", width: 1920, height: 1080 },
        { path: "demo", startFrame: 25, endFrame: 35, totalFrames: 10, kind: "video", width: 1920, height: 1080, fps: 25 },
        { path: "outro", startFrame: 35, endFrame: 55, totalFrames: 20, kind: "image", width: 1920, height: 1080 },
      ],
    };

    expect(diffCompositionSchedules(before, after, ["demo"])).toEqual({
      changed: [{ path: "demo", before: { startFrame: 25, endFrame: 30, totalFrames: 5 }, after: { startFrame: 25, endFrame: 35, totalFrames: 10 } }],
      shifted: [{ path: "outro", before: { startFrame: 30, endFrame: 50, totalFrames: 20 }, after: { startFrame: 35, endFrame: 55, totalFrames: 20 } }],
      totalFramesChanged: true,
      cacheSafe: false,
    });
  });

  it("matches changed and shifted leaves by qualified paths across retained relationships", () => {
    const before: CompositionSchedule = {
      fps: 25,
      totalFrames: 12,
      leaves: [
        { path: "route/primary/panel", startFrame: 0, endFrame: 5, totalFrames: 5, kind: "image", width: 1920, height: 1080 },
        { path: "route/fallback/panel", startFrame: 5, endFrame: 9, totalFrames: 4, kind: "image", width: 1920, height: 1080 },
        { path: "layout/caption", startFrame: 9, endFrame: 12, totalFrames: 3, kind: "image", width: 1920, height: 1080 },
      ],
    };
    const after: CompositionSchedule = {
      fps: 25,
      totalFrames: 14,
      leaves: [
        { path: "route/primary/panel", startFrame: 0, endFrame: 7, totalFrames: 7, kind: "image", width: 1920, height: 1080 },
        { path: "route/fallback/panel", startFrame: 7, endFrame: 11, totalFrames: 4, kind: "image", width: 1920, height: 1080 },
        { path: "layout/caption", startFrame: 11, endFrame: 14, totalFrames: 3, kind: "image", width: 1920, height: 1080 },
      ],
    };

    const diff = diffCompositionSchedules(before, after, ["route/primary"]);
    expect(diff.changed.map(({ path }) => path)).toEqual(["route/primary/panel"]);
    expect(diff.shifted.map(({ path }) => path)).toEqual(["layout/caption", "route/fallback/panel"]);
    expect(diff.cacheSafe).toBe(false);
  });

});
