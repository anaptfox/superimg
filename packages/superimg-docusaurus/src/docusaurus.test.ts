import { describe, expect, it } from "vitest";
import superimgDocusaurus, { normalizeOptions } from "./index.js";

describe("@superimg/docusaurus", () => {
  it("normalizes options with safe defaults", () => {
    const opts = normalizeOptions(undefined);
    expect(opts.id).toBe("default");
    expect(opts.asyncWebAssembly).toBe(true);
    expect(opts.asyncWebAssemblyOnServer).toBe(false);
    expect(opts.fallbackText).toBe("Loading preview…");
  });

  it("plugin enables client WASM only by default", () => {
    const plugin = superimgDocusaurus({}, {});
    expect(plugin.name).toBe("docusaurus-plugin-superimg");
    expect(plugin.getThemePath()).toBe("./theme");
    expect(plugin.getTypeScriptThemePath()).toBe("../src/theme");

    const client = plugin.configureWebpack({}, false);
    expect(client).toEqual({ experiments: { asyncWebAssembly: true } });

    const server = plugin.configureWebpack({}, true);
    expect(server).toEqual({});
  });

  it("can disable WASM or enable it on server", () => {
    const off = superimgDocusaurus({}, { asyncWebAssembly: false });
    expect(off.configureWebpack({}, false)).toEqual({});

    const both = superimgDocusaurus({}, {
      asyncWebAssemblyOnServer: true,
    });
    expect(both.configureWebpack({}, true)).toEqual({
      experiments: { asyncWebAssembly: true },
    });
  });
});
