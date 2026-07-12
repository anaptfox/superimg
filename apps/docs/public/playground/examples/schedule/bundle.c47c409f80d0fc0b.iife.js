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
	//#region examples/data/schedule/schedule.media.ts
	const DAYS = [
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri"
	];
	const HOURS = [
		9,
		10,
		11,
		12,
		13,
		14,
		15,
		16
	];
	const COLORS = {
		deep: {
			bg: "#3b82f6",
			border: "#2563eb"
		},
		meeting: {
			bg: "#f59e0b",
			border: "#d97706"
		}
	};
	//#endregion
	exports.default = define({
		sample: {
			schedule: {
				Mon: [{
					start: 9,
					duration: 2,
					type: "deep",
					label: "Deep work"
				}, {
					start: 14,
					duration: 1,
					type: "meeting",
					label: "Standup"
				}],
				Tue: [{
					start: 14,
					duration: 1,
					type: "meeting",
					label: "Code review"
				}],
				Wed: [{
					start: 11,
					duration: 2,
					type: "deep",
					label: "Sprint planning"
				}, {
					start: 15,
					duration: 1,
					type: "meeting",
					label: "1:1"
				}],
				Thu: [{
					start: 10,
					duration: 3,
					type: "deep",
					label: "Feature build"
				}],
				Fri: [{
					start: 13,
					duration: 2,
					type: "meeting",
					label: "Demo day"
				}]
			},
			theme: "dark"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "6s",
			fonts: ["Inter:wght@400;500;600"],
			inlineCss: [`* { margin: 0; padding: 0; box-sizing: border-box; }`]
		},
		render(ctx) {
			const { std, width, height, data } = ctx;
			const { schedule, theme } = data;
			const t = ctx.director({
				enter: "55%",
				hold: "35%",
				exit: "10%"
			});
			const bgColor = theme === "dark" ? "#0f172a" : "#f8fafc";
			const textColor = theme === "dark" ? "#e2e8f0" : "#334155";
			const mutedColor = theme === "dark" ? "#64748b" : "#94a3b8";
			const lineColor = theme === "dark" ? "rgba(148, 163, 184, 0.12)" : "rgba(71, 85, 105, 0.12)";
			const padding = 48;
			const labelWidth = 64;
			const headerHeight = 56;
			const gridWidth = width - padding * 2 - labelWidth;
			const gridHeight = height - padding * 2 - headerHeight - 72;
			const colWidth = gridWidth / DAYS.length;
			const rowHeight = gridHeight / HOURS.length;
			const daysHtml = DAYS.map((day, i) => {
				return `<div style="width: ${colWidth}px; text-align: center; color: ${textColor}; font-weight: 600; font-size: 17px; opacity: ${t.tween(0, 1, {
					during: "enter",
					at: `${((.04 + i * .035) * 100).toFixed(1)}%`,
					for: "14%",
					easing: "easeOutCubic"
				})};">${day}</div>`;
			}).join("");
			const hoursHtml = HOURS.map((hour, i) => {
				return `<div style="height: ${rowHeight}px; color: ${mutedColor}; font-size: 13px; display: flex; align-items: center; opacity: ${t.tween(0, 1, {
					during: "enter",
					at: `${((.08 + i * .025) * 100).toFixed(1)}%`,
					for: "12%",
					easing: "easeOutCubic"
				})};">${hour}:00</div>`;
			}).join("");
			const gridLinesH = HOURS.map((_, i) => `<div style="position: absolute; top: ${i * rowHeight}px; left: 0; right: 0; height: 1px; background: ${lineColor};"></div>`).join("");
			const gridLinesV = DAYS.map((_, i) => `<div style="position: absolute; left: ${i * colWidth}px; top: 0; bottom: 0; width: 1px; background: ${lineColor};"></div>`).join("");
			let blockIndex = 0;
			const blocksHtml = DAYS.map((day, dayIndex) => {
				return (schedule[day] || []).map((block) => {
					const i = blockIndex++;
					const blockP = t.tween(0, 1, {
						during: "enter",
						at: `${((.22 + i * .06) * 100).toFixed(1)}%`,
						for: "20%",
						easing: "easeOutCubic"
					});
					const x = dayIndex * colWidth + 6;
					const y = (block.start - (HOURS[0] ?? 9)) * rowHeight + 6;
					const blockHeight = block.duration * rowHeight - 12;
					const blockWidth = colWidth - 12;
					const color = COLORS[block.type] ?? COLORS.deep;
					return `
          <div style="
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${blockWidth}px;
            height: ${blockHeight * blockP}px;
            background: ${color.bg};
            border-left: 3px solid ${color.border};
            border-radius: 6px;
            opacity: ${blockP};
            overflow: hidden;
            box-shadow: 0 4px 12px ${std.color.alpha(color.bg, .35)};
          ">
            <div style="padding: 10px; color: white; font-size: 13px; font-weight: 500;">${block.label}</div>
          </div>
        `;
				}).join("");
			}).join("");
			const legendOpacity = t.tween(0, 1, {
				during: "enter",
				at: "42%",
				for: "18%",
				easing: "easeOutCubic"
			});
			const titleOpacity = t.tween(0, 1, {
				during: "enter",
				at: "0%",
				for: "20%",
				easing: "easeOutCubic"
			});
			return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: ${bgColor};
      font-family: 'Inter', system-ui, sans-serif;
      padding: ${padding}px;
      box-sizing: border-box;
      opacity: ${1 - t.tween(0, 1, {
				during: "exit",
				easing: "easeInCubic"
			})};
    ">
      <div style="margin-bottom: 20px; margin-left: ${labelWidth}px; opacity: ${titleOpacity};">
        <div style="font-size: 28px; font-weight: 600; color: ${textColor}; letter-spacing: -0.02em;">Weekly schedule</div>
        <div style="font-size: 15px; color: ${mutedColor}; margin-top: 4px;">Deep work blocks vs meetings</div>
      </div>

      <div style="display: flex; margin-left: ${labelWidth}px; margin-bottom: 12px;">
        ${daysHtml}
      </div>

      <div style="display: flex; position: relative;">
        <div style="width: ${labelWidth}px;">
          ${hoursHtml}
        </div>

        <div style="position: relative; width: ${gridWidth}px; height: ${gridHeight}px; border-radius: 8px; background: ${theme === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"};">
          ${gridLinesH}
          ${gridLinesV}
          ${blocksHtml}
        </div>
      </div>

      <div style="display: flex; gap: 28px; margin-top: 24px; margin-left: ${labelWidth}px; opacity: ${legendOpacity};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 14px; height: 14px; background: #3b82f6; border-radius: 4px;"></div>
          <span style="color: ${textColor}; font-size: 14px;">Deep work</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 14px; height: 14px; background: #f59e0b; border-radius: 4px;"></div>
          <span style="color: ${textColor}; font-size: 14px;">Meetings</span>
        </div>
      </div>
    </div>
  `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZWR1bGUubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2RhdGEvc2NoZWR1bGUvc2NoZWR1bGUubWVkaWEudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy9qc29uLnRzXG4vLyEgU2VyaWFsaXphYmxlIEpTT04tc2hhcGVkIHZhbHVlcyBmb3IgdGVtcGxhdGUgZGF0YSBkZWZhdWx0cyBhbmQgQ0xJIGxvYWRlcnMuXG5mdW5jdGlvbiBpc0pzb25PYmplY3QodmFsdWUpIHtcblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvdHlwZXMudHNcbi8vISBTdXBlckltZyBUeXBlcyAtIENvcmUgdHlwZSBkZWZpbml0aW9uc1xuLy8hIEV4cGxpY2l0LCB0eXBlZCwgc2VsZi1kb2N1bWVudGluZyBpbnRlcmZhY2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vKipcbiogRGVmaW5lIGEgcHJvamVjdC9mb2xkZXIgY29uZmlnIGZvciBfY29uZmlnLnRzIGZpbGVzLlxuKiBQcm92aWRlcyB0eXBlIGluZmVyZW5jZSBhbmQgdmFsaWRhdGlvbi5cbiovXG5mdW5jdGlvbiBkZWZpbmVDb25maWcoY29uZmlnKSB7XG5cdHJldHVybiBjb25maWc7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvZGVmaW5lLnRzXG4vLyEgVGhlIHVuaWZpZWQgYGRlZmluZSgpYCB0ZW1wbGF0ZSBmYWN0b3J5LlxuLy8hXG4vLyEgVW5pZmllZCB0ZW1wbGF0ZSBmYWN0b3J5IOKAlCBvbmUgYGRlZmluZSgpYCBmb3IgYWxsIG91dHB1dCBraW5kcy5cbi8vISBUaHJlZSBvcnRob2dvbmFsIGF4ZXMgc2VsZWN0IGJlaGF2aW91cjpcbi8vISAgLSBtZWRpdW06ICAgXCJodG1sXCIgKENocm9taXVtKSB8IFwic3ZnXCIgKHJlc3ZnLXdhc20sIGJyb3dzZXItZnJlZSwgZWRnZSkuXG4vLyEgIC0gYW5pbWF0ZWQ6IGluZmVycmVkIGZyb20gdGhlIGNvbmZpZyDigJQgdHJ1ZSBpZmYgaXQgZGVjbGFyZXMgZnBzIEFORFxuLy8hICAgICAgICAgICAgICAoZHVyYXRpb24gT1IgYSBgcmVzb2x2ZWAgaG9vayB0aGF0IHdpbGwgc3VwcGx5IGR1cmF0aW9uKS5cbi8vISAgLSBzaW5rOiAgICAgY2hvc2VuIGxhdGVyIChjb25maWcub3V0cHV0cyAvIENMSSAvIGBhc2ApLCBub3QgYXQgYXV0aG9yaW5nIHRpbWUuXG4vLyFcbi8vISBUeXBlU2NyaXB0IG5hcnJvd3MgYGN0eGAgdG8gdGhlIHJpZ2h0IHZhcmlhbnQgYXQgdGhlIGNhbGwgc2l0ZSB2aWEgb3ZlcmxvYWRzOlxuLy8hIG1lZGl1bSBwaWNrcyB0aGUgc3RkbGliIGZsYXZvdXIsIGFuaW1hdGVkIGFkZHMgdGhlIHRlbXBvcmFsIGZpZWxkcyArIGhlbHBlcnMuXG5mdW5jdGlvbiBkZWZpbmUoaW5wdXQpIHtcblx0Y29uc3QgbWVkaXVtID0gaW5wdXQubWVkaXVtID8/IFwiaHRtbFwiO1xuXHRjb25zdCBjID0gaW5wdXQuY29uZmlnO1xuXHRjb25zdCBoYXNSZXNvbHZlID0gdHlwZW9mIGlucHV0LnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIjtcblx0cmV0dXJuIHtcblx0XHRtZWRpdW0sXG5cdFx0YW5pbWF0ZWQ6ICEhYyAmJiB0eXBlb2YgYy5mcHMgPT09IFwibnVtYmVyXCIgJiYgKGMuZHVyYXRpb24gIT0gbnVsbCB8fCBoYXNSZXNvbHZlKSxcblx0XHRyZW5kZXI6IGlucHV0LnJlbmRlcixcblx0XHQuLi5pbnB1dC5jb25maWcgIT09IHZvaWQgMCA/IHsgY29uZmlnOiBpbnB1dC5jb25maWcgfSA6IHt9LFxuXHRcdC4uLmlucHV0LnNhbXBsZSAhPT0gdm9pZCAwID8geyBzYW1wbGU6IGlucHV0LnNhbXBsZSB9IDoge30sXG5cdFx0Li4uaGFzUmVzb2x2ZSA/IHsgcmVzb2x2ZTogaW5wdXQucmVzb2x2ZSB9IDoge31cblx0fTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gYW5pbWF0ZWQgKGZwcyArIGR1cmF0aW9uIGF0IGF1dGhvcmluZyB0aW1lKS4gKi9cbmZ1bmN0aW9uIGlzQW5pbWF0ZWRUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IHRydWU7XG59XG4vKiogTmFycm93IGEgdGVtcGxhdGUgbW9kdWxlIHRvIHN0YXRpYyAoc3RpbGwgLyBzaW5nbGUtZnJhbWUpLiAqL1xuZnVuY3Rpb24gaXNTdGF0aWNUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IGZhbHNlO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3Jlc3VsdHMudHNcbi8vISBSZXN1bHQgdHlwZXMgYW5kIHN0cnVjdHVyZWQgZXJyb3JzXG4vLyEgRGlzY3JpbWluYXRlZCB1bmlvbnMgZm9yIGFzeW5jIG9wZXJhdGlvbnMgd2l0aCBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2VzXG4vKipcbiogQmFzZSBlcnJvciBjbGFzcyBmb3IgYWxsIFN1cGVySW1nIGVycm9yc1xuKi9cbnZhciBTdXBlckltZ0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG5cdGNvZGU7XG5cdGRldGFpbHM7XG5cdHN1Z2dlc3Rpb247XG5cdGRvY3NVcmw7XG5cdC8qKiBNYXBwZWQgc291cmNlIGxvY2F0aW9uIChwb3B1bGF0ZWQgYnkgZW5yaWNoRXJyb3Igd2hlbiBzb3VyY2VtYXAgYXZhaWxhYmxlKSAqL1xuXHRsb2NhdGlvbjtcblx0LyoqIFZpdGUtc3R5bGUgY29kZSBmcmFtZSBzdHJpbmcgKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZSBjb250ZW50IGF2YWlsYWJsZSkgKi9cblx0Y29kZUZyYW1lO1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlLCBjb2RlLCBkZXRhaWxzLCBzdWdnZXN0aW9uLCBkb2NzVXJsKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5jb2RlID0gY29kZTtcblx0XHR0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuXHRcdHRoaXMuc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb247XG5cdFx0dGhpcy5kb2NzVXJsID0gZG9jc1VybDtcblx0XHR0aGlzLm5hbWUgPSBcIlN1cGVySW1nRXJyb3JcIjtcblx0XHRjb25zdCBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlO1xuXHRcdGlmIChjYXB0dXJlU3RhY2tUcmFjZSkgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdH1cblx0LyoqIENvbnZlcnQgdG8gYSBwbGFpbiBvYmplY3QgZm9yIGxvZ2dpbmcvc2VyaWFsaXphdGlvbiAqL1xuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdGNvZGU6IHRoaXMuY29kZSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMubWVzc2FnZSxcblx0XHRcdGRldGFpbHM6IHRoaXMuZGV0YWlscyxcblx0XHRcdHN1Z2dlc3Rpb246IHRoaXMuc3VnZ2VzdGlvbixcblx0XHRcdC4uLnRoaXMuZG9jc1VybCAhPT0gdm9pZCAwID8geyBkb2NzVXJsOiB0aGlzLmRvY3NVcmwgfSA6IHt9LFxuXHRcdFx0Li4udGhpcy5sb2NhdGlvbiAhPT0gdm9pZCAwID8geyBsb2NhdGlvbjogdGhpcy5sb2NhdGlvbiB9IDoge30sXG5cdFx0XHQuLi50aGlzLmNvZGVGcmFtZSAhPT0gdm9pZCAwID8geyBjb2RlRnJhbWU6IHRoaXMuY29kZUZyYW1lIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkXG4qL1xudmFyIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IGRldGFpbHMubGluZSA/IGAgYXQgbGluZSAke2RldGFpbHMubGluZX1gIDogXCJcIjtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBDaGVjayB0aGUgdGVtcGxhdGUgc3ludGF4JHtsb2NhdGlvbn0uIEVuc3VyZSB0aGUgcmVuZGVyIGZ1bmN0aW9uIHJldHVybnMgYSBzdHJpbmcuYDtcblx0XHRzdXBlcihgVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkJHtsb2NhdGlvbn06ICR7ZGV0YWlscy5zeW50YXhFcnJvcn1gLCBcIlRFTVBMQVRFX0NPTVBJTEFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlQ29tcGlsYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgdGhyZXcgYW4gZXJyb3IgZHVyaW5nIHJlbmRlclxuKi9cbnZhciBUZW1wbGF0ZVJ1bnRpbWVFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCB0aW1lSW5mbyA9IGRldGFpbHMudGltZUNvbnRleHQgPyBgICgke2RldGFpbHMudGltZUNvbnRleHQudGltZWxpbmVTZWNvbmRzLnRvRml4ZWQoMyl9cywgJHsoZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVByb2dyZXNzICogMTAwKS50b0ZpeGVkKDEpfSUgcHJvZ3Jlc3MpYCA6IFwiXCI7XG5cdFx0c3VwZXIoYFRlbXBsYXRlIGVycm9yIGF0IGZyYW1lICR7ZGV0YWlscy5mcmFtZX0ke3RpbWVJbmZvfTogJHtkZXRhaWxzLm9yaWdpbmFsRXJyb3J9YCwgXCJURU1QTEFURV9SVU5USU1FX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBgVGhlIHJlbmRlciBmdW5jdGlvbiB0aHJldyBhbiBlcnJvci4gQ2hlY2sgdGhhdCBhbGwgZGF0YSBwcm9wZXJ0aWVzIGV4aXN0IGFuZCB2YWx1ZXMgYXJlbid0IE5hTi91bmRlZmluZWQgYXQgdGhpcyBwb2ludCBpbiB0aGUgdGltZWxpbmUuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlcyNkZWJ1Z2dpbmdcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJUZW1wbGF0ZVJ1bnRpbWVFcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogRGF0YSB2YWxpZGF0aW9uIGZhaWxlZFxuKi9cbnZhciBWYWxpZGF0aW9uRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBgRXhwZWN0ZWQgJHtkZXRhaWxzLmV4cGVjdGVkVHlwZX0gYnV0IHJlY2VpdmVkICR7dHlwZW9mIGRldGFpbHMucmVjZWl2ZWRWYWx1ZX0uIENoZWNrIHlvdXIgZGF0YSBvYmplY3QuYDtcblx0XHRzdXBlcihgVmFsaWRhdGlvbiBmYWlsZWQgZm9yIGZpZWxkIFwiJHtkZXRhaWxzLmZpZWxkfVwiYCwgXCJWQUxJREFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlZhbGlkYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogUmVuZGVyIGZhaWxlZCAoZW5jb2RpbmcsIGJyb3dzZXIsIGV0Yy4pXG4qL1xudmFyIFJlbmRlckVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gZGV0YWlscy5odG1sRXJyb3IgPyBgVGhlIHRlbXBsYXRlIHJldHVybmVkIGludmFsaWQgSFRNTC4gQ2hlY2sgeW91ciByZW5kZXIgZnVuY3Rpb24gb3V0cHV0LmAgOiBkZXRhaWxzLmVuY29kZXJFcnJvciA/IGBFbmNvZGVyIGVycm9yLiBUcnkgcmVkdWNpbmcgcmVzb2x1dGlvbiBvciBjaGFuZ2luZyBjb2RlYy5gIDogYEJyb3dzZXIgZXJyb3IuIENoZWNrIGZvciBicm93c2VyIGNvbXBhdGliaWxpdHkgaXNzdWVzLmA7XG5cdFx0c3VwZXIoYFJlbmRlciBmYWlsZWQgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfWAsIFwiUkVOREVSX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlJlbmRlckVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBGaWxlIEkvTyBlcnJvclxuKi9cbnZhciBJT0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdHN1cGVyKGBGYWlsZWQgdG8gJHtkZXRhaWxzLm9wZXJhdGlvbn0gZmlsZTogJHtkZXRhaWxzLnBhdGh9YCwgXCJJT19FUlJPUlwiLCBkZXRhaWxzLCBkZXRhaWxzLm9wZXJhdGlvbiA9PT0gXCJ3cml0ZVwiID8gYENoZWNrIHRoYXQgdGhlIGRpcmVjdG9yeSBleGlzdHMgYW5kIHlvdSBoYXZlIHdyaXRlIHBlcm1pc3Npb25zLmAgOiBgQ2hlY2sgdGhhdCB0aGUgZmlsZSBleGlzdHMgYW5kIHlvdSBoYXZlIHJlYWQgcGVybWlzc2lvbnMuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZyNpb1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIklPRXJyb3JcIjtcblx0fVxufTtcbi8qKlxuKiBQbGF5ZXIgbm90IHJlYWR5IGVycm9yXG4qL1xudmFyIFBsYXllck5vdFJlYWR5RXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihvcGVyYXRpb24pIHtcblx0XHRzdXBlcihgUGxheWVyIG5vdCByZWFkeSBmb3Igb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBcIlBMQVlFUl9OT1RfUkVBRFlcIiwgeyBvcGVyYXRpb24gfSwgYENhbGwgbG9hZCgpIGFuZCB3YWl0IGZvciBpdCB0byBjb21wbGV0ZSBiZWZvcmUgY2FsbGluZyAke29wZXJhdGlvbn0oKS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvcGxheWVyXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyTm90UmVhZHlFcnJvclwiO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3BsYXllci50c1xuLy8hIFBsYXllciB0eXBlcyAtIFVzZXItZmFjaW5nIG9wdGlvbnMsIGV2ZW50cywgYW5kIGlucHV0IHR5cGVzIGZvciB0aGUgYnJvd3NlciBwbGF5ZXJcbi8vISBJbXBsZW1lbnRhdGlvbiB0eXBlcyAoUGxheWVyU3RhdGUsIFBsYXllclN0b3JlLCBldGMuKSBsaXZlIGluIEBzdXBlcmltZy9wbGF5ZXJcbi8qKiBUeXBlIGd1YXJkIGZvciBDb21wb3NlZFRlbXBsYXRlICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIiAmJiBpbnB1dCAhPT0gbnVsbCAmJiBcInR5cGVcIiBpbiBpbnB1dCAmJiBpbnB1dC50eXBlID09PSBcImNvbXBvc2VkXCI7XG59XG4vKiogQGRlcHJlY2F0ZWQgVXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSAqL1xuY29uc3QgaXNBbnlDb21wb3NlZFRlbXBsYXRlID0gaXNDb21wb3NlZFRlbXBsYXRlO1xuLyoqIEBkZXByZWNhdGVkIFJlbW92ZWQg4oCUIHVzZSBpc0NvbXBvc2VkVGVtcGxhdGUgYW5kIGNoZWNrIG1lZGl1bSA9PT0gXCJzdmdcIiAqL1xuZnVuY3Rpb24gaXNDb21wb3NlZFN2Z1RlbXBsYXRlKGlucHV0KSB7XG5cdHJldHVybiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpICYmIGlucHV0Lm1lZGl1bSA9PT0gXCJzdmdcIjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9ldmVudHMudHNcbi8vISBUeXBlZCwgdmVyc2lvbmVkIGV2ZW50IGNvbnRyYWN0IGZvciBzdXBlcmltZyBidWlsZCBpbnRlZ3JhdGlvbnMuXG4vLyEgQm90aCBKUyBjb25zdW1lcnMgKHJlbmRlciB3cmFwcGVycykgYW5kIFJ1c3QgZGVzZXJpYWxpemVycyAoZS5nLiBndW1ibylcbi8vISBzaG91bGQga2V5IG9uIHRoZSBgdmAgZmllbGQgYmVmb3JlIHJlYWRpbmcgZXZlbnQtc3BlY2lmaWMgZmllbGRzLlxuLy8hIEJ1bXAgYHZgIG9uIGFueSBicmVha2luZyBmaWVsZCByZW5hbWUgb3IgcmVtb3ZhbDsgYWRkaXRpdmUgZmllbGRzIGFyZSBub24tYnJlYWtpbmcuXG5jb25zdCBSRU5ERVJfRVZFTlRfVkVSU0lPTiA9IDE7XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvYmF0Y2gtdHlwZXMudHNcbi8vISBTdXBlckltZyBCYXRjaCBUeXBlc1xuLy8hIENvLWxvY2F0ZWQgYGV4cG9ydCBjb25zdCBiYXRjaGAgY29udmVudGlvbiBmb3IgYnVpbGQtdGltZSBmYW4tb3V0LlxuLy8hIEEgdGVtcGxhdGUgbW9kdWxlIG9wdGlvbmFsbHkgZXhwb3J0cyBgYmF0Y2hgIChidWlsdCB3aXRoIGBkZWZpbmVCYXRjaGApIHRvXG4vLyEgZ2VuZXJhdGUgbWFueSBvdXRwdXRzIGZyb20gb25lIHRlbXBsYXRlIOKAlCBubyBzZXBhcmF0ZSBsb2FkZXIgZmlsZS5cbi8qKlxuKiBUeXBlIGEgY28tbG9jYXRlZCBgYmF0Y2hgIGV4cG9ydCBhZ2FpbnN0IGl0cyB0ZW1wbGF0ZS5cbipcbiogYFREYXRhYCBmbG93cyBmcm9tIHRoZSB0ZW1wbGF0ZSB2YWx1ZSDigJQgY2hhbmdlIHRoZSB0ZW1wbGF0ZSdzIGBzYW1wbGVgXG4qIHNoYXBlIGFuZCB0aGUgYGRhdGE6YCBzaXRlcyBiZWxvdyB0eXBlLWVycm9yLiBUaGUgdGVtcGxhdGUgYXJndW1lbnQgaXNcbiogaW5mZXJlbmNlLW9ubHk7IGF0IHJ1bnRpbWUgdGhlIHByb3ZpZGVyIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbipcbiogUHV0IGFueSBzZXJ2ZXIvZGF0YSBpbXBvcnRzICppbnNpZGUqIHRoZSBwcm92aWRlciB3aXRoIGBhd2FpdCBpbXBvcnQoLi4uKWBcbiogc28gdGhlIGNsaWVudCBwbGF5ZXIgYnVuZGxlICh3aGljaCBpbXBvcnRzIHRoZSB0ZW1wbGF0ZSkgdHJlZS1zaGFrZXMgdGhlbSBvdXQuXG4qXG4qIEBleGFtcGxlXG4qIGBgYHR5cGVzY3JpcHRcbiogLy8gb2cubWVkaWEudHNcbiogaW1wb3J0IHsgZGVmaW5lLCBkZWZpbmVCYXRjaCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuKlxuKiBjb25zdCB0ZW1wbGF0ZSA9IGRlZmluZSh7IHNhbXBsZTogeyB0aXRsZTogXCJIaVwiIH0sIGNvbmZpZzogeyB3aWR0aDogMTIwMCwgaGVpZ2h0OiA2MzAgfSwgcmVuZGVyIH0pO1xuKiBleHBvcnQgZGVmYXVsdCB0ZW1wbGF0ZTtcbipcbiogZXhwb3J0IGNvbnN0IGJhdGNoID0gZGVmaW5lQmF0Y2godGVtcGxhdGUsIGFzeW5jICgpID0+IHtcbiogICBjb25zdCB7IGdldFBvc3RzIH0gPSBhd2FpdCBpbXBvcnQoXCIuLi9jb250ZW50XCIpO1xuKiAgIHJldHVybiAoYXdhaXQgZ2V0UG9zdHMoKSkubWFwKHAgPT4gKHsgc2x1ZzogcC5zbHVnLCBzYW1wbGU6IHsgdGl0bGU6IHAudGl0bGUgfSB9KSk7XG4qIH0pO1xuKiBgYGBcbiovXG5mdW5jdGlvbiBkZWZpbmVCYXRjaChfdGVtcGxhdGUsIHByb3ZpZGVyKSB7XG5cdHJldHVybiBwcm92aWRlcjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9pbmRleC50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gUHVyZSBUeXBlU2NyaXB0IHR5cGUgZGVmaW5pdGlvbnNcbi8vISBDb3JlIHR5cGVzLCBpbnRlcmZhY2VzLCBhbmQgZXJyb3IgY2xhc3NlcyBmb3IgdGVtcGxhdGVzLCByZW5kZXJpbmcsIGFuZCBwbGF5YmFja1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBJT0Vycm9yLCBQbGF5ZXJOb3RSZWFkeUVycm9yLCBSRU5ERVJfRVZFTlRfVkVSU0lPTiwgUmVuZGVyRXJyb3IsIFN1cGVySW1nRXJyb3IsIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciwgVGVtcGxhdGVSdW50aW1lRXJyb3IsIFZhbGlkYXRpb25FcnJvciwgZGVmaW5lLCBkZWZpbmVCYXRjaCwgZGVmaW5lQ29uZmlnLCBpc0FuaW1hdGVkVGVtcGxhdGUsIGlzQW55Q29tcG9zZWRUZW1wbGF0ZSwgaXNDb21wb3NlZFN2Z1RlbXBsYXRlLCBpc0NvbXBvc2VkVGVtcGxhdGUsIGlzSnNvbk9iamVjdCwgaXNTdGF0aWNUZW1wbGF0ZSB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgeyBkZWZpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjaGVkdWxlQmxvY2sge1xuICBzdGFydDogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xuICB0eXBlOiBcImRlZXBcIiB8IFwibWVldGluZ1wiO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNjaGVkdWxlVmlkZW9EYXRhIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBzY2hlZHVsZTogUmVjb3JkPHN0cmluZywgU2NoZWR1bGVCbG9ja1tdPjtcbiAgdGhlbWU6IFwiZGFya1wiIHwgXCJsaWdodFwiO1xufVxuXG5jb25zdCBEQVlTID0gW1wiTW9uXCIsIFwiVHVlXCIsIFwiV2VkXCIsIFwiVGh1XCIsIFwiRnJpXCJdO1xuY29uc3QgSE9VUlMgPSBbOSwgMTAsIDExLCAxMiwgMTMsIDE0LCAxNSwgMTZdO1xuXG5jb25zdCBDT0xPUlM6IFJlY29yZDxzdHJpbmcsIHsgYmc6IHN0cmluZzsgYm9yZGVyOiBzdHJpbmcgfT4gPSB7XG4gIGRlZXA6IHsgYmc6IFwiIzNiODJmNlwiLCBib3JkZXI6IFwiIzI1NjNlYlwiIH0sXG4gIG1lZXRpbmc6IHsgYmc6IFwiI2Y1OWUwYlwiLCBib3JkZXI6IFwiI2Q5NzcwNlwiIH0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmU8U2NoZWR1bGVWaWRlb0RhdGE+KHtcbiAgc2FtcGxlOiB7XG4gICAgc2NoZWR1bGU6IHtcbiAgICAgIE1vbjogW1xuICAgICAgICB7IHN0YXJ0OiA5LCBkdXJhdGlvbjogMiwgdHlwZTogXCJkZWVwXCIsIGxhYmVsOiBcIkRlZXAgd29ya1wiIH0sXG4gICAgICAgIHsgc3RhcnQ6IDE0LCBkdXJhdGlvbjogMSwgdHlwZTogXCJtZWV0aW5nXCIsIGxhYmVsOiBcIlN0YW5kdXBcIiB9LFxuICAgICAgXSxcbiAgICAgIFR1ZTogW3sgc3RhcnQ6IDE0LCBkdXJhdGlvbjogMSwgdHlwZTogXCJtZWV0aW5nXCIsIGxhYmVsOiBcIkNvZGUgcmV2aWV3XCIgfV0sXG4gICAgICBXZWQ6IFtcbiAgICAgICAgeyBzdGFydDogMTEsIGR1cmF0aW9uOiAyLCB0eXBlOiBcImRlZXBcIiwgbGFiZWw6IFwiU3ByaW50IHBsYW5uaW5nXCIgfSxcbiAgICAgICAgeyBzdGFydDogMTUsIGR1cmF0aW9uOiAxLCB0eXBlOiBcIm1lZXRpbmdcIiwgbGFiZWw6IFwiMToxXCIgfSxcbiAgICAgIF0sXG4gICAgICBUaHU6IFt7IHN0YXJ0OiAxMCwgZHVyYXRpb246IDMsIHR5cGU6IFwiZGVlcFwiLCBsYWJlbDogXCJGZWF0dXJlIGJ1aWxkXCIgfV0sXG4gICAgICBGcmk6IFt7IHN0YXJ0OiAxMywgZHVyYXRpb246IDIsIHR5cGU6IFwibWVldGluZ1wiLCBsYWJlbDogXCJEZW1vIGRheVwiIH1dLFxuICAgIH0sXG4gICAgdGhlbWU6IFwiZGFya1wiLFxuICB9LFxuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCI2c1wiLFxuICAgIGZvbnRzOiBbXCJJbnRlcjp3Z2h0QDQwMDs1MDA7NjAwXCJdLFxuICAgIGlubGluZUNzczogW2AqIHsgbWFyZ2luOiAwOyBwYWRkaW5nOiAwOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9YF0sXG4gIH0sXG4gIHJlbmRlcihjdHg6IFJlbmRlckNvbnRleHQ8U2NoZWR1bGVWaWRlb0RhdGE+KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIGRhdGEgfSA9IGN0eDtcbiAgICBjb25zdCB7IHNjaGVkdWxlLCB0aGVtZSB9ID0gZGF0YTtcblxuICAgIGNvbnN0IHQgPSBjdHguZGlyZWN0b3IoeyBlbnRlcjogXCI1NSVcIiwgaG9sZDogXCIzNSVcIiwgZXhpdDogXCIxMCVcIiB9KTtcblxuICAgIGNvbnN0IGJnQ29sb3IgPSB0aGVtZSA9PT0gXCJkYXJrXCIgPyBcIiMwZjE3MmFcIiA6IFwiI2Y4ZmFmY1wiO1xuICAgIGNvbnN0IHRleHRDb2xvciA9IHRoZW1lID09PSBcImRhcmtcIiA/IFwiI2UyZThmMFwiIDogXCIjMzM0MTU1XCI7XG4gICAgY29uc3QgbXV0ZWRDb2xvciA9IHRoZW1lID09PSBcImRhcmtcIiA/IFwiIzY0NzQ4YlwiIDogXCIjOTRhM2I4XCI7XG4gICAgY29uc3QgbGluZUNvbG9yID0gdGhlbWUgPT09IFwiZGFya1wiID8gXCJyZ2JhKDE0OCwgMTYzLCAxODQsIDAuMTIpXCIgOiBcInJnYmEoNzEsIDg1LCAxMDUsIDAuMTIpXCI7XG5cbiAgICBjb25zdCBwYWRkaW5nID0gNDg7XG4gICAgY29uc3QgbGFiZWxXaWR0aCA9IDY0O1xuICAgIGNvbnN0IGhlYWRlckhlaWdodCA9IDU2O1xuICAgIGNvbnN0IGdyaWRXaWR0aCA9IHdpZHRoIC0gcGFkZGluZyAqIDIgLSBsYWJlbFdpZHRoO1xuICAgIGNvbnN0IGdyaWRIZWlnaHQgPSBoZWlnaHQgLSBwYWRkaW5nICogMiAtIGhlYWRlckhlaWdodCAtIDcyO1xuICAgIGNvbnN0IGNvbFdpZHRoID0gZ3JpZFdpZHRoIC8gREFZUy5sZW5ndGg7XG4gICAgY29uc3Qgcm93SGVpZ2h0ID0gZ3JpZEhlaWdodCAvIEhPVVJTLmxlbmd0aDtcblxuICAgIGNvbnN0IGRheXNIdG1sID0gREFZUy5tYXAoKGRheSwgaSkgPT4ge1xuICAgICAgY29uc3Qgb3BhY2l0eSA9IHQudHdlZW4oMCwgMSwgeyBkdXJpbmc6IFwiZW50ZXJcIiwgYXQ6IGAkeygoMC4wNCArIGkgKiAwLjAzNSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIGZvcjogXCIxNCVcIiwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pO1xuICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwid2lkdGg6ICR7Y29sV2lkdGh9cHg7IHRleHQtYWxpZ246IGNlbnRlcjsgY29sb3I6ICR7dGV4dENvbG9yfTsgZm9udC13ZWlnaHQ6IDYwMDsgZm9udC1zaXplOiAxN3B4OyBvcGFjaXR5OiAke29wYWNpdHl9O1wiPiR7ZGF5fTwvZGl2PmA7XG4gICAgfSkuam9pbihcIlwiKTtcblxuICAgIGNvbnN0IGhvdXJzSHRtbCA9IEhPVVJTLm1hcCgoaG91ciwgaSkgPT4ge1xuICAgICAgY29uc3Qgb3BhY2l0eSA9IHQudHdlZW4oMCwgMSwgeyBkdXJpbmc6IFwiZW50ZXJcIiwgYXQ6IGAkeygoMC4wOCArIGkgKiAwLjAyNSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIGZvcjogXCIxMiVcIiwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pO1xuICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwiaGVpZ2h0OiAke3Jvd0hlaWdodH1weDsgY29sb3I6ICR7bXV0ZWRDb2xvcn07IGZvbnQtc2l6ZTogMTNweDsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgb3BhY2l0eTogJHtvcGFjaXR5fTtcIj4ke2hvdXJ9OjAwPC9kaXY+YDtcbiAgICB9KS5qb2luKFwiXCIpO1xuXG4gICAgY29uc3QgZ3JpZExpbmVzSCA9IEhPVVJTLm1hcCgoXywgaSkgPT5cbiAgICAgIGA8ZGl2IHN0eWxlPVwicG9zaXRpb246IGFic29sdXRlOyB0b3A6ICR7aSAqIHJvd0hlaWdodH1weDsgbGVmdDogMDsgcmlnaHQ6IDA7IGhlaWdodDogMXB4OyBiYWNrZ3JvdW5kOiAke2xpbmVDb2xvcn07XCI+PC9kaXY+YFxuICAgICkuam9pbihcIlwiKTtcblxuICAgIGNvbnN0IGdyaWRMaW5lc1YgPSBEQVlTLm1hcCgoXywgaSkgPT5cbiAgICAgIGA8ZGl2IHN0eWxlPVwicG9zaXRpb246IGFic29sdXRlOyBsZWZ0OiAke2kgKiBjb2xXaWR0aH1weDsgdG9wOiAwOyBib3R0b206IDA7IHdpZHRoOiAxcHg7IGJhY2tncm91bmQ6ICR7bGluZUNvbG9yfTtcIj48L2Rpdj5gXG4gICAgKS5qb2luKFwiXCIpO1xuXG4gICAgbGV0IGJsb2NrSW5kZXggPSAwO1xuICAgIGNvbnN0IGJsb2Nrc0h0bWwgPSBEQVlTLm1hcCgoZGF5LCBkYXlJbmRleCkgPT4ge1xuICAgICAgY29uc3QgYmxvY2tzID0gc2NoZWR1bGVbZGF5XSB8fCBbXTtcbiAgICAgIHJldHVybiBibG9ja3MubWFwKChibG9jazogU2NoZWR1bGVCbG9jaykgPT4ge1xuICAgICAgICBjb25zdCBpID0gYmxvY2tJbmRleCsrO1xuICAgICAgICBjb25zdCBibG9ja1AgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcImVudGVyXCIsIGF0OiBgJHsoKDAuMjIgKyBpICogMC4wNikgKiAxMDApLnRvRml4ZWQoMSl9JWAsIGZvcjogXCIyMCVcIiwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pO1xuICAgICAgICBjb25zdCB4ID0gZGF5SW5kZXggKiBjb2xXaWR0aCArIDY7XG4gICAgICAgIGNvbnN0IHkgPSAoKGJsb2NrLnN0YXJ0IC0gKEhPVVJTWzBdID8/IDkpKSAqIHJvd0hlaWdodCkgKyA2O1xuICAgICAgICBjb25zdCBibG9ja0hlaWdodCA9IGJsb2NrLmR1cmF0aW9uICogcm93SGVpZ2h0IC0gMTI7XG4gICAgICAgIGNvbnN0IGJsb2NrV2lkdGggPSBjb2xXaWR0aCAtIDEyO1xuICAgICAgICBjb25zdCBjb2xvciA9IChDT0xPUlNbYmxvY2sudHlwZV0gPz8gQ09MT1JTLmRlZXApITtcblxuICAgICAgICByZXR1cm4gYFxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6ICR7eH1weDtcbiAgICAgICAgICAgIHRvcDogJHt5fXB4O1xuICAgICAgICAgICAgd2lkdGg6ICR7YmxvY2tXaWR0aH1weDtcbiAgICAgICAgICAgIGhlaWdodDogJHtibG9ja0hlaWdodCAqIGJsb2NrUH1weDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICR7Y29sb3IuYmd9O1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDNweCBzb2xpZCAke2NvbG9yLmJvcmRlcn07XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgICAgICBvcGFjaXR5OiAke2Jsb2NrUH07XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMTJweCAke3N0ZC5jb2xvci5hbHBoYShjb2xvci5iZywgMC4zNSl9O1xuICAgICAgICAgIFwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cInBhZGRpbmc6IDEwcHg7IGNvbG9yOiB3aGl0ZTsgZm9udC1zaXplOiAxM3B4OyBmb250LXdlaWdodDogNTAwO1wiPiR7YmxvY2subGFiZWx9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgICB9KS5qb2luKFwiXCIpO1xuICAgIH0pLmpvaW4oXCJcIik7XG5cbiAgICBjb25zdCBsZWdlbmRPcGFjaXR5ID0gdC50d2VlbigwLCAxLCB7IGR1cmluZzogXCJlbnRlclwiLCBhdDogXCI0MiVcIiwgZm9yOiBcIjE4JVwiLCBlYXNpbmc6IFwiZWFzZU91dEN1YmljXCIgfSk7XG4gICAgY29uc3QgdGl0bGVPcGFjaXR5ID0gdC50d2VlbigwLCAxLCB7IGR1cmluZzogXCJlbnRlclwiLCBhdDogXCIwJVwiLCBmb3I6IFwiMjAlXCIsIGVhc2luZzogXCJlYXNlT3V0Q3ViaWNcIiB9KTtcbiAgICBjb25zdCBnbG9iYWxPcGFjaXR5ID0gMSAtIHQudHdlZW4oMCwgMSwgeyBkdXJpbmc6IFwiZXhpdFwiLCBlYXNpbmc6IFwiZWFzZUluQ3ViaWNcIiB9KTtcblxuICAgIHJldHVybiBgXG4gICAgPGRpdiBzdHlsZT1cIlxuICAgICAgd2lkdGg6ICR7d2lkdGh9cHg7XG4gICAgICBoZWlnaHQ6ICR7aGVpZ2h0fXB4O1xuICAgICAgYmFja2dyb3VuZDogJHtiZ0NvbG9yfTtcbiAgICAgIGZvbnQtZmFtaWx5OiAnSW50ZXInLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBwYWRkaW5nOiAke3BhZGRpbmd9cHg7XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgb3BhY2l0eTogJHtnbG9iYWxPcGFjaXR5fTtcbiAgICBcIj5cbiAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAyMHB4OyBtYXJnaW4tbGVmdDogJHtsYWJlbFdpZHRofXB4OyBvcGFjaXR5OiAke3RpdGxlT3BhY2l0eX07XCI+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6IDI4cHg7IGZvbnQtd2VpZ2h0OiA2MDA7IGNvbG9yOiAke3RleHRDb2xvcn07IGxldHRlci1zcGFjaW5nOiAtMC4wMmVtO1wiPldlZWtseSBzY2hlZHVsZTwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiAxNXB4OyBjb2xvcjogJHttdXRlZENvbG9yfTsgbWFyZ2luLXRvcDogNHB4O1wiPkRlZXAgd29yayBibG9ja3MgdnMgbWVldGluZ3M8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgbWFyZ2luLWxlZnQ6ICR7bGFiZWxXaWR0aH1weDsgbWFyZ2luLWJvdHRvbTogMTJweDtcIj5cbiAgICAgICAgJHtkYXlzSHRtbH1cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgcG9zaXRpb246IHJlbGF0aXZlO1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwid2lkdGg6ICR7bGFiZWxXaWR0aH1weDtcIj5cbiAgICAgICAgICAke2hvdXJzSHRtbH1cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOiByZWxhdGl2ZTsgd2lkdGg6ICR7Z3JpZFdpZHRofXB4OyBoZWlnaHQ6ICR7Z3JpZEhlaWdodH1weDsgYm9yZGVyLXJhZGl1czogOHB4OyBiYWNrZ3JvdW5kOiAke3RoZW1lID09PSBcImRhcmtcIiA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjAyKVwiIDogXCJyZ2JhKDAsMCwwLDAuMDIpXCJ9O1wiPlxuICAgICAgICAgICR7Z3JpZExpbmVzSH1cbiAgICAgICAgICAke2dyaWRMaW5lc1Z9XG4gICAgICAgICAgJHtibG9ja3NIdG1sfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgZ2FwOiAyOHB4OyBtYXJnaW4tdG9wOiAyNHB4OyBtYXJnaW4tbGVmdDogJHtsYWJlbFdpZHRofXB4OyBvcGFjaXR5OiAke2xlZ2VuZE9wYWNpdHl9O1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA4cHg7XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiAxNHB4OyBoZWlnaHQ6IDE0cHg7IGJhY2tncm91bmQ6ICMzYjgyZjY7IGJvcmRlci1yYWRpdXM6IDRweDtcIj48L2Rpdj5cbiAgICAgICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAke3RleHRDb2xvcn07IGZvbnQtc2l6ZTogMTRweDtcIj5EZWVwIHdvcms8L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA4cHg7XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiAxNHB4OyBoZWlnaHQ6IDE0cHg7IGJhY2tncm91bmQ6ICNmNTllMGI7IGJvcmRlci1yYWRpdXM6IDRweDtcIj48L2Rpdj5cbiAgICAgICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAke3RleHRDb2xvcn07IGZvbnQtc2l6ZTogMTRweDtcIj5NZWV0aW5nczwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYDtcbiAgfSxcbn0pOyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkEsU0FBUyxPQUFPLE9BQU87RUFDdEIsTUFBTSxTQUFTLE1BQU0sVUFBVTtFQUMvQixNQUFNLElBQUksTUFBTTtFQUNoQixNQUFNLGFBQWEsT0FBTyxNQUFNLFlBQVk7RUFDNUMsT0FBTztHQUNOO0dBQ0EsVUFBVSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUUsUUFBUSxhQUFhLEVBQUUsWUFBWSxRQUFRO0dBQ3JFLFFBQVEsTUFBTTtHQUNkLEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxhQUFhLEVBQUUsU0FBUyxNQUFNLFFBQVEsSUFBSSxDQUFDO0VBQy9DO0NBQ0Q7Ozs7Ozs7Ozs7Ozs7Ozs7O0NDM0JBLE1BQU0sT0FBTztFQUFDO0VBQU87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