import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CollectionSourceDescriptor, SourceDescriptor } from "@superimg/core/source-analysis";
import { CollectionExecutionError, loadCollectionEntries } from "./index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(): Promise<{ directory: string; filename: string }> {
  const directory = await mkdtemp(join(tmpdir(), "superimg-collection-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "clips.media.ts");
  await writeFile(filename, "// descriptor anchor\n");
  return { directory, filename };
}

function staticDescriptor(filename: string, source: string, entryId?: CollectionSourceDescriptor["entryId"]): CollectionSourceDescriptor {
  return {
    schemaVersion: 0,
    kind: "collection",
    filename,
    declaration: "direct",
    collectionRange: { start: 0, end: source.length },
    mediaRange: { start: 0, end: 0 },
    entries: { kind: "static", source, range: { start: 0, end: source.length } },
    ...(entryId === undefined ? {} : { entryId }),
    mediaProjection: projection(filename),
    entriesProjection: projection(`${filename}?entries`),
  };
}

function providerDescriptor(
  filename: string,
  module = "./clips.server.mjs",
  imported = "loadClips",
  entryId?: CollectionSourceDescriptor["entryId"],
): CollectionSourceDescriptor {
  return {
    schemaVersion: 0,
    kind: "collection",
    filename,
    declaration: "direct",
    collectionRange: { start: 0, end: 1 },
    mediaRange: { start: 0, end: 1 },
    entries: {
      kind: "provider",
      import: { module, imported, local: imported, kind: imported === "default" ? "default" : "named" },
      range: { start: 0, end: 1 },
    },
    ...(entryId === undefined ? {} : { entryId }),
    mediaProjection: projection(filename),
    entriesProjection: projection(`${filename}?entries`),
  };
}

function projection(filename: string) {
  return {
    code: "",
    map: { version: 3, sources: [filename], sourcesContent: [""], names: [], mappings: "" },
  };
}

async function expectCode(promise: Promise<unknown>, code: CollectionExecutionError["code"]): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CollectionExecutionError);
    expect((error as CollectionExecutionError).code).toBe(code);
  }
}

