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
	//#region examples/interfaces/imessage/imessage.media.ts
	function messageWeight(m) {
		return Math.max(1.2, m.text.length / 40) + (m.typingHesitation ? .6 : 0);
	}
	function estimateIMessageTimeline(data) {
		const pace = data.timingPreset === "rapid" ? .85 : data.timingPreset === "dramatic" ? 1.25 : 1;
		const weights = data.messages.map(messageWeight);
		const messagesS = Math.max(3, weights.reduce((a, w) => a + w, 0) * 1.7 * pace);
		return layoutTimeline({
			messages: messagesS,
			hold: Math.max(.7, messagesS * (1 / 9))
		});
	}
	//#endregion
	exports.default = define({
		sample: {
			contactName: "Alex",
			messages: [
				{
					id: "1",
					text: "Hey, did you see SuperImg?",
					sender: "contact"
				},
				{
					id: "2",
					text: "You can render HTML templates straight to MP4",
					sender: "contact"
				},
				{
					id: "3",
					text: "Just shipped my first dev reel with it",
					sender: "user"
				}
			],
			theme: "light",
			timingPreset: "natural",
			showHeader: true,
			showTypingIndicator: true
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "11.4s"
		},
		resolve({ data }) {
			const { totalSeconds, phases } = estimateIMessageTimeline(data);
			return {
				duration: `${totalSeconds}s`,
				phases
			};
		},
		render(ctx) {
			const { std, width, height, data } = ctx;
			const { contactName, contactAvatar, messages, theme, timingPreset, showHeader, showTypingIndicator } = data;
			const msgCount = messages.length;
			const seqEnter = timingPreset === "rapid" ? .25 : timingPreset === "dramatic" ? .45 : .35;
			const { phases } = estimateIMessageTimeline(data);
			const t = ctx.director(phases);
			const weights = messages.map(messageWeight);
			const stk = std.stack(messages, {
				during: t.in("messages"),
				lead: .05,
				trail: .05,
				enter: seqEnter,
				weights
			});
			const THEME = theme === "dark" ? {
				bg: "#000000",
				headerBg: "#1C1C1E",
				userBubble: "linear-gradient(180deg, #007AFF 0%, #0066DD 100%)",
				userText: "#ffffff",
				contactBubble: "#3A3A3C",
				contactText: "#ffffff",
				headerText: "#ffffff",
				mutedText: "#8E8E93",
				footerBg: "#1C1C1E"
			} : {
				bg: "#ffffff",
				headerBg: "#F6F6F6",
				userBubble: "linear-gradient(180deg, #007AFF 0%, #0066DD 100%)",
				userText: "#ffffff",
				contactBubble: "#E9E9EB",
				contactText: "#000000",
				headerText: "#000000",
				mutedText: "#8E8E93",
				footerBg: "#F6F6F6"
			};
			const baseFontSize = Math.min(width, height) * .032;
			const headerHeight = showHeader ? height * .08 : 0;
			const footerHeight = height * .055;
			const chatPadding = width * .04;
			const bubbleMaxWidth = width * .75;
			const messageGap = baseFontSize * .8;
			function renderTypingIndicator(progress) {
				const dotSize = baseFontSize * .4;
				const bounceOffset = [
					0,
					.2,
					.4
				];
				let dotsHtml = "";
				for (let i = 0; i < 3; i++) {
					const dotProgress = (progress * 3 + bounceOffset[i]) % 1;
					const bounce = Math.sin(dotProgress * Math.PI) * 4;
					dotsHtml += `<div style="
          width:${dotSize}px;
          height:${dotSize}px;
          background:${THEME.mutedText};
          border-radius:50%;
          transform:translateY(${-bounce}px);
        "></div>`;
				}
				return `<div style="
        display:flex;
        justify-content:flex-start;
        margin-left:${chatPadding}px;
      ">
        <div style="
          display:inline-flex;
          align-items:center;
          gap:${dotSize * .5}px;
          padding:${baseFontSize * .8}px ${baseFontSize * 1}px;
          background:${THEME.contactBubble};
          border-radius:${baseFontSize}px ${baseFontSize}px ${baseFontSize}px ${baseFontSize * .25}px;
        ">${dotsHtml}</div>
      </div>`;
			}
			function getBubbleTransform(enterProgress) {
				return {
					transform: `scale(${std.interpolate(enterProgress, [0, 1], [.3, 1], "easeOutBack")}) translateY(${std.interpolate(enterProgress, [0, 1], [20, 0], "easeOutCubic")}px)`,
					opacity: std.interpolate(Math.min(enterProgress * 2, 1), [0, 1], [0, 1], "linear")
				};
			}
			function renderReactions(reactions, isUser) {
				if (!reactions || reactions.length === 0) return "";
				const reactionSize = baseFontSize * 1.2;
				const position = isUser ? "left:-8px;" : "right:-8px;";
				return reactions.map((r, i) => `
        <div style="
          position:absolute;
          bottom:-${reactionSize * .4}px;
          ${position}
          background:${theme === "dark" ? "#2C2C2E" : "#ffffff"};
          border-radius:${reactionSize}px;
          padding:${reactionSize * .15}px ${reactionSize * .25}px;
          font-size:${reactionSize * .8}px;
          box-shadow:0 1px 3px rgba(0,0,0,0.2);
          transform:translateX(${i * reactionSize * .6}px);
        ">${r.emoji}</div>
      `).join("");
			}
			let messagesHtml = "";
			let currentTypingHtml = "";
			for (let i = 0; i < msgCount; i++) {
				const msg = messages[i];
				const item = stk.state(i);
				if (item.state === "hidden") continue;
				const isUser = msg.sender === "user";
				if (!isUser && showTypingIndicator && item.state === "entering" && item.slot < .5) {
					const typingProgress = item.slot * 2;
					if (msg.typingHesitation) {
						if (typingProgress < .3 || typingProgress > .55) currentTypingHtml = renderTypingIndicator(typingProgress < .3 ? typingProgress / .3 : Math.min((typingProgress - .55) / .45 * 1.3, 1));
					} else currentTypingHtml = renderTypingIndicator(typingProgress);
					continue;
				}
				const bubbleP = isUser || !showTypingIndicator ? item.enter : item.state === "entering" ? std.interpolate(item.slot, [.5, 1], [0, 1]) : item.state === "revealed" ? 1 : 0;
				if (bubbleP <= 0) continue;
				const { transform, opacity } = getBubbleTransform(bubbleP);
				const bubbleStyle = isUser ? `background:${THEME.userBubble};color:${THEME.userText};border-radius:${baseFontSize}px ${baseFontSize}px ${baseFontSize * .25}px ${baseFontSize}px;margin-left:auto;margin-right:${chatPadding}px;` : `background:${THEME.contactBubble};color:${THEME.contactText};border-radius:${baseFontSize}px ${baseFontSize}px ${baseFontSize}px ${baseFontSize * .25}px;margin-left:${chatPadding}px;`;
				const transformOrigin = isUser ? "bottom right" : "bottom left";
				messagesHtml += `
        <div style="
          position:relative;
          max-width:${bubbleMaxWidth}px;
          padding:${baseFontSize * .7}px ${baseFontSize}px;
          ${bubbleStyle}
          font-size:${baseFontSize}px;
          line-height:1.35;
          transform:${transform};
          transform-origin:${transformOrigin};
          opacity:${opacity};
          margin-bottom:${messageGap}px;
          word-wrap:break-word;
        ">
          ${msg.text}
          ${renderReactions(msg.reactions, isUser)}
        </div>
      `;
			}
			const headerHtml = showHeader ? `
      <div style="
        height:${headerHeight}px;
        background:${THEME.headerBg};
        display:flex;
        align-items:center;
        justify-content:center;
        gap:${baseFontSize * .5}px;
      ">
        ${contactAvatar ? `
          <img src="${contactAvatar}" style="
            width:${baseFontSize * 2}px;
            height:${baseFontSize * 2}px;
            border-radius:50%;
            object-fit:cover;
          " />
        ` : `
          <div style="
            width:${baseFontSize * 2}px;
            height:${baseFontSize * 2}px;
            border-radius:50%;
            background:linear-gradient(135deg, #A8A8AA 0%, #8E8E93 100%);
            display:flex;
            align-items:center;
            justify-content:center;
            color:white;
            font-size:${baseFontSize * .9}px;
            font-weight:600;
          ">${contactName.charAt(0).toUpperCase()}</div>
        `}
        <span style="
          font-size:${baseFontSize * .95}px;
          font-weight:600;
          color:${THEME.headerText};
        ">${contactName}</span>
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
        padding:0 ${baseFontSize * .5}px;
      ">
        <div style="
          flex:1;
          height:${baseFontSize * 2.2}px;
          background:${theme === "dark" ? "#1C1C1E" : "#FFFFFF"};
          border:1px solid ${theme === "dark" ? "#38383A" : "#C6C6C8"};
          border-radius:${baseFontSize * 1.1}px;
          display:flex;
          align-items:center;
          padding:0 ${baseFontSize * .7}px;
          position:relative;
        ">
          <span style="
            color:#8E8E93;
            font-size:${baseFontSize * .95}px;
          ">iMessage</span>
          <div style="
            position:absolute;
            right:${baseFontSize * .4}px;
            width:${baseFontSize * 1.6}px;
            height:${baseFontSize * 1.6}px;
            border-radius:50%;
            background:${theme === "dark" ? "#38383A" : "#E5E5EA"};
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <span style="
              color:#8E8E93;
              font-size:${baseFontSize * .9}px;
              line-height:1;
              margin-top:-1px;
            ">↑</span>
          </div>
        </div>
      </div>
    `;
			return `
      <div style="
        width:${width}px;
        height:${height}px;
        background:${THEME.bg};
        font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,sans-serif;
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
          padding-bottom:${baseFontSize}px;
        ">
          ${messagesHtml}
          ${currentTypingHtml}
        </div>

        ${footerHtml}
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1lc3NhZ2UubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctY29yZS9ub2RlX21vZHVsZXMvQHN1cGVyaW1nL3N0ZGxpYi9kaXN0L2xheW91dC10aW1lbGluZS5qcyIsIi4uL3BhY2thZ2VzL3N1cGVyaW1nLXR5cGVzL2Rpc3QvaW5kZXguanMiLCIuLi9leGFtcGxlcy9pbnRlcmZhY2VzL2ltZXNzYWdlL2ltZXNzYWdlLm1lZGlhLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvbGF5b3V0LXRpbWVsaW5lLnRzXG4vKipcbiogTWFwIGFic29sdXRlLXNlY29uZCBzZWdtZW50cyB0byBhIGRpcmVjdG9yIHBoYXNlIGxheW91dC5cbipcbiogQHBhcmFtIHNlZ21lbnRzIC0gbmFtZSDihpIgZHVyYXRpb24gaW4gc2Vjb25kcyAobXVzdCBiZSA+IDApLiBPYmplY3Qga2V5IG9yZGVyIGlzIHByZXNlcnZlZC5cbiogQHJldHVybnMgcGVyY2VudCBwaGFzZXMgKHN1bSAxMDAlKSwgdG90YWxTZWNvbmRzLCBhbmQgc3RhYmxlIG9yZGVyXG4qXG4qIEBleGFtcGxlXG4qIGBgYHRzXG4qIGNvbnN0IHsgcGhhc2VzLCB0b3RhbFNlY29uZHMgfSA9IGxheW91dFRpbWVsaW5lKHsgYm9vdDogMSwgdHlwZTogMiwgZXZlbnRfMDogMC45IH0pO1xuKiAvLyByZXNvbHZlOiByZXR1cm4geyBkdXJhdGlvbjogYCR7dG90YWxTZWNvbmRzfXNgLCBwaGFzZXMgfVxuKiAvLyByZW5kZXI6ICBjb25zdCBkID0gY3R4LmRpcmVjdG9yKHBoYXNlcylcbiogYGBgXG4qL1xuZnVuY3Rpb24gbGF5b3V0VGltZWxpbmUoc2VnbWVudHMpIHtcblx0Y29uc3Qgb3JkZXIgPSBPYmplY3Qua2V5cyhzZWdtZW50cyk7XG5cdGlmIChvcmRlci5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihcImxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnRzIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgcGhhc2VcIik7XG5cdGNvbnN0IHNlY29uZHMgPSBvcmRlci5tYXAoKG5hbWUpID0+IHtcblx0XHRjb25zdCBzID0gc2VnbWVudHNbbmFtZV07XG5cdFx0aWYgKCFOdW1iZXIuaXNGaW5pdGUocykgfHwgcyA8PSAwKSB0aHJvdyBuZXcgRXJyb3IoYGxheW91dFRpbWVsaW5lKCk6IHNlZ21lbnQgXCIke25hbWV9XCIgbXVzdCBiZSBhIGZpbml0ZSBudW1iZXIgPiAwIChnb3QgJHtzfSlgKTtcblx0XHRyZXR1cm4gcztcblx0fSk7XG5cdGNvbnN0IHRvdGFsU2Vjb25kcyA9IHNlY29uZHMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG5cdGNvbnN0IHBoYXNlcyA9IHt9O1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IG9yZGVyLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgbmFtZSA9IG9yZGVyW2ldO1xuXHRcdHBoYXNlc1tuYW1lXSA9IGAke3NlY29uZHNbaV0gLyB0b3RhbFNlY29uZHMgKiAxMDB9JWA7XG5cdH1cblx0cmV0dXJuIHtcblx0XHRwaGFzZXMsXG5cdFx0dG90YWxTZWNvbmRzLFxuXHRcdG9yZGVyXG5cdH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGxheW91dFRpbWVsaW5lIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWxheW91dC10aW1lbGluZS5qcy5tYXAiLCIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSwgbGF5b3V0VGltZWxpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlYWN0aW9uIHtcbiAgZW1vamk6IHN0cmluZztcbiAgc2VuZGVyOiBcInVzZXJcIiB8IFwiY29udGFjdFwiO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2Uge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHNlbmRlcjogXCJ1c2VyXCIgfCBcImNvbnRhY3RcIjtcbiAgdHlwaW5nSGVzaXRhdGlvbj86IGJvb2xlYW47XG4gIHJlYWN0aW9ucz86IFJlYWN0aW9uW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgaU1lc3NhZ2VEYXRhIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb250YWN0TmFtZTogc3RyaW5nO1xuICBjb250YWN0QXZhdGFyPzogc3RyaW5nO1xuICBtZXNzYWdlczogTWVzc2FnZVtdO1xuICB0aGVtZTogXCJsaWdodFwiIHwgXCJkYXJrXCI7XG4gIHRpbWluZ1ByZXNldDogXCJyYXBpZFwiIHwgXCJuYXR1cmFsXCIgfCBcImRyYW1hdGljXCI7XG4gIHNob3dIZWFkZXI6IGJvb2xlYW47XG4gIHNob3dUeXBpbmdJbmRpY2F0b3I6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIG1lc3NhZ2VXZWlnaHQobTogTWVzc2FnZSk6IG51bWJlciB7XG4gIGNvbnN0IGJhc2UgPSBNYXRoLm1heCgxLjIsIG0udGV4dC5sZW5ndGggLyA0MCk7XG4gIHJldHVybiBiYXNlICsgKG0udHlwaW5nSGVzaXRhdGlvbiA/IDAuNiA6IDApO1xufVxuXG5mdW5jdGlvbiBlc3RpbWF0ZUlNZXNzYWdlVGltZWxpbmUoZGF0YTogaU1lc3NhZ2VEYXRhKSB7XG4gIGNvbnN0IHBhY2UgPVxuICAgIGRhdGEudGltaW5nUHJlc2V0ID09PSBcInJhcGlkXCIgPyAwLjg1IDogZGF0YS50aW1pbmdQcmVzZXQgPT09IFwiZHJhbWF0aWNcIiA/IDEuMjUgOiAxO1xuICBjb25zdCB3ZWlnaHRzID0gZGF0YS5tZXNzYWdlcy5tYXAobWVzc2FnZVdlaWdodCk7XG4gIGNvbnN0IG1lc3NhZ2VzUyA9IE1hdGgubWF4KDMsIHdlaWdodHMucmVkdWNlKChhLCB3KSA9PiBhICsgdywgMCkgKiAxLjcgKiBwYWNlKTtcbiAgY29uc3QgaG9sZFMgPSBNYXRoLm1heCgwLjcsIG1lc3NhZ2VzUyAqICgxIC8gOSkpO1xuICByZXR1cm4gbGF5b3V0VGltZWxpbmUoeyBtZXNzYWdlczogbWVzc2FnZXNTLCBob2xkOiBob2xkUyB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lPGlNZXNzYWdlRGF0YT4oe1xuICBzYW1wbGU6IHtcbiAgICBjb250YWN0TmFtZTogXCJBbGV4XCIsXG4gICAgbWVzc2FnZXM6IFtcbiAgICAgIHsgaWQ6IFwiMVwiLCB0ZXh0OiBcIkhleSwgZGlkIHlvdSBzZWUgU3VwZXJJbWc/XCIsIHNlbmRlcjogXCJjb250YWN0XCIgfSxcbiAgICAgIHsgaWQ6IFwiMlwiLCB0ZXh0OiBcIllvdSBjYW4gcmVuZGVyIEhUTUwgdGVtcGxhdGVzIHN0cmFpZ2h0IHRvIE1QNFwiLCBzZW5kZXI6IFwiY29udGFjdFwiIH0sXG4gICAgICB7IGlkOiBcIjNcIiwgdGV4dDogXCJKdXN0IHNoaXBwZWQgbXkgZmlyc3QgZGV2IHJlZWwgd2l0aCBpdFwiLCBzZW5kZXI6IFwidXNlclwiIH0sXG4gICAgXSxcbiAgICB0aGVtZTogXCJsaWdodFwiLFxuICAgIHRpbWluZ1ByZXNldDogXCJuYXR1cmFsXCIsXG4gICAgc2hvd0hlYWRlcjogdHJ1ZSxcbiAgICBzaG93VHlwaW5nSW5kaWNhdG9yOiB0cnVlLFxuICB9LFxuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCIxMS40c1wiLCAvLyBBU1QgZmFsbGJhY2s7IHJlc29sdmUoKSBvdmVycmlkZXNcbiAgfSxcbiAgcmVzb2x2ZSh7IGRhdGEgfSkge1xuICAgIGNvbnN0IHsgdG90YWxTZWNvbmRzLCBwaGFzZXMgfSA9IGVzdGltYXRlSU1lc3NhZ2VUaW1lbGluZShkYXRhKTtcbiAgICByZXR1cm4geyBkdXJhdGlvbjogYCR7dG90YWxTZWNvbmRzfXNgLCBwaGFzZXMgfTtcbiAgfSxcbiAgcmVuZGVyKGN0eDogUmVuZGVyQ29udGV4dDxpTWVzc2FnZURhdGE+KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIGRhdGEgfSA9IGN0eDtcbiAgICBjb25zdCB7XG4gICAgICBjb250YWN0TmFtZSxcbiAgICAgIGNvbnRhY3RBdmF0YXIsXG4gICAgICBtZXNzYWdlcyxcbiAgICAgIHRoZW1lLFxuICAgICAgdGltaW5nUHJlc2V0LFxuICAgICAgc2hvd0hlYWRlcixcbiAgICAgIHNob3dUeXBpbmdJbmRpY2F0b3IsXG4gICAgfSA9IGRhdGE7XG5cbiAgICBjb25zdCBtc2dDb3VudCA9IG1lc3NhZ2VzLmxlbmd0aDtcbiAgICBjb25zdCBzZXFFbnRlciA9IHRpbWluZ1ByZXNldCA9PT0gXCJyYXBpZFwiID8gMC4yNSA6IHRpbWluZ1ByZXNldCA9PT0gXCJkcmFtYXRpY1wiID8gMC40NSA6IDAuMzU7XG4gICAgY29uc3QgeyBwaGFzZXMgfSA9IGVzdGltYXRlSU1lc3NhZ2VUaW1lbGluZShkYXRhKTtcbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHBoYXNlcyk7XG4gICAgY29uc3Qgd2VpZ2h0cyA9IG1lc3NhZ2VzLm1hcChtZXNzYWdlV2VpZ2h0KTtcbiAgICBjb25zdCBzdGsgPSBzdGQuc3RhY2sobWVzc2FnZXMsIHtcbiAgICAgIGR1cmluZzogdC5pbihcIm1lc3NhZ2VzXCIpLFxuICAgICAgbGVhZDogMC4wNSxcbiAgICAgIHRyYWlsOiAwLjA1LFxuICAgICAgZW50ZXI6IHNlcUVudGVyLFxuICAgICAgd2VpZ2h0cyxcbiAgICB9KTtcblxuICAgIC8vIENvbG9yc1xuICAgIGNvbnN0IFRIRU1FID0gdGhlbWUgPT09IFwiZGFya1wiID8ge1xuICAgICAgYmc6IFwiIzAwMDAwMFwiLFxuICAgICAgaGVhZGVyQmc6IFwiIzFDMUMxRVwiLFxuICAgICAgdXNlckJ1YmJsZTogXCJsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCAjMDA3QUZGIDAlLCAjMDA2NkREIDEwMCUpXCIsXG4gICAgICB1c2VyVGV4dDogXCIjZmZmZmZmXCIsXG4gICAgICBjb250YWN0QnViYmxlOiBcIiMzQTNBM0NcIixcbiAgICAgIGNvbnRhY3RUZXh0OiBcIiNmZmZmZmZcIixcbiAgICAgIGhlYWRlclRleHQ6IFwiI2ZmZmZmZlwiLFxuICAgICAgbXV0ZWRUZXh0OiBcIiM4RThFOTNcIixcbiAgICAgIGZvb3RlckJnOiBcIiMxQzFDMUVcIixcbiAgICB9IDoge1xuICAgICAgYmc6IFwiI2ZmZmZmZlwiLFxuICAgICAgaGVhZGVyQmc6IFwiI0Y2RjZGNlwiLFxuICAgICAgdXNlckJ1YmJsZTogXCJsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCAjMDA3QUZGIDAlLCAjMDA2NkREIDEwMCUpXCIsXG4gICAgICB1c2VyVGV4dDogXCIjZmZmZmZmXCIsXG4gICAgICBjb250YWN0QnViYmxlOiBcIiNFOUU5RUJcIixcbiAgICAgIGNvbnRhY3RUZXh0OiBcIiMwMDAwMDBcIixcbiAgICAgIGhlYWRlclRleHQ6IFwiIzAwMDAwMFwiLFxuICAgICAgbXV0ZWRUZXh0OiBcIiM4RThFOTNcIixcbiAgICAgIGZvb3RlckJnOiBcIiNGNkY2RjZcIixcbiAgICB9O1xuXG4gICAgLy8gTGF5b3V0IGNhbGN1bGF0aW9uc1xuICAgIGNvbnN0IGJhc2VGb250U2l6ZSA9IE1hdGgubWluKHdpZHRoLCBoZWlnaHQpICogMC4wMzI7XG4gICAgY29uc3QgaGVhZGVySGVpZ2h0ID0gc2hvd0hlYWRlciA/IGhlaWdodCAqIDAuMDggOiAwO1xuICAgIGNvbnN0IGZvb3RlckhlaWdodCA9IGhlaWdodCAqIDAuMDU1O1xuICAgIGNvbnN0IGNoYXRQYWRkaW5nID0gd2lkdGggKiAwLjA0O1xuICAgIGNvbnN0IGJ1YmJsZU1heFdpZHRoID0gd2lkdGggKiAwLjc1O1xuICAgIGNvbnN0IG1lc3NhZ2VHYXAgPSBiYXNlRm9udFNpemUgKiAwLjg7XG5cbiAgICAvLyBUeXBpbmcgaW5kaWNhdG9yIEhUTUxcbiAgICBmdW5jdGlvbiByZW5kZXJUeXBpbmdJbmRpY2F0b3IocHJvZ3Jlc3M6IG51bWJlcik6IHN0cmluZyB7XG4gICAgICBjb25zdCBkb3RTaXplID0gYmFzZUZvbnRTaXplICogMC40O1xuICAgICAgY29uc3QgYm91bmNlT2Zmc2V0ID0gWzAsIDAuMiwgMC40XTtcblxuICAgICAgbGV0IGRvdHNIdG1sID0gXCJcIjtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGRvdFByb2dyZXNzID0gKHByb2dyZXNzICogMyArIGJvdW5jZU9mZnNldFtpXSEpICUgMTtcbiAgICAgICAgY29uc3QgYm91bmNlID0gTWF0aC5zaW4oZG90UHJvZ3Jlc3MgKiBNYXRoLlBJKSAqIDQ7XG4gICAgICAgIGRvdHNIdG1sICs9IGA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgd2lkdGg6JHtkb3RTaXplfXB4O1xuICAgICAgICAgIGhlaWdodDoke2RvdFNpemV9cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLm11dGVkVGV4dH07XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czo1MCU7XG4gICAgICAgICAgdHJhbnNmb3JtOnRyYW5zbGF0ZVkoJHstYm91bmNlfXB4KTtcbiAgICAgICAgXCI+PC9kaXY+YDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OmZsZXgtc3RhcnQ7XG4gICAgICAgIG1hcmdpbi1sZWZ0OiR7Y2hhdFBhZGRpbmd9cHg7XG4gICAgICBcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIGRpc3BsYXk6aW5saW5lLWZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6Y2VudGVyO1xuICAgICAgICAgIGdhcDoke2RvdFNpemUgKiAwLjV9cHg7XG4gICAgICAgICAgcGFkZGluZzoke2Jhc2VGb250U2l6ZSAqIDAuOH1weCAke2Jhc2VGb250U2l6ZSAqIDF9cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLmNvbnRhY3RCdWJibGV9O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemV9cHggJHtiYXNlRm9udFNpemV9cHggJHtiYXNlRm9udFNpemV9cHggJHtiYXNlRm9udFNpemUgKiAwLjI1fXB4O1xuICAgICAgICBcIj4ke2RvdHNIdG1sfTwvZGl2PlxuICAgICAgPC9kaXY+YDtcbiAgICB9XG5cbiAgICAvLyBNZXNzYWdlIGJ1YmJsZSBhbmltYXRpb25cbiAgICBmdW5jdGlvbiBnZXRCdWJibGVUcmFuc2Zvcm0oZW50ZXJQcm9ncmVzczogbnVtYmVyKTogeyB0cmFuc2Zvcm06IHN0cmluZzsgb3BhY2l0eTogbnVtYmVyIH0ge1xuICAgICAgY29uc3Qgc2NhbGUgPSBzdGQuaW50ZXJwb2xhdGUoZW50ZXJQcm9ncmVzcywgWzAsIDFdLCBbMC4zLCAxXSwgXCJlYXNlT3V0QmFja1wiKTtcbiAgICAgIGNvbnN0IHRyYW5zbGF0ZVkgPSBzdGQuaW50ZXJwb2xhdGUoZW50ZXJQcm9ncmVzcywgWzAsIDFdLCBbMjAsIDBdLCBcImVhc2VPdXRDdWJpY1wiKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRyYW5zZm9ybTogYHNjYWxlKCR7c2NhbGV9KSB0cmFuc2xhdGVZKCR7dHJhbnNsYXRlWX1weClgLFxuICAgICAgICBvcGFjaXR5OiBzdGQuaW50ZXJwb2xhdGUoTWF0aC5taW4oZW50ZXJQcm9ncmVzcyAqIDIsIDEpLCBbMCwgMV0sIFswLCAxXSwgXCJsaW5lYXJcIiksXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIFJlbmRlciByZWFjdGlvbnNcbiAgICBmdW5jdGlvbiByZW5kZXJSZWFjdGlvbnMocmVhY3Rpb25zOiBSZWFjdGlvbltdIHwgdW5kZWZpbmVkLCBpc1VzZXI6IGJvb2xlYW4pOiBzdHJpbmcge1xuICAgICAgaWYgKCFyZWFjdGlvbnMgfHwgcmVhY3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiXCI7XG5cbiAgICAgIGNvbnN0IHJlYWN0aW9uU2l6ZSA9IGJhc2VGb250U2l6ZSAqIDEuMjtcbiAgICAgIGNvbnN0IHBvc2l0aW9uID0gaXNVc2VyID8gXCJsZWZ0Oi04cHg7XCIgOiBcInJpZ2h0Oi04cHg7XCI7XG5cbiAgICAgIHJldHVybiByZWFjdGlvbnMubWFwKChyLCBpKSA9PiBgXG4gICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgICBib3R0b206LSR7cmVhY3Rpb25TaXplICogMC40fXB4O1xuICAgICAgICAgICR7cG9zaXRpb259XG4gICAgICAgICAgYmFja2dyb3VuZDoke3RoZW1lID09PSBcImRhcmtcIiA/IFwiIzJDMkMyRVwiIDogXCIjZmZmZmZmXCJ9O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtyZWFjdGlvblNpemV9cHg7XG4gICAgICAgICAgcGFkZGluZzoke3JlYWN0aW9uU2l6ZSAqIDAuMTV9cHggJHtyZWFjdGlvblNpemUgKiAwLjI1fXB4O1xuICAgICAgICAgIGZvbnQtc2l6ZToke3JlYWN0aW9uU2l6ZSAqIDAuOH1weDtcbiAgICAgICAgICBib3gtc2hhZG93OjAgMXB4IDNweCByZ2JhKDAsMCwwLDAuMik7XG4gICAgICAgICAgdHJhbnNmb3JtOnRyYW5zbGF0ZVgoJHtpICogcmVhY3Rpb25TaXplICogMC42fXB4KTtcbiAgICAgICAgXCI+JHtyLmVtb2ppfTwvZGl2PlxuICAgICAgYCkuam9pbihcIlwiKTtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCBtZXNzYWdlcyBIVE1MXG4gICAgbGV0IG1lc3NhZ2VzSHRtbCA9IFwiXCI7XG4gICAgbGV0IGN1cnJlbnRUeXBpbmdIdG1sID0gXCJcIjtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXNnQ291bnQ7IGkrKykge1xuICAgICAgY29uc3QgbXNnID0gbWVzc2FnZXNbaV0hO1xuICAgICAgY29uc3QgaXRlbSA9IHN0ay5zdGF0ZShpKTtcbiAgICAgIGlmIChpdGVtLnN0YXRlID09PSBcImhpZGRlblwiKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXNVc2VyID0gbXNnLnNlbmRlciA9PT0gXCJ1c2VyXCI7XG5cbiAgICAgIGlmICghaXNVc2VyICYmIHNob3dUeXBpbmdJbmRpY2F0b3IgJiYgaXRlbS5zdGF0ZSA9PT0gXCJlbnRlcmluZ1wiICYmIGl0ZW0uc2xvdCA8IDAuNSkge1xuICAgICAgICBjb25zdCB0eXBpbmdQcm9ncmVzcyA9IGl0ZW0uc2xvdCAqIDI7XG4gICAgICAgIGlmIChtc2cudHlwaW5nSGVzaXRhdGlvbikge1xuICAgICAgICAgIGNvbnN0IHNob3dUeXBpbmcgPSB0eXBpbmdQcm9ncmVzcyA8IDAuMzAgfHwgdHlwaW5nUHJvZ3Jlc3MgPiAwLjU1O1xuICAgICAgICAgIGlmIChzaG93VHlwaW5nKSB7XG4gICAgICAgICAgICBjb25zdCBhZGp1c3RlZFByb2dyZXNzID0gdHlwaW5nUHJvZ3Jlc3MgPCAwLjMwXG4gICAgICAgICAgICAgID8gdHlwaW5nUHJvZ3Jlc3MgLyAwLjMwXG4gICAgICAgICAgICAgIDogTWF0aC5taW4oKHR5cGluZ1Byb2dyZXNzIC0gMC41NSkgLyAwLjQ1ICogMS4zLCAxKTtcbiAgICAgICAgICAgIGN1cnJlbnRUeXBpbmdIdG1sID0gcmVuZGVyVHlwaW5nSW5kaWNhdG9yKGFkanVzdGVkUHJvZ3Jlc3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50VHlwaW5nSHRtbCA9IHJlbmRlclR5cGluZ0luZGljYXRvcih0eXBpbmdQcm9ncmVzcyk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGJ1YmJsZVAgPSBpc1VzZXIgfHwgIXNob3dUeXBpbmdJbmRpY2F0b3JcbiAgICAgICAgPyBpdGVtLmVudGVyXG4gICAgICAgIDogaXRlbS5zdGF0ZSA9PT0gXCJlbnRlcmluZ1wiXG4gICAgICAgICAgPyBzdGQuaW50ZXJwb2xhdGUoaXRlbS5zbG90LCBbMC41LCAxXSwgWzAsIDFdKVxuICAgICAgICAgIDogaXRlbS5zdGF0ZSA9PT0gXCJyZXZlYWxlZFwiXG4gICAgICAgICAgICA/IDFcbiAgICAgICAgICAgIDogMDtcbiAgICAgIGlmIChidWJibGVQIDw9IDApIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCB7IHRyYW5zZm9ybSwgb3BhY2l0eSB9ID0gZ2V0QnViYmxlVHJhbnNmb3JtKGJ1YmJsZVApO1xuXG4gICAgICBjb25zdCBidWJibGVTdHlsZSA9IGlzVXNlclxuICAgICAgICA/IGBiYWNrZ3JvdW5kOiR7VEhFTUUudXNlckJ1YmJsZX07Y29sb3I6JHtUSEVNRS51c2VyVGV4dH07Ym9yZGVyLXJhZGl1czoke2Jhc2VGb250U2l6ZX1weCAke2Jhc2VGb250U2l6ZX1weCAke2Jhc2VGb250U2l6ZSAqIDAuMjV9cHggJHtiYXNlRm9udFNpemV9cHg7bWFyZ2luLWxlZnQ6YXV0bzttYXJnaW4tcmlnaHQ6JHtjaGF0UGFkZGluZ31weDtgXG4gICAgICAgIDogYGJhY2tncm91bmQ6JHtUSEVNRS5jb250YWN0QnViYmxlfTtjb2xvcjoke1RIRU1FLmNvbnRhY3RUZXh0fTtib3JkZXItcmFkaXVzOiR7YmFzZUZvbnRTaXplfXB4ICR7YmFzZUZvbnRTaXplfXB4ICR7YmFzZUZvbnRTaXplfXB4ICR7YmFzZUZvbnRTaXplICogMC4yNX1weDttYXJnaW4tbGVmdDoke2NoYXRQYWRkaW5nfXB4O2A7XG5cbiAgICAgIGNvbnN0IHRyYW5zZm9ybU9yaWdpbiA9IGlzVXNlciA/IFwiYm90dG9tIHJpZ2h0XCIgOiBcImJvdHRvbSBsZWZ0XCI7XG5cbiAgICAgIG1lc3NhZ2VzSHRtbCArPSBgXG4gICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICBwb3NpdGlvbjpyZWxhdGl2ZTtcbiAgICAgICAgICBtYXgtd2lkdGg6JHtidWJibGVNYXhXaWR0aH1weDtcbiAgICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC43fXB4ICR7YmFzZUZvbnRTaXplfXB4O1xuICAgICAgICAgICR7YnViYmxlU3R5bGV9XG4gICAgICAgICAgZm9udC1zaXplOiR7YmFzZUZvbnRTaXplfXB4O1xuICAgICAgICAgIGxpbmUtaGVpZ2h0OjEuMzU7XG4gICAgICAgICAgdHJhbnNmb3JtOiR7dHJhbnNmb3JtfTtcbiAgICAgICAgICB0cmFuc2Zvcm0tb3JpZ2luOiR7dHJhbnNmb3JtT3JpZ2lufTtcbiAgICAgICAgICBvcGFjaXR5OiR7b3BhY2l0eX07XG4gICAgICAgICAgbWFyZ2luLWJvdHRvbToke21lc3NhZ2VHYXB9cHg7XG4gICAgICAgICAgd29yZC13cmFwOmJyZWFrLXdvcmQ7XG4gICAgICAgIFwiPlxuICAgICAgICAgICR7bXNnLnRleHR9XG4gICAgICAgICAgJHtyZW5kZXJSZWFjdGlvbnMobXNnLnJlYWN0aW9ucywgaXNVc2VyKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICBgO1xuICAgIH1cblxuICAgIC8vIEhlYWRlciBIVE1MIC0gbWluaW1hbDoganVzdCBhdmF0YXIgKyBuYW1lXG4gICAgY29uc3QgaGVhZGVySHRtbCA9IHNob3dIZWFkZXIgPyBgXG4gICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIGhlaWdodDoke2hlYWRlckhlaWdodH1weDtcbiAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLmhlYWRlckJnfTtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgIGp1c3RpZnktY29udGVudDpjZW50ZXI7XG4gICAgICAgIGdhcDoke2Jhc2VGb250U2l6ZSAqIDAuNX1weDtcbiAgICAgIFwiPlxuICAgICAgICAke2NvbnRhY3RBdmF0YXIgPyBgXG4gICAgICAgICAgPGltZyBzcmM9XCIke2NvbnRhY3RBdmF0YXJ9XCIgc3R5bGU9XCJcbiAgICAgICAgICAgIHdpZHRoOiR7YmFzZUZvbnRTaXplICogMn1weDtcbiAgICAgICAgICAgIGhlaWdodDoke2Jhc2VGb250U2l6ZSAqIDJ9cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOjUwJTtcbiAgICAgICAgICAgIG9iamVjdC1maXQ6Y292ZXI7XG4gICAgICAgICAgXCIgLz5cbiAgICAgICAgYCA6IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICB3aWR0aDoke2Jhc2VGb250U2l6ZSAqIDJ9cHg7XG4gICAgICAgICAgICBoZWlnaHQ6JHtiYXNlRm9udFNpemUgKiAyfXB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czo1MCU7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxMzVkZWcsICNBOEE4QUEgMCUsICM4RThFOTMgMTAwJSk7XG4gICAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO1xuICAgICAgICAgICAgY29sb3I6d2hpdGU7XG4gICAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjl9cHg7XG4gICAgICAgICAgICBmb250LXdlaWdodDo2MDA7XG4gICAgICAgICAgXCI+JHtjb250YWN0TmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKX08L2Rpdj5cbiAgICAgICAgYH1cbiAgICAgICAgPHNwYW4gc3R5bGU9XCJcbiAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjk1fXB4O1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OjYwMDtcbiAgICAgICAgICBjb2xvcjoke1RIRU1FLmhlYWRlclRleHR9O1xuICAgICAgICBcIj4ke2NvbnRhY3ROYW1lfTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgIGAgOiBcIlwiO1xuXG4gICAgLy8gRm9vdGVyIEhUTUwgLSBhdXRoZW50aWMgaU1lc3NhZ2UgaW5wdXQgYmFyXG4gICAgY29uc3QgZm9vdGVySHRtbCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgcG9zaXRpb246YWJzb2x1dGU7XG4gICAgICAgIGJvdHRvbTowO1xuICAgICAgICBsZWZ0OjA7XG4gICAgICAgIHJpZ2h0OjA7XG4gICAgICAgIGhlaWdodDoke2Zvb3RlckhlaWdodH1weDtcbiAgICAgICAgYmFja2dyb3VuZDoke1RIRU1FLmJnfTtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgIHBhZGRpbmc6MCAke2Jhc2VGb250U2l6ZSAqIDAuNX1weDtcbiAgICAgIFwiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgZmxleDoxO1xuICAgICAgICAgIGhlaWdodDoke2Jhc2VGb250U2l6ZSAqIDIuMn1weDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiR7dGhlbWUgPT09IFwiZGFya1wiID8gXCIjMUMxQzFFXCIgOiBcIiNGRkZGRkZcIn07XG4gICAgICAgICAgYm9yZGVyOjFweCBzb2xpZCAke3RoZW1lID09PSBcImRhcmtcIiA/IFwiIzM4MzgzQVwiIDogXCIjQzZDNkM4XCJ9O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6JHtiYXNlRm9udFNpemUgKiAxLjF9cHg7XG4gICAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAgICBwYWRkaW5nOjAgJHtiYXNlRm9udFNpemUgKiAwLjd9cHg7XG4gICAgICAgICAgcG9zaXRpb246cmVsYXRpdmU7XG4gICAgICAgIFwiPlxuICAgICAgICAgIDxzcGFuIHN0eWxlPVwiXG4gICAgICAgICAgICBjb2xvcjojOEU4RTkzO1xuICAgICAgICAgICAgZm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC45NX1weDtcbiAgICAgICAgICBcIj5pTWVzc2FnZTwvc3Bhbj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgICAgIHJpZ2h0OiR7YmFzZUZvbnRTaXplICogMC40fXB4O1xuICAgICAgICAgICAgd2lkdGg6JHtiYXNlRm9udFNpemUgKiAxLjZ9cHg7XG4gICAgICAgICAgICBoZWlnaHQ6JHtiYXNlRm9udFNpemUgKiAxLjZ9cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOjUwJTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6JHt0aGVtZSA9PT0gXCJkYXJrXCIgPyBcIiMzODM4M0FcIiA6IFwiI0U1RTVFQVwifTtcbiAgICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDpjZW50ZXI7XG4gICAgICAgICAgXCI+XG4gICAgICAgICAgICA8c3BhbiBzdHlsZT1cIlxuICAgICAgICAgICAgICBjb2xvcjojOEU4RTkzO1xuICAgICAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjl9cHg7XG4gICAgICAgICAgICAgIGxpbmUtaGVpZ2h0OjE7XG4gICAgICAgICAgICAgIG1hcmdpbi10b3A6LTFweDtcbiAgICAgICAgICAgIFwiPuKGkTwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICBgO1xuXG4gICAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgd2lkdGg6JHt3aWR0aH1weDtcbiAgICAgICAgaGVpZ2h0OiR7aGVpZ2h0fXB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiR7VEhFTUUuYmd9O1xuICAgICAgICBmb250LWZhbWlseTotYXBwbGUtc3lzdGVtLEJsaW5rTWFjU3lzdGVtRm9udCwnSW50ZXInLCdTZWdvZSBVSScsUm9ib3RvLHNhbnMtc2VyaWY7XG4gICAgICAgIHBvc2l0aW9uOnJlbGF0aXZlO1xuICAgICAgICBvdmVyZmxvdzpoaWRkZW47XG4gICAgICBcIj5cbiAgICAgICAgJHtoZWFkZXJIdG1sfVxuXG4gICAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgICB0b3A6JHtoZWFkZXJIZWlnaHR9cHg7XG4gICAgICAgICAgbGVmdDowO1xuICAgICAgICAgIHJpZ2h0OjA7XG4gICAgICAgICAgYm90dG9tOiR7Zm9vdGVySGVpZ2h0fXB4O1xuICAgICAgICAgIG92ZXJmbG93OmhpZGRlbjtcbiAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgZmxleC1kaXJlY3Rpb246Y29sdW1uO1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDpmbGV4LWVuZDtcbiAgICAgICAgICBwYWRkaW5nLWJvdHRvbToke2Jhc2VGb250U2l6ZX1weDtcbiAgICAgICAgXCI+XG4gICAgICAgICAgJHttZXNzYWdlc0h0bWx9XG4gICAgICAgICAgJHtjdXJyZW50VHlwaW5nSHRtbH1cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgJHtmb290ZXJIdG1sfVxuICAgICAgPC9kaXY+XG4gICAgYDtcbiAgfSxcbn0pO1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FjQSxTQUFTLGVBQWUsVUFBVTtFQUNqQyxNQUFNLFFBQVEsT0FBTyxLQUFLLFFBQVE7RUFDbEMsSUFBSSxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksTUFBTSx5REFBeUQ7RUFDakcsTUFBTSxVQUFVLE1BQU0sS0FBSyxT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