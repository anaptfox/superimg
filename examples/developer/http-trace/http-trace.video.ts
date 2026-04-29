import { defineScene, type RenderContext } from "superimg";
import { type ThemeName } from "superimg/stdlib/code";
import {
  type HttpMethod,
  METHOD_COLORS,
  getStatusColor,
  prettyJson,
  parseHeaders,
  streamCode,
} from "../../_http-helpers";

export type ThemeKey = "dark" | "light" | "insomnia" | "postman";

export interface HttpTraceData extends Record<string, unknown> {
  method: HttpMethod;
  endpoint: string;
  summary?: string;
  requestHeaders: string;
  requestBody: string;
  responseStatus: number;
  responseStatusText: string;
  responseHeaders: string;
  responseBody: string;
  responseTimeMs?: number;
  requestId?: string;
  /** Key takeaway from the response — pops in as a callout chip during settle. */
  keyResult?: string;
  theme: ThemeKey;
  showHeaders: boolean;
}

interface ThemePalette {
  bg: string;
  panel: string;
  panelBorder: string;
  text: string;
  muted: string;
  codeBg: string;
  shiki: ThemeName;
}

const THEMES: Record<ThemeKey, ThemePalette> = {
  dark: {
    bg: "#0f0f12",
    panel: "#17171c",
    panelBorder: "rgba(255,255,255,0.06)",
    text: "#f5f5f7",
    muted: "#8b8b95",
    codeBg: "#16161e",
    shiki: "dark-plus",
  },
  light: {
    bg: "#f6f7f9",
    panel: "#ffffff",
    panelBorder: "rgba(0,0,0,0.08)",
    text: "#18181b",
    muted: "#6b7280",
    codeBg: "#f3f4f6",
    shiki: "github-light",
  },
  insomnia: {
    bg: "#1c1c24",
    panel: "#2a2a38",
    panelBorder: "rgba(155,128,255,0.12)",
    text: "#f5f3ff",
    muted: "#9d9bb5",
    codeBg: "#1f1f2c",
    shiki: "dracula",
  },
  postman: {
    bg: "#1c1c1c",
    panel: "#2a2a2a",
    panelBorder: "rgba(255,108,55,0.18)",
    text: "#f5f5f5",
    muted: "#a1a1a1",
    codeBg: "#1f1f1f",
    shiki: "github-dark",
  },
};

function shikiCss(): string {
  return `
    pre.shiki { margin: 0; padding: 0; background: transparent !important; font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace; font-size: 22px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    pre.shiki code { background: transparent !important; }
  `;
}

