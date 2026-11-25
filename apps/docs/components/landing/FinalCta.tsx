import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to try it?
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Install the package, write a <code className="text-sm">*.media.ts</code> media
          program, play it live or export a file. MIT licensed — no per-render fees.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-10 px-5 text-sm">
            <Link href="/docs/getting-started">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-10 px-5 text-sm">
            <Link href="/docs/embed-in-apps">Embed in apps</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-10 px-5 text-sm">
            <Link href="/playground">Playground</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
