import { defineScene } from "superimg";

interface TechlahomEvent {
  date: string;
  day: string;
  time: string;
  group: string;
  title: string;
  location: string;
  color: string;
}

export default defineScene({
  data: {
    month: "March",
    year: "2026",
    hookLine1: "5 meetups.",
    hookLine2: "This month.",
    tagline: "Find your people.",
    cta: "All free. All welcome.",
    ctaUrl: "meetup.com/techlahoma",
    techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png",
    backgroundImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1920",

    events: [
      { date: "Mar 4", day: "TUE", time: "11 AM", group: "OKC Coffee & Code", title: "Coworking Session", location: "8th Street Market", color: "#f65858" },
      { date: "Mar 7", day: "FRI", time: "6:30 PM", group: "Tulsa Web Devs", title: "React 19 Deep Dive", location: "36 Degrees North", color: "#3b82f6" },
      { date: "Mar 12", day: "WED", time: "6 PM", group: "OKC Python", title: "Intro to FastAPI", location: "Tailwind HQ", color: "#10b981" },
      { date: "Mar 18", day: "TUE", time: "7 PM", group: "Techlahoma Foundation", title: "Monthly Board Meeting", location: "Virtual", color: "#8b5cf6" },
      { date: "Mar 25", day: "TUE", time: "6 PM", group: "OKC Design+Dev", title: "Design Systems Workshop", location: "Starspace46", color: "#f59e0b" },
    ] as TechlahomEvent[],
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 15,
    fonts: ["Inter:wght@400;500;600;700;800"],
    audio: { src: "../../_assets/lofi-bg.mp3", volume: 0.6, fadeIn: 0.5, fadeOut: 1.5, loop: true },
    outputs: {
      landscape: { width: 1920, height: 1080 },
      square: { width: 1080, height: 1080 },
      story: { width: 1080, height: 1920 },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { month, year, hookLine1, hookLine2, tagline, cta, ctaUrl, techlahomaSvg, backgroundImage, events } = data;

    const r = std.createResponsive(ctx);

    // === SCORE PHASES ===
    // hook: 2s, events: 9s, recap: 2.5s, outro: 1.5s
    // Total 15s. Fractions: 2/15, 9/15, 2.5/15, 1.5/15
    const t = std.score({
      hook: 2/15,
      events: 9/15,
      recap: 2.5/15,
      outro: 1.5/15
    });

    // Ken Burns background (shared)
    const bg = std.backgrounds.kenBurns({
      src: backgroundImage,
      progress: ctx.sceneProgress,
      zoomTo: 1.12,
      overlay: "rgba(0, 0, 0, 0.6)",
    });

    // === RECAP PHASE ===
    if (t.active === "recap") {
      const recapP = t.within("recap");
      const recapBg = std.backgrounds.kenBurns({ src: backgroundImage, progress: ctx.sceneProgress, zoomTo: 1.12, overlay: "rgba(0, 0, 0, 0.7)" });

      // Stagger rows using score
      const recapRows = events.map((event: TechlahomEvent, i: number) => {
        const anim = t.motion({ during: "recap", at: 0.1/2.5 + i * 0.08/2.5, duration: 0.3/2.5, y: 20 });
        
        const rowHeight = r({ portrait: 72, square: 56, default: 64 });
        const dateBadgeWidth = r({ portrait: 60, square: 48, default: 56 });
        const groupFontSize = r({ portrait: 22, square: 16, default: 20 });
        const timeFontSize = r({ portrait: 18, square: 14, default: 16 });
        const containerWidth = r({ portrait: "92%", square: "85%", default: "70%" });
        const rowPadding = r({ portrait: "12px 16px", default: "10px 14px" });
        const rowGap = r({ portrait: 16, default: 12 });
        const dayFontSize = r({ portrait: 10, default: 8 });
        const dateFontSize = r({ portrait: 22, default: 18 });

        return `
          <div style="${std.css({
            display: "flex", alignItems: "center", gap: rowGap, padding: rowPadding,
            background: "rgba(0, 0, 0, 0.8)", borderLeft: `4px solid ${event.color}`, borderRadius: 8,
            opacity: anim.opacity, transform: `translateY(${anim.y}px)`,
          })}">
            <div style="${std.css({
              width: dateBadgeWidth, height: dateBadgeWidth, background: event.color, borderRadius: 8,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
            })}">
              <div style="${std.css({ fontSize: dayFontSize, fontWeight: 700, color: "#fff", letterSpacing: "0.1em" })}">${event.day}</div>
              <div style="${std.css({ fontSize: dateFontSize, fontWeight: 800, color: "#fff", lineHeight: 1 })}">${event.date.split(" ")[1]}</div>
            </div>
            <div style="${std.css({ flex: 1, fontSize: groupFontSize, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}">${event.group}</div>
            <div style="${std.css({ fontSize: timeFontSize, fontWeight: 500, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" })}">${event.time}</div>
          </div>
        `;
      }).join("");

      return `
        <div style="${std.css({ width, height, position: "relative", overflow: "hidden" })}">
          ${recapBg.html}
          <div style="${std.css({ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: r({ portrait: 32, default: 40 }) })}">
            <div style="${std.css({ width: r({ portrait: "92%", default: "70%" }), maxWidth: 960, display: "flex", flexDirection: "column", gap: 12 })}">
              ${recapRows}
            </div>
          </div>
        </div>
      `;
    }

    // === OUTRO PHASE ===
    if (t.active === "outro") {
      const outroP = t.within("outro");
      const logoWidth = r({ portrait: 500, square: 400, default: 480 });

      const ctaAnim = t.motion({ during: "outro", at: 0.2/1.5, duration: 0.3/1.5, y: 20 });
      const logoAnim = t.motion({ during: "outro", at: 0, duration: 0.16/1.5, scale: 0.1 });
      const fadeOut = t.tween(0, 1, { during: "outro", at: 0.6/1.5, duration: 0.4/1.5 });

      return `
        <div style="${std.css({ width, height, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: r({ portrait: 48, default: 32 }), opacity: 1 - fadeOut })}">
          <div style="${std.css({ fontSize: r({ portrait: 36, default: 32 }), fontWeight: 600, color: "#fff" })};${ctaAnim.style}">${cta}</div>
          <img src="${techlahomaSvg}" style="${std.css({ width: logoWidth })};${logoAnim.style}" />
          <div style="${std.css({ fontSize: r({ portrait: 28, default: 24 }), fontWeight: 500, color: "rgba(255,255,255,0.7)" })};${ctaAnim.style}">${ctaUrl}</div>
        </div>
      `;
    }

    // === HOOK PHASE ===
    if (t.active === "hook") {
      const hook1P = t.tween(0, 1, { during: "hook", at: 0, duration: 0.6/2 });
      const hook2P = t.tween(0, 1, { during: "hook", at: 0.9/2, duration: 0.5/2 });
      const taglineP = t.tween(0, 1, { during: "hook", at: 1.8/2, duration: 0.6/2 });
      
      const hook1Visible = std.text.type(hookLine1, hook1P).visible;
      const hook2Visible = std.text.type(hookLine2, hook2P).visible;
      const taglineVisible = std.text.type(tagline, taglineP).visible;

      return `
        <div style="${std.css({ width, height, position: "relative", overflow: "hidden" })}">
          ${bg.html}
          <div style="${std.css({ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16 })}">
            <div style="${std.css({ fontSize: r({ portrait: 72, default: 64 }), fontWeight: 800, color: "#fff" })}">${hook1Visible}</div>
            <div style="${std.css({ fontSize: r({ portrait: 72, default: 64 }), fontWeight: 800, color: "#fff" })}">${hook2Visible}</div>
            <div style="${std.css({ fontSize: r({ portrait: 32, default: 28 }), fontWeight: 500, color: "rgba(255,255,255,0.8)", marginTop: 16 })}">${taglineVisible}</div>
          </div>
        </div>
      `;
    }

    // === EVENTS PHASE ===
    const eventCards = events.map((event: TechlahomEvent, i: number) => {
      // Stagger events across the 9s phase
      const cardAnim = t.motion({
        during: "events",
        at: i * (1/events.length) * 0.8,
        duration: 1.5/9,
        scale: 0.05,
        y: 60,
        exit: { at: (i+1) * (1/events.length) * 0.9, duration: 0.5/9 }
      });

      if (!cardAnim.visible) return "";

      const cardWidth = r({ portrait: "88%", square: "80%", default: "70%" });
      const dateBadgeSize = r({ portrait: 80, square: 60, default: 70 });

      return `
        <div style="${std.css({
          position: "absolute", width: cardWidth, maxWidth: 900, background: "rgba(0, 0, 0, 0.85)",
          borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", gap: 20,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)", borderLeft: `4px solid ${event.color}`,
        })};${cardAnim.style}">
          <div style="${std.css({
            width: dateBadgeSize, height: dateBadgeSize, background: event.color, borderRadius: 12,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
          })}">
            <div style="${std.css({ fontSize: r({ portrait: 14, default: 11 }), fontWeight: 700, color: "#fff" })}">${event.day}</div>
            <div style="${std.css({ fontSize: r({ portrait: 28, default: 22 }), fontWeight: 800, color: "#fff", lineHeight: 1 })}">${event.date.split(" ")[1]}</div>
          </div>
          <div style="${std.css({ flex: 1, display: "flex", flexDirection: "column", gap: 6 })}">
            <div style="${std.css({ fontSize: r({ portrait: 28, default: 24 }), fontWeight: 700, color: event.color })}">${event.group}</div>
            <div style="${std.css({ fontSize: r({ portrait: 36, default: 32 }), fontWeight: 600, color: "#fff", lineHeight: 1.2 })}">${event.title}</div>
            <div style="${std.css({ fontSize: r({ portrait: 24, default: 22 }), fontWeight: 400, color: "rgba(255,255,255,0.7)" })}">${event.location}</div>
          </div>
          <div style="${std.css({ padding: "8px 16px", background: "rgba(255,255,255,0.1)", borderRadius: 8, fontSize: r({ portrait: 20, default: 18 }), fontWeight: 600, color: "#fff", whiteSpace: "nowrap" })}">${event.time}</div>
        </div>
      `;
    }).join("");

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden" })}">
        ${bg.html}
        <div style="${std.css({ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" })}">
          ${eventCards}
        </div>
      </div>
    `;
  },
});
