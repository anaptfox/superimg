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
	//#region examples/interfaces/claude/claude.media.ts
	function messageWeight(text) {
		return Math.max(1.2, text.length / 45);
	}
	function estimateChatTimeline(data) {
		const pace = data.timingPreset === "rapid" ? .85 : data.timingPreset === "dramatic" ? 1.25 : 1;
		const weights = data.messages.map((m) => messageWeight(m.text));
		const messagesS = Math.max(2, weights.reduce((a, w) => a + w, 0) * 1.55 * pace);
		return layoutTimeline({
			messages: messagesS,
			hold: Math.max(.55, messagesS * (1 / 9))
		});
	}
	//#endregion
	exports.default = define({
		sample: {
			messages: [{
				id: "1",
				text: "What's the best way to learn programming?",
				role: "user"
			}, {
				id: "2",
				text: "Start with a project you care about. The motivation to build something real will carry you through the frustrating parts.",
				role: "assistant"
			}],
			model: "claude-4-sonnet",
			theme: "light",
			timingPreset: "natural",
			showHeader: true,
			showThinkingIndicator: true
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "8s"
		},
		resolve({ data }) {
			const { totalSeconds, phases } = estimateChatTimeline(data);
			return {
				duration: `${totalSeconds}s`,
				phases
			};
		},
		render(ctx) {
			const { std, width, height, data } = ctx;
			const { messages, model, theme, timingPreset, showHeader, showThinkingIndicator } = data;
			const msgCount = messages.length;
			const seqEnter = timingPreset === "rapid" ? .25 : timingPreset === "dramatic" ? .45 : .35;
			const { phases } = estimateChatTimeline(data);
			const t = ctx.director(phases);
			const weights = messages.map((m) => messageWeight(m.text));
			const stk = std.stack(messages, {
				during: t.in("messages"),
				lead: .05,
				trail: .05,
				enter: seqEnter,
				weights
			});
			const THEME = theme === "dark" ? {
				bg: "#1a1a1a",
				userBg: "#2d2d2d",
				assistantBg: "transparent",
				text: "#f5f5f5",
				mutedText: "#a0a0a0",
				accent: "#D97757",
				border: "#3d3d3d",
				headerBg: "#1a1a1a",
				inputBg: "#2d2d2d"
			} : {
				bg: "#FAF9F5",
				userBg: "#F0EDE6",
				assistantBg: "transparent",
				text: "#1a1a1a",
				mutedText: "#6b6b6b",
				accent: "#D97757",
				border: "#E5E2DB",
				headerBg: "#FAF9F5",
				inputBg: "#F0EDE6"
			};
			const baseFontSize = Math.min(width, height) * .03;
			const headerHeight = showHeader ? height * .08 : 0;
			const footerHeight = height * .1;
			const contentPadding = width * .06;
			const maxContentWidth = Math.min(width * .85, 680);
			const logoSize = baseFontSize * 1.4;
			const claudeLogo = `
      <div style="
        width:${logoSize}px;
        height:${logoSize}px;
        background:${THEME.accent};
        border-radius:${logoSize * .3}px;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
      ">
        <svg width="${logoSize * .6}" height="${logoSize * .6}" viewBox="0 0 24 24" fill="white">
          <path t="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
    `;
			function renderThinkingIndicator(progress) {
				const shimmerPos = progress * 200 % 100;
				return `
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * .6}px;
          padding:${baseFontSize * .5}px 0;
        ">
          ${claudeLogo}
          <div style="
            width:${baseFontSize * 6}px;
            height:${baseFontSize * .3}px;
            background:linear-gradient(90deg, ${THEME.border} 0%, ${THEME.accent} ${shimmerPos}%, ${THEME.border} 100%);
            border-radius:${baseFontSize * .15}px;
          "></div>
        </div>
      `;
			}
			let messagesHtml = "";
			let currentThinkingHtml = "";
			for (let i = 0; i < msgCount; i++) {
				const msg = messages[i];
				const item = stk.state(i);
				if (item.state === "hidden") continue;
				if (msg.role === "assistant") {
					if (showThinkingIndicator && item.state === "entering" && item.slot < .5) {
						currentThinkingHtml = renderThinkingIndicator(item.slot * 2);
						continue;
					}
					const typeP = item.state === "revealed" ? 1 : item.state === "entering" ? std.interpolate(item.slot, [.5, 1], [0, 1]) : 0;
					if (typeP <= 0) continue;
					const { visible: displayText, typing } = std.text.type(msg.text, typeP);
					const cursorHtml = typing && item.state === "entering" ? `<span style="
          display:inline-block;
          width:2px;
          height:1.1em;
          background:${THEME.accent};
          margin-left:2px;
          vertical-align:text-bottom;
          animation:blink 0.5s infinite;
        "></span>` : "";
					const opacity = item.state === "entering" ? item.enter : 1;
					messagesHtml += `
          <div style="
            display:flex;
            align-items:flex-start;
            gap:${baseFontSize * .6}px;
            padding:${baseFontSize * .8}px 0;
            opacity:${opacity};
          ">
            ${claudeLogo}
            <div style="
              flex:1;
              font-size:${baseFontSize}px;
              line-height:1.6;
              color:${THEME.text};
              white-space:pre-wrap;
              word-wrap:break-word;
            ">${displayText}${cursorHtml}</div>
          </div>
        `;
				} else {
					const opacity = item.enter;
					const translateY = item.state === "entering" ? std.interpolate(item.enter, [0, 1], [10, 0], "easeOutCubic") : 0;
					messagesHtml += `
          <div style="
            display:flex;
            justify-content:flex-end;
            padding:${baseFontSize * .5}px 0;
            opacity:${opacity};
            transform:translateY(${translateY}px);
          ">
            <div style="
              max-width:80%;
              background:${THEME.userBg};
              padding:${baseFontSize * .7}px ${baseFontSize}px;
              border-radius:${baseFontSize * 1.2}px;
              font-size:${baseFontSize}px;
              line-height:1.5;
              color:${THEME.text};
              word-wrap:break-word;
            ">${msg.text}</div>
          </div>
        `;
				}
			}
			const modelDisplay = model === "claude-4-opus" ? "Claude 4 Opus" : model === "claude-4-sonnet" ? "Claude 4 Sonnet" : "Claude 3.5 Sonnet";
			const headerHtml = showHeader ? `
      <div style="
        height:${headerHeight}px;
        background:${THEME.headerBg};
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:0 ${contentPadding}px;
        border-bottom:1px solid ${THEME.border};
      ">
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * .5}px;
          font-size:${baseFontSize * 1.1}px;
          font-weight:600;
          color:${THEME.text};
        ">
          ${claudeLogo}
          <span>Claude</span>
        </div>
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * .3}px;
          font-size:${baseFontSize * .8}px;
          color:${THEME.mutedText};
          background:${THEME.userBg};
          padding:${baseFontSize * .3}px ${baseFontSize * .6}px;
          border-radius:${baseFontSize * .5}px;
        ">
          <span>${modelDisplay}</span>
          <span style="font-size:${baseFontSize * .6}px;">▼</span>
        </div>
      </div>
    ` : "";
			const footerHtml = `
      <div style="
        position:absolute;
        bottom:0;
        left:0;
        right:0;
        height:${footerHeight}px;
        background:${THEME.bg};
        display:flex;
        align-items:center;
        justify-content:center;
        padding:0 ${contentPadding}px;
      ">
        <div style="
          width:100%;
          max-width:${maxContentWidth}px;
          background:${THEME.inputBg};
          border:1px solid ${THEME.border};
          border-radius:${baseFontSize * 1.5}px;
          padding:${baseFontSize * .7}px ${baseFontSize}px;
          display:flex;
          align-items:center;
          justify-content:space-between;
        ">
          <span style="
            font-size:${baseFontSize * .9}px;
            color:${THEME.mutedText};
          ">Reply to Claude...</span>
          <div style="
            width:${baseFontSize * 1.5}px;
            height:${baseFontSize * 1.5}px;
            background:${THEME.accent};
            border-radius:${baseFontSize * .4}px;
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <span style="color:white;font-size:${baseFontSize * .8}px;">↑</span>
          </div>
        </div>
      </div>
    `;
			return `
      <style>@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:${THEME.bg};
        font-family:'Styrene A', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position:relative;
        overflow:hidden;
      ">
        ${headerHtml}

        <div style="
          position:absolute;
          top:${headerHeight}px;
          left:0;
          right:0;
          bottom:${footerHeight}px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          padding:${baseFontSize}px ${contentPadding}px;
        ">
          <div style="
            max-width:${maxContentWidth}px;
            width:100%;
            margin:0 auto;
          ">
            ${messagesHtml}
            ${currentThinkingHtml}
          </div>
        </div>

        ${footerHtml}
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhdWRlLm1lZGlhLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3N1cGVyaW1nLWNvcmUvbm9kZV9tb2R1bGVzL0BzdXBlcmltZy9zdGRsaWIvZGlzdC9sYXlvdXQtdGltZWxpbmUuanMiLCIuLi9wYWNrYWdlcy9zdXBlcmltZy10eXBlcy9kaXN0L2luZGV4LmpzIiwiLi4vZXhhbXBsZXMvaW50ZXJmYWNlcy9jbGF1ZGUvY2xhdWRlLm1lZGlhLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvbGF5b3V0LXRpbWVsaW5lLnRzXG4vKipcbiogTWFwIGFic29sdXRlLXNlY29uZCBzZWdtZW50cyB0byBhIGRpcmVjdG9yIHBoYXNlIGxheW91dC5cbipcbiogQHBhcmFtIHNlZ21lbnRzIC0gbmFtZSDihpIgZHVyYXRpb24gaW4gc2Vjb25kcyAobXVzdCBiZSA+IDApLiBPYmplY3Qga2V5IG9yZGVyIGlzIHByZXNlcnZlZC5cbiogQHJldHVybnMgcGVyY2VudCBwaGFzZXMgKHN1bSAxMDAlKSwgdG90YWxTZWNvbmRzLCBhbmQgc3RhYmxlIG9yZGVyXG4qXG4qIEBleGFtcGxlXG4qIGBgYHRzXG4qIGNvbnN0IHsgcGhhc2VzLCB0b3RhbFNlY29uZHMgfSA9IGxheW91dFRpbWVsaW5lKHsgYm9vdDogMSwgdHlwZTogMiwgZXZlbnRfMDogMC45IH0pO1xuKiAvLyByZXNvbHZlOiByZXR1cm4geyBkdXJhdGlvbjogYCR7dG90YWxTZWNvbmRzfXNgLCBwaGFzZXMgfVxuKiAvLyByZW5kZXI6ICBjb25zdCBkID0gY3R4LmRpcmVjdG9yKHBoYXNlcylcbiogYGBgXG4qL1xuZnVuY3Rpb24gbGF5b3V0VGltZWxpbmUoc2VnbWVudHMpIHtcblx0Y29uc3Qgb3JkZXIgPSBPYmplY3Qua2V5cyhzZWdtZW50cyk7XG5cdGlmIChvcmRlci5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihcImxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnRzIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgcGhhc2VcIik7XG5cdGNvbnN0IHNlY29uZHMgPSBvcmRlci5tYXAoKG5hbWUpID0+IHtcblx0XHRjb25zdCBzID0gc2VnbWVudHNbbmFtZV07XG5cdFx0aWYgKCFOdW1iZXIuaXNGaW5pdGUocykgfHwgcyA8PSAwKSB0aHJvdyBuZXcgRXJyb3IoYGxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnQgXCIke25hbWV9XCIgbXVzdCBiZSBhIGZpbml0ZSBudW1iZXIgPiAwIChnb3QgJHtzfSlgKTtcblx0XHRyZXR1cm4gcztcblx0fSk7XG5cdGNvbnN0IHRvdGFsU2Vjb25kcyA9IHNlY29uZHMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG5cdGNvbnN0IHBoYXNlcyA9IHt9O1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IG9yZGVyLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgbmFtZSA9IG9yZGVyW2ldO1xuXHRcdHBoYXNlc1tuYW1lXSA9IGAke3NlY29uZHNbaV0gLyB0b3RhbFNlY29uZHMgKiAxMDB9JWA7XG5cdH1cblx0cmV0dXJuIHtcblx0XHRwaGFzZXMsXG5cdFx0dG90YWxTZWNvbmRzLFxuXHRcdG9yZGVyXG5cdH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGxheW91dFRpbWVsaW5lIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWxheW91dC10aW1lbGluZS5qcy5tYXAiLCIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSwgbGF5b3V0VGltZWxpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENsYXVkZU1lc3NhZ2Uge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHJvbGU6IFwidXNlclwiIHwgXCJhc3Npc3RhbnRcIjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDbGF1ZGVEYXRhIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBtZXNzYWdlczogQ2xhdWRlTWVzc2FnZVtdO1xuICBtb2RlbDogXCJjbGF1ZGUtNC1vcHVzXCIgfCBcImNsYXVkZS00LXNvbm5ldFwiIHwgXCJjbGF1ZGUtMy41LXNvbm5ldFwiO1xuICB0aGVtZTogXCJkYXJrXCIgfCBcImxpZ2h0XCI7XG4gIHRpbWluZ1ByZXNldDogXCJyYXBpZFwiIHwgXCJuYXR1cmFsXCIgfCBcImRyYW1hdGljXCI7XG4gIHNob3dIZWFkZXI6IGJvb2xlYW47XG4gIHNob3dUaGlua2luZ0luZGljYXRvcjogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gbWVzc2FnZVdlaWdodCh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5tYXgoMS4yLCB0ZXh0Lmxlbmd0aCAvIDQ1KTtcbn1cblxuZnVuY3Rpb24gZXN0aW1hdGVDaGF0VGltZWxpbmUoZGF0YTogQ2xhdWRlRGF0YSkge1xuICBjb25zdCBwYWNlID1cbiAgICBkYXRhLnRpbWluZ1ByZXNldCA9PT0gXCJyYXBpZFwiID8gMC44NSA6IGRhdGEudGltaW5nUHJlc2V0ID09PSBcImRyYW1hdGljXCIgPyAxLjI1IDogMTtcbiAgY29uc3Qgd2VpZ2h0cyA9IGRhdGEubWVzc2FnZXMubWFwKChtKSA9PiBtZXNzYWdlV2VpZ2h0KG0udGV4dCkpO1xuICBjb25zdCBtZXNzYWdlc1MgPSBNYXRoLm1heCgyLCB3ZWlnaHRzLnJlZHVjZSgoYSwgdykgPT4gYSArIHcsIDApICogMS41NSAqIHBhY2UpO1xuICBjb25zdCBob2xkUyA9IE1hdGgubWF4KDAuNTUsIG1lc3NhZ2VzUyAqICgxIC8gOSkpO1xuICByZXR1cm4gbGF5b3V0VGltZWxpbmUoeyBtZXNzYWdlczogbWVzc2FnZXNTLCBob2xkOiBob2xkUyB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lPENsYXVkZURhdGE+KHtcbiAgc2FtcGxlOiB7XG4gICAgbWVzc2FnZXM6IFtcbiAgICAgIHsgaWQ6IFwiMVwiLCB0ZXh0OiBcIldoYXQncyB0aGUgYmVzdCB3YXkgdG8gbGVhcm4gcHJvZ3JhbW1pbmc/XCIsIHJvbGU6IFwidXNlclwiIH0sXG4gICAgICB7IGlkOiBcIjJcIiwgdGV4dDogXCJTdGFydCB3aXRoIGEgcHJvamVjdCB5b3UgY2FyZSBhYm91dC4gVGhlIG1vdGl2YXRpb24gdG8gYnVpbGQgc29tZXRoaW5nIHJlYWwgd2lsbCBjYXJyeSB5b3UgdGhyb3VnaCB0aGUgZnJ1c3RyYXRpbmcgcGFydHMuXCIsIHJvbGU6IFwiYXNzaXN0YW50XCIgfSxcbiAgICBdLFxuICAgIG1vZGVsOiBcImNsYXVkZS00LXNvbm5ldFwiLFxuICAgIHRoZW1lOiBcImxpZ2h0XCIsXG4gICAgdGltaW5nUHJlc2V0OiBcIm5hdHVyYWxcIixcbiAgICBzaG93SGVhZGVyOiB0cnVlLFxuICAgIHNob3dUaGlua2luZ0luZGljYXRvcjogdHJ1ZSxcbiAgfSxcbiAgY29uZmlnOiB7XG4gICAgd2lkdGg6IDE5MjAsXG4gICAgaGVpZ2h0OiAxMDgwLFxuICAgIGZwczogMzAsXG4gICAgZHVyYXRpb246IFwiOHNcIiwgLy8gQVNUIGZhbGxiYWNrOyByZXNvbHZlKCkgb3ZlcnJpZGVzXG4gIH0sXG4gIHJlc29sdmUoeyBkYXRhIH0pIHtcbiAgICBjb25zdCB7IHRvdGFsU2Vjb25kcywgcGhhc2VzIH0gPSBlc3RpbWF0ZUNoYXRUaW1lbGluZShkYXRhKTtcbiAgICByZXR1cm4geyBkdXJhdGlvbjogYCR7dG90YWxTZWNvbmRzfXNgLCBwaGFzZXMgfTtcbiAgfSxcbiAgcmVuZGVyKGN0eDogUmVuZGVyQ29udGV4dDxDbGF1ZGVEYXRhPikge1xuICAgIGNvbnN0IHsgc3RkLCB3aWR0aCwgaGVpZ2h0LCBkYXRhIH0gPSBjdHg7XG4gICAgY29uc3Qge1xuICAgICAgbWVzc2FnZXMsXG4gICAgICBtb2RlbCxcbiAgICAgIHRoZW1lLFxuICAgICAgdGltaW5nUHJlc2V0LFxuICAgICAgc2hvd0hlYWRlcixcbiAgICAgIHNob3dUaGlua2luZ0luZGljYXRvcixcbiAgICB9ID0gZGF0YTtcblxuICAgIGNvbnN0IG1zZ0NvdW50ID0gbWVzc2FnZXMubGVuZ3RoO1xuICAgIGNvbnN0IHNlcUVudGVyID0gdGltaW5nUHJlc2V0ID09PSBcInJhcGlkXCIgPyAwLjI1IDogdGltaW5nUHJlc2V0ID09PSBcImRyYW1hdGljXCIgPyAwLjQ1IDogMC4zNTtcbiAgICBjb25zdCB7IHBoYXNlcyB9ID0gZXN0aW1hdGVDaGF0VGltZWxpbmUoZGF0YSk7XG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3RvcihwaGFzZXMpO1xuICAgIGNvbnN0IHdlaWdodHMgPSBtZXNzYWdlcy5tYXAoKG0pID0+IG1lc3NhZ2VXZWlnaHQobS50ZXh0KSk7XG4gICAgY29uc3Qgc3RrID0gc3RkLnN0YWNrKG1lc3NhZ2VzLCB7XG4gICAgICBkdXJpbmc6IHQuaW4oXCJtZXNzYWdlc1wiKSxcbiAgICAgIGxlYWQ6IDAuMDUsXG4gICAgICB0cmFpbDogMC4wNSxcbiAgICAgIGVudGVyOiBzZXFFbnRlcixcbiAgICAgIHdlaWdodHMsXG4gICAgfSk7XG5cbiAgICAvLyBDbGF1ZGUgY29sb3JzXG4gICAgY29uc3QgVEhFTUUgPSB0aGVtZSA9PT0gXCJkYXJrXCIgPyB7XG4gICAgICBiZzogXCIjMWExYTFhXCIsXG4gICAgICB1c2VyQmc6IFwiIzJkMmQyZFwiLFxuICAgICAgYXNzaXN0YW50Qmc6IFwidHJhbnNwYXJlbnRcIixcbiAgICAgIHRleHQ6IFwiI2Y1ZjVmNVwiLFxuICAgICAgbXV0ZWRUZXh0OiBcIiNhMGEwYTBcIixcbiAgICAgIGFjY2VudDogXCIjRDk3NzU3XCIsXG4gICAgICBib3JkZXI6IFwiIzNkM2QzZFwiLFxuICAgICAgaGVhZGVyQmc6IFwiIzFhMWExYVwiLFxuICAgICAgaW5wdXRCZzogXCIjMmQyZDJkXCIsXG4gICAgfSA6IHtcbiAgICAgIGJnOiBcIiNGQUY5RjVcIixcbiAgICAgIHVzZXJCZzogXCIjRjBFREU2XCIsXG4gICAgICBhc3Npc3RhbnRCZzogXCJ0cmFuc3BhcmVudFwiLFxuICAgICAgdGV4dDogXCIjMWExYTFhXCIsXG4gICAgICBtdXRlZFRleHQ6IFwiIzZiNmI2YlwiLFxuICAgICAgYWNjZW50OiBcIiNEOTc3NTdcIixcbiAgICAgIGJvcmRlcjogXCIjRTVFMkRCXCIsXG4gICAgICBoZWFkZXJCZzogXCIjRkFGOUY1XCIsXG4gICAgICBpbnB1dEJnOiBcIiNGMEVERTZcIixcbiAgICB9O1xuXG4gICAgY29uc3QgYmFzZUZvbnRTaXplID0gTWF0aC5taW4od2lkdGgsIGhlaWdodCkgKiAwLjAzO1xuICAgIGNvbnN0IGhlYWRlckhlaWdodCA9IHNob3dIZWFkZXIgPyBoZWlnaHQgKiAwLjA4IDogMDtcbiAgICBjb25zdCBmb290ZXJIZWlnaHQgPSBoZWlnaHQgKiAwLjE7XG4gICAgY29uc3QgY29udGVudFBhZGRpbmcgPSB3aWR0aCAqIDAuMDY7XG4gICAgY29uc3QgbWF4Q29udGVudFdpZHRoID0gTWF0aC5taW4od2lkdGggKiAwLjg1LCA2ODApO1xuXG4gICAgY29uc3QgbG9nb1NpemUgPSBiYXNlRm9udFNpemUgKiAxLjQ7XG4gICAgY29uc3QgY2xhdWRlTG9nbyA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgd2lkdGg6JHtsb2dvU2l6ZX1weDtcbiAgICAgICAgaGVpZ2h0OiR7bG9nb1NpemV9cHg7XG4gICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS5hY2NlbnR9O1xuICAgICAgICBib3JkZXItcmFkaXVzOiR7bG9nb1NpemUgKiAwLjN9cHg7XG4gICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6Y2VudGVyO1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO1xuICAgICAgICBmbGV4LXNocmluazowO1xuICAgICAgXCI+XG4gICAgICAgIDxzdmcgd2lkdGg9XCIke2xvZ29TaXplICogMC42fVwiIGhlaWdodD1cIiR7bG9nb1NpemUgKiAwLjZ9XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJ3aGl0ZVwiPlxuICAgICAgICAgIDxwYXRoIHQ9XCJNMTIgMkwyIDdsMTAgNSAxMC01LTEwLTV6TTIgMTdsMTAgNSAxMC01TTIgMTJsMTAgNSAxMC01XCIvPlxuICAgICAgICA8L3N2Zz5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICBmdW5jdGlvbiByZW5kZXJUaGlua2luZ0luZGljYXRvcihwcm9ncmVzczogbnVtYmVyKTogc3RyaW5nIHtcbiAgICAgIGNvbnN0IHNoaW1tZXJQb3MgPSAocHJvZ3Jlc3MgKiAyMDApICUgMTAwO1xuXG4gICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAgICBnYXA6JHtiYXNlRm9udFNpemUgKiAwLjZ9cHg7XG4gICAgICAgICAgcGFkZGluZzoke2Jhc2VGb250U2l6ZSAqIDAuNX1weCAwO1xuICAgICAgICBcIj5cbiAgICAgICAgICAke2NsYXVkZUxvZ299XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgICAgd2lkdGg6JHtiYXNlRm9udFNpemUgKiA2fXB4O1xuICAgICAgICAgICAgaGVpZ2h0OiR7YmFzZUZvbnRTaXplICogMC4zfXB4O1xuICAgICAgICAgICAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsICR7VEhFTUUuYm9yZGVyfSAwJSwgJHtUSEVNRS5hY2NlbnR9ICR7c2hpbW1lclBvc30lLCAke1RIRU1FLmJvcmRlcn0gMTAwJSk7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiR7YmFzZUZvbnRTaXplICogMC4xNX1weDtcbiAgICAgICAgICBcIj48L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICBgO1xuICAgIH1cblxuICAgIGxldCBtZXNzYWdlc0h0bWwgPSBcIlwiO1xuICAgIGxldCBjdXJyZW50VGhpbmtpbmdIdG1sID0gXCJcIjtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXNnQ291bnQ7IGkrKykge1xuICAgICAgY29uc3QgbXNnID0gbWVzc2FnZXNbaV0hO1xuICAgICAgY29uc3QgaXRlbSA9IHN0ay5zdGF0ZShpKTtcbiAgICAgIGlmIChpdGVtLnN0YXRlID09PSBcImhpZGRlblwiKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXNBc3Npc3RhbnQgPSBtc2cucm9sZSA9PT0gXCJhc3Npc3RhbnRcIjtcblxuICAgICAgaWYgKGlzQXNzaXN0YW50KSB7XG4gICAgICAgIGlmIChzaG93VGhpbmtpbmdJbmRpY2F0b3IgJiYgaXRlbS5zdGF0ZSA9PT0gXCJlbnRlcmluZ1wiICYmIGl0ZW0uc2xvdCA8IDAuNSkge1xuICAgICAgICAgIGN1cnJlbnRUaGlua2luZ0h0bWwgPSByZW5kZXJUaGlua2luZ0luZGljYXRvcihpdGVtLnNsb3QgKiAyKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHR5cGVQID0gaXRlbS5zdGF0ZSA9PT0gXCJyZXZlYWxlZFwiXG4gICAgICAgICAgPyAxXG4gICAgICAgICAgOiBpdGVtLnN0YXRlID09PSBcImVudGVyaW5nXCJcbiAgICAgICAgICAgID8gc3RkLmludGVycG9sYXRlKGl0ZW0uc2xvdCwgWzAuNSwgMV0sIFswLCAxXSlcbiAgICAgICAgICAgIDogMDtcbiAgICAgICAgaWYgKHR5cGVQIDw9IDApIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IHsgdmlzaWJsZTogZGlzcGxheVRleHQsIHR5cGluZyB9ID0gc3RkLnRleHQudHlwZShtc2cudGV4dCwgdHlwZVApO1xuICAgICAgICBjb25zdCBzaG93Q3Vyc29yID0gdHlwaW5nICYmIGl0ZW0uc3RhdGUgPT09IFwiZW50ZXJpbmdcIjtcbiAgICAgICAgY29uc3QgY3Vyc29ySHRtbCA9IHNob3dDdXJzb3IgPyBgPHNwYW4gc3R5bGU9XCJcbiAgICAgICAgICBkaXNwbGF5OmlubGluZS1ibG9jaztcbiAgICAgICAgICB3aWR0aDoycHg7XG4gICAgICAgICAgaGVpZ2h0OjEuMWVtO1xuICAgICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS5hY2NlbnR9O1xuICAgICAgICAgIG1hcmdpbi1sZWZ0OjJweDtcbiAgICAgICAgICB2ZXJ0aWNhbC1hbGlnbjp0ZXh0LWJvdHRvbTtcbiAgICAgICAgICBhbmltYXRpb246YmxpbmsgMC41cyBpbmZpbml0ZTtcbiAgICAgICAgXCI+PC9zcGFuPmAgOiBcIlwiO1xuXG4gICAgICAgIGNvbnN0IG9wYWNpdHkgPSBpdGVtLnN0YXRlID09PSBcImVudGVyaW5nXCIgPyBpdGVtLmVudGVyIDogMTtcblxuICAgICAgICBtZXNzYWdlc0h0bWwgKz0gYFxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBnYXA6JHtiYXNlRm9udFNpemUgKiAwLjZ9cHg7XG4gICAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC44fXB4IDA7XG4gICAgICAgICAgICBvcGFjaXR5OiR7b3BhY2l0eX07XG4gICAgICAgICAgXCI+XG4gICAgICAgICAgICAke2NsYXVkZUxvZ299XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICAgIGZsZXg6MTtcbiAgICAgICAgICAgICAgZm9udC1zaXplOiR7YmFzZUZvbnRTaXplfXB4O1xuICAgICAgICAgICAgICBsaW5lLWhlaWdodDoxLjY7XG4gICAgICAgICAgICAgIGNvbG9yOiR7VEhFTUUudGV4dH07XG4gICAgICAgICAgICAgIHdoaXRlLXNwYWNlOnByZS13cmFwO1xuICAgICAgICAgICAgICB3b3JkLXdyYXA6YnJlYWstd29yZDtcbiAgICAgICAgICAgIFwiPiR7ZGlzcGxheVRleHR9JHtjdXJzb3JIdG1sfTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgb3BhY2l0eSA9IGl0ZW0uZW50ZXI7XG4gICAgICAgIGNvbnN0IHRyYW5zbGF0ZVkgPSBpdGVtLnN0YXRlID09PSBcImVudGVyaW5nXCJcbiAgICAgICAgICA/IHN0ZC5pbnRlcnBvbGF0ZShpdGVtLmVudGVyLCBbMCwgMV0sIFsxMCwgMF0sIFwiZWFzZU91dEN1YmljXCIpXG4gICAgICAgICAgOiAwO1xuXG4gICAgICAgIG1lc3NhZ2VzSHRtbCArPSBgXG4gICAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OmZsZXgtZW5kO1xuICAgICAgICAgICAgcGFkZGluZzoke2Jhc2VGb250U2l6ZSAqIDAuNX1weCAwO1xuICAgICAgICAgICAgb3BhY2l0eToke29wYWNpdHl9O1xuICAgICAgICAgICAgdHJhbnNmb3JtOnRyYW5zbGF0ZVkoJHt0cmFuc2xhdGVZfXB4KTtcbiAgICAgICAgICBcIj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICAgICAgbWF4LXdpZHRoOjgwJTtcbiAgICAgICAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLnVzZXJCZ307XG4gICAgICAgICAgICAgIHBhZGRpbmc6JHtiYXNlRm9udFNpemUgKiAwLjd9cHggJHtiYXNlRm9udFNpemV9cHg7XG4gICAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemUgKiAxLjJ9cHg7XG4gICAgICAgICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZX1weDtcbiAgICAgICAgICAgICAgbGluZS1oZWlnaHQ6MS41O1xuICAgICAgICAgICAgICBjb2xvcjoke1RIRU1FLnRleHR9O1xuICAgICAgICAgICAgICB3b3JkLXdyYXA6YnJlYWstd29yZDtcbiAgICAgICAgICAgIFwiPiR7bXNnLnRleHR9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbW9kZWxEaXNwbGF5ID0gbW9kZWwgPT09IFwiY2xhdWRlLTQtb3B1c1wiID8gXCJDbGF1ZGUgNCBPcHVzXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsID09PSBcImNsYXVkZS00LXNvbm5ldFwiID8gXCJDbGF1ZGUgNCBTb25uZXRcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgXCJDbGF1ZGUgMy41IFNvbm5ldFwiO1xuXG4gICAgY29uc3QgaGVhZGVySHRtbCA9IHNob3dIZWFkZXIgPyBgXG4gICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIGhlaWdodDoke2hlYWRlckhlaWdodH1weDtcbiAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLmhlYWRlckJnfTtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgIGp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBwYWRkaW5nOjAgJHtjb250ZW50UGFkZGluZ31weDtcbiAgICAgICAgYm9yZGVyLWJvdHRvbToxcHggc29saWQgJHtUSEVNRS5ib3JkZXJ9O1xuICAgICAgXCI+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6Y2VudGVyO1xuICAgICAgICAgIGdhcDoke2Jhc2VGb250U2l6ZSAqIDAuNX1weDtcbiAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAxLjF9cHg7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6NjAwO1xuICAgICAgICAgIGNvbG9yOiR7VEhFTUUudGV4dH07XG4gICAgICAgIFwiPlxuICAgICAgICAgICR7Y2xhdWRlTG9nb31cbiAgICAgICAgICA8c3Bhbj5DbGF1ZGU8L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAgICBnYXA6JHtiYXNlRm9udFNpemUgKiAwLjN9cHg7XG4gICAgICAgICAgZm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC44fXB4O1xuICAgICAgICAgIGNvbG9yOiR7VEhFTUUubXV0ZWRUZXh0fTtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiR7VEhFTUUudXNlckJnfTtcbiAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC4zfXB4ICR7YmFzZUZvbnRTaXplICogMC42fXB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemUgKiAwLjV9cHg7XG4gICAgICAgIFwiPlxuICAgICAgICAgIDxzcGFuPiR7bW9kZWxEaXNwbGF5fTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuNn1weDtcIj7ilrw8L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgYCA6IFwiXCI7XG5cbiAgICBjb25zdCBmb290ZXJIdG1sID0gYFxuICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgYm90dG9tOjA7XG4gICAgICAgIGxlZnQ6MDtcbiAgICAgICAgcmlnaHQ6MDtcbiAgICAgICAgaGVpZ2h0OiR7Zm9vdGVySGVpZ2h0fXB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiR7VEhFTUUuYmd9O1xuICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAganVzdGlmeS1jb250ZW50OmNlbnRlcjtcbiAgICAgICAgcGFkZGluZzowICR7Y29udGVudFBhZGRpbmd9cHg7XG4gICAgICBcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIHdpZHRoOjEwMCU7XG4gICAgICAgICAgbWF4LXdpZHRoOiR7bWF4Q29udGVudFdpZHRofXB4O1xuICAgICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS5pbnB1dEJnfTtcbiAgICAgICAgICBib3JkZXI6MXB4IHNvbGlkICR7VEhFTUUuYm9yZGVyfTtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiR7YmFzZUZvbnRTaXplICogMS41fXB4O1xuICAgICAgICAgIHBhZGRpbmc6JHtiYXNlRm9udFNpemUgKiAwLjd9cHggJHtiYXNlRm9udFNpemV9cHg7XG4gICAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtcbiAgICAgICAgXCI+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJcbiAgICAgICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuOX1weDtcbiAgICAgICAgICAgIGNvbG9yOiR7VEhFTUUubXV0ZWRUZXh0fTtcbiAgICAgICAgICBcIj5SZXBseSB0byBDbGF1ZGUuLi48L3NwYW4+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgICAgd2lkdGg6JHtiYXNlRm9udFNpemUgKiAxLjV9cHg7XG4gICAgICAgICAgICBoZWlnaHQ6JHtiYXNlRm9udFNpemUgKiAxLjV9cHg7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiR7VEhFTUUuYWNjZW50fTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemUgKiAwLjR9cHg7XG4gICAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO1xuICAgICAgICAgIFwiPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjp3aGl0ZTtmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjh9cHg7XCI+4oaRPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICByZXR1cm4gYFxuICAgICAgPHN0eWxlPkBrZXlmcmFtZXMgYmxpbmsgeyAwJSwgNTAlIHsgb3BhY2l0eTogMTsgfSA1MSUsIDEwMCUgeyBvcGFjaXR5OiAwOyB9IH08L3N0eWxlPlxuICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICB3aWR0aDoke3dpZHRofXB4O1xuICAgICAgICBoZWlnaHQ6JHtoZWlnaHR9cHg7XG4gICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS5iZ307XG4gICAgICAgIGZvbnQtZmFtaWx5OidTdHlyZW5lIEEnLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZjtcbiAgICAgICAgcG9zaXRpb246cmVsYXRpdmU7XG4gICAgICAgIG92ZXJmbG93OmhpZGRlbjtcbiAgICAgIFwiPlxuICAgICAgICAke2hlYWRlckh0bWx9XG5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIHBvc2l0aW9uOmFic29sdXRlO1xuICAgICAgICAgIHRvcDoke2hlYWRlckhlaWdodH1weDtcbiAgICAgICAgICBsZWZ0OjA7XG4gICAgICAgICAgcmlnaHQ6MDtcbiAgICAgICAgICBib3R0b206JHtmb290ZXJIZWlnaHR9cHg7XG4gICAgICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjpjb2x1bW47XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OmZsZXgtZW5kO1xuICAgICAgICAgIHBhZGRpbmc6JHtiYXNlRm9udFNpemV9cHggJHtjb250ZW50UGFkZGluZ31weDtcbiAgICAgICAgXCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgICAgbWF4LXdpZHRoOiR7bWF4Q29udGVudFdpZHRofXB4O1xuICAgICAgICAgICAgd2lkdGg6MTAwJTtcbiAgICAgICAgICAgIG1hcmdpbjowIGF1dG87XG4gICAgICAgICAgXCI+XG4gICAgICAgICAgICAke21lc3NhZ2VzSHRtbH1cbiAgICAgICAgICAgICR7Y3VycmVudFRoaW5raW5nSHRtbH1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgJHtmb290ZXJIdG1sfVxuICAgICAgPC9kaXY+XG4gICAgYDtcbiAgfSxcbn0pO1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FjQSxTQUFTLGVBQWUsVUFBVTtFQUNqQyxNQUFNLFFBQVEsT0FBTyxLQUFLLFFBQVE7RUFDbEMsSUFBSSxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksTUFBTSx5REFBeUQ7RUFDakcsTUFBTSxVQUFVLE1BQU0sS0FBSyxTQUFTO0dBQ25DLE1BQU0sSUFBSSxTQUFTO0dBQ25CLElBQUksQ0FBQyxPQUFPLFNBQVMsQ0FBQyxLQUFLLEtBQUssR0FBRyxNQUFNLElBQUksTUFBTSw4QkFBOEIsS0FBSyxxQ0FBcUMsRUFBRSxFQUFFO0dBQy9ILE9BQU87RUFDUixDQUFDO0VBQ0QsTUFBTSxlQUFlLFFBQVEsUUFBUSxHQUFHLE1BQU0sSUFBSSxHQUFHLENBQUM7RUFDdEQsTUFBTSxTQUFTLENBQUM7RUFDaEIsS0FBSyxJQUFJLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0dBQ3RDLE1BQU0sT0FBTyxNQUFNO0dBQ25CLE9BQU8sUUFBUSxHQUFHLFFBQVEsS0FBSyxlQUFlLElBQUk7RUFDbkQ7RUFDQSxPQUFPO0dBQ047R0FDQTtHQUNBO0VBQ0Q7Q0FDRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0NKQSxTQUFTLE9BQU8sT0FBTztFQUN0QixNQUFNLFNBQVMsTUFBTSxVQUFVO0VBQy9CLE1BQU0sSUFBSSxNQUFNO0VBQ2hCLE1BQU0sYUFBYSxPQUFPLE1BQU0sWUFBWTtFQUM1QyxPQUFPO0dBQ047R0FDQSxVQUFVLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRSxRQUFRLGFBQWEsRUFBRSxZQUFZLFFBQVE7R0FDckUsUUFBUSxNQUFNO0dBQ2QsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLGFBQWEsRUFBRSxTQUFTLE1BQU0sUUFBUSxJQUFJLENBQUM7RUFDL0M7Q0FDRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0N4QkEsU0FBUyxjQUFjLE1BQXNCO0VBQzNDLE9BQU8sS0FBSyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7Q0FDdkM7Q0FFQSxTQUFTLHFCQUFxQixNQUFrQjtFQUM5QyxNQUFNLE9BQ0osS0FBSyxpQkFBaUIsVUFBVSxNQUFPLEtBQUssaUJBQWlCLGFBQWEsT0FBTztFQUNuRixNQUFNLFVBQVUsS0FBSyxTQUFTLEtBQUssTUFBTSxjQUFjLEVBQUUsSUFBSSxDQUFDO0VBQzlELE1BQU0sWUFBWSxLQUFLLElBQUksR0FBRyxRQUFRLFFBQVEsR0FBRyxNQUFNLElBQUksR0FBRyxDQUFDLElBQUksT0FBTyxJQUFJO0VBRTlFLE9BQU8sZUFBZTtHQUFFLFVBQVU7R0FBVyxNQUQvQixLQUFLLElBQUksS0FBTSxhQUFhLElBQUksRUFDUztFQUFFLENBQUM7Q0FDNUQ7O21CQUVlLE9BQW1CO0VBQ2hDLFFBQVE7R0FDTixVQUFVLENBQ1I7SUFBRSxJQUFJO0lBQUssTUFBTTtJQUE2QyxNQUFNO0dBQU8sR0FDM0U7SUFBRSxJQUFJO0lBQUssTUFBTTtJQUE2SCxNQUFNO0dBQVksQ0FDbEs7R0FDQSxPQUFPO0dBQ1AsT0FBTztHQUNQLGNBQWM7R0FDZCxZQUFZO0dBQ1osdUJBQXVCO0VBQ3pCO0VBQ0EsUUFBUTtHQUNOLE9BQU87R0FDUCxRQUFRO0dBQ1IsS0FBSztHQUNMLFVBQVU7RUFDWjtFQUNBLFFBQVEsRUFBRSxRQUFRO0dBQ2hCLE1BQU0sRUFBRSxjQUFjLFdBQVcscUJBQXFCLElBQUk7R0FDMUQsT0FBTztJQUFFLFVBQVUsR0FBRyxhQUFhO0lBQUk7R0FBTztFQUNoRDtFQUNBLE9BQU8sS0FBZ0M7R0FDckMsTUFBTSxFQUFFLEtBQUssT0FBTyxRQUFRLFNBQVM7R0FDckMsTUFBTSxFQUNKLFVBQ0EsT0FDQSxPQUNBLGNBQ0EsWUFDQSwwQkFDRTtHQUVKLE1BQU0sV0FBVyxTQUFTO0dBQzFCLE1BQU0sV0FBVyxpQkFBaUIsVUFBVSxNQUFPLGlCQUFpQixhQUFhLE1BQU87R0FDeEYsTUFBTSxFQUFFLFdBQVcscUJBQXFCLElBQUk7R0FDNUMsTUFBTSxJQUFJLElBQUksU0FBUyxNQUFNO0dBQzdCLE1BQU0sVUFBVSxTQUFTLEtBQUssTUFBTSxjQUFjLEVBQUUsSUFBSSxDQUFDO0dBQ3pELE1BQU0sTUFBTSxJQUFJLE1BQU0sVUFBVTtJQUM5QixRQUFRLEVBQUUsR0FBRyxVQUFVO0lBQ3ZCLE1BQU07SUFDTixPQUFPO0lBQ1AsT0FBTztJQUNQO0dBQ0YsQ0FBQztHQUdELE1BQU0sUUFBUSxVQUFVLFNBQVM7SUFDL0IsSUFBSTtJQUNKLFFBQVE7SUFDUixhQUFhO0lBQ2IsTUFBTTtJQUNOLFdBQVc7SUFDWCxRQUFRO0lBQ1IsUUFBUTtJQUNSLFVBQVU7SUFDVixTQUFTO0dBQ1gsSUFBSTtJQUNGLElBQUk7SUFDSixRQUFRO0lBQ1IsYUFBYTtJQUNiLE1BQU07SUFDTixXQUFXO0lBQ1gsUUFBUTtJQUNSLFFBQVE7SUFDUixVQUFVO0lBQ1YsU0FBUztHQUNYO0dBRUEsTUFBTSxlQUFlLEtBQUssSUFBSSxPQUFPLE1BQU0sSUFBSTtHQUMvQyxNQUFNLGVBQWUsYUFBYSxTQUFTLE1BQU87R0FDbEQsTUFBTSxlQUFlLFNBQVM7R0FDOUIsTUFBTSxpQkFBaUIsUUFBUTtHQUMvQixNQUFNLGtCQUFrQixLQUFLLElBQUksUUFBUSxLQUFNLEdBQUc7R0FFbEQsTUFBTSxXQUFXLGVBQWU7R0FDaEMsTUFBTSxhQUFhOztnQkFFUCxTQUFTO2lCQUNSLFNBQVM7cUJBQ0wsTUFBTSxPQUFPO3dCQUNWLFdBQVcsR0FBSTs7Ozs7O3NCQU1qQixXQUFXLEdBQUksWUFBWSxXQUFXLEdBQUk7Ozs7O0dBTTVELFNBQVMsd0JBQXdCLFVBQTBCO0lBQ3pELE1BQU0sYUFBYyxXQUFXLE1BQU87SUFFdEMsT0FBTzs7OztnQkFJRyxlQUFlLEdBQUk7b0JBQ2YsZUFBZSxHQUFJOztZQUUzQixXQUFXOztvQkFFSCxlQUFlLEVBQUU7cUJBQ2hCLGVBQWUsR0FBSTtnREFDUSxNQUFNLE9BQU8sT0FBTyxNQUFNLE9BQU8sR0FBRyxXQUFXLEtBQUssTUFBTSxPQUFPOzRCQUNyRixlQUFlLElBQUs7Ozs7R0FJNUM7R0FFQSxJQUFJLGVBQWU7R0FDbkIsSUFBSSxzQkFBc0I7R0FFMUIsS0FBSyxJQUFJLElBQUksR0FBRyxJQUFJLFVBQVUsS0FBSztJQUNqQyxNQUFNLE1BQU0sU0FBUztJQUNyQixNQUFNLE9BQU8sSUFBSSxNQUFNLENBQUM7SUFDeEIsSUFBSSxLQUFLLFVBQVUsVUFBVTtJQUk3QixJQUZvQixJQUFJLFNBQVMsYUFFaEI7S0FDZixJQUFJLHlCQUF5QixLQUFLLFVBQVUsY0FBYyxLQUFLLE9BQU8sSUFBSztNQUN6RSxzQkFBc0Isd0JBQXdCLEtBQUssT0FBTyxDQUFDO01BQzNEO0tBQ0Y7S0FFQSxNQUFNLFFBQVEsS0FBSyxVQUFVLGFBQ3pCLElBQ0EsS0FBSyxVQUFVLGFBQ2IsSUFBSSxZQUFZLEtBQUssTUFBTSxDQUFDLElBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFDM0M7S0FDTixJQUFJLFNBQVMsR0FBRztLQUVoQixNQUFNLEVBQUUsU0FBUyxhQUFhLFdBQVcsSUFBSSxLQUFLLEtBQUssSUFBSSxNQUFNLEtBQUs7S0FFdEUsTUFBTSxhQURhLFVBQVUsS0FBSyxVQUFVLGFBQ1o7Ozs7dUJBSWpCLE1BQU0sT0FBTzs7OztxQkFJZjtLQUViLE1BQU0sVUFBVSxLQUFLLFVBQVUsYUFBYSxLQUFLLFFBQVE7S0FFekQsZ0JBQWdCOzs7O2tCQUlOLGVBQWUsR0FBSTtzQkFDZixlQUFlLEdBQUk7c0JBQ25CLFFBQVE7O2NBRWhCLFdBQVc7OzswQkFHQyxhQUFhOztzQkFFakIsTUFBTSxLQUFLOzs7Z0JBR2pCLGNBQWMsV0FBVzs7O0lBR25DLE9BQU87S0FDTCxNQUFNLFVBQVUsS0FBSztLQUNyQixNQUFNLGFBQWEsS0FBSyxVQUFVLGFBQzlCLElBQUksWUFBWSxLQUFLLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLGNBQWMsSUFDM0Q7S0FFSixnQkFBZ0I7Ozs7c0JBSUYsZUFBZSxHQUFJO3NCQUNuQixRQUFRO21DQUNLLFdBQVc7Ozs7MkJBSW5CLE1BQU0sT0FBTzt3QkFDaEIsZUFBZSxHQUFJLEtBQUssYUFBYTs4QkFDL0IsZUFBZSxJQUFJOzBCQUN2QixhQUFhOztzQkFFakIsTUFBTSxLQUFLOztnQkFFakIsSUFBSSxLQUFLOzs7SUFHbkI7R0FDRjtHQUVBLE1BQU0sZUFBZSxVQUFVLGtCQUFrQixrQkFDNUIsVUFBVSxvQkFBb0Isb0JBQzlCO0dBRXJCLE1BQU0sYUFBYSxhQUFhOztpQkFFbkIsYUFBYTtxQkFDVCxNQUFNLFNBQVM7Ozs7b0JBSWhCLGVBQWU7a0NBQ0QsTUFBTSxPQUFPOzs7OztnQkFLL0IsZUFBZSxHQUFJO3NCQUNiLGVBQWUsSUFBSTs7a0JBRXZCLE1BQU0sS0FBSzs7WUFFakIsV0FBVzs7Ozs7O2dCQU1QLGVBQWUsR0FBSTtzQkFDYixlQUFlLEdBQUk7a0JBQ3ZCLE1BQU0sVUFBVTt1QkFDWCxNQUFNLE9BQU87b0JBQ2hCLGVBQWUsR0FBSSxLQUFLLGVBQWUsR0FBSTswQkFDckMsZUFBZSxHQUFJOztrQkFFM0IsYUFBYTttQ0FDSSxlQUFlLEdBQUk7OztRQUc5QztHQUVKLE1BQU0sYUFBYTs7Ozs7O2lCQU1OLGFBQWE7cUJBQ1QsTUFBTSxHQUFHOzs7O29CQUlWLGVBQWU7Ozs7c0JBSWIsZ0JBQWdCO3VCQUNmLE1BQU0sUUFBUTs2QkFDUixNQUFNLE9BQU87MEJBQ2hCLGVBQWUsSUFBSTtvQkFDekIsZUFBZSxHQUFJLEtBQUssYUFBYTs7Ozs7O3dCQU1qQyxlQUFlLEdBQUk7b0JBQ3ZCLE1BQU0sVUFBVTs7O29CQUdoQixlQUFlLElBQUk7cUJBQ2xCLGVBQWUsSUFBSTt5QkFDZixNQUFNLE9BQU87NEJBQ1YsZUFBZSxHQUFJOzs7OztpREFLRSxlQUFlLEdBQUk7Ozs7O0dBTWhFLE9BQU87OztnQkFHSyxNQUFNO2lCQUNMLE9BQU87cUJBQ0gsTUFBTSxHQUFHOzs7OztVQUtwQixXQUFXOzs7O2dCQUlMLGFBQWE7OzttQkFHVixhQUFhOzs7OztvQkFLWixhQUFhLEtBQUssZUFBZTs7O3dCQUc3QixnQkFBZ0I7Ozs7Y0FJMUIsYUFBYTtjQUNiLG9CQUFvQjs7OztVQUl4QixXQUFXOzs7RUFHbkI7Q0FDRiJ9