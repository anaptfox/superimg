import { describe, expect, it } from "vitest";
import {
  MediaSourceAnalysisError,
  analyzeMediaSource,
  assertBrowserSourceCanCompile,
} from "./analyze-media-source.js";

const filename = "/project/clips.media.ts";

function expectCode(source: string, code: MediaSourceAnalysisError["code"]): void {
  try {
    analyzeMediaSource(source, filename);
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(MediaSourceAnalysisError);
    expect((error as MediaSourceAnalysisError).code).toBe(code);
  }
}

describe("analyzeMediaSource", () => {
  it("recognizes collection imports from a configured authoring facade", () => {
    const direct = analyzeMediaSource(
      `import { collection, image } from "framework/media";
       import { loadCards } from "./cards.server";
       export default collection({ entries: loadCards, media: image({ render }) });`,
      filename,
      { facades: ["framework/media"] },
    );
    expect(direct.kind).toBe("collection");
    expect(direct.mediaProjection.code).not.toContain("loadCards");
    expect(direct.mediaProjection.code).not.toContain("cards.server");

    const aliased = analyzeMediaSource(
      `import { collection as defineCollection, image } from "framework/media";
       export default defineCollection({ entries: [{ id: "one" }], media: image({ render }) });`,
      filename,
      { facades: ["framework/media"] },
    );
    expect(aliased.kind).toBe("collection");
  });

  it("recognizes interactive definitions from a configured authoring facade", () => {
    expect(() => analyzeMediaSource(
      `import { collection, defineInteractive } from "framework/media";
       export default collection({
         entries: [{ id: "one" }],
         media: defineInteractive({ guide, render }),
       });`,
      filename,
      { facades: ["framework/media"] },
    )).toThrowError(expect.objectContaining({
      code: "COLLECTION_INTERACTIVE_UNSUPPORTED",
    }));
  });

  it("does not treat unconfigured packages as authoring facades", () => {
    const descriptor = analyzeMediaSource(
      `import { collection, image } from "framework/media";
       export default collection({ entries: [{ id: "one" }], media: image({ render }) });`,
      filename,
    );
    expect(descriptor.kind).toBe("media");
  });

  it("projects an imported provider away from browser-safe media", () => {
    const source = `
import { collection, video } from "@foxworth/superimg";
import { loadClips } from "./clips.server"; // PROVIDER_ONLY_MARKER
import { renderClip } from "./render-clip";

export default collection({
  entries: loadClips,
  media: video({
    duration: "12s",
    render: renderClip,
  }),
});
`;

    const descriptor = analyzeMediaSource(source, filename);
    expect(descriptor.kind).toBe("collection");
    if (descriptor.kind !== "collection") return;

    expect(descriptor.schemaVersion).toBe(0);
    expect(descriptor.entries).toEqual({
      kind: "provider",
      import: {
        module: "./clips.server",
        imported: "loadClips",
        local: "loadClips",
        kind: "named",
      },
      range: expect.any(Object),
    });
    expect(descriptor.mediaProjection.code).toContain('import { video } from "@foxworth/superimg";');
    expect(descriptor.mediaProjection.code).toContain('import { renderClip } from "./render-clip";');
    expect(descriptor.mediaProjection.code).toContain("export default");
    expect(descriptor.mediaProjection.code).toContain('duration: "12s"');
    expect(descriptor.mediaProjection.code).not.toContain("collection");
    expect(descriptor.mediaProjection.code).not.toContain("loadClips");
    expect(descriptor.mediaProjection.code).not.toContain("clips.server");
    expect(descriptor.mediaProjection.code).not.toContain("PROVIDER_ONLY_MARKER");
    expect(descriptor.mediaProjection.map.sourcesContent.join("\n")).toBe(
      descriptor.mediaProjection.code,
    );
    expect(descriptor.mediaProjection.map.sourcesContent.join("\n")).not.toContain(
      "PROVIDER_ONLY_MARKER",
    );
    expect(descriptor.entriesProjection.code).toContain(
      'import { loadClips as __superimg_entries } from "./clips.server";',
    );
  });

  it("accepts a deeply JSON-compatible inline readonly array and removes all data", () => {
    const source = `
import { collection, image, Html } from "@foxworth/superimg";
export default collection({
  entries: [
    { id: "ada", title: "Ada", flags: [true, false, null], score: -1.5 },
    { id: "grace", title: "Grace", flags: [], score: 2 },
  ] as const,
  media: image<{ id: string; title: string }>({
    render(ctx) { return Html({ width: "fill", height: "fill", html: ctx.data.title }); },
  }),
});
`;
    const descriptor = analyzeMediaSource(source, filename);
    expect(descriptor.kind).toBe("collection");
    if (descriptor.kind !== "collection") return;

    expect(descriptor.entries.kind).toBe("static");
    expect(descriptor.mediaProjection.code).not.toContain("Ada");
    expect(descriptor.mediaProjection.code).not.toContain("Grace");
    expect(descriptor.mediaProjection.map.sourcesContent.join("\n")).not.toContain("Ada");
    expect(descriptor.entriesProjection.code).toContain('id: "ada"');
    expect(descriptor.mediaProjection.code).toContain("image<{ id: string; title: string }>");
  });

  it("supports one const collection binding exported as default", () => {
    const source = `
import { collection, svg } from "@foxworth/superimg";
import loadIcons from "./icons.server";
const icons = collection({ entries: loadIcons, entryId: "id", media: svg({ render: draw }) });
export default icons;
`;
    const descriptor = analyzeMediaSource(source, filename);
    expect(descriptor.kind).toBe("collection");
    if (descriptor.kind !== "collection") return;
    expect(descriptor.declaration).toBe("binding");
    expect(descriptor.binding).toBe("icons");
    expect(descriptor.entryId).toMatchObject({ kind: "property", property: "id" });
    expect(descriptor.mediaProjection.code).toContain("const icons =");
    expect(descriptor.mediaProjection.code).toContain("svg({ render: draw })");
    expect(descriptor.mediaProjection.code).toContain("export default icons");
    expect(descriptor.mediaProjection.code).not.toContain("loadIcons");
  });

  it("rewrites adjacent one-line imports without consuming following statements", () => {
    const source = `import { collection, image } from "@foxworth/superimg"; import { load } from "./cards.server"; import { render } from "./render"; export default collection({ entries: load, media: image({ render }) });`;
    const descriptor = analyzeMediaSource(source, filename);
    expect(descriptor.kind).toBe("collection");
    expect(descriptor.mediaProjection.code).toContain('import { image } from "@foxworth/superimg";');
    expect(descriptor.mediaProjection.code).toContain('import { render } from "./render";');
    expect(descriptor.mediaProjection.code).toContain("export default");
    expect(descriptor.mediaProjection.code).not.toContain("./cards.server");
  });

  it("extracts inline and imported entryId selectors into the server projection", () => {
    const inline = analyzeMediaSource(
      `import { collection, image, Html } from "@foxworth/superimg";
       import { load } from "./cards.server";
       export default collection({ entries: load, entryId: (card) => card.slug, media: image({ render }) });`,
      filename,
    );
    expect(inline.kind).toBe("collection");
    if (inline.kind === "collection") {
      expect(inline.entryId?.kind).toBe("function");
      expect(inline.entriesProjection.code).toContain("entryId: (card) => card.slug");
    }

    const imported = analyzeMediaSource(
      `import { collection, image } from "@foxworth/superimg";
       import { load, identify } from "./cards.server";
       export default collection({ entries: load, entryId: identify, media: image({ render }) });`,
      filename,
    );
    expect(imported.kind).toBe("collection");
    if (imported.kind === "collection") {
      expect(imported.entryId?.kind).toBe("imported-function");
      expect(imported.mediaProjection.code).not.toContain("identify");
      expect(imported.entriesProjection.code).toContain(
        'import { identify as __superimg_entry_id } from "./cards.server";',
      );
    }
  });

  it("accepts self-contained synchronous entryId functions with locals and String conversion", () => {
    const descriptor = analyzeMediaSource(
      `import { collection, image } from "@foxworth/superimg";
       import { load } from "./cards.server";
       export default collection({
         entries: load,
         entryId: (card) => { const value = card.numericId; return String(value); },
         media: image({ render: () => Html({ width: "fill", height: "fill", html: "" }) }),
       });`,
      filename,
    );
    expect(descriptor.kind).toBe("collection");
    if (descriptor.kind !== "collection") return;
    expect(descriptor.entryId?.kind).toBe("function");
    expect(descriptor.entriesProjection.code).toContain("String(value)");
  });

  it("removes inline and external source map directives from projected source and sourcesContent", () => {
    const encodedSecret = Buffer.from(
      JSON.stringify({ version: 3, sources: ["secret.server.ts"], sourcesContent: ["SECRET_TOKEN"] }),
    ).toString("base64");
    const directive = `//# ${["source", "MappingURL"].join("")}=data:application/json;base64,${encodedSecret}`;
    const source = `import { collection, image } from "@foxworth/superimg";
export default collection({ entries: [{ id: "SECRET_ENTRY" }], media: image({ render }) });
${directive}`;
    const descriptor = analyzeMediaSource(source, filename);
    expect(descriptor.kind).toBe("collection");
    expect(descriptor.mediaProjection.code).not.toContain("SECRET_ENTRY");
    expect(descriptor.mediaProjection.code).not.toContain("sourceMappingURL");
    expect(descriptor.mediaProjection.code).not.toContain("SECRET_TOKEN");
    expect(descriptor.mediaProjection.map.sourcesContent.join("\n")).not.toContain("SECRET_TOKEN");
  });

  it("returns an ordinary descriptor without executing or rewriting media", () => {
    const source = `import { video } from "@foxworth/superimg"; export default video({ render });`;
    const descriptor = analyzeMediaSource(source, filename);
    expect(descriptor).toMatchObject({ schemaVersion: 0, kind: "media", filename });
    expect(descriptor.mediaProjection.code).toBe(source);
  });

  it("requires callers to opt into the media projection before browser compilation", () => {
    const descriptor = analyzeMediaSource(
      `import { collection, image } from "@foxworth/superimg";
       export default collection({ entries: [{ id: "one" }], media: image({ render }) });`,
      filename,
    );
    expect(() => assertBrowserSourceCanCompile(descriptor)).toThrowError(
      expect.objectContaining({ code: "COLLECTION_REQUIRES_SERVER_PROJECTION" }),
    );
  });

  it.each([
    {
      name: "option factory",
      code: "UNSUPPORTED_COLLECTION_SYNTAX",
      source: `import { collection } from "@foxworth/superimg"; export default collection(makeOptions());`,
    },
    {
      name: "option spread",
      code: "COLLECTION_OPTION_SPREAD",
      source: `import { collection, image } from "@foxworth/superimg"; export default collection({ ...options, entries: [], media: image({ render }) });`,
    },
    {
      name: "computed option",
      code: "COLLECTION_COMPUTED_PROPERTY",
      source: `import { collection, image } from "@foxworth/superimg"; export default collection({ ["entries"]: [], media: image({ render }) });`,
    },
    {
      name: "local provider",
      code: "COLLECTION_ENTRIES_UNSUPPORTED",
      source: `import { collection, image } from "@foxworth/superimg"; const load = () => []; export default collection({ entries: load, media: image({ render }) });`,
    },
    {
      name: "namespace provider",
      code: "COLLECTION_ENTRIES_UNSUPPORTED",
      source: `import { collection, image } from "@foxworth/superimg"; import * as cards from "./cards.server"; export default collection({ entries: cards.load, media: image({ render }) });`,
    },
    {
      name: "non-server provider",
      code: "COLLECTION_PROVIDER_NOT_SERVER_MODULE",
      source: `import { collection, image } from "@foxworth/superimg"; import { load } from "./cards"; export default collection({ entries: load, media: image({ render }) });`,
    },
    {
      name: "non-JSON static data",
      code: "COLLECTION_ENTRIES_UNSUPPORTED",
      source: `import { collection, image } from "@foxworth/superimg"; export default collection({ entries: [{ id: makeId() }], media: image({ render }) });`,
    },
    {
      name: "capturing inline id function",
      code: "COLLECTION_ID_UNSUPPORTED",
      source: `import { collection, image } from "@foxworth/superimg"; import { load } from "./cards.server"; import { slugify } from "./slug"; export default collection({ entries: load, entryId: (card) => slugify(card.title), media: image({ render }) });`,
    },
    {
      name: "nested collection",
      code: "COLLECTION_NESTED",
      source: `import { collection, image } from "@foxworth/superimg"; export default collection({ entries: [], media: collection({ entries: [], media: image({ render }) }) });`,
    },
    {
      name: "interactive collection",
      code: "COLLECTION_INTERACTIVE_UNSUPPORTED",
      source: `import { collection } from "@foxworth/superimg"; import { defineInteractive } from "@foxworth/superimg/interactive/define"; export default collection({ entries: [], media: defineInteractive({ render }) });`,
    },
    {
      name: "shared provider/media module",
      code: "COLLECTION_PROVIDER_MEDIA_MODULE_SHARED",
      source: `import { collection, image } from "@foxworth/superimg"; import { load, render } from "./cards.server"; export default collection({ entries: load, media: image({ render }) });`,
    },
    {
      name: "transitively shared provider/media module",
      code: "COLLECTION_PROVIDER_MEDIA_MODULE_SHARED",
      source: `import { collection, image } from "@foxworth/superimg"; import { load, secretRender } from "./cards.server"; const render = secretRender; const card = image({ render }); export default collection({ entries: load, media: card });`,
    },
    {
      name: "mutable collection binding",
      code: "UNSUPPORTED_COLLECTION_SYNTAX",
      source: `import { collection, image } from "@foxworth/superimg"; let cards = collection({ entries: [], media: image({ render }) }); export default cards;`,
    },
    {
      name: "collection hidden behind a factory",
      code: "UNSUPPORTED_COLLECTION_SYNTAX",
      source: `import { collection, image } from "@foxworth/superimg"; const make = () => collection({ entries: [], media: image({ render }) }); export default make();`,
    },
  ] as const)("rejects $name", ({ source, code }) => {
    expectCode(source, code);
  });
});
