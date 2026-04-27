import { defineScene, type RenderContext } from "superimg";

export interface ClaudeCodeStep {
  label: string;
  detail: string;
  kind: "read" | "edit" | "test" | "done";
}

export interface ClaudeCodeData extends Record<string, unknown> {
  projectName: string;
  cwd: string;
  branch: string;
  prompt: string;
  summary: string;
  steps: ClaudeCodeStep[];
  theme: "dark" | "warm";
  showHeader: boolean;
}

const THEME = {
  dark: {
    page: "#101014",
    terminal: "#1b1b1d",
    chrome: "#2a2a2c",
    border: "rgba(255,255,255,0.09)",
    text: "#ece7df",
    muted: "#8e8982",
    dim: "#625d58",
    prompt: "#d97757",
    green: "#8ccf7e",
    blue: "#7da8ff",
    yellow: "#e9c46a",
    red: "#ff6b6b",
    panel: "#232326",
  },
  warm: {
    page: "#191612",
    terminal: "#211d19",
    chrome: "#302a24",
    border: "rgba(255,244,230,0.1)",
    text: "#f4eadc",
    muted: "#a69a8a",
    dim: "#6f6458",
    prompt: "#e07a5f",
    green: "#98c379",
    blue: "#89b4fa",
    yellow: "#e5c07b",
    red: "#e06c75",
    panel: "#2b251f",
  },
};

