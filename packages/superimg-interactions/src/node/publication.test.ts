import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ExportBundle } from "@superimg/types";
import { publishPortableBundle } from "./publication.js";
import { prepareNodeArrangement, readNodeArrangement } from "./prepared-arrangement.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function bundle(
  bytes: Uint8Array,
  declaredSha = sha256(bytes),
  artifactPath = "youtube/launch.mp4",
): ExportBundle {
  const artifact = Object.freeze({
    path: artifactPath,
    mimeType: artifactPath.endsWith(".png") ? "image/png" : "video/mp4",
    byteLength: bytes.byteLength,
    sha256: declaredSha,
    coordinates: Object.freeze({
      variantId: "default",
      editionId: "default",
      renditionId: "youtube",
    }),
    stream() {
      const copy = bytes.slice();
      return new ReadableStream<Uint8Array>({
        start(controller) {
          const middle = Math.floor(copy.byteLength / 2);
          controller.enqueue(copy.slice(0, middle));
          controller.enqueue(copy.slice(middle));
          controller.close();
        },
      });
    },
  });
  return {
    manifest: {
      kind: "@foxworth/superimg/export-bundle",
      schemaVersion: 0,
      programDigest: "program-a",
      coordinates: [
        { variantId: "default", editionId: "default" },
      ],
      artifacts: [artifact],
      assets: [],
      fonts: [],
    },
    artifacts: [artifact],
    async dispose() {},
  } as unknown as ExportBundle;
}

function request() {
  return {
    source: "launch",
    publication: { targetId: "project-output", publicationId: "launch.export" },
    destinations: ["youtube"],
  } as const;
}

const logicalTarget = {
  targetId: "project-output",
  publicationId: "launch.export",
} as const;

