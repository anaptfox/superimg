// Feature Launch — Relay as a desktop app product film
// Desktop window chrome · crossfade between in-app screens · responsive editions

import {
  video,
  Frame,
  Stack,
  Text,
  Spacer,
  Fill,
  type FrameProps,
  type MediaChild,
  type MediaElement,
  googleFont,
} from "@foxworth/superimg";

const CSS = [
  "* { margin: 0; padding: 0; box-sizing: border-box; }",
  "body { overflow: hidden; font-family: Inter, system-ui, sans-serif; }",
];

const MONO = "'JetBrains Mono', ui-monospace, monospace";

type SurfaceProps = Omit<FrameProps, "style"> & {
  border?: string;
  style?: Record<string, string | number | undefined>;
};

/** Product-local surface recipe; its visual defaults belong to Relay, not the tree kernel. */
function Surface(props: SurfaceProps, ...children: MediaChild[]): MediaElement {
  const { border, style, ...frame } = props;
  return Frame(
    {
      radius: 16,
      pad: 20,
      fill: "rgba(255,255,255,0.06)",
      ...frame,
      style: border ? { ...style, border } : style,
    },
    ...children,
  );
}

const AGENTS = [
  { name: "Scout", task: "Crawl API docs", color: "#38bdf8", start: 0, tools: ["fetch", "parse"], elapsed: "2m" },
  { name: "Planner", task: "Break down epic", color: "#a78bfa", start: 0.1, tools: ["plan"], elapsed: "4m" },
  { name: "Coder", task: "Implement auth", color: "#34d399", start: 0.2, tools: ["edit", "test"], elapsed: "11m" },
  { name: "Reviewer", task: "Check diff", color: "#fbbf24", start: 0.34, tools: ["diff"], elapsed: "1m" },
  { name: "Deploy", task: "Ship canary", color: "#f472b6", start: 0.46, tools: ["ship"], elapsed: "done" },
] as const;

const COLS = ["Backlog", "Running", "Review", "Done"] as const;

const COL_TINT: Record<(typeof COLS)[number], string> = {
  Backlog: "rgba(255,255,255,0.035)",
  Running: "rgba(52,211,153,0.07)",
  Review: "rgba(251,191,36,0.06)",
  Done: "rgba(129,140,248,0.06)",
};

const PAGE_CLAIMS = [
  { label: "Board", title: "Every agent on one board" },
  { label: "Handoff", title: "Context moves between agents" },
  { label: "Insights", title: "Proof it's working" },
] as const;

