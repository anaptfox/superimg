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
	//#region examples/interfaces/claude-code/claude-code.media.ts
	const C = {
		page: "#0e0d0b",
		terminal: "#161513",
		chrome: "#1f1e1b",
		border: "#33312d",
		borderBright: "#4a4740",
		text: "#d6d3cc",
		soft: "#a8a49b",
		muted: "#7c7970",
		dim: "#5c5a54",
		accent: "#d97757",
		selected: "#2b2926",
		diffHeader: "#1c1b18",
		delBg: "#3a1f1c",
		delText: "#e07a6a",
		addBg: "#1e3020",
		addText: "#8fc47a",
		done: "#7fae6a",
		trafficRed: "#e05c48",
		trafficYellow: "#e0a840",
		trafficGreen: "#4fa85c"
	};
	/** Window settle only — chat content starts after this phase ends. */
	const BOOT_S = 1.35;
	const SUBMIT_S = .6;
	const TYPE_MIN_S = .9;
	const TYPE_CHARS_PER_SEC = 32;
	const ASSIST_CHARS_PER_SEC = 50;
	function escapeHtml(value) {
		return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
	function typeSeconds(prompt) {
		return Math.max(TYPE_MIN_S, prompt.length / TYPE_CHARS_PER_SEC);
	}
	/** Seconds for one event — pure, deterministic. Tuned near the original fixed phases. */
	function estimateEventSeconds(e) {
		switch (e.type) {
			case "assistant": return Math.max(.55, e.text.length / ASSIST_CHARS_PER_SEC + .25);
			case "tool": return .9;
			case "todos": return .5 + e.items.length * .28;
			case "edit": return .5 + e.diff.length * .24;
			case "permission": return .6 + e.options.length * .45;
			case "spinner": return e.seconds ?? 2.3;
			default: return e;
		}
	}
	/** Pure timeline: same call for resolve() and render() via std.layoutTimeline. */
	function buildTimeline(data) {
		const segments = {
			boot: BOOT_S,
			type: typeSeconds(data.prompt),
			submit: SUBMIT_S
		};
		for (let i = 0; i < data.events.length; i++) segments[`event_${i}`] = estimateEventSeconds(data.events[i]);
		return layoutTimeline(segments);
	}
	function renderAssistantEvent(p, ev, bullet, win) {
		if (p <= 0) return "";
		const chars = Math.floor(win(p, 0, .85) * ev.text.length);
		if (chars <= 0) return "";
		return `<div class="block">${bullet} ${escapeHtml(ev.text.slice(0, chars))}</div>`;
	}
	function renderToolEvent(p, ev, bullet, enter, win) {
		const call = enter(win(p, 0, .35));
		const result = enter(win(p, .35, .4));
		if (call.p <= 0) return "";
		return `
    <div class="block tight" style="${call.style}">${bullet} <span style="font-weight:500;">${escapeHtml(ev.name)}</span><span style="color:${C.muted};">(${escapeHtml(ev.args)})</span></div>
    <div class="block" style="color:${C.muted};padding-left:2px;opacity:${result.p};">&nbsp;&nbsp;⎿&nbsp;&nbsp;${escapeHtml(ev.result)}</div>`;
	}
	function renderTodosEvent(p, ev, bullet, enter, win) {
		const block = enter(win(p, 0, .25));
		if (block.p <= 0) return "";
		const rows = ev.items.map((todo, i) => {
			const checked = todo.status === "done" && win(p, .3 + i * .28, .12) >= 1;
			const lead = i === 0 ? "⎿&nbsp;&nbsp;" : "&nbsp;&nbsp;&nbsp;";
			const box = checked ? `<span style="color:${C.done};">☒</span> <span style="color:${C.dim};text-decoration:line-through;">${escapeHtml(todo.text)}</span>` : todo.status === "pending" ? `☐ ${escapeHtml(todo.text)}` : `<span style="color:${C.text};">☐</span> <span style="color:${C.text};">${escapeHtml(todo.text)}</span>`;
			return `<div style="color:${C.muted};padding-left:2px;">&nbsp;&nbsp;${lead}${box}</div>`;
		}).join("");
		return `
    <div class="block" style="${block.style}">
      <div>${bullet} <span style="font-weight:500;">Update Todos</span></div>
      ${rows}
    </div>`;
	}
	function renderEditEvent(p, ev, bullet, enter, win, fs) {
		const head = enter(win(p, 0, .2));
		if (head.p <= 0) return "";
		const rows = ev.diff.map((line, i) => {
			if (win(p, .18 + i * .09, .1) <= 0) return "";
			const bg = line.kind === "del" ? C.delBg : line.kind === "add" ? C.addBg : "transparent";
			const fg = line.kind === "del" ? C.delText : line.kind === "add" ? C.addText : C.muted;
			const pad = line.kind === "context" ? "&nbsp;&nbsp;" : "&nbsp;";
			return `<div style="padding:0 ${fs * .45}px;background:${bg};"><span style="color:${C.dim};">&nbsp;&nbsp;${line.num}${pad}</span><span style="color:${fg};">${escapeHtml(line.text)}</span></div>`;
		}).join("");
		return `
    <div class="block tight" style="${head.style}">${bullet} <span style="font-weight:500;">Update</span><span style="color:${C.muted};">(${escapeHtml(ev.file)})</span></div>
    <div class="block" style="border:1px solid ${C.border};border-radius:4px;margin-left:2px;opacity:${head.p};">
      <div style="padding:${fs * .14}px ${fs * .45}px;color:${C.muted};background:${C.diffHeader};border-bottom:1px solid ${C.border};border-radius:4px 4px 0 0;">${escapeHtml(ev.file)}</div>
      <div style="padding:${fs * .18}px 0;">${rows}</div>
    </div>`;
	}
	function renderPermissionEvent(p, ev, enter, win, fs) {
		const box = enter(win(p, 0, .22));
		if (box.p <= 0) return "";
		const selectedIdx = ev.selected ?? 0;
		const rows = ev.options.map((option, i) => {
			const selected = i === selectedIdx;
			return `<div style="padding:1px ${fs * .28}px;border-radius:3px;${selected ? `background:${C.selected};color:${C.accent};` : `color:${C.text};`}white-space:pre;">${selected ? "❯ " : "  "}${escapeHtml(option)}</div>`;
		}).join("");
		return `
    <div class="block" style="border:1px solid ${C.accent};border-radius:6px;padding:${fs * .42}px ${fs * .55}px;${box.style}">
      <div style="margin-bottom:${fs * .32}px;">Do you want to make this edit to <span style="color:${C.accent};font-weight:500;">${escapeHtml(ev.file)}</span>?</div>
      ${rows}
    </div>`;
	}
	function renderSpinnerEvent(p, ev, enter, win, timelineSeconds, phaseSeconds) {
		const spin = enter(win(p, 0, .12));
		if (spin.p <= 0) return "";
		const localSec = p * phaseSeconds;
		const verb = ev.verbs[Math.floor(localSec / .7) % ev.verbs.length] ?? ev.verbs[0] ?? "Working…";
		const elapsed = Math.floor(timelineSeconds);
		return `
    <div class="block" style="color:${C.muted};${spin.style}">
      <span style="color:${C.accent};">✻</span> <span style="color:${C.accent};">${escapeHtml(verb)}</span> (${elapsed}s · ${escapeHtml(ev.tokens)} · esc to interrupt)
    </div>`;
	}
	var claude_code_media_default = define({
		sample: {
			windowTitle: "fox@homestead: ~/code/gumbo — claude",
			version: "2.1.4",
			cwd: "/Users/fox/code/gumbo",
			tip: "Use # to memorize shortcuts and preferences in CLAUDE.md",
			prompt: "refactor the auth middleware to use the new session store",
			inputPlaceholder: "Try \"run the auth tests and fix what breaks\"",
			statusLeft: "? for shortcuts",
			statusRight: "⏵⏵ accept edits on · Opus 4.8 · 41% context left",
			events: [
				{
					type: "assistant",
					text: "I'll read the current middleware first, then find every call site."
				},
				{
					type: "tool",
					name: "Read",
					args: "src/middleware/auth.ts",
					result: "Read 148 lines (ctrl+o to expand)"
				},
				{
					type: "tool",
					name: "Grep",
					args: "pattern: \"sessionStore\", glob: \"src/**/*.ts\"",
					result: "Found 6 matches across 4 files"
				},
				{
					type: "todos",
					items: [
						{
							text: "Read current auth middleware",
							status: "done"
						},
						{
							text: "Locate all sessionStore call sites",
							status: "done"
						},
						{
							text: "Swap resolver to SessionStore.get()",
							status: "active"
						},
						{
							text: "Update tests in auth.test.ts",
							status: "pending"
						}
					]
				},
				{
					type: "edit",
					file: "src/middleware/auth.ts",
					diff: [
						{
							kind: "context",
							num: "41",
							text: "export async function requireAuth(c: Context) {"
						},
						{
							kind: "del",
							num: "42",
							text: "-   const raw = c.req.header('cookie')"
						},
						{
							kind: "del",
							num: "43",
							text: "-   const session = await legacyStore.parse(raw)"
						},
						{
							kind: "add",
							num: "42",
							text: "+   const session = await sessionStore.get(c, {"
						},
						{
							kind: "add",
							num: "43",
							text: "+     rolling: true,"
						},
						{
							kind: "add",
							num: "44",
							text: "+   })"
						},
						{
							kind: "context",
							num: "45",
							text: "  if (!session) return c.redirect('/login')"
						}
					]
				},
				{
					type: "permission",
					file: "auth.ts",
					options: [
						"1. Yes",
						"2. Yes, allow all edits during this session (shift+tab)",
						"3. No, and tell Claude what to do differently (esc)"
					]
				},
				{
					type: "spinner",
					verbs: [
						"Percolating…",
						"Cogitating…",
						"Simmering…",
						"Ruminating…",
						"Noodling…",
						"Marinating…"
					],
					tokens: "↑ 3.4k tokens",
					seconds: 2.3
				}
			]
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "14s"
		},
		resolve({ data }) {
			const { totalSeconds, phases } = buildTimeline(data);
			return {
				duration: `${totalSeconds}s`,
				phases
			};
		},
		render(ctx) {
			const { std, width, height, data, timeline } = ctx;
			const { phases } = buildTimeline(data);
			const t = ctx.director(phases);
			const fs = 23;
			const small = fs * .92;
			const cardW = Math.min(width - 340, 1460);
			const cardH = Math.min(height - 180, 880);
			const intro = t.motion({
				during: "boot",
				y: 22,
				scale: .992,
				at: "0s",
				for: "55%",
				exit: false,
				easing: "easeOutCubic"
			});
			const submitted = t.in("submit") > .05;
			const blink = timeline.seconds % 1.06 < .53 ? 1 : 0;
			const settled = t.in("boot") >= .55 || t.in("type") > 0 || t.in("submit") > 0;
			const enter = (p) => {
				const e = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
				return {
					p: e,
					style: `opacity:${e};transform:translateY(${(1 - e) * 10}px);`
				};
			};
			const win = (p, start, span) => std.clamp01((p - start) / span);
			const bootP = t.in("boot");
			const banner = enter(win(bootP, .58, .22));
			const tip = enter(win(bootP, .78, .18));
			const typedChars = Math.floor(std.clamp01(t.in("type") / .88) * data.prompt.length);
			const inputText = submitted ? "" : escapeHtml(data.prompt.slice(0, typedChars));
			const promptLine = enter(win(t.in("submit"), 0, .4));
			const bullet = `<span style="color:${C.accent};">⏺</span>`;
			const bannerHtml = banner.p > 0 ? `
      <div class="block" style="border:1px solid ${C.borderBright};border-radius:6px;padding:${fs * .35}px ${fs * .55}px;${banner.style}">
        <div><span style="color:${C.accent};">✻</span> Welcome to <span style="color:${C.accent};">Claude Code</span> <span style="color:${C.muted};">v${escapeHtml(data.version)}</span></div>
        <div style="color:${C.muted};margin-top:${fs * .26}px;">/help for help, /status for your current setup</div>
        <div style="color:${C.muted};">cwd: ${escapeHtml(data.cwd)}</div>
      </div>` : "";
			const tipHtml = tip.p > 0 ? `
      <div class="block" style="color:${C.muted};${tip.style}">※ Tip: ${escapeHtml(data.tip)}</div>` : "";
			const promptHtml = promptLine.p > 0 ? `
      <div class="block" style="${promptLine.style}">
        <span style="color:${C.muted};">&gt;</span> <span style="color:${C.soft};">${escapeHtml(data.prompt)}</span>
      </div>` : "";
			const eventsHtml = data.events.map((ev, i) => {
				const p = t.in(`event_${i}`);
				if (p <= 0) return "";
				switch (ev.type) {
					case "assistant": return renderAssistantEvent(p, ev, bullet, win);
					case "tool": return renderToolEvent(p, ev, bullet, enter, win);
					case "todos": return renderTodosEvent(p, ev, bullet, enter, win);
					case "edit": return renderEditEvent(p, ev, bullet, enter, win, fs);
					case "permission": return renderPermissionEvent(p, ev, enter, win, fs);
					case "spinner": return renderSpinnerEvent(p, ev, enter, win, timeline.seconds, estimateEventSeconds(ev));
					default: return ev;
				}
			}).join("");
			const showPlaceholder = submitted || typedChars === 0;
			const cursorHtml = `<span style="display:inline-block;width:0.55em;height:1.1em;vertical-align:-0.18em;background:${C.text};opacity:${blink};"></span>`;
			const composerHtml = `
      <div style="border:1px solid ${C.borderBright};border-radius:6px;padding:${fs * .22}px ${fs * .55}px;display:flex;align-items:center;gap:${fs * .36}px;">
        <span style="color:${C.accent};">&gt;</span>
        <span>${inputText}</span>${cursorHtml}
        ${showPlaceholder ? `<span style="color:${C.dim};">${escapeHtml(data.inputPlaceholder)}</span>` : ""}
      </div>
      <div style="display:flex;justify-content:space-between;color:${C.dim};font-size:${small}px;padding:${fs * .18}px ${fs * .2}px 0;">
        <span>${escapeHtml(data.statusLeft)}</span>
        <span>${escapeHtml(data.statusRight)}</span>
      </div>`;
			return `
      <style>
        * { box-sizing: border-box; }
        .mono {
          font-family: 'SF Mono', ui-monospace, Menlo, Consolas, 'DejaVu Sans Mono', monospace;
          font-variant-ligatures: none;
          -webkit-font-smoothing: antialiased;
        }
        .block { margin-bottom: ${fs * .5}px; }
        .block.tight { margin-bottom: ${fs * .1}px; }
      </style>
      <div class="mono" style="${std.css({
				width,
				height,
				background: `radial-gradient(120% 120% at 50% 0%, #1a1815 0%, ${C.page} 62%)`,
				color: C.text,
				fontSize: fs,
				lineHeight: 1.65
			}, std.css.center())}">
        <main style="
          width:${cardW}px;
          height:${cardH}px;
          background:${C.terminal};
          border:1px solid ${C.border};
          border-radius:10px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          box-shadow:0 30px 90px rgba(0,0,0,0.55);
          opacity:${intro.opacity};
          ${intro.style}
        ">
          <div style="
            display:flex;align-items:center;gap:${fs * .36}px;
            padding:${fs * .34}px ${fs * .55}px;
            background:${C.chrome};border-bottom:1px solid ${C.border};
            flex:none;
          ">
            <span style="width:${fs * .48}px;height:${fs * .48}px;border-radius:50%;background:${C.trafficRed};"></span>
            <span style="width:${fs * .48}px;height:${fs * .48}px;border-radius:50%;background:${C.trafficYellow};"></span>
            <span style="width:${fs * .48}px;height:${fs * .48}px;border-radius:50%;background:${C.trafficGreen};"></span>
            <span style="margin-left:${fs * .36}px;color:${C.muted};font-size:${small}px;">${escapeHtml(data.windowTitle)}</span>
          </div>

          <div style="
            flex:1;min-height:0;
            padding:${fs * .6}px ${fs * .7}px 0;
            display:flex;flex-direction:column;justify-content:flex-end;
            overflow:hidden;
          ">
            ${bannerHtml}
            ${tipHtml}
            ${promptHtml}
            ${eventsHtml}
          </div>

          <div style="flex:none;padding:${fs * .2}px ${fs * .7}px ${fs * .5}px;opacity:${settled ? 1 : 0};">
            ${composerHtml}
          </div>
        </main>
      </div>
    `;
		}
	});
	//#endregion
	exports.buildTimeline = buildTimeline;
	exports.default = claude_code_media_default;
	exports.estimateEventSeconds = estimateEventSeconds;
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhdWRlLWNvZGUubWVkaWEuanMiLCJuYW1lcyI6WyJfeCJdLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3N1cGVyaW1nLWNvcmUvbm9kZV9tb2R1bGVzL0BzdXBlcmltZy9zdGRsaWIvZGlzdC9sYXlvdXQtdGltZWxpbmUuanMiLCIuLi9wYWNrYWdlcy9zdXBlcmltZy10eXBlcy9kaXN0L2luZGV4LmpzIiwiLi4vZXhhbXBsZXMvaW50ZXJmYWNlcy9jbGF1ZGUtY29kZS9jbGF1ZGUtY29kZS5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2xheW91dC10aW1lbGluZS50c1xuLyoqXG4qIE1hcCBhYnNvbHV0ZS1zZWNvbmQgc2VnbWVudHMgdG8gYSBkaXJlY3RvciBwaGFzZSBsYXlvdXQuXG4qXG4qIEBwYXJhbSBzZWdtZW50cyAtIG5hbWUg4oaSIGR1cmF0aW9uIGluIHNlY29uZHMgKG11c3QgYmUgPiAwKS4gT2JqZWN0IGtleSBvcmRlciBpcyBwcmVzZXJ2ZWQuXG4qIEByZXR1cm5zIHBlcmNlbnQgcGhhc2VzIChzdW0gMTAwJSksIHRvdGFsU2Vjb25kcywgYW5kIHN0YWJsZSBvcmRlclxuKlxuKiBAZXhhbXBsZVxuKiBgYGB0c1xuKiBjb25zdCB7IHBoYXNlcywgdG90YWxTZWNvbmRzIH0gPSBsYXlvdXRUaW1lbGluZSh7IGJvb3Q6IDEsIHR5cGU6IDIsIGV2ZW50XzA6IDAuOSB9KTtcbiogLy8gcmVzb2x2ZTogcmV0dXJuIHsgZHVyYXRpb246IGAke3RvdGFsU2Vjb25kc31zYCwgcGhhc2VzIH1cbiogLy8gcmVuZGVyOiAgY29uc3QgZCA9IGN0eC5kaXJlY3RvcihwaGFzZXMpXG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGxheW91dFRpbWVsaW5lKHNlZ21lbnRzKSB7XG5cdGNvbnN0IG9yZGVyID0gT2JqZWN0LmtleXMoc2VnbWVudHMpO1xuXHRpZiAob3JkZXIubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoXCJsYXlvdXRUaW1lbGluZSgpOiBzZWdtZW50cyBtdXN0IGhhdmUgYXQgbGVhc3Qgb25lIHBoYXNlXCIpO1xuXHRjb25zdCBzZWNvbmRzID0gb3JkZXIubWFwKChuYW1lKSA9PiB7XG5cdFx0Y29uc3QgcyA9IHNlZ21lbnRzW25hbWVdO1xuXHRcdGlmICghTnVtYmVyLmlzRmluaXRlKHMpIHx8IHMgPD0gMCkgdGhyb3cgbmV3IEVycm9yKGBsYXlvdXRUaW1lbGluZSgpOiBzZWdtZW50IFwiJHtuYW1lfVwiIG11c3QgYmUgYSBmaW5pdGUgbnVtYmVyID4gMCAoZ290ICR7c30pYCk7XG5cdFx0cmV0dXJuIHM7XG5cdH0pO1xuXHRjb25zdCB0b3RhbFNlY29uZHMgPSBzZWNvbmRzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApO1xuXHRjb25zdCBwaGFzZXMgPSB7fTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBvcmRlci5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IG5hbWUgPSBvcmRlcltpXTtcblx0XHRwaGFzZXNbbmFtZV0gPSBgJHtzZWNvbmRzW2ldIC8gdG90YWxTZWNvbmRzICogMTAwfSVgO1xuXHR9XG5cdHJldHVybiB7XG5cdFx0cGhhc2VzLFxuXHRcdHRvdGFsU2Vjb25kcyxcblx0XHRvcmRlclxuXHR9O1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBsYXlvdXRUaW1lbGluZSB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1sYXlvdXQtdGltZWxpbmUuanMubWFwIiwiLy8jcmVnaW9uIHNyYy9qc29uLnRzXG4vLyEgU2VyaWFsaXphYmxlIEpTT04tc2hhcGVkIHZhbHVlcyBmb3IgdGVtcGxhdGUgZGF0YSBkZWZhdWx0cyBhbmQgQ0xJIGxvYWRlcnMuXG5mdW5jdGlvbiBpc0pzb25PYmplY3QodmFsdWUpIHtcblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvdHlwZXMudHNcbi8vISBTdXBlckltZyBUeXBlcyAtIENvcmUgdHlwZSBkZWZpbml0aW9uc1xuLy8hIEV4cGxpY2l0LCB0eXBlZCwgc2VsZi1kb2N1bWVudGluZyBpbnRlcmZhY2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vKipcbiogRGVmaW5lIGEgcHJvamVjdC9mb2xkZXIgY29uZmlnIGZvciBfY29uZmlnLnRzIGZpbGVzLlxuKiBQcm92aWRlcyB0eXBlIGluZmVyZW5jZSBhbmQgdmFsaWRhdGlvbi5cbiovXG5mdW5jdGlvbiBkZWZpbmVDb25maWcoY29uZmlnKSB7XG5cdHJldHVybiBjb25maWc7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvZGVmaW5lLnRzXG4vLyEgVGhlIHVuaWZpZWQgYGRlZmluZSgpYCB0ZW1wbGF0ZSBmYWN0b3J5LlxuLy8hXG4vLyEgVW5pZmllZCB0ZW1wbGF0ZSBmYWN0b3J5IOKAlCBvbmUgYGRlZmluZSgpYCBmb3IgYWxsIG91dHB1dCBraW5kcy5cbi8vISBUaHJlZSBvcnRob2dvbmFsIGF4ZXMgc2VsZWN0IGJlaGF2aW91cjpcbi8vISAgLSBtZWRpdW06ICAgXCJodG1sXCIgKENocm9taXVtKSB8IFwic3ZnXCIgKHJlc3ZnLXdhc20sIGJyb3dzZXItZnJlZSwgZWRnZSkuXG4vLyEgIC0gYW5pbWF0ZWQ6IGluZmVycmVkIGZyb20gdGhlIGNvbmZpZyDigJQgdHJ1ZSBpZmYgaXQgZGVjbGFyZXMgZnBzIEFORFxuLy8hICAgICAgICAgICAgICAoZHVyYXRpb24gT1IgYSBgcmVzb2x2ZWAgaG9vayB0aGF0IHdpbGwgc3VwcGx5IGR1cmF0aW9uKS5cbi8vISAgLSBzaW5rOiAgICAgY2hvc2VuIGxhdGVyIChjb25maWcub3V0cHV0cyAvIENMSSAvIGBhc2ApLCBub3QgYXQgYXV0aG9yaW5nIHRpbWUuXG4vLyFcbi8vISBUeXBlU2NyaXB0IG5hcnJvd3MgYGN0eGAgdG8gdGhlIHJpZ2h0IHZhcmlhbnQgYXQgdGhlIGNhbGwgc2l0ZSB2aWEgb3ZlcmxvYWRzOlxuLy8hIG1lZGl1bSBwaWNrcyB0aGUgc3RkbGliIGZsYXZvdXIsIGFuaW1hdGVkIGFkZHMgdGhlIHRlbXBvcmFsIGZpZWxkcyArIGhlbHBlcnMuXG5mdW5jdGlvbiBkZWZpbmUoaW5wdXQpIHtcblx0Y29uc3QgbWVkaXVtID0gaW5wdXQubWVkaXVtID8/IFwiaHRtbFwiO1xuXHRjb25zdCBjID0gaW5wdXQuY29uZmlnO1xuXHRjb25zdCBoYXNSZXNvbHZlID0gdHlwZW9mIGlucHV0LnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIjtcblx0cmV0dXJuIHtcblx0XHRtZWRpdW0sXG5cdFx0YW5pbWF0ZWQ6ICEhYyAmJiB0eXBlb2YgYy5mcHMgPT09IFwibnVtYmVyXCIgJiYgKGMuZHVyYXRpb24gIT0gbnVsbCB8fCBoYXNSZXNvbHZlKSxcblx0XHRyZW5kZXI6IGlucHV0LnJlbmRlcixcblx0XHQuLi5pbnB1dC5jb25maWcgIT09IHZvaWQgMCA/IHsgY29uZmlnOiBpbnB1dC5jb25maWcgfSA6IHt9LFxuXHRcdC4uLmlucHV0LnNhbXBsZSAhPT0gdm9pZCAwID8geyBzYW1wbGU6IGlucHV0LnNhbXBsZSB9IDoge30sXG5cdFx0Li4uaGFzUmVzb2x2ZSA/IHsgcmVzb2x2ZTogaW5wdXQucmVzb2x2ZSB9IDoge31cblx0fTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gYW5pbWF0ZWQgKGZwcyArIGR1cmF0aW9uIGF0IGF1dGhvcmluZyB0aW1lKS4gKi9cbmZ1bmN0aW9uIGlzQW5pbWF0ZWRUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IHRydWU7XG59XG4vKiogTmFycm93IGEgdGVtcGxhdGUgbW9kdWxlIHRvIHN0YXRpYyAoc3RpbGwgLyBzaW5nbGUtZnJhbWUpLiAqL1xuZnVuY3Rpb24gaXNTdGF0aWNUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IGZhbHNlO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3Jlc3VsdHMudHNcbi8vISBSZXN1bHQgdHlwZXMgYW5kIHN0cnVjdHVyZWQgZXJyb3JzXG4vLyEgRGlzY3JpbWluYXRlZCB1bmlvbnMgZm9yIGFzeW5jIG9wZXJhdGlvbnMgd2l0aCBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2VzXG4vKipcbiogQmFzZSBlcnJvciBjbGFzcyBmb3IgYWxsIFN1cGVySW1nIGVycm9yc1xuKi9cbnZhciBTdXBlckltZ0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG5cdGNvZGU7XG5cdGRldGFpbHM7XG5cdHN1Z2dlc3Rpb247XG5cdGRvY3NVcmw7XG5cdC8qKiBNYXBwZWQgc291cmNlIGxvY2F0aW9uIChwb3B1bGF0ZWQgYnkgZW5yaWNoRXJyb3Igd2hlbiBzb3VyY2VtYXAgYXZhaWxhYmxlKSAqL1xuXHRsb2NhdGlvbjtcblx0LyoqIFZpdGUtc3R5bGUgY29kZSBmcmFtZSBzdHJpbmcgKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZSBjb250ZW50IGF2YWlsYWJsZSkgKi9cblx0Y29kZUZyYW1lO1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlLCBjb2RlLCBkZXRhaWxzLCBzdWdnZXN0aW9uLCBkb2NzVXJsKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5jb2RlID0gY29kZTtcblx0XHR0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuXHRcdHRoaXMuc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb247XG5cdFx0dGhpcy5kb2NzVXJsID0gZG9jc1VybDtcblx0XHR0aGlzLm5hbWUgPSBcIlN1cGVySW1nRXJyb3JcIjtcblx0XHRjb25zdCBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlO1xuXHRcdGlmIChjYXB0dXJlU3RhY2tUcmFjZSkgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdH1cblx0LyoqIENvbnZlcnQgdG8gYSBwbGFpbiBvYmplY3QgZm9yIGxvZ2dpbmcvc2VyaWFsaXphdGlvbiAqL1xuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdGNvZGU6IHRoaXMuY29kZSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMubWVzc2FnZSxcblx0XHRcdGRldGFpbHM6IHRoaXMuZGV0YWlscyxcblx0XHRcdHN1Z2dlc3Rpb246IHRoaXMuc3VnZ2VzdGlvbixcblx0XHRcdC4uLnRoaXMuZG9jc1VybCAhPT0gdm9pZCAwID8geyBkb2NzVXJsOiB0aGlzLmRvY3NVcmwgfSA6IHt9LFxuXHRcdFx0Li4udGhpcy5sb2NhdGlvbiAhPT0gdm9pZCAwID8geyBsb2NhdGlvbjogdGhpcy5sb2NhdGlvbiB9IDoge30sXG5cdFx0XHQuLi50aGlzLmNvZGVGcmFtZSAhPT0gdm9pZCAwID8geyBjb2RlRnJhbWU6IHRoaXMuY29kZUZyYW1lIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkXG4qL1xudmFyIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IGRldGFpbHMubGluZSA/IGAgYXQgbGluZSAke2RldGFpbHMubGluZX1gIDogXCJcIjtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBDaGVjayB0aGUgdGVtcGxhdGUgc3ludGF4JHtsb2NhdGlvbn0uIEVuc3VyZSB0aGUgcmVuZGVyIGZ1bmN0aW9uIHJldHVybnMgYSBzdHJpbmcuYDtcblx0XHRzdXBlcihgVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkJHtsb2NhdGlvbn06ICR7ZGV0YWlscy5zeW50YXhFcnJvcn1gLCBcIlRFTVBMQVRFX0NPTVBJTEFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlQ29tcGlsYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgdGhyZXcgYW4gZXJyb3IgZHVyaW5nIHJlbmRlclxuKi9cbnZhciBUZW1wbGF0ZVJ1bnRpbWVFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCB0aW1lSW5mbyA9IGRldGFpbHMudGltZUNvbnRleHQgPyBgICgke2RldGFpbHMudGltZUNvbnRleHQudGltZWxpbmVTZWNvbmRzLnRvRml4ZWQoMyl9cywgJHsoZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVByb2dyZXNzICogMTAwKS50b0ZpeGVkKDEpfSUgcHJvZ3Jlc3MpYCA6IFwiXCI7XG5cdFx0c3VwZXIoYFRlbXBsYXRlIGVycm9yIGF0IGZyYW1lICR7ZGV0YWlscy5mcmFtZX0ke3RpbWVJbmZvfTogJHtkZXRhaWxzLm9yaWdpbmFsRXJyb3J9YCwgXCJURU1QTEFURV9SVU5USU1FX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBgVGhlIHJlbmRlciBmdW5jdGlvbiB0aHJldyBhbiBlcnJvci4gQ2hlY2sgdGhhdCBhbGwgZGF0YSBwcm9wZXJ0aWVzIGV4aXN0IGFuZCB2YWx1ZXMgYXJlbid0IE5hTi91bmRlZmluZWQgYXQgdGhpcyBwb2ludCBpbiB0aGUgdGltZWxpbmUuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlcyNkZWJ1Z2dpbmdcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJUZW1wbGF0ZVJ1bnRpbWVFcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogRGF0YSB2YWxpZGF0aW9uIGZhaWxlZFxuKi9cbnZhciBWYWxpZGF0aW9uRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBgRXhwZWN0ZWQgJHtkZXRhaWxzLmV4cGVjdGVkVHlwZX0gYnV0IHJlY2VpdmVkICR7dHlwZW9mIGRldGFpbHMucmVjZWl2ZWRWYWx1ZX0uIENoZWNrIHlvdXIgZGF0YSBvYmplY3QuYDtcblx0XHRzdXBlcihgVmFsaWRhdGlvbiBmYWlsZWQgZm9yIGZpZWxkIFwiJHtkZXRhaWxzLmZpZWxkfVwiYCwgXCJWQUxJREFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlZhbGlkYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogUmVuZGVyIGZhaWxlZCAoZW5jb2RpbmcsIGJyb3dzZXIsIGV0Yy4pXG4qL1xudmFyIFJlbmRlckVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gZGV0YWlscy5odG1sRXJyb3IgPyBgVGhlIHRlbXBsYXRlIHJldHVybmVkIGludmFsaWQgSFRNTC4gQ2hlY2sgeW91ciByZW5kZXIgZnVuY3Rpb24gb3V0cHV0LmAgOiBkZXRhaWxzLmVuY29kZXJFcnJvciA/IGBFbmNvZGVyIGVycm9yLiBUcnkgcmVkdWNpbmcgcmVzb2x1dGlvbiBvciBjaGFuZ2luZyBjb2RlYy5gIDogYEJyb3dzZXIgZXJyb3IuIENoZWNrIGZvciBicm93c2VyIGNvbXBhdGliaWxpdHkgaXNzdWVzLmA7XG5cdFx0c3VwZXIoYFJlbmRlciBmYWlsZWQgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfWAsIFwiUkVOREVSX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlJlbmRlckVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBGaWxlIEkvTyBlcnJvclxuKi9cbnZhciBJT0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdHN1cGVyKGBGYWlsZWQgdG8gJHtkZXRhaWxzLm9wZXJhdGlvbn0gZmlsZTogJHtkZXRhaWxzLnBhdGh9YCwgXCJJT19FUlJPUlwiLCBkZXRhaWxzLCBkZXRhaWxzLm9wZXJhdGlvbiA9PT0gXCJ3cml0ZVwiID8gYENoZWNrIHRoYXQgdGhlIGRpcmVjdG9yeSBleGlzdHMgYW5kIHlvdSBoYXZlIHdyaXRlIHBlcm1pc3Npb25zLmAgOiBgQ2hlY2sgdGhhdCB0aGUgZmlsZSBleGlzdHMgYW5kIHlvdSBoYXZlIHJlYWQgcGVybWlzc2lvbnMuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZyNpb1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIklPRXJyb3JcIjtcblx0fVxufTtcbi8qKlxuKiBQbGF5ZXIgbm90IHJlYWR5IGVycm9yXG4qL1xudmFyIFBsYXllck5vdFJlYWR5RXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihvcGVyYXRpb24pIHtcblx0XHRzdXBlcihgUGxheWVyIG5vdCByZWFkeSBmb3Igb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBcIlBMQVlFUl9OT1RfUkVBRFlcIiwgeyBvcGVyYXRpb24gfSwgYENhbGwgbG9hZCgpIGFuZCB3YWl0IGZvciBpdCB0byBjb21wbGV0ZSBiZWZvcmUgY2FsbGluZyAke29wZXJhdGlvbn0oKS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvcGxheWVyXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyTm90UmVhZHlFcnJvclwiO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3BsYXllci50c1xuLy8hIFBsYXllciB0eXBlcyAtIFVzZXItZmFjaW5nIG9wdGlvbnMsIGV2ZW50cywgYW5kIGlucHV0IHR5cGVzIGZvciB0aGUgYnJvd3NlciBwbGF5ZXJcbi8vISBJbXBsZW1lbnRhdGlvbiB0eXBlcyAoUGxheWVyU3RhdGUsIFBsYXllclN0b3JlLCBldGMuKSBsaXZlIGluIEBzdXBlcmltZy9wbGF5ZXJcbi8qKiBUeXBlIGd1YXJkIGZvciBDb21wb3NlZFRlbXBsYXRlICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIiAmJiBpbnB1dCAhPT0gbnVsbCAmJiBcInR5cGVcIiBpbiBpbnB1dCAmJiBpbnB1dC50eXBlID09PSBcImNvbXBvc2VkXCI7XG59XG4vKiogQGRlcHJlY2F0ZWQgVXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSAqL1xuY29uc3QgaXNBbnlDb21wb3NlZFRlbXBsYXRlID0gaXNDb21wb3NlZFRlbXBsYXRlO1xuLyoqIEBkZXByZWNhdGVkIFJlbW92ZWQg4oCUIHVzZSBpc0NvbXBvc2VkVGVtcGxhdGUgYW5kIGNoZWNrIG1lZGl1bSA9PT0gXCJzdmdcIiAqL1xuZnVuY3Rpb24gaXNDb21wb3NlZFN2Z1RlbXBsYXRlKGlucHV0KSB7XG5cdHJldHVybiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpICYmIGlucHV0Lm1lZGl1bSA9PT0gXCJzdmdcIjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9ldmVudHMudHNcbi8vISBUeXBlZCwgdmVyc2lvbmVkIGV2ZW50IGNvbnRyYWN0IGZvciBzdXBlcmltZyBidWlsZCBpbnRlZ3JhdGlvbnMuXG4vLyEgQm90aCBKUyBjb25zdW1lcnMgKHJlbmRlciB3cmFwcGVycykgYW5kIFJ1c3QgZGVzZXJpYWxpemVycyAoZS5nLiBndW1ibylcbi8vISBzaG91bGQga2V5IG9uIHRoZSBgdmAgZmllbGQgYmVmb3JlIHJlYWRpbmcgZXZlbnQtc3BlY2lmaWMgZmllbGRzLlxuLy8hIEJ1bXAgYHZgIG9uIGFueSBicmVha2luZyBmaWVsZCByZW5hbWUgb3IgcmVtb3ZhbDsgYWRkaXRpdmUgZmllbGRzIGFyZSBub24tYnJlYWtpbmcuXG5jb25zdCBSRU5ERVJfRVZFTlRfVkVSU0lPTiA9IDE7XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvYmF0Y2gtdHlwZXMudHNcbi8vISBTdXBlckltZyBCYXRjaCBUeXBlc1xuLy8hIENvLWxvY2F0ZWQgYGV4cG9ydCBjb25zdCBiYXRjaGAgY29udmVudGlvbiBmb3IgYnVpbGQtdGltZSBmYW4tb3V0LlxuLy8hIEEgdGVtcGxhdGUgbW9kdWxlIG9wdGlvbmFsbHkgZXhwb3J0cyBgYmF0Y2hgIChidWlsdCB3aXRoIGBkZWZpbmVCYXRjaGApIHRvXG4vLyEgZ2VuZXJhdGUgbWFueSBvdXRwdXRzIGZyb20gb25lIHRlbXBsYXRlIOKAlCBubyBzZXBhcmF0ZSBsb2FkZXIgZmlsZS5cbi8qKlxuKiBUeXBlIGEgY28tbG9jYXRlZCBgYmF0Y2hgIGV4cG9ydCBhZ2FpbnN0IGl0cyB0ZW1wbGF0ZS5cbipcbiogYFREYXRhYCBmbG93cyBmcm9tIHRoZSB0ZW1wbGF0ZSB2YWx1ZSDigJQgY2hhbmdlIHRoZSB0ZW1wbGF0ZSdzIGBzYW1wbGVgXG4qIHNoYXBlIGFuZCB0aGUgYGRhdGE6YCBzaXRlcyBiZWxvdyB0eXBlLWVycm9yLiBUaGUgdGVtcGxhdGUgYXJndW1lbnQgaXNcbiogaW5mZXJlbmNlLW9ubHk7IGF0IHJ1bnRpbWUgdGhlIHByb3ZpZGVyIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbipcbiogUHV0IGFueSBzZXJ2ZXIvZGF0YSBpbXBvcnRzICppbnNpZGUqIHRoZSBwcm92aWRlciB3aXRoIGBhd2FpdCBpbXBvcnQoLi4uKWBcbiogc28gdGhlIGNsaWVudCBwbGF5ZXIgYnVuZGxlICh3aGljaCBpbXBvcnRzIHRoZSB0ZW1wbGF0ZSkgdHJlZS1zaGFrZXMgdGhlbSBvdXQuXG4qXG4qIEBleGFtcGxlXG4qIGBgYHR5cGVzY3JpcHRcbiogLy8gb2cubWVkaWEudHNcbiogaW1wb3J0IHsgZGVmaW5lLCBkZWZpbmVCYXRjaCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuKlxuKiBjb25zdCB0ZW1wbGF0ZSA9IGRlZmluZSh7IHNhbXBsZTogeyB0aXRsZTogXCJIaVwiIH0sIGNvbmZpZzogeyB3aWR0aDogMTIwMCwgaGVpZ2h0OiA2MzAgfSwgcmVuZGVyIH0pO1xuKiBleHBvcnQgZGVmYXVsdCB0ZW1wbGF0ZTtcbipcbiogZXhwb3J0IGNvbnN0IGJhdGNoID0gZGVmaW5lQmF0Y2godGVtcGxhdGUsIGFzeW5jICgpID0+IHtcbiogICBjb25zdCB7IGdldFBvc3RzIH0gPSBhd2FpdCBpbXBvcnQoXCIuLi9jb250ZW50XCIpO1xuKiAgIHJldHVybiAoYXdhaXQgZ2V0UG9zdHMoKSkubWFwKHAgPT4gKHsgc2x1ZzogcC5zbHVnLCBzYW1wbGU6IHsgdGl0bGU6IHAudGl0bGUgfSB9KSk7XG4qIH0pO1xuKiBgYGBcbiovXG5mdW5jdGlvbiBkZWZpbmVCYXRjaChfdGVtcGxhdGUsIHByb3ZpZGVyKSB7XG5cdHJldHVybiBwcm92aWRlcjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9pbmRleC50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gUHVyZSBUeXBlU2NyaXB0IHR5cGUgZGVmaW5pdGlvbnNcbi8vISBDb3JlIHR5cGVzLCBpbnRlcmZhY2VzLCBhbmQgZXJyb3IgY2xhc3NlcyBmb3IgdGVtcGxhdGVzLCByZW5kZXJpbmcsIGFuZCBwbGF5YmFja1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBJT0Vycm9yLCBQbGF5ZXJOb3RSZWFkeUVycm9yLCBSRU5ERVJfRVZFTlRfVkVSU0lPTiwgUmVuZGVyRXJyb3IsIFN1cGVySW1nRXJyb3IsIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciwgVGVtcGxhdGVSdW50aW1lRXJyb3IsIFZhbGlkYXRpb25FcnJvciwgZGVmaW5lLCBkZWZpbmVCYXRjaCwgZGVmaW5lQ29uZmlnLCBpc0FuaW1hdGVkVGVtcGxhdGUsIGlzQW55Q29tcG9zZWRUZW1wbGF0ZSwgaXNDb21wb3NlZFN2Z1RlbXBsYXRlLCBpc0NvbXBvc2VkVGVtcGxhdGUsIGlzSnNvbk9iamVjdCwgaXNTdGF0aWNUZW1wbGF0ZSB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgeyBkZWZpbmUsIGxheW91dFRpbWVsaW5lLCB0eXBlIFJlbmRlckNvbnRleHQgfSBmcm9tIFwic3VwZXJpbWdcIjtcblxuLyoqIERpZmYgbGluZSBpbnNpZGUgYW4gZWRpdCBldmVudC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2xhdWRlQ29kZURpZmZMaW5lIHtcbiAga2luZDogXCJjb250ZXh0XCIgfCBcImRlbFwiIHwgXCJhZGRcIjtcbiAgbnVtOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDbGF1ZGVDb2RlVG9kbyB7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhdHVzOiBcImRvbmVcIiB8IFwiYWN0aXZlXCIgfCBcInBlbmRpbmdcIjtcbn1cblxuLyoqXG4gKiBQcm9ncmFtbWFibGUgdHJhbnNjcmlwdCBldmVudHMg4oCUIGFueSBsZW5ndGgsIGFueSBvcmRlci5cbiAqIFBhc3MgYSBkaWZmZXJlbnQgYGV2ZW50c2AgYXJyYXkgKGhhbmQtYXV0aG9yZWQgb3IgTExNLWdlbmVyYXRlZCkgYW5kIGR1cmF0aW9uIHNjYWxlcyB2aWEgcmVzb2x2ZSgpLlxuICovXG5leHBvcnQgdHlwZSBDbGF1ZGVDb2RlRXZlbnQgPVxuICB8IHsgdHlwZTogXCJhc3Npc3RhbnRcIjsgdGV4dDogc3RyaW5nIH1cbiAgfCB7IHR5cGU6IFwidG9vbFwiOyBuYW1lOiBzdHJpbmc7IGFyZ3M6IHN0cmluZzsgcmVzdWx0OiBzdHJpbmcgfVxuICB8IHsgdHlwZTogXCJ0b2Rvc1wiOyBpdGVtczogQ2xhdWRlQ29kZVRvZG9bXSB9XG4gIHwgeyB0eXBlOiBcImVkaXRcIjsgZmlsZTogc3RyaW5nOyBkaWZmOiBDbGF1ZGVDb2RlRGlmZkxpbmVbXSB9XG4gIHwgeyB0eXBlOiBcInBlcm1pc3Npb25cIjsgZmlsZTogc3RyaW5nOyBvcHRpb25zOiBzdHJpbmdbXTsgc2VsZWN0ZWQ/OiBudW1iZXIgfVxuICB8IHsgdHlwZTogXCJzcGlubmVyXCI7IHZlcmJzOiBzdHJpbmdbXTsgdG9rZW5zOiBzdHJpbmc7IHNlY29uZHM/OiBudW1iZXIgfTtcblxuZXhwb3J0IGludGVyZmFjZSBDbGF1ZGVDb2RlRGF0YSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgd2luZG93VGl0bGU6IHN0cmluZztcbiAgdmVyc2lvbjogc3RyaW5nO1xuICBjd2Q6IHN0cmluZztcbiAgdGlwOiBzdHJpbmc7XG4gIHByb21wdDogc3RyaW5nO1xuICBpbnB1dFBsYWNlaG9sZGVyOiBzdHJpbmc7XG4gIHN0YXR1c0xlZnQ6IHN0cmluZztcbiAgc3RhdHVzUmlnaHQ6IHN0cmluZztcbiAgZXZlbnRzOiBDbGF1ZGVDb2RlRXZlbnRbXTtcbn1cblxuY29uc3QgQyA9IHtcbiAgcGFnZTogXCIjMGUwZDBiXCIsXG4gIHRlcm1pbmFsOiBcIiMxNjE1MTNcIixcbiAgY2hyb21lOiBcIiMxZjFlMWJcIixcbiAgYm9yZGVyOiBcIiMzMzMxMmRcIixcbiAgYm9yZGVyQnJpZ2h0OiBcIiM0YTQ3NDBcIixcbiAgdGV4dDogXCIjZDZkM2NjXCIsXG4gIHNvZnQ6IFwiI2E4YTQ5YlwiLFxuICBtdXRlZDogXCIjN2M3OTcwXCIsXG4gIGRpbTogXCIjNWM1YTU0XCIsXG4gIGFjY2VudDogXCIjZDk3NzU3XCIsXG4gIHNlbGVjdGVkOiBcIiMyYjI5MjZcIixcbiAgZGlmZkhlYWRlcjogXCIjMWMxYjE4XCIsXG4gIGRlbEJnOiBcIiMzYTFmMWNcIixcbiAgZGVsVGV4dDogXCIjZTA3YTZhXCIsXG4gIGFkZEJnOiBcIiMxZTMwMjBcIixcbiAgYWRkVGV4dDogXCIjOGZjNDdhXCIsXG4gIGRvbmU6IFwiIzdmYWU2YVwiLFxuICB0cmFmZmljUmVkOiBcIiNlMDVjNDhcIixcbiAgdHJhZmZpY1llbGxvdzogXCIjZTBhODQwXCIsXG4gIHRyYWZmaWNHcmVlbjogXCIjNGZhODVjXCIsXG59O1xuXG4vKiogV2luZG93IHNldHRsZSBvbmx5IOKAlCBjaGF0IGNvbnRlbnQgc3RhcnRzIGFmdGVyIHRoaXMgcGhhc2UgZW5kcy4gKi9cbmNvbnN0IEJPT1RfUyA9IDEuMzU7XG5jb25zdCBTVUJNSVRfUyA9IDAuNjtcbmNvbnN0IFRZUEVfTUlOX1MgPSAwLjk7XG5jb25zdCBUWVBFX0NIQVJTX1BFUl9TRUMgPSAzMjtcbmNvbnN0IEFTU0lTVF9DSEFSU19QRVJfU0VDID0gNTA7XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIik7XG59XG5cbmZ1bmN0aW9uIHR5cGVTZWNvbmRzKHByb21wdDogc3RyaW5nKTogbnVtYmVyIHtcbiAgcmV0dXJuIE1hdGgubWF4KFRZUEVfTUlOX1MsIHByb21wdC5sZW5ndGggLyBUWVBFX0NIQVJTX1BFUl9TRUMpO1xufVxuXG4vKiogU2Vjb25kcyBmb3Igb25lIGV2ZW50IOKAlCBwdXJlLCBkZXRlcm1pbmlzdGljLiBUdW5lZCBuZWFyIHRoZSBvcmlnaW5hbCBmaXhlZCBwaGFzZXMuICovXG5leHBvcnQgZnVuY3Rpb24gZXN0aW1hdGVFdmVudFNlY29uZHMoZTogQ2xhdWRlQ29kZUV2ZW50KTogbnVtYmVyIHtcbiAgc3dpdGNoIChlLnR5cGUpIHtcbiAgICBjYXNlIFwiYXNzaXN0YW50XCI6XG4gICAgICByZXR1cm4gTWF0aC5tYXgoMC41NSwgZS50ZXh0Lmxlbmd0aCAvIEFTU0lTVF9DSEFSU19QRVJfU0VDICsgMC4yNSk7XG4gICAgY2FzZSBcInRvb2xcIjpcbiAgICAgIHJldHVybiAwLjk7XG4gICAgY2FzZSBcInRvZG9zXCI6XG4gICAgICByZXR1cm4gMC41ICsgZS5pdGVtcy5sZW5ndGggKiAwLjI4O1xuICAgIGNhc2UgXCJlZGl0XCI6XG4gICAgICByZXR1cm4gMC41ICsgZS5kaWZmLmxlbmd0aCAqIDAuMjQ7XG4gICAgY2FzZSBcInBlcm1pc3Npb25cIjpcbiAgICAgIHJldHVybiAwLjYgKyBlLm9wdGlvbnMubGVuZ3RoICogMC40NTtcbiAgICBjYXNlIFwic3Bpbm5lclwiOlxuICAgICAgcmV0dXJuIGUuc2Vjb25kcyA/PyAyLjM7XG4gICAgZGVmYXVsdDoge1xuICAgICAgY29uc3QgX3g6IG5ldmVyID0gZTtcbiAgICAgIHJldHVybiBfeDtcbiAgICB9XG4gIH1cbn1cblxuLyoqIFB1cmUgdGltZWxpbmU6IHNhbWUgY2FsbCBmb3IgcmVzb2x2ZSgpIGFuZCByZW5kZXIoKSB2aWEgc3RkLmxheW91dFRpbWVsaW5lLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkVGltZWxpbmUoZGF0YTogQ2xhdWRlQ29kZURhdGEpIHtcbiAgY29uc3Qgc2VnbWVudHM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gICAgYm9vdDogQk9PVF9TLFxuICAgIHR5cGU6IHR5cGVTZWNvbmRzKGRhdGEucHJvbXB0KSxcbiAgICBzdWJtaXQ6IFNVQk1JVF9TLFxuICB9O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEuZXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgc2VnbWVudHNbYGV2ZW50XyR7aX1gXSA9IGVzdGltYXRlRXZlbnRTZWNvbmRzKGRhdGEuZXZlbnRzW2ldISk7XG4gIH1cbiAgcmV0dXJuIGxheW91dFRpbWVsaW5lKHNlZ21lbnRzKTtcbn1cblxudHlwZSBFbnRlciA9IChwOiBudW1iZXIpID0+IHsgcDogbnVtYmVyOyBzdHlsZTogc3RyaW5nIH07XG50eXBlIFdpbiA9IChwOiBudW1iZXIsIHN0YXJ0OiBudW1iZXIsIHNwYW46IG51bWJlcikgPT4gbnVtYmVyO1xuXG5mdW5jdGlvbiByZW5kZXJBc3Npc3RhbnRFdmVudChwOiBudW1iZXIsIGV2OiBFeHRyYWN0PENsYXVkZUNvZGVFdmVudCwgeyB0eXBlOiBcImFzc2lzdGFudFwiIH0+LCBidWxsZXQ6IHN0cmluZywgd2luOiBXaW4pOiBzdHJpbmcge1xuICBpZiAocCA8PSAwKSByZXR1cm4gXCJcIjtcbiAgY29uc3QgY2hhcnMgPSBNYXRoLmZsb29yKHdpbihwLCAwLCAwLjg1KSAqIGV2LnRleHQubGVuZ3RoKTtcbiAgaWYgKGNoYXJzIDw9IDApIHJldHVybiBcIlwiO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJibG9ja1wiPiR7YnVsbGV0fSAke2VzY2FwZUh0bWwoZXYudGV4dC5zbGljZSgwLCBjaGFycykpfTwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRvb2xFdmVudChwOiBudW1iZXIsIGV2OiBFeHRyYWN0PENsYXVkZUNvZGVFdmVudCwgeyB0eXBlOiBcInRvb2xcIiB9PiwgYnVsbGV0OiBzdHJpbmcsIGVudGVyOiBFbnRlciwgd2luOiBXaW4pOiBzdHJpbmcge1xuICBjb25zdCBjYWxsID0gZW50ZXIod2luKHAsIDAsIDAuMzUpKTtcbiAgY29uc3QgcmVzdWx0ID0gZW50ZXIod2luKHAsIDAuMzUsIDAuNCkpO1xuICBpZiAoY2FsbC5wIDw9IDApIHJldHVybiBcIlwiO1xuICByZXR1cm4gYFxuICAgIDxkaXYgY2xhc3M9XCJibG9jayB0aWdodFwiIHN0eWxlPVwiJHtjYWxsLnN0eWxlfVwiPiR7YnVsbGV0fSA8c3BhbiBzdHlsZT1cImZvbnQtd2VpZ2h0OjUwMDtcIj4ke2VzY2FwZUh0bWwoZXYubmFtZSl9PC9zcGFuPjxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLm11dGVkfTtcIj4oJHtlc2NhcGVIdG1sKGV2LmFyZ3MpfSk8L3NwYW4+PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImJsb2NrXCIgc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9O3BhZGRpbmctbGVmdDoycHg7b3BhY2l0eToke3Jlc3VsdC5wfTtcIj4mbmJzcDsmbmJzcDvijr8mbmJzcDsmbmJzcDske2VzY2FwZUh0bWwoZXYucmVzdWx0KX08L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiByZW5kZXJUb2Rvc0V2ZW50KFxuICBwOiBudW1iZXIsXG4gIGV2OiBFeHRyYWN0PENsYXVkZUNvZGVFdmVudCwgeyB0eXBlOiBcInRvZG9zXCIgfT4sXG4gIGJ1bGxldDogc3RyaW5nLFxuICBlbnRlcjogRW50ZXIsXG4gIHdpbjogV2luLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgYmxvY2sgPSBlbnRlcih3aW4ocCwgMCwgMC4yNSkpO1xuICBpZiAoYmxvY2sucCA8PSAwKSByZXR1cm4gXCJcIjtcbiAgY29uc3Qgcm93cyA9IGV2Lml0ZW1zXG4gICAgLm1hcCgodG9kbywgaSkgPT4ge1xuICAgICAgY29uc3QgY2hlY2tlZCA9IHRvZG8uc3RhdHVzID09PSBcImRvbmVcIiAmJiB3aW4ocCwgMC4zICsgaSAqIDAuMjgsIDAuMTIpID49IDE7XG4gICAgICBjb25zdCBsZWFkID0gaSA9PT0gMCA/IFwi4o6/Jm5ic3A7Jm5ic3A7XCIgOiBcIiZuYnNwOyZuYnNwOyZuYnNwO1wiO1xuICAgICAgY29uc3QgYm94ID0gY2hlY2tlZFxuICAgICAgICA/IGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5kb25lfTtcIj7imJI8L3NwYW4+IDxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLmRpbX07dGV4dC1kZWNvcmF0aW9uOmxpbmUtdGhyb3VnaDtcIj4ke2VzY2FwZUh0bWwodG9kby50ZXh0KX08L3NwYW4+YFxuICAgICAgICA6IHRvZG8uc3RhdHVzID09PSBcInBlbmRpbmdcIlxuICAgICAgICAgID8gYOKYkCAke2VzY2FwZUh0bWwodG9kby50ZXh0KX1gXG4gICAgICAgICAgOiBgPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MudGV4dH07XCI+4piQPC9zcGFuPiA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy50ZXh0fTtcIj4ke2VzY2FwZUh0bWwodG9kby50ZXh0KX08L3NwYW4+YDtcbiAgICAgIHJldHVybiBgPGRpdiBzdHlsZT1cImNvbG9yOiR7Qy5tdXRlZH07cGFkZGluZy1sZWZ0OjJweDtcIj4mbmJzcDsmbmJzcDske2xlYWR9JHtib3h9PC9kaXY+YDtcbiAgICB9KVxuICAgIC5qb2luKFwiXCIpO1xuICByZXR1cm4gYFxuICAgIDxkaXYgY2xhc3M9XCJibG9ja1wiIHN0eWxlPVwiJHtibG9jay5zdHlsZX1cIj5cbiAgICAgIDxkaXY+JHtidWxsZXR9IDxzcGFuIHN0eWxlPVwiZm9udC13ZWlnaHQ6NTAwO1wiPlVwZGF0ZSBUb2Rvczwvc3Bhbj48L2Rpdj5cbiAgICAgICR7cm93c31cbiAgICA8L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiByZW5kZXJFZGl0RXZlbnQoXG4gIHA6IG51bWJlcixcbiAgZXY6IEV4dHJhY3Q8Q2xhdWRlQ29kZUV2ZW50LCB7IHR5cGU6IFwiZWRpdFwiIH0+LFxuICBidWxsZXQ6IHN0cmluZyxcbiAgZW50ZXI6IEVudGVyLFxuICB3aW46IFdpbixcbiAgZnM6IG51bWJlcixcbik6IHN0cmluZyB7XG4gIGNvbnN0IGhlYWQgPSBlbnRlcih3aW4ocCwgMCwgMC4yKSk7XG4gIGlmIChoZWFkLnAgPD0gMCkgcmV0dXJuIFwiXCI7XG4gIGNvbnN0IHJvd3MgPSBldi5kaWZmXG4gICAgLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgY29uc3Qgcm93ID0gd2luKHAsIDAuMTggKyBpICogMC4wOSwgMC4xKTtcbiAgICAgIGlmIChyb3cgPD0gMCkgcmV0dXJuIFwiXCI7XG4gICAgICBjb25zdCBiZyA9IGxpbmUua2luZCA9PT0gXCJkZWxcIiA/IEMuZGVsQmcgOiBsaW5lLmtpbmQgPT09IFwiYWRkXCIgPyBDLmFkZEJnIDogXCJ0cmFuc3BhcmVudFwiO1xuICAgICAgY29uc3QgZmcgPSBsaW5lLmtpbmQgPT09IFwiZGVsXCIgPyBDLmRlbFRleHQgOiBsaW5lLmtpbmQgPT09IFwiYWRkXCIgPyBDLmFkZFRleHQgOiBDLm11dGVkO1xuICAgICAgY29uc3QgcGFkID0gbGluZS5raW5kID09PSBcImNvbnRleHRcIiA/IFwiJm5ic3A7Jm5ic3A7XCIgOiBcIiZuYnNwO1wiO1xuICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwicGFkZGluZzowICR7ZnMgKiAwLjQ1fXB4O2JhY2tncm91bmQ6JHtiZ307XCI+PHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuZGltfTtcIj4mbmJzcDsmbmJzcDske2xpbmUubnVtfSR7cGFkfTwvc3Bhbj48c3BhbiBzdHlsZT1cImNvbG9yOiR7Zmd9O1wiPiR7ZXNjYXBlSHRtbChsaW5lLnRleHQpfTwvc3Bhbj48L2Rpdj5gO1xuICAgIH0pXG4gICAgLmpvaW4oXCJcIik7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImJsb2NrIHRpZ2h0XCIgc3R5bGU9XCIke2hlYWQuc3R5bGV9XCI+JHtidWxsZXR9IDxzcGFuIHN0eWxlPVwiZm9udC13ZWlnaHQ6NTAwO1wiPlVwZGF0ZTwvc3Bhbj48c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5tdXRlZH07XCI+KCR7ZXNjYXBlSHRtbChldi5maWxlKX0pPC9zcGFuPjwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJibG9ja1wiIHN0eWxlPVwiYm9yZGVyOjFweCBzb2xpZCAke0MuYm9yZGVyfTtib3JkZXItcmFkaXVzOjRweDttYXJnaW4tbGVmdDoycHg7b3BhY2l0eToke2hlYWQucH07XCI+XG4gICAgICA8ZGl2IHN0eWxlPVwicGFkZGluZzoke2ZzICogMC4xNH1weCAke2ZzICogMC40NX1weDtjb2xvcjoke0MubXV0ZWR9O2JhY2tncm91bmQ6JHtDLmRpZmZIZWFkZXJ9O2JvcmRlci1ib3R0b206MXB4IHNvbGlkICR7Qy5ib3JkZXJ9O2JvcmRlci1yYWRpdXM6NHB4IDRweCAwIDA7XCI+JHtlc2NhcGVIdG1sKGV2LmZpbGUpfTwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cInBhZGRpbmc6JHtmcyAqIDAuMTh9cHggMDtcIj4ke3Jvd3N9PC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyUGVybWlzc2lvbkV2ZW50KFxuICBwOiBudW1iZXIsXG4gIGV2OiBFeHRyYWN0PENsYXVkZUNvZGVFdmVudCwgeyB0eXBlOiBcInBlcm1pc3Npb25cIiB9PixcbiAgZW50ZXI6IEVudGVyLFxuICB3aW46IFdpbixcbiAgZnM6IG51bWJlcixcbik6IHN0cmluZyB7XG4gIGNvbnN0IGJveCA9IGVudGVyKHdpbihwLCAwLCAwLjIyKSk7XG4gIGlmIChib3gucCA8PSAwKSByZXR1cm4gXCJcIjtcbiAgY29uc3Qgc2VsZWN0ZWRJZHggPSBldi5zZWxlY3RlZCA/PyAwO1xuICBjb25zdCByb3dzID0gZXYub3B0aW9uc1xuICAgIC5tYXAoKG9wdGlvbiwgaSkgPT4ge1xuICAgICAgY29uc3Qgc2VsZWN0ZWQgPSBpID09PSBzZWxlY3RlZElkeDtcbiAgICAgIHJldHVybiBgPGRpdiBzdHlsZT1cInBhZGRpbmc6MXB4ICR7ZnMgKiAwLjI4fXB4O2JvcmRlci1yYWRpdXM6M3B4OyR7c2VsZWN0ZWQgPyBgYmFja2dyb3VuZDoke0Muc2VsZWN0ZWR9O2NvbG9yOiR7Qy5hY2NlbnR9O2AgOiBgY29sb3I6JHtDLnRleHR9O2B9d2hpdGUtc3BhY2U6cHJlO1wiPiR7c2VsZWN0ZWQgPyBcIuKdryBcIiA6IFwiICBcIn0ke2VzY2FwZUh0bWwob3B0aW9uKX08L2Rpdj5gO1xuICAgIH0pXG4gICAgLmpvaW4oXCJcIik7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImJsb2NrXCIgc3R5bGU9XCJib3JkZXI6MXB4IHNvbGlkICR7Qy5hY2NlbnR9O2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6JHtmcyAqIDAuNDJ9cHggJHtmcyAqIDAuNTV9cHg7JHtib3guc3R5bGV9XCI+XG4gICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbToke2ZzICogMC4zMn1weDtcIj5EbyB5b3Ugd2FudCB0byBtYWtlIHRoaXMgZWRpdCB0byA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5hY2NlbnR9O2ZvbnQtd2VpZ2h0OjUwMDtcIj4ke2VzY2FwZUh0bWwoZXYuZmlsZSl9PC9zcGFuPj88L2Rpdj5cbiAgICAgICR7cm93c31cbiAgICA8L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiByZW5kZXJTcGlubmVyRXZlbnQoXG4gIHA6IG51bWJlcixcbiAgZXY6IEV4dHJhY3Q8Q2xhdWRlQ29kZUV2ZW50LCB7IHR5cGU6IFwic3Bpbm5lclwiIH0+LFxuICBlbnRlcjogRW50ZXIsXG4gIHdpbjogV2luLFxuICB0aW1lbGluZVNlY29uZHM6IG51bWJlcixcbiAgcGhhc2VTZWNvbmRzOiBudW1iZXIsXG4pOiBzdHJpbmcge1xuICBjb25zdCBzcGluID0gZW50ZXIod2luKHAsIDAsIDAuMTIpKTtcbiAgaWYgKHNwaW4ucCA8PSAwKSByZXR1cm4gXCJcIjtcbiAgY29uc3QgbG9jYWxTZWMgPSBwICogcGhhc2VTZWNvbmRzO1xuICBjb25zdCB2ZXJiID0gZXYudmVyYnNbTWF0aC5mbG9vcihsb2NhbFNlYyAvIDAuNykgJSBldi52ZXJicy5sZW5ndGhdID8/IGV2LnZlcmJzWzBdID8/IFwiV29ya2luZ+KAplwiO1xuICBjb25zdCBlbGFwc2VkID0gTWF0aC5mbG9vcih0aW1lbGluZVNlY29uZHMpO1xuICByZXR1cm4gYFxuICAgIDxkaXYgY2xhc3M9XCJibG9ja1wiIHN0eWxlPVwiY29sb3I6JHtDLm11dGVkfTske3NwaW4uc3R5bGV9XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5hY2NlbnR9O1wiPuKcuzwvc3Bhbj4gPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuYWNjZW50fTtcIj4ke2VzY2FwZUh0bWwodmVyYil9PC9zcGFuPiAoJHtlbGFwc2VkfXMgwrcgJHtlc2NhcGVIdG1sKGV2LnRva2Vucyl9IMK3IGVzYyB0byBpbnRlcnJ1cHQpXG4gICAgPC9kaXY+YDtcbn1cblxuY29uc3QgU0FNUExFX0VWRU5UUzogQ2xhdWRlQ29kZUV2ZW50W10gPSBbXG4gIHtcbiAgICB0eXBlOiBcImFzc2lzdGFudFwiLFxuICAgIHRleHQ6IFwiSSdsbCByZWFkIHRoZSBjdXJyZW50IG1pZGRsZXdhcmUgZmlyc3QsIHRoZW4gZmluZCBldmVyeSBjYWxsIHNpdGUuXCIsXG4gIH0sXG4gIHtcbiAgICB0eXBlOiBcInRvb2xcIixcbiAgICBuYW1lOiBcIlJlYWRcIixcbiAgICBhcmdzOiBcInNyYy9taWRkbGV3YXJlL2F1dGgudHNcIixcbiAgICByZXN1bHQ6IFwiUmVhZCAxNDggbGluZXMgKGN0cmwrbyB0byBleHBhbmQpXCIsXG4gIH0sXG4gIHtcbiAgICB0eXBlOiBcInRvb2xcIixcbiAgICBuYW1lOiBcIkdyZXBcIixcbiAgICBhcmdzOiAncGF0dGVybjogXCJzZXNzaW9uU3RvcmVcIiwgZ2xvYjogXCJzcmMvKiovKi50c1wiJyxcbiAgICByZXN1bHQ6IFwiRm91bmQgNiBtYXRjaGVzIGFjcm9zcyA0IGZpbGVzXCIsXG4gIH0sXG4gIHtcbiAgICB0eXBlOiBcInRvZG9zXCIsXG4gICAgaXRlbXM6IFtcbiAgICAgIHsgdGV4dDogXCJSZWFkIGN1cnJlbnQgYXV0aCBtaWRkbGV3YXJlXCIsIHN0YXR1czogXCJkb25lXCIgfSxcbiAgICAgIHsgdGV4dDogXCJMb2NhdGUgYWxsIHNlc3Npb25TdG9yZSBjYWxsIHNpdGVzXCIsIHN0YXR1czogXCJkb25lXCIgfSxcbiAgICAgIHsgdGV4dDogXCJTd2FwIHJlc29sdmVyIHRvIFNlc3Npb25TdG9yZS5nZXQoKVwiLCBzdGF0dXM6IFwiYWN0aXZlXCIgfSxcbiAgICAgIHsgdGV4dDogXCJVcGRhdGUgdGVzdHMgaW4gYXV0aC50ZXN0LnRzXCIsIHN0YXR1czogXCJwZW5kaW5nXCIgfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgdHlwZTogXCJlZGl0XCIsXG4gICAgZmlsZTogXCJzcmMvbWlkZGxld2FyZS9hdXRoLnRzXCIsXG4gICAgZGlmZjogW1xuICAgICAgeyBraW5kOiBcImNvbnRleHRcIiwgbnVtOiBcIjQxXCIsIHRleHQ6IFwiZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVpcmVBdXRoKGM6IENvbnRleHQpIHtcIiB9LFxuICAgICAgeyBraW5kOiBcImRlbFwiLCBudW06IFwiNDJcIiwgdGV4dDogXCItICAgY29uc3QgcmF3ID0gYy5yZXEuaGVhZGVyKCdjb29raWUnKVwiIH0sXG4gICAgICB7IGtpbmQ6IFwiZGVsXCIsIG51bTogXCI0M1wiLCB0ZXh0OiBcIi0gICBjb25zdCBzZXNzaW9uID0gYXdhaXQgbGVnYWN5U3RvcmUucGFyc2UocmF3KVwiIH0sXG4gICAgICB7IGtpbmQ6IFwiYWRkXCIsIG51bTogXCI0MlwiLCB0ZXh0OiBcIisgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgc2Vzc2lvblN0b3JlLmdldChjLCB7XCIgfSxcbiAgICAgIHsga2luZDogXCJhZGRcIiwgbnVtOiBcIjQzXCIsIHRleHQ6IFwiKyAgICAgcm9sbGluZzogdHJ1ZSxcIiB9LFxuICAgICAgeyBraW5kOiBcImFkZFwiLCBudW06IFwiNDRcIiwgdGV4dDogXCIrICAgfSlcIiB9LFxuICAgICAgeyBraW5kOiBcImNvbnRleHRcIiwgbnVtOiBcIjQ1XCIsIHRleHQ6IFwiICBpZiAoIXNlc3Npb24pIHJldHVybiBjLnJlZGlyZWN0KCcvbG9naW4nKVwiIH0sXG4gICAgXSxcbiAgfSxcbiAge1xuICAgIHR5cGU6IFwicGVybWlzc2lvblwiLFxuICAgIGZpbGU6IFwiYXV0aC50c1wiLFxuICAgIG9wdGlvbnM6IFtcbiAgICAgIFwiMS4gWWVzXCIsXG4gICAgICBcIjIuIFllcywgYWxsb3cgYWxsIGVkaXRzIGR1cmluZyB0aGlzIHNlc3Npb24gKHNoaWZ0K3RhYilcIixcbiAgICAgIFwiMy4gTm8sIGFuZCB0ZWxsIENsYXVkZSB3aGF0IHRvIGRvIGRpZmZlcmVudGx5IChlc2MpXCIsXG4gICAgXSxcbiAgfSxcbiAge1xuICAgIHR5cGU6IFwic3Bpbm5lclwiLFxuICAgIHZlcmJzOiBbXCJQZXJjb2xhdGluZ+KAplwiLCBcIkNvZ2l0YXRpbmfigKZcIiwgXCJTaW1tZXJpbmfigKZcIiwgXCJSdW1pbmF0aW5n4oCmXCIsIFwiTm9vZGxpbmfigKZcIiwgXCJNYXJpbmF0aW5n4oCmXCJdLFxuICAgIHRva2VuczogXCLihpEgMy40ayB0b2tlbnNcIixcbiAgICBzZWNvbmRzOiAyLjMsXG4gIH0sXG5dO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmU8Q2xhdWRlQ29kZURhdGE+KHtcbiAgc2FtcGxlOiB7XG4gICAgd2luZG93VGl0bGU6IFwiZm94QGhvbWVzdGVhZDogfi9jb2RlL2d1bWJvIOKAlCBjbGF1ZGVcIixcbiAgICB2ZXJzaW9uOiBcIjIuMS40XCIsXG4gICAgY3dkOiBcIi9Vc2Vycy9mb3gvY29kZS9ndW1ib1wiLFxuICAgIHRpcDogXCJVc2UgIyB0byBtZW1vcml6ZSBzaG9ydGN1dHMgYW5kIHByZWZlcmVuY2VzIGluIENMQVVERS5tZFwiLFxuICAgIHByb21wdDogXCJyZWZhY3RvciB0aGUgYXV0aCBtaWRkbGV3YXJlIHRvIHVzZSB0aGUgbmV3IHNlc3Npb24gc3RvcmVcIixcbiAgICBpbnB1dFBsYWNlaG9sZGVyOiAnVHJ5IFwicnVuIHRoZSBhdXRoIHRlc3RzIGFuZCBmaXggd2hhdCBicmVha3NcIicsXG4gICAgc3RhdHVzTGVmdDogXCI/IGZvciBzaG9ydGN1dHNcIixcbiAgICBzdGF0dXNSaWdodDogXCLij7Xij7UgYWNjZXB0IGVkaXRzIG9uIMK3IE9wdXMgNC44IMK3IDQxJSBjb250ZXh0IGxlZnRcIixcbiAgICBldmVudHM6IFNBTVBMRV9FVkVOVFMsXG4gIH0sXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIC8vIEZhbGxiYWNrIGZvciBBU1QgZGlzY292ZXJ5IChtdXN0IGxvb2sgYW5pbWF0ZWQpLiByZXNvbHZlKCkgb3ZlcnJpZGVzIHBlciBldmVudHNbXS5cbiAgICBkdXJhdGlvbjogXCIxNHNcIixcbiAgfSxcbiAgcmVzb2x2ZSh7IGRhdGEgfSkge1xuICAgIGNvbnN0IHsgdG90YWxTZWNvbmRzLCBwaGFzZXMgfSA9IGJ1aWxkVGltZWxpbmUoZGF0YSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGR1cmF0aW9uOiBgJHt0b3RhbFNlY29uZHN9c2AsXG4gICAgICBwaGFzZXMsXG4gICAgfTtcbiAgfSxcbiAgcmVuZGVyKGN0eDogUmVuZGVyQ29udGV4dDxDbGF1ZGVDb2RlRGF0YT4pIHtcbiAgICBjb25zdCB7IHN0ZCwgd2lkdGgsIGhlaWdodCwgZGF0YSwgdGltZWxpbmUgfSA9IGN0eDtcbiAgICBjb25zdCB7IHBoYXNlcyB9ID0gYnVpbGRUaW1lbGluZShkYXRhKTtcbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHBoYXNlcyk7XG5cbiAgICBjb25zdCBmcyA9IDIzO1xuICAgIGNvbnN0IHNtYWxsID0gZnMgKiAwLjkyO1xuICAgIGNvbnN0IGNhcmRXID0gTWF0aC5taW4od2lkdGggLSAzNDAsIDE0NjApO1xuICAgIGNvbnN0IGNhcmRIID0gTWF0aC5taW4oaGVpZ2h0IC0gMTgwLCA4ODApO1xuXG4gICAgLy8gQ2FyZCBzZXR0bGVzIGZ1bGx5IGR1cmluZyBib290OyBubyB0cmFuc2NyaXB0IHVudGlsIHR5cGUgcGhhc2UgKGFmdGVyIGJvb3QpLlxuICAgIGNvbnN0IGludHJvID0gdC5tb3Rpb24oe1xuICAgICAgZHVyaW5nOiBcImJvb3RcIixcbiAgICAgIHk6IDIyLFxuICAgICAgc2NhbGU6IDAuOTkyLFxuICAgICAgYXQ6IFwiMHNcIixcbiAgICAgIGZvcjogXCI1NSVcIixcbiAgICAgIGV4aXQ6IGZhbHNlLFxuICAgICAgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiLFxuICAgIH0pO1xuICAgIGNvbnN0IHN1Ym1pdHRlZCA9IHQuaW4oXCJzdWJtaXRcIikgPiAwLjA1O1xuICAgIGNvbnN0IGJsaW5rID0gdGltZWxpbmUuc2Vjb25kcyAlIDEuMDYgPCAwLjUzID8gMSA6IDA7XG4gICAgLy8gSGlkZSBjb21wb3Nlci9zdGF0dXMgdW50aWwgdGhlIHdpbmRvdyBoYXMgc2V0dGxlZCAoYm9vdCDiiaUgNTUlKS5cbiAgICBjb25zdCBzZXR0bGVkID0gdC5pbihcImJvb3RcIikgPj0gMC41NSB8fCB0LmluKFwidHlwZVwiKSA+IDAgfHwgdC5pbihcInN1Ym1pdFwiKSA+IDA7XG5cbiAgICBjb25zdCBlbnRlcjogRW50ZXIgPSAocCkgPT4ge1xuICAgICAgY29uc3QgZSA9IHN0ZC5pbnRlcnBvbGF0ZShwLCBbMCwgMV0sIFswLCAxXSwgXCJlYXNlT3V0Q3ViaWNcIik7XG4gICAgICByZXR1cm4geyBwOiBlLCBzdHlsZTogYG9wYWNpdHk6JHtlfTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgkeygxIC0gZSkgKiAxMH1weCk7YCB9O1xuICAgIH07XG4gICAgY29uc3Qgd2luOiBXaW4gPSAocCwgc3RhcnQsIHNwYW4pID0+IHN0ZC5jbGFtcDAxKChwIC0gc3RhcnQpIC8gc3Bhbik7XG5cbiAgICBjb25zdCBib290UCA9IHQuaW4oXCJib290XCIpO1xuICAgIC8vIEJhbm5lci90aXAgb25seSBhZnRlciBjYXJkIGZhZGUtaW4gY29tcGxldGVzIChzZWNvbmQgaGFsZiBvZiBib290KS5cbiAgICBjb25zdCBiYW5uZXIgPSBlbnRlcih3aW4oYm9vdFAsIDAuNTgsIDAuMjIpKTtcbiAgICBjb25zdCB0aXAgPSBlbnRlcih3aW4oYm9vdFAsIDAuNzgsIDAuMTgpKTtcblxuICAgIGNvbnN0IHR5cGVkQ2hhcnMgPSBNYXRoLmZsb29yKHN0ZC5jbGFtcDAxKHQuaW4oXCJ0eXBlXCIpIC8gMC44OCkgKiBkYXRhLnByb21wdC5sZW5ndGgpO1xuICAgIGNvbnN0IGlucHV0VGV4dCA9IHN1Ym1pdHRlZCA/IFwiXCIgOiBlc2NhcGVIdG1sKGRhdGEucHJvbXB0LnNsaWNlKDAsIHR5cGVkQ2hhcnMpKTtcblxuICAgIGNvbnN0IHN1Ym1pdFAgPSB0LmluKFwic3VibWl0XCIpO1xuICAgIGNvbnN0IHByb21wdExpbmUgPSBlbnRlcih3aW4oc3VibWl0UCwgMCwgMC40KSk7XG5cbiAgICBjb25zdCBidWxsZXQgPSBgPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuYWNjZW50fTtcIj7ij7o8L3NwYW4+YDtcblxuICAgIGNvbnN0IGJhbm5lckh0bWwgPVxuICAgICAgYmFubmVyLnAgPiAwXG4gICAgICAgID8gYFxuICAgICAgPGRpdiBjbGFzcz1cImJsb2NrXCIgc3R5bGU9XCJib3JkZXI6MXB4IHNvbGlkICR7Qy5ib3JkZXJCcmlnaHR9O2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6JHtmcyAqIDAuMzV9cHggJHtmcyAqIDAuNTV9cHg7JHtiYW5uZXIuc3R5bGV9XCI+XG4gICAgICAgIDxkaXY+PHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuYWNjZW50fTtcIj7inLs8L3NwYW4+IFdlbGNvbWUgdG8gPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuYWNjZW50fTtcIj5DbGF1ZGUgQ29kZTwvc3Bhbj4gPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9O1wiPnYke2VzY2FwZUh0bWwoZGF0YS52ZXJzaW9uKX08L3NwYW4+PC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9O21hcmdpbi10b3A6JHtmcyAqIDAuMjZ9cHg7XCI+L2hlbHAgZm9yIGhlbHAsIC9zdGF0dXMgZm9yIHlvdXIgY3VycmVudCBzZXR1cDwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6JHtDLm11dGVkfTtcIj5jd2Q6ICR7ZXNjYXBlSHRtbChkYXRhLmN3ZCl9PC9kaXY+XG4gICAgICA8L2Rpdj5gXG4gICAgICAgIDogXCJcIjtcblxuICAgIGNvbnN0IHRpcEh0bWwgPVxuICAgICAgdGlwLnAgPiAwXG4gICAgICAgID8gYFxuICAgICAgPGRpdiBjbGFzcz1cImJsb2NrXCIgc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9OyR7dGlwLnN0eWxlfVwiPuKAuyBUaXA6ICR7ZXNjYXBlSHRtbChkYXRhLnRpcCl9PC9kaXY+YFxuICAgICAgICA6IFwiXCI7XG5cbiAgICBjb25zdCBwcm9tcHRIdG1sID1cbiAgICAgIHByb21wdExpbmUucCA+IDBcbiAgICAgICAgPyBgXG4gICAgICA8ZGl2IGNsYXNzPVwiYmxvY2tcIiBzdHlsZT1cIiR7cHJvbXB0TGluZS5zdHlsZX1cIj5cbiAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9O1wiPiZndDs8L3NwYW4+IDxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLnNvZnR9O1wiPiR7ZXNjYXBlSHRtbChkYXRhLnByb21wdCl9PC9zcGFuPlxuICAgICAgPC9kaXY+YFxuICAgICAgICA6IFwiXCI7XG5cbiAgICAvLyB0LmluKCkgaXMgMCBiZWZvcmUgYSBwaGFzZSwgMOKGkjEgZHVyaW5nLCBhbmQgc3RheXMgMSBhZnRlciDigJQgc3RhY2stbGlrZSBzdGF5LlxuICAgIGNvbnN0IGV2ZW50c0h0bWwgPSBkYXRhLmV2ZW50c1xuICAgICAgLm1hcCgoZXYsIGkpID0+IHtcbiAgICAgICAgY29uc3QgcCA9IHQuaW4oYGV2ZW50XyR7aX1gKTtcbiAgICAgICAgaWYgKHAgPD0gMCkgcmV0dXJuIFwiXCI7XG4gICAgICAgIHN3aXRjaCAoZXYudHlwZSkge1xuICAgICAgICAgIGNhc2UgXCJhc3Npc3RhbnRcIjpcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJBc3Npc3RhbnRFdmVudChwLCBldiwgYnVsbGV0LCB3aW4pO1xuICAgICAgICAgIGNhc2UgXCJ0b29sXCI6XG4gICAgICAgICAgICByZXR1cm4gcmVuZGVyVG9vbEV2ZW50KHAsIGV2LCBidWxsZXQsIGVudGVyLCB3aW4pO1xuICAgICAgICAgIGNhc2UgXCJ0b2Rvc1wiOlxuICAgICAgICAgICAgcmV0dXJuIHJlbmRlclRvZG9zRXZlbnQocCwgZXYsIGJ1bGxldCwgZW50ZXIsIHdpbik7XG4gICAgICAgICAgY2FzZSBcImVkaXRcIjpcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJFZGl0RXZlbnQocCwgZXYsIGJ1bGxldCwgZW50ZXIsIHdpbiwgZnMpO1xuICAgICAgICAgIGNhc2UgXCJwZXJtaXNzaW9uXCI6XG4gICAgICAgICAgICByZXR1cm4gcmVuZGVyUGVybWlzc2lvbkV2ZW50KHAsIGV2LCBlbnRlciwgd2luLCBmcyk7XG4gICAgICAgICAgY2FzZSBcInNwaW5uZXJcIjpcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJTcGlubmVyRXZlbnQocCwgZXYsIGVudGVyLCB3aW4sIHRpbWVsaW5lLnNlY29uZHMsIGVzdGltYXRlRXZlbnRTZWNvbmRzKGV2KSk7XG4gICAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgY29uc3QgX3g6IG5ldmVyID0gZXY7XG4gICAgICAgICAgICByZXR1cm4gX3g7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmpvaW4oXCJcIik7XG5cbiAgICBjb25zdCBzaG93UGxhY2Vob2xkZXIgPSBzdWJtaXR0ZWQgfHwgdHlwZWRDaGFycyA9PT0gMDtcbiAgICBjb25zdCBjdXJzb3JIdG1sID0gYDxzcGFuIHN0eWxlPVwiZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MC41NWVtO2hlaWdodDoxLjFlbTt2ZXJ0aWNhbC1hbGlnbjotMC4xOGVtO2JhY2tncm91bmQ6JHtDLnRleHR9O29wYWNpdHk6JHtibGlua307XCI+PC9zcGFuPmA7XG4gICAgY29uc3QgY29tcG9zZXJIdG1sID0gYFxuICAgICAgPGRpdiBzdHlsZT1cImJvcmRlcjoxcHggc29saWQgJHtDLmJvcmRlckJyaWdodH07Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzoke2ZzICogMC4yMn1weCAke2ZzICogMC41NX1weDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoke2ZzICogMC4zNn1weDtcIj5cbiAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuYWNjZW50fTtcIj4mZ3Q7PC9zcGFuPlxuICAgICAgICA8c3Bhbj4ke2lucHV0VGV4dH08L3NwYW4+JHtjdXJzb3JIdG1sfVxuICAgICAgICAke3Nob3dQbGFjZWhvbGRlciA/IGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5kaW19O1wiPiR7ZXNjYXBlSHRtbChkYXRhLmlucHV0UGxhY2Vob2xkZXIpfTwvc3Bhbj5gIDogXCJcIn1cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2Vlbjtjb2xvcjoke0MuZGltfTtmb250LXNpemU6JHtzbWFsbH1weDtwYWRkaW5nOiR7ZnMgKiAwLjE4fXB4ICR7ZnMgKiAwLjJ9cHggMDtcIj5cbiAgICAgICAgPHNwYW4+JHtlc2NhcGVIdG1sKGRhdGEuc3RhdHVzTGVmdCl9PC9zcGFuPlxuICAgICAgICA8c3Bhbj4ke2VzY2FwZUh0bWwoZGF0YS5zdGF0dXNSaWdodCl9PC9zcGFuPlxuICAgICAgPC9kaXY+YDtcblxuICAgIHJldHVybiBgXG4gICAgICA8c3R5bGU+XG4gICAgICAgICogeyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgICAgIC5tb25vIHtcbiAgICAgICAgICBmb250LWZhbWlseTogJ1NGIE1vbm8nLCB1aS1tb25vc3BhY2UsIE1lbmxvLCBDb25zb2xhcywgJ0RlamFWdSBTYW5zIE1vbm8nLCBtb25vc3BhY2U7XG4gICAgICAgICAgZm9udC12YXJpYW50LWxpZ2F0dXJlczogbm9uZTtcbiAgICAgICAgICAtd2Via2l0LWZvbnQtc21vb3RoaW5nOiBhbnRpYWxpYXNlZDtcbiAgICAgICAgfVxuICAgICAgICAuYmxvY2sgeyBtYXJnaW4tYm90dG9tOiAke2ZzICogMC41fXB4OyB9XG4gICAgICAgIC5ibG9jay50aWdodCB7IG1hcmdpbi1ib3R0b206ICR7ZnMgKiAwLjF9cHg7IH1cbiAgICAgIDwvc3R5bGU+XG4gICAgICA8ZGl2IGNsYXNzPVwibW9ub1wiIHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgd2lkdGgsXG4gICAgICAgIGhlaWdodCxcbiAgICAgICAgYmFja2dyb3VuZDogYHJhZGlhbC1ncmFkaWVudCgxMjAlIDEyMCUgYXQgNTAlIDAlLCAjMWExODE1IDAlLCAke0MucGFnZX0gNjIlKWAsXG4gICAgICAgIGNvbG9yOiBDLnRleHQsXG4gICAgICAgIGZvbnRTaXplOiBmcyxcbiAgICAgICAgbGluZUhlaWdodDogMS42NSxcbiAgICAgIH0sIHN0ZC5jc3MuY2VudGVyKCkpfVwiPlxuICAgICAgICA8bWFpbiBzdHlsZT1cIlxuICAgICAgICAgIHdpZHRoOiR7Y2FyZFd9cHg7XG4gICAgICAgICAgaGVpZ2h0OiR7Y2FyZEh9cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDoke0MudGVybWluYWx9O1xuICAgICAgICAgIGJvcmRlcjoxcHggc29saWQgJHtDLmJvcmRlcn07XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czoxMHB4O1xuICAgICAgICAgIG92ZXJmbG93OmhpZGRlbjtcbiAgICAgICAgICBkaXNwbGF5OmZsZXg7XG4gICAgICAgICAgZmxleC1kaXJlY3Rpb246Y29sdW1uO1xuICAgICAgICAgIGJveC1zaGFkb3c6MCAzMHB4IDkwcHggcmdiYSgwLDAsMCwwLjU1KTtcbiAgICAgICAgICBvcGFjaXR5OiR7aW50cm8ub3BhY2l0eX07XG4gICAgICAgICAgJHtpbnRyby5zdHlsZX1cbiAgICAgICAgXCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIlxuICAgICAgICAgICAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6JHtmcyAqIDAuMzZ9cHg7XG4gICAgICAgICAgICBwYWRkaW5nOiR7ZnMgKiAwLjM0fXB4ICR7ZnMgKiAwLjU1fXB4O1xuICAgICAgICAgICAgYmFja2dyb3VuZDoke0MuY2hyb21lfTtib3JkZXItYm90dG9tOjFweCBzb2xpZCAke0MuYm9yZGVyfTtcbiAgICAgICAgICAgIGZsZXg6bm9uZTtcbiAgICAgICAgICBcIj5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwid2lkdGg6JHtmcyAqIDAuNDh9cHg7aGVpZ2h0OiR7ZnMgKiAwLjQ4fXB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6JHtDLnRyYWZmaWNSZWR9O1wiPjwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwid2lkdGg6JHtmcyAqIDAuNDh9cHg7aGVpZ2h0OiR7ZnMgKiAwLjQ4fXB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6JHtDLnRyYWZmaWNZZWxsb3d9O1wiPjwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwid2lkdGg6JHtmcyAqIDAuNDh9cHg7aGVpZ2h0OiR7ZnMgKiAwLjQ4fXB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6JHtDLnRyYWZmaWNHcmVlbn07XCI+PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJtYXJnaW4tbGVmdDoke2ZzICogMC4zNn1weDtjb2xvcjoke0MubXV0ZWR9O2ZvbnQtc2l6ZToke3NtYWxsfXB4O1wiPiR7ZXNjYXBlSHRtbChkYXRhLndpbmRvd1RpdGxlKX08L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICBmbGV4OjE7bWluLWhlaWdodDowO1xuICAgICAgICAgICAgcGFkZGluZzoke2ZzICogMC42fXB4ICR7ZnMgKiAwLjd9cHggMDtcbiAgICAgICAgICAgIGRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47anVzdGlmeS1jb250ZW50OmZsZXgtZW5kO1xuICAgICAgICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgICAgIFwiPlxuICAgICAgICAgICAgJHtiYW5uZXJIdG1sfVxuICAgICAgICAgICAgJHt0aXBIdG1sfVxuICAgICAgICAgICAgJHtwcm9tcHRIdG1sfVxuICAgICAgICAgICAgJHtldmVudHNIdG1sfVxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXg6bm9uZTtwYWRkaW5nOiR7ZnMgKiAwLjJ9cHggJHtmcyAqIDAuN31weCAke2ZzICogMC41fXB4O29wYWNpdHk6JHtzZXR0bGVkID8gMSA6IDB9O1wiPlxuICAgICAgICAgICAgJHtjb21wb3Nlckh0bWx9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvbWFpbj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gIH0sXG59KTtc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