const SCORE = {
  intro: 0.1,
  prompt: 0.24,
  working: 0.42,
  summary: 0.18,
  outro: 0.06,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default defineScene<ClaudeCodeData>({
  data: {
    projectName: "acme-dashboard",
    cwd: "~/src/acme-dashboard",
    branch: "feature/shortcuts",
    prompt: "add keyboard shortcuts to the command palette and cover them with tests",
    summary: "Implemented shortcut handling, updated command palette copy, and added focused keyboard tests.",
    steps: [
      { kind: "read", label: "Read", detail: "src/components/CommandPalette.tsx" },
      { kind: "read", label: "Read", detail: "src/hooks/use-command-palette.ts" },
      { kind: "edit", label: "Edit", detail: "src/components/CommandPalette.tsx" },
      { kind: "edit", label: "Edit", detail: "src/hooks/use-hotkeys.ts" },
      { kind: "test", label: "Run", detail: "pnpm test command-palette" },
      { kind: "done", label: "Done", detail: "2 files changed, 6 tests passed" },
    ],
    theme: "dark",
    showHeader: true,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 8.5,
  },
  render(ctx: RenderContext<ClaudeCodeData>) {
    const { std, width, height, data } = ctx;
    const {
      projectName,
      cwd,
      branch,
      prompt,
      summary,
      steps,
      theme,
      showHeader,
    } = data;

    const colors = THEME[theme] ?? THEME.dark;
    const score = std.score(SCORE);
    const intro = score.motion({ during: "intro", y: 26, scale: 0.985, exit: false });
    const promptProgress = score.within("prompt");
    const workingProgress = score.within("working");
    const summaryProgress = score.within("summary");
    const outroOpacity = score.active === "outro" ? 1 - score.within("outro") : 1;

    const terminalWidth = Math.min(width - 180, 1260);
    const terminalHeight = Math.min(height - 180, 720);
    const baseFontSize = Math.min(width, height) * 0.021;
    const chromeHeight = showHeader ? 44 : 0;
    const panelWidth = 340;
    const bodyPadding = 28;
    const lineHeight = 1.48;

    const safePrompt = escapeHtml(prompt);
    const safeSummary = escapeHtml(summary);
    const visiblePromptChars = Math.floor(std.clamp01(promptProgress / 0.78) * safePrompt.length);
    const promptDone = promptProgress >= 0.82 || score.active === "working" || score.active === "summary" || score.active === "outro";
    const displayPrompt = promptDone ? safePrompt : safePrompt.slice(0, visiblePromptChars);
    const promptCursor = promptDone ? "" : '<span class="cursor">&nbsp;</span>';

    const thinkingOpacity = score.active === "working"
      ? std.interpolate(workingProgress, [0, 0.18, 0.86, 1], [0, 1, 1, 0], "linear")
      : 0;
    const thinkingDots = ".".repeat(Math.floor((workingProgress * 18) % 4));

    const stepWindow = std.clamp01((workingProgress - 0.1) / 0.78);
    const visibleSteps = Math.min(steps.length, Math.floor(stepWindow * steps.length) + (stepWindow > 0 ? 1 : 0));

    const kindColor = {
      read: colors.blue,
      edit: colors.yellow,
      test: colors.prompt,
      done: colors.green,
    } as const;

    let stepHtml = "";
    for (let i = 0; i < visibleSteps; i++) {
      const step = steps[i]!;
      const local = std.clamp01(stepWindow * steps.length - i);
      const opacity = std.interpolate(local, [0, 1], [0, 1], "easeOutCubic");
      const y = std.interpolate(local, [0, 1], [8, 0], "easeOutCubic");
      stepHtml += `
        <div class="step" style="opacity:${opacity}; transform:translateY(${y}px);">
          <span class="tag" style="color:${kindColor[step.kind]}; border-color:${kindColor[step.kind]}55;">${step.label}</span>
          <span class="path">${escapeHtml(step.detail)}</span>
        </div>
      `;
    }

    const summaryReveal = std.clamp01(summaryProgress / 0.62);
    const visibleSummaryChars = Math.floor(summaryReveal * safeSummary.length);
    const displaySummary = score.active === "summary" || score.active === "outro"
      ? safeSummary.slice(0, visibleSummaryChars)
      : "";
    const showSummaryCursor = score.active === "summary" && summaryReveal < 1;

    const metricsProgress = score.active === "summary" || score.active === "outro"
      ? std.interpolate(summaryProgress, [0.35, 0.8], [0, 1], "easeOutCubic")
      : 0;

    const planRows = [
      ["[x]", "Inspect command palette wiring"],
      [visibleSteps >= 4 ? "[x]" : "[ ]", "Patch shortcut handling"],
      [visibleSteps >= 5 ? "[x]" : "[ ]", "Run focused tests"],
    ].map(([mark, text], i) => {
      const active = (i === 0 && visibleSteps >= 1) || (i === 1 && visibleSteps >= 4) || (i === 2 && visibleSteps >= 5);
      return `<div class="plan-row" style="color:${active ? colors.text : colors.dim};"><span>${mark}</span><span>${text}</span></div>`;
    }).join("");

    const fileRows = [
      "src/components/CommandPalette.tsx",
      "src/hooks/use-hotkeys.ts",
      "src/hooks/use-command-palette.ts",
      "tests/command-palette.test.ts",
    ].map((file, i) => {
      const isTouched = visibleSteps > i + 1;
      return `<div class="file-row" style="color:${isTouched ? colors.text : colors.dim};">${escapeHtml(file)}</div>`;
    }).join("");

    const setupLines = [
      `<span class="muted">$</span> claude`,
      `<span class="brand">Claude Code</span> <span class="muted">in ${escapeHtml(cwd)}</span>`,
      `<span class="muted">branch:</span> ${escapeHtml(branch)}`,
      "",
    ].join("\n");

    return `
      <style>
        @keyframes blink { 0%, 52% { opacity: 1; } 53%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        * { box-sizing: border-box; }
        .mono {
          font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
          font-variant-ligatures: none;
          -webkit-font-smoothing: antialiased;
        }
        .cursor {
          display:inline-block;
          width:0.62em;
          height:1.05em;
          margin-left:2px;
          background:${colors.text};
          opacity:0.82;
          animation:blink 1s steps(1, end) infinite;
          vertical-align:-0.12em;
        }
        .muted { color:${colors.muted}; }
        .brand { color:${colors.prompt}; font-weight:700; }
        .step {
          display:flex;
          align-items:center;
          gap:12px;
          min-height:${baseFontSize * 1.65}px;
        }
        .tag {
          width:58px;
          padding:3px 7px;
          border:1px solid;
          border-radius:5px;
          text-align:center;
          font-size:${baseFontSize * 0.58}px;
          text-transform:uppercase;
        }
        .path { color:${colors.text}; }
        .panel-title {
          color:${colors.muted};
          font-size:${baseFontSize * 0.62}px;
          text-transform:uppercase;
          letter-spacing:0.08em;
          margin-bottom:12px;
        }
        .plan-row, .file-row {
          display:flex;
          gap:10px;
          min-height:${baseFontSize * 1.28}px;
          font-size:${baseFontSize * 0.72}px;
          line-height:1.35;
        }
      </style>
      <div class="mono" style="
        width:${width}px;
        height:${height}px;
        background:
          radial-gradient(circle at 50% 18%, rgba(217,119,87,0.12), transparent 34%),
          linear-gradient(180deg, ${colors.page} 0%, #0c0c10 100%);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:70px;
        color:${colors.text};
      ">
        <div style="
          width:${terminalWidth}px;
          height:${terminalHeight}px;
          background:${colors.terminal};
          border:1px solid ${colors.border};
          border-radius:10px;
          overflow:hidden;
          box-shadow:0 28px 70px rgba(0,0,0,0.48);
          opacity:${intro.opacity * outroOpacity};
          ${intro.style}
        ">
          ${showHeader ? `
            <div style="
              height:${chromeHeight}px;
              background:${colors.chrome};
              border-bottom:1px solid ${colors.border};
              display:flex;
              align-items:center;
              padding:0 18px;
              gap:10px;
            ">
              <div style="display:flex;gap:8px;">
                <div style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></div>
                <div style="width:12px;height:12px;border-radius:50%;background:#ffbd2e;"></div>
                <div style="width:12px;height:12px;border-radius:50%;background:#28c840;"></div>
              </div>
              <div style="flex:1;text-align:center;color:${colors.muted};font-size:14px;">${escapeHtml(projectName)} - claude</div>
            </div>
          ` : ""}
          <div style="
            height:${terminalHeight - chromeHeight}px;
            display:grid;
            grid-template-columns:1fr ${panelWidth}px;
          ">
            <main style="
              padding:${bodyPadding}px;
              border-right:1px solid ${colors.border};
              overflow:hidden;
              font-size:${baseFontSize}px;
              line-height:${lineHeight};
            ">
              <pre style="margin:0 0 ${baseFontSize * 0.55}px;white-space:pre-wrap;color:${colors.text};font:inherit;line-height:inherit;">${setupLines}</pre>
              <div style="margin-bottom:${baseFontSize * 0.7}px;">
                <span style="color:${colors.prompt};">></span>
                <span> ${displayPrompt}${promptCursor}</span>
              </div>
              ${thinkingOpacity > 0 ? `
                <div style="opacity:${thinkingOpacity}; color:${colors.muted}; margin-bottom:${baseFontSize * 0.55}px;">
                  Thinking${thinkingDots}<span style="animation:pulse 1s ease-in-out infinite;">_</span>
                </div>
              ` : ""}
              <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:${baseFontSize * 0.9}px;">
                ${stepHtml}
              </div>
              ${displaySummary ? `
                <div style="margin-top:${baseFontSize * 0.5}px;">
                  <span class="brand">Claude:</span>
                  <span> ${displaySummary}${showSummaryCursor ? '<span class="cursor">&nbsp;</span>' : ""}</span>
                </div>
              ` : ""}
            </main>
            <aside style="
              padding:${bodyPadding}px ${bodyPadding * 0.85}px;
              background:${colors.panel};
              font-size:${baseFontSize * 0.78}px;
              line-height:1.45;
            ">
              <div class="panel-title">Session</div>
              <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin-bottom:${baseFontSize * 1.35}px;">
                <span class="muted">cwd</span><span>${escapeHtml(cwd)}</span>
                <span class="muted">model</span><span>Claude Sonnet 4.5</span>
                <span class="muted">mode</span><span>interactive CLI</span>
              </div>

              <div class="panel-title">Plan</div>
              <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:${baseFontSize * 1.35}px;">
                ${planRows}
              </div>

              <div class="panel-title">Touched Files</div>
              <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:${baseFontSize * 1.35}px;">
                ${fileRows}
              </div>

              <div class="panel-title">Result</div>
              <div style="
                border:1px solid ${colors.border};
                border-radius:7px;
                padding:14px;
                color:${metricsProgress > 0 ? colors.green : colors.dim};
                opacity:${0.35 + metricsProgress * 0.65};
              ">
                tests ${metricsProgress >= 1 ? "passed" : "pending"}<br>
                edits ${metricsProgress >= 1 ? "applied" : "queued"}<br>
                ready ${metricsProgress >= 1 ? "for review" : "soon"}
              </div>
            </aside>
          </div>
        </div>
      </div>
    `;
  },
});
