// HTTP Trace — the request told as a latency waterfall on an instrument sheet.
// A playhead sweeps the timeline; the response lands where the wait ends.

import { video, Frame, Stack, Text, Html, type RenderContext, googleFont } from "@foxworth/superimg";
import type { LangName } from "@foxworth/superimg/stdlib/code";
import {
  type HttpMethod,
  METHOD_COLORS,
  getStatusColor,
  prettyJson,
  parseHeaders,
} from "../../_http-helpers";

export interface TraceSpan {
  label: string;
  ms: number;
}

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
  /** Key takeaway from the response — lands with the receipt. */
  keyResult?: string;
  /** Optional real timings; derived from responseTimeMs when absent. */
  timings?: TraceSpan[];
  showHeaders: boolean;
}

const SHEET = "#F3F4F1";
const CARD = "#FBFBF9";
const GRAPHITE = "#1B1E22";
const MUTED = "#6C7480";
const HAIR = "rgba(27,30,34,0.13)";
const GREY_SPAN = "#A7AFB9";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Typical share of wall time per phase when only a total is known. */
const DERIVED_SHARE: ReadonlyArray<readonly [string, number]> = [
  ["dns", 0.08],
  ["tls", 0.17],
  ["sent", 0.05],
  ["waiting", 0.56],
  ["download", 0.14],
];

function spansOf(data: HttpTraceData): TraceSpan[] {
  const measured = (data.timings ?? []).filter((s) => Number.isFinite(s.ms) && s.ms > 0);
  if (measured.length > 0) return measured;
  const requested = Number(data.responseTimeMs ?? 40);
  const total = Number.isFinite(requested) ? Math.max(1, requested) : 40;
  return DERIVED_SHARE.map(([label, share]) => ({
    label,
    ms: Math.max(0.5, Math.round(total * share * 10) / 10),
  }));
}

