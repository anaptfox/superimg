import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serializeProgramLock } from "../src/artifacts.js";
import { MEDIA_COMPILED_INTERACTIONS } from "../src/compiled.js";
import { EDIT_COMPILED_INTERACTIONS } from "../src/edit/compiled.js";
import { RENDER_COMPILED_INTERACTIONS } from "../src/render/compiled.js";
import { SCRIPT_COMPILED_INTERACTIONS } from "../src/script/compiled.js";

const programs = Object.freeze({
  media: MEDIA_COMPILED_INTERACTIONS.program,
  edit: EDIT_COMPILED_INTERACTIONS.program,
  render: RENDER_COMPILED_INTERACTIONS.program,
  script: SCRIPT_COMPILED_INTERACTIONS.program,
});

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const lockPath = new URL("../program.lock", import.meta.url);
const contents = serializeProgramLock(programs);

if (process.argv.includes("--check")) {
  const current = await readFile(lockPath, "utf8").catch(() => "");
  if (current !== contents) {
    throw new Error(
      `generated media interaction artifacts drifted: ${fileURLToPath(lockPath).slice(packageRoot.length)}`,
    );
  }
} else {
  await writeFile(lockPath, contents);
}
