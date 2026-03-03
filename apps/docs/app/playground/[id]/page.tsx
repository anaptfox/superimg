"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p className="text-sm text-muted-foreground">Loading Editor...</p>
    </div>
  ),
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlaygroundEditorPage({ params }: PageProps) {
  const { id } = use(params);
  return <Editor templateId={id} />;
}
