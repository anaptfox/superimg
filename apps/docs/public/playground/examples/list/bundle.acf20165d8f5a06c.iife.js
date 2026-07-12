var __template = (function(exports) {
	Object.defineProperties(exports, {
		__esModule: { value: true },
		[Symbol.toStringTag]: { value: "Module" }
	});
	//#region packages/superimg-core/node_modules/@superimg/stdlib/dist/layout-timeline.js
	/**
	* Map absolute-second segments to a director phase layout.
	*
	* @param segments - name → duration in seconds (must be > 0). Object key order is preserved.
	* @returns percent phases (sum 100%), totalSeconds, and stable order
	*
	* @example
	* ```ts
	* const { phases, totalSeconds } = layoutTimeline({ boot: 1, type: 2, event_0: 0.9 });
	* // resolve: return { duration: `${totalSeconds}s`, phases }
	* // render:  const d = ctx.director(phases)
	* ```
	*/
	function layoutTimeline(segments) {
		const order = Object.keys(segments);
		if (order.length === 0) throw new Error("layoutTimeline(): segments must have at least one phase");
		const seconds = order.map((name) => {
			const s = segments[name];
			if (!Number.isFinite(s) || s <= 0) throw new Error(`layoutTimeline(): segment "${name}" must be a finite number > 0 (got ${s})`);
			return s;
		});
		const totalSeconds = seconds.reduce((a, b) => a + b, 0);
		const phases = {};
		for (let i = 0; i < order.length; i++) {
			const name = order[i];
			phases[name] = `${seconds[i] / totalSeconds * 100}%`;
		}
		return {
			phases,
			totalSeconds,
			order
		};
	}
	//#endregion
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
	//#region examples/data/list/list.media.ts
	function itemWeight(item) {
		return Math.max(1, 1 + (item.subtitle?.length ?? 0) / 80);
	}
	function estimateListTimeline(data) {
		const weights = data.items.map(itemWeight);
		const itemsS = Math.max(2, weights.reduce((a, w) => a + w, 0) * 1.15);
		return layoutTimeline({
			intro: .95,
			items: itemsS,
			hold: Math.max(.5, itemsS * .1),
			outro: .65
		});
	}
	//#endregion
	exports.default = define({
		sample: {
			title: "Top 5 Reasons to Use TypeScript",
			items: [
				{
					title: "Type Safety",
					subtitle: "Catch errors at compile time"
				},
				{
					title: "Better IDE Support",
					subtitle: "Autocomplete and refactoring"
				},
				{
					title: "Self-Documenting Code",
					subtitle: "Types serve as documentation"
				},
				{
					title: "Easier Refactoring",
					subtitle: "Confident large-scale changes"
				},
				{
					title: "Growing Ecosystem",
					subtitle: "First-class library support"
				}
			],
			direction: "down",
			theme: "dark",
			numberStyle: "circle",
			accentColor: "#f97316"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "8s"
		},
		resolve({ data }) {
			const { totalSeconds, phases } = estimateListTimeline(data);
			return {
				duration: `${totalSeconds}s`,
				phases
			};
		},
		render(ctx) {
			const { std, width, height, timeline, data } = ctx;
			const { title, items, direction = "down", theme = "dark", numberStyle = "circle", accentColor = "#f97316" } = data;
			const orderedItems = direction === "down" ? [...items].reverse() : items;
			const itemCount = orderedItems.length;
			const bgColor = theme === "dark" ? "#0a0a0a" : "#fafafa";
			const textColor = theme === "dark" ? "#ffffff" : "#0a0a0a";
			const mutedColor = theme === "dark" ? "#a1a1aa" : "#71717a";
			const { phases } = estimateListTimeline(data);
			const t = ctx.director(phases);
			const weights = orderedItems.map(itemWeight);
			const stk = std.stack(orderedItems, {
				during: t.in("items"),
				weights
			});
			function getDisplayNumber(index) {
				if (direction === "down") return itemCount - index;
				return index + 1;
			}
			const titleProgress = std.interpolate(t.in("intro"), [0, 1], [0, 1], "easeOutCubic");
			const finalHoldProgress = std.interpolate(t.in("hold"), [0, 1], [0, 1]);
			const globalOpacity = 1 - std.interpolate(t.in("outro"), [0, 1], [0, 1], "easeInCubic");
			const baseFontSize = Math.min(width, height) * .045;
			const titleFontSize = baseFontSize * 1.4;
			const numberSize = baseFontSize * 2.2;
			const itemPadding = baseFontSize * .6;
			const itemGap = baseFontSize * .5;
			const headerHeight = height * .15;
			const contentHeight = height - headerHeight - height * .08;
			const itemHeight = Math.min((contentHeight - itemGap * (itemCount - 1)) / itemCount, height * .14);
			const startY = headerHeight + (contentHeight - (itemHeight * itemCount + itemGap * (itemCount - 1))) / 2;
			const itemsHtml = orderedItems.map((item, i) => {
				const state = stk.state(i);
				if (state.state === "hidden") return "";
				const rawProgress = state.enter;
				const numberProgress = std.interpolate(Math.min(1, rawProgress * 1.5), [0, 1], [0, 1], "easeOutBack");
				const textProgress = std.interpolate(rawProgress, [0, 1], [0, 1], "easeOutCubic");
				const anim = {
					numberScale: numberProgress,
					numberOpacity: Math.min(1, rawProgress * 2),
					textTranslateX: (1 - textProgress) * 50,
					textOpacity: textProgress
				};
				const displayNum = getDisplayNumber(i);
				const y = startY + i * (itemHeight + itemGap);
				const numSize = numberSize * .9;
				let numberBadge = "";
				if (numberStyle === "circle") numberBadge = `
        <div style="
          width: ${numSize}px;
          height: ${numSize}px;
          border-radius: 50%;
          background: ${accentColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${numSize * .5}px;
          font-weight: 800;
          color: white;
          transform: scale(${anim.numberScale});
          opacity: ${anim.numberOpacity};
          box-shadow: 0 0 20px ${accentColor}40;
        ">${displayNum}</div>
      `;
				else if (numberStyle === "square") numberBadge = `
        <div style="
          width: ${numSize}px;
          height: ${numSize}px;
          border-radius: ${numSize * .15}px;
          background: ${accentColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${numSize * .5}px;
          font-weight: 800;
          color: white;
          transform: scale(${anim.numberScale}) rotate(${(1 - anim.numberScale) * -15}deg);
          opacity: ${anim.numberOpacity};
        ">${displayNum}</div>
      `;
				else numberBadge = `
        <div style="
          font-size: ${numSize * .7}px;
          font-weight: 900;
          color: ${accentColor};
          transform: scale(${anim.numberScale});
          opacity: ${anim.numberOpacity};
          min-width: ${numSize}px;
          text-align: center;
        ">${displayNum}</div>
      `;
				return `
      <div style="
        position: absolute;
        left: ${width * .06}px;
        right: ${width * .06}px;
        top: ${y}px;
        height: ${itemHeight}px;
        display: flex;
        align-items: center;
        gap: ${itemPadding}px;
      ">
        ${numberBadge}
        <div style="
          flex: 1;
          transform: translateX(${anim.textTranslateX}px);
          opacity: ${anim.textOpacity};
        ">
          <div style="
            font-size: ${baseFontSize * 1.1}px;
            font-weight: 700;
            color: ${textColor};
            line-height: 1.2;
            margin-bottom: 2px;
          ">${item.title}</div>
          ${item.subtitle ? `
            <div style="
              font-size: ${baseFontSize * .75}px;
              color: ${mutedColor};
              line-height: 1.3;
            ">${item.subtitle}</div>
          ` : ""}
        </div>
      </div>
    `;
			}).join("");
			return `
    <div style="width:${width}px;height:${height}px;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;opacity:${globalOpacity};">

      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%, ${accentColor}10 0%, transparent 50%);pointer-events:none;"></div>

      <div style="position:absolute;inset:0;background:${accentColor};opacity:${finalHoldProgress > 0 ? Math.sin(finalHoldProgress * Math.PI) * .3 : 0};pointer-events:none;"></div>

      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: ${headerHeight}px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 ${width * .06}px;
        opacity: ${titleProgress};
        transform: translateY(${(1 - titleProgress) * -20}px);
      ">
        <h1 style="
          font-size: ${titleFontSize}px;
          font-weight: 800;
          color: ${textColor};
          text-align: center;
          line-height: 1.2;
          letter-spacing: -0.02em;
        ">${title}</h1>
      </div>

      ${itemsHtml}

    </div>
  `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlzdC5tZWRpYS5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9zdXBlcmltZy1jb3JlL25vZGVfbW9kdWxlcy9Ac3VwZXJpbWcvc3RkbGliL2Rpc3QvbGF5b3V0LXRpbWVsaW5lLmpzIiwiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2RhdGEvbGlzdC9saXN0Lm1lZGlhLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvbGF5b3V0LXRpbWVsaW5lLnRzXG4vKipcbiogTWFwIGFic29sdXRlLXNlY29uZCBzZWdtZW50cyB0byBhIGRpcmVjdG9yIHBoYXNlIGxheW91dC5cbipcbiogQHBhcmFtIHNlZ21lbnRzIC0gbmFtZSDihpIgZHVyYXRpb24gaW4gc2Vjb25kcyAobXVzdCBiZSA+IDApLiBPYmplY3Qga2V5IG9yZGVyIGlzIHByZXNlcnZlZC5cbiogQHJldHVybnMgcGVyY2VudCBwaGFzZXMgKHN1bSAxMDAlKSwgdG90YWxTZWNvbmRzLCBhbmQgc3RhYmxlIG9yZGVyXG4qXG4qIEBleGFtcGxlXG4qIGBgYHRzXG4qIGNvbnN0IHsgcGhhc2VzLCB0b3RhbFNlY29uZHMgfSA9IGxheW91dFRpbWVsaW5lKHsgYm9vdDogMSwgdHlwZTogMiwgZXZlbnRfMDogMC45IH0pO1xuKiAvLyByZXNvbHZlOiByZXR1cm4geyBkdXJhdGlvbjogYCR7dG90YWxTZWNvbmRzfXNgLCBwaGFzZXMgfVxuKiAvLyByZW5kZXI6ICBjb25zdCBkID0gY3R4LmRpcmVjdG9yKHBoYXNlcylcbiogYGBgXG4qL1xuZnVuY3Rpb24gbGF5b3V0VGltZWxpbmUoc2VnbWVudHMpIHtcblx0Y29uc3Qgb3JkZXIgPSBPYmplY3Qua2V5cyhzZWdtZW50cyk7XG5cdGlmIChvcmRlci5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihcImxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnRzIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgcGhhc2VcIik7XG5cdGNvbnN0IHNlY29uZHMgPSBvcmRlci5tYXAoKG5hbWUpID0+IHtcblx0XHRjb25zdCBzID0gc2VnbWVudHNbbmFtZV07XG5cdFx0aWYgKCFOdW1iZXIuaXNGaW5pdGUocykgfHwgcyA8PSAwKSB0aHJvdyBuZXcgRXJyb3IoYGxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnQgXCIke25hbWV9XCIgbXVzdCBiZSBhIGZpbml0ZSBudW1iZXIgPiAwIChnb3QgJHtzfSlgKTtcblx0XHRyZXR1cm4gcztcblx0fSk7XG5cdGNvbnN0IHRvdGFsU2Vjb25kcyA9IHNlY29uZHMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG5cdGNvbnN0IHBoYXNlcyA9IHt9O1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IG9yZGVyLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgbmFtZSA9IG9yZGVyW2ldO1xuXHRcdHBoYXNlc1tuYW1lXSA9IGAke3NlY29uZHNbaV0gLyB0b3RhbFNlY29uZHMgKiAxMDB9JWA7XG5cdH1cblx0cmV0dXJuIHtcblx0XHRwaGFzZXMsXG5cdFx0dG90YWxTZWNvbmRzLFxuXHRcdG9yZGVyXG5cdH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGxheW91dFRpbWVsaW5lIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWxheW91dC10aW1lbGluZS5qcy5tYXAiLCIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSwgbGF5b3V0VGltZWxpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgdHlwZSBMaXN0RGlyZWN0aW9uID0gXCJ1cFwiIHwgXCJkb3duXCI7XG5leHBvcnQgdHlwZSBOdW1iZXJTdHlsZSA9IFwiY2lyY2xlXCIgfCBcInNxdWFyZVwiIHwgXCJwbGFpblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIExpc3RJdGVtIHtcbiAgdGl0bGU6IHN0cmluZztcbiAgc3VidGl0bGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdFZpZGVvRGF0YSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgdGl0bGU6IHN0cmluZztcbiAgaXRlbXM6IExpc3RJdGVtW107XG4gIGRpcmVjdGlvbjogTGlzdERpcmVjdGlvbjtcbiAgdGhlbWU6IFwibGlnaHRcIiB8IFwiZGFya1wiO1xuICBudW1iZXJTdHlsZTogTnVtYmVyU3R5bGU7XG4gIGFjY2VudENvbG9yOiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGl0ZW1XZWlnaHQoaXRlbTogTGlzdEl0ZW0pOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5tYXgoMSwgMSArIChpdGVtLnN1YnRpdGxlPy5sZW5ndGggPz8gMCkgLyA4MCk7XG59XG5cbmZ1bmN0aW9uIGVzdGltYXRlTGlzdFRpbWVsaW5lKGRhdGE6IExpc3RWaWRlb0RhdGEpIHtcbiAgY29uc3Qgd2VpZ2h0cyA9IGRhdGEuaXRlbXMubWFwKGl0ZW1XZWlnaHQpO1xuICBjb25zdCBpdGVtc1MgPSBNYXRoLm1heCgyLCB3ZWlnaHRzLnJlZHVjZSgoYSwgdykgPT4gYSArIHcsIDApICogMS4xNSk7XG4gIHJldHVybiBsYXlvdXRUaW1lbGluZSh7XG4gICAgaW50cm86IDAuOTUsXG4gICAgaXRlbXM6IGl0ZW1zUyxcbiAgICBob2xkOiBNYXRoLm1heCgwLjUsIGl0ZW1zUyAqIDAuMSksXG4gICAgb3V0cm86IDAuNjUsXG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmU8TGlzdFZpZGVvRGF0YT4oe1xuICBzYW1wbGU6IHtcbiAgICB0aXRsZTogXCJUb3AgNSBSZWFzb25zIHRvIFVzZSBUeXBlU2NyaXB0XCIsXG4gICAgaXRlbXM6IFtcbiAgICAgIHsgdGl0bGU6IFwiVHlwZSBTYWZldHlcIiwgc3VidGl0bGU6IFwiQ2F0Y2ggZXJyb3JzIGF0IGNvbXBpbGUgdGltZVwiIH0sXG4gICAgICB7IHRpdGxlOiBcIkJldHRlciBJREUgU3VwcG9ydFwiLCBzdWJ0aXRsZTogXCJBdXRvY29tcGxldGUgYW5kIHJlZmFjdG9yaW5nXCIgfSxcbiAgICAgIHsgdGl0bGU6IFwiU2VsZi1Eb2N1bWVudGluZyBDb2RlXCIsIHN1YnRpdGxlOiBcIlR5cGVzIHNlcnZlIGFzIGRvY3VtZW50YXRpb25cIiB9LFxuICAgICAgeyB0aXRsZTogXCJFYXNpZXIgUmVmYWN0b3JpbmdcIiwgc3VidGl0bGU6IFwiQ29uZmlkZW50IGxhcmdlLXNjYWxlIGNoYW5nZXNcIiB9LFxuICAgICAgeyB0aXRsZTogXCJHcm93aW5nIEVjb3N5c3RlbVwiLCBzdWJ0aXRsZTogXCJGaXJzdC1jbGFzcyBsaWJyYXJ5IHN1cHBvcnRcIiB9LFxuICAgIF0sXG4gICAgZGlyZWN0aW9uOiBcImRvd25cIixcbiAgICB0aGVtZTogXCJkYXJrXCIsXG4gICAgbnVtYmVyU3R5bGU6IFwiY2lyY2xlXCIsXG4gICAgYWNjZW50Q29sb3I6IFwiI2Y5NzMxNlwiLFxuICB9LFxuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCI4c1wiLCAvLyBBU1QgZmFsbGJhY2s7IHJlc29sdmUoKSBvdmVycmlkZXNcbiAgfSxcbiAgcmVzb2x2ZSh7IGRhdGEgfSkge1xuICAgIGNvbnN0IHsgdG90YWxTZWNvbmRzLCBwaGFzZXMgfSA9IGVzdGltYXRlTGlzdFRpbWVsaW5lKGRhdGEpO1xuICAgIHJldHVybiB7IGR1cmF0aW9uOiBgJHt0b3RhbFNlY29uZHN9c2AsIHBoYXNlcyB9O1xuICB9LFxuICByZW5kZXIoY3R4OiBSZW5kZXJDb250ZXh0PExpc3RWaWRlb0RhdGE+KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIHRpbWVsaW5lLCBkYXRhIH0gPSBjdHg7XG4gICAgY29uc3Qge1xuICAgICAgdGl0bGUsXG4gICAgICBpdGVtcyxcbiAgICAgIGRpcmVjdGlvbiA9IFwiZG93blwiLFxuICAgICAgdGhlbWUgPSBcImRhcmtcIixcbiAgICAgIG51bWJlclN0eWxlID0gXCJjaXJjbGVcIixcbiAgICAgIGFjY2VudENvbG9yID0gXCIjZjk3MzE2XCIsXG4gICAgfSA9IGRhdGE7XG5cbiAgICBjb25zdCBvcmRlcmVkSXRlbXMgPSBkaXJlY3Rpb24gPT09IFwiZG93blwiID8gWy4uLml0ZW1zXS5yZXZlcnNlKCkgOiBpdGVtcztcbiAgICBjb25zdCBpdGVtQ291bnQgPSBvcmRlcmVkSXRlbXMubGVuZ3RoO1xuXG4gICAgY29uc3QgYmdDb2xvciA9IHRoZW1lID09PSBcImRhcmtcIiA/IFwiIzBhMGEwYVwiIDogXCIjZmFmYWZhXCI7XG4gICAgY29uc3QgdGV4dENvbG9yID0gdGhlbWUgPT09IFwiZGFya1wiID8gXCIjZmZmZmZmXCIgOiBcIiMwYTBhMGFcIjtcbiAgICBjb25zdCBtdXRlZENvbG9yID0gdGhlbWUgPT09IFwiZGFya1wiID8gXCIjYTFhMWFhXCIgOiBcIiM3MTcxN2FcIjtcblxuICAgIGNvbnN0IHsgcGhhc2VzIH0gPSBlc3RpbWF0ZUxpc3RUaW1lbGluZShkYXRhKTtcbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHBoYXNlcyk7XG4gICAgY29uc3Qgd2VpZ2h0cyA9IG9yZGVyZWRJdGVtcy5tYXAoaXRlbVdlaWdodCk7XG4gICAgY29uc3Qgc3RrID0gc3RkLnN0YWNrKG9yZGVyZWRJdGVtcywgeyBkdXJpbmc6IHQuaW4oXCJpdGVtc1wiKSwgd2VpZ2h0cyB9KTtcblxuICAgIGZ1bmN0aW9uIGdldERpc3BsYXlOdW1iZXIoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG4gICAgICBpZiAoZGlyZWN0aW9uID09PSBcImRvd25cIikgcmV0dXJuIGl0ZW1Db3VudCAtIGluZGV4O1xuICAgICAgcmV0dXJuIGluZGV4ICsgMTtcbiAgICB9XG5cbiAgICBjb25zdCB0aXRsZVByb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHQuaW4oXCJpbnRyb1wiKSwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuICAgIGNvbnN0IGZpbmFsSG9sZFByb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHQuaW4oXCJob2xkXCIpLCBbMCwgMV0sIFswLCAxXSk7XG4gICAgY29uc3QgZmFkZU91dFByb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHQuaW4oXCJvdXRyb1wiKSwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZUluQ3ViaWNcIik7XG4gICAgY29uc3QgZ2xvYmFsT3BhY2l0eSA9IDEgLSBmYWRlT3V0UHJvZ3Jlc3M7XG5cbiAgICBjb25zdCBiYXNlRm9udFNpemUgPSBNYXRoLm1pbih3aWR0aCwgaGVpZ2h0KSAqIDAuMDQ1O1xuICAgIGNvbnN0IHRpdGxlRm9udFNpemUgPSBiYXNlRm9udFNpemUgKiAxLjQ7XG4gICAgY29uc3QgbnVtYmVyU2l6ZSA9IGJhc2VGb250U2l6ZSAqIDIuMjtcbiAgICBjb25zdCBpdGVtUGFkZGluZyA9IGJhc2VGb250U2l6ZSAqIDAuNjtcbiAgICBjb25zdCBpdGVtR2FwID0gYmFzZUZvbnRTaXplICogMC41O1xuXG4gICAgY29uc3QgaGVhZGVySGVpZ2h0ID0gaGVpZ2h0ICogMC4xNTtcbiAgICBjb25zdCBjb250ZW50SGVpZ2h0ID0gaGVpZ2h0IC0gaGVhZGVySGVpZ2h0IC0gaGVpZ2h0ICogMC4wODtcbiAgICBjb25zdCBpdGVtSGVpZ2h0ID0gTWF0aC5taW4oXG4gICAgICAoY29udGVudEhlaWdodCAtIGl0ZW1HYXAgKiAoaXRlbUNvdW50IC0gMSkpIC8gaXRlbUNvdW50LFxuICAgICAgaGVpZ2h0ICogMC4xNFxuICAgICk7XG4gICAgY29uc3Qgc3RhcnRZID1cbiAgICAgIGhlYWRlckhlaWdodCArIChjb250ZW50SGVpZ2h0IC0gKGl0ZW1IZWlnaHQgKiBpdGVtQ291bnQgKyBpdGVtR2FwICogKGl0ZW1Db3VudCAtIDEpKSkgLyAyO1xuXG4gICAgY29uc3QgaXRlbXNIdG1sID0gb3JkZXJlZEl0ZW1zXG4gICAgICAubWFwKChpdGVtOiBMaXN0SXRlbSwgaTogbnVtYmVyKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RrLnN0YXRlKGkpO1xuICAgICAgICBpZiAoc3RhdGUuc3RhdGUgPT09IFwiaGlkZGVuXCIpIHJldHVybiBcIlwiO1xuXG4gICAgICAgIGNvbnN0IHJhd1Byb2dyZXNzID0gc3RhdGUuZW50ZXI7XG4gICAgICAgIGNvbnN0IG51bWJlclByb2dyZXNzID0gc3RkLmludGVycG9sYXRlKE1hdGgubWluKDEsIHJhd1Byb2dyZXNzICogMS41KSwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEJhY2tcIik7XG4gICAgICAgIGNvbnN0IHRleHRQcm9ncmVzcyA9IHN0ZC5pbnRlcnBvbGF0ZShyYXdQcm9ncmVzcywgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuICAgICAgICBjb25zdCBhbmltID0ge1xuICAgICAgICAgIG51bWJlclNjYWxlOiBudW1iZXJQcm9ncmVzcyxcbiAgICAgICAgICBudW1iZXJPcGFjaXR5OiBNYXRoLm1pbigxLCByYXdQcm9ncmVzcyAqIDIpLFxuICAgICAgICAgIHRleHRUcmFuc2xhdGVYOiAoMSAtIHRleHRQcm9ncmVzcykgKiA1MCxcbiAgICAgICAgICB0ZXh0T3BhY2l0eTogdGV4dFByb2dyZXNzLFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGRpc3BsYXlOdW0gPSBnZXREaXNwbGF5TnVtYmVyKGkpO1xuICAgICAgICBjb25zdCB5ID0gc3RhcnRZICsgaSAqIChpdGVtSGVpZ2h0ICsgaXRlbUdhcCk7XG4gICAgICAgIGNvbnN0IG51bVNpemUgPSBudW1iZXJTaXplICogMC45O1xuXG4gICAgICAgIGxldCBudW1iZXJCYWRnZSA9IFwiXCI7XG4gICAgICAgIGlmIChudW1iZXJTdHlsZSA9PT0gXCJjaXJjbGVcIikge1xuICAgICAgICAgIG51bWJlckJhZGdlID0gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgd2lkdGg6ICR7bnVtU2l6ZX1weDtcbiAgICAgICAgICBoZWlnaHQ6ICR7bnVtU2l6ZX1weDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICAgICAgYmFja2dyb3VuZDogJHthY2NlbnRDb2xvcn07XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgIGZvbnQtc2l6ZTogJHtudW1TaXplICogMC41fXB4O1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiA4MDA7XG4gICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoJHthbmltLm51bWJlclNjYWxlfSk7XG4gICAgICAgICAgb3BhY2l0eTogJHthbmltLm51bWJlck9wYWNpdHl9O1xuICAgICAgICAgIGJveC1zaGFkb3c6IDAgMCAyMHB4ICR7YWNjZW50Q29sb3J9NDA7XG4gICAgICAgIFwiPiR7ZGlzcGxheU51bX08L2Rpdj5cbiAgICAgIGA7XG4gICAgICAgIH0gZWxzZSBpZiAobnVtYmVyU3R5bGUgPT09IFwic3F1YXJlXCIpIHtcbiAgICAgICAgICBudW1iZXJCYWRnZSA9IGBcbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIHdpZHRoOiAke251bVNpemV9cHg7XG4gICAgICAgICAgaGVpZ2h0OiAke251bVNpemV9cHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogJHtudW1TaXplICogMC4xNX1weDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiAke2FjY2VudENvbG9yfTtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgZm9udC1zaXplOiAke251bVNpemUgKiAwLjV9cHg7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6IDgwMDtcbiAgICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgke2FuaW0ubnVtYmVyU2NhbGV9KSByb3RhdGUoJHsoMSAtIGFuaW0ubnVtYmVyU2NhbGUpICogLTE1fWRlZyk7XG4gICAgICAgICAgb3BhY2l0eTogJHthbmltLm51bWJlck9wYWNpdHl9O1xuICAgICAgICBcIj4ke2Rpc3BsYXlOdW19PC9kaXY+XG4gICAgICBgO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG51bWJlckJhZGdlID0gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgZm9udC1zaXplOiAke251bVNpemUgKiAwLjd9cHg7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6IDkwMDtcbiAgICAgICAgICBjb2xvcjogJHthY2NlbnRDb2xvcn07XG4gICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgke2FuaW0ubnVtYmVyU2NhbGV9KTtcbiAgICAgICAgICBvcGFjaXR5OiAke2FuaW0ubnVtYmVyT3BhY2l0eX07XG4gICAgICAgICAgbWluLXdpZHRoOiAke251bVNpemV9cHg7XG4gICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICBcIj4ke2Rpc3BsYXlOdW19PC9kaXY+XG4gICAgICBgO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICBsZWZ0OiAke3dpZHRoICogMC4wNn1weDtcbiAgICAgICAgcmlnaHQ6ICR7d2lkdGggKiAwLjA2fXB4O1xuICAgICAgICB0b3A6ICR7eX1weDtcbiAgICAgICAgaGVpZ2h0OiAke2l0ZW1IZWlnaHR9cHg7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIGdhcDogJHtpdGVtUGFkZGluZ31weDtcbiAgICAgIFwiPlxuICAgICAgICAke251bWJlckJhZGdlfVxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoJHthbmltLnRleHRUcmFuc2xhdGVYfXB4KTtcbiAgICAgICAgICBvcGFjaXR5OiAke2FuaW0udGV4dE9wYWNpdHl9O1xuICAgICAgICBcIj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICBmb250LXNpemU6ICR7YmFzZUZvbnRTaXplICogMS4xfXB4O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgICAgICAgIGNvbG9yOiAke3RleHRDb2xvcn07XG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMS4yO1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xuICAgICAgICAgIFwiPiR7aXRlbS50aXRsZX08L2Rpdj5cbiAgICAgICAgICAke2l0ZW0uc3VidGl0bGUgPyBgXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICAgIGZvbnQtc2l6ZTogJHtiYXNlRm9udFNpemUgKiAwLjc1fXB4O1xuICAgICAgICAgICAgICBjb2xvcjogJHttdXRlZENvbG9yfTtcbiAgICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgICAgICAgIFwiPiR7aXRlbS5zdWJ0aXRsZX08L2Rpdj5cbiAgICAgICAgICBgIDogXCJcIn1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICBgO1xuICAgICAgfSlcbiAgICAgIC5qb2luKFwiXCIpO1xuXG4gICAgY29uc3QgY2VsZWJyYXRpb25PcGFjaXR5ID0gZmluYWxIb2xkUHJvZ3Jlc3MgPiAwID8gTWF0aC5zaW4oZmluYWxIb2xkUHJvZ3Jlc3MgKiBNYXRoLlBJKSAqIDAuMyA6IDA7XG5cbiAgICByZXR1cm4gYFxuICAgIDxkaXYgc3R5bGU9XCJ3aWR0aDoke3dpZHRofXB4O2hlaWdodDoke2hlaWdodH1weDtiYWNrZ3JvdW5kOiR7YmdDb2xvcn07Zm9udC1mYW1pbHk6LWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsJ1NlZ29lIFVJJyxIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZjtwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW47b3BhY2l0eToke2dsb2JhbE9wYWNpdHl9O1wiPlxuXG4gICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChlbGxpcHNlIGF0IDMwJSAyMCUsICR7YWNjZW50Q29sb3J9MTAgMCUsIHRyYW5zcGFyZW50IDUwJSk7cG9pbnRlci1ldmVudHM6bm9uZTtcIj48L2Rpdj5cblxuICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2dyb3VuZDoke2FjY2VudENvbG9yfTtvcGFjaXR5OiR7Y2VsZWJyYXRpb25PcGFjaXR5fTtwb2ludGVyLWV2ZW50czpub25lO1wiPjwvZGl2PlxuXG4gICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgdG9wOiAwO1xuICAgICAgICBsZWZ0OiAwO1xuICAgICAgICByaWdodDogMDtcbiAgICAgICAgaGVpZ2h0OiAke2hlYWRlckhlaWdodH1weDtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgIHBhZGRpbmc6IDAgJHt3aWR0aCAqIDAuMDZ9cHg7XG4gICAgICAgIG9wYWNpdHk6ICR7dGl0bGVQcm9ncmVzc307XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgkeygxIC0gdGl0bGVQcm9ncmVzcykgKiAtMjB9cHgpO1xuICAgICAgXCI+XG4gICAgICAgIDxoMSBzdHlsZT1cIlxuICAgICAgICAgIGZvbnQtc2l6ZTogJHt0aXRsZUZvbnRTaXplfXB4O1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiA4MDA7XG4gICAgICAgICAgY29sb3I6ICR7dGV4dENvbG9yfTtcbiAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgbGluZS1oZWlnaHQ6IDEuMjtcbiAgICAgICAgICBsZXR0ZXItc3BhY2luZzogLTAuMDJlbTtcbiAgICAgICAgXCI+JHt0aXRsZX08L2gxPlxuICAgICAgPC9kaXY+XG5cbiAgICAgICR7aXRlbXNIdG1sfVxuXG4gICAgPC9kaXY+XG4gIGA7XG4gIH0sXG59KTtcbiJdLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMF0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBY0EsU0FBUyxlQUFlLFVBQVU7RUFDakMsTUFBTSxRQUFRLE9BQU8sS0FBSyxRQUFRO0VBQ2xDLElBQUksTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLE1BQU0seURBQXlEO0VBQ2pHLE1BQU0sVUFBVSxNQUFNLEtBQUssU0FBUztHQUNuQyxNQUFNLElBQUksU0FBUztHQUNuQixJQUFJLENBQUMsT0FBTyxTQUFTLENBQUMsS0FBSyxLQUFLLEdBQUcsTUFBTSxJQUFJLE1BQU0sOEJBQThCLEtBQUsscUNBQXFDLEVBQUUsRUFBRTtHQUMvSCxPQUFPO0VBQ1IsQ0FBQztFQUNELE1BQU0sZUFBZSxRQUFRLFFBQVEsR0FBRyxNQUFN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