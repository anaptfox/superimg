"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

const PACKAGE_MANAGERS = [
  { id: "npx", label: "npx", command: "npx superimg init" },
  { id: "pnpm", label: "pnpm", command: "pnpm dlx superimg init" },
  { id: "bun", label: "bun", command: "bunx superimg init" },
  { id: "deno", label: "deno", command: "deno run npm:superimg init" },
] as const;

type PackageManager = (typeof PACKAGE_MANAGERS)[number]["id"];

export function Hero() {
  const [copied, setCopied] = useState(false);
  const [pm, setPm] = useState<PackageManager>("npx");

  useEffect(() => {
    const saved = localStorage.getItem("preferred-pm") as PackageManager | null;
    if (saved && PACKAGE_MANAGERS.some((p) => p.id === saved)) {
      setPm(saved);
    }
  }, []);

  const selectPm = (id: PackageManager) => {
    setPm(id);
    localStorage.setItem("preferred-pm", id);
  };

  const currentCommand =
    PACKAGE_MANAGERS.find((p) => p.id === pm)?.command ?? PACKAGE_MANAGERS[0].command;

  const copyCommand = async () => {
    await navigator.clipboard.writeText(currentCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative flex flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
        Create videos{" "}
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          with code
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        Programmatic video generation. HTML/CSS templates, rendered to MP4.
      </p>

      {/* Install Command */}
      <div className="mt-10 w-full max-w-xl">
        {/* Package Manager Tabs */}
        <div className="mb-2 flex justify-center gap-1">
          {PACKAGE_MANAGERS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPm(p.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pm === p.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* Command Box */}
        <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-[var(--code-bg)] shadow-lg">
          <code className="flex-1 px-4 py-3 text-left font-mono text-sm text-[var(--code-foreground)] sm:text-base">
            {currentCommand}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCommand}
            className="h-auto rounded-none border-l border-border px-4 hover:bg-muted"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
