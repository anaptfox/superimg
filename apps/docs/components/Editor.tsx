"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useVideoSession, DataForm, VideoControls, type ExportOptions } from "superimg-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import posthog from "posthog-js";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Repeat, LayoutGrid } from "lucide-react";
import { ExamplesPanel } from "./ExamplesPanel";
import { getExampleById, type EditorExample } from "@/lib/video/examples/index";

const DEFAULT_TEMPLATE = `// SuperImg Template
// Edit the defaults below and use ctx.data in render to drive the output.

import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    title: "SuperImg Editor",
    accentColor: "#667eea",
    bgColor: "#0f0f23",
  },

  render(ctx) {
    const { width, height, sceneProgress: p, sceneTimeSeconds, std, data } = ctx;

    // Fade in title
    const opacity = std.tween(0, 1, std.math.clamp(p * 3, 0, 1), "easeOutCubic");
    const y = std.tween(30, 0, std.math.clamp(p * 3, 0, 1), "easeOutCubic");

    // Subtle hue pulse on accent
    const pulsedColor = std.color.mix(data.accentColor, "#ffffff", Math.sin(sceneTimeSeconds * 2) * 0.08 + 0.08);

    return \`
      <div style="\${std.css({ width, height, background: data.bgColor })};\${std.css.center()}">
        <div style="\${std.css({
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          opacity,
          transform: "translateY(" + y + "px)",
        })}">
          <h1 style="\${std.css({ fontSize: 72, color: pulsedColor, margin: 0 })}">
            \${data.title}
          </h1>
          <p style="\${std.css({ fontSize: 20, color: "rgba(255,255,255,0.5)", marginTop: 12 })}">
            Frame \${ctx.sceneFrame} · \${sceneTimeSeconds.toFixed(2)}s
          </p>
        </div>
      </div>
    \`;
  },
});
`;

const DURATION_OPTIONS = [1, 3, 5, 10, 15, 30];

