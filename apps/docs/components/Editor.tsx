"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Player,
  DataForm,
  VideoControls,
  useCompiledTemplate,
  usePlayerSession,
  usePlayerShortcuts,
  isComposedTemplate,
  type ExportOptions,
} from "superimg/react";
import {
  playgroundAssetResolver,
  resolvePlaygroundAssets,
} from "@/lib/playground/host";
import { shouldUseBundled } from "@/lib/playground/example";
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
import {
  getExampleById,
  EDITOR_EXAMPLES,
  type EditorExample,
} from "@/lib/video/examples/index";
import { useSearchParams } from "next/navigation";

const SUPERIMG_CONTEXT = `## SuperImg - Programmatic Video Generation

Video is a pure function of time. \`render(ctx)\` is called once per frame, returns HTML string.

### Key Context Fields
\`timeline.progress\` (0→1), \`timeline.seconds\`, \`width\`, \`height\`, \`data\`, \`std\`

### Stdlib
- \`std.interpolate(progress, [0, 1], [from, to], "easeOutCubic")\` — animation
- \`std.math.clamp\`, \`std.math.map\`
- \`std.color.alpha\`, \`std.color.mix\`
- \`std.css(obj)\` — object → inline style
- \`std.css.center()\`, \`std.css.fill()\`

### Rules
- Return template literal strings, NOT JSX
- Keep render pure — no state mutation
- Set root to \`width: \${width}px; height: \${height}px\`
`;

