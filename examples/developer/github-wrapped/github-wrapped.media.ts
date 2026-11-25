// GitHub Wrapped — set as a printed annual report, not a streaming recap.
// Persistent page furniture; the centre column turns like a broadside.

import { video, Frame, Stack, Text, Html, type RenderContext, googleFont } from "@foxworth/superimg";

export interface TopLanguage {
  name: string;
  percent: number;
  color: string;
}

export interface TopRepo {
  name: string;
  stars: number;
}

export interface GitHubWrappedData extends Record<string, unknown> {
  username: string;
  year: number;
  totalCommits: number;
  longestStreak: number;
  contributions: number;
  pullRequests: number;
  issuesClosed: number;
  topLanguages: TopLanguage[];
  topRepos: TopRepo[];
}

const PAPER = "#EDE7DA";
const INK = "#15130F";
const RED = "#B4321F";
const SOFT = "rgba(21,19,15,0.52)";
const HAIR = "rgba(21,19,15,0.20)";

const SPREADS = ["commits", "languages", "repos", "streak"] as const;
type Spread = (typeof SPREADS)[number];

const SPREAD_TITLE: Record<Spread, string> = {
  commits: "The count",
  languages: "The languages",
  repos: "The repositories",
  streak: "The streak",
};

function grouped(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Deterministic per-week ink weight for the contribution strip. */
function weekWeight(i: number): number {
  const h = (i * 2654435761) % 1009;
  return 0.18 + (h / 1009) * 0.42;
}

export default video<GitHubWrappedData>({
  duration: "12s",
  fonts: [googleFont("Inter:wght@400;500;600;700;800;900"), googleFont("JetBrains+Mono:wght@400;500;700")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; }",
    ".num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }",
  ],
  sample: {
    username: "devmaster",
    year: 2025,
    totalCommits: 2847,
    longestStreak: 45,
    contributions: 3200,
    pullRequests: 156,
    issuesClosed: 89,
    topLanguages: [
      { name: "TypeScript", percent: 45, color: "#2F5D8C" },
      { name: "Rust", percent: 25, color: "#8C5A2F" },
      { name: "Go", percent: 20, color: "#2F7C8C" },
      { name: "Python", percent: 10, color: "#5C5C2F" },
    ],
    topRepos: [
      { name: "awesome-cli", stars: 1250 },
      { name: "react-hooks", stars: 890 },
      { name: "dotfiles", stars: 340 },
    ],
  },

  render(ctx: RenderContext<GitHubWrappedData>) {
    const { std, width, height, data } = ctx;
    const ease = (v: number, fn: Parameters<typeof std.interpolate>[3]) =>
      std.interpolate(v, [0, 1], [0, 1], fn);
    const username = String(data.username ?? "octocat");
    const year = Number(data.year ?? 2025);
    const languages = (data.topLanguages ?? []).slice(0, 4);
    const repos = (data.topRepos ?? []).slice(0, 3);

    const t = ctx.director({
      masthead: "1.6s",
      spreads: "6.8s",
      colophon: "1.6s",
    });

    const mastheadP = ease(t.in("masthead"), "easeOutCubic");
    const spreadsP = t.in("spreads");
    const colophonP = ease(t.in("colophon"), "easeOutCubic");

    const padX = Math.round(width * 0.068);
    const padY = Math.round(height * 0.068);
    const colW = width - padX * 2;
    const bodyH = Math.round(height - padY * 2 - height * 0.22);
    const px = (v: number) => Math.round(Math.min(width, height * 1.78) * v);

    // The masthead dissolves as it docks into the header rule.
    const dock = std.interpolate(spreadsP, [0, 0.09], [0, 1], "easeOutCubic");
    const heroOp = 1 - dock;
    const heroLift = std.interpolate(dock, [0, 1], [0, -34], "easeInCubic");

    // Page turn: each spread rises in, then lifts away. Exit is faster than enter.
    const beat = t.beats({ during: "spreads", of: SPREADS, cross: "0s" });
    const activeSpread: Spread = beat.crossing ? beat.to : beat.name;
    const activeIndex = beat.index;
    const local = beat.crossing ? 1 : beat.local;
    const turnIn = std.interpolate(local, [0, 0.14], [0, 1], "easeOutCubic");
    const turnOut = std.interpolate(local, [0.9, 1], [0, 1], "easeInCubic");
    const spreadOp = Math.min(turnIn, 1 - turnOut);
    const spreadY = (1 - turnIn) * 16 - turnOut * 12;

    function rule(w: number | "fill", thickness = 2, color = INK, progress = 1) {
      return Frame(
        { width: w, height: thickness },
        Frame({
          x: 0,
          y: 0,
          width: w,
          height: thickness,
          fill: color,
          style: {
            transform: `scaleX(${std.math.clamp(progress, 0, 1)})`,
            transformOrigin: "left center",
          },
        }),
      );
    }

    function kicker(text: string, color = SOFT) {
      return Text(
        { variant: "label", color, size: px(0.0135), weight: 700, letterSpacing: 4.2 },
        text.toUpperCase(),
      );
    }

    function statCell(label: string, value: string) {
      return Stack(
        { gap: px(0.006), width: Math.round(colW * 0.17) },
        Text(
          { variant: "label", color: SOFT, size: px(0.0125), weight: 600, letterSpacing: 2.6 },
          label.toUpperCase(),
        ),
        Text(
          {
            variant: "title",
            color: INK,
            size: px(0.028),
            weight: 700,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          },
          value,
        ),
      );
    }

    function commitsSpread() {
      const counted = std.interpolate(local, [0, 0.72], [0, 1], "easeOutExpo") * Number(data.totalCommits ?? 0);
      return Stack(
        { gap: px(0.022), width: colW },
        kicker("Commits pushed", RED),
        Text(
          {
            variant: "display",
            color: INK,
            size: px(0.155),
            weight: 900,
            letterSpacing: -8,
            fontFamily: "Inter, system-ui, sans-serif",
          },
          grouped(counted),
        ),
        rule(colW, 2, HAIR, std.interpolate(local, [0.1, 0.5], [0, 1], "easeOutCubic")),
        Stack(
          { direction: "row", gap: px(0.03), width: colW, height: px(0.06), align: "start" },
          statCell("contributions", grouped(Number(data.contributions ?? 0))),
          statCell("pull requests", grouped(Number(data.pullRequests ?? 0))),
          statCell("issues closed", grouped(Number(data.issuesClosed ?? 0))),
        ),
      );
    }

    function languagesSpread() {
      const rowH = px(0.058);
      return Stack(
        { gap: px(0.016), width: colW },
        kicker("Where the year went", RED),
        ...languages.map((lang, i) => {
          const p = std.math.clamp((local - i * 0.07) / 0.34, 0, 1);
          const grow = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
          return Stack(
            { gap: px(0.005), width: colW, style: { opacity: Math.min(1, p * 2.2) } },
            Stack(
              { direction: "row", width: colW, height: px(0.032), align: "center", justify: "space-between" },
              Text({ variant: "title", color: INK, size: px(0.026), weight: 700 }, lang.name),
              Text(
                {
                  variant: "title",
                  color: SOFT,
                  size: px(0.024),
                  weight: 600,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                },
                `${lang.percent}%`,
              ),
            ),
            Frame(
              { width: colW, height: px(0.011), fill: HAIR },
              Frame({
                x: 0,
                y: 0,
                width: Math.round((colW * lang.percent) / 100),
                height: px(0.011),
                fill: lang.color,
                style: { transform: `scaleX(${grow})`, transformOrigin: "left center" },
              }),
            ),
            Frame({ width: colW, height: Math.round(rowH * 0.12) }),
          );
        }),
      );
    }

    function reposSpread() {
      return Stack(
        { gap: px(0.02), width: colW },
        kicker("Most starred", RED),
        ...repos.map((repo, i) => {
          const p = std.math.clamp((local - i * 0.09) / 0.36, 0, 1);
          const slide = std.interpolate(p, [0, 1], [18, 0], "easeOutCubic");
          return Stack(
            {
              direction: "row",
              width: colW,
              height: px(0.075),
              align: "center",
              justify: "space-between",
              style: {
                opacity: Math.min(1, p * 2),
                transform: `translateX(${slide.toFixed(2)}px)`,
                borderBottom: `1px solid ${HAIR}`,
              },
            },
            Stack(
              { direction: "row", gap: px(0.018), align: "center", height: px(0.05) },
              Text(
                {
                  variant: "title",
                  color: RED,
                  size: px(0.022),
                  weight: 700,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                },
                String(i + 1).padStart(2, "0"),
              ),
              Text({ variant: "title", color: INK, size: px(0.038), weight: 700 }, repo.name),
            ),
            Text(
              {
                variant: "title",
                color: INK,
                size: px(0.028),
                weight: 600,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              },
              `★ ${grouped(repo.stars)}`,
            ),
          );
        }),
      );
    }

    function streakSpread() {
      const streak = Number(data.longestStreak ?? 0);
      const weeks = 52;
      const cell = Math.floor((colW - (weeks - 1) * 6) / weeks);
      const runWeeks = Math.max(1, Math.round(streak / 7));
      const runStart = 26;
      const drawn = std.interpolate(local, [0.06, 0.62], [0, 1], "easeOutCubic");
      const stripH = Math.round(cell * 2.4);
      const squares = Array.from({ length: weeks }, (_, i) => {
        const x = i * (cell + 6);
        const inRun = i >= runStart && i < runStart + runWeeks;
        const shown = i / weeks <= drawn;
        if (!shown) return "";
        const h = inRun ? stripH : Math.round(stripH * weekWeight(i) * 1.6);
        const y = stripH - h;
        const fill = inRun ? RED : `rgba(21,19,15,${weekWeight(i).toFixed(2)})`;
        return `<rect x="${x}" y="${y}" width="${cell}" height="${h}" rx="2" fill="${fill}"/>`;
      }).join("");

      const counted = Math.round(
        std.interpolate(local, [0, 0.6], [0, 1], "easeOutExpo") * streak,
      );

      return Stack(
        { gap: px(0.024), width: colW },
        kicker("Longest unbroken run", RED),
        Stack(
          { direction: "row", gap: px(0.024), align: "end", height: px(0.13) },
          Text(
            {
              variant: "display",
              color: INK,
              size: px(0.12),
              weight: 900,
              letterSpacing: -6,
            },
            String(counted),
          ),
          Stack(
            { gap: px(0.004), height: px(0.075), justify: "end" },
            Text({ variant: "title", color: INK, size: px(0.03), weight: 700 }, "days"),
            Text({ variant: "body", color: SOFT, size: px(0.017) }, "of consecutive commits"),
          ),
        ),
        Html({
          id: "streak-strip",
          width: colW,
          height: stripH,
          html: `<svg width="${colW}" height="${stripH}" viewBox="0 0 ${colW} ${stripH}">${squares}</svg>`,
        }),
        Stack(
          { direction: "row", width: colW, height: px(0.024), justify: "space-between", align: "center" },
          Text({ variant: "label", color: SOFT, size: px(0.0125), weight: 600, letterSpacing: 2 }, "JAN"),
          Text({ variant: "label", color: SOFT, size: px(0.0125), weight: 600, letterSpacing: 2 }, "DEC"),
        ),
      );
    }

    function spreadBody(name: Spread) {
      if (name === "commits") return commitsSpread();
      if (name === "languages") return languagesSpread();
      if (name === "repos") return reposSpread();
      return streakSpread();
    }

    const headerOp = Math.max(dock, colophonP > 0 ? 1 : 0);
    const showColophon = colophonP > 0;

    const centre = showColophon
      ? Stack(
          {
            id: "colophon",
            gap: px(0.024),
            width: colW,
            style: { opacity: std.interpolate(colophonP, [0, 0.3], [0, 1], "easeOutCubic") },
          },
          rule(colW, 3, RED, std.interpolate(colophonP, [0, 0.45], [0, 1], "easeOutCubic")),
          Text(
            { variant: "display", color: INK, size: px(0.072), maxWidth: colW, weight: 800, letterSpacing: -3 },
            `That was ${year}, @${username}.`,
          ),
          Text(
            { variant: "body", color: SOFT, size: px(0.022), maxWidth: Math.round(colW * 0.62) },
            "Every commit, review, and late fix — set in one page and filed away.",
          ),
        )
      : Stack(
          {
            id: "spread",
            width: colW,
            style: {
              opacity: spreadOp,
              transform: `translateY(${spreadY.toFixed(2)}px)`,
            },
          },
          spreadBody(activeSpread),
        );

    return Frame(
      { id: "page", width, height, fill: PAPER },
      Frame({
        width,
        height,
        fill: "radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.55), transparent 70%)",
      }),

      // Page furniture — always on, so the spreads read as one document.
      Frame(
        { x: padX, y: padY, width: colW, height: px(0.05) },
        Stack(
          { gap: px(0.012), width: colW, style: { opacity: headerOp } },
          rule(colW, 3, INK, headerOp),
          Stack(
            { direction: "row", width: colW, height: px(0.026), align: "center", justify: "space-between" },
            Text(
              { variant: "label", color: INK, size: px(0.0145), weight: 800, letterSpacing: 6 },
              "THE ANNUAL",
            ),
            Text(
              {
                variant: "label",
                color: SOFT,
                size: px(0.0145),
                weight: 500,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              },
              `@${username} · ${year}`,
            ),
          ),
        ),
      ),

      // Opening lockup.
      heroOp > 0.01
        ? Stack(
            {
              id: "hero",
              width: "fill",
              height: "fill",
              align: "center",
              justify: "center",
              gap: px(0.01),
              style: { opacity: heroOp, transform: `translateY(${heroLift.toFixed(2)}px)` },
            },
            Text(
              {
                variant: "label",
                color: RED,
                size: px(0.018),
                weight: 800,
                letterSpacing: 9,
                align: "center",
                style: { opacity: std.interpolate(mastheadP, [0, 0.35], [0, 1], "easeOutCubic") },
              },
              "THE ANNUAL",
            ),
            Text(
              {
                variant: "display",
                color: INK,
                size: px(0.22),
                weight: 900,
                letterSpacing: -14,
                align: "center",
                motion: t.motion({ id: "hero-year", during: "masthead", at: "8%", for: "42%", y: 26 }),
              },
              String(year),
            ),
            Text(
              {
                variant: "body",
                color: SOFT,
                size: px(0.024),
                align: "center",
                motion: t.motion({ id: "hero-by", during: "masthead", at: "28%", for: "40%", y: 14 }),
              },
              `A year of code by @${username}`,
            ),
          )
        : Frame({ width: 1, height: 1 }),

      // Centre column.
      Frame(
        { x: padX, y: Math.round(padY + height * 0.13), width: colW, height: bodyH },
        Stack({ width: colW, height: bodyH, justify: "center" }, centre),
      ),

      // Folio.
      Frame(
        { x: padX, y: height - padY - px(0.026), width: colW, height: px(0.026) },
        Stack(
          {
            direction: "row",
            width: colW,
            height: px(0.026),
            align: "center",
            justify: "space-between",
            style: { opacity: headerOp * 0.9 },
          },
          Text(
            { variant: "label", color: SOFT, size: px(0.0125), weight: 600, letterSpacing: 2.4 },
            showColophon ? "END OF YEAR" : SPREAD_TITLE[activeSpread].toUpperCase(),
          ),
          Text(
            {
              variant: "label",
              color: SOFT,
              size: px(0.0125),
              weight: 600,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            },
            showColophon
              ? `${SPREADS.length} / ${SPREADS.length}`
              : `${String(activeIndex + 1).padStart(2, "0")} / ${String(SPREADS.length).padStart(2, "0")}`,
          ),
        ),
      ),
    );
  },
});
