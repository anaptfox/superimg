import { defineScene, type RenderContext } from "superimg";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toLocaleString();
}

export interface ContributorItem {
  login: string;
  avatar_url: string;
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

const TIMING = {
  headerFadeIn: { start: 0, end: 0.1 },
  avatarReveal: { start: 0.1, end: 0.85 },
  finalPause: { start: 0.85, end: 0.92 },
  fadeOut: { start: 0.92, end: 1.0 },
};

const GITHUB_LOGO =
  'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';

const PEOPLE_ICON =
  "M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z";

export default defineScene<ContributorsVideoData>({
  data: {
    repo: "vercel/next.js",
    description: "The React Framework for the Web",
    totalContributors: 3200,
    contributors: [
      { login: "timneutkens", avatar_url: "https://avatars.githubusercontent.com/u/6324199", contributions: 5420 },
      { login: "ijjk", avatar_url: "https://avatars.githubusercontent.com/u/22380829", contributions: 3180 },
      { login: "Timer", avatar_url: "https://avatars.githubusercontent.com/u/616428", contributions: 2850 },
      { login: "balazsorban44", avatar_url: "https://avatars.githubusercontent.com/u/18369201", contributions: 1920 },
      { login: "leerob", avatar_url: "https://avatars.githubusercontent.com/u/9113740", contributions: 890 },
      { login: "huozhi", avatar_url: "https://avatars.githubusercontent.com/u/4236644", contributions: 750 },
    ],
    theme: "dark",
    showContributions: true,
    accentColor: "#238636",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
  },
  render(ctx: RenderContext<ContributorsVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { contributors, repo, description, totalContributors, theme, showContributions, accentColor } = data;

    const bgColor = theme === "dark" ? "#0d1117" : "#ffffff";
    const textColor = theme === "dark" ? "#c9d1d9" : "#24292f";
    const mutedColor = theme === "dark" ? "#8b949e" : "#656d76";
    const cardBg = theme === "dark" ? "#161b22" : "#f6f8fa";
    const borderColor = theme === "dark" ? "#30363d" : "#d0d7de";

    const headerProgress = std.interpolate(sceneProgress, [TIMING.headerFadeIn.start, TIMING.headerFadeIn.end], [0, 1], "easeOutCubic");
    const avatarProgress = std.interpolate(sceneProgress, [TIMING.avatarReveal.start, TIMING.avatarReveal.end], [0, 1]);
    const fadeOutProgress = std.interpolate(sceneProgress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeOutCubic");

    const globalOpacity = 1 - fadeOutProgress;

    const padding = { top: 160, right: 60, bottom: 80, left: 60 };
    const gridWidth = width - padding.left - padding.right;

    const count = contributors.length;
    const cols = count <= 12 ? 4 : count <= 24 ? 5 : count <= 35 ? 6 : 7;
    const avatarSize = Math.min(100, Math.floor((gridWidth - (cols - 1) * 16) / cols));
    const gap = 16;

    const visibleCount = Math.floor(avatarProgress * count);

    const avatars = contributors
      .slice(0, visibleCount)
      .map((contributor: ContributorItem, index: number) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = padding.left + col * (avatarSize + gap);
        const y = padding.top + row * (avatarSize + gap + 30);

        const avatarStartProgress = index / count;
        const avatarEndProgress = Math.min(1, avatarStartProgress + 0.15);
        let avatarLocalProgress = 0;
        if (avatarProgress > avatarStartProgress) {
          avatarLocalProgress = Math.min(1, (avatarProgress - avatarStartProgress) / (avatarEndProgress - avatarStartProgress));
        }

        const scale = std.interpolate(avatarLocalProgress, [0, 1], [0, 1], "easeOutBack");
        const opacity = std.interpolate(avatarLocalProgress, [0, 1], [0, 1], "easeOutCubic");

        return `
      <div style="position: absolute; left: ${x}px; top: ${y}px; width: ${avatarSize}px; text-align: center; transform: scale(${scale}); opacity: ${opacity}; transform-origin: center top;">
        <div style="width: ${avatarSize}px; height: ${avatarSize}px; border-radius: 50%; overflow: hidden; border: 3px solid ${borderColor}; background: ${cardBg}; margin: 0 auto;">
          <img src="${contributor.avatar_url}" width="${avatarSize}" height="${avatarSize}" style="display: block; width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="margin-top: 6px; font-size: 12px; color: ${textColor}; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${contributor.login}
        </div>
        ${showContributions ? `
          <div style="display: inline-flex; align-items: center; gap: 3px; margin-top: 2px; padding: 2px 6px; background: ${accentColor}; border-radius: 10px; font-size: 10px; color: white; font-weight: 600;">
            ${formatNumber(contributor.contributions)}
          </div>
        ` : ""}
      </div>
    `;
      })
      .join("");

    return `
    <div style="width: ${width}px; height: ${height}px; background: ${bgColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; position: relative; opacity: ${globalOpacity}; overflow: hidden;">

      <div style="position: absolute; top: 40px; left: ${padding.left}px; right: ${padding.right}px; display: flex; justify-content: space-between; align-items: flex-start; opacity: ${headerProgress}; transform: translateY(${(1 - headerProgress) * -20}px);">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <svg width="36" height="36" viewBox="0 0 16 16" fill="${textColor}">
              <path d="${GITHUB_LOGO}"/>
            </svg>
            <span style="font-size: 28px; font-weight: 600; color: ${textColor};">${repo}</span>
          </div>
          ${description ? `<div style="font-size: 16px; color: ${mutedColor}; margin-top: 8px; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${description}</div>` : ""}
        </div>

        <div style="text-align: right; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
            <svg width="28" height="28" viewBox="0 0 16 16" fill="${accentColor}">
              <path d="${PEOPLE_ICON}"/>
            </svg>
            <span style="font-size: 40px; font-weight: 700; color: ${accentColor};">
              ${formatNumber(totalContributors)}
            </span>
          </div>
          <div style="font-size: 14px; color: ${mutedColor}; margin-top: 4px;">
            contributors
          </div>
        </div>
      </div>

      ${avatars}

      <div style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); color: ${mutedColor}; font-size: 14px; opacity: 0.6;">
        contributors
      </div>
    </div>
  `;
  },
});
