"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Player, type PlayerRef } from "superimg/react/player";
import { ChevronDown, Copy, Check, Download, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CodeBlockContent, CodeBlockContainer } from "@/components/ai-elements/code-block";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EditorExample } from "@/lib/video/examples";
import { usePlaygroundExample } from "@/lib/playground/example";

interface TemplatePreviewModalProps {
  template: EditorExample | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatePreviewModal({
  template,
  open,
  onOpenChange,
}: TemplatePreviewModalProps) {
  const router = useRouter();
  const playerRef = useRef<PlayerRef>(null);
  const isMobile = useIsMobile();
  const [codeOpen, setCodeOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const playground = usePlaygroundExample(template, {
    enabled: !!template,
    preview: true,
  });

  const handleCopyCode = useCallback(async () => {
    if (!template) return;
    const source =
      template.code ??
      (template.codeUrl ? await fetch(template.codeUrl).then((r) => r.text()) : "");
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      posthog.capture("template_code_copied", { template_id: template.id });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy code");
    }
  }, [template]);

  const handleExport = useCallback(() => {
    if (!template) return;
    posthog.capture("template_export_clicked", { template_id: template.id });
    router.push(`/playground/${template.id}?action=export`);
    onOpenChange(false);
  }, [template, router, onOpenChange]);

  const handleEdit = useCallback(() => {
    if (!template) return;
    posthog.capture("template_edit_clicked", { template_id: template.id });
    router.push(`/playground/${template.id}`);
    onOpenChange(false);
  }, [template, router, onOpenChange]);

  const categoryLabel = template?.category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const content = template ? (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-neutral-950">
        <Player
          ref={playerRef}
          template={playground.template ?? undefined}
          assets={playground.assets}
          assetResolver={playground.assetResolver}
          format="horizontal"
          playbackMode="loop"
          loadMode="eager"
          hoverBehavior="none"
          autoPlay
          className="h-full w-full"
          style={{ aspectRatio: "16/9" }}
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {template.title}
          </h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="outline">{categoryLabel}</Badge>
            {template.playground?.needsBundle && (
              <Badge variant="secondary">Pre-bundled</Badge>
            )}
            {template.playground?.needsAssets && (
              <Badge variant="secondary">Assets</Badge>
            )}
          </div>
        </div>
      </div>

      <Collapsible open={codeOpen} onOpenChange={setCodeOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => {
              if (!codeOpen) {
                posthog.capture("template_code_expanded", { template_id: template.id });
              }
            }}
          >
            <span>{codeOpen ? "Hide Code" : "Show Code"}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${codeOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <CodeBlockContainer language="typescript" className="max-h-80 overflow-auto">
            <CodeBlockContent
              code={template.code ?? "// Load code from editor"}
              language="typescript"
            />
          </CodeBlockContainer>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleCopyCode} className="flex-1 sm:flex-none">
          {copied ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy Code
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleExport} className="flex-1 sm:flex-none">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export Video
        </Button>
        <Button onClick={handleEdit} className="flex-1 sm:flex-none">
          Edit in Playground
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] overflow-auto p-4">
          <SheetTitle className="sr-only">
            {template?.title ?? "Template Preview"}
          </SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(92vw,1280px)] max-w-none overflow-y-auto p-6 sm:max-w-[min(92vw,1280px)]">
        <DialogTitle className="sr-only">
          {template?.title ?? "Template Preview"}
        </DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}
