import { defineScene } from "superimg";

export default defineScene({
  data: {
    speakerName: "Jane Doe",
    speakerTitle: "Principal Engineer @ TechCo",
    speakerPhoto: "https://i.pravatar.cc/500?img=47",
    hook: "Meet the Speaker.",
    hookLine2: "Deep dive into React Server Components.",
    talkTitle: "Scaling with React Server Components",
    backgroundImage: "https://secure.meetupstatic.com/photos/event/8/6/9/7/highres_516994455.jpeg",
    date: "March 18",
    time: "11 AM – 1 PM",
    address: "3 NE 8th St · Oklahoma City, OK",
    groupName: "OKC ReactJS",
    brandColor: "#0f172a",
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
    const { std, sceneTimeSeconds: time, width, height, data, isPortrait } = ctx;
    const { hook, hookLine2, speakerName, speakerTitle, speakerPhoto, talkTitle, backgroundImage, date, time: eventTime, address, groupName, brandColor, techlahomaSvg } = data;

    const mainDur = 9.0;
    const r = std.createResponsive(ctx);

    // score: main (75%) -> outro (25%)
    const t = std.score({ main: 0.75, outro: 0.25 });

    // === OUTRO PHASE ===
    if (t.active === "outro") {
      const logoWidth = r({ portrait: 500, square: 400, default: 480 });
      const logoAnim = t.motion({ during: "outro", scale: 0.1, duration: 1/3, exit: false });

      return `
        <div style="${std.css({ width, height, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" })}">
          <img src="${techlahomaSvg}" style="${std.css({ width: logoWidth, opacity: logoAnim.opacity })};${logoAnim.style}" />
        </div>
      `;
    }

    // === MAIN CONTENT ===
    const bg = std.backgrounds.kenBurns({ src: backgroundImage, progress: time / mainDur, zoomTo: 1.1, overlay: "rgba(0, 0, 0, 0.65)" });

    // Triggers within "main" phase (9s duration)
    const hook1P = t.tween(0, 1, { during: "main", at: 0/9, duration: 0.8/9 });
    const hook2P = t.tween(0, 1, { during: "main", at: 1.4/9, duration: 0.7/9 });
    const speakerInfoAnim = t.motion({ during: "main", at: 2.7/9, duration: 0.6/9 });
    const expandP = t.tween(0, 1, { during: "main", at: 4.0/9, duration: 0.5/9, easing: "easeInOutCubic" });
    const groupAnim = t.motion({ during: "main", at: 4.2/9, duration: 0.4/9, y: -20 });
    const talkAnim = t.motion({ during: "main", at: 4.4/9, duration: 0.4/9, y: 20 });
    const logisticsAnim = t.motion({ during: "main", at: 4.7/9, duration: 0.4/9, y: 20 });
    
    // Card with enter and exit
    const cardAnim = t.motion({ 
      during: "main", at: 0, duration: 0.5/9, scale: 0.05, 
      exit: { during: "main", at: 8.5/9, duration: 0.5/9 } 
    });

    const hook1Visible = std.text.type(hook, hook1P).visible;
    const hook2Visible = std.text.type(hookLine2, hook2P).visible;

    const hookShiftAmount = r({ portrait: -80, default: -60 });
    const hookShiftY = std.interpolate(expandP, [0, 1], [0, hookShiftAmount], "easeInOutCubic");

    // Responsive sizing
    const cardWidth = r({ portrait: "90%", square: "75%", default: "65%" });
    const cardMaxWidth = r({ portrait: 972, default: 900 });
    const hookSize = r({ portrait: 56, square: 32, default: 44 });
    const speakerNameSize = r({ portrait: 44, square: 28, default: 36 });
    const speakerTitleSize = r({ portrait: 28, square: 16, default: 20 });
    const talkSize = r({ portrait: 36, square: 20, default: 28 });
    const logisticsSize = r({ portrait: 32, square: 16, default: 20 });
    const addressSize = r({ portrait: 28, square: 14, default: 16 });
    const paddingX = r({ portrait: 48, square: 36, default: 48 });
    const paddingY = r({ portrait: 64, square: 36, default: 48 });
    const avatarSize = r({ portrait: 280, square: 200, default: 300 });

    const portraitPaddingTop = paddingY + (avatarSize / 2);
    const landscapePaddingRight = paddingX + (avatarSize / 2);

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden" })}">
        ${bg.html}
        <div style="${std.css({ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 })}">
          <div style="${std.css({
            width: cardWidth, maxWidth: cardMaxWidth, background: std.color.alpha(brandColor, 0.95), borderRadius: 16,
            paddingTop: isPortrait ? portraitPaddingTop : paddingY, paddingBottom: paddingY, paddingLeft: paddingX,
            paddingRight: isPortrait ? paddingX : landscapePaddingRight, boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
            color: "white", textAlign: isPortrait ? "center" : "left", opacity: cardAnim.opacity,
            display: "flex", flexDirection: "column", alignItems: isPortrait ? "center" : "flex-start", position: "relative",
          })};${cardAnim.style}">

            <!-- Overlapping Speaker Avatar -->
            <div style="${std.css({
              width: avatarSize, height: avatarSize, borderRadius: "50%", backgroundImage: `url(${speakerPhoto})`, backgroundSize: "cover",
              position: "absolute", top: isPortrait ? -avatarSize / 2 : "50%", marginTop: isPortrait ? 0 : -avatarSize / 2,
              right: isPortrait ? "auto" : -avatarSize / 3, left: isPortrait ? "50%" : "auto", marginLeft: isPortrait ? -avatarSize / 2 : 0,
              border: "8px solid #cbd5e1", boxShadow: "0 16px 32px rgba(0,0,0,0.3)",
            })}"></div>

            <!-- Hook section -->
            <div style="${std.css({ transform: `translateY(${hookShiftY}px)`, marginBottom: expandP > 0 ? 16 : 0 })}">
              <div style="${std.css({
                fontSize: 16, fontWeight: 600, background: std.color.alpha("#ffffff", 0.2), padding: "6px 16px",
                marginBottom: 24, opacity: groupAnim.opacity, textTransform: "uppercase", letterSpacing: "0.1em", display: "inline-block",
              })};${groupAnim.style}">${groupName}</div>

              <div style="${std.css({ fontSize: hookSize, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, minHeight: hookSize * 1.1 })}">${hook1Visible}</div>
              <div style="${std.css({ fontSize: hookSize * 0.7, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 20, minHeight: hookSize * 0.7 * 1.2, opacity: 0.8 })}">${hook2Visible}</div>
            </div>

            <!-- Speaker Info -->
            <div style="${std.css({ opacity: speakerInfoAnim.opacity, marginBottom: 16 })};${speakerInfoAnim.style}">
              <div style="${std.css({ fontSize: speakerNameSize, fontWeight: 700 })}">${speakerName}</div>
              <div style="${std.css({ fontSize: speakerTitleSize, fontWeight: 400, color: "#61dafb" })}">${speakerTitle}</div>
            </div>

            <!-- Talk Title -->
            <div style="${std.css({ fontSize: talkSize, fontWeight: 600, lineHeight: 1.2, marginBottom: 24, opacity: talkAnim.opacity, fontStyle: "italic" })};${talkAnim.style}">"${talkTitle}"</div>

            <!-- Logistics -->
            <div style="${std.css({ opacity: logisticsAnim.opacity })};${logisticsAnim.style}">
              <div style="${std.css({ fontSize: logisticsSize, fontWeight: 600, marginBottom: 8 })}">${date} · ${eventTime}</div>
              <div style="${std.css({ fontSize: addressSize, fontWeight: 400, opacity: 0.85 })}">${address}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
});
