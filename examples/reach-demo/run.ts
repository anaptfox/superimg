#!/usr/bin/env npx tsx
/**
 * Five-step Reach demo. Host stays sovereign: this process owns Media
 * dispatch, the import map, and the Offer. Boundary only lists and carries pins.
 *
 * Run from this directory after `pnpm install` at the SuperImg root:
 *   pnpm --filter @superimg/reach-demo start
 */
import { spawn, type ChildProcess } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BusClient } from "@foxworth/boundary/bus";
import {
  acceptDraft,
  proposeDraft,
  type DraftStore,
} from "@foxworth/boundary/drafts";
import {
  admitAll,
  bindProjection,
  compileInteractions,
  installInteractions,
  projectInteractions,
} from "@foxworth/boundary";
import { createDraft, type Draft } from "@foxworth/boundary/program";
import {
  MEDIA_ARTIFACT_ROTATE_CONTRACT,
  MEDIA_COMPILED_INTERACTIONS,
  MEDIA_INTERACTION_IDS,
  mediaArtifactRotate,
} from "@superimg/interactions";
import {
  bindThumbnailGuest,
  type ThumbnailGuestRuntime,
} from "@superimg/interactions";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const boundaryRoot = resolve(repoRoot, "../ops");
const boundaryBin = process.env.BOUNDARY ?? join(boundaryRoot, "target/debug/boundary");
const socket =
  process.env.BOUNDARY_BUS_SOCKET ?? join(tmpdir(), `superimg-reach-demo-${process.pid}`, "bus.sock");

/**
 * The demo owns this integration-only bridge. Production SuperImg interactions
 * receive a component runtime from their host instead of reaching into a Boundary
 * checkout themselves.
 */
async function loadThumbnailGuestRuntime(): Promise<ThumbnailGuestRuntime> {
  const plugin = await import("@foxworth/boundary/plugin");
  return {
    async inspect({ bytes, interfaceName, footprints, witDigest }) {
      const offer = new plugin.ImportOffer(interfaceName);
      for (const footprint of footprints) offer.offer(footprint);
      const inspected = await plugin.inspectPlugin(bytes, offer, witDigest);
      return { realizationId: inspected.realizationId, check: inspected.check };
    },
    async execute({ bytes, interfaceName, footprints, witDigest, host, exportName, input }) {
      const offer = new plugin.ImportOffer(interfaceName);
      for (const footprint of footprints) offer.offer(footprint);
      const executor = plugin.createPluginExecutor();
      try {
        const loaded = await plugin.loadPlugin({ executor, bytes, offer, witDigest, host });
        if (loaded.status === "ready") {
          try {
            return await loaded.instance.call(exportName, input);
          } finally {
            await loaded.instance.close();
          }
        }
        return loaded.status === "refused"
          ? { status: "fault" as const, certainty: "not-started" as const, reason: `unmapped guest imports: ${loaded.unmapped.join(", ")}` }
          : loaded;
      } finally {
        await executor.close();
      }
    },
  };
}

function runBoundary(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(boundaryBin, args, {
      env: { ...process.env, BOUNDARY_BUS_SOCKET: socket },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

function startBus(): Promise<ChildProcess> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(boundaryBin, ["bus", "--socket", socket], {
      env: { ...process.env, BOUNDARY_BUS_SOCKET: socket },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("boundary bus did not start")); }, 8000);
    child.stderr?.on("data", (chunk: Buffer) => {
      if (String(chunk).includes("listening")) {
        clearTimeout(timer);
        resolvePromise(child);
      }
    });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`boundary bus exited ${code}`));
    });
  });
}

function mcpTools(): Promise<{ tools: { name: string }[]; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(boundaryBin, ["mcp", "--socket", socket], {
      env: { ...process.env, BOUNDARY_BUS_SOCKET: socket },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", () => {
      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const listed = lines
        .map((line) => JSON.parse(line) as { id?: number; result?: { tools?: { name: string }[] } })
        .find((message) => message.id === 2);
      resolvePromise({ tools: listed?.result?.tools ?? [], stderr });
    });
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "reach-demo", version: "0" },
        },
      })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`,
    );
    child.stdin.end();
  });
}

function mcpCall(name: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(boundaryBin, ["mcp", "--socket", socket], {
      env: { ...process.env, BOUNDARY_BUS_SOCKET: socket },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", reject);
    child.on("close", () => resolvePromise(stdout));
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "reach-demo", version: "0" },
        },
      })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name, arguments: {} },
      })}\n`,
    );
    child.stdin.end();
  });
}

function memoryDraftStore(): DraftStore {
  const byDigest = new Map<string, Draft>();
  return {
    put(draft) {
      byDigest.set(draft.draftDigest, draft);
    },
    get(draftDigest) {
      return byDigest.get(draftDigest);
    },
    list() {
      return Object.freeze([...byDigest.values()]);
    },
    recordDecision() {},
  };
}

