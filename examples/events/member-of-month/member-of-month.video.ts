import { defineScene } from "superimg";

export default defineScene({
  data: {
    name: "Luigi Polvani",
    role: "Software Engineer",
    location: "Norman, OK",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
    quote: "Luigi has made major contributions to the Norman tech scene through Coffee and Code meetups and Oklathon.",
    techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png",
    ctaUrl: "techlahoma.org/volunteer",
    brandColor: "#FFD700",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 15,
    fonts: ["Inter:wght@400;500;600;700;800"],
    audio: { src: "../../_assets/lofi-bg.mp3", volume: 0.5, fadeIn: 0.5, fadeOut: 1.5, loop: true },
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
    const { std, sceneTimeSeconds: time, width, height, data, isPortrait, isSquare } = ctx;
    const { name, role, location, photoUrl, quote, techlahomaSvg, ctaUrl, brandColor } = data;

    // Timeline for a 15s scene
    const t = std.score({
      build: 0.2,    // 3s (Frame + Photo)
      content: 0.5,  // 7.5s (Name + Role + Quote)
      poster: 0.3    // 4.5s (Final Badge + CTA)
    });

    // Build animations
    const frameAnim = t.motion({ at: 0, duration: 0.6, scale: 0.8 });
    const photoAnim = t.motion({ at: 0.5, duration: 0.8, scale: 0 });
    const logoAnim  = t.motion({ at: 0.7, duration: 0.5, y: -20 });
    const titleAnim = t.motion({ at: 0.3, duration: 0.5, y: 20 });

    // Content animations
    const nameAnim = t.motion({ during: "content", at: 0, duration: 0.4, y: 30 });
    const roleAnim = t.motion({ during: "content", at: 0.15, duration: 0.4, y: 20 });
    const quoteAnim = t.motion({ 
      during: "content", 
      at: 0.3, 
      duration: 0.4, 
      y: isPortrait ? 40 : -40,
      exit: { opacity: 0 } // Custom exit to match original's quoteEnd timing
    });

    // Poster moment
    const badgeAnim = t.motion({ during: "poster", at: 0, duration: 0.4, scale: 0.9 });
    const ctaAnim = t.motion({ during: "poster", at: 0.4, duration: 0.4, y: 20 });

    // Pulse effect for final badge
    const badgePulse = t.active === "poster" ? 1 + Math.sin((time - 11) * 3) * 0.02 : 1;

    // Responsive sizing
    const frameSize = isPortrait ? 300 : isSquare ? 240 : 260;
    const frameBorder = isPortrait ? 8 : 6;
    const photoSize = frameSize - frameBorder * 4;
    const nameSize = isPortrait ? 48 : isSquare ? 36 : 42;
    const roleSize = isPortrait ? 24 : isSquare ? 18 : 22;
    const titleSize = isPortrait ? 20 : isSquare ? 16 : 18;
    const quoteSize = isPortrait ? 24 : isSquare ? 18 : 22;
    const logoHeight = isPortrait ? 32 : 28;
    const ctaSize = isPortrait ? 18 : 16;
    const padding = isPortrait ? 48 : 60;
    const frameTop = isPortrait ? 160 : isSquare ? 80 : 100;

    return `
      <div style="${std.css({
        width, height, background: "#000",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      })}">
        <!-- Techlahoma Logo (top right) -->
        <img src="${techlahomaSvg}" style="${std.css({
          position: "absolute", top: padding, right: padding,
          height: logoHeight,
        })}; ${logoAnim.style}" />

        <!-- Quote Box -->
        ${quoteAnim.visible ? `
          <div style="${std.css({
            position: "absolute",
            top: isPortrait ? "auto" : 60,
            bottom: isPortrait ? frameTop + frameSize + 180 : "auto",
            left: padding, right: padding,
            background: brandColor, borderRadius: 12,
            padding: isPortrait ? "20px 24px" : "24px 32px",
          })}; ${quoteAnim.style}">
            <div style="${std.css({
              fontSize: quoteSize, fontWeight: 500, color: "#000",
              lineHeight: 1.5, textAlign: "center",
            })}">"${quote}"</div>
          </div>
        ` : ""}

        <!-- Main Content Container -->
        <div style="${std.css({
          display: "flex", flexDirection: "column", alignItems: "center",
          marginTop: isPortrait ? 0 : 40,
        })}">
          <!-- Yellow Frame -->
          <div style="${std.css({
            width: frameSize, height: frameSize,
            border: `${frameBorder}px solid ${brandColor}`,
            borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          })}; ${frameAnim.style}">
            <!-- Photo -->
            <div style="${std.css({
              width: photoSize, height: photoSize,
              borderRadius: 8, overflow: "hidden",
            })}; ${photoAnim.style}">
              <img src="${photoUrl}" style="${std.css({
                width: "100%", height: "100%", objectFit: "cover",
                filter: "grayscale(100%)",
              })}" />
            </div>
          </div>

          <!-- Name -->
          <div style="${std.css({
            marginTop: 24,
            fontSize: nameSize, fontWeight: 800, color: "#fff",
          })}; ${nameAnim.style}">${name}</div>

          <!-- Role + Location -->
          <div style="${std.css({
            marginTop: 8,
            fontSize: roleSize, fontWeight: 500, color: "rgba(255,255,255,0.7)",
          })}; ${roleAnim.style}">${role} | ${location}</div>
        </div>

        <!-- MEMBER OF THE MONTH Title -->
        <div style="${std.css({
          position: "absolute",
          bottom: isPortrait ? 120 : 80,
          left: 0, right: 0, textAlign: "center",
        })}">
          ${t.active === "poster" ? `
            <!-- Poster moment: prominent badge -->
            <div style="${std.css({
              display: "inline-block",
              background: brandColor,
              padding: isPortrait ? "16px 40px" : "12px 32px",
              borderRadius: 8,
              transform: `scale(${badgePulse})`,
            })}; ${badgeAnim.style}">
              <div style="${std.css({
                fontSize: titleSize + 4, fontWeight: 800, color: "#000",
                letterSpacing: "0.1em",
              })}">MEMBER OF THE MONTH</div>
            </div>
          ` : `
            <!-- Regular title during earlier phases -->
            <div style="${std.css({
              fontSize: titleSize, fontWeight: 600, color: "rgba(255,255,255,0.6)",
              letterSpacing: "0.15em",
            })}; ${titleAnim.style}">MEMBER OF THE MONTH</div>
          `}
        </div>

        <!-- CTA URL -->
        <div style="${std.css({
          position: "absolute",
          bottom: isPortrait ? 60 : 40,
          left: 0, right: 0, textAlign: "center",
          fontSize: ctaSize, fontWeight: 500, color: "rgba(255,255,255,0.5)",
        })}; ${ctaAnim.style}">${ctaUrl}</div>
      </div>
    `;
  },
});
