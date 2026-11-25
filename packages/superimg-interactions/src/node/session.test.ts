import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MEDIA_INTERACTION_IDS } from "../contracts.js";
import { createNodeMediaInteractionSession } from "./session.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Node media interaction session", () => {
  it("pairs the mount with its runtime kernel for check and inspect, then disposes idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-node-session-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "card.media.ts"), `
      import { image, Html } from "@foxworth/superimg";
      export default image({ render: () => Html({ html: "<main>paired runtime</main>" }) });
    `);

    const session = await createNodeMediaInteractionSession({ projectRoot: root });
    try {
      const checked = await session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.check,
        input: { source: "card" },
      }, {});
      const inspected = await session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.inspect,
        input: { source: "card" },
      }, {});

      expect(checked.report).toMatchObject({ kind: "image", ok: true });
      expect(inspected.report).toMatchObject({ kind: "image" });
    } finally {
      const firstDisposal = session.dispose();
      expect(session.dispose()).toBe(firstDisposal);
      await firstDisposal;
    }
  }, 20_000);

  it("cleans up the runtime when mount construction fails", async () => {
    await expect(createNodeMediaInteractionSession({
      projectRoot: join(tmpdir(), `superimg-missing-session-${Date.now()}`),
    })).rejects.toThrow();
  });
});
