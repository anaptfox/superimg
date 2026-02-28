"use client";

import { useState, useMemo } from "react";
import { ChevronRight, Search, X, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Player } from "superimg-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  EXAMPLE_CATEGORIES,
  getExamplesByCategory,
  type EditorExample,
} from "@/lib/video/examples/index";

interface ExamplesPanelProps {
  onSelectExample: (example: EditorExample) => void;
  activeExampleId?: string;
}

export function ExamplesPanel({
  onSelectExample,
  activeExampleId,
}: ExamplesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredExample, setHoveredExample] = useState<EditorExample | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const isMobile = useIsMobile();

  // Filter examples based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return EXAMPLE_CATEGORIES.map((category) => ({
        ...category,
        examples: getExamplesByCategory(category.id),
      }));
    }

    const query = searchQuery.toLowerCase();
    return EXAMPLE_CATEGORIES.map((category) => {
      const examples = getExamplesByCategory(category.id).filter(
        (example) =>
          example.title.toLowerCase().includes(query) ||
          example.id.toLowerCase().includes(query)
      );
      return { ...category, examples };
    }).filter((category) => category.examples.length > 0);
  }, [searchQuery]);

  const totalResults = filteredCategories.reduce(
    (acc, cat) => acc + cat.examples.length,
    0
  );

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-border bg-muted px-4 py-3">
        <SheetTitle className="text-base">Examples</SheetTitle>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search examples..."
            className="h-8 pl-8 pr-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-xs text-muted-foreground">
            {totalResults} result{totalResults !== 1 ? "s" : ""}
          </p>
        )}
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.map((category, index) => (
          <Collapsible
            key={category.id}
            defaultOpen={searchQuery ? true : index < 2}
            className="mb-1"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
              <span>{category.title}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {category.examples.length}
                </span>
                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90 [[data-state=open]>&]:rotate-90" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-2 border-l border-border pl-2">
                {category.examples.map((example) => (
                  <button
                    key={example.id}
                    onClick={() => onSelectExample(example)}
                    onMouseEnter={() => !isMobile && setHoveredExample(example)}
                    onMouseLeave={() => setHoveredExample(null)}
                    className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      activeExampleId === example.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {example.title}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
        {filteredCategories.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No examples found for "{searchQuery}"
          </div>
        )}
      </div>

      {/* Hover preview - positioned to the right of the panel */}
      {hoveredExample && !isMobile && (
        <div className="fixed left-[360px] top-1/2 z-50 -translate-y-1/2">
          <div className="w-[320px] overflow-hidden rounded-lg border bg-card shadow-xl">
            <div className="relative">
              <Player
                code={hoveredExample.code}
                format="horizontal"
                playbackMode="loop"
                hoverBehavior="play"
                compileDebounceMs={150}
                onCompiling={setIsCompiling}
                style={{ width: "100%", aspectRatio: "16/9" }}
              />
              {isCompiling && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="p-3 text-sm font-medium">{hoveredExample.title}</div>
          </div>
        </div>
      )}
    </div>
  );
}
