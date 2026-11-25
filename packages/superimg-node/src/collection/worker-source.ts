//! Isolated collection-provider runner.
//!
//! The string is intentionally dependency-free: the parent starts it with the
//! current Node executable and reserves stdout for one structured JSON reply.

export const COLLECTION_WORKER_SOURCE = String.raw`
import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const reply = (value) => process.stdout.write(JSON.stringify(value));
const fail = (kind, error) => {
  const message = error instanceof Error ? error.message : String(error);
  reply({ ok: false, kind, message });
};
console.log = (...values) => console.error(...values);
console.info = (...values) => console.error(...values);
console.debug = (...values) => console.error(...values);

function assertJson(value, path = "$", ancestors = new Set()) {
  if (value === null) return;
  const type = typeof value;
  if (type === "string" || type === "boolean") return;
  if (type === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number at " + path);
    return;
  }
  if (type !== "object") throw new Error("Unsupported " + type + " at " + path);
  if (ancestors.has(value)) throw new Error("Cyclic value at " + path);
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new Error("Sparse array at " + path + "[" + index + "]");
      }
      assertJson(value[index], path + "[" + index + "]", ancestors);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Non-plain object at " + path);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error("Symbol-keyed property at " + path);
    }
    for (const key of Object.keys(value)) {
      assertJson(value[key], path + "." + key, ancestors);
    }
  }
  ancestors.delete(value);
}

async function imported(binding, baseUrl) {
  const moduleUrl = await resolveModuleUrl(binding.module, baseUrl);
  const namespace = await import(moduleUrl);
  const name = binding.kind === "default" ? "default" : binding.imported;
  if (!(name in namespace)) throw new Error("Missing export " + JSON.stringify(name) + " from " + binding.module);
  return namespace[name];
}

async function resolveModuleUrl(specifier, baseUrl) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("file:")) {
    return specifier;
  }
  const exact = new URL(specifier, baseUrl);
  if (exact.protocol !== "file:") return exact.href;
  try {
    await access(fileURLToPath(exact));
    return exact.href;
  } catch {}
  for (const extension of [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]) {
    const candidate = new URL(exact.href);
    candidate.pathname += extension;
    try {
      await access(fileURLToPath(candidate));
      return candidate.href;
    } catch {}
  }
  return exact.href;
}

let input = "";
for await (const chunk of process.stdin) input += chunk;

let failureKind = "execution";
try {
  const request = JSON.parse(input);
  const baseUrl = pathToFileURL(request.filename).href;
  let entries;
  if (request.entries.kind === "static") {
    entries = (0, eval)("(" + request.entries.source + ")");
  } else {
    let provider;
    try {
      provider = await imported(request.entries.import, baseUrl);
    } catch (error) {
      failureKind = "load";
      throw error;
    }
    if (typeof provider !== "function") throw new Error("Collection provider export must be a function");
    if (provider.length !== 0) throw new Error("Collection provider must be a zero-argument function");
    entries = await provider();
  }
  if (!Array.isArray(entries)) throw new Error("Collection provider must return a complete array");
  assertJson(entries);

  let ids;
  if (request.entryId?.kind === "function") {
    const identify = (0, eval)("(" + request.entryId.source + ")");
    if (typeof identify !== "function") throw new Error("Collection entryId source must evaluate to a function");
    failureKind = "identity";
    ids = entries.map((entry) => identify(entry));
  } else if (request.entryId?.kind === "imported-function") {
    let identify;
    try {
      identify = await imported(request.entryId.import, baseUrl);
    } catch (error) {
      failureKind = "load";
      throw error;
    }
    if (typeof identify !== "function") throw new Error("Collection entryId export must be a function");
    failureKind = "identity";
    ids = entries.map((entry) => identify(entry));
  }
  if (ids !== undefined) assertJson(ids);
  reply({ ok: true, entries, ...(ids === undefined ? {} : { ids }) });
} catch (error) {
  fail(failureKind, error);
}
`;
