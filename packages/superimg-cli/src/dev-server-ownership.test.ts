import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { startDevServer, type DevServer } from "./dev-server.js";

it("an explicit source previews the source-owning package library", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-dev-owner-"));
  let server: DevServer | undefined;
  const listener = createServer();
  try {
    await mkdir(join(root, "packages/campaign/media"), { recursive: true });
    await writeFile(join(root, "package.json"), '{"private":true,"workspaces":["packages/*"]}');
    await writeFile(join(root, "root-only.media.ts"), "export default {};");
    await writeFile(join(root, "packages/campaign/package.json"), '{"type":"module"}');
    const source = join(root, "packages/campaign/media/card.media.ts");
    await writeFile(source, "export default {};");
    await new Promise<void>((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
    const address = listener.address();
    if (!address || typeof address === "string") throw new Error("Expected test port");
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    server = await startDevServer(source, { port: address.port });
    const response = await fetch(`${new URL(server.url).origin}/api/videos`);
    expect(response.status).toBe(200);
    const entries = await response.json() as { relativePath: string }[];
    expect(entries.map((entry) => entry.relativePath)).toEqual(["media/card.media.ts"]);
  } finally {
    if (listener.listening) await new Promise<void>((resolve) => listener.close(() => resolve()));
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
