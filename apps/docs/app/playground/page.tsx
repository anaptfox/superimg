"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopNav } from "@/components/landing/TopNav";

const TemplateGrid = dynamic(
  () => import("@/components/playground/TemplateGrid").then((m) => m.TemplateGrid),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground"></div>
          <p className="text-sm text-muted-foreground">Loading Templates...</p>
        </div>
      </div>
    ),
  },
);

function LegacyExampleRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const example = searchParams.get("example");

  useEffect(() => {
    if (example) {
      router.replace(`/playground/${example}`);
    }
  }, [example, router]);

  return null;
}

export default function PlaygroundPage() {
  return (
    <>
      <Suspense fallback={null}>
        <LegacyExampleRedirect />
      </Suspense>
      <TopNav />
      <TemplateGrid />
    </>
  );
}