import { filmEditHash, filmScript, filmScriptHash } from "./film.js";
import { parseScript } from "./parse.js";

export const SCRIPT_FILE_SUFFIX = ".script.md";
export const isScriptFile = (path: string): boolean => path.toLowerCase().endsWith(SCRIPT_FILE_SUFFIX);

/** Compile a script to the exact film-facing ES module used by source hosts. */
export function scriptModuleCode(text: string, path: string): string {
  const doc = parseScript(text);
  if (!doc) throw new Error(`${path} has no shot, speech, or card fence, so it is not a script.`);
  const film = filmScript(doc);
  return `export default ${JSON.stringify({ ...film, hash: filmScriptHash(film), editHash: filmEditHash(film) })};\n`;
}
