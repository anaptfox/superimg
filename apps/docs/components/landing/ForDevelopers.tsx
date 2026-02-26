import Link from "next/link";
import { Button } from "@/components/ui/button";

const CODE_EXAMPLE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  render(ctx) {
    const { sceneFrame, width, height } = ctx;
    return \`
      <div style="width: \${width}px; height: \${height}px;">
        <h1>Frame \${sceneFrame}</h1>
      </div>
    \`;
  },
});`;

export function ForDevelopers() {
  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Or write code directly
          </h2>
          <p className="mt-3 text-muted-foreground">
            For developers who prefer full control, write templates in JavaScript or TypeScript
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-[var(--code-bg)]">
          <div className="border-b border-border/50 bg-[var(--code-header)] px-4 py-2 text-sm font-medium text-[var(--code-foreground)]">
            videos/intro.ts
          </div>
          <pre className="overflow-x-auto p-4 text-sm">
            <code className="text-[var(--code-foreground)]">{CODE_EXAMPLE}</code>
          </pre>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild variant="outline" size="lg">
            <Link href="/docs">Read the Docs</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/editor">Open Editor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
