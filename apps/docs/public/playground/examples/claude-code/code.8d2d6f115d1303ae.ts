import { define, layoutTimeline, type RenderContext } from "superimg";

/** Diff line inside an edit event. */
export interface ClaudeCodeDiffLine {
  kind: "context" | "del" | "add";
  num: string;
  text: string;
}

export interface ClaudeCodeTodo {
  text: string;
  status: "done" | "active" | "pending";
}

/**
 * Programmable transcript events — any length, any order.
 * Pass a different `events` array (hand-authored or LLM-generated) and duration scales via resolve().
 */
export type ClaudeCodeEvent =
  | { type: "assistant"; text: string }
  | { type: "tool"; name: string; args: string; result: string }
  | { type: "todos"; items: ClaudeCodeTodo[] }
  | { type: "edit"; file: string; diff: ClaudeCodeDiffLine[] }
  | { type: "permission"; file: string; options: string[]; selected?: number }
  | { type: "spinner"; verbs: string[]; tokens: string; seconds?: number };

export interface ClaudeCodeData extends Record<string, unknown> {
  windowTitle: string;
  version: string;
  cwd: string;
  tip: string;
  prompt: string;
  inputPlaceholder: string;
  statusLeft: string;
  statusRight: string;
  events: ClaudeCodeEvent[];
}

const C = {
  page: "#0e0d0b",
  terminal: "#161513",
  chrome: "#1f1e1b",
  border: "#33312d",
  borderBright: "#4a4740",
  text: "#d6d3cc",
  soft: "#a8a49b",
  muted: "#7c7970",
  dim: "#5c5a54",
  accent: "#d97757",
  selected: "#2b2926",
  diffHeader: "#1c1b18",
  delBg: "#3a1f1c",
  delText: "#e07a6a",
  addBg: "#1e3020",
  addText: "#8fc47a",
  done: "#7fae6a",
  trafficRed: "#e05c48",
  trafficYellow: "#e0a840",
  trafficGreen: "#4fa85c",
};

/** Window settle only — chat content starts after this phase ends. */
const BOOT_S = 1.35;
const SUBMIT_S = 0.6;
const TYPE_MIN_S = 0.9;
const TYPE_CHARS_PER_SEC = 32;
const ASSIST_CHARS_PER_SEC = 50;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function typeSeconds(prompt: string): number {
  return Math.max(TYPE_MIN_S, prompt.length / TYPE_CHARS_PER_SEC);
}

/** Seconds for one event — pure, deterministic. Tuned near the original fixed phases. */
export function estimateEventSeconds(e: ClaudeCodeEvent): number {
  switch (e.type) {
    case "assistant":
      return Math.max(0.55, e.text.length / ASSIST_CHARS_PER_SEC + 0.25);
    case "tool":
      return 0.9;
    case "todos":
      return 0.5 + e.items.length * 0.28;
    case "edit":
      return 0.5 + e.diff.length * 0.24;
    case "permission":
      return 0.6 + e.options.length * 0.45;
    case "spinner":
      return e.seconds ?? 2.3;
    default: {
      const _x: never = e;
      return _x;
    }
  }
}

/** Pure timeline: same call for resolve() and render() via std.layoutTimeline. */
export function buildTimeline(data: ClaudeCodeData) {
  const segments: Record<string, number> = {
    boot: BOOT_S,
    type: typeSeconds(data.prompt),
    submit: SUBMIT_S,
  };
  for (let i = 0; i < data.events.length; i++) {
    segments[`event_${i}`] = estimateEventSeconds(data.events[i]!);
  }
  return layoutTimeline(segments);
}

type Enter = (p: number) => { p: number; style: string };
type Win = (p: number, start: number, span: number) => number;

function renderAssistantEvent(p: number, ev: Extract<ClaudeCodeEvent, { type: "assistant" }>, bullet: string, win: Win): string {
  if (p <= 0) return "";
  const chars = Math.floor(win(p, 0, 0.85) * ev.text.length);
  if (chars <= 0) return "";
  return `<div class="block">${bullet} ${escapeHtml(ev.text.slice(0, chars))}</div>`;
}