const TEMPLATE_EXAMPLE = `import { define } from "superimg";

export default define({
  sample: { title: "Hello", color: "#667eea" },
  config: { duration: 3 },
  render(ctx) {
    const { std, timeline, width, height, data } = ctx;
    const opacity = std.interpolate(timeline.progress, [0, 1], [0, 1], "easeOutCubic");
    return \\\`
      <div style="\\\${std.css({ width, height, background: '#0f0f23' }, std.css.center())}">
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
    import { Player, define } from 'https://esm.sh/superimg';

    const template = define({
      sample: { title: "Hello", color: "#667eea" },
      config: { duration: 3 },
      render(ctx) {
        const { std, timeline, width, height, data } = ctx;
        const opacity = std.interpolate(timeline.progress, [0, 1], [0, 1], "easeOutCubic");
        return \\\`
          <div style="\\\${std.css({ width, height, background: '#0f0f23' }, std.css.center())}">
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
Return define code. User pastes into SuperImg playground.

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
// 1. Define \`sample\` below → they become editable fields in the Data panel
// 2. Access values via \`ctx.data.title\`, \`ctx.data.accentColor\`, etc.
// 3. Changes in the Data panel instantly update the preview

import { define } from "superimg";

export default define({
  sample: {
    title: "SuperImg Editor",
    accentColor: "#667eea",
    bgColor: "#0f0f23",
  },

  render(ctx) {
    const { width, height, timeline, std, data } = ctx;

    // Fade in title
    const fadeIn = std.math.clamp(timeline.progress * 3, 0, 1);
    const opacity = std.interpolate(fadeIn, [0, 1], [0, 1], "easeOutCubic");
    const y = std.interpolate(fadeIn, [0, 1], [30, 0], "easeOutCubic");

    // Subtle hue pulse on accent
    const pulsedColor = std.color.mix(data.accentColor, "#ffffff", Math.sin(timeline.seconds * 2) * 0.08 + 0.08);

    return \`
      <div style="\${std.css({ width, height, background: data.bgColor }, std.css.center())}">
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
            Frame \${ctx.timeline.frame} · \${timeline.seconds.toFixed(2)}s
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

function initialEditorCode(templateId?: string): string {
  if (templateId) {
    const example = getExampleById(templateId);
    if (example?.code) return example.code;
  }
  return DEFAULT_TEMPLATE;
}

export default function Editor({ templateId }: EditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialExample = templateId ? getExampleById(templateId) : undefined;
  const [code, setCode] = useState(() => initialEditorCode(templateId));
  const [activeExampleId, setActiveExampleId] = useState<string | undefined>(templateId);
  const [dataPanelOpen, setDataPanelOpen] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [duration, setDuration] = useState(5);
  const [looping, setLooping] = useState(true);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wasmCompile, setWasmCompile] = useState(() => !shouldUseBundled(initialExample));
  const [codeEdited, setCodeEdited] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const activeExample = activeExampleId ? getExampleById(activeExampleId) : undefined;

  // Load example from templateId prop on mount
  useEffect(() => {
    if (templateId) {
      const example = getExampleById(templateId);
      if (example) {
        setCode(example.code ?? DEFAULT_TEMPLATE);
        setActiveExampleId(example.id);
        setWasmCompile(!shouldUseBundled(example));
        setCodeEdited(false);
        setFormData({});
      }
    }
  }, [templateId]);

  const handleSelectExample = (example: EditorExample) => {
    posthog.capture("example_selected_in_editor", { example_id: example.id, example_title: example.title, category: example.category });
    router.push(`/playground/${example.id}`);
    setExamplesOpen(false);
  };

  const { template, compiling, error: compileError } = useCompiledTemplate({
    code,
    bundled: activeExample?.bundled,
    wasmCompile,
    debounceMs: 300,
    enabled: !!code || !!(activeExample?.bundled && !wasmCompile),
  });

  const assets = useMemo(
    () => resolvePlaygroundAssets(template?.config?.assets),
    [template?.config?.assets],
  );

  const session = usePlayerSession({
    template,
    data: formData,
    duration,
  });

  // Sync duration dropdown when the compiled template declares one
  useEffect(() => {
    if (!template || isComposedTemplate(template)) return;
    const declared = template.config?.duration;
    if (typeof declared === "number") setDuration(declared);
  }, [template]);

  const durationOptions = useMemo(() => {
    const declared =
      template && !isComposedTemplate(template) && typeof template.config?.duration === "number"
        ? template.config.duration
        : undefined;
    if (declared != null && !DURATION_OPTIONS.includes(declared)) {
      return [...DURATION_OPTIONS, declared].sort((a, b) => a - b);
    }
    return DURATION_OPTIONS;
  }, [template]);

  useEffect(() => {
    if (compileError) {
      posthog.capture("editor_compile_error", { error_message: compileError.message });
    } else if (template && codeEdited) {
      posthog.capture("editor_code_changed", { code_length: code.length });
    }
  }, [compileError, template, codeEdited, code.length]);

  const exportRequested = searchParams.get("action") === "export";

  useEffect(() => {
    if (exportRequested && session.store) {
      setExportDialogOpen(true);
    }
  }, [exportRequested, session.store]);

  const handleDataChange = (newData: Record<string, unknown>) => {
    setFormData(newData);
  };

  const handleExport = useCallback(
    async (options: ExportOptions) => {
      posthog.capture("editor_export_started", {
        format: options.format,
        duration_seconds: duration,
      });
      const blob = await session.exportMp4(options);
      if (blob) {
        posthog.capture("editor_export_completed", {
          file_size_bytes: blob.size,
          format: options.format,
          duration_seconds: duration,
        });
      }
      return blob;
    },
    [session.exportMp4, duration],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExamplesOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  usePlayerShortcuts(session.playerRef, {
    onToggleLoop: () => setLooping((prev) => !prev),
    onEscape: () => router.push("/playground"),
  });


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
              <Badge variant="secondary" className="ml-1 hidden sm:flex text-xs">{EDITOR_EXAMPLES.length}</Badge>
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
                setWasmCompile(true);
                setCodeEdited(true);
                setFormData({});
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
                  {durationOptions.map((d) => (
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

          {activeExample?.bundled && !wasmCompile && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
              Multi-file template — showing pre-built bundle. Edit code to live-compile (imports may not resolve in browser).
            </div>
          )}

          {/* Preview — WebRuntime via Player */}
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-4">
            <Player
              ref={session.playerRef}
              template={template ?? undefined}
              format={session.format}
              duration={duration}
              playbackMode={looping ? "loop" : "once"}
              loadMode="eager"
              autoPlay
              data={formData}
              assets={assets}
              assetResolver={playgroundAssetResolver}
              onStore={session.onStore}
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
                  from <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">data</code>
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
                {template && !isComposedTemplate(template) && template.sample && Object.keys(template.sample).length > 0 ? (
                  <DataForm
                    templateData={template.sample}
                    data={formData}
                    onChange={handleDataChange}
                    theme="dark"
                  />
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">
                    Add a <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">sample</code> object to your template to generate form controls here.
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Controls */}
          {session.store && (
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
              exportDialogOpen={exportDialogOpen}
              onExportDialogOpenChange={setExportDialogOpen}
              className="border-t border-border"
            />
          )}

          {/* Error Display */}
          {compileError && (
            <Card className="mx-4 mb-4 border-destructive/50 bg-destructive/10">
              <CardContent className="p-3">
                <pre className="overflow-auto whitespace-pre-wrap font-mono text-sm text-destructive">
                  {compileError.message}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
