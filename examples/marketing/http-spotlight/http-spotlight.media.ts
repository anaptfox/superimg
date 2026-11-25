// HTTP Spotlight — an endpoint sold like a billboard, not debugged like a log.
// Film: ink field, one citron slab, Swiss grid, tabular numbers.
// Deliberately not a request/response code diff — see developer/http-trace for that.

import { video, Frame, Fill, Stack, Text, Html, type RenderContext, googleFont } from "@foxworth/superimg";
import { type HttpMethod } from "../../_http-helpers";

export interface ApiBrand {
  name: string;
  domain: string;
  accentColor: string;
}

export interface SpotlightMetric {
  label: string;
  value: string;
  delta: string;
}

export interface SpotlightCta {
  text: string;
  url: string;
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
  metric: SpotlightMetric;
  cta: SpotlightCta;
}

const INK = "#0C0C0B";
const INK_SOFT = "#17171A";
const CHALK = "#F3F1EA";
const GREY = "#8C8C86";

/** Top-level keys of a JSON body, in source order. Never throws on bad input. */
function bodyKeys(body: string, limit: number): Array<{ key: string; value: string }> {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .slice(0, limit)
      .map(([key, value]) => ({
        key,
        value: typeof value === "string" ? value : String(value),
      }));
  } catch {
    return [];
  }
}

/** "32ms" → count the number, keep the unit. */
function countUp(value: string, progress: number): string {
  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(value.trim());
  if (!match) return value;
  const target = Number(match[1]);
  const decimals = match[1]!.includes(".") ? 1 : 0;
  return `${(target * progress).toFixed(decimals)}${match[2]}`;
}

