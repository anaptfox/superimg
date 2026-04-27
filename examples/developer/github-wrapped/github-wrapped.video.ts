import { defineScene, type RenderContext } from "superimg";

function formatNumberLocale(num: number): string {
  return num.toLocaleString("en-US");
}

export type WrappedTheme = "dark" | "spotify" | "github" | "neon";

export interface TopLanguage {
  name: string;
  percent: number;
  color: string;
}

export interface TopRepo {
  name: string;
  stars: number;
}

export interface GitHubWrappedVideoData extends Record<string, unknown> {
  username: string;
  year: number;
  totalCommits: number;
  longestStreak: number;
  topLanguages: TopLanguage[];
  topRepos: TopRepo[];
  contributions: number;
  pullRequests: number;
  issuesClosed: number;
  theme: WrappedTheme;
}

const THEME_CONFIG: Record<WrappedTheme, { bg: string; card: string; text: string; accent: string; glow: string }> = {
  dark: { bg: "#0d1117", card: "#161b22", text: "#f0f6fc", accent: "#58a6ff", glow: "#58a6ff40" },
  spotify: { bg: "#121212", card: "#1db954", text: "#ffffff", accent: "#1db954", glow: "#1db95450" },
  github: { bg: "#0d1117", card: "#238636", text: "#f0f6fc", accent: "#3fb950", glow: "#3fb95050" },
  neon: { bg: "#0a0a0a", card: "#1a1a2e", text: "#ffffff", accent: "#ff00ff", glow: "#ff00ff50" },
};

