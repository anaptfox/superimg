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
	exports.default = define({
		sample: {
			author: {
				name: "Thread Master",
				handle: "threadmaster",
				avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=thread"
			},
			tweets: [
				{
					id: "1",
					text: "Here's why every dev should learn video marketing (thread):",
					position: 1
				},
				{
					id: "2",
					text: "1. Video gets 10x more engagement than text",
					position: 2
				},
				{
					id: "3",
					text: "2. It builds trust faster than blog posts",
					position: 3
				}
			],
			theme: "dark",
			transitionStyle: "slide",
			showPosition: true
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "9s"
		},
		render(ctx) {
			const { std, width, height, timeline, data } = ctx;
			const { author, tweets, theme = "dark", transitionStyle = "slide", showPosition = true } = data;
			const tweetCount = tweets.length;
			const THEME = {
				bg: theme === "dark" ? "#0a0a0a" : "#fafafa",
				text: theme === "dark" ? "#ffffff" : "#0a0a0a",
				muted: theme === "dark" ? "#71717a" : "#a1a1aa",
				cardBg: theme === "dark" ? "#16181c" : "#ffffff",
				accent: "#1d9bf0"
			};
			const t = ctx.director({
				intro: "8%",
				tweets: "84%",
				count: "4%",
				outro: "4%"
			});
			const car = std.carousel(tweets, {
				during: t.in("tweets"),
				enter: .3,
				exit: .25,
				last: "hold"
			});
			const authorProgress = std.interpolate(t.in("intro"), [0, 1], [0, 1], "easeOutCubic");
			const finalCountProgress = std.interpolate(t.in("count"), [0, 1], [0, 1], "easeOutCubic");
			const globalOpacity = 1 - std.interpolate(t.in("outro"), [0, 1], [0, 1], "easeOutCubic");
			const baseFontSize = Math.min(width, height) * .038;
			const headerHeight = height * .15;
			const cardPadding = width * .06;
			const cardWidth = width - cardPadding * 2;
			const cardHeight = height - headerHeight - cardPadding * 2.5;
			let currentTweetHtml = "";
			for (let i = 0; i < tweetCount; i++) {
				const tweet = tweets[i];
				const item = car.state(i);
				if (item.state === "hidden" || item.state === "gone") continue;
				const { enter, exit, state: phase } = item;
				let transform = "";
				let opacity = 1;
				if (transitionStyle === "slide") {
					if (phase === "entering") {
						transform = `translateX(${(1 - enter) * 100}%)`;
						opacity = enter;
					} else if (phase === "exiting") {
						transform = `translateX(${-exit * 100}%)`;
						opacity = 1 - exit;
					}
				} else if (transitionStyle === "stack") {
					if (phase === "entering") {
						transform = `translateY(${(1 - enter) * 30}px) scale(${.9 + enter * .1})`;
						opacity = enter;
					} else if (phase === "exiting") {
						transform = `translateY(${-exit * 20}px) scale(${1 - exit * .05})`;
						opacity = 1 - exit * .8;
					}
				} else if (transitionStyle === "flip") {
					if (phase === "entering") {
						transform = `perspective(1000px) rotateY(${(1 - enter) * 90}deg)`;
						opacity = enter;
					} else if (phase === "exiting") {
						transform = `perspective(1000px) rotateY(${exit * -90}deg)`;
						opacity = 1 - exit;
					}
				}
				const zIndex = phase === "entering" ? 2 : 1;
				currentTweetHtml += `
      <div style="
        position:absolute;
        left:${cardPadding}px;
        top:${headerHeight + cardPadding * .5}px;
        width:${cardWidth}px;
        height:${cardHeight}px;
        background:${THEME.cardBg};
        border-radius:${baseFontSize * .8}px;
        padding:${baseFontSize * 1.2}px;
        box-shadow:0 4px 20px rgba(0,0,0,0.15);
        transform:${transform};
        opacity:${opacity};
        z-index:${zIndex};
        display:flex;
        flex-direction:column;
        box-sizing:border-box;
      ">
        <div style="display:flex;align-items:center;gap:${baseFontSize * .6}px;margin-bottom:${baseFontSize * .8}px;">
          ${author.avatar ? `
            <img src="${author.avatar}" style="width:${baseFontSize * 2}px;height:${baseFontSize * 2}px;border-radius:50%;object-fit:cover;" />
          ` : `
            <div style="width:${baseFontSize * 2}px;height:${baseFontSize * 2}px;border-radius:50%;background:${THEME.accent};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${baseFontSize * .9}px;">
              ${author.name.charAt(0).toUpperCase()}
            </div>
          `}
          <div>
            <div style="font-size:${baseFontSize * .85}px;font-weight:700;color:${THEME.text};">${author.name}</div>
            <div style="font-size:${baseFontSize * .7}px;color:${THEME.muted};">@${author.handle}</div>
          </div>
          ${showPosition ? `
            <div style="margin-left:auto;font-size:${baseFontSize * .7}px;color:${THEME.accent};font-weight:600;">
              ${tweet.position}/${tweetCount}
            </div>
          ` : ""}
        </div>

        <div style="
          flex:1;
          font-size:${baseFontSize * 1.1}px;
          color:${THEME.text};
          line-height:1.5;
          overflow:hidden;
          display:-webkit-box;
          -webkit-line-clamp:8;
          -webkit-box-orient:vertical;
        ">${tweet.text}</div>

        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * .3}px;
          margin-top:${baseFontSize * .6}px;
          padding-top:${baseFontSize * .6}px;
          border-top:1px solid ${THEME.muted}30;
          color:${THEME.accent};
          font-size:${baseFontSize * .65}px;
          font-weight:500;
        ">
          <svg width="${baseFontSize * .8}" height="${baseFontSize * .8}" viewBox="0 0 24 24" fill="currentColor">
            <path t="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Thread
        </div>
      </div>
    `;
			}
			const showFinalCount = finalCountProgress > 0 && tweetCount > 1;
			return `
    <div style="width:${width}px;height:${height}px;background:${THEME.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;opacity:${globalOpacity};">

      <div style="
        position:absolute;
        top:0;
        left:0;
        right:0;
        height:${headerHeight}px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:${baseFontSize * .8}px;
        opacity:${authorProgress};
        transform:translateY(${(1 - authorProgress) * -15}px);
      ">
        ${author.avatar ? `
          <img src="${author.avatar}" style="width:${baseFontSize * 2.5}px;height:${baseFontSize * 2.5}px;border-radius:50%;object-fit:cover;border:2px solid ${THEME.accent};" />
        ` : `
          <div style="width:${baseFontSize * 2.5}px;height:${baseFontSize * 2.5}px;border-radius:50%;background:${THEME.accent};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${baseFontSize * 1.2}px;border:2px solid ${THEME.accent};">
            ${author.name.charAt(0).toUpperCase()}
          </div>
        `}
        <div>
          <div style="font-size:${baseFontSize * 1}px;font-weight:700;color:${THEME.text};">${author.name}</div>
          <div style="font-size:${baseFontSize * .75}px;color:${THEME.accent};">🧵 Thread</div>
        </div>
      </div>

      ${currentTweetHtml}

      ${showFinalCount ? `
        <div style="
          position:absolute;
          bottom:${cardPadding}px;
          left:50%;
          transform:translateX(-50%);
          font-size:${baseFontSize * .8}px;
          color:${THEME.muted};
          opacity:${finalCountProgress};
        ">
          ${tweetCount} tweets
        </div>
      ` : ""}

    </div>
  `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWFkLm1lZGlhLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3N1cGVyaW1nLXR5cGVzL2Rpc3QvaW5kZXguanMiLCIuLi9leGFtcGxlcy9zb2NpYWwvdGhyZWFkL3RocmVhZC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSwgdHlwZSBSZW5kZXJDb250ZXh0IH0gZnJvbSBcInN1cGVyaW1nXCI7XG5cbmV4cG9ydCB0eXBlIFRyYW5zaXRpb25TdHlsZSA9IFwic2xpZGVcIiB8IFwic3RhY2tcIiB8IFwiZmxpcFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRocmVhZFR3ZWV0IHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBwb3NpdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRocmVhZEF1dGhvciB7XG4gIG5hbWU6IHN0cmluZztcbiAgaGFuZGxlOiBzdHJpbmc7XG4gIGF2YXRhcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUaHJlYWREYXRhIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBhdXRob3I6IFRocmVhZEF1dGhvcjtcbiAgdHdlZXRzOiBUaHJlYWRUd2VldFtdO1xuICB0aGVtZT86IFwibGlnaHRcIiB8IFwiZGFya1wiO1xuICB0cmFuc2l0aW9uU3R5bGU/OiBUcmFuc2l0aW9uU3R5bGU7XG4gIHNob3dQb3NpdGlvbj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZTxUaHJlYWREYXRhPih7XG4gIHNhbXBsZToge1xuICAgIGF1dGhvcjoge1xuICAgICAgbmFtZTogXCJUaHJlYWQgTWFzdGVyXCIsXG4gICAgICBoYW5kbGU6IFwidGhyZWFkbWFzdGVyXCIsXG4gICAgICBhdmF0YXI6IFwiaHR0cHM6Ly9hcGkuZGljZWJlYXIuY29tLzcueC9hdmF0YWFhcnMvc3ZnP3NlZWQ9dGhyZWFkXCIsXG4gICAgfSxcbiAgICB0d2VldHM6IFtcbiAgICAgIHsgaWQ6IFwiMVwiLCB0ZXh0OiBcIkhlcmUncyB3aHkgZXZlcnkgZGV2IHNob3VsZCBsZWFybiB2aWRlbyBtYXJrZXRpbmcgKHRocmVhZCk6XCIsIHBvc2l0aW9uOiAxIH0sXG4gICAgICB7IGlkOiBcIjJcIiwgdGV4dDogXCIxLiBWaWRlbyBnZXRzIDEweCBtb3JlIGVuZ2FnZW1lbnQgdGhhbiB0ZXh0XCIsIHBvc2l0aW9uOiAyIH0sXG4gICAgICB7IGlkOiBcIjNcIiwgdGV4dDogXCIyLiBJdCBidWlsZHMgdHJ1c3QgZmFzdGVyIHRoYW4gYmxvZyBwb3N0c1wiLCBwb3NpdGlvbjogMyB9LFxuICAgIF0sXG4gICAgdGhlbWU6IFwiZGFya1wiLFxuICAgIHRyYW5zaXRpb25TdHlsZTogXCJzbGlkZVwiLFxuICAgIHNob3dQb3NpdGlvbjogdHJ1ZSxcbiAgfSxcbiAgY29uZmlnOiB7XG4gICAgd2lkdGg6IDE5MjAsXG4gICAgaGVpZ2h0OiAxMDgwLFxuICAgIGZwczogMzAsXG4gICAgZHVyYXRpb246IFwiOXNcIixcbiAgfSxcbiAgcmVuZGVyKGN0eDogUmVuZGVyQ29udGV4dDxUaHJlYWREYXRhPikge1xuICAgIGNvbnN0IHsgc3RkLCB3aWR0aCwgaGVpZ2h0LCB0aW1lbGluZSwgZGF0YSB9ID0gY3R4O1xuICAgIGNvbnN0IHtcbiAgICAgIGF1dGhvcixcbiAgICAgIHR3ZWV0cyxcbiAgICAgIHRoZW1lID0gXCJkYXJrXCIsXG4gICAgICB0cmFuc2l0aW9uU3R5bGUgPSBcInNsaWRlXCIsXG4gICAgICBzaG93UG9zaXRpb24gPSB0cnVlLFxuICAgIH0gPSBkYXRhO1xuXG4gICAgY29uc3QgdHdlZXRDb3VudCA9IHR3ZWV0cy5sZW5ndGg7XG5cbiAgICBjb25zdCBiZ0NvbG9yID0gdGhlbWUgPT09IFwiZGFya1wiID8gXCIjMGEwYTBhXCIgOiBcIiNmYWZhZmFcIjtcbiAgICBjb25zdCB0ZXh0Q29sb3IgPSB0aGVtZSA9PT0gXCJkYXJrXCIgPyBcIiNmZmZmZmZcIiA6IFwiIzBhMGEwYVwiO1xuICAgIGNvbnN0IG11dGVkQ29sb3IgPSB0aGVtZSA9PT0gXCJkYXJrXCIgPyBcIiM3MTcxN2FcIiA6IFwiI2ExYTFhYVwiO1xuICAgIGNvbnN0IGNhcmRCZyA9IHRoZW1lID09PSBcImRhcmtcIiA/IFwiIzE2MTgxY1wiIDogXCIjZmZmZmZmXCI7XG4gICAgY29uc3QgYWNjZW50Q29sb3IgPSBcIiMxZDliZjBcIjtcblxuICAgIGNvbnN0IFRIRU1FID0geyBiZzogYmdDb2xvciwgdGV4dDogdGV4dENvbG9yLCBtdXRlZDogbXV0ZWRDb2xvciwgY2FyZEJnLCBhY2NlbnQ6IGFjY2VudENvbG9yIH07XG5cbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHsgaW50cm86IFwiOCVcIiwgdHdlZXRzOiBcIjg0JVwiLCBjb3VudDogXCI0JVwiLCBvdXRybzogXCI0JVwiIH0pO1xuICAgIGNvbnN0IGNhciA9IHN0ZC5jYXJvdXNlbCh0d2VldHMsIHtcbiAgICAgIGR1cmluZzogdC5pbihcInR3ZWV0c1wiKSxcbiAgICAgIGVudGVyOiAwLjMsXG4gICAgICBleGl0OiAwLjI1LFxuICAgICAgbGFzdDogXCJob2xkXCIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhdXRob3JQcm9ncmVzcyA9IHN0ZC5pbnRlcnBvbGF0ZSh0LmluKFwiaW50cm9cIiksIFswLCAxXSwgWzAsIDFdLCBcImVhc2VPdXRDdWJpY1wiKTtcbiAgICBjb25zdCBmaW5hbENvdW50UHJvZ3Jlc3MgPSBzdGQuaW50ZXJwb2xhdGUodC5pbihcImNvdW50XCIpLCBbMCwgMV0sIFswLCAxXSwgXCJlYXNlT3V0Q3ViaWNcIik7XG4gICAgY29uc3QgZmFkZU91dFByb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHQuaW4oXCJvdXRyb1wiKSwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuXG4gICAgY29uc3QgZ2xvYmFsT3BhY2l0eSA9IDEgLSBmYWRlT3V0UHJvZ3Jlc3M7XG4gICAgY29uc3QgYmFzZUZvbnRTaXplID0gTWF0aC5taW4od2lkdGgsIGhlaWdodCkgKiAwLjAzODtcbiAgICBjb25zdCBoZWFkZXJIZWlnaHQgPSBoZWlnaHQgKiAwLjE1O1xuICAgIGNvbnN0IGNhcmRQYWRkaW5nID0gd2lkdGggKiAwLjA2O1xuICAgIGNvbnN0IGNhcmRXaWR0aCA9IHdpZHRoIC0gY2FyZFBhZGRpbmcgKiAyO1xuICAgIGNvbnN0IGNhcmRIZWlnaHQgPSBoZWlnaHQgLSBoZWFkZXJIZWlnaHQgLSBjYXJkUGFkZGluZyAqIDIuNTtcblxuICAgIGxldCBjdXJyZW50VHdlZXRIdG1sID0gXCJcIjtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHdlZXRDb3VudDsgaSsrKSB7XG4gICAgICBjb25zdCB0d2VldCA9IHR3ZWV0c1tpXSE7XG4gICAgICBjb25zdCBpdGVtID0gY2FyLnN0YXRlKGkpO1xuICAgICAgaWYgKGl0ZW0uc3RhdGUgPT09IFwiaGlkZGVuXCIgfHwgaXRlbS5zdGF0ZSA9PT0gXCJnb25lXCIpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCB7IGVudGVyLCBleGl0LCBzdGF0ZTogcGhhc2UgfSA9IGl0ZW07XG5cbiAgICAgIGxldCB0cmFuc2Zvcm0gPSBcIlwiO1xuICAgICAgbGV0IG9wYWNpdHkgPSAxO1xuXG4gICAgICBpZiAodHJhbnNpdGlvblN0eWxlID09PSBcInNsaWRlXCIpIHtcbiAgICAgICAgaWYgKHBoYXNlID09PSBcImVudGVyaW5nXCIpIHtcbiAgICAgICAgICB0cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWCgkeygxIC0gZW50ZXIpICogMTAwfSUpYDtcbiAgICAgICAgICBvcGFjaXR5ID0gZW50ZXI7XG4gICAgICAgIH0gZWxzZSBpZiAocGhhc2UgPT09IFwiZXhpdGluZ1wiKSB7XG4gICAgICAgICAgdHJhbnNmb3JtID0gYHRyYW5zbGF0ZVgoJHstZXhpdCAqIDEwMH0lKWA7XG4gICAgICAgICAgb3BhY2l0eSA9IDEgLSBleGl0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHRyYW5zaXRpb25TdHlsZSA9PT0gXCJzdGFja1wiKSB7XG4gICAgICAgIGlmIChwaGFzZSA9PT0gXCJlbnRlcmluZ1wiKSB7XG4gICAgICAgICAgdHJhbnNmb3JtID0gYHRyYW5zbGF0ZVkoJHsoMSAtIGVudGVyKSAqIDMwfXB4KSBzY2FsZSgkezAuOSArIGVudGVyICogMC4xfSlgO1xuICAgICAgICAgIG9wYWNpdHkgPSBlbnRlcjtcbiAgICAgICAgfSBlbHNlIGlmIChwaGFzZSA9PT0gXCJleGl0aW5nXCIpIHtcbiAgICAgICAgICB0cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWSgkey1leGl0ICogMjB9cHgpIHNjYWxlKCR7MSAtIGV4aXQgKiAwLjA1fSlgO1xuICAgICAgICAgIG9wYWNpdHkgPSAxIC0gZXhpdCAqIDAuODtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0cmFuc2l0aW9uU3R5bGUgPT09IFwiZmxpcFwiKSB7XG4gICAgICAgIGlmIChwaGFzZSA9PT0gXCJlbnRlcmluZ1wiKSB7XG4gICAgICAgICAgY29uc3Qgcm90YXRlWSA9ICgxIC0gZW50ZXIpICogOTA7XG4gICAgICAgICAgdHJhbnNmb3JtID0gYHBlcnNwZWN0aXZlKDEwMDBweCkgcm90YXRlWSgke3JvdGF0ZVl9ZGVnKWA7XG4gICAgICAgICAgb3BhY2l0eSA9IGVudGVyO1xuICAgICAgICB9IGVsc2UgaWYgKHBoYXNlID09PSBcImV4aXRpbmdcIikge1xuICAgICAgICAgIGNvbnN0IHJvdGF0ZVkgPSBleGl0ICogLTkwO1xuICAgICAgICAgIHRyYW5zZm9ybSA9IGBwZXJzcGVjdGl2ZSgxMDAwcHgpIHJvdGF0ZVkoJHtyb3RhdGVZfWRlZylgO1xuICAgICAgICAgIG9wYWNpdHkgPSAxIC0gZXhpdDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCB6SW5kZXggPSBwaGFzZSA9PT0gXCJlbnRlcmluZ1wiID8gMiA6IDE7XG5cbiAgICAgIGN1cnJlbnRUd2VldEh0bWwgKz0gYFxuICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICBwb3NpdGlvbjphYnNvbHV0ZTtcbiAgICAgICAgbGVmdDoke2NhcmRQYWRkaW5nfXB4O1xuICAgICAgICB0b3A6JHtoZWFkZXJIZWlnaHQgKyBjYXJkUGFkZGluZyAqIDAuNX1weDtcbiAgICAgICAgd2lkdGg6JHtjYXJkV2lkdGh9cHg7XG4gICAgICAgIGhlaWdodDoke2NhcmRIZWlnaHR9cHg7XG4gICAgICAgIGJhY2tncm91bmQ6JHtUSEVNRS5jYXJkQmd9O1xuICAgICAgICBib3JkZXItcmFkaXVzOiR7YmFzZUZvbnRTaXplICogMC44fXB4O1xuICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMS4yfXB4O1xuICAgICAgICBib3gtc2hhZG93OjAgNHB4IDIwcHggcmdiYSgwLDAsMCwwLjE1KTtcbiAgICAgICAgdHJhbnNmb3JtOiR7dHJhbnNmb3JtfTtcbiAgICAgICAgb3BhY2l0eToke29wYWNpdHl9O1xuICAgICAgICB6LWluZGV4OiR7ekluZGV4fTtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBmbGV4LWRpcmVjdGlvbjpjb2x1bW47XG4gICAgICAgIGJveC1zaXppbmc6Ym9yZGVyLWJveDtcbiAgICAgIFwiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6JHtiYXNlRm9udFNpemUgKiAwLjZ9cHg7bWFyZ2luLWJvdHRvbToke2Jhc2VGb250U2l6ZSAqIDAuOH1weDtcIj5cbiAgICAgICAgICAke2F1dGhvci5hdmF0YXIgPyBgXG4gICAgICAgICAgICA8aW1nIHNyYz1cIiR7YXV0aG9yLmF2YXRhcn1cIiBzdHlsZT1cIndpZHRoOiR7YmFzZUZvbnRTaXplICogMn1weDtoZWlnaHQ6JHtiYXNlRm9udFNpemUgKiAyfXB4O2JvcmRlci1yYWRpdXM6NTAlO29iamVjdC1maXQ6Y292ZXI7XCIgLz5cbiAgICAgICAgICBgIDogYFxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiR7YmFzZUZvbnRTaXplICogMn1weDtoZWlnaHQ6JHtiYXNlRm9udFNpemUgKiAyfXB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6JHtUSEVNRS5hY2NlbnR9O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtjb2xvcjp3aGl0ZTtmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC45fXB4O1wiPlxuICAgICAgICAgICAgICAke2F1dGhvci5uYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgYH1cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuODV9cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiR7VEhFTUUudGV4dH07XCI+JHthdXRob3IubmFtZX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjd9cHg7Y29sb3I6JHtUSEVNRS5tdXRlZH07XCI+QCR7YXV0aG9yLmhhbmRsZX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAke3Nob3dQb3NpdGlvbiA/IGBcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tbGVmdDphdXRvO2ZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuN31weDtjb2xvcjoke1RIRU1FLmFjY2VudH07Zm9udC13ZWlnaHQ6NjAwO1wiPlxuICAgICAgICAgICAgICAke3R3ZWV0LnBvc2l0aW9ufS8ke3R3ZWV0Q291bnR9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBgIDogXCJcIn1cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIGZsZXg6MTtcbiAgICAgICAgICBmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAxLjF9cHg7XG4gICAgICAgICAgY29sb3I6JHtUSEVNRS50ZXh0fTtcbiAgICAgICAgICBsaW5lLWhlaWdodDoxLjU7XG4gICAgICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgICAgIGRpc3BsYXk6LXdlYmtpdC1ib3g7XG4gICAgICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOjg7XG4gICAgICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OnZlcnRpY2FsO1xuICAgICAgICBcIj4ke3R3ZWV0LnRleHR9PC9kaXY+XG5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgICAgZ2FwOiR7YmFzZUZvbnRTaXplICogMC4zfXB4O1xuICAgICAgICAgIG1hcmdpbi10b3A6JHtiYXNlRm9udFNpemUgKiAwLjZ9cHg7XG4gICAgICAgICAgcGFkZGluZy10b3A6JHtiYXNlRm9udFNpemUgKiAwLjZ9cHg7XG4gICAgICAgICAgYm9yZGVyLXRvcDoxcHggc29saWQgJHtUSEVNRS5tdXRlZH0zMDtcbiAgICAgICAgICBjb2xvcjoke1RIRU1FLmFjY2VudH07XG4gICAgICAgICAgZm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC42NX1weDtcbiAgICAgICAgICBmb250LXdlaWdodDo1MDA7XG4gICAgICAgIFwiPlxuICAgICAgICAgIDxzdmcgd2lkdGg9XCIke2Jhc2VGb250U2l6ZSAqIDAuOH1cIiBoZWlnaHQ9XCIke2Jhc2VGb250U2l6ZSAqIDAuOH1cIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiPlxuICAgICAgICAgICAgPHBhdGggdD1cIk0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNWgtMnYtMmgydjJ6bTAtNGgtMlY3aDJ2NnptNCA0aC0ydi0yaDJ2MnptMC00aC0yVjdoMnY2elwiLz5cbiAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICBUaHJlYWRcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICBgO1xuICAgIH1cblxuICAgIGNvbnN0IHNob3dGaW5hbENvdW50ID0gZmluYWxDb3VudFByb2dyZXNzID4gMCAmJiB0d2VldENvdW50ID4gMTtcblxuICAgIHJldHVybiBgXG4gICAgPGRpdiBzdHlsZT1cIndpZHRoOiR7d2lkdGh9cHg7aGVpZ2h0OiR7aGVpZ2h0fXB4O2JhY2tncm91bmQ6JHtUSEVNRS5iZ307Zm9udC1mYW1pbHk6LWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsJ1NlZ29lIFVJJyxIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZjtwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW47b3BhY2l0eToke2dsb2JhbE9wYWNpdHl9O1wiPlxuXG4gICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIHBvc2l0aW9uOmFic29sdXRlO1xuICAgICAgICB0b3A6MDtcbiAgICAgICAgbGVmdDowO1xuICAgICAgICByaWdodDowO1xuICAgICAgICBoZWlnaHQ6JHtoZWFkZXJIZWlnaHR9cHg7XG4gICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6Y2VudGVyO1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO1xuICAgICAgICBnYXA6JHtiYXNlRm9udFNpemUgKiAwLjh9cHg7XG4gICAgICAgIG9wYWNpdHk6JHthdXRob3JQcm9ncmVzc307XG4gICAgICAgIHRyYW5zZm9ybTp0cmFuc2xhdGVZKCR7KDEgLSBhdXRob3JQcm9ncmVzcykgKiAtMTV9cHgpO1xuICAgICAgXCI+XG4gICAgICAgICR7YXV0aG9yLmF2YXRhciA/IGBcbiAgICAgICAgICA8aW1nIHNyYz1cIiR7YXV0aG9yLmF2YXRhcn1cIiBzdHlsZT1cIndpZHRoOiR7YmFzZUZvbnRTaXplICogMi41fXB4O2hlaWdodDoke2Jhc2VGb250U2l6ZSAqIDIuNX1weDtib3JkZXItcmFkaXVzOjUwJTtvYmplY3QtZml0OmNvdmVyO2JvcmRlcjoycHggc29saWQgJHtUSEVNRS5hY2NlbnR9O1wiIC8+XG4gICAgICAgIGAgOiBgXG4gICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiR7YmFzZUZvbnRTaXplICogMi41fXB4O2hlaWdodDoke2Jhc2VGb250U2l6ZSAqIDIuNX1weDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOiR7VEhFTUUuYWNjZW50fTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Y29sb3I6d2hpdGU7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDEuMn1weDtib3JkZXI6MnB4IHNvbGlkICR7VEhFTUUuYWNjZW50fTtcIj5cbiAgICAgICAgICAgICR7YXV0aG9yLm5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIGB9XG4gICAgICAgIDxkaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDF9cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiR7VEhFTUUudGV4dH07XCI+JHthdXRob3IubmFtZX08L2Rpdj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC43NX1weDtjb2xvcjoke1RIRU1FLmFjY2VudH07XCI+8J+ntSBUaHJlYWQ8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgJHtjdXJyZW50VHdlZXRIdG1sfVxuXG4gICAgICAke3Nob3dGaW5hbENvdW50ID8gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgcG9zaXRpb246YWJzb2x1dGU7XG4gICAgICAgICAgYm90dG9tOiR7Y2FyZFBhZGRpbmd9cHg7XG4gICAgICAgICAgbGVmdDo1MCU7XG4gICAgICAgICAgdHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgICAgICAgZm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC44fXB4O1xuICAgICAgICAgIGNvbG9yOiR7VEhFTUUubXV0ZWR9O1xuICAgICAgICAgIG9wYWNpdHk6JHtmaW5hbENvdW50UHJvZ3Jlc3N9O1xuICAgICAgICBcIj5cbiAgICAgICAgICAke3R3ZWV0Q291bnR9IHR3ZWV0c1xuICAgICAgICA8L2Rpdj5cbiAgICAgIGAgOiBcIlwifVxuXG4gICAgPC9kaXY+XG4gIGA7XG4gIH0sXG59KTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkEsU0FBUyxPQUFPLE9BQU87RUFDdEIsTUFBTSxTQUFTLE1BQU0sVUFBVTtFQUMvQixNQUFNLElBQUksTUFBTTtFQUNoQixNQUFNLGFBQWEsT0FBTyxNQUFNLFlBQVk7RUFDNUMsT0FBTztHQUNOO0dBQ0EsVUFBVSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUUsUUFBUSxhQUFhLEVBQUUsWUFBWSxRQUFRO0dBQ3JFLFFBQVEsTUFBTTtHQUNkLEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxP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