export default function Editor() {
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const [code, setCode] = useState(DEFAULT_TEMPLATE);
  const [activeExampleId, setActiveExampleId] = useState<string | undefined>();
  const [dataPanelOpen, setDataPanelOpen] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [duration, setDuration] = useState(5);
  const [looping, setLooping] = useState(true);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = resolvedTheme === "dark";

  // Load example from URL param on mount
  useEffect(() => {
    const exampleId = searchParams.get("example");
    if (exampleId) {
      const example = getExampleById(exampleId);
      if (example) {
        setCode(example.code);
        setActiveExampleId(example.id);
      }
    }
  }, [searchParams]);

  const handleSelectExample = (example: EditorExample) => {
    setCode(example.code);
    setActiveExampleId(example.id);
    setFormData({}); // Reset form data when switching examples
    setExamplesOpen(false); // Auto-close sheet
  };

  const session = useVideoSession({
    containerRef,
    initialFormat: "horizontal",
    duration,
  });

  // Compile code when it changes
  useEffect(() => {
    session.compile(code);
    setFormData({}); // Reset form data when code changes

    if (session.error) {
      posthog.capture("editor_compile_error", {
        error_message: session.error.message,
      });
      posthog.captureException(session.error);
    } else if (session.template) {
      posthog.capture("editor_code_changed", {
        code_length: code.length,
      });
    }
  }, [code]);

  // Auto-play when ready
  useEffect(() => {
    if (session.ready && !session.isPlaying && !session.exporting) {
      session.play();
    }
  }, [session.ready]);

  // Loop handling - restart when video ends
  useEffect(() => {
    if (looping && !session.isPlaying && session.progress >= 0.99 && !session.exporting) {
      session.seek(0);
      session.play();
    }
  }, [looping, session.isPlaying, session.progress, session.exporting]);

  // Handle form data changes
  const handleDataChange = (newData: Record<string, unknown>) => {
    setFormData(newData);
    session.setData(newData);
  };

  // Handle export with options from dialog
  const handleExport = useCallback(async (options: ExportOptions) => {
    posthog.capture("editor_export_started", {
      fps: session.fps,
      format: options.format,
      duration_seconds: duration,
    });

    const blob = await session.exportMp4(options);

    if (blob) {
      posthog.capture("editor_export_completed", {
        file_size_bytes: blob.size,
        fps: session.fps,
        format: options.format,
        duration_seconds: duration,
      });
    }

    return blob;
  }, [session, duration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Shift+E to toggle examples panel (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExamplesOpen((prev) => !prev);
        return;
      }

      // Don't capture other shortcuts if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      // Don't capture if CodeMirror is focused
      if ((e.target as HTMLElement)?.closest('.cm-editor')) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          session.togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (!session.isPlaying) {
            session.seek(Math.max(0, session.currentFrame - (e.shiftKey ? 10 : 1)));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (!session.isPlaying) {
            session.seek(Math.min(session.totalFrames - 1, session.currentFrame + (e.shiftKey ? 10 : 1)));
          }
          break;
        case "Home":
          e.preventDefault();
          session.seek(0);
          break;
        case "End":
          e.preventDefault();
          session.seek(session.totalFrames - 1);
          break;
        case "KeyL":
          e.preventDefault();
          setLooping((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session]);

  return (
    <>
      <Sheet open={examplesOpen} onOpenChange={setExamplesOpen}>
        <SheetContent side="left" className="w-[350px] p-0">
          <ExamplesPanel
            onSelectExample={handleSelectExample}
            activeExampleId={activeExampleId}
          />
        </SheetContent>
      </Sheet>

      <div className="flex h-screen bg-background text-foreground">
        {/* Code Editor Panel - Left Side */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3 text-sm font-medium">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExamplesOpen(true)}
              className="-ml-1 gap-2"
              title="Browse examples (⌘⇧E)"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Examples</span>
            </Button>
            <span className="text-muted-foreground">|</span>
            <span>Template Code</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeMirror
              value={code}
              height="100%"
              theme={isDark ? oneDark : "light"}
              extensions={[javascript({ typescript: true })]}
              onChange={(value) => {
                setCode(value);
                setActiveExampleId(undefined);
              }}
              className="h-full"
            />
          </div>
        </div>

        {/* Preview Panel - Right Side */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2 text-sm font-medium">
            <div className="flex items-center gap-3">
              <span>Preview</span>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger className="h-7 w-[80px] border-input bg-secondary text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)} className="text-xs">
                      {d}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLooping((prev) => !prev)}
                className={`h-7 w-7 p-0 ${looping ? "text-blue-500" : "text-muted-foreground"}`}
                title={looping ? "Loop enabled (L)" : "Loop disabled (L)"}
              >
                <Repeat className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Badge variant={session.error ? "destructive" : "secondary"}>
                {session.status}
              </Badge>
            </div>
          </div>

          {/* Preview Container - stays dark for video contrast */}
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-4">
            <div
              ref={containerRef}
              className="max-h-full max-w-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
              style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
            />
          </div>

          {/* Data Panel */}
          {session.template?.defaults && Object.keys(session.template.defaults).length > 0 && (
            <Collapsible
              open={dataPanelOpen}
              onOpenChange={setDataPanelOpen}
              className="border-t border-border bg-muted"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-accent">
                <span>Data</span>
                <svg
                  className={`h-4 w-4 transition-transform ${dataPanelOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-[200px] overflow-y-auto px-4 pb-4">
                  <DataForm
                    defaults={session.template.defaults}
                    data={formData}
                    onChange={handleDataChange}
                    theme={isDark ? "dark" : "light"}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Controls */}
          <VideoControls
            store={session.store}
            showTimeline
            showTime
            showFormat
            showExport
            onExport={handleExport}
            onDownload={session.download}
            exporting={session.exporting}
            exportProgress={session.exportProgress}
            currentFormat={session.format}
            onFormatChange={session.setFormat}
            className="border-t border-border"
          />

          {/* Error Display */}
          {session.error && (
            <Card className="mx-4 mb-4 border-destructive/50 bg-destructive/10">
              <CardContent className="p-3">
                <pre className="overflow-auto whitespace-pre-wrap font-mono text-sm text-destructive">
                  {session.error.message}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
