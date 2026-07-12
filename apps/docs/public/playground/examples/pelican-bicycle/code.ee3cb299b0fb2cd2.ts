// Pelican on a Bicycle — whimsical animated video with inline SVG
// Demonstrates: timeline.seconds-driven SVG transforms, looping motion, director intro

import { define } from "superimg";

export default define({
  sample: {
    skyTop: "#87CEEB",
    skyBottom: "#E0F4FF",
    road: "#6B7280",
    grass: "#4ADE80",
    frameColor: "#F97316",
    wheelColor: "#1F2937",
    pelicanBody: "#F8FAFC",
    pelicanWing: "#CBD5E1",
    beakColor: "#FB923C",
    pouchColor: "#FDBA74",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "6s",
    inlineCss: [
      "* { margin: 0; padding: 0; box-sizing: border-box; }",
      "body { overflow: hidden; font-family: system-ui, sans-serif; }",
    ],
  },

  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const {
      skyTop,
      skyBottom,
      road,
      grass,
      frameColor,
      wheelColor,
      pelicanBody,
      pelicanWing,
      beakColor,
      pouchColor,
    } = data;

    const t = ctx.director({ intro: "1.2s", ride: "4.0s", outro: "0.8s" });
    const titleMotion = t.motion({ y: 18, exit: { y: -12 } });

    // Layout (proportional to frame size)
    const groundY = height * 0.78;
    const rearHub = { x: width * 0.34, y: groundY - height * 0.096 };
    const frontHub = { x: width * 0.62, y: groundY - height * 0.096 };
    const crank = { x: width * 0.425, y: groundY - height * 0.096 };
    const seat = { x: width * 0.385, y: groundY - height * 0.24 };
    const handle = { x: width * 0.585, y: groundY - height * 0.29 };

    // Continuous loop motion from scene time
    const wheelRpm = 1.4; // seconds per revolution
    const wheelAngle = ((timeline.seconds / wheelRpm) * 360) % 360;
    const pelicanBob = Math.sin((timeline.seconds * Math.PI * 2) / 0.9) * height * 0.008;
    const cloudDrift1 = (timeline.seconds * (width * 0.02)) % (width * 0.05);
    const cloudDrift2 = (timeline.seconds * (width * 0.015)) % (width * 0.04);
    const roadDashOffset = timeline.seconds * 140;
    const bikeTravel = std.interpolate(
      t.in("ride"),
      [0, 1],
      [0, width * 0.08],
      "easeInOutSine"
    );

    const wheelR = height * 0.096;
    const spoke = (len: number) => `
      <line x1="${-len}" y1="0" x2="${len}" y2="0" stroke="${wheelColor}" stroke-width="3" stroke-linecap="round"/>
      <line x1="0" y1="${-len}" x2="0" y2="${len}" stroke="${wheelColor}" stroke-width="3" stroke-linecap="round"/>
      <line x1="${-len * 0.7}" y1="${-len * 0.7}" x2="${len * 0.7}" y2="${len * 0.7}" stroke="${wheelColor}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${len * 0.7}" y1="${-len * 0.7}" x2="${-len * 0.7}" y2="${len * 0.7}" stroke="${wheelColor}" stroke-width="2.5" stroke-linecap="round"/>
    `;

    const wheel = (hub: { x: number; y: number }) => `
      <g transform="translate(${hub.x + bikeTravel} ${hub.y})">
        <circle r="${wheelR}" fill="none" stroke="${wheelColor}" stroke-width="7"/>
        <g transform="rotate(${wheelAngle})">${spoke(wheelR * 0.83)}</g>
        <circle r="8" fill="${frameColor}"/>
      </g>
    `;

    const pelicanX = seat.x - width * 0.03 + bikeTravel;
    const pelicanY = seat.y - height * 0.155 + pelicanBob;

    return `
      <div style="${std.css({ width, height, position: "relative" })}">
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${skyTop}"/>
              <stop offset="100%" stop-color="${skyBottom}"/>
            </linearGradient>
            <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${road}"/>
              <stop offset="100%" stop-color="#374151"/>
            </linearGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#00000022"/>
            </filter>
          </defs>

          <rect width="${width}" height="${height}" fill="url(#sky)"/>

          <ellipse cx="${width * 0.2}" cy="${groundY - height * 0.03}" rx="${width * 0.12}" ry="${height * 0.065}" fill="${grass}" opacity="0.55"/>
          <ellipse cx="${width * 0.8}" cy="${groundY - height * 0.015}" rx="${width * 0.14}" ry="${height * 0.075}" fill="${grass}" opacity="0.45"/>

          <g opacity="0.9">
            <g transform="translate(${cloudDrift1} 0)">
              <ellipse cx="${width * 0.15}" cy="${height * 0.16}" rx="${width * 0.028}" ry="${height * 0.046}" fill="#fff"/>
              <ellipse cx="${width * 0.19}" cy="${height * 0.135}" rx="${width * 0.02}" ry="${height * 0.04}" fill="#fff"/>
              <ellipse cx="${width * 0.12}" cy="${height * 0.135}" rx="${width * 0.016}" ry="${height * 0.033}" fill="#fff"/>
            </g>
            <g transform="translate(${-cloudDrift2} 0)">
              <ellipse cx="${width * 0.75}" cy="${height * 0.2}" rx="${width * 0.032}" ry="${height * 0.05}" fill="#fff"/>
              <ellipse cx="${width * 0.79}" cy="${height * 0.18}" rx="${width * 0.022}" ry="${height * 0.043}" fill="#fff"/>
              <ellipse cx="${width * 0.72}" cy="${height * 0.182}" rx="${width * 0.018}" ry="${height * 0.037}" fill="#fff"/>
            </g>
          </g>

          <rect x="0" y="${groundY}" width="${width}" height="${height - groundY}" fill="${grass}"/>
          <rect x="0" y="${groundY + height * 0.06}" width="${width}" height="${height * 0.2}" fill="url(#road)"/>
          <line x1="0" y1="${groundY + height * 0.12}" x2="${width}" y2="${groundY + height * 0.12}"
                stroke="#FDE68A" stroke-width="5" stroke-dasharray="40 30"
                stroke-dashoffset="${roadDashOffset}" opacity="0.85"/>

          <g filter="url(#softShadow)">
            ${wheel(rearHub)}
            ${wheel(frontHub)}

            <path d="M ${rearHub.x + bikeTravel} ${rearHub.y}
                     L ${crank.x + bikeTravel} ${crank.y}
                     L ${seat.x + bikeTravel} ${seat.y}
                     L ${handle.x + bikeTravel} ${handle.y}
                     L ${frontHub.x + bikeTravel} ${frontHub.y}
                     M ${crank.x + bikeTravel} ${crank.y} L ${frontHub.x + bikeTravel} ${frontHub.y}"
                  fill="none" stroke="${frameColor}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M ${seat.x + bikeTravel - 8} ${seat.y + 4} Q ${seat.x + bikeTravel + 10} ${seat.y + 18} ${seat.x + bikeTravel + 28} ${seat.y + 6}"
                  fill="none" stroke="${frameColor}" stroke-width="7" stroke-linecap="round"/>
            <line x1="${handle.x + bikeTravel}" y1="${handle.y}" x2="${handle.x + bikeTravel + 4}" y2="${handle.y - height * 0.07}"
                  stroke="${frameColor}" stroke-width="7" stroke-linecap="round"/>
            <line x1="${handle.x + bikeTravel - 22}" y1="${handle.y - height * 0.063}" x2="${handle.x + bikeTravel + 26}" y2="${handle.y - height * 0.063}"
                  stroke="${frameColor}" stroke-width="7" stroke-linecap="round"/>

            <g transform="translate(${crank.x + bikeTravel} ${crank.y})">
              <g transform="rotate(${wheelAngle})">
                <line x1="-26" y1="0" x2="26" y2="0" stroke="${frameColor}" stroke-width="6" stroke-linecap="round"/>
                <rect x="-34" y="-7" width="14" height="14" rx="3" fill="#111827"/>
                <rect x="20" y="-7" width="14" height="14" rx="3" fill="#111827"/>
              </g>
            </g>
          </g>

          <g filter="url(#softShadow)" transform="translate(${pelicanX} ${pelicanY})">
            <path d="M 10 95 Q -30 80 -18 58 Q -5 72 10 78 Z" fill="${pelicanWing}"/>
            <ellipse cx="72" cy="88" rx="58" ry="48" fill="${pelicanBody}"/>
            <ellipse cx="88" cy="102" rx="42" ry="34" fill="${pelicanBody}"/>
            <path d="M 48 72 Q 20 50 58 38 Q 95 55 88 78 Z" fill="${pelicanWing}"/>
            <path d="M 52 74 Q 30 58 52 48" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
            <path d="M 108 70 Q 138 42 162 48 Q 176 52 170 66 Q 158 78 132 82 Q 118 84 108 70 Z" fill="${pelicanBody}"/>
            <path d="M 168 58 L 250 52 Q 258 56 252 64 L 176 70 Z" fill="${beakColor}"/>
            <path d="M 176 68 Q 210 92 198 112 Q 182 104 174 78 Z" fill="${pouchColor}" stroke="${beakColor}" stroke-width="2"/>
            <circle cx="166" cy="58" r="5" fill="#111827"/>
            <circle cx="168" cy="56" r="1.8" fill="#fff"/>
            <path d="M 78 128 L 70 150 L 58 158" fill="none" stroke="${beakColor}" stroke-width="5" stroke-linecap="round"/>
            <path d="M 96 130 L 104 152 L 118 160" fill="none" stroke="${beakColor}" stroke-width="5" stroke-linecap="round"/>
            <path d="M 128 78 Q 148 88 138 98 Q 126 92 120 82 Z" fill="#EF4444"/>
          </g>
        </svg>

        <div style="${std.css({
          position: "absolute",
          left: 0,
          right: 0,
          top: height * 0.04,
          textAlign: "center",
          pointerEvents: "none",
        })}; ${titleMotion.style}">
          <div style="font-size:${height * 0.046}px;font-weight:700;color:#0F172A;opacity:0.9">
            Pelican Commute
          </div>
          <div style="font-size:${height * 0.022}px;color:#475569;margin-top:6px">
            SuperImg video · inline SVG animation
          </div>
        </div>
      </div>
    `;
  },
});