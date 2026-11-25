import { describe, expect, it } from "vitest";
import { createMediaIR } from "@superimg/types";
import { defineInteractive } from "./definition.js";
import { Html } from "@superimg/stdlib/tree";
import {
  INTERACTIVE_EXTENSION_KEY,
  attachInteractiveExtension,
  encodeInteractiveExtension,
  isInteractiveExtension,
  parseInteractiveExtension,
  readInteractiveExtension,
} from "./extension.js";

const lesson = defineInteractive<{ title: string }>({
  guide: {
    id: "lesson",
    steps: [
      {
        id: "intro",
        label: "Intro",
        note: "Ask",
        duration: "1s",
        scene: { state: "intro" },
        focusNodeId: "prompt",
      },
    ],
  },
  sample: { title: "Sample data stays outside IR" },
  render: (ctx) => Html({ width: "fill", height: "fill", html: `<h1>${ctx.data.title}</h1>` }),
});

describe("interactive Media IR extension", () => {
  it("round-trips the schema-0 guide without sample or live data", () => {
    const extension = encodeInteractiveExtension(lesson);
    expect(extension.schemaVersion).toBe(0);
    expect(JSON.stringify(extension)).not.toContain("Sample data stays outside IR");
    expect(parseInteractiveExtension(extension)).toMatchObject({
      guide: { id: "lesson" },
      clock: { fps: 30, durationSeconds: 1, totalFrames: 30 },
    });
    expect(isInteractiveExtension(extension)).toBe(true);
  });

  it("attaches through the generic envelope while leaving the base IR opaque", () => {
    const ir = createMediaIR({ sourceId: "lesson" });
    const attached = attachInteractiveExtension(ir, lesson);
    expect(ir.extensions).toEqual({});
    expect(attached.extensions[INTERACTIVE_EXTENSION_KEY]?.schemaVersion).toBe(0);
    expect(readInteractiveExtension(attached)?.guide.id).toBe("lesson");
  });

  it("fails closed on a mismatched clock or unknown schema", () => {
    const extension = encodeInteractiveExtension(lesson);
    const wrongClock = {
      ...extension,
      payload: {
        ...extension.payload,
        clock: { fps: 30, durationSeconds: 2, totalFrames: 60 },
      },
    };
    expect(() => parseInteractiveExtension(wrongClock)).toThrow(/does not match/);
    expect(
      isInteractiveExtension({ ...extension, schemaVersion: 1 } as never),
    ).toBe(false);
  });
});
