"use client";

import { Sparkles, ArrowRight } from "lucide-react";

export function CreateWithAI() {
  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Create and edit with AI
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Use your favorite AI coding assistant to generate and modify templates
          </p>
        </div>

        {/* Prompt to Code Flow */}
        <div className="mb-10 flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-6">
          <div className="w-full max-w-sm rounded-lg border border-border/50 bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-purple-400" />
              Your prompt
            </div>
            <p className="text-sm italic text-foreground/80">
              "Make a countdown timer that goes from 5 to 1, then shows GO!"
            </p>
          </div>

          <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
          <div className="block text-muted-foreground md:hidden">↓</div>

          <div className="w-full max-w-sm rounded-lg border border-border/50 bg-[var(--code-bg)] p-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              AI generates code
            </div>
            <pre className="text-xs text-[var(--code-foreground)]">
              <code>{`defineTemplate({
  render(ctx) {
    const count = 5 - ctx.second;
    return \`<div>\${count}</div>\`;
  }
})`}</code>
            </pre>
          </div>
        </div>

        {/* Works With Badges */}
        <div className="text-center text-sm text-muted-foreground">
          <span className="mr-3">Works with:</span>
          <span className="inline-flex items-center gap-4">
            <span className="rounded-md bg-muted/50 px-3 py-1 font-medium text-foreground">
              Cursor
            </span>
            <span className="rounded-md bg-muted/50 px-3 py-1 font-medium text-foreground">
              Claude Code
            </span>
            <span className="rounded-md bg-muted/50 px-3 py-1 font-medium text-foreground">
              Windsurf
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
