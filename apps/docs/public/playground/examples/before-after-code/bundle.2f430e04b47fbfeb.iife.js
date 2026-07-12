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
	//#region examples/developer/before-after-code/before-after-code.media.ts
	const TIMING = {
		titleFadeIn: {
			start: 0,
			end: .03
		},
		transition: {
			start: .42,
			end: .5
		},
		fadeOut: {
			start: .97,
			end: 1
		}
	};
	function renderCodeWindow(content, baseFontSize, theme, std, shikiTheme) {
		const highlighted = std.code.highlight(content.code, {
			lang: content.language || "typescript",
			theme: shikiTheme
		});
		return `
    <div style="
      display:flex;
      flex-direction:column;
      width:100%;
      height:100%;
      background:${theme.cardBg};
      border-radius:${baseFontSize * .5}px;
      overflow:hidden;
      box-shadow:0 20px 50px rgba(0,0,0,0.3);
      border:1px solid ${theme.border};
    ">
      <div style="
        height:${baseFontSize * 1.4}px;
        background:${theme.headerBg};
        display:flex;
        align-items:center;
        padding:0 ${baseFontSize * .6}px;
        gap:${baseFontSize * .4}px;
        border-bottom:1px solid ${theme.border};
      ">
        <div style="display:flex;gap:${baseFontSize * .25}px;">
          <div style="width:${baseFontSize * .35}px;height:${baseFontSize * .35}px;border-radius:50%;background:#ff5f56;"></div>
          <div style="width:${baseFontSize * .35}px;height:${baseFontSize * .35}px;border-radius:50%;background:#ffbd2e;"></div>
          <div style="width:${baseFontSize * .35}px;height:${baseFontSize * .35}px;border-radius:50%;background:#27ca40;"></div>
        </div>
        <div style="
          font-size:${baseFontSize * .5}px;
          color:${theme.mutedText};
          margin-left:${baseFontSize * .5}px;
          font-family:ui-sans-serif,system-ui,sans-serif;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        ">${content.filename || (content.language === "html" ? "index.html" : "index.ts")}</div>
      </div>
      <div style="
        flex:1;
        padding:${baseFontSize * .7}px ${baseFontSize * .9}px;
        font-family:'SF Mono', 'Fira Code', monospace;
        font-size:${baseFontSize * .65}px;
        line-height:1.6;
        overflow:hidden;
        background:${theme.cardBg};
      ">
        ${highlighted}
      </div>
    </div>
  `;
	}
	//#endregion
	exports.default = define({
		sample: {
			title: "Simplify your Code",
			before: {
				code: "const res = await fetch('/api/user');\nconst data = await res.json();\nif (!res.ok) throw new Error();\nconsole.log(data.name);",
				language: "javascript",
				filename: "raw-fetch.js",
				label: "MANUAL FETCH"
			},
			after: {
				code: "const user = await sdk.users.get();\nconsole.log(user.name);",
				language: "typescript",
				filename: "with-sdk.ts",
				label: "USING SDK"
			},
			transition: "wipe",
			theme: "dark",
			accentColor: "#3b82f6"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "10s"
		},
		render(ctx) {
			const { std, width, height, timeline, data } = ctx;
			const { title, transition, theme: themeKey, accentColor } = data;
			const isDark = themeKey === "dark";
			const bgGradient = isDark ? `linear-gradient(135deg, #0a0a0a 0%, #171717 100%)` : `linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)`;
			const textColor = isDark ? "#ffffff" : "#0a0a0a";
			const mutedColor = isDark ? "#a1a1aa" : "#71717a";
			const cardBg = isDark ? "#121212" : "#ffffff";
			const border = isDark ? "#262626" : "#e5e5e5";
			const headerBg = isDark ? "#1c1c1c" : "#f3f4f6";
			const shikiTheme = isDark ? "dark-plus" : "github-light";
			const theme = {
				text: textColor,
				cardBg,
				border,
				headerBg,
				mutedText: mutedColor
			};
			const titleProgress = std.interpolate(timeline.progress, [TIMING.titleFadeIn.start, TIMING.titleFadeIn.end], [0, 1], "easeOutCubic");
			const transitionProgress = std.interpolate(timeline.progress, [TIMING.transition.start, TIMING.transition.end], [0, 1], "easeInOutCubic");
			const globalOpacity = 1 - std.interpolate(timeline.progress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeInCubic");
			const baseFontSize = Math.min(width, height) * .045;
			const horizontalPadding = width * .08;
			const [titleArea, labelArea, windowArea] = std.layout.partitionY({
				x: 0,
				y: 0,
				width,
				height
			}, [
				{ height: title ? height * .15 : 0 },
				{ height: baseFontSize * 2.5 },
				{ fill: true }
			], { gap: baseFontSize * .3 });
			const codeArea = std.layout.inset(windowArea, {
				x: horizontalPadding,
				bottom: baseFontSize * 1.2
			});
			const labelRow = std.layout.inset(labelArea, { x: horizontalPadding });
			const beforeLabel = data.before.label || "BEFORE";
			const afterLabel = data.after.label || "AFTER";
			let contentHtml = "";
			const codeBox = `top:${codeArea.y}px;left:${codeArea.x}px;width:${codeArea.width}px;height:${codeArea.height}px;`;
			const labelBox = `top:${labelRow.y}px;height:${labelRow.height}px;`;
			if (transition === "wipe") {
				const wipePosition = transitionProgress * 100;
				contentHtml = `
      <div style="position:absolute;${codeBox}overflow:hidden;">
        <div style="position:absolute;inset:0;clip-path:inset(0 ${100 - wipePosition}% 0 0);">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 0 0 ${wipePosition}%);">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="position:absolute;top:0;bottom:0;left:${wipePosition}%;width:4px;background:${accentColor};transform:translateX(-50%);box-shadow:0 0 30px ${accentColor};opacity:${transitionProgress > 0 && transitionProgress < 1 ? 1 : 0};z-index:10;"></div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;display:flex;align-items:center;font-size:${baseFontSize * .7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;opacity:${transitionProgress};">${afterLabel}</div>
      <div style="position:absolute;${labelBox}right:${horizontalPadding}px;display:flex;align-items:center;font-size:${baseFontSize * .7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;opacity:${1 - transitionProgress};">${beforeLabel}</div>
    `;
			} else if (transition === "slide") {
				const beforeX = -transitionProgress * 120;
				const afterX = (1 - transitionProgress) * 120;
				contentHtml = `
      <div style="position:absolute;${codeBox}overflow:hidden;">
        <div style="position:absolute;inset:0;transform:translateX(${beforeX}%);opacity:${1 - transitionProgress};">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="position:absolute;inset:0;transform:translateX(${afterX}%);opacity:${transitionProgress};">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;right:${horizontalPadding}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * .8}px;font-weight:700;color:${transitionProgress < .5 ? mutedColor : accentColor};letter-spacing:0.15em;">${transitionProgress < .5 ? beforeLabel : afterLabel}</div>
    `;
			} else if (transition === "flip") {
				const rotateY = transitionProgress * 180;
				contentHtml = `
      <div style="position:absolute;${codeBox}perspective:2000px;">
        <div style="width:100%;height:100%;position:relative;transform-style:preserve-3d;transform:rotateY(${rotateY}deg);">
          <div style="position:absolute;inset:0;backface-visibility:hidden;">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
          <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
        </div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;right:${horizontalPadding}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * .8}px;font-weight:700;color:${rotateY < 90 ? mutedColor : accentColor};letter-spacing:0.15em;">${rotateY < 90 ? beforeLabel : afterLabel}</div>
    `;
			} else {
				const splitGap = baseFontSize;
				const halfWidth = (codeArea.width - splitGap) / 2;
				contentHtml = `
      <div style="position:absolute;${codeBox}display:flex;gap:${splitGap}px;">
        <div style="flex:1;transform:scale(${.95 + (1 - transitionProgress) * .05});opacity:${.6 + (1 - transitionProgress) * .4};">${renderCodeWindow(data.before, baseFontSize, theme, std, shikiTheme)}</div>
        <div style="flex:1;transform:scale(${.95 + transitionProgress * .05});opacity:${.6 + transitionProgress * .4};">${renderCodeWindow(data.after, baseFontSize, theme, std, shikiTheme)}</div>
      </div>
      <div style="position:absolute;${labelBox}left:${labelRow.x}px;width:${halfWidth}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * .7}px;font-weight:700;color:${mutedColor};letter-spacing:0.15em;">${beforeLabel}</div>
      <div style="position:absolute;${labelBox}right:${horizontalPadding}px;width:${halfWidth}px;display:flex;align-items:center;justify-content:center;font-size:${baseFontSize * .7}px;font-weight:700;color:${accentColor};letter-spacing:0.15em;">${afterLabel}</div>
    `;
			}
			return `
    <div style="
      width:${width}px;
      height:${height}px;
      background:${bgGradient};
      font-family:ui-sans-serif,system-ui,sans-serif;
      position:relative;
      overflow:hidden;
      opacity:${globalOpacity};
    ">
      ${title ? `
        <div style="
          position:absolute;
          top:0;
          left:0;
          right:0;
          height:${titleArea.height}px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:0 ${horizontalPadding}px;
          opacity:${titleProgress};
          transform:translateY(${(1 - titleProgress) * -20}px);
        ">
          <h1 style="font-size:${baseFontSize * 1.3}px;font-weight:800;color:${textColor};text-align:center;margin:0;letter-spacing:-0.02em;">${title}</h1>
        </div>
      ` : ""}
      ${contentHtml}
    </div>
  `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVmb3JlLWFmdGVyLWNvZGUubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2RldmVsb3Blci9iZWZvcmUtYWZ0ZXItY29kZS9iZWZvcmUtYWZ0ZXItY29kZS5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSwgdHlwZSBSZW5kZXJDb250ZXh0IH0gZnJvbSBcInN1cGVyaW1nXCI7XG5cbmV4cG9ydCB0eXBlIFRyYW5zaXRpb25TdHlsZSA9IFwid2lwZVwiIHwgXCJzcGxpdFwiIHwgXCJmbGlwXCIgfCBcInNsaWRlXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29kZUNvbnRlbnQge1xuICBjb2RlOiBzdHJpbmc7XG4gIGxhbmd1YWdlPzogc3RyaW5nO1xuICBmaWxlbmFtZT86IHN0cmluZztcbiAgbGFiZWw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmVmb3JlQWZ0ZXJDb2RlRGF0YSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgYmVmb3JlOiBDb2RlQ29udGVudDtcbiAgYWZ0ZXI6IENvZGVDb250ZW50O1xuICB0aXRsZTogc3RyaW5nO1xuICB0cmFuc2l0aW9uOiBUcmFuc2l0aW9uU3R5bGU7XG4gIHRoZW1lOiBcImxpZ2h0XCIgfCBcImRhcmtcIjtcbiAgYWNjZW50Q29sb3I6IHN0cmluZztcbn1cblxuY29uc3QgVElNSU5HID0ge1xuICB0aXRsZUZhZGVJbjogeyBzdGFydDogMCwgZW5kOiAwLjAzIH0sXG4gIHRyYW5zaXRpb246IHsgc3RhcnQ6IDAuNDIsIGVuZDogMC41IH0sXG4gIGZhZGVPdXQ6IHsgc3RhcnQ6IDAuOTcsIGVuZDogMS4wIH0sXG59O1xuXG5mdW5jdGlvbiByZW5kZXJDb2RlV2luZG93KFxuICBjb250ZW50OiBDb2RlQ29udGVudCxcbiAgYmFzZUZvbnRTaXplOiBudW1iZXIsXG4gIHRoZW1lOiB7IGNhcmRCZzogc3RyaW5nOyBib3JkZXI6IHN0cmluZzsgaGVhZGVyQmc6IHN0cmluZzsgbXV0ZWRUZXh0OiBzdHJpbmc7IHRleHQ6IHN0cmluZyB9LFxuICBzdGQ6IGFueSxcbiAgc2hpa2lUaGVtZTogc3RyaW5nXG4pOiBzdHJpbmcge1xuICBjb25zdCBoaWdobGlnaHRlZCA9IHN0ZC5jb2RlLmhpZ2hsaWdodChjb250ZW50LmNvZGUsIHsgXG4gICAgbGFuZzogKGNvbnRlbnQubGFuZ3VhZ2UgfHwgXCJ0eXBlc2NyaXB0XCIpIGFzIGFueSwgXG4gICAgdGhlbWU6IHNoaWtpVGhlbWUgYXMgYW55IFxuICB9KTtcblxuICByZXR1cm4gYFxuICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOmNvbHVtbjtcbiAgICAgIHdpZHRoOjEwMCU7XG4gICAgICBoZWlnaHQ6MTAwJTtcbiAgICAgIGJhY2tncm91bmQ6JHt0aGVtZS5jYXJkQmd9O1xuICAgICAgYm9yZGVyLXJhZGl1czoke2Jhc2VGb250U2l6ZSAqIDAuNX1weDtcbiAgICAgIG92ZXJmbG93OmhpZGRlbjtcbiAgICAgIGJveC1zaGFkb3c6MCAyMHB4IDUwcHggcmdiYSgwLDAsMCwwLjMpO1xuICAgICAgYm9yZGVyOjFweCBzb2xpZCAke3RoZW1lLmJvcmRlcn07XG4gICAgXCI+XG4gICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgIGhlaWdodDoke2Jhc2VGb250U2l6ZSAqIDEuNH1weDtcbiAgICAgICAgYmFja2dyb3VuZDoke3RoZW1lLmhlYWRlckJnfTtcbiAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczpjZW50ZXI7XG4gICAgICAgIHBhZGRpbmc6MCAke2Jhc2VGb250U2l6ZSAqIDAuNn1weDtcbiAgICAgICAgZ2FwOiR7YmFzZUZvbnRTaXplICogMC40fXB4O1xuICAgICAgICBib3JkZXItYm90dG9tOjFweCBzb2xpZCAke3RoZW1lLmJvcmRlcn07XG4gICAgICBcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6JHtiYXNlRm9udFNpemUgKiAwLjI1fXB4O1wiPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJ3aWR0aDoke2Jhc2VGb250U2l6ZSAqIDAuMzV9cHg7aGVpZ2h0OiR7YmFzZUZvbnRTaXplICogMC4zNX1weDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOiNmZjVmNTY7XCI+PC9kaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiR7YmFzZUZvbnRTaXplICogMC4zNX1weDtoZWlnaHQ6JHtiYXNlRm9udFNpemUgKiAwLjM1fXB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6I2ZmYmQyZTtcIj48L2Rpdj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwid2lkdGg6JHtiYXNlRm9udFNpemUgKiAwLjM1fXB4O2hlaWdodDoke2Jhc2VGb250U2l6ZSAqIDAuMzV9cHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDojMjdjYTQwO1wiPjwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuNX1weDtcbiAgICAgICAgICBjb2xvcjoke3RoZW1lLm11dGVkVGV4dH07XG4gICAgICAgICAgbWFyZ2luLWxlZnQ6JHtiYXNlRm9udFNpemUgKiAwLjV9cHg7XG4gICAgICAgICAgZm9udC1mYW1pbHk6dWktc2Fucy1zZXJpZixzeXN0ZW0tdWksc2Fucy1zZXJpZjtcbiAgICAgICAgICB3aGl0ZS1zcGFjZTpub3dyYXA7XG4gICAgICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgICAgIHRleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7XG4gICAgICAgIFwiPiR7Y29udGVudC5maWxlbmFtZSB8fCAoY29udGVudC5sYW5ndWFnZSA9PT0gJ2h0bWwnID8gJ2luZGV4Lmh0bWwnIDogJ2luZGV4LnRzJyl9PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJcbiAgICAgICAgZmxleDoxO1xuICAgICAgICBwYWRkaW5nOiR7YmFzZUZvbnRTaXplICogMC43fXB4ICR7YmFzZUZvbnRTaXplICogMC45fXB4O1xuICAgICAgICBmb250LWZhbWlseTonU0YgTW9ubycsICdGaXJhIENvZGUnLCBtb25vc3BhY2U7XG4gICAgICAgIGZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuNjV9cHg7XG4gICAgICAgIGxpbmUtaGVpZ2h0OjEuNjtcbiAgICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgICBiYWNrZ3JvdW5kOiR7dGhlbWUuY2FyZEJnfTtcbiAgICAgIFwiPlxuICAgICAgICAke2hpZ2hsaWdodGVkfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIGA7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZTxCZWZvcmVBZnRlckNvZGVEYXRhPih7XG4gIHNhbXBsZToge1xuICAgIHRpdGxlOiBcIlNpbXBsaWZ5IHlvdXIgQ29kZVwiLFxuICAgIGJlZm9yZTogeyBcbiAgICAgIGNvZGU6IFwiY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvdXNlcicpO1xcbmNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xcbmlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoKTtcXG5jb25zb2xlLmxvZyhkYXRhLm5hbWUpO1wiLCBcbiAgICAgIGxhbmd1YWdlOiBcImphdmFzY3JpcHRcIixcbiAgICAgIGZpbGVuYW1lOiBcInJhdy1mZXRjaC5qc1wiLFxuICAgICAgbGFiZWw6IFwiTUFOVUFMIEZFVENIXCJcbiAgICB9LFxuICAgIGFmdGVyOiB7IFxuICAgICAgY29kZTogXCJjb25zdCB1c2VyID0gYXdhaXQgc2RrLnVzZXJzLmdldCgpO1xcbmNvbnNvbGUubG9nKHVzZXIubmFtZSk7XCIsIFxuICAgICAgbGFuZ3VhZ2U6IFwidHlwZXNjcmlwdFwiLFxuICAgICAgZmlsZW5hbWU6IFwid2l0aC1zZGsudHNcIixcbiAgICAgIGxhYmVsOiBcIlVTSU5HIFNES1wiXG4gICAgfSxcbiAgICB0cmFuc2l0aW9uOiBcIndpcGVcIixcbiAgICB0aGVtZTogXCJkYXJrXCIsXG4gICAgYWNjZW50Q29sb3I6IFwiIzNiODJmNlwiLFxuICB9LFxuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCIxMHNcIixcbiAgfSxcbiAgcmVuZGVyKGN0eDogUmVuZGVyQ29udGV4dDxCZWZvcmVBZnRlckNvZGVEYXRhPikge1xuICAgIGNvbnN0IHsgc3RkLCB3aWR0aCwgaGVpZ2h0LCB0aW1lbGluZSwgZGF0YSB9ID0gY3R4O1xuICAgIGNvbnN0IHsgdGl0bGUsIHRyYW5zaXRpb24sIHRoZW1lOiB0aGVtZUtleSwgYWNjZW50Q29sb3IgfSA9IGRhdGE7XG5cbiAgICBjb25zdCBpc0RhcmsgPSB0aGVtZUtleSA9PT0gXCJkYXJrXCI7XG4gICAgY29uc3QgYmdDb2xvciA9IGlzRGFyayA/IFwiIzBhMGEwYVwiIDogXCIjZmFmYWZhXCI7XG4gICAgY29uc3QgYmdHcmFkaWVudCA9IGlzRGFyayBcbiAgICAgID8gYGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICMwYTBhMGEgMCUsICMxNzE3MTcgMTAwJSlgXG4gICAgICA6IGBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjZjVmNWY1IDAlLCAjZmZmZmZmIDEwMCUpYDtcbiAgICBcbiAgICBjb25zdCB0ZXh0Q29sb3IgPSBpc0RhcmsgPyBcIiNmZmZmZmZcIiA6IFwiIzBhMGEwYVwiO1xuICAgIGNvbnN0IG11dGVkQ29sb3IgPSBpc0RhcmsgPyBcIiNhMWExYWFcIiA6IFwiIzcxNzE3YVwiO1xuICAgIGNvbnN0IGNhcmRCZyA9IGlzRGFyayA/IFwiIzEyMTIxMlwiIDogXCIjZmZmZmZmXCI7XG4gICAgY29uc3QgYm9yZGVyID0gaXNEYXJrID8gXCIjMjYyNjI2XCIgOiBcIiNlNWU1ZTVcIjtcbiAgICBjb25zdCBoZWFkZXJCZyA9IGlzRGFyayA/IFwiIzFjMWMxY1wiIDogXCIjZjNmNGY2XCI7XG4gICAgY29uc3Qgc2hpa2lUaGVtZSA9IGlzRGFyayA/IFwiZGFyay1wbHVzXCIgOiBcImdpdGh1Yi1saWdodFwiO1xuXG4gICAgY29uc3QgdGhlbWUgPSB7IHRleHQ6IHRleHRDb2xvciwgY2FyZEJnLCBib3JkZXIsIGhlYWRlckJnLCBtdXRlZFRleHQ6IG11dGVkQ29sb3IgfTtcblxuICAgIGNvbnN0IHRpdGxlUHJvZ3Jlc3MgPSBzdGQuaW50ZXJwb2xhdGUodGltZWxpbmUucHJvZ3Jlc3MsIFtUSU1JTkcudGl0bGVGYWRlSW4uc3RhcnQsIFRJTUlORy50aXRsZUZhZGVJbi5lbmRdLCBbMCwgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuICAgIGNvbnN0IHRyYW5zaXRpb25Qcm9ncmVzcyA9IHN0ZC5pbnRlcnBvbGF0ZSh0aW1lbGluZS5wcm9ncmVzcywgW1RJTUlORy50cmFuc2l0aW9uLnN0YXJ0LCBUSU1JTkcudHJhbnNpdGlvbi5lbmRdLCBbMCwgMV0sIFwiZWFzZUluT3V0Q3ViaWNcIik7XG4gICAgY29uc3QgZmFkZU91dFByb2dyZXNzID0gc3RkLmludGVycG9sYXRlKHRpbWVsaW5lLnByb2dyZXNzLCBbVElNSU5HLmZhZGVPdXQuc3RhcnQsIFRJTUlORy5mYWRlT3V0LmVuZF0sIFswLCAxXSwgXCJlYXNlSW5DdWJpY1wiKTtcblxuICAgIGNvbnN0IGdsb2JhbE9wYWNpdHkgPSAxIC0gZmFkZU91dFByb2dyZXNzO1xuXG4gICAgY29uc3QgYmFzZUZvbnRTaXplID0gTWF0aC5taW4od2lkdGgsIGhlaWdodCkgKiAwLjA0NTtcbiAgICBjb25zdCBob3Jpem9udGFsUGFkZGluZyA9IHdpZHRoICogMC4wODtcblxuICAgIGNvbnN0IFt0aXRsZUFyZWEsIGxhYmVsQXJlYSwgd2luZG93QXJlYV0gPSBzdGQubGF5b3V0LnBhcnRpdGlvblkoXG4gICAgICB7IHg6IDAsIHk6IDAsIHdpZHRoLCBoZWlnaHQgfSxcbiAgICAgIFtcbiAgICAgICAgeyBoZWlnaHQ6IHRpdGxlID8gaGVpZ2h0ICogMC4xNSA6IDAgfSxcbiAgICAgICAgeyBoZWlnaHQ6IGJhc2VGb250U2l6ZSAqIDIuNSB9LFxuICAgICAgICB7IGZpbGw6IHRydWUgfSxcbiAgICAgIF0sXG4gICAgICB7IGdhcDogYmFzZUZvbnRTaXplICogMC4zIH0sXG4gICAgKTtcbiAgICBjb25zdCBjb2RlQXJlYSA9IHN0ZC5sYXlvdXQuaW5zZXQod2luZG93QXJlYSwge1xuICAgICAgeDogaG9yaXpvbnRhbFBhZGRpbmcsXG4gICAgICBib3R0b206IGJhc2VGb250U2l6ZSAqIDEuMixcbiAgICB9KTtcbiAgICBjb25zdCBsYWJlbFJvdyA9IHN0ZC5sYXlvdXQuaW5zZXQobGFiZWxBcmVhLCB7IHg6IGhvcml6b250YWxQYWRkaW5nIH0pO1xuXG4gICAgY29uc3QgYmVmb3JlTGFiZWwgPSBkYXRhLmJlZm9yZS5sYWJlbCB8fCBcIkJFRk9SRVwiO1xuICAgIGNvbnN0IGFmdGVyTGFiZWwgPSBkYXRhLmFmdGVyLmxhYmVsIHx8IFwiQUZURVJcIjtcblxuICAgIGxldCBjb250ZW50SHRtbCA9IFwiXCI7XG5cbiAgICBjb25zdCBjb2RlQm94ID0gYHRvcDoke2NvZGVBcmVhLnl9cHg7bGVmdDoke2NvZGVBcmVhLnh9cHg7d2lkdGg6JHtjb2RlQXJlYS53aWR0aH1weDtoZWlnaHQ6JHtjb2RlQXJlYS5oZWlnaHR9cHg7YDtcbiAgICBjb25zdCBsYWJlbEJveCA9IGB0b3A6JHtsYWJlbFJvdy55fXB4O2hlaWdodDoke2xhYmVsUm93LmhlaWdodH1weDtgO1xuXG4gICAgaWYgKHRyYW5zaXRpb24gPT09IFwid2lwZVwiKSB7XG4gICAgICBjb25zdCB3aXBlUG9zaXRpb24gPSB0cmFuc2l0aW9uUHJvZ3Jlc3MgKiAxMDA7XG4gICAgICBjb250ZW50SHRtbCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTske2NvZGVCb3h9b3ZlcmZsb3c6aGlkZGVuO1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtjbGlwLXBhdGg6aW5zZXQoMCAkezEwMCAtIHdpcGVQb3NpdGlvbn0lIDAgMCk7XCI+JHtyZW5kZXJDb2RlV2luZG93KGRhdGEuYWZ0ZXIsIGJhc2VGb250U2l6ZSwgdGhlbWUsIHN0ZCwgc2hpa2lUaGVtZSl9PC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO2NsaXAtcGF0aDppbnNldCgwIDAgMCAke3dpcGVQb3NpdGlvbn0lKTtcIj4ke3JlbmRlckNvZGVXaW5kb3coZGF0YS5iZWZvcmUsIGJhc2VGb250U2l6ZSwgdGhlbWUsIHN0ZCwgc2hpa2lUaGVtZSl9PC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtib3R0b206MDtsZWZ0OiR7d2lwZVBvc2l0aW9ufSU7d2lkdGg6NHB4O2JhY2tncm91bmQ6JHthY2NlbnRDb2xvcn07dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7Ym94LXNoYWRvdzowIDAgMzBweCAke2FjY2VudENvbG9yfTtvcGFjaXR5OiR7dHJhbnNpdGlvblByb2dyZXNzID4gMCAmJiB0cmFuc2l0aW9uUHJvZ3Jlc3MgPCAxID8gMSA6IDB9O3otaW5kZXg6MTA7XCI+PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTske2xhYmVsQm94fWxlZnQ6JHtsYWJlbFJvdy54fXB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Zm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC43fXB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjoke2FjY2VudENvbG9yfTtsZXR0ZXItc3BhY2luZzowLjE1ZW07b3BhY2l0eToke3RyYW5zaXRpb25Qcm9ncmVzc307XCI+JHthZnRlckxhYmVsfTwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlOyR7bGFiZWxCb3h9cmlnaHQ6JHtob3Jpem9udGFsUGFkZGluZ31weDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuN31weDtmb250LXdlaWdodDo3MDA7Y29sb3I6JHttdXRlZENvbG9yfTtsZXR0ZXItc3BhY2luZzowLjE1ZW07b3BhY2l0eTokezEgLSB0cmFuc2l0aW9uUHJvZ3Jlc3N9O1wiPiR7YmVmb3JlTGFiZWx9PC9kaXY+XG4gICAgYDtcbiAgICB9IGVsc2UgaWYgKHRyYW5zaXRpb24gPT09IFwic2xpZGVcIikge1xuICAgICAgY29uc3QgYmVmb3JlWCA9IC10cmFuc2l0aW9uUHJvZ3Jlc3MgKiAxMjA7XG4gICAgICBjb25zdCBhZnRlclggPSAoMSAtIHRyYW5zaXRpb25Qcm9ncmVzcykgKiAxMjA7XG4gICAgICBjb250ZW50SHRtbCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTske2NvZGVCb3h9b3ZlcmZsb3c6aGlkZGVuO1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgke2JlZm9yZVh9JSk7b3BhY2l0eTokezEgLSB0cmFuc2l0aW9uUHJvZ3Jlc3N9O1wiPiR7cmVuZGVyQ29kZVdpbmRvdyhkYXRhLmJlZm9yZSwgYmFzZUZvbnRTaXplLCB0aGVtZSwgc3RkLCBzaGlraVRoZW1lKX08L2Rpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoJHthZnRlclh9JSk7b3BhY2l0eToke3RyYW5zaXRpb25Qcm9ncmVzc307XCI+JHtyZW5kZXJDb2RlV2luZG93KGRhdGEuYWZ0ZXIsIGJhc2VGb250U2l6ZSwgdGhlbWUsIHN0ZCwgc2hpa2lUaGVtZSl9PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTske2xhYmVsQm94fWxlZnQ6JHtsYWJlbFJvdy54fXB4O3JpZ2h0OiR7aG9yaXpvbnRhbFBhZGRpbmd9cHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2ZvbnQtc2l6ZToke2Jhc2VGb250U2l6ZSAqIDAuOH1weDtmb250LXdlaWdodDo3MDA7Y29sb3I6JHt0cmFuc2l0aW9uUHJvZ3Jlc3MgPCAwLjUgPyBtdXRlZENvbG9yIDogYWNjZW50Q29sb3J9O2xldHRlci1zcGFjaW5nOjAuMTVlbTtcIj4ke3RyYW5zaXRpb25Qcm9ncmVzcyA8IDAuNSA/IGJlZm9yZUxhYmVsIDogYWZ0ZXJMYWJlbH08L2Rpdj5cbiAgICBgO1xuICAgIH0gZWxzZSBpZiAodHJhbnNpdGlvbiA9PT0gXCJmbGlwXCIpIHtcbiAgICAgIGNvbnN0IHJvdGF0ZVkgPSB0cmFuc2l0aW9uUHJvZ3Jlc3MgKiAxODA7XG4gICAgICBjb250ZW50SHRtbCA9IGBcbiAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTske2NvZGVCb3h9cGVyc3BlY3RpdmU6MjAwMHB4O1wiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwid2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtwb3NpdGlvbjpyZWxhdGl2ZTt0cmFuc2Zvcm0tc3R5bGU6cHJlc2VydmUtM2Q7dHJhbnNmb3JtOnJvdGF0ZVkoJHtyb3RhdGVZfWRlZyk7XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2ZhY2UtdmlzaWJpbGl0eTpoaWRkZW47XCI+JHtyZW5kZXJDb2RlV2luZG93KGRhdGEuYmVmb3JlLCBiYXNlRm9udFNpemUsIHRoZW1lLCBzdGQsIHNoaWtpVGhlbWUpfTwvZGl2PlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO2JhY2tmYWNlLXZpc2liaWxpdHk6aGlkZGVuO3RyYW5zZm9ybTpyb3RhdGVZKDE4MGRlZyk7XCI+JHtyZW5kZXJDb2RlV2luZG93KGRhdGEuYWZ0ZXIsIGJhc2VGb250U2l6ZSwgdGhlbWUsIHN0ZCwgc2hpa2lUaGVtZSl9PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7JHtsYWJlbEJveH1sZWZ0OiR7bGFiZWxSb3cueH1weDtyaWdodDoke2hvcml6b250YWxQYWRkaW5nfXB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAwLjh9cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiR7cm90YXRlWSA8IDkwID8gbXV0ZWRDb2xvciA6IGFjY2VudENvbG9yfTtsZXR0ZXItc3BhY2luZzowLjE1ZW07XCI+JHtyb3RhdGVZIDwgOTAgPyBiZWZvcmVMYWJlbCA6IGFmdGVyTGFiZWx9PC9kaXY+XG4gICAgYDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc3BsaXRHYXAgPSBiYXNlRm9udFNpemU7XG4gICAgICBjb25zdCBoYWxmV2lkdGggPSAoY29kZUFyZWEud2lkdGggLSBzcGxpdEdhcCkgLyAyO1xuICAgICAgY29udGVudEh0bWwgPSBgXG4gICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7JHtjb2RlQm94fWRpc3BsYXk6ZmxleDtnYXA6JHtzcGxpdEdhcH1weDtcIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MTt0cmFuc2Zvcm06c2NhbGUoJHswLjk1ICsgKDEgLSB0cmFuc2l0aW9uUHJvZ3Jlc3MpICogMC4wNX0pO29wYWNpdHk6JHswLjYgKyAoMSAtIHRyYW5zaXRpb25Qcm9ncmVzcykgKiAwLjR9O1wiPiR7cmVuZGVyQ29kZVdpbmRvdyhkYXRhLmJlZm9yZSwgYmFzZUZvbnRTaXplLCB0aGVtZSwgc3RkLCBzaGlraVRoZW1lKX08L2Rpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MTt0cmFuc2Zvcm06c2NhbGUoJHswLjk1ICsgdHJhbnNpdGlvblByb2dyZXNzICogMC4wNX0pO29wYWNpdHk6JHswLjYgKyB0cmFuc2l0aW9uUHJvZ3Jlc3MgKiAwLjR9O1wiPiR7cmVuZGVyQ29kZVdpbmRvdyhkYXRhLmFmdGVyLCBiYXNlRm9udFNpemUsIHRoZW1lLCBzdGQsIHNoaWtpVGhlbWUpfTwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7JHtsYWJlbEJveH1sZWZ0OiR7bGFiZWxSb3cueH1weDt3aWR0aDoke2hhbGZXaWR0aH1weDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC43fXB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjoke211dGVkQ29sb3J9O2xldHRlci1zcGFjaW5nOjAuMTVlbTtcIj4ke2JlZm9yZUxhYmVsfTwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlOyR7bGFiZWxCb3h9cmlnaHQ6JHtob3Jpem9udGFsUGFkZGluZ31weDt3aWR0aDoke2hhbGZXaWR0aH1weDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOiR7YmFzZUZvbnRTaXplICogMC43fXB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjoke2FjY2VudENvbG9yfTtsZXR0ZXItc3BhY2luZzowLjE1ZW07XCI+JHthZnRlckxhYmVsfTwvZGl2PlxuICAgIGA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGBcbiAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICB3aWR0aDoke3dpZHRofXB4O1xuICAgICAgaGVpZ2h0OiR7aGVpZ2h0fXB4O1xuICAgICAgYmFja2dyb3VuZDoke2JnR3JhZGllbnR9O1xuICAgICAgZm9udC1mYW1pbHk6dWktc2Fucy1zZXJpZixzeXN0ZW0tdWksc2Fucy1zZXJpZjtcbiAgICAgIHBvc2l0aW9uOnJlbGF0aXZlO1xuICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgb3BhY2l0eToke2dsb2JhbE9wYWNpdHl9O1xuICAgIFwiPlxuICAgICAgJHt0aXRsZSA/IGBcbiAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgIHBvc2l0aW9uOmFic29sdXRlO1xuICAgICAgICAgIHRvcDowO1xuICAgICAgICAgIGxlZnQ6MDtcbiAgICAgICAgICByaWdodDowO1xuICAgICAgICAgIGhlaWdodDoke3RpdGxlQXJlYS5oZWlnaHR9cHg7XG4gICAgICAgICAgZGlzcGxheTpmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOmNlbnRlcjtcbiAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO1xuICAgICAgICAgIHBhZGRpbmc6MCAke2hvcml6b250YWxQYWRkaW5nfXB4O1xuICAgICAgICAgIG9wYWNpdHk6JHt0aXRsZVByb2dyZXNzfTtcbiAgICAgICAgICB0cmFuc2Zvcm06dHJhbnNsYXRlWSgkeygxIC0gdGl0bGVQcm9ncmVzcykgKiAtMjB9cHgpO1xuICAgICAgICBcIj5cbiAgICAgICAgICA8aDEgc3R5bGU9XCJmb250LXNpemU6JHtiYXNlRm9udFNpemUgKiAxLjN9cHg7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOiR7dGV4dENvbG9yfTt0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW46MDtsZXR0ZXItc3BhY2luZzotMC4wMmVtO1wiPiR7dGl0bGV9PC9oMT5cbiAgICAgICAgPC9kaXY+XG4gICAgICBgIDogXCJcIn1cbiAgICAgICR7Y29udGVudEh0bWx9XG4gICAgPC9kaXY+XG4gIGA7XG4gIH0sXG59KTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkEsU0FBUyxPQUFPLE9BQU87RUFDdEIsTUFBTSxTQUFTLE1BQU0sVUFBVTtFQUMvQixNQUFNLElBQUksTUFBTTtFQUNoQixNQUFNLGFBQWEsT0FBTyxNQUFNLFlBQVk7RUFDNUMsT0FBTztHQUNOO0dBQ0EsVUFBVSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUUsUUFBUSxhQUFhLEVBQUUsWUFBWSxRQUFRO0dBQ3JFLFFBQVEsTUFBTTtHQUNkLEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxhQUFhLEVBQUUsU0FBUyxNQUFNLFFBQVEsSUFBSSxDQUFDO0VBQy9DO0NBQ0Q7Ozs7Ozs7Ozs7Ozs7Ozs7O0NDckJBLE1BQU0sU0FBUztFQUNiLGFBQWE7R0FBRSxPQUFPO0dBQUcsS0FBSztFQUFLO0VBQ25DLFlBQVk7R0FBRSxPQUFPO0dBQU0sS0FBSztFQUFJO0VBQ3BDLFNBQVM7R0FBRSxPQUFPO0dBQU0sS0FBSztFQUFJO0NBQ25DO0NBRUEsU0FBUyxpQkFDUCxTQUNBLGNBQ0EsT0FDQSxLQUNBLFlBQ1E7RUFDUixNQUFNLGNBQWMsSUFBSSxLQUFLLFVBQVUsUUFBUSxN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