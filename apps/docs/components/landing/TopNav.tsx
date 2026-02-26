"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TopNav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold">
            SuperImg
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            <Link
              href="/editor"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Editor
            </Link>
            <Link
              href="/docs"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/blog"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Blog
            </Link>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
