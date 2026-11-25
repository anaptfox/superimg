import { mkdir, writeFile } from "node:fs/promises";
import { render } from "@foxworth/superimg/runtime";
import clip from "./clip.media";

const mp4 = await render(clip, { as: "mp4" });
await mkdir("out", { recursive: true });
await writeFile("out/clip.mp4", Buffer.from(await mp4.bytes()));
