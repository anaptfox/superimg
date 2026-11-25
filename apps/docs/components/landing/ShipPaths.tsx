"use client";

import Link from "next/link";
import { Player } from "@foxworth/superimg/react/player";
import { shipPathsTemplate } from "@/content/templates/ship-paths";

type PlayerTemplate = Parameters<typeof Player>[0]["media"];

/**
 * You or an agent write the template → live plays it → export ships files.
 */
export function ShipPaths() {
  const template = shipPathsTemplate as PlayerTemplate;

  return (
    <section className="border-t border-border/50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 text-center sm:mb-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            You or an agent write the template.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Same <code className="rounded bg-muted px-1 py-0.5 text-xs">*.media.ts</code>
            {" "}
            — hand-authored or agent-assisted. Then it{" "}
            <span className="text-foreground/85">plays live</span> in your app
            {" "}
            and <span className="text-foreground/85">exports</span> to YouTube &amp; social
            (16:9 and 9:16).
          </p>
        </div>

        {/* Dual stage: landscape + reel (same template, different format) */}
        <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-8">
          {/* YouTube / landscape */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                YouTube · 16:9
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/70">horizontal</span>
            </div>
            <div className="relative w-full overflow-hidden rounded-xl bg-[#0d0d0d] ring-1 ring-white/10 shadow-xl shadow-black/30 sm:rounded-2xl aspect-video">
              <Player
                media={template}
                size={{ width: 1920, height: 1080 }}
                playbackMode="loop"
                loadMode="eager"
                autoPlay
                controls={false}
                className="absolute inset-0 h-full w-full"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>

          {/* Reel / vertical */}
          <div className="mx-auto w-full max-w-[280px] sm:max-w-[300px] lg:mx-0 lg:w-[240px] lg:max-w-none lg:shrink-0 xl:w-[280px]">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reel · 9:16
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/70">vertical</span>
            </div>
            <div className="relative w-full overflow-hidden rounded-xl bg-[#0d0d0d] ring-1 ring-white/10 shadow-xl shadow-black/30 sm:rounded-2xl aspect-[9/16]">
              <Player
                media={template}
                size={{ width: 1080, height: 1920 }}
                playbackMode="loop"
                loadMode="eager"
                autoPlay
                controls={false}
                className="absolute inset-0 h-full w-full"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm sm:mt-6 sm:gap-x-8">
          <Link
            href="/docs/getting-started"
            className="font-medium text-foreground transition-colors hover:text-foreground"
          >
            Author · get started
          </Link>
          <Link
            href="/docs/embed-in-apps"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Embed · play in app
          </Link>
          <Link
            href="/docs/cli"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Export · check then ship
          </Link>
        </div>
      </div>
    </section>
  );
}
