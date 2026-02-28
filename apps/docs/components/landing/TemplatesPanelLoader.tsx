"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const TemplatesPanel = dynamic(() => import("./TemplatesPanel"), {
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

export function TemplatesPanelSection() {
  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start from a template
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
            Production-ready templates for social content, marketing videos,
            data visualization, and developer screencasts. Browse free examples
            or get the full collection.
          </p>
        </div>

        <TemplatesPanel />

        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/templates">Browse all templates →</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/editor">Open editor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
