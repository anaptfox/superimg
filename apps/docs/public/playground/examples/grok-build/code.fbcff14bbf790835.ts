import { define, type RenderContext } from "superimg";

export interface PlanLine {
  num: string;
  text: string;
  tone: "heading" | "body" | "blank";
}

export interface Hotkey {
  key: string;
  label: string;
}

export interface Subagent {
  label: string;
  role: string;
  status: "running" | "done";
}

export interface GrokBuildData extends Record<string, unknown> {
  workspace: string;
  prompt: string;
  thoughtSeconds: number;
  planTitle: string;
  planLines: PlanLine[];
  hotkeys: Hotkey[];
  subagents: Subagent[];
  model: string;
  modes: { idle: string; afterApprove: string };
}

const C = {
  page: "#000000",
  chrome: "#0c0c0c",
  border: "#2a2a2a",
  borderSoft: "#1e1e1e",
  text: "#e9e9e9",
  soft: "#9c9c9c",
  muted: "#6e6e6e",
  dim: "#3f3f3f",
  done: "#5f5f5f",
  traffic: "#3a3a3a",
};

const SPIN = ["◐", "◓", "◑", "◒"] as const;
const BAR_WIDTH = 34;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default define<GrokBuildData>({
  sample: {
    workspace: "projects/main · gumbo/src",
    prompt: "Migrate auth from sessions to JWT with token rotation.",
    thoughtSeconds: 3.4,
    planTitle: "plan.md",
    planLines: [
      { num: "1", text: "Bottom line", tone: "heading" },
      {
        num: "2",
        text: "Swap legacy sessions for JWT + rotation, behind a flag with 7d compat.",
        tone: "body",
      },
      { num: "3", text: "", tone: "blank" },
      { num: "4", text: "Approach", tone: "heading" },
      { num: "5", text: "• Add jwtVerify helper in src/lib/jwt.ts.", tone: "body" },
      { num: "6", text: "• Add /auth/refresh with rotating refresh tokens.", tone: "body" },
      { num: "7", text: "• Replace session check in authMiddleware.", tone: "body" },
    ],
    hotkeys: [
      { key: "a", label: "pprove" },
      { key: "c", label: "omment" },
      { key: "q", label: "uit plan" },
    ],
    subagents: [
      { label: "Explore session middleware", role: "explore", status: "running" },
      { label: "Explore token storage", role: "explore", status: "running" },
      { label: "Draft jwt.ts helper", role: "build", status: "running" },
      { label: "Audit refresh endpoints", role: "review", status: "running" },
      { label: "Map auth call sites", role: "explore", status: "done" },
      { label: "Read AGENTS.md", role: "explore", status: "done" },
    ],
    model: "grok-4.5",
    modes: { idle: "ask", afterApprove: "build" },
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "13s",
  },
  render(ctx: RenderContext<GrokBuildData>) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({
      boot: "8%",
      prompt: "10%",
      think: "10%",
      plan: "22%",
      agents: "20%",
      progress: "15%",
      approve: "10%",
      hold: "5%",
    });

    const fs = 20;
    const small = fs * 0.9;
    const cardW = Math.min(width - 280, 1280);
    const cardH = Math.min(height - 140, 900);

    const enter = (p: number) => {
      const e = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
      return {
        p: e,
        style: `opacity:${e};transform:translateY(${(1 - e) * 10}px);`,
      };
    };
    const win = (p: number, start: number, span: number) =>
      std.clamp01((p - start) / span);

    const intro = t.motion({ during: "boot", y: 20, scale: 0.992, exit: false });
    const blink = timeline.seconds % 1.06 < 0.53 ? 1 : 0;
    const spinGlyph = SPIN[Math.floor(timeline.seconds / 0.18) % SPIN.length];

    // ---- prompt typing ------------------------------------------------------
    const promptP = t.in("prompt");
    const typedChars = Math.floor(std.clamp01(promptP / 0.88) * data.prompt.length);
    const promptDone = promptP >= 0.88 || t.in("think") > 0;
    const promptText = escapeHtml(
      promptDone ? data.prompt : data.prompt.slice(0, typedChars),
    );
    const promptVisible = t.in("boot") > 0.4 || promptP > 0;

    // ---- think --------------------------------------------------------------
    const thinkP = t.in("think");
    const thinkEnter = enter(win(thinkP, 0, 0.35));
    const thoughtVal =
      thinkP > 0
        ? Math.min(data.thoughtSeconds, thinkP * data.thoughtSeconds * 1.15)
        : 0;
    const thoughtShown =
      t.in("plan") > 0 || t.in("agents") > 0 || t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0
        ? data.thoughtSeconds
        : thoughtVal;

    // ---- plan ---------------------------------------------------------------
    const planP = t.in("plan");
    const planHead = enter(win(planP, 0, 0.18));
    const planLinesHtml = data.planLines
      .map((line, i) => {
        const row = enter(win(planP, 0.12 + i * 0.08, 0.14));
        if (row.p <= 0) return "";
        const fg =
          line.tone === "heading" ? C.text : line.tone === "body" ? C.soft : C.dim;
        return `<div style="${row.style}"><span style="color:${C.dim};display:inline-block;width:28px;">${escapeHtml(line.num)}</span><span style="color:${fg};">${escapeHtml(line.text)}</span></div>`;
      })
      .join("");
    const hotkeysEnter = enter(win(planP, 0.72, 0.2));
    const approveP = t.in("approve");
    const approveActive = approveP > 0.35 || t.in("hold") > 0;
    const hotkeysHtml = data.hotkeys
      .map((hk) => {
        const isApprove = hk.key === "a" && approveActive;
        const keyColor = isApprove ? C.text : C.text;
        const labelColor = isApprove ? C.text : C.muted;
        const bg = isApprove ? "rgba(233,233,233,0.08)" : "transparent";
        return `<span style="padding:1px 8px 1px 0;border-radius:2px;background:${bg};"><span style="color:${keyColor};">[${escapeHtml(hk.key)}]</span><span style="color:${labelColor};">${escapeHtml(hk.label)}</span></span>`;
      })
      .join("");

    // ---- subagents ----------------------------------------------------------
    const agentsP = t.in("agents");
    const agentsHead = enter(win(agentsP, 0, 0.15));
    const runningCount = data.subagents.filter((s) => s.status === "running").length;
    const doneCount = data.subagents.filter((s) => s.status === "done").length;
    // Flip first two "running" to done mid-agents, keep last two spinning
    const agentsHtml = data.subagents
      .map((agent, i) => {
        const row = enter(win(agentsP, 0.1 + i * 0.07, 0.14));
        if (row.p <= 0) return "";
        const flipDone =
          agent.status === "running" && i < 2 && win(agentsP, 0.55 + i * 0.12, 0.15) >= 1;
        const isDone = agent.status === "done" || flipDone;
        const icon = isDone
          ? `<span style="color:${C.done};">✓</span>`
          : `<span style="color:${C.text};">${spinGlyph}</span>`;
        const labelColor = isDone ? C.done : C.soft;
        return `<div style="${row.style}">${icon} <span style="color:${labelColor};">${escapeHtml(agent.label)}</span> <span style="color:${C.dim};">${escapeHtml(agent.role)}</span></div>`;
      })
      .join("");
    const liveRunning = Math.max(
      0,
      runningCount - (win(agentsP, 0.55, 0.15) >= 1 ? 1 : 0) - (win(agentsP, 0.67, 0.15) >= 1 ? 1 : 0),
    );
    const liveDone = doneCount + (runningCount - liveRunning);

    // ---- progress + meter ---------------------------------------------------
    const pctBase = 8.45;
    const pctEnd = 72.4;
    const progressLocal =
      t.in("hold") > 0 || t.in("approve") > 0
        ? 1
        : t.in("progress") > 0
          ? t.in("progress")
          : t.in("agents") > 0.7
            ? win(t.in("agents"), 0.7, 0.3) * 0.08
            : 0;
    const pct =
      progressLocal <= 0
        ? pctBase
        : pctBase + (pctEnd - pctBase) * std.interpolate(Math.min(1, progressLocal), [0, 1], [0, 1], "linear");
    const filled = Math.round((pct / 100) * BAR_WIDTH);
    const bar =
      "█".repeat(Math.max(0, filled)) + " ".repeat(Math.max(0, BAR_WIDTH - filled));
    const turnBase = 12.4;
    const tokBase = 41.2;
    const workClock = Math.max(
      0,
      t.in("agents") * 0.4 + t.in("progress") * 0.5 + t.in("approve") * 0.2 + t.in("hold") * 0.1,
    );
    const turnSec = turnBase + workClock * 18;
    const tokens = tokBase + workClock * 12;

    // ---- mode ---------------------------------------------------------------
    const mode =
      approveActive || t.in("hold") > 0 ? data.modes.afterApprove : data.modes.idle;

    // ---- block visibility ---------------------------------------------------
    const thoughtHtml =
      thinkEnter.p > 0 || t.in("plan") > 0
        ? `<div style="color:${C.muted};margin-bottom:${fs * 0.55}px;${thinkEnter.p > 0 && t.in("plan") <= 0 ? thinkEnter.style : ""}">◆ Thought for ${thoughtShown.toFixed(1)}s</div>`
        : "";

    const planHtml =
      planHead.p > 0 || t.in("agents") > 0 || t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0
        ? `
      <div style="margin-bottom:${fs * 0.55}px;${planHead.p < 1 && t.in("agents") <= 0 ? planHead.style : ""}">
        <div style="display:flex;align-items:center;color:${C.dim};overflow:hidden;white-space:nowrap;">
          <span style="flex:1;overflow:hidden;">────────────────────────────────────────────</span>
          <span style="color:${C.text};padding:0 8px;">${escapeHtml(data.planTitle)}</span>
          <span style="flex:1;overflow:hidden;text-align:right;">────────────────────────────────────────────</span>
          <span style="color:${C.muted};padding-left:10px;">×</span>
        </div>
        <div style="padding:8px 0 4px;">${planLinesHtml}</div>
        <div style="color:${C.dim};overflow:hidden;white-space:nowrap;">──────────────────────────────────────────────────────────────────────────────────────────────────</div>
        <div style="padding-top:6px;${hotkeysEnter.p < 1 && t.in("agents") <= 0 ? hotkeysEnter.style : ""}">${hotkeysHtml}</div>
      </div>`
        : "";

    const agentsBlock =
      agentsHead.p > 0 || t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0
        ? `
      <div style="border:0.5px solid ${C.borderSoft};border-radius:3px;padding:8px 12px;margin-bottom:${fs * 0.55}px;${agentsHead.p < 1 && t.in("progress") <= 0 ? agentsHead.style : ""}">
        <div style="color:${C.muted};margin-bottom:6px;">subagents <span style="color:${C.dim};">— ${liveRunning} running, ${liveDone} done</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;">${agentsHtml}</div>
      </div>`
        : "";

    const progressOpacity =
      t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0
        ? 1
        : t.in("agents") > 0.7
          ? win(t.in("agents"), 0.7, 0.3)
          : 0;

    const cursorHtml = `<span style="background:${C.text};width:7px;height:${fs * 0.85}px;display:inline-block;vertical-align:-2px;opacity:${blink};"></span>`;

    return `
      <style>
        * { box-sizing: border-box; margin: 0; }
        .mono {
          font-family: 'SF Mono', ui-monospace, Menlo, Consolas, 'DejaVu Sans Mono', monospace;
          font-variant-ligatures: none;
          -webkit-font-smoothing: antialiased;
        }
      </style>
      <div class="mono" style="${std.css({
        width,
        height,
        background: C.page,
        color: C.text,
        fontSize: fs,
        lineHeight: 1.65,
      }, std.css.center())}">
        <main style="
          width:${cardW}px;
          height:${cardH}px;
          background:${C.page};
          border:0.5px solid ${C.border};
          border-radius:8px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          box-shadow:0 28px 80px rgba(0,0,0,0.65);
          opacity:${intro.opacity};
          ${intro.style}
        ">
          <div style="
            display:flex;align-items:center;gap:10px;
            padding:10px 14px;
            background:${C.chrome};border-bottom:0.5px solid ${C.border};
            flex:none;
          ">
            <span style="width:12px;height:12px;border-radius:50%;background:${C.traffic};"></span>
            <span style="width:12px;height:12px;border-radius:50%;background:${C.traffic};"></span>
            <span style="width:12px;height:12px;border-radius:50%;background:${C.traffic};"></span>
            <span style="margin-left:8px;color:${C.muted};font-size:${small}px;">grok</span>
          </div>

          <div style="
            flex:1;min-height:0;
            padding:14px 18px;
            display:flex;flex-direction:column;
            overflow:hidden;
          ">
            <div style="display:flex;justify-content:space-between;color:${C.muted};border-bottom:0.5px solid ${C.borderSoft};padding-bottom:8px;margin-bottom:12px;font-size:${small}px;">
              <span>${escapeHtml(data.workspace).split(" · ").join(` <span style="color:${C.dim};">·</span> `)}</span>
              <span>[turn: ${turnSec.toFixed(1)}s, ↓${tokens.toFixed(1)}k] <span style="color:${C.dim};">[×]</span></span>
            </div>

            ${
              promptVisible
                ? `<div style="margin-bottom:10px;"><span style="color:${C.text};">❯</span> <span style="color:${C.soft};">${promptText}</span>${!promptDone ? cursorHtml : ""}</div>`
                : ""
            }

            ${thoughtHtml}
            ${planHtml}
            ${agentsBlock}

            <div style="flex:1;"></div>

            <div style="display:flex;align-items:center;color:${C.muted};margin-bottom:8px;opacity:${progressOpacity};font-size:${small}px;white-space:pre;">
              <span>|</span><span style="color:${C.soft};">${bar}</span><span> ${pct.toFixed(2)}%</span><span>|</span>
            </div>

            <div style="border-top:0.5px solid ${C.borderSoft};padding-top:8px;display:flex;align-items:center;gap:8px;">
              <span style="color:${C.text};">❯</span>
              ${cursorHtml}
              <span style="flex:1;"></span>
              <span style="color:${C.muted};font-size:${small}px;">${escapeHtml(data.model)} <span style="color:${C.dim};">·</span> ${escapeHtml(mode)}</span>
            </div>
          </div>
        </main>
      </div>
    `;
  },
});