export default video<HttpSpotlightData>({
  duration: "6.5s",
  poster: "5.4s",
  fonts: [googleFont("Archivo:wght@600;700;800"), googleFont("JetBrains+Mono:wght@400;500;700")],
  sample: {
    apiBrand: { name: "Acme", domain: "api.acme.dev", accentColor: "#DDFF4F" },
    summary: "One call. Zero setup.",
    method: "POST",
    endpoint: "/v1/checkout/sessions",
    requestBody: JSON.stringify({ customer: "cus_4f8a", amount: 4900, currency: "usd" }, null, 2),
    responseStatus: 201,
    responseStatusText: "Created",
    responseBody: JSON.stringify(
      { id: "cs_test_a1B2", url: "pay.acme.dev/cs_test_a1B2", expiresAt: 1735689600 },
      null,
      2,
    ),
    metric: { label: "p99 latency", value: "32ms", delta: "3× faster than v1" },
    cta: { text: "Try it", url: "acme.dev/docs" },
  },
  render(ctx: RenderContext<HttpSpotlightData>) {
    const { std, width, height, data } = ctx;
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

    const accent = apiBrand.accentColor;

    const t = ctx.director({
      stamp: "16%",
      claim: "16%",
      proof: "22%",
      count: "18%",
      close: "28%",
    });

    const stampP = t.in("stamp");
    const claimP = t.in("claim");
    const proofP = t.in("proof");
    const countP = t.in("count");
    const closeP = t.in("close");

    const mono = "'JetBrains Mono', ui-monospace, monospace";
    const sans = "'Archivo', system-ui, sans-serif";

    const pad = Math.round(width * 0.055);
    const slabW = Math.round(width * 0.33);
    const slabX = width - slabW;
    const colW = slabX - pad * 2;

    // The citron slab drops from the top edge and stays put.
    const slabDrop = std.interpolate(stampP, [0, 1], [0, 1], "easeOutExpo");
    const slabH = Math.max(1, Math.round(height * slabDrop));

    const brandMotion = t.motion({ id: "brand", during: "stamp", at: "24%", for: "60%", y: -14 });
    const chipPop = std.spring(0.78, 1, std.clamp01(stampP / 0.85), "snappy");
    const chipOp = std.clamp01(stampP * 2.2);

    const claimShift = std.interpolate(claimP, [0, 1], [26, 0], "easeOutExpo");
    const claimOp = std.clamp01(claimP * 1.8);

    const reqKeys = bodyKeys(requestBody, 3);
    const resKeys = bodyKeys(responseBody, 3);
    const chipIn = std.stagger.ms(Math.max(1, resKeys.length), proofP, {
      windowSeconds: t.clip({ during: "proof" }).durationSeconds,
      eachMs: 70,
      capMs: 280,
    });

    const statusPop = std.spring(0.7, 1, std.clamp01(proofP / 0.5), "playful");
    const statusOp = std.clamp01(proofP * 3);

    const counted = countP > 0 || closeP > 0;
    const countEase = counted
      ? std.interpolate(closeP > 0 ? 1 : countP, [0, 1], [0, 1], "easeOutExpo")
      : 0;
    const metricLabelOp = std.clamp01((proofP > 0.5 ? (proofP - 0.5) * 2 : 0) + countP * 2);

    const ctaSlide = std.interpolate(closeP, [0, 1], [1, 0], "easeOutExpo");
    const ctaOp = std.clamp01(closeP * 2.4);
    const ctaW = Math.round(colW * 0.52);

    const endpointSize = Math.round(
      Math.min(height * 0.055, (colW * 0.86) / Math.max(1, endpoint.length * 0.56)),
    );

    const chipHtml = resKeys
      .map((entry, i) => {
        const p = chipIn[i] ?? 0;
        const y = std.interpolate(p, [0, 1], [16, 0], "easeOutCubic");
        return `<div style="display:flex;align-items:baseline;gap:14px;padding:14px 20px;border:1px solid ${CHALK}22;background:${INK_SOFT};opacity:${p.toFixed(3)};transform:translateY(${y.toFixed(2)}px);">
        <span style="font-family:${mono};font-size:19px;color:${GREY};letter-spacing:1px;">${std.text.escapeHtml(entry.key)}</span>
        <span style="font-family:${mono};font-size:23px;font-weight:500;color:${CHALK};">${std.text.escapeHtml(std.text.truncate(entry.value, 26, "…"))}</span>
      </div>`;
      })
      .join("");

    const sendLine = reqKeys.length
      ? `{ ${reqKeys.map((entry) => entry.key).join(", ")} }`
      : "no body";

    // Swiss grid: every block owns an explicit box, nothing hugs.
    const rowH = 64;
    const claimSize = Math.round(height * 0.105);
    const slabPad = Math.round(slabW * 0.12);
    const slabInner = slabW - slabPad * 2;
    const metricSize = Math.round(Math.min(height * 0.19, slabInner / Math.max(1, metric.value.length * 0.68)));

    return Frame(
      { id: "board", width: "fill", height: "fill" },
      Fill({ color: INK }),
      Fill({ id: "rules", style: { backgroundImage: `linear-gradient(90deg, ${CHALK}0A 1px, transparent 1px)`, backgroundSize: `${Math.round(width / 12)}px 100%` } }),
      Frame({ x: slabX, y: 0, width: slabW, height: slabH, fill: accent }),
      Frame({ x: slabX - 2, y: 0, width: 2, height: slabH, fill: `${accent}66` }),

      Frame(
        {
          id: "brand",
          x: pad,
          y: Math.round(height * 0.075),
          width: 520,
          height: 56,
          motion: brandMotion,
        },
        Frame(
          { width: 52, height: 52, fill: accent },
          Text(
            {
              variant: "title",
              size: 28,
              weight: 800,
              color: INK,
              fontFamily: sans,
              align: "center",
              style: { lineHeight: "52px" },
            },
            apiBrand.name.charAt(0).toUpperCase(),
          ),
        ),
        Frame(
          { x: 68, y: 2, width: 440, height: 26 },
          Text({ variant: "title", size: 22, weight: 700, color: CHALK, fontFamily: sans }, apiBrand.name),
        ),
        Frame(
          { x: 68, y: 30, width: 440, height: 22 },
          Text({ variant: "caption", size: 16, weight: 400, color: GREY, fontFamily: mono }, apiBrand.domain),
        ),
      ),

      Frame(
        { id: "endpoint", x: pad, y: Math.round(height * 0.2), width: colW, height: rowH },
        Frame(
          {
            width: 108,
            height: 48,
            fill: accent,
            style: {
              opacity: chipOp,
              transform: `scale(${chipPop.toFixed(4)})`,
              transformOrigin: "0% 50%",
            },
          },
          Text(
            {
              variant: "label",
              size: 26,
              weight: 800,
              color: INK,
              fontFamily: mono,
              align: "center",
              letterSpacing: 1,
              style: { lineHeight: "48px" },
            },
            method,
          ),
        ),
        Frame(
          { x: 130, y: 6, width: colW - 130, height: 40 },
          Text(
            {
              variant: "title",
              size: endpointSize,
              weight: 500,
              color: CHALK,
              fontFamily: mono,
              style: { opacity: chipOp },
            },
            endpoint,
          ),
        ),
      ),

      Frame(
        {
          id: "claim",
          x: pad,
          y: Math.round(height * 0.29),
          width: colW,
          height: claimSize * 2.3,
          style: {
            opacity: claimOp,
            transform: `translateY(${claimShift.toFixed(2)}px)`,
          },
        },
        Text(
          {
            variant: "display",
            size: claimSize,
            weight: 800,
            color: CHALK,
            fontFamily: sans,
            letterSpacing: -4,
            lineHeight: 1.04,
            maxWidth: colW,
          },
          summary,
        ),
      ),

      Frame(
        {
          id: "send",
          x: pad,
          y: Math.round(height * 0.53),
          width: colW,
          height: 32,
          style: { opacity: claimOp * 0.85 },
        },
        Text(
          { variant: "caption", size: 18, weight: 400, color: GREY, fontFamily: mono, letterSpacing: 3 },
          "YOU SEND",
        ),
        Frame(
          { x: 150, y: 0, width: colW - 150, height: 30 },
          Text({ variant: "caption", size: 20, weight: 500, color: `${CHALK}CC`, fontFamily: mono }, sendLine),
        ),
      ),

      Frame(
        {
          id: "status",
          x: pad,
          y: Math.round(height * 0.62),
          width: colW,
          height: 48,
          style: { opacity: statusOp },
        },
        Frame(
          {
            width: 250,
            height: 44,
            fill: accent,
            style: { transform: `scale(${statusPop.toFixed(4)})`, transformOrigin: "0% 50%" },
          },
          Text(
            {
              variant: "label",
              size: 22,
              weight: 700,
              color: INK,
              fontFamily: mono,
              align: "center",
              style: { lineHeight: "44px" },
            },
            `${responseStatus} ${responseStatusText.toUpperCase()}`,
          ),
        ),
        Frame(
          { x: 272, y: 12, width: 240, height: 24 },
          Text(
            { variant: "caption", size: 18, weight: 400, color: GREY, fontFamily: mono, letterSpacing: 3 },
            "YOU GET",
          ),
        ),
      ),

      Html({
        id: "chips",
        x: pad,
        y: Math.round(height * 0.7),
        width: colW,
        height: 86,
        html: `<div style="display:flex;gap:14px;">${chipHtml}</div>`,
      }),

      Frame(
        {
          id: "cta",
          x: pad,
          y: height - Math.round(height * 0.115),
          width: colW,
          height: 74,
          overflow: "hidden",
          style: { opacity: ctaOp },
        },
        Frame(
          {
            width: ctaW,
            height: 74,
            fill: accent,
            style: { transform: `translateX(${(-ctaSlide * (ctaW + pad)).toFixed(1)}px)` },
          },
          Frame(
            { x: 28, y: 20, width: ctaW - 56, height: 36 },
            Text(
              { variant: "title", size: 27, weight: 800, color: INK, fontFamily: sans, letterSpacing: -0.5 },
              cta.text,
            ),
            Text(
              {
                variant: "caption",
                size: 19,
                weight: 500,
                color: `${INK}B0`,
                fontFamily: mono,
                align: "right",
              },
              cta.url,
            ),
          ),
        ),
      ),

      Frame(
        {
          id: "slab-copy",
          x: slabX + slabPad,
          y: Math.round(height * 0.28),
          width: slabInner,
          height: Math.round(height * 0.5),
          style: { opacity: metricLabelOp },
        },
        Text(
          {
            variant: "label",
            size: 21,
            weight: 700,
            color: `${INK}CC`,
            fontFamily: mono,
            letterSpacing: 4,
          },
          metric.label.toUpperCase(),
        ),
        Frame(
          { x: 0, y: 42, width: slabInner, height: Math.round(metricSize * 1.05) },
          Text(
            {
              variant: "display",
              size: metricSize,
              weight: 800,
              color: INK,
              fontFamily: sans,
              letterSpacing: -6,
              lineHeight: 1,
              style: { fontVariantNumeric: "tabular-nums" },
            },
            countUp(metric.value, countEase),
          ),
        ),
        Frame({
          x: 0,
          y: Math.round(metricSize * 1.05) + 60,
          width: Math.max(1, Math.round(slabInner * countEase)),
          height: 3,
          fill: INK,
          style: { opacity: countEase > 0.02 ? 0.6 : 0 },
        }),
        Frame(
          { x: 0, y: Math.round(metricSize * 1.05) + 82, width: slabInner, height: 90 },
          Text(
            {
              variant: "caption",
              size: 24,
              weight: 700,
              color: `${INK}CC`,
              fontFamily: sans,
              maxWidth: slabInner,
              lineHeight: 1.25,
              style: { opacity: countEase },
            },
            metric.delta,
          ),
        ),
      ),
    );
  },
});
