import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createNodeMediaInteractionSession, MEDIA_INTERACTION_IDS } from "@foxworth/superimg-interactions";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const fixtureRoot = join(here, "..", "fixtures", "collection-library");

describe("collection library paired runtime qualification", { timeout: 60_000 }, () => {
  let root = "";
  let session: Awaited<ReturnType<typeof createNodeMediaInteractionSession>> | undefined;

  afterAll(async () => {
    await session?.dispose();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("keeps discovery and default analysis provider-free, then exports exact frozen rows", async () => {
    root = await mkdtemp(join(repoRoot, ".tmp-collection-library-"));
    await cp(fixtureRoot, root, { recursive: true });
    session = await createNodeMediaInteractionSession({
      projectRoot: root,
    });
    const mount = session.mount;
    const context = {};
    const counter = join(root, "provider-count.txt");
    const counterValue = async () => readFile(counter, "utf8").catch(() => "");

    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.discover,
      input: {},
    }, context)).resolves.toMatchObject({
      sources: [{ sourceId: "cards", relativePath: "cards.media.ts", sourceKind: "collection" }],
    });
    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.check,
      input: { source: "cards" },
    }, context)).resolves.toMatchObject({ report: { ok: true, kind: "collection" } });
    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.inspect,
      input: { source: "cards" },
    }, context)).resolves.toMatchObject({ report: { kind: "collection" } });
    expect(await counterValue()).toBe("");

    const snapshot = await mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.snapshot,
      input: { source: "cards" },
    }, context);
    expect(snapshot).toMatchObject({
      kind: "media-collection-snapshot",
      source: "cards.media.ts",
      sourceId: "cards",
      entries: [
        { id: "north", data: { title: "Frozen NORTH copy" } },
        { id: "south", data: { title: "Frozen SOUTH copy" } },
      ],
    });
    expect(await counterValue()).toBe("x");

    await writeFile(join(root, "rows.json"), JSON.stringify([
      { id: "north", title: "Changed NORTH copy", color: "#fecaca" },
      { id: "south", title: "Changed SOUTH copy", color: "#fed7aa" },
      { id: "west", title: "Added WEST copy", color: "#fef08a" },
    ]));

    const publicationId = "collection/frozen-rows";
    const receipt = await mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.export,
      input: {
        source: "cards",
        publication: { targetId: "project-output", publicationId },
        destinations: ["160x90.html"],
        snapshot,
      },
    }, context);

    expect(receipt).toMatchObject({
      targetId: "project-output",
      publicationId,
      manifest: {
        kind: "media-export",
        sourceId: "cards",
        snapshotDigest: snapshot.snapshotDigest,
        providerHash: snapshot.providerHash,
        entries: [
          { id: "north", dataDigest: snapshot.entries[0]?.dataDigest },
          { id: "south", dataDigest: snapshot.entries[1]?.dataDigest },
        ],
      },
    });
    expect((await counterValue()).length).toBe(1);

    const manifestPath = join(root, "output", publicationId, "export.json");
    const published = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sourceId: string;
      snapshotDigest: string;
      renditions: { coordinates: { entryId?: string; variantId: string; editionId: string }; path: string }[];
    };
    expect(published.sourceId).toBe("cards");
    expect(published.snapshotDigest).toBe(snapshot.snapshotDigest);
    expect(published.renditions.map((item) => item.coordinates)).toEqual([
      { sourceId: "cards", entryId: "north", variantId: "default", editionId: "default", renditionId: "160x90.html" },
      { sourceId: "cards", entryId: "south", variantId: "default", editionId: "default", renditionId: "160x90.html" },
    ]);

    const html = await Promise.all(published.renditions.map(async (item) =>
      readFile(join(root, "output", publicationId, item.path), "utf8"),
    ));
    const visibleHtml = html.map((value) => value.replace(/<br\s*\/?\s*>/gi, " "));
    expect(visibleHtml[0]).toContain("Frozen NORTH copy");
    expect(visibleHtml[1]).toContain("Frozen SOUTH copy");
    expect(visibleHtml.join("\n")).not.toContain("Changed ");
    expect(visibleHtml.join("\n")).not.toContain("Added WEST");
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual(receipt.manifest);
    expect(receipt.manifestDigest).toMatch(/^[a-f0-9]{64}$/);

    await session.dispose();
    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.check,
      input: { source: "cards" },
    }, context)).rejects.toThrow(/disposed/i);
  });
});
