import { TopNav } from "@/components/landing/TopNav";
import { Hero } from "@/components/landing/Hero";
import { ShipPaths } from "@/components/landing/ShipPaths";
import { ExampleGallery } from "@/components/landing/ExampleGallery";
import { DemoSection } from "@/components/landing/DemoSection";
import { ValueProps } from "@/components/landing/ValueProps";
import { ForDevelopers } from "@/components/landing/ForDevelopers";
import { CreateWithAI } from "@/components/landing/CreateWithAI";
import { FinalCta } from "@/components/landing/FinalCta";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />
      {/* Claim → paths → examples → try → depth → CTA */}
      <Hero />
      <ShipPaths />
      <ExampleGallery />
      <DemoSection />
      <ValueProps />
      <ForDevelopers />
      <CreateWithAI />
      <FinalCta />

      <footer className="border-t border-border/50 px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <p className="mb-3 text-sm font-semibold">Product</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="/playground" className="transition-colors hover:text-foreground">
                    Playground
                  </a>
                </li>
                <li>
                  <a href="/showcase" className="transition-colors hover:text-foreground">
                    Showcase
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">Docs</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="/docs/introduction"
                    className="transition-colors hover:text-foreground"
                  >
                    Introduction
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/getting-started"
                    className="transition-colors hover:text-foreground"
                  >
                    Getting started
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/embed-in-apps"
                    className="transition-colors hover:text-foreground"
                  >
                    Embed in apps
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/comparison"
                    className="transition-colors hover:text-foreground"
                  >
                    Comparison
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">More</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="/blog" className="transition-colors hover:text-foreground">
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/anaptfox/superimg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-foreground"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="mb-1 text-sm font-semibold">SuperImg</p>
              <p className="text-sm text-muted-foreground">
                Write a media program once — play it live, export it anywhere. MIT licensed.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
