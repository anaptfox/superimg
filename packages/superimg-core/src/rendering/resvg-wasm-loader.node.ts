//! Node-only default loader for @resvg/resvg-wasm.

export async function loadDefaultWasm(): Promise<Uint8Array> {
  const specifier = "@resvg/resvg-wasm/index_bg.wasm";
  const resolved =
    typeof import.meta.resolve === "function"
      ? import.meta.resolve(specifier)
      : new URL(`../../node_modules/${specifier}`, import.meta.url).href;
  const [{ readFile }, { fileURLToPath }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
  ]);
  return new Uint8Array(await readFile(fileURLToPath(resolved)));
}