export default video<HttpTraceData>({
  duration: "8s",
  fonts: [googleFont("JetBrains+Mono:wght@400;500;700"), googleFont("Inter:wght@400;500;600;700;800")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; }",
    "pre.shiki { margin: 0; padding: 0; background: transparent !important; }",
    "pre.shiki code { background: transparent !important; }",
    ".rline { white-space: pre; font-family: 'JetBrains Mono', ui-monospace, monospace; }",
  ],
  sample: {
    method: "POST",
    endpoint: "/v1/users",
    summary: "Create a user in one call.",
    requestHeaders: JSON.stringify({
      "Content-Type": "application/json",
      Authorization: "Bearer sk_•••",
    }),
    requestBody: JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" }, null, 2),
    responseStatus: 201,
    responseStatusText: "Created",
    responseHeaders: "",
    responseBody: JSON.stringify(
      { id: "usr_4f8a", name: "Ada Lovelace", createdAt: "2026-04-19T10:30:00Z" },
      null,
      2,
    ),
    responseTimeMs: 47,
    requestId: "req_01HG7K2P",
    keyResult: "usr_4f8a",
    showHeaders: true,
  },

  render(ctx: RenderContext<HttpTraceData>) {
    const { std, width, height, data } = ctx;
    const ease = (v: number, fn: Parameters<typeof std.interpolate>[3]) =>
      std.interpolate(v, [0, 1], [0, 1], fn);
    const method = (data.method ?? "GET") as HttpMethod;
    const endpoint = String(data.endpoint ?? "/");
    const summary = data.summary ? String(data.summary) : "";
    const status = Number(data.responseStatus ?? 200);
    const statusText = String(data.responseStatusText ?? "");
    const requestId = data.requestId ? String(data.requestId) : "";
    const keyResult = data.keyResult ? String(data.keyResult) : "";

    const methodColor = METHOD_COLORS[method] ?? MUTED;
    const statusColor = std.color.darken(getStatusColor(status), 24);

    const spans = spansOf(data);
    const totalMs = spans.reduce((sum, s) => sum + s.ms, 0);
    const waitIndex = Math.max(
      0,
      spans.findIndex((s) => /wait|ttfb|server/i.test(s.label)),
    );
    const waitEndMs = spans.slice(0, waitIndex + 1).reduce((sum, s) => sum + s.ms, 0);

    const t = ctx.director({
      slate: "0.9s",
      trace: "2.6s",
      land: "0.7s",
      receipt: "2.0s",
      read: "1.2s",
      out: "0.6s",
    });

    const slateP = ease(t.in("slate"), "easeOutCubic");
    const traceP = ease(t.in("trace"), "easeInOutCubic");
    const landP = t.in("land");
    const receiptP = t.in("receipt");
    const readP = t.in("read");
    const outP = ease(t.in("out"), "easeInCubic");

    const padX = Math.round(width * 0.07);
    const padY = Math.round(height * 0.062);
    const colW = width - padX * 2;
    const px = (v: number) => Math.round(Math.min(width, height * 1.78) * v);

    // Waterfall geometry.
    const labelW = Math.round(colW * 0.15);
    const valueW = Math.round(colW * 0.1);
    const barsX = labelW;
    const barsW = colW - labelW - valueW;
    const axisH = px(0.022);
    const rowH = px(0.027);
    const wfH = axisH + spans.length * rowH + px(0.008);
    const scale = barsW / Math.max(1, totalMs);

    const playMs = traceP * totalMs;
    const landed = traceP >= waitEndMs / totalMs || landP > 0;

    const ticks = 5;
    const tickEls = Array.from({ length: ticks + 1 }, (_, i) => {
      const ms = (totalMs / ticks) * i;
      const x = barsX + ms * scale;
      const shown = std.interpolate(slateP, [0.15 + i * 0.06, 0.55 + i * 0.06], [0, 1], "easeOutCubic");
      return `<line x1="${x.toFixed(1)}" y1="${axisH}" x2="${x.toFixed(1)}" y2="${wfH}" stroke="${HAIR}" stroke-width="1" opacity="${shown.toFixed(3)}"/>
        <text x="${x.toFixed(1)}" y="${axisH - px(0.009)}" fill="${MUTED}" font-family="${MONO}" font-size="${px(0.0125)}" text-anchor="${i === 0 ? "start" : i === ticks ? "end" : "middle"}" opacity="${shown.toFixed(3)}">${Math.round(ms)}ms</text>`;
    }).join("");

    let cursorMs = 0;
    const rowEls = spans
      .map((span, i) => {
        const start = cursorMs;
        cursorMs += span.ms;
        const y = axisH + i * rowH;
        const barH = Math.round(rowH * 0.42);
        const barY = y + Math.round((rowH - barH) / 2);
        const x = barsX + start * scale;
        const full = span.ms * scale;
        const local = std.math.clamp((playMs - start) / Math.max(0.001, span.ms), 0, 1);
        const w = Math.max(local > 0 ? 2 : 0, full * local);
        const hero = i === waitIndex;
        const color = hero ? methodColor : i === spans.length - 1 ? statusColor : GREY_SPAN;
        const reached = local > 0;
        const labelOp = reached ? 1 : 0.34;
        return `<text x="${labelW - px(0.014)}" y="${(barY + barH * 0.82).toFixed(1)}" fill="${GRAPHITE}" font-family="${MONO}" font-size="${px(0.0155)}" text-anchor="end" opacity="${labelOp}">${std.text.escapeHtml(span.label)}</text>
          <rect x="${x.toFixed(1)}" y="${barY}" width="${full.toFixed(1)}" height="${barH}" rx="3" fill="${HAIR}" opacity="0.6"/>
          ${w > 0 ? `<rect x="${x.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" rx="3" fill="${color}"/>` : ""}
          <text x="${colW}" y="${(barY + barH * 0.82).toFixed(1)}" fill="${reached ? GRAPHITE : MUTED}" font-family="${MONO}" font-size="${px(0.0145)}" text-anchor="end" opacity="${(labelOp * (local > 0.6 ? 1 : local / 0.6)).toFixed(3)}">${span.ms.toFixed(1)}ms</text>`;
      })
      .join("");

    const headX = barsX + playMs * scale;
    const headOp = traceP > 0 && traceP < 1 ? 1 : traceP >= 1 ? std.interpolate(landP, [0, 0.6], [1, 0.25], "easeOutCubic") : 0;
    const waterfall = `<svg width="${colW}" height="${wfH}" viewBox="0 0 ${colW} ${wfH}">
      ${tickEls}
      ${rowEls}
      <line x1="${headX.toFixed(1)}" y1="${axisH - px(0.005)}" x2="${headX.toFixed(1)}" y2="${wfH}" stroke="${GRAPHITE}" stroke-width="1.5" opacity="${headOp.toFixed(3)}"/>
      <polygon points="${(headX - 5).toFixed(1)},${axisH - px(0.005)} ${(headX + 5).toFixed(1)},${axisH - px(0.005)} ${headX.toFixed(1)},${(axisH + 3).toFixed(1)}" fill="${GRAPHITE}" opacity="${headOp.toFixed(3)}"/>
    </svg>`;

    // Receipt: the response body, revealed a line at a time under the waterfall.
    const bodyLines = prettyJson(String(data.responseBody ?? "")).split("\n").filter((l) => l.length > 0);
    const receiptReveal = std.stagger.ms(bodyLines, receiptP, {
      windowSeconds: 2,
      eachMs: 100,
      capMs: 700,
    });
    const receiptLines = bodyLines
      .map((line, i) => {
        const p = receiptReveal[i]!.progress;
        let inner: string;
        try {
          const html = std.code.highlight(line, {
            lang: "json" as LangName,
            theme: "github-light",
          });
          inner = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1]?.replace(/\n$/, "") ?? std.text.escapeHtml(line);
        } catch {
          inner = std.text.escapeHtml(line);
        }
        return `<div class="rline" style="opacity:${p.toFixed(3)};transform:translateY(${((1 - p) * 6).toFixed(2)}px);">${inner}</div>`;
      })
      .join("");

    const headers = data.showHeaders ? parseHeaders(String(data.requestHeaders ?? "")) : {};
    const headerKeys = Object.keys(headers).slice(0, 2);

    const statusScale = std.spring(0.82, 1, landP, "snappy");
    const statusOp = landed ? std.interpolate(landP, [0, 0.4], [0.15, 1], "easeOutCubic") : 0;
    const page = t.motion({ id: "sheet", during: "slate", y: 16, exit: { y: -14 } });
    const receiptLineH = px(0.024);
    const receiptH = Math.round(bodyLines.length * receiptLineH + px(0.066));

    function chip(label: string, color: string, opts: { solid?: boolean; size?: number } = {}) {
      const size = opts.size ?? px(0.017);
      return Frame(
        {
          radius: 7,
          fill: opts.solid ? std.color.alpha(color, 0.18) : std.color.alpha(color, 0.12),
          pad: { x: Math.round(size * 0.7), y: Math.round(size * 0.34) },
          style: opts.solid ? undefined : { border: `1px solid ${std.color.alpha(color, 0.45)}` },
        },
        Text(
          {
            variant: "label",
            color: opts.solid ? GRAPHITE : color,
            size,
            weight: 700,
            fontFamily: MONO,
          },
          label,
        ),
      );
    }

    return Frame(
      { id: "sheet", width, height, fill: SHEET, style: { opacity: 1 - outP } },
      Frame({
        width,
        height,
        fill: `repeating-linear-gradient(0deg, ${HAIR} 0 1px, transparent 1px ${px(0.03)}px), repeating-linear-gradient(90deg, ${HAIR} 0 1px, transparent 1px ${px(0.03)}px)`,
        style: { opacity: 0.35 },
      }),
      Stack(
        {
          id: "page",
          width: "fill",
          height: "fill",
          align: "center",
          justify: "center",
          gap: px(0.019),
          pad: { x: padX, y: padY },
          motion: page,
        },

        // Request line.
        Stack(
          {
            direction: "row",
            width: colW,
            height: px(0.05),
            align: "center",
            justify: "space-between",
            style: { opacity: std.interpolate(slateP, [0, 0.5], [0, 1], "easeOutCubic") },
          },
          Stack(
            { direction: "row", gap: px(0.014), align: "center", height: px(0.05) },
            chip(method, methodColor, { solid: true, size: px(0.019) }),
            Text(
              { variant: "title", color: GRAPHITE, size: px(0.03), weight: 500, fontFamily: MONO },
              endpoint,
            ),
          ),
          Stack(
            { gap: px(0.004), height: px(0.05), justify: "center", align: "end" },
            summary
              ? Text({ variant: "body", color: MUTED, size: px(0.0165), align: "right" }, summary)
              : null,
            requestId
              ? Text(
                  { variant: "label", color: MUTED, size: px(0.0125), fontFamily: MONO, align: "right" },
                  requestId,
                )
              : null,
          ),
        ),

        Frame({ width: colW, height: 2, fill: GRAPHITE }),

        // Trace label row + status landing.
        Stack(
          { direction: "row", width: colW, height: px(0.034), align: "center", justify: "space-between" },
          Text(
            { variant: "label", color: MUTED, size: px(0.0135), weight: 700, letterSpacing: 3.4 },
            "TIMELINE",
          ),
          Stack(
            { direction: "row", gap: px(0.01), align: "center", height: px(0.034) },
            ...headerKeys.map((key) =>
              Text(
                { variant: "label", color: MUTED, size: px(0.0125), fontFamily: MONO },
                `${key}: ${String(headers[key]).slice(0, 26)}`,
              ),
            ),
            Frame({
              width: Math.round(px(0.09)),
              height: px(0.034),
              style: {
                opacity: statusOp,
                transform: `scale(${statusScale.toFixed(3)})`,
                transformOrigin: "right center",
              },
            }, Stack(
              { direction: "row", gap: px(0.008), align: "center", justify: "end", height: px(0.034) },
              chip(`${status} ${statusText}`.trim(), statusColor, { size: px(0.0155) }),
            )),
          ),
        ),

        Html({ id: "waterfall", width: colW, height: wfH, html: waterfall }),

        // Response receipt.
        Frame(
          {
            id: "receipt",
            width: colW,
            height: receiptH,
            radius: 12,
            fill: CARD,
            pad: { x: px(0.024), y: px(0.018) },
            style: {
              border: `1px solid ${receiptP > 0 ? std.color.alpha(statusColor, 0.45) : HAIR}`,
              opacity: std.interpolate(receiptP, [0, 0.12], [0, 1], "easeOutCubic"),
              transform: `translateY(${((1 - std.interpolate(receiptP, [0, 0.2], [0, 1], "easeOutCubic")) * 14).toFixed(2)}px)`,
              boxShadow: "0 14px 34px rgba(27,30,34,0.07)",
            },
          },
          Stack(
            { width: "fill", gap: px(0.012) },
            Stack(
              {
                direction: "row",
                width: "fill",
                height: px(0.026),
                align: "center",
                justify: "space-between",
              },
              Text(
                { variant: "label", color: MUTED, size: px(0.0125), weight: 700, letterSpacing: 3 },
                "RESPONSE BODY",
              ),
              Stack(
                { direction: "row", gap: px(0.016), align: "center", height: px(0.026) },
                keyResult
                  ? Text(
                      {
                        variant: "label",
                        color: statusColor,
                        size: px(0.0155),
                        weight: 700,
                        fontFamily: MONO,
                        style: {
                          opacity: std.interpolate(receiptP, [0.5, 0.85], [0, 1], "easeOutCubic"),
                        },
                      },
                      `→ ${keyResult}`,
                    )
                  : null,
                Text(
                  {
                    variant: "label",
                    color: readP > 0 ? statusColor : GRAPHITE,
                    size: px(0.0175),
                    weight: 700,
                    fontFamily: MONO,
                  },
                  `${totalMs.toFixed(1)} ms total`,
                ),
              ),
            ),
            Html({
              id: "receipt-body",
              width: colW - px(0.048),
              height: Math.round(bodyLines.length * receiptLineH),
              html: `<div style="font-size:${px(0.018)}px;line-height:${receiptLineH}px;color:${GRAPHITE};">${receiptLines}</div>`,
            }),
          ),
        ),
      ),
    );
  },
});