export default defineScene<HttpTraceData>({
  data: {
    method: "POST",
    endpoint: "/v1/users",
    summary: "Create a new user with one call.",
    requestHeaders: JSON.stringify({ "Content-Type": "application/json", Authorization: "Bearer sk_•••" }),
    requestBody: JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" }, null, 2),
    responseStatus: 201,
    responseStatusText: "Created",
    responseHeaders: "",
    responseBody: JSON.stringify(
      { id: "usr_4f8a", name: "Ada Lovelace", email: "ada@example.com", createdAt: "2026-04-19T10:30:00Z" },
      null,
      2,
    ),
    responseTimeMs: 47,
    requestId: "req_01HG7K2P",
    keyResult: "→ usr_4f8a",
    theme: "dark",
    showHeaders: false,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 8,
    fonts: ["JetBrains+Mono:wght@400;500;600", "Inter:wght@400;500;600;700;800"],
  },
  render(ctx: RenderContext<HttpTraceData>) {
    const { std, width, height, sceneTimeSeconds, data } = ctx;
    const {
      method,
      endpoint,
      summary,
      requestHeaders,
      requestBody,
      responseStatus,
      responseStatusText,
      responseBody,
      responseTimeMs,
      requestId,
      keyResult,
      theme,
      showHeaders,
    } = data;

    const palette = THEMES[theme] ?? THEMES.dark;
    const methodColor = METHOD_COLORS[method] ?? "#71717a";
    const statusColor = getStatusColor(responseStatus);
    const isLight = theme === "light";

    // Unified timeline
    const t = std.score({
      stage: 0.08,
      layout: 0.1,
      request: 0.2,
      arrow: 0.08,
      status: 0.09,
      response: 0.27,
      callout: 0.1,
      settle: 0.08
    });

    // Stage intro: dominant from frame 0, gracefully bows out as layout assembles.
    const layoutP = t.within("layout");
    const stageOp = 1 - layoutP;
    const stageScale = std.spring(1.04, 1, t.within("stage"), { stiffness: 140, damping: 14 });
    const headerOp = std.interpolate(layoutP, [0, 1], [0, 1], "easeOutCubic");

    const panelY = std.interpolate(layoutP, [0, 1], [40, 0], "easeOutCubic");
    const panelOp = std.interpolate(layoutP, [0, 1], [0, 1], "easeOutCubic");

    const statusP = t.within("status");
    const statusScale = std.spring(0.7, 1, statusP, { stiffness: 200, damping: 12 });
    const statusOp = std.interpolate(statusP, [0, 1], [0, 1], "easeOutCubic");
    const settlePulse = t.active === "settle" ? 1 + Math.sin(t.within("settle") * Math.PI) * 0.04 : 1;

    const calloutP = t.within("callout");
    const calloutScale = std.spring(0.7, 1, calloutP, { stiffness: 220, damping: 13 });
    const calloutOp = std.interpolate(calloutP, [0, 1], [0, 1], "easeOutCubic");
    const calloutGlow = std.interpolate(calloutP, [0, 1], [0, 18], "easeOutCubic");

    const reqBodyPretty = prettyJson(requestBody ?? "");
    const resBodyPretty = prettyJson(responseBody ?? "");

    const reqStream = reqBodyPretty
      ? streamCode(std, reqBodyPretty, t.within("request"), {
          lang: "json",
          theme: palette.shiki,
          variance: 0.7,
          time: sceneTimeSeconds,
          accentColor: methodColor,
        })
      : null;
    const resStream = resBodyPretty
      ? streamCode(std, resBodyPretty, t.within("response"), {
          lang: "json",
          theme: palette.shiki,
          variance: 0.7,
          time: sceneTimeSeconds,
          accentColor: statusColor,
        })
      : null;

    const reqHeadersMap = parseHeaders(requestHeaders);
    const reqHeadersHtml = showHeaders && Object.keys(reqHeadersMap).length > 0
      ? `<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid ${palette.panelBorder};font-family:'JetBrains Mono',monospace;font-size:14px;line-height:1.7;">${
          Object.entries(reqHeadersMap)
            .map(([k, v]) => `<div><span style="color:${methodColor};">${k}</span>: <span style="color:${palette.muted};">${v}</span></div>`)
            .join("")
        }</div>`
      : "";

    const arrowP = t.within("arrow");
    const arrowDashTotal = 80;
    const arrowDashOffset = (1 - arrowP) * arrowDashTotal;
    const arrowHeadOp = arrowP > 0.6 ? std.interpolate((arrowP - 0.6) / 0.4, [0, 1], [0, 1], "easeOutCubic") : 0;

    const reqReveal = reqStream
      ? reqStream.html
      : `<div style="color:${palette.muted};font-style:italic;">No request body</div>`;
    const resReveal = resStream
      ? resStream.html
      : `<div style="color:${palette.muted};font-style:italic;">No response body</div>`;

    return `
    <style>
      * { box-sizing: border-box; }
      ${shikiCss()}
      .tabular { font-variant-numeric: tabular-nums; }
      body { margin: 0; }
    </style>
    <div style="position:relative;width:${width}px;height:${height}px;background:${palette.bg};color:${palette.text};font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;">

      ${
        stageOp > 0.01
          ? `
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;opacity:${stageOp};transform:scale(${stageScale});">
          <div style="display:flex;align-items:center;gap:18px;margin-bottom:28px;">
            <div style="background:${methodColor};color:white;font-weight:700;font-size:28px;padding:14px 26px;border-radius:12px;letter-spacing:0.5px;">${method}</div>
            <div style="font-size:42px;font-family:'JetBrains Mono',monospace;font-weight:500;color:${palette.text};">${endpoint}</div>
          </div>
          ${summary ? `<div style="font-size:56px;font-weight:700;letter-spacing:-1.5px;line-height:1.1;max-width:1300px;color:${palette.text};">${summary}</div>` : ""}
        </div>
      `
          : ""
      }

      <div style="position:absolute;inset:0;padding:60px 72px;display:flex;flex-direction:column;gap:28px;opacity:${headerOp};">

        <header style="display:flex;align-items:flex-start;gap:20px;">
          <div style="background:${methodColor};color:white;font-weight:700;font-size:24px;padding:11px 20px;border-radius:10px;letter-spacing:0.5px;">${method}</div>
          <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;">
            <div style="font-size:30px;font-family:'JetBrains Mono',monospace;font-weight:500;word-break:break-all;">${endpoint}</div>
            ${summary ? `<div style="font-size:20px;color:${palette.muted};">${summary}</div>` : ""}
            ${requestId ? `<div style="font-size:13px;color:${palette.muted};font-family:'JetBrains Mono',monospace;opacity:0.7;">${requestId}</div>` : ""}
          </div>
        </header>

        <main style="flex:1;display:flex;gap:36px;align-items:center;min-height:0;opacity:${panelOp};transform:translateY(${panelY}px);">

          <section style="flex:1;display:flex;flex-direction:column;gap:14px;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:${palette.muted};text-transform:uppercase;letter-spacing:1.5px;">Request</div>
            <div style="background:${palette.codeBg};border-radius:14px;padding:28px;border:1px solid ${palette.panelBorder};overflow:hidden;">
              ${reqHeadersHtml}
              ${reqReveal}
            </div>
          </section>

          <div style="display:flex;align-items:center;justify-content:center;width:90px;flex-shrink:0;">
            <svg width="90" height="44" viewBox="0 0 90 44" style="overflow:visible;">
              <line x1="6" y1="22" x2="84" y2="22" stroke="${palette.muted}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${arrowDashTotal}" stroke-dashoffset="${arrowDashOffset}" />
              <polyline points="72,12 84,22 72,32" fill="none" stroke="${palette.muted}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${arrowHeadOp}" />
            </svg>
          </div>

          <section style="flex:1;display:flex;flex-direction:column;gap:14px;min-width:0;">
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;min-height:36px;">
              <div style="font-size:14px;font-weight:600;color:${palette.muted};text-transform:uppercase;letter-spacing:1.5px;">Response</div>
              ${
                statusP > 0
                  ? `<div class="tabular" style="background:${statusColor}1a;color:${statusColor};font-weight:700;font-size:18px;padding:6px 14px;border-radius:8px;border:1px solid ${statusColor}55;opacity:${statusOp};transform:scale(${statusScale * settlePulse});transform-origin:left center;">${responseStatus} ${responseStatusText}</div>`
                  : ""
              }
              ${
                statusP > 0 && responseTimeMs != null
                  ? `<div class="tabular" style="font-size:14px;color:${palette.muted};font-family:'JetBrains Mono',monospace;opacity:${statusOp};">${responseTimeMs}ms</div>`
                  : ""
              }
              ${
                calloutP > 0 && keyResult
                  ? `<div style="margin-left:auto;display:inline-flex;align-items:center;gap:8px;background:${statusColor}22;color:${statusColor};font-weight:700;font-size:18px;padding:8px 16px;border-radius:10px;border:1px solid ${statusColor}88;opacity:${calloutOp};transform:scale(${calloutScale});box-shadow:0 0 ${calloutGlow}px ${statusColor}66;font-family:'JetBrains Mono',monospace;">${keyResult}</div>`
                  : ""
              }
            </div>
            <div style="background:${palette.codeBg};border-radius:14px;padding:28px;border:1px solid ${statusP > 0 ? statusColor + (isLight ? "55" : "33") : palette.panelBorder};overflow:hidden;">
              ${resReveal}
            </div>
          </section>

        </main>
      </div>

    </div>
    `;
  },
});
