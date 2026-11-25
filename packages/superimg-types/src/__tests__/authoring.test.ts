import { describe, expect, it } from "vitest";
import { collection } from "../collection.js";
import {
  define,
  image,
  ogImage,
  svg,
  video,
  type ImageDefinition,
  type VideoDefinition,
} from "../define.js";
import type { AssetDeclaration } from "../types.js";
import { MEDIA_ELEMENT, type MediaElement } from "../media-node.js";

function Html(props: { html: string }): MediaElement {
  return {
    $$typeof: MEDIA_ELEMENT,
    type: "Html",
    props: { width: "fill", height: "fill", ...props },
    children: [],
  };
}

const boxed = (html: string) => Html({ html });

interface Clip {
  id: string;
  title: string;
}

interface Post {
  slug: string;
  title: string;
}

const clips: readonly Clip[] = [{ id: "intro", title: "Introduction" }];
const loadClips = async (): Promise<readonly Clip[]> => clips;

const remoteLogo = {
  url: new URL("https://assets.example.test/logo.svg"),
  type: "image",
} satisfies AssetDeclaration;
const embeddedTone = {
  bytes: new Uint8Array([0, 1, 2, 3]),
  mimeType: "audio/wav",
  type: "audio",
} satisfies AssetDeclaration;

const clipMedia = video<Clip>({
  duration: "12s",
  poster: "2s",
  variants: {
    shortTitle: { title: "Intro" },
  },
  editions: {
    square: {
      size: { width: 1080, height: 1080 },
      render(ctx) {
        return boxed(`<h1>${ctx.width}:${ctx.data.title}</h1>`);
      },
    },
  },
  render(ctx) {
    return boxed(`<h1>${ctx.data.title}</h1>`);
  },
});

const exactExample = collection({
  entries: loadClips,
  media: clipMedia,
});

const inlineExactExample = collection({
  entries: loadClips,
  media: video<Clip>({
    duration: "12s",
    render(ctx) {
      return boxed(`<h1>${ctx.data.title}</h1>`);
    },
  }),
});

const syncExample = collection({
  entries: () => clips,
  media: clipMedia,
});

const staticExample = collection({
  entries: clips,
  media: image<Clip>({
    size: { width: 750, height: 1050 },
    render: (ctx) => boxed(`<h1>${ctx.data.title}</h1>`),
  }),
});

const posts = collection({
  entries: [{ slug: "hello", title: "Hello" }] satisfies Post[],
  entryId: "slug",
  media: image<Post>({ render: (ctx) => boxed(ctx.data.title) }),
});

const bare = collection({
  entries: clips,
  media: define<Clip>({
    sample: clips[0]!,
    config: { width: 1000, height: 1000 },
    render: (ctx) => boxed(ctx.data.title),
  }),
});

const interactive = {
  kind: "interactive" as const,
  guide: {
    id: "lesson",
    steps: [{ id: "one", label: "One", duration: "1s", scene: {} }],
  },
  render: (ctx: { data: Clip }) => boxed(ctx.data.title),
};

if (false) {
  // @ts-expect-error interactive definitions are singular and cannot be collected
  collection({ entries: clips, media: interactive });

  // @ts-expect-error collections cannot nest
  collection({ entries: clips, media: exactExample });

  // @ts-expect-error Clip media cannot render Post entries
  collection({ entries: [{ slug: "post", title: "Post" }], entryId: "slug", media: clipMedia });

  // @ts-expect-error entries without an `id: string` require an identity resolver
  collection({ entries: [{ title: "Missing" }], media: image<{ title: string }>({ render: () => boxed("") }) });

  collection({
    // @ts-expect-error entry snapshots must be deeply JSON-compatible
    entries: [{ id: "bad", createdAt: new Date() }],
    media: image<{ id: string; createdAt: Date }>({ render: () => boxed("") }),
  });

  video<Clip>({
    duration: "1s",
    variants: {
      bad: {
        // @ts-expect-error variants cannot own delivery dimensions
        width: 1080,
      },
    },
    render: () => boxed(""),
  });
}

const custom = image({
  size: { width: 333, height: 777 },
  assets: { logo: remoteLogo, tone: embeddedTone },
  render: () => boxed("custom"),
});

if (false) {
  image({
    // @ts-expect-error relative string asset shorthand was removed
    assets: { logo: "./assets/logo.svg" },
    render: () => boxed("asset shorthand"),
  });
}

const vector = svg({ render: () => boxed("<svg/>") });
const og = ogImage({ render: () => boxed("og") });

const videoContract: VideoDefinition<Clip> = clipMedia;
const imageContract: ImageDefinition<Clip> = staticExample.media;

describe("clean-break media authoring", () => {
  it("lowers recipes to canonical media definitions with defaults", () => {
    expect(videoContract).toMatchObject({
      kind: "media",
      media: "video",
      fallbackFormat: "mp4",
      animated: true,
      config: { width: 1920, height: 1080, fps: 30, duration: "12s" },
      poster: "2s",
    });
    expect(vector).toMatchObject({ kind: "media", media: "svg", config: { width: 1920, height: 1080 } });
    expect(og.config).toMatchObject({ width: 1200, height: 630 });
    expect(custom.config).toMatchObject({ width: 333, height: 777 });
    expect(custom.config?.assets).toEqual({ logo: remoteLogo, tone: embeddedTone });
  });

  it("preserves providers, static entries, and custom identity", () => {
    expect(exactExample.entries).toBe(loadClips);
    expect(inlineExactExample.media.media).toBe("video");
    expect(syncExample.media).toBe(clipMedia);
    expect(imageContract.config).toMatchObject({ width: 750, height: 1050 });
    expect(posts.entryId).toBe("slug");
    expect(bare.media.kind).toBe("media");
  });
});
