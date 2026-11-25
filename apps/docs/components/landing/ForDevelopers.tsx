import Link from "next/link";
import { Button } from "@/components/ui/button";

const CODE_EXAMPLE = `import { video, Frame, Stack, Text } from "@foxworth/superimg";
import { Player } from "@foxworth/superimg/player";

const program = video({
  duration: "3s",
  sample: { title: "Hello" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center" },
        Text({ variant: "display" }, ctx.data.title),
      ),
    );
  },
});

// Same media program — live embed
const player = new Player(document.querySelector("#stage"));
await player.load(program);`;

export function ForDevelopers() {
  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            One media program — play or export
          </h2>
          <p className="mt-3 text-muted-foreground">
            Author with <code className="text-sm">video()</code>, embed with{" "}
            <code className="text-sm">@foxworth/superimg/player</code>, check and export with the CLI
            or <code className="text-sm">@foxworth/superimg/runtime</code>.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-[var(--code-bg)]">
          <div className="border-b border-border/50 bg-[var(--code-header)] px-4 py-2 text-sm font-medium text-[var(--code-foreground)]">
            intro.media.ts
          </div>
          <pre className="overflow-x-auto p-4 text-sm">
            <code className="text-[var(--code-foreground)]">{CODE_EXAMPLE}</code>
          </pre>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/docs/getting-started">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/docs/embed-in-apps">Embed in apps</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/playground">Playground</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
