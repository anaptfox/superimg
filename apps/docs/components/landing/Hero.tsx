"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { Star, ArrowRight, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const INSTALL = "npm install @foxworth/superimg";
const SKILL = "npx superimg skill install";

function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      posthog.capture("install_command_copied", { command, label: label ?? "install" });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="group flex w-full max-w-xl items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-left font-mono text-sm transition-colors hover:border-border hover:bg-muted/70"
      aria-label={`Copy ${command}`}
    >
      <span className="shrink-0 text-muted-foreground select-none">$</span>
      <span className="min-w-0 flex-1 truncate text-foreground">{command}</span>
      <span className="shrink-0 text-muted-foreground group-hover:text-foreground">
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </span>
    </button>
  );
}

export function Hero() {
  return (
    <section className="relative flex flex-col items-center px-6 pb-12 pt-16 text-center sm:pt-20">
      <a
        href="https://github.com/anaptfox/superimg"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-8 inline-flex items-center gap-3 rounded-full border border-border/50 bg-muted/40 px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        onClick={() => posthog.capture("oss_badge_clicked")}
      >
        <span className="inline-flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
          Star on GitHub
        </span>
        <span className="border-l border-border/50 pl-3">Open source</span>
        <span className="border-l border-border/50 pl-3">MIT</span>
      </a>

      <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
        Write a media program once.{" "}
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Play live. Export anywhere.
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        Author in TypeScript, check it, then export for destinations — or embed the same
        program in your app with the Player.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg" className="h-10 px-5 text-sm">
          <Link
            href="/docs/getting-started"
            onClick={() => posthog.capture("hero_cta", { target: "getting_started" })}
          >
            Get started
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-10 px-5 text-sm">
          <Link
            href="/docs/embed-in-apps"
            onClick={() => posthog.capture("hero_cta", { target: "embed_in_apps" })}
          >
            Embed in apps
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-10 px-5 text-sm">
          <a
            href="https://github.com/anaptfox/superimg"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog.capture("hero_cta", { target: "github" })}
          >
            GitHub
          </a>
        </Button>
      </div>

      <div className="mt-10 flex w-full flex-col items-center gap-3">
        <CopyCommand command={INSTALL} label="install" />
        <CopyCommand command={SKILL} label="skill" />
        <p className="text-xs text-muted-foreground">
          Offline export needs Chromium once:{" "}
          <code className="rounded bg-muted px-1 py-0.5">npx superimg setup</code>
          {" · "}
          <Link href="/playground" className="underline-offset-4 hover:underline">
            Playground
          </Link>
        </p>
      </div>
    </section>
  );
}
