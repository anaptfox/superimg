"use client";

import dynamic from "next/dynamic";

const PreviewCards = dynamic(() => import("./PreviewCards"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-[280px] animate-pulse rounded-lg bg-muted"
        />
      ))}
    </div>
  ),
});

export function HoverPreviews() {
  return (
    <section className="border-t border-border/50 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Explore by Category
          </h2>
          <p className="mt-4 text-muted-foreground">
            Hover to preview, click to open in the editor
          </p>
        </div>

        <div className="mt-12">
          <PreviewCards />
        </div>
      </div>
    </section>
  );
}
