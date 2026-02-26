import { TopNav } from "@/components/landing/TopNav";
import { Hero } from "@/components/landing/Hero";
import { LiveExampleLoader } from "@/components/landing/LiveExampleLoader";
import { HowItWorksLoader } from "@/components/landing/HowItWorksLoader";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />
      <Hero />
      <LiveExampleLoader />
      <HowItWorksLoader />

      <footer className="border-t border-border/50 px-6 py-12">
        <div className="mx-auto max-w-4xl text-center text-sm text-muted-foreground">
          <p>Built with SuperImg - Programmatic video generation for developers</p>
        </div>
      </footer>
    </main>
  );
}
