//! The SuperImg script format (`*.script.md`): parse, print, and hash.
//!
//! No dependencies; runs in Node and in a browser.

export { SCRIPT_FIELD_KEY_PATTERN, SCRIPT_ID_PATTERN, parseShotBeats } from "./grammar.js";
export { parseScript, scriptBlocks } from "./parse.js";
export { patchScriptAttr, type PatchAttrResult } from "./patch.js";
export {
  editBlock,
  insertBlock,
  removeBlock,
  sliceShots,
  checkScript,
  type BlockEditPatch,
  type InsertBlockOptions,
  type SliceShotsOptions,
  type EditScriptResult,
} from "./edit.js";
export { printScript } from "./print.js";
export { editHash, filmEditHash, filmScript, filmScriptHash, scriptHash } from "./film.js";
export type {
  FilmBlock,
  FilmCard,
  FilmScript,
  FilmShot,
  FilmSpeech,
  ScriptAt,
  ScriptBeatAnchor,
  ScriptBlock,
  ScriptBlockBase,
  ScriptCard,
  ScriptCheckOptions,
  ScriptDocument,
  ScriptFinding,
  ScriptFindingCode,
  ScriptItem,
  ScriptMarkdown,
  ScriptShot,
  ScriptSpeech,
} from "./types.js";
export { setShotHold } from "./edit.js";
export { SCRIPT_FILE_SUFFIX, isScriptFile, scriptModuleCode } from "./module.js";
