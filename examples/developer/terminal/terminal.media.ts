import { video, Frame, Stack, Text, Fill, Html, layoutTimeline, type RenderContext } from "@foxworth/superimg";

export interface TerminalCommand {
  prompt: string;
  command: string;
  output: string;
  outputDelay: number;
}

export interface TerminalVideoData extends Record<string, unknown> {
  commands: TerminalCommand[];
  title: string;
  theme: "dark" | "light" | "matrix" | "ubuntu";
  fontSize: "small" | "medium" | "large";
}

const THEMES: Record<string, { bg: string; text: string; prompt: string; headerBg: string; title: string }> = {
  dark: { bg: "#1e1e1e", text: "#d4d4d4", prompt: "#6a9955", headerBg: "#2d2d2d", title: "#858585" },
  light: { bg: "#ffffff", text: "#1e1e1e", prompt: "#0066cc", headerBg: "#f3f3f3", title: "#666666" },
  matrix: { bg: "#0d0d0d", text: "#00ff00", prompt: "#00ff00", headerBg: "#1a1a1a", title: "#00ff00" },
  ubuntu: { bg: "#300a24", text: "#eeeeee", prompt: "#8ae234", headerBg: "#2c001e", title: "#eeeeee" },
};

const FONT_SIZE_MAP: Record<string, number> = {
  small: 26,
  medium: 32,
  large: 38,
};

const HEADER_S = 0.3;
const PROMPT_S = 0.3;
const EXIT_S = 0.12;
const RESPONSE_PAUSE_SECONDS = 0.42;
const OUTPUT_BURST_SECONDS = 0.22;
const CHARS_PER_SEC = 1 / 0.03;

function commandPlan(cmd: TerminalCommand) {
  const typing = Math.max(0.35, Array.from(cmd.command).length / CHARS_PER_SEC);
  const outputLines = cmd.output ? cmd.output.split("\n").length : 0;
  const delay = Number.isFinite(cmd.outputDelay) ? Math.max(0, cmd.outputDelay) : 0;
  const responseStart = typing + delay + RESPONSE_PAUSE_SECONDS;
  const burst = Math.max(OUTPUT_BURST_SECONDS, outputLines * 0.18);
  return { typing, responseStart, burst, seconds: responseStart + (cmd.output ? burst : 0) + 0.8 };
}

function commandSeconds(cmd: TerminalCommand): number {
  return commandPlan(cmd).seconds;
}

function estimateTerminalTimeline(data: TerminalVideoData) {
  const commandsS = Math.max(
    2.5,
    data.commands.reduce((a, c) => a + commandSeconds(c), 0),
  );
  return layoutTimeline({
    header: HEADER_S,
    commands: commandsS,
    prompt: PROMPT_S,
    exit: EXIT_S,
  });
}

export default video<TerminalVideoData>({
  duration: "6s", // resolve() owns the data-driven duration
  inlineCss: ["* { margin: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],
  sample: {
    title: "Terminal",
    commands: [
      {
        prompt: "$ ",
        command: "npm install @acme/cli",
        output: "added 42 packages in 2.3s",
        outputDelay: 0.5,
      },
      {
        prompt: "$ ",
        command: "acme init my-project",
        output: "✓ Created my-project\n✓ Installed dependencies\n✓ Ready to go!",
        outputDelay: 0.4,
      },
    ],
    theme: "dark",
    fontSize: "medium",
  },
  resolve({ data }) {
    const { totalSeconds, phases } = estimateTerminalTimeline(data);
    return { duration: `${totalSeconds}s`, phases };
  },
  render(ctx: RenderContext<TerminalVideoData>) {
    const { std, width, height, timeline, data } = ctx;
    const { commands, title, theme, fontSize } = data;

    const themeStyle = (THEMES[theme] ?? THEMES.dark) as (typeof THEMES)["dark"];
    const termFontSize = FONT_SIZE_MAP[fontSize] ?? 32;

    const { phases } = estimateTerminalTimeline(data);

    const t = ctx.director(phases);
    const terminalAnim = t.motion({
      id: "terminal-window",
      during: "header",
      y: 20,
      exit: { y: -20 },
      exitEasing: "easeInCubic",
    });
    const commandsProgress = t.in("commands");
    const numCommands = commands.length;
    const cmdSecs = commands.map(commandSeconds);
    const stack = std.stack(commands, {
      id: "terminal-commands",
      itemIds: commands.map((_command, index) => `command-${index}`),
      during: commandsProgress,
      weights: cmdSecs,
      lead: 0,
      trail: 0,
    });

    let linesHtml = "";
    const cursorOpacity = timeline.seconds % 1.0 < 0.5 ? 0.75 : 0;

    for (let i = 0; i < numCommands; i++) {
      const cmd = commands[i]!;
      const state = stack.state(i);
      if (state.state === "hidden") continue;
      const plan = commandPlan(cmd);
      const cmdLocalSec = state.slot * plan.seconds;
      const typingProgress = std.clamp01(cmdLocalSec / plan.typing);
      const chars = Array.from(cmd.command);
      const displayCmd = chars.slice(0, Math.floor(typingProgress * chars.length)).join("");
      const isActiveCursor = typingProgress < 1;

      const currentCursorOp = isActiveCursor ? 0.75 : cursorOpacity;
      const cursor = `<span class="cursor" style="opacity: ${currentCursorOp}">&nbsp;</span>`;

      linesHtml += `<div class="line"><span class="prompt">${std.text.escapeHtml(cmd.prompt)}</span><span class="command">${std.text.escapeHtml(displayCmd)}${isActiveCursor ? cursor : ""}</span></div>`;

      const responseStartSec = plan.responseStart;

      if (typingProgress >= 1 && cmdLocalSec < responseStartSec && cmd.output) {
        linesHtml += `<div class="line running"><span class="cursor" style="opacity: ${cursorOpacity}">&nbsp;</span></div>`;
      }

      if (cmdLocalSec >= responseStartSec && cmd.output) {
        const outputLines = cmd.output.split("\n");
        const outputBurstProgress = std.clamp01(
          (cmdLocalSec - responseStartSec) / plan.burst,
        );
        const visibleOutputLines = Math.min(
          outputLines.length,
          Math.floor(outputBurstProgress * outputLines.length) + 1,
        );

        for (let j = 0; j < visibleOutputLines && j < outputLines.length; j++) {
          linesHtml += `<div class="line output">${std.text.escapeHtml(outputLines[j]!)}</div>`;
        }
      }
    }

    if (t.in("prompt") > 0 && commands.length > 0) {
      const firstPrompt = commands[0]!.prompt;
      linesHtml += `<div class="line"><span class="prompt">${std.text.escapeHtml(firstPrompt)}</span><span class="cursor" style="opacity: ${cursorOpacity}">&nbsp;</span></div>`;
    }

    const windowW = Math.min(1440, width - 120);
    const bodyH = Math.min(height - 300, Math.max(360, (commands.reduce((count, cmd) => count + 1 + (cmd.output ? cmd.output.split("\n").length : 0), 1)) * termFontSize * 1.4 + 80));
    return Frame(
      { id: "stage", width, height, fill: "#111116" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center", pad: 60 },
        Frame(
          { id: "terminal-window", width: windowW, height: bodyH + 64, fill: themeStyle.bg, radius: 12, overflow: "hidden", motion: terminalAnim, style: { boxShadow: "0 24px 64px rgba(0,0,0,0.4)" } },
          Stack(
            { direction: "row", width: windowW, height: 64, pad: { x: 28 }, gap: 12, align: "center", fill: themeStyle.headerBg },
            ...["#ff5f56", "#ffbd2e", "#27ca40"].map((color, i) => Fill({ id: `window-control-${i}`, width: 14, height: 14, radius: 7, color })),
            Text({ id: "terminal-title", variant: "label", size: 22, color: themeStyle.title }, title),
          ),
          Frame(
            { x: 0, y: 64, width: windowW, height: bodyH, pad: 40 },
            Html({ id: "terminal-lines", width: windowW - 80, height: bodyH - 80, html: `
              <style>
                .terminal { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-variant-ligatures: none; font-size: ${termFontSize}px; line-height: 1.4; }
                .terminal .line { min-height: 1.4em; white-space: pre-wrap; overflow-wrap: anywhere; }
                .terminal .prompt { color: ${themeStyle.prompt}; }
                .terminal .command, .terminal .output { color: ${themeStyle.text}; }
                .terminal .cursor { display: inline-block; width: 0.62em; height: 1.05em; margin-left: 2px; background: ${themeStyle.text}; vertical-align: -0.12em; }
              </style>
              <div class="terminal">${linesHtml}</div>
            ` }),
          ),
        ),
      ),
    );
  },
});
