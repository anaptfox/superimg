"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeroCode } from "./HeroCode";

const HeroPlayer = dynamic(() => import("./HeroPlayer"), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] w-[640px] animate-pulse rounded-xl bg-muted" />
  ),
});

export function Hero() {
  const [view, setView] = useState<"video" | "code">("video");

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "video" | "code")}
        >
          <TabsList>
            <TabsTrigger value="video">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mb-10 overflow-hidden rounded-xl shadow-2xl shadow-purple-500/20">
        {view === "video" ? <HeroPlayer /> : <HeroCode />}
      </div>

      <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
        Create Programmatic Videos{" "}
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          with Code
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        Write JavaScript templates, preview in real-time, and export stunning
        videos. Perfect for marketing, social content, and data visualizations.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Button asChild size="lg" className="h-12 px-8 text-base">
          <Link href="/editor">Open Editor</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-12 px-8 text-base"
        >
          <Link href="/editor?example=hello-world">View Examples</Link>
        </Button>
      </div>

      <div className="mt-16 flex items-center gap-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
          MP4 Export
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
          Live Preview
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500"></span>
          TypeScript
        </div>
      </div>
    </section>
  );
}
