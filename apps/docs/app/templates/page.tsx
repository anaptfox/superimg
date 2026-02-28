import type { Metadata } from "next";
import { TopNav } from "@/components/landing/TopNav";
import TemplatesClient from "./TemplatesClient";

export const metadata: Metadata = {
  title: "Templates — SuperImg",
  description:
    "Production-ready video templates for SuperImg. 24 free examples to try in the browser, plus a Pro collection of 15+ templates with full source code. $79 one-time.",
};

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />
      <TemplatesClient />

      <footer className="border-t border-border/50 px-6 py-12">
        <div className="mx-auto max-w-4xl text-center text-sm text-muted-foreground">
          <p>
            Built with SuperImg - Programmatic video generation for developers
          </p>
        </div>
      </footer>
    </main>
  );
}