describe("loadCollectionEntries", () => {
  it("resolves static entries, preserves raw data, computes stable digests, and deeply freezes the snapshot", async () => {
    const { filename } = await fixture();
    const first = await loadCollectionEntries(staticDescriptor(filename, `[
      { id: "ada", title: "Ada", nested: { score: 1 } },
      { id: "grace", title: "Grace", nested: { score: 2 } }
    ]`));
    const reordered = await loadCollectionEntries(staticDescriptor(filename, `[
      { title: "Ada", nested: { score: 1 }, id: "ada" }
    ]`));

    expect(first.map(({ id }) => id)).toEqual(["ada", "grace"]);
    expect(first[0]!.data).toEqual({ id: "ada", title: "Ada", nested: { score: 1 } });
    expect(first[0]!.dataDigest).toBe(reordered[0]!.dataDigest);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0]!.data)).toBe(true);
    expect(Object.isFrozen((first[0]!.data as { nested: object }).nested)).toBe(true);
  });

  it("supports sync and async zero-argument providers and property/function identities", async () => {
    const { directory, filename } = await fixture();
    await writeFile(join(directory, "clips.server.mjs"), `
      export function loadClips() { return [{ slug: "sync", title: "Sync" }]; }
      export async function loadAsync() { await Promise.resolve(); return [{ slug: "async", title: "Async" }]; }
      export const identify = (entry) => entry.slug;
    `);

    const sync = await loadCollectionEntries(providerDescriptor(filename, "./clips.server.mjs", "loadClips", {
      kind: "property",
      property: "slug",
      range: { start: 0, end: 1 },
    }));
    const asyncEntries = await loadCollectionEntries(providerDescriptor(filename, "./clips.server.mjs", "loadAsync", {
      kind: "imported-function",
      import: { module: "./clips.server.mjs", imported: "identify", local: "identify", kind: "named" },
      range: { start: 0, end: 1 },
    }));
    const inlineId = await loadCollectionEntries(providerDescriptor(filename, "./clips.server.mjs", "loadClips", {
      kind: "function",
      source: "(entry) => entry.slug + '-inline'",
      range: { start: 0, end: 1 },
    }));

    expect(sync[0]!.id).toBe("sync");
    expect(asyncEntries[0]!.id).toBe("async");
    expect(inlineId[0]!.id).toBe("sync-inline");
  });

  it("resolves the extensionless dedicated .server import used by authored TypeScript", async () => {
    const { directory, filename } = await fixture();
    await writeFile(join(directory, "typed.server.ts"), `
      interface Clip { id: string; title: string }
      export async function loadClips(): Promise<Clip[]> {
        return [{ id: "typed", title: "TypeScript" }];
      }
    `);

    const entries = await loadCollectionEntries(providerDescriptor(filename, "./typed.server"));
    expect(entries).toMatchObject([{ id: "typed", data: { title: "TypeScript" } }]);
  });

  it("does not inherit parent env secrets into the provider worker", async () => {
    const { directory, filename } = await fixture();
    const marker = "SUPERIMG_TEST_PROVIDER_SECRET";
    const previous = process.env[marker];
    process.env[marker] = "must-not-leak";
    await writeFile(join(directory, "clips.server.mjs"), `
      export function loadClips() {
        return [{ id: "env", leaked: process.env[${JSON.stringify(marker)}] ?? null }];
      }
    `);
    try {
      const entries = await loadCollectionEntries(providerDescriptor(filename));
      expect(entries[0]!.data).toEqual({ id: "env", leaked: null });
    } finally {
      if (previous === undefined) delete process.env[marker];
      else process.env[marker] = previous;
    }
  });

  it("executes a provider exactly once per load snapshot", async () => {
    const { directory, filename } = await fixture();
    const countFile = join(directory, "count.txt");
    await writeFile(countFile, "0");
    await writeFile(join(directory, "clips.server.mjs"), `
      import { readFile, writeFile } from "node:fs/promises";
      const file = ${JSON.stringify(countFile)};
      export async function loadClips() {
        const count = Number(await readFile(file, "utf8")) + 1;
        await writeFile(file, String(count));
        return [{ id: "only", count }];
      }
    `);

    const entries = await loadCollectionEntries(providerDescriptor(filename));
    expect(entries[0]!.data).toEqual({ id: "only", count: 1 });
    expect(await readFile(countFile, "utf8")).toBe("1");
  });

  it("keeps provider console output off the structured IPC channel", async () => {
    const { directory, filename } = await fixture();
    await writeFile(join(directory, "clips.server.mjs"), `
      export function loadClips() {
        console.log("provider diagnostic");
        return [{ id: "logged" }];
      }
    `);
    const entries = await loadCollectionEntries(providerDescriptor(filename));
    expect(entries[0]!.id).toBe("logged");
  });

  it("rejects providers that require arguments", async () => {
    const { directory, filename } = await fixture();
    await writeFile(join(directory, "clips.server.mjs"), `export function loadClips(required) { return [{ id: required }]; }`);
    await expectCode(loadCollectionEntries(providerDescriptor(filename)), "COLLECTION_PROVIDER_EXECUTION_FAILED");
  });

  it.each([
    { name: "missing id", source: `[{ title: "No id" }]`, code: "COLLECTION_ID_REQUIRED" },
    { name: "empty id", source: `[{ id: "" }]`, code: "COLLECTION_ID_INVALID" },
    { name: "whitespace", source: `[{ id: " one " }]`, code: "COLLECTION_ID_INVALID" },
    { name: "path escape", source: `[{ id: "../one" }]`, code: "COLLECTION_ID_INVALID" },
    { name: "Windows device stem", source: `[{ id: "NUL.txt" }]`, code: "COLLECTION_ID_INVALID" },
    { name: "duplicate", source: `[{ id: "one" }, { id: "one" }]`, code: "COLLECTION_ID_DUPLICATE" },
    { name: "case collision", source: `[{ id: "One" }, { id: "one" }]`, code: "COLLECTION_ID_CASE_COLLISION" },
  ] as const)("rejects $name", async ({ source, code }) => {
    const { filename } = await fixture();
    await expectCode(loadCollectionEntries(staticDescriptor(filename, source)), code);
  });

  it("rejects empty, non-finite, cyclic, and otherwise non-JSON snapshots", async () => {
    const { directory, filename } = await fixture();
    await expectCode(loadCollectionEntries(staticDescriptor(filename, "[]")), "COLLECTION_EMPTY");
    await writeFile(join(directory, "clips.server.mjs"), `
      export function nonfinite() { return [{ id: "bad", score: Number.POSITIVE_INFINITY }]; }
      export function cyclic() { const entry = { id: "bad" }; entry.self = entry; return [entry]; }
      export function invalid() { return [{ id: "bad", missing: undefined }]; }
    `);
    await expectCode(loadCollectionEntries(providerDescriptor(filename, "./clips.server.mjs", "nonfinite")), "COLLECTION_ENTRY_NOT_JSON");
    await expectCode(loadCollectionEntries(providerDescriptor(filename, "./clips.server.mjs", "cyclic")), "COLLECTION_ENTRY_NOT_JSON");
    await expectCode(loadCollectionEntries(providerDescriptor(filename, "./clips.server.mjs", "invalid")), "COLLECTION_ENTRY_NOT_JSON");
  });

  it("rejects ordinary, nested-like, and interactive descriptors", async () => {
    const { filename } = await fixture();
    const ordinary: SourceDescriptor = {
      schemaVersion: 0,
      kind: "media",
      filename,
      mediaProjection: projection(filename),
    };
    await expectCode(loadCollectionEntries(ordinary), "COLLECTION_NESTED");
    await expectCode(loadCollectionEntries({ ...ordinary, kind: "interactive" } as unknown as SourceDescriptor), "COLLECTION_INTERACTIVE_UNSUPPORTED");
  });

  it("terminates a timed-out provider process tree", async () => {
    const { directory, filename } = await fixture();
    const pidFile = join(directory, "grandchild.pid");
    const heartbeat = join(directory, "grandchild-heartbeat.txt");
    await writeFile(join(directory, "clips.server.mjs"), hangingProviderWithHeartbeat(pidFile, heartbeat));

    const pending = loadCollectionEntries(providerDescriptor(filename), { timeoutMs: 1_000 });
    // Wait until the grandchild is running before delaying this process's
    // timeout callback. Otherwise a short deadline can kill the worker while
    // it is still starting, and the test never exercises descendant cleanup.
    await waitForFile(pidFile);
    await waitForFile(heartbeat);
    // The timeout uses this process's event loop. Simulate the delay caused by
    // a busy test gate: the grandchild may write before the timeout callback
    // runs, so a marker's mere existence cannot establish a leak.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_200);
    await expectCode(pending, "COLLECTION_PROVIDER_TIMEOUT");
    const grandchildPid = Number(await readFile(pidFile, "utf8"));
    expect(Number.isSafeInteger(grandchildPid)).toBe(true);
    await expectProcessExit(grandchildPid);
    const heartbeatAtExit = await readFile(heartbeat, "utf8");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    expect(await readFile(heartbeat, "utf8")).toBe(heartbeatAtExit);
  });

  it("cancels and terminates the provider process tree through AbortSignal", async () => {
    const { directory, filename } = await fixture();
    const pidFile = join(directory, "grandchild.pid");
    const heartbeat = join(directory, "grandchild-heartbeat.txt");
    await writeFile(join(directory, "clips.server.mjs"), hangingProviderWithHeartbeat(pidFile, heartbeat));
    const controller = new AbortController();
    const pending = loadCollectionEntries(providerDescriptor(filename), { timeoutMs: 2_000, signal: controller.signal });
    await waitForFile(pidFile);
    await waitForFile(heartbeat);
    controller.abort(new Error("stop"));

    await expectCode(pending, "COLLECTION_PROVIDER_EXECUTION_FAILED");
    const grandchildPid = Number(await readFile(pidFile, "utf8"));
    expect(Number.isSafeInteger(grandchildPid)).toBe(true);
    await expectProcessExit(grandchildPid);
    const heartbeatAtExit = await readFile(heartbeat, "utf8");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    expect(await readFile(heartbeat, "utf8")).toBe(heartbeatAtExit);
  });
});

function hangingProviderWithHeartbeat(pidFile: string, heartbeat: string): string {
  return `
    import { spawn } from "node:child_process";
    export async function loadClips() {
      spawn(process.execPath, ["--input-type=module", "--eval", ${JSON.stringify(
        `import { appendFileSync, writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => appendFileSync(${JSON.stringify(heartbeat)}, "alive\\n"), 10);`,
      )}], { stdio: "ignore" });
      await new Promise(() => {});
    }
  `;
}

async function expectProcessExit(pid: number): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (typeof error === "object" && error !== null && Reflect.get(error, "code") === "ESRCH") return;
      throw error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(`Provider grandchild process ${pid} remained alive after timeout`);
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      await readFile(path);
      return;
    } catch (error) {
      if (typeof error !== "object" || error === null || Reflect.get(error, "code") !== "ENOENT") throw error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  throw new Error(`Timed out waiting for provider descendant handshake at ${path}`);
}
