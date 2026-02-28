"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground"></div>
        <p className="text-sm text-muted-foreground">Loading Editor...</p>
      </div>
    </div>
  ),
});

export default function EditorPage() {
  return <Editor />;
}
