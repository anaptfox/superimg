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
	//#region examples/interfaces/chatgpt/chatgpt.media.ts
	function messageWeight(text) {
		return Math.max(1.2, text.length / 45);
	}
	function estimateChatTimeline(data) {
		const pace = data.timingPreset === "rapid" ? .85 : data.timingPreset === "dramatic" ? 1.25 : 1;
		const weights = data.messages.map((m) => messageWeight(m.text));
		const messagesS = Math.max(2, weights.reduce((a, w) => a + w, 0) * 1.45 * pace);
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
				text: "How do I create a video from code?",
				role: "user"
			}, {
				id: "2",
				text: "Use SuperImg! Write an HTML/CSS template in TypeScript and render it to MP4 — perfect for dev demos and social clips.",
				role: "assistant"
			}],
			model: "gpt-5.1-codex-mini",
			theme: "dark",
			timingPreset: "natural",
			showHeader: true,
			showThinkingIndicator: true
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "7s"
		},
		resolve({ data }) {
			const { totalSeconds, phases } = estimateChatTimeline(data);
			return {
				duration: `${totalSeconds}s`,
				phases
			};
		},
		render(ctx) {
			const { std, width, height, timeline, data } = ctx;
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
				bg: "#212121",
				userBg: "#2f2f2f",
				assistantBg: "transparent",
				text: "#ececec",
				mutedText: "#8e8e8e",
				accent: "#10a37f",
				border: "#444444",
				headerBg: "#212121",
				inputBg: "#2f2f2f"
			} : {
				bg: "#ffffff",
				userBg: "#f7f7f8",
				assistantBg: "transparent",
				text: "#374151",
				mutedText: "#6b7280",
				accent: "#10a37f",
				border: "#e5e5e5",
				headerBg: "#ffffff",
				inputBg: "#f7f7f8"
			};
			const baseFontSize = Math.min(width, height) * .03;
			const headerHeight = showHeader ? height * .08 : 0;
			const footerHeight = height * .1;
			const contentPadding = width * .06;
			const maxContentWidth = Math.min(width * .85, 680);
			baseFontSize * 1.5;
			const logoSize = baseFontSize * 1.4;
			const chatGPTLogo = `
      <svg width="${logoSize}" height="${logoSize}" viewBox="0 0 41 41" fill="none">
        <path t="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.81233 35.6324 8.76321 36.5014C10.7141 37.3705 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.3946 40.4998C24.5319 40.5054 26.6157 39.8321 28.3453 38.5772C30.0748 37.3223 31.3345 35.5506 32.0158 33.5179C33.4065 33.2332 34.7203 32.6547 35.8693 31.8211C37.0183 30.9875 37.9759 29.9183 38.6782 28.6846C39.7451 26.8398 40.199 24.7043 39.976 22.5849C39.7529 20.4656 38.8645 18.4715 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9183 21.0707 29.9183 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.55279 26.0835 5.73539 26.1326L13.6996 30.7332C13.8954 30.8458 14.1553 30.8458 14.4017 30.7332L24.1517 25.1082C24.3524 24.9942 24.5187 24.8288 24.6337 24.6292C24.7487 24.4296 24.8082 24.203 24.8063 23.9727V12.7025L28.1726 14.6467C28.1903 14.6555 28.2055 14.6685 28.2169 14.6846C28.2284 14.7007 28.2356 14.7194 28.2378 14.7389V24.0698C28.2349 26.0559 27.4419 27.9599 26.0349 29.3608C24.6279 30.7617 22.7208 31.5482 20.7315 31.5482C19.7962 31.5482 18.8627 31.3666 17.9829 31.0064L6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19415 10.5228 8.19415 10.6071V19.8989C8.19252 20.1262 8.24995 20.3499 8.36117 20.5485C8.47238 20.7471 8.6334 20.9137 8.82866 21.0319L18.5765 26.6555L15.2102 28.5997C15.1926 28.6093 15.1726 28.6146 15.1527 28.6146C15.1327 28.6146 15.1127 28.6093 15.0951 28.5997L7.16711 24.0181C5.40739 23.0029 4.12156 21.3708 3.54127 19.4445C2.96099 17.5182 3.12857 15.4414 4.01397 13.6194L4.29707 13.6194ZM31.955 20.0556L22.2044 14.4299L25.5706 12.4857C25.5882 12.4762 25.6082 12.4708 25.6082 12.4708C25.6481 12.4708 25.6681 12.4762 25.6857 12.4857L33.6125 17.0674C34.7871 17.7499 35.7649 18.7206 36.4562 19.8896C37.1476 21.0586 37.5275 22.3863 37.5601 23.7467C37.5926 25.1071 37.2763 26.4528 36.6415 27.655C36.0067 28.8573 35.0748 29.8756 33.9345 29.8756L31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.0755 14.8686L27.1003 10.2668C26.8525 10.1531 26.5933 10.0942 26.33 10.0942C26.0667 10.0942 25.8039 10.1531 25.5548 10.2668L15.8049 15.8918C15.604 16.0054 15.4375 16.1706 15.3224 16.3701C15.2073 16.5695 15.1477 16.7961 15.1496 17.0265V28.2985L11.7832 26.3553C11.7656 26.3457 11.7504 26.3327 11.739 26.3166C11.7275 26.3005 11.7203 26.2818 11.7181 26.2623V16.8977C11.7221 14.9113 12.5157 13.0073 13.9225 11.6062C15.3293 10.2051 17.2361 9.41883 19.2254 9.41883C20.1607 9.41883 21.0942 9.60002 21.9739 9.96056L35.3055 15.0128ZM14.2424 21.9419L10.8761 20C10.8584 19.9912 10.8432 19.9782 10.8318 19.9621C10.8203 19.946 10.8131 19.9273 10.8109 19.9078V10.6415C10.8144 8.65325 11.6105 6.74797 13.0216 5.3476C14.4326 3.94723 16.3445 3.16475 18.3379 3.16948C19.2731 3.16977 20.2066 3.35131 21.0863 3.71168C21.0263 3.74487 20.9204 3.80314 20.851 3.84553L12.8886 8.44595C12.6888 8.55976 12.5228 8.7247 12.4077 8.92398C12.2927 9.12326 12.2328 9.34944 12.2342 9.57937L12.2342 21.9419H14.2424Z" fill="${THEME.accent}"/>
      </svg>
    `;
			function renderThinkingIndicator(progress) {
				const dotSize = baseFontSize * .35;
				const dots = [];
				for (let i = 0; i < 3; i++) {
					const phase = (progress * 2 + i * .3) % 1;
					const opacity = .3 + Math.sin(phase * Math.PI) * .7;
					dots.push(`<div style="
          width:${dotSize}px;
          height:${dotSize}px;
          background:${THEME.mutedText};
          border-radius:50%;
          opacity:${opacity};
        "></div>`);
				}
				return `
        <div style="
          display:flex;
          align-items:center;
          gap:${dotSize * .8}px;
          padding:${baseFontSize * .5}px 0;
        ">
          ${chatGPTLogo}
          <div style="display:flex;gap:${dotSize * .5}px;margin-left:${baseFontSize * .5}px;">
            ${dots.join("")}
          </div>
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
          background:${THEME.text};
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
            ${chatGPTLogo}
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
          ${chatGPTLogo}
          <span>ChatGPT</span>
        </div>
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * .3}px;
          font-size:${baseFontSize * .85}px;
          color:${THEME.mutedText};
          background:${THEME.userBg};
          padding:${baseFontSize * .3}px ${baseFontSize * .6}px;
          border-radius:${baseFontSize * .5}px;
        ">
          <span>${model.toUpperCase()}</span>
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
          ">Message ChatGPT...</span>
          <div style="
            width:${baseFontSize * 1.5}px;
            height:${baseFontSize * 1.5}px;
            background:${THEME.mutedText};
            border-radius:${baseFontSize * .4}px;
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <span style="color:${THEME.bg};font-size:${baseFontSize * .8}px;">↑</span>
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
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdGdwdC5tZWRpYS5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9zdXBlcmltZy1jb3JlL25vZGVfbW9kdWxlcy9Ac3VwZXJpbWcvc3RkbGliL2Rpc3QvbGF5b3V0LXRpbWVsaW5lLmpzIiwiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2ludGVyZmFjZXMvY2hhdGdwdC9jaGF0Z3B0Lm1lZGlhLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvbGF5b3V0LXRpbWVsaW5lLnRzXG4vKipcbiogTWFwIGFic29sdXRlLXNlY29uZCBzZWdtZW50cyB0byBhIGRpcmVjdG9yIHBoYXNlIGxheW91dC5cbipcbiogQHBhcmFtIHNlZ21lbnRzIC0gbmFtZSDihpIgZHVyYXRpb24gaW4gc2Vjb25kcyAobXVzdCBiZSA+IDApLiBPYmplY3Qga2V5IG9yZGVyIGlzIHByZXNlcnZlZC5cbiogQHJldHVybnMgcGVyY2VudCBwaGFzZXMgKHN1bSAxMDAlKSwgdG90YWxTZWNvbmRzLCBhbmQgc3RhYmxlIG9yZGVyXG4qXG4qIEBleGFtcGxlXG4qIGBgYHRzXG4qIGNvbnN0IHsgcGhhc2VzLCB0b3RhbFNlY29uZHMgfSA9IGxheW91dFRpbWVsaW5lKHsgYm9vdDogMSwgdHlwZTogMiwgZXZlbnRfMDogMC45IH0pO1xuKiAvLyByZXNvbHZlOiByZXR1cm4geyBkdXJhdGlvbjogYCR7dG90YWxTZWNvbmRzfXNgLCBwaGFzZXMgfVxuKiAvLyByZW5kZXI6ICBjb25zdCBkID0gY3R4LmRpcmVjdG9yKHBoYXNlcylcbiogYGBgXG4qL1xuZnVuY3Rpb24gbGF5b3V0VGltZWxpbmUoc2VnbWVudHMpIHtcblx0Y29uc3Qgb3JkZXIgPSBPYmplY3Qua2V5cyhzZWdtZW50cyk7XG5cdGlmIChvcmRlci5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihcImxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnRzIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgcGhhc2VcIik7XG5cdGNvbnN0IHNlY29uZHMgPSBvcmRlci5tYXAoKG5hbWUpID0+IHtcblx0XHRjb25zdCBzID0gc2VnbWVudHNbbmFtZV07XG5cdFx0aWYgKCFOdW1iZXIuaXNGaW5pdGUocykgfHwgcyA8PSAwKSB0aHJvdyBuZXcgRXJyb3IoYGxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnQgXCIke25hbWV9XCIgbXVzdCBiZSBhIGZpbml0ZSBudW1iZXIgPiAwIChnb3QgJHtzfSlgKTtcblx0XHRyZXR1cm4gcztcblx0fSk7XG5cdGNvbnN0IHRvdGFsU2Vjb25kcyA9IHNlY29uZHMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG5cdGNvbnN0IHBoYXNlcyA9IHt9O1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IG9yZGVyLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgbmFtZSA9IG9yZGVyW2ldO1xuXHRcdHBoYXNlc1tuYW1lXSA9IGAke3NlY29uZHNbaV0gLyB0b3RhbFNlY29uZHMgKiAxMDB9JWA7XG5cdH1cblx0cmV0dXJuIHtcblx0XHRwaGFzZXMsXG5cdFx0dG90YWxTZWNvbmRzLFxuXHRcdG9yZGVyXG5cdH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGxheW91dFRpbWVsaW5lIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWxheW91dC10aW1lbGluZS5qcy5tYXAiLCIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSwgbGF5b3V0VGltZWxpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENoYXRNZXNzYWdlIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICByb2xlOiBcInVzZXJcIiB8IFwiYXNzaXN0YW50XCI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hhdEdQVERhdGEgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIG1lc3NhZ2VzOiBDaGF0TWVzc2FnZVtdO1xuICBtb2RlbDogXCJncHQtNS4xLWNvZGV4LW1pbmlcIiB8IFwiZ3B0LTRcIiB8IFwiZ3B0LTMuNVwiO1xuICB0aGVtZTogXCJkYXJrXCIgfCBcImxpZ2h0XCI7XG4gIHRpbWluZ1ByZXNldDogXCJyYXBpZFwiIHwgXCJuYXR1cmFsXCIgfCBcImRyYW1hdGljXCI7XG4gIHNob3dIZWFkZXI6IGJvb2xlYW47XG4gIHNob3dUaGlua2luZ0luZGljYXRvcjogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gbWVzc2FnZVdlaWdodCh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5tYXgoMS4yLCB0ZXh0Lmxlbmd0aCAvIDQ1KTtcbn1cblxuZnVuY3Rpb24gZXN0aW1hdGVDaGF0VGltZWxpbmUoZGF0YTogQ2hhdEdQVERhdGEpIHtcbiAgY29uc3QgcGFjZSA9XG4gICAgZGF0YS50aW1pbmdQcmVzZXQgPT09IFwicmFwaWRcIiA/IDAuODUgOiBkYXRhLnRpbWluZ1ByZXNldCA9PT0gXCJkcmFtYXRpY1wiID8gMS4yNSA6IDE7XG4gIGNvbnN0IHdlaWdodHMgPSBkYXRhLm1lc3NhZ2VzLm1hcCgobSkgPT4gbWVzc2FnZVdlaWdodChtLnRleHQpKTtcbiAgY29uc3QgbWVzc2FnZXNTID0gTWF0aC5tYXgoMiwgd2VpZ2h0cy5yZWR1Y2UoKGEsIHcpID0+IGEgKyB3LCAwKSAqIDEuNDUgKiBwYWNlKTtcbiAgY29uc3QgaG9sZFMgPSBNYXRoLm1heCgwLjU1LCBtZXNzYWdlc1MgKiAoMSAvIDkpKTtcbiAgcmV0dXJuIGxheW91dFRpbWVsaW5lKHsgbWVzc2FnZXM6IG1lc3NhZ2VzUywgaG9sZDogaG9sZFMgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZTxDaGF0R1BURGF0YT4oe1xuICBzYW1wbGU6IHtcbiAgICBtZXNzYWdlczogW1xuICAgICAgeyBpZDogXCIxXCIsIHRleHQ6IFwiSG93IGRvIEkgY3JlYXRlIGEgdmlkZW8gZnJvbSBjb2RlP1wiLCByb2xlOiBcInVzZXJcIiB9LFxuICAgICAgeyBpZDogXCIyXCIsIHRleHQ6IFwiVXNlIFN1cGVySW1nISBXcml0ZSBhbiBIVE1ML0NTUyB0ZW1wbGF0ZSBpbiBUeXBlU2NyaXB0IGFuZCByZW5kZXIgaXQgdG8gTVA0IOKAlCBwZXJmZWN0IGZvciBkZXYgZGVtb3MgYW5kIHNvY2lhbCBjbGlwcy5cIiwgcm9sZTogXCJhc3Npc3RhbnRcIiB9LFxuICAgIF0sXG4gICAgbW9kZWw6IFwiZ3B0LTUuMS1jb2RleC1taW5pXCIsXG4gICAgdGhlbWU6IFwiZGFya1wiLFxuICAgIHRpbWluZ1ByZXNldDogXCJuYXR1cmFsXCIsXG4gICAgc2hvd0hlYWRlcjogdHJ1ZSxcbiAgICBzaG93VGhpbmtpbmdJbmRpY2F0b3I6IHRydWUsXG4gIH0sXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIGR1cmF0aW9uOiBcIjdzXCIsIC8vIEFTVCBmYWxsYmFjazsgcmVzb2x2ZSgpIG92ZXJyaWRlc1xuICB9LFxuICByZXNvbHZlKHsgZGF0YSB9KSB7XG4gICAgY29uc3QgeyB0b3RhbFNlY29uZHMsIHBoYXNlcyB9ID0gZXN0aW1hdGVDaGF0VGltZWxpbmUoZGF0YSk7XG4gICAgcmV0dXJuIHsgZHVyYXRpb246IGAke3RvdGFsU2Vjb25kc31zYCwgcGhhc2VzIH07XG4gIH0sXG4gIHJlbmRlcihjdHg6IFJlbmRlckNvbnRleHQ8Q2hhdEdQVERhdGE+KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIHRpbWVsaW5lLCBkYXRhIH0gPSBjdHg7XG4gICAgY29uc3Qge1xuICAgICAgbWVzc2FnZXMsXG4gICAgICBtb2RlbCxcbiAgICAgIHRoZW1lLFxuICAgICAgdGltaW5nUHJlc2V0LFxuICAgICAgc2hvd0hlYWRlcixcbiAgICAgIHNob3dUaGlua2luZ0luZGljYXRvcixcbiAgICB9ID0gZGF0YTtcblxuICAgIGNvbnN0IG1zZ0NvdW50ID0gbWVzc2FnZXMubGVuZ3RoO1xuICAgIGNvbnN0IHNlcUVudGVyID0gdGltaW5nUHJlc2V0ID09PSBcInJhcGlkXCIgPyAwLjI1IDogdGltaW5nUHJlc2V0ID09PSBcImRyYW1hdGljXCIgPyAwLjQ1IDogMC4zNTtcbiAgICBjb25zdCB7IHBoYXNlcyB9ID0gZXN0aW1hdGVDaGF0VGltZWxpbmUoZGF0YSk7XG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3RvcihwaGFzZXMpO1xuICAgIGNvbnN0IHdlaWdodHMgPSBtZXNzYWdlcy5tYXAoKG0pID0+IG1lc3NhZ2VXZWlnaHQobS50ZXh0KSk7XG4gICAgY29uc3Qgc3RrID0gc3RkLnN0YWNrKG1lc3NhZ2VzLCB7XG4gICAgICBkdXJpbmc6IHQuaW4oXCJtZXNzYWdlc1wiKSxcbiAgICAgIGxlYWQ6IDAuMDUsXG4gICAgICB0cmFpbDogMC4wNSxcbiAgICAgIGVudGVyOiBzZXFFbnRlcixcbiAgICAgIHdlaWdodHMsXG4gICAgfSk7XG5cbiAgICAvLyBDb2xvcnNcbiAgICBjb25zdCBUSEVNRSA9IHRoZW1lID09PSBcImRhcmtcIiA/IHtcbiAgICAgIGJnOiBcIiMyMTIxMjFcIixcbiAgICAgIHVzZXJCZzogXCIjMmYyZjJmXCIsXG4gICAgICBhc3Npc3RhbnRCZzogXCJ0cmFuc3BhcmVudFwiLFxuICAgICAgdGV4dDogXCIjZWNlY2VjXCIsXG4gICAgICBtdXRlZFRleHQ6IFwiIzhlOGU4ZVwiLFxuICAgICAgYWNjZW50OiBcIiMxMGEzN2ZcIixcbiAgICAgIGJvcmRlcjogXCIjNDQ0NDQ0XCIsXG4gICAgICBoZWFkZXJCZzogXCIjMjEyMTIxXCIsXG4gICAgICBpbnB1dEJnOiBcIiMyZjJmMmZcIixcbiAgICB9IDoge1xuICAgICAgYmc6IFwiI2ZmZmZmZlwiLFxuICAgICAgdXNlckJnOiBcIiNmN2Y3ZjhcIixcbiAgICAgIGFzc2lzdGFudEJnOiBcInRyYW5zcGFyZW50XCIsXG4gICAgICB0ZXh0OiBcIiMzNzQxNTFcIixcbiAgICAgIG11dGVkVGV4dDogXCIjNmI3MjgwXCIsXG4gICAgICBhY2NlbnQ6IFwiIzEwYTM3ZlwiLFxuICAgICAgYm9yZGVyOiBcIiNlNWU1ZTVcIixcbiAgICAgIGhlYWRlckJnOiBcIiNmZmZmZmZcIixcbiAgICAgIGlucHV0Qmc6IFwiI2Y3ZjdmOFwiLFxuICAgIH07XG5cbiAgICAvLyBMYXlvdXQgY2FsY3VsYXRpb25zXG4gICAgY29uc3QgYmFzZUZvbnRTaXplID0gTWF0aC5taW4od2lkdGgsIGhlaWdodCkgKiAwLjAzO1xuICAgIGNvbnN0IGhlYWRlckhlaWdodCA9IHNob3dIZWFkZXIgPyBoZWlnaHQgKiAwLjA4IDogMDtcbiAgICBjb25zdCBmb290ZXJIZWlnaHQgPSBoZWlnaHQgKiAwLjE7XG4gICAgY29uc3QgY29udGVudFBhZGRpbmcgPSB3aWR0aCAqIDAuMDY7XG4gICAgY29uc3QgbWF4Q29udGVudFdpZHRoID0gTWF0aC5taW4od2lkdGggKiAwLjg1LCA2ODApO1xuICAgIGNvbnN0IG1lc3NhZ2VHYXAgPSBiYXNlRm9udFNpemUgKiAxLjU7XG5cbiAgICAvLyBDaGF0R1BUIGxvZ28gU1ZHIChPcGVuQUkgaWNvbilcbiAgICBjb25zdCBsb2dvU2l6ZSA9IGJhc2VGb250U2l6ZSAqIDEuNDtcbiAgICBjb25zdCBjaGF0R1BUTG9nbyA9IGBcbiAgICAgIDxzdmcgd2lkdGg9XCIke2xvZ29TaXplfVwiIGhlaWdodD1cIiR7bG9nb1NpemV9XCIgdmlld0JveD1cIjAgMCA0MSA0MVwiIGZpbGw9XCJub25lXCI+XG4gICAgICAgIDxwYXRoIHQ9XCJNMzcuNTMyNCAxNi44NzA3QzM3Ljk4MDggMTUuNTI0MSAzOC4xMzYzIDE0LjA5NzQgMzcuOTg4NiAxMi42ODU5QzM3Ljg0MDkgMTEuMjc0NCAzNy4zOTM0IDkuOTEwNzYgMzYuNjc2IDguNjg2MjJDMzUuNjEyNiA2LjgzNDA0IDMzLjk4ODIgNS4zNjc2IDMyLjAzNzMgNC40OTg1QzMwLjA4NjQgMy42Mjk0MSAyNy45MDk4IDMuNDAyNTkgMjUuODIxNSAzLjg1MDc4QzI0Ljg3OTYgMi43ODkzIDIzLjcyMTkgMS45NDEyNSAyMi40MjU3IDEuMzYzNDFDMjEuMTI5NSAwLjc4NTU3NSAxOS43MjQ5IDAuNDkxMjY5IDE4LjMwNTggMC41MDAxOTdDMTYuMTcwOCAwLjQ5NTA0NCAxNC4wODkzIDEuMTY4MDMgMTIuMzYxNCAyLjQyMjE0QzEwLjYzMzUgMy42NzYyNCA5LjM0ODUzIDUuNDQ2NjYgOC42OTE3IDcuNDc4MTVDNy4zMDA4NSA3Ljc2Mjg2IDUuOTg2ODYgOC4zNDE0IDQuODM3NyA5LjE3NTA1QzMuNjg4NTQgMTAuMDA4NyAyLjczMDczIDExLjA3ODIgMi4wMjgzOSAxMi4zMTJDMC45NTY0NjQgMTQuMTU5MSAwLjQ5ODkwNSAxNi4yOTg4IDAuNzIxNjk4IDE4LjQyMjhDMC45NDQ0OTIgMjAuNTQ2NyAxLjgzNjEyIDIyLjU0NDkgMy4yNjggMjQuMTI5M0MyLjgxOTY2IDI1LjQ3NTkgMi42NjQxMyAyNi45MDI2IDIuODExODIgMjguMzE0MUMyLjk1OTUxIDI5LjcyNTYgMy40MDcwMSAzMS4wODkyIDQuMTI0MzcgMzIuMzEzOEM1LjE4NzkxIDM0LjE2NTkgNi44MTIzMyAzNS42MzI0IDguNzYzMjEgMzYuNTAxNEMxMC43MTQxIDM3LjM3MDUgMTIuODkwNyAzNy41OTczIDE0Ljk3ODkgMzcuMTQ5MkMxNS45MjA4IDM4LjIxMDcgMTcuMDc4NiAzOS4wNTg3IDE4LjM3NDcgMzkuNjM2NkMxOS42NzA5IDQwLjIxNDQgMjEuMDc1NSA0MC41MDg3IDIyLjM5NDYgNDAuNDk5OEMyNC41MzE5IDQwLjUwNTQgMjYuNjE1NyAzOS44MzIxIDI4LjM0NTMgMzguNTc3MkMzMC4wNzQ4IDM3LjMyMjMgMzEuMzM0NSAzNS41NTA2IDMyLjAxNTggMzMuNTE3OUMzMy40MDY1IDMzLjIzMzIgMzQuNzIwMyAzMi42NTQ3IDM1Ljg2OTMgMzEuODIxMUMzNy4wMTgzIDMwLjk4NzUgMzcuOTc1OSAyOS45MTgzIDM4LjY3ODIgMjguNjg0NkMzOS43NDUxIDI2LjgzOTggNDAuMTk5IDI0LjcwNDMgMzkuOTc2IDIyLjU4NDlDMzkuNzUyOSAyMC40NjU2IDM4Ljg2NDUgMTguNDcxNSAzNy41MzI0IDE2Ljg3MDdaTTIyLjQ5NzggMzcuODg0OUMyMC43NDQzIDM3Ljg4NzQgMTkuMDQ1OSAzNy4yNzMzIDE3LjY5OTQgMzYuMTUwMUMxNy43NjAxIDM2LjExNyAxNy44NjY2IDM2LjA1ODYgMTcuOTM2IDM2LjAxNjFMMjUuOTAwNCAzMS40MTU2QzI2LjEwMDMgMzEuMzAxOSAyNi4yNjYzIDMxLjEzNyAyNi4zODEzIDMwLjkzNzhDMjYuNDk2NCAzMC43Mzg2IDI2LjU1NjMgMzAuNTEyNCAyNi41NTQ5IDMwLjI4MjVWMTkuMDU0MkwyOS45MjEzIDIwLjk5OEMyOS45Mzg5IDIxLjAwNjggMjkuOTU0MSAyMS4wMTk4IDI5Ljk2NTYgMjEuMDM1OUMyOS45NzcgMjEuMDUyIDI5LjkxODMgMjEuMDcwNyAyOS45MTgzIDIxLjA5MDJWMzAuMzg4OUMyOS45ODQyIDMyLjM3NSAyOS4xOTQ2IDM0LjI3OTEgMjcuNzkwOSAzNS42ODQxQzI2LjM4NzIgMzcuMDg5MiAyNC40ODM4IDM3Ljg4MDYgMjIuNDk3OCAzNy44ODQ5Wk02LjM5MjI3IDMxLjAwNjRDNS41MTM5NyAyOS40ODg4IDUuMTk3NDIgMjcuNzEwNyA1LjQ5ODA0IDI1Ljk4MzJDNS41NTcxOCAyNi4wMTg3IDUuNTUyNzkgMjYuMDgzNSA1LjczNTM5IDI2LjEzMjZMMTMuNjk5NiAzMC43MzMyQzEzLjg5NTQgMzAuODQ1OCAxNC4xNTUzIDMwLjg0NTggMTQuNDAxNyAzMC43MzMyTDI0LjE1MTcgMjUuMTA4MkMyNC4zNTI0IDI0Ljk5NDIgMjQuNTE4NyAyNC44Mjg4IDI0LjYzMzcgMjQuNjI5MkMyNC43NDg3IDI0LjQyOTYgMjQuODA4MiAyNC4yMDMgMjQuODA2MyAyMy45NzI3VjEyLjcwMjVMMjguMTcyNiAxNC42NDY3QzI4LjE5MDMgMTQuNjU1NSAyOC4yMDU1IDE0LjY2ODUgMjguMjE2OSAxNC42ODQ2QzI4LjIyODQgMTQuNzAwNyAyOC4yMzU2IDE0LjcxOTQgMjguMjM3OCAxNC43Mzg5VjI0LjA2OThDMjguMjM0OSAyNi4wNTU5IDI3LjQ0MTkgMjcuOTU5OSAyNi4wMzQ5IDI5LjM2MDhDMjQuNjI3OSAzMC43NjE3IDIyLjcyMDggMzEuNTQ4MiAyMC43MzE1IDMxLjU0ODJDMTkuNzk2MiAzMS41NDgyIDE4Ljg2MjcgMzEuMzY2NiAxNy45ODI5IDMxLjAwNjRMNi4zOTIyNyAzMS4wMDY0Wk00LjI5NzA3IDEzLjYxOTRDNS4xNzE1NiAxMi4wOTk4IDYuNTUyNzkgMTAuOTM2NCA4LjE5ODg1IDEwLjMzMjdDOC4xOTg4NSAxMC40MDEzIDguMTk0MTUgMTAuNTIyOCA4LjE5NDE1IDEwLjYwNzFWMTkuODk4OUM4LjE5MjUyIDIwLjEyNjIgOC4yNDk5NSAyMC4zNDk5IDguMzYxMTcgMjAuNTQ4NUM4LjQ3MjM4IDIwLjc0NzEgOC42MzM0IDIwLjkxMzcgOC44Mjg2NiAyMS4wMzE5TDE4LjU3NjUgMjYuNjU1NUwxNS4yMTAyIDI4LjU5OTdDMTUuMTkyNiAyOC42MDkzIDE1LjE3MjYgMjguNjE0NiAxNS4xNTI3IDI4LjYxNDZDMTUuMTMyNyAyOC42MTQ2IDE1LjExMjcgMjguNjA5MyAxNS4wOTUxIDI4LjU5OTdMNy4xNjcxMSAyNC4wMTgxQzUuNDA3MzkgMjMuMDAyOSA0LjEyMTU2IDIxLjM3MDggMy41NDEyNyAxOS40NDQ1QzIuOTYwOTkgMTcuNTE4MiAzLjEyODU3IDE1LjQ0MTQgNC4wMTM5NyAxMy42MTk0TDQuMjk3MDcgMTMuNjE5NFpNMzEuOTU1IDIwLjA1NTZMMjIuMjA0NCAxNC40Mjk5TDI1LjU3MDYgMTIuNDg1N0MyNS41ODgyIDEyLjQ3NjIgMjUuNjA4MiAxMi40NzA4IDI1LjYwODIgMTIuNDcwOEMyNS42NDgxIDEyLjQ3MDggMjUuNjY4MSAxMi40NzYyIDI1LjY4NTcgMTIuNDg1N0wzMy42MTI1IDE3LjA2NzRDMzQuNzg3MSAxNy43NDk5IDM1Ljc2NDkgMTguNzIwNiAzNi40NTYyIDE5Ljg4OTZDMzcuMTQ3NiAyMS4wNTg2IDM3LjUyNzUgMjIuMzg2MyAzNy41NjAxIDIzLjc0NjdDMzcuNTkyNiAyNS4xMDcxIDM3LjI3NjMgMjYuNDUyOCAzNi42NDE1IDI3LjY1NUMzNi4wMDY3IDI4Ljg1NzMgMzUuMDc0OCAyOS44NzU2IDMzLjkzNDUgMjkuODc1NkwzMS45NTUgMjAuMDU1NlpNMzUuMzA1NSAxNS4wMTI4QzM1LjI0NjQgMTQuOTc2NSAzNS4xNDMxIDE0LjkxNDIgMzUuMDc1NSAxNC44Njg2TDI3LjEwMDMgMTAuMjY2OEMyNi44NTI1IDEwLjE1MzEgMjYuNTkzMyAxMC4wOTQyIDI2LjMzIDEwLjA5NDJDMjYuMDY2NyAxMC4wOTQyIDI1LjgwMzkgMTAuMTUzMSAyNS41NTQ4IDEwLjI2NjhMMTUuODA0OSAxNS44OTE4QzE1LjYwNCAxNi4wMDU0IDE1LjQzNzUgMTYuMTcwNiAxNS4zMjI0IDE2LjM3MDFDMTUuMjA3MyAxNi41Njk1IDE1LjE0NzcgMTYuNzk2MSAxNS4xNDk2IDE3LjAyNjVWMjguMjk4NUwxMS43ODMyIDI2LjM1NTNDMTEuNzY1NiAyNi4zNDU3IDExLjc1MDQgMjYuMzMyNyAxMS43MzkgMjYuMzE2NkMxMS43Mjc1IDI2LjMwMDUgMTEuNzIwMyAyNi4yODE4IDExLjcxODEgMjYuMjYyM1YxNi44OTc3QzExLjcyMjEgMTQuOTExMyAxMi41MTU3IDEzLjAwNzMgMTMuOTIyNSAxMS42MDYyQzE1LjMyOTMgMTAuMjA1MSAxNy4yMzYxIDkuNDE4ODMgMTkuMjI1NCA5LjQxODgzQzIwLjE2MDcgOS40MTg4MyAyMS4wOTQyIDkuNjAwMDIgMjEuOTczOSA5Ljk2MDU2TDM1LjMwNTUgMTUuMDEyOFpNMTQuMjQyNCAyMS45NDE5TDEwLjg3NjEgMjBDMTAuODU4NCAxOS45OTEyIDEwLjg0MzIgMTkuOTc4MiAxMC44MzE4IDE5Ljk2MjFDMTAuODIwMyAxOS45NDYgMTAuODEzMSAxOS45MjczIDEwLjgxMDkgMTkuOTA3OFYxMC42NDE1QzEwLjgxNDQgOC42NTMyNSAxMS42MTA1IDYuNzQ3OTcgMTMuMDIxNiA1LjM0NzZDMTQuNDMyNiAzLjk0NzIzIDE2LjM0NDUgMy4xNjQ3NSAxOC4zMzc5IDMuMTY5NDhDMTkuMjczMSAzLjE2OTc3IDIwLjIwNjYgMy4zNTEzMSAyMS4wODYzIDMuNzExNjhDMjEuMDI2MyAzLjc0NDg3IDIwLjkyMDQgMy44MDMxNCAyMC44NTEgMy44NDU1M0wxMi44ODg2IDguNDQ1OTVDMTIuNjg4OCA4LjU1OTc2IDEyLjUyMjggOC43MjQ3IDEyLjQwNzcgOC45MjM5OEMxMi4yOTI3IDkuMTIzMjYgMTIuMjMyOCA5LjM0OTQ0IDEyLjIzNDIgOS41NzkzN0wxMi4yMzQyIDIxLjk0MTlIMTQuMjQyNFpcIiBmaWxsPVwiJHtUSEVNRS5hY2NlbnR9XCIvPlxuICAgICAgPC9zdmc+XG4gICAgYDtcblxuICAgIC8vIFRoaW5raW5nIGluZGljYXRvciAoMyBwdWxzaW5nIGRvdHMpXG4gICAgZnVuY3Rpb24gcmVuZGVyVGhpbmtpbmdJbmRpY2F0b3IocHJvZ3Jlc3M6IG51bWJlcik6IHN0cmluZyB7XG4gICAgICBjb25zdCBkb3RTaXplID0gYmFzZUZvbnRTaXplICogMC4zNTtcbiAgICAgIGNvbnN0IGRvdHMgPSBbXTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgY29uc3QgcGhhc2UgPSAocHJvZ3Jlc3MgKiAyICsgaSAqIDAuMykgJSAxO1xuICAgICAgICBjb25zdCBvcGFjaXR5ID0gMC4zICsgTWF0aC5zaW4ocGhhc2UgKiBNYXRoLlBJKSAqIDAuNztcbiAgICAgICAgZG90cy5wdXNoKGA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgd2lkdGg6JHtkb3RTaXplfXB4O1xuICAgICAgICAgIGhlaWdodDoke2RvdFNpemV9cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLm11dGVkVGV4dH07XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czo1MCU7XG4gICAgICAgICAgb3BhY2l0eToke29wYWNpdHl9O1xuICAgICAgICBcIj48L2Rpdj5gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGBcbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgICAgZ2FwOiR7ZG90U2l6ZSAqIDAuOH1weDtcbiAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC41fXB4IDA7XG4gICAgICAgIFwiPlxuICAgICAgICAgICR7Y2hhdEdQVExvZ299XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6JHtkb3RTaXplICogMC41fXB4O21hcmdpbi1sZWZ0OiR7YmFzZUZvbnRTaXplICogMC41fXB4O1wiPlxuICAgICAgICAgICAgJHtkb3RzLmpvaW4oXCJcIil9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYDtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCBtZXNzYWdlcyBIVE1MXG4gICAgbGV0IG1lc3NhZ2VzSHRtbCA9IFwiXCI7XG4gICAgbGV0IGN1cnJlbnRUaGlua2luZ0h0bWwgPSBcIlwiO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtc2dDb3VudDsgaSsrKSB7XG4gICAgICBjb25zdCBtc2cgPSBtZXNzYWdlc1tpXSE7XG4gICAgICBjb25zdCBpdGVtID0gc3RrLnN0YXRlKGkpO1xuICAgICAgaWYgKGl0ZW0uc3RhdGUgPT09IFwiaGlkZGVuXCIpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpc0Fzc2lzdGFudCA9IG1zZy5yb2xlID09PSBcImFzc2lzdGFudFwiO1xuXG4gICAgICBpZiAoaXNBc3Npc3RhbnQpIHtcbiAgICAgICAgaWYgKHNob3dUaGlua2luZ0luZGljYXRvciAmJiBpdGVtLnN0YXRlID09PSBcImVudGVyaW5nXCIgJiYgaXRlbS5zbG90IDwgMC41KSB7XG4gICAgICAgICAgY3VycmVudFRoaW5raW5nSHRtbCA9IHJlbmRlclRoaW5raW5nSW5kaWNhdG9yKGl0ZW0uc2xvdCAqIDIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHlwZVAgPSBpdGVtLnN0YXRlID09PSBcInJldmVhbGVkXCJcbiAgICAgICAgICA/IDFcbiAgICAgICAgICA6IGl0ZW0uc3RhdGUgPT09IFwiZW50ZXJpbmdcIlxuICAgICAgICAgICAgPyBzdGQuaW50ZXJwb2xhdGUoaXRlbS5zbG90LCBbMC41LCAxXSwgWzAsIDFdKVxuICAgICAgICAgICAgOiAwO1xuICAgICAgICBpZiAodHlwZVAgPD0gMCkgY29udGludWU7XG5cbiAgICAgICAgY29uc3QgeyB2aXNpYmxlOiBkaXNwbGF5VGV4dCwgdHlwaW5nIH0gPSBzdGQudGV4dC50eXBlKG1zZy50ZXh0LCB0eXBlUCk7XG4gICAgICAgIGNvbnN0IHNob3dDdXJzb3IgPSB0eXBpbmcgJiYgaXRlbS5zdGF0ZSA9PT0gXCJlbnRlcmluZ1wiO1xuICAgICAgICBjb25zdCBjdXJzb3JIdG1sID0gc2hvd0N1cnNvciA/IGA8c3BhbiBzdHlsZT1cIlxuICAgICAgICAgIGRpc3BsYXk6aW5saW5lLWJsb2NrO1xuICAgICAgICAgIHdpZHRoOjJweDtcbiAgICAgICAgICBoZWlnaHQ6MS4xZW07XG4gICAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLnRleHR9O1xuICAgICAgICAgIG1hcmdpbi1sZWZ0OjJweDtcbiAgICAgICAgICB2ZXJ0aWNhbC1hbGlnbjp0ZXh0LWJvdHRvbTtcbiAgICAgICAgICBhbmltYXRpb246YmxpbmsgMC41cyBpbmZpbml0ZTtcbiAgICAgICAgXCI+PC9zcGFuPmAgOiBcIlwiO1xuXG4gICAgICAgIGNvbnN0IG9wYWNpdHkgPSBpdGVtLnN0YXRlID09PSBcImVudGVyaW5nXCIgPyBpdGVtLmVudGVyIDogMTtcblxuICAgICAgICBtZXNzYWdlc0h0bWwgKz0gYFxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBnYXA6JHtiYXNlRm9udFNpemUgKiAwLjZ9cHg7XG4gICAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC44fXB4IDA7XG4gICAgICAgICAgICBvcGFjaXR5OiR7b3BhY2l0eX07XG4gICAgICAgICAgXCI+XG4gICAgICAgICAgICAke2NoYXRHUFRMb2dvfVxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgICAgICBmbGV4OjE7XG4gICAgICAgICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZX1weDtcbiAgICAgICAgICAgICAgbGluZS1oZWlnaHQ6MS42O1xuICAgICAgICAgICAgICBjb2xvcjoke1RIRU1FLnRleHR9O1xuICAgICAgICAgICAgICB3aGl0ZS1zcGFjZTpwcmUtd3JhcDtcbiAgICAgICAgICAgICAgd29yZC13cmFwOmJyZWFrLXdvcmQ7XG4gICAgICAgICAgICBcIj4ke2Rpc3BsYXlUZXh0fSR7Y3Vyc29ySHRtbH08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG9wYWNpdHkgPSBpdGVtLmVudGVyO1xuICAgICAgICBjb25zdCB0cmFuc2xhdGVZID0gaXRlbS5zdGF0ZSA9PT0gXCJlbnRlcmluZ1wiXG4gICAgICAgICAgPyBzdGQuaW50ZXJwb2xhdGUoaXRlbS5lbnRlciwgWzAsIDFdLCBbMTAsIDBdLCBcImVhc2VPdXRDdWJpY1wiKVxuICAgICAgICAgIDogMDtcblxuICAgICAgICBtZXNzYWdlc0h0bWwgKz0gYFxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDpmbGV4LWVuZDtcbiAgICAgICAgICAgIHBhZGRpbmc6JHtiYXNlRm9udFNpemUgKiAwLjV9cHggMDtcbiAgICAgICAgICAgIG9wYWNpdHk6JHtvcGFjaXR5fTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTp0cmFuc2xhdGVZKCR7dHJhbnNsYXRlWX1weCk7XG4gICAgICAgICAgXCI+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICAgIG1heC13aWR0aDo4MCU7XG4gICAgICAgICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS51c2VyQmd9O1xuICAgICAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC43fXB4ICR7YmFzZUZvbnRTaXplfXB4O1xuICAgICAgICAgICAgICBib3JkZXItcmFkaXVzOiR7YmFzZUZvbnRTaXplICogMS4yfXB4O1xuICAgICAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemV9cHg7XG4gICAgICAgICAgICAgIGxpbmUtaGVpZ2h0OjEuNTtcbiAgICAgICAgICAgICAgY29sb3I6JHtUSEVNRS50ZXh0fTtcbiAgICAgICAgICAgICAgd29yZC13cmFwOmJyZWFrLXdvcmQ7XG4gICAgICAgICAgICBcIj4ke21zZy50ZXh0fTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhlYWRlciBIVE1MXG4gICAgY29uc3QgaGVhZGVySHRtbCA9IHNob3dIZWFkZXIgPyBgXG4gICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIGhlaWdodDoke2hlYWRlckhlaWdodH1weDtcbiAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLmhlYWRlckJnfTtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgIGp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBwYWRkaW5nOjAgJHtjb250ZW50UGFkZGluZ31weDtcbiAgICAgICAgYm9yZGVyLWJvdHRvbToxcHggc29saWQgJHtUSEVNRS5ib3JkZXJ9O1xuICAgICAgXCI+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6Y2VudGVyO1xuICAgICAgICAgIGdhcDoke2Jhc2VGb250U2l6ZSAqIDAuNX1weDtcbiAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAxLjF9cHg7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6NjAwO1xuICAgICAgICAgIGNvbG9yOiR7VEhFTUUudGV4dH07XG4gICAgICAgIFwiPlxuICAgICAgICAgICR7Y2hhdEdQVExvZ299XG4gICAgICAgICAgPHNwYW4+Q2hhdEdQVDwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6Y2VudGVyO1xuICAgICAgICAgIGdhcDoke2Jhc2VGb250U2l6ZSAqIDAuM31weDtcbiAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjg1fXB4O1xuICAgICAgICAgIGNvbG9yOiR7VEhFTUUubXV0ZWRUZXh0fTtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiR7VEhFTUUudXNlckJnfTtcbiAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC4zfXB4ICR7YmFzZUZvbnRTaXplICogMC42fXB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemUgKiAwLjV9cHg7XG4gICAgICAgIFwiPlxuICAgICAgICAgIDxzcGFuPiR7bW9kZWwudG9VcHBlckNhc2UoKX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjZ9cHg7XCI+4pa8PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGAgOiBcIlwiO1xuXG4gICAgLy8gRm9vdGVyIChpbnB1dCBhcmVhIC0gZGVjb3JhdGl2ZSlcbiAgICBjb25zdCBmb290ZXJIdG1sID0gYFxuICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgYm90dG9tOjA7XG4gICAgICAgIGxlZnQ6MDtcbiAgICAgICAgcmlnaHQ6MDtcbiAgICAgICAgaGVpZ2h0OiR7Zm9vdGVySGVpZ2h0fXB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiR7VEhFTUUuYmd9O1xuICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAganVzdGlmeS1jb250ZW50OmNlbnRlcjtcbiAgICAgICAgcGFkZGluZzowICR7Y29udGVudFBhZGRpbmd9cHg7XG4gICAgICBcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIHdpZHRoOjEwMCU7XG4gICAgICAgICAgbWF4LXdpZHRoOiR7bWF4Q29udGVudFdpZHRofXB4O1xuICAgICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS5pbnB1dEJnfTtcbiAgICAgICAgICBib3JkZXI6MXB4IHNvbGlkICR7VEhFTUUuYm9yZGVyfTtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiR7YmFzZUZvbnRTaXplICogMS41fXB4O1xuICAgICAgICAgIHBhZGRpbmc6JHtiYXNlRm9udFNpemUgKiAwLjd9cHggJHtiYXNlRm9udFNpemV9cHg7XG4gICAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtcbiAgICAgICAgXCI+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJcbiAgICAgICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuOX1weDtcbiAgICAgICAgICAgIGNvbG9yOiR7VEhFTUUubXV0ZWRUZXh0fTtcbiAgICAgICAgICBcIj5NZXNzYWdlIENoYXRHUFQuLi48L3NwYW4+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgICAgd2lkdGg6JHtiYXNlRm9udFNpemUgKiAxLjV9cHg7XG4gICAgICAgICAgICBoZWlnaHQ6JHtiYXNlRm9udFNpemUgKiAxLjV9cHg7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiR7VEhFTUUubXV0ZWRUZXh0fTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemUgKiAwLjR9cHg7XG4gICAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO1xuICAgICAgICAgIFwiPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjoke1RIRU1FLmJnfTtmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjh9cHg7XCI+4oaRPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICByZXR1cm4gYFxuICAgICAgPHN0eWxlPkBrZXlmcmFtZXMgYmxpbmsgeyAwJSwgNTAlIHsgb3BhY2l0eTogMTsgfSA1MSUsIDEwMCUgeyBvcGFjaXR5OiAwOyB9IH08L3N0eWxlPlxuICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICB3aWR0aDoke3dpZHRofXB4O1xuICAgICAgICBoZWlnaHQ6JHtoZWlnaHR9cHg7XG4gICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS5iZ307XG4gICAgICAgIGZvbnQtZmFtaWx5Oi1hcHBsZS1zeXN0ZW0sQmxpbmtNYWNTeXN0ZW1Gb250LCdTZWdvZSBVSScsUm9ib3RvLHNhbnMtc2VyaWY7XG4gICAgICAgIHBvc2l0aW9uOnJlbGF0aXZlO1xuICAgICAgICBvdmVyZmxvdzpoaWRkZW47XG4gICAgICBcIj5cbiAgICAgICAgJHtoZWFkZXJIdG1sfVxuXG4gICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgICB0b3A6JHtoZWFkZXJIZWlnaHR9cHg7XG4gICAgICAgICAgbGVmdDowO1xuICAgICAgICAgIHJpZ2h0OjA7XG4gICAgICAgICAgYm90dG9tOiR7Zm9vdGVySGVpZ2h0fXB4O1xuICAgICAgICAgIG92ZXJmbG93OmhpZGRlbjtcbiAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgZmxleC1kaXJlY3Rpb246Y29sdW1uO1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDpmbGV4LWVuZDtcbiAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplfXB4ICR7Y29udGVudFBhZGRpbmd9cHg7XG4gICAgICAgIFwiPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICAgIG1heC13aWR0aDoke21heENvbnRlbnRXaWR0aH1weDtcbiAgICAgICAgICAgIHdpZHRoOjEwMCU7XG4gICAgICAgICAgICBtYXJnaW46MCBhdXRvO1xuICAgICAgICAgIFwiPlxuICAgICAgICAgICAgJHttZXNzYWdlc0h0bWx9XG4gICAgICAgICAgICAke2N1cnJlbnRUaGlua2luZ0h0bWx9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgICR7Zm9vdGVySHRtbH1cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gIH0sXG59KTtcbiJdLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMF0sIm1hcHBpbmdz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