async function main(): Promise<void> {
  await access(boundaryBin, constants.X_OK).catch(() => {
    throw new Error(`Build the sibling Boundary CLI first, or set BOUNDARY to its executable path. Missing: ${boundaryBin}`);
  });
  // Check the executable before loading the integration-only sibling sources.
  const [{ demoThumbnailSource, executeThumbnailGuest }, { startLiveMediaOffer }] = await Promise.all([
    import("../../packages/superimg-interactions/src/wasm/execute.ts"),
    import("./serve.js"),
  ]);
  await mkdir(dirname(socket), { recursive: true, mode: 0o700 });
  const busProcess = await startBus();
  let surface: Awaited<ReturnType<typeof startLiveMediaOffer>> | undefined;
  let bus: BusClient | undefined;
  try {
    surface = await startLiveMediaOffer(repoRoot);
    bus = await BusClient.connect(socket);
    await bus.register(surface.record);
    console.log("1. boundary list after the Media session registered");
    const listed = await runBoundary(["list", "--socket", socket]);
    process.stdout.write(listed.stdout || listed.stderr);
    if (!listed.stdout.includes(surface.bindingDigest)) {
      throw new Error("boundary list did not show the Media Reach record");
    }

    console.log("2. boundary call media.source.check");
    const called = await runBoundary([
      "call",
      MEDIA_INTERACTION_IDS.check,
      "--socket",
      socket,
      "--input",
      JSON.stringify({
        source: "examples/basics/hello-world/hello-world.media.ts",
      }),
    ]);
    process.stdout.write(called.stdout || called.stderr);
    const checkOutcome = JSON.parse(called.stdout) as {
      certainty?: string;
      result?: { kind?: string };
    };
    if (checkOutcome.result?.kind !== "returned" || checkOutcome.certainty !== "completed") {
      throw new Error("boundary call media.source.check must return, not fault");
    }

    console.log("3. Zig thumbnail bind and call");
    const thumbnailRuntime = await loadThumbnailGuestRuntime();
    const bytes = await readFile(join(repoRoot, "packages/superimg-interactions/guests/thumbnail/zig-out/thumbnail.component.wasm"));
    const ok = await bindThumbnailGuest(thumbnailRuntime, bytes);
    console.log(`   compliant: ${ok.status}`);
    const { store: rasters, artifactId } = demoThumbnailSource();
    const calledGuest = await executeThumbnailGuest({
      runtime: thumbnailRuntime,
      bytes,
      store: rasters,
      input: { artifactId, maxWidth: 200 },
    });
    if (calledGuest.status !== "returned") {
      throw new Error(`thumbnail guest must return, got ${JSON.stringify(calledGuest)}`);
    }
    const thumbnail = JSON.parse(calledGuest.payload) as {
      width?: number;
      height?: number;
    };
    console.log(`   call: width=${thumbnail.width} height=${thumbnail.height}`);
    const overreachBytes = await readFile(join(repoRoot, "packages/superimg-interactions/guests/thumbnail-overreach/overreach.component.wasm"));
    const refused = await bindThumbnailGuest(thumbnailRuntime, overreachBytes);
    if (refused.status !== "unrealized") {
      throw new Error("expected publications guest to be refused");
    }
    console.log(`   publications guest: ${refused.report}`);
    if (
      !refused.unmapped.includes(
        "boundary:guest/footprints@1.0.0#media-publications",
      )
    ) {
      throw new Error("refusal must name boundary:guest/footprints@1.0.0#media-publications");
    }

    console.log("4. boundary mcp lists the Offer; discover is unoffered");
    const mcp = await mcpTools();
    process.stderr.write(mcp.stderr);
    const names = mcp.tools.map((tool) => tool.name).sort();
    console.log(`   tools: ${names.join(", ")}`);
    const expected = [
      "check",
      "inspect",
      "describe",
      "thumbnail",
      "arrange",
      "snapshot",
      "compile",
      "export",
    ].sort();
    if (names.join(",") !== expected.join(",")) {
      throw new Error(`boundary mcp tools were ${names.join(", ")}; expected ${expected.join(", ")}`);
    }
    if (names.some((name) => name.includes("delete") || name === "discover")) {
      throw new Error("boundary mcp listed an unoffered interaction");
    }
    const unoffered = await mcpCall("discover");
    if (!unoffered.includes("unknown tool")) {
      throw new Error(`unoffered discover must be a tool error, got ${unoffered}`);
    }
    console.log("   unoffered media.project.discover: unknown tool");

    console.log("5. Draft media.artifact.rotate; accept does not mutate the live Program");
    const live = MEDIA_COMPILED_INTERACTIONS.program;
    const store = memoryDraftStore();
    const draft = createDraft({
      contract: MEDIA_ARTIFACT_ROTATE_CONTRACT,
      gap: "no interaction rotates an artifact raster today",
      proposer: "model",
      createdAt: "2026-09-06T12:00:00Z",
    });
    await proposeDraft(store, draft);
    await acceptDraft(store, {
      draftDigest: draft.draftDigest,
      decidedBy: "author",
      decidedAt: "2026-09-06T12:05:00Z",
    });
    if (MEDIA_COMPILED_INTERACTIONS.program !== live) {
      throw new Error("accept mutated the live Program");
    }
    const compiled = compileInteractions({ rotate: mediaArtifactRotate });
    const missing = installInteractions(compiled, {
      installationId: "demo:rotate-missing",
      bindings: [],
      realizationIds: {},
    });
    const projection = projectInteractions(compiled, {
      rotate: { interaction: compiled.handles.rotate, modes: ["direct"] },
    });
    const bound = bindProjection(projection, missing.installation, { admit: admitAll });
    if (bound.status !== "unrealized") {
      throw new Error("expected missing-direct");
    }
    console.log(`   Binding: ${bound.report.issues.map((issue) => issue.reason).join(", ")}`);
    await bus.unregister(surface.record.bindingDigest);
    if ((await bus.list()).some((record) => record.bindingDigest === surface!.bindingDigest)) {
      throw new Error("withdrawal left the binding discoverable");
    }
    console.log("6. withdrawn binding is absent while the bus client remains connected");
    console.log("done");
  } finally {
    bus?.close();
    try { await surface?.stop(); } finally { busProcess.kill("SIGTERM"); }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
