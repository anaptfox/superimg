"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { useVideoSession } from "superimg-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { MessageSquare, Code, Play } from "lucide-react";

const AI_PROMPT = `Create a countdown timer video that counts down from 5 to 1,
then shows "GO!" at the end. Use a dark gradient background
with large white numbers.`;

const GENERATED_CODE = `export function render(ctx) {
  const { sceneFrame, fps, width, height } = ctx;
  const second = Math.floor(sceneFrame / fps);
  const count = Math.max(1, 5 - second);
  const showGo = second >= 5;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(135deg, #1e1e2e, #2d2d44);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
    ">
      <div style="
        font-size: 180px;
        font-weight: 800;
        color: white;
        text-shadow: 0 4px 20px rgba(0,0,0,0.5);
      ">\${showGo ? 'GO!' : count}</div>
    </div>
  \`;
}`;

export function LiveExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const session = useVideoSession({
    initialPreviewFormat: "horizontal",
    duration: 6,
    canvasRef,
  });

  useEffect(() => {
    session.compile(GENERATED_CODE);
  }, []);

  useEffect(() => {
    if (session.template && !session.isPlaying) {
      session.play();
    }
  }, [session.template]);

  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See it in action
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Describe what you want. AI writes the code. Preview instantly.
          </p>
        </div>

        {/* Three step flow */}
        <div className="mb-8 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-400" />
            <span>Prompt</span>
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-purple-400" />
            <span>Code</span>
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-green-400" />
            <span>Video</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-[#1a1a1a] shadow-2xl">
          {/* Prompt Section */}
          <div className="border-b border-border/50 bg-[#252526] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              Your prompt to AI
            </div>
            <p className="text-sm italic text-foreground/80">
              "{AI_PROMPT}"
            </p>
          </div>

          <div className="grid md:grid-cols-2">
            {/* Generated Code */}
            <div className="border-b border-border/50 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-sm font-medium text-muted-foreground">
                <Code className="h-3 w-3" />
                AI generates this code
              </div>
              <CodeMirror
                value={GENERATED_CODE}
                height="280px"
                theme={oneDark}
                extensions={[javascript({ typescript: true })]}
                editable={false}
                className="text-sm"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                }}
              />
            </div>

            {/* Video Preview */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-sm font-medium text-muted-foreground">
                <Play className="h-3 w-3" />
                Video output
              </div>
              <div className="flex flex-1 items-center justify-center bg-[#0d0d0d] p-4">
                <canvas
                  ref={canvasRef}
                  width={session.previewWidth}
                  height={session.previewHeight}
                  className="max-h-full max-w-full rounded shadow-lg"
                  style={{ aspectRatio: "16/9" }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href="/editor">Try in Editor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
