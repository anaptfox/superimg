"use client";

import dynamic from "next/dynamic";

const WidgetEditor = dynamic(() => import("./WidgetEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-[#0d0d0d] text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <p className="text-sm text-white/60">Loading SuperImg Editor…</p>
      </div>
    </div>
  ),
});

export default function WidgetPage() {
  return <WidgetEditor />;
}
