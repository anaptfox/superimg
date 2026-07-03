import { define } from "superimg";
import type { TimelineData } from "#/lib/ai/schema";

export type { TimelineData };

export const TIMELINE_TIMING = {
  introSec: 4,
  perEventSec: 5.5,
  outroSec: 3,
} as const;

/** Derive total runtime from milestone count — single source of truth for Player + export. */
export function calculateTimelineDuration(eventCount: number): number {
  return (
    TIMELINE_TIMING.introSec +
    eventCount * TIMELINE_TIMING.perEventSec +
    TIMELINE_TIMING.outroSec
  );
}

const SAMPLE_EVENTS = [
  { date: "2020", title: "Event One", description: "Description here" },
  { date: "2021", title: "Event Two", description: "Description here" },
  { date: "2022", title: "Event Three", description: "Description here" },
  { date: "2023", title: "Event Four", description: "Description here" },
  { date: "2024", title: "Event Five", description: "Description here" },
];

export const timelineTemplate = define<TimelineData>({
  config: {
    fps: 30,
    duration: calculateTimelineDuration(SAMPLE_EVENTS.length),
    width: 1920,
    height: 1080,
    fonts: ["Inter:wght@400;500;600;700;800", "JetBrains+Mono:wght@500;600;700"],
    inlineCss: [
      "* { margin: 0; padding: 0; box-sizing: border-box; }",
      "body { overflow: hidden; font-family: 'Inter', system-ui, sans-serif; }",
    ],
  },
  sample: {
    title: "Timeline",
    events: SAMPLE_EVENTS,
    accentColor: "#667eea",
  },
  render(ctx) {
    const { data, std, width, height } = ctx;
    const { title, events, accentColor } = data;
    const count = events.length;

    // ~5s per event at 8 milestones; fewer events get even more hold time.
    const d = ctx.director({ intro: "8%", events: "84%", outro: "8%" });
    const car = std.carousel(events, {
      during: d.in("events"),
      enter: 0.14,
      exit: 0.1,
      last: "hold",
    });

    const introP = d.in("intro");
    const outroP = d.in("outro");
    const globalOpacity = 1 - std.interpolate(outroP, [0, 1], [0, 1], "easeInOutCubic");

    const titleIntro = d.motion({
      during: "intro",
      at: "12%",
      for: "55%",
      y: 48,
      fromOpacity: 0,
      easing: "easeOutQuart",
    });

    const lineP = std.math.clamp((introP - 0.35) / 0.45, 0, 1);
    const accentLineWidth = std.interpolate(lineP, [0, 1], [0, 180], "easeOutCubic");

    const subtitleIntro = d.motion({
      during: "intro",
      at: "48%",
      for: "40%",
      y: 20,
      fromOpacity: 0,
      easing: "easeOutCubic",
    });

    const headerIntro = d.motion({
      during: "events",
      at: "0%",
      for: "12%",
      y: -16,
      fromOpacity: 0,
      easing: "easeOutCubic",
    });

    const ambientDrift = d.motion({
      during: "events",
      at: "0%",
      for: "100%",
      x: -18,
      y: 12,
      easing: "linear",
    });

    const activeIndex = (() => {
      let hold = -1;
      let entering = -1;
      let exiting = -1;
      for (let i = 0; i < count; i++) {
        const item = car.state(i);
        if (item.state === "hold") hold = i;
        else if (item.state === "entering") entering = i;
        else if (item.state === "exiting") exiting = i;
      }
      if (hold >= 0) return hold;
      if (entering >= 0) return entering;
      if (exiting >= 0) return exiting;
      return count - 1;
    })();

    const progress = count > 1 ? activeIndex / (count - 1) : 1;

    const dotsHtml = events
      .map((_, i) => {
        const item = car.state(i);
        const lit =
          item.state === "hold" ||
          item.state === "entering" ||
          (item.state === "exiting" && item.exit < 0.5);
        const size = lit ? 10 : 7;
        const alpha = lit ? 1 : 0.28;
        return `<div style="width:${size}px; height:${size}px; border-radius:50%;
          background:${std.color.alpha(accentColor, alpha)};
          box-shadow:${lit ? `0 0 18px ${std.color.alpha(accentColor, 0.55)}` : "none"};
          transition:all 0.2s;"></div>`;
      })
      .join("");

    const eventCards: string[] = [];

    for (let i = 0; i < count; i++) {
      const event = events[i]!;
      const item = car.state(i);
      if (item.state === "hidden" || item.state === "gone") continue;

      const { enter, exit, state: phase } = item;
      let transform = "";
      let opacity = 1;

      if (phase === "entering") {
        transform = `translateY(${(1 - enter) * 56}px) scale(${0.96 + enter * 0.04})`;
        opacity = enter;
      } else if (phase === "exiting") {
        transform = `translateY(${-exit * 36}px) scale(${1 - exit * 0.04})`;
        opacity = 1 - exit;
      }

      const dateGlow = phase === "hold" ? std.color.alpha(accentColor, 0.22) : std.color.alpha(accentColor, 0.12);

      eventCards.push(`
        <div style="position:absolute; inset:0; ${std.css(
          { opacity, transform, width: "100%", maxWidth: 1320 },
          std.css.center(),
        )}">
          <div style="${std.css(
            {
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 56,
              alignItems: "stretch",
              width: "100%",
            },
          )}">
            <div style="${std.css(
              {
                position: "relative",
                borderRadius: 24,
                padding: "36px 28px",
                background: `linear-gradient(160deg, ${std.color.alpha(accentColor, 0.18)} 0%, rgba(255,255,255,0.03) 100%)`,
                border: `1px solid ${std.color.alpha(accentColor, 0.35)}`,
                boxShadow: `0 24px 80px ${std.color.alpha(accentColor, 0.15)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
              },
              std.css.column(),
              std.css.center(),
            )}">
              <div style="position:absolute; inset:12px; border-radius:18px;
                background:radial-gradient(circle at 50% 30%, ${dateGlow}, transparent 70%);
                pointer-events:none;"></div>
              <div style="font-family:'JetBrains Mono', monospace; font-size:15px; font-weight:600;
                letter-spacing:2px; text-transform:uppercase; color:${std.color.alpha(accentColor, 0.75)};
                margin-bottom:12px;">Milestone</div>
              <div style="font-family:'JetBrains Mono', monospace; font-size:58px; font-weight:700;
                color:white; letter-spacing:-1px; line-height:1;">${event.date}</div>
            </div>

            <div style="${std.css(
              {
                borderRadius: 28,
                padding: "48px 56px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
              },
              std.css.column(),
            )}">
              <div style="font-size:14px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
                color:${std.color.alpha(accentColor, 0.8)}; margin-bottom:18px;">
                ${String(i + 1).padStart(2, "0")} of ${String(count).padStart(2, "0")}
              </div>
              <div style="font-size:46px; font-weight:800; color:white; letter-spacing:-1.5px;
                line-height:1.15; margin-bottom:22px; max-width:900px;">
                ${event.title}
              </div>
              <div style="width:72px; height:3px; border-radius:2px; margin-bottom:24px;
                background:linear-gradient(90deg, ${accentColor}, transparent);"></div>
              <div style="font-size:24px; font-weight:400; color:rgba(255,255,255,0.62);
                line-height:1.65; max-width:820px;">
                ${event.description}
              </div>
            </div>
          </div>
        </div>
      `);
    }

    const eventCardHtml = eventCards.join("");

    const showIntro = introP < 1;
    const showEvents = d.in("events") > 0 && outroP < 0.35;
    const introOpacity = showIntro ? 1 - std.interpolate(introP, [0.82, 1], [0, 1], "easeInOutCubic") : 0;
    const eventsOpacity = showEvents ? globalOpacity : 0;

    return `
      <div style="${std.css({
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#07070d",
      })}">

        <div style="position:absolute; inset:0;
          background:
            radial-gradient(ellipse 900px 700px at 18% 22%, ${std.color.alpha(accentColor, 0.16)} 0%, transparent 70%),
            radial-gradient(ellipse 700px 500px at 82% 78%, ${std.color.alpha(accentColor, 0.1)} 0%, transparent 65%),
            linear-gradient(165deg, #06060c 0%, #0b0b14 45%, #07070d 100%);
          transform:translate(${ambientDrift.x ?? 0}px, ${ambientDrift.y ?? 0}px);"></div>

        <div style="position:absolute; inset:0; opacity:0.04;
          background-image:repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px);
          pointer-events:none;"></div>

        <div style="position:absolute; inset:0; opacity:${introOpacity};
          ${std.css(std.css.center())}">
          <div style="text-align:center; padding:0 160px; max-width:1400px;
            ${titleIntro.style}">
            <div style="font-size:18px; font-weight:600; letter-spacing:4px; text-transform:uppercase;
              color:${std.color.alpha(accentColor, 0.75)}; margin-bottom:28px;">Timeline</div>
            <h1 style="font-size:78px; font-weight:800; color:white; letter-spacing:-3px;
              line-height:1.05; margin-bottom:28px;">${title}</h1>
            <div style="width:${accentLineWidth}px; height:4px; margin:0 auto 28px; border-radius:2px;
              background:linear-gradient(90deg, transparent, ${accentColor}, transparent);"></div>
            <p style="font-size:26px; font-weight:400; color:rgba(255,255,255,0.45);
              letter-spacing:-0.3px; ${subtitleIntro.style}">
              ${count} key moments · chronological
            </p>
          </div>
        </div>

        <div style="position:absolute; inset:0; opacity:${eventsOpacity};
          ${std.css({ padding: "72px 96px 96px" }, std.css.column())}">

          <div style="${std.css(
            { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 56 },
            headerIntro.style,
          )}">
            <div style="font-size:22px; font-weight:700; color:rgba(255,255,255,0.88);
              letter-spacing:-0.5px; max-width:900px; white-space:nowrap; overflow:hidden;
              text-overflow:ellipsis;">${title}</div>
            <div style="font-family:'JetBrains Mono', monospace; font-size:15px; font-weight:600;
              color:rgba(255,255,255,0.35); letter-spacing:1px;">
              ${String(activeIndex + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}
            </div>
          </div>

          <div style="position:relative; flex:1; min-height:0;">
            ${eventCardHtml}
          </div>

          <div style="margin-top:48px;">
            <div style="height:3px; border-radius:2px; background:rgba(255,255,255,0.08);
              overflow:hidden; margin-bottom:18px;">
              <div style="height:100%; width:${progress * 100}%; border-radius:2px;
                background:linear-gradient(90deg, ${accentColor}, ${std.color.alpha(accentColor, 0.5)});
                box-shadow:0 0 20px ${std.color.alpha(accentColor, 0.4)};"></div>
            </div>
            <div style="${std.css({ display: "flex", gap: 10, justifyContent: "center" })}">
              ${dotsHtml}
            </div>
          </div>
        </div>

        <div style="position:absolute; bottom:40px; right:56px; font-size:14px; font-weight:500;
          letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.18);
          opacity:${globalOpacity};">superimg.app</div>
      </div>
    `;
  },
});