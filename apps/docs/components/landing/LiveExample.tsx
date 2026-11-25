"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Player } from "@foxworth/superimg/react/player";
import { landingDualPathTemplate } from "@/content/templates/landing-demos";
import { useIsMobile } from "@/hooks/use-mobile";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Code, Play, Sliders, ChevronDown, RotateCcw } from "lucide-react";

interface FormState {
  title: string;
  accent: string;
}

const INITIAL_FORM: FormState = {
  title: "Ship it",
  accent: "#818cf8",
};

/** Shown in the code pane — desktop Player uses a 9:16 reel canvas. */
const TEMPLATE_CODE_REEL = `import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1080, height: 1920, fps: 30, duration: 5 },
  sample: { title: "Ship it", accent: "#818cf8" },
  render(ctx) {
    const { width, height, std, data } = ctx;
    const t = ctx.director({ intro: "25%", live: "35%", export: "40%" });
    const card = t.motion({ y: 18, opacity: 0, easing: "easeOutCubic" });
    const live = t.in("live");
    const exp = t.in("export");
    return Html({ width: "fill", height: "fill", html: \`
      <div style="\${std.css({ width, height }, std.css.center(), {
        flexDirection: "column", gap: 28, background: "#0c0c12", color: "#fff",
      })}">
        <h1 style="\${card.style}">\${data.title}</h1>
        <span style="opacity:\${live}">Live · in your app</span>
        <span style="opacity:\${exp}">Export · MP4 · GIF · still</span>
      </div>
    \` });
  },
});`;

export function LiveExample() {
  const [cfg, setCfg] = useState<FormState>(INITIAL_FORM);
  const [showCode, setShowCode] = useState(false);
  const isMobile = useIsMobile();

  // Reel on desktop; landscape on mobile (and after viewport reset to narrow).
  const size = isMobile
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 };
  const sizeKey = `${size.width}x${size.height}`;
  const [mountedSizeKey, setMountedSizeKey] = useState(sizeKey);

  // Remount Player when size flips so stage size + scale re-init cleanly
  // (avoids stuck letterbox after resize desktop↔mobile).
  useEffect(() => {
    setMountedSizeKey(sizeKey);
  }, [sizeKey]);

  const formData = useMemo(
    () => ({
      title: cfg.title,
      accent: cfg.accent,
    }),
    [cfg],
  );

  const updateConfig = (patch: Partial<FormState>) => {
    setCfg((prev) => ({ ...prev, ...patch }));
  };

  const resetForm = () => {
    setCfg(INITIAL_FORM);
  };

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-xl border border-border/50 bg-[#1a1a1a] shadow-2xl text-left">
        <div className="grid md:grid-cols-2 md:items-stretch">
          <div className="md:col-start-1 md:row-start-1 border-t border-border/50 md:border-t-0 md:border-r flex flex-col min-h-0">
            <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-sm font-medium text-muted-foreground">
              <Code className="h-3 w-3" />
              hello.media.ts
              <span className="ml-auto font-mono text-[10px] text-white/40">
                {isMobile ? "16:9 mobile" : "9:16 reel"}
              </span>
            </div>
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
                  value={TEMPLATE_CODE_REEL}
                  height="200px"
                  theme={oneDark}
                  extensions={[javascript({ typescript: true })]}
                  readOnly
                  className="text-sm"
                  basicSetup={{ lineNumbers: true, foldGutter: false }}
                />
              )}
            </div>
            <div className="hidden md:block flex-1 min-h-0">
              <CodeMirror
                value={TEMPLATE_CODE_REEL}
                height="100%"
                minHeight="360px"
                theme={oneDark}
                extensions={[javascript({ typescript: true })]}
                readOnly
                className="text-sm h-full [&_.cm-editor]:h-full [&_.cm-scroller]:min-h-[360px]"
                basicSetup={{ lineNumbers: true, foldGutter: false }}
              />
            </div>
            <div className="border-t border-border/50 bg-[#252526] px-4 py-3 mt-auto">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Sliders className="h-3 w-3" />
                Customize
                <button
                  type="button"
                  onClick={resetForm}
                  className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-white/50 hover:bg-white/10 hover:text-white/80"
                  title="Reset title and accent"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                  <span className="w-12 shrink-0">Title</span>
                  <input
                    type="text"
                    value={cfg.title}
                    onChange={(e) => updateConfig({ title: e.target.value })}
                    className="h-8 w-full rounded border border-white/10 bg-white/5 px-2 text-xs text-white outline-none focus:border-white/25"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-12 shrink-0">Accent</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={cfg.accent}
                      onChange={(e) => updateConfig({ accent: e.target.value })}
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                    />
                    <span className="font-mono text-[10px] text-white/50">{cfg.accent}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="-order-1 flex flex-col md:order-0 md:col-start-2 md:row-start-1 min-w-0 bg-[#0d0d0d]">
            <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-sm font-medium text-muted-foreground">
              <Play className="h-3 w-3" />
              Live preview
              <span className="ml-auto text-[10px] text-white/40">
                {isMobile ? "horizontal" : "reel"}
              </span>
            </div>
            {/*
              Desktop: 9:16 reel stage (phone frame).
              Mobile: 16:9 horizontal so stacked preview isn’t an endless scroll.
              Remount Player on format change (key) so scale/layout resets cleanly.
            */}
            <div
              className={
                isMobile
                  ? "relative w-full aspect-video overflow-hidden bg-[#0d0d0d]"
                  : "relative flex flex-1 items-center justify-center overflow-hidden bg-[#0d0d0d] p-6 min-h-[420px]"
              }
              style={isMobile ? { maxHeight: "min(50vh, 320px)" } : undefined}
            >
              <div
                className={
                  isMobile
                    ? "absolute inset-0"
                    : "relative aspect-[9/16] h-full max-h-[min(560px,70vh)] w-auto max-w-full overflow-hidden rounded-none ring-0 shadow-none"
                }
              >
                <Player
                  key={mountedSizeKey}
                  media={
                    landingDualPathTemplate as Parameters<typeof Player>[0]["media"]
                  }
                  data={formData}
                  size={size}
                  playbackMode="loop"
                  loadMode="eager"
                  autoPlay
                  controls={false}
                  className="absolute inset-0 h-full w-full"
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="h-9 px-4 text-sm">
          <Link href="/playground">Open full playground</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-9 px-4 text-sm">
          <Link href="/docs/getting-started">Getting started</Link>
        </Button>
      </div>
    </div>
  );
}
