"use client";

import dynamic from "next/dynamic";
import { DeferredDemo } from "./DeferredDemo";

const InteractiveCodeDemo = dynamic(
  () => import("./CodeDemoInteractive").then((module) => module.CodeDemoInteractive),
  { ssr: false },
);

interface CodeDemoProps {
  templateId: string;
}

export function CodeDemo({ templateId }: CodeDemoProps) {
  return (
    <DeferredDemo label={`Interactive code example: ${templateId}`}>
      <InteractiveCodeDemo templateId={templateId} />
    </DeferredDemo>
  );
}