describe("portable bundle publication", () => {
  it("writes artifacts, writes the manifest last, and atomically replaces prior output", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-interactions-"));
    roots.push(root);
    const finalPath = join(root, "launch.export");
    await mkdir(finalPath);
    await writeFile(join(finalPath, "old.txt"), "old");
    const bytes = new TextEncoder().encode("portable media");

    const receipt = await publishPortableBundle({
      bundle: bundle(bytes),
      finalPath,
      ...logicalTarget,
      sourceId: "launch",
      request: request(),
      producerVersion: "0.1.0-test",
    });

    expect(receipt).toMatchObject(logicalTarget);
    expect(receipt.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(join(finalPath, "old.txt"))).toBe(false);
    expect(await readFile(join(finalPath, "media/youtube/launch.mp4"))).toEqual(
      Buffer.from(bytes),
    );
    const manifest = JSON.parse(await readFile(join(finalPath, "export.json"), "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 0,
      kind: "media-export",
      sourceId: "launch",
      producer: { name: "superimg", version: "0.1.0-test" },
      renditions: [
        {
          path: "media/youtube/launch.mp4",
          sha256: sha256(bytes),
        },
      ],
    });
    expect(manifest).toEqual(receipt.manifest);
    expect(manifest.inputIdentity).toBeUndefined();
    expect(manifest.stillSelection).toBeUndefined();
  });

  it("retains value identity and selected frame with the bytes and preserves them on a staging failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-interactions-"));
    roots.push(root);
    const finalPath = join(root, "launch.export");
    const bytes = new TextEncoder().encode("original artifact");
    const specPath = join(root, "board.arrange.json");
    const specimen = (id: string) => ({ id, label: id, view: { src: "shot.png" }, provenance: "capture" });
    await writeFile(specPath, JSON.stringify({ pattern: "registered-comparison", spec: { question: "What differs?", workRemoved: "Compare states", evidence: "observation", states: [specimen("a"), specimen("b")], frame: { scale: "shared", viewport: { width: 100, height: 100 } }, correspondence: ["object"] } }));
    await writeFile(join(root, "shot.png"), "first asset");
    const input = await readNodeArrangement(specPath);
    const prepared = await prepareNodeArrangement(input);
    const inputIdentity = { schemaVersion: 1, kind: "arrangement", digest: prepared.identity } as const;
    const stillSelection = { requestedSeconds: 4, frame: 120, encodedSeconds: 4, origin: "explicit", artifacts: ["board.png"] } as const;
    const base = { finalPath, ...logicalTarget, sourceId: "launch", request: request(), producerVersion: "test" };
    const receipt = await publishPortableBundle({ ...base, bundle: bundle(bytes, sha256(bytes), "board.png"), inputIdentity, stillSelection });
    const retained = JSON.parse(await readFile(join(finalPath, "export.json"), "utf8"));
    expect(retained.inputIdentity).toEqual(inputIdentity);
    expect(retained.stillSelection).toEqual(stillSelection);
    expect(retained.renditions[0].sha256).toBe(sha256(bytes));
    await writeFile(join(root, "shot.png"), "changed asset");
    const changed = await prepareNodeArrangement(input);
    expect(changed.identity).not.toBe(prepared.identity);
    const otherIdentity = { ...inputIdentity, digest: changed.identity };
    const other = await publishPortableBundle({ ...base, finalPath: join(root, "other.export"), bundle: bundle(bytes, sha256(bytes), "board.png"), inputIdentity: otherIdentity, stillSelection });
    expect(other.manifest.requestDigest).not.toBe(receipt.manifest.requestDigest);
    await expect(publishPortableBundle({ ...base, bundle: bundle(bytes, "0".repeat(64), "board.png"), inputIdentity: otherIdentity, stillSelection })).rejects.toThrow("do not match");
    expect(JSON.parse(await readFile(join(finalPath, "export.json"), "utf8"))).toEqual(retained);
  });

  it("exposes no partial replacement when an artifact stream fails validation", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-interactions-"));
    roots.push(root);
    const finalPath = join(root, "launch.export");
    await mkdir(finalPath);
    await writeFile(join(finalPath, "old.txt"), "preserve me");
    const bytes = new TextEncoder().encode("tampered");

    await expect(
      publishPortableBundle({
        bundle: bundle(bytes, "0".repeat(64)),
        finalPath,
        ...logicalTarget,
        sourceId: "launch",
        request: request(),
        producerVersion: "0.1.0-test",
      }),
    ).rejects.toThrow("do not match");

    expect(await readFile(join(finalPath, "old.txt"), "utf8")).toBe("preserve me");
    expect(existsSync(join(finalPath, "export.json"))).toBe(false);
  });

  it("binds the selected editions into the durable request digest", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-interactions-"));
    roots.push(root);
    const bytes = new TextEncoder().encode("edition-aware");
    const square = await publishPortableBundle({
      bundle: bundle(bytes),
      finalPath: join(root, "square.export"),
      ...logicalTarget,
      sourceId: "launch",
      request: { ...request(), editionIds: ["square"] },
      producerVersion: "0.1.0-test",
    });
    const portrait = await publishPortableBundle({
      bundle: bundle(bytes),
      finalPath: join(root, "portrait.export"),
      ...logicalTarget,
      sourceId: "launch",
      request: { ...request(), editionIds: ["portrait"] },
      producerVersion: "0.1.0-test",
    });

    expect(square.manifest.requestDigest).not.toBe(portrait.manifest.requestDigest);
  });

  it("rejects traversal paths before exposing any publication", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-interactions-"));
    roots.push(root);
    const bytes = new TextEncoder().encode("escape attempt");

    await expect(
      publishPortableBundle({
        bundle: bundle(bytes, sha256(bytes), "../escape.mp4"),
        finalPath: join(root, "launch.export"),
        ...logicalTarget,
        sourceId: "launch",
        request: request(),
        producerVersion: "0.1.0-test",
      }),
    ).rejects.toThrow("escapes publication");

    expect(existsSync(join(root, "launch.export"))).toBe(false);
    expect(existsSync(join(root, "escape.mp4"))).toBe(false);
  });

  it("does not replace a destination symlink", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-interactions-"));
    roots.push(root);
    const target = join(root, "target");
    const finalPath = join(root, "launch.export");
    await mkdir(target);
    await writeFile(join(target, "preserve.txt"), "preserve me");
    await symlink(target, finalPath);
    const bytes = new TextEncoder().encode("symlink attempt");

    await expect(
      publishPortableBundle({
        bundle: bundle(bytes),
        finalPath,
        ...logicalTarget,
        sourceId: "launch",
        request: request(),
        producerVersion: "0.1.0-test",
      }),
    ).rejects.toThrow("cannot be a symlink");

    expect(await readFile(join(target, "preserve.txt"), "utf8")).toBe("preserve me");
  });
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
