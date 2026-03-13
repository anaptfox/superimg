"use client";

import { useState, useMemo, useCallback } from "react";
import posthog from "posthog-js";
import { Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "./TemplateCard";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import {
  EDITOR_EXAMPLES,
  EXAMPLE_CATEGORIES,
  getExamplesByCategory,
  type EditorExample,
} from "@/lib/video/examples";

const ALL_CATEGORY = { id: "all", title: "All" } as const;

export function TemplateGrid() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<EditorExample | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    posthog.capture("playground_category_filtered", { category });
  };

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query) {
      posthog.capture("playground_search", { query });
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleSelectTemplate = useCallback((template: EditorExample) => {
    setSelectedTemplate(template);
    setModalOpen(true);
  }, []);

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSelectedTemplate(null);
    }
  }, []);

  const filteredExamples = useMemo(() => {
    // First filter by category
    let examples =
      activeCategory === "all"
        ? EDITOR_EXAMPLES
        : getExamplesByCategory(activeCategory);

    // Then filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      examples = examples.filter((example) => {
        const titleMatch = example.title.toLowerCase().includes(query);
        const categoryMatch = example.category.toLowerCase().includes(query);
        // Also match formatted category
        const formattedCategory = example.category
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
          .toLowerCase();
        return titleMatch || categoryMatch || formattedCategory.includes(query);
      });
    }

    return examples;
  }, [activeCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Search */}
      <div className="border-b border-border bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Templates</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Hover to preview. Click to open.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={handleSearch}
                className="h-9 pl-9 pr-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  onClick={clearSearch}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Clear search</span>
                </Button>
              )}
            </div>
          </div>
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
            <TemplateCard
              key={example.id}
              example={example}
              onSelect={handleSelectTemplate}
            />
          ))}
        </div>

        {filteredExamples.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            {searchQuery
              ? `No templates found for "${searchQuery}"`
              : "No templates found in this category."}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <TemplatePreviewModal
        template={selectedTemplate}
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
      />
    </div>
  );
}
