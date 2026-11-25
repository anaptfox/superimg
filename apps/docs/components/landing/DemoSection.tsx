"use client";

import { LiveExampleLoader } from "@/components/landing/LiveExampleLoader";

/** Mid-page interactive proof — after pillars, before deep sections (Remotion-style). */
export function DemoSection() {
  return (
    <section className="border-t border-border/50 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Same code. Live update.
          </h2>
          <p className="mt-2 text-muted-foreground">
            Tweak data on a live Player — same media program you keep in git and play in
            product. Open any tile above to remix a full example.
          </p>
        </div>
        <LiveExampleLoader />
      </div>
    </section>
  );
}