export default defineScene<GitHubWrappedVideoData>({
  data: {
    username: "devmaster",
    year: 2025,
    totalCommits: 2847,
    longestStreak: 45,
    contributions: 3200,
    topLanguages: [
      { name: "TypeScript", percent: 45, color: "#3178c6" },
      { name: "Rust", percent: 25, color: "#dea584" },
      { name: "Go", percent: 20, color: "#00add8" },
      { name: "Python", percent: 10, color: "#3572a5" },
    ],
    topRepos: [
      { name: "awesome-cli", stars: 1250 },
      { name: "react-hooks", stars: 890 },
      { name: "dotfiles", stars: 340 },
    ],
    pullRequests: 156,
    issuesClosed: 89,
    theme: "dark",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 10,
  },
  render(ctx: RenderContext<GitHubWrappedVideoData>) {
    const { std, width, height, data } = ctx;
    const { username, year, totalCommits, longestStreak, topLanguages, topRepos, theme } = data;
    const themeKey: WrappedTheme = theme ?? "dark";
    const themeConfig = THEME_CONFIG[themeKey];

    const t = std.score({
      intro: 0.12,
      username: 0.1,
      commits: 0.16,
      languages: 0.17,
      repos: 0.17,
      streak: 0.13,
      outro: 0.1,
      fadeOut: 0.05
    });

    const introP = t.within("intro", { easing: "easeOutExpo" });
    const usernameP = t.within("username", { easing: "easeOutBack" });
    const commitsP = t.within("commits");
    const langsP = t.within("languages");
    const reposP = t.within("repos");
    const streakP = t.within("streak");
    const outroP = t.within("outro", { easing: "easeOutExpo" });
    const fadeP = t.within("fadeOut", { easing: "easeOutExpo" });

    const globalOp = 1 - fadeP;
    const fontSize = Math.min(width, height) * 0.045;

    let langsHtml = "";
    if (t.active === "languages" || t.active === "repos") {
      langsHtml = topLanguages.slice(0, 4)
        .map((lang: TopLanguage, i: number) => {
          const delay = i * 0.15;
          const localP = Math.max(0, (langsP - delay) / (1 - delay));
          const barWidth = std.interpolate(localP, [0, 1], [0, 1], "easeOutExpo") * lang.percent;
          return `<div style="margin-bottom:12px;opacity:${localP};">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:${fontSize * 0.5}px;font-weight:600;">${lang.name}</span>
          <span style="font-size:${fontSize * 0.4}px;opacity:0.7;">${lang.percent}%</span>
        </div>
        <div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${barWidth}%;background:${lang.color};border-radius:4px;"></div>
        </div>
      </div>`;
        })
        .join("");
    }

    let reposHtml = "";
    if (t.active === "repos" || t.active === "streak") {
      reposHtml = topRepos.slice(0, 3)
        .map((repo: TopRepo, i: number) => {
          const delay = i * 0.2;
          const localP = Math.max(0, (reposP - delay) / (1 - delay));
          const repoEased = std.interpolate(localP, [0, 1], [0, 1], "easeOutExpo");
          return `<div style="display:flex;align-items:center;gap:12px;opacity:${repoEased};transform:translateX(${(1 - repoEased) * 30}px);">
        <span style="font-size:${fontSize * 0.5}px;font-weight:600;">${repo.name}</span>
        <span style="font-size:${fontSize * 0.4}px;color:${themeConfig.accent};">★ ${repo.stars}</span>
      </div>`;
        })
        .join("");
    }

    const renderCounter = (value: number, progress: number) =>
      Math.floor(std.interpolate(progress, [0, 1], [0, 1], "easeOutExpo") * value);

    let mainContent = "";

    if (t.active === "intro") {
      mainContent = `
      <div style="opacity:${introP};transform:scale(${0.8 + introP * 0.2});">
        <div style="font-size:${fontSize * 0.6}px;color:${themeConfig.accent};margin-bottom:16px;">YOUR</div>
        <div style="font-size:${fontSize * 2}px;font-weight:900;letter-spacing:-0.03em;">${year}</div>
        <div style="font-size:${fontSize * 0.5}px;margin-top:8px;opacity:0.7;">in code</div>
      </div>
    `;
    } else if (t.active === "commits") {
      const count = renderCounter(totalCommits, commitsP);
      mainContent = `
      <div style="text-align:center;">
        <div style="font-size:${fontSize * 0.4}px;color:${themeConfig.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Total Commits</div>
        <div style="font-size:${fontSize * 2.5}px;font-weight:900;color:${themeConfig.accent};text-shadow:0 0 40px ${themeConfig.glow};">${formatNumberLocale(count)}</div>
        <div style="font-size:${fontSize * 0.4}px;margin-top:16px;opacity:0.6;">contributions to the world</div>
      </div>
    `;
    } else if (t.active === "languages") {
      mainContent = `
      <div style="width:80%;max-width:400px;">
        <div style="font-size:${fontSize * 0.5}px;color:${themeConfig.accent};margin-bottom:24px;text-transform:uppercase;letter-spacing:0.1em;">Top Languages</div>
        ${langsHtml}
      </div>
    `;
    } else if (t.active === "repos") {
      mainContent = `
      <div style="text-align:left;">
        <div style="font-size:${fontSize * 0.5}px;color:${themeConfig.accent};margin-bottom:24px;text-transform:uppercase;letter-spacing:0.1em;">Top Repositories</div>
        <div style="display:flex;flex-direction:column;gap:16px;">${reposHtml}</div>
      </div>
    `;
    } else if (t.active === "streak") {
      const streakCount = renderCounter(longestStreak, streakP);
      mainContent = `
      <div style="text-align:center;">
        <div style="font-size:${fontSize * 0.4}px;color:${themeConfig.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Longest Streak</div>
        <div style="font-size:${fontSize * 2.5}px;font-weight:900;">${streakCount}</div>
        <div style="font-size:${fontSize * 0.5}px;margin-top:8px;opacity:0.7;">days of consecutive commits</div>
        <div style="font-size:48px;margin-top:24px;">🔥</div>
      </div>
    `;
    } else {
      mainContent = `
      <div style="text-align:center;opacity:${outroP};">
        <div style="font-size:${fontSize * 0.8}px;font-weight:700;margin-bottom:24px;">That's a wrap, @${username}!</div>
        <div style="font-size:${fontSize * 0.4}px;opacity:0.7;">Here's to another year of shipping 🚀</div>
      </div>
    `;
    }

    return `
    <div style="width:${width}px;height:${height}px;background:${themeConfig.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${themeConfig.text};position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:${globalOp};">

      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%, ${themeConfig.glow} 0%, transparent 50%);"></div>

      ${t.active !== "intro" ? `
        <div style="position:absolute;top:8%;opacity:${usernameP};">
          <div style="font-size:${fontSize * 0.4}px;color:${themeConfig.accent};font-weight:600;">@${username}</div>
        </div>
      ` : ""}

      ${mainContent}

      <div style="position:absolute;bottom:8%;opacity:${introP * 0.6};">
        <div style="font-size:${fontSize * 0.3}px;color:${themeConfig.accent};">GitHub Wrapped ${year}</div>
      </div>

    </div>
  `;
  },
});
