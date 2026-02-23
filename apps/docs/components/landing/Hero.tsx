"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

const INSTALL_COMMAND = "npx skills add https://github.com/anaptfox/superimg";

export function Hero() {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    await navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
        Create videos{" "}
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          with AI
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        Install the SuperImg skill. Ask your AI to make a video. Done.
      </p>

      {/* Install Command */}
      <div className="mt-10 w-full max-w-xl">
        <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-[#1a1a1a] shadow-lg">
          <code className="flex-1 px-4 py-3 text-left font-mono text-sm text-muted-foreground sm:text-base">
            {INSTALL_COMMAND}
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

      {/* Works With */}
      <div className="mt-8 text-sm text-muted-foreground">
        <span className="mr-3">Works with:</span>
        <span className="inline-flex items-center gap-4">
          <span className="font-medium text-foreground">Cursor</span>
          <span className="text-border">·</span>
          <span className="font-medium text-foreground">Claude Code</span>
          <span className="text-border">·</span>
          <span className="font-medium text-foreground">Windsurf</span>
        </span>
      </div>
    </section>
  );
}
