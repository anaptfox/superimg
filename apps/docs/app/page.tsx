import { Hero } from "@/components/landing/Hero";
import { HoverPreviews } from "@/components/landing/HoverPreviews";
import { Features } from "@/components/landing/Features";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <HoverPreviews />
      <Features />

      <footer className="border-t border-border/50 px-6 py-12">
        <div className="mx-auto max-w-4xl text-center text-sm text-muted-foreground">
          <p>Built with SuperImg - Programmatic video generation for developers</p>
        </div>
      </footer>
    </main>
  );
}