function renderToolEvent(p: number, ev: Extract<ClaudeCodeEvent, { type: "tool" }>, bullet: string, enter: Enter, win: Win): string {
  const call = enter(win(p, 0, 0.35));
  const result = enter(win(p, 0.35, 0.4));
  if (call.p <= 0) return "";
  return `
    <div class="block tight" style="${call.style}">${bullet} <span style="font-weight:500;">${escapeHtml(ev.name)}</span><span style="color:${C.muted};">(${escapeHtml(ev.args)})</span></div>
    <div class="block" style="color:${C.muted};padding-left:2px;opacity:${result.p};">&nbsp;&nbsp;⎿&nbsp;&nbsp;${escapeHtml(ev.result)}</div>`;
}

function renderTodosEvent(
  p: number,
  ev: Extract<ClaudeCodeEvent, { type: "todos" }>,
  bullet: string,
  enter: Enter,
  win: Win,
): string {
  const block = enter(win(p, 0, 0.25));
  if (block.p <= 0) return "";
  const rows = ev.items
    .map((todo, i) => {
      const checked = todo.status === "done" && win(p, 0.3 + i * 0.28, 0.12) >= 1;
      const lead = i === 0 ? "⎿&nbsp;&nbsp;" : "&nbsp;&nbsp;&nbsp;";
      const box = checked
        ? `<span style="color:${C.done};">☒</span> <span style="color:${C.dim};text-decoration:line-through;">${escapeHtml(todo.text)}</span>`
        : todo.status === "pending"
          ? `☐ ${escapeHtml(todo.text)}`
          : `<span style="color:${C.text};">☐</span> <span style="color:${C.text};">${escapeHtml(todo.text)}</span>`;
      return `<div style="color:${C.muted};padding-left:2px;">&nbsp;&nbsp;${lead}${box}</div>`;
    })
    .join("");
  return `
    <div class="block" style="${block.style}">
      <div>${bullet} <span style="font-weight:500;">Update Todos</span></div>
      ${rows}
    </div>`;
}

function renderEditEvent(
  p: number,
  ev: Extract<ClaudeCodeEvent, { type: "edit" }>,
  bullet: string,
  enter: Enter,
  win: Win,
  fs: number,
): string {
  const head = enter(win(p, 0, 0.2));
  if (head.p <= 0) return "";
  const rows = ev.diff
    .map((line, i) => {
      const row = win(p, 0.18 + i * 0.09, 0.1);
      if (row <= 0) return "";
      const bg = line.kind === "del" ? C.delBg : line.kind === "add" ? C.addBg : "transparent";
      const fg = line.kind === "del" ? C.delText : line.kind === "add" ? C.addText : C.muted;
      const pad = line.kind === "context" ? "&nbsp;&nbsp;" : "&nbsp;";
      return `<div style="padding:0 ${fs * 0.45}px;background:${bg};"><span style="color:${C.dim};">&nbsp;&nbsp;${line.num}${pad}</span><span style="color:${fg};">${escapeHtml(line.text)}</span></div>`;
    })
    .join("");
  return `
    <div class="block tight" style="${head.style}">${bullet} <span style="font-weight:500;">Update</span><span style="color:${C.muted};">(${escapeHtml(ev.file)})</span></div>
    <div class="block" style="border:1px solid ${C.border};border-radius:4px;margin-left:2px;opacity:${head.p};">
      <div style="padding:${fs * 0.14}px ${fs * 0.45}px;color:${C.muted};background:${C.diffHeader};border-bottom:1px solid ${C.border};border-radius:4px 4px 0 0;">${escapeHtml(ev.file)}</div>
      <div style="padding:${fs * 0.18}px 0;">${rows}</div>
    </div>`;
}

