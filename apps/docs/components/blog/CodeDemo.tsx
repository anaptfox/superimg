"use client";

import { useState, useEffect, useRef } from "react";
import { useVideoSession, VideoControls } from "superimg-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { BLOG_DEMOS } from "@/content/blog/templates/blog-demos";

type View = "split" | "code" | "video";

const VIEWS: { id: View; label: string }[] = [
  { id: "split", label: "Split" },
  { id: "code", label: "Code" },
  { id: "video", label: "Video" },
];

interface CodeDemoProps {
  templateId: string;
}

export function CodeDemo({ templateId }: CodeDemoProps) {
  const [view, setView] = useState<View>("split");
  const containerRef = useRef<HTMLDivElement>(null);

  const demo = BLOG_DEMOS[templateId];
  const session = useVideoSession({
    containerRef,
    initialFormat: "horizontal",
    duration: demo?.duration ?? 4,
  });

  useEffect(() => {
    if (demo) {
      session.compile(demo.code);
    }
  }, [demo?.code]);

  useEffect(() => {
    if (session.template && !session.isPlaying) {
      session.play();
    }
  }, [session.template]);

  if (!demo) {
    return (
      <div className="not-prose my-8 flex items-center justify-center rounded-xl bg-muted p-8 text-sm text-muted-foreground">
        CodeDemo: template &quot;{templateId}&quot; not found
      </div>
    );
  }

  const showCode = view === "split" || view === "code";
  const showVideo = view === "split" || view === "video";
  const isLoading = !session.template;

  const handleCanvasClick = () => {
    if (session.store && session.template) {
      session.store.getState().togglePlayPause();
    }
  };

  return (
    <div className="not-prose my-8 -mx-6 lg:-mx-24">
      <div className="overflow-hidden rounded-xl border border-border/50 bg-[#1a1a1a] shadow-xl">

        {/* Unified header: macOS dots + filename left, toggle right */}
        <div className="flex items-center justify-between border-b border-border/50 bg-[#252526] px-4 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2">template.ts</span>
          </div>
          <div className="flex gap-0.5 rounded-md border border-border/40 bg-black/30 p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  view === v.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className={view === "split" ? "lg:grid lg:grid-cols-2" : ""}>

          {/* Code panel */}
          {showCode && (
            <div
              className={
                view === "split"
                  ? "border-b border-border/50 lg:border-b-0 lg:border-r"
                  : ""
              }
            >
              <CodeMirror
                value={demo.code}
                theme={oneDark}
                extensions={[javascript({ typescript: true })]}
                readOnly
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  highlightActiveLine: false,
                }}
                className="text-sm [&_.cm-editor]:bg-transparent! [&_.cm-scroller]:max-h-80 [&_.cm-scroller]:overflow-auto lg:[&_.cm-scroller]:max-h-none"
              />
            </div>
          )}

          {/* Video panel */}
          {showVideo && (
            <div className="flex flex-col">
              {/* Preview tab with loading indicator */}
              <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-xs font-medium text-muted-foreground">
                {isLoading ? (
                  <span className="inline-block h-2 w-2 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                )}
                {isLoading ? "Compiling…" : "Preview"}
              </div>
              <div className="relative flex flex-1 items-center justify-center bg-[#0d0d0d] p-4">
                {/* Loading shimmer */}
                {isLoading && (
                  <div className="absolute inset-0 animate-pulse bg-white/5" />
                )}
                {/* Canvas — click to play/pause */}
                <div
                  ref={containerRef}
                  className="w-full cursor-pointer rounded shadow-lg"
                  style={{ aspectRatio: "16/9" }}
                  onClick={handleCanvasClick}
                  title={session.isPlaying ? "Click to pause" : "Click to play"}
                />
              </div>
              <div className="border-t border-border/50">
                <VideoControls store={session.store} showTime />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
