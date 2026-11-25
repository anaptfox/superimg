/**
 * Homepage diagram — causal flow (not three equal “hosts”):
 *
 *   You  ──┐
 *          ├──writes──►  *.media.ts  ──plays──►  Live (site)
 *   Agent ─┘                    └──exports──►  Export (YouTube / social)
 *
 * Authors = you and/or a coding agent. Live + Export consume the file.
 * editions: landscape 16:9 + portrait 9:16
 */
import { define, type RenderContext, googleFont } from "@foxworth/superimg";
import { Html } from "@foxworth/superimg";

const CSS = [
  "* { margin: 0; padding: 0; box-sizing: border-box; }",
  "body { overflow: hidden; font-family: Inter, system-ui, sans-serif; }",
];

/** Smoothstep 0→1 */
const smooth = (p: number) => {
  const x = Math.max(0, Math.min(1, p));
  return x * x * (3 - 2 * x);
};

/** Map phase progress into [0,1] over a sub-window of the phase */
const windowP = (p: number, start: number, end: number) => {
  if (end <= start) return p >= end ? 1 : 0;
  return smooth((p - start) / (end - start));
};

export const shipPathsTemplate = define({
  editions: {
    landscape: { size: { width: 1280, height: 720 } },
    portrait: { size: { width: 1080, height: 1920 } },
  },
  sample: {
    title: "Hello",
    product: "Relay",
    accent: "#818cf8",
  },
  config: {
    fps: 30,
    duration: 12,
    width: 1280,
    height: 720,
    fonts: [googleFont("Inter:wght@500;600;700;800"), googleFont("JetBrains+Mono:wght@500;600")],
    inlineCss: CSS,
  },
  render(ctx: RenderContext) {
    const { std, width, height, data, timeline } = ctx;
    const r = std.createResponsive(ctx);
    const ratio = width / height;
    const portrait = ratio < 0.85;
    const clamp = std.math.clamp;

    const accent = String(data.accent ?? "#818cf8");
    const title = String(data.title ?? "Hello");
    const product = String(data.product ?? "Relay");
    const ok = "#34d399";
    const mint = "#34d399";
    const violet = "#a78bfa";
    const ytRed = "#ff4e45";
    const igPink = "#e1306c";
    const xGray = "#e7e9ea";

    // Slightly larger type on reel so UI reads on a phone
    const labelPx = r({ portrait: 13, default: 11 }) ?? 11;
    const monoPx = r({ portrait: 12, default: 10.5 }) ?? 10.5;
    const panePad = r({ portrait: 12, default: 12 });
    const tiny = Math.max(8, monoPx - 2);

    // ── Ordered beats ────────────────────────────────────────────────────
    // Desktop: progressive graph (hosts stay once revealed)
    // Mobile/reel: step-by-step — only ONE host on screen at a time
    const t = ctx.director(
      portrait
        ? {
            seed: "8%",
            agent: "28%",
            live: "26%",
            export: "26%",
            all: "12%",
          }
        : {
            seed: "10%",
            agent: "24%",
            live: "22%",
            export: "22%",
            all: "22%",
          },
    );

    const seedP = t.in("seed");
    const agentP = t.in("agent");
    const liveP = t.in("live");
    const exportP = t.in("export");
    const allP = t.in("all");
    const settled = allP > 0;

    // Focus = active beat (desktop + mobile)
    const aFocus = !settled && agentP > 0 && liveP <= 0;
    const lFocus = !settled && liveP > 0 && exportP <= 0;
    const eFocus = !settled && exportP > 0 && allP <= 0;
    // Desktop keeps past hosts lit; mobile does not stack them
    const aPast = !portrait && (liveP > 0 || exportP > 0 || settled);
    const lPast = !portrait && (exportP > 0 || settled);
    const ePast = !portrait && settled;

    // Desktop: reveal & keep once shown
    const desktopBits = (p: number, past: boolean) => {
      if (settled || past) return { draw: 1, show: 1, content: 1 };
      return {
        draw: windowP(p, 0, 0.32),
        show: windowP(p, 0.12, 0.4),
        content: windowP(p, 0.28, 0.92),
      };
    };

    // Mobile: one step full-screen. Enter on focus; short exit when next step starts.
    const mobileStep = (
      p: number,
      focus: boolean,
      nextP: number,
      /** hold through settle (export only) */
      holdOnSettle: boolean,
    ) => {
      if (holdOnSettle && settled) {
        return { draw: 1, show: 1, content: 1 };
      }
      const exitP = nextP > 0 ? clamp(nextP / 0.12, 0, 1) : 0;
      if (focus) {
        return {
          draw: windowP(p, 0, 0.28),
          show: windowP(p, 0.05, 0.26),
          content: windowP(p, 0.2, 0.88),
        };
      }
      // Leaving this step (next has started)
      if (exitP > 0 && exitP < 1) {
        const k = 1 - exitP;
        return { draw: k, show: k, content: k };
      }
      return { draw: 0, show: 0, content: 0 };
    };

    const a = portrait
      ? mobileStep(agentP, aFocus, liveP, false)
      : desktopBits(agentP, aPast);
    const l = portrait
      ? mobileStep(liveP, lFocus, exportP, false)
      : desktopBits(liveP, lPast);
    const e = portrait
      ? mobileStep(exportP, eFocus || settled, 0, true)
      : desktopBits(exportP, ePast);

    // Hub enter
    const hubMotion = t.motion({
      id: "tpl",
      during: "seed",
      at: "0%",
      for: "80%",
      y: 16,
      fromOpacity: 0,
      easing: "easeOutCubic",
    });
    const hubStyle =
      seedP < 1 && agentP <= 0 && !settled
        ? hubMotion.style
        : "opacity:1;transform:none";

    // Enter: desktop rises; mobile slides from right (step turn)
    const hostEnter = (show: number, stepSlide: boolean) => {
      const op = show;
      if (stepSlide) {
        const x = std.interpolate(show, [0, 1], [28, 0], "easeOutCubic");
        const y = std.interpolate(show, [0, 1], [8, 0], "easeOutCubic");
        return { op, y, x };
      }
      const y = std.interpolate(show, [0, 1], [14, 0], "easeOutCubic");
      return { op, y, x: 0 };
    };
    const aEnter = hostEnter(a.show, portrait);
    const lEnter = hostEnter(l.show, portrait);
    const eEnter = hostEnter(e.show, portrait);

    // ── Geometry ─────────────────────────────────────────────────────────
    const padX = Math.round(width * (portrait ? 0.055 : 0.038));
    const padY = Math.round(height * (portrait ? 0.05 : 0.038));
    const footerH = Math.round(height * (portrait ? 0.07 : 0.042));
    const gap = Math.round(Math.min(width, height) * (portrait ? 0.016 : 0.014));

    // Mobile: compact hub (more room for the active step)
    const hubW = Math.round(width * (portrait ? 0.9 : 0.4));
    const hubH = Math.round(height * (portrait ? 0.14 : 0.2));
    const hubX = Math.round((width - hubW) / 2);
    const hubY = padY;

    const corridor = Math.round(height * (portrait ? 0.028 : 0.085));
    const hostTop = hubY + hubH + corridor;
    const hostBottom = height - padY - footerH;
    const hostSpan = Math.max(100, hostBottom - hostTop);

    let agentX: number, agentY: number, aW: number, aH: number;
    let liveX: number, liveY: number, lW: number, lH: number;
    let exportX: number, exportY: number, eW: number, eH: number;

    if (portrait) {
      // Single stage — each step fills the same full card under the template
      const stageW = width - padX * 2;
      const stageH = hostSpan;
      const stageX = padX;
      const stageY = hostTop;
      aW = lW = eW = stageW;
      aH = lH = eH = stageH;
      agentX = liveX = exportX = stageX;
      agentY = liveY = exportY = stageY;
    } else {
      // Landscape: unequal widths + heights + staggered Y
      const colGap = gap * 1.25;
      const totalW = width - padX * 2 - colGap * 2;
      aW = Math.floor(totalW * 0.32);
      lW = Math.floor(totalW * 0.4);
      eW = totalW - aW - lW;
      agentX = padX;
      liveX = agentX + aW + colGap;
      exportX = liveX + lW + colGap;

      lH = hostSpan;
      aH = Math.round(hostSpan * 0.92);
      eH = Math.round(hostSpan * 0.58);

      liveY = hostTop;
      agentY = hostTop + Math.round(hostSpan * 0.04);
      exportY = hostTop + Math.round(hostSpan * 0.22);
    }

    const portY = hubY + hubH;
    // Mobile: single center port (one line at a time into the stage)
    const aPortX = hubX + hubW * (portrait ? 0.5 : 0.16);
    const lPortX = hubX + hubW * (portrait ? 0.5 : 0.5);
    const ePortX = hubX + hubW * (portrait ? 0.5 : 0.84);

    const aLandX = agentX + aW / 2;
    const aLandY = agentY;
    const lLandX = liveX + lW / 2;
    const lLandY = liveY;
    const eLandX = exportX + eW / 2;
    const eLandY = exportY;

    // Mobile step index for dots (1–3)
    const stepIdx = aFocus ? 0 : lFocus ? 1 : eFocus || settled ? 2 : -1;

    // ── Edges ────────────────────────────────────────────────────────────
    const bezierLen = (
      x1: number,
      y1: number,
      c1x: number,
      c1y: number,
      c2x: number,
      c2y: number,
      x2: number,
      y2: number,
    ) => {
      let len = 0;
      let px = x1;
      let py = y1;
      for (let i = 1; i <= 16; i++) {
        const u = i / 16;
        const tt = 1 - u;
        const x =
          tt * tt * tt * x1 +
          3 * tt * tt * u * c1x +
          3 * tt * u * u * c2x +
          u * u * u * x2;
        const y =
          tt * tt * tt * y1 +
          3 * tt * tt * u * c1y +
          3 * tt * u * u * c2y +
          u * u * u * y2;
        len += Math.hypot(x - px, y - py);
        px = x;
        py = y;
      }
      return len;
    };

    const pointOn = (
      u: number,
      x1: number,
      y1: number,
      c1x: number,
      c1y: number,
      c2x: number,
      c2y: number,
      x2: number,
      y2: number,
    ) => {
      const tt = 1 - u;
      return {
        x:
          tt * tt * tt * x1 +
          3 * tt * tt * u * c1x +
          3 * tt * u * u * c2x +
          u * u * u * x2,
        y:
          tt * tt * tt * y1 +
          3 * tt * tt * u * c1y +
          3 * tt * u * u * c2y +
          u * u * u * y2,
      };
    };

    const flowEdge = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      draw: number,
      focus: boolean,
      complete: boolean,
      hue: string,
      id: string,
      side: number,
    ) => {
      const pe = smooth(clamp(draw, 0, 1));
      if (pe <= 0.001 && !complete) {
        // Nothing yet — no ghost track, no ports (keeps seed clean)
        return "";
      }

      const dy = y2 - y1;
      const spread = Math.abs(x2 - x1) * 0.15 + width * 0.02 * side;
      const c1x = x1 + spread * 0.35;
      const c1y = y1 + dy * 0.42;
      const c2x = x2 - spread * 0.2;
      const c2y = y2 - dy * 0.38;

      const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      const len = bezierLen(x1, y1, c1x, c1y, c2x, c2y, x2, y2);
      const drawn = len * pe;

      const strong = focus || complete || settled;
      const strokeOp = strong ? 0.95 : 0.55 + pe * 0.35;
      const strokeW = strong ? 2.4 : 1.8;

      // Tip follows draw; after complete, slow loop (only during settle)
      let uDot = pe;
      if (settled || (complete && pe >= 0.99)) {
        const phase = id === "a" ? 0 : id === "l" ? 0.33 : 0.66;
        uDot = (timeline.seconds * 0.45 + phase) % 1;
      }
      const tip = pointOn(uDot, x1, y1, c1x, c1y, c2x, c2y, x2, y2);
      const tipOp = pe > 0.04 ? (strong ? 1 : 0.75) : 0;
      const landOp = pe > 0.9 ? (strong ? 0.95 : 0.55) : pe * 0.4;

      return `
        <defs>
          <linearGradient id="g-${id}" gradientUnits="userSpaceOnUse"
            x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
            <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="${hue}" stop-opacity="1"/>
          </linearGradient>
          <filter id="f-${id}" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path d="${d}" fill="none" stroke="url(#g-${id})" stroke-width="${strokeW + 2}"
          stroke-linecap="round" opacity="${strokeOp * 0.32}" filter="url(#f-${id})"
          stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len - drawn).toFixed(1)}"/>
        <path d="${d}" fill="none" stroke="url(#g-${id})" stroke-width="${strokeW}"
          stroke-linecap="round" opacity="${strokeOp}"
          stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len - drawn).toFixed(1)}"/>
        <circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="${strong ? 3.6 : 2.6}"
          fill="${hue}" opacity="${tipOp}"/>
        <circle cx="${x2}" cy="${y2}" r="4.5" fill="${hue}" opacity="${landOp}"/>
        <circle cx="${x2}" cy="${y2}" r="7" fill="none" stroke="${hue}" stroke-width="1"
          opacity="${landOp * 0.4}"/>
        <circle cx="${x1}" cy="${y1}" r="3.2" fill="${accent}" opacity="${pe > 0.02 ? 0.9 : 0}"/>
      `;
    };

    // ── Author pane: you and/or agent write the same template ────────────
    // Dual author: you (human) and/or agent — same file lands in the hub
    type AuthLine =
      | { who: "you" | "agent" | "sys"; kind: "cmd"; text: string }
      | { who: "you" | "agent" | "sys"; kind: "out"; text: string; dim?: boolean }
      | { who: "sys"; kind: "ok"; text: string };

    const authLines: AuthLine[] = [
      { who: "you", kind: "cmd", text: "edit launch.media.ts" },
      { who: "agent", kind: "out", text: "draft define() + render(ctx)" },
      { who: "you", kind: "cmd", text: "superimg check launch.media.ts" },
      { who: "sys", kind: "ok", text: "✓ check passed · 0 issues" },
      { who: "sys", kind: "out", text: "template ready → live · export", dim: true },
    ];

    const cliPs = std.stagger.ms(authLines.length, a.content, {
      windowSeconds: 2.2,
      eachMs: 42,
      capMs: 180,
    });

    const lineMb = portrait ? 3 : 4;
    const whoChip = (who: "you" | "agent" | "sys") => {
      if (who === "you") {
        return `<span style="font:700 ${tiny}px JetBrains Mono,monospace;padding:1px 5px;border-radius:3px;
          background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.12);
          flex-shrink:0;">you</span>`;
      }
      if (who === "agent") {
        return `<span style="font:700 ${tiny}px JetBrains Mono,monospace;padding:1px 5px;border-radius:3px;
          background:rgba(129,140,248,0.18);color:${accent};border:1px solid rgba(129,140,248,0.35);
          flex-shrink:0;">agent</span>`;
      }
      return `<span style="width:28px;flex-shrink:0;"></span>`;
    };

    const cliHtml = authLines
      .map((line, i) => {
        const p = cliPs[i] ?? 0;
        const op = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
        const y = std.interpolate(p, [0, 1], [5, 0], "easeOutCubic");
        const chip = whoChip(line.who);
        if (line.kind === "cmd") {
          return `
            <div style="opacity:${op};transform:translateY(${y}px);margin-bottom:${lineMb}px;
              display:flex;align-items:center;gap:6px;min-width:0;">
              ${chip}
              <span style="font:500 ${monoPx}px JetBrains Mono,monospace;line-height:1.35;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,0.88);">
                <span style="color:${ok};">$</span> ${line.text}
              </span>
            </div>`;
        }
        if (line.kind === "ok") {
          return `
            <div style="opacity:${op};transform:translateY(${y}px);margin-bottom:${lineMb}px;
              display:flex;align-items:center;gap:6px;">
              ${chip}
              <span style="font:500 ${monoPx}px JetBrains Mono,monospace;color:${ok};">${line.text}</span>
            </div>`;
        }
        return `
          <div style="opacity:${op};transform:translateY(${y}px);margin-bottom:${lineMb}px;
            display:flex;align-items:center;gap:6px;min-width:0;">
            ${chip}
            <span style="font:500 ${monoPx}px JetBrains Mono,monospace;
              color:${line.dim ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.55)"};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${line.text}</span>
          </div>`;
      })
      .join("");

    const cursorOn =
      a.content > 0.85 && Math.floor(timeline.seconds * 2) % 2 === 0;
    const statusP = clamp((a.content - 0.5) / 0.4, 0, 1);

    const agentBody = `
      <div style="height:100%;border-radius:8px;background:#0b0b11;border:1px solid rgba(255,255,255,0.09);
        overflow:hidden;display:flex;flex-direction:column;">
        <div style="flex-shrink:0;height:${portrait ? 20 : 24}px;background:rgba(255,255,255,0.035);
          border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:6px;padding:0 8px;">
          <div style="display:flex;gap:4px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#ff5f56;"></div>
            <div style="width:6px;height:6px;border-radius:50%;background:#ffbd2e;"></div>
            <div style="width:6px;height:6px;border-radius:50%;background:#27ca40;"></div>
          </div>
          <span style="font:600 ${tiny}px JetBrains Mono,monospace;color:rgba(255,255,255,0.4);">
            editor · terminal
          </span>
          <span style="margin-left:auto;font:500 ${Math.max(7, tiny - 1)}px JetBrains Mono,monospace;
            color:rgba(255,255,255,0.25);">you · agent</span>
        </div>
        <div style="flex-shrink:0;padding:${portrait ? "5px 8px 0" : "7px 10px 0"};
          display:flex;gap:5px;flex-wrap:wrap;">
          <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;
            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);">
            <span style="font:600 ${Math.max(7, tiny - 1)}px JetBrains Mono,monospace;color:rgba(255,255,255,0.55);">you</span>
            <span style="font:500 ${Math.max(7, tiny - 1)}px Inter;color:rgba(255,255,255,0.35);">hand-write</span>
          </div>
          <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;
            background:rgba(129,140,248,0.1);border:1px solid rgba(129,140,248,0.22);">
            <span style="font:600 ${Math.max(7, tiny - 1)}px JetBrains Mono,monospace;color:${accent};">agent</span>
            <span style="font:500 ${Math.max(7, tiny - 1)}px Inter;color:rgba(255,255,255,0.35);">assist</span>
          </div>
        </div>
        <div style="flex:1;min-height:0;padding:${portrait ? "6px 8px" : "8px 10px"};overflow:hidden;
          display:flex;flex-direction:column;justify-content:flex-start;">
          ${cliHtml}
          <div style="height:12px;margin-top:2px;flex-shrink:0;padding-left:34px;">
            <span style="display:inline-block;width:7px;height:12px;background:${ok};
              opacity:${cursorOn ? 0.9 : 0};border-radius:1px;"></span>
          </div>
        </div>
        <div style="flex-shrink:0;padding:${portrait ? "5px 8px 7px" : "6px 10px 8px"};
          border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.25);
          display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font:600 ${Math.max(7, tiny - 1)}px JetBrains Mono,monospace;
            color:${statusP > 0.9 ? ok : "rgba(255,255,255,0.4)"};">
            ${statusP > 0.9 ? "launch.media.ts ready" : "authoring…"}
          </span>
          <span style="font:500 ${Math.max(7, tiny - 1)}px JetBrains Mono,monospace;
            color:rgba(255,255,255,0.28);">same file</span>
        </div>
      </div>`;

    // ── LIVE body: real homepage + embedded player that plays ────────────
    const heroPx = r({ portrait: 17, default: 15 }) ?? 15;
    const subPx = r({ portrait: 10, default: 9.5 });
    const siteTiny = r({ portrait: 9, default: 8 }) ?? 8;

    const liveInnerOp = l.content;
    const liveInnerY = std.interpolate(l.content, [0, 1], [8, 0], "easeOutCubic");

    // Embedded video “playing” once the live host has content
    const playing = l.content > 0.35 || lPast || settled;
    // Progress 0→1 loops while host is live (reads as real playback)
    const playProg = playing
      ? (timeline.seconds * 0.28 + l.content * 0.15) % 1
      : 0;
    const playPct = Math.round(playProg * 100);
    // Fake timecode ~0:00–0:08
    const playSec = Math.floor(playProg * 8);
    const timeStr = `0:0${playSec}`;
    // Motion inside the mini player (card + bg drift)
    const vidPhase = playing ? timeline.seconds : 0;
    const cardLift = playing ? Math.sin(vidPhase * 2.1) * 4 : 8;
    const cardScale = playing ? 0.94 + Math.sin(vidPhase * 1.6) * 0.03 : 0.9;
    const cardOp = playing ? 0.95 : 0.5;
    const bgShiftX = playing ? Math.sin(vidPhase * 0.7) * 8 : 0;
    const bgShiftY = playing ? Math.cos(vidPhase * 0.55) * 6 : 0;
    // Play button fades out once “playing”
    const playBtnOp = playing
      ? std.interpolate(l.content, [0.35, 0.55], [1, 0], "easeOutCubic")
      : std.interpolate(l.content, [0, 0.4], [0, 1], "easeOutCubic");
    const scrubH = portrait ? 3 : 3.5;
    const chromeH = portrait ? 20 : 26;
    const navH = portrait ? 22 : 28;

    const liveBody = `
      <div style="height:100%;border-radius:10px;background:#0a0a10;border:1px solid rgba(255,255,255,0.1);
        overflow:hidden;display:flex;flex-direction:column;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.03);">
        <!-- browser chrome -->
        <div style="flex-shrink:0;height:${chromeH}px;background:linear-gradient(180deg,#1a1a22,#121218);
          border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:6px;padding:0 8px;">
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <div style="width:7px;height:7px;border-radius:50%;background:#ff5f56;"></div>
            <div style="width:7px;height:7px;border-radius:50%;background:#ffbd2e;"></div>
            <div style="width:7px;height:7px;border-radius:50%;background:#27ca40;"></div>
          </div>
          <div style="flex:1;height:${portrait ? 12 : 15}px;border-radius:6px;background:rgba(0,0,0,0.4);
            border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:5px;padding:0 7px;min-width:0;">
            <span style="font:600 ${Math.max(7, siteTiny - 1)}px Inter;color:${ok};flex-shrink:0;">🔒</span>
            <span style="font:500 ${siteTiny}px JetBrains Mono,monospace;color:rgba(255,255,255,0.45);
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              https://${product.toLowerCase()}.dev
            </span>
          </div>
        </div>
        <!-- site -->
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;background:#0b0b12;
          opacity:${liveInnerOp};transform:translateY(${liveInnerY}px);">
          <!-- sticky-ish site header -->
          <div style="flex-shrink:0;height:${navH}px;display:flex;align-items:center;justify-content:space-between;
            padding:0 ${portrait ? 8 : 12}px;border-bottom:1px solid rgba(255,255,255,0.06);
            background:rgba(11,11,18,0.92);">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:${portrait ? 12 : 14}px;height:${portrait ? 12 : 14}px;border-radius:4px;
                background:linear-gradient(135deg,${accent},#34d399);"></div>
              <span style="font:800 ${labelPx}px Inter;color:#fff;letter-spacing:-0.4px;">${product}</span>
            </div>
            <div style="display:flex;gap:${portrait ? 8 : 12}px;align-items:center;">
              <span style="font:600 ${subPx}px Inter;color:rgba(255,255,255,0.5);">Product</span>
              <span style="font:600 ${subPx}px Inter;color:rgba(255,255,255,0.5);">Pricing</span>
              <span style="font:600 ${subPx}px Inter;color:rgba(255,255,255,0.5);">Docs</span>
              <span style="font:700 ${subPx}px Inter;padding:${portrait ? "3px 7px" : "4px 9px"};border-radius:6px;
                background:${accent};color:#0a0a12;">Sign in</span>
            </div>
          </div>
          <!-- page scroll area -->
          <div style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;
            padding:${portrait ? "8px 10px 6px" : "10px 14px 8px"};
            background:
              radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.12), transparent 55%),
              linear-gradient(180deg,#0c0c14 0%,#0a0a10 100%);">
            <!-- hero copy -->
            <div style="flex-shrink:0;margin-bottom:${portrait ? 6 : 8}px;">
              <div style="display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:999px;
                background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);margin-bottom:5px;">
                <span style="width:5px;height:5px;border-radius:50%;background:${violet};
                  box-shadow:0 0 6px ${violet};"></span>
                <span style="font:600 ${siteTiny}px Inter;color:${violet};letter-spacing:0.04em;">
                  NEW · PRODUCT LAUNCH
                </span>
              </div>
              <div style="font:800 ${heroPx}px/1.12 Inter;color:#fff;letter-spacing:-0.45px;margin-bottom:3px;">
                ${title}
              </div>
              <div style="font:500 ${subPx}px/1.35 Inter;color:rgba(255,255,255,0.42);max-width:95%;">
                Live product video on your homepage — same template as export.
              </div>
            </div>
            <!-- EMBEDDED PLAYER (playing) -->
            <div style="flex:1;min-height:${portrait ? 48 : 56}px;border-radius:9px;position:relative;overflow:hidden;
              border:1px solid rgba(255,255,255,0.12);
              box-shadow:0 8px 24px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.2);">
              <!-- animated scene bg -->
              <div style="position:absolute;inset:-12%;
                background:
                  radial-gradient(circle at ${42 + bgShiftX}% ${40 + bgShiftY}%, rgba(129,140,248,0.45), transparent 42%),
                  radial-gradient(circle at ${70 - bgShiftX * 0.5}% ${60 - bgShiftY * 0.5}%, rgba(52,211,153,0.2), transparent 40%),
                  linear-gradient(145deg,#12122a,#0a0a14 55%,#0d1520);
                transform:scale(1.05);"></div>
              <!-- mini “video” card content -->
              <div style="position:absolute;left:50%;top:42%;
                transform:translate(-50%,-50%) translateY(${cardLift}px) scale(${cardScale});
                opacity:${cardOp};text-align:center;pointer-events:none;">
                <div style="font:800 ${Math.round(heroPx * 1.15)}px Inter;color:#fff;letter-spacing:-0.5px;
                  text-shadow:0 2px 12px rgba(0,0,0,0.4);">${title}</div>
                <div style="margin-top:4px;font:600 ${siteTiny}px JetBrains Mono,monospace;color:rgba(255,255,255,0.45);">
                  ${product}
                </div>
              </div>
              <!-- play button (fades when playing) -->
              <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
                width:${portrait ? 28 : 34}px;height:${portrait ? 28 : 34}px;border-radius:50%;
                background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;
                opacity:${playBtnOp};box-shadow:0 4px 16px rgba(0,0,0,0.35);">
                <div style="width:0;height:0;border-left:${portrait ? 9 : 11}px solid #0a0a12;
                  border-top:${portrait ? 6 : 7}px solid transparent;border-bottom:${portrait ? 6 : 7}px solid transparent;
                  margin-left:2px;"></div>
              </div>
              <!-- player controls bar -->
              <div style="position:absolute;left:0;right:0;bottom:0;padding:${portrait ? "5px 7px 6px" : "6px 8px 7px"};
                background:linear-gradient(transparent,rgba(0,0,0,0.75));">
                <div style="height:${scrubH}px;border-radius:99px;background:rgba(255,255,255,0.15);
                  position:relative;overflow:visible;margin-bottom:4px;">
                  <div style="position:absolute;left:0;top:0;bottom:0;width:${playPct}%;
                    border-radius:99px;background:linear-gradient(90deg,${accent},${mint});"></div>
                  <div style="position:absolute;left:${playPct}%;top:50%;width:${portrait ? 7 : 8}px;height:${portrait ? 7 : 8}px;
                    margin-left:-4px;margin-top:-4px;border-radius:50%;background:#fff;
                    box-shadow:0 0 6px rgba(255,255,255,0.5);opacity:${playing ? 1 : 0.4};"></div>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <!-- pause icon when playing -->
                    <div style="display:flex;gap:2px;align-items:center;height:10px;">
                      <div style="width:2.5px;height:9px;border-radius:1px;background:rgba(255,255,255,0.85);
                        opacity:${playing ? 1 : 0.35};"></div>
                      <div style="width:2.5px;height:9px;border-radius:1px;background:rgba(255,255,255,0.85);
                        opacity:${playing ? 1 : 0.35};"></div>
                    </div>
                    <span style="font:600 ${Math.max(7, siteTiny - 1)}px JetBrains Mono,monospace;
                      color:rgba(255,255,255,0.65);">${timeStr} / 0:08</span>
                  </div>
                  <span style="font:600 ${Math.max(7, siteTiny - 1)}px Inter;color:rgba(255,255,255,0.4);">
                    ${playing ? "LIVE" : "Player"}
                  </span>
                </div>
              </div>
            </div>
            <!-- CTA row + trust strip -->
            <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;
              gap:6px;margin-top:${portrait ? 6 : 8}px;">
              <div style="display:flex;gap:5px;">
                <div style="padding:${portrait ? "4px 9px" : "5px 11px"};border-radius:6px;background:${accent};
                  font:700 ${subPx}px Inter;color:#0a0a12;">Get started</div>
                <div style="padding:${portrait ? "4px 9px" : "5px 11px"};border-radius:6px;
                  border:1px solid rgba(255,255,255,0.12);font:600 ${subPx}px Inter;color:rgba(255,255,255,0.55);">
                  Docs
                </div>
              </div>
              <span style="font:500 ${Math.max(7, siteTiny - 1)}px Inter;color:rgba(255,255,255,0.28);">
                Embed · SuperImg
              </span>
            </div>
          </div>
        </div>
      </div>`;

    // ── EXPORT body: compact icon cloud (space-efficient destinations) ───
    // Positions are % of cloud box; sizes relative to pane min dimension
    type CloudIcon = {
      id: string;
      glyph: string; // short mark
      c: string;
      x: number; // % left
      y: number; // % top
      s: number; // scale multiplier
    };
    const cloud: CloudIcon[] = [
      { id: "YouTube", glyph: "▶", c: ytRed, x: 38, y: 28, s: 1.15 },
      { id: "Reels", glyph: "◎", c: igPink, x: 62, y: 18, s: 1 },
      { id: "TikTok", glyph: "♪", c: "#25f4ee", x: 18, y: 36, s: 0.95 },
      { id: "Feed", glyph: "in", c: "#0a66c2", x: 72, y: 42, s: 0.9 },
      { id: "X", glyph: "𝕏", c: xGray, x: 28, y: 62, s: 0.88 },
      { id: "OG", glyph: "OG", c: mint, x: 54, y: 58, s: 0.85 },
      { id: "Stories", glyph: "◯", c: "#f59e0b", x: 78, y: 68, s: 0.78 },
      { id: "Shorts", glyph: "S", c: "#ff0033", x: 12, y: 68, s: 0.8 },
    ];

    const cloudPs = std.stagger.ms(cloud.length, e.content, {
      windowSeconds: 1.4,
      eachMs: 40,
      capMs: 160,
    });

    // Base icon size from host pane (compact)
    const iconBase = Math.round(
      Math.min(eW, eH) * (portrait ? 0.14 : 0.16),
    );
    const iconMin = portrait ? 22 : 26;
    const iconMax = portrait ? 40 : 48;

    const cloudHtml = cloud
      .map((d, i) => {
        const p = cloudPs[i] ?? 0;
        const op = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
        const sc = std.interpolate(p, [0, 1], [0.55, 1], "easeOutCubic");
        // Gentle float after settle — phase-offset so they don’t lock-step
        const float =
          settled || e.content > 0.95
            ? Math.sin(timeline.seconds * 1.4 + i * 0.9) * 2.5
            : std.interpolate(p, [0, 1], [10, 0], "easeOutCubic");
        const size = clamp(Math.round(iconBase * d.s), iconMin, iconMax);
        const fontSz = Math.max(9, Math.round(size * (d.glyph.length > 1 ? 0.32 : 0.42)));
        return `
          <div style="position:absolute;left:${d.x}%;top:${d.y}%;
            width:${size}px;height:${size}px;margin-left:${-size / 2}px;margin-top:${-size / 2}px;
            opacity:${op};transform:translateY(${float}px) scale(${sc});
            border-radius:${Math.round(size * 0.28)}px;
            background:linear-gradient(145deg,${std.color.alpha(d.c, 0.35)},${std.color.alpha(d.c, 0.08)});
            border:1px solid ${std.color.alpha(d.c, 0.5)};
            box-shadow:0 4px 14px ${std.color.alpha(d.c, 0.18)}, inset 0 1px 0 rgba(255,255,255,0.08);
            display:flex;align-items:center;justify-content:center;
            font:700 ${fontSz}px Inter,system-ui,sans-serif;color:#fff;letter-spacing:-0.02em;">
            ${d.glyph}
          </div>`;
      })
      .join("");

    const exportHeadOp = e.content;
    const exportBody = `
      <div style="height:100%;display:flex;flex-direction:column;min-height:0;">
        <div style="flex-shrink:0;font:600 ${tiny}px Inter;color:rgba(255,255,255,0.4);
          letter-spacing:0.02em;opacity:${exportHeadOp};margin-bottom:2px;">
          YouTube · social · OG
        </div>
        <div style="flex:1;min-height:0;position:relative;overflow:hidden;">
          <!-- soft cloud glow -->
          <div style="position:absolute;left:50%;top:48%;width:70%;height:70%;
            transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;
            background:radial-gradient(circle,rgba(52,211,153,0.1),transparent 68%);
            opacity:${exportHeadOp};"></div>
          ${cloudHtml}
        </div>
      </div>`;

    const ring = (focus: boolean, complete: boolean, hue: string) => {
      if (focus) {
        return `0 0 0 1.5px ${std.color.alpha(hue, 0.65)}, 0 14px 36px ${std.color.alpha(hue, 0.2)}`;
      }
      if (complete || settled) {
        return `0 0 0 1px ${std.color.alpha(hue, 0.35)}, 0 8px 24px ${std.color.alpha(hue, 0.1)}`;
      }
      return "0 6px 18px rgba(0,0,0,0.28)";
    };

    const pane = (
      x: number,
      y: number,
      w: number,
      h: number,
      label: string,
      body: string,
      enter: { op: number; y: number; x: number },
      focus: boolean,
      complete: boolean,
      hue: string,
      stepN?: number,
    ) => {
      if (enter.op < 0.01) return "";
      const stepTag =
        portrait && stepN
          ? `<span style="font:600 ${Math.max(8, tiny - 1)}px JetBrains Mono,monospace;
              color:rgba(255,255,255,0.3);margin-left:8px;">${stepN}/3</span>`
          : "";
      return `
      <div style="position:absolute;left:${x + enter.x}px;top:${y + enter.y}px;width:${w}px;height:${h}px;
        opacity:${enter.op};border-radius:12px;padding:${panePad}px;box-sizing:border-box;
        background:linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));
        border:1px solid rgba(255,255,255,${focus ? 0.16 : complete || settled ? 0.12 : 0.08});
        box-shadow:${ring(focus, complete || (portrait && focus), hue)};
        display:flex;flex-direction:column;min-height:0;z-index:2;">
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:${portrait ? 6 : 7}px;flex-shrink:0;">
          <div style="display:flex;align-items:center;">
            <div style="font:700 ${labelPx}px Inter;letter-spacing:0.1em;text-transform:uppercase;
              color:${focus || complete || settled ? hue : "rgba(255,255,255,0.5)"};">${label}</div>
            ${stepTag}
          </div>
          <div style="width:6px;height:6px;border-radius:50%;
            background:${focus || complete || settled ? hue : "rgba(255,255,255,0.2)"};
            box-shadow:${focus ? `0 0 10px ${hue}` : complete || settled ? `0 0 6px ${std.color.alpha(hue, 0.5)}` : "none"};"></div>
        </div>
        <div style="flex:1;min-height:0;overflow:hidden;">${body}</div>
      </div>`;
    };

    // ── Hub: TypeScript editor ───────────────────────────────────────────
    const kw = "#c4b5fd";
    const fn = "#93c5fd";
    const str = "#86efac";
    const punc = "rgba(255,255,255,0.45)";
    const plain = "rgba(255,255,255,0.78)";
    const dim = "rgba(255,255,255,0.32)";
    const codePx = r({ portrait: 12, default: 10 }) ?? 10;
    const lineH = portrait ? 1.35 : 1.38;
    const tabH = portrait ? 26 : 22;

    const tsLine = (n: number, html: string) => `
      <div style="display:flex;gap:7px;line-height:${lineH};white-space:nowrap;">
        <span style="width:12px;text-align:right;flex-shrink:0;color:${dim};">${n}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;">${html}</span>
      </div>`;

    const hubGlow = settled
      ? `0 0 0 1px rgba(0,0,0,0.4),0 0 44px ${std.color.alpha(accent, 0.3)},0 12px 32px rgba(0,0,0,0.45)`
      : `0 0 0 1px rgba(0,0,0,0.4),0 0 28px ${std.color.alpha(accent, 0.2)},0 12px 28px rgba(0,0,0,0.4)`;

    const hub = `
      <div style="position:absolute;left:${hubX}px;top:${hubY}px;width:${hubW}px;height:${hubH}px;
        border-radius:10px;display:flex;flex-direction:column;z-index:3;overflow:hidden;
        background:#0d0d14;
        border:1px solid ${std.color.alpha(accent, 0.5)};
        box-shadow:${hubGlow};
        ${hubStyle}">
        <div style="flex-shrink:0;height:${tabH}px;background:rgba(255,255,255,0.04);
          border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:6px;padding:0 8px;">
          <div style="display:flex;gap:4px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#ff5f56;"></div>
            <div style="width:6px;height:6px;border-radius:50%;background:#ffbd2e;"></div>
            <div style="width:6px;height:6px;border-radius:50%;background:#27ca40;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;padding:2px 8px;border-radius:5px 5px 0 0;
            background:rgba(129,140,248,0.12);border:1px solid rgba(129,140,248,0.25);border-bottom:none;">
            <span style="font:600 ${Math.max(8, codePx - 0.5)}px JetBrains Mono,monospace;color:${accent};">TS</span>
            <span style="font:600 ${Math.max(8, codePx - 0.5)}px JetBrains Mono,monospace;color:rgba(255,255,255,0.7);">
              launch.media.ts
            </span>
          </div>
        </div>
        <div style="flex:1;min-height:0;padding:5px 8px 6px;font:500 ${codePx}px/1.4 JetBrains Mono,monospace;
          overflow:hidden;background:linear-gradient(180deg,#0c0c12,#0a0a10);">
          ${tsLine(1, `<span style="color:${kw}">import</span> <span style="color:${punc}">{</span> <span style="color:${fn}">define</span> <span style="color:${punc}">}</span> <span style="color:${kw}">from</span> <span style="color:${str}">"superimg"</span><span style="color:${punc}">;</span>`)}
          ${tsLine(2, `<span style="color:${dim}">// you or agent</span>`)}
          ${tsLine(3, `<span style="color:${kw}">export default</span> <span style="color:${fn}">define</span><span style="color:${punc}">({</span>`)}
          ${tsLine(4, `&nbsp;&nbsp;<span style="color:${plain}">config</span><span style="color:${punc}">:</span> <span style="color:${punc}">{</span> <span style="color:${plain}">duration</span><span style="color:${punc}">:</span> <span style="color:#fbbf24;">8</span> <span style="color:${punc}">},</span>`)}
          ${tsLine(5, `&nbsp;&nbsp;<span style="color:${fn}">render</span><span style="color:${punc}">(</span><span style="color:${plain}">ctx</span><span style="color:${punc}">)</span> <span style="color:${punc}">{</span>`)}
          ${tsLine(6, `&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:${kw}">return</span> <span style="color:${str}">\`&lt;h1&gt;${title}&lt;/h1&gt;\`</span><span style="color:${punc}">;</span>`)}
          ${tsLine(7, `&nbsp;&nbsp;<span style="color:${punc}">},</span>`)}
          ${tsLine(8, `<span style="color:${punc}">});</span>`)}
        </div>
      </div>`;

    // Footer only after export content is mostly in
    const footerOp = settled
      ? 1
      : std.interpolate(e.content, [0.6, 1], [0, 0.9], "easeOutCubic");

    return Html({ width: "fill", height: "fill", html: `
      <div style="${std.css({
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#07070c",
      })}">
        <div style="position:absolute;inset:0;background:
          radial-gradient(ellipse 55% 35% at 50% 8%, rgba(99,102,241,0.16), transparent 55%),
          radial-gradient(ellipse 30% 30% at 18% 70%, rgba(129,140,248,0.07), transparent 50%),
          radial-gradient(ellipse 30% 30% at 82% 70%, rgba(52,211,153,0.06), transparent 50%),
          linear-gradient(180deg,#06060b,#0c0c14 45%,#07070c);"></div>

        <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1;">
          <!-- You/Agent → template (authors). Template → Live / Export (consumes). -->
          ${flowEdge(aLandX, aLandY, aPortX, portY, a.draw, aFocus, aPast || (portrait && aFocus), accent, "a", -1)}
          ${flowEdge(lPortX, portY, lLandX, lLandY, l.draw, lFocus, lPast || (portrait && lFocus), violet, "l", 0)}
          ${flowEdge(ePortX, portY, eLandX, eLandY, e.draw, eFocus || (portrait && settled), ePast || (portrait && (eFocus || settled)), mint, "e", 1)}
        </svg>

        ${pane(agentX, agentY, aW, aH, "You / Agent", agentBody, aEnter, aFocus, aPast, accent, 1)}
        ${pane(liveX, liveY, lW, lH, "Live", liveBody, lEnter, lFocus, lPast, violet, 2)}
        ${pane(exportX, exportY, eW, eH, "Export", exportBody, eEnter, eFocus || (portrait && settled), ePast, mint, 3)}

        ${hub}

        <div style="position:absolute;left:${padX}px;right:${padX}px;bottom:${Math.round(padY * 0.3)}px;
          height:${footerH}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:6px;z-index:2;opacity:${portrait ? (agentP > 0 || settled ? 1 : footerOp) : footerOp};">
          ${
            portrait
              ? `<div style="display:flex;align-items:center;gap:8px;">
                  ${[0, 1, 2]
                    .map((i) => {
                      const on = stepIdx === i;
                      const done = stepIdx > i;
                      const c = i === 0 ? accent : i === 1 ? violet : mint;
                      return `<div style="width:${on ? 18 : 7}px;height:7px;border-radius:99px;
                        background:${on || done ? c : "rgba(255,255,255,0.15)"};
                        opacity:${on ? 1 : done ? 0.55 : 0.35};"></div>`;
                    })
                    .join("")}
                </div>
                <div style="font:600 ${Math.max(9, labelPx - 1)}px Inter;letter-spacing:0.06em;text-transform:uppercase;
                  color:rgba(255,255,255,0.35);">
                  ${
                    stepIdx === 0
                      ? "Step 1 · You or agent write"
                      : stepIdx === 1
                        ? "Step 2 · Live on your site"
                        : stepIdx === 2
                          ? "Step 3 · Export to social"
                          : "One media program"
                  }
                </div>`
              : `<div style="font:600 ${labelPx}px Inter;letter-spacing:0.06em;text-transform:uppercase;
                  color:rgba(255,255,255,0.32);">you or agent · live · export</div>`
          }
        </div>
      </div>
    ` });
  },
});
