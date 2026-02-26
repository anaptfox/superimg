"use client";

import { useRef, useEffect } from "react";
import { Code, Sparkles, Eye, Video } from "lucide-react";
import { useVideoSession, VideoControls } from "superimg-react";
import type { PlayerStore } from "superimg-react";

// Step 1: Simple template - just shows the frame number (before AI edit)
const BEFORE_TEMPLATE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  render(ctx) {
    const { sceneFrame, width, height } = ctx;
    return \`
      <div style="
        width: \${width}px; height: \${height}px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex; align-items: center; justify-content: center;
        font-family: system-ui, sans-serif;
      ">
        <div style="font-size: 48px; font-weight: 700; color: white;">
          \${sceneFrame}
        </div>
      </div>
    \`;
  }
});`;

// Step 3: Enhanced template - with fade-in animation (after AI edit)
const AFTER_TEMPLATE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  render(ctx) {
    const { sceneFrame, sceneProgress, width, height, std } = ctx;
    const opacity = std.easing.easeOutQuad(Math.min(sceneProgress * 2, 1));
    const scale = 0.8 + 0.2 * std.easing.easeOutBack(Math.min(sceneProgress * 2, 1));
    return \`
      <div style="
        width: \${width}px; height: \${height}px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex; align-items: center; justify-content: center;
        font-family: system-ui, sans-serif;
      ">
        <div style="font-size: 48px; font-weight: 700; color: white;
          opacity: \${opacity}; transform: scale(\${scale});">
          \${sceneFrame}
        </div>
      </div>
    \`;
  }
});`;

const BEFORE_CODE_DISPLAY = `render(ctx) {
  const { sceneFrame } = ctx;
  return \`<div>\${sceneFrame}</div>\`;
}`;

const AFTER_CODE_DISPLAY = `render(ctx) {
  const { sceneFrame, std } = ctx;
  const opacity = std.easing
    .easeOutQuad(sceneProgress);
  return \`<div>\${sceneFrame}</div>\`;
}`;

function MiniVideoPreview({
  canvasRef,
  store,
  width = 200,
  height = 200,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  store: PlayerStore;
  width?: number;
  height?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-[#0d0d0d]">
      <div className="flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded-lg"
          style={{ width: 150, height: 150 }}
        />
      </div>
      <VideoControls store={store} showTimeline={false} />
    </div>
  );
}

export function HowItWorks() {
  const step1CanvasRef = useRef<HTMLCanvasElement>(null);
  const step3CanvasRef = useRef<HTMLCanvasElement>(null);

  const step1Session = useVideoSession({
    initialPreviewFormat: "square",
    duration: 2,
    canvasRef: step1CanvasRef,
  });

  const step3Session = useVideoSession({
    initialPreviewFormat: "square",
    duration: 2,
    canvasRef: step3CanvasRef,
  });

  useEffect(() => {
    step1Session.compile(BEFORE_TEMPLATE);
    step3Session.compile(AFTER_TEMPLATE);
  }, []);

  useEffect(() => {
    if (step1Session.template && !step1Session.isPlaying) {
      step1Session.play();
    }
  }, [step1Session.template]);

  useEffect(() => {
    if (step3Session.template && !step3Session.isPlaying) {
      step3Session.play();
    }
  }, [step3Session.template]);

  const steps = [
    {
      number: "1",
      title: "Write a template",
      description: "HTML/CSS with JavaScript logic",
      icon: Code,
      color: "text-blue-400",
      content: (
        <div className="rounded-lg border border-border/50 bg-[var(--code-bg)] p-3 text-left">
          <pre className="text-xs leading-relaxed text-[var(--code-foreground)]">
            <code>{BEFORE_CODE_DISPLAY}</code>
          </pre>
        </div>
      ),
      video: <MiniVideoPreview canvasRef={step1CanvasRef} store={step1Session.store} />,
    },
    {
      number: "2",
      title: "Edit with AI",
      description: "Add capabilities with a single command",
      icon: Sparkles,
      color: "text-purple-400",
      content: (
        <div className="rounded-lg border border-border/50 bg-[var(--code-bg)] p-3 text-left">
          <code className="text-sm text-[var(--code-foreground)]">
            superimg add skill
          </code>
        </div>
      ),
      video: null,
    },
    {
      number: "3",
      title: "Preview instantly",
      description: "See changes in real-time",
      icon: Eye,
      color: "text-green-400",
      content: (
        <div className="rounded-lg border border-border/50 bg-[var(--code-bg)] p-3 text-left">
          <pre className="text-xs leading-relaxed text-[var(--code-foreground)]">
            <code>{AFTER_CODE_DISPLAY}</code>
          </pre>
        </div>
      ),
      video: <MiniVideoPreview canvasRef={step3CanvasRef} store={step3Session.store} />,
    },
    {
      number: "4",
      title: "Export to MP4",
      description: "Production-ready video",
      icon: Video,
      color: "text-orange-400",
      content: (
        <div className="rounded-lg border border-border/50 bg-[var(--code-bg)] p-3 text-left">
          <code className="text-sm text-[var(--code-foreground)]">
            npx superimg render -o video.mp4
          </code>
        </div>
      ),
      video: null,
    },
  ];

  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="grid items-center gap-6 rounded-xl border border-border/30 bg-muted/10 p-5 sm:grid-cols-2"
            >
              {/* Left: Step info + content */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50">
                    <step.icon className={`h-4 w-4 ${step.color}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                {step.content}
              </div>

              {/* Right: Video preview */}
              <div className="flex justify-center">
                {step.video}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
