var __template = (function(exports) {
	Object.defineProperties(exports, {
		__esModule: { value: true },
		[Symbol.toStringTag]: { value: "Module" }
	});
	//#region packages/superimg-types/dist/index.js
	//! Serializable JSON-shaped values for template data defaults and CLI loaders.
	//! SuperImg Types - Core type definitions
	//! Explicit, typed, self-documenting interfaces for templates, rendering, and playback
	//! The unified `define()` template factory.
	//!
	//! Unified template factory — one `define()` for all output kinds.
	//! Three orthogonal axes select behaviour:
	//!  - medium:   "html" (Chromium) | "svg" (resvg-wasm, browser-free, edge).
	//!  - animated: inferred from the config — true iff it declares fps AND
	//!              (duration OR a `resolve` hook that will supply duration).
	//!  - sink:     chosen later (config.outputs / CLI / `as`), not at authoring time.
	//!
	//! TypeScript narrows `ctx` to the right variant at the call site via overloads:
	//! medium picks the stdlib flavour, animated adds the temporal fields + helpers.
	function define(input) {
		const medium = input.medium ?? "html";
		const c = input.config;
		const hasResolve = typeof input.resolve === "function";
		return {
			medium,
			animated: !!c && typeof c.fps === "number" && (c.duration != null || hasResolve),
			render: input.render,
			...input.config !== void 0 ? { config: input.config } : {},
			...input.sample !== void 0 ? { sample: input.sample } : {},
			...hasResolve ? { resolve: input.resolve } : {}
		};
	}
	//! Result types and structured errors
	//! Discriminated unions for async operations with actionable error messages
	//! Player types - User-facing options, events, and input types for the browser player
	//! Implementation types (PlayerState, PlayerStore, etc.) live in @superimg/player
	//! Typed, versioned event contract for superimg build integrations.
	//! Both JS consumers (render wrappers) and Rust deserializers (e.g. gumbo)
	//! should key on the `v` field before reading event-specific fields.
	//! Bump `v` on any breaking field rename or removal; additive fields are non-breaking.
	//! SuperImg Batch Types
	//! Co-located `export const batch` convention for build-time fan-out.
	//! A template module optionally exports `batch` (built with `defineBatch`) to
	//! generate many outputs from one template — no separate loader file.
	//! SuperImg Types - Pure TypeScript type definitions
	//! Core types, interfaces, and error classes for templates, rendering, and playback
	//#endregion
	//#region examples/developer/github-wrapped/github-wrapped.media.ts
	function formatNumberLocale(num) {
		return num.toLocaleString("en-US");
	}
	const THEME_CONFIG = {
		dark: {
			bg: "#0d1117",
			card: "#161b22",
			text: "#f0f6fc",
			accent: "#58a6ff",
			glow: "#58a6ff40"
		},
		spotify: {
			bg: "#121212",
			card: "#1db954",
			text: "#ffffff",
			accent: "#1db954",
			glow: "#1db95450"
		},
		github: {
			bg: "#0d1117",
			card: "#238636",
			text: "#f0f6fc",
			accent: "#3fb950",
			glow: "#3fb95050"
		},
		neon: {
			bg: "#0a0a0a",
			card: "#1a1a2e",
			text: "#ffffff",
			accent: "#ff00ff",
			glow: "#ff00ff50"
		}
	};
	//#endregion
	exports.default = define({
		sample: {
			username: "devmaster",
			year: 2025,
			totalCommits: 2847,
			longestStreak: 45,
			contributions: 3200,
			topLanguages: [
				{
					name: "TypeScript",
					percent: 45,
					color: "#3178c6"
				},
				{
					name: "Rust",
					percent: 25,
					color: "#dea584"
				},
				{
					name: "Go",
					percent: 20,
					color: "#00add8"
				},
				{
					name: "Python",
					percent: 10,
					color: "#3572a5"
				}
			],
			topRepos: [
				{
					name: "awesome-cli",
					stars: 1250
				},
				{
					name: "react-hooks",
					stars: 890
				},
				{
					name: "dotfiles",
					stars: 340
				}
			],
			pullRequests: 156,
			issuesClosed: 89,
			theme: "dark"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "10s"
		},
		render(ctx) {
			const { std, width, height, data } = ctx;
			const { username, year, totalCommits, longestStreak, topLanguages, topRepos, theme } = data;
			const themeConfig = THEME_CONFIG[theme ?? "dark"];
			const t = ctx.director({
				intro: "1.2s",
				username: "1.0s",
				commits: "1.6s",
				languages: "1.7s",
				repos: "1.7s",
				streak: "1.3s",
				outro: "1.0s",
				fadeOut: "0.5s"
			});
			const introP = t.in("intro", { easing: "easeOutExpo" });
			const usernameP = t.in("username", { easing: "easeOutBack" });
			const commitsP = t.in("commits");
			const langsP = t.in("languages");
			const reposP = t.in("repos");
			const streakP = t.in("streak");
			const outroP = t.in("outro", { easing: "easeOutExpo" });
			const globalOp = 1 - t.in("fadeOut", { easing: "easeInCubic" });
			const fontSize = Math.min(width, height) * .045;
			let langsHtml = "";
			if (t.active === "languages" || t.active === "repos") langsHtml = topLanguages.slice(0, 4).map((lang, i) => {
				const delay = i * .15;
				const localP = Math.max(0, (langsP - delay) / (1 - delay));
				const barWidth = std.interpolate(localP, [0, 1], [0, 1], "easeOutExpo") * lang.percent;
				return `<div style="margin-bottom:12px;opacity:${localP};">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:${fontSize * .5}px;font-weight:600;">${lang.name}</span>
          <span style="font-size:${fontSize * .4}px;opacity:0.7;">${lang.percent}%</span>
        </div>
        <div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${barWidth}%;background:${lang.color};border-radius:4px;"></div>
        </div>
      </div>`;
			}).join("");
			let reposHtml = "";
			if (t.active === "repos" || t.active === "streak") reposHtml = topRepos.slice(0, 3).map((repo, i) => {
				const delay = i * .2;
				const localP = Math.max(0, (reposP - delay) / (1 - delay));
				const repoEased = std.interpolate(localP, [0, 1], [0, 1], "easeOutExpo");
				return `<div style="display:flex;align-items:center;gap:12px;opacity:${repoEased};transform:translateX(${(1 - repoEased) * 30}px);">
        <span style="font-size:${fontSize * .5}px;font-weight:600;">${repo.name}</span>
        <span style="font-size:${fontSize * .4}px;color:${themeConfig.accent};">★ ${repo.stars}</span>
      </div>`;
			}).join("");
			const beatPhases = [
				"intro",
				"commits",
				"languages",
				"repos",
				"streak"
			];
			let phaseOp = 1;
			if (t.active && beatPhases.includes(t.active)) {
				const phaseP = t.in(t.active);
				phaseOp = Math.min(std.interpolate(phaseP, [0, .12], [0, 1], "easeOutCubic"), std.interpolate(phaseP, [.9, 1], [1, 0], "easeInCubic"));
			}
			const renderCounter = (value, progress) => Math.floor(std.interpolate(progress, [0, 1], [0, 1], "easeOutExpo") * value);
			let mainContent = "";
			if (t.active === "intro") mainContent = `
      <div style="opacity:${introP};transform:scale(${.8 + introP * .2});">
        <div style="font-size:${fontSize * .6}px;color:${themeConfig.accent};margin-bottom:16px;">YOUR</div>
        <div style="font-size:${fontSize * 2}px;font-weight:900;letter-spacing:-0.03em;">${year}</div>
        <div style="font-size:${fontSize * .5}px;margin-top:8px;opacity:0.7;">in code</div>
      </div>
    `;
			else if (t.active === "commits") {
				const count = renderCounter(totalCommits, commitsP);
				mainContent = `
      <div style="text-align:center;">
        <div style="font-size:${fontSize * .4}px;color:${themeConfig.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Total Commits</div>
        <div style="font-size:${fontSize * 2.5}px;font-weight:900;color:${themeConfig.accent};text-shadow:0 0 40px ${themeConfig.glow};">${formatNumberLocale(count)}</div>
        <div style="font-size:${fontSize * .4}px;margin-top:16px;opacity:0.6;">contributions to the world</div>
      </div>
    `;
			} else if (t.active === "languages") mainContent = `
      <div style="width:80%;max-width:400px;">
        <div style="font-size:${fontSize * .5}px;color:${themeConfig.accent};margin-bottom:24px;text-transform:uppercase;letter-spacing:0.1em;">Top Languages</div>
        ${langsHtml}
      </div>
    `;
			else if (t.active === "repos") mainContent = `
      <div style="text-align:left;">
        <div style="font-size:${fontSize * .5}px;color:${themeConfig.accent};margin-bottom:24px;text-transform:uppercase;letter-spacing:0.1em;">Top Repositories</div>
        <div style="display:flex;flex-direction:column;gap:16px;">${reposHtml}</div>
      </div>
    `;
			else if (t.active === "streak") {
				const streakCount = renderCounter(longestStreak, streakP);
				mainContent = `
      <div style="text-align:center;">
        <div style="font-size:${fontSize * .4}px;color:${themeConfig.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Longest Streak</div>
        <div style="font-size:${fontSize * 2.5}px;font-weight:900;">${streakCount}</div>
        <div style="font-size:${fontSize * .5}px;margin-top:8px;opacity:0.7;">days of consecutive commits</div>
        <div style="font-size:48px;margin-top:24px;">🔥</div>
      </div>
    `;
			} else mainContent = `
      <div style="text-align:center;opacity:${outroP};">
        <div style="font-size:${fontSize * .8}px;font-weight:700;margin-bottom:24px;">That's a wrap, @${username}!</div>
        <div style="font-size:${fontSize * .4}px;opacity:0.7;">Here's to another year of shipping 🚀</div>
      </div>
    `;
			return `
    <div style="width:${width}px;height:${height}px;background:${themeConfig.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${themeConfig.text};position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:${globalOp};">

      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%, ${themeConfig.glow} 0%, transparent 50%);"></div>

      ${t.active !== "intro" ? `
        <div style="position:absolute;top:8%;opacity:${usernameP};">
          <div style="font-size:${fontSize * .4}px;color:${themeConfig.accent};font-weight:600;">@${username}</div>
        </div>
      ` : ""}

      <div style="display:flex;flex-direction:column;align-items:center;opacity:${phaseOp};">${mainContent}</div>

      <div style="position:absolute;bottom:8%;opacity:${introP * .6};">
        <div style="font-size:${fontSize * .3}px;color:${themeConfig.accent};">GitHub Wrapped ${year}</div>
      </div>

    </div>
  `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLXdyYXBwZWQubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2RldmVsb3Blci9naXRodWItd3JhcHBlZC9naXRodWItd3JhcHBlZC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSwgdHlwZSBSZW5kZXJDb250ZXh0IH0gZnJvbSBcInN1cGVyaW1nXCI7XG5cbmZ1bmN0aW9uIGZvcm1hdE51bWJlckxvY2FsZShudW06IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBudW0udG9Mb2NhbGVTdHJpbmcoXCJlbi1VU1wiKTtcbn1cblxuZXhwb3J0IHR5cGUgV3JhcHBlZFRoZW1lID0gXCJkYXJrXCIgfCBcInNwb3RpZnlcIiB8IFwiZ2l0aHViXCIgfCBcIm5lb25cIjtcblxuZXhwb3J0IGludGVyZmFjZSBUb3BMYW5ndWFnZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgcGVyY2VudDogbnVtYmVyO1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRvcFJlcG8ge1xuICBuYW1lOiBzdHJpbmc7XG4gIHN0YXJzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2l0SHViV3JhcHBlZFZpZGVvRGF0YSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgeWVhcjogbnVtYmVyO1xuICB0b3RhbENvbW1pdHM6IG51bWJlcjtcbiAgbG9uZ2VzdFN0cmVhazogbnVtYmVyO1xuICB0b3BMYW5ndWFnZXM6IFRvcExhbmd1YWdlW107XG4gIHRvcFJlcG9zOiBUb3BSZXBvW107XG4gIGNvbnRyaWJ1dGlvbnM6IG51bWJlcjtcbiAgcHVsbFJlcXVlc3RzOiBudW1iZXI7XG4gIGlzc3Vlc0Nsb3NlZDogbnVtYmVyO1xuICB0aGVtZTogV3JhcHBlZFRoZW1lO1xufVxuXG5jb25zdCBUSEVNRV9DT05GSUc6IFJlY29yZDxXcmFwcGVkVGhlbWUsIHsgYmc6IHN0cmluZzsgY2FyZDogc3RyaW5nOyB0ZXh0OiBzdHJpbmc7IGFjY2VudDogc3RyaW5nOyBnbG93OiBzdHJpbmcgfT4gPSB7XG4gIGRhcms6IHsgYmc6IFwiIzBkMTExN1wiLCBjYXJkOiBcIiMxNjFiMjJcIiwgdGV4dDogXCIjZjBmNmZjXCIsIGFjY2VudDogXCIjNThhNmZmXCIsIGdsb3c6IFwiIzU4YTZmZjQwXCIgfSxcbiAgc3BvdGlmeTogeyBiZzogXCIjMTIxMjEyXCIsIGNhcmQ6IFwiIzFkYjk1NFwiLCB0ZXh0OiBcIiNmZmZmZmZcIiwgYWNjZW50OiBcIiMxZGI5NTRcIiwgZ2xvdzogXCIjMWRiOTU0NTBcIiB9LFxuICBnaXRodWI6IHsgYmc6IFwiIzBkMTExN1wiLCBjYXJkOiBcIiMyMzg2MzZcIiwgdGV4dDogXCIjZjBmNmZjXCIsIGFjY2VudDogXCIjM2ZiOTUwXCIsIGdsb3c6IFwiIzNmYjk1MDUwXCIgfSxcbiAgbmVvbjogeyBiZzogXCIjMGEwYTBhXCIsIGNhcmQ6IFwiIzFhMWEyZVwiLCB0ZXh0OiBcIiNmZmZmZmZcIiwgYWNjZW50OiBcIiNmZjAwZmZcIiwgZ2xvdzogXCIjZmYwMGZmNTBcIiB9LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lPEdpdEh1YldyYXBwZWRWaWRlb0RhdGE+KHtcbiAgc2FtcGxlOiB7XG4gICAgdXNlcm5hbWU6IFwiZGV2bWFzdGVyXCIsXG4gICAgeWVhcjogMjAyNSxcbiAgICB0b3RhbENvbW1pdHM6IDI4NDcsXG4gICAgbG9uZ2VzdFN0cmVhazogNDUsXG4gICAgY29udHJpYnV0aW9uczogMzIwMCxcbiAgICB0b3BMYW5ndWFnZXM6IFtcbiAgICAgIHsgbmFtZTogXCJUeXBlU2NyaXB0XCIsIHBlcmNlbnQ6IDQ1LCBjb2xvcjogXCIjMzE3OGM2XCIgfSxcbiAgICAgIHsgbmFtZTogXCJSdXN0XCIsIHBlcmNlbnQ6IDI1LCBjb2xvcjogXCIjZGVhNTg0XCIgfSxcbiAgICAgIHsgbmFtZTogXCJHb1wiLCBwZXJjZW50OiAyMCwgY29sb3I6IFwiIzAwYWRkOFwiIH0sXG4gICAgICB7IG5hbWU6IFwiUHl0aG9uXCIsIHBlcmNlbnQ6IDEwLCBjb2xvcjogXCIjMzU3MmE1XCIgfSxcbiAgICBdLFxuICAgIHRvcFJlcG9zOiBbXG4gICAgICB7IG5hbWU6IFwiYXdlc29tZS1jbGlcIiwgc3RhcnM6IDEyNTAgfSxcbiAgICAgIHsgbmFtZTogXCJyZWFjdC1ob29rc1wiLCBzdGFyczogODkwIH0sXG4gICAgICB7IG5hbWU6IFwiZG90ZmlsZXNcIiwgc3RhcnM6IDM0MCB9LFxuICAgIF0sXG4gICAgcHVsbFJlcXVlc3RzOiAxNTYsXG4gICAgaXNzdWVzQ2xvc2VkOiA4OSxcbiAgICB0aGVtZTogXCJkYXJrXCIsXG4gIH0sXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIGR1cmF0aW9uOiBcIjEwc1wiLFxuICB9LFxuICByZW5kZXIoY3R4OiBSZW5kZXJDb250ZXh0PEdpdEh1YldyYXBwZWRWaWRlb0RhdGE+KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIGRhdGEgfSA9IGN0eDtcbiAgICBjb25zdCB7IHVzZXJuYW1lLCB5ZWFyLCB0b3RhbENvbW1pdHMsIGxvbmdlc3RTdHJlYWssIHRvcExhbmd1YWdlcywgdG9wUmVwb3MsIHRoZW1lIH0gPSBkYXRhO1xuICAgIGNvbnN0IHRoZW1lS2V5OiBXcmFwcGVkVGhlbWUgPSB0aGVtZSA/PyBcImRhcmtcIjtcbiAgICBjb25zdCB0aGVtZUNvbmZpZyA9IFRIRU1FX0NPTkZJR1t0aGVtZUtleV07XG5cbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHtcbiAgICAgIGludHJvOiBcIjEuMnNcIixcbiAgICAgIHVzZXJuYW1lOiBcIjEuMHNcIixcbiAgICAgIGNvbW1pdHM6IFwiMS42c1wiLFxuICAgICAgbGFuZ3VhZ2VzOiBcIjEuN3NcIixcbiAgICAgIHJlcG9zOiBcIjEuN3NcIixcbiAgICAgIHN0cmVhazogXCIxLjNzXCIsXG4gICAgICBvdXRybzogXCIxLjBzXCIsXG4gICAgICBmYWRlT3V0OiBcIjAuNXNcIlxuICAgIH0pO1xuXG4gICAgY29uc3QgaW50cm9QID0gdC5pbihcImludHJvXCIsIHsgZWFzaW5nOiBcImVhc2VPdXRFeHBvXCIgfSk7XG4gICAgY29uc3QgdXNlcm5hbWVQID0gdC5pbihcInVzZXJuYW1lXCIsIHsgZWFzaW5nOiBcImVhc2VPdXRCYWNrXCIgfSk7XG4gICAgY29uc3QgY29tbWl0c1AgPSB0LmluKFwiY29tbWl0c1wiKTtcbiAgICBjb25zdCBsYW5nc1AgPSB0LmluKFwibGFuZ3VhZ2VzXCIpO1xuICAgIGNvbnN0IHJlcG9zUCA9IHQuaW4oXCJyZXBvc1wiKTtcbiAgICBjb25zdCBzdHJlYWtQID0gdC5pbihcInN0cmVha1wiKTtcbiAgICBjb25zdCBvdXRyb1AgPSB0LmluKFwib3V0cm9cIiwgeyBlYXNpbmc6IFwiZWFzZU91dEV4cG9cIiB9KTtcbiAgICBjb25zdCBmYWRlUCA9IHQuaW4oXCJmYWRlT3V0XCIsIHsgZWFzaW5nOiBcImVhc2VJbkN1YmljXCIgfSk7XG5cbiAgICBjb25zdCBnbG9iYWxPcCA9IDEgLSBmYWRlUDtcbiAgICBjb25zdCBmb250U2l6ZSA9IE1hdGgubWluKHdpZHRoLCBoZWlnaHQpICogMC4wNDU7XG5cbiAgICBsZXQgbGFuZ3NIdG1sID0gXCJcIjtcbiAgICBpZiAodC5hY3RpdmUgPT09IFwibGFuZ3VhZ2VzXCIgfHwgdC5hY3RpdmUgPT09IFwicmVwb3NcIikge1xuICAgICAgbGFuZ3NIdG1sID0gdG9wTGFuZ3VhZ2VzLnNsaWNlKDAsIDQpXG4gICAgICAgIC5tYXAoKGxhbmc6IFRvcExhbmd1YWdlLCBpOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBjb25zdCBkZWxheSA9IGkgKiAwLjE1O1xuICAgICAgICAgIGNvbnN0IGxvY2FsUCA9IE1hdGgubWF4KDAsIChsYW5nc1AgLSBkZWxheSkgLyAoMSAtIGRlbGF5KSk7XG4gICAgICAgICAgY29uc3QgYmFyV2lkdGggPSBzdGQuaW50ZXJwb2xhdGUobG9jYWxQLCBbMCwgMV0sIFswLCAxXSwgXCJlYXNlT3V0RXhwb1wiKSAqIGxhbmcucGVyY2VudDtcbiAgICAgICAgICByZXR1cm4gYDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjEycHg7b3BhY2l0eToke2xvY2FsUH07XCI+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo0cHg7XCI+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6JHtmb250U2l6ZSAqIDAuNX1weDtmb250LXdlaWdodDo2MDA7XCI+JHtsYW5nLm5hbWV9PC9zcGFuPlxuICAgICAgICAgIDxzcGFuIHN0eWxlPVwiZm9udC1zaXplOiR7Zm9udFNpemUgKiAwLjR9cHg7b3BhY2l0eTowLjc7XCI+JHtsYW5nLnBlcmNlbnR9JTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJoZWlnaHQ6OHB4O2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwwLjEpO2JvcmRlci1yYWRpdXM6NHB4O292ZXJmbG93OmhpZGRlbjtcIj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiaGVpZ2h0OjEwMCU7d2lkdGg6JHtiYXJXaWR0aH0lO2JhY2tncm91bmQ6JHtsYW5nLmNvbG9yfTtib3JkZXItcmFkaXVzOjRweDtcIj48L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5gO1xuICAgICAgICB9KVxuICAgICAgICAuam9pbihcIlwiKTtcbiAgICB9XG5cbiAgICBsZXQgcmVwb3NIdG1sID0gXCJcIjtcbiAgICBpZiAodC5hY3RpdmUgPT09IFwicmVwb3NcIiB8fCB0LmFjdGl2ZSA9PT0gXCJzdHJlYWtcIikge1xuICAgICAgcmVwb3NIdG1sID0gdG9wUmVwb3Muc2xpY2UoMCwgMylcbiAgICAgICAgLm1hcCgocmVwbzogVG9wUmVwbywgaTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgY29uc3QgZGVsYXkgPSBpICogMC4yO1xuICAgICAgICAgIGNvbnN0IGxvY2FsUCA9IE1hdGgubWF4KDAsIChyZXBvc1AgLSBkZWxheSkgLyAoMSAtIGRlbGF5KSk7XG4gICAgICAgICAgY29uc3QgcmVwb0Vhc2VkID0gc3RkLmludGVycG9sYXRlKGxvY2FsUCwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEV4cG9cIik7XG4gICAgICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTJweDtvcGFjaXR5OiR7cmVwb0Vhc2VkfTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgkeygxIC0gcmVwb0Vhc2VkKSAqIDMwfXB4KTtcIj5cbiAgICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6JHtmb250U2l6ZSAqIDAuNX1weDtmb250LXdlaWdodDo2MDA7XCI+JHtyZXBvLm5hbWV9PC9zcGFuPlxuICAgICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC40fXB4O2NvbG9yOiR7dGhlbWVDb25maWcuYWNjZW50fTtcIj7imIUgJHtyZXBvLnN0YXJzfTwvc3Bhbj5cbiAgICAgIDwvZGl2PmA7XG4gICAgICAgIH0pXG4gICAgICAgIC5qb2luKFwiXCIpO1xuICAgIH1cblxuICAgIC8vIENyb3NzZmFkZSBlYWNoIHN0YXQgYmVhdCBpbi9vdXQgc28gcGhhc2UgY2hhbmdlcyBkb24ndCBoYXJkLWN1dC5cbiAgICBjb25zdCBiZWF0UGhhc2VzID0gW1wiaW50cm9cIiwgXCJjb21taXRzXCIsIFwibGFuZ3VhZ2VzXCIsIFwicmVwb3NcIiwgXCJzdHJlYWtcIl07XG4gICAgbGV0IHBoYXNlT3AgPSAxO1xuICAgIGlmICh0LmFjdGl2ZSAmJiBiZWF0UGhhc2VzLmluY2x1ZGVzKHQuYWN0aXZlKSkge1xuICAgICAgY29uc3QgcGhhc2VQID0gdC5pbih0LmFjdGl2ZSk7XG4gICAgICBwaGFzZU9wID0gTWF0aC5taW4oXG4gICAgICAgIHN0ZC5pbnRlcnBvbGF0ZShwaGFzZVAsIFswLCAwLjEyXSwgWzAsIDFdLCBcImVhc2VPdXRDdWJpY1wiKSxcbiAgICAgICAgc3RkLmludGVycG9sYXRlKHBoYXNlUCwgWzAuOSwgMV0sIFsxLCAwXSwgXCJlYXNlSW5DdWJpY1wiKSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVuZGVyQ291bnRlciA9ICh2YWx1ZTogbnVtYmVyLCBwcm9ncmVzczogbnVtYmVyKSA9PlxuICAgICAgTWF0aC5mbG9vcihzdGQuaW50ZXJwb2xhdGUocHJvZ3Jlc3MsIFswLCAxXSwgWzAsIDFdLCBcImVhc2VPdXRFeHBvXCIpICogdmFsdWUpO1xuXG4gICAgbGV0IG1haW5Db250ZW50ID0gXCJcIjtcblxuICAgIGlmICh0LmFjdGl2ZSA9PT0gXCJpbnRyb1wiKSB7XG4gICAgICBtYWluQ29udGVudCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJvcGFjaXR5OiR7aW50cm9QfTt0cmFuc2Zvcm06c2NhbGUoJHswLjggKyBpbnRyb1AgKiAwLjJ9KTtcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC42fXB4O2NvbG9yOiR7dGhlbWVDb25maWcuYWNjZW50fTttYXJnaW4tYm90dG9tOjE2cHg7XCI+WU9VUjwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiR7Zm9udFNpemUgKiAyfXB4O2ZvbnQtd2VpZ2h0OjkwMDtsZXR0ZXItc3BhY2luZzotMC4wM2VtO1wiPiR7eWVhcn08L2Rpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC41fXB4O21hcmdpbi10b3A6OHB4O29wYWNpdHk6MC43O1wiPmluIGNvZGU8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gICAgfSBlbHNlIGlmICh0LmFjdGl2ZSA9PT0gXCJjb21taXRzXCIpIHtcbiAgICAgIGNvbnN0IGNvdW50ID0gcmVuZGVyQ291bnRlcih0b3RhbENvbW1pdHMsIGNvbW1pdHNQKTtcbiAgICAgIG1haW5Db250ZW50ID0gYFxuICAgICAgPGRpdiBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyO1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiR7Zm9udFNpemUgKiAwLjR9cHg7Y29sb3I6JHt0aGVtZUNvbmZpZy5hY2NlbnR9O3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtsZXR0ZXItc3BhY2luZzowLjFlbTttYXJnaW4tYm90dG9tOjE2cHg7XCI+VG90YWwgQ29tbWl0czwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiR7Zm9udFNpemUgKiAyLjV9cHg7Zm9udC13ZWlnaHQ6OTAwO2NvbG9yOiR7dGhlbWVDb25maWcuYWNjZW50fTt0ZXh0LXNoYWRvdzowIDAgNDBweCAke3RoZW1lQ29uZmlnLmdsb3d9O1wiPiR7Zm9ybWF0TnVtYmVyTG9jYWxlKGNvdW50KX08L2Rpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC40fXB4O21hcmdpbi10b3A6MTZweDtvcGFjaXR5OjAuNjtcIj5jb250cmlidXRpb25zIHRvIHRoZSB3b3JsZDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgYDtcbiAgICB9IGVsc2UgaWYgKHQuYWN0aXZlID09PSBcImxhbmd1YWdlc1wiKSB7XG4gICAgICBtYWluQ29udGVudCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJ3aWR0aDo4MCU7bWF4LXdpZHRoOjQwMHB4O1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiR7Zm9udFNpemUgKiAwLjV9cHg7Y29sb3I6JHt0aGVtZUNvbmZpZy5hY2NlbnR9O21hcmdpbi1ib3R0b206MjRweDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6MC4xZW07XCI+VG9wIExhbmd1YWdlczwvZGl2PlxuICAgICAgICAke2xhbmdzSHRtbH1cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gICAgfSBlbHNlIGlmICh0LmFjdGl2ZSA9PT0gXCJyZXBvc1wiKSB7XG4gICAgICBtYWluQ29udGVudCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnQ7XCI+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6JHtmb250U2l6ZSAqIDAuNX1weDtjb2xvcjoke3RoZW1lQ29uZmlnLmFjY2VudH07bWFyZ2luLWJvdHRvbToyNHB4O3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtsZXR0ZXItc3BhY2luZzowLjFlbTtcIj5Ub3AgUmVwb3NpdG9yaWVzPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxNnB4O1wiPiR7cmVwb3NIdG1sfTwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgYDtcbiAgICB9IGVsc2UgaWYgKHQuYWN0aXZlID09PSBcInN0cmVha1wiKSB7XG4gICAgICBjb25zdCBzdHJlYWtDb3VudCA9IHJlbmRlckNvdW50ZXIobG9uZ2VzdFN0cmVhaywgc3RyZWFrUCk7XG4gICAgICBtYWluQ29udGVudCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlcjtcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC40fXB4O2NvbG9yOiR7dGhlbWVDb25maWcuYWNjZW50fTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6MC4xZW07bWFyZ2luLWJvdHRvbToxNnB4O1wiPkxvbmdlc3QgU3RyZWFrPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6JHtmb250U2l6ZSAqIDIuNX1weDtmb250LXdlaWdodDo5MDA7XCI+JHtzdHJlYWtDb3VudH08L2Rpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC41fXB4O21hcmdpbi10b3A6OHB4O29wYWNpdHk6MC43O1wiPmRheXMgb2YgY29uc2VjdXRpdmUgY29tbWl0czwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOjQ4cHg7bWFyZ2luLXRvcDoyNHB4O1wiPvCflKU8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1haW5Db250ZW50ID0gYFxuICAgICAgPGRpdiBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyO29wYWNpdHk6JHtvdXRyb1B9O1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiR7Zm9udFNpemUgKiAwLjh9cHg7Zm9udC13ZWlnaHQ6NzAwO21hcmdpbi1ib3R0b206MjRweDtcIj5UaGF0J3MgYSB3cmFwLCBAJHt1c2VybmFtZX0hPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6JHtmb250U2l6ZSAqIDAuNH1weDtvcGFjaXR5OjAuNztcIj5IZXJlJ3MgdG8gYW5vdGhlciB5ZWFyIG9mIHNoaXBwaW5nIPCfmoA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGBcbiAgICA8ZGl2IHN0eWxlPVwid2lkdGg6JHt3aWR0aH1weDtoZWlnaHQ6JHtoZWlnaHR9cHg7YmFja2dyb3VuZDoke3RoZW1lQ29uZmlnLmJnfTtmb250LWZhbWlseTotYXBwbGUtc3lzdGVtLEJsaW5rTWFjU3lzdGVtRm9udCwnU2Vnb2UgVUknLEhlbHZldGljYSxBcmlhbCxzYW5zLXNlcmlmO2NvbG9yOiR7dGhlbWVDb25maWcudGV4dH07cG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7b3BhY2l0eToke2dsb2JhbE9wfTtcIj5cblxuICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoZWxsaXBzZSBhdCA1MCUgMzAlLCAke3RoZW1lQ29uZmlnLmdsb3d9IDAlLCB0cmFuc3BhcmVudCA1MCUpO1wiPjwvZGl2PlxuXG4gICAgICAke3QuYWN0aXZlICE9PSBcImludHJvXCIgPyBgXG4gICAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTt0b3A6OCU7b3BhY2l0eToke3VzZXJuYW1lUH07XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC40fXB4O2NvbG9yOiR7dGhlbWVDb25maWcuYWNjZW50fTtmb250LXdlaWdodDo2MDA7XCI+QCR7dXNlcm5hbWV9PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYCA6IFwiXCJ9XG5cbiAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtvcGFjaXR5OiR7cGhhc2VPcH07XCI+JHttYWluQ29udGVudH08L2Rpdj5cblxuICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO2JvdHRvbTo4JTtvcGFjaXR5OiR7aW50cm9QICogMC42fTtcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2ZvbnRTaXplICogMC4zfXB4O2NvbG9yOiR7dGhlbWVDb25maWcuYWNjZW50fTtcIj5HaXRIdWIgV3JhcHBlZCAke3llYXJ9PC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgIDwvZGl2PlxuICBgO1xuICB9LFxufSk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJBLFNBQVMsT0FBTyxPQUFPO0VBQ3RCLE1BQU0sU0FBUyxNQUFNLFVBQVU7RUFDL0IsTUFBTSxJQUFJLE1BQU07RUFDaEIsTUFBTSxhQUFhLE9BQU8sTUFBTSxZQUFZO0VBQzVDLE9BQU87R0FDTjtHQUNBLFVBQVUsQ0FBQyxDQUFDLEtBQUssT0FBTyxFQUFFLFFBQVEsYUFBYSxFQUFFLFlBQVksUUFBUTtHQUNyRSxRQUFRLE1BQU07R0FDZCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsYUFBYSxFQUFFLFNBQVMsTUFBTSxRQUFRLElBQUksQ0FBQztFQUMvQztDQUNEOzs7Ozs7Ozs7Ozs7Ozs7OztDQ3ZDQSxTQUFTLG1CQUFtQixLQUFxQjtFQUMvQyxPQUFPLElBQUksZUFBZSxPQUFPO0NBQ25DO0NBNEJBLE1BQU0sZUFBK0c7RUFDbkgsTUFBTTtHQUFFLElBQUk7R0FBVyxNQUFNO0dBQVcsTUFBTTtHQUFXLFFBQVE7R0FBVyxNQUFNO0VBQVk7RUFDOUYsU0FBUztHQUFFLElBQUk7R0FBVyxNQUFNO0dBQVcsTUFBTTtHQUFXLFFBQVE7R0FBVyxNQUFNO0VBQVk7RUFDakcsUUFBUTtHQUFFLElBQUk7R0FBVyxNQUFNO0dBQVcsTUFBTTtHQUFXLFFBQVE7R0FB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