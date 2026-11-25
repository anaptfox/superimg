import { execFile as execFileCb } from "node:child_process";
import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

// scripts/verify-codec-consumers.mjs prepares this clean installation and its
// fixtures; the ordinary integration suite skips this independently gated test.
const directory = process.env.SUPERIMG_CODEC_CONSUMER_DIR;
const packed = directory ? it : it.skip;
const execFile = promisify(execFileCb);

packed("shares native codec registration across installed entry points in either order", async () => {
  const cwd = directory!;
  const script = join(cwd, "superimg-codec-probe.mjs");
  await copyFile(fileURLToPath(new URL("../fixtures/codec-consumer/probe.mjs", import.meta.url)), script);
  for (const order of ["root-first", "node-first"]) {
    const { stdout, stderr } = await execFile(process.execPath, [script, order], {
      cwd, timeout: 90_000, env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" },
    });
    expect(`${stdout}\n${stderr}`).not.toMatch(/(?:mediabunny|prores|dts).*loaded twice/i);
    const result = JSON.parse(stdout) as { order: string; facts: string[] };
    expect(result.order).toBe(order);
    expect(result.facts[0]).toBe(order === "root-first" ? "root-avc-render" : "frames:avc-aac.mp4:avc");
    expect(result.facts).toEqual(expect.arrayContaining([
      "root-avc-render", "root-prores-aac-conversion", "frames:avc-aac.mp4:avc",
      "frames:opaque.mov:prores", "frames:alpha.mov:prores", "dts-waveform",
    ]));
    await writeFile(join(cwd, `codec-${order}-facts.json`), JSON.stringify({ ...result, stderr }, null, 2));
  }
}, 200_000);
