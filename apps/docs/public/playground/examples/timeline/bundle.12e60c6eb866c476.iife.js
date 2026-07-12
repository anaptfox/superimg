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
	//#region examples/data/timeline/timeline.media.ts
	const THEMES = {
		minimalist: {
			bg: {
				dark: "#000000",
				light: "#ffffff"
			},
			text: {
				dark: "#ffffff",
				light: "#000000"
			},
			muted: {
				dark: "#888888",
				light: "#666666"
			},
			accent: {
				dark: "#ffffff",
				light: "#000000"
			},
			fontFamily: "\"Inter\", system-ui, sans-serif",
			nodeActiveStyle: (accent) => `background: ${accent}; transform: scale(1.3);`,
			containerStyle: () => "",
			easing: "easeOutCubic"
		},
		tech: {
			bg: {
				dark: "#0A0A0F",
				light: "#F3F4F6"
			},
			text: {
				dark: "#E2E8F0",
				light: "#0F172A"
			},
			muted: {
				dark: "#888888",
				light: "#666666"
			},
			accent: {
				dark: "#3B82F6",
				light: "#3B82F6"
			},
			fontFamily: "\"Fira Code\", monospace",
			nodeActiveStyle: (accent) => `box-shadow: 0 0 15px ${accent}; border: 1px solid ${accent}; background: ${accent};`,
			containerStyle: (isDark) => isDark ? `background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(148, 163, 184, 0.1);` : "",
			easing: "easeOutCubic",
			imageFilter: "filter: grayscale(80%) sepia(20%) hue-rotate(180deg);"
		},
		corporate: {
			bg: {
				dark: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
				light: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
			},
			text: {
				dark: "#ffffff",
				light: "#000000"
			},
			muted: {
				dark: "#888888",
				light: "#666666"
			},
			accent: {
				dark: "#2563EB",
				light: "#2563EB"
			},
			fontFamily: "\"Roboto\", system-ui, sans-serif",
			nodeActiveStyle: (accent) => `background: ${accent}; border: 2px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1);`,
			containerStyle: () => "",
			easing: "easeOutCubic"
		},
		playful: {
			bg: {
				dark: "#1A1A1A",
				light: "#FEF3C7"
			},
			text: {
				dark: "#FDF8F6",
				light: "#431407"
			},
			muted: {
				dark: "#A8A29E",
				light: "#78716C"
			},
			accent: {
				dark: "#EC4899",
				light: "#EC4899"
			},
			fontFamily: "\"Outfit\", \"Varela Round\", system-ui, sans-serif",
			nodeActiveStyle: (accent) => `background: ${accent}; transform: rotate(-5deg) scale(1.2); box-shadow: 4px 4px 0px rgba(0,0,0,0.2);`,
			containerStyle: (isDark) => `box-shadow: 8px 8px 0px rgba(0,0,0,0.05); border-radius: 24px; border: 2px solid ${isDark ? "#333" : "#ddd"};`,
			easing: "easeOutBack"
		}
	};
	//#endregion
	exports.default = define({
		sample: {
			title: "Product Roadmap",
			subtitle: "What is next for our company",
			events: [
				{
					date: "Q1 2025",
					title: "Launch v2.0",
					description: "Major release",
					icon: "🚀"
				},
				{
					date: "Q2 2025",
					title: "Mobile app",
					description: "iOS & Android",
					icon: "📱"
				},
				{
					date: "Q3 2025",
					title: "Enterprise",
					description: "Team features",
					icon: "🏢"
				}
			],
			theme: "tech",
			mode: "dark"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "6s",
			fonts: [
				"Inter:wght@400;700;800",
				"Fira+Code:wght@400;700",
				"Roboto:wght@400;500;700;800",
				"Outfit:wght@400;500;700;800"
			]
		},
		render(ctx) {
			const { width, height, timeline, data, std } = ctx;
			const { title, subtitle, events, mode, theme } = data;
			const isPortrait = height > width;
			const themeConfig = THEMES[theme ?? "minimalist"] ?? THEMES.minimalist;
			const isDark = mode === "dark";
			const themeEasing = themeConfig.easing;
			const bgColor = themeConfig.bg[isDark ? "dark" : "light"];
			const textColor = themeConfig.text[isDark ? "dark" : "light"];
			const mutedColor = themeConfig.muted[isDark ? "dark" : "light"];
			const accentColor = themeConfig.accent[isDark ? "dark" : "light"];
			const fontFamily = themeConfig.fontFamily;
			const containerStyle = themeConfig.containerStyle(isDark);
			const totalEvents = events.length;
			const ENTRANCE_END = totalEvents <= 3 ? .15 : totalEvents <= 6 ? .1 : .07;
			const progressRemaining = 1 - ENTRANCE_END - .05;
			const slicePerEvent = totalEvents > 0 ? progressRemaining / totalEvents : 1;
			const titleProgress = std.interpolate(timeline.progress, [0, .1], [0, 1], themeEasing);
			const sidebarWidth = isPortrait ? 80 : 120;
			const mainPadding = isPortrait ? 40 : 60;
			const titleFontSize = isPortrait ? 36 : 48;
			const subtitleFontSize = isPortrait ? 20 : 24;
			const dateFontSize = isPortrait ? 24 : 32;
			const eventTitleFontSize = isPortrait ? 48 : 64;
			const descFontSize = isPortrait ? 22 : 28;
			const imageHeight = isPortrait ? 280 : 360;
			const sidebarNodesHtml = events.map((event, i) => {
				const eventStart = ENTRANCE_END + i * slicePerEvent;
				const eventEnd = eventStart + slicePerEvent;
				const isActive = timeline.progress >= eventStart && timeline.progress < eventEnd;
				const isPast = timeline.progress >= eventEnd;
				let currentStyle = `background: ${isPast ? accentColor : isDark ? "#333333" : "#DDDDDD"};`;
				if (isActive) currentStyle = themeConfig.nodeActiveStyle(accentColor, isDark);
				const truncatedDate = event.date.length > 6 ? event.date.slice(0, 5) + "…" : event.date;
				return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; z-index: 2;">
          <div style="width: ${isPortrait ? 12 : 16}px; height: ${isPortrait ? 12 : 16}px; border-radius: 50%; ${currentStyle} z-index: 2;"></div>
          <span style="font-size: ${isPortrait ? 8 : 10}px; color: ${mutedColor}; margin-top: 4px; opacity: ${isActive ? 1 : isPast ? .7 : .4}; white-space: nowrap; text-align: center;">${truncatedDate}</span>
        </div>
      `;
			}).join("");
			const activeNodeIndex = events.findIndex((_, i) => {
				const start = ENTRANCE_END + i * slicePerEvent;
				const end = start + slicePerEvent;
				return timeline.progress >= start && timeline.progress < end;
			});
			const displayIndex = activeNodeIndex === -1 ? timeline.progress > .5 ? totalEvents - 1 : 0 : activeNodeIndex;
			const fillPercent = timeline.progress < ENTRANCE_END ? 0 : Math.min(100, (timeline.progress - ENTRANCE_END) / progressRemaining * 100);
			let eventContentHtml = "";
			if (totalEvents > 0 && displayIndex >= 0) {
				const e = events[displayIndex];
				const start = ENTRANCE_END + displayIndex * slicePerEvent;
				const lp = Math.max(0, Math.min(1, (timeline.progress - start) / slicePerEvent));
				const IN_DUR = .15;
				const OUT_DUR = .15;
				const enterP = std.interpolate(lp, [0, IN_DUR], [0, 1], themeEasing);
				const exitP = std.interpolate(lp, [1 - OUT_DUR, 1], [0, 1], "easeInCubic");
				const opacity = enterP * (1 - exitP);
				const yOffset = (1 - enterP) * 40 - exitP * 40;
				const eventAccent = e.accentColor || accentColor;
				const imageFilter = themeConfig.imageFilter || "";
				const playfulBorder = theme === "playful" ? `border: 4px solid ${textColor};` : "";
				const imageHtml = e.imageUrl ? `
        <div style="margin-top: ${isPortrait ? 24 : 32}px; width: 100%; height: ${imageHeight}px; border-radius: 16px; background: url('${e.imageUrl}') center/cover; ${playfulBorder} ${imageFilter}"></div>
      ` : "";
				eventContentHtml = `
        <div style="opacity: ${opacity}; transform: translateY(${yOffset}px); display: flex; flex-direction: column; height: 100%; justify-content: center;">
          <div style="font-size: ${dateFontSize}px; font-weight: 700; color: ${eventAccent}; margin-bottom: 8px; letter-spacing: 2px;">
            ${e.date.toUpperCase()}
          </div>
          <div style="font-size: ${eventTitleFontSize}px; font-weight: 800; color: ${textColor}; line-height: 1.1; margin-bottom: 24px;">
            ${e.icon ? `<span style="margin-right: 16px;">${e.icon}</span>` : ""}${e.title}
          </div>
          ${e.description ? `<div style="font-size: ${descFontSize}px; line-height: 1.5; color: ${mutedColor}; font-weight: ${theme === "tech" ? "400" : "500"};">${e.description}</div>` : ""}
          ${imageHtml}
        </div>
        `;
			}
			const mainLayoutOpacity = std.interpolate(std.clamp01((titleProgress - .8) / .2), [0, 1], [0, 1], "easeOutCubic");
			return `
        <div style="width: ${width}px; height: ${height}px; background: ${bgColor}; font-family: ${fontFamily}; display: flex; flex-direction: column; overflow: hidden; padding: ${mainPadding}px;">      <div style="opacity: ${titleProgress}; transform: translateY(${30 * (1 - titleProgress)}px); margin-bottom: ${isPortrait ? 24 : 40}px;">
        <h1 style="color: ${textColor}; font-size: ${titleFontSize}px; margin: 0; font-weight: 800; letter-spacing: -1px;">${title}</h1>
        ${subtitle ? `<h2 style="color: ${mutedColor}; font-size: ${subtitleFontSize}px; margin: 8px 0 0 0; font-weight: 500;">${subtitle}</h2>` : ""}
      </div>

      <div style="display: flex; flex: 1; height: 100%; opacity: ${mainLayoutOpacity};">
        <div style="width: ${sidebarWidth}px; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 0;">
          <div style="position: absolute; left: 50%; top: 20px; bottom: 20px; width: 4px; background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}; transform: translateX(-50%); border-radius: 2px;"></div>
          <div style="position: absolute; left: 50%; top: 20px; height: ${fillPercent}%; width: 4px; background: ${accentColor}; transform: translateX(-50%); border-radius: 2px;"></div>
          ${sidebarNodesHtml}
        </div>

        <div style="flex: 1; padding-left: ${isPortrait ? 24 : 40}px; ${containerStyle} border-radius: 24px; padding: ${isPortrait ? 24 : 40}px; position: relative;">
          ${eventContentHtml}
        </div>
      </div>
    </div>
  `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZWxpbmUubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2RhdGEvdGltZWxpbmUvdGltZWxpbmUubWVkaWEudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy9qc29uLnRzXG4vLyEgU2VyaWFsaXphYmxlIEpTT04tc2hhcGVkIHZhbHVlcyBmb3IgdGVtcGxhdGUgZGF0YSBkZWZhdWx0cyBhbmQgQ0xJIGxvYWRlcnMuXG5mdW5jdGlvbiBpc0pzb25PYmplY3QodmFsdWUpIHtcblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvdHlwZXMudHNcbi8vISBTdXBlckltZyBUeXBlcyAtIENvcmUgdHlwZSBkZWZpbml0aW9uc1xuLy8hIEV4cGxpY2l0LCB0eXBlZCwgc2VsZi1kb2N1bWVudGluZyBpbnRlcmZhY2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vKipcbiogRGVmaW5lIGEgcHJvamVjdC9mb2xkZXIgY29uZmlnIGZvciBfY29uZmlnLnRzIGZpbGVzLlxuKiBQcm92aWRlcyB0eXBlIGluZmVyZW5jZSBhbmQgdmFsaWRhdGlvbi5cbiovXG5mdW5jdGlvbiBkZWZpbmVDb25maWcoY29uZmlnKSB7XG5cdHJldHVybiBjb25maWc7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvZGVmaW5lLnRzXG4vLyEgVGhlIHVuaWZpZWQgYGRlZmluZSgpYCB0ZW1wbGF0ZSBmYWN0b3J5LlxuLy8hXG4vLyEgVW5pZmllZCB0ZW1wbGF0ZSBmYWN0b3J5IOKAlCBvbmUgYGRlZmluZSgpYCBmb3IgYWxsIG91dHB1dCBraW5kcy5cbi8vISBUaHJlZSBvcnRob2dvbmFsIGF4ZXMgc2VsZWN0IGJlaGF2aW91cjpcbi8vISAgLSBtZWRpdW06ICAgXCJodG1sXCIgKENocm9taXVtKSB8IFwic3ZnXCIgKHJlc3ZnLXdhc20sIGJyb3dzZXItZnJlZSwgZWRnZSkuXG4vLyEgIC0gYW5pbWF0ZWQ6IGluZmVycmVkIGZyb20gdGhlIGNvbmZpZyDigJQgdHJ1ZSBpZmYgaXQgZGVjbGFyZXMgZnBzIEFORFxuLy8hICAgICAgICAgICAgICAoZHVyYXRpb24gT1IgYSBgcmVzb2x2ZWAgaG9vayB0aGF0IHdpbGwgc3VwcGx5IGR1cmF0aW9uKS5cbi8vISAgLSBzaW5rOiAgICAgY2hvc2VuIGxhdGVyIChjb25maWcub3V0cHV0cyAvIENMSSAvIGBhc2ApLCBub3QgYXQgYXV0aG9yaW5nIHRpbWUuXG4vLyFcbi8vISBUeXBlU2NyaXB0IG5hcnJvd3MgYGN0eGAgdG8gdGhlIHJpZ2h0IHZhcmlhbnQgYXQgdGhlIGNhbGwgc2l0ZSB2aWEgb3ZlcmxvYWRzOlxuLy8hIG1lZGl1bSBwaWNrcyB0aGUgc3RkbGliIGZsYXZvdXIsIGFuaW1hdGVkIGFkZHMgdGhlIHRlbXBvcmFsIGZpZWxkcyArIGhlbHBlcnMuXG5mdW5jdGlvbiBkZWZpbmUoaW5wdXQpIHtcblx0Y29uc3QgbWVkaXVtID0gaW5wdXQubWVkaXVtID8/IFwiaHRtbFwiO1xuXHRjb25zdCBjID0gaW5wdXQuY29uZmlnO1xuXHRjb25zdCBoYXNSZXNvbHZlID0gdHlwZW9mIGlucHV0LnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIjtcblx0cmV0dXJuIHtcblx0XHRtZWRpdW0sXG5cdFx0YW5pbWF0ZWQ6ICEhYyAmJiB0eXBlb2YgYy5mcHMgPT09IFwibnVtYmVyXCIgJiYgKGMuZHVyYXRpb24gIT0gbnVsbCB8fCBoYXNSZXNvbHZlKSxcblx0XHRyZW5kZXI6IGlucHV0LnJlbmRlcixcblx0XHQuLi5pbnB1dC5jb25maWcgIT09IHZvaWQgMCA/IHsgY29uZmlnOiBpbnB1dC5jb25maWcgfSA6IHt9LFxuXHRcdC4uLmlucHV0LnNhbXBsZSAhPT0gdm9pZCAwID8geyBzYW1wbGU6IGlucHV0LnNhbXBsZSB9IDoge30sXG5cdFx0Li4uaGFzUmVzb2x2ZSA/IHsgcmVzb2x2ZTogaW5wdXQucmVzb2x2ZSB9IDoge31cblx0fTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gYW5pbWF0ZWQgKGZwcyArIGR1cmF0aW9uIGF0IGF1dGhvcmluZyB0aW1lKS4gKi9cbmZ1bmN0aW9uIGlzQW5pbWF0ZWRUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IHRydWU7XG59XG4vKiogTmFycm93IGEgdGVtcGxhdGUgbW9kdWxlIHRvIHN0YXRpYyAoc3RpbGwgLyBzaW5nbGUtZnJhbWUpLiAqL1xuZnVuY3Rpb24gaXNTdGF0aWNUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IGZhbHNlO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3Jlc3VsdHMudHNcbi8vISBSZXN1bHQgdHlwZXMgYW5kIHN0cnVjdHVyZWQgZXJyb3JzXG4vLyEgRGlzY3JpbWluYXRlZCB1bmlvbnMgZm9yIGFzeW5jIG9wZXJhdGlvbnMgd2l0aCBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2VzXG4vKipcbiogQmFzZSBlcnJvciBjbGFzcyBmb3IgYWxsIFN1cGVySW1nIGVycm9yc1xuKi9cbnZhciBTdXBlckltZ0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG5cdGNvZGU7XG5cdGRldGFpbHM7XG5cdHN1Z2dlc3Rpb247XG5cdGRvY3NVcmw7XG5cdC8qKiBNYXBwZWQgc291cmNlIGxvY2F0aW9uIChwb3B1bGF0ZWQgYnkgZW5yaWNoRXJyb3Igd2hlbiBzb3VyY2VtYXAgYXZhaWxhYmxlKSAqL1xuXHRsb2NhdGlvbjtcblx0LyoqIFZpdGUtc3R5bGUgY29kZSBmcmFtZSBzdHJpbmcgKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZSBjb250ZW50IGF2YWlsYWJsZSkgKi9cblx0Y29kZUZyYW1lO1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlLCBjb2RlLCBkZXRhaWxzLCBzdWdnZXN0aW9uLCBkb2NzVXJsKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5jb2RlID0gY29kZTtcblx0XHR0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuXHRcdHRoaXMuc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb247XG5cdFx0dGhpcy5kb2NzVXJsID0gZG9jc1VybDtcblx0XHR0aGlzLm5hbWUgPSBcIlN1cGVySW1nRXJyb3JcIjtcblx0XHRjb25zdCBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlO1xuXHRcdGlmIChjYXB0dXJlU3RhY2tUcmFjZSkgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdH1cblx0LyoqIENvbnZlcnQgdG8gYSBwbGFpbiBvYmplY3QgZm9yIGxvZ2dpbmcvc2VyaWFsaXphdGlvbiAqL1xuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdGNvZGU6IHRoaXMuY29kZSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMubWVzc2FnZSxcblx0XHRcdGRldGFpbHM6IHRoaXMuZGV0YWlscyxcblx0XHRcdHN1Z2dlc3Rpb246IHRoaXMuc3VnZ2VzdGlvbixcblx0XHRcdC4uLnRoaXMuZG9jc1VybCAhPT0gdm9pZCAwID8geyBkb2NzVXJsOiB0aGlzLmRvY3NVcmwgfSA6IHt9LFxuXHRcdFx0Li4udGhpcy5sb2NhdGlvbiAhPT0gdm9pZCAwID8geyBsb2NhdGlvbjogdGhpcy5sb2NhdGlvbiB9IDoge30sXG5cdFx0XHQuLi50aGlzLmNvZGVGcmFtZSAhPT0gdm9pZCAwID8geyBjb2RlRnJhbWU6IHRoaXMuY29kZUZyYW1lIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkXG4qL1xudmFyIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IGRldGFpbHMubGluZSA/IGAgYXQgbGluZSAke2RldGFpbHMubGluZX1gIDogXCJcIjtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBDaGVjayB0aGUgdGVtcGxhdGUgc3ludGF4JHtsb2NhdGlvbn0uIEVuc3VyZSB0aGUgcmVuZGVyIGZ1bmN0aW9uIHJldHVybnMgYSBzdHJpbmcuYDtcblx0XHRzdXBlcihgVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkJHtsb2NhdGlvbn06ICR7ZGV0YWlscy5zeW50YXhFcnJvcn1gLCBcIlRFTVBMQVRFX0NPTVBJTEFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlQ29tcGlsYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgdGhyZXcgYW4gZXJyb3IgZHVyaW5nIHJlbmRlclxuKi9cbnZhciBUZW1wbGF0ZVJ1bnRpbWVFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCB0aW1lSW5mbyA9IGRldGFpbHMudGltZUNvbnRleHQgPyBgICgke2RldGFpbHMudGltZUNvbnRleHQudGltZWxpbmVTZWNvbmRzLnRvRml4ZWQoMyl9cywgJHsoZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVByb2dyZXNzICogMTAwKS50b0ZpeGVkKDEpfSUgcHJvZ3Jlc3MpYCA6IFwiXCI7XG5cdFx0c3VwZXIoYFRlbXBsYXRlIGVycm9yIGF0IGZyYW1lICR7ZGV0YWlscy5mcmFtZX0ke3RpbWVJbmZvfTogJHtkZXRhaWxzLm9yaWdpbmFsRXJyb3J9YCwgXCJURU1QTEFURV9SVU5USU1FX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBgVGhlIHJlbmRlciBmdW5jdGlvbiB0aHJldyBhbiBlcnJvci4gQ2hlY2sgdGhhdCBhbGwgZGF0YSBwcm9wZXJ0aWVzIGV4aXN0IGFuZCB2YWx1ZXMgYXJlbid0IE5hTi91bmRlZmluZWQgYXQgdGhpcyBwb2ludCBpbiB0aGUgdGltZWxpbmUuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlcyNkZWJ1Z2dpbmdcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJUZW1wbGF0ZVJ1bnRpbWVFcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogRGF0YSB2YWxpZGF0aW9uIGZhaWxlZFxuKi9cbnZhciBWYWxpZGF0aW9uRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBgRXhwZWN0ZWQgJHtkZXRhaWxzLmV4cGVjdGVkVHlwZX0gYnV0IHJlY2VpdmVkICR7dHlwZW9mIGRldGFpbHMucmVjZWl2ZWRWYWx1ZX0uIENoZWNrIHlvdXIgZGF0YSBvYmplY3QuYDtcblx0XHRzdXBlcihgVmFsaWRhdGlvbiBmYWlsZWQgZm9yIGZpZWxkIFwiJHtkZXRhaWxzLmZpZWxkfVwiYCwgXCJWQUxJREFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlZhbGlkYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogUmVuZGVyIGZhaWxlZCAoZW5jb2RpbmcsIGJyb3dzZXIsIGV0Yy4pXG4qL1xudmFyIFJlbmRlckVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gZGV0YWlscy5odG1sRXJyb3IgPyBgVGhlIHRlbXBsYXRlIHJldHVybmVkIGludmFsaWQgSFRNTC4gQ2hlY2sgeW91ciByZW5kZXIgZnVuY3Rpb24gb3V0cHV0LmAgOiBkZXRhaWxzLmVuY29kZXJFcnJvciA/IGBFbmNvZGVyIGVycm9yLiBUcnkgcmVkdWNpbmcgcmVzb2x1dGlvbiBvciBjaGFuZ2luZyBjb2RlYy5gIDogYEJyb3dzZXIgZXJyb3IuIENoZWNrIGZvciBicm93c2VyIGNvbXBhdGliaWxpdHkgaXNzdWVzLmA7XG5cdFx0c3VwZXIoYFJlbmRlciBmYWlsZWQgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfWAsIFwiUkVOREVSX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlJlbmRlckVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBGaWxlIEkvTyBlcnJvclxuKi9cbnZhciBJT0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdHN1cGVyKGBGYWlsZWQgdG8gJHtkZXRhaWxzLm9wZXJhdGlvbn0gZmlsZTogJHtkZXRhaWxzLnBhdGh9YCwgXCJJT19FUlJPUlwiLCBkZXRhaWxzLCBkZXRhaWxzLm9wZXJhdGlvbiA9PT0gXCJ3cml0ZVwiID8gYENoZWNrIHRoYXQgdGhlIGRpcmVjdG9yeSBleGlzdHMgYW5kIHlvdSBoYXZlIHdyaXRlIHBlcm1pc3Npb25zLmAgOiBgQ2hlY2sgdGhhdCB0aGUgZmlsZSBleGlzdHMgYW5kIHlvdSBoYXZlIHJlYWQgcGVybWlzc2lvbnMuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZyNpb1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIklPRXJyb3JcIjtcblx0fVxufTtcbi8qKlxuKiBQbGF5ZXIgbm90IHJlYWR5IGVycm9yXG4qL1xudmFyIFBsYXllck5vdFJlYWR5RXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihvcGVyYXRpb24pIHtcblx0XHRzdXBlcihgUGxheWVyIG5vdCByZWFkeSBmb3Igb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBcIlBMQVlFUl9OT1RfUkVBRFlcIiwgeyBvcGVyYXRpb24gfSwgYENhbGwgbG9hZCgpIGFuZCB3YWl0IGZvciBpdCB0byBjb21wbGV0ZSBiZWZvcmUgY2FsbGluZyAke29wZXJhdGlvbn0oKS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvcGxheWVyXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyTm90UmVhZHlFcnJvclwiO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3BsYXllci50c1xuLy8hIFBsYXllciB0eXBlcyAtIFVzZXItZmFjaW5nIG9wdGlvbnMsIGV2ZW50cywgYW5kIGlucHV0IHR5cGVzIGZvciB0aGUgYnJvd3NlciBwbGF5ZXJcbi8vISBJbXBsZW1lbnRhdGlvbiB0eXBlcyAoUGxheWVyU3RhdGUsIFBsYXllclN0b3JlLCBldGMuKSBsaXZlIGluIEBzdXBlcmltZy9wbGF5ZXJcbi8qKiBUeXBlIGd1YXJkIGZvciBDb21wb3NlZFRlbXBsYXRlICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIiAmJiBpbnB1dCAhPT0gbnVsbCAmJiBcInR5cGVcIiBpbiBpbnB1dCAmJiBpbnB1dC50eXBlID09PSBcImNvbXBvc2VkXCI7XG59XG4vKiogQGRlcHJlY2F0ZWQgVXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSAqL1xuY29uc3QgaXNBbnlDb21wb3NlZFRlbXBsYXRlID0gaXNDb21wb3NlZFRlbXBsYXRlO1xuLyoqIEBkZXByZWNhdGVkIFJlbW92ZWQg4oCUIHVzZSBpc0NvbXBvc2VkVGVtcGxhdGUgYW5kIGNoZWNrIG1lZGl1bSA9PT0gXCJzdmdcIiAqL1xuZnVuY3Rpb24gaXNDb21wb3NlZFN2Z1RlbXBsYXRlKGlucHV0KSB7XG5cdHJldHVybiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpICYmIGlucHV0Lm1lZGl1bSA9PT0gXCJzdmdcIjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9ldmVudHMudHNcbi8vISBUeXBlZCwgdmVyc2lvbmVkIGV2ZW50IGNvbnRyYWN0IGZvciBzdXBlcmltZyBidWlsZCBpbnRlZ3JhdGlvbnMuXG4vLyEgQm90aCBKUyBjb25zdW1lcnMgKHJlbmRlciB3cmFwcGVycykgYW5kIFJ1c3QgZGVzZXJpYWxpemVycyAoZS5nLiBndW1ibylcbi8vISBzaG91bGQga2V5IG9uIHRoZSBgdmAgZmllbGQgYmVmb3JlIHJlYWRpbmcgZXZlbnQtc3BlY2lmaWMgZmllbGRzLlxuLy8hIEJ1bXAgYHZgIG9uIGFueSBicmVha2luZyBmaWVsZCByZW5hbWUgb3IgcmVtb3ZhbDsgYWRkaXRpdmUgZmllbGRzIGFyZSBub24tYnJlYWtpbmcuXG5jb25zdCBSRU5ERVJfRVZFTlRfVkVSU0lPTiA9IDE7XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvYmF0Y2gtdHlwZXMudHNcbi8vISBTdXBlckltZyBCYXRjaCBUeXBlc1xuLy8hIENvLWxvY2F0ZWQgYGV4cG9ydCBjb25zdCBiYXRjaGAgY29udmVudGlvbiBmb3IgYnVpbGQtdGltZSBmYW4tb3V0LlxuLy8hIEEgdGVtcGxhdGUgbW9kdWxlIG9wdGlvbmFsbHkgZXhwb3J0cyBgYmF0Y2hgIChidWlsdCB3aXRoIGBkZWZpbmVCYXRjaGApIHRvXG4vLyEgZ2VuZXJhdGUgbWFueSBvdXRwdXRzIGZyb20gb25lIHRlbXBsYXRlIOKAlCBubyBzZXBhcmF0ZSBsb2FkZXIgZmlsZS5cbi8qKlxuKiBUeXBlIGEgY28tbG9jYXRlZCBgYmF0Y2hgIGV4cG9ydCBhZ2FpbnN0IGl0cyB0ZW1wbGF0ZS5cbipcbiogYFREYXRhYCBmbG93cyBmcm9tIHRoZSB0ZW1wbGF0ZSB2YWx1ZSDigJQgY2hhbmdlIHRoZSB0ZW1wbGF0ZSdzIGBzYW1wbGVgXG4qIHNoYXBlIGFuZCB0aGUgYGRhdGE6YCBzaXRlcyBiZWxvdyB0eXBlLWVycm9yLiBUaGUgdGVtcGxhdGUgYXJndW1lbnQgaXNcbiogaW5mZXJlbmNlLW9ubHk7IGF0IHJ1bnRpbWUgdGhlIHByb3ZpZGVyIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbipcbiogUHV0IGFueSBzZXJ2ZXIvZGF0YSBpbXBvcnRzICppbnNpZGUqIHRoZSBwcm92aWRlciB3aXRoIGBhd2FpdCBpbXBvcnQoLi4uKWBcbiogc28gdGhlIGNsaWVudCBwbGF5ZXIgYnVuZGxlICh3aGljaCBpbXBvcnRzIHRoZSB0ZW1wbGF0ZSkgdHJlZS1zaGFrZXMgdGhlbSBvdXQuXG4qXG4qIEBleGFtcGxlXG4qIGBgYHR5cGVzY3JpcHRcbiogLy8gb2cubWVkaWEudHNcbiogaW1wb3J0IHsgZGVmaW5lLCBkZWZpbmVCYXRjaCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuKlxuKiBjb25zdCB0ZW1wbGF0ZSA9IGRlZmluZSh7IHNhbXBsZTogeyB0aXRsZTogXCJIaVwiIH0sIGNvbmZpZzogeyB3aWR0aDogMTIwMCwgaGVpZ2h0OiA2MzAgfSwgcmVuZGVyIH0pO1xuKiBleHBvcnQgZGVmYXVsdCB0ZW1wbGF0ZTtcbipcbiogZXhwb3J0IGNvbnN0IGJhdGNoID0gZGVmaW5lQmF0Y2godGVtcGxhdGUsIGFzeW5jICgpID0+IHtcbiogICBjb25zdCB7IGdldFBvc3RzIH0gPSBhd2FpdCBpbXBvcnQoXCIuLi9jb250ZW50XCIpO1xuKiAgIHJldHVybiAoYXdhaXQgZ2V0UG9zdHMoKSkubWFwKHAgPT4gKHsgc2x1ZzogcC5zbHVnLCBzYW1wbGU6IHsgdGl0bGU6IHAudGl0bGUgfSB9KSk7XG4qIH0pO1xuKiBgYGBcbiovXG5mdW5jdGlvbiBkZWZpbmVCYXRjaChfdGVtcGxhdGUsIHByb3ZpZGVyKSB7XG5cdHJldHVybiBwcm92aWRlcjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9pbmRleC50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gUHVyZSBUeXBlU2NyaXB0IHR5cGUgZGVmaW5pdGlvbnNcbi8vISBDb3JlIHR5cGVzLCBpbnRlcmZhY2VzLCBhbmQgZXJyb3IgY2xhc3NlcyBmb3IgdGVtcGxhdGVzLCByZW5kZXJpbmcsIGFuZCBwbGF5YmFja1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBJT0Vycm9yLCBQbGF5ZXJOb3RSZWFkeUVycm9yLCBSRU5ERVJfRVZFTlRfVkVSU0lPTiwgUmVuZGVyRXJyb3IsIFN1cGVySW1nRXJyb3IsIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciwgVGVtcGxhdGVSdW50aW1lRXJyb3IsIFZhbGlkYXRpb25FcnJvciwgZGVmaW5lLCBkZWZpbmVCYXRjaCwgZGVmaW5lQ29uZmlnLCBpc0FuaW1hdGVkVGVtcGxhdGUsIGlzQW55Q29tcG9zZWRUZW1wbGF0ZSwgaXNDb21wb3NlZFN2Z1RlbXBsYXRlLCBpc0NvbXBvc2VkVGVtcGxhdGUsIGlzSnNvbk9iamVjdCwgaXNTdGF0aWNUZW1wbGF0ZSB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgeyBkZWZpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVsaW5lRXZlbnQge1xuICBkYXRlOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICBpY29uPzogc3RyaW5nO1xuICBpbWFnZVVybD86IHN0cmluZztcbiAgYWNjZW50Q29sb3I/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFRpbWVsaW5lVGhlbWUgPSBcIm1pbmltYWxpc3RcIiB8IFwidGVjaFwiIHwgXCJjb3Jwb3JhdGVcIiB8IFwicGxheWZ1bFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVsaW5lVmlkZW9EYXRhIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICB0aXRsZTogc3RyaW5nO1xuICBzdWJ0aXRsZT86IHN0cmluZztcbiAgZXZlbnRzOiBUaW1lbGluZUV2ZW50W107XG4gIG1vZGU/OiBcImRhcmtcIiB8IFwibGlnaHRcIjtcbiAgdGhlbWU/OiBUaW1lbGluZVRoZW1lO1xufVxuXG5pbnRlcmZhY2UgVGhlbWVDb25maWcge1xuICBiZzogeyBkYXJrOiBzdHJpbmc7IGxpZ2h0OiBzdHJpbmcgfTtcbiAgdGV4dDogeyBkYXJrOiBzdHJpbmc7IGxpZ2h0OiBzdHJpbmcgfTtcbiAgbXV0ZWQ6IHsgZGFyazogc3RyaW5nOyBsaWdodDogc3RyaW5nIH07XG4gIGFjY2VudDogeyBkYXJrOiBzdHJpbmc7IGxpZ2h0OiBzdHJpbmcgfTtcbiAgZm9udEZhbWlseTogc3RyaW5nO1xuICBub2RlQWN0aXZlU3R5bGU6IChhY2NlbnQ6IHN0cmluZywgaXNEYXJrOiBib29sZWFuKSA9PiBzdHJpbmc7XG4gIGNvbnRhaW5lclN0eWxlOiAoaXNEYXJrOiBib29sZWFuKSA9PiBzdHJpbmc7XG4gIGVhc2luZzogXCJlYXNlT3V0Q3ViaWNcIiB8IFwiZWFzZU91dEJhY2tcIjtcbiAgaW1hZ2VGaWx0ZXI/OiBzdHJpbmc7XG59XG5cbmNvbnN0IFRIRU1FUzogUmVjb3JkPFRpbWVsaW5lVGhlbWUsIFRoZW1lQ29uZmlnPiA9IHtcbiAgbWluaW1hbGlzdDoge1xuICAgIGJnOiB7IGRhcms6IFwiIzAwMDAwMFwiLCBsaWdodDogXCIjZmZmZmZmXCIgfSxcbiAgICB0ZXh0OiB7IGRhcms6IFwiI2ZmZmZmZlwiLCBsaWdodDogXCIjMDAwMDAwXCIgfSxcbiAgICBtdXRlZDogeyBkYXJrOiBcIiM4ODg4ODhcIiwgbGlnaHQ6IFwiIzY2NjY2NlwiIH0sXG4gICAgYWNjZW50OiB7IGRhcms6IFwiI2ZmZmZmZlwiLCBsaWdodDogXCIjMDAwMDAwXCIgfSxcbiAgICBmb250RmFtaWx5OiAnXCJJbnRlclwiLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWYnLFxuICAgIG5vZGVBY3RpdmVTdHlsZTogKGFjY2VudCkgPT4gYGJhY2tncm91bmQ6ICR7YWNjZW50fTsgdHJhbnNmb3JtOiBzY2FsZSgxLjMpO2AsXG4gICAgY29udGFpbmVyU3R5bGU6ICgpID0+IFwiXCIsXG4gICAgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiLFxuICB9LFxuICB0ZWNoOiB7XG4gICAgYmc6IHsgZGFyazogXCIjMEEwQTBGXCIsIGxpZ2h0OiBcIiNGM0Y0RjZcIiB9LFxuICAgIHRleHQ6IHsgZGFyazogXCIjRTJFOEYwXCIsIGxpZ2h0OiBcIiMwRjE3MkFcIiB9LFxuICAgIG11dGVkOiB7IGRhcms6IFwiIzg4ODg4OFwiLCBsaWdodDogXCIjNjY2NjY2XCIgfSxcbiAgICBhY2NlbnQ6IHsgZGFyazogXCIjM0I4MkY2XCIsIGxpZ2h0OiBcIiMzQjgyRjZcIiB9LFxuICAgIGZvbnRGYW1pbHk6ICdcIkZpcmEgQ29kZVwiLCBtb25vc3BhY2UnLFxuICAgIG5vZGVBY3RpdmVTdHlsZTogKGFjY2VudCkgPT4gYGJveC1zaGFkb3c6IDAgMCAxNXB4ICR7YWNjZW50fTsgYm9yZGVyOiAxcHggc29saWQgJHthY2NlbnR9OyBiYWNrZ3JvdW5kOiAke2FjY2VudH07YCxcbiAgICBjb250YWluZXJTdHlsZTogKGlzRGFyaykgPT4gaXNEYXJrID8gYGJhY2tncm91bmQ6IHJnYmEoMzAsIDQxLCA1OSwgMC41KTsgYm9yZGVyOiAxcHggc29saWQgcmdiYSgxNDgsIDE2MywgMTg0LCAwLjEpO2AgOiBcIlwiLFxuICAgIGVhc2luZzogXCJlYXNlT3V0Q3ViaWNcIixcbiAgICBpbWFnZUZpbHRlcjogXCJmaWx0ZXI6IGdyYXlzY2FsZSg4MCUpIHNlcGlhKDIwJSkgaHVlLXJvdGF0ZSgxODBkZWcpO1wiLFxuICB9LFxuICBjb3Jwb3JhdGU6IHtcbiAgICBiZzogeyBkYXJrOiBcImxpbmVhci1ncmFkaWVudCgxMzVkZWcsICMwZjE3MmEgMCUsICMxZTI5M2IgMTAwJSlcIiwgbGlnaHQ6IFwibGluZWFyLWdyYWRpZW50KDEzNWRlZywgI2Y4ZmFmYyAwJSwgI2UyZThmMCAxMDAlKVwiIH0sXG4gICAgdGV4dDogeyBkYXJrOiBcIiNmZmZmZmZcIiwgbGlnaHQ6IFwiIzAwMDAwMFwiIH0sXG4gICAgbXV0ZWQ6IHsgZGFyazogXCIjODg4ODg4XCIsIGxpZ2h0OiBcIiM2NjY2NjZcIiB9LFxuICAgIGFjY2VudDogeyBkYXJrOiBcIiMyNTYzRUJcIiwgbGlnaHQ6IFwiIzI1NjNFQlwiIH0sXG4gICAgZm9udEZhbWlseTogJ1wiUm9ib3RvXCIsIHN5c3RlbS11aSwgc2Fucy1zZXJpZicsXG4gICAgbm9kZUFjdGl2ZVN0eWxlOiAoYWNjZW50KSA9PiBgYmFja2dyb3VuZDogJHthY2NlbnR9OyBib3JkZXI6IDJweCBzb2xpZCAjZmZmOyBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtgLFxuICAgIGNvbnRhaW5lclN0eWxlOiAoKSA9PiBcIlwiLFxuICAgIGVhc2luZzogXCJlYXNlT3V0Q3ViaWNcIixcbiAgfSxcbiAgcGxheWZ1bDoge1xuICAgIGJnOiB7IGRhcms6IFwiIzFBMUExQVwiLCBsaWdodDogXCIjRkVGM0M3XCIgfSxcbiAgICB0ZXh0OiB7IGRhcms6IFwiI0ZERjhGNlwiLCBsaWdodDogXCIjNDMxNDA3XCIgfSxcbiAgICBtdXRlZDogeyBkYXJrOiBcIiNBOEEyOUVcIiwgbGlnaHQ6IFwiIzc4NzE2Q1wiIH0sXG4gICAgYWNjZW50OiB7IGRhcms6IFwiI0VDNDg5OVwiLCBsaWdodDogXCIjRUM0ODk5XCIgfSxcbiAgICBmb250RmFtaWx5OiAnXCJPdXRmaXRcIiwgXCJWYXJlbGEgUm91bmRcIiwgc3lzdGVtLXVpLCBzYW5zLXNlcmlmJyxcbiAgICBub2RlQWN0aXZlU3R5bGU6IChhY2NlbnQpID0+IGBiYWNrZ3JvdW5kOiAke2FjY2VudH07IHRyYW5zZm9ybTogcm90YXRlKC01ZGVnKSBzY2FsZSgxLjIpOyBib3gtc2hhZG93OiA0cHggNHB4IDBweCByZ2JhKDAsMCwwLDAuMik7YCxcbiAgICBjb250YWluZXJTdHlsZTogKGlzRGFyaykgPT4gYGJveC1zaGFkb3c6IDhweCA4cHggMHB4IHJnYmEoMCwwLDAsMC4wNSk7IGJvcmRlci1yYWRpdXM6IDI0cHg7IGJvcmRlcjogMnB4IHNvbGlkICR7aXNEYXJrID8gXCIjMzMzXCIgOiBcIiNkZGRcIn07YCxcbiAgICBlYXNpbmc6IFwiZWFzZU91dEJhY2tcIixcbiAgfSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZTxUaW1lbGluZVZpZGVvRGF0YT4oe1xuICBzYW1wbGU6IHtcbiAgICB0aXRsZTogXCJQcm9kdWN0IFJvYWRtYXBcIixcbiAgICBzdWJ0aXRsZTogXCJXaGF0IGlzIG5leHQgZm9yIG91ciBjb21wYW55XCIsXG4gICAgZXZlbnRzOiBbXG4gICAgICB7IGRhdGU6IFwiUTEgMjAyNVwiLCB0aXRsZTogXCJMYXVuY2ggdjIuMFwiLCBkZXNjcmlwdGlvbjogXCJNYWpvciByZWxlYXNlXCIsIGljb246IFwi8J+agFwiIH0sXG4gICAgICB7IGRhdGU6IFwiUTIgMjAyNVwiLCB0aXRsZTogXCJNb2JpbGUgYXBwXCIsIGRlc2NyaXB0aW9uOiBcImlPUyAmIEFuZHJvaWRcIiwgaWNvbjogXCLwn5OxXCIgfSxcbiAgICAgIHsgZGF0ZTogXCJRMyAyMDI1XCIsIHRpdGxlOiBcIkVudGVycHJpc2VcIiwgZGVzY3JpcHRpb246IFwiVGVhbSBmZWF0dXJlc1wiLCBpY29uOiBcIvCfj6JcIiB9LFxuICAgIF0sXG4gICAgdGhlbWU6IFwidGVjaFwiLFxuICAgIG1vZGU6IFwiZGFya1wiLFxuICB9LFxuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCI2c1wiLFxuICAgIGZvbnRzOiBbXG4gICAgICBcIkludGVyOndnaHRANDAwOzcwMDs4MDBcIixcbiAgICAgIFwiRmlyYStDb2RlOndnaHRANDAwOzcwMFwiLFxuICAgICAgXCJSb2JvdG86d2dodEA0MDA7NTAwOzcwMDs4MDBcIixcbiAgICAgIFwiT3V0Zml0OndnaHRANDAwOzUwMDs3MDA7ODAwXCIsXG4gICAgXSxcbiAgfSxcbiAgcmVuZGVyKGN0eDogUmVuZGVyQ29udGV4dDxUaW1lbGluZVZpZGVvRGF0YT4pIHtcbiAgICBjb25zdCB7IHdpZHRoLCBoZWlnaHQsIHRpbWVsaW5lLCBkYXRhLCBzdGQgfSA9IGN0eDtcbiAgICBjb25zdCB7IHRpdGxlLCBzdWJ0aXRsZSwgZXZlbnRzLCBtb2RlLCB0aGVtZSB9ID0gZGF0YTtcbiAgICBjb25zdCBpc1BvcnRyYWl0ID0gaGVpZ2h0ID4gd2lkdGg7XG5cbiAgICBjb25zdCBzZWxlY3RlZFRoZW1lOiBUaW1lbGluZVRoZW1lID0gdGhlbWUgPz8gXCJtaW5pbWFsaXN0XCI7XG4gICAgY29uc3QgdGhlbWVDb25maWcgPSBUSEVNRVNbc2VsZWN0ZWRUaGVtZV0gPz8gVEhFTUVTLm1pbmltYWxpc3Q7XG4gICAgY29uc3QgaXNEYXJrID0gbW9kZSA9PT0gXCJkYXJrXCI7XG4gICAgY29uc3QgdGhlbWVFYXNpbmcgPSB0aGVtZUNvbmZpZy5lYXNpbmc7XG5cbiAgICBjb25zdCBiZ0NvbG9yID0gdGhlbWVDb25maWcuYmdbaXNEYXJrID8gXCJkYXJrXCIgOiBcImxpZ2h0XCJdO1xuICAgIGNvbnN0IHRleHRDb2xvciA9IHRoZW1lQ29uZmlnLnRleHRbaXNEYXJrID8gXCJkYXJrXCIgOiBcImxpZ2h0XCJdO1xuICAgIGNvbnN0IG11dGVkQ29sb3IgPSB0aGVtZUNvbmZpZy5tdXRlZFtpc0RhcmsgPyBcImRhcmtcIiA6IFwibGlnaHRcIl07XG4gICAgY29uc3QgYWNjZW50Q29sb3IgPSB0aGVtZUNvbmZpZy5hY2NlbnRbaXNEYXJrID8gXCJkYXJrXCIgOiBcImxpZ2h0XCJdO1xuICAgIGNvbnN0IGZvbnRGYW1pbHkgPSB0aGVtZUNvbmZpZy5mb250RmFtaWx5O1xuICAgIGNvbnN0IGNvbnRhaW5lclN0eWxlID0gdGhlbWVDb25maWcuY29udGFpbmVyU3R5bGUoaXNEYXJrKTtcblxuICAgIGNvbnN0IHRvdGFsRXZlbnRzID0gZXZlbnRzLmxlbmd0aDtcbiAgICBjb25zdCBFTlRSQU5DRV9FTkQgPSB0b3RhbEV2ZW50cyA8PSAzID8gMC4xNSA6IHRvdGFsRXZlbnRzIDw9IDYgPyAwLjEwIDogMC4wNztcbiAgICBjb25zdCBFWElUX0JVRkZFUiA9IDAuMDU7XG4gICAgY29uc3QgcHJvZ3Jlc3NSZW1haW5pbmcgPSAxIC0gRU5UUkFOQ0VfRU5EIC0gRVhJVF9CVUZGRVI7XG4gICAgY29uc3Qgc2xpY2VQZXJFdmVudCA9IHRvdGFsRXZlbnRzID4gMCA/IHByb2dyZXNzUmVtYWluaW5nIC8gdG90YWxFdmVudHMgOiAxO1xuXG4gICAgY29uc3QgdGl0bGVQcm9ncmVzcyA9IHN0ZC5pbnRlcnBvbGF0ZSh0aW1lbGluZS5wcm9ncmVzcywgWzAsIDAuMV0sIFswLCAxXSwgdGhlbWVFYXNpbmcpO1xuXG4gICAgY29uc3Qgc2lkZWJhcldpZHRoID0gaXNQb3J0cmFpdCA/IDgwIDogMTIwO1xuICAgIGNvbnN0IG1haW5QYWRkaW5nID0gaXNQb3J0cmFpdCA/IDQwIDogNjA7XG4gICAgY29uc3QgdGl0bGVGb250U2l6ZSA9IGlzUG9ydHJhaXQgPyAzNiA6IDQ4O1xuICAgIGNvbnN0IHN1YnRpdGxlRm9udFNpemUgPSBpc1BvcnRyYWl0ID8gMjAgOiAyNDtcbiAgICBjb25zdCBkYXRlRm9udFNpemUgPSBpc1BvcnRyYWl0ID8gMjQgOiAzMjtcbiAgICBjb25zdCBldmVudFRpdGxlRm9udFNpemUgPSBpc1BvcnRyYWl0ID8gNDggOiA2NDtcbiAgICBjb25zdCBkZXNjRm9udFNpemUgPSBpc1BvcnRyYWl0ID8gMjIgOiAyODtcbiAgICBjb25zdCBpbWFnZUhlaWdodCA9IGlzUG9ydHJhaXQgPyAyODAgOiAzNjA7XG5cbiAgICBjb25zdCBzaWRlYmFyTm9kZXNIdG1sID0gZXZlbnRzLm1hcCgoZXZlbnQ6IFRpbWVsaW5lRXZlbnQsIGk6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgZXZlbnRTdGFydCA9IEVOVFJBTkNFX0VORCArIGkgKiBzbGljZVBlckV2ZW50O1xuICAgICAgY29uc3QgZXZlbnRFbmQgPSBldmVudFN0YXJ0ICsgc2xpY2VQZXJFdmVudDtcbiAgICAgIGNvbnN0IGlzQWN0aXZlID0gdGltZWxpbmUucHJvZ3Jlc3MgPj0gZXZlbnRTdGFydCAmJiB0aW1lbGluZS5wcm9ncmVzcyA8IGV2ZW50RW5kO1xuICAgICAgY29uc3QgaXNQYXN0ID0gdGltZWxpbmUucHJvZ3Jlc3MgPj0gZXZlbnRFbmQ7XG5cbiAgICAgIGNvbnN0IG5vZGVCYXNlQ29sb3IgPSBpc1Bhc3QgPyBhY2NlbnRDb2xvciA6IChpc0RhcmsgPyBcIiMzMzMzMzNcIiA6IFwiI0RERERERFwiKTtcbiAgICAgIGxldCBjdXJyZW50U3R5bGUgPSBgYmFja2dyb3VuZDogJHtub2RlQmFzZUNvbG9yfTtgO1xuICAgICAgaWYgKGlzQWN0aXZlKSB7XG4gICAgICAgIGN1cnJlbnRTdHlsZSA9IHRoZW1lQ29uZmlnLm5vZGVBY3RpdmVTdHlsZShhY2NlbnRDb2xvciwgaXNEYXJrKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdHJ1bmNhdGVkRGF0ZSA9IGV2ZW50LmRhdGUubGVuZ3RoID4gNiA/IGV2ZW50LmRhdGUuc2xpY2UoMCwgNSkgKyBcIuKAplwiIDogZXZlbnQuZGF0ZTtcbiAgICAgIGNvbnN0IGxhYmVsT3BhY2l0eSA9IGlzQWN0aXZlID8gMSA6IGlzUGFzdCA/IDAuNyA6IDAuNDtcblxuICAgICAgcmV0dXJuIGBcbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyOyBmbGV4OiAxOyB6LWluZGV4OiAyO1wiPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJ3aWR0aDogJHtpc1BvcnRyYWl0ID8gMTIgOiAxNn1weDsgaGVpZ2h0OiAke2lzUG9ydHJhaXQgPyAxMiA6IDE2fXB4OyBib3JkZXItcmFkaXVzOiA1MCU7ICR7Y3VycmVudFN0eWxlfSB6LWluZGV4OiAyO1wiPjwvZGl2PlxuICAgICAgICAgIDxzcGFuIHN0eWxlPVwiZm9udC1zaXplOiAke2lzUG9ydHJhaXQgPyA4IDogMTB9cHg7IGNvbG9yOiAke211dGVkQ29sb3J9OyBtYXJnaW4tdG9wOiA0cHg7IG9wYWNpdHk6ICR7bGFiZWxPcGFjaXR5fTsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgdGV4dC1hbGlnbjogY2VudGVyO1wiPiR7dHJ1bmNhdGVkRGF0ZX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYDtcbiAgICB9KS5qb2luKFwiXCIpO1xuXG4gICAgY29uc3QgYWN0aXZlTm9kZUluZGV4ID0gZXZlbnRzLmZpbmRJbmRleCgoXzogVGltZWxpbmVFdmVudCwgaTogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCBzdGFydCA9IEVOVFJBTkNFX0VORCArIGkgKiBzbGljZVBlckV2ZW50O1xuICAgICAgY29uc3QgZW5kID0gc3RhcnQgKyBzbGljZVBlckV2ZW50O1xuICAgICAgcmV0dXJuIHRpbWVsaW5lLnByb2dyZXNzID49IHN0YXJ0ICYmIHRpbWVsaW5lLnByb2dyZXNzIDwgZW5kO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZGlzcGxheUluZGV4ID0gYWN0aXZlTm9kZUluZGV4ID09PSAtMSA/ICh0aW1lbGluZS5wcm9ncmVzcyA+IDAuNSA/IHRvdGFsRXZlbnRzIC0gMSA6IDApIDogYWN0aXZlTm9kZUluZGV4O1xuXG4gICAgY29uc3QgZmlsbFBlcmNlbnQgPSB0aW1lbGluZS5wcm9ncmVzcyA8IEVOVFJBTkNFX0VORFxuICAgICAgPyAwXG4gICAgICA6IE1hdGgubWluKDEwMCwgKCh0aW1lbGluZS5wcm9ncmVzcyAtIEVOVFJBTkNFX0VORCkgLyBwcm9ncmVzc1JlbWFpbmluZykgKiAxMDApO1xuXG4gICAgbGV0IGV2ZW50Q29udGVudEh0bWwgPSBcIlwiO1xuICAgIGlmICh0b3RhbEV2ZW50cyA+IDAgJiYgZGlzcGxheUluZGV4ID49IDApIHtcbiAgICAgIGNvbnN0IGUgPSBldmVudHNbZGlzcGxheUluZGV4XSE7XG4gICAgICBjb25zdCBzdGFydCA9IEVOVFJBTkNFX0VORCArIGRpc3BsYXlJbmRleCAqIHNsaWNlUGVyRXZlbnQ7XG5cbiAgICAgIGNvbnN0IGxwID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgKHRpbWVsaW5lLnByb2dyZXNzIC0gc3RhcnQpIC8gc2xpY2VQZXJFdmVudCkpO1xuXG4gICAgICBjb25zdCBJTl9EVVIgPSAwLjE1O1xuICAgICAgY29uc3QgT1VUX0RVUiA9IDAuMTU7XG5cbiAgICAgIGNvbnN0IGVudGVyUCA9IHN0ZC5pbnRlcnBvbGF0ZShscCwgWzAsIElOX0RVUl0sIFswLCAxXSwgdGhlbWVFYXNpbmcpO1xuICAgICAgY29uc3QgZXhpdFAgPSBzdGQuaW50ZXJwb2xhdGUobHAsIFsxIC0gT1VUX0RVUiwgMV0sIFswLCAxXSwgXCJlYXNlSW5DdWJpY1wiKTtcbiAgICAgIGNvbnN0IG9wYWNpdHkgPSBlbnRlclAgKiAoMSAtIGV4aXRQKTtcbiAgICAgIGNvbnN0IHlPZmZzZXQgPSAoMSAtIGVudGVyUCkgKiA0MCAtIGV4aXRQICogNDA7XG5cbiAgICAgIGNvbnN0IGV2ZW50QWNjZW50ID0gZS5hY2NlbnRDb2xvciB8fCBhY2NlbnRDb2xvcjtcblxuICAgICAgY29uc3QgaW1hZ2VGaWx0ZXIgPSB0aGVtZUNvbmZpZy5pbWFnZUZpbHRlciB8fCBcIlwiO1xuICAgICAgY29uc3QgcGxheWZ1bEJvcmRlciA9IHRoZW1lID09PSBcInBsYXlmdWxcIiA/IGBib3JkZXI6IDRweCBzb2xpZCAke3RleHRDb2xvcn07YCA6IFwiXCI7XG4gICAgICBjb25zdCBpbWFnZUh0bWwgPSBlLmltYWdlVXJsID8gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogJHtpc1BvcnRyYWl0ID8gMjQgOiAzMn1weDsgd2lkdGg6IDEwMCU7IGhlaWdodDogJHtpbWFnZUhlaWdodH1weDsgYm9yZGVyLXJhZGl1czogMTZweDsgYmFja2dyb3VuZDogdXJsKCcke2UuaW1hZ2VVcmx9JykgY2VudGVyL2NvdmVyOyAke3BsYXlmdWxCb3JkZXJ9ICR7aW1hZ2VGaWx0ZXJ9XCI+PC9kaXY+XG4gICAgICBgIDogXCJcIjtcblxuICAgICAgZXZlbnRDb250ZW50SHRtbCA9IGBcbiAgICAgICAgPGRpdiBzdHlsZT1cIm9wYWNpdHk6ICR7b3BhY2l0eX07IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgke3lPZmZzZXR9cHgpOyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBoZWlnaHQ6IDEwMCU7IGp1c3RpZnktY29udGVudDogY2VudGVyO1wiPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6ICR7ZGF0ZUZvbnRTaXplfXB4OyBmb250LXdlaWdodDogNzAwOyBjb2xvcjogJHtldmVudEFjY2VudH07IG1hcmdpbi1ib3R0b206IDhweDsgbGV0dGVyLXNwYWNpbmc6IDJweDtcIj5cbiAgICAgICAgICAgICR7ZS5kYXRlLnRvVXBwZXJDYXNlKCl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZTogJHtldmVudFRpdGxlRm9udFNpemV9cHg7IGZvbnQtd2VpZ2h0OiA4MDA7IGNvbG9yOiAke3RleHRDb2xvcn07IGxpbmUtaGVpZ2h0OiAxLjE7IG1hcmdpbi1ib3R0b206IDI0cHg7XCI+XG4gICAgICAgICAgICAke2UuaWNvbiA/IGA8c3BhbiBzdHlsZT1cIm1hcmdpbi1yaWdodDogMTZweDtcIj4ke2UuaWNvbn08L3NwYW4+YCA6IFwiXCJ9JHtlLnRpdGxlfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICR7ZS5kZXNjcmlwdGlvbiA/IGA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiAke2Rlc2NGb250U2l6ZX1weDsgbGluZS1oZWlnaHQ6IDEuNTsgY29sb3I6ICR7bXV0ZWRDb2xvcn07IGZvbnQtd2VpZ2h0OiAke3RoZW1lID09PSBcInRlY2hcIiA/IFwiNDAwXCIgOiBcIjUwMFwifTtcIj4ke2UuZGVzY3JpcHRpb259PC9kaXY+YCA6IFwiXCJ9XG4gICAgICAgICAgJHtpbWFnZUh0bWx9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWFpbkxheW91dE9wYWNpdHkgPSBzdGQuaW50ZXJwb2xhdGUoc3RkLmNsYW1wMDEoKHRpdGxlUHJvZ3Jlc3MgLSAwLjgpIC8gMC4yKSwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuXG4gICAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXYgc3R5bGU9XCJ3aWR0aDogJHt3aWR0aH1weDsgaGVpZ2h0OiAke2hlaWdodH1weDsgYmFja2dyb3VuZDogJHtiZ0NvbG9yfTsgZm9udC1mYW1pbHk6ICR7Zm9udEZhbWlseX07IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IG92ZXJmbG93OiBoaWRkZW47IHBhZGRpbmc6ICR7bWFpblBhZGRpbmd9cHg7XCI+ICAgICAgPGRpdiBzdHlsZT1cIm9wYWNpdHk6ICR7dGl0bGVQcm9ncmVzc307IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgkezMwICogKDEgLSB0aXRsZVByb2dyZXNzKX1weCk7IG1hcmdpbi1ib3R0b206ICR7aXNQb3J0cmFpdCA/IDI0IDogNDB9cHg7XCI+XG4gICAgICAgIDxoMSBzdHlsZT1cImNvbG9yOiAke3RleHRDb2xvcn07IGZvbnQtc2l6ZTogJHt0aXRsZUZvbnRTaXplfXB4OyBtYXJnaW46IDA7IGZvbnQtd2VpZ2h0OiA4MDA7IGxldHRlci1zcGFjaW5nOiAtMXB4O1wiPiR7dGl0bGV9PC9oMT5cbiAgICAgICAgJHtzdWJ0aXRsZSA/IGA8aDIgc3R5bGU9XCJjb2xvcjogJHttdXRlZENvbG9yfTsgZm9udC1zaXplOiAke3N1YnRpdGxlRm9udFNpemV9cHg7IG1hcmdpbjogOHB4IDAgMCAwOyBmb250LXdlaWdodDogNTAwO1wiPiR7c3VidGl0bGV9PC9oMj5gIDogXCJcIn1cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgZmxleDogMTsgaGVpZ2h0OiAxMDAlOyBvcGFjaXR5OiAke21haW5MYXlvdXRPcGFjaXR5fTtcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiAke3NpZGViYXJXaWR0aH1weDsgcG9zaXRpb246IHJlbGF0aXZlOyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IHBhZGRpbmc6IDIwcHggMDtcIj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246IGFic29sdXRlOyBsZWZ0OiA1MCU7IHRvcDogMjBweDsgYm90dG9tOiAyMHB4OyB3aWR0aDogNHB4OyBiYWNrZ3JvdW5kOiAke2lzRGFyayA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIgOiBcInJnYmEoMCwwLDAsMC4xKVwifTsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpOyBib3JkZXItcmFkaXVzOiAycHg7XCI+PC9kaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDogNTAlOyB0b3A6IDIwcHg7IGhlaWdodDogJHtmaWxsUGVyY2VudH0lOyB3aWR0aDogNHB4OyBiYWNrZ3JvdW5kOiAke2FjY2VudENvbG9yfTsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpOyBib3JkZXItcmFkaXVzOiAycHg7XCI+PC9kaXY+XG4gICAgICAgICAgJHtzaWRlYmFyTm9kZXNIdG1sfVxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IHN0eWxlPVwiZmxleDogMTsgcGFkZGluZy1sZWZ0OiAke2lzUG9ydHJhaXQgPyAyNCA6IDQwfXB4OyAke2NvbnRhaW5lclN0eWxlfSBib3JkZXItcmFkaXVzOiAyNHB4OyBwYWRkaW5nOiAke2lzUG9ydHJhaXQgPyAyNCA6IDQwfXB4OyBwb3NpdGlvbjogcmVsYXRpdmU7XCI+XG4gICAgICAgICAgJHtldmVudENvbnRlbnRIdG1sfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgO1xuICB9LFxufSk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJBLFNBQVMsT0FBTyxPQUFPO0VBQ3RCLE1BQU0sU0FBUyxNQUFNLFVBQVU7RUFDL0IsTUFBTSxJQUFJLE1BQU07RUFDaEIsTUFBTSxhQUFhLE9BQU8sTUFBTSxZQUFZO0VBQzVDLE9BQU87R0FDTjtHQUNBLFVBQVUsQ0FBQyxDQUFDLEtBQUssT0FBTyxFQUFFLFFBQVEsYUFBYSxFQUFFLFlBQVksUUFBUTtHQUNyRSxRQUFRLE1BQU07R0FDZCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsYUFBYSxFQUFFLFNBQVMsTUFBTSxRQUFRLElBQUksQ0FBQztFQUMvQztDQUNEOzs7Ozs7Ozs7Ozs7Ozs7OztDQ1JBLE1BQU0sU0FBNkM7RUFDakQsWUFBWTtHQUNWLElBQUk7SUFBRSxNQUFNO0lBQVcsT0FBTztHQUFVO0dBQ3hDLE1BQU07SUFBRSxNQUFNO0lBQVcsT0FBTztHQUFVO0dBQzFDLE9BQU87SUFBRSxNQUFNO0lBQVcsT0FBTztHQUFVO0dBQzNDLFFBQVE7SUFBRSxNQUFNO0lBQVcsT0FBTztHQUFVO0dBQzVDLFlBQVk7R0FDWixrQkFBa0IsV0FBVyxlQUFlLE9BQU87R0FDbkQsc0JBQXNCO0dBQ3RCLFFBQVE7RUFDVjtFQUNBLE1BQU07R0FDSixJQUFJO0lBQUUsTUFBTTtJQUFXLE9BQU87R0FBVTtHQUN4QyxNQUFNO0lBQUUsTUFBTTtJQUFXLE9BQU87R0FBVTtHQUMxQyxPQUFPO0lBQUUsTUFBTTtJQUFXLE9BQU87R0FBVTtHQUMzQyxRQUFRO0lBQUUsTUFBTTtJQUFXLE9B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