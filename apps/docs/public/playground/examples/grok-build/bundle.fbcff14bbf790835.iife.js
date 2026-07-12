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
	//#region examples/interfaces/grok-build/grok-build.media.ts
	const C = {
		page: "#000000",
		chrome: "#0c0c0c",
		border: "#2a2a2a",
		borderSoft: "#1e1e1e",
		text: "#e9e9e9",
		soft: "#9c9c9c",
		muted: "#6e6e6e",
		dim: "#3f3f3f",
		done: "#5f5f5f",
		traffic: "#3a3a3a"
	};
	const SPIN = [
		"◐",
		"◓",
		"◑",
		"◒"
	];
	const BAR_WIDTH = 34;
	function escapeHtml(value) {
		return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
	//#endregion
	exports.default = define({
		sample: {
			workspace: "projects/main · gumbo/src",
			prompt: "Migrate auth from sessions to JWT with token rotation.",
			thoughtSeconds: 3.4,
			planTitle: "plan.md",
			planLines: [
				{
					num: "1",
					text: "Bottom line",
					tone: "heading"
				},
				{
					num: "2",
					text: "Swap legacy sessions for JWT + rotation, behind a flag with 7d compat.",
					tone: "body"
				},
				{
					num: "3",
					text: "",
					tone: "blank"
				},
				{
					num: "4",
					text: "Approach",
					tone: "heading"
				},
				{
					num: "5",
					text: "• Add jwtVerify helper in src/lib/jwt.ts.",
					tone: "body"
				},
				{
					num: "6",
					text: "• Add /auth/refresh with rotating refresh tokens.",
					tone: "body"
				},
				{
					num: "7",
					text: "• Replace session check in authMiddleware.",
					tone: "body"
				}
			],
			hotkeys: [
				{
					key: "a",
					label: "pprove"
				},
				{
					key: "c",
					label: "omment"
				},
				{
					key: "q",
					label: "uit plan"
				}
			],
			subagents: [
				{
					label: "Explore session middleware",
					role: "explore",
					status: "running"
				},
				{
					label: "Explore token storage",
					role: "explore",
					status: "running"
				},
				{
					label: "Draft jwt.ts helper",
					role: "build",
					status: "running"
				},
				{
					label: "Audit refresh endpoints",
					role: "review",
					status: "running"
				},
				{
					label: "Map auth call sites",
					role: "explore",
					status: "done"
				},
				{
					label: "Read AGENTS.md",
					role: "explore",
					status: "done"
				}
			],
			model: "grok-4.5",
			modes: {
				idle: "ask",
				afterApprove: "build"
			}
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "13s"
		},
		render(ctx) {
			const { std, width, height, data, timeline } = ctx;
			const t = ctx.director({
				boot: "8%",
				prompt: "10%",
				think: "10%",
				plan: "22%",
				agents: "20%",
				progress: "15%",
				approve: "10%",
				hold: "5%"
			});
			const fs = 20;
			const small = fs * .9;
			const cardW = Math.min(width - 280, 1280);
			const cardH = Math.min(height - 140, 900);
			const enter = (p) => {
				const e = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
				return {
					p: e,
					style: `opacity:${e};transform:translateY(${(1 - e) * 10}px);`
				};
			};
			const win = (p, start, span) => std.clamp01((p - start) / span);
			const intro = t.motion({
				during: "boot",
				y: 20,
				scale: .992,
				exit: false
			});
			const blink = timeline.seconds % 1.06 < .53 ? 1 : 0;
			const spinGlyph = SPIN[Math.floor(timeline.seconds / .18) % SPIN.length];
			const promptP = t.in("prompt");
			const typedChars = Math.floor(std.clamp01(promptP / .88) * data.prompt.length);
			const promptDone = promptP >= .88 || t.in("think") > 0;
			const promptText = escapeHtml(promptDone ? data.prompt : data.prompt.slice(0, typedChars));
			const promptVisible = t.in("boot") > .4 || promptP > 0;
			const thinkP = t.in("think");
			const thinkEnter = enter(win(thinkP, 0, .35));
			const thoughtVal = thinkP > 0 ? Math.min(data.thoughtSeconds, thinkP * data.thoughtSeconds * 1.15) : 0;
			const thoughtShown = t.in("plan") > 0 || t.in("agents") > 0 || t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0 ? data.thoughtSeconds : thoughtVal;
			const planP = t.in("plan");
			const planHead = enter(win(planP, 0, .18));
			const planLinesHtml = data.planLines.map((line, i) => {
				const row = enter(win(planP, .12 + i * .08, .14));
				if (row.p <= 0) return "";
				const fg = line.tone === "heading" ? C.text : line.tone === "body" ? C.soft : C.dim;
				return `<div style="${row.style}"><span style="color:${C.dim};display:inline-block;width:28px;">${escapeHtml(line.num)}</span><span style="color:${fg};">${escapeHtml(line.text)}</span></div>`;
			}).join("");
			const hotkeysEnter = enter(win(planP, .72, .2));
			const approveActive = t.in("approve") > .35 || t.in("hold") > 0;
			const hotkeysHtml = data.hotkeys.map((hk) => {
				const isApprove = hk.key === "a" && approveActive;
				const keyColor = isApprove ? C.text : C.text;
				const labelColor = isApprove ? C.text : C.muted;
				return `<span style="padding:1px 8px 1px 0;border-radius:2px;background:${isApprove ? "rgba(233,233,233,0.08)" : "transparent"};"><span style="color:${keyColor};">[${escapeHtml(hk.key)}]</span><span style="color:${labelColor};">${escapeHtml(hk.label)}</span></span>`;
			}).join("");
			const agentsP = t.in("agents");
			const agentsHead = enter(win(agentsP, 0, .15));
			const runningCount = data.subagents.filter((s) => s.status === "running").length;
			const doneCount = data.subagents.filter((s) => s.status === "done").length;
			const agentsHtml = data.subagents.map((agent, i) => {
				const row = enter(win(agentsP, .1 + i * .07, .14));
				if (row.p <= 0) return "";
				const flipDone = agent.status === "running" && i < 2 && win(agentsP, .55 + i * .12, .15) >= 1;
				const isDone = agent.status === "done" || flipDone;
				const icon = isDone ? `<span style="color:${C.done};">✓</span>` : `<span style="color:${C.text};">${spinGlyph}</span>`;
				const labelColor = isDone ? C.done : C.soft;
				return `<div style="${row.style}">${icon} <span style="color:${labelColor};">${escapeHtml(agent.label)}</span> <span style="color:${C.dim};">${escapeHtml(agent.role)}</span></div>`;
			}).join("");
			const liveRunning = Math.max(0, runningCount - (win(agentsP, .55, .15) >= 1 ? 1 : 0) - (win(agentsP, .67, .15) >= 1 ? 1 : 0));
			const liveDone = doneCount + (runningCount - liveRunning);
			const pctBase = 8.45;
			const pctEnd = 72.4;
			const progressLocal = t.in("hold") > 0 || t.in("approve") > 0 ? 1 : t.in("progress") > 0 ? t.in("progress") : t.in("agents") > .7 ? win(t.in("agents"), .7, .3) * .08 : 0;
			const pct = progressLocal <= 0 ? pctBase : pctBase + (pctEnd - pctBase) * std.interpolate(Math.min(1, progressLocal), [0, 1], [0, 1], "linear");
			const filled = Math.round(pct / 100 * BAR_WIDTH);
			const bar = "█".repeat(Math.max(0, filled)) + " ".repeat(Math.max(0, BAR_WIDTH - filled));
			const turnBase = 12.4;
			const tokBase = 41.2;
			const workClock = Math.max(0, t.in("agents") * .4 + t.in("progress") * .5 + t.in("approve") * .2 + t.in("hold") * .1);
			const turnSec = turnBase + workClock * 18;
			const tokens = tokBase + workClock * 12;
			const mode = approveActive || t.in("hold") > 0 ? data.modes.afterApprove : data.modes.idle;
			const thoughtHtml = thinkEnter.p > 0 || t.in("plan") > 0 ? `<div style="color:${C.muted};margin-bottom:${fs * .55}px;${thinkEnter.p > 0 && t.in("plan") <= 0 ? thinkEnter.style : ""}">◆ Thought for ${thoughtShown.toFixed(1)}s</div>` : "";
			const planHtml = planHead.p > 0 || t.in("agents") > 0 || t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0 ? `
      <div style="margin-bottom:${fs * .55}px;${planHead.p < 1 && t.in("agents") <= 0 ? planHead.style : ""}">
        <div style="display:flex;align-items:center;color:${C.dim};overflow:hidden;white-space:nowrap;">
          <span style="flex:1;overflow:hidden;">────────────────────────────────────────────</span>
          <span style="color:${C.text};padding:0 8px;">${escapeHtml(data.planTitle)}</span>
          <span style="flex:1;overflow:hidden;text-align:right;">────────────────────────────────────────────</span>
          <span style="color:${C.muted};padding-left:10px;">×</span>
        </div>
        <div style="padding:8px 0 4px;">${planLinesHtml}</div>
        <div style="color:${C.dim};overflow:hidden;white-space:nowrap;">──────────────────────────────────────────────────────────────────────────────────────────────────</div>
        <div style="padding-top:6px;${hotkeysEnter.p < 1 && t.in("agents") <= 0 ? hotkeysEnter.style : ""}">${hotkeysHtml}</div>
      </div>` : "";
			const agentsBlock = agentsHead.p > 0 || t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0 ? `
      <div style="border:0.5px solid ${C.borderSoft};border-radius:3px;padding:8px 12px;margin-bottom:${fs * .55}px;${agentsHead.p < 1 && t.in("progress") <= 0 ? agentsHead.style : ""}">
        <div style="color:${C.muted};margin-bottom:6px;">subagents <span style="color:${C.dim};">— ${liveRunning} running, ${liveDone} done</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;">${agentsHtml}</div>
      </div>` : "";
			const progressOpacity = t.in("progress") > 0 || t.in("approve") > 0 || t.in("hold") > 0 ? 1 : t.in("agents") > .7 ? win(t.in("agents"), .7, .3) : 0;
			const cursorHtml = `<span style="background:${C.text};width:7px;height:${fs * .85}px;display:inline-block;vertical-align:-2px;opacity:${blink};"></span>`;
			return `
      <style>
        * { box-sizing: border-box; margin: 0; }
        .mono {
          font-family: 'SF Mono', ui-monospace, Menlo, Consolas, 'DejaVu Sans Mono', monospace;
          font-variant-ligatures: none;
          -webkit-font-smoothing: antialiased;
        }
      </style>
      <div class="mono" style="${std.css({
				width,
				height,
				background: C.page,
				color: C.text,
				fontSize: fs,
				lineHeight: 1.65
			}, std.css.center())}">
        <main style="
          width:${cardW}px;
          height:${cardH}px;
          background:${C.page};
          border:0.5px solid ${C.border};
          border-radius:8px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          box-shadow:0 28px 80px rgba(0,0,0,0.65);
          opacity:${intro.opacity};
          ${intro.style}
        ">
          <div style="
            display:flex;align-items:center;gap:10px;
            padding:10px 14px;
            background:${C.chrome};border-bottom:0.5px solid ${C.border};
            flex:none;
          ">
            <span style="width:12px;height:12px;border-radius:50%;background:${C.traffic};"></span>
            <span style="width:12px;height:12px;border-radius:50%;background:${C.traffic};"></span>
            <span style="width:12px;height:12px;border-radius:50%;background:${C.traffic};"></span>
            <span style="margin-left:8px;color:${C.muted};font-size:${small}px;">grok</span>
          </div>

          <div style="
            flex:1;min-height:0;
            padding:14px 18px;
            display:flex;flex-direction:column;
            overflow:hidden;
          ">
            <div style="display:flex;justify-content:space-between;color:${C.muted};border-bottom:0.5px solid ${C.borderSoft};padding-bottom:8px;margin-bottom:12px;font-size:${small}px;">
              <span>${escapeHtml(data.workspace).split(" · ").join(` <span style="color:${C.dim};">·</span> `)}</span>
              <span>[turn: ${turnSec.toFixed(1)}s, ↓${tokens.toFixed(1)}k] <span style="color:${C.dim};">[×]</span></span>
            </div>

            ${promptVisible ? `<div style="margin-bottom:10px;"><span style="color:${C.text};">❯</span> <span style="color:${C.soft};">${promptText}</span>${!promptDone ? cursorHtml : ""}</div>` : ""}

            ${thoughtHtml}
            ${planHtml}
            ${agentsBlock}

            <div style="flex:1;"></div>

            <div style="display:flex;align-items:center;color:${C.muted};margin-bottom:8px;opacity:${progressOpacity};font-size:${small}px;white-space:pre;">
              <span>|</span><span style="color:${C.soft};">${bar}</span><span> ${pct.toFixed(2)}%</span><span>|</span>
            </div>

            <div style="border-top:0.5px solid ${C.borderSoft};padding-top:8px;display:flex;align-items:center;gap:8px;">
              <span style="color:${C.text};">❯</span>
              ${cursorHtml}
              <span style="flex:1;"></span>
              <span style="color:${C.muted};font-size:${small}px;">${escapeHtml(data.model)} <span style="color:${C.dim};">·</span> ${escapeHtml(mode)}</span>
            </div>
          </div>
        </main>
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3Jvay1idWlsZC5tZWRpYS5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9zdXBlcmltZy10eXBlcy9kaXN0L2luZGV4LmpzIiwiLi4vZXhhbXBsZXMvaW50ZXJmYWNlcy9ncm9rLWJ1aWxkL2dyb2stYnVpbGQubWVkaWEudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy9qc29uLnRzXG4vLyEgU2VyaWFsaXphYmxlIEpTT04tc2hhcGVkIHZhbHVlcyBmb3IgdGVtcGxhdGUgZGF0YSBkZWZhdWx0cyBhbmQgQ0xJIGxvYWRlcnMuXG5mdW5jdGlvbiBpc0pzb25PYmplY3QodmFsdWUpIHtcblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvdHlwZXMudHNcbi8vISBTdXBlckltZyBUeXBlcyAtIENvcmUgdHlwZSBkZWZpbml0aW9uc1xuLy8hIEV4cGxpY2l0LCB0eXBlZCwgc2VsZi1kb2N1bWVudGluZyBpbnRlcmZhY2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vKipcbiogRGVmaW5lIGEgcHJvamVjdC9mb2xkZXIgY29uZmlnIGZvciBfY29uZmlnLnRzIGZpbGVzLlxuKiBQcm92aWRlcyB0eXBlIGluZmVyZW5jZSBhbmQgdmFsaWRhdGlvbi5cbiovXG5mdW5jdGlvbiBkZWZpbmVDb25maWcoY29uZmlnKSB7XG5cdHJldHVybiBjb25maWc7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvZGVmaW5lLnRzXG4vLyEgVGhlIHVuaWZpZWQgYGRlZmluZSgpYCB0ZW1wbGF0ZSBmYWN0b3J5LlxuLy8hXG4vLyEgVW5pZmllZCB0ZW1wbGF0ZSBmYWN0b3J5IOKAlCBvbmUgYGRlZmluZSgpYCBmb3IgYWxsIG91dHB1dCBraW5kcy5cbi8vISBUaHJlZSBvcnRob2dvbmFsIGF4ZXMgc2VsZWN0IGJlaGF2aW91cjpcbi8vISAgLSBtZWRpdW06ICAgXCJodG1sXCIgKENocm9taXVtKSB8IFwic3ZnXCIgKHJlc3ZnLXdhc20sIGJyb3dzZXItZnJlZSwgZWRnZSkuXG4vLyEgIC0gYW5pbWF0ZWQ6IGluZmVycmVkIGZyb20gdGhlIGNvbmZpZyDigJQgdHJ1ZSBpZmYgaXQgZGVjbGFyZXMgZnBzIEFORFxuLy8hICAgICAgICAgICAgICAoZHVyYXRpb24gT1IgYSBgcmVzb2x2ZWAgaG9vayB0aGF0IHdpbGwgc3VwcGx5IGR1cmF0aW9uKS5cbi8vISAgLSBzaW5rOiAgICAgY2hvc2VuIGxhdGVyIChjb25maWcub3V0cHV0cyAvIENMSSAvIGBhc2ApLCBub3QgYXQgYXV0aG9yaW5nIHRpbWUuXG4vLyFcbi8vISBUeXBlU2NyaXB0IG5hcnJvd3MgYGN0eGAgdG8gdGhlIHJpZ2h0IHZhcmlhbnQgYXQgdGhlIGNhbGwgc2l0ZSB2aWEgb3ZlcmxvYWRzOlxuLy8hIG1lZGl1bSBwaWNrcyB0aGUgc3RkbGliIGZsYXZvdXIsIGFuaW1hdGVkIGFkZHMgdGhlIHRlbXBvcmFsIGZpZWxkcyArIGhlbHBlcnMuXG5mdW5jdGlvbiBkZWZpbmUoaW5wdXQpIHtcblx0Y29uc3QgbWVkaXVtID0gaW5wdXQubWVkaXVtID8/IFwiaHRtbFwiO1xuXHRjb25zdCBjID0gaW5wdXQuY29uZmlnO1xuXHRjb25zdCBoYXNSZXNvbHZlID0gdHlwZW9mIGlucHV0LnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIjtcblx0cmV0dXJuIHtcblx0XHRtZWRpdW0sXG5cdFx0YW5pbWF0ZWQ6ICEhYyAmJiB0eXBlb2YgYy5mcHMgPT09IFwibnVtYmVyXCIgJiYgKGMuZHVyYXRpb24gIT0gbnVsbCB8fCBoYXNSZXNvbHZlKSxcblx0XHRyZW5kZXI6IGlucHV0LnJlbmRlcixcblx0XHQuLi5pbnB1dC5jb25maWcgIT09IHZvaWQgMCA/IHsgY29uZmlnOiBpbnB1dC5jb25maWcgfSA6IHt9LFxuXHRcdC4uLmlucHV0LnNhbXBsZSAhPT0gdm9pZCAwID8geyBzYW1wbGU6IGlucHV0LnNhbXBsZSB9IDoge30sXG5cdFx0Li4uaGFzUmVzb2x2ZSA/IHsgcmVzb2x2ZTogaW5wdXQucmVzb2x2ZSB9IDoge31cblx0fTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gYW5pbWF0ZWQgKGZwcyArIGR1cmF0aW9uIGF0IGF1dGhvcmluZyB0aW1lKS4gKi9cbmZ1bmN0aW9uIGlzQW5pbWF0ZWRUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IHRydWU7XG59XG4vKiogTmFycm93IGEgdGVtcGxhdGUgbW9kdWxlIHRvIHN0YXRpYyAoc3RpbGwgLyBzaW5nbGUtZnJhbWUpLiAqL1xuZnVuY3Rpb24gaXNTdGF0aWNUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IGZhbHNlO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3Jlc3VsdHMudHNcbi8vISBSZXN1bHQgdHlwZXMgYW5kIHN0cnVjdHVyZWQgZXJyb3JzXG4vLyEgRGlzY3JpbWluYXRlZCB1bmlvbnMgZm9yIGFzeW5jIG9wZXJhdGlvbnMgd2l0aCBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2VzXG4vKipcbiogQmFzZSBlcnJvciBjbGFzcyBmb3IgYWxsIFN1cGVySW1nIGVycm9yc1xuKi9cbnZhciBTdXBlckltZ0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG5cdGNvZGU7XG5cdGRldGFpbHM7XG5cdHN1Z2dlc3Rpb247XG5cdGRvY3NVcmw7XG5cdC8qKiBNYXBwZWQgc291cmNlIGxvY2F0aW9uIChwb3B1bGF0ZWQgYnkgZW5yaWNoRXJyb3Igd2hlbiBzb3VyY2VtYXAgYXZhaWxhYmxlKSAqL1xuXHRsb2NhdGlvbjtcblx0LyoqIFZpdGUtc3R5bGUgY29kZSBmcmFtZSBzdHJpbmcgKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZSBjb250ZW50IGF2YWlsYWJsZSkgKi9cblx0Y29kZUZyYW1lO1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlLCBjb2RlLCBkZXRhaWxzLCBzdWdnZXN0aW9uLCBkb2NzVXJsKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5jb2RlID0gY29kZTtcblx0XHR0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuXHRcdHRoaXMuc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb247XG5cdFx0dGhpcy5kb2NzVXJsID0gZG9jc1VybDtcblx0XHR0aGlzLm5hbWUgPSBcIlN1cGVySW1nRXJyb3JcIjtcblx0XHRjb25zdCBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlO1xuXHRcdGlmIChjYXB0dXJlU3RhY2tUcmFjZSkgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdH1cblx0LyoqIENvbnZlcnQgdG8gYSBwbGFpbiBvYmplY3QgZm9yIGxvZ2dpbmcvc2VyaWFsaXphdGlvbiAqL1xuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdGNvZGU6IHRoaXMuY29kZSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMubWVzc2FnZSxcblx0XHRcdGRldGFpbHM6IHRoaXMuZGV0YWlscyxcblx0XHRcdHN1Z2dlc3Rpb246IHRoaXMuc3VnZ2VzdGlvbixcblx0XHRcdC4uLnRoaXMuZG9jc1VybCAhPT0gdm9pZCAwID8geyBkb2NzVXJsOiB0aGlzLmRvY3NVcmwgfSA6IHt9LFxuXHRcdFx0Li4udGhpcy5sb2NhdGlvbiAhPT0gdm9pZCAwID8geyBsb2NhdGlvbjogdGhpcy5sb2NhdGlvbiB9IDoge30sXG5cdFx0XHQuLi50aGlzLmNvZGVGcmFtZSAhPT0gdm9pZCAwID8geyBjb2RlRnJhbWU6IHRoaXMuY29kZUZyYW1lIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkXG4qL1xudmFyIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IGRldGFpbHMubGluZSA/IGAgYXQgbGluZSAke2RldGFpbHMubGluZX1gIDogXCJcIjtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBDaGVjayB0aGUgdGVtcGxhdGUgc3ludGF4JHtsb2NhdGlvbn0uIEVuc3VyZSB0aGUgcmVuZGVyIGZ1bmN0aW9uIHJldHVybnMgYSBzdHJpbmcuYDtcblx0XHRzdXBlcihgVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkJHtsb2NhdGlvbn06ICR7ZGV0YWlscy5zeW50YXhFcnJvcn1gLCBcIlRFTVBMQVRFX0NPTVBJTEFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlQ29tcGlsYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgdGhyZXcgYW4gZXJyb3IgZHVyaW5nIHJlbmRlclxuKi9cbnZhciBUZW1wbGF0ZVJ1bnRpbWVFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCB0aW1lSW5mbyA9IGRldGFpbHMudGltZUNvbnRleHQgPyBgICgke2RldGFpbHMudGltZUNvbnRleHQudGltZWxpbmVTZWNvbmRzLnRvRml4ZWQoMyl9cywgJHsoZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVByb2dyZXNzICogMTAwKS50b0ZpeGVkKDEpfSUgcHJvZ3Jlc3MpYCA6IFwiXCI7XG5cdFx0c3VwZXIoYFRlbXBsYXRlIGVycm9yIGF0IGZyYW1lICR7ZGV0YWlscy5mcmFtZX0ke3RpbWVJbmZvfTogJHtkZXRhaWxzLm9yaWdpbmFsRXJyb3J9YCwgXCJURU1QTEFURV9SVU5USU1FX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBgVGhlIHJlbmRlciBmdW5jdGlvbiB0aHJldyBhbiBlcnJvci4gQ2hlY2sgdGhhdCBhbGwgZGF0YSBwcm9wZXJ0aWVzIGV4aXN0IGFuZCB2YWx1ZXMgYXJlbid0IE5hTi91bmRlZmluZWQgYXQgdGhpcyBwb2ludCBpbiB0aGUgdGltZWxpbmUuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlcyNkZWJ1Z2dpbmdcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJUZW1wbGF0ZVJ1bnRpbWVFcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogRGF0YSB2YWxpZGF0aW9uIGZhaWxlZFxuKi9cbnZhciBWYWxpZGF0aW9uRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBgRXhwZWN0ZWQgJHtkZXRhaWxzLmV4cGVjdGVkVHlwZX0gYnV0IHJlY2VpdmVkICR7dHlwZW9mIGRldGFpbHMucmVjZWl2ZWRWYWx1ZX0uIENoZWNrIHlvdXIgZGF0YSBvYmplY3QuYDtcblx0XHRzdXBlcihgVmFsaWRhdGlvbiBmYWlsZWQgZm9yIGZpZWxkIFwiJHtkZXRhaWxzLmZpZWxkfVwiYCwgXCJWQUxJREFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlZhbGlkYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogUmVuZGVyIGZhaWxlZCAoZW5jb2RpbmcsIGJyb3dzZXIsIGV0Yy4pXG4qL1xudmFyIFJlbmRlckVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gZGV0YWlscy5odG1sRXJyb3IgPyBgVGhlIHRlbXBsYXRlIHJldHVybmVkIGludmFsaWQgSFRNTC4gQ2hlY2sgeW91ciByZW5kZXIgZnVuY3Rpb24gb3V0cHV0LmAgOiBkZXRhaWxzLmVuY29kZXJFcnJvciA/IGBFbmNvZGVyIGVycm9yLiBUcnkgcmVkdWNpbmcgcmVzb2x1dGlvbiBvciBjaGFuZ2luZyBjb2RlYy5gIDogYEJyb3dzZXIgZXJyb3IuIENoZWNrIGZvciBicm93c2VyIGNvbXBhdGliaWxpdHkgaXNzdWVzLmA7XG5cdFx0c3VwZXIoYFJlbmRlciBmYWlsZWQgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfWAsIFwiUkVOREVSX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlJlbmRlckVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBGaWxlIEkvTyBlcnJvclxuKi9cbnZhciBJT0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdHN1cGVyKGBGYWlsZWQgdG8gJHtkZXRhaWxzLm9wZXJhdGlvbn0gZmlsZTogJHtkZXRhaWxzLnBhdGh9YCwgXCJJT19FUlJPUlwiLCBkZXRhaWxzLCBkZXRhaWxzLm9wZXJhdGlvbiA9PT0gXCJ3cml0ZVwiID8gYENoZWNrIHRoYXQgdGhlIGRpcmVjdG9yeSBleGlzdHMgYW5kIHlvdSBoYXZlIHdyaXRlIHBlcm1pc3Npb25zLmAgOiBgQ2hlY2sgdGhhdCB0aGUgZmlsZSBleGlzdHMgYW5kIHlvdSBoYXZlIHJlYWQgcGVybWlzc2lvbnMuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZyNpb1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIklPRXJyb3JcIjtcblx0fVxufTtcbi8qKlxuKiBQbGF5ZXIgbm90IHJlYWR5IGVycm9yXG4qL1xudmFyIFBsYXllck5vdFJlYWR5RXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihvcGVyYXRpb24pIHtcblx0XHRzdXBlcihgUGxheWVyIG5vdCByZWFkeSBmb3Igb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBcIlBMQVlFUl9OT1RfUkVBRFlcIiwgeyBvcGVyYXRpb24gfSwgYENhbGwgbG9hZCgpIGFuZCB3YWl0IGZvciBpdCB0byBjb21wbGV0ZSBiZWZvcmUgY2FsbGluZyAke29wZXJhdGlvbn0oKS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvcGxheWVyXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyTm90UmVhZHlFcnJvclwiO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3BsYXllci50c1xuLy8hIFBsYXllciB0eXBlcyAtIFVzZXItZmFjaW5nIG9wdGlvbnMsIGV2ZW50cywgYW5kIGlucHV0IHR5cGVzIGZvciB0aGUgYnJvd3NlciBwbGF5ZXJcbi8vISBJbXBsZW1lbnRhdGlvbiB0eXBlcyAoUGxheWVyU3RhdGUsIFBsYXllclN0b3JlLCBldGMuKSBsaXZlIGluIEBzdXBlcmltZy9wbGF5ZXJcbi8qKiBUeXBlIGd1YXJkIGZvciBDb21wb3NlZFRlbXBsYXRlICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIiAmJiBpbnB1dCAhPT0gbnVsbCAmJiBcInR5cGVcIiBpbiBpbnB1dCAmJiBpbnB1dC50eXBlID09PSBcImNvbXBvc2VkXCI7XG59XG4vKiogQGRlcHJlY2F0ZWQgVXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSAqL1xuY29uc3QgaXNBbnlDb21wb3NlZFRlbXBsYXRlID0gaXNDb21wb3NlZFRlbXBsYXRlO1xuLyoqIEBkZXByZWNhdGVkIFJlbW92ZWQg4oCUIHVzZSBpc0NvbXBvc2VkVGVtcGxhdGUgYW5kIGNoZWNrIG1lZGl1bSA9PT0gXCJzdmdcIiAqL1xuZnVuY3Rpb24gaXNDb21wb3NlZFN2Z1RlbXBsYXRlKGlucHV0KSB7XG5cdHJldHVybiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpICYmIGlucHV0Lm1lZGl1bSA9PT0gXCJzdmdcIjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9ldmVudHMudHNcbi8vISBUeXBlZCwgdmVyc2lvbmVkIGV2ZW50IGNvbnRyYWN0IGZvciBzdXBlcmltZyBidWlsZCBpbnRlZ3JhdGlvbnMuXG4vLyEgQm90aCBKUyBjb25zdW1lcnMgKHJlbmRlciB3cmFwcGVycykgYW5kIFJ1c3QgZGVzZXJpYWxpemVycyAoZS5nLiBndW1ibylcbi8vISBzaG91bGQga2V5IG9uIHRoZSBgdmAgZmllbGQgYmVmb3JlIHJlYWRpbmcgZXZlbnQtc3BlY2lmaWMgZmllbGRzLlxuLy8hIEJ1bXAgYHZgIG9uIGFueSBicmVha2luZyBmaWVsZCByZW5hbWUgb3IgcmVtb3ZhbDsgYWRkaXRpdmUgZmllbGRzIGFyZSBub24tYnJlYWtpbmcuXG5jb25zdCBSRU5ERVJfRVZFTlRfVkVSU0lPTiA9IDE7XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvYmF0Y2gtdHlwZXMudHNcbi8vISBTdXBlckltZyBCYXRjaCBUeXBlc1xuLy8hIENvLWxvY2F0ZWQgYGV4cG9ydCBjb25zdCBiYXRjaGAgY29udmVudGlvbiBmb3IgYnVpbGQtdGltZSBmYW4tb3V0LlxuLy8hIEEgdGVtcGxhdGUgbW9kdWxlIG9wdGlvbmFsbHkgZXhwb3J0cyBgYmF0Y2hgIChidWlsdCB3aXRoIGBkZWZpbmVCYXRjaGApIHRvXG4vLyEgZ2VuZXJhdGUgbWFueSBvdXRwdXRzIGZyb20gb25lIHRlbXBsYXRlIOKAlCBubyBzZXBhcmF0ZSBsb2FkZXIgZmlsZS5cbi8qKlxuKiBUeXBlIGEgY28tbG9jYXRlZCBgYmF0Y2hgIGV4cG9ydCBhZ2FpbnN0IGl0cyB0ZW1wbGF0ZS5cbipcbiogYFREYXRhYCBmbG93cyBmcm9tIHRoZSB0ZW1wbGF0ZSB2YWx1ZSDigJQgY2hhbmdlIHRoZSB0ZW1wbGF0ZSdzIGBzYW1wbGVgXG4qIHNoYXBlIGFuZCB0aGUgYGRhdGE6YCBzaXRlcyBiZWxvdyB0eXBlLWVycm9yLiBUaGUgdGVtcGxhdGUgYXJndW1lbnQgaXNcbiogaW5mZXJlbmNlLW9ubHk7IGF0IHJ1bnRpbWUgdGhlIHByb3ZpZGVyIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbipcbiogUHV0IGFueSBzZXJ2ZXIvZGF0YSBpbXBvcnRzICppbnNpZGUqIHRoZSBwcm92aWRlciB3aXRoIGBhd2FpdCBpbXBvcnQoLi4uKWBcbiogc28gdGhlIGNsaWVudCBwbGF5ZXIgYnVuZGxlICh3aGljaCBpbXBvcnRzIHRoZSB0ZW1wbGF0ZSkgdHJlZS1zaGFrZXMgdGhlbSBvdXQuXG4qXG4qIEBleGFtcGxlXG4qIGBgYHR5cGVzY3JpcHRcbiogLy8gb2cubWVkaWEudHNcbiogaW1wb3J0IHsgZGVmaW5lLCBkZWZpbmVCYXRjaCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuKlxuKiBjb25zdCB0ZW1wbGF0ZSA9IGRlZmluZSh7IHNhbXBsZTogeyB0aXRsZTogXCJIaVwiIH0sIGNvbmZpZzogeyB3aWR0aDogMTIwMCwgaGVpZ2h0OiA2MzAgfSwgcmVuZGVyIH0pO1xuKiBleHBvcnQgZGVmYXVsdCB0ZW1wbGF0ZTtcbipcbiogZXhwb3J0IGNvbnN0IGJhdGNoID0gZGVmaW5lQmF0Y2godGVtcGxhdGUsIGFzeW5jICgpID0+IHtcbiogICBjb25zdCB7IGdldFBvc3RzIH0gPSBhd2FpdCBpbXBvcnQoXCIuLi9jb250ZW50XCIpO1xuKiAgIHJldHVybiAoYXdhaXQgZ2V0UG9zdHMoKSkubWFwKHAgPT4gKHsgc2x1ZzogcC5zbHVnLCBzYW1wbGU6IHsgdGl0bGU6IHAudGl0bGUgfSB9KSk7XG4qIH0pO1xuKiBgYGBcbiovXG5mdW5jdGlvbiBkZWZpbmVCYXRjaChfdGVtcGxhdGUsIHByb3ZpZGVyKSB7XG5cdHJldHVybiBwcm92aWRlcjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9pbmRleC50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gUHVyZSBUeXBlU2NyaXB0IHR5cGUgZGVmaW5pdGlvbnNcbi8vISBDb3JlIHR5cGVzLCBpbnRlcmZhY2VzLCBhbmQgZXJyb3IgY2xhc3NlcyBmb3IgdGVtcGxhdGVzLCByZW5kZXJpbmcsIGFuZCBwbGF5YmFja1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBJT0Vycm9yLCBQbGF5ZXJOb3RSZWFkeUVycm9yLCBSRU5ERVJfRVZFTlRfVkVSU0lPTiwgUmVuZGVyRXJyb3IsIFN1cGVySW1nRXJyb3IsIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciwgVGVtcGxhdGVSdW50aW1lRXJyb3IsIFZhbGlkYXRpb25FcnJvciwgZGVmaW5lLCBkZWZpbmVCYXRjaCwgZGVmaW5lQ29uZmlnLCBpc0FuaW1hdGVkVGVtcGxhdGUsIGlzQW55Q29tcG9zZWRUZW1wbGF0ZSwgaXNDb21wb3NlZFN2Z1RlbXBsYXRlLCBpc0NvbXBvc2VkVGVtcGxhdGUsIGlzSnNvbk9iamVjdCwgaXNTdGF0aWNUZW1wbGF0ZSB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgeyBkZWZpbmUsIHR5cGUgUmVuZGVyQ29udGV4dCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBsYW5MaW5lIHtcbiAgbnVtOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgdG9uZTogXCJoZWFkaW5nXCIgfCBcImJvZHlcIiB8IFwiYmxhbmtcIjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb3RrZXkge1xuICBrZXk6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJhZ2VudCB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHJvbGU6IHN0cmluZztcbiAgc3RhdHVzOiBcInJ1bm5pbmdcIiB8IFwiZG9uZVwiO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdyb2tCdWlsZERhdGEgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHdvcmtzcGFjZTogc3RyaW5nO1xuICBwcm9tcHQ6IHN0cmluZztcbiAgdGhvdWdodFNlY29uZHM6IG51bWJlcjtcbiAgcGxhblRpdGxlOiBzdHJpbmc7XG4gIHBsYW5MaW5lczogUGxhbkxpbmVbXTtcbiAgaG90a2V5czogSG90a2V5W107XG4gIHN1YmFnZW50czogU3ViYWdlbnRbXTtcbiAgbW9kZWw6IHN0cmluZztcbiAgbW9kZXM6IHsgaWRsZTogc3RyaW5nOyBhZnRlckFwcHJvdmU6IHN0cmluZyB9O1xufVxuXG5jb25zdCBDID0ge1xuICBwYWdlOiBcIiMwMDAwMDBcIixcbiAgY2hyb21lOiBcIiMwYzBjMGNcIixcbiAgYm9yZGVyOiBcIiMyYTJhMmFcIixcbiAgYm9yZGVyU29mdDogXCIjMWUxZTFlXCIsXG4gIHRleHQ6IFwiI2U5ZTllOVwiLFxuICBzb2Z0OiBcIiM5YzljOWNcIixcbiAgbXV0ZWQ6IFwiIzZlNmU2ZVwiLFxuICBkaW06IFwiIzNmM2YzZlwiLFxuICBkb25lOiBcIiM1ZjVmNWZcIixcbiAgdHJhZmZpYzogXCIjM2EzYTNhXCIsXG59O1xuXG5jb25zdCBTUElOID0gW1wi4peQXCIsIFwi4peTXCIsIFwi4peRXCIsIFwi4peSXCJdIGFzIGNvbnN0O1xuY29uc3QgQkFSX1dJRFRIID0gMzQ7XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIik7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZTxHcm9rQnVpbGREYXRhPih7XG4gIHNhbXBsZToge1xuICAgIHdvcmtzcGFjZTogXCJwcm9qZWN0cy9tYWluIMK3IGd1bWJvL3NyY1wiLFxuICAgIHByb21wdDogXCJNaWdyYXRlIGF1dGggZnJvbSBzZXNzaW9ucyB0byBKV1Qgd2l0aCB0b2tlbiByb3RhdGlvbi5cIixcbiAgICB0aG91Z2h0U2Vjb25kczogMy40LFxuICAgIHBsYW5UaXRsZTogXCJwbGFuLm1kXCIsXG4gICAgcGxhbkxpbmVzOiBbXG4gICAgICB7IG51bTogXCIxXCIsIHRleHQ6IFwiQm90dG9tIGxpbmVcIiwgdG9uZTogXCJoZWFkaW5nXCIgfSxcbiAgICAgIHtcbiAgICAgICAgbnVtOiBcIjJcIixcbiAgICAgICAgdGV4dDogXCJTd2FwIGxlZ2FjeSBzZXNzaW9ucyBmb3IgSldUICsgcm90YXRpb24sIGJlaGluZCBhIGZsYWcgd2l0aCA3ZCBjb21wYXQuXCIsXG4gICAgICAgIHRvbmU6IFwiYm9keVwiLFxuICAgICAgfSxcbiAgICAgIHsgbnVtOiBcIjNcIiwgdGV4dDogXCJcIiwgdG9uZTogXCJibGFua1wiIH0sXG4gICAgICB7IG51bTogXCI0XCIsIHRleHQ6IFwiQXBwcm9hY2hcIiwgdG9uZTogXCJoZWFkaW5nXCIgfSxcbiAgICAgIHsgbnVtOiBcIjVcIiwgdGV4dDogXCLigKIgQWRkIGp3dFZlcmlmeSBoZWxwZXIgaW4gc3JjL2xpYi9qd3QudHMuXCIsIHRvbmU6IFwiYm9keVwiIH0sXG4gICAgICB7IG51bTogXCI2XCIsIHRleHQ6IFwi4oCiIEFkZCAvYXV0aC9yZWZyZXNoIHdpdGggcm90YXRpbmcgcmVmcmVzaCB0b2tlbnMuXCIsIHRvbmU6IFwiYm9keVwiIH0sXG4gICAgICB7IG51bTogXCI3XCIsIHRleHQ6IFwi4oCiIFJlcGxhY2Ugc2Vzc2lvbiBjaGVjayBpbiBhdXRoTWlkZGxld2FyZS5cIiwgdG9uZTogXCJib2R5XCIgfSxcbiAgICBdLFxuICAgIGhvdGtleXM6IFtcbiAgICAgIHsga2V5OiBcImFcIiwgbGFiZWw6IFwicHByb3ZlXCIgfSxcbiAgICAgIHsga2V5OiBcImNcIiwgbGFiZWw6IFwib21tZW50XCIgfSxcbiAgICAgIHsga2V5OiBcInFcIiwgbGFiZWw6IFwidWl0IHBsYW5cIiB9LFxuICAgIF0sXG4gICAgc3ViYWdlbnRzOiBbXG4gICAgICB7IGxhYmVsOiBcIkV4cGxvcmUgc2Vzc2lvbiBtaWRkbGV3YXJlXCIsIHJvbGU6IFwiZXhwbG9yZVwiLCBzdGF0dXM6IFwicnVubmluZ1wiIH0sXG4gICAgICB7IGxhYmVsOiBcIkV4cGxvcmUgdG9rZW4gc3RvcmFnZVwiLCByb2xlOiBcImV4cGxvcmVcIiwgc3RhdHVzOiBcInJ1bm5pbmdcIiB9LFxuICAgICAgeyBsYWJlbDogXCJEcmFmdCBqd3QudHMgaGVscGVyXCIsIHJvbGU6IFwiYnVpbGRcIiwgc3RhdHVzOiBcInJ1bm5pbmdcIiB9LFxuICAgICAgeyBsYWJlbDogXCJBdWRpdCByZWZyZXNoIGVuZHBvaW50c1wiLCByb2xlOiBcInJldmlld1wiLCBzdGF0dXM6IFwicnVubmluZ1wiIH0sXG4gICAgICB7IGxhYmVsOiBcIk1hcCBhdXRoIGNhbGwgc2l0ZXNcIiwgcm9sZTogXCJleHBsb3JlXCIsIHN0YXR1czogXCJkb25lXCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiUmVhZCBBR0VOVFMubWRcIiwgcm9sZTogXCJleHBsb3JlXCIsIHN0YXR1czogXCJkb25lXCIgfSxcbiAgICBdLFxuICAgIG1vZGVsOiBcImdyb2stNC41XCIsXG4gICAgbW9kZXM6IHsgaWRsZTogXCJhc2tcIiwgYWZ0ZXJBcHByb3ZlOiBcImJ1aWxkXCIgfSxcbiAgfSxcbiAgY29uZmlnOiB7XG4gICAgd2lkdGg6IDE5MjAsXG4gICAgaGVpZ2h0OiAxMDgwLFxuICAgIGZwczogMzAsXG4gICAgZHVyYXRpb246IFwiMTNzXCIsXG4gIH0sXG4gIHJlbmRlcihjdHg6IFJlbmRlckNvbnRleHQ8R3Jva0J1aWxkRGF0YT4pIHtcbiAgICBjb25zdCB7IHN0ZCwgd2lkdGgsIGhlaWdodCwgZGF0YSwgdGltZWxpbmUgfSA9IGN0eDtcbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHtcbiAgICAgIGJvb3Q6IFwiOCVcIixcbiAgICAgIHByb21wdDogXCIxMCVcIixcbiAgICAgIHRoaW5rOiBcIjEwJVwiLFxuICAgICAgcGxhbjogXCIyMiVcIixcbiAgICAgIGFnZW50czogXCIyMCVcIixcbiAgICAgIHByb2dyZXNzOiBcIjE1JVwiLFxuICAgICAgYXBwcm92ZTogXCIxMCVcIixcbiAgICAgIGhvbGQ6IFwiNSVcIixcbiAgICB9KTtcblxuICAgIGNvbnN0IGZzID0gMjA7XG4gICAgY29uc3Qgc21hbGwgPSBmcyAqIDAuOTtcbiAgICBjb25zdCBjYXJkVyA9IE1hdGgubWluKHdpZHRoIC0gMjgwLCAxMjgwKTtcbiAgICBjb25zdCBjYXJkSCA9IE1hdGgubWluKGhlaWdodCAtIDE0MCwgOTAwKTtcblxuICAgIGNvbnN0IGVudGVyID0gKHA6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgZSA9IHN0ZC5pbnRlcnBvbGF0ZShwLCBbMCwgMV0sIFswLCAxXSwgXCJlYXNlT3V0Q3ViaWNcIik7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwOiBlLFxuICAgICAgICBzdHlsZTogYG9wYWNpdHk6JHtlfTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgkeygxIC0gZSkgKiAxMH1weCk7YCxcbiAgICAgIH07XG4gICAgfTtcbiAgICBjb25zdCB3aW4gPSAocDogbnVtYmVyLCBzdGFydDogbnVtYmVyLCBzcGFuOiBudW1iZXIpID0+XG4gICAgICBzdGQuY2xhbXAwMSgocCAtIHN0YXJ0KSAvIHNwYW4pO1xuXG4gICAgY29uc3QgaW50cm8gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJib290XCIsIHk6IDIwLCBzY2FsZTogMC45OTIsIGV4aXQ6IGZhbHNlIH0pO1xuICAgIGNvbnN0IGJsaW5rID0gdGltZWxpbmUuc2Vjb25kcyAlIDEuMDYgPCAwLjUzID8gMSA6IDA7XG4gICAgY29uc3Qgc3BpbkdseXBoID0gU1BJTltNYXRoLmZsb29yKHRpbWVsaW5lLnNlY29uZHMgLyAwLjE4KSAlIFNQSU4ubGVuZ3RoXTtcblxuICAgIC8vIC0tLS0gcHJvbXB0IHR5cGluZyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwcm9tcHRQID0gdC5pbihcInByb21wdFwiKTtcbiAgICBjb25zdCB0eXBlZENoYXJzID0gTWF0aC5mbG9vcihzdGQuY2xhbXAwMShwcm9tcHRQIC8gMC44OCkgKiBkYXRhLnByb21wdC5sZW5ndGgpO1xuICAgIGNvbnN0IHByb21wdERvbmUgPSBwcm9tcHRQID49IDAuODggfHwgdC5pbihcInRoaW5rXCIpID4gMDtcbiAgICBjb25zdCBwcm9tcHRUZXh0ID0gZXNjYXBlSHRtbChcbiAgICAgIHByb21wdERvbmUgPyBkYXRhLnByb21wdCA6IGRhdGEucHJvbXB0LnNsaWNlKDAsIHR5cGVkQ2hhcnMpLFxuICAgICk7XG4gICAgY29uc3QgcHJvbXB0VmlzaWJsZSA9IHQuaW4oXCJib290XCIpID4gMC40IHx8IHByb21wdFAgPiAwO1xuXG4gICAgLy8gLS0tLSB0aGluayAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHRoaW5rUCA9IHQuaW4oXCJ0aGlua1wiKTtcbiAgICBjb25zdCB0aGlua0VudGVyID0gZW50ZXIod2luKHRoaW5rUCwgMCwgMC4zNSkpO1xuICAgIGNvbnN0IHRob3VnaHRWYWwgPVxuICAgICAgdGhpbmtQID4gMFxuICAgICAgICA/IE1hdGgubWluKGRhdGEudGhvdWdodFNlY29uZHMsIHRoaW5rUCAqIGRhdGEudGhvdWdodFNlY29uZHMgKiAxLjE1KVxuICAgICAgICA6IDA7XG4gICAgY29uc3QgdGhvdWdodFNob3duID1cbiAgICAgIHQuaW4oXCJwbGFuXCIpID4gMCB8fCB0LmluKFwiYWdlbnRzXCIpID4gMCB8fCB0LmluKFwicHJvZ3Jlc3NcIikgPiAwIHx8IHQuaW4oXCJhcHByb3ZlXCIpID4gMCB8fCB0LmluKFwiaG9sZFwiKSA+IDBcbiAgICAgICAgPyBkYXRhLnRob3VnaHRTZWNvbmRzXG4gICAgICAgIDogdGhvdWdodFZhbDtcblxuICAgIC8vIC0tLS0gcGxhbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwbGFuUCA9IHQuaW4oXCJwbGFuXCIpO1xuICAgIGNvbnN0IHBsYW5IZWFkID0gZW50ZXIod2luKHBsYW5QLCAwLCAwLjE4KSk7XG4gICAgY29uc3QgcGxhbkxpbmVzSHRtbCA9IGRhdGEucGxhbkxpbmVzXG4gICAgICAubWFwKChsaW5lLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGVudGVyKHdpbihwbGFuUCwgMC4xMiArIGkgKiAwLjA4LCAwLjE0KSk7XG4gICAgICAgIGlmIChyb3cucCA8PSAwKSByZXR1cm4gXCJcIjtcbiAgICAgICAgY29uc3QgZmcgPVxuICAgICAgICAgIGxpbmUudG9uZSA9PT0gXCJoZWFkaW5nXCIgPyBDLnRleHQgOiBsaW5lLnRvbmUgPT09IFwiYm9keVwiID8gQy5zb2Z0IDogQy5kaW07XG4gICAgICAgIHJldHVybiBgPGRpdiBzdHlsZT1cIiR7cm93LnN0eWxlfVwiPjxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLmRpbX07ZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MjhweDtcIj4ke2VzY2FwZUh0bWwobGluZS5udW0pfTwvc3Bhbj48c3BhbiBzdHlsZT1cImNvbG9yOiR7Zmd9O1wiPiR7ZXNjYXBlSHRtbChsaW5lLnRleHQpfTwvc3Bhbj48L2Rpdj5gO1xuICAgICAgfSlcbiAgICAgIC5qb2luKFwiXCIpO1xuICAgIGNvbnN0IGhvdGtleXNFbnRlciA9IGVudGVyKHdpbihwbGFuUCwgMC43MiwgMC4yKSk7XG4gICAgY29uc3QgYXBwcm92ZVAgPSB0LmluKFwiYXBwcm92ZVwiKTtcbiAgICBjb25zdCBhcHByb3ZlQWN0aXZlID0gYXBwcm92ZVAgPiAwLjM1IHx8IHQuaW4oXCJob2xkXCIpID4gMDtcbiAgICBjb25zdCBob3RrZXlzSHRtbCA9IGRhdGEuaG90a2V5c1xuICAgICAgLm1hcCgoaGspID0+IHtcbiAgICAgICAgY29uc3QgaXNBcHByb3ZlID0gaGsua2V5ID09PSBcImFcIiAmJiBhcHByb3ZlQWN0aXZlO1xuICAgICAgICBjb25zdCBrZXlDb2xvciA9IGlzQXBwcm92ZSA/IEMudGV4dCA6IEMudGV4dDtcbiAgICAgICAgY29uc3QgbGFiZWxDb2xvciA9IGlzQXBwcm92ZSA/IEMudGV4dCA6IEMubXV0ZWQ7XG4gICAgICAgIGNvbnN0IGJnID0gaXNBcHByb3ZlID8gXCJyZ2JhKDIzMywyMzMsMjMzLDAuMDgpXCIgOiBcInRyYW5zcGFyZW50XCI7XG4gICAgICAgIHJldHVybiBgPHNwYW4gc3R5bGU9XCJwYWRkaW5nOjFweCA4cHggMXB4IDA7Ym9yZGVyLXJhZGl1czoycHg7YmFja2dyb3VuZDoke2JnfTtcIj48c3BhbiBzdHlsZT1cImNvbG9yOiR7a2V5Q29sb3J9O1wiPlske2VzY2FwZUh0bWwoaGsua2V5KX1dPC9zcGFuPjxzcGFuIHN0eWxlPVwiY29sb3I6JHtsYWJlbENvbG9yfTtcIj4ke2VzY2FwZUh0bWwoaGsubGFiZWwpfTwvc3Bhbj48L3NwYW4+YDtcbiAgICAgIH0pXG4gICAgICAuam9pbihcIlwiKTtcblxuICAgIC8vIC0tLS0gc3ViYWdlbnRzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBhZ2VudHNQID0gdC5pbihcImFnZW50c1wiKTtcbiAgICBjb25zdCBhZ2VudHNIZWFkID0gZW50ZXIod2luKGFnZW50c1AsIDAsIDAuMTUpKTtcbiAgICBjb25zdCBydW5uaW5nQ291bnQgPSBkYXRhLnN1YmFnZW50cy5maWx0ZXIoKHMpID0+IHMuc3RhdHVzID09PSBcInJ1bm5pbmdcIikubGVuZ3RoO1xuICAgIGNvbnN0IGRvbmVDb3VudCA9IGRhdGEuc3ViYWdlbnRzLmZpbHRlcigocykgPT4gcy5zdGF0dXMgPT09IFwiZG9uZVwiKS5sZW5ndGg7XG4gICAgLy8gRmxpcCBmaXJzdCB0d28gXCJydW5uaW5nXCIgdG8gZG9uZSBtaWQtYWdlbnRzLCBrZWVwIGxhc3QgdHdvIHNwaW5uaW5nXG4gICAgY29uc3QgYWdlbnRzSHRtbCA9IGRhdGEuc3ViYWdlbnRzXG4gICAgICAubWFwKChhZ2VudCwgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBlbnRlcih3aW4oYWdlbnRzUCwgMC4xICsgaSAqIDAuMDcsIDAuMTQpKTtcbiAgICAgICAgaWYgKHJvdy5wIDw9IDApIHJldHVybiBcIlwiO1xuICAgICAgICBjb25zdCBmbGlwRG9uZSA9XG4gICAgICAgICAgYWdlbnQuc3RhdHVzID09PSBcInJ1bm5pbmdcIiAmJiBpIDwgMiAmJiB3aW4oYWdlbnRzUCwgMC41NSArIGkgKiAwLjEyLCAwLjE1KSA+PSAxO1xuICAgICAgICBjb25zdCBpc0RvbmUgPSBhZ2VudC5zdGF0dXMgPT09IFwiZG9uZVwiIHx8IGZsaXBEb25lO1xuICAgICAgICBjb25zdCBpY29uID0gaXNEb25lXG4gICAgICAgICAgPyBgPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuZG9uZX07XCI+4pyTPC9zcGFuPmBcbiAgICAgICAgICA6IGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy50ZXh0fTtcIj4ke3NwaW5HbHlwaH08L3NwYW4+YDtcbiAgICAgICAgY29uc3QgbGFiZWxDb2xvciA9IGlzRG9uZSA/IEMuZG9uZSA6IEMuc29mdDtcbiAgICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwiJHtyb3cuc3R5bGV9XCI+JHtpY29ufSA8c3BhbiBzdHlsZT1cImNvbG9yOiR7bGFiZWxDb2xvcn07XCI+JHtlc2NhcGVIdG1sKGFnZW50LmxhYmVsKX08L3NwYW4+IDxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLmRpbX07XCI+JHtlc2NhcGVIdG1sKGFnZW50LnJvbGUpfTwvc3Bhbj48L2Rpdj5gO1xuICAgICAgfSlcbiAgICAgIC5qb2luKFwiXCIpO1xuICAgIGNvbnN0IGxpdmVSdW5uaW5nID0gTWF0aC5tYXgoXG4gICAgICAwLFxuICAgICAgcnVubmluZ0NvdW50IC0gKHdpbihhZ2VudHNQLCAwLjU1LCAwLjE1KSA+PSAxID8gMSA6IDApIC0gKHdpbihhZ2VudHNQLCAwLjY3LCAwLjE1KSA+PSAxID8gMSA6IDApLFxuICAgICk7XG4gICAgY29uc3QgbGl2ZURvbmUgPSBkb25lQ291bnQgKyAocnVubmluZ0NvdW50IC0gbGl2ZVJ1bm5pbmcpO1xuXG4gICAgLy8gLS0tLSBwcm9ncmVzcyArIG1ldGVyIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHBjdEJhc2UgPSA4LjQ1O1xuICAgIGNvbnN0IHBjdEVuZCA9IDcyLjQ7XG4gICAgY29uc3QgcHJvZ3Jlc3NMb2NhbCA9XG4gICAgICB0LmluKFwiaG9sZFwiKSA+IDAgfHwgdC5pbihcImFwcHJvdmVcIikgPiAwXG4gICAgICAgID8gMVxuICAgICAgICA6IHQuaW4oXCJwcm9ncmVzc1wiKSA+IDBcbiAgICAgICAgICA/IHQuaW4oXCJwcm9ncmVzc1wiKVxuICAgICAgICAgIDogdC5pbihcImFnZW50c1wiKSA+IDAuN1xuICAgICAgICAgICAgPyB3aW4odC5pbihcImFnZW50c1wiKSwgMC43LCAwLjMpICogMC4wOFxuICAgICAgICAgICAgOiAwO1xuICAgIGNvbnN0IHBjdCA9XG4gICAgICBwcm9ncmVzc0xvY2FsIDw9IDBcbiAgICAgICAgPyBwY3RCYXNlXG4gICAgICAgIDogcGN0QmFzZSArIChwY3RFbmQgLSBwY3RCYXNlKSAqIHN0ZC5pbnRlcnBvbGF0ZShNYXRoLm1pbigxLCBwcm9ncmVzc0xvY2FsKSwgWzAsIDFdLCBbMCwgMV0sIFwibGluZWFyXCIpO1xuICAgIGNvbnN0IGZpbGxlZCA9IE1hdGgucm91bmQoKHBjdCAvIDEwMCkgKiBCQVJfV0lEVEgpO1xuICAgIGNvbnN0IGJhciA9XG4gICAgICBcIuKWiFwiLnJlcGVhdChNYXRoLm1heCgwLCBmaWxsZWQpKSArIFwiIFwiLnJlcGVhdChNYXRoLm1heCgwLCBCQVJfV0lEVEggLSBmaWxsZWQpKTtcbiAgICBjb25zdCB0dXJuQmFzZSA9IDEyLjQ7XG4gICAgY29uc3QgdG9rQmFzZSA9IDQxLjI7XG4gICAgY29uc3Qgd29ya0Nsb2NrID0gTWF0aC5tYXgoXG4gICAgICAwLFxuICAgICAgdC5pbihcImFnZW50c1wiKSAqIDAuNCArIHQuaW4oXCJwcm9ncmVzc1wiKSAqIDAuNSArIHQuaW4oXCJhcHByb3ZlXCIpICogMC4yICsgdC5pbihcImhvbGRcIikgKiAwLjEsXG4gICAgKTtcbiAgICBjb25zdCB0dXJuU2VjID0gdHVybkJhc2UgKyB3b3JrQ2xvY2sgKiAxODtcbiAgICBjb25zdCB0b2tlbnMgPSB0b2tCYXNlICsgd29ya0Nsb2NrICogMTI7XG5cbiAgICAvLyAtLS0tIG1vZGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgbW9kZSA9XG4gICAgICBhcHByb3ZlQWN0aXZlIHx8IHQuaW4oXCJob2xkXCIpID4gMCA/IGRhdGEubW9kZXMuYWZ0ZXJBcHByb3ZlIDogZGF0YS5tb2Rlcy5pZGxlO1xuXG4gICAgLy8gLS0tLSBibG9jayB2aXNpYmlsaXR5IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHRob3VnaHRIdG1sID1cbiAgICAgIHRoaW5rRW50ZXIucCA+IDAgfHwgdC5pbihcInBsYW5cIikgPiAwXG4gICAgICAgID8gYDxkaXYgc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9O21hcmdpbi1ib3R0b206JHtmcyAqIDAuNTV9cHg7JHt0aGlua0VudGVyLnAgPiAwICYmIHQuaW4oXCJwbGFuXCIpIDw9IDAgPyB0aGlua0VudGVyLnN0eWxlIDogXCJcIn1cIj7il4YgVGhvdWdodCBmb3IgJHt0aG91Z2h0U2hvd24udG9GaXhlZCgxKX1zPC9kaXY+YFxuICAgICAgICA6IFwiXCI7XG5cbiAgICBjb25zdCBwbGFuSHRtbCA9XG4gICAgICBwbGFuSGVhZC5wID4gMCB8fCB0LmluKFwiYWdlbnRzXCIpID4gMCB8fCB0LmluKFwicHJvZ3Jlc3NcIikgPiAwIHx8IHQuaW4oXCJhcHByb3ZlXCIpID4gMCB8fCB0LmluKFwiaG9sZFwiKSA+IDBcbiAgICAgICAgPyBgXG4gICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbToke2ZzICogMC41NX1weDske3BsYW5IZWFkLnAgPCAxICYmIHQuaW4oXCJhZ2VudHNcIikgPD0gMCA/IHBsYW5IZWFkLnN0eWxlIDogXCJcIn1cIj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Y29sb3I6JHtDLmRpbX07b3ZlcmZsb3c6aGlkZGVuO3doaXRlLXNwYWNlOm5vd3JhcDtcIj5cbiAgICAgICAgICA8c3BhbiBzdHlsZT1cImZsZXg6MTtvdmVyZmxvdzpoaWRkZW47XCI+4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLnRleHR9O3BhZGRpbmc6MCA4cHg7XCI+JHtlc2NhcGVIdG1sKGRhdGEucGxhblRpdGxlKX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJmbGV4OjE7b3ZlcmZsb3c6aGlkZGVuO3RleHQtYWxpZ246cmlnaHQ7XCI+4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLm11dGVkfTtwYWRkaW5nLWxlZnQ6MTBweDtcIj7Dlzwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJwYWRkaW5nOjhweCAwIDRweDtcIj4ke3BsYW5MaW5lc0h0bWx9PC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjoke0MuZGltfTtvdmVyZmxvdzpoaWRkZW47d2hpdGUtc3BhY2U6bm93cmFwO1wiPuKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgDwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwicGFkZGluZy10b3A6NnB4OyR7aG90a2V5c0VudGVyLnAgPCAxICYmIHQuaW4oXCJhZ2VudHNcIikgPD0gMCA/IGhvdGtleXNFbnRlci5zdHlsZSA6IFwiXCJ9XCI+JHtob3RrZXlzSHRtbH08L2Rpdj5cbiAgICAgIDwvZGl2PmBcbiAgICAgICAgOiBcIlwiO1xuXG4gICAgY29uc3QgYWdlbnRzQmxvY2sgPVxuICAgICAgYWdlbnRzSGVhZC5wID4gMCB8fCB0LmluKFwicHJvZ3Jlc3NcIikgPiAwIHx8IHQuaW4oXCJhcHByb3ZlXCIpID4gMCB8fCB0LmluKFwiaG9sZFwiKSA+IDBcbiAgICAgICAgPyBgXG4gICAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyOjAuNXB4IHNvbGlkICR7Qy5ib3JkZXJTb2Z0fTtib3JkZXItcmFkaXVzOjNweDtwYWRkaW5nOjhweCAxMnB4O21hcmdpbi1ib3R0b206JHtmcyAqIDAuNTV9cHg7JHthZ2VudHNIZWFkLnAgPCAxICYmIHQuaW4oXCJwcm9ncmVzc1wiKSA8PSAwID8gYWdlbnRzSGVhZC5zdHlsZSA6IFwiXCJ9XCI+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9O21hcmdpbi1ib3R0b206NnB4O1wiPnN1YmFnZW50cyA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5kaW19O1wiPuKAlCAke2xpdmVSdW5uaW5nfSBydW5uaW5nLCAke2xpdmVEb25lfSBkb25lPC9zcGFuPjwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDoycHggMjBweDtcIj4ke2FnZW50c0h0bWx9PC9kaXY+XG4gICAgICA8L2Rpdj5gXG4gICAgICAgIDogXCJcIjtcblxuICAgIGNvbnN0IHByb2dyZXNzT3BhY2l0eSA9XG4gICAgICB0LmluKFwicHJvZ3Jlc3NcIikgPiAwIHx8IHQuaW4oXCJhcHByb3ZlXCIpID4gMCB8fCB0LmluKFwiaG9sZFwiKSA+IDBcbiAgICAgICAgPyAxXG4gICAgICAgIDogdC5pbihcImFnZW50c1wiKSA+IDAuN1xuICAgICAgICAgID8gd2luKHQuaW4oXCJhZ2VudHNcIiksIDAuNywgMC4zKVxuICAgICAgICAgIDogMDtcblxuICAgIGNvbnN0IGN1cnNvckh0bWwgPSBgPHNwYW4gc3R5bGU9XCJiYWNrZ3JvdW5kOiR7Qy50ZXh0fTt3aWR0aDo3cHg7aGVpZ2h0OiR7ZnMgKiAwLjg1fXB4O2Rpc3BsYXk6aW5saW5lLWJsb2NrO3ZlcnRpY2FsLWFsaWduOi0ycHg7b3BhY2l0eToke2JsaW5rfTtcIj48L3NwYW4+YDtcblxuICAgIHJldHVybiBgXG4gICAgICA8c3R5bGU+XG4gICAgICAgICogeyBib3gtc2l6aW5nOiBib3JkZXItYm94OyBtYXJnaW46IDA7IH1cbiAgICAgICAgLm1vbm8ge1xuICAgICAgICAgIGZvbnQtZmFtaWx5OiAnU0YgTW9ubycsIHVpLW1vbm9zcGFjZSwgTWVubG8sIENvbnNvbGFzLCAnRGVqYVZ1IFNhbnMgTW9ubycsIG1vbm9zcGFjZTtcbiAgICAgICAgICBmb250LXZhcmlhbnQtbGlnYXR1cmVzOiBub25lO1xuICAgICAgICAgIC13ZWJraXQtZm9udC1zbW9vdGhpbmc6IGFudGlhbGlhc2VkO1xuICAgICAgICB9XG4gICAgICA8L3N0eWxlPlxuICAgICAgPGRpdiBjbGFzcz1cIm1vbm9cIiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgIHdpZHRoLFxuICAgICAgICBoZWlnaHQsXG4gICAgICAgIGJhY2tncm91bmQ6IEMucGFnZSxcbiAgICAgICAgY29sb3I6IEMudGV4dCxcbiAgICAgICAgZm9udFNpemU6IGZzLFxuICAgICAgICBsaW5lSGVpZ2h0OiAxLjY1LFxuICAgICAgfSwgc3RkLmNzcy5jZW50ZXIoKSl9XCI+XG4gICAgICAgIDxtYWluIHN0eWxlPVwiXG4gICAgICAgICAgd2lkdGg6JHtjYXJkV31weDtcbiAgICAgICAgICBoZWlnaHQ6JHtjYXJkSH1weDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiR7Qy5wYWdlfTtcbiAgICAgICAgICBib3JkZXI6MC41cHggc29saWQgJHtDLmJvcmRlcn07XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czo4cHg7XG4gICAgICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgICAgIGRpc3BsYXk6ZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjpjb2x1bW47XG4gICAgICAgICAgYm94LXNoYWRvdzowIDI4cHggODBweCByZ2JhKDAsMCwwLDAuNjUpO1xuICAgICAgICAgIG9wYWNpdHk6JHtpbnRyby5vcGFjaXR5fTtcbiAgICAgICAgICAke2ludHJvLnN0eWxlfVxuICAgICAgICBcIj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICBkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMHB4O1xuICAgICAgICAgICAgcGFkZGluZzoxMHB4IDE0cHg7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiR7Qy5jaHJvbWV9O2JvcmRlci1ib3R0b206MC41cHggc29saWQgJHtDLmJvcmRlcn07XG4gICAgICAgICAgICBmbGV4Om5vbmU7XG4gICAgICAgICAgXCI+XG4gICAgICAgICAgICA8c3BhbiBzdHlsZT1cIndpZHRoOjEycHg7aGVpZ2h0OjEycHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDoke0MudHJhZmZpY307XCI+PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJ3aWR0aDoxMnB4O2hlaWdodDoxMnB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6JHtDLnRyYWZmaWN9O1wiPjwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwid2lkdGg6MTJweDtoZWlnaHQ6MTJweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOiR7Qy50cmFmZmljfTtcIj48L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBzdHlsZT1cIm1hcmdpbi1sZWZ0OjhweDtjb2xvcjoke0MubXV0ZWR9O2ZvbnQtc2l6ZToke3NtYWxsfXB4O1wiPmdyb2s8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgICBmbGV4OjE7bWluLWhlaWdodDowO1xuICAgICAgICAgICAgcGFkZGluZzoxNHB4IDE4cHg7XG4gICAgICAgICAgICBkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO1xuICAgICAgICAgICAgb3ZlcmZsb3c6aGlkZGVuO1xuICAgICAgICAgIFwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2Vlbjtjb2xvcjoke0MubXV0ZWR9O2JvcmRlci1ib3R0b206MC41cHggc29saWQgJHtDLmJvcmRlclNvZnR9O3BhZGRpbmctYm90dG9tOjhweDttYXJnaW4tYm90dG9tOjEycHg7Zm9udC1zaXplOiR7c21hbGx9cHg7XCI+XG4gICAgICAgICAgICAgIDxzcGFuPiR7ZXNjYXBlSHRtbChkYXRhLndvcmtzcGFjZSkuc3BsaXQoXCIgwrcgXCIpLmpvaW4oYCA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5kaW19O1wiPsK3PC9zcGFuPiBgKX08L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuPlt0dXJuOiAke3R1cm5TZWMudG9GaXhlZCgxKX1zLCDihpMke3Rva2Vucy50b0ZpeGVkKDEpfWtdIDxzcGFuIHN0eWxlPVwiY29sb3I6JHtDLmRpbX07XCI+W8OXXTwvc3Bhbj48L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgJHtcbiAgICAgICAgICAgICAgcHJvbXB0VmlzaWJsZVxuICAgICAgICAgICAgICAgID8gYDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjEwcHg7XCI+PHNwYW4gc3R5bGU9XCJjb2xvcjoke0MudGV4dH07XCI+4p2vPC9zcGFuPiA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Qy5zb2Z0fTtcIj4ke3Byb21wdFRleHR9PC9zcGFuPiR7IXByb21wdERvbmUgPyBjdXJzb3JIdG1sIDogXCJcIn08L2Rpdj5gXG4gICAgICAgICAgICAgICAgOiBcIlwiXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICR7dGhvdWdodEh0bWx9XG4gICAgICAgICAgICAke3BsYW5IdG1sfVxuICAgICAgICAgICAgJHthZ2VudHNCbG9ja31cblxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MTtcIj48L2Rpdj5cblxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Y29sb3I6JHtDLm11dGVkfTttYXJnaW4tYm90dG9tOjhweDtvcGFjaXR5OiR7cHJvZ3Jlc3NPcGFjaXR5fTtmb250LXNpemU6JHtzbWFsbH1weDt3aGl0ZS1zcGFjZTpwcmU7XCI+XG4gICAgICAgICAgICAgIDxzcGFuPnw8L3NwYW4+PHNwYW4gc3R5bGU9XCJjb2xvcjoke0Muc29mdH07XCI+JHtiYXJ9PC9zcGFuPjxzcGFuPiAke3BjdC50b0ZpeGVkKDIpfSU8L3NwYW4+PHNwYW4+fDwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyLXRvcDowLjVweCBzb2xpZCAke0MuYm9yZGVyU29mdH07cGFkZGluZy10b3A6OHB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweDtcIj5cbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MudGV4dH07XCI+4p2vPC9zcGFuPlxuICAgICAgICAgICAgICAke2N1cnNvckh0bWx9XG4gICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxO1wiPjwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MubXV0ZWR9O2ZvbnQtc2l6ZToke3NtYWxsfXB4O1wiPiR7ZXNjYXBlSHRtbChkYXRhLm1vZGVsKX0gPHNwYW4gc3R5bGU9XCJjb2xvcjoke0MuZGltfTtcIj7Ctzwvc3Bhbj4gJHtlc2NhcGVIdG1sKG1vZGUpfTwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L21haW4+XG4gICAgICA8L2Rpdj5cbiAgICBgO1xuICB9LFxufSk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJBLFNBQVMsT0FBTyxPQUFPO0VBQ3RCLE1BQU0sU0FBUyxNQUFNLFVBQVU7RUFDL0IsTUFBTSxJQUFJLE1BQU07RUFDaEIsTUFBTSxhQUFhLE9BQU8sTUFBTSxZQUFZO0VBQzVDLE9BQU87R0FDTjtHQUNBLFVBQVUsQ0FBQyxDQUFDLEtBQUssT0FBTyxFQUFFLFFBQVEsYUFBYSxFQUFFLFlBQVksUUFBUTtHQUNyRSxRQUFRLE1BQU07R0FDZCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0s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