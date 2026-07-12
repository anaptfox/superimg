import { define, layoutTimeline, type RenderContext } from "superimg";

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

const FONT_SIZE_MAP: Record<string, string> = {
  small: "16px",
  medium: "20px",
  large: "24px",
};

const HEADER_S = 0.3;
const PROMPT_S = 0.3;
const EXIT_S = 0.12;
const RESPONSE_PAUSE_SECONDS = 0.42;
const OUTPUT_BURST_SECONDS = 0.22;
const CHARS_PER_SEC = 1 / 0.03;

function commandSeconds(cmd: TerminalCommand): number {
  const typing = Math.max(0.35, cmd.command.length / CHARS_PER_SEC);
  const outputLines = cmd.output ? cmd.output.split("\n").length : 0;
  const output = cmd.output
    ? RESPONSE_PAUSE_SECONDS + Math.max(OUTPUT_BURST_SECONDS, outputLines * 0.18) + 0.35
    : 0.2;
  // Hold after each command so output is readable (not just type speed).
  return typing + (cmd.outputDelay ?? 0) * 0.35 + output + 0.45;
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

export default define<TerminalVideoData>({
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
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "6s", // AST fallback; resolve() overrides
  },
  resolve({ data }) {
    const { totalSeconds, phases } = estimateTerminalTimeline(data);
    return { duration: `${totalSeconds}s`, phases };
  },
  render(ctx: RenderContext<TerminalVideoData>) {
    const { std, width, height, timeline, data } = ctx;
    const { commands, title, theme, fontSize } = data;

    const t = (THEMES[theme] ?? THEMES.dark) as (typeof THEMES)["dark"];
    const termFontSize = FONT_SIZE_MAP[fontSize] ?? "20px";

    const { phases } = estimateTerminalTimeline(data);

    const t = ctx.director(phases);
    const terminalAnim = t.motion({
      during: "header",
      y: 20,
      exit: { y: -20 },
      exitEasing: "easeInCubic",
    });
    const commandsProgress = t.in("commands");
    const numCommands = commands.length;
    const cmdSecs = commands.map(commandSeconds);
    const cmdTotal = cmdSecs.reduce((a, b) => a + b, 0) || 1;
    // Map each command to a weighted slice of the commands phase.
    const cmdStarts: number[] = [];
    let acc = 0;
    for (const s of cmdSecs) {
      cmdStarts.push(acc);
      acc += s / cmdTotal;
    }

    let linesHtml = "";
    const cursorOpacity = timeline.seconds % 1.0 < 0.5 ? 0.75 : 0;

    for (let i = 0; i < numCommands; i++) {
      const cmd = commands[i]!;
      const start = cmdStarts[i]!;
      const end = i + 1 < numCommands ? cmdStarts[i + 1]! : 1;
      const span = Math.max(0.0001, end - start);
      const cmdLocalP = (commandsProgress - start) / span;
      if (cmdLocalP < 0) continue;

      const cmdLocalSec = cmdLocalP * cmdSecs[i]!;
      const typingSecs = Math.max(0.01, cmd.command.length / CHARS_PER_SEC);
      const typingProgress = std.clamp01(cmdLocalSec / typingSecs);
      const visibleCmdChars = Math.floor(typingProgress * cmd.command.length);
      const displayCmd = cmd.command.substring(0, visibleCmdChars);

      const isActiveCursor = typingProgress < 1 && commandsProgress < end;
      const currentCursorOp = isActiveCursor ? 0.75 : cursorOpacity;
      const cursor = `<span class="cursor" style="opacity: ${currentCursorOp}">&nbsp;</span>`;

      linesHtml += `<div class="line"><span class="prompt">${cmd.prompt}</span><span class="command">${displayCmd}${isActiveCursor ? cursor : ""}</span></div>`;

      const responseStartSec = typingSecs + RESPONSE_PAUSE_SECONDS;

      if (typingProgress >= 1 && cmdLocalSec < responseStartSec && cmd.output) {
        linesHtml += `<div class="line running"><span class="cursor" style="opacity: ${cursorOpacity}">&nbsp;</span></div>`;
      }

      if (cmdLocalSec >= responseStartSec && cmd.output) {
        const outputLines = cmd.output.split("\n");
        const outputBurstProgress = std.clamp01(
          (cmdLocalSec - responseStartSec) / OUTPUT_BURST_SECONDS,
        );
        const visibleOutputLines = Math.min(
          outputLines.length,
          Math.floor(outputBurstProgress * outputLines.length) + 1,
        );

        for (let j = 0; j < visibleOutputLines && j < outputLines.length; j++) {
          linesHtml += `<div class="line output">${outputLines[j]}</div>`;
        }
      }
    }

    if (t.active === "prompt" && commands.length > 0) {
      const firstPrompt = commands[0]!.prompt;
      linesHtml += `<div class="line"><span class="prompt">${firstPrompt}</span><span class="cursor" style="opacity: ${cursorOpacity}">&nbsp;</span></div>`;
    }

    return `
    <style>
      .terminal {
        font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-weight: 400;
        font-variant-ligatures: none;
        -webkit-font-smoothing: antialiased;
        letter-spacing: 0;
      }
      .line { min-height: 1.35em; padding: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .prompt { color: ${t.prompt}; }
      .command { color: ${t.text}; }
      .output { color: ${t.text}; }
      .cursor {
        display: inline-block;
        width: 0.62em;
        height: 1.05em;
        margin-left: 2px;
        background: ${t.text};
        vertical-align: -0.12em;
      }
    </style>
    <div style="width: ${width}px; height: ${height}px; background: linear-gradient(180deg, #0f0f0f 0%, #171720 100%); display: flex; align-items: center; justify-content: center; padding: 60px; box-sizing: border-box;">
      <div style="width: 100%; max-width: 1100px; background: ${t.bg}; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; box-shadow: 0 22px 42px -22px rgba(0, 0, 0, 0.85); ${terminalAnim.style}">
        <div style="background: ${t.headerBg}; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 12px 20px; display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; gap: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #27ca40;"></div>
          </div>
          <span style="flex: 1; text-align: center; color: ${t.title}; font-size: 14px; font-family: -apple-system, sans-serif;">${title}</span>
        </div>
        <div class="terminal" style="padding: 26px 28px; font-size: ${termFontSize}; line-height: 1.35; min-height: 300px;">
          ${linesHtml}
        </div>
      </div>
    </div>
  `;
  },
});
