// Speaker card — a conference badge on a lanyard that unfolds into the talk card.
// No headshot: the badge carries a generated code block and the speaker's initials,
// so the template ships with nothing to fetch.

import { video, Frame, Stack, Text, Fill, Vector, vector, type RenderContext, googleFont } from "@foxworth/superimg";

export interface SpeakerData extends Record<string, unknown> {
  speakerName: string;
  speakerTitle: string;
  talkTitle: string;
  date: string;
  time: string;
  address: string;
  groupName: string;
  brandColor: string;
}

const CARD = "#F7F5F0";
const INK = "#12141B";
const ACID = "#EAF25C";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "··";
  if (w.length === 1) return w[0]!.slice(0, 2).toUpperCase();
  return (w[0]![0]! + w[w.length - 1]![0]!).toUpperCase();
}

/** Deterministic bit field so every speaker gets their own badge code. */
function codeBits(seed: string, n: number): boolean[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: boolean[] = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    out.push(((h >>> 9) & 1) === 1);
  }
  return out;
}

export default video<SpeakerData>({
  duration: "12s",
  fps: 30,
  poster: "10.8s",
  fonts: [googleFont("Inter:wght@400;500;600;700;800;900"), googleFont("IBM Plex Mono:wght@400;500;600")],
  audio: {
    id: "bed",
    src: "../../_assets/lofi-bg.mp3",
    role: "music",
    volume: 0.6,
    fadeIn: "0.5s",
    fadeOut: "1.5s",
    loop: true,
  },
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; font-family: Inter, system-ui, sans-serif; }",
  ],

  editions: {
    landscape: { size: { width: 1920, height: 1080 } },
    square: { size: { width: 1080, height: 1080 } },
    story: { size: { width: 1080, height: 1920 } },
  },

  sample: {
    speakerName: "Jane Doe",
    speakerTitle: "Principal Engineer @ TechCo",
    talkTitle: "Scaling with React Server Components",
    date: "March 18",
    time: "11 AM – 1 PM",
    address: "3 NE 8th St · Oklahoma City, OK",
    groupName: "OKC ReactJS",
    brandColor: "#1A2FCB",
  },

  render(ctx: RenderContext<SpeakerData>) {
    const { std, width, height, data, isPortrait, isSquare } = ctx;
    const { speakerName, speakerTitle, talkTitle, date, time: eventTime, address, groupName } = data;
    const field = data.brandColor;

    const wide = !isPortrait && !isSquare;
    function pick<T>(o: { portrait: T; square: T; wide: T }): T {
      return isPortrait ? o.portrait : isSquare ? o.square : o.wide;
    }
    const s = Math.min(width, height) / 1080;
    const px = (n: number) => Math.round(n * s);

    const t = ctx.director({ drop: "22%", read: "20%", open: "26%", book: "32%" });
    const drop = t.in("drop");
    const open = t.in("open");
    const book = t.in("book");

    // ---- the badge geometry ---------------------------------------------
    const badgeW = pick({ portrait: px(760), square: px(660), wide: px(600) });
    const badgeH = pick({ portrait: px(1010), square: px(830), wide: px(790) });
    const openW = pick({ portrait: px(920), square: px(950), wide: px(1520) });
    const openH = pick({ portrait: px(1300), square: px(900), wide: px(600) });

    const expand = std.interpolate(open, [0.05, 0.85], [0, 1], "easeInOutCubic");
    const cardW = Math.round(std.interpolate(expand, [0, 1], [badgeW, openW]));
    const cardH = Math.round(std.interpolate(expand, [0, 1], [badgeH, openH]));
    const cardX = Math.round((width - cardW) / 2);
    const cardY = Math.round((height - cardH) / 2 + std.interpolate(expand, [0, 1], [px(40), 0]));

    const pad = px(46);
    const bandH = px(84);
    const qrS = px(148);

    // ---- entrance: a badge dropped on a lanyard, swinging to rest --------
    const fall = std.interpolate(drop, [0, 0.62], [0, 1], "easeOutCubic");
    const swingDecay = Math.exp(-4.2 * drop);
    const swing = 9 * swingDecay * Math.cos(drop * 13.5) * (1 - expand);
    const dropY = std.interpolate(fall, [0, 1], [-(cardY + badgeH), 0]);

    // ---- lanyard ---------------------------------------------------------
    const strapTop = Math.max(px(8), cardY);
    const retract = std.interpolate(expand, [0, 0.55], [0, 1], "easeInCubic");
    const strapReveal = std.interpolate(drop, [0, 0.5], [0, 1], "easeOutCubic");
    const clipX = width / 2;
    const spread = pick({ portrait: 0.3, square: 0.3, wide: 0.22 });
    const strapW = px(46);
    const strap = (dir: -1 | 1) => {
      const x0 = clipX + dir * width * spread;
      const angle = (Math.atan2(x0 - clipX, strapTop) * 180) / Math.PI;
      const length = Math.hypot(x0 - clipX, strapTop);
      return vector.group({ id: `strap-${dir}`, transform: `translate(${clipX} ${strapTop}) rotate(${-angle})` },
        vector.path({ d: std.svg.shape.roundedRect(-strapW / 2, -length, strapW, length, 0), fill: "rgba(0,0,0,0.34)" }),
        ...Array.from({ length: 26 }, (_, i) => {
          const y = (i / 26) * length - length;
          return vector.path({ id: `chevron-${dir}-${i}`, d: `M ${-strapW / 2} ${y} L 0 ${y + strapW * 0.34} L ${strapW / 2} ${y}`,
            fill: "none", stroke: "rgba(255,255,255,0.16)", strokeWidth: px(3) });
        }),
      );
    };
    const lanyard = Vector({ id: "lanyard", width, height: strapTop }, strap(-1), strap(1));

    // Decorative identity pattern: deterministic, intentionally not a QR code.
    const grid = 9;
    const bits = codeBits(speakerName + talkTitle, grid * grid);
    const cell = qrS / grid;
    const finder = (gx: number, gy: number) => Frame({ x: gx * cell, y: gy * cell, width: cell * 3, height: cell * 3, fill: INK },
      Fill({ x: cell, y: cell, width: cell, height: cell, color: CARD }),
    );
    const code = Frame({ id: "badge-pattern", width: qrS, height: qrS },
      ...bits.map((bit, i) => {
        const gx = i % grid;
        const gy = Math.floor(i / grid);
        const inFinder = (gx < 3 && gy < 3) || (gx > grid - 4 && gy < 3) || (gx < 3 && gy > grid - 4);
        return inFinder || !bit ? null : Fill({ id: `bit-${i}`, x: gx * cell, y: gy * cell, width: cell, height: cell, color: INK });
      }),
      finder(0, 0), finder(grid - 3, 0), finder(0, grid - 3),
    );

    // ---- element positions across the fold -------------------------------
    const lerp = (a: number, b: number) => Math.round(std.interpolate(expand, [0, 1], [a, b]));
    const idY = lerp(Math.round(badgeH * 0.44), bandH + px(wide ? 74 : 60));
    const qrX = lerp(pad, openW - pad - qrS);
    const qrY = lerp(badgeH - pad - qrS - px(34), bandH + px(wide ? 58 : 34));
    const idW = wide ? Math.round(openW * 0.36) - pad : Math.min(badgeW, openW) - pad * 2;
    const talkX = wide ? px(640) : pad;
    const talkY = wide ? bandH + px(70) : bandH + px(340);
    const talkW = wide ? openW - px(640) - pad - qrS - px(48) : openW - pad * 2;
    const titleH = pick({ portrait: px(220), square: px(210), wide: px(210) });
    const talkH = px(44) + titleH + px(120);

    const reveal = std.interpolate(open, [0.62, 1], [0, 1], "easeOutCubic");
    const nameIn = t.motion({ id: "badge.name", during: "drop", at: "42%", for: "40%", y: px(18), exit: false });
    const titleIn = t.motion({ id: "badge.title", during: "drop", at: "54%", for: "40%", y: px(12), exit: false });
    const codeIn = t.motion({ id: "badge.code", during: "read", at: "0%", for: "40%", scale: 0.86, exit: false });
    const dateIn = t.motion({ id: "card.date", during: "book", at: "0%", for: "26%", y: px(14) });
    const addrIn = t.motion({ id: "card.addr", during: "book", at: "16%", for: "26%", y: px(12) });

    const nameSize = pick({ portrait: px(74), square: px(64), wide: px(66) });
    const talkSize = pick({ portrait: px(52), square: px(50), wide: px(58) });

    const card = Frame(
      {
        id: "badge",
        x: cardX,
        y: cardY,
        width: cardW,
        height: cardH,
        radius: px(14),
        fill: CARD,
        style: {
          overflow: "hidden",
          transformOrigin: "top center",
          transform: `translateY(${dropY.toFixed(1)}px) rotate(${swing.toFixed(2)}deg)`,
          boxShadow: `0 ${px(34)}px ${px(90)}px rgba(0,0,0,0.42)`,
        },
      },
      // header band
      Frame(
        { x: 0, y: 0, width: cardW, height: bandH, fill: INK },
        Stack(
          {
            direction: "row",
            width: "fill",
            height: "fill",
            align: "center",
            justify: "space-between",
            pad: { x: pad },
          },
          Frame(
            { width: Math.round(cardW * 0.5), height: px(22) },
            Text(
              { variant: "label", size: px(17), weight: 600, letterSpacing: px(3.2), fontFamily: MONO, color: CARD },
              groupName.toUpperCase(),
            ),
          ),
          Stack(
            { direction: "row", gap: px(10), align: "center", height: px(30), pad: { x: px(14) }, radius: px(4), fill: ACID },
            Frame(
              { width: px(88), height: px(16) },
              Text({ variant: "label", size: px(14), weight: 700, letterSpacing: px(2.6), fontFamily: MONO, color: INK }, "SPEAKER"),
            ),
          ),
        ),
      ),
      // punched slot — only while it is still a badge
      Frame({
        x: Math.round(cardW / 2 - px(70)),
        y: bandH + px(22),
        width: px(140),
        height: px(18),
        radius: px(9),
        fill: std.color.alpha(INK, 0.16),
        style: { opacity: (1 - expand) * strapReveal },
      }),
      // initials watermark, big and quiet
      Frame(
        { x: pad, y: lerp(Math.round(badgeH * 0.16), openH - Math.round(badgeH * 0.3)), width: Math.round(badgeW * 0.7), height: Math.round(badgeH * 0.24) },
        Text(
          {
            variant: "display",
            size: Math.round(badgeH * 0.26),
            weight: 800,
            letterSpacing: px(-8),
            color: std.color.alpha(field, 0.13),
            lineHeight: 1,
            style: { opacity: strapReveal },
          },
          initials(speakerName),
        ),
      ),
      // identity
      Frame(
        { x: pad, y: idY, width: idW, height: px(210) },
        Frame({
          x: 0,
          y: 0,
          width: px(58),
          height: px(6),
          fill: field,
          style: { transformOrigin: "left center", transform: `scaleX(${strapReveal.toFixed(3)})` },
        }),
        Frame(
          { x: 0, y: px(26), width: idW, height: px(96) },
          Text(
            {
              variant: "display",
              size: nameSize,
              weight: 800,
              letterSpacing: px(-2.2),
              lineHeight: 1.06,
              color: INK,
              motion: nameIn,
            },
            speakerName,
          ),
        ),
        Frame(
          { x: 0, y: px(134), width: idW, height: px(62) },
          Text(
            {
              variant: "title",
              size: px(24),
              weight: 500,
              letterSpacing: px(0.2),
              lineHeight: 1.3,
              color: std.color.alpha(INK, 0.6),
              motion: titleIn,
            },
            speakerTitle,
          ),
        ),
      ),
      // code block
      Frame(
        { x: qrX, y: qrY, width: qrS, height: qrS + px(30), style: codeIn },
        code,
        Frame(
          { x: 0, y: qrS + px(8), width: qrS, height: px(16) },
          Text(
            { variant: "label", size: px(12), weight: 500, letterSpacing: px(1.8), fontFamily: MONO, color: std.color.alpha(INK, 0.45) },
            "ADMIT ONE",
          ),
        ),
      ),
      // fold line — the seam the card opens along
      Frame({
        x: wide ? px(596) : pad,
        y: wide ? bandH + px(54) : bandH + px(292),
        width: wide ? px(2) : openW - pad * 2,
        height: wide ? openH - bandH - px(108) : px(2),
        fill: std.color.alpha(INK, 0.14),
        style: { opacity: expand },
      }),
      // the talk
      Frame(
        { x: talkX, y: talkY, width: talkW, height: talkH, style: { opacity: reveal } },
        Frame(
          { x: 0, y: 0, width: px(260), height: px(18) },
          Text(
            { variant: "label", size: px(14), weight: 600, letterSpacing: px(3), fontFamily: MONO, color: field },
            "NOW PRESENTING",
          ),
        ),
        Frame(
          {
            x: 0,
            y: px(44),
            width: talkW,
            height: titleH,
            style: { transform: `translateY(${std.interpolate(reveal, [0, 1], [px(20), 0]).toFixed(1)}px)` },
          },
          Text(
            {
              variant: "display",
              size: talkSize,
              weight: 800,
              letterSpacing: px(-1.8),
              lineHeight: 1.1,
              color: INK,
              maxWidth: talkW,
            },
            talkTitle,
          ),
        ),
        Frame({
          x: 0,
          y: px(44) + titleH,
          width: talkW,
          height: px(3),
          fill: field,
          style: {
            transformOrigin: "left center",
            transform: `scaleX(${std.interpolate(book, [0, 0.5], [0, 1], "easeInOutCubic").toFixed(3)})`,
          },
        }),
        Frame(
          { x: 0, y: px(44) + titleH + px(30), width: talkW, height: px(40), style: dateIn },
          Frame({
            x: 0,
            y: px(14),
            width: px(12),
            height: px(12),
            radius: px(6),
            fill: ACID,
            style: { boxShadow: `0 0 0 ${px(3)}px ${std.color.alpha(field, 0.25)}` },
          }),
          Frame(
            { x: px(28), y: 0, width: talkW - px(28), height: px(40) },
            Text(
              { variant: "title", size: px(31), weight: 700, letterSpacing: px(-0.4), color: INK },
              `${date} · ${eventTime}`,
            ),
          ),
        ),
        Frame(
          { x: 0, y: px(44) + titleH + px(82), width: talkW, height: px(28), style: addrIn },
          Text(
            { variant: "body", size: px(21), weight: 500, letterSpacing: px(0.2), fontFamily: MONO, color: std.color.alpha(INK, 0.58) },
            address,
          ),
        ),
      ),
    );

    return Frame(
      { id: "stage", width, height },
      Fill({ color: field }),
      Fill({
        gradient: {
          kind: "radial",
          at: "50% 22%",
          size: "120% 90%",
          stops: ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.02)", "transparent"],
        },
      }),
      Fill({
        gradient: {
          kind: "linear",
          angle: "180deg",
          stops: ["transparent", "transparent 52%", "rgba(0,0,0,0.4)"],
        },
      }),
      Frame(
        {
          x: 0,
          y: 0,
          width,
          height: strapTop,
          style: {
            opacity: strapReveal * (1 - retract),
            transform: `translateY(${(-retract * strapTop).toFixed(1)}px)`,
          },
        },
        lanyard,
      ),
      card,
      // floor shadow under the card once it has landed
      Frame({
        x: Math.round(cardX + cardW * 0.06),
        y: cardY + cardH - px(6),
        width: Math.round(cardW * 0.88),
        height: px(40),
        radius: "50%",
        fill: "rgba(0,0,0,0.3)",
        style: { filter: `blur(${px(22)}px)`, opacity: fall * 0.8 },
      }),
    );
  },
});
