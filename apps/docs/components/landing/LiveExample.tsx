"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useVideoSession, VideoControls } from "superimg-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Code, Play } from "lucide-react";

const TEMPLATE_CODE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  render(ctx) {
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
  },
});`;

export function LiveExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [code, setCode] = useState(TEMPLATE_CODE);

  const session = useVideoSession({
    initialPreviewFormat: "horizontal",
    duration: 6,
    canvasRef,
  });

  useEffect(() => {
    session.compile(code);
  }, []);

  useEffect(() => {
    if (session.template && !session.isPlaying) {
      session.play();
    }
  }, [session.template]);

  const handleCodeChange = (value: string) => {
    setCode(value);
    session.compile(value);
  };

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
            {/* Editable Code */}
            <div className="border-b border-border/50 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2 border-b border-border/50 bg-[#252526] px-4 py-2 text-sm font-medium text-muted-foreground">
                <Code className="h-3 w-3" />
                template.ts
              </div>
              <CodeMirror
                value={code}
                height="360px"
                theme={oneDark}
                extensions={[javascript({ typescript: true })]}
                onChange={handleCodeChange}
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
                Preview
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
              {/* Playback Controls */}
              <div className="border-t border-border/50">
                <VideoControls store={session.store} showTime />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href="/editor">Open Full Editor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
