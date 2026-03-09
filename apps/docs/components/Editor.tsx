"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVideoSession, DataForm, VideoControls, isComposedTemplate, type ExportOptions } from "superimg-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import posthog from "posthog-js";
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
import { Repeat, LayoutGrid, Copy, Check, ExternalLink, ArrowLeft } from "lucide-react";
import {
  OpenIn,
  OpenInTrigger,
  OpenInContent,
  OpenInClaude,
  OpenInChatGPT,
} from "@/components/ai-elements/open-in-chat";
import { ExamplesPanel } from "./ExamplesPanel";
import { getExampleById, type EditorExample } from "@/lib/video/examples/index";

const SUPERIMG_CONTEXT = `## SuperImg - Programmatic Video Generation

Video is a pure function of time. \`render(ctx)\` is called once per frame, returns HTML string.

### Key Context Fields
\`sceneProgress\` (0→1), \`sceneTimeSeconds\`, \`width\`, \`height\`, \`data\`, \`std\`

### Stdlib
- \`std.tween(from, to, progress, "easeOutCubic")\` — animation
- \`std.math.clamp\`, \`std.math.map\`
- \`std.color.alpha\`, \`std.color.mix\`
- \`std.css(obj)\` — object → inline style
- \`std.css.center()\`, \`std.css.fill()\`

### Rules
- Return template literal strings, NOT JSX
- Keep render pure — no state mutation
- Set root to \`width: \${width}px; height: \${height}px\`
`;

const TEMPLATE_EXAMPLE = `import { defineScene } from "superimg";

export default defineScene({
  defaults: { title: "Hello", color: "#667eea" },
  config: { durationSeconds: 3 },
  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const opacity = std.tween(0, 1, sceneProgress, "easeOutCubic");
    return \\\`
      <div style="\\\${std.css({ width, height, background: '#0f0f23' })};\\\${std.css.center()}">
        <h1 style="\\\${std.css({ color: data.color, fontSize: 64, opacity })}">\\\${data.title}</h1>
      </div>
    \\\`;
  }
});`;

const HTML_PAGE_EXAMPLE = `<!DOCTYPE html>
<html>
<head>
  <title>My Video</title>
  <script type="module">
    import { Player, defineScene } from 'https://esm.sh/superimg';

    const template = defineScene({
      defaults: { title: "Hello", color: "#667eea" },
      config: { durationSeconds: 3 },
      render(ctx) {
        const { std, sceneProgress, width, height, data } = ctx;
        const opacity = std.tween(0, 1, sceneProgress, "easeOutCubic");
        return \\\`
          <div style="\\\${std.css({ width, height, background: '#0f0f23' })};\\\${std.css.center()}">
            <h1 style="\\\${std.css({ color: data.color, fontSize: 64, opacity })}">\\\${data.title}</h1>
          </div>
        \\\`;
      }
    });

    const player = new Player({ container: '#video', playbackMode: 'loop' });
    await player.load(template);
    player.play();
  </script>
</head>
<body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div id="video" style="width:800px;aspect-ratio:16/9"></div>
</body>
</html>`;

function buildAIPrompt(code: string): string {
  return `${SUPERIMG_CONTEXT}

## Output Options

### Option 1: Template Code (for playground)
Return defineScene code. User pastes into SuperImg playground.

\`\`\`javascript
${TEMPLATE_EXAMPLE}
\`\`\`

### Option 2: Complete HTML Page (standalone)
Return full HTML. User saves as .html and opens in browser - video plays directly.

\`\`\`html
${HTML_PAGE_EXAMPLE}
\`\`\`

Choose based on context:
- Iterate in playground → Option 1
- Shareable standalone file → Option 2

---

Here's my current template:

\`\`\`javascript
${code}
\`\`\`

Help me modify this template.`;
}

const DEFAULT_TEMPLATE = `// SuperImg Template
// 1. Define \`defaults\` below → they become editable fields in the Data panel
// 2. Access values via \`ctx.data.title\`, \`ctx.data.accentColor\`, etc.
// 3. Changes in the Data panel instantly update the preview

import { defineScene } from "superimg";

export default defineScene({
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

interface EditorProps {
  templateId?: string;
}

export default function Editor({ templateId }: EditorProps) {
  const router = useRouter();
  const [code, setCode] = useState(DEFAULT_TEMPLATE);
  const [activeExampleId, setActiveExampleId] = useState<string | undefined>(templateId);
  const [dataPanelOpen, setDataPanelOpen] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [duration, setDuration] = useState(5);
  const [looping, setLooping] = useState(true);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load example from templateId prop on mount
  useEffect(() => {
    if (templateId) {
      const example = getExampleById(templateId);
      if (example) {
        setCode(example.code);
        setActiveExampleId(example.id);
      }
    }
  }, [templateId]);

  const handleSelectExample = (example: EditorExample) => {
    posthog.capture("example_selected_in_editor", { example_id: example.id, example_title: example.title, category: example.category });
    // Navigate to the example's URL (this updates the URL and triggers a re-render)
    router.push(`/playground/${example.id}`);
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
        case "Escape":
          e.preventDefault();
          router.push("/playground");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session, router]);


  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    posthog.capture("editor_code_copied", { code_length: code.length });
  };

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
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Link href="/playground">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Examples</span>
              </Link>
            </Button>
            <span className="text-muted-foreground">|</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExamplesOpen(true)}
              className="gap-2"
              title="Browse examples (⌘⇧E)"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Examples</span>
              <Badge variant="secondary" className="ml-1 hidden sm:flex text-xs">24</Badge>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="gap-1.5"
              title="Copy template code"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
            </Button>
            <OpenIn query={buildAIPrompt(code)}>
              <OpenInTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <span className="hidden sm:inline">Open in AI Chat</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </OpenInTrigger>
              <OpenInContent>
                <OpenInClaude />
                <OpenInChatGPT />
              </OpenInContent>
            </OpenIn>
            <span className="text-muted-foreground">|</span>
            <span>Template Code</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeMirror
              value={code}
              height="100%"
              theme={oneDark}
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
          </div>

          {/* Preview Container - stays dark for video contrast */}
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-4">
            <div
              ref={containerRef}
              className="max-h-full max-w-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
              style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
            />
          </div>

          {/* Data Panel - always visible */}
          <Collapsible
            open={dataPanelOpen}
            onOpenChange={setDataPanelOpen}
            className="border-t border-border bg-muted"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-accent">
              <div className="flex items-center gap-2">
                <span>Data</span>
                <span className="text-xs font-normal text-muted-foreground">
                  from <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">defaults</code>
                </span>
              </div>
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
                {session.template && !isComposedTemplate(session.template) && session.template.defaults && Object.keys(session.template.defaults).length > 0 ? (
                  <DataForm
                    defaults={session.template.defaults}
                    data={formData}
                    onChange={handleDataChange}
                    theme="dark"
                  />
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">
                    Add a <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">defaults</code> object to your template to generate form controls here.
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

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
