import { TopNav } from "@/components/landing/TopNav";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/icons/github";
import Link from "next/link";

export const metadata = {
  title: "Showcase — SuperImg",
  description: "Projects and media built with SuperImg.",
};

export default function ShowcasePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Showcase
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Example media programs live in the playground. Ship something with
              SuperImg? Share it on GitHub.
            </p>
          </div>

          <div className="mb-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/playground">Open playground</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Back home</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <h3 className="text-lg font-medium">Your project here</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Built something with SuperImg? Open an issue with the project name,
              URL, and a short description.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <a
                  href="https://github.com/anaptfox/superimg/issues/new?title=Showcase%20submission&body=Project%20name:%0AProject%20URL:%0ADescription:"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <GitHubIcon className="h-4 w-4" />
                  Submit your project
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 px-6 py-8">
        <div className="mx-auto max-w-3xl text-center text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">
            ← Back to SuperImg
          </Link>
        </div>
      </footer>
    </main>
  );
}
