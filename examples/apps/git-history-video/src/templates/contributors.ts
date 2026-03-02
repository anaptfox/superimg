import { defineScene } from "superimg";

export default defineScene({
  config: {
    fps: 30,
    durationSeconds: 12,
    width: 1920,
    height: 1080,
  },
  defaults: {
    title: "Project Activity",
    accentColor: "#38bdf8",
    contributors: [] as Array<{
      name: string;
      commits: number;
      linesAdded: number;
      linesDeleted: number;
    }>,
  },
  render({ sceneTimeSeconds: t, data, std, width, height }) {
    const { title, contributors, accentColor } = data;
    const list = contributors.slice(0, 6);
    const maxCommits = Math.max(1, ...list.map((c) => c.commits));
    const enterP = std.math.clamp(t / 1.2, 0, 1);
    const rowsP = std.math.clamp((t - 1.1) / 8.5, 0, 1);
    const exitP = std.math.clamp((t - 10.5) / 1.5, 0, 1);

    const rows = list
      .map((c, i) => {
        const rowStart = i * 0.25;
        const rowP = std.math.clamp((rowsP - rowStart * 0.2) / 0.8, 0, 1);
        const y = std.tween(30, 0, rowP, "easeOutCubic");
        const opacity = std.tween(0, 1, rowP, "easeOutCubic");
        const barW = Math.round((c.commits / maxCommits) * 720);
        return `
          <div style="position:relative; display:flex; align-items:center; margin:20px 0; transform:translateY(${y}px); opacity:${opacity};">
            <div style="width:60px; color:rgba(255,255,255,0.45); font-weight:700; font-size:22px;">#${i + 1}</div>
            <div style="width:340px; color:white; font-size:30px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</div>
            <div style="height:22px; width:${barW}px; border-radius:999px; margin:0 22px; background:linear-gradient(90deg, ${std.color.alpha(accentColor, 0.6)}, ${accentColor});"></div>
            <div style="display:flex; gap:18px; font-size:21px;">
              <span style="color:white; font-weight:700;">${c.commits} commits</span>
              <span style="color:#6af18a;">+${c.linesAdded}</span>
              <span style="color:#ff7373;">-${c.linesDeleted}</span>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div style="${std.css({
        width,
        height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        background: "radial-gradient(circle at 10% 0%, #1E293B 0%, #0F172A 55%, #020617 100%)",
      })}">
        <div style="position:absolute; inset:0; opacity:${std.tween(0.3, 1, enterP, "easeOutCubic")};">
          <div style="position:absolute; top:90px; left:110px; color:rgba(255,255,255,0.75); font-size:26px; letter-spacing:0.08em;">TOP CONTRIBUTORS</div>
          <div style="position:absolute; top:130px; left:110px; color:white; font-size:64px; font-weight:800;">${title}</div>
          <div style="position:absolute; top:224px; left:110px; width:260px; height:4px; border-radius:2px; background:${accentColor};"></div>
          <div style="position:absolute; top:${280 + (list.length <= 2 ? 120 : 0)}px; left:110px; right:110px;">${rows}</div>
        </div>
        <div style="position:absolute; inset:0; background:black; opacity:${exitP};"></div>
      </div>
    `;
  },
});
