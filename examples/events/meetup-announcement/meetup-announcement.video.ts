import { defineScene } from "superimg";

export default defineScene({
  data: {
    hook: "OKC has a tech scene.",
    hookLine2: "We saved you a seat.",
    subheader: "Laptops welcome. Beginners too.",
    talkTitle: "Coworking at 8th Street Market",
    backgroundImage: "https://secure.meetupstatic.com/photos/event/8/6/9/7/highres_516994455.jpeg",
    date: "March 18",
    time: "11 AM – 1 PM",
    address: "3 NE 8th St · Oklahoma City, OK",
    groupName: "OKC Coffee and Code",
    brandColor: "#f65858",
    techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 12,
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
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const { hook, hookLine2, subheader, talkTitle, backgroundImage, date, time: eventTime, address, groupName, brandColor, techlahomaSvg } = data;

    const r = std.createResponsive(ctx);
    const mainDur = 9.0;
    
    // score: main (0-9s) → outro (9-12s)
    const t = std.score({ main: 0.75, outro: 0.25 });

    // === OUTRO PHASE ===
    if (t.active === "outro") {
      const logoWidth = r({ portrait: 500, square: 400, default: 480 });
      // Use motion() in the outro phase
      const logoAnim = t.motion({ during: "outro", scale: 0.1, duration: 1/3, exit: false });

      return `
        <div style="${std.css({ width, height, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" })}">
          <img src="${techlahomaSvg}" style="${std.css({ width: logoWidth, opacity: logoAnim.opacity })};${logoAnim.style}" />
        </div>
      `;
    }

    // === MAIN CONTENT ===
    const bg = std.backgrounds.kenBurns({ src: backgroundImage, progress: time / mainDur, zoomTo: 1.1, overlay: "rgba(0, 0, 0, 0.5)" });

    // Individual triggers within "main" phase
    const hook1P = t.tween(0, 1, { during: "main", at: 0/9, duration: 0.8/9 });
    const hook2P = t.tween(0, 1, { during: "main", at: 1.4/9, duration: 0.7/9 });
    const subP = t.tween(0, 1, { during: "main", at: 2.7/9, duration: 0.8/9 });
    
    const expandP = t.tween(0, 1, { during: "main", at: 4.0/9, duration: 0.5/9, easing: "easeInOutCubic" });
    const groupAnim = t.motion({ during: "main", at: 4.2/9, duration: 0.4/9, y: -20 });
    const titleAnim = t.motion({ during: "main", at: 4.4/9, duration: 0.4/9, y: 20 });
    const logisticsAnim = t.motion({ during: "main", at: 4.7/9, duration: 0.4/9, y: 20 });
    const ctaAnim = t.motion({ during: "main", at: 6.5/9, duration: 0.4/9, y: 15 });
    
    const cardAnim = t.motion({ during: "main", at: 0, duration: 0.5/9, scale: 0.05, exit: { during: "main", at: 8.5/9, duration: 0.5/9, y: 0 } });

    // Animations logic
    const hook1Visible = std.text.type(hook, hook1P).visible;
    const hook2Visible = std.text.type(hookLine2, hook2P).visible;
    const subheaderVisible = std.text.type(subheader, subP).visible;

    const hookShiftAmount = r({ portrait: -80, default: -60 });
    const hookShiftY = std.interpolate(expandP, [0, 1], [0, hookShiftAmount], "easeInOutCubic");

    // Responsive sizing
    const cardWidth = r({ portrait: "90%", square: "85%", default: "75%" });
    const cardMaxWidth = r({ portrait: 972, default: 850 });
    const hookSize = r({ portrait: 68, square: 32, default: 48 });
    const subheaderSize = r({ portrait: 34, square: 16, default: 22 });
    const titleSize = r({ portrait: 44, square: 22, default: 32 });
    const logisticsSize = r({ portrait: 32, square: 16, default: 20 });
    const addressSize = r({ portrait: 28, square: 14, default: 16 });
    const ctaSize = r({ portrait: 32, square: 14, default: 18 });
    const paddingX = r({ portrait: 48, square: 28, default: 44 });
    const paddingY = r({ portrait: 64, square: 28, default: 44 });
    const groupBadgeSize = r({ portrait: 20, default: 13 });
    const hostedBySize = r({ portrait: 14, default: 10 });
    const groupBadgePadding = r({ portrait: "10px 24px", default: "6px 16px" });
    const hookMargin = r({ portrait: 20, default: 12 });
    const titleMargin = r({ portrait: 24, default: 16 });

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden" })}">
        ${bg.html}
        <div style="${std.css({ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 })}">
          <div style="${std.css({
            width: cardWidth, maxWidth: cardMaxWidth, background: std.color.alpha(brandColor, 0.95),
            borderRadius: 16, padding: `${paddingY}px ${paddingX}px`, boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
            color: "white", textAlign: "center", opacity: cardAnim.opacity, display: "flex", flexDirection: "column", alignItems: "center",
          })};${cardAnim.style}">

            <!-- Hosted by + Group badge -->
            <div style="${std.css({ fontSize: hostedBySize, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.15em", opacity: groupAnim.opacity * 0.7, marginBottom: 6 })};${groupAnim.style}">hosted by</div>
            <div style="${std.css({
              fontSize: groupBadgeSize, fontWeight: 600, background: std.color.alpha("#ffffff", 0.2),
              padding: groupBadgePadding, marginBottom: titleMargin + Math.abs(hookShiftY),
              opacity: groupAnim.opacity, textTransform: "uppercase", letterSpacing: "0.1em",
            })};${groupAnim.style}">${groupName}</div>

            <!-- Hook section -->
            <div style="${std.css({ transform: `translateY(${hookShiftY}px)`, marginBottom: expandP > 0 ? 16 : 0 })}">
              <div style="${std.css({ fontSize: hookSize, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, minHeight: hookSize * 1.1, whiteSpace: "nowrap" })}">${hook1Visible}</div>
              <div style="${std.css({ fontSize: hookSize, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: hookMargin, minHeight: hookSize * 1.1, whiteSpace: "nowrap" })}">${hook2Visible}</div>
              <div style="${std.css({ fontSize: subheaderSize, fontWeight: 400, minHeight: subheaderSize * 1.2, opacity: subP > 0 ? 0.8 : 0, whiteSpace: "nowrap" })}">${subheaderVisible}</div>
            </div>

            <!-- Title -->
            <div style="${std.css({ fontSize: titleSize, fontWeight: 600, lineHeight: 1.2, marginBottom: titleMargin, opacity: titleAnim.opacity })};${titleAnim.style}">${talkTitle}</div>

            <!-- Logistics -->
            <div style="${std.css({ opacity: logisticsAnim.opacity, marginBottom: titleMargin, textAlign: "center" })};${logisticsAnim.style}">
              <div style="${std.css({ fontSize: logisticsSize, fontWeight: 600, marginBottom: 8 })}">${date} · ${eventTime}</div>
              <div style="${std.css({ fontSize: addressSize, fontWeight: 400, opacity: 0.85 })}">${address}</div>
            </div>

            <!-- CTA -->
            <div style="${std.css({ fontSize: ctaSize, fontWeight: 500, fontStyle: "italic", opacity: ctaAnim.opacity * 0.9 })};${ctaAnim.style}">Your seat's waiting.</div>
          </div>
        </div>
      </div>
    `;
  },
});
