import { defineScene, type RenderContext } from "superimg";
import { highlight } from "@superimg/stdlib/code";
import {
  type HttpMethod,
  METHOD_COLORS,
  getStatusColor,
  prettyJson,
  streamCode,
} from "../../_http-helpers";

/** Radiating sparkles burst, used for the response moment. */
function sparkles(count: number, progress: number, accentColor: string): string {
  let html = "";
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const dist = 100 + progress * 200;
    const x = 50 + Math.cos(ang) * dist * (progress * 0.5 + 0.5);
    const y = 50 + Math.sin(ang) * dist * (progress * 0.5 + 0.5);
    const sc = 1 - progress * 0.5;
    const op = 1 - progress;
    html += `<div style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%) scale(${sc});width:4px;height:4px;background:${accentColor};border-radius:50%;box-shadow:0 0 10px ${accentColor},0 0 20px ${accentColor};opacity:${op};"></div>`;
  }
  return html;
}

export interface ApiBrand {
  name: string;
  logoSvg?: string;
  domain?: string;
  accentColor?: string;
}

export interface SpotlightMetric {
  label: string;
  value: string;
  delta?: string;
}

export interface SpotlightCta {
  text: string;
  url?: string;
}

export interface HttpSpotlightData extends Record<string, unknown> {
  apiBrand: ApiBrand;
  summary: string;
  method: HttpMethod;
  endpoint: string;
  requestBody: string;
  responseStatus: number;
  responseStatusText: string;
  responseBody: string;
  metric?: SpotlightMetric;
  cta?: SpotlightCta;
}

const PALETTE = {
  bg: "#0a0a0f",
  panel: "#13131a",
  panelBorder: "rgba(255,255,255,0.06)",
  text: "#f5f5f7",
  muted: "#8b8b95",
  codeBg: "#16161e",
} as const;

const DEFAULT_ACCENT = "#7c3aed";

const TIMING = {
  titleCard: { start: 0.0, end: 0.12 },
  layoutIn: { start: 0.12, end: 0.25 },
  requestIn: { start: 0.2, end: 0.4 },
  arrow: { start: 0.4, end: 0.5 },
  responseSlam: { start: 0.5, end: 0.58 },
  responseStream: { start: 0.5, end: 0.82 },
  sparkleBurst: { start: 0.5, end: 0.78 },
  metricIn: { start: 0.78, end: 0.88 },
  ctaIn: { start: 0.86, end: 0.97 },
};

