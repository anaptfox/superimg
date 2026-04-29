import { defineScene, type RenderContext } from "superimg";

export interface ClaudeCodeFeedPart {
  text: string;
  tone?: "normal" | "muted" | "blue" | "bold" | "accent";
}

export interface ClaudeCodeFeedLine {
  bullet: "green" | "white";
  parts: ClaudeCodeFeedPart[];
}

export interface ClaudeCodeCommand {
  command: string;
  description: string;
}

export interface ClaudeCodeData extends Record<string, unknown> {
  userName: string;
  version: string;
  modelLine: string;
  cwd: string;
  prompt: string;
  finalMessage: string;
  tips: string[];
  recentActivity: string[];
  commands: ClaudeCodeCommand[];
  feed: ClaudeCodeFeedLine[];
  theme: "dark" | "warm";
}

const THEME = {
  dark: {
    page: "#171717",
    terminal: "#050505",
    chrome: "#252525",
    chromeBorder: "#3a3a3a",
    border: "#e0704d",
    borderDim: "rgba(224,112,77,0.78)",
    text: "#f2f2f0",
    muted: "#9d9d9d",
    dim: "#656565",
    prompt: "#e0704d",
    green: "#00c875",
    blue: "#a7adff",
    rule: "#474747",
    input: "#0b0b0b",
  },
  warm: {
    page: "#18120e",
    terminal: "#0a0705",
    chrome: "#302721",
    chromeBorder: "#493b32",
    border: "#eb7c54",
    borderDim: "rgba(235,124,84,0.78)",
    text: "#f5ede5",
    muted: "#aaa29a",
    dim: "#716a63",
    prompt: "#eb7c54",
    green: "#8ed26f",
    blue: "#b8bcff",
    rule: "#5b524b",
    input: "#100c09",
  },
};