function renderPermissionEvent(
  p: number,
  ev: Extract<ClaudeCodeEvent, { type: "permission" }>,
  enter: Enter,
  win: Win,
  fs: number,
): string {
  const box = enter(win(p, 0, 0.22));
  if (box.p <= 0) return "";
  const selectedIdx = ev.selected ?? 0;
  const rows = ev.options
    .map((option, i) => {
      const selected = i === selectedIdx;
      return `<div style="padding:1px ${fs * 0.28}px;border-radius:3px;${selected ? `background:${C.selected};color:${C.accent};` : `color:${C.text};`}white-space:pre;">${selected ? "❯ " : "  "}${escapeHtml(option)}</div>`;
    })
    .join("");
  return `
    <div class="block" style="border:1px solid ${C.accent};border-radius:6px;padding:${fs * 0.42}px ${fs * 0.55}px;${box.style}">
      <div style="margin-bottom:${fs * 0.32}px;">Do you want to make this edit to <span style="color:${C.accent};font-weight:500;">${escapeHtml(ev.file)}</span>?</div>
      ${rows}
    </div>`;
}

function renderSpinnerEvent(
  p: number,
  ev: Extract<ClaudeCodeEvent, { type: "spinner" }>,
  enter: Enter,
  win: Win,
  timelineSeconds: number,
  phaseSeconds: number,
): string {
  const spin = enter(win(p, 0, 0.12));
  if (spin.p <= 0) return "";
  const localSec = p * phaseSeconds;
  const verb = ev.verbs[Math.floor(localSec / 0.7) % ev.verbs.length] ?? ev.verbs[0] ?? "Working…";
  const elapsed = Math.floor(timelineSeconds);
  return `
    <div class="block" style="color:${C.muted};${spin.style}">
      <span style="color:${C.accent};">✻</span> <span style="color:${C.accent};">${escapeHtml(verb)}</span> (${elapsed}s · ${escapeHtml(ev.tokens)} · esc to interrupt)
    </div>`;
}

const SAMPLE_EVENTS: ClaudeCodeEvent[] = [
  {
    type: "assistant",
    text: "I'll read the current middleware first, then find every call site.",
  },
  {
    type: "tool",
    name: "Read",
    args: "src/middleware/auth.ts",
    result: "Read 148 lines (ctrl+o to expand)",
  },
  {
    type: "tool",
    name: "Grep",
    args: 'pattern: "sessionStore", glob: "src/**/*.ts"',
    result: "Found 6 matches across 4 files",
  },
  {
    type: "todos",
    items: [
      { text: "Read current auth middleware", status: "done" },
      { text: "Locate all sessionStore call sites", status: "done" },
      { text: "Swap resolver to SessionStore.get()", status: "active" },
      { text: "Update tests in auth.test.ts", status: "pending" },
    ],
  },
  {
    type: "edit",
    file: "src/middleware/auth.ts",
    diff: [
      { kind: "context", num: "41", text: "export async function requireAuth(c: Context) {" },
      { kind: "del", num: "42", text: "-   const raw = c.req.header('cookie')" },
      { kind: "del", num: "43", text: "-   const session = await legacyStore.parse(raw)" },
      { kind: "add", num: "42", text: "+   const session = await sessionStore.get(c, {" },
      { kind: "add", num: "43", text: "+     rolling: true," },
      { kind: "add", num: "44", text: "+   })" },
      { kind: "context", num: "45", text: "  if (!session) return c.redirect('/login')" },
    ],
  },
  {
    type: "permission",
    file: "auth.ts",
    options: [
      "1. Yes",
      "2. Yes, allow all edits during this session (shift+tab)",
      "3. No, and tell Claude what to do differently (esc)",
    ],
  },
  {
    type: "spinner",
    verbs: ["Percolating…", "Cogitating…", "Simmering…", "Ruminating…", "Noodling…", "Marinating…"],
    tokens: "↑ 3.4k tokens",
    seconds: 2.3,
  },
];