export default defineScene<HttpSpotlightData>({
  data: {
    apiBrand: {
      name: "Acme",
      domain: "api.acme.dev",
      accentColor: "#7c3aed",
    },
    summary: "One call. Zero setup.",
    method: "POST",
    endpoint: "/v1/checkout/sessions",
    requestBody: JSON.stringify(
      { customer: "cus_4f8a", amount: 4900, currency: "usd" },
      null,
      2,
    ),
    responseStatus: 201,
    responseStatusText: "Created",
    responseBody: JSON.stringify(
      { id: "cs_test_a1B2", url: "https://pay.acme.dev/cs_test_a1B2", expiresAt: 1735689600 },
      null,
      2,
    ),
    metric: { label: "p99", value: "32ms", delta: "3× faster than v1" },
    cta: { text: "Try it →", url: "acme.dev/docs" },
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    fonts: ["JetBrains+Mono:wght@400;500;600", "Inter:wght@400;500;600;700;800"],
  },
  render(ctx: RenderContext<HttpSpotlightData>) {
    const { std, width, height, sceneProgress, sceneTimeSeconds, data } = ctx;
    const {
      apiBrand,
      summary,
      method,
      endpoint,
      requestBody,
      responseStatus,
      responseStatusText,
      responseBody,
      metric,
      cta,
    } = data;

    const accent = apiBrand.accentColor || DEFAULT_ACCENT;
    const methodColor = METHOD_COLORS[method] ?? "#8b8b95";
    const statusColor = getStatusColor(responseStatus);
    const isSuccess = responseStatus >= 200 && responseStatus < 300;

    const titleP = std.interpolate(sceneProgress, [TIMING.titleCard.start, TIMING.titleCard.end], [0, 1]);
    const layoutP = std.interpolate(sceneProgress, [TIMING.layoutIn.start, TIMING.layoutIn.end], [0, 1]);
    const reqP = std.interpolate(sceneProgress, [TIMING.requestIn.start, TIMING.requestIn.end], [0, 1]);
    const arrowP = std.interpolate(sceneProgress, [TIMING.arrow.start, TIMING.arrow.end], [0, 1]);
    const slamP = std.interpolate(sceneProgress, [TIMING.responseSlam.start, TIMING.responseSlam.end], [0, 1]);
    const streamP = std.interpolate(sceneProgress, [TIMING.responseStream.start, TIMING.responseStream.end], [0, 1]);
    const sparkleP = std.interpolate(sceneProgress, [TIMING.sparkleBurst.start, TIMING.sparkleBurst.end], [0, 1]);
    const metricP = std.interpolate(sceneProgress, [TIMING.metricIn.start, TIMING.metricIn.end], [0, 1]);
    const ctaP = std.interpolate(sceneProgress, [TIMING.ctaIn.start, TIMING.ctaIn.end], [0, 1]);

    // Title card → header morph: title visible immediately (front-loaded hook),
    // gracefully fades out as the layout assembles.
    const titleHeroOp = 1 - layoutP;
    const titleHeroScale = std.spring(1.04, 1, Math.min(1, titleP * 1.6), { stiffness: 140, damping: 14 });
    const headerOp = std.interpolate(layoutP, [0, 1], [0, 1], "easeOutCubic");

    // Panels slide up
    const panelY = std.interpolate(layoutP, [0, 1], [40, 0], "easeOutCubic");
    const panelOp = std.interpolate(layoutP, [0, 1], [0, 1], "easeOutCubic");

    // Request body fades in whole (not type-out)
    const reqOp = std.interpolate(reqP, [0, 1], [0, 1], "easeOutCubic");

    // Arrow draw + traveling dot
    const arrowDashTotal = 100;
    const arrowDashOffset = (1 - arrowP) * arrowDashTotal;
    const dotProgress = arrowP > 0.4 ? (arrowP - 0.4) / 0.6 : 0;
    const dotX = 8 + dotProgress * 80; // svg viewBox is 0-100 wide

    // Status slam-in
    const statusScale = std.spring(0.4, 1, slamP, { stiffness: 220, damping: 11 });
    const statusOp = std.interpolate(slamP, [0, 1], [0, 1], "easeOutCubic");
    const statusGlow = std.interpolate(slamP, [0, 1], [0, 32], "easeOutCubic");
    const responseBodyOp = std.interpolate(slamP, [0, 1], [0, 1], "easeOutCubic");

    // Metric
    const metricY = std.interpolate(metricP, [0, 1], [20, 0], "easeOutCubic");
    const metricOp = std.interpolate(metricP, [0, 1], [0, 1], "easeOutCubic");

    // CTA
    const ctaX = std.interpolate(ctaP, [0, 1], [40, 0], "easeOutCubic");
    const ctaOp = std.interpolate(ctaP, [0, 1], [0, 1], "easeOutCubic");

    // Request: appears whole (devs read JSON fast — front-loaded design).
    const reqHl = requestBody
      ? highlight(prettyJson(requestBody), { lang: "json", theme: "dark-plus" })
      : "";
    // Response: streams in LLM-style — natural cadence, blinking cursor at the
    // leading edge. This is the storytelling moment of the video.
    const resStream = responseBody
      ? streamCode(std, prettyJson(responseBody), streamP, {
          lang: "json",
          theme: "dark-plus",
          variance: 0.75,
          time: sceneTimeSeconds,
          accentColor: accent,
        })
      : null;

    const sparklesHtml =
      isSuccess && sparkleP > 0 && sparkleP < 1
        ? `<div style="position:absolute;inset:0;pointer-events:none;">${sparkles(18, sparkleP, accent)}</div>`
        : "";

    const brandHtml = `
      <div style="display:flex;align-items:center;gap:12px;">
        ${apiBrand.logoSvg ? `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:${accent};">${apiBrand.logoSvg}</div>` : `<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,${accent},${accent}88);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:white;">${apiBrand.name.charAt(0)}</div>`}
        <div style="display:flex;flex-direction:column;gap:2px;line-height:1.1;">
          <div style="font-size:18px;font-weight:700;color:${PALETTE.text};">${apiBrand.name}</div>
          ${apiBrand.domain ? `<div style="font-size:13px;color:${PALETTE.muted};font-family:'JetBrains Mono',monospace;">${apiBrand.domain}</div>` : ""}
        </div>
      </div>
    `;

    return `
    <style>
      * { box-sizing: border-box; }
      pre.shiki { margin:0; padding:0; background:transparent !important; font-family:'JetBrains Mono','SF Mono',monospace; font-size:22px; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
      pre.shiki code { background:transparent !important; }
      .tabular { font-variant-numeric: tabular-nums; }
      body { margin:0; }
    </style>
    <div style="position:relative;width:${width}px;height:${height}px;background:radial-gradient(ellipse at 50% 30%, ${accent}1f 0%, ${PALETTE.bg} 60%);font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;color:${PALETTE.text};overflow:hidden;">

      ${
        titleHeroOp > 0.01
          ? `
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:${titleHeroOp};transform:scale(${titleHeroScale});">
          <div style="font-size:88px;font-weight:800;letter-spacing:-2px;line-height:1.05;max-width:1400px;">${summary}</div>
          <div style="margin-top:32px;display:flex;align-items:center;gap:16px;">
            <div style="background:${methodColor};color:white;font-weight:700;font-size:24px;padding:10px 20px;border-radius:10px;">${method}</div>
            <div style="font-size:32px;font-family:'JetBrains Mono',monospace;color:${PALETTE.text};">${endpoint}</div>
          </div>
        </div>
      `
          : ""
      }

      <div style="position:absolute;inset:0;padding:48px 60px;display:flex;flex-direction:column;gap:24px;opacity:${headerOp};">
        <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;">
          ${brandHtml}
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="background:${methodColor};color:white;font-weight:700;font-size:20px;padding:8px 16px;border-radius:8px;">${method}</div>
            <div style="font-size:24px;font-family:'JetBrains Mono',monospace;color:${PALETTE.text};">${endpoint}</div>
          </div>
        </header>

        <div style="font-size:32px;font-weight:600;color:${PALETTE.text};letter-spacing:-0.5px;">${summary}</div>

        <main style="flex:1;display:flex;gap:32px;align-items:center;min-height:0;opacity:${panelOp};transform:translateY(${panelY}px);">

          <section style="flex:1;display:flex;flex-direction:column;gap:10px;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:${PALETTE.muted};text-transform:uppercase;letter-spacing:1.5px;">Request</div>
            <div style="background:${PALETTE.codeBg};border:1px solid ${PALETTE.panelBorder};border-radius:14px;padding:28px;overflow:hidden;opacity:${reqOp};">
              ${reqHl || `<div style="color:${PALETTE.muted};font-style:italic;">No body</div>`}
            </div>
          </section>

          <div style="display:flex;align-items:center;justify-content:center;width:100px;">
            <svg width="100" height="40" viewBox="0 0 100 40" style="overflow:visible;">
              <defs>
                <filter id="dotGlow">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>
              <line x1="8" y1="20" x2="88" y2="20" stroke="${PALETTE.muted}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${arrowDashTotal}" stroke-dashoffset="${arrowDashOffset}" />
              <polyline points="76,10 88,20 76,30" fill="none" stroke="${PALETTE.muted}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${arrowP > 0.6 ? (arrowP - 0.6) / 0.4 : 0}" />
              ${
                dotProgress > 0 && dotProgress < 1
                  ? `<circle cx="${dotX}" cy="20" r="6" fill="${accent}" opacity="0.7" filter="url(#dotGlow)" /><circle cx="${dotX}" cy="20" r="3" fill="${accent}" />`
                  : ""
              }
            </svg>
          </div>

          <section style="flex:1;display:flex;flex-direction:column;gap:10px;min-width:0;position:relative;">
            <div style="display:flex;align-items:center;gap:12px;min-height:36px;">
              <div style="font-size:13px;font-weight:600;color:${PALETTE.muted};text-transform:uppercase;letter-spacing:1.5px;">Response</div>
              ${
                slamP > 0
                  ? `<div class="tabular" style="background:${statusColor}1a;color:${statusColor};font-weight:700;font-size:18px;padding:6px 14px;border-radius:8px;border:1px solid ${statusColor}66;opacity:${statusOp};transform:scale(${statusScale});box-shadow:0 0 ${statusGlow}px ${accent}66;">${responseStatus} ${responseStatusText}</div>`
                  : ""
              }
              ${
                metricP > 0 && metric
                  ? `<div class="tabular" style="display:flex;align-items:baseline;gap:8px;background:rgba(255,255,255,0.04);padding:6px 14px;border-radius:8px;border:1px solid ${PALETTE.panelBorder};opacity:${metricOp};transform:translateY(${metricY}px);"><span style="font-size:11px;color:${PALETTE.muted};text-transform:uppercase;letter-spacing:1px;">${metric.label}</span><span style="font-size:18px;font-weight:700;color:${PALETTE.text};font-family:'JetBrains Mono',monospace;">${metric.value}</span>${metric.delta ? `<span style="font-size:13px;color:${accent};font-weight:600;">${metric.delta}</span>` : ""}</div>`
                  : ""
              }
            </div>
            <div style="background:${PALETTE.codeBg};border:1px solid ${slamP > 0 ? statusColor + "44" : PALETTE.panelBorder};border-radius:14px;padding:28px;overflow:hidden;opacity:${responseBodyOp};box-shadow:${slamP > 0 ? `inset 0 0 0 1px ${statusColor}22` : "none"};">
              ${resStream ? resStream.html : `<div style="color:${PALETTE.muted};font-style:italic;">No body</div>`}
            </div>
            ${sparklesHtml}
          </section>

        </main>

        ${
          ctaP > 0 && cta
            ? `<footer style="display:flex;justify-content:flex-end;align-items:center;gap:16px;opacity:${ctaOp};transform:translateX(${ctaX}px);">${cta.url ? `<div style="font-size:14px;color:${PALETTE.muted};font-family:'JetBrains Mono',monospace;">${cta.url}</div>` : ""}<div style="display:inline-flex;align-items:center;gap:8px;background:${accent};color:white;font-weight:700;font-size:18px;padding:14px 24px;border-radius:12px;box-shadow:0 8px 32px ${accent}66;">${cta.text}</div></footer>`
            : `<div style="height:60px;"></div>`
        }
      </div>

    </div>
    `;
  },
});
