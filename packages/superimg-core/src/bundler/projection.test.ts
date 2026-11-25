import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bundleTemplateBrowser } from "./browser.js";
import { bundleMediaProgram, bundleTemplateESM, bundleTemplateWithMap } from "./bundler.js";
import { compileTemplate } from "../rendering/compiler.js";

const { rolldown } = vi.hoisted(() => ({
  rolldown: vi.fn(async () => ({
    generate: async () => ({
      output: [{
        code: "/* bundled */",
        map: { version: 3, sources: [], mappings: "" },
      }],
    }),
    close: async () => {},
  })),
}));

vi.mock("@rolldown/browser", () => ({ rolldown, VERSION: "test" }));

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

beforeEach(() => {
  rolldown.mockClear();
});

describe("collection source projection", () => {
  it("binds the entry source URL in an IIFE without rewriting string contents", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-source-base-"));
    temporaryDirectories.push(directory);
    const entrypoint = join(directory, "source.media.ts");
    await writeFile(entrypoint, `import { image, Html } from "@foxworth/superimg";
      const sourceBase = new URL("./assets/", import.meta.url).href;
      export default image({
        sample: { sourceBase, literal: "import.meta.url" },
        render: (ctx) => Html({ html: ctx.data.sourceBase }),
      });`);

    const bundle = await bundleTemplateWithMap(entrypoint);
    const compiled = compileTemplate(bundle);
    expect(compiled.error).toBeUndefined();
    expect(compiled.media?.sample).toMatchObject({
      sourceBase: new URL("./assets/", pathToFileURL(entrypoint)).href,
      literal: "import.meta.url",
    });
  });

  it("emits a minified ESM program with serializable runtime requirements", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-esm-capabilities-"));
    temporaryDirectories.push(directory);
    const entrypoint = join(directory, "code.media.ts");
    await writeFile(
      entrypoint,
      `import { image, Html } from "@foxworth/superimg";
       function helper(std) { return std.code.highlight("const x = 1", { lang: "ts" }); }
       export default image({ render(ctx) { return Html({ html: helper(ctx.std) }); } });`,
    );

    const code = await bundleTemplateESM(entrypoint);
    expect(code).not.toContain("sourceMappingURL");
    expect(code).toContain("mediaCapabilities");
    const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    expect(module.default.mediaCapabilities).toMatchObject({
      version: 0,
      names: expect.arrayContaining(["code"]),
    });
  });

  it("resolves a host authoring facade without an installed package", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-facade-resolution-"));
    temporaryDirectories.push(directory);
    const facade = join(directory, "authoring-facade.ts");
    const entrypoint = join(directory, "card.media.ts");
    await writeFile(
      facade,
      'export { image, Html } from "@foxworth/superimg";\n',
    );
    await writeFile(
      entrypoint,
      [
        'import { image, Html } from "application/media";',
        'export default image({ render: () => Html({ html: "<h1>Ready</h1>" }) });',
      ].join("\n"),
    );

    await expect(bundleMediaProgram(entrypoint, {
      sourceAnalysis: { facades: ["application/media"] },
    })).rejects.toThrow("must have an authoringFacades module mapping");

    const bundle = await bundleMediaProgram(entrypoint, {
      authoringFacades: { "application/media": facade },
    });
    const compiled = compileTemplate(bundle);
    expect(compiled.error).toBeUndefined();
    expect(compiled.media?.kind).toBe("media");
  });

  it("keeps server providers and entry data out of IIFEs and sourcemaps", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-projection-"));
    temporaryDirectories.push(directory);
    const entrypoint = join(directory, "cards.media.ts");

    await writeFile(
      join(directory, "cards.server.ts"),
      `import { readFile } from "node:fs/promises";
       export const PROVIDER_SECRET_MARKER = "provider-secret";
       export async function loadCards() {
         await readFile("/not-executed");
         return [{ id: "server-only-entry", title: PROVIDER_SECRET_MARKER }];
       }`,
    );
    await writeFile(
      entrypoint,
      `import { collection, image, Html } from "@foxworth/superimg";
       import { loadCards } from "./cards.server";
       export default collection({
         entries: loadCards,
         media: image<{ id: string; title: string }>({
           render(ctx) { return Html({ width: "fill", height: "fill", html: \`<h1>\${ctx.data.title}</h1>\` }); },
         }),
       });`,
    );

    const bundle = await bundleTemplateWithMap(entrypoint);
    const serializedMap = JSON.stringify(bundle.sourceMap);
    for (const marker of [
      "PROVIDER_SECRET_MARKER",
      "provider-secret",
      "server-only-entry",
      "cards.server",
      "node:fs/promises",
    ]) {
      expect(bundle.code).not.toContain(marker);
      expect(serializedMap).not.toContain(marker);
    }
  });

  it("rejects raw collection source before browser bundler initialization", async () => {
    await expect(
      bundleTemplateBrowser(`
        import { collection, image, Html } from "@foxworth/superimg";
        export default collection({
          entries: [{ id: "one" }],
          media: image({ render() { return Html({ width: "fill", height: "fill", html: "<div />" }); } }),
        });
      `),
    ).rejects.toMatchObject({ code: "COLLECTION_REQUIRES_SERVER_PROJECTION" });
    expect(rolldown).not.toHaveBeenCalled();
  });

  it("does not mistake collection text in comments or strings for collection source", async () => {
    const bundled = await bundleTemplateBrowser(`
        import { image, Html } from "@foxworth/superimg";
        // collection({ entries: [], media: image({}) })
        const note = "collection({})";
        export default image({ render() { return Html({ width: "fill", height: "fill", html: note }); } });
      `);
    expect(bundled.code).toBe("/* bundled */");
    expect(rolldown).toHaveBeenCalledTimes(2);
  });
});
