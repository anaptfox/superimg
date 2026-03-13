import { TopNav } from "@/components/landing/TopNav";
import { Button } from "@/components/ui/button";
import { Heart, Zap, Video, Layout, Palette } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Support SuperImg",
  description: "Support SuperImg development through Pro Templates or RexRender.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <Heart className="mx-auto mb-4 h-10 w-10 text-red-500" />
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Support SuperImg
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              SuperImg is free and open source, MIT licensed. Here's how you can support development.
            </p>
          </div>

          {/* RexRender */}
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex items-start gap-4">
              <Image
                src="/rexrender-logo.svg"
                alt="RexRender"
                width={48}
                height={48}
                className="shrink-0"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">RexRender</h2>
                <p className="mt-2 text-muted-foreground">
                  Skip the code. RexRender is our web-based video tool built on SuperImg.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <Zap className="mt-0.5 h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Paste content, get video</p>
                      <p className="text-sm text-muted-foreground">
                        Tweet, ChatGPT conversation, iMessage — paste and export
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Layout className="mt-0.5 h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">30+ templates</p>
                      <p className="text-sm text-muted-foreground">
                        Terminal, changelog, before/after, and more
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Video className="mt-0.5 h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">All formats</p>
                      <p className="text-sm text-muted-foreground">
                        Reels, Shorts, Stories, YouTube — one click
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Palette className="mt-0.5 h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">No timeline, no layers</p>
                      <p className="text-sm text-muted-foreground">
                        Just paste, customize, and export. 1080p in under a minute.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <a
                      href="https://rexrender.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Try RexRender Free
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href="https://rexrender.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Go Pro — $19/mo
                    </a>
                  </Button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Pro includes unlimited renders, AI generation, brand kit, and more.
                </p>
              </div>
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
