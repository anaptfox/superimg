"use client";

import { useState } from "react";
import Link from "next/link";
import { Player } from "superimg-react/player";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  helloWorldTemplate,
  countdownTemplate,
  testimonialTemplate,
  chartTemplate,
  terminalTemplate,
} from "@/lib/templates/showcase";
import {
  EXAMPLE_CATEGORIES,
  EDITOR_EXAMPLES,
  getExamplesByCategory,
} from "@/lib/video/examples";
import { Check, Code, Terminal, Download } from "lucide-react";

const CATEGORY_TEMPLATES: Record<
  string,
  Parameters<typeof Player>[0]["template"]
> = {
  "getting-started": helloWorldTemplate,
  marketing: countdownTemplate,
  social: testimonialTemplate,
  data: chartTemplate,
  developer: terminalTemplate,
};

const PRO_TEMPLATES = [
  {
    id: "saas-metrics-dashboard",
    title: "SaaS Metrics Dashboard",
    description: "MRR, churn, and growth metrics with animated transitions",
  },
  {
    id: "multi-platform-ad",
    title: "Multi-Platform Ad",
    description:
      "One template, multiple outputs — YouTube, Instagram, TikTok",
  },
  {
    id: "release-notes-video",
    title: "Release Notes Video",
    description: "Animated changelog with code diffs and feature previews",
  },
  {
    id: "customer-onboarding",
    title: "Customer Onboarding",
    description: "Personalized welcome video with data-driven defaults",
  },
  {
    id: "social-proof-reel",
    title: "Social Proof Reel",
    description: "Rotating testimonials with avatar animations",
  },
  {
    id: "pipeline-explainer",
    title: "Pipeline Explainer",
    description:
      "Technical architecture diagram with step-by-step animation",
  },
];

const INCLUDED_FEATURES = [
  {
    label: "Full source code",
    detail:
      "Every template is a .ts file. Read it, modify it, learn from it.",
  },
  {
    label: "Data-driven defaults",
    detail:
      "Each template has a defaults object. Pass different data, get a different video.",
  },
  {
    label: "Multi-format ready",
    detail:
      "Templates render to YouTube (16:9), Instagram (1:1), TikTok (9:16), and more.",
  },
  {
    label: "Commercial license",
    detail:
      "Use the rendered videos anywhere. Client work, social media, ads. No attribution required.",
  },
  {
    label: "New templates monthly",
    detail:
      "The repo grows. Your purchase includes 12 months of additions.",
  },
];

const FAQ_ITEMS = [
  {
    q: "What exactly do I get?",
    a: "Access to a private GitHub repo with 15+ SuperImg templates. Each is a standalone .ts file with a render function, defaults for customization, and config for multi-format output.",
  },
  {
    q: "Can I use the videos commercially?",
    a: "Yes. Full commercial rights for any video you render from these templates. Client work, social media, ads — no attribution required.",
  },
  {
    q: "What happens after 12 months?",
    a: "You keep every template you have. If you want access to new additions after the first year, you can renew for $49/year. If you don't renew, nothing changes — your existing templates work forever.",
  },
  {
    q: "Can I modify the templates?",
    a: "They're TypeScript files. You own them. Change anything — the layout, the animations, the data schema. That's the point.",
  },
  {
    q: "Do I need SuperImg installed?",
    a: "Yes. The templates use defineTemplate from the superimg package (free, open source). Install with npm install superimg.",
  },
];

export default function TemplatesClient() {
  const [activeCategory, setActiveCategory] = useState<string>(
    EXAMPLE_CATEGORIES[0].id
  );
  const filteredExamples = getExamplesByCategory(activeCategory);

  return (
    <>
      {/* Hero */}
      <section className="px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Templates
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Browse {EDITOR_EXAMPLES.length} free templates in the editor, or get
          the full Pro collection — production-grade templates you can customize
          and render.
        </p>
      </section>

      {/* Free Templates */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold tracking-tight">Free templates</h2>
          <p className="mt-2 text-muted-foreground">
            {EDITOR_EXAMPLES.length} templates across{" "}
            {EXAMPLE_CATEGORIES.length} categories. Open any in the browser
            editor.
          </p>

          {/* Category tabs */}
          <div className="mt-8 flex flex-wrap gap-2">
            {EXAMPLE_CATEGORIES.map((cat) => {
              const count = getExamplesByCategory(cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeCategory === cat.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.title}
                  <span className="ml-2 opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Template grid */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredExamples.map((example) => {
              const template = CATEGORY_TEMPLATES[example.category];
              return (
                <Link
                  key={example.id}
                  href={`/editor?example=${example.id}`}
                  className="group"
                >
                  <Card className="h-full transition-all duration-200 hover:ring-2 hover:ring-primary/50">
                    {template && (
                      <CardContent className="p-0">
                        <div className="overflow-hidden rounded-t-lg">
                          <Player
                            template={template}
                            format="horizontal"
                            playbackMode="loop"
                            loadMode="lazy"
                            hoverBehavior="play"
                            hoverDelayMs={200}
                            maxCacheFrames={30}
                            className="w-full"
                            style={{
                              width: "100%",
                              height: "auto",
                              aspectRatio: "16/9",
                            }}
                          />
                        </div>
                      </CardContent>
                    )}
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center justify-between text-base">
                        {example.title}
                        <span className="text-muted-foreground transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </CardTitle>
                      <CardDescription>Open in editor</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Transition */}
      <div className="px-6">
        <div className="mx-auto max-w-6xl border-t border-border/50" />
      </div>

      {/* Pro Templates */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold tracking-tight">Pro Templates</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Production-grade video templates. Responsive layouts, data-driven
            defaults, multi-format output. Clone the repo, swap the data,
            render.
          </p>

          {/* Pro template preview grid */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRO_TEMPLATES.map((tmpl) => (
              <Card
                key={tmpl.id}
                className="relative h-full border-border/50 bg-card/50"
              >
                <CardContent className="p-0">
                  <div className="flex h-[140px] items-center justify-center rounded-t-lg bg-linear-to-br from-blue-500/10 to-purple-500/10">
                    <div className="rounded-md bg-foreground/5 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      Pro
                    </div>
                  </div>
                </CardContent>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">{tmpl.title}</CardTitle>
                  <CardDescription>{tmpl.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* What's included */}
          <div className="mt-16">
            <h3 className="text-lg font-semibold">What&apos;s included</h3>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUDED_FEATURES.map((feature) => (
                <div key={feature.label} className="flex gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  <div>
                    <div className="font-medium">{feature.label}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {feature.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-md">
          <Card className="border-2 border-border text-center">
            <CardHeader className="pb-2 pt-8">
              <CardTitle className="text-2xl">Pro Templates</CardTitle>
            </CardHeader>
            <CardContent className="pb-8">
              <div className="mt-4">
                <span className="text-5xl font-bold">$79</span>
                <span className="ml-2 text-muted-foreground">one-time</span>
              </div>

              <ul className="mt-8 space-y-3 text-left text-sm">
                {[
                  "15+ production-grade templates",
                  "Full source code",
                  "12 months of new additions",
                  "Commercial license",
                  "Keep everything, forever",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 shrink-0 text-green-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Button size="lg" className="mt-8 w-full" asChild>
                <a
                  href="https://polar.sh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get the templates
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How to use */}
      <section className="border-t border-border/50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Clone, customize, render
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Terminal className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">Clone the repo</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ll get access to a private GitHub repo. Clone it like
                any other project.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Code className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">Pick a template and edit</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Each template is a standalone .ts file. Change the data, adjust
                the animations, make it yours.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">Render to video</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  npx superimg render template.ts -o video.mp4
                </code>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Questions
          </h2>

          <div className="mt-12 space-y-8">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q}>
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/50 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Start with code, ship a video
          </h2>
          <p className="mt-4 text-muted-foreground">
            {EDITOR_EXAMPLES.length} free templates in the browser editor. Or
            get the full Pro collection for $79.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <a
                href="https://polar.sh"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get the Pro templates
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/editor">Try free templates →</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
