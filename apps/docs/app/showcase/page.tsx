import { TopNav } from "@/components/landing/TopNav";
import { Button } from "@/components/ui/button";
import { ExternalLink, Github } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Showcase — SuperImg",
  description: "Projects built with SuperImg.",
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
              Projects built with SuperImg
            </p>
          </div>

          {/* RexRender */}
          <div className="mb-8 rounded-xl border border-border bg-card p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <Image
                  src="/rexrender-logo.svg"
                  alt="RexRender"
                  width={48}
                  height={48}
                  className="shrink-0"
                />
                <div>
                  <h2 className="text-2xl font-semibold">RexRender</h2>
                  <p className="mt-2 text-muted-foreground">
                    Web-based video creation tool. Paste content, customize, export. 30+ templates for tweets, ChatGPT conversations, terminal sessions, and more.
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    <li className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      Video Editor
                    </li>
                    <li className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      No-Code
                    </li>
                    <li className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      SaaS
                    </li>
                  </ul>
                </div>
              </div>
              <Button asChild className="shrink-0">
                <a
                  href="https://rexrender.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  Visit
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Your Project */}
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <h3 className="text-lg font-medium">Your Project Here</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Built something with SuperImg? Let us know on GitHub.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <a
                  href="https://github.com/anaptfox/superimg/issues/new?title=Showcase%20submission&body=Project%20name:%0AProject%20URL:%0ADescription:"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Submit Your Project
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 px-6 py-8">
        <div className="mx-auto max-w-3xl text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to SuperImg
          </Link>
        </div>
      </footer>
    </main>
  );
}
