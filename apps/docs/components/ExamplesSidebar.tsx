"use client";

import { ChevronRight } from "lucide-react";
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
  return (
    <Sidebar className="border-r border-[#333]">
      <SidebarHeader className="border-b border-[#333] bg-[#252526] px-4 py-3">
        <span className="text-sm font-medium text-white">Examples</span>
      </SidebarHeader>
      <SidebarContent className="bg-[#1e1e1e]">
        <SidebarGroup>
          <SidebarMenu>
            {EXAMPLE_CATEGORIES.map((category, index) => {
              const examples = getExamplesByCategory(category.id);
              return (
                <Collapsible
                  key={category.id}
                  defaultOpen={index < 2}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="text-[#ccc] hover:bg-[#333] hover:text-white">
                        {category.title}
                        <span className="ml-auto text-xs text-[#888]">
                          {examples.length}
                        </span>
                        <ChevronRight className="ml-1 h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="border-[#444]">
                        {examples.map((example) => (
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
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