export default define<ClaudeCodeData>({
  sample: {
    windowTitle: "fox@homestead: ~/code/gumbo — claude",
    version: "2.1.4",
    cwd: "/Users/fox/code/gumbo",
    tip: "Use # to memorize shortcuts and preferences in CLAUDE.md",
    prompt: "refactor the auth middleware to use the new session store",
    inputPlaceholder: 'Try "run the auth tests and fix what breaks"',
    statusLeft: "? for shortcuts",
    statusRight: "⏵⏵ accept edits on · Opus 4.8 · 41% context left",
    events: SAMPLE_EVENTS,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    // Fallback for AST discovery (must look animated). resolve() overrides per events[].
    duration: "14s",
  },
  resolve({ data }) {
    const { totalSeconds, phases } = buildTimeline(data);
    return {
      duration: `${totalSeconds}s`,
      phases,
    };
  },
  render(ctx: RenderContext<ClaudeCodeData>) {
    const { std, width, height, data, timeline } = ctx;
    const { phases } = buildTimeline(data);
    const t = ctx.director(phases);

    const fs = 23;
    const small = fs * 0.92;
    const cardW = Math.min(width - 340, 1460);
    const cardH = Math.min(height - 180, 880);

    // Card settles fully during boot; no transcript until type phase (after boot).
    const intro = t.motion({
      during: "boot",
      y: 22,
      scale: 0.992,
      at: "0s",
      for: "55%",
      exit: false,
      easing: "easeOutCubic",
    });
    const submitted = t.in("submit") > 0.05;
    const blink = timeline.seconds % 1.06 < 0.53 ? 1 : 0;
    // Hide composer/status until the window has settled (boot ≥ 55%).
    const settled = t.in("boot") >= 0.55 || t.in("type") > 0 || t.in("submit") > 0;

    const enter: Enter = (p) => {
      const e = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
      return { p: e, style: `opacity:${e};transform:translateY(${(1 - e) * 10}px);` };
    };
    const win: Win = (p, start, span) => std.clamp01((p - start) / span);

    const bootP = t.in("boot");
    // Banner/tip only after card fade-in completes (second half of boot).
    const banner = enter(win(bootP, 0.58, 0.22));
    const tip = enter(win(bootP, 0.78, 0.18));

    const typedChars = Math.floor(std.clamp01(t.in("type") / 0.88) * data.prompt.length);
    const inputText = submitted ? "" : escapeHtml(data.prompt.slice(0, typedChars));

    const submitP = t.in("submit");
    const promptLine = enter(win(submitP, 0, 0.4));

    const bullet = `<span style="color:${C.accent};">⏺</span>`;

    const bannerHtml =
      banner.p > 0
        ? `
      <div class="block" style="border:1px solid ${C.borderBright};border-radius:6px;padding:${fs * 0.35}px ${fs * 0.55}px;${banner.style}">
        <div><span style="color:${C.accent};">✻</span> Welcome to <span style="color:${C.accent};">Claude Code</span> <span style="color:${C.muted};">v${escapeHtml(data.version)}</span></div>
        <div style="color:${C.muted};margin-top:${fs * 0.26}px;">/help for help, /status for your current setup</div>
        <div style="color:${C.muted};">cwd: ${escapeHtml(data.cwd)}</div>
      </div>`
        : "";

    const tipHtml =
      tip.p > 0
        ? `
      <div class="block" style="color:${C.muted};${tip.style}">※ Tip: ${escapeHtml(data.tip)}</div>`
        : "";

    const promptHtml =
      promptLine.p > 0
        ? `
      <div class="block" style="${promptLine.style}">
        <span style="color:${C.muted};">&gt;</span> <span style="color:${C.soft};">${escapeHtml(data.prompt)}</span>
      </div>`
        : "";

    // t.in() is 0 before a phase, 0→1 during, and stays 1 after — stack-like stay.
    const eventsHtml = data.events
      .map((ev, i) => {
        const p = t.in(`event_${i}`);
        if (p <= 0) return "";
        switch (ev.type) {
          case "assistant":
            return renderAssistantEvent(p, ev, bullet, win);
          case "tool":
            return renderToolEvent(p, ev, bullet, enter, win);
          case "todos":
            return renderTodosEvent(p, ev, bullet, enter, win);
          case "edit":
            return renderEditEvent(p, ev, bullet, enter, win, fs);
          case "permission":
            return renderPermissionEvent(p, ev, enter, win, fs);
          case "spinner":
            return renderSpinnerEvent(p, ev, enter, win, timeline.seconds, estimateEventSeconds(ev));
          default: {
            const _x: never = ev;
            return _x;
          }
        }
      })
      .join("");

    const showPlaceholder = submitted || typedChars === 0;
    const cursorHtml = `<span style="display:inline-block;width:0.55em;height:1.1em;vertical-align:-0.18em;background:${C.text};opacity:${blink};"></span>`;
    const composerHtml = `
      <div style="border:1px solid ${C.borderBright};border-radius:6px;padding:${fs * 0.22}px ${fs * 0.55}px;display:flex;align-items:center;gap:${fs * 0.36}px;">
        <span style="color:${C.accent};">&gt;</span>
        <span>${inputText}</span>${cursorHtml}
        ${showPlaceholder ? `<span style="color:${C.dim};">${escapeHtml(data.inputPlaceholder)}</span>` : ""}
      </div>
      <div style="display:flex;justify-content:space-between;color:${C.dim};font-size:${small}px;padding:${fs * 0.18}px ${fs * 0.2}px 0;">
        <span>${escapeHtml(data.statusLeft)}</span>
        <span>${escapeHtml(data.statusRight)}</span>
      </div>`;

    return `
      <style>
        * { box-sizing: border-box; }
        .mono {
          font-family: 'SF Mono', ui-monospace, Menlo, Consolas, 'DejaVu Sans Mono', monospace;
          font-variant-ligatures: none;
          -webkit-font-smoothing: antialiased;
        }
        .block { margin-bottom: ${fs * 0.5}px; }
        .block.tight { margin-bottom: ${fs * 0.1}px; }
      </style>
      <div class="mono" style="${std.css({
        width,
        height,
        background: `radial-gradient(120% 120% at 50% 0%, #1a1815 0%, ${C.page} 62%)`,
        color: C.text,
        fontSize: fs,
        lineHeight: 1.65,
      }, std.css.center())}">
        <main style="
          width:${cardW}px;
          height:${cardH}px;
          background:${C.terminal};
          border:1px solid ${C.border};
          border-radius:10px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          box-shadow:0 30px 90px rgba(0,0,0,0.55);
          opacity:${intro.opacity};
          ${intro.style}
        ">
          <div style="
            display:flex;align-items:center;gap:${fs * 0.36}px;
            padding:${fs * 0.34}px ${fs * 0.55}px;
            background:${C.chrome};border-bottom:1px solid ${C.border};
            flex:none;
          ">
            <span style="width:${fs * 0.48}px;height:${fs * 0.48}px;border-radius:50%;background:${C.trafficRed};"></span>
            <span style="width:${fs * 0.48}px;height:${fs * 0.48}px;border-radius:50%;background:${C.trafficYellow};"></span>
            <span style="width:${fs * 0.48}px;height:${fs * 0.48}px;border-radius:50%;background:${C.trafficGreen};"></span>
            <span style="margin-left:${fs * 0.36}px;color:${C.muted};font-size:${small}px;">${escapeHtml(data.windowTitle)}</span>
          </div>

          <div style="
            flex:1;min-height:0;
            padding:${fs * 0.6}px ${fs * 0.7}px 0;
            display:flex;flex-direction:column;justify-content:flex-end;
            overflow:hidden;
          ">
            ${bannerHtml}
            ${tipHtml}
            ${promptHtml}
            ${eventsHtml}
          </div>

          <div style="flex:none;padding:${fs * 0.2}px ${fs * 0.7}px ${fs * 0.5}px;opacity:${settled ? 1 : 0};">
            ${composerHtml}
          </div>
        </main>
      </div>
    `;
  },
});
