"use client";

import posthog from "posthog-js";
import { Star } from "lucide-react";
import { LiveExampleLoader } from "@/components/landing/LiveExampleLoader";

export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center py-16 text-center">
      {/* OSS Badge */}
      <a
        href="https://github.com/anaptfox/superimg"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 inline-flex items-center gap-4 rounded-full border border-border/50 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        onClick={() => posthog.capture("oss_badge_clicked")}
      >
        <span className="inline-flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
          Star on GitHub
        </span>
        <span className="border-l border-border/50 pl-4">Open Source</span>
        <span className="border-l border-border/50 pl-4">MIT License</span>
      </a>

      <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
        Programmatic video,{" "}
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          open source
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        Write a TypeScript function that returns HTML. SuperImg renders every frame to MP4.
      </p>

      <LiveExampleLoader />
    </section>
  );
}
