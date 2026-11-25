import { beforeAll, describe, expect, it } from "vitest";
import { createRenderContext } from "../../packages/superimg-core/src/rendering/create-render-context";
import { lowerRenderOutput } from "../../packages/superimg-core/src/rendering/lower-output";
import { Html, type RenderContext } from "@foxworth/superimg";
import { createPreparedStdlibForTemplate, type PreparedStdlib } from "../../packages/superimg-core/src/shared/stdlib-capabilities";
import chatgpt from "./chatgpt/chatgpt.media";
import claude from "./claude/claude.media";
import imessage from "./imessage/imessage.media";

// Sample the real templates, using the same context and lowering as the runtime.
// These assertions cover sub-beat behavior that a clean layout check cannot see.
let preparedStdlib: PreparedStdlib;

beforeAll(async () => {
  preparedStdlib = await createPreparedStdlibForTemplate({
    medium: "html", animated: true,
    mediaCapabilities: { version: 0, names: ["stack", "text"] },
    render: () => Html({ width: 1, height: 1, html: "" }),
  });
});

const response = "ANSWER <Frame> & more text to stream slowly";

const cases = [
  { name: "chatgpt", factor: 1.45, render: (ctx: RenderContext, thinking: boolean) => chatgpt.render({ ...ctx, data: { ...chatgpt.sample!, messages: [{ id: "reply", role: "assistant", text: response }], showThinkingIndicator: thinking } }) },
  { name: "claude", factor: 1.55, render: (ctx: RenderContext, thinking: boolean) => claude.render({ ...ctx, data: { ...claude.sample!, messages: [{ id: "reply", role: "assistant", text: response }], showThinkingIndicator: thinking } }) },
];
for (const { name, render, factor } of cases) {
  describe(`${name} conversation`, () => {
    function atSlot(slot: number, thinking = true) {
      const messageSeconds = Math.max(2, Math.max(1.2, response.length / 45) * factor);
      const totalSeconds = messageSeconds + Math.max(1.6, messageSeconds / 9);
      const seconds = messageSeconds * (0.05 + 0.9 * slot);
      const ctx = createRenderContext(Math.round(seconds * 1000), 1000, Math.round(totalSeconds * 1000) + 1, 1920, 1080, {}, {}, undefined, undefined, undefined, undefined, preparedStdlib);
      return lowerRenderOutput(render(ctx, thinking));
    }
    it("keeps thinking after stack arrival, then streams before the final hold", () => {
      expect(atSlot(0.4)).not.toContain("ANSWER");
      expect(atSlot(0.7)).toContain("ANSWER");
      expect(atSlot(0.7)).not.toContain("stream slowly");
      expect(atSlot(1)).toContain("ANSWER &lt;Frame&gt; &amp; more text to stream slowly");
    });
    it("starts streaming immediately when thinking is disabled", () => {
      expect(atSlot(0.25, false)).toContain("ANSWER");
    });
    it("derives cursor state from the same frame and escapes code snippets", () => {
      expect(atSlot(0.7)).toEqual(atSlot(0.7));
      expect(atSlot(0.7)).not.toMatch(/@keyframes|animation:/);
      expect(atSlot(1)).not.toContain("<Frame>");
    });
  });
}

describe("iMessage conversation", () => {
  function atSlot(slot: number) {
    const data = { ...imessage.sample!, contactName: "<Alex>", messages: [{ id: "reply", sender: "contact" as const, text: response }] };
    const messageSeconds = Math.max(3, Math.max(1.2, response.length / 40) * 1.7);
    const totalSeconds = messageSeconds + Math.max(1.6, messageSeconds / 9);
    const seconds = messageSeconds * (0.05 + 0.9 * slot);
    return lowerRenderOutput(imessage.render({ ...createRenderContext(Math.round(seconds * 1000), 1000, Math.round(totalSeconds * 1000) + 1, 1920, 1080, {}, {}, undefined, undefined, undefined, undefined, preparedStdlib), data }));
  }
  it("keeps the typing indicator until its midpoint, after stack arrival", () => {
    expect(atSlot(0.4)).not.toContain("ANSWER");
    expect(atSlot(0.7)).toContain("ANSWER &lt;Frame&gt; &amp;");
    expect(atSlot(1)).toContain("&lt;Alex&gt;");
  });
});