const SCORE = {
  intro: 0.08,
  welcome: 0.18,
  prompt: 0.25,
  work: 0.35,
  final: 0.1,
  outro: 0.04,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function claudeMark(color: string, cellSize: number): string {
  const rows = [
    "00111100",
    "01111110",
    "11011011",
    "11111111",
    "01111110",
    "01011010",
  ];

  return `
    <div class="claude-mark" style="grid-template-columns:repeat(8, ${cellSize}px);grid-auto-rows:${cellSize}px;">
      ${rows.map((row) => Array.from(row).map((cell) => (
        `<span style="background:${cell === "1" ? color : "transparent"};"></span>`
      )).join("")).join("")}
    </div>
  `;
}

export default defineScene<ClaudeCodeData>({
  data: {
    userName: "Andrew",
    version: "2.0.33",
    modelLine: "Sonnet 4.5 - Claude Max",
    cwd: "C:\\Users\\Andrew\\Documents\\AI\\CCApps",
    prompt: "Show me the code path for keyboard shortcuts in the command palette, then patch the handler and add focused tests.",
    finalMessage: "Updated the shortcut handler, tightened command palette copy, and added focused keyboard tests.",
    tips: [
      "Run /init to create a CLAUDE.md file with instructions for Claude",
      "Run /terminal-setup-hotkey to tag Claude right from your status bar",
    ],
    recentActivity: [
      "No recent activity",
    ],
    commands: [
      { command: "/add-dir", description: "Add a new working directory" },
      { command: "/agents", description: "Manage agent configurations" },
      { command: "/hooks", description: "List and manage hooks" },
      { command: "/init", description: "Initialize a new CLAUDE.md file to add context" },
      { command: "/compact", description: "Clear conversation history but keep a summary in context" },
    ],
    feed: [
      {
        bullet: "green",
        parts: [
          { text: "Searched for " },
          { text: "2", tone: "bold" },
          { text: " patterns, read " },
          { text: "3", tone: "bold" },
          { text: " files " },
          { text: "(ctrl+o to expand)", tone: "muted" },
        ],
      },
      {
        bullet: "white",
        parts: [
          { text: "Now let me trace the " },
          { text: "command-palette", tone: "blue" },
          { text: " package - specifically " },
          { text: "registerShortcut", tone: "blue" },
          { text: " and " },
          { text: "handleKeydown", tone: "blue" },
          { text: "." },
        ],
      },
      {
        bullet: "green",
        parts: [
          { text: "Searched for " },
          { text: "3", tone: "bold" },
          { text: " patterns, read " },
          { text: "2", tone: "bold" },
          { text: " files " },
          { text: "(ctrl+o to expand)", tone: "muted" },
        ],
      },
      {
        bullet: "white",
        parts: [
          { text: "Edited " },
          { text: "src/components/CommandPalette.tsx", tone: "blue" },
          { text: " and " },
          { text: "src/hooks/use-hotkeys.ts", tone: "blue" },
          { text: "." },
        ],
      },
      {
        bullet: "green",
        parts: [
          { text: "Ran " },
          { text: "pnpm test command-palette", tone: "bold" },
          { text: " - " },
          { text: "6 tests passed", tone: "bold" },
        ],
      },
    ],
    theme: "dark",
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
      userName,
      version,
      modelLine,
      cwd,
      prompt,
      finalMessage,
      tips,
      recentActivity,
      commands,
      feed,
      theme,
    } = data;

    const colors = THEME[theme] ?? THEME.dark;
    const score = std.score(SCORE);
    const intro = score.motion({ during: "intro", y: 22, scale: 0.992, exit: false });
    const welcomeProgress = score.within("welcome");
    const promptProgress = score.within("prompt");
    const workProgress = score.within("work");
    const finalProgress = score.within("final");
    const outroOpacity = score.active === "outro" ? 1 - score.within("outro") : 1;
    const isSubmitted = score.active === "work" || score.active === "final" || score.active === "outro";

    const terminalWidth = Math.min(width - 260, 1540);
    const terminalHeight = Math.min(height - 150, 860);
    const baseFontSize = Math.min(width, height) * 0.0175;
    const titleBarHeight = baseFontSize * 1.9;
    const viewportHeight = terminalHeight - titleBarHeight;
    const contentPadding = baseFontSize * 0.98;
    const welcomeHeight = baseFontSize * 15.1;
    const commandTop = contentPadding + welcomeHeight + baseFontSize * 1.22;
    const inputHeight = baseFontSize * 2.05;
    const footerHeight = baseFontSize * 1.28;
    const composerHeight = inputHeight + footerHeight;

    const promptReveal = score.active === "prompt" || score.active === "work" || score.active === "final" || score.active === "outro"
      ? std.clamp01(promptProgress / 0.84)
      : 0;
    const startupOpacity = isSubmitted ? 0 : 1;
    const feedTop = contentPadding;
    const promptDone = isSubmitted || promptProgress > 0.92;
    const displayPrompt = escapeHtml(prompt.slice(0, Math.floor((promptDone ? 1 : promptReveal) * prompt.length)));
    const promptCursor = promptDone ? "" : '<span class="cursor">&nbsp;</span>';

    const workWindow = std.clamp01((workProgress - 0.08) / 0.84);
    const feedCursor = workWindow * feed.length;
    const finalReveal = score.active === "final" || score.active === "outro"
      ? std.clamp01(finalProgress / 0.74)
      : 0;
    const finalText = escapeHtml(finalMessage.slice(0, Math.floor(finalReveal * finalMessage.length)));
    const finalCursor = score.active === "final" && finalReveal < 1 ? '<span class="cursor">&nbsp;</span>' : "";
    const feedScroll = 0;

    const toneStyle = {
      normal: `color:${colors.text};font-weight:400;`,
      muted: `color:${colors.muted};font-weight:400;`,
      blue: `color:${colors.blue};font-weight:400;`,
      bold: `color:${colors.text};font-weight:800;`,
      accent: `color:${colors.prompt};font-weight:700;`,
    } as const;

    const renderParts = (parts: ClaudeCodeFeedPart[], maxChars = Number.POSITIVE_INFINITY) => {
      let remaining = maxChars;
      let html = "";

      for (const part of parts) {
        if (remaining <= 0) break;
        const chunk = part.text.slice(0, Math.floor(remaining));
        html += `<span style="${toneStyle[part.tone ?? "normal"]}">${escapeHtml(chunk)}</span>`;
        remaining -= chunk.length;
      }

      return html;
    };

    const commandRows = commands.map((item) => `
      <div class="command-row">
        <span class="slash">${escapeHtml(item.command)}</span>
        <span>${escapeHtml(item.description)}</span>
      </div>
    `).join("");

    const tipRows = tips.map((tip, index) => {
      const label = index === 0 ? "Run" : "Run";
      return `<div class="info-line"><span>${label}</span> ${escapeHtml(tip.replace(/^Run /, ""))}</div>`;
    }).join("");

    const activityRows = recentActivity.map((item) => (
      `<div class="info-line">${escapeHtml(item)}</div>`
    )).join("");

    const feedRows = feed.map((line, index) => {
      const local = feedCursor - index;
      if (local <= 0) return "";

      const bulletColor = line.bullet === "green" ? colors.green : colors.text;
      const totalChars = line.parts.reduce((sum, part) => sum + part.text.length, 0);
      const visibleChars = Math.min(totalChars, Math.floor(std.clamp01(local / 0.82) * totalChars));
      if (visibleChars <= 0) return "";

      return `
        <div class="feed-row">
          <span class="bullet" style="background:${bulletColor};box-shadow:0 0 ${baseFontSize * 0.75}px ${bulletColor}44;"></span>
          <span class="feed-text">${renderParts(line.parts, visibleChars)}</span>
        </div>
      `;
    }).join("");

    return `
      <style>
        @keyframes blink { 0%, 52% { opacity: 1; } 53%, 100% { opacity: 0; } }
        * { box-sizing: border-box; }
        .mono {
          font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
          font-variant-ligatures:none;
          -webkit-font-smoothing:antialiased;
          letter-spacing:0;
        }
        .cursor {
          display:inline-block;
          width:0.58em;
          height:1.05em;
          margin-left:2px;
          background:${colors.text};
          opacity:0.9;
          animation:blink 1s steps(1, end) infinite;
          vertical-align:-0.13em;
        }
        .claude-mark {
          display:grid;
          justify-content:center;
          margin:${baseFontSize * 1.22}px auto ${baseFontSize}px;
        }
        .claude-mark span { display:block; }
        .panel-heading {
          color:${colors.prompt};
          font-weight:700;
          font-size:${baseFontSize * 0.73}px;
          margin-bottom:${baseFontSize * 0.24}px;
        }
        .info-line {
          color:${colors.text};
          font-size:${baseFontSize * 0.52}px;
          line-height:1.24;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .info-line span { color:${colors.muted}; }
        .command-row {
          display:grid;
          grid-template-columns:${baseFontSize * 8.8}px 1fr;
          gap:${baseFontSize * 1.05}px;
          color:${colors.muted};
          font-size:${baseFontSize * 0.54}px;
          line-height:1.38;
          min-height:${baseFontSize * 0.78}px;
        }
        .slash { color:${colors.text}; }
        .feed-row {
          display:grid;
          grid-template-columns:${baseFontSize * 0.86}px 1fr;
          gap:${baseFontSize * 0.46}px;
          align-items:start;
          margin-bottom:${baseFontSize * 0.92}px;
          font-size:${baseFontSize * 0.88}px;
          line-height:1.25;
        }
        .bullet {
          width:${baseFontSize * 0.42}px;
          height:${baseFontSize * 0.42}px;
          border-radius:50%;
          margin-top:${baseFontSize * 0.32}px;
        }
        .feed-text {
          display:block;
          overflow-wrap:anywhere;
        }
      </style>
      <div class="mono" style="
        width:${width}px;
        height:${height}px;
        background:
          linear-gradient(180deg, ${colors.page} 0%, #101010 100%);
        color:${colors.text};
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <main style="
          width:${terminalWidth}px;
          height:${terminalHeight}px;
          position:relative;
          background:${colors.terminal};
          border:1px solid ${colors.chromeBorder};
          border-radius:7px;
          overflow:hidden;
          box-shadow:0 26px 80px rgba(0,0,0,0.52);
          opacity:${intro.opacity * outroOpacity};
          ${intro.style}
        ">
          <div style="
            height:${titleBarHeight}px;
            background:${colors.chrome};
            border-bottom:1px solid ${colors.chromeBorder};
            display:grid;
            grid-template-columns:auto 1fr auto;
            align-items:center;
            gap:${baseFontSize * 0.75}px;
            padding:0 ${baseFontSize * 0.72}px;
            color:${colors.muted};
            font-size:${baseFontSize * 0.58}px;
          ">
            <div style="display:flex;gap:${baseFontSize * 0.36}px;">
              <span style="width:${baseFontSize * 0.46}px;height:${baseFontSize * 0.46}px;border-radius:50%;background:#ff5f57;"></span>
              <span style="width:${baseFontSize * 0.46}px;height:${baseFontSize * 0.46}px;border-radius:50%;background:#ffbd2e;"></span>
              <span style="width:${baseFontSize * 0.46}px;height:${baseFontSize * 0.46}px;border-radius:50%;background:#28c840;"></span>
            </div>
            <div style="text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              andrew@workstation: ~/acme-dashboard - claude
            </div>
            <div style="color:${colors.dim};">132x38</div>
          </div>
          <div style="
            position:relative;
            height:${viewportHeight}px;
            background:${colors.terminal};
            overflow:hidden;
          ">
          <section style="
            position:absolute;
            top:${contentPadding}px;
            left:${contentPadding}px;
            right:${contentPadding}px;
            height:${welcomeHeight}px;
            border:1px solid ${colors.border};
            display:grid;
            grid-template-columns:47% 53%;
            opacity:${std.interpolate(welcomeProgress, [0, 0.35, 1], [0.72, 1, 1], "easeOutCubic") * startupOpacity};
          ">
            <div style="
              position:absolute;
              top:-${baseFontSize * 0.64}px;
              left:${baseFontSize * 2.3}px;
              padding:0 ${baseFontSize * 0.86}px;
              background:${colors.terminal};
              color:${colors.prompt};
              font-size:${baseFontSize * 0.7}px;
              line-height:1;
              white-space:nowrap;
            ">
              Claude Code <span style="color:${colors.muted};">v${escapeHtml(version)}</span>
            </div>

            <div style="
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              text-align:center;
              padding:${baseFontSize}px;
            ">
              <div style="font-size:${baseFontSize * 0.56}px;margin-bottom:${baseFontSize * 0.45}px;">Welcome back ${escapeHtml(userName)}!</div>
              ${claudeMark(colors.prompt, baseFontSize * 0.34)}
              <div style="color:${colors.muted};font-size:${baseFontSize * 0.55}px;line-height:1.42;">
                ${escapeHtml(modelLine)}<br>
                ${escapeHtml(cwd)}
              </div>
            </div>

            <div style="
              display:grid;
              grid-template-rows:52% 48%;
              border-left:1px solid ${colors.borderDim};
              min-width:0;
            ">
              <div style="padding:${baseFontSize * 0.82}px ${baseFontSize * 1.1}px ${baseFontSize * 0.42}px;overflow:hidden;">
                <div class="panel-heading">Tips for getting started</div>
                ${tipRows}
              </div>
              <div style="
                padding:${baseFontSize * 0.76}px ${baseFontSize * 1.1}px;
                border-top:1px solid ${colors.borderDim};
                overflow:hidden;
              ">
                <div class="panel-heading">Recent activity</div>
                ${activityRows}
              </div>
            </div>
          </section>

          <div style="
            position:absolute;
            top:${commandTop}px;
            left:${contentPadding}px;
            right:${contentPadding}px;
            height:1px;
            background:${colors.rule};
            opacity:${startupOpacity};
          "></div>

          <section style="
            position:absolute;
            top:${commandTop + baseFontSize * 0.78}px;
            left:${contentPadding}px;
            right:${contentPadding}px;
            opacity:${startupOpacity};
          ">
            ${commandRows}
          </section>

          <section style="
            position:absolute;
            top:${feedTop}px;
            left:${contentPadding}px;
            right:${contentPadding}px;
            bottom:${composerHeight + contentPadding * 0.7}px;
            opacity:${isSubmitted ? 1 : 0};
            overflow:hidden;
          ">
            <div style="
              display:grid;
              grid-template-columns:${baseFontSize * 1.15}px 1fr;
              gap:${baseFontSize * 0.38}px;
              padding:${baseFontSize * 0.12}px 0 ${baseFontSize * 0.95}px;
              font-size:${baseFontSize * 0.82}px;
              line-height:1.26;
            ">
              <span style="color:${colors.muted};">></span>
              <span style="white-space:pre-wrap;">${escapeHtml(prompt)}</span>
            </div>

            <div style="
              height:calc(100% - ${baseFontSize * 4.55}px);
              overflow:hidden;
              margin-top:${baseFontSize * 0.32}px;
            ">
              <div style="transform:translateY(${feedScroll}px);">
                ${feedRows}

                ${finalText ? `
                  <div class="feed-row" style="margin-top:${baseFontSize * 0.08}px;">
                    <span class="bullet" style="background:${colors.text};"></span>
                    <span class="feed-text">
                      <span style="${toneStyle.accent}">Done:</span>
                      <span> ${finalText}${finalCursor}</span>
                    </span>
                  </div>
                ` : ""}
              </div>
            </div>
          </section>

          <section style="
            position:absolute;
            left:${contentPadding}px;
            right:${contentPadding}px;
            bottom:${contentPadding * 0.62}px;
            opacity:1;
          ">
            <div style="
              height:${inputHeight}px;
              border:1px solid ${colors.rule};
              background:${colors.input};
              display:grid;
              grid-template-columns:${baseFontSize * 1.15}px 1fr;
              gap:${baseFontSize * 0.34}px;
              align-items:center;
              padding:0 ${baseFontSize * 0.42}px;
              color:${colors.text};
              font-size:${baseFontSize * 0.74}px;
              line-height:1.2;
            ">
              <span style="color:${colors.muted};">></span>
              <span style="white-space:pre-wrap;">${isSubmitted ? '<span class="cursor">&nbsp;</span>' : `${displayPrompt}${promptCursor}`}</span>
            </div>
            <div style="
              display:grid;
              grid-template-columns:1fr auto 1fr;
              align-items:center;
              color:${colors.muted};
              font-size:${baseFontSize * 0.42}px;
              line-height:${footerHeight}px;
            ">
              <span>! for bash mode</span>
              <span>/ for commands - esc to undo - tab to save</span>
              <span style="text-align:right;">shift+tab for auto-accept edits</span>
            </div>
          </section>
          </div>
        </main>
      </div>
    `;
  },
});
