"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useVideoSession, VideoControls } from "superimg-react";
import { useIsMobile } from "@/hooks/use-mobile";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Code, Play, Sliders, ChevronDown } from "lucide-react";

const GRADIENT_PRESETS: Record<string, string> = {
  Midnight: "linear-gradient(135deg, #1e1e2e, #2d2d44)",
  Ocean: "linear-gradient(135deg, #0f2027, #203a43)",
  Sunset: "linear-gradient(135deg, #2d1b3d, #44203a)",
  Forest: "linear-gradient(135deg, #1a2a1a, #2d3a2d)",
};

interface FormState {
  name: string;
  startFrom: number;
  color: string;
  fontSize: number;
  gradientKey: string;
}

const INITIAL_FORM: FormState = {
  name: "GO!",
  startFrom: 5,
  color: "#ffffff",
  fontSize: 180,
  gradientKey: "Midnight",
};

const TEMPLATE_CODE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    name: "GO!",
    startFrom: 5,
    color: "#ffffff",
    fontSize: 180,
    gradient: "linear-gradient(135deg, #1e1e2e, #2d2d44)",
  },
  render(ctx) {
    const { sceneFrame, fps, width, height, std, data } = ctx;
    const second = Math.floor(sceneFrame / fps);
    const count = Math.max(1, data.startFrom - second);
    const showGo = second >= data.startFrom;

    const bg = std.css({
      width, height,
      background: data.gradient,
      fontFamily: "system-ui, sans-serif",
    }) + ";" + std.css.center();

    const num = std.css({
      fontSize: data.fontSize,
      fontWeight: 800,
      color: data.color,
      textShadow: "0 4px 20px rgba(0,0,0,0.5)",
    });

    return \`
      <div style="\${bg}">
        <div style="\${num}">
          \${showGo ? data.name : count}
        </div>
      </div>
    \`;
  },
});`;

export function LiveExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cfg, setCfg] = useState<FormState>(INITIAL_FORM);
  const [showCode, setShowCode] = useState(false);
  const isMobile = useIsMobile();

  const session = useVideoSession({
    containerRef,
    initialFormat: "horizontal",
    duration: 6,
  });

  useEffect(() => {
    session.compile(TEMPLATE_CODE);
  }, []);

  useEffect(() => {
    if (session.template && !session.isPlaying) {
      session.play();
    }
  }, [session.template]);

  const updateConfig = useCallback(
    (patch: Partial<FormState>) => {
      setCfg((prev) => {
        const next = { ...prev, ...patch };
        session.setData({
          name: next.name,
          startFrom: next.startFrom,
          color: next.color,
          fontSize: next.fontSize,
          gradient: GRADIENT_PRESETS[next.gradientKey] ?? GRADIENT_PRESETS.Midnight,
        });
        return next;
      });
    },
    [session]
  );

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Try it now
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Edit the code below and see your changes instantly
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-[#1a1a1a] shadow-2xl">
          <div className="grid md:grid-cols-2">
            {/* Editable Code - col-1 on desktop, pushed below video on mobile via row/col */}
            <div className="md:col-start-1 md:row-start-1 border-t border-border/50 md:border-t-0 md:border-r">
              <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-sm font-medium text-muted-foreground">
                <Code className="h-3 w-3" />
                template.ts
              </div>
              {/* Collapsible on mobile */}
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-muted-foreground hover:bg-white/5"
                >
                  <span>View template code</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showCode ? "rotate-180" : ""}`}
                  />
                </button>
                {showCode && (
                  <CodeMirror
                    value={TEMPLATE_CODE}
                    height="240px"
                    theme={oneDark}
                    extensions={[javascript({ typescript: true })]}
                    readOnly
                    className="text-sm"
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: false,
                    }}
                  />
                )}
              </div>
              <div className="hidden md:block">
                <CodeMirror
                  value={TEMPLATE_CODE}
                  height="320px"
                  theme={oneDark}
                  extensions={[javascript({ typescript: true })]}
                  readOnly
                  className="text-sm"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                  }}
                />
              </div>
              {/* Controls */}
              <div className="border-t border-border/50 bg-[#252526] px-4 py-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Sliders className="h-3 w-3" />
                  Customize (session.setData)
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-12 shrink-0">Name</span>
                    <input
                      type="text"
                      value={cfg.name}
                      onChange={(e) => updateConfig({ name: e.target.value })}
                      className="h-8 w-full rounded border border-white/10 bg-white/5 px-2 text-xs text-white outline-none focus:border-white/25"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-12 shrink-0">Start</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={cfg.startFrom}
                      onChange={(e) =>
                        updateConfig({
                          startFrom: Math.max(
                            1,
                            Math.min(10, Number(e.target.value) || 1)
                          ),
                        })
                      }
                      className="h-8 w-full rounded border border-white/10 bg-white/5 px-2 text-xs text-white outline-none focus:border-white/25"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-12 shrink-0">Color</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={cfg.color}
                        onChange={(e) => updateConfig({ color: e.target.value })}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                      />
                      <span className="font-mono text-[10px] text-white/50">
                        {cfg.color}
                      </span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-12 shrink-0">BG</span>
                    <select
                      value={cfg.gradientKey}
                      onChange={(e) =>
                        updateConfig({ gradientKey: e.target.value })
                      }
                      className="h-8 w-full cursor-pointer rounded border border-white/10 bg-white/5 px-1.5 text-xs text-white outline-none focus:border-white/25"
                    >
                      {Object.keys(GRADIENT_PRESETS).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-1 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                    <span className="w-12 shrink-0">Size</span>
                    <input
                      type="range"
                      min={80}
                      max={240}
                      value={cfg.fontSize}
                      onChange={(e) =>
                        updateConfig({ fontSize: Number(e.target.value) })
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white/70"
                    />
                    <span className="w-8 text-right font-mono text-[10px] text-white/50">
                      {cfg.fontSize}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Video Preview - col-2 on desktop; on mobile, DOM order puts it second but we use -order-1 to hoist */}
            <div className="-order-1 flex flex-col md:order-0 md:col-start-2 md:row-start-1">
              <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-sm font-medium text-muted-foreground">
                <Play className="h-3 w-3" />
                Preview
              </div>
              <div
                className="flex flex-1 items-center justify-center bg-[#0d0d0d] p-4"
                style={
                  isMobile ? { maxHeight: "min(60vh, 400px)" } : undefined
                }
              >
                <div
                  ref={containerRef}
                  className="max-h-full max-w-full rounded shadow-lg"
                  style={{
                    aspectRatio:
                      session.format === "vertical"
                        ? "9/16"
                        : session.format === "square"
                          ? "1/1"
                          : typeof session.format === "object"
                            ? `${session.format.width}/${session.format.height}`
                            : "16/9",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                />
              </div>
              {/* Playback Controls */}
              <div className="border-t border-border/50">
                <VideoControls
                  store={session.store}
                  showTime
                  showFormat
                  showExport
                  currentFormat={session.format}
                  onFormatChange={session.setFormat}
                  onExport={(opts) => session.exportMp4(opts)}
                  onDownload={session.download}
                  exporting={session.exporting}
                  exportProgress={session.exportProgress}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="dark:border dark:border-border/40 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
          >
            <Link href="/editor">Open Full Editor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
