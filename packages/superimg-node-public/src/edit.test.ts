import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { compileNodeEditableSource, NodeEditEngine, NodeEditError } from "./edit.js";

it("compiles a project for direct bindings and refuses stale edits without writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-public-edit-"));
  const path = join(root, "card.media.ts");
  const source = `import { image, Frame, Text } from '@foxworth/superimg'; export default image({ size:{width:320,height:180}, render:()=>Frame({id:'title',x:10,y:20},Text({color:'#fff'},'Hi')) });`;
  try {
    await writeFile(path, source);
    const engine = new NodeEditEngine({ projectRoot: root, compileSource: args => compileNodeEditableSource(root, args) });
    const bindings = await engine.bindings("card.media.ts", {});
    expect(bindings.sourceHashes["card.media.ts"]).toBeTruthy();
    await expect(engine.plan({ schemaVersion: 0, source: "card.media.ts", kind: "set-node-transform", target: { nodeId: "title", xBindingId: "title#x", yBindingId: "title#y" }, value: { x: 30, y: 40 }, expected: { intentHash: "stale", sourceHashes: { "card.media.ts": "stale" } } }, {})).rejects.toBeInstanceOf(NodeEditError);
    expect(await readFile(path, "utf8")).toBe(source);
  } finally { await rm(root, { recursive: true, force: true }); }
});
