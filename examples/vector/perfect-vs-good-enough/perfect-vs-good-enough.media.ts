// Perfect vs Good Enough — hand-drawn lemonade stand comparison
// Demonstrates: std.svg.draw + std.stagger for multi-group line-art reveals
// Based on the classic "perfect (coming soon) vs good enough (selling)" sketch

import { define, Vector, vector, googleFont } from "@foxworth/superimg";

export default define({
  sample: {
    ink: "#2b2b2b",
    paper: "#ffffff",
    panel: "#3f3f3f",
    fillGray: "#e2e2e4",
    lemonade: "#f5ef9e",
    money: "#b9ac3f",
  },

  medium: "svg",
  poster: "8s",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "9s",
    fonts: [googleFont("Inter:wght@400;600;700;800"), googleFont("Fraunces:wght@600"), googleFont("Kalam:wght@400")],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #ffffff; overflow: hidden; font-family: system-ui, sans-serif; }
    `],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { ink, paper, panel, fillGray, lemonade, money } = data;

    // establish (labels) → develop (draw left, draw right) → resolve
    // (punchline stamp, then the money payoff) → hold ≥1s on the settled frame
    const t = ctx.director({
      labels: "0.8s",
      left: "2.4s",
      right: "2.4s",
      stamp: "0.8s",
      payoff: "0.8s",
      hold: "1.8s",
    });

    // --- Path helpers -------------------------------------------------

    // Zigzag trim (awning fringe), teeth pointing down
    const zig = (x1: number, x2: number, y: number, amp: number, teeth: number) => {
      const step = (x2 - x1) / teeth;
      let d = `M ${x1} ${y}`;
      for (let i = 0; i < teeth; i++) {
        d += ` L ${x1 + step * (i + 0.5)} ${y + amp} L ${x1 + step * (i + 1)} ${y}`;
      }
      return d;
    };

    // Rectangle rotated `deg` around its center, as a closed path
    const rotRect = (cx: number, cy: number, w: number, h: number, deg: number) => {
      const r = (deg * Math.PI) / 180;
      const cos = Math.cos(r), sin = Math.sin(r);
      const pts = [
        [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2],
      ].map(([x, y]) => `${cx + x * cos - y * sin} ${cy + x * sin + y * cos}`);
      return `M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} Z`;
    };

    type Stroke = { d: string; w?: number; fill?: string };

    // --- Left stand: the "perfect" booth (viewBox 1200x675) -----------

    const LEFT: Stroke[] = [
      // Stepped marquee crown
      { d: "M 318 332 L 318 292 L 342 292 L 342 276 L 476 276 L 476 292 L 500 292 L 500 332", fill: fillGray },
      // "BEST LEMONADE" sign plate
      { d: rotRect(409, 303, 132, 30, -2), fill: paper },
      // Awning: flares outward
      { d: "M 302 332 L 516 332 L 552 386 L 266 386 Z", fill: fillGray },
      { d: zig(266, 552, 386, 13, 13), w: 2.5 },
      // Booth body
      { d: "M 288 386 L 288 606 L 534 606 L 534 386", fill: fillGray },
      // Left front edge (perspective hint) + base line
      { d: "M 288 606 L 316 616 L 316 398", w: 2 },
      { d: "M 316 616 L 540 616 L 534 606", w: 2 },
      // Serving window (boarded up behind the banner)
      { d: rotRect(438, 438, 176, 66, -1.5) },
      // COMING SOON banner, slapped on diagonally
      { d: rotRect(408, 505, 296, 74, -14), fill: paper, w: 3 },
    ];

    // --- Right stand: "good enough" and open for business --------------

    const plankXs = Array.from({ length: 8 }, (_, i) => 742 + i * 30);
    const RIGHT: Stroke[] = [
      // Two upright posts
      { d: rotRect(742, 448, 18, 260, 1), fill: fillGray },
      { d: rotRect(952, 462, 18, 290, -1), fill: fillGray },
      // Top crossboards (slightly askew)
      { d: rotRect(850, 366, 300, 24, -1.2), fill: fillGray },
      { d: rotRect(852, 398, 296, 22, 0.8), fill: fillGray },
      // LEMONADE sign nailed over the boards
      { d: rotRect(858, 380, 150, 42, -2), fill: paper, w: 3 },
      // Counter slab
      { d: "M 706 482 L 1000 478 L 1010 492 L 716 497 Z", fill: fillGray },
      // Plank front
      { d: "M 722 497 L 722 594 L 976 590 L 976 494", fill: fillGray },
      ...plankXs.map((x) => ({ d: `M ${x} 497 L ${x} 592`, w: 2 })),
      // Lemonade jug on the counter
      {
        d: "M 838 476 Q 830 456 836 440 L 832 432 L 864 432 L 860 440 Q 866 456 858 476 Q 848 480 838 476 Z",
        fill: paper, w: 2.5,
      },
      { d: "M 862 442 Q 874 450 862 464", w: 2.5 },
      // Money bags at the base
      {
        d: "M 748 592 Q 728 588 730 570 Q 724 556 740 550 L 750 546 Q 746 538 754 536 L 766 536 Q 774 538 770 546 L 780 552 Q 794 558 786 572 Q 792 588 772 592 Q 760 596 748 592 Z",
        fill: fillGray, w: 2.5,
      },
      {
        d: "M 786 594 Q 770 590 774 574 Q 770 562 784 558 L 792 554 Q 790 548 796 546 L 806 546 Q 812 548 810 554 L 818 560 Q 828 566 822 578 Q 826 590 810 594 Q 798 598 786 594 Z",
        fill: fillGray, w: 2.5,
      },
      { d: "M 750 544 Q 758 548 768 544 M 792 552 Q 799 556 808 552", w: 2 },
    ];

    // --- Animation ------------------------------------------------------

    const drawGroup = (id: string, paths: Stroke[], progress: number, fillOpacity: number) =>
      std.stagger.ms(paths, progress, {
        windowSeconds: 2.4,
        eachMs: 45,
        capMs: 500,
      })
        // Skip un-started paths: dash-length estimates differ slightly from the
        // browser's, which otherwise leaks a sliver of stroke at progress 0
        .filter(({ progress: p }) => p > 0)
        .map(({ item, index, progress: p }) => vector.path({
          id: `${id}-stroke-${index}`, d: item.d,
          fill: item.fill ?? "none", fillOpacity: fillOpacity * p,
          stroke: ink, strokeWidth: item.w ?? 3, strokeLinecap: "round", strokeLinejoin: "round",
          ...std.svg.draw(item.d, p),
        }));

    const leftP = t.in("left");
    const rightP = t.in("right");
    const stampP = t.in("stamp");
    const payoffP = t.in("payoff");

    // Fills settle in as each side finishes drawing (ink first, then wash)
    const leftFill = std.interpolate(leftP, [0.75, 1], [0, 1]);
    const rightFill = std.interpolate(rightP, [0.75, 1], [0, 1]);

    // Each sign's lettering arrives as its own side finishes — never all at once
    const bestLemOp = std.interpolate(leftP, [0.82, 0.96], [0, 1], "easeOutCubic");
    const lemonadeOp = std.interpolate(rightP, [0.82, 0.96], [0, 1], "easeOutCubic");

    // COMING SOON stamps down onto the booth: scale settles 1.3 → 1
    const stampScale = std.interpolate(stampP, [0, 1], [1.3, 1], "easeOutCubic");
    const stampOp = std.interpolate(stampP, [0, 0.45], [0, 1]);

    // Payoff: lemonade pours, then the $ pop in with a small overshoot
    const pourP = std.interpolate(payoffP, [0, 0.6], [0, 1], "easeOutCubic");
    const d1 = std.interpolate(payoffP, [0.15, 0.75], [0, 1], "easeOutBack");
    const d2 = std.interpolate(payoffP, [0.3, 0.9], [0, 1], "easeOutBack");

    const lemonadeFill = vector.group({ id: "payoff" },
      vector.defs(vector.clip({ id: "pour" }, vector.path({ d: std.svg.shape.roundedRect(828, 476 - 32 * pourP, 40, 36, 0), fill: "#fff" }))),
      vector.path({ id: "lemonade", d: "M840,472Q834,458 838,448L858,448Q862,458 856,472Q848,475 840,472Z", fill: lemonade, clip: "pour" }),
      d1 > 0 ? vector.group({ id: "earnings-first", transform: { x: 759, y: 570, scale: Math.max(0, d1) }, opacity: std.clamp01(d1) },
        vector.text({ family: "Inter", x: 0, y: 8, size: 24, weight: 700, fill: money, anchor: "middle" }, "$")) : null,
      d2 > 0 ? vector.group({ id: "earnings-second", transform: { x: 798, y: 575, scale: Math.max(0, d2) }, opacity: std.clamp01(d2) * 0.85 },
        vector.text({ family: "Inter", x: 0, y: 7, size: 20, weight: 700, fill: money, anchor: "middle" }, "$")) : null,
    );

    const lettering = vector.group({ id: "lettering" },
      vector.text({ family: "Inter", x: 409, y: 309, transform: { rotate: -2, originX: 409, originY: 303 }, anchor: "middle", size: 12, weight: 800, letterSpacing: 1.5, fill: ink, opacity: bestLemOp }, "BEST LEMONADE"),
      vector.text({ x: 408, y: 514, transform: { rotate: -14, scale: stampScale, originX: 408, originY: 505 }, anchor: "middle", size: 28, weight: 600, letterSpacing: 4, fill: ink, family: "Fraunces", opacity: stampOp }, "COMING SOON"),
      vector.text({ x: 858, y: 389, transform: { rotate: -2, originX: 858, originY: 380 }, anchor: "middle", size: 24, letterSpacing: 2, fill: ink, family: "Kalam", opacity: lemonadeOp }, "LEMONADE"),
    );

    // Header labels drop in with a short stagger — left leads, right follows
    const labelPs = std.stagger.ms(2, t.in("labels"), {
      windowSeconds: 0.8,
      eachMs: 80,
      capMs: 200,
    });
    const label = (x: number, w: number, text: string, p: number) => {
      const y = std.interpolate(p, [0, 1], [16, 0]);
      return vector.group({ id: `label-${x}`, opacity: p, transform: { y } },
        vector.path({ d: std.svg.shape.roundedRect(x, 96, w, 64, 0), fill: panel }),
        vector.text({ family: "Inter", x: x + w / 2, y: 139, anchor: "middle", size: 30, weight: 800, letterSpacing: 7, fill: paper }, text),
      );
    };

    return Vector({ id: "lemonade-comparison", width, height, viewBox: { x: 0, y: 0, width: 1200, height: 675 } },
      vector.path({ id: "paper", d: "M0,0H1200V675H0Z", fill: paper }),
      label(258, 268, "PERFECT", labelPs[0] ?? 0),
      label(688, 324, "GOOD ENOUGH", labelPs[1] ?? 0),
      ...drawGroup("perfect", LEFT, leftP, leftFill),
      ...drawGroup("open", RIGHT, rightP, rightFill),
      lemonadeFill, lettering,
    );
  },
});
