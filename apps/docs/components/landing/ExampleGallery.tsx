"use client";

import Link from "next/link";
import { useRef } from "react";
import posthog from "posthog-js";

/**
 * Homepage examples: mixed real media + explicit multi-format strip
 * so visitors see SuperImg responsiveness (16:9 / 1:1 / 9:16 / still).
 */

export type FrameFormat = "16:9" | "1:1" | "9:16" | "still";

export type HomeExampleTile = {
  id: string;
  exampleId: string;
  title: string;
  useCase: string;
  prompt?: string;
  format: FrameFormat;
  src: string;
  kind: "video" | "image";
};

const FORMAT_META: Record<
  FrameFormat,
  { label: string; aspect: string; hint: string }
> = {
  "16:9": { label: "16:9", aspect: "aspect-video", hint: "YouTube · landscape" },
  "1:1": { label: "1:1", aspect: "aspect-square", hint: "Feed · square" },
  "9:16": { label: "9:16", aspect: "aspect-[9/16]", hint: "Reel · Stories" },
  still: { label: "PNG", aspect: "aspect-[1.91/1]", hint: "OG · still" },
};

/** Same template rendered at three presets — the responsiveness proof. */
const RESPONSIVE_STRIP: HomeExampleTile[] = [
  {
    id: "launch-16x9",
    exampleId: "feature-launch",
    title: "Feature launch",
    useCase: "Landscape export",
    format: "16:9",
    src: "/home-examples/launch-16x9.mp4",
    kind: "video",
  },
  {
    id: "launch-1x1",
    exampleId: "feature-launch",
    title: "Feature launch",
    useCase: "Square feed export",
    format: "1:1",
    src: "/home-examples/launch-1x1.mp4",
    kind: "video",
  },
  {
    id: "launch-9x16",
    exampleId: "feature-launch",
    title: "Feature launch",
    useCase: "Story / reel export",
    format: "9:16",
    src: "/home-examples/launch-9x16.mp4",
    kind: "video",
  },
];

/** Mixed formats elsewhere in the catalog — not only landscape. */
export const HOME_EXAMPLE_TILES: HomeExampleTile[] = [
  {
    id: "social-tweet",
    exampleId: "tweet",
    title: "Social post",
    useCase: "X / Twitter",
    prompt: "Turn this tweet into a 1080p social clip.",
    format: "16:9",
    src: "/home-examples/social-tweet.mp4",
    kind: "video",
  },
  {
    id: "tweet-story",
    exampleId: "tweet",
    title: "Social story",
    useCase: "Same tweet · vertical",
    prompt: "Export the same tweet template as a story.",
    format: "9:16",
    src: "/home-examples/tweet-9x16.mp4",
    kind: "video",
  },
  {
    id: "data-story",
    exampleId: "stats-card",
    title: "Data story",
    useCase: "Stats · dashboards",
    prompt: "Count up these metrics with easeOutCubic.",
    format: "16:9",
    src: "/home-examples/data-story.mp4",
    kind: "video",
  },
  {
    id: "karaoke-square",
    exampleId: "karaoke",
    title: "Karaoke",
    useCase: "Captions · square",
    prompt: "Word-by-word captions in a 1:1 frame.",
    format: "1:1",
    src: "/home-examples/karaoke-1x1.mp4",
    kind: "video",
  },
  {
    id: "developer-terminal",
    exampleId: "terminal",
    title: "Developer demo",
    useCase: "Terminal · code",
    prompt: "Type this install command in a dark terminal.",
    format: "16:9",
    src: "/home-examples/developer-terminal.mp4",
    kind: "video",
  },
  {
    id: "vertical-reel",
    exampleId: "shorts",
    title: "Shorts",
    useCase: "Vertical social",
    prompt: "Make a vertical reel version of this launch.",
    format: "9:16",
    src: "/home-examples/vertical-reel.mp4",
    kind: "video",
  },
  {
    id: "product-ui",
    exampleId: "chatgpt",
    title: "Product UI",
    useCase: "Chat · interface",
    prompt: "Animate a chat thread reply by reply.",
    format: "16:9",
    src: "/home-examples/product-ui.mp4",
    kind: "video",
  },
  {
    id: "og-still",
    exampleId: "og-card",
    title: "OG still",
    useCase: "Image · no fps",
    prompt: "Same system as video — still OG card.",
    format: "still",
    src: "/home-examples/og-still.png",
    kind: "image",
  },
  {
    id: "motion-vector",
    exampleId: "svg-draw",
    title: "Motion / vector",
    useCase: "SVG · line art",
    prompt: "Draw this path with stroke reveal.",
    format: "16:9",
    src: "/home-examples/motion-vector.mp4",
    kind: "video",
  },
];

function FormatBadge({ format }: { format: FrameFormat }) {
  const meta = FORMAT_META[format];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
      <span className="text-white/50">{meta.label}</span>
      <span className="hidden text-white/35 sm:inline">·</span>
      <span className="hidden text-white/60 sm:inline">{meta.hint.split("·")[0]?.trim()}</span>
    </span>
  );
}

function MediaTile({
  tile,
  className = "",
  frameClassName,
}: {
  tile: HomeExampleTile;
  className?: string;
  /** Override frame sizing (for the responsive strip). */
  frameClassName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const meta = FORMAT_META[tile.format];
  const aspectClass = frameClassName ?? meta.aspect;

  const onEnter = () => {
    const v = videoRef.current;
    if (!v) return;
    void v.play().catch(() => {});
  };

  const onLeave = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <Link
      href={`/playground?example=${tile.exampleId}`}
      className={`group relative block overflow-hidden rounded-none bg-zinc-950 shadow-none ring-0 transition duration-200 ${className}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={() =>
        posthog.capture("home_example_clicked", {
          example_id: tile.exampleId,
          title: tile.title,
          format: tile.format,
        })
      }
    >
      <div className={`relative w-full overflow-hidden bg-[#0d0d0d] ${aspectClass}`}>
        {tile.kind === "video" ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={tile.src}
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.src}
            alt={tile.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        <div className="pointer-events-none absolute left-2 top-2 z-10">
          <FormatBadge format={tile.format} />
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 pt-12"
          style={{
            background: "linear-gradient(transparent, rgba(0,0,0,0.88))",
          }}
        >
          <p className="text-sm font-semibold text-white">{tile.title}</p>
          <p className="text-xs text-zinc-300">{tile.useCase}</p>
          {tile.prompt ? (
            <p className="mt-1 line-clamp-2 text-[11px] italic text-zinc-400 opacity-0 transition group-hover:opacity-100">
              “{tile.prompt}”
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ExampleGallery() {
  return (
    <section className="border-t border-border/50 px-4 py-16 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What you can build
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            One media program family, many frames — YouTube, square feed, Reels, and stills.
            Hover to play · click to remix in the playground.
          </p>
        </div>

        {/* ——— Responsive proof: same template, three presets ——— */}
        <div className="mb-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Responsiveness
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                Desktop app · every format
              </h3>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Relay product film: macOS window, swipe between board / handoff / features —
                then export the same template as 16:9, 1:1, and 9:16.
              </p>
            </div>
            <Link
              href="/playground?example=feature-launch"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open feature-launch →
            </Link>
          </div>

          {/*
            Fluid strip: wide landscape flexes, square + reel keep aspect.
            On mobile stacks; on desktop sits in a responsive row.
          */}
          <div
            className="
              grid gap-3
              grid-cols-1
              sm:grid-cols-2
              lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)_minmax(0,0.55fr)]
              lg:items-end
            "
          >
            {RESPONSIVE_STRIP.map((tile) => (
              <MediaTile
                key={tile.id}
                tile={tile}
                className={
                  tile.format === "16:9"
                    ? "sm:col-span-2 lg:col-span-1"
                    : tile.format === "9:16"
                      ? "max-w-[220px] justify-self-center sm:max-w-none sm:justify-self-stretch"
                      : ""
                }
              />
            ))}
          </div>
        </div>

        {/* ——— Mixed catalog: fluid masonry, format badges ——— */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold tracking-tight">More formats & use cases</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            16:9, 1:1, 9:16, and stills mixed in one stream — one program, many destinations.
          </p>
        </div>

        <div
          className="
            columns-1 gap-4
            sm:columns-2
            lg:columns-3
            xl:columns-4
            [column-fill:_balance]
          "
        >
          {HOME_EXAMPLE_TILES.map((tile) => (
            <div key={tile.id} className="mb-4 break-inside-avoid">
              <MediaTile tile={tile} />
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/playground"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => posthog.capture("home_examples_browse_all")}
          >
            Browse all templates in playground →
          </Link>
        </div>
      </div>
    </section>
  );
}
