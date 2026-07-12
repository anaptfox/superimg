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
	//#region examples/data/tier-list/tier-list.media.ts
	const DEFAULT_TIER_COLORS = {
		S: "#ff7f7f",
		A: "#ffbf7f",
		B: "#ffff7f",
		C: "#7fff7f",
		D: "#7fbfff",
		F: "#bf7fbf"
	};
	const TIERS = [
		"S",
		"A",
		"B",
		"C",
		"D",
		"F"
	];
	//#endregion
	exports.default = define({
		sample: {
			title: "Programming Languages Tier List",
			items: [
				{
					id: "1",
					name: "TypeScript",
					tier: "S"
				},
				{
					id: "2",
					name: "Rust",
					tier: "S"
				},
				{
					id: "3",
					name: "Python",
					tier: "A"
				},
				{
					id: "4",
					name: "Go",
					tier: "A"
				},
				{
					id: "5",
					name: "JavaScript",
					tier: "B"
				},
				{
					id: "6",
					name: "Java",
					tier: "C"
				},
				{
					id: "7",
					name: "PHP",
					tier: "D"
				},
				{
					id: "8",
					name: "COBOL",
					tier: "F"
				}
			],
			theme: "dark",
			showTierLabels: true
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "7s"
		},
		render(ctx) {
			const { std, width, height, timeline, data } = ctx;
			const { title, items, theme = "dark", showTierLabels = true } = data;
			const bgColor = theme === "dark" ? "#0a0a0a" : theme === "neon" ? "#0a0014" : "#fafafa";
			const textColor = theme === "dark" || theme === "neon" ? "#ffffff" : "#0a0a0a";
			const rowBgColor = theme === "dark" ? "#18181b" : theme === "neon" ? "#1a0a24" : "#f4f4f5";
			const TIMING = {
				titleSlam: {
					start: 0,
					end: .08
				},
				tiersAppear: {
					start: .08,
					end: .18
				},
				itemsReveal: {
					start: .2,
					end: .82
				},
				sTierGlow: {
					start: .84,
					end: .92
				},
				fadeOut: {
					start: .94,
					end: 1
				}
			};
			function getItemAnimation(index, totalItems, progress) {
				const itemDuration = .15;
				const staggerDelay = index / (totalItems + 2);
				const itemStart = TIMING.itemsReveal.start + staggerDelay * (TIMING.itemsReveal.end - TIMING.itemsReveal.start);
				const itemEnd = Math.min(itemStart + itemDuration, TIMING.itemsReveal.end);
				const rawProgress = std.interpolate(progress, [itemStart, itemEnd], [0, 1]);
				const animProgress = std.interpolate(rawProgress, [0, 1], [0, 1], "easeOutBack");
				return {
					scale: .3 + animProgress * .7,
					opacity: rawProgress,
					translateY: (1 - animProgress) * 30,
					isVisible: rawProgress > 0
				};
			}
			const titleProgress = std.interpolate(timeline.progress, [TIMING.titleSlam.start, TIMING.titleSlam.end], [0, 1], "easeOutElastic");
			const tiersProgress = std.interpolate(timeline.progress, [TIMING.tiersAppear.start, TIMING.tiersAppear.end], [0, 1], "easeOutCubic");
			const sGlowProgress = std.interpolate(timeline.progress, [TIMING.sTierGlow.start, TIMING.sTierGlow.end], [0, 1]);
			const globalOpacity = 1 - std.interpolate(timeline.progress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeInCubic");
			const baseFontSize = Math.min(width, height) * .035;
			const headerHeight = height * .12;
			const tierLabelWidth = showTierLabels ? width * .12 : 0;
			const contentPadding = width * .03;
			const tierRowHeight = (height - headerHeight - contentPadding * 2) / 6;
			const tierRowGap = 2;
			const itemsByTier = {
				S: [],
				A: [],
				B: [],
				C: [],
				D: [],
				F: []
			};
			items.forEach((item, idx) => {
				itemsByTier[item.tier].push({
					item,
					globalIndex: idx
				});
			});
			const itemWidth = Math.min(tierRowHeight * .8, (width - tierLabelWidth - contentPadding * 3) / 8);
			const itemHeight = tierRowHeight * .75;
			const tierRowsHtml = TIERS.map((tier, tierIdx) => {
				const tierColor = DEFAULT_TIER_COLORS[tier];
				const rowY = headerHeight + contentPadding + tierIdx * (tierRowHeight + tierRowGap);
				const tierItems = itemsByTier[tier];
				const isSTier = tier === "S";
				const glowIntensity = isSTier && sGlowProgress > 0 ? Math.sin(sGlowProgress * Math.PI) : 0;
				const rowGlow = isSTier ? `0 0 ${30 * glowIntensity}px ${tierColor}80` : "none";
				const itemsHtml = tierItems.map(({ item, globalIndex }, itemIdx) => {
					const anim = getItemAnimation(globalIndex, items.length, timeline.progress);
					if (!anim.isVisible) return "";
					return `
        <div style="
          position:absolute;
          left:${tierLabelWidth + contentPadding + itemIdx * (itemWidth + 4)}px;
          top:50%;
          transform:translateY(-50%) translateY(${anim.translateY}px) scale(${anim.scale});
          opacity:${anim.opacity};
          width:${itemWidth}px;
          height:${itemHeight}px;
          background:${tierColor};
          border-radius:${baseFontSize * .3}px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:${baseFontSize * .3}px;
          box-shadow:${isSTier && sGlowProgress > 0 ? `0 0 ${15 * glowIntensity}px ${tierColor}` : "0 2px 8px rgba(0,0,0,0.2)"};
        ">
          <span style="
            font-size:${baseFontSize * .75}px;
            font-weight:700;
            color:#000;
            text-align:center;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            width:100%;
          ">${item.name}</span>
        </div>
      `;
				}).join("");
				return `
      <div style="
        position:absolute;
        left:${contentPadding}px;
        right:${contentPadding}px;
        top:${rowY}px;
        height:${tierRowHeight}px;
        display:flex;
        align-items:stretch;
        opacity:${tiersProgress};
        box-shadow:${rowGlow};
      ">
        ${showTierLabels ? `
          <div style="
            width:${tierLabelWidth}px;
            background:${tierColor};
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:${baseFontSize * 1.5}px;
            font-weight:900;
            color:#000;
            border-radius:${baseFontSize * .2}px 0 0 ${baseFontSize * .2}px;
          ">${tier}</div>
        ` : ""}

        <div style="
          flex:1;
          background:${rowBgColor};
          position:relative;
          border-radius:${showTierLabels ? `0 ${baseFontSize * .2}px ${baseFontSize * .2}px 0` : `${baseFontSize * .2}px`};
          min-height:${tierRowHeight}px;
        ">
          ${itemsHtml}
        </div>
      </div>
    `;
			}).join("");
			return `
    <div style="width:${width}px;height:${height}px;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;opacity:${globalOpacity};">

      ${theme === "neon" ? `
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%, #ff00ff15 0%, transparent 40%);pointer-events:none;"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 70% 80%, #00ffff10 0%, transparent 40%);pointer-events:none;"></div>
  ` : ""}

      <div style="
        position:absolute;
        top:0;
        left:0;
        right:0;
        height:${headerHeight}px;
        display:flex;
        align-items:center;
        justify-content:center;
        transform:scale(${titleProgress}) translateY(${(1 - titleProgress) * -20}px);
        opacity:${titleProgress > .5 ? 1 : titleProgress * 2};
      ">
        <h1 style="
          font-size:${baseFontSize * 1.8}px;
          font-weight:900;
          color:${textColor};
          text-align:center;
          margin:0;
          letter-spacing:-0.02em;
          text-transform:uppercase;
        ">${title}</h1>
      </div>

      ${tierRowsHtml}

    </div>
  `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGllci1saXN0Lm1lZGlhLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3N1cGVyaW1nLXR5cGVzL2Rpc3QvaW5kZXguanMiLCIuLi9leGFtcGxlcy9kYXRhL3RpZXItbGlzdC90aWVyLWxpc3QubWVkaWEudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy9qc29uLnRzXG4vLyEgU2VyaWFsaXphYmxlIEpTT04tc2hhcGVkIHZhbHVlcyBmb3IgdGVtcGxhdGUgZGF0YSBkZWZhdWx0cyBhbmQgQ0xJIGxvYWRlcnMuXG5mdW5jdGlvbiBpc0pzb25PYmplY3QodmFsdWUpIHtcblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvdHlwZXMudHNcbi8vISBTdXBlckltZyBUeXBlcyAtIENvcmUgdHlwZSBkZWZpbml0aW9uc1xuLy8hIEV4cGxpY2l0LCB0eXBlZCwgc2VsZi1kb2N1bWVudGluZyBpbnRlcmZhY2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vKipcbiogRGVmaW5lIGEgcHJvamVjdC9mb2xkZXIgY29uZmlnIGZvciBfY29uZmlnLnRzIGZpbGVzLlxuKiBQcm92aWRlcyB0eXBlIGluZmVyZW5jZSBhbmQgdmFsaWRhdGlvbi5cbiovXG5mdW5jdGlvbiBkZWZpbmVDb25maWcoY29uZmlnKSB7XG5cdHJldHVybiBjb25maWc7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvZGVmaW5lLnRzXG4vLyEgVGhlIHVuaWZpZWQgYGRlZmluZSgpYCB0ZW1wbGF0ZSBmYWN0b3J5LlxuLy8hXG4vLyEgVW5pZmllZCB0ZW1wbGF0ZSBmYWN0b3J5IOKAlCBvbmUgYGRlZmluZSgpYCBmb3IgYWxsIG91dHB1dCBraW5kcy5cbi8vISBUaHJlZSBvcnRob2dvbmFsIGF4ZXMgc2VsZWN0IGJlaGF2aW91cjpcbi8vISAgLSBtZWRpdW06ICAgXCJodG1sXCIgKENocm9taXVtKSB8IFwic3ZnXCIgKHJlc3ZnLXdhc20sIGJyb3dzZXItZnJlZSwgZWRnZSkuXG4vLyEgIC0gYW5pbWF0ZWQ6IGluZmVycmVkIGZyb20gdGhlIGNvbmZpZyDigJQgdHJ1ZSBpZmYgaXQgZGVjbGFyZXMgZnBzIEFORFxuLy8hICAgICAgICAgICAgICAoZHVyYXRpb24gT1IgYSBgcmVzb2x2ZWAgaG9vayB0aGF0IHdpbGwgc3VwcGx5IGR1cmF0aW9uKS5cbi8vISAgLSBzaW5rOiAgICAgY2hvc2VuIGxhdGVyIChjb25maWcub3V0cHV0cyAvIENMSSAvIGBhc2ApLCBub3QgYXQgYXV0aG9yaW5nIHRpbWUuXG4vLyFcbi8vISBUeXBlU2NyaXB0IG5hcnJvd3MgYGN0eGAgdG8gdGhlIHJpZ2h0IHZhcmlhbnQgYXQgdGhlIGNhbGwgc2l0ZSB2aWEgb3ZlcmxvYWRzOlxuLy8hIG1lZGl1bSBwaWNrcyB0aGUgc3RkbGliIGZsYXZvdXIsIGFuaW1hdGVkIGFkZHMgdGhlIHRlbXBvcmFsIGZpZWxkcyArIGhlbHBlcnMuXG5mdW5jdGlvbiBkZWZpbmUoaW5wdXQpIHtcblx0Y29uc3QgbWVkaXVtID0gaW5wdXQubWVkaXVtID8/IFwiaHRtbFwiO1xuXHRjb25zdCBjID0gaW5wdXQuY29uZmlnO1xuXHRjb25zdCBoYXNSZXNvbHZlID0gdHlwZW9mIGlucHV0LnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIjtcblx0cmV0dXJuIHtcblx0XHRtZWRpdW0sXG5cdFx0YW5pbWF0ZWQ6ICEhYyAmJiB0eXBlb2YgYy5mcHMgPT09IFwibnVtYmVyXCIgJiYgKGMuZHVyYXRpb24gIT0gbnVsbCB8fCBoYXNSZXNvbHZlKSxcblx0XHRyZW5kZXI6IGlucHV0LnJlbmRlcixcblx0XHQuLi5pbnB1dC5jb25maWcgIT09IHZvaWQgMCA/IHsgY29uZmlnOiBpbnB1dC5jb25maWcgfSA6IHt9LFxuXHRcdC4uLmlucHV0LnNhbXBsZSAhPT0gdm9pZCAwID8geyBzYW1wbGU6IGlucHV0LnNhbXBsZSB9IDoge30sXG5cdFx0Li4uaGFzUmVzb2x2ZSA/IHsgcmVzb2x2ZTogaW5wdXQucmVzb2x2ZSB9IDoge31cblx0fTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gYW5pbWF0ZWQgKGZwcyArIGR1cmF0aW9uIGF0IGF1dGhvcmluZyB0aW1lKS4gKi9cbmZ1bmN0aW9uIGlzQW5pbWF0ZWRUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IHRydWU7XG59XG4vKiogTmFycm93IGEgdGVtcGxhdGUgbW9kdWxlIHRvIHN0YXRpYyAoc3RpbGwgLyBzaW5nbGUtZnJhbWUpLiAqL1xuZnVuY3Rpb24gaXNTdGF0aWNUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IGZhbHNlO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3Jlc3VsdHMudHNcbi8vISBSZXN1bHQgdHlwZXMgYW5kIHN0cnVjdHVyZWQgZXJyb3JzXG4vLyEgRGlzY3JpbWluYXRlZCB1bmlvbnMgZm9yIGFzeW5jIG9wZXJhdGlvbnMgd2l0aCBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2VzXG4vKipcbiogQmFzZSBlcnJvciBjbGFzcyBmb3IgYWxsIFN1cGVySW1nIGVycm9yc1xuKi9cbnZhciBTdXBlckltZ0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG5cdGNvZGU7XG5cdGRldGFpbHM7XG5cdHN1Z2dlc3Rpb247XG5cdGRvY3NVcmw7XG5cdC8qKiBNYXBwZWQgc291cmNlIGxvY2F0aW9uIChwb3B1bGF0ZWQgYnkgZW5yaWNoRXJyb3Igd2hlbiBzb3VyY2VtYXAgYXZhaWxhYmxlKSAqL1xuXHRsb2NhdGlvbjtcblx0LyoqIFZpdGUtc3R5bGUgY29kZSBmcmFtZSBzdHJpbmcgKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZSBjb250ZW50IGF2YWlsYWJsZSkgKi9cblx0Y29kZUZyYW1lO1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlLCBjb2RlLCBkZXRhaWxzLCBzdWdnZXN0aW9uLCBkb2NzVXJsKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5jb2RlID0gY29kZTtcblx0XHR0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuXHRcdHRoaXMuc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb247XG5cdFx0dGhpcy5kb2NzVXJsID0gZG9jc1VybDtcblx0XHR0aGlzLm5hbWUgPSBcIlN1cGVySW1nRXJyb3JcIjtcblx0XHRjb25zdCBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlO1xuXHRcdGlmIChjYXB0dXJlU3RhY2tUcmFjZSkgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdH1cblx0LyoqIENvbnZlcnQgdG8gYSBwbGFpbiBvYmplY3QgZm9yIGxvZ2dpbmcvc2VyaWFsaXphdGlvbiAqL1xuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdGNvZGU6IHRoaXMuY29kZSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMubWVzc2FnZSxcblx0XHRcdGRldGFpbHM6IHRoaXMuZGV0YWlscyxcblx0XHRcdHN1Z2dlc3Rpb246IHRoaXMuc3VnZ2VzdGlvbixcblx0XHRcdC4uLnRoaXMuZG9jc1VybCAhPT0gdm9pZCAwID8geyBkb2NzVXJsOiB0aGlzLmRvY3NVcmwgfSA6IHt9LFxuXHRcdFx0Li4udGhpcy5sb2NhdGlvbiAhPT0gdm9pZCAwID8geyBsb2NhdGlvbjogdGhpcy5sb2NhdGlvbiB9IDoge30sXG5cdFx0XHQuLi50aGlzLmNvZGVGcmFtZSAhPT0gdm9pZCAwID8geyBjb2RlRnJhbWU6IHRoaXMuY29kZUZyYW1lIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkXG4qL1xudmFyIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IGRldGFpbHMubGluZSA/IGAgYXQgbGluZSAke2RldGFpbHMubGluZX1gIDogXCJcIjtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBDaGVjayB0aGUgdGVtcGxhdGUgc3ludGF4JHtsb2NhdGlvbn0uIEVuc3VyZSB0aGUgcmVuZGVyIGZ1bmN0aW9uIHJldHVybnMgYSBzdHJpbmcuYDtcblx0XHRzdXBlcihgVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkJHtsb2NhdGlvbn06ICR7ZGV0YWlscy5zeW50YXhFcnJvcn1gLCBcIlRFTVBMQVRFX0NPTVBJTEFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlQ29tcGlsYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgdGhyZXcgYW4gZXJyb3IgZHVyaW5nIHJlbmRlclxuKi9cbnZhciBUZW1wbGF0ZVJ1bnRpbWVFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCB0aW1lSW5mbyA9IGRldGFpbHMudGltZUNvbnRleHQgPyBgICgke2RldGFpbHMudGltZUNvbnRleHQudGltZWxpbmVTZWNvbmRzLnRvRml4ZWQoMyl9cywgJHsoZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVByb2dyZXNzICogMTAwKS50b0ZpeGVkKDEpfSUgcHJvZ3Jlc3MpYCA6IFwiXCI7XG5cdFx0c3VwZXIoYFRlbXBsYXRlIGVycm9yIGF0IGZyYW1lICR7ZGV0YWlscy5mcmFtZX0ke3RpbWVJbmZvfTogJHtkZXRhaWxzLm9yaWdpbmFsRXJyb3J9YCwgXCJURU1QTEFURV9SVU5USU1FX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBgVGhlIHJlbmRlciBmdW5jdGlvbiB0aHJldyBhbiBlcnJvci4gQ2hlY2sgdGhhdCBhbGwgZGF0YSBwcm9wZXJ0aWVzIGV4aXN0IGFuZCB2YWx1ZXMgYXJlbid0IE5hTi91bmRlZmluZWQgYXQgdGhpcyBwb2ludCBpbiB0aGUgdGltZWxpbmUuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlcyNkZWJ1Z2dpbmdcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJUZW1wbGF0ZVJ1bnRpbWVFcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogRGF0YSB2YWxpZGF0aW9uIGZhaWxlZFxuKi9cbnZhciBWYWxpZGF0aW9uRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBgRXhwZWN0ZWQgJHtkZXRhaWxzLmV4cGVjdGVkVHlwZX0gYnV0IHJlY2VpdmVkICR7dHlwZW9mIGRldGFpbHMucmVjZWl2ZWRWYWx1ZX0uIENoZWNrIHlvdXIgZGF0YSBvYmplY3QuYDtcblx0XHRzdXBlcihgVmFsaWRhdGlvbiBmYWlsZWQgZm9yIGZpZWxkIFwiJHtkZXRhaWxzLmZpZWxkfVwiYCwgXCJWQUxJREFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlZhbGlkYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogUmVuZGVyIGZhaWxlZCAoZW5jb2RpbmcsIGJyb3dzZXIsIGV0Yy4pXG4qL1xudmFyIFJlbmRlckVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gZGV0YWlscy5odG1sRXJyb3IgPyBgVGhlIHRlbXBsYXRlIHJldHVybmVkIGludmFsaWQgSFRNTC4gQ2hlY2sgeW91ciByZW5kZXIgZnVuY3Rpb24gb3V0cHV0LmAgOiBkZXRhaWxzLmVuY29kZXJFcnJvciA/IGBFbmNvZGVyIGVycm9yLiBUcnkgcmVkdWNpbmcgcmVzb2x1dGlvbiBvciBjaGFuZ2luZyBjb2RlYy5gIDogYEJyb3dzZXIgZXJyb3IuIENoZWNrIGZvciBicm93c2VyIGNvbXBhdGliaWxpdHkgaXNzdWVzLmA7XG5cdFx0c3VwZXIoYFJlbmRlciBmYWlsZWQgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfWAsIFwiUkVOREVSX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlJlbmRlckVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBGaWxlIEkvTyBlcnJvclxuKi9cbnZhciBJT0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdHN1cGVyKGBGYWlsZWQgdG8gJHtkZXRhaWxzLm9wZXJhdGlvbn0gZmlsZTogJHtkZXRhaWxzLnBhdGh9YCwgXCJJT19FUlJPUlwiLCBkZXRhaWxzLCBkZXRhaWxzLm9wZXJhdGlvbiA9PT0gXCJ3cml0ZVwiID8gYENoZWNrIHRoYXQgdGhlIGRpcmVjdG9yeSBleGlzdHMgYW5kIHlvdSBoYXZlIHdyaXRlIHBlcm1pc3Npb25zLmAgOiBgQ2hlY2sgdGhhdCB0aGUgZmlsZSBleGlzdHMgYW5kIHlvdSBoYXZlIHJlYWQgcGVybWlzc2lvbnMuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZyNpb1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIklPRXJyb3JcIjtcblx0fVxufTtcbi8qKlxuKiBQbGF5ZXIgbm90IHJlYWR5IGVycm9yXG4qL1xudmFyIFBsYXllck5vdFJlYWR5RXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihvcGVyYXRpb24pIHtcblx0XHRzdXBlcihgUGxheWVyIG5vdCByZWFkeSBmb3Igb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBcIlBMQVlFUl9OT1RfUkVBRFlcIiwgeyBvcGVyYXRpb24gfSwgYENhbGwgbG9hZCgpIGFuZCB3YWl0IGZvciBpdCB0byBjb21wbGV0ZSBiZWZvcmUgY2FsbGluZyAke29wZXJhdGlvbn0oKS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvcGxheWVyXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyTm90UmVhZHlFcnJvclwiO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3BsYXllci50c1xuLy8hIFBsYXllciB0eXBlcyAtIFVzZXItZmFjaW5nIG9wdGlvbnMsIGV2ZW50cywgYW5kIGlucHV0IHR5cGVzIGZvciB0aGUgYnJvd3NlciBwbGF5ZXJcbi8vISBJbXBsZW1lbnRhdGlvbiB0eXBlcyAoUGxheWVyU3RhdGUsIFBsYXllclN0b3JlLCBldGMuKSBsaXZlIGluIEBzdXBlcmltZy9wbGF5ZXJcbi8qKiBUeXBlIGd1YXJkIGZvciBDb21wb3NlZFRlbXBsYXRlICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIiAmJiBpbnB1dCAhPT0gbnVsbCAmJiBcInR5cGVcIiBpbiBpbnB1dCAmJiBpbnB1dC50eXBlID09PSBcImNvbXBvc2VkXCI7XG59XG4vKiogQGRlcHJlY2F0ZWQgVXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSAqL1xuY29uc3QgaXNBbnlDb21wb3NlZFRlbXBsYXRlID0gaXNDb21wb3NlZFRlbXBsYXRlO1xuLyoqIEBkZXByZWNhdGVkIFJlbW92ZWQg4oCUIHVzZSBpc0NvbXBvc2VkVGVtcGxhdGUgYW5kIGNoZWNrIG1lZGl1bSA9PT0gXCJzdmdcIiAqL1xuZnVuY3Rpb24gaXNDb21wb3NlZFN2Z1RlbXBsYXRlKGlucHV0KSB7XG5cdHJldHVybiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpICYmIGlucHV0Lm1lZGl1bSA9PT0gXCJzdmdcIjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9ldmVudHMudHNcbi8vISBUeXBlZCwgdmVyc2lvbmVkIGV2ZW50IGNvbnRyYWN0IGZvciBzdXBlcmltZyBidWlsZCBpbnRlZ3JhdGlvbnMuXG4vLyEgQm90aCBKUyBjb25zdW1lcnMgKHJlbmRlciB3cmFwcGVycykgYW5kIFJ1c3QgZGVzZXJpYWxpemVycyAoZS5nLiBndW1ibylcbi8vISBzaG91bGQga2V5IG9uIHRoZSBgdmAgZmllbGQgYmVmb3JlIHJlYWRpbmcgZXZlbnQtc3BlY2lmaWMgZmllbGRzLlxuLy8hIEJ1bXAgYHZgIG9uIGFueSBicmVha2luZyBmaWVsZCByZW5hbWUgb3IgcmVtb3ZhbDsgYWRkaXRpdmUgZmllbGRzIGFyZSBub24tYnJlYWtpbmcuXG5jb25zdCBSRU5ERVJfRVZFTlRfVkVSU0lPTiA9IDE7XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvYmF0Y2gtdHlwZXMudHNcbi8vISBTdXBlckltZyBCYXRjaCBUeXBlc1xuLy8hIENvLWxvY2F0ZWQgYGV4cG9ydCBjb25zdCBiYXRjaGAgY29udmVudGlvbiBmb3IgYnVpbGQtdGltZSBmYW4tb3V0LlxuLy8hIEEgdGVtcGxhdGUgbW9kdWxlIG9wdGlvbmFsbHkgZXhwb3J0cyBgYmF0Y2hgIChidWlsdCB3aXRoIGBkZWZpbmVCYXRjaGApIHRvXG4vLyEgZ2VuZXJhdGUgbWFueSBvdXRwdXRzIGZyb20gb25lIHRlbXBsYXRlIOKAlCBubyBzZXBhcmF0ZSBsb2FkZXIgZmlsZS5cbi8qKlxuKiBUeXBlIGEgY28tbG9jYXRlZCBgYmF0Y2hgIGV4cG9ydCBhZ2FpbnN0IGl0cyB0ZW1wbGF0ZS5cbipcbiogYFREYXRhYCBmbG93cyBmcm9tIHRoZSB0ZW1wbGF0ZSB2YWx1ZSDigJQgY2hhbmdlIHRoZSB0ZW1wbGF0ZSdzIGBzYW1wbGVgXG4qIHNoYXBlIGFuZCB0aGUgYGRhdGE6YCBzaXRlcyBiZWxvdyB0eXBlLWVycm9yLiBUaGUgdGVtcGxhdGUgYXJndW1lbnQgaXNcbiogaW5mZXJlbmNlLW9ubHk7IGF0IHJ1bnRpbWUgdGhlIHByb3ZpZGVyIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbipcbiogUHV0IGFueSBzZXJ2ZXIvZGF0YSBpbXBvcnRzICppbnNpZGUqIHRoZSBwcm92aWRlciB3aXRoIGBhd2FpdCBpbXBvcnQoLi4uKWBcbiogc28gdGhlIGNsaWVudCBwbGF5ZXIgYnVuZGxlICh3aGljaCBpbXBvcnRzIHRoZSB0ZW1wbGF0ZSkgdHJlZS1zaGFrZXMgdGhlbSBvdXQuXG4qXG4qIEBleGFtcGxlXG4qIGBgYHR5cGVzY3JpcHRcbiogLy8gb2cubWVkaWEudHNcbiogaW1wb3J0IHsgZGVmaW5lLCBkZWZpbmVCYXRjaCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuKlxuKiBjb25zdCB0ZW1wbGF0ZSA9IGRlZmluZSh7IHNhbXBsZTogeyB0aXRsZTogXCJIaVwiIH0sIGNvbmZpZzogeyB3aWR0aDogMTIwMCwgaGVpZ2h0OiA2MzAgfSwgcmVuZGVyIH0pO1xuKiBleHBvcnQgZGVmYXVsdCB0ZW1wbGF0ZTtcbipcbiogZXhwb3J0IGNvbnN0IGJhdGNoID0gZGVmaW5lQmF0Y2godGVtcGxhdGUsIGFzeW5jICgpID0+IHtcbiogICBjb25zdCB7IGdldFBvc3RzIH0gPSBhd2FpdCBpbXBvcnQoXCIuLi9jb250ZW50XCIpO1xuKiAgIHJldHVybiAoYXdhaXQgZ2V0UG9zdHMoKSkubWFwKHAgPT4gKHsgc2x1ZzogcC5zbHVnLCBzYW1wbGU6IHsgdGl0bGU6IHAudGl0bGUgfSB9KSk7XG4qIH0pO1xuKiBgYGBcbiovXG5mdW5jdGlvbiBkZWZpbmVCYXRjaChfdGVtcGxhdGUsIHByb3ZpZGVyKSB7XG5cdHJldHVybiBwcm92aWRlcjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9pbmRleC50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gUHVyZSBUeXBlU2NyaXB0IHR5cGUgZGVmaW5pdGlvbnNcbi8vISBDb3JlIHR5cGVzLCBpbnRlcmZhY2VzLCBhbmQgZXJyb3IgY2xhc3NlcyBmb3IgdGVtcGxhdGVzLCByZW5kZXJpbmcsIGFuZCBwbGF5YmFja1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBJT0Vycm9yLCBQbGF5ZXJOb3RSZWFkeUVycm9yLCBSRU5ERVJfRVZFTlRfVkVSU0lPTiwgUmVuZGVyRXJyb3IsIFN1cGVySW1nRXJyb3IsIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciwgVGVtcGxhdGVSdW50aW1lRXJyb3IsIFZhbGlkYXRpb25FcnJvciwgZGVmaW5lLCBkZWZpbmVCYXRjaCwgZGVmaW5lQ29uZmlnLCBpc0FuaW1hdGVkVGVtcGxhdGUsIGlzQW55Q29tcG9zZWRUZW1wbGF0ZSwgaXNDb21wb3NlZFN2Z1RlbXBsYXRlLCBpc0NvbXBvc2VkVGVtcGxhdGUsIGlzSnNvbk9iamVjdCwgaXNTdGF0aWNUZW1wbGF0ZSB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgeyBkZWZpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgdHlwZSBUaWVyID0gXCJTXCIgfCBcIkFcIiB8IFwiQlwiIHwgXCJDXCIgfCBcIkRcIiB8IFwiRlwiO1xuZXhwb3J0IHR5cGUgVGllclRoZW1lID0gXCJkYXJrXCIgfCBcImxpZ2h0XCIgfCBcIm5lb25cIjtcblxuZXhwb3J0IGludGVyZmFjZSBUaWVySXRlbSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdGllcjogVGllcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUaWVyTGlzdFZpZGVvRGF0YSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgdGl0bGU6IHN0cmluZztcbiAgaXRlbXM6IFRpZXJJdGVtW107XG4gIHRoZW1lOiBUaWVyVGhlbWU7XG4gIHNob3dUaWVyTGFiZWxzOiBib29sZWFuO1xufVxuXG5jb25zdCBERUZBVUxUX1RJRVJfQ09MT1JTOiBSZWNvcmQ8VGllciwgc3RyaW5nPiA9IHtcbiAgUzogXCIjZmY3ZjdmXCIsXG4gIEE6IFwiI2ZmYmY3ZlwiLFxuICBCOiBcIiNmZmZmN2ZcIixcbiAgQzogXCIjN2ZmZjdmXCIsXG4gIEQ6IFwiIzdmYmZmZlwiLFxuICBGOiBcIiNiZjdmYmZcIixcbn07XG5cbmNvbnN0IFRJRVJTOiBUaWVyW10gPSBbXCJTXCIsIFwiQVwiLCBcIkJcIiwgXCJDXCIsIFwiRFwiLCBcIkZcIl07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZTxUaWVyTGlzdFZpZGVvRGF0YT4oe1xuICBzYW1wbGU6IHtcbiAgICB0aXRsZTogXCJQcm9ncmFtbWluZyBMYW5ndWFnZXMgVGllciBMaXN0XCIsXG4gICAgaXRlbXM6IFtcbiAgICAgIHsgaWQ6IFwiMVwiLCBuYW1lOiBcIlR5cGVTY3JpcHRcIiwgdGllcjogXCJTXCIgYXMgVGllciB9LFxuICAgICAgeyBpZDogXCIyXCIsIG5hbWU6IFwiUnVzdFwiLCB0aWVyOiBcIlNcIiBhcyBUaWVyIH0sXG4gICAgICB7IGlkOiBcIjNcIiwgbmFtZTogXCJQeXRob25cIiwgdGllcjogXCJBXCIgYXMgVGllciB9LFxuICAgICAgeyBpZDogXCI0XCIsIG5hbWU6IFwiR29cIiwgdGllcjogXCJBXCIgYXMgVGllciB9LFxuICAgICAgeyBpZDogXCI1XCIsIG5hbWU6IFwiSmF2YVNjcmlwdFwiLCB0aWVyOiBcIkJcIiBhcyBUaWVyIH0sXG4gICAgICB7IGlkOiBcIjZcIiwgbmFtZTogXCJKYXZhXCIsIHRpZXI6IFwiQ1wiIGFzIFRpZXIgfSxcbiAgICAgIHsgaWQ6IFwiN1wiLCBuYW1lOiBcIlBIUFwiLCB0aWVyOiBcIkRcIiBhcyBUaWVyIH0sXG4gICAgICB7IGlkOiBcIjhcIiwgbmFtZTogXCJDT0JPTFwiLCB0aWVyOiBcIkZcIiBhcyBUaWVyIH0sXG4gICAgXSxcbiAgICB0aGVtZTogXCJkYXJrXCIsXG4gICAgc2hvd1RpZXJMYWJlbHM6IHRydWUsXG4gIH0sXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIGR1cmF0aW9uOiBcIjdzXCIsXG4gIH0sXG4gIHJlbmRlcihjdHg6IFJlbmRlckNvbnRleHQ8VGllckxpc3RWaWRlb0RhdGE+KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIHRpbWVsaW5lLCBkYXRhIH0gPSBjdHg7XG4gICAgY29uc3QgeyB0aXRsZSwgaXRlbXMsIHRoZW1lID0gXCJkYXJrXCIsIHNob3dUaWVyTGFiZWxzID0gdHJ1ZSB9ID0gZGF0YTtcblxuICAgIGNvbnN0IGJnQ29sb3IgPSB0aGVtZSA9PT0gXCJkYXJrXCIgPyBcIiMwYTBhMGFcIiA6IHRoZW1lID09PSBcIm5lb25cIiA/IFwiIzBhMDAxNFwiIDogXCIjZmFmYWZhXCI7XG4gICAgY29uc3QgdGV4dENvbG9yID0gdGhlbWUgPT09IFwiZGFya1wiIHx8IHRoZW1lID09PSBcIm5lb25cIiA/IFwiI2ZmZmZmZlwiIDogXCIjMGEwYTBhXCI7XG4gICAgY29uc3Qgcm93QmdDb2xvciA9IHRoZW1lID09PSBcImRhcmtcIiA/IFwiIzE4MTgxYlwiIDogdGhlbWUgPT09IFwibmVvblwiID8gXCIjMWEwYTI0XCIgOiBcIiNmNGY0ZjVcIjtcblxuICAgIGNvbnN0IFRJTUlORyA9IHtcbiAgICAgIHRpdGxlU2xhbTogeyBzdGFydDogMCwgZW5kOiAwLjA4IH0sXG4gICAgICB0aWVyc0FwcGVhcjogeyBzdGFydDogMC4wOCwgZW5kOiAwLjE4IH0sXG4gICAgICBpdGVtc1JldmVhbDogeyBzdGFydDogMC4yLCBlbmQ6IDAuODIgfSxcbiAgICAgIHNUaWVyR2xvdzogeyBzdGFydDogMC44NCwgZW5kOiAwLjkyIH0sXG4gICAgICBmYWRlT3V0OiB7IHN0YXJ0OiAwLjk0LCBlbmQ6IDEuMCB9LFxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBnZXRJdGVtQW5pbWF0aW9uKFxuICAgICAgaW5kZXg6IG51bWJlcixcbiAgICAgIHRvdGFsSXRlbXM6IG51bWJlcixcbiAgICAgIHByb2dyZXNzOiBudW1iZXJcbiAgICApOiB7IHNjYWxlOiBudW1iZXI7IG9wYWNpdHk6IG51bWJlcjsgdHJhbnNsYXRlWTogbnVtYmVyOyBpc1Zpc2libGU6IGJvb2xlYW4gfSB7XG4gICAgICBjb25zdCBpdGVtRHVyYXRpb24gPSAwLjE1O1xuICAgICAgY29uc3Qgc3RhZ2dlckRlbGF5ID0gaW5kZXggLyAodG90YWxJdGVtcyArIDIpO1xuICAgICAgY29uc3QgaXRlbVN0YXJ0ID1cbiAgICAgICAgVElNSU5HLml0ZW1zUmV2ZWFsLnN0YXJ0ICtcbiAgICAgICAgc3RhZ2dlckRlbGF5ICogKFRJTUlORy5pdGVtc1JldmVhbC5lbmQgLSBUSU1JTkcuaXRlbXNSZXZlYWwuc3RhcnQpO1xuICAgICAgY29uc3QgaXRlbUVuZCA9IE1hdGgubWluKGl0ZW1TdGFydCArIGl0ZW1EdXJhdGlvbiwgVElNSU5HLml0ZW1zUmV2ZWFsLmVuZCk7XG5cbiAgICAgIGNvbnN0IHJhd1Byb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHByb2dyZXNzLCBbaXRlbVN0YXJ0LCBpdGVtRW5kXSwgWzAsIDFdKTtcbiAgICAgIGNvbnN0IGFuaW1Qcm9ncmVzcyA9IHN0ZC5pbnRlcnBvbGF0ZShyYXdQcm9ncmVzcywgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEJhY2tcIik7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNjYWxlOiAwLjMgKyBhbmltUHJvZ3Jlc3MgKiAwLjcsXG4gICAgICAgIG9wYWNpdHk6IHJhd1Byb2dyZXNzLFxuICAgICAgICB0cmFuc2xhdGVZOiAoMSAtIGFuaW1Qcm9ncmVzcykgKiAzMCxcbiAgICAgICAgaXNWaXNpYmxlOiByYXdQcm9ncmVzcyA+IDAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHRpdGxlUHJvZ3Jlc3MgPSBzdGQuaW50ZXJwb2xhdGUodGltZWxpbmUucHJvZ3Jlc3MsIFtUSU1JTkcudGl0bGVTbGFtLnN0YXJ0LCBUSU1JTkcudGl0bGVTbGFtLmVuZF0sIFswLCAxXSwgXCJlYXNlT3V0RWxhc3RpY1wiKTtcbiAgICBjb25zdCB0aWVyc1Byb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHRpbWVsaW5lLnByb2dyZXNzLCBbVElNSU5HLnRpZXJzQXBwZWFyLnN0YXJ0LCBUSU1JTkcudGllcnNBcHBlYXIuZW5kXSwgWzAsIDFdLCBcImVhc2VPdXRDdWJpY1wiKTtcbiAgICBjb25zdCBzR2xvd1Byb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHRpbWVsaW5lLnByb2dyZXNzLCBbVElNSU5HLnNUaWVyR2xvdy5zdGFydCwgVElNSU5HLnNUaWVyR2xvdy5lbmRdLCBbMCwgMV0pO1xuICAgIGNvbnN0IGZhZGVPdXRQcm9ncmVzcyA9IHN0ZC5pbnRlcnBvbGF0ZSh0aW1lbGluZS5wcm9ncmVzcywgW1RJTUlORy5mYWRlT3V0LnN0YXJ0LCBUSU1JTkcuZmFkZU91dC5lbmRdLCBbMCwgMV0sIFwiZWFzZUluQ3ViaWNcIik7XG5cbiAgICBjb25zdCBnbG9iYWxPcGFjaXR5ID0gMSAtIGZhZGVPdXRQcm9ncmVzcztcbiAgICBjb25zdCBiYXNlRm9udFNpemUgPSBNYXRoLm1pbih3aWR0aCwgaGVpZ2h0KSAqIDAuMDM1O1xuICAgIGNvbnN0IGhlYWRlckhlaWdodCA9IGhlaWdodCAqIDAuMTI7XG4gICAgY29uc3QgdGllckxhYmVsV2lkdGggPSBzaG93VGllckxhYmVscyA/IHdpZHRoICogMC4xMiA6IDA7XG4gICAgY29uc3QgY29udGVudFBhZGRpbmcgPSB3aWR0aCAqIDAuMDM7XG5cbiAgICBjb25zdCBhdmFpbGFibGVIZWlnaHQgPSBoZWlnaHQgLSBoZWFkZXJIZWlnaHQgLSBjb250ZW50UGFkZGluZyAqIDI7XG4gICAgY29uc3QgdGllclJvd0hlaWdodCA9IGF2YWlsYWJsZUhlaWdodCAvIDY7XG4gICAgY29uc3QgdGllclJvd0dhcCA9IDI7XG5cbiAgICBjb25zdCBpdGVtc0J5VGllcjogUmVjb3JkPFRpZXIsIHsgaXRlbTogVGllckl0ZW07IGdsb2JhbEluZGV4OiBudW1iZXIgfVtdPiA9IHtcbiAgICAgIFM6IFtdLCBBOiBbXSwgQjogW10sIEM6IFtdLCBEOiBbXSwgRjogW10sXG4gICAgfTtcbiAgICBpdGVtcy5mb3JFYWNoKChpdGVtOiBUaWVySXRlbSwgaWR4OiBudW1iZXIpID0+IHtcbiAgICAgIGl0ZW1zQnlUaWVyW2l0ZW0udGllcl0ucHVzaCh7IGl0ZW0sIGdsb2JhbEluZGV4OiBpZHggfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBpdGVtV2lkdGggPSBNYXRoLm1pbihcbiAgICAgIHRpZXJSb3dIZWlnaHQgKiAwLjgsXG4gICAgICAod2lkdGggLSB0aWVyTGFiZWxXaWR0aCAtIGNvbnRlbnRQYWRkaW5nICogMykgLyA4XG4gICAgKTtcbiAgICBjb25zdCBpdGVtSGVpZ2h0ID0gdGllclJvd0hlaWdodCAqIDAuNzU7XG5cbiAgICBjb25zdCB0aWVyUm93c0h0bWwgPSBUSUVSUy5tYXAoKHRpZXIsIHRpZXJJZHgpID0+IHtcbiAgICAgIGNvbnN0IHRpZXJDb2xvciA9IERFRkFVTFRfVElFUl9DT0xPUlNbdGllcl07XG4gICAgICBjb25zdCByb3dZID0gaGVhZGVySGVpZ2h0ICsgY29udGVudFBhZGRpbmcgKyB0aWVySWR4ICogKHRpZXJSb3dIZWlnaHQgKyB0aWVyUm93R2FwKTtcbiAgICAgIGNvbnN0IHRpZXJJdGVtcyA9IGl0ZW1zQnlUaWVyW3RpZXJdO1xuXG4gICAgICBjb25zdCBpc1NUaWVyID0gdGllciA9PT0gXCJTXCI7XG4gICAgICBjb25zdCBnbG93SW50ZW5zaXR5ID0gaXNTVGllciAmJiBzR2xvd1Byb2dyZXNzID4gMCA/IE1hdGguc2luKHNHbG93UHJvZ3Jlc3MgKiBNYXRoLlBJKSA6IDA7XG4gICAgICBjb25zdCByb3dHbG93ID0gaXNTVGllciA/IGAwIDAgJHszMCAqIGdsb3dJbnRlbnNpdHl9cHggJHt0aWVyQ29sb3J9ODBgIDogXCJub25lXCI7XG5cbiAgICAgIGNvbnN0IGl0ZW1zSHRtbCA9IHRpZXJJdGVtc1xuICAgICAgICAubWFwKCh7IGl0ZW0sIGdsb2JhbEluZGV4IH0sIGl0ZW1JZHgpID0+IHtcbiAgICAgICAgICBjb25zdCBhbmltID0gZ2V0SXRlbUFuaW1hdGlvbihnbG9iYWxJbmRleCwgaXRlbXMubGVuZ3RoLCB0aW1lbGluZS5wcm9ncmVzcyk7XG4gICAgICAgICAgaWYgKCFhbmltLmlzVmlzaWJsZSkgcmV0dXJuIFwiXCI7XG5cbiAgICAgICAgICBjb25zdCBpdGVtWCA9IHRpZXJMYWJlbFdpZHRoICsgY29udGVudFBhZGRpbmcgKyBpdGVtSWR4ICogKGl0ZW1XaWR0aCArIDQpO1xuXG4gICAgICAgICAgcmV0dXJuIGBcbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIHBvc2l0aW9uOmFic29sdXRlO1xuICAgICAgICAgIGxlZnQ6JHtpdGVtWH1weDtcbiAgICAgICAgICB0b3A6NTAlO1xuICAgICAgICAgIHRyYW5zZm9ybTp0cmFuc2xhdGVZKC01MCUpIHRyYW5zbGF0ZVkoJHthbmltLnRyYW5zbGF0ZVl9cHgpIHNjYWxlKCR7YW5pbS5zY2FsZX0pO1xuICAgICAgICAgIG9wYWNpdHk6JHthbmltLm9wYWNpdHl9O1xuICAgICAgICAgIHdpZHRoOiR7aXRlbVdpZHRofXB4O1xuICAgICAgICAgIGhlaWdodDoke2l0ZW1IZWlnaHR9cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDoke3RpZXJDb2xvcn07XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czoke2Jhc2VGb250U2l6ZSAqIDAuM31weDtcbiAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6Y2VudGVyO1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDpjZW50ZXI7XG4gICAgICAgICAgcGFkZGluZzoke2Jhc2VGb250U2l6ZSAqIDAuM31weDtcbiAgICAgICAgICBib3gtc2hhZG93OiR7aXNTVGllciAmJiBzR2xvd1Byb2dyZXNzID4gMCA/IGAwIDAgJHsxNSAqIGdsb3dJbnRlbnNpdHl9cHggJHt0aWVyQ29sb3J9YCA6IFwiMCAycHggOHB4IHJnYmEoMCwwLDAsMC4yKVwifTtcbiAgICAgICAgXCI+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJcbiAgICAgICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuNzV9cHg7XG4gICAgICAgICAgICBmb250LXdlaWdodDo3MDA7XG4gICAgICAgICAgICBjb2xvcjojMDAwO1xuICAgICAgICAgICAgdGV4dC1hbGlnbjpjZW50ZXI7XG4gICAgICAgICAgICBvdmVyZmxvdzpoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OmVsbGlwc2lzO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6bm93cmFwO1xuICAgICAgICAgICAgd2lkdGg6MTAwJTtcbiAgICAgICAgICBcIj4ke2l0ZW0ubmFtZX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYDtcbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oXCJcIik7XG5cbiAgICAgIHJldHVybiBgXG4gICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIHBvc2l0aW9uOmFic29sdXRlO1xuICAgICAgICBsZWZ0OiR7Y29udGVudFBhZGRpbmd9cHg7XG4gICAgICAgIHJpZ2h0OiR7Y29udGVudFBhZGRpbmd9cHg7XG4gICAgICAgIHRvcDoke3Jvd1l9cHg7XG4gICAgICAgIGhlaWdodDoke3RpZXJSb3dIZWlnaHR9cHg7XG4gICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6c3RyZXRjaDtcbiAgICAgICAgb3BhY2l0eToke3RpZXJzUHJvZ3Jlc3N9O1xuICAgICAgICBib3gtc2hhZG93OiR7cm93R2xvd307XG4gICAgICBcIj5cbiAgICAgICAgJHtzaG93VGllckxhYmVscyA/IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICB3aWR0aDoke3RpZXJMYWJlbFdpZHRofXB4O1xuICAgICAgICAgICAgYmFja2dyb3VuZDoke3RpZXJDb2xvcn07XG4gICAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO1xuICAgICAgICAgICAgZm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMS41fXB4O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6OTAwO1xuICAgICAgICAgICAgY29sb3I6IzAwMDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemUgKiAwLjJ9cHggMCAwICR7YmFzZUZvbnRTaXplICogMC4yfXB4O1xuICAgICAgICAgIFwiPiR7dGllcn08L2Rpdj5cbiAgICAgICAgYCA6IFwiXCJ9XG5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIGZsZXg6MTtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiR7cm93QmdDb2xvcn07XG4gICAgICAgICAgcG9zaXRpb246cmVsYXRpdmU7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czoke3Nob3dUaWVyTGFiZWxzID8gYDAgJHtiYXNlRm9udFNpemUgKiAwLjJ9cHggJHtiYXNlRm9udFNpemUgKiAwLjJ9cHggMGAgOiBgJHtiYXNlRm9udFNpemUgKiAwLjJ9cHhgfTtcbiAgICAgICAgICBtaW4taGVpZ2h0OiR7dGllclJvd0hlaWdodH1weDtcbiAgICAgICAgXCI+XG4gICAgICAgICAgJHtpdGVtc0h0bWx9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgYDtcbiAgICB9KS5qb2luKFwiXCIpO1xuXG4gICAgY29uc3QgbmVvbkJnID0gdGhlbWUgPT09IFwibmVvblwiID8gYFxuICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KGVsbGlwc2UgYXQgMzAlIDIwJSwgI2ZmMDBmZjE1IDAlLCB0cmFuc3BhcmVudCA0MCUpO3BvaW50ZXItZXZlbnRzOm5vbmU7XCI+PC9kaXY+XG4gICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoZWxsaXBzZSBhdCA3MCUgODAlLCAjMDBmZmZmMTAgMCUsIHRyYW5zcGFyZW50IDQwJSk7cG9pbnRlci1ldmVudHM6bm9uZTtcIj48L2Rpdj5cbiAgYCA6IFwiXCI7XG5cbiAgICByZXR1cm4gYFxuICAgIDxkaXYgc3R5bGU9XCJ3aWR0aDoke3dpZHRofXB4O2hlaWdodDoke2hlaWdodH1weDtiYWNrZ3JvdW5kOiR7YmdDb2xvcn07Zm9udC1mYW1pbHk6LWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsJ1NlZ29lIFVJJyxIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZjtwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW47b3BhY2l0eToke2dsb2JhbE9wYWNpdHl9O1wiPlxuXG4gICAgICAke25lb25CZ31cblxuICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgdG9wOjA7XG4gICAgICAgIGxlZnQ6MDtcbiAgICAgICAgcmlnaHQ6MDtcbiAgICAgICAgaGVpZ2h0OiR7aGVhZGVySGVpZ2h0fXB4O1xuICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAganVzdGlmeS1jb250ZW50OmNlbnRlcjtcbiAgICAgICAgdHJhbnNmb3JtOnNjYWxlKCR7dGl0bGVQcm9ncmVzc30pIHRyYW5zbGF0ZVkoJHsoMSAtIHRpdGxlUHJvZ3Jlc3MpICogLTIwfXB4KTtcbiAgICAgICAgb3BhY2l0eToke3RpdGxlUHJvZ3Jlc3MgPiAwLjUgPyAxIDogdGl0bGVQcm9ncmVzcyAqIDJ9O1xuICAgICAgXCI+XG4gICAgICAgIDxoMSBzdHlsZT1cIlxuICAgICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDEuOH1weDtcbiAgICAgICAgICBmb250LXdlaWdodDo5MDA7XG4gICAgICAgICAgY29sb3I6JHt0ZXh0Q29sb3J9O1xuICAgICAgICAgIHRleHQtYWxpZ246Y2VudGVyO1xuICAgICAgICAgIG1hcmdpbjowO1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOi0wLjAyZW07XG4gICAgICAgICAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO1xuICAgICAgICBcIj4ke3RpdGxlfTwvaDE+XG4gICAgICA8L2Rpdj5cblxuICAgICAgJHt0aWVyUm93c0h0bWx9XG5cbiAgICA8L2Rpdj5cbiAgYDtcbiAgfSxcbn0pO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZCQSxTQUFTLE9BQU8sT0FBTztFQUN0QixNQUFNLFNBQVMsTUFBTSxVQUFVO0VBQy9CLE1BQU0sSUFBSSxNQUFNO0VBQ2hCLE1BQU0sYUFBYSxPQUFPLE1BQU0sWUFBWTtFQUM1QyxPQUFPO0dBQ047R0FDQSxVQUFVLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRSxRQUFRLGFBQWEsRUFBRSxZQUFZLFFBQVE7R0FDckUsUUFBUSxNQUFNO0dBQ2QsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLGFBQWEsRUFBRSxTQUFTLE1BQU0sUUFBUSxJQUFJLENBQUM7RUFDL0M7Q0FDRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0N2QkEsTUFBTSxzQkFBNEM7RUFDaEQsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0VBQ0gsR0FBRztFQUNILEdBQUc7RUFDSCxHQUFHO0NBQ0w7Q0FFQSxNQUFNLFFBQWdCO0VBQUM7RUFBSztFQUFLO0VBQUs7RUFBSztFQUFLO0NBQUc7O21CQUVw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