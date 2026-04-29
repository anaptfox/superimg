"use client";

import Link from "next/link";
import { Player } from "superimg/react/player";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  helloWorldTemplate,
  countdownTemplate,
  testimonialTemplate,
  chartTemplate,
  vectorTemplate,
  terminalTemplate,
} from "@/lib/templates/showcase";
import { type EditorExample } from "@/lib/video/examples";

interface CategoryPreview {
  id: EditorExample["category"];
  title: string;
  description: string;
  template: Parameters<typeof Player>[0]["template"];
  exampleId: string;
}

const CATEGORY_PREVIEWS: CategoryPreview[] = [
  {
    id: "basics",
    title: "Basics",
    description: "Starter templates and compositional building blocks",
    template: helloWorldTemplate,
    exampleId: "hello-world",
  },
  {
    id: "marketing",
    title: "Marketing",
    description: "Launch cards, promos, testimonials, and brand assets",
    template: countdownTemplate,
    exampleId: "countdown",
  },
  {
    id: "events",
    title: "Events",
    description: "Meetups, speakers, agendas, and event recaps",
    template: countdownTemplate,
    exampleId: "meetup-announcement",
  },
  {
    id: "social",
    title: "Social",
    description: "Posts, threads, and shareable social formats",
    template: testimonialTemplate,
    exampleId: "tweet",
  },
  {
    id: "interfaces",
    title: "Interfaces",
    description: "Chat and app-style interface simulations",
    template: testimonialTemplate,
    exampleId: "chatgpt",
  },
  {
    id: "data",
    title: "Data",
    description: "Dashboards, timelines, rankings, and visual summaries",
    template: chartTemplate,
    exampleId: "stats-card",
  },
  {
    id: "vector",
    title: "Vector",
    description: "SVG drawing, morphs, filters, and path-based motion",
    template: vectorTemplate,
    exampleId: "svg-draw",
  },
  {
    id: "developer",
    title: "Developer",
    description: "Code, terminal, and technical motion demos",
    template: terminalTemplate,
    exampleId: "terminal",
  },
];

export default function PreviewCards() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORY_PREVIEWS.map((category) => (
        <Link
          key={category.id}
          href={`/playground?example=${category.exampleId}`}
          className="group"
        >
          <Card className="h-full transition-all duration-200 hover:ring-2 hover:ring-primary/50">
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-t-lg">
                <Player
                  template={category.template}
                  format="horizontal"
                  playbackMode="loop"
                  loadMode="lazy"
                  hoverBehavior="play"
                  hoverDelayMs={200}
                  maxCacheFrames={30}
                  className="w-full"
                  style={{ width: "100%", height: "auto", aspectRatio: "16/9" }}
                />
              </div>
            </CardContent>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between text-base">
                {category.title}
                <span className="text-muted-foreground transition-transform group-hover:translate-x-1">
                  →
                </span>
              </CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
