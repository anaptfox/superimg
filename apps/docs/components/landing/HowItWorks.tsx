"use client";

import { useRef, useEffect } from "react";
import { Code, Sparkles, Eye, Video } from "lucide-react";
import { useVideoSession, VideoControls } from "superimg-react";
import type { PlayerStore } from "superimg-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

// Step 1: Simple countdown template (before AI edit)
const BEFORE_TEMPLATE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  render(ctx) {
    const { sceneFrame, fps, width, height, std } = ctx;
    const count = Math.max(1, 5 - Math.floor(sceneFrame / fps));
    const bgStyle = std.css({ width, height, background: "linear-gradient(135deg, #1e1e2e, #2d2d44)", fontFamily: "system-ui, sans-serif" }) + ";" + std.css.center();
    return \`
      <div style="\${bgStyle}">
        <div style="\${std.css({ fontSize: 180, fontWeight: 800, color: 'white', textShadow: '0 4px 20px rgba(0,0,0,0.5)' })}">
          \${count}
        </div>
      </div>
    \`;
  }
});`;

// Step 3: Enhanced countdown - with pulse animation (after AI edit)
const AFTER_TEMPLATE = `import { defineTemplate } from "superimg";

export default defineTemplate({
  render(ctx) {
    const { sceneFrame, fps, width, height, std } = ctx;
    const count = Math.max(1, 5 - Math.floor(sceneFrame / fps));
    const showGo = Math.floor(sceneFrame / fps) >= 5;
    const fraction = (sceneFrame % fps) / fps;
    const pulse = std.tween(1.2, 1, fraction, "easeOutCubic");
    const glow = std.tween(0.8, 0.2, fraction, "easeOutCubic");
    const bgStyle = std.css({ width, height, background: "linear-gradient(135deg, #1e1e2e, #2d2d44)", fontFamily: "system-ui, sans-serif" }) + ";" + std.css.center();
    const numStyle = std.css({ fontSize: 180, fontWeight: 800, color: "white", transform: "scale(" + pulse + ")", textShadow: "0 0 " + (40 * glow) + "px rgba(102,126,234," + glow + ")" });
    return \`
      <div style="\${bgStyle}">
        <div style="\${numStyle}">\${showGo ? "GO!" : count}</div>
      </div>
    \`;
  }
});`;

const BEFORE_CODE_DISPLAY = `render(ctx) {
  const { sceneFrame, fps } = ctx;
  const count = 5 - Math.floor(sceneFrame / fps);
  return \`<div>\${count}</div>\`;
}`;

const AFTER_CODE_DISPLAY = `render(ctx) {
  const { sceneFrame, fps, std } = ctx;
  const count = 5 - Math.floor(sceneFrame / fps);
  const pulse = std.tween(1.2, 1, fraction, 'easeOutCubic');
  const s = std.css({
    transform: 'scale(' + pulse + ')'
  });
  return \`<div style="\${s}">\${count}</div>\`;
}`;

function MiniVideoPreview({
  containerRef,
  store,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  store: PlayerStore;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-[#0d0d0d]">
      <div className="flex items-center justify-center p-4">
        <div
          ref={containerRef}
          className="rounded-lg"
          style={{ width: 150, height: 150 }}
        />
      </div>
      <VideoControls store={store} showTimeline={false} />
    </div>
  );
}

export function HowItWorks() {
  const step1ContainerRef = useRef<HTMLDivElement>(null);
  const step3ContainerRef = useRef<HTMLDivElement>(null);

  const step1Session = useVideoSession({
    initialFormat: "square",
    duration: 2,
    containerRef: step1ContainerRef,
  });

  const step3Session = useVideoSession({
    initialFormat: "square",
    duration: 2,
    containerRef: step3ContainerRef,
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
        <div className="overflow-hidden rounded-lg border border-border/50 bg-[var(--code-bg)]">
          <CodeMirror
            value={BEFORE_CODE_DISPLAY}
            theme={oneDark}
            extensions={[javascript({ typescript: true })]}
            readOnly
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
            }}
            className="text-xs [&_.cm-editor]:!bg-transparent"
          />
        </div>
      ),
      video: <MiniVideoPreview containerRef={step1ContainerRef} store={step1Session.store} />,
    },
    {
      number: "2",
      title: "Edit with AI",
      description: "Add capabilities with a single command",
      icon: Sparkles,
      color: "text-purple-400",
      content: (
        <div className="rounded-lg border border-border/50 bg-[var(--code-bg)] p-3 text-left font-mono">
          <code className="text-sm text-[var(--code-foreground)]">
            <span className="select-none text-muted-foreground">$ </span>
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
        <div className="overflow-hidden rounded-lg border border-border/50 bg-[var(--code-bg)]">
          <CodeMirror
            value={AFTER_CODE_DISPLAY}
            theme={oneDark}
            extensions={[javascript({ typescript: true })]}
            readOnly
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
            }}
            className="text-xs [&_.cm-editor]:!bg-transparent"
          />
        </div>
      ),
      video: <MiniVideoPreview containerRef={step3ContainerRef} store={step3Session.store} />,
    },
    {
      number: "4",
      title: "Export or embed",
      description: "Render to MP4 or embed with React",
      icon: Video,
      color: "text-orange-400",
      content: (
        <div className="space-y-2">
          <div className="rounded-lg border border-border/50 bg-[var(--code-bg)] p-3 text-left font-mono">
            <code className="text-sm text-[var(--code-foreground)]">
              <span className="select-none text-muted-foreground">$ </span>
              npx superimg render -o video.mp4
            </code>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/50 bg-[var(--code-bg)]">
            <CodeMirror
              value={'<Player template={template} />'}
              theme={oneDark}
              extensions={[javascript({ jsx: true, typescript: true })]}
              readOnly
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
              className="text-sm [&_.cm-editor]:!bg-transparent"
            />
          </div>
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
