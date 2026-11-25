"use client";

import { Sparkles, ArrowRight } from "lucide-react";

export function CreateWithAI() {
  return (
    <section className="border-t border-border/50 px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Create and edit with agents
          </h2>
          <p className="mt-3 text-muted-foreground">
            Install the SuperImg skill, then let Cursor, Claude Code, Codex, or similar own the loop.
          </p>
        </div>

        <div className="mb-10 flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-6">
          <div className="w-full max-w-sm rounded-lg border border-border/50 bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-purple-400" />
              Your prompt
            </div>
            <p className="text-sm italic text-foreground/80">
              &ldquo;Make a 5s product intro that plays in our app and exports to MP4 — title from
              data, soft fade-in.&rdquo;
            </p>
          </div>

          <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
          <div className="block text-muted-foreground md:hidden">↓</div>

          <div className="w-full max-w-sm rounded-lg border border-border/50 bg-[var(--code-bg)] p-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Agent writes + checks
            </div>
            <pre className="overflow-x-auto text-xs text-[var(--code-foreground)]">
              <code>{`define({
  sample: { title: "Ship it" },
  config: { fps: 30, duration: 5, width: 1280, height: 720 },
  render(ctx) { /* pure HTML */ }
})
// superimg check · inspect · export`}</code>
            </pre>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <span className="mr-3">Works with:</span>
          <span className="inline-flex flex-wrap items-center justify-center gap-2">
            {["Cursor", "Claude Code", "Codex", "Windsurf"].map((name) => (
              <span
                key={name}
                className="rounded-md bg-muted/50 px-3 py-1 font-medium text-foreground"
              >
                {name}
              </span>
            ))}
          </span>
        </div>
        <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
          $ npx superimg skill install
        </p>
      </div>
    </section>
  );
}
