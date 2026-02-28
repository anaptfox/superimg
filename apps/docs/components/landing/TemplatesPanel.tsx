"use client";

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

const CATEGORIES = [
  {
    id: "marketing",
    title: "Marketing",
    description: "Launch cards, countdowns, and promotional videos",
    template: countdownTemplate,
    exampleId: "product-hunt",
    count: 5,
  },
  {
    id: "social",
    title: "Social",
    description: "Testimonials, milestones, and engagement content",
    template: testimonialTemplate,
    exampleId: "testimonials",
    count: 5,
  },
  {
    id: "data",
    title: "Data",
    description: "Charts, graphs, and data visualization animations",
    template: chartTemplate,
    exampleId: "star-history",
    count: 4,
  },
  {
    id: "developer",
    title: "Developer",
    description: "Terminal sessions, code snippets, and git workflows",
    template: terminalTemplate,
    exampleId: "code-typewriter",
    count: 6,
  },
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics with simple animated text and effects",
    template: helloWorldTemplate,
    exampleId: "hello-world",
    count: 4,
  },
];

export default function TemplatesPanel() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORIES.map((category) => (
        <Link
          key={category.id}
          href={`/editor?example=${category.exampleId}`}
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
                  style={{
                    width: "100%",
                    height: "auto",
                    aspectRatio: "16/9",
                  }}
                />
              </div>
            </CardContent>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between text-base">
                {category.title}
                <span className="text-sm font-normal text-muted-foreground">
                  {category.count} templates
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
