"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TemplateCard } from "./TemplateCard";
import {
  EDITOR_EXAMPLES,
  EXAMPLE_CATEGORIES,
  getExamplesByCategory,
} from "@/lib/video/examples";

const ALL_CATEGORY = { id: "all", title: "All" } as const;

export function TemplateGrid() {
  const [activeCategory, setActiveCategory] = useState("all");

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    posthog.capture("playground_category_filtered", { category });
  };

  const filteredExamples =
    activeCategory === "all"
      ? EDITOR_EXAMPLES
      : getExamplesByCategory(activeCategory);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-foreground">Examples</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hover to preview. Click to edit.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs
            value={activeCategory}
            onValueChange={handleCategoryChange}
            className="w-full"
          >
            <TabsList variant="line" className="h-12 gap-0">
              <TabsTrigger
                value={ALL_CATEGORY.id}
                className="px-4 text-sm"
              >
                {ALL_CATEGORY.title}
              </TabsTrigger>
              {EXAMPLE_CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="px-4 text-sm"
                >
                  {cat.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredExamples.map((example) => (
            <TemplateCard key={example.id} example={example} />
          ))}
        </div>

        {filteredExamples.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No templates found in this category.
          </div>
        )}
      </div>
    </div>
  );
}
