"use client";

import { useState, useMemo } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import {
  EXAMPLE_CATEGORIES,
  getExamplesByCategory,
  type EditorExample,
} from "@/lib/video/examples/index";

interface ExamplesSidebarProps {
  onSelectExample: (example: EditorExample) => void;
  activeExampleId?: string;
}

export function ExamplesSidebar({
  onSelectExample,
  activeExampleId,
}: ExamplesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
    <Sidebar className="border-r border-[#333]">
      <SidebarHeader className="border-b border-[#333] bg-[#252526] p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search examples..."
            className="h-8 border-[#444] bg-[#333] pl-8 pr-8 text-sm text-white placeholder:text-[#888]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-xs text-[#888]">
            {totalResults} result{totalResults !== 1 ? "s" : ""}
          </p>
        )}
      </SidebarHeader>
      <SidebarContent className="bg-[#1e1e1e]">
        <SidebarGroup>
          <SidebarMenu>
            {filteredCategories.map((category, index) => (
              <Collapsible
                key={category.id}
                defaultOpen={searchQuery ? true : index < 2}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="text-[#ccc] hover:bg-[#333] hover:text-white">
                      {category.title}
                      <span className="ml-auto text-xs text-[#888]">
                        {category.examples.length}
                      </span>
                      <ChevronRight className="ml-1 h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-[#444]">
                      {category.examples.map((example) => (
                        <SidebarMenuSubItem key={example.id}>
                          <SidebarMenuSubButton
                            isActive={activeExampleId === example.id}
                            onClick={() => onSelectExample(example)}
                            className="cursor-pointer text-[#aaa] hover:bg-[#333] hover:text-white data-[active=true]:bg-[#094771] data-[active=true]:text-white"
                          >
                            {example.title}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
            {filteredCategories.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[#888]">
                No examples found for "{searchQuery}"
              </div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