export default video({
  editions: {
    landscape: { size: { width: 1920, height: 1080 } },
    square: { size: { width: 1080, height: 1080 } },
    story: { size: { width: 1080, height: 1920 } },
  },
  sample: {
    product: "Relay",
    title: "Kanban for AI agents",
    subtitle: "Watch every agent, tool call, and handoff on one board",
    cta: "Download for Mac",
    accent: "#818cf8",
  },

  duration: "14s",
  poster: "1.5s",
  fonts: [googleFont("Inter:wght@400;500;600;700;800"), googleFont("JetBrains+Mono:wght@500;600;700")],
  inlineCss: CSS,

  render(ctx) {
    const { std, width, height, data } = ctx;
    const r = std.createResponsive(ctx);
    const ratio = width / height;
    const portrait = ratio < 0.85;
    const square = ratio >= 0.85 && ratio <= 1.15;

    const product = String(data.product ?? "Relay");
    const title = String(data.title ?? "Kanban for AI agents");
    const cta = String(data.cta ?? "Download for Mac");
    const accent = String(data.accent ?? "#818cf8");

    const t = ctx.director({
      hook: "18%",
      app: "58%",
      cta: "24%",
    });

    const padX = r({ portrait: 28, default: square ? 40 : 72 });
    const padY = r({ portrait: 36, default: square ? 40 : 56 });
    const titlePx = r({ portrait: 36, default: square ? 40 : 52 });
    const bodyPx = r({ portrait: 15, default: square ? 16 : 20 });

    const winW = Math.round(
      Math.min(width - padX * 2, portrait ? width * 0.92 : square ? width * 0.9 : width * 0.84),
    );
    const winH = Math.round(
      Math.min(height - padY * 2, portrait ? height * 0.52 : square ? height * 0.68 : height * 0.72),
    );
    const titleBarH = r({ portrait: 38, default: 44 });
    const sidebarW = portrait ? 56 : square ? 156 : 188;
    const compactNav = sidebarW < 100;
    const bodyW = winW - sidebarW;
    const contentH = winH - titleBarH;
    const winRadius = r({ portrait: 12, default: 14 });
    const toolbarH = 48;
    const peekY = Math.round(height * 0.32);
    const centerY = Math.round((height - winH) / 2);
    const centerX = Math.round((width - winW) / 2);

    function trafficLights() {
      return Stack(
        { direction: "row", gap: 8, height: titleBarH, align: "center" },
        Frame({ width: 12, height: 12, radius: 6, fill: "#ff5f57" }),
        Frame({ width: 12, height: 12, radius: 6, fill: "#febc2e" }),
        Frame({ width: 12, height: 12, radius: 6, fill: "#28c840" }),
      );
    }

    function mark() {
      return Stack(
        {
          width: compactNav ? 24 : 28,
          height: compactNav ? 24 : 28,
          align: "center",
          justify: "center",
          radius: 8,
          fill: "linear-gradient(145deg,#818cf8,#6366f1)",
        },
        Text({ variant: "label", color: "#fff", size: compactNav ? 12 : 13, weight: 800 }, "R"),
      );
    }

    function navGlyph(id: string, on: boolean) {
      const c = on ? "#c7d2fe" : "rgba(255,255,255,0.42)";
      if (id === "board") {
        return Stack(
          { gap: 2, width: 14, height: 14, justify: "center" },
          Stack(
            { direction: "row", gap: 2 },
            Frame({ width: 6, height: 6, radius: 1.5, fill: c }),
            Frame({ width: 6, height: 6, radius: 1.5, fill: c }),
          ),
          Stack(
            { direction: "row", gap: 2 },
            Frame({ width: 6, height: 6, radius: 1.5, fill: c }),
            Frame({ width: 6, height: 6, radius: 1.5, fill: c }),
          ),
        );
      }
      if (id === "handoff") {
        return Stack(
          { direction: "row", gap: 2, width: 14, height: 10, align: "center" },
          Frame({ width: 6, height: 6, radius: 3, fill: c }),
          Frame({ width: 8, height: 2, radius: 1, fill: c }),
        );
      }
      return Stack(
        { direction: "row", gap: 2, width: 14, height: 12, align: "end" },
        Frame({ width: 3, height: 6, radius: 1, fill: c }),
        Frame({ width: 3, height: 10, radius: 1, fill: c }),
        Frame({ width: 3, height: 8, radius: 1, fill: c }),
      );
    }

    function sidebar(view: "board" | "handoff" | "insights") {
      const items = [
        { id: "board", label: "Board" },
        { id: "handoff", label: "Handoff" },
        { id: "insights", label: "Insights" },
      ] as const;
      return Stack(
        {
          width: sidebarW,
          height: "fill",
          pad: compactNav ? { x: 8, y: 12 } : { x: 12, y: 14 },
          gap: compactNav ? 10 : 18,
          fill: "#14141d",
          style: { borderRight: "1px solid rgba(255,255,255,0.07)" },
        },
        compactNav
          ? Stack({ align: "center", width: "fill" }, mark())
          : Stack(
              { direction: "row", gap: 10, align: "center", height: 28 },
              mark(),
              Stack(
                { gap: 2 },
                Text({ variant: "label", color: "#f4f4f5", size: 13, weight: 700 }, product),
                Text(
                  { variant: "caption", color: "rgba(255,255,255,0.4)", size: 12 },
                  "production",
                ),
              ),
            ),
        Stack(
          { gap: 4, width: "fill" },
          compactNav
            ? null
            : Text(
                {
                  variant: "label",
                  color: "rgba(255,255,255,0.32)",
                  size: 12,
                  weight: 700,
                  letterSpacing: 1.2,
                },
                "WORKSPACE",
              ),
          ...items.map((item) => {
            const on = item.id === view;
            return Surface(
              {
                width: "fill",
                pad: compactNav ? { x: 6, y: 8 } : { x: 8, y: 8 },
                radius: 8,
                fill: on ? "rgba(129,140,248,0.18)" : "transparent",
                border: on ? "1px solid rgba(129,140,248,0.28)" : "1px solid transparent",
              },
              Stack(
                {
                  direction: "row",
                  gap: 10,
                  align: "center",
                  justify: compactNav ? "center" : "start",
                  width: "fill",
                  height: 18,
                },
                navGlyph(item.id, on),
                compactNav
                  ? null
                  : Text(
                      {
                        variant: "label",
                        color: on ? "#eef0ff" : "rgba(255,255,255,0.58)",
                        weight: on ? 600 : 500,
                        size: 13,
                      },
                      item.label,
                    ),
              ),
            );
          }),
        ),
        Spacer(),
        compactNav
          ? null
          : Surface(
              {
                pad: { x: 10, y: 8 },
                radius: 8,
                fill: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              },
              Stack(
                { gap: 2 },
                Text({ variant: "label", color: "rgba(255,255,255,0.62)", size: 12, weight: 600 }, "5 agents"),
                Text(
                  { variant: "caption", color: "rgba(255,255,255,0.38)", size: 12, fontFamily: MONO },
                  "synced just now",
                ),
              ),
            ),
      );
    }

    function viewToolbar(label: string, right?: MediaElement) {
      return Stack(
        {
          direction: "row",
          height: toolbarH,
          width: "fill",
          align: "center",
          justify: "space-between",
          pad: { x: 16 },
          fill: "rgba(255,255,255,0.025)",
          style: { borderBottom: "1px solid rgba(255,255,255,0.06)" },
        },
        Text({ variant: "label", color: "rgba(255,255,255,0.72)", weight: 600, size: 13 }, label),
        right ?? Frame({ width: 1, height: 1 }),
      );
    }

    function windowTitle(view: "board" | "handoff" | "insights") {
      const titles = {
        board: "Agent board",
        handoff: "Handoff",
        insights: "Insights",
      };
      return `${product} — ${titles[view]}`;
    }

    function windowChrome(
      inner: MediaElement,
      view: "board" | "handoff" | "insights",
      motion?: FrameProps["motion"],
    ) {
      return Surface(
        {
          id: "desktop-window",
          width: winW,
          height: winH,
          radius: winRadius,
          pad: 0,
          fill: "#101018",
          border: "1px solid rgba(255,255,255,0.14)",
          overflow: "hidden",
          motion,
          style: {
            boxShadow: "0 40px 90px rgba(0,0,0,0.58), 0 0 0 1px rgba(0,0,0,0.35)",
          },
        },
        Stack(
          { width: "fill", height: "fill" },
          Stack(
            {
              direction: "row",
              height: titleBarH,
              align: "center",
              justify: "space-between",
              pad: { x: 14 },
              fill: "rgba(255,255,255,0.05)",
              style: { borderBottom: "1px solid rgba(255,255,255,0.07)" },
            },
            trafficLights(),
            Text(
              { variant: "label", color: "rgba(255,255,255,0.5)", weight: 600, size: 12 },
              windowTitle(view),
            ),
            Frame({ width: 56, height: 10 }),
          ),
          Stack(
            { direction: "row", width: "fill", height: "fill" },
            sidebar(view),
            Frame({ width: "fill", height: "fill", overflow: "hidden", fill: "#0c0c14" }, inner),
          ),
        ),
      );
    }

    function chip(label: string, tone = "rgba(255,255,255,0.08)") {
      return Surface(
        {
          pad: { x: 6, y: 3 },
          radius: 5,
          fill: tone,
        },
        Text(
          {
            variant: "label",
            color: "rgba(255,255,255,0.62)",
            size: 12,
            weight: 600,
            fontFamily: MONO,
          },
          label,
        ),
      );
    }

    function statusFor(col: string): { label: string; color: string } {
      if (col === "Running") return { label: "running", color: "#6ee7b7" };
      if (col === "Review") return { label: "review", color: "#fcd34d" };
      if (col === "Done") return { label: "done", color: "#a5b4fc" };
      return { label: "idle", color: "rgba(255,255,255,0.38)" };
    }

    function agentCard(
      agent: (typeof AGENTS)[number],
      opts: { col: string; opacity: number; width: number; progress?: number },
    ) {
      const status = statusFor(opts.col);
      const running = opts.col === "Running";
      const glow = running
        ? `0 0 0 1px ${std.color.alpha(agent.color, 0.45)}, 0 10px 28px ${std.color.alpha(agent.color, 0.22)}`
        : "0 8px 20px rgba(0,0,0,0.28)";
      const barScale = std.math.clamp(opts.progress ?? 0.62, 0.08, 1);
      return Surface(
        {
          id: `agent-${agent.name.toLowerCase()}`,
          width: opts.width,
          radius: 10,
          pad: { x: 12, y: 11 },
          overflow: "hidden",
          fill: "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.035))",
          border: running
            ? `1px solid ${std.color.alpha(agent.color, 0.35)}`
            : "1px solid rgba(255,255,255,0.12)",
          style: { opacity: opts.opacity, boxShadow: glow },
        },
        Stack(
          { gap: 7 },
          Stack(
            { direction: "row", gap: 8, align: "center", height: 18 },
            Frame({
              width: 8,
              height: 8,
              radius: 4,
              fill: agent.color,
              style: { boxShadow: `0 0 10px ${std.color.alpha(agent.color, 0.75)}` },
            }),
            Text({ variant: "label", color: "#fafafa", weight: 700, size: 13 }, agent.name),
            Spacer(),
            Text(
              {
                variant: "label",
                color: status.color,
                size: 12,
                weight: 600,
                fontFamily: MONO,
              },
              status.label,
            ),
          ),
          Text({ variant: "caption", color: "rgba(255,255,255,0.58)", size: 12 }, agent.task),
          Stack(
            { direction: "row", gap: 5, align: "center", height: 18 },
            ...agent.tools.map((tool) => chip(tool)),
            Spacer(),
            Text(
              {
                variant: "caption",
                color: "rgba(255,255,255,0.38)",
                size: 12,
                fontFamily: MONO,
              },
              agent.elapsed,
            ),
          ),
          running
            ? Frame(
                {
                  width: "fill",
                  height: 3,
                  radius: 2,
                  overflow: "hidden",
                  fill: "rgba(255,255,255,0.08)",
                },
                Frame({
                  width: "fill",
                  height: 3,
                  radius: 2,
                  fill: agent.color,
                  style: { transform: `scaleX(${barScale})`, transformOrigin: "left center" },
                }),
              )
            : null,
        ),
      );
    }

    function settledColFor(name: string, colCount: number) {
      if (portrait) return name === "Deploy" || name === "Scout" ? Math.min(1, colCount - 1) : 0;
      if (name === "Scout" || name === "Coder") return 1;
      if (name === "Planner") return 2;
      if (name === "Deploy") return 3;
      return 0;
    }

    function buildBoardScreen(local: number, settled = false) {
      const colCount = portrait ? 2 : 4;
      const cols = portrait ? (["Running", "Done"] as const) : COLS;
      const agents = portrait ? AGENTS.slice(0, 4) : AGENTS;
      const innerPad = 16;
      const gap = 12;
      const colW = (bodyW - innerPad * 2 - gap * (colCount - 1)) / colCount;
      const runProgress = std.interpolate(local, [0.2, 1], [0.2, 0.75], "linear");

      const buckets: { agent: (typeof AGENTS)[number]; opacity: number }[][] = cols.map(() => []);
      for (const agent of agents) {
        const target = Math.min(colCount - 1, settledColFor(agent.name, colCount));
        let col = target;
        if (!settled && !portrait && agent.name === "Coder") {
          col = local < 0.3 ? 0 : target;
        }
        const opacity =
          settled || agent.name === "Scout"
            ? 1
            : std.math.clamp(local / 0.12, 0, 1);
        if (opacity <= 0) continue;
        buckets[col]!.push({ agent, opacity });
      }

      const columns = cols.map((name, i) => {
        const items = buckets[i]!;
        const tint = COL_TINT[name as (typeof COLS)[number]] ?? "rgba(255,255,255,0.04)";
        return Surface(
          {
            id: `col-${name.toLowerCase()}`,
            width: colW,
            height: "fill",
            radius: 12,
            pad: 10,
            fill: tint,
            border: "1px solid rgba(255,255,255,0.08)",
          },
          Stack(
            { gap: 8, width: "fill", height: "fill" },
            Stack(
              { direction: "row", align: "center", justify: "space-between", height: 22 },
              Text(
                {
                  variant: "label",
                  color: "rgba(255,255,255,0.72)",
                  weight: 700,
                  size: 12,
                  letterSpacing: 0.8,
                },
                name.toUpperCase(),
              ),
              Surface(
                {
                  pad: { x: 7, y: 2 },
                  radius: 8,
                  fill: "rgba(255,255,255,0.08)",
                },
                Text(
                  {
                    variant: "label",
                    color: "rgba(255,255,255,0.55)",
                    size: 12,
                    weight: 700,
                    fontFamily: MONO,
                  },
                  String(items.length),
                ),
              ),
            ),
            ...items.map((item) =>
              agentCard(item.agent, {
                col: name,
                opacity: item.opacity,
                width: colW - 20,
                progress: name === "Running" ? runProgress : undefined,
              }),
            ),
          ),
        );
      });

      return Frame(
        { id: "board-screen", width: bodyW, height: contentH },
        Stack(
          { width: "fill", height: "fill" },
          viewToolbar(
            "Workspace · production",
            Stack(
              { direction: "row", gap: 8, align: "center", height: 28 },
              Surface(
                {
                  pad: { x: 10, y: 6 },
                  radius: 8,
                  fill: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                },
                Text(
                  { variant: "caption", color: "rgba(255,255,255,0.4)", size: 12 },
                  "Filter",
                ),
              ),
              Stack(
                { direction: "row", gap: 6, align: "center", height: 24 },
                Frame({
                  width: 7,
                  height: 7,
                  radius: 4,
                  fill: "#34d399",
                  style: { boxShadow: "0 0 10px #34d399" },
                }),
                Text(
                  { variant: "caption", color: "rgba(255,255,255,0.62)", size: 12 },
                  `${agents.length} live`,
                ),
              ),
            ),
          ),
          Stack(
            {
              direction: "row",
              width: "fill",
              height: "fill",
              gap,
              pad: innerPad,
            },
            ...columns,
          ),
        ),
      );
    }

    function fadeY(local: number, start: number, dur = 0.18) {
      const p = std.math.clamp((local - start) / dur, 0, 1);
      const op = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
      const y = std.interpolate(p, [0, 1], [8, 0], "easeOutCubic");
      return { opacity: op, transform: `translateY(${y}px)` };
    }

    function buildHandoffScreen(local: number) {
      const aIn = std.math.clamp(local / 0.2, 0, 1);
      const bIn = std.math.clamp((local - 0.08) / 0.2, 0, 1);
      const beam = std.math.clamp((local - 0.12) / 0.28, 0, 1);
      const aOp = std.interpolate(aIn, [0, 1], [0, 1], "easeOutCubic");
      const bOp = std.interpolate(bIn, [0, 1], [0, 1], "easeOutCubic");
      const aY = std.interpolate(aIn, [0, 1], [8, 0], "easeOutCubic");
      const bY = std.interpolate(bIn, [0, 1], [8, 0], "easeOutCubic");
      const tokenP = std.interpolate(std.math.clamp((local - 0.18) / 0.32, 0, 1), [0, 1], [0, 1], "easeInOutCubic");
      const events = [
        { t: "14:02", who: "Planner", text: "queued OAuth refresh" },
        { t: "14:02", who: "Relay", text: "packed context · 12 files" },
        { t: "14:03", who: "Coder", text: "accepted handoff" },
        { t: "14:03", who: "Coder", text: "GET /oauth/token   200  41ms" },
        { t: "14:03", who: "Coder", text: "PATCH /sessions    200  18ms" },
        { t: "14:04", who: "Relay", text: "board card moved → Running" },
      ];
      const files = [
        { name: "auth/oauth.ts", loc: "84" },
        { name: "auth/refresh.ts", loc: "41" },
        { name: "sessions.ts", loc: "112" },
        { name: "lib/http.ts", loc: "67" },
      ];
      const paneW = portrait ? Math.min(bodyW - 40, 420) : Math.round(bodyW * 0.4);
      const beamW = portrait ? 6 : 72;
      const beamH = portrait ? 48 : 6;
      const beamScale = Math.max(0.2, beam);

      function agentPane(
        id: string,
        tone: string,
        kicker: string,
        name: string,
        task: string,
        status: string,
        opacity: number,
        y: number,
      ) {
        return Surface(
          {
            id,
            width: paneW,
            radius: 14,
            pad: 18,
            fill: "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            border: `1px solid ${std.color.alpha(tone, 0.35)}`,
            style: {
              opacity,
              transform: `translateY(${y}px)`,
              boxShadow: `0 16px 40px ${std.color.alpha(tone, 0.12)}`,
            },
          },
          Stack(
            { gap: 10 },
            Text(
              {
                variant: "label",
                color: tone,
                weight: 700,
                size: 12,
                letterSpacing: 1,
              },
              kicker,
            ),
            Stack(
              { direction: "row", gap: 10, align: "center", height: 32 },
              Frame({
                width: 12,
                height: 12,
                radius: 6,
                fill: tone,
                style: { boxShadow: `0 0 12px ${std.color.alpha(tone, 0.7)}` },
              }),
              Text({ variant: "title", color: "#fff", size: 22, weight: 700 }, name),
            ),
            Text({ variant: "body", color: "rgba(255,255,255,0.62)", size: 14 }, task),
            Stack(
              { direction: "row", gap: 6, align: "center", height: 26 },
              chip(status, std.color.alpha(tone, 0.18)),
              chip("12 files"),
              chip("84k tok"),
            ),
          ),
        );
      }

      const logRows = events.map((ev, i) => {
        const style = fadeY(local, 0.04 + i * 0.08, 0.14);
        return Stack(
          {
            direction: "row",
            gap: 12,
            align: "center",
            width: "fill",
            height: 32,
            style,
          },
          Frame({ width: 3, height: 16, radius: 2, fill: i % 2 ? "#34d399" : "#a78bfa" }),
          Text(
            {
              variant: "label",
              color: "rgba(255,255,255,0.42)",
              size: 12,
              fontFamily: MONO,
            },
            ev.t,
          ),
          Text({ variant: "label", color: "#e4e4e7", size: 13, weight: 600 }, ev.who),
          Text({ variant: "caption", color: "rgba(255,255,255,0.68)", size: 13 }, ev.text),
        );
      });

      const tokenX = Math.round(tokenP * Math.max(0, beamW - 10));
      const tokenY = portrait ? Math.round(tokenP * Math.max(0, beamH - 10)) : 0;

      return Frame(
        { id: "handoff-screen", width: bodyW, height: contentH },
        Stack(
          { width: "fill", height: "fill" },
          viewToolbar(
            "Handoff · live",
            chip("Today", "rgba(129,140,248,0.16)"),
          ),
          Stack(
            {
              width: "fill",
              height: "fill",
              gap: 16,
              pad: { x: 20, y: 18 },
              justify: "start",
            },
            Stack(
              {
                direction: portrait ? "column" : "row",
                gap: portrait ? 12 : 18,
                align: "center",
                justify: "center",
                width: "fill",
              },
              agentPane("handoff-from", "#a78bfa", "FROM", "Planner", "Implement OAuth refresh", "queued", aOp, aY),
              Frame(
                {
                  id: "handoff-beam",
                  width: portrait ? 16 : beamW,
                  height: portrait ? beamH : 16,
                },
                Frame({
                  x: portrait ? 5 : 0,
                  y: portrait ? 0 : 5,
                  width: beamW,
                  height: beamH,
                  radius: 3,
                  fill: "linear-gradient(90deg,#a78bfa,#34d399)",
                  style: {
                    opacity: Math.max(0.25, beam),
                    transform: portrait ? `scaleY(${beamScale})` : `scaleX(${beamScale})`,
                    transformOrigin: portrait ? "center top" : "left center",
                    boxShadow: "0 0 16px rgba(167,139,250,0.5)",
                  },
                }),
                Frame({
                  x: portrait ? 3 : tokenX,
                  y: portrait ? tokenY : 3,
                  width: 10,
                  height: 10,
                  radius: 5,
                  fill: "#f8fafc",
                  style: {
                    opacity: tokenP > 0.02 ? 1 : 0,
                    boxShadow: "0 0 12px rgba(255,255,255,0.7)",
                  },
                }),
              ),
              agentPane("handoff-to", "#34d399", "TO", "Coder", "Implement OAuth refresh", "running", bOp, bY),
            ),
            Stack(
              {
                direction: portrait ? "column" : "row",
                gap: 12,
                width: "fill",
              },
              Surface(
                {
                  width: "fill",
                  radius: 12,
                  pad: 16,
                  fill: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.08)",
                },
                Stack(
                  { gap: 6, width: "fill" },
                  Text(
                    {
                      variant: "label",
                      color: "rgba(255,255,255,0.45)",
                      size: 12,
                      weight: 700,
                      letterSpacing: 0.8,
                    },
                    "ACTIVITY",
                  ),
                  ...logRows,
                ),
              ),
              Surface(
                {
                  width: portrait ? "fill" : 280,
                  radius: 12,
                  pad: 16,
                  fill: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.08)",
                },
                Stack(
                  { gap: 8, width: "fill" },
                  Text(
                    {
                      variant: "label",
                      color: "rgba(255,255,255,0.45)",
                      size: 12,
                      weight: 700,
                      letterSpacing: 0.8,
                    },
                    "CONTEXT",
                  ),
                  ...files.map((file, i) =>
                    Stack(
                      {
                        direction: "row",
                        justify: "space-between",
                        align: "center",
                        width: "fill",
                        height: 28,
                        style: fadeY(local, 0.12 + i * 0.05, 0.14),
                      },
                      Text(
                        {
                          variant: "label",
                          color: "rgba(255,255,255,0.72)",
                          size: 12,
                          fontFamily: MONO,
                        },
                        file.name,
                      ),
                      Text(
                        {
                          variant: "caption",
                          color: "rgba(255,255,255,0.38)",
                          size: 12,
                          fontFamily: MONO,
                        },
                        file.loc,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Spacer(),
          ),
        ),
      );
    }

    function buildInsightsScreen(local: number) {
      const kpis = [
        { label: "Live agents", value: "5", hint: "now" },
        { label: "Handoffs", value: "12", hint: "today" },
        { label: "Avg pass", value: "2.1s", hint: "p50" },
        { label: "Success", value: "98%", hint: "week" },
      ];
      const bars = [
        { name: "Scout", n: 18, color: "#38bdf8" },
        { name: "Planner", n: 12, color: "#a78bfa" },
        { name: "Coder", n: 24, color: "#34d399" },
        { name: "Reviewer", n: 9, color: "#fbbf24" },
        { name: "Deploy", n: 7, color: "#f472b6" },
      ];
      const recent = [
        { who: "Scout", text: "finished Crawl API docs" },
        { who: "Planner", text: "handed off to Coder" },
        { who: "Coder", text: "opened Implement auth" },
        { who: "Reviewer", text: "queued Check diff" },
        { who: "Deploy", text: "canary healthy" },
        { who: "Relay", text: "digest ready for #eng" },
      ];
      const paneW = portrait ? bodyW - 40 : Math.floor((bodyW - 52) / 2);

      function kpiCard(kpi: (typeof kpis)[number], i: number) {
        const p = std.math.clamp((local - i * 0.05) / 0.2, 0, 1);
        const op = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
        const y = std.interpolate(p, [0, 1], [8, 0], "easeOutCubic");
        const sc = std.interpolate(p, [0, 1], [0.97, 1], "easeOutCubic");
        return Surface(
          {
            width: "fill",
            radius: 12,
            pad: { x: 16, y: 14 },
            fill: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            style: { opacity: op, transform: `translateY(${y}px) scale(${sc})` },
          },
          Stack(
            { gap: 4 },
            Text(
              {
                variant: "label",
                color: "rgba(255,255,255,0.45)",
                size: 12,
                weight: 600,
              },
              kpi.label,
            ),
            Stack(
              { gap: 2, width: "fill", height: 52 },
              Text({ variant: "title", color: "#fff", size: 26, weight: 700 }, kpi.value),
              Text(
                {
                  variant: "caption",
                  color: "rgba(255,255,255,0.38)",
                  size: 12,
                  fontFamily: MONO,
                },
                kpi.hint,
              ),
            ),
          ),
        );
      }

      const kpiRow = portrait
        ? Stack(
            { gap: 10, width: "fill" },
            Stack({ direction: "row", gap: 10, width: "fill" }, kpiCard(kpis[0]!, 0), kpiCard(kpis[1]!, 1)),
            Stack({ direction: "row", gap: 10, width: "fill" }, kpiCard(kpis[2]!, 2), kpiCard(kpis[3]!, 3)),
          )
        : Stack(
            { direction: "row", gap: 10, width: "fill" },
            ...kpis.map((kpi, i) => kpiCard(kpi, i)),
          );

      const barPane = Surface(
        {
          width: portrait ? "fill" : paneW,
          radius: 12,
          pad: 16,
          fill: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
        },
        Stack(
          { gap: 12, width: "fill" },
          Text(
            {
              variant: "label",
              color: "rgba(255,255,255,0.45)",
              size: 12,
              weight: 700,
              letterSpacing: 0.8,
            },
            "THROUGHPUT · calls",
          ),
          ...bars.map((bar, i) => {
            const p = std.math.clamp((local - 0.12 - i * 0.04) / 0.22, 0, 1);
            const eased = std.interpolate(p, [0, 1], [0.08, bar.n / 24], "easeOutCubic");
            return Stack(
              { gap: 6, width: "fill" },
              Stack(
                { direction: "row", justify: "space-between", width: "fill", align: "center", height: 18 },
                Text({ variant: "label", color: "#fff", size: 12, weight: 600 }, bar.name),
                Text(
                  {
                    variant: "label",
                    color: "rgba(255,255,255,0.4)",
                    size: 12,
                    fontFamily: MONO,
                  },
                  String(bar.n),
                ),
              ),
              Frame(
                { width: "fill", height: 8, radius: 4, overflow: "hidden", fill: "rgba(255,255,255,0.07)" },
                Frame({
                  width: "fill",
                  height: 8,
                  radius: 4,
                  fill: bar.color,
                  style: {
                    transform: `scaleX(${p > 0 ? eased : 0})`,
                    transformOrigin: "left center",
                  },
                }),
              ),
            );
          }),
        ),
      );

      const recentPane = Surface(
        {
          width: portrait ? "fill" : paneW,
          radius: 12,
          pad: 16,
          fill: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
        },
        Stack(
          { gap: 10, width: "fill" },
          Text(
            {
              variant: "label",
              color: "rgba(255,255,255,0.45)",
              size: 12,
              weight: 700,
              letterSpacing: 0.8,
            },
            "RECENT",
          ),
          ...recent.map((row, i) =>
            Stack(
              {
                direction: "row",
                gap: 10,
                align: "center",
                width: "fill",
                height: 26,
                style: fadeY(local, 0.15 + i * 0.05, 0.16),
              },
              Text({ variant: "label", color: "#c7d2fe", size: 12, weight: 600 }, row.who),
              Text({ variant: "caption", color: "rgba(255,255,255,0.62)", size: 12 }, row.text),
            ),
          ),
        ),
      );

      return Frame(
        { id: "insights-screen", width: bodyW, height: contentH },
        Stack(
          { width: "fill", height: "fill" },
          viewToolbar("Insights · last 7 days", chip("Live", "rgba(52,211,153,0.16)")),
          Stack(
            {
              width: "fill",
              height: "fill",
              pad: 16,
              gap: 12,
              justify: "start",
            },
            kpiRow,
            Stack(
              {
                direction: portrait ? "column" : "row",
                gap: 12,
                width: "fill",
              },
              barPane,
              recentPane,
            ),
            Spacer(),
          ),
        ),
      );
    }

    function stage(...children: MediaElement[]) {
      return Frame(
        { id: "stage", width, height },
        Fill({ id: "stage-bg", width: "fill", height: "fill", color: "#07070c" }),
        Fill({
          width: "fill",
          height: "fill",
          gradient: {
            kind: "radial",
            at: "20% 15%",
            size: "80% 55%",
            stops: ["rgba(99,102,241,0.2)", "transparent"],
          },
        }),
        Fill({
          width: "fill",
          height: "fill",
          gradient: {
            kind: "radial",
            at: "85% 75%",
            size: "60% 45%",
            stops: ["rgba(52,211,153,0.08)", "transparent"],
          },
        }),
        Fill({
          width: "fill",
          height: "fill",
          gradient: {
            kind: "linear",
            angle: "165deg",
            stops: ["#05050a", "#0b0b12 52%", "#07070c"],
          },
        }),
        ...children,
      );
    }

    function placedWindow(
      inner: MediaElement,
      view: "board" | "handoff" | "insights",
      y: number,
      motion?: FrameProps["motion"],
      opacity = 1,
    ) {
      return Frame(
        {
          x: centerX,
          y,
          width: winW,
          height: winH,
          style: opacity < 1 ? { opacity } : undefined,
        },
        windowChrome(inner, view, motion),
      );
    }

    function claimCopy(index: number, opacity: number, y = 0) {
      const claim = PAGE_CLAIMS[index]!;
      return Stack(
        {
          width: "fill",
          align: "center",
          gap: 6,
          style: {
            opacity,
            transform: y ? `translateY(${y}px)` : undefined,
          },
        },
        Text({ variant: "label", color: accent, weight: 700, size: 12 }, claim.label),
        Text(
          {
            variant: "title",
            color: "#fff",
            size: r({ portrait: 20, default: 24 }),
            weight: 800,
            align: "center",
            letterSpacing: -0.4,
          },
          claim.title,
        ),
      );
    }

    function claimOverlay(fromI: number, toI: number, mix: number) {
      const outOp = 1 - mix;
      const inY = std.interpolate(mix, [0, 1], [6, 0], "easeOutCubic");
      return Frame(
        {
          id: "app-kicker",
          width: width - padX * 2,
          height: 64,
        },
        Frame({ width: "fill", height: 64 }, claimCopy(fromI, outOp)),
        Frame({ width: "fill", height: 64 }, claimCopy(toI, mix, inY)),
      );
    }

    function crossfadeInner(
      outgoing: MediaElement,
      incoming: MediaElement | undefined,
      swipe: number,
    ) {
      if (!incoming || swipe <= 0) return outgoing;
      const outX = Math.round(-12 * swipe);
      const inX = Math.round(12 * (1 - swipe));
      return Frame(
        { width: bodyW, height: contentH, overflow: "hidden" },
        Frame(
          {
            width: bodyW,
            height: contentH,
            style: { opacity: 1 - swipe, transform: `translateX(${outX}px)` },
          },
          outgoing,
        ),
        Frame(
          {
            width: bodyW,
            height: contentH,
            style: { opacity: swipe, transform: `translateX(${inX}px)` },
          },
          incoming,
        ),
      );
    }

    const appP = t.in("app");
    const inApp = t.active === "app" || (appP > 0 && t.in("cta") <= 0);
    const inHook = t.active === "hook" || (t.in("hook") < 1 && appP <= 0);

    if (inApp) {
      const beat = t.beats({
        during: "app",
        of: ["board", "handoff", "insights"] as const,
        cross: "8%",
      });
      const screenLocal = (i: number): number => {
        if (beat.crossing) {
          if (i <= beat.index) return 1;
          if (i === beat.index + 1) return beat.mix;
          return 0;
        }
        if (i < beat.index) return 1;
        if (i === beat.index) return beat.local;
        return 0;
      };
      const screens = [
        buildBoardScreen(screenLocal(0)),
        buildHandoffScreen(screenLocal(1)),
        buildInsightsScreen(screenLocal(2)),
      ];
      const views = ["board", "handoff", "insights"] as const;
      const viewI = beat.crossing && beat.mix > 0.5 ? beat.index + 1 : beat.index;
      const inner = beat.crossing
        ? crossfadeInner(screens[beat.index]!, screens[beat.index + 1], Math.max(beat.mix, 0.001))
        : screens[beat.index]!;
      const lift = std.interpolate(appP, [0, 0.1], [0, 1], "easeOutCubic");
      const winY = Math.round(std.interpolate(lift, [0, 1], [peekY, centerY]));
      const kickerH = 64;
      const kickerY = Math.max(padY, winY - kickerH - 10);
      const kickerOp = std.interpolate(appP, [0.02, 0.12], [0, 1], "easeOutCubic");
      const claimMix = beat.crossing ? beat.mix : 0;
      const claimTo = Math.min(2, beat.crossing ? beat.index + 1 : beat.index);

      return stage(
        placedWindow(inner, views[viewI]!, winY),
        Frame(
          {
            x: padX,
            y: kickerY,
            width: width - padX * 2,
            height: kickerH,
            style: { opacity: kickerOp },
          },
          claimOverlay(beat.index, claimTo, claimMix),
        ),
      );
    }

    if (inHook) {
      const titleIn = t.motion({
        id: "hook-title",
        during: "hook",
        at: "0%",
        for: "28%",
        y: 16,
        fromOpacity: 0,
        easing: "easeOutCubic",
      });
      const subIn = t.motion({
        id: "hook-sub",
        during: "hook",
        at: "12%",
        for: "28%",
        y: 10,
        fromOpacity: 0,
        easing: "easeOutCubic",
      });
      const peek = t.motion({
        id: "hook-peek",
        during: "hook",
        at: "28%",
        for: "28%",
        y: 28,
        scale: 0.94,
        fromOpacity: 0,
        easing: "easeOutCubic",
      });
      const hookCopyOp = std.interpolate(t.in("hook"), [0.78, 1], [1, 0], "easeInCubic");

      return stage(
        Frame(
          {
            id: "hook-copy",
            x: 0,
            y: 0,
            width,
            height: Math.round(height * 0.28),
            style: { opacity: hookCopyOp },
          },
          Stack(
            {
              width: "fill",
              height: "fill",
              align: "center",
              justify: "end",
              gap: 14,
              pad: { x: padX, bottom: 16 },
            },
            Text(
              {
                id: "hook-kicker",
                variant: "label",
                color: accent,
                weight: 700,
                motion: titleIn,
              },
              `${product} · for Mac`,
            ),
            Text(
              {
                id: "hook-title",
                variant: "display",
                color: "#fff",
                size: titlePx,
                weight: 800,
                align: "center",
                letterSpacing: -1,
                motion: titleIn,
              },
              title,
            ),
            Text(
              {
                id: "hook-sub",
                variant: "body",
                color: "rgba(255,255,255,0.66)",
                size: bodyPx,
                align: "center",
                maxWidth: 560,
                motion: subIn,
              },
              "Watch every agent on one board",
            ),
          ),
        ),
        placedWindow(buildBoardScreen(0, true), "board", peekY, peek),
      );
    }

    const ctaIn = t.motion({
      id: "cta-block",
      during: "cta",
      at: "0%",
      for: "15%",
      y: 14,
      fromOpacity: 0,
      easing: "easeOutCubic",
    });
    const btnIn = t.motion({
      id: "cta-btn",
      during: "cta",
      at: "10%",
      for: "12%",
      scale: 0.95,
      fromOpacity: 0,
      easing: "easeOutCubic",
    });

    return stage(
      placedWindow(buildInsightsScreen(1), "insights", centerY, undefined, 0.62),
      Fill({
        id: "cta-scrim",
        width: "fill",
        height: "fill",
        gradient: {
          kind: "radial",
          at: "50% 50%",
          size: "52% 44%",
          stops: ["rgba(5,5,10,0.82)", "transparent"],
        },
      }),
      Stack(
        { id: "cta-block", align: "center", justify: "center", gap: 12, motion: ctaIn },
        Text({ variant: "label", color: accent, weight: 700 }, product),
        Text(
          {
            variant: "display",
            color: "#fff",
            size: titlePx,
            weight: 800,
            align: "center",
            letterSpacing: -1,
          },
          "Ship agents you can see",
        ),
        Text(
          {
            variant: "body",
            color: "rgba(255,255,255,0.55)",
            size: bodyPx,
            align: "center",
            maxWidth: 620,
          },
          "Every tool call, on your Mac",
        ),
        Surface(
          {
            id: "cta-btn",
            radius: 14,
            pad: { x: 28, y: 14 },
            fill: `linear-gradient(135deg,${accent},#34d399)`,
            motion: btnIn,
            style: { boxShadow: "0 12px 40px rgba(99,102,241,0.35)" },
          },
          Text({ variant: "title", color: "#fff", size: 17, weight: 700 }, cta),
        ),
      ),
    );
  },
});
