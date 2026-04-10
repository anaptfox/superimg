"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, Github } from "lucide-react";

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
              href="/playground"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Playground
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
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="GitHub">
            <a href="https://github.com/anaptfox/superimg" target="_blank" rel="noopener noreferrer" onClick={() => posthog.capture("github_link_clicked", { location: "topnav" })}>
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:hidden">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-1">
                <SheetClose asChild>
                  <a
                    href="https://github.com/anaptfox/superimg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => posthog.capture("github_link_clicked", { location: "mobile_menu" })}
                  >
                    GitHub
                  </a>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/playground"
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Playground
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/docs"
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Docs
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/blog"
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Blog
                  </Link>
                </SheetClose>

              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
