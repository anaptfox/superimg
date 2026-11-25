// Contributors — an honour board of enamel pins. Every face is drawn deterministically
// from the login string, so the film renders offline with no avatar CDN in the loop.

import { video, Frame, Stack, Text, Fill, Html, googleFont } from "@foxworth/superimg";

export interface ContributorItem {
  login: string;
  contributions: number;
}

export interface ContributorsVideoData extends Record<string, unknown> {
  contributors: ContributorItem[];
  repo: string;
  description: string;
  totalContributors: number;
  theme: "light" | "dark";
  showContributions: boolean;
  accentColor: string;
}

const DISPLAY = "'Archivo', 'Inter', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const BOARDS = {
  dark: { felt: "#0C1512", grain: "#16241E", ink: "#F0EFE6", faint: "rgba(240,239,230,0.45)", disc: 26 },
  light: { felt: "#EDE7D8", grain: "#DED5C0", ink: "#17201C", faint: "rgba(23,32,28,0.5)", disc: 76 },
} as const;





/** FNV-1a — same login always draws the same face. */
function hash32(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function picker(seed: number) {
  let s = seed || 1;
  return (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % n;
  };
}

/** A portrait built from a login: hue, head, cap, eyes, mouth, one accessory. */
function portrait(login: string, discL: number): string {
  const pick = picker(hash32(login));
  const hue = pick(360);
  const alt = (hue + 140 + pick(80)) % 360;

  const disc = `hsl(${hue} 42% ${discL}%)`;
  const skin = `hsl(${hue} 64% ${discL > 50 ? 58 : 62}%)`;
  const cap = `hsl(${alt} 58% ${discL > 50 ? 42 : 52}%)`;
  const dark = `hsl(${hue} 60% 14%)`;

  const capDrop = 6 + pick(14); // how low the hair sits
  const eyeR = 3 + pick(2);
  const eyeDx = 8 + pick(3);
  const smile = pick(3) - 1; // -1 frown, 0 flat, 1 smile
  const accessory = pick(4); // 0 none, 1 glasses, 2 cheeks, 3 antenna

  const mouth =
    smile === 0
      ? `<line x1="44" y1="59" x2="56" y2="59" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/>`
      : `<path d="M43,${smile > 0 ? 57 : 61} Q50,${smile > 0 ? 65 : 54} 57,${smile > 0 ? 57 : 61}" fill="none" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/>`;

  const extras =
    accessory === 1
      ? `<g fill="none" stroke="${dark}" stroke-width="1.8" opacity="0.85">
           <circle cx="${50 - eyeDx}" cy="46" r="7.5"/><circle cx="${50 + eyeDx}" cy="46" r="7.5"/>
           <line x1="${50 - eyeDx + 7.5}" y1="46" x2="${50 + eyeDx - 7.5}" y2="46"/>
         </g>`
      : accessory === 2
        ? `<g fill="hsl(${alt} 70% 60%)" opacity="0.55">
             <circle cx="${50 - eyeDx - 6}" cy="54" r="4"/><circle cx="${50 + eyeDx + 6}" cy="54" r="4"/>
           </g>`
        : accessory === 3
          ? `<g stroke="${cap}" stroke-width="2.4" fill="${cap}">
               <line x1="50" y1="22" x2="50" y2="13" stroke-linecap="round"/><circle cx="50" cy="10" r="3.6" stroke="none"/>
             </g>`
          : "";

  return `<g clip-path="url(#disc-clip)">
  <circle cx="50" cy="50" r="50" fill="${disc}"/>
  <path d="M12,100 Q12,74 50,74 Q88,74 88,100 Z" fill="${cap}" opacity="0.9"/>
  <circle cx="50" cy="46" r="26" fill="${skin}"/>
  <path d="M24,${46 - capDrop + 8} A26,26 0 0 1 76,${46 - capDrop + 8} L76,${46 - capDrop} A26,26 0 0 0 24,${46 - capDrop} Z" fill="${cap}"/>
  <path d="M24,46 A26,26 0 0 1 76,46 L76,${46 - capDrop} A26,26 0 0 0 24,${46 - capDrop} Z" fill="${cap}"/>
  <circle cx="${50 - eyeDx}" cy="46" r="${eyeR}" fill="${dark}"/>
  <circle cx="${50 + eyeDx}" cy="46" r="${eyeR}" fill="${dark}"/>
  ${mouth}
  ${extras}
</g>`;
}

export default video<ContributorsVideoData>({
  duration: "9.5s",
  poster: "7.6s",
  fonts: [googleFont("Archivo:wght@600;700;800"), googleFont("IBM+Plex+Mono:wght@400;500;600")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    repo: "vercel/next.js",
    description: "The React Framework for the Web",
    totalContributors: 3200,
    contributors: [
      { login: "timneutkens", contributions: 5420 },
      { login: "ijjk", contributions: 3180 },
      { login: "Timer", contributions: 2850 },
      { login: "balazsorban44", contributions: 1920 },
      { login: "leerob", contributions: 890 },
      { login: "huozhi", contributions: 750 },
    ],
    theme: "dark",
    showContributions: true,
    accentColor: "#C8A24A",
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { contributors, repo, description, totalContributors, theme, showContributions, accentColor } = data;
    const board = theme === "light" ? BOARDS.light : BOARDS.dark;

    if (contributors.length === 0) {
      return Frame(
        { id: "empty-state", width, height, fill: board.felt },
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center", gap: 24, pad: 96 },
          Text({ variant: "title", size: 52, color: board.ink }, repo),
          Text({ variant: "body", size: 30, color: board.ink }, "No contributors yet"),
        ),
      );
    }

    const t = ctx.director({
      board: "13%",
      pin: "38%",
      tally: "17%",
      hold: "23%",
      exit: "9%",
    });

    const n = contributors.length;
    const most = Math.max(1, ...contributors.map((c) => c.contributions));
    const topLogin = contributors.reduce((best, c) => (c.contributions > best.contributions ? c : best), contributors[0]!).login;

    // ── Board geometry ──────────────────────────────────────────────────────
    const margin = 96;
    const headH = 250;
    const cols = Math.min(6, Math.max(1, n));
    const rows = Math.ceil(n / cols);
    const gapX = 52;
    const gapY = 44;
    const availW = width - margin * 2;
    const size = Math.min(214, Math.floor((availW - gapX * (cols - 1)) / cols));
    const cellH = size + 84;
    const gridW = cols * size + (cols - 1) * gapX;
    const gridX = Math.round((width - gridW) / 2);
    const gridH = rows * cellH + (rows - 1) * gapY;
    const gridY = headH + Math.max(0, (height - headH - margin - gridH) / 2);

    const boardP = t.in("board");
    const headOp = std.interpolate(boardP, [0, 0.55], [0, 1], "easeOutCubic");
    const headY = std.interpolate(boardP, [0, 0.7], [16, 0], "easeOutQuint");
    const ruleP = std.interpolate(boardP, [0.35, 1], [0, 1], "easeOutQuart");

    const pinP = t.in("pin");
    const pinAt = (i: number) => {
      const step = 1 / (n + 2.4);
      return std.clamp01((pinP - i * step * 0.95) / (step * 2.4));
    };

    const tallyP = t.in("tally");
    const shownTotal = std.interpolate(tallyP, [0, 0.85], [0, totalContributors], "easeOutQuint");
    const crown = std.interpolate(tallyP, [0.3, 0.8], [0, 1], "easeOutQuart");

    const exitOp = 1 - std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");

    // ── Pins ────────────────────────────────────────────────────────────────
    const pins = contributors.map((person, i) => {
      const p = pinAt(i);
      if (p <= 0.001) return null;

      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridX + col * (size + gapX);
      const y = gridY + row * (cellH + gapY);

      const scale = std.spring(0.68, 1, p, "snappy");
      const op = std.clamp01(p * 2.4);
      // The gauge sweeps a beat behind the pin landing.
      const gauge = std.interpolate(std.clamp01((p - 0.4) / 0.6), [0, 1], [0, 1], "easeOutCubic");
      const share = person.contributions / most;

      const isTop = person.login === topLogin;
      const ringLit = isTop ? crown : 0;

      const r = 50;
      const gaugeR = 56;
      const circ = 2 * Math.PI * gaugeR;
      const svg = `<svg width="${size}" height="${size}" viewBox="-8 -8 116 116" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="disc-clip"><circle cx="50" cy="50" r="${r}"/></clipPath></defs>
  ${portrait(person.login, board.disc)}
  <circle cx="50" cy="50" r="${r}" fill="none" stroke="${std.color.alpha(accentColor, 0.35 + ringLit * 0.55)}" stroke-width="${(2 + ringLit * 1.6).toFixed(2)}"/>
  <circle cx="50" cy="50" r="${gaugeR}" fill="none" stroke="${std.color.alpha(board.ink, 0.12)}" stroke-width="3"/>
  <circle cx="50" cy="50" r="${gaugeR}" fill="none" stroke="${accentColor}" stroke-width="3" stroke-linecap="round"
          stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ * (1 - share * gauge)).toFixed(2)}"
          transform="rotate(-90 50 50)"/>
  ${ringLit > 0 ? `<circle cx="50" cy="50" r="${(gaugeR + 6 + ringLit * 5).toFixed(2)}" fill="none" stroke="${std.color.alpha(accentColor, 0.4 * ringLit)}" stroke-width="1.2"/>` : ""}
</svg>`;

      return Frame(
        {
          id: `pin-${person.login}`,
          x,
          y,
          width: size,
          height: cellH,
          style: { opacity: op, transform: `scale(${scale.toFixed(4)})`, transformOrigin: "center top" },
        },
        Html({ width: size, height: size, html: svg }),
        Frame(
          { x: 0, y: size + 16, width: size, height: 60 },
          Stack(
            { width: size, height: 60, gap: 7 },
            Text(
              {
                variant: "label",
                color: isTop && crown > 0.4 ? accentColor : board.ink,
                size: 18,
                weight: 700,
                fontFamily: DISPLAY,
                align: "center",
                maxWidth: size,
              },
              person.login,
            ),
            showContributions
              ? Text(
                  { variant: "label", color: board.faint, size: 14, fontFamily: MONO, align: "center", letterSpacing: 1 },
                  `${std.text.formatCompact(person.contributions)} commits`,
                )
              : null,
          ),
        ),
      );
    });

    // ── Board grain ─────────────────────────────────────────────────────────
    const grainSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="felt" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" seed="19" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" filter="url(#felt)" opacity="${theme === "light" ? 0.06 : 0.09}"/>
</svg>`;

    return Frame(
      { id: "board", width, height },
      Fill({ color: board.felt }),
      Fill({
        gradient: { kind: "radial", at: "50% 8%", size: "82% 66%", stops: [std.color.alpha(board.grain, 0.95), "transparent"] },
      }),
      Html({ id: "grain", width, height, html: grainSvg }),

      Frame(
        { x: 0, y: 0, width, height, style: { opacity: exitOp } },

        // Plaque header
        Frame(
          { x: margin, y: 92, width: width - margin * 2, height: 120, style: { opacity: headOp, transform: `translateY(${headY.toFixed(2)}px)` } },
          Stack(
            { width: width - margin * 2, gap: 14 },
            Stack(
              { direction: "row", height: 22, gap: 14, align: "center" },
              Frame({ width: 26, height: 3, fill: accentColor }),
              Text({ variant: "label", color: accentColor, size: 14, weight: 600, fontFamily: MONO, letterSpacing: 5 }, "BUILT BY"),
            ),
            Text({ variant: "display", color: board.ink, size: 56, weight: 800, fontFamily: DISPLAY, letterSpacing: -1.8 }, repo),
            description
              ? Text({ variant: "caption", color: board.faint, size: 22, fontFamily: DISPLAY, maxWidth: 900 }, description)
              : null,
          ),
        ),

        // Total, counted up during the tally
        Frame(
          { x: width - margin - 320, y: 96, width: 320, height: 104, style: { opacity: headOp } },
          Stack(
            { width: 320, height: 104, gap: 6 },
            Text({ variant: "display", color: accentColor, size: 62, weight: 800, fontFamily: DISPLAY, align: "right", letterSpacing: -2 }, std.text.formatCompact(Math.round(shownTotal))),
            Text({ variant: "label", color: board.faint, size: 15, weight: 500, fontFamily: MONO, align: "right", letterSpacing: 3 }, "CONTRIBUTORS"),
            Text({ variant: "label", color: board.faint, size: 14, fontFamily: MONO, align: "right", letterSpacing: 1.5 }, `TOP ${n} SHOWN`),
          ),
        ),

        // Rule under the plaque
        Frame({
          x: margin,
          y: 232,
          width: width - margin * 2,
          height: 1,
          fill: std.color.alpha(board.ink, 0.18),
          style: { transform: `scaleX(${ruleP.toFixed(3)})`, transformOrigin: "left center" },
        }),

        ...pins,
      ),
    );
  },
});
