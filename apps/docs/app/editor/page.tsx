"use client";

import dynamic from "next/dynamic";
import { SidebarProvider } from "@/components/ui/sidebar";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-[#1a1a1a] text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
        <p className="text-sm text-white/60">Loading Code Editor...</p>
      </div>
    </div>
  ),
});

export default function EditorPage() {
  return (
    <SidebarProvider defaultOpen={true}>
      <Editor />
    </SidebarProvider>
  );
}
