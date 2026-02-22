"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useVideoSession, Timeline } from "superimg-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ExamplesSidebar } from "./ExamplesSidebar";
import { getExampleById, type EditorExample } from "@/lib/video/examples/index";

const DEFAULT_TEMPLATE = `// SuperImg Template
// Available context: ctx.sceneFrame, ctx.sceneTimeSeconds, ctx.sceneProgress, ctx.width, ctx.height, ctx.fps, ctx.std

export function render(ctx) {
  const { width, height, sceneProgress, sceneTimeSeconds } = ctx;

  // Animate a gradient that shifts over time
  const hue = Math.floor(sceneProgress * 360);
  const bgColor = \`hsl(\${hue}, 70%, 20%)\`;

  // Bouncing circle
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 100 + Math.sin(sceneTimeSeconds * 2) * 50;
  const circleX = centerX + Math.sin(sceneTimeSeconds * 3) * 200;
  const circleY = centerY + Math.cos(sceneTimeSeconds * 2) * 150;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: \${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    ">
      <!-- Animated circle -->
      <div style="
        position: absolute;
        left: \${circleX - radius}px;
        top: \${circleY - radius}px;
        width: \${radius * 2}px;
        height: \${radius * 2}px;
        background: linear-gradient(135deg, #e94560, #0f3460);
        border-radius: 50%;
        box-shadow: 0 0 60px rgba(233, 69, 96, 0.5);
      "></div>

      <!-- Text overlay -->
      <div style="
        position: relative;
        z-index: 1;
        text-align: center;
        color: white;
        font-family: system-ui, sans-serif;
      ">
        <h1 style="
          font-size: 72px;
          margin: 0;
          text-shadow: 0 4px 20px rgba(0,0,0,0.5);
        ">SuperImg Editor</h1>
        <p style="
          font-size: 24px;
          opacity: 0.8;
          margin-top: 16px;
        ">Frame \${ctx.sceneFrame} / Time: \${sceneTimeSeconds.toFixed(2)}s</p>
      </div>
    </div>
  \`;
}
`;

const DURATION_SECONDS = 5;

export default function Editor() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(DEFAULT_TEMPLATE);
  const [activeExampleId, setActiveExampleId] = useState<string | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  };

  const session = useVideoSession({
    initialPreviewFormat: "horizontal",
    duration: DURATION_SECONDS,
    canvasRef,
  });

  // Compile code when it changes
  useEffect(() => {
    session.compile(code);

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

  // Handle export
  const handleExport = async () => {
    posthog.capture("editor_export_started", {
      fps: session.fps,
      width: session.previewWidth,
      height: session.previewHeight,
      duration_seconds: DURATION_SECONDS,
    });

    const blob = await session.exportMp4();

    if (blob) {
      session.download(blob, "superimg-export.mp4");
      posthog.capture("editor_export_completed", {
        file_size_bytes: blob.size,
        fps: session.fps,
        width: session.previewWidth,
        height: session.previewHeight,
        duration_seconds: DURATION_SECONDS,
      });
    }
  };

  // Handle play/pause with tracking
  const handlePlayPause = () => {
    const wasPlaying = session.isPlaying;
    session.togglePlayPause();
    posthog.capture(
      wasPlaying ? "editor_pause_clicked" : "editor_play_clicked",
      {
        current_frame: session.currentFrame,
        total_frames: session.totalFrames,
      }
    );
  };

  return (
    <>
      <ExamplesSidebar
        onSelectExample={handleSelectExample}
        activeExampleId={activeExampleId}
      />
      <SidebarInset>
        <div className="flex h-screen bg-[#1a1a1a] text-white">
          {/* Code Editor Panel - Left Side */}
          <div className="flex min-w-0 flex-1 flex-col border-r border-[#333]">
            <div className="flex items-center gap-2 border-b border-[#333] bg-[#252526] px-4 py-3 text-sm font-medium">
              <SidebarTrigger className="-ml-1 text-[#888] hover:text-white" />
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
            <div className="flex items-center justify-between border-b border-[#333] bg-[#252526] px-4 py-3 text-sm font-medium">
              <span>Preview</span>
              <Badge variant={session.error ? "destructive" : "secondary"}>
                {session.status}
              </Badge>
            </div>

            {/* Canvas Preview */}
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-[#0d0d0d] p-4">
              <canvas
                ref={canvasRef}
                width={session.previewWidth}
                height={session.previewHeight}
                className="max-h-full max-w-full object-contain shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
              />
            </div>

            {/* Timeline */}
            <div className="border-t border-[#333] bg-[#252526] p-4">
              <Timeline
                store={session.store}
                className="h-2 rounded"
                showTime
              />
            </div>

            {/* Controls */}
            <div className="space-y-3 border-t border-[#333] bg-[#252526] p-4">
              {session.exporting && (
                <div className="space-y-2">
                  <Progress value={session.exportProgress * 100} className="h-2" />
                  <p className="text-center text-xs text-muted-foreground">
                    Exporting... {Math.round(session.exportProgress * 100)}%
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handlePlayPause}
                  disabled={session.exporting}
                  className="flex-1"
                  size="lg"
                >
                  {session.isPlaying ? "Pause" : "Play"}
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={session.exporting || !session.template}
                  className="flex-1"
                  size="lg"
                >
                  {session.exporting ? "Exporting..." : "Export MP4"}
                </Button>
              </div>
            </div>

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
      </SidebarInset>
    </>
  );
}
