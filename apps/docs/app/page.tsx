import { TopNav } from "@/components/landing/TopNav";
import { Hero } from "@/components/landing/Hero";
import { HowItWorksLoader } from "@/components/landing/HowItWorksLoader";
import { TemplatesPanelSection } from "@/components/landing/TemplatesPanelLoader";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />
      <Hero />
      <HowItWorksLoader />
      <TemplatesPanelSection />

      <footer className="border-t border-border/50 px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <p className="mb-3 text-sm font-semibold">Product</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/playground" className="hover:text-foreground transition-colors">Playground</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">Docs</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/docs/introduction" className="hover:text-foreground transition-colors">Introduction</a></li>
                <li><a href="/docs/getting-started" className="hover:text-foreground transition-colors">Getting Started</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">More</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/blog" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="/showcase" className="hover:text-foreground transition-colors">Showcase</a></li>
                <li><a href="/support" className="hover:text-foreground transition-colors">Support</a></li>
                <li><a href="https://github.com/anaptfox/superimg" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a></li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="mb-1 text-sm font-semibold">SuperImg</p>
              <p className="text-sm text-muted-foreground">Open-source framework for programmatic video. MIT licensed.</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
