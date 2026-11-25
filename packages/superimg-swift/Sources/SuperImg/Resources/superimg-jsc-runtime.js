(function() {
	// \0rolldown/runtime.js
	var __defProp$1 = Object.defineProperty;
	var __commonJSMin$1 = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
	var __exportAll$1 = (all, flags) => {
		let target = Object.setPrototypeOf({}, null);
		for (var name in all) __defProp$1(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!(flags & 1)) __defProp$1(target, Symbol.toStringTag, { value: "Module" });
		return flags & 2 ? target : Object.preventExtensions(target);
	};
	// packages/superimg-types/dist/index.js
	//! Serializable JSON-shaped values for template data defaults and CLI loaders.
	//! Authoring tree — render() returns a node; the runtime lowers to HTML/SVG.
	//! Raw markup is available only through the explicit Html() node.
	/** Editing masters; source capture precision and color space remain unchanged. */
	const PRORES_MASTER_ENCODING = {
		format: "mov",
		capture: { intermediate: "png" },
		video: {
			codec: "prores",
			quality: "very-high",
			alpha: "discard"
		},
		audio: {
			codec: "aac",
			quality: "high"
		}
	};
	({ ...PRORES_MASTER_ENCODING }), { ...PRORES_MASTER_ENCODING.video };
	//! Cortex task material. Not an Ops operation and not an export bundle.
	//! Untrusted JSON becomes a bundle only through parseCortexBundle.
	const EDITORIAL_INTENTS = [
		"decision_support",
		"status",
		"explanation",
		"memory"
	];
	const EDITORIAL_AUDIENCES = [
		"owner",
		"team",
		"public"
	];
	const VISUAL_ATOM_KINDS = [
		"metric",
		"series",
		"event",
		"table",
		"entity",
		"relation",
		"text",
		"image",
		"video",
		"code",
		"geo",
		"duration",
		"status",
		"evidence"
	];
	const CORTEX_ASSET_KINDS = [
		"image",
		"video",
		"file"
	];
	new Set(EDITORIAL_INTENTS);
	new Set(EDITORIAL_AUDIENCES);
	new Set(VISUAL_ATOM_KINDS);
	new Set(CORTEX_ASSET_KINDS);
	//! SuperImg Types - Core type definitions
	//! Explicit, typed, self-documenting interfaces for templates, rendering, and playback
	//! Canonical deterministic media definitions and authoring helpers.
	//!
	//! `video()`, `image()`, `svg()`, and `ogImage()` are the concise authoring
	//! surface. They all lower to the same `MediaDefinition` returned by `define()`.
	//! Delivery destinations and file paths are deliberately absent from this layer.
	//! Shared execution controls for bounded, cancellable render work.
	//! Result types and structured errors
	//! Discriminated unions for async operations with actionable error messages
	/**
	* Base error class for all SuperImg errors
	*/
	var SuperImgError = class extends Error {
		code;
		details;
		suggestion;
		docsUrl;
		/** Mapped source location (populated by enrichError when sourcemap available) */
		location;
		/** Vite-style code frame string (populated by enrichError when source content available) */
		codeFrame;
		constructor(message, code, details, suggestion, docsUrl, options) {
			super(message, options && "cause" in options ? { cause: options.cause } : void 0);
			this.code = code;
			this.details = details;
			this.suggestion = suggestion;
			this.docsUrl = docsUrl;
			this.name = "SuperImgError";
			const captureStackTrace = Error.captureStackTrace;
			if (captureStackTrace) captureStackTrace(this, this.constructor);
		}
		/** Convert to a plain object for logging/serialization */
		toJSON() {
			return {
				name: this.name,
				code: this.code,
				message: this.message,
				details: this.details,
				suggestion: this.suggestion,
				...this.docsUrl !== void 0 ? { docsUrl: this.docsUrl } : {},
				...this.location !== void 0 ? { location: this.location } : {},
				...this.codeFrame !== void 0 ? { codeFrame: this.codeFrame } : {}
			};
		}
	};
	/**
	* True for a SuperImgError from this module copy or a duplicated one.
	* Cross-realm copies fail `instanceof`, so name, code, suggestion, and details
	* are accepted as the same shape.
	*/
	function isSuperImgError(value, code) {
		if (typeof value !== "object" || value === null) return false;
		const candidate = value;
		const shaped = typeof candidate.name === "string" && candidate.name.length > 0 && typeof candidate.code === "string" && typeof candidate.suggestion === "string" && typeof candidate.details === "object" && candidate.details !== null;
		if (!shaped && !(value instanceof SuperImgError)) return false;
		if (code !== void 0 && candidate.code !== code) return false;
		return value instanceof SuperImgError || shaped;
	}
	/**
	* Template compilation failed
	*/
	var TemplateCompilationError = class extends SuperImgError {
		constructor(details) {
			const location = details.line ? ` at line ${details.line}` : "";
			const defaultSuggestion = `Check the template syntax${location}. Ensure the render function returns a valid media tree.`;
			super(`Template compilation failed${location}: ${details.syntaxError}`, "TEMPLATE_COMPILATION_ERROR", details, details.suggestion ?? defaultSuggestion, "https://superimg.dev/docs/templates");
			this.name = "TemplateCompilationError";
			if (details.file && details.line !== void 0) this.location = {
				file: details.file,
				line: details.line,
				...details.column !== void 0 ? { column: details.column } : {}
			};
		}
	};
	//! Player input guards shared across packages.
	//! Canonical PlayerOptions / PlayerEvents live in @superimg/player.
	//! MediaIR — experimental draft intermediate representation between authoring and render.
	//! Browser-safe contracts only (no DOM/Node types).
	"a".repeat(64);
	//! Public, value-first runtime contracts.
	//!
	//! These types deliberately contain no source paths, host identities, URLs,
	//! filesystem handles, Buffer, or Blob. Hosts may associate an authored value
	//! with their own identity before or after invoking the runtime.
	//! Deterministic collection authoring contracts.
	//!
	//! A collection runs one media definition against a complete, finite entry
	//! snapshot. Entry providers are server-only and are projected out before any
	//! browser program is bundled.
	//! SuperImg Types - Pure TypeScript type definitions
	//! Core types, interfaces, and error classes for templates, rendering, and playback
	// packages/superimg-core/src/shared/stdlib-capability-types.ts
	const STDLIB_CAPABILITIES = [
		"math",
		"color",
		"date",
		"text",
		"layout",
		"svg",
		"viz",
		"subtitle",
		"backgrounds",
		"montage",
		"path",
		"reveal",
		"responsive",
		"carousel",
		"stack",
		"spring",
		"stagger",
		"timing",
		"phases",
		"motion",
		"safe-area",
		"oscillate",
		"ready",
		"layout-timeline",
		"interpolate",
		"code",
		"rough",
		"katex",
		"lottie",
		"mermaid",
		"three"
	];
	new Set(STDLIB_CAPABILITIES);
	// packages/superimg-core/src/shared/stdlib-capability-detection.ts
	/**
	* Compiler/fallback-only capability discovery. Shipped stamped programs do not
	* pull these source-analysis heuristics into the common Player graph.
	*/
	const CAPABILITY_PATTERNS = [
		["math", /\bstd\.math\b/],
		["color", /\bstd\.color\b|\bstd\.interpolateColor\b/],
		["date", /\bstd\.date\b/],
		["text", /\bstd\.text\b/],
		["layout", /\bstd\.layout\b/],
		["svg", /\bstd\.svg\.(?!rough\b)/],
		["viz", /\bstd\.viz\.(?!(?:katex|equation|equationSteps|equationMatch|katexCss|lottie|mermaid|three)\b)/],
		["subtitle", /\bstd\.subtitle\b/],
		["backgrounds", /\bstd\.backgrounds\b/],
		["montage", /\bstd\.montage\b/],
		["path", /\bstd\.path\b/],
		["reveal", /\bstd\.reveal\b/],
		["responsive", /\bstd\.(?:responsive|createResponsive)\b/],
		["carousel", /\bstd\.carousel\b/],
		["stack", /\bstd\.stack\b/],
		["spring", /\bstd\.spring\b/],
		["stagger", /\bstd\.stagger\b/],
		["timing", /\bstd\.timing\b/],
		["phases", /\bstd\.phases\b/],
		["motion", /\bstd\.motion\b/],
		["safe-area", /\bstd\.(?:safeArea|safeBox)\b/],
		["oscillate", /\bstd\.(?:oscillate|loop|pingpong|wiggle)\b/],
		["ready", /\bstd\.ready\b/],
		["layout-timeline", /\bstd\.layoutTimeline\b/],
		["interpolate", /\bstd\.interpolate\b/],
		["code", /\bstd\.code\b/],
		["rough", /\bstd\.svg\.rough\b/],
		["katex", /\bstd\.viz\.katex\b|\bstd\.viz\.(?:equation|equationSteps|equationMatch|katexCss)\b/],
		["lottie", /\bstd\.viz\.lottie\b/],
		["mermaid", /\bstd\.viz\.mermaid\b/],
		["three", /\bstd\.viz\.three\b/]
	];
	function expandStdlibNamespaceAliases(source) {
		const rootAliases = /* @__PURE__ */ new Set();
		for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\.)?std\b(?!\.)/g)) rootAliases.add(match[1]);
		for (const declaration of source.matchAll(/\b(?:const|let|var)\s*\{([^{}]*)\}\s*=/g)) for (const binding of declaration[1].matchAll(/(?:^|,)\s*std\s*:\s*([A-Za-z_$][\w$]*)\s*(?=,|$)/g)) rootAliases.add(binding[1]);
		let normalized = source;
		for (const alias of rootAliases) {
			const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			normalized = normalized.replace(new RegExp(`\\b${escaped}\\.`, "g"), "std.").replace(new RegExp(`\\b${escaped}\\s*\\[`, "g"), "std[");
		}
		const aliases = /* @__PURE__ */ new Map();
		for (const match of normalized.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\.)?std\.(math|color|date|text|layout|viz|svg|subtitle|backgrounds|path|responsive|timing|phases|motion|code)\b/g)) aliases.set(match[1], match[2]);
		if (aliases.size === 0) return normalized;
		const expanded = [normalized];
		for (const [alias, namespace] of aliases) {
			const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			expanded.push(normalized.replace(new RegExp(`\\b${escaped}\\.`, "g"), `std.${namespace}.`));
		}
		return expanded.join("\n");
	}
	function stampKeys(template) {
		const keys = [template];
		const render = template.render;
		if (typeof render === "function") keys.push(render);
		return keys;
	}
	const stampedCapabilities = /* @__PURE__ */ new WeakMap();
	const stampedMediaCapabilities = /* @__PURE__ */ new WeakMap();
	function readStamped(template) {
		for (const key of stampKeys(template)) {
			const capabilities = stampedCapabilities.get(key);
			if (capabilities) return capabilities;
		}
	}
	function detectStdlibCapabilitiesFromSource(source) {
		const expandedSource = expandStdlibNamespaceAliases(source);
		if (/\b(?:ctx\.)?std(?:\.[A-Za-z_$][\w$]*)*\s*\[/.test(expandedSource)) return [...STDLIB_CAPABILITIES];
		return CAPABILITY_PATTERNS.flatMap(([name, pattern]) => pattern.test(expandedSource) ? [name] : []);
	}
	function detectMediaCapabilitiesFromSource(source) {
		const names = new Set(detectStdlibCapabilitiesFromSource(source));
		if (/\bstd\.viz\.canvas\b|\b<canvas\b/i.test(source)) names.add("canvas");
		if (/\bstd\.viz\.three\b|WebGLRenderer|webgl/i.test(source)) names.add("webgl");
		if (/\bstd\.viz\.lottie\b/.test(source)) names.add("lottie");
		if (/<script\b/i.test(source) || /\bstd\.viz\.(?:canvas|three|lottie)\b/.test(source)) names.add("scripts");
		if (/\btailwind\s*:/.test(source) || /\bconfig\.tailwind\b/.test(source)) names.add("tailwind");
		if (/\bactions\s*:\s*\[/.test(source) && /data-si-actions|actions:\s*\[/.test(source)) names.add("interactive");
		if (/@keyframes\b|animation-name\s*:/i.test(source)) names.add("css-animation");
		if (/\bfonts\s*:/.test(source)) names.add("fonts");
		return {
			version: 0,
			names: [...names]
		};
	}
	function stampStdlibCapabilitiesFromSource(template, bundledSource) {
		const capabilities = detectStdlibCapabilitiesFromSource(bundledSource);
		const mediaCapabilities = detectMediaCapabilitiesFromSource(bundledSource);
		for (const key of stampKeys(template)) {
			stampedCapabilities.set(key, capabilities);
			stampedMediaCapabilities.set(key, mediaCapabilities);
		}
		Object.defineProperty(template, "mediaCapabilities", {
			value: mediaCapabilities,
			enumerable: true,
			configurable: true,
			writable: true
		});
	}
	function getStampedMediaCapabilities(template) {
		for (const key of stampKeys(template)) {
			const capabilities = stampedMediaCapabilities.get(key);
			if (capabilities) return capabilities;
		}
		const direct = template.mediaCapabilities;
		return direct?.version === 0 ? direct : void 0;
	}
	function copyStdlibCapabilityStamp(from, to) {
		const capabilities = readStamped(from);
		if (capabilities) for (const key of stampKeys(to)) stampedCapabilities.set(key, capabilities);
		const mediaCapabilities = getStampedMediaCapabilities(from);
		if (!mediaCapabilities) return;
		for (const key of stampKeys(to)) stampedMediaCapabilities.set(key, mediaCapabilities);
		Object.defineProperty(to, "mediaCapabilities", {
			value: mediaCapabilities,
			enumerable: true,
			configurable: true,
			writable: true
		});
	}
	// packages/superimg-core/src/errors/compiler-diagnostics.ts
	const clean = (value) => value.replace(/\u001b\[[0-9;]*m/g, "");
	const record = (value) => typeof value === "object" && value !== null ? value : void 0;
	const string = (value) => typeof value === "string" ? value : void 0;
	const number = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
	/** Rolldown aggregates and OXC records share one JSON-safe diagnostic contract. */
	function compilerDiagnostics(error, stage, file) {
		const records = [];
		const seen = /* @__PURE__ */ new Set();
		const visit = (value) => {
			const item = record(value);
			if (!item || seen.has(item)) return;
			seen.add(item);
			const retained = item.compilerDiagnostics ?? record(item.details)?.compilerDiagnostics;
			if (Array.isArray(retained) && retained.length) {
				records.push(...retained);
				return;
			}
			if (Array.isArray(item.errors) && item.errors.length) {
				item.errors.forEach(visit);
				return;
			}
			const loc = record(item.loc ?? item.location);
			const sourceFile = string(loc?.file ?? item.filename ?? item.id) ?? file;
			const line = number(loc?.line);
			const column = number(loc?.column);
			const help = string(item.helpMessage ?? item.help);
			const plugin = string(item.plugin);
			const labels = (Array.isArray(item.labels) ? item.labels : item.range ? [item.range] : []).flatMap((value) => {
				const label = record(value);
				const start = number(label?.start);
				const end = number(label?.end);
				const message = string(label?.message);
				return start !== void 0 && end !== void 0 ? [{
					start,
					end,
					...message ? { message } : {}
				}] : [];
			});
			const code = string(item.code ?? item.kind) ?? "TEMPLATE_COMPILATION_ERROR";
			records.push({
				code,
				severity: item.severity === "Warning" || item.severity === "warning" ? "warning" : "error",
				stage: /^(?:MISSING_EXPORT|UNRESOLVED_IMPORT|UNRESOLVED_ENTRY)$/.test(code) ? "resolve" : stage,
				message: clean(string(item.message) ?? String(value)),
				...sourceFile ? { file: sourceFile } : {},
				...line !== void 0 ? { line } : {},
				...column !== void 0 ? { column } : {},
				...labels.length ? { labels } : {},
				...help ? { help } : {},
				...plugin ? { plugin } : {}
			});
		};
		visit(error);
		if (!records.length) records.push({
			code: "TEMPLATE_COMPILATION_ERROR",
			severity: "error",
			stage,
			message: clean(String(error)),
			...file ? { file } : {}
		});
		return records;
	}
	/** Preserve native/source codes and every record across CLI JSON and React. */
	function normalizeCompilerError(error, stage, file) {
		const diagnostics = compilerDiagnostics(error, stage, file);
		const primary = diagnostics[0];
		const result = isSuperImgError(error) ? error : new TemplateCompilationError({
			syntaxError: primary.message,
			...primary.file ? { file: primary.file } : {},
			...primary.line !== void 0 ? { line: primary.line } : {},
			...primary.column !== void 0 ? { column: primary.column } : {},
			...primary.help ? { suggestion: primary.help } : {}
		});
		if (!isSuperImgError(error) && typeof record(error)?.code === "string") Object.assign(result, { code: record(error).code });
		if (!isSuperImgError(error) && error instanceof Error && error.stack) result.stack = error.stack;
		Object.assign(result, { compilerDiagnostics: Object.freeze(diagnostics) });
		Object.assign(result.details, { compilerDiagnostics: diagnostics });
		return result;
	}
	// packages/superimg-core/src/rendering/compiler.ts
	//! Template compilation - evaluates pre-bundled code into TemplateModule
	/**
	* Evaluates pre-bundled template code into a TemplateModule.
	* Expects IIFE-format code with __template global (output of rolldown bundling).
	*
	* Returns a CompileResult — `error` is a SuperImgError subclass (TemplateCompilationError)
	* when compilation fails. Engine layer enriches the error with sourcemap-mapped
	* location + code frame before surfacing to users.
	*/
	function compileTemplate(input) {
		const bundledCode = typeof input === "string" ? input : input.code;
		const nativeModules = Object.fromEntries((typeof input === "string" ? [] : input.nativeModuleSets ?? []).map((set) => [set.identity, set.outputs]));
		let factory;
		try {
			factory = new Function("__superimgNativeModules", bundledCode + "\nreturn __template;");
		} catch (e) {
			return { error: normalizeCompilerError(e, "evaluate") };
		}
		let exports;
		try {
			exports = factory(nativeModules);
		} catch (e) {
			return { error: normalizeCompilerError(e, "evaluate") };
		}
		const def = exports?.default;
		if (!def || def.kind !== "media" && def.kind !== "interactive" || typeof def.render !== "function") return { error: new TemplateCompilationError({
			syntaxError: "Media source must export a deterministic media or interactive definition",
			suggestion: "Export `video(...)`, `image(...)`, `svg(...)`, `ogImage(...)`, `define(...)`, or `defineInteractive(...)` as the default value."
		}) };
		if (def.kind === "interactive") return { interactive: def };
		const config = def.config;
		const hasResolve = typeof def.resolve === "function";
		const animated = typeof def.animated === "boolean" ? def.animated : !!config && typeof config.fps === "number" && (config.duration != null || hasResolve);
		const media = {
			kind: "media",
			media: def.media,
			fallbackFormat: def.fallbackFormat,
			medium: def.medium ?? "html",
			animated: typeof def.animated === "boolean" ? def.animated : animated,
			render: def.render,
			...def.config !== void 0 ? { config: def.config } : {},
			...def.sample !== void 0 ? { sample: def.sample } : {},
			...def.editions !== void 0 ? { editions: def.editions } : {},
			...def.variants !== void 0 ? { variants: def.variants } : {},
			...def.poster !== void 0 ? { poster: def.poster } : {},
			...def.composition !== void 0 ? { composition: def.composition } : {},
			...hasResolve ? { resolve: def.resolve } : {}
		};
		if (getStampedMediaCapabilities(def)) copyStdlibCapabilityStamp(def, media);
		else stampStdlibCapabilitiesFromSource(media, bundledCode);
		return { media };
	}
	// node_modules/.pnpm/@emotion+unitless@0.10.0/node_modules/@emotion/unitless/dist/emotion-unitless.cjs.js
	var require_emotion_unitless_cjs = /* @__PURE__ */ __commonJSMin$1(((exports) => {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports["default"] = {
			animationIterationCount: 1,
			aspectRatio: 1,
			borderImageOutset: 1,
			borderImageSlice: 1,
			borderImageWidth: 1,
			boxFlex: 1,
			boxFlexGroup: 1,
			boxOrdinalGroup: 1,
			columnCount: 1,
			columns: 1,
			flex: 1,
			flexGrow: 1,
			flexPositive: 1,
			flexShrink: 1,
			flexNegative: 1,
			flexOrder: 1,
			gridRow: 1,
			gridRowEnd: 1,
			gridRowSpan: 1,
			gridRowStart: 1,
			gridColumn: 1,
			gridColumnEnd: 1,
			gridColumnSpan: 1,
			gridColumnStart: 1,
			msGridRow: 1,
			msGridRowSpan: 1,
			msGridColumn: 1,
			msGridColumnSpan: 1,
			fontWeight: 1,
			lineHeight: 1,
			opacity: 1,
			order: 1,
			orphans: 1,
			scale: 1,
			tabSize: 1,
			widows: 1,
			zIndex: 1,
			zoom: 1,
			WebkitLineClamp: 1,
			fillOpacity: 1,
			floodOpacity: 1,
			stopOpacity: 1,
			strokeDasharray: 1,
			strokeDashoffset: 1,
			strokeMiterlimit: 1,
			strokeOpacity: 1,
			strokeWidth: 1
		};
	}));
	// node_modules/.pnpm/@emotion+unitless@0.10.0/node_modules/@emotion/unitless/dist/emotion-unitless.cjs.default.js
	var require_emotion_unitless_cjs_default = /* @__PURE__ */ __commonJSMin$1(((exports) => {
		exports._default = require_emotion_unitless_cjs().default;
	}));
	require_emotion_unitless_cjs();
	var import_emotion_unitless_cjs_default = require_emotion_unitless_cjs_default();
	// packages/superimg-stdlib/dist/css.js
	/**
	* CSS style utilities for SuperImg templates
	*
	* Converts style objects to inline style strings with auto-px for numeric values.
	* Use for dynamic per-frame styles; pair with config.inlineCss/config.stylesheets for static utility classes.
	*
	* @example
	* ```ts
	* std.css({ width: 1920, height: 1080, opacity: 0.8 })
	* // "width:1920px;height:1080px;opacity:0.8"
	*
	* std.css.fill()
	* // "position:absolute;top:0;left:0;width:100%;height:100%"
	* ```
	*/
	/** Canonical unitless properties (camelCase) from @emotion/unitless */
	const UNITLESS_KEYS = new Set(Object.keys(import_emotion_unitless_cjs_default._default));
	function camelToKebab(str) {
		const kebab = str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
		if (/^(webkit|moz|ms|o)-/.test(kebab)) return `-${kebab}`;
		return kebab;
	}
	function kebabToCamel(str) {
		return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
	}
	function isUnitlessProperty(key) {
		if (key.startsWith("--")) return true;
		const camel = key.includes("-") ? kebabToCamel(key) : key;
		if (UNITLESS_KEYS.has(camel)) return true;
		const unprefixed = camel.replace(/^(Webkit|Moz|ms|O)/, "");
		const normalized = unprefixed ? unprefixed.charAt(0).toLowerCase() + unprefixed.slice(1) : "";
		return normalized ? UNITLESS_KEYS.has(normalized) : false;
	}
	const properties = /* @__PURE__ */ new Map();
	function property(key) {
		const cached = properties.get(key);
		if (cached) return cached;
		const result = {
			name: camelToKebab(key),
			unitless: isUnitlessProperty(key)
		};
		if (key.length <= 64 && !key.startsWith("--")) {
			if (properties.size >= 256) properties.delete(properties.keys().next().value);
			properties.set(key, result);
		}
		return result;
	}
	function serializeValue(unitless, value) {
		if (typeof value === "number") {
			if (unitless) return String(value);
			return `${value}px`;
		}
		return String(value);
	}
	/**
	* Convert style objects and preset strings to an inline style string.
	* Accepts any mix of style objects and preset strings (from css.fill(), css.center(), etc.).
	* Numeric values get 'px' appended except for unitless properties (opacity, zIndex, etc.).
	* null/undefined values are omitted. Empty strings are ignored.
	*
	* @param args - Style objects and/or preset strings to combine
	* @returns Semicolon-separated inline style string
	*
	* @example
	* ```ts
	* std.css({ width: 1920, height: 1080 }, std.css.center())
	* // "width:1920px;height:1080px;display:flex;align-items:center;justify-content:center"
	* ```
	*/
	function css(...args) {
		const parts = [];
		for (const arg of args) if (typeof arg === "string") {
			if (arg) parts.push(arg);
		} else for (const [key, value] of Object.entries(arg)) {
			if (value === null || value === void 0) continue;
			const metadata = property(key);
			parts.push(`${metadata.name}:${serializeValue(metadata.unitless, value)}`);
		}
		return parts.join(";");
	}
	/**
	* Preset: fill container (position absolute, full width/height).
	* Use for root/wrapper divs that should cover the canvas.
	*/
	function fill() {
		return "position:absolute;top:0;left:0;width:100%;height:100%";
	}
	/**
	* Preset: flexbox center (horizontal and vertical).
	* Use for centering content.
	*/
	function center() {
		return "display:flex;align-items:center;justify-content:center";
	}
	/**
	* Preset: flexbox column layout.
	* Use for vertical layouts.
	*/
	function column() {
		return "display:flex;flex-direction:column";
	}
	/**
	* Preset: flexbox row layout.
	* Use for horizontal layouts (opposite of stack).
	*/
	function row() {
		return "display:flex;flex-direction:row";
	}
	/**
	* Fine grain / dither style fragment for banding reduction on gradients.
	* Returns only CSS (background SVG data-URI + blend). Mount as a full-bleed
	* layer or combine with `std.css.fill()`.
	*/
	function ditherNoise(opts = {}) {
		const opacity = opts.opacity ?? .04;
		const blend = opts.blendMode ?? "overlay";
		const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${opts.frequency ?? .65}' numOctaves='3' seed='${opts.seed ?? 1}' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>`;
		return [
			`background-image:${`url("data:image/svg+xml,${encodeURIComponent(svg)}")`}`,
			"background-repeat:repeat",
			"background-size:128px 128px",
			`opacity:${opacity}`,
			`mix-blend-mode:${blend}`,
			"pointer-events:none"
		].join(";");
	}
	/**
	* Translucent glass material style recipe (backdrop-filter + fill + border).
	* Pair with a positioned container; does not emit HTML structure.
	*/
	function appleGlass(opts = {}) {
		const blur = opts.blur ?? 20;
		const fill = opts.fill ?? "rgba(255,255,255,0.12)";
		const border = opts.border ?? "1px solid rgba(255,255,255,0.22)";
		const radius = typeof opts.radius === "number" ? `${opts.radius}px` : opts.radius ?? "16px";
		const shadow = opts.shadow ?? "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)";
		return [
			`background:${fill}`,
			`-webkit-backdrop-filter:saturate(180%) blur(${blur}px)`,
			`backdrop-filter:saturate(180%) blur(${blur}px)`,
			`border:${border}`,
			`border-radius:${radius}`,
			`box-shadow:${shadow}`
		].join(";");
	}
	// packages/superimg-stdlib/dist/rolldown-runtime.js
	var __defProp = Object.defineProperty;
	var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
	var __exportAll = (all, flags) => {
		let target = Object.setPrototypeOf({}, null);
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!(flags & 1)) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return flags & 2 ? target : Object.preventExtensions(target);
	};
	// packages/superimg-stdlib/dist/easing2.js
	var easing_exports$1 = /* @__PURE__ */ __exportAll({
		EASING_NAMES: () => EASING_NAMES,
		clamp01: () => clamp01$1,
		easeInBack: () => easeInBack,
		easeInBounce: () => easeInBounce,
		easeInCirc: () => easeInCirc,
		easeInCubic: () => easeInCubic,
		easeInElastic: () => easeInElastic,
		easeInExpo: () => easeInExpo,
		easeInOutBack: () => easeInOutBack,
		easeInOutBounce: () => easeInOutBounce,
		easeInOutCirc: () => easeInOutCirc,
		easeInOutCubic: () => easeInOutCubic,
		easeInOutElastic: () => easeInOutElastic,
		easeInOutExpo: () => easeInOutExpo,
		easeInOutQuad: () => easeInOutQuad,
		easeInOutQuart: () => easeInOutQuart,
		easeInOutQuint: () => easeInOutQuint,
		easeInOutSine: () => easeInOutSine,
		easeInQuad: () => easeInQuad,
		easeInQuart: () => easeInQuart,
		easeInQuint: () => easeInQuint,
		easeInSine: () => easeInSine,
		easeOutBack: () => easeOutBack,
		easeOutBounce: () => easeOutBounce,
		easeOutCirc: () => easeOutCirc,
		easeOutCubic: () => easeOutCubic,
		easeOutElastic: () => easeOutElastic,
		easeOutExpo: () => easeOutExpo,
		easeOutQuad: () => easeOutQuad,
		easeOutQuart: () => easeOutQuart,
		easeOutQuint: () => easeOutQuint,
		easeOutSine: () => easeOutSine,
		linear: () => linear$1
	});
	/**
	* Easing functions for SuperImg animations
	*
	* All functions take a normalized time value `t` in the range [0, 1]
	* and return an eased value, typically also in [0, 1].
	*
	* @example
	* ```ts
	* import { easeOutCubic } from '@foxworth/superimg/stdlib/easing';
	*
	* const progress = easeOutCubic(0.5); // 0.875
	* ```
	*/
	/**
	* Clamp a value to the range [0, 1]
	*/
	function clamp01$1(t) {
		return Math.max(0, Math.min(1, t));
	}
	/** Named easing keys supported by public animation helpers */
	const EASING_NAMES = [
		"linear",
		"easeInQuad",
		"easeOutQuad",
		"easeInOutQuad",
		"easeInSine",
		"easeOutSine",
		"easeInOutSine",
		"easeInCubic",
		"easeOutCubic",
		"easeInOutCubic",
		"easeInQuart",
		"easeOutQuart",
		"easeInOutQuart",
		"easeInQuint",
		"easeOutQuint",
		"easeInOutQuint",
		"easeInExpo",
		"easeOutExpo",
		"easeInOutExpo",
		"easeInCirc",
		"easeOutCirc",
		"easeInOutCirc",
		"easeInBack",
		"easeOutBack",
		"easeInOutBack",
		"easeInElastic",
		"easeOutElastic",
		"easeInOutElastic",
		"easeInBounce",
		"easeOutBounce",
		"easeInOutBounce"
	];
	/**
	* Linear easing (no easing, identity function).
	* @ai-hint Use for constant-speed movement or when easing is applied elsewhere.
	* @param t - Normalized time in [0, 1] (clamped internally)
	* @returns The clamped input value
	*/
	function linear$1(t) {
		return clamp01$1(t);
	}
	function easeInQuad(t) {
		const x = clamp01$1(t);
		return x * x;
	}
	function easeOutQuad(t) {
		const x = 1 - clamp01$1(t);
		return 1 - x * x;
	}
	function easeInOutQuad(t) {
		const x = clamp01$1(t);
		return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
	}
	function easeInSine(t) {
		const x = clamp01$1(t);
		return 1 - Math.cos(x * Math.PI / 2);
	}
	function easeOutSine(t) {
		const x = clamp01$1(t);
		return Math.sin(x * Math.PI / 2);
	}
	function easeInOutSine(t) {
		const x = clamp01$1(t);
		return -(Math.cos(Math.PI * x) - 1) / 2;
	}
	/**
	* Cubic ease-in: slow start, accelerating toward the end.
	* @ai-hint Most common "speed up" curve. Output grows as t³.
	* @param t - Normalized time in [0, 1] (clamped internally)
	* @returns Eased value in [0, 1]
	*/
	function easeInCubic(t) {
		const x = clamp01$1(t);
		return x * x * x;
	}
	/**
	* Cubic ease-out: fast start, decelerating toward the end.
	* @ai-hint Best default for entrance animations (fade-in, slide-in).
	* @param t - Normalized time in [0, 1] (clamped internally)
	* @returns Eased value in [0, 1]
	*/
	function easeOutCubic(t) {
		const x = 1 - clamp01$1(t);
		return 1 - x * x * x;
	}
	/**
	* Cubic ease-in-out: slow start and end, fast in the middle.
	* @ai-hint Good for looping animations or elements that enter and exit.
	* @param t - Normalized time in [0, 1] (clamped internally)
	* @returns Eased value in [0, 1]
	*/
	function easeInOutCubic(t) {
		const x = clamp01$1(t);
		return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
	}
	function easeInQuart(t) {
		const x = clamp01$1(t);
		return x * x * x * x;
	}
	function easeOutQuart(t) {
		const x = 1 - clamp01$1(t);
		return 1 - x * x * x * x;
	}
	function easeInOutQuart(t) {
		const x = clamp01$1(t);
		return x < .5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
	}
	function easeInQuint(t) {
		const x = clamp01$1(t);
		return x * x * x * x * x;
	}
	function easeOutQuint(t) {
		const x = 1 - clamp01$1(t);
		return 1 - x * x * x * x * x;
	}
	function easeInOutQuint(t) {
		const x = clamp01$1(t);
		return x < .5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
	}
	function easeInExpo(t) {
		const x = clamp01$1(t);
		return x === 0 ? 0 : Math.pow(2, 10 * (x - 1));
	}
	function easeOutExpo(t) {
		const x = clamp01$1(t);
		return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
	}
	function easeInOutExpo(t) {
		const x = clamp01$1(t);
		if (x === 0) return 0;
		if (x === 1) return 1;
		return x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
	}
	function easeInCirc(t) {
		const x = clamp01$1(t);
		return 1 - Math.sqrt(1 - x * x);
	}
	function easeOutCirc(t) {
		const x = clamp01$1(t) - 1;
		return Math.sqrt(1 - x * x);
	}
	function easeInOutCirc(t) {
		const x = clamp01$1(t);
		return x < .5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
	}
	const BACK_C1 = 1.70158;
	const BACK_C3 = 2.70158;
	function easeInBack(t) {
		const x = clamp01$1(t);
		return BACK_C3 * x * x * x - BACK_C1 * x * x;
	}
	function easeOutBack(t) {
		const x = clamp01$1(t);
		return 1 + BACK_C3 * Math.pow(x - 1, 3) + BACK_C1 * Math.pow(x - 1, 2);
	}
	function easeInOutBack(t) {
		const x = clamp01$1(t);
		const c2 = BACK_C1 * 1.525;
		return x < .5 ? Math.pow(2 * x, 2) * (7.189819 * x - c2) / 2 : (Math.pow(2 * x - 2, 2) * (3.5949095 * (x * 2 - 2) + c2) + 2) / 2;
	}
	const ELASTIC_C4 = 2 * Math.PI / 3;
	function easeInElastic(t) {
		const x = clamp01$1(t);
		if (x === 0) return 0;
		if (x === 1) return 1;
		return -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * ELASTIC_C4);
	}
	function easeOutElastic(t) {
		const x = clamp01$1(t);
		if (x === 0) return 0;
		if (x === 1) return 1;
		return Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * ELASTIC_C4) + 1;
	}
	function easeInOutElastic(t) {
		const x = clamp01$1(t);
		if (x === 0) return 0;
		if (x === 1) return 1;
		return x < .5 ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * (2 * Math.PI) / 4.5)) / 2 : Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * (2 * Math.PI) / 4.5) / 2 + 1;
	}
	function bounceOut(t) {
		const n1 = 7.5625;
		const d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + .75;
		else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + .9375;
		else return n1 * (t -= 2.625 / d1) * t + .984375;
	}
	function easeInBounce(t) {
		return 1 - bounceOut(1 - clamp01$1(t));
	}
	function easeOutBounce(t) {
		return bounceOut(clamp01$1(t));
	}
	function easeInOutBounce(t) {
		const x = clamp01$1(t);
		return x < .5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2;
	}
	// packages/superimg-stdlib/dist/math-basic.js
	/** Small deterministic math core used by the browser clock/director graph. */
	const lerp$1 = (a, b, t) => a + (b - a) * t;
	const clamp$1 = (value, min, max) => Math.min(Math.max(value, min), max);
	const inverseLerp$1 = (a, b, value) => a === b ? 0 : (value - a) / (b - a);
	const repeat$2 = (value, length) => clamp$1(value - Math.floor(value / length) * length, 0, length);
	const pingPong$1 = (value, length) => {
		const repeated = repeat$2(value, length * 2);
		return length - Math.abs(repeated - length);
	};
	// packages/superimg-stdlib/dist/motion-presets.js
	const MOTION_TONES = {
		premium: {
			enterEasing: "easeInOutCubic",
			exitEasing: "easeInCubic",
			enter: {
				y: 16,
				fromOpacity: 0
			},
			exitSpeed: 1.25,
			stagger: {
				eachMs: 50,
				capMs: 400
			},
			overshoot: false
		},
		playful: {
			enterEasing: "playful",
			exitEasing: "easeInCubic",
			enter: {
				y: 28,
				scale: .92,
				fromOpacity: 0
			},
			exitSpeed: 1.3,
			stagger: {
				eachMs: 60,
				capMs: 500
			},
			overshoot: true
		},
		broadcast: {
			enterEasing: "easeOutCubic",
			exitEasing: "easeInCubic",
			enter: {
				y: 12,
				fromOpacity: 0
			},
			exitSpeed: 1.2,
			stagger: {
				eachMs: 40,
				capMs: 350
			},
			overshoot: false
		},
		social: {
			enterEasing: "easeOutExpo",
			exitEasing: "easeInQuart",
			enter: {
				y: 32,
				scale: .94,
				fromOpacity: 0
			},
			exitSpeed: 1.35,
			stagger: {
				eachMs: 45,
				capMs: 450
			},
			overshoot: false
		}
	};
	function getMotionTone(tone) {
		const t = MOTION_TONES[tone];
		if (!t) throw new Error(`Unknown motion tone "${tone}". Known: ${Object.keys(MOTION_TONES).join(", ")}`);
		return t;
	}
	function motionStyle(tone, overrides) {
		const t = getMotionTone(tone);
		return {
			y: t.enter.y,
			scale: t.enter.scale,
			blur: t.enter.blur,
			fromOpacity: t.enter.fromOpacity ?? 0,
			easing: t.enterEasing,
			exitEasing: t.exitEasing,
			...overrides
		};
	}
	/** Namespace for `std.motion`. */
	const motion = {
		style: motionStyle,
		tones: MOTION_TONES,
		getTone: getMotionTone
	};
	// packages/superimg-stdlib/dist/spring.js
	/**
	* Spring physics interpolation for SuperImg animations.
	*
	* Single entry point: `spring(from, to, progress, config?)` returns an
	* interpolated value driven by an analytical damped harmonic oscillator.
	*
	* Named presets encode craft defaults (critically damped by default).
	*
	* @example
	* ```ts
	* const x = std.spring(0, 500, p, "gentle");
	* d.motion({ scale: 0.92, easing: "playful" });
	* ```
	*/
	/** Critically damped / near-critical named springs (ζ ≈ 1 unless noted). */
	const SPRINGS = {
		/** Default: premium settle, no visible bounce (ζ ≈ 1). */
		gentle: {
			stiffness: 170,
			damping: 26,
			mass: 1
		},
		/** Snappy UI settle, critically damped. */
		snappy: {
			stiffness: 380,
			damping: 39,
			mass: 1
		},
		/** Balanced fluid settle — between gentle and snappy. */
		fluid: {
			stiffness: 210,
			damping: 29,
			mass: 1
		},
		/** Soft overshoot — entrances only. */
		playful: {
			stiffness: 170,
			damping: 12,
			mass: 1
		},
		/** Expressive wobble — rare. */
		wobbly: {
			stiffness: 180,
			damping: 8,
			mass: 1
		}
	};
	const SPRING_NAMES = new Set(Object.keys(SPRINGS));
	function isSpringName(value) {
		return SPRING_NAMES.has(value);
	}
	/**
	* Resolve a spring name or partial config to a full config.
	* Omitted config → `gentle` (critically damped).
	*/
	function resolveSpring(spec, fallback = "gentle") {
		if (spec == null) return { ...SPRINGS[fallback] };
		if (typeof spec === "string") {
			if (!isSpringName(spec)) throw new Error(`Unknown spring "${spec}". Known: ${Object.keys(SPRINGS).join(", ")}`);
			return { ...SPRINGS[spec] };
		}
		const base = SPRINGS[fallback];
		return {
			stiffness: spec.stiffness ?? base.stiffness,
			damping: spec.damping ?? base.damping,
			mass: spec.mass ?? base.mass
		};
	}
	/** Map 0..1 progress to a spring-driven 0..1 curve (may overshoot if underdamped). */
	function springCurve(progress, config) {
		if (progress <= 0) return 0;
		if (progress >= 1) return 1;
		const { stiffness, damping, mass } = resolveSpring(config);
		const omega = Math.sqrt(stiffness / mass);
		const zeta = damping / (2 * Math.sqrt(stiffness * mass));
		const epsilon = .001;
		const decay = Math.max(1e-6, zeta * omega);
		const t = progress * (-Math.log(epsilon) / decay);
		if (zeta < 1) {
			const omegaD = omega * Math.sqrt(1 - zeta * zeta);
			return 1 - Math.exp(-zeta * omega * t) * Math.cos(omegaD * t);
		}
		if (zeta === 1) return 1 - (1 + omega * t) * Math.exp(-omega * t);
		const s1 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
		const s2 = -omega * (zeta - Math.sqrt(zeta * zeta - 1));
		const c2 = s1 / (s1 - s2);
		return 1 - (1 - c2) * Math.exp(s1 * t) - c2 * Math.exp(s2 * t);
	}
	/**
	* Interpolate between two values using spring physics.
	*
	* @example
	* ```ts
	* const scale = std.spring(0.8, 1, p, "gentle");
	* const x = std.spring(0, 100, p, { stiffness: 200, damping: 20 });
	* ```
	*/
	function spring(from, to, progress, config) {
		return lerp$1(from, to, springCurve(progress, config));
	}
	// packages/superimg-stdlib/dist/director2.js
	//! Phase layout normalize + motion time parsing for director().
	function parsePhaseDuration(value, totalSeconds) {
		const s = value.trim();
		if (s.endsWith("%")) {
			const pct = parseFloat(s);
			if (!Number.isFinite(pct) || pct <= 0) throw new Error(`director(): invalid phase "%": "${value}"`);
			return pct / 100;
		}
		if (s.endsWith("ms")) {
			const ms = parseFloat(s);
			if (!Number.isFinite(ms) || ms <= 0) throw new Error(`director(): invalid phase duration: "${value}"`);
			return ms / 1e3 / totalSeconds;
		}
		if (s.endsWith("s")) {
			const sec = parseFloat(s);
			if (!Number.isFinite(sec) || sec <= 0) throw new Error(`director(): invalid phase duration: "${value}"`);
			return sec / totalSeconds;
		}
		throw new Error(`director(): phase "${value}" must end with "s", "ms", or "%" (e.g. "0.6s", "15%")`);
	}
	function isWindow(value) {
		return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number" && Number.isFinite(value[0]) && Number.isFinite(value[1]);
	}
	function isPhaseValue(value) {
		return typeof value === "string" || typeof value === "number" || isWindow(value);
	}
	function isPhaseMap(value) {
		if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
		return Object.values(value).every(isPhaseValue);
	}
	/** True when the layout is `{ acts, cues }` rather than a flat phase map. */
	function isStructuredPhaseConfig(cfg) {
		if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) return false;
		const keys = Object.keys(cfg);
		if (keys.length === 0 || keys.some((key) => key !== "acts" && key !== "cues")) return false;
		const structured = cfg;
		if (structured.acts === void 0 && structured.cues === void 0) return false;
		if (structured.acts !== void 0 && !isPhaseMap(structured.acts)) return false;
		if (structured.cues !== void 0 && !isPhaseMap(structured.cues)) return false;
		return true;
	}
	function materialized(name, start, end, totalSeconds, kind) {
		const fraction = Math.max(0, end - start);
		return {
			name,
			start,
			end,
			fraction,
			duration: fraction,
			startSec: start * totalSeconds,
			endSec: end * totalSeconds,
			...kind !== void 0 ? { kind } : {}
		};
	}
	function normalizeFlat(map, totalSeconds, kind) {
		const entries = Object.entries(map);
		if (entries.length === 0) throw new Error("director(): phase layout must have at least one phase");
		const safeSeconds = totalSeconds > 0 ? totalSeconds : 1;
		const sequential = [];
		const order = [];
		for (const [name, value] of entries) {
			if (isWindow(value)) {
				if (value[0] < 0 || !(value[1] > value[0])) throw new Error(`director(): phase "${name}" window [${value[0]}, ${value[1]}] must be start < end and start ≥ 0`);
				if (value[0] >= safeSeconds) throw new Error(`director(): phase "${name}" starts at ${value[0]}s, past the ${safeSeconds}s scene`);
				const start = value[0] / safeSeconds;
				const end = Math.min(1, value[1] / safeSeconds);
				order.push({
					kind: "win",
					phase: materialized(name, start, end, safeSeconds, kind)
				});
				continue;
			}
			const fraction = typeof value === "number" ? (() => {
				if (!Number.isFinite(value) || value <= 0) throw new Error(`director(): invalid phase duration: "${value}"`);
				return value / safeSeconds;
			})() : parsePhaseDuration(value, safeSeconds);
			sequential.push({
				name,
				fraction
			});
			order.push({
				kind: "seq",
				name
			});
		}
		const total = sequential.reduce((sum, entry) => sum + entry.fraction, 0);
		if (total > 1 + Number.EPSILON * Math.max(1, sequential.length) * 4) throw new Error(`director(): phases sum to ${(total * 100).toFixed(1)}% which exceeds 100%`);
		const placed = /* @__PURE__ */ new Map();
		let acc = 0;
		for (const entry of sequential) {
			const start = acc;
			const end = Math.min(1, acc + entry.fraction);
			acc = end;
			placed.set(entry.name, materialized(entry.name, start, end, safeSeconds, kind));
		}
		return order.map((item) => item.kind === "win" ? item.phase : placed.get(item.name));
	}
	function normalizePhases(cfg, totalSeconds) {
		if (isStructuredPhaseConfig(cfg)) {
			const acts = cfg.acts ? normalizeFlat(cfg.acts, totalSeconds, "act") : [];
			const cues = cfg.cues ? normalizeFlat(cfg.cues, totalSeconds, "cue") : [];
			if (acts.length + cues.length === 0) throw new Error("director(): phase layout must have at least one phase");
			const names = /* @__PURE__ */ new Set();
			for (const phase of [...acts, ...cues]) {
				if (names.has(phase.name)) throw new Error(`director(): duplicate phase "${phase.name}"`);
				names.add(phase.name);
			}
			return [...acts, ...cues];
		}
		return normalizeFlat(cfg, totalSeconds);
	}
	/** Convert an at/for value to a scene-fraction offset within the phase. */
	function parseMotionTime(value, phaseSpan, totalSeconds) {
		if (typeof value !== "string") throw new Error(`director(): time values must be strings with units ("0.5s", "500ms", or "25%") — got ${typeof value}`);
		const s = value.trim();
		if (s.endsWith("%")) return parseFloat(s) / 100 * phaseSpan;
		if (s.endsWith("ms")) return parseFloat(s) / 1e3 / totalSeconds;
		if (s.endsWith("s")) return parseFloat(s) / totalSeconds;
		throw new Error(`director(): time "${value}" must end with "s", "ms", or "%"`);
	}
	//! Motion result CSS assembly + mergeMotion.
	function approxZero(v) {
		return Math.abs(v) < 1e-4;
	}
	function buildTransform(x, y, scale, rotate) {
		const parts = [];
		if (!approxZero(x)) parts.push(`translateX(${x}px)`);
		if (!approxZero(y)) parts.push(`translateY(${y}px)`);
		if (!approxZero(scale - 1)) parts.push(`scale(${scale})`);
		if (!approxZero(rotate)) parts.push(`rotate(${rotate}deg)`);
		return parts.join(" ");
	}
	function buildFilter(blur) {
		return !approxZero(blur) ? `blur(${blur}px)` : "";
	}
	function buildStyle(opacity, transform, filter) {
		const parts = [`opacity:${opacity}`];
		if (transform) parts.push(`transform:${transform}`);
		if (filter) parts.push(`filter:${filter}`);
		return parts.join(";");
	}
	function makeResult(x, y, scale, rotate, blur, opacity, enter, exitEased) {
		let phase;
		if (enter <= 0) phase = "before";
		else if (exitEased >= 1) phase = "after";
		else if (exitEased > 0) phase = "exiting";
		else if (enter < 1) phase = "entering";
		else phase = "steady";
		const transform = buildTransform(x, y, scale, rotate);
		const filter = buildFilter(blur);
		return {
			x,
			y,
			scale,
			rotate,
			blur,
			opacity,
			enter,
			exit: exitEased,
			visible: enter > 0 && exitEased < 1,
			phase,
			transform,
			filter,
			style: buildStyle(opacity, transform, filter)
		};
	}
	/**
	* Merge multiple motion values into a single MotionResult.
	* Last-wins per property; transforms combine into one CSS string.
	*
	* @example
	* const card = t.motion({ y: 20 });
	* const idle = { scale: std.oscillate(time, { period: "1s", from: 0.98, to: 1.02 }) };
	* return `<div style="${std.css(std.mergeMotion(card, idle))}">`;
	*/
	function mergeMotion(...motions) {
		let x = 0, y = 0, scale = 1, rotate = 0, blur = 0, opacity = 1;
		let enter = 1, exitVal = 0;
		let visible = true;
		let phase = "steady";
		for (const m of motions) {
			if (m.x !== void 0) x = m.x;
			if (m.y !== void 0) y = m.y;
			if (m.scale !== void 0) scale = m.scale;
			if (m.rotate !== void 0) rotate = m.rotate;
			if (m.blur !== void 0) blur = m.blur;
			if (m.opacity !== void 0) opacity = m.opacity;
			const r = m;
			if (r.enter !== void 0) enter = r.enter;
			if (r.exit !== void 0) exitVal = r.exit;
			if (r.visible !== void 0) visible = r.visible;
			if (r.phase !== void 0) phase = r.phase;
		}
		const transform = buildTransform(x, y, scale, rotate);
		const filter = buildFilter(blur);
		return {
			x,
			y,
			scale,
			rotate,
			blur,
			opacity,
			enter,
			exit: exitVal,
			visible,
			phase,
			transform,
			filter,
			style: buildStyle(opacity, transform, filter)
		};
	}
	//! Director easing resolve + exit-mirror descriptors for Media IR.
	const DEFAULT_ENTER_EASING = easeOutCubic;
	const DEFAULT_EXIT_EASING = easeInCubic;
	const SHORTHAND_TO_CANONICAL = {
		inQuad: "easeInQuad",
		outQuad: "easeOutQuad",
		inOutQuad: "easeInOutQuad",
		inSine: "easeInSine",
		outSine: "easeOutSine",
		inOutSine: "easeInOutSine",
		inCubic: "easeInCubic",
		outCubic: "easeOutCubic",
		inOutCubic: "easeInOutCubic",
		inQuart: "easeInQuart",
		outQuart: "easeOutQuart",
		inOutQuart: "easeInOutQuart",
		inQuint: "easeInQuint",
		outQuint: "easeOutQuint",
		inOutQuint: "easeInOutQuint",
		inExpo: "easeInExpo",
		outExpo: "easeOutExpo",
		inOutExpo: "easeInOutExpo",
		inCirc: "easeInCirc",
		outCirc: "easeOutCirc",
		inOutCirc: "easeInOutCirc",
		inBack: "easeInBack",
		outBack: "easeOutBack",
		inOutBack: "easeInOutBack",
		inElastic: "easeInElastic",
		outElastic: "easeOutElastic",
		inOutElastic: "easeInOutElastic",
		inBounce: "easeInBounce",
		outBounce: "easeOutBounce",
		inOutBounce: "easeInOutBounce"
	};
	const NAMED_EASINGS = {
		linear: linear$1,
		easeInQuad,
		easeOutQuad,
		easeInOutQuad,
		easeInSine,
		easeOutSine,
		easeInOutSine,
		easeInCubic,
		easeOutCubic,
		easeInOutCubic,
		easeInQuart,
		easeOutQuart,
		easeInOutQuart,
		easeInQuint,
		easeOutQuint,
		easeInOutQuint,
		easeInExpo,
		easeOutExpo,
		easeInOutExpo,
		easeInCirc,
		easeOutCirc,
		easeInOutCirc,
		easeInBack,
		easeOutBack,
		easeInOutBack,
		easeInElastic,
		easeOutElastic,
		easeInOutElastic,
		easeInBounce,
		easeOutBounce,
		easeInOutBounce,
		inQuad: easeInQuad,
		outQuad: easeOutQuad,
		inOutQuad: easeInOutQuad,
		inSine: easeInSine,
		outSine: easeOutSine,
		inOutSine: easeInOutSine,
		inCubic: easeInCubic,
		outCubic: easeOutCubic,
		inOutCubic: easeInOutCubic,
		inQuart: easeInQuart,
		outQuart: easeOutQuart,
		inOutQuart: easeInOutQuart,
		inQuint: easeInQuint,
		outQuint: easeOutQuint,
		inOutQuint: easeInOutQuint,
		inExpo: easeInExpo,
		outExpo: easeOutExpo,
		inOutExpo: easeInOutExpo,
		inCirc: easeInCirc,
		outCirc: easeOutCirc,
		inOutCirc: easeInOutCirc,
		inBack: easeInBack,
		outBack: easeOutBack,
		inOutBack: easeInOutBack,
		inElastic: easeInElastic,
		outElastic: easeOutElastic,
		inOutElastic: easeInOutElastic,
		inBounce: easeInBounce,
		outBounce: easeOutBounce,
		inOutBounce: easeInOutBounce,
		enter: easeOutCubic,
		exit: easeInCubic,
		move: easeInOutCubic,
		loop: linear$1
	};
	const EXIT_MIRROR = {
		easeOutQuad: easeInQuad,
		easeOutCubic: easeInCubic,
		easeOutQuart: easeInQuart,
		easeOutQuint: easeInQuint,
		easeOutSine: easeInSine,
		easeOutExpo: easeInExpo,
		easeOutCirc: easeInCirc,
		easeOutBack: easeInQuad,
		easeOutElastic: easeInQuad,
		easeOutBounce: easeInQuad,
		easeInOutQuad,
		easeInOutCubic,
		easeInOutQuart,
		easeInOutSine,
		easeInOutExpo,
		outQuad: easeInQuad,
		outCubic: easeInCubic,
		outQuart: easeInQuart,
		outQuint: easeInQuint,
		outSine: easeInSine,
		outExpo: easeInExpo,
		outCirc: easeInCirc,
		outBack: easeInQuad,
		outElastic: easeInQuad,
		outBounce: easeInQuad,
		inOutQuad: easeInOutQuad,
		inOutCubic: easeInOutCubic,
		inOutQuart: easeInOutQuart,
		inOutSine: easeInOutSine,
		inOutExpo: easeInOutExpo,
		enter: easeInCubic,
		exit: easeInCubic,
		move: easeInOutCubic,
		loop: linear$1
	};
	function resolveEasing$2(spec, fallback) {
		if (spec === void 0) return fallback;
		if (typeof spec === "function") return spec;
		if (typeof spec === "object") return (t) => springCurve(t, resolveSpring(spec));
		if (typeof spec === "string" && isSpringName(spec)) {
			const cfg = resolveSpring(spec);
			return (t) => springCurve(t, cfg);
		}
		const fn = NAMED_EASINGS[spec];
		if (!fn) throw new Error(`Unknown easing: "${spec}". Use a named curve, spring name (${Object.keys({
			gentle: 1,
			snappy: 1,
			fluid: 1,
			playful: 1,
			wobbly: 1
		}).join(", ")}), or semantic enter|exit|move|loop`);
		return fn;
	}
	function easingDescriptor(spec) {
		if (spec === void 0) return void 0;
		if (typeof spec === "function") return {
			kind: "named",
			name: "custom-function"
		};
		if (typeof spec === "object") {
			const s = resolveSpring(spec);
			return {
				kind: "spring",
				stiffness: s.stiffness,
				damping: s.damping,
				mass: s.mass
			};
		}
		if (typeof spec === "string" && isSpringName(spec)) {
			const s = resolveSpring(spec);
			return {
				kind: "spring",
				stiffness: s.stiffness,
				damping: s.damping,
				mass: s.mass
			};
		}
		const rawName = String(spec);
		return {
			kind: "named",
			name: SHORTHAND_TO_CANONICAL[rawName] ?? rawName
		};
	}
	/** Descriptor of the *effective* exit easing after mirrorExitEasing rules. */
	function mirroredExitEasingDescriptor(spec) {
		if (spec === void 0) return {
			kind: "named",
			name: "easeInCubic"
		};
		if (typeof spec === "function") return {
			kind: "named",
			name: "custom-function"
		};
		if (typeof spec === "object") return {
			kind: "named",
			name: "easeInCubic"
		};
		if (typeof spec === "string" && isSpringName(spec)) return {
			kind: "named",
			name: "easeInCubic"
		};
		const mirroredNames = {
			easeOutQuad: "easeInQuad",
			easeOutCubic: "easeInCubic",
			easeOutQuart: "easeInQuart",
			easeOutQuint: "easeInQuint",
			easeOutSine: "easeInSine",
			easeOutExpo: "easeInExpo",
			easeOutCirc: "easeInCirc",
			easeOutBack: "easeInQuad",
			easeOutElastic: "easeInQuad",
			easeOutBounce: "easeInQuad",
			easeInOutQuad: "easeInOutQuad",
			easeInOutCubic: "easeInOutCubic",
			easeInOutQuart: "easeInOutQuart",
			easeInOutSine: "easeInOutSine",
			easeInOutExpo: "easeInOutExpo",
			enter: "easeInCubic",
			exit: "easeInCubic",
			move: "easeInOutCubic",
			loop: "linear"
		};
		const rawName = String(spec);
		const name = SHORTHAND_TO_CANONICAL[rawName] ?? rawName;
		return {
			kind: "named",
			name: mirroredNames[name] ?? name
		};
	}
	function mirrorExitEasing(spec, fallback) {
		if (spec === void 0) return fallback;
		if (typeof spec === "string") {
			if (isSpringName(spec)) return DEFAULT_EXIT_EASING;
			const mirrored = EXIT_MIRROR[spec];
			if (mirrored) return mirrored;
		}
		return resolveEasing$2(spec, fallback);
	}
	//! Nested director clips (Remotion-style sequence windows).
	function resolveClipWindow(opts, parentWindow, parentDurationSeconds, phaseMap) {
		if (opts.during) {
			if (Array.isArray(opts.during)) {
				const [startSec, endSec] = opts.during;
				if (typeof startSec !== "number" || typeof endSec !== "number" || !(endSec > startSec)) throw new Error("director.clip({ during }) window must be [startSec, endSec]");
				return {
					start: startSec / parentDurationSeconds,
					end: endSec / parentDurationSeconds
				};
			}
			if (!phaseMap) throw new Error("director.clip({ during }) requires a director with named phases");
			if (typeof opts.during !== "string") throw new Error("director.clip({ during }) must be a phase name or [startSec, endSec]");
			const p = phaseMap.get(opts.during);
			if (!p) throw new Error(`director.clip: unknown phase "${opts.during}". Known: ${[...phaseMap.keys()].join(", ")}`);
			return {
				start: p.start,
				end: p.end
			};
		}
		if (opts.duration === void 0) throw new Error("director.clip() requires `duration` or `during`");
		const parentSpan = parentWindow.end - parentWindow.start;
		const fromOffset = opts.from === void 0 ? 0 : parseMotionTime(opts.from, parentSpan, parentDurationSeconds);
		const durationSpan = parseMotionTime(opts.duration, parentSpan, parentDurationSeconds);
		const start = parentWindow.start + fromOffset;
		return {
			start,
			end: start + durationSpan
		};
	}
	function createDirectorClip(sceneCtx, window, phaseMap, makeDirector) {
		const { timeline } = sceneCtx;
		const fps = sceneCtx.fps ?? 30;
		const clipFn = (opts) => {
			return createDirectorClip(sceneCtx, resolveClipWindow(opts, window, timeline.durationSeconds, phaseMap), phaseMap, makeDirector);
		};
		const clipProgress = () => {
			const s = window.end - window.start;
			return s <= 0 ? 0 : clamp01$1((timeline.progress - window.start) / s);
		};
		return {
			get active() {
				return timeline.progress >= window.start && timeline.progress < window.end;
			},
			get progress() {
				return clipProgress();
			},
			get frame() {
				const p = clipProgress();
				const s = window.end - window.start;
				const sec = p * s * timeline.durationSeconds;
				const tf = Math.max(1, Math.ceil(s * timeline.durationSeconds * fps));
				return Math.min(tf - 1, Math.floor(sec * fps));
			},
			get seconds() {
				return clipProgress() * (window.end - window.start) * timeline.durationSeconds;
			},
			get durationSeconds() {
				return (window.end - window.start) * timeline.durationSeconds;
			},
			get totalFrames() {
				return Math.max(1, Math.ceil((window.end - window.start) * timeline.durationSeconds * fps));
			},
			director(phases) {
				const p = clipProgress();
				const s = window.end - window.start;
				return makeDirector({
					timeline: {
						frame: timeline.frame,
						fps,
						progress: p,
						seconds: p * s * timeline.durationSeconds,
						durationSeconds: s * timeline.durationSeconds,
						totalFrames: Math.max(1, Math.ceil(s * timeline.durationSeconds * fps))
					},
					fps,
					...sceneCtx.instrument ? { instrument: sceneCtx.instrument } : {}
				}, phases);
			},
			clip: clipFn
		};
	}
	//! createDirector factory — phases, motion, tween, value, clip.
	/** Default max enter duration when `for` is omitted (standard element enter). */
	const DEFAULT_ENTER_CAP_SECONDS = .375;
	/** Auto exit window as fraction of exit phase (exits ~25% faster). */
	const DEFAULT_EXIT_PHASE_SCALE = .75;
	const DEFAULT_PHASES = {
		enter: "15%",
		hold: "70%",
		exit: "15%"
	};
	function createDirector(ctx, phases, opts) {
		const cfg = resolvePhaseConfig(phases, opts);
		const totalSeconds = ctx.timeline.durationSeconds > 0 ? ctx.timeline.durationSeconds : 1;
		const ordered = normalizePhases(cfg, totalSeconds);
		const phaseMap = new Map(ordered.map((p) => [p.name, p]));
		const sp = ctx.timeline.progress;
		const secs = ctx.timeline.seconds;
		const tonePreset = opts?.tone ? getMotionTone(opts.tone) : null;
		const instrument = ctx.instrument;
		const sceneId = instrument?.sceneId ?? "default";
		const frame = instrument?.frame ?? ctx.timeline.frame;
		const sceneStartFrame = instrument?.sceneStartFrame ?? 0;
		const totalFrames = instrument?.totalFrames ?? ctx.timeline.totalFrames;
		if (instrument?.onDirector) instrument.onDirector({
			sceneId,
			phases: ordered.map((p) => ({
				name: p.name,
				start: p.start,
				end: p.end
			})),
			frame,
			sceneStartFrame,
			totalFrames
		});
		const firstPhase = ordered[0];
		const lastPhase = ordered[ordered.length - 1];
		const activeName = (() => {
			if (sp >= 1) {
				let best = ordered[0];
				for (const phase of ordered) if (phase.end >= best.end) best = phase;
				return best.name;
			}
			for (const p of ordered) if (sp >= p.start && sp < p.end) return p.name;
			return "idle";
		})();
		const phasesView = ordered.slice();
		for (const phase of ordered) phasesView[phase.name] = phase;
		function phaseOf(name) {
			const p = phaseMap.get(name);
			if (!p) throw new Error(`director: unknown phase "${name}". Known: ${ordered.map((o) => o.name).join(", ")}`);
			return p;
		}
		function isNumericWindow(value) {
			return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";
		}
		function looksLikeTime(value) {
			return /(?:ms|s|%)$/.test(value.trim());
		}
		function windowOf(target) {
			if (typeof target === "string") {
				const phase = phaseOf(target);
				return {
					start: phase.start,
					end: phase.end
				};
			}
			if (isNumericWindow(target)) {
				const start = target[0] / totalSeconds;
				const end = target[1] / totalSeconds;
				if (!(end > start)) throw new Error(`director(): window [${target[0]}, ${target[1]}] must have start < end`);
				return {
					start,
					end
				};
			}
			const from = phaseOf(String(target[0]));
			const to = phaseOf(String(target[1]));
			return {
				start: Math.min(from.start, to.start),
				end: Math.max(from.end, to.end)
			};
		}
		function progressOf(target, clamp = true) {
			const window = windowOf(target);
			if (window.end === window.start) return sp >= window.start ? 1 : 0;
			const raw = (sp - window.start) / (window.end - window.start);
			return clamp ? clamp01$1(raw) : raw;
		}
		function easeProgress(raw, ease) {
			if (ease === void 0) return raw;
			if (typeof ease === "string" || typeof ease === "function") return resolveEasing$2(ease, linear$1)(raw);
			if ("stiffness" in ease) return resolveEasing$2(ease, linear$1)(raw);
			const spec = ease.ease ?? ease.easing;
			return spec === void 0 ? raw : resolveEasing$2(spec, linear$1)(raw);
		}
		function phaseLocal(target) {
			return progressOf(target);
		}
		function phaseIn(target, inOpts) {
			const opts = inOpts === void 0 ? void 0 : typeof inOpts === "string" || typeof inOpts === "function" || "stiffness" in inOpts ? { ease: inOpts } : inOpts;
			const clamp = opts?.clamp !== false;
			let local = progressOf(target, clamp);
			if (opts?.at !== void 0 || opts?.duration !== void 0) {
				const window = windowOf(target);
				const span = window.end - window.start;
				const atLocal = opts.at !== void 0 ? parseMotionTime(opts.at, span, totalSeconds) / span : 0;
				const durLocal = opts.duration !== void 0 ? parseMotionTime(opts.duration, span, totalSeconds) / span : 1 - atLocal;
				if (local <= atLocal) local = 0;
				else if (local >= atLocal + durLocal) local = 1;
				else local = durLocal <= 0 ? 1 : (local - atLocal) / durLocal;
				if (clamp) local = clamp01$1(local);
			}
			return easeProgress(local, opts);
		}
		function phaseAt(target, dataSeconds) {
			return phaseLocal(target) * dataSeconds;
		}
		function legacySpan(from, to) {
			const start = parseMotionTime(from, 1, totalSeconds);
			const end = parseMotionTime(to, 1, totalSeconds);
			if (sp <= start) return 0;
			if (sp >= end) return 1;
			return clamp01$1((sp - start) / (end - start));
		}
		function span(target, easeOrTo, maybeEase) {
			if (typeof target === "string" && typeof easeOrTo === "string" && (looksLikeTime(target) || looksLikeTime(easeOrTo))) return easeProgress(legacySpan(target, easeOrTo), maybeEase);
			if (typeof target === "string" && typeof easeOrTo === "string" && phaseMap.has(target) && phaseMap.has(easeOrTo)) return easeProgress(progressOf([target, easeOrTo]), maybeEase);
			if (typeof target === "string" && typeof easeOrTo === "string" && !phaseMap.has(target)) return easeProgress(legacySpan(target, easeOrTo), maybeEase);
			return easeProgress(progressOf(target), easeOrTo);
		}
		function transition(from, to, ease) {
			const raw = span(from, to);
			if (!ease) return raw;
			return resolveEasing$2(ease, linear$1)(raw);
		}
		function inSpan(from, to) {
			const raw = to === void 0 ? progressOf(from) : span(from, to);
			return raw > 0 && raw < 1;
		}
		function targetsOf(value) {
			if (Array.isArray(value)) {
				if (isNumericWindow(value)) return [value];
				return value;
			}
			return [value];
		}
		function motion(motionOpts = {}) {
			const toneEnter = tonePreset?.enter;
			const startX = motionOpts.x ?? 0;
			const startY = motionOpts.y ?? toneEnter?.y ?? 24;
			const startScale = motionOpts.scale ?? toneEnter?.scale ?? 1;
			const startRotate = motionOpts.rotate ?? 0;
			const startBlur = motionOpts.blur ?? toneEnter?.blur ?? 0;
			const fromOpacity = motionOpts.fromOpacity ?? toneEnter?.fromOpacity ?? 0;
			const during = motionOpts.during;
			const at = motionOpts.at ?? "0s";
			const window = motionOpts.window;
			const easingSpec = motionOpts.easing ?? motionOpts.ease ?? tonePreset?.enterEasing;
			const exitEasingSpec = motionOpts.exitEasing ?? motionOpts.exitEase ?? tonePreset?.exitEasing;
			const exit = motionOpts.exit;
			const duringPhase = during !== void 0 ? windowOf(during) : void 0;
			const hasLaterPhase = duringPhase ? ordered.some((p) => p.start >= duringPhase.end - 1e-12) : false;
			const exitOff = exit === false || exit === void 0 && !hasLaterPhase;
			let enterStart, enterEnd;
			if (window) [enterStart, enterEnd] = window;
			else {
				const phase = duringPhase ?? firstPhase;
				const phaseSpan = phase.end - phase.start;
				const atFrac = parseMotionTime(at, phaseSpan, totalSeconds);
				let forFrac;
				if (motionOpts.for !== void 0) forFrac = parseMotionTime(motionOpts.for, phaseSpan, totalSeconds);
				else {
					const capFrac = DEFAULT_ENTER_CAP_SECONDS / totalSeconds;
					forFrac = Math.min(phaseSpan - atFrac, capFrac, phaseSpan);
					if (forFrac <= 0) forFrac = Math.max(0, phaseSpan - atFrac);
				}
				enterStart = phase.start + atFrac;
				enterEnd = enterStart + forFrac;
			}
			const enterSpan = enterEnd - enterStart;
			const enterRaw = enterSpan <= 0 ? sp >= enterStart ? 1 : 0 : clamp01$1((sp - enterStart) / enterSpan);
			const enter = resolveEasing$2(easingSpec, tonePreset ? resolveEasing$2(tonePreset.enterEasing, DEFAULT_ENTER_EASING) : DEFAULT_ENTER_EASING)(enterRaw);
			const exitOpts = typeof exit === "object" ? exit : {};
			let exitStart, exitEnd, exitActive;
			if (exitOff) {
				exitActive = false;
				exitStart = 0;
				exitEnd = 0;
			} else if (exitOpts.window) {
				[exitStart, exitEnd] = exitOpts.window;
				exitActive = true;
			} else if (exitOpts.for !== void 0 || exitOpts.at !== void 0) {
				const phase = lastPhase;
				const phaseSpan = phase.end - phase.start;
				const atFrac = exitOpts.at !== void 0 ? parseMotionTime(exitOpts.at, phaseSpan, totalSeconds) : 0;
				const forFrac = exitOpts.for !== void 0 ? parseMotionTime(exitOpts.for, phaseSpan, totalSeconds) : phaseSpan * DEFAULT_EXIT_PHASE_SCALE;
				exitStart = phase.start + atFrac;
				exitEnd = exitStart + forFrac;
				exitActive = ordered.length >= 2 && lastPhase.name !== firstPhase.name;
			} else if (ordered.length >= 2 && lastPhase.name !== firstPhase.name) {
				const phaseSpan = lastPhase.end - lastPhase.start;
				const exitScale = tonePreset ? Math.min(1, 1 / tonePreset.exitSpeed) : DEFAULT_EXIT_PHASE_SCALE;
				exitStart = lastPhase.start;
				exitEnd = lastPhase.start + phaseSpan * exitScale;
				exitActive = true;
			} else {
				exitActive = false;
				exitStart = 0;
				exitEnd = 0;
			}
			const exitSpan = exitEnd - exitStart;
			const exitRaw = !exitActive || exitSpan <= 0 ? 0 : clamp01$1((sp - exitStart) / exitSpan);
			const exitDefault = tonePreset ? resolveEasing$2(tonePreset.exitEasing, DEFAULT_EXIT_EASING) : DEFAULT_EXIT_EASING;
			const exitEased = mirrorExitEasing(exitEasingSpec ?? easingSpec, exitDefault)(exitRaw);
			const exitToX = exitOpts.x ?? -startX;
			const exitToY = exitOpts.y ?? -startY;
			const exitToScale = exitOpts.scale ?? startScale;
			const exitToRotate = exitOpts.rotate ?? -startRotate;
			const exitToBlur = exitOpts.blur ?? startBlur;
			const ax = lerp$1(lerp$1(startX, 0, enter), exitToX, exitEased);
			const ay = lerp$1(lerp$1(startY, 0, enter), exitToY, exitEased);
			const aScale = lerp$1(lerp$1(startScale, 1, enter), exitToScale, exitEased);
			const aRotate = lerp$1(lerp$1(startRotate, 0, enter), exitToRotate, exitEased);
			const aBlur = lerp$1(lerp$1(startBlur, 0, enter), exitToBlur, exitEased);
			const opacity = lerp$1(fromOpacity, 1, enter) * (1 - exitEased);
			const describedEnter = easingDescriptor(easingSpec);
			const describedExit = exitActive ? mirroredExitEasingDescriptor(exitEasingSpec ?? easingSpec) : void 0;
			if (instrument?.onMotion) {
				const localId = motionOpts.id;
				if (!localId) {
					if (instrument.strictIds) throw new Error(`director.motion: missing required id (Media IR). Pass id: "my.motion"`);
					instrument.onIssue?.({
						code: "anonymous_id",
						message: "director.motion has no stable id; motion semantics are sampled",
						sceneId,
						frame
					});
				} else instrument.onMotion({
					localId,
					sceneId,
					kind: "motion",
					...motionOpts.target !== void 0 ? { target: motionOpts.target } : {},
					enterStart,
					enterEnd,
					...exitActive ? {
						exitStart,
						exitEnd
					} : {},
					from: {
						x: startX,
						y: startY,
						scale: startScale,
						rotate: startRotate,
						blur: startBlur,
						opacity: fromOpacity
					},
					to: {
						x: 0,
						y: 0,
						scale: 1,
						rotate: 0,
						blur: 0,
						opacity: 1
					},
					...exitActive ? { exitTo: {
						x: exitToX,
						y: exitToY,
						scale: exitToScale,
						rotate: exitToRotate,
						blur: exitToBlur,
						opacity: 0
					} } : {},
					...describedEnter !== void 0 ? { easing: describedEnter } : {},
					...describedExit !== void 0 ? { exitEasing: describedExit } : {},
					frame,
					sceneStartFrame,
					totalFrames
				});
			}
			return makeResult(ax, ay, aScale, aRotate, aBlur, opacity, enter, exitEased);
		}
		function tween(fromOrOpts, to, tweenOpts = {}) {
			if (typeof fromOrOpts === "object") return tween(fromOrOpts.from ?? 0, fromOrOpts.to ?? 1, fromOrOpts);
			const from = fromOrOpts;
			const end = to ?? 1;
			const { during, at = "0s", for: forOpt = "100%", pattern } = tweenOpts;
			const easingSpec = tweenOpts.easing ?? tweenOpts.ease;
			const phase = during !== void 0 ? windowOf(during) : firstPhase;
			const spanLen = phase.end - phase.start;
			const atFrac = parseMotionTime(at, spanLen, totalSeconds);
			const forFrac = parseMotionTime(forOpt, spanLen, totalSeconds);
			const localStart = phase.start + atFrac;
			const localEnd = localStart + forFrac;
			const localSpan = localEnd - localStart;
			const raw = localSpan <= 0 ? sp >= localStart ? 1 : 0 : clamp01$1((sp - localStart) / localSpan);
			let eased;
			if (pattern === "sine") eased = Math.sin(raw * Math.PI);
			else if (pattern === "pulse") eased = .5 + .5 * Math.sin(raw * Math.PI * 6 - Math.PI / 2);
			else if (pattern === "bounce") eased = easeOutBounce(raw);
			else if (pattern === "linear") eased = raw;
			else eased = resolveEasing$2(easingSpec, DEFAULT_ENTER_EASING)(raw);
			if (instrument?.onMotion) {
				const localId = tweenOpts.id;
				if (!localId) {
					if (instrument.strictIds) throw new Error(`director.tween: missing required id (Media IR). Pass id: "my.tween"`);
					instrument.onIssue?.({
						code: "anonymous_id",
						message: "director.tween has no stable id; motion semantics are sampled",
						sceneId,
						frame
					});
				} else instrument.onMotion({
					localId,
					sceneId,
					kind: "tween",
					...tweenOpts.target !== void 0 ? { target: tweenOpts.target } : {},
					...tweenOpts.property !== void 0 ? { property: tweenOpts.property } : {},
					enterStart: localStart,
					enterEnd: localEnd,
					from: { value: from },
					to: { value: end },
					...pattern && pattern !== "linear" ? { easing: {
						kind: "named",
						name: `pattern:${pattern}`
					} } : easingDescriptor(easingSpec) !== void 0 ? { easing: easingDescriptor(easingSpec) } : {},
					...pattern !== void 0 ? { pattern } : {},
					frame,
					sceneStartFrame,
					totalFrames
				});
			}
			return lerp$1(from, end, eased);
		}
		function beats(opts) {
			const names = opts.of;
			if (names.length === 0) throw new Error("director.beats: `of` must list at least one beat");
			const window = opts.during !== void 0 ? windowOf(opts.during) : {
				start: 0,
				end: 1
			};
			const span = window.end - window.start;
			const local = span <= 0 ? 1 : clamp01$1((sp - window.start) / span);
			const n = names.length;
			const beatSpan = 1 / n;
			const rawIndex = Math.min(n - 1, Math.floor(local / beatSpan + 1e-9));
			const inBeat = beatSpan <= 0 ? 1 : clamp01$1((local - rawIndex * beatSpan) / beatSpan);
			const beatSceneSpan = span / n;
			const crossScene = opts.cross !== void 0 ? parseMotionTime(opts.cross, beatSceneSpan, totalSeconds) : .08 * beatSceneSpan;
			const crossOfBeat = beatSceneSpan > 0 ? Math.max(0, Math.min(.5, crossScene / beatSceneSpan)) : 0;
			if (rawIndex < n - 1 && crossOfBeat > 0 && inBeat >= 1 - crossOfBeat) {
				const mix = clamp01$1((inBeat - (1 - crossOfBeat)) / crossOfBeat);
				return {
					crossing: true,
					from: names[rawIndex],
					to: names[rawIndex + 1],
					mix,
					index: rawIndex
				};
			}
			return {
				crossing: false,
				name: names[rawIndex],
				local: inBeat,
				index: rawIndex
			};
		}
		function value(vOrOpts, valueOpts = {}) {
			if (vOrOpts !== null && typeof vOrOpts === "object" && ("from" in vOrOpts || "to" in vOrOpts)) return tween(vOrOpts);
			const v = vOrOpts;
			let opacity = 1;
			if (valueOpts.during) {
				if (!targetsOf(valueOpts.during).map(windowOf).some((window) => sp >= window.start && sp < window.end)) opacity = 0;
			}
			if (valueOpts.fadeOn) {
				for (const window of targetsOf(valueOpts.fadeOn).map(windowOf)) if (sp >= window.start) {
					const spanLen = window.end - window.start;
					opacity *= 1 - (spanLen <= 0 ? 1 : clamp01$1((sp - window.start) / spanLen));
				}
			}
			return {
				current: v,
				opacity
			};
		}
		const parentWindow = {
			start: 0,
			end: 1
		};
		return {
			progress: sp,
			seconds: secs,
			active: activeName,
			phases: phasesView,
			in: phaseIn,
			phaseIn,
			phaseLocal,
			at: phaseAt,
			beats,
			span,
			transition,
			inSpan,
			motion,
			tween,
			value,
			clip: (clipOpts) => createDirectorClip(ctx, resolveClipWindow(clipOpts, parentWindow, totalSeconds, phaseMap), phaseMap, createDirector)
		};
	}
	function resolvePhaseConfig(phases, opts) {
		const fromOpts = opts?.acts || opts?.cues ? {
			...opts.acts ? { acts: opts.acts } : {},
			...opts.cues ? { cues: opts.cues } : {}
		} : void 0;
		if (phases === void 0) return fromOpts ?? DEFAULT_PHASES;
		if (!fromOpts) return phases;
		if (isStructuredPhaseConfig(phases)) return {
			...phases.acts || opts?.acts ? { acts: {
				...phases.acts,
				...opts?.acts
			} } : {},
			...phases.cues || opts?.cues ? { cues: {
				...phases.cues,
				...opts?.cues
			} } : {}
		};
		return {
			acts: {
				...phases,
				...opts?.acts
			},
			...opts?.cues ? { cues: opts.cues } : {}
		};
	}
	// packages/superimg-stdlib/dist/easing.js
	var easing_exports = /* @__PURE__ */ __exportAll$1({
		EASING_NAMES: () => EASING_NAMES,
		clamp01: () => clamp01$1,
		easeInBack: () => easeInBack,
		easeInBounce: () => easeInBounce,
		easeInCirc: () => easeInCirc,
		easeInCubic: () => easeInCubic,
		easeInElastic: () => easeInElastic,
		easeInExpo: () => easeInExpo,
		easeInOutBack: () => easeInOutBack,
		easeInOutBounce: () => easeInOutBounce,
		easeInOutCirc: () => easeInOutCirc,
		easeInOutCubic: () => easeInOutCubic,
		easeInOutElastic: () => easeInOutElastic,
		easeInOutExpo: () => easeInOutExpo,
		easeInOutQuad: () => easeInOutQuad,
		easeInOutQuart: () => easeInOutQuart,
		easeInOutQuint: () => easeInOutQuint,
		easeInOutSine: () => easeInOutSine,
		easeInQuad: () => easeInQuad,
		easeInQuart: () => easeInQuart,
		easeInQuint: () => easeInQuint,
		easeInSine: () => easeInSine,
		easeOutBack: () => easeOutBack,
		easeOutBounce: () => easeOutBounce,
		easeOutCirc: () => easeOutCirc,
		easeOutCubic: () => easeOutCubic,
		easeOutElastic: () => easeOutElastic,
		easeOutExpo: () => easeOutExpo,
		easeOutQuad: () => easeOutQuad,
		easeOutQuart: () => easeOutQuart,
		easeOutQuint: () => easeOutQuint,
		easeOutSine: () => easeOutSine,
		linear: () => linear$1
	});
	// packages/superimg-core/src/shared/stdlib.ts
	//! Shared stdlib construction - used by create-render-context and other runtime code
	function missingCapability(name) {
		throw new Error(`SuperImg stdlib capability "${name}" was not prepared. Load templates through Player/createRenderPlan before rendering.`);
	}
	function missingNamespace(name) {
		const callable = () => missingCapability(name);
		return new Proxy(callable, {
			get: () => missingNamespace(name),
			apply: () => missingCapability(name)
		});
	}
	const baseInterpolate = (progress, inputRange, outputRange, easing) => {
		if (inputRange.length < 2) throw new Error("interpolate: inputRange must have at least 2 values");
		if (inputRange.length !== outputRange.length) throw new Error("interpolate: inputRange and outputRange must have the same length");
		const last = inputRange.length - 1;
		if (progress <= inputRange[0]) return outputRange[0];
		if (progress >= inputRange[last]) return outputRange[last];
		let index = 1;
		while (index < last && progress > inputRange[index]) index += 1;
		const start = inputRange[index - 1];
		const span = inputRange[index] - start;
		const segment = clamp01$1(span === 0 ? 0 : (progress - start) / span);
		const easingFn = typeof easing === "function" ? easing : easing === void 0 ? void 0 : easing_exports[easing];
		if (easing !== void 0 && !easingFn) throw new Error(`Unknown easing "${easing}". Valid names: ${EASING_NAMES.join(", ")}`);
		const amount = easingFn ? easingFn(segment) : segment;
		const from = outputRange[index - 1];
		return from + (outputRange[index] - from) * amount;
	};
	const missingCode = {
		highlight: () => missingCapability("code"),
		getThemes: () => [],
		getLangs: () => []
	};
	const missing = (name) => missingNamespace(name);
	/**
	* Produce a pristine stdlib for one authority boundary. Optional capability
	* loaders mutate only the returned object; sessions never share capability packs.
	*/
	function createStaticStdlib() {
		const lazyViz = {
			coords: missing("viz"),
			plot: missing("viz"),
			tracker: missing("viz"),
			canvas: missing("viz"),
			reveal: missing("viz"),
			camera: missing("viz"),
			indicate: missing("viz"),
			scale: missing("viz"),
			charts: missing("viz"),
			project3d: missing("viz"),
			three: missing("three"),
			lottie: missing("lottie"),
			lottieApi: missing("lottie"),
			lottieDurationFrames: missing("lottie"),
			lottieDurationSeconds: missing("lottie"),
			LOTTIE_VERSION: "",
			LOTTIE_MODULE_LIGHT: "",
			LOTTIE_MODULE_FULL: "",
			mermaid: missing("mermaid"),
			equation: missing("katex"),
			equationSteps: missing("katex"),
			equationMatch: missing("katex"),
			parseEquationSteps: missing("katex"),
			katexCss: "",
			katex: missing("katex")
		};
		const lazySvg = {
			draw: missing("svg"),
			drawMany: missing("svg"),
			filter: missing("svg"),
			morph: missing("svg"),
			arcPoint: missing("svg"),
			shape: missing("svg"),
			textPath: missing("svg"),
			bezier: missing("svg"),
			gradient: missing("svg"),
			measureText: missing("svg"),
			wrapText: missing("svg"),
			fitText: missing("svg"),
			rough: missing("rough")
		};
		return {
			math: missing("math"),
			color: missing("color"),
			text: missing("text"),
			date: missing("date"),
			css: Object.assign(css, {
				fill,
				center,
				column,
				row,
				ditherNoise,
				appleGlass
			}),
			responsive: missing("responsive"),
			subtitle: missing("subtitle"),
			code: missingCode,
			carousel: missing("carousel"),
			stack: missing("stack"),
			layoutTimeline: missing("layout-timeline"),
			backgrounds: missing("backgrounds"),
			montage: missing("montage"),
			createResponsive: missing("responsive"),
			spring: missing("spring"),
			clamp01: clamp01$1,
			stagger: missing("stagger"),
			timing: missing("timing"),
			phases: missing("phases"),
			motion: missing("motion"),
			safeArea: missing("safe-area"),
			safeBox: missing("safe-area"),
			interpolate: baseInterpolate,
			interpolateColor: missing("color"),
			path: missing("path"),
			svg: lazySvg,
			layout: missing("layout"),
			mergeMotion,
			reveal: missing("reveal"),
			oscillate: missing("oscillate"),
			loop: missing("oscillate"),
			pingpong: missing("oscillate"),
			wiggle: missing("oscillate"),
			viz: lazyViz,
			ready: missing("ready")
		};
	}
	// packages/superimg-stdlib/dist/video.js
	/**
	* Frame-accurate embedded video for headless render.
	* Emits marked <img> placeholders; Playwright injects ffmpeg-extracted frames.
	*/
	const CLIP_SYNC_ATTR = "data-superimg-clip";
	function quantizeVideoTime(time, fps) {
		if (fps <= 0) return time;
		const step = 1 / fps;
		return Math.round(time / step) * step;
	}
	function sync(options, fps) {
		const { src, at = 0, start = 0, playbackRate = 1, width = "100%", height = "100%", objectFit = "cover" } = options;
		const time = quantizeVideoTime(start + at * playbackRate, fps);
		const frameIndex = Math.round(time * fps);
		const style = css({
			width,
			height,
			objectFit,
			display: "block"
		});
		return {
			time,
			frameIndex,
			html: `<img ${CLIP_SYNC_ATTR} data-src="${escapeAttr$1(src)}" data-t="${time}" data-frame="${frameIndex}" style="${style}" alt="">`,
			style
		};
	}
	function escapeAttr$1(value) {
		return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
	}
	// packages/superimg-stdlib/dist/h.js
	//! Local copy of the authoring-tree shape. Keep in sync with
	//! `@superimg/types` `media-node.ts`. Types stays a leaf package.
	//! Hyperscript constructor for the authoring tree.
	function isMediaElement(value) {
		return typeof value === "object" && value !== null && value.$$typeof === "@foxworth/superimg/element" && typeof value.type === "string";
	}
	function flattenChildren(children) {
		const out = [];
		for (const child of children) {
			if (child === null || child === void 0 || child === false || child === true) continue;
			if (Array.isArray(child)) {
				out.push(...flattenChildren(child));
				continue;
			}
			out.push(child);
		}
		return out;
	}
	/**
	* Hyperscript constructor. `type` is an HTML/SVG tag or a primitive name
	* (`Frame`, `Stack`, `Text`, …).
	*/
	function h$2(type, props, ...children) {
		const { key, ...rest } = props ?? {};
		const fromProps = rest.children;
		const nested = Array.isArray(fromProps) ? fromProps : fromProps !== void 0 ? [fromProps] : [];
		const { children: _ignored, ...attrProps } = rest;
		return {
			$$typeof: "@foxworth/superimg/element",
			type,
			props: attrProps,
			children: flattenChildren([...nested, ...children]),
			...key !== void 0 && key !== null ? { key: String(key) } : {}
		};
	}
	// packages/superimg-stdlib/dist/primitives.js
	//! Layout primitives — return MediaElements; layout runs in lower().
	function Video(props) {
		return h$2("Video", {
			width: "fill",
			height: "fill",
			fit: "cover",
			muted: true,
			...props
		});
	}
	function Html(props) {
		if (typeof props.html !== "string") throw new Error("Html() requires an html string");
		return h$2("Html", {
			width: "fill",
			height: "fill",
			...props
		});
	}
	// packages/superimg-stdlib/dist/media.js
	const MEDIA_ATTR = "data-superimg-media";
	const EXTERNAL_EMBED_ATTR = "data-superimg-external-embed";
	function video(options, fps) {
		const { src, at = 0, start = 0, playbackRate = 1, width = "100%", height = "100%", muted = true, loop = false, controls = false, poster } = options;
		const objectFit = options.objectFit ?? options.fit ?? "cover";
		const time = quantizeVideoTime(start + at * playbackRate, fps);
		const frameIndex = Math.round(time * fps);
		const style = css({
			width,
			height,
			objectFit,
			display: "block"
		});
		const html = `<video ${[
			MEDIA_ATTR,
			`${CLIP_SYNC_ATTR}`,
			`data-kind="video"`,
			`data-src="${escapeAttr(src)}"`,
			`data-t="${time}"`,
			`data-frame="${frameIndex}"`,
			`data-playback-rate="${playbackRate}"`,
			`src="${escapeAttr(src)}"`,
			`preload="metadata"`,
			`playsinline`,
			muted ? "muted" : "",
			loop ? "loop" : "",
			controls ? "controls" : "",
			poster ? `poster="${escapeAttr(poster)}"` : "",
			`style="${style}"`
		].filter(Boolean).join(" ")}></video>`;
		return Object.assign(Video({
			src,
			html,
			fit: objectFit,
			muted,
			loop,
			...typeof width === "number" ? { width } : { width: "fill" },
			...typeof height === "number" ? { height } : { height: "fill" },
			...poster !== void 0 ? { poster } : {}
		}), {
			kind: "video",
			time,
			frameIndex,
			html,
			style
		});
	}
	function youtube(options, fps) {
		const videoId = options.videoId ?? extractYoutubeId(options.url ?? "");
		if (!videoId) throw new Error("std.media.youtube() requires a YouTube url or videoId");
		const at = options.at ?? 0;
		const time = quantizeVideoTime((options.start ?? 0) + at, fps);
		const frameIndex = Math.round(time * fps);
		const style = css({
			width: options.width ?? "100%",
			height: options.height ?? "100%",
			objectFit: options.fit ?? "cover",
			display: "block",
			border: 0
		});
		const title = options.title ?? "YouTube video";
		const embedUrl = buildYoutubeEmbedUrl(videoId, Math.max(0, Math.floor(time)));
		const sourceUrl = options.url ?? `https://www.youtube.com/watch?v=${videoId}`;
		const html = `<iframe ${[
			MEDIA_ATTR,
			EXTERNAL_EMBED_ATTR,
			`data-kind="youtube"`,
			`data-provider="youtube"`,
			`data-video-id="${escapeAttr(videoId)}"`,
			`data-src="${escapeAttr(sourceUrl)}"`,
			`data-t="${time}"`,
			`data-frame="${frameIndex}"`,
			options.poster ? `data-poster="${escapeAttr(options.poster)}"` : "",
			`src="${escapeAttr(embedUrl)}"`,
			`title="${escapeAttr(title)}"`,
			`allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`,
			`allowfullscreen`,
			`style="${style}"`
		].filter(Boolean).join(" ")}></iframe>`;
		return Object.assign(Html({
			html,
			width: "fill",
			height: "fill"
		}), {
			kind: "youtube",
			videoId,
			time,
			frameIndex,
			embedUrl,
			html,
			style
		});
	}
	function extractYoutubeId(input) {
		if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
		try {
			const url = new URL(input);
			if (url.hostname === "youtu.be") {
				const id = url.pathname.split("/").filter(Boolean)[0];
				return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
			}
			if (url.hostname.endsWith("youtube.com")) {
				const watchId = url.searchParams.get("v");
				if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;
				const parts = url.pathname.split("/").filter(Boolean);
				const embedIndex = parts.findIndex((part) => part === "embed" || part === "shorts");
				const id = embedIndex >= 0 ? parts[embedIndex + 1] : void 0;
				return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
			}
		} catch {
			return null;
		}
		return null;
	}
	function buildYoutubeEmbedUrl(videoId, start) {
		const url = new URL(`https://www.youtube.com/embed/${videoId}`);
		url.searchParams.set("start", String(start));
		url.searchParams.set("enablejsapi", "1");
		url.searchParams.set("playsinline", "1");
		url.searchParams.set("mute", "1");
		return url.toString();
	}
	function escapeAttr(value) {
		return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
	}
	// packages/superimg-core/src/shared/bind-std-timing.ts
	//! Per-frame stdlib binding — video sync and scale helpers (+ optional IR sink).
	function bindStdTiming(base, window, scale = 1, instrument) {
		const sceneId = instrument?.sceneId ?? "default";
		const sceneStartFrame = instrument?.sceneStartFrame ?? 0;
		const totalFrames = instrument?.totalFrames ?? window.totalFrames;
		const frame = instrument?.frame ?? window.frame;
		const strict = instrument?.strictIds === true;
		/** Only require ids when the matching IR hook is active (strict compile attaches all hooks). */
		const requireId = (api, id, hookActive) => {
			if (id) return id;
			if (strict && instrument && hookActive) throw new Error(`${api}: missing required id (Media IR). Pass id: "my.${api.split(".").pop()}"`);
			if (instrument && hookActive) instrument.onIssue?.({
				code: "anonymous_id",
				message: `${api} has no stable id; temporal semantics are sampled`,
				sceneId,
				frame
			});
			return "";
		};
		return {
			...base,
			px: (value) => `${value * scale}px`,
			scale,
			stack: (items, opts) => {
				const hook = !!instrument?.onStack;
				const id = requireId("std.stack", opts.id, hook);
				if (id && instrument?.onStack) {
					const itemIds = opts.itemIds ?? (strict ? (() => {
						throw new Error(`std.stack: missing required itemIds (Media IR) for stack "${id}"`);
					})() : items.map((_, i) => String(i)));
					if (!opts.itemIds) instrument.onIssue?.({
						code: "anonymous_item_ids",
						message: `std.stack "${id}" uses positional item IDs; item identity may shift`,
						sceneId,
						id,
						frame
					});
					if (opts.itemIds && opts.itemIds.length !== items.length && strict) throw new Error(`std.stack: itemIds length (${opts.itemIds.length}) must match items (${items.length})`);
					instrument.onStack({
						localId: id,
						sceneId,
						itemIds: [...itemIds],
						frame,
						sceneStartFrame,
						totalFrames
					});
				}
				return base.stack(items, opts);
			},
			carousel: (items, opts) => {
				const hook = !!instrument?.onCarousel;
				const id = requireId("std.carousel", opts.id, hook);
				if (id && instrument?.onCarousel) {
					const itemIds = opts.itemIds ?? (strict ? (() => {
						throw new Error(`std.carousel: missing required itemIds (Media IR) for carousel "${id}"`);
					})() : items.map((_, i) => String(i)));
					if (!opts.itemIds) instrument.onIssue?.({
						code: "anonymous_item_ids",
						message: `std.carousel "${id}" uses positional item IDs; item identity may shift`,
						sceneId,
						id,
						frame
					});
					if (opts.itemIds && opts.itemIds.length !== items.length && strict) throw new Error(`std.carousel: itemIds length (${opts.itemIds.length}) must match items (${items.length})`);
					instrument.onCarousel({
						localId: id,
						sceneId,
						itemIds: [...itemIds],
						frame,
						sceneStartFrame,
						totalFrames
					});
				}
				return base.carousel(items, opts);
			},
			video: { sync: (opts) => {
				const hook = !!instrument?.onVideoSync;
				const id = requireId("std.video.sync", opts.id, hook);
				const result = sync(opts, window.fps);
				if (id && instrument?.onVideoSync) instrument.onVideoSync({
					localId: id,
					sceneId,
					src: opts.src,
					mediaTime: result.time,
					frame,
					sceneStartFrame,
					totalFrames
				});
				return result;
			} },
			media: {
				video: (opts) => video(opts, window.fps),
				youtube: (opts) => youtube(opts, window.fps)
			}
		};
	}
	// packages/superimg-core/src/shared/create-timeline.ts
	//! Build unified Timeline snapshot from frame parameters.
	function createTimeline(frame, fps, totalFrames) {
		const progress = totalFrames > 1 ? Math.min(frame / (totalFrames - 1), 1) : totalFrames === 1 ? 1 : 0;
		const durationSeconds = totalFrames / fps;
		return {
			frame,
			fps,
			progress,
			seconds: progress * durationSeconds,
			durationSeconds,
			totalFrames
		};
	}
	// packages/superimg-stdlib/dist/transcript.js
	/**
	* Create a marker sync for querying progress between named timestamps.
	*
	* @param def - Record of marker names to timestamps (in seconds)
	* @param time - Current time in seconds
	* @returns A MarkerSync instance for querying progress between markers
	*
	* @example
	* ```ts
	* const m = markers({
	*   intro: 0,
	*   main: 2.5,
	*   outro: 8,
	* }, time);
	*
	* // Progress between markers
	* const fadeIn = m.progress("intro", "main");  // 0-1
	*
	* // Get segment as CueEvent
	* const introToMain = m.segment("intro", "main");
	* const opacity = std.interpolate(introToMain.progress, [0, 1], [0, 1], "easeOutCubic");
	*
	* // What's active now?
	* const curr = m.current();  // { marker: "main", progress: 0.3 }
	* ```
	*/
	function markers(def, time) {
		const sorted = Object.entries(def).sort(([, a], [, b]) => a - b);
		return {
			progress(from, to) {
				const fromTime = def[from];
				const toTime = def[to];
				if (fromTime === void 0) throw new Error(`Marker "${from}" not found`);
				if (toTime === void 0) throw new Error(`Marker "${to}" not found`);
				const duration = toTime - fromTime;
				if (duration === 0) return time >= fromTime ? 1 : 0;
				return Math.max(0, Math.min(1, (time - fromTime) / duration));
			},
			segment(from, to) {
				const fromTime = def[from];
				const toTime = def[to];
				if (fromTime === void 0) throw new Error(`Marker "${from}" not found`);
				if (toTime === void 0) throw new Error(`Marker "${to}" not found`);
				const duration = toTime - fromTime;
				const progress = this.progress(from, to);
				return {
					id: `${from}->${to}`,
					progress,
					active: progress > 0 && progress < 1,
					start: fromTime,
					end: toTime,
					duration
				};
			},
			current() {
				for (let i = 0; i < sorted.length - 1; i++) {
					const current = sorted[i];
					const next = sorted[i + 1];
					if (!current || !next) continue;
					const [name, markerTime] = current;
					const [nextName, nextTime] = next;
					if (time >= markerTime && time < nextTime) return this.segment(name, nextName);
				}
				const lastEntry = sorted[sorted.length - 1];
				if (sorted.length > 1 && lastEntry && time >= lastEntry[1]) {
					const prevEntry = sorted[sorted.length - 2];
					if (!prevEntry) return null;
					const [prevName] = prevEntry;
					const [lastName] = lastEntry;
					return this.segment(prevName, lastName);
				}
				return null;
			},
			at(marker) {
				const t = def[marker];
				if (t === void 0) throw new Error(`Marker "${marker}" not found`);
				return t;
			}
		};
	}
	/**
	* Create a transcript sync for word-level timing.
	*
	* @param words - Array of words with timing
	* @param time - Current time in seconds
	* @returns A TranscriptSync instance for querying word progress
	*
	* @example
	* ```ts
	* const t = transcript(words, time);
	*
	* // Get current word
	* const word = t.current();
	* if (word) {
	*   const highlight = std.interpolate(word.progress, [0, 1], [0, 1], "easeOutCubic");
	* }
	*
	* // Render with highlighting
	* const caption = t.map((w, i) => {
	*   const isCurrent = t.current()?.id === w.id;
	*   return `<span class="${isCurrent ? 'active' : ''}">${w.text}</span>`;
	* }).join(' ');
	* ```
	*/
	function transcript(words, time) {
		const sorted = [...words].sort((a, b) => a.start - b.start);
		function buildEvent(word, index) {
			const { text, start, end } = word;
			const duration = end - start;
			let progress;
			if (duration === 0) progress = time >= start ? 1 : 0;
			else if (time <= start) progress = 0;
			else if (time >= end) progress = 1;
			else progress = (time - start) / duration;
			return {
				id: `word-${index}`,
				text,
				progress,
				active: progress > 0 && progress < 1,
				start,
				end,
				duration
			};
		}
		return {
			at(index) {
				if (index < 0 || index >= sorted.length) throw new Error(`Word index ${index} out of bounds (0-${sorted.length - 1})`);
				return buildEvent(sorted[index], index);
			},
			current() {
				for (let i = 0; i < sorted.length; i++) {
					const event = buildEvent(sorted[i], i);
					if (event.active) return event;
				}
				return null;
			},
			all() {
				return sorted.map((w, i) => buildEvent(w, i));
			},
			range(start, end) {
				return sorted.map((w, i) => buildEvent(w, i)).filter((e) => e.end > start && e.start < end);
			},
			find(text) {
				const lower = text.toLowerCase();
				const index = sorted.findIndex((w) => w.text.toLowerCase() === lower);
				return index >= 0 ? buildEvent(sorted[index], index) : null;
			},
			map(fn) {
				return sorted.map((w, i) => fn(buildEvent(w, i), i));
			},
			count() {
				return sorted.length;
			},
			duration() {
				if (sorted.length === 0) return 0;
				return sorted[sorted.length - 1].end - sorted[0].start;
			},
			charProgress() {
				const word = this.current();
				if (!word) return 0;
				return word.progress * word.text.length;
			},
			between(fromIndex, toIndex) {
				if (fromIndex < 0 || fromIndex >= sorted.length) throw new Error(`fromIndex ${fromIndex} out of bounds (0-${sorted.length - 1})`);
				if (toIndex < 0 || toIndex >= sorted.length) throw new Error(`toIndex ${toIndex} out of bounds (0-${sorted.length - 1})`);
				const fromWord = sorted[fromIndex];
				const toWord = sorted[toIndex];
				const start = fromWord.start;
				const end = toWord.end;
				const duration = end - start;
				let progress;
				if (duration === 0) progress = time >= start ? 1 : 0;
				else if (time <= start) progress = 0;
				else if (time >= end) progress = 1;
				else progress = (time - start) / duration;
				const text = sorted.slice(fromIndex, toIndex + 1).map((w) => w.text).join(" ");
				return {
					id: `words-${fromIndex}-${toIndex}`,
					text,
					progress,
					active: progress > 0 && progress < 1,
					start,
					end,
					duration
				};
			}
		};
	}
	// packages/superimg-stdlib/dist/track.js
	function createTrack(timeline, source, instrument) {
		const words = source.words ?? [];
		const markerBook = source.markers ?? {};
		if (instrument?.onTrack) {
			if (!source.id) {
				if (instrument.strictIds) throw new Error(`ctx.track: missing required id (Media IR). Pass id: "voiceover"`);
				instrument.onIssue?.({
					code: "anonymous_id",
					message: "ctx.track has no stable id; track semantics are sampled",
					sceneId: instrument.sceneId ?? "default",
					frame: instrument.frame ?? timeline.frame
				});
			} else instrument.onTrack({
				localId: source.id,
				sceneId: instrument.sceneId ?? "default",
				kind: words.length > 0 && Object.keys(markerBook).length === 0 ? "transcript" : words.length === 0 && Object.keys(markerBook).length > 0 ? "markers" : "author-track",
				wordCount: words.length,
				markerCount: Object.keys(markerBook).length,
				frame: instrument.frame ?? timeline.frame,
				sceneStartFrame: instrument.sceneStartFrame ?? 0,
				totalFrames: instrument.totalFrames ?? timeline.totalFrames
			});
		}
		return {
			get seconds() {
				return timeline.seconds;
			},
			id: source.id,
			transcript() {
				return transcript(words, timeline.seconds);
			},
			markers() {
				return markers(markerBook, timeline.seconds);
			}
		};
	}
	// packages/superimg-core/src/rendering/create-render-context.ts
	//! Pure TypeScript implementations (no WASM)
	/**
	* Compute orientation flags from dimensions
	*/
	function computeOrientationFlags(width, height) {
		const aspectRatio = width / height;
		return {
			aspectRatio,
			isPortrait: aspectRatio < 1,
			isLandscape: aspectRatio > 1,
			isSquare: aspectRatio > .9 && aspectRatio < 1.1
		};
	}
	function createImageStdlib(baseStdlib, scale) {
		const { backgrounds: _backgrounds, montage: _montage, oscillate: _oscillate, loop: _loop, pingpong: _pingpong, wiggle: _wiggle, ...still } = baseStdlib;
		return {
			...still,
			px: (value) => `${value * scale}px`,
			scale
		};
	}
	/**
	* Create a RenderContext from parameters
	*/
	function createRenderContext(frame, fps, totalFrames, width, height, data = {}, assets = {}, assetResolver, designWidth, instrument, sceneMeta, baseStdlib = createStaticStdlib()) {
		const timeline = createTimeline(frame, fps, totalFrames);
		const timeSeconds = timeline.seconds;
		const { aspectRatio, isPortrait, isLandscape, isSquare } = computeOrientationFlags(width, height);
		const scale = designWidth ? width / designWidth : 1;
		const sceneId = sceneMeta?.sceneId ?? instrument?.sceneId ?? "default";
		const sceneStartFrame = sceneMeta?.sceneStartFrame ?? instrument?.sceneStartFrame ?? 0;
		const directorInstrument = instrument ? {
			strictIds: instrument.strictIds === true,
			sceneId,
			frame,
			sceneStartFrame,
			totalFrames,
			...instrument.onDirector ? { onDirector: instrument.onDirector } : {},
			...instrument.onMotion ? { onMotion: instrument.onMotion } : {},
			...instrument.onIssue ? { onIssue: instrument.onIssue } : {}
		} : void 0;
		const trackInstrument = instrument ? {
			strictIds: instrument.strictIds === true,
			sceneId,
			frame,
			sceneStartFrame,
			totalFrames,
			...instrument.onTrack ? { onTrack: instrument.onTrack } : {},
			...instrument.onIssue ? { onIssue: instrument.onIssue } : {}
		} : void 0;
		const directorCtx = {
			timeline,
			fps,
			...directorInstrument ? { instrument: directorInstrument } : {}
		};
		return {
			std: bindStdTiming(baseStdlib, {
				fps,
				frame,
				totalFrames,
				progress: timeline.progress,
				timeSeconds: timeline.seconds,
				durationSeconds: timeline.durationSeconds
			}, scale, instrument),
			timeline,
			director: (phases, opts) => createDirector(directorCtx, phases, opts),
			track: (source) => createTrack(timeline, source, trackInstrument),
			globalFrame: frame,
			globalTimeSeconds: timeSeconds,
			totalFrames,
			totalDurationSeconds: timeline.durationSeconds,
			sceneIndex: sceneMeta?.sceneIndex ?? 0,
			sceneId,
			fps,
			isFinite: true,
			width,
			height,
			aspectRatio,
			isPortrait,
			isLandscape,
			isSquare,
			data,
			assets,
			asset: assetResolver ?? ((filename) => filename),
			cssViewport: {
				width,
				height,
				devicePixelRatio: 1
			}
		};
	}
	function createImageRenderContext(width, height, options = {}) {
		const { aspectRatio, isPortrait, isLandscape, isSquare } = computeOrientationFlags(width, height);
		const scale = options.designWidth ? width / options.designWidth : 1;
		return {
			std: createImageStdlib(createStaticStdlib(), scale),
			width,
			height,
			aspectRatio,
			isPortrait,
			isLandscape,
			isSquare,
			data: options.data ?? {},
			assets: options.assets ?? {},
			asset: options.assetResolver ?? ((filename) => filename)
		};
	}
	function createSvgRenderContext(width, height, options = {}) {
		const base = createImageRenderContext(width, height, options);
		return {
			...base,
			std: base.std,
			...options.duration !== void 0 ? { duration: options.duration } : {}
		};
	}
	// packages/superimg-stdlib/dist/measure.js
	/** Approximate metrics (~0.55em avg glyph width). Works browser-free in resvg. */
	function heuristicWidth(text, fontSize, letterSpacing = 0) {
		return text.length * fontSize * .55 + Math.max(0, text.length - 1) * letterSpacing;
	}
	function heuristicMeasurement(text, fontSize, letterSpacing = 0) {
		const chars = Array.from(text);
		return {
			width: chars.length * fontSize * .55 + Math.max(0, chars.length - 1) * letterSpacing,
			ascent: fontSize * .8,
			descent: fontSize * .2,
			exact: false
		};
	}
	function createTextMeasurer(faces) {
		const indexed = faces.map((face) => ({
			...face,
			familyKey: face.family.trim().toLowerCase(),
			style: face.style === "italic" ? "italic" : "normal"
		}));
		return { measure(text, request) {
			const face = matchFace(indexed, request.fontFamily, request.fontWeight ?? 400, request.fontStyle);
			if (!face) return heuristicMeasurement(text, request.fontSize, request.letterSpacing ?? 0);
			return measureWithFace(text, face.metrics, request.fontSize, request.letterSpacing ?? 0);
		} };
	}
	function measureWithFace(text, metrics, fontSize, letterSpacing) {
		const chars = Array.from(text);
		let units = 0;
		let previous;
		for (const char of chars) {
			const codePoint = char.codePointAt(0);
			if (previous !== void 0) units += metrics.kerning(previous, codePoint);
			units += metrics.advance(codePoint);
			previous = codePoint;
		}
		const scale = fontSize / metrics.unitsPerEm;
		return {
			width: units * scale + Math.max(0, chars.length - 1) * letterSpacing,
			ascent: metrics.ascent * scale,
			descent: metrics.descent * scale,
			exact: true
		};
	}
	function matchFace(faces, fontFamily, weight, fontStyle) {
		const style = fontStyle === "italic" || fontStyle === "oblique" ? "italic" : "normal";
		for (const family of fontFamilyList(fontFamily)) {
			const familyFaces = faces.filter((face) => face.familyKey === family);
			if (familyFaces.length === 0) continue;
			const styled = familyFaces.filter((face) => face.style === style);
			const pool = styled.length > 0 ? styled : familyFaces.filter((face) => face.style === "normal");
			const chosen = nearestWeight(pool.length > 0 ? pool : familyFaces, weight);
			if (chosen) return chosen;
		}
	}
	/** CSS font-family list: commas split families, quotes are not part of the name. */
	function fontFamilyList(value) {
		const families = [];
		let current = "";
		let quote;
		for (const char of value) {
			if (quote) {
				if (char === quote) quote = void 0;
				else current += char;
				continue;
			}
			if (char === "\"" || char === "'") {
				quote = char;
				continue;
			}
			if (char === ",") {
				const name = current.trim().toLowerCase();
				if (name) families.push(name);
				current = "";
				continue;
			}
			current += char;
		}
		const name = current.trim().toLowerCase();
		if (name) families.push(name);
		return families;
	}
	function nearestWeight(faces, weight) {
		const exact = faces.find((face) => face.weight === weight);
		if (exact) return exact;
		const heavier = faces.filter((face) => face.weight > weight).sort((a, b) => a.weight - b.weight);
		const lighter = faces.filter((face) => face.weight < weight).sort((a, b) => b.weight - a.weight);
		if (weight >= 500) return heavier[0] ?? lighter[0];
		return lighter[0] ?? heavier[0];
	}
	function widthOf(text, opts) {
		const key = `${opts.fontFamily ?? ""}\0${opts.fontSize}\0${opts.fontWeight ?? ""}\0${opts.fontStyle ?? ""}\0${opts.letterSpacing ?? 0}\0${text}`;
		const cached = opts.wordWidths?.get(key);
		if (cached !== void 0) return cached;
		const width = opts.measurer ? opts.measurer.measure(text, {
			fontFamily: opts.fontFamily ?? "",
			fontSize: opts.fontSize,
			...opts.fontWeight !== void 0 ? { fontWeight: opts.fontWeight } : {},
			...opts.fontStyle !== void 0 ? { fontStyle: opts.fontStyle } : {},
			...opts.letterSpacing !== void 0 ? { letterSpacing: opts.letterSpacing } : {}
		}).width : heuristicWidth(text, opts.fontSize, opts.letterSpacing ?? 0);
		opts.wordWidths?.set(key, width);
		return width;
	}
	function measureText(text, opts) {
		const { fontSize, letterSpacing = 0, lineHeight = 1.2 } = opts;
		const measured = opts.measurer ? opts.measurer.measure(text, {
			fontFamily: opts.fontFamily ?? "",
			fontSize,
			...opts.fontWeight !== void 0 ? { fontWeight: opts.fontWeight } : {},
			...opts.fontStyle !== void 0 ? { fontStyle: opts.fontStyle } : {},
			letterSpacing
		}) : void 0;
		const width = measured?.width ?? heuristicWidth(text, fontSize, letterSpacing);
		const ascender = measured?.ascent ?? fontSize * .8;
		const descender = measured?.descent ?? fontSize * .2;
		return {
			width,
			height: fontSize * lineHeight,
			ascender,
			descender,
			lines: [{
				text,
				width,
				height: fontSize * lineHeight
			}]
		};
	}
	function wrapText(text, maxWidth, opts) {
		const words = text.split(/[^\S\u00a0\u202f]+/u).filter((word) => word.length > 0);
		const lineHeight = (opts.lineHeight ?? 1.2) * opts.fontSize;
		const lines = [];
		const gap = widthOf(" ", opts) + (opts.letterSpacing ?? 0) * 2;
		let current = [];
		let currentWidth = 0;
		const push = () => {
			if (current.length === 0) return;
			lines.push({
				text: current.join(" "),
				width: currentWidth,
				height: lineHeight
			});
			current = [];
			currentWidth = 0;
		};
		for (const word of words) {
			const wordWidth = widthOf(word, opts);
			if (current.length === 0) {
				current.push(word);
				currentWidth = wordWidth;
				continue;
			}
			const next = currentWidth + gap + wordWidth;
			if (next > maxWidth) {
				push();
				current.push(word);
				currentWidth = wordWidth;
			} else {
				current.push(word);
				currentWidth = next;
			}
		}
		push();
		if (lines.length === 0) lines.push({
			text: "",
			width: 0,
			height: lineHeight
		});
		return {
			lines,
			totalHeight: lines.length * lineHeight
		};
	}
	function fitText(text, box, opts) {
		const maxSize = opts.maxSize ?? 120;
		const minSize = opts.minSize ?? 8;
		let lo = minSize;
		let hi = maxSize;
		let best = {
			fontSize: minSize,
			lines: []
		};
		while (lo <= hi) {
			const mid = Math.floor((lo + hi) / 2);
			const { lines, totalHeight } = wrapText(text, box.width, {
				...opts,
				fontSize: mid
			});
			if (Math.max(...lines.map((l) => l.width), 0) <= box.width && totalHeight <= box.height) {
				best = {
					fontSize: mid,
					lines
				};
				lo = mid + 1;
			} else hi = mid - 1;
		}
		return best;
	}
	// packages/superimg-stdlib/dist/safe-area.js
	const PRESET_TABLE = {
		broadcast: {
			landscape: {
				top: .1,
				right: .05,
				bottom: .1,
				left: .05
			},
			portrait: {
				top: .12,
				right: .06,
				bottom: .14,
				left: .06
			},
			square: {
				top: .1,
				right: .08,
				bottom: .1,
				left: .08
			}
		},
		title: {
			landscape: {
				top: .1,
				right: .1,
				bottom: .1,
				left: .1
			},
			portrait: {
				top: .1,
				right: .1,
				bottom: .1,
				left: .1
			},
			square: {
				top: .1,
				right: .1,
				bottom: .1,
				left: .1
			}
		},
		action: {
			landscape: {
				top: .05,
				right: .05,
				bottom: .05,
				left: .05
			},
			portrait: {
				top: .05,
				right: .05,
				bottom: .05,
				left: .05
			},
			square: {
				top: .05,
				right: .05,
				bottom: .05,
				left: .05
			}
		},
		social: {
			landscape: {
				top: .08,
				right: .08,
				bottom: .12,
				left: .05
			},
			portrait: {
				top: .12,
				right: .14,
				bottom: .18,
				left: .06
			},
			square: {
				top: .1,
				right: .1,
				bottom: .14,
				left: .08
			}
		},
		"social-center": {
			landscape: {
				top: .1,
				right: .15,
				bottom: .12,
				left: .15
			},
			portrait: {
				top: .14,
				right: .16,
				bottom: .2,
				left: .16
			},
			square: {
				top: .12,
				right: .14,
				bottom: .14,
				left: .14
			}
		}
	};
	function getAspectKind(width, height) {
		const ratio = width / height;
		if (ratio < .9) return "portrait";
		if (ratio > 1.1) return "landscape";
		return "square";
	}
	function getSafeArea(width, height, preset = "broadcast") {
		if (preset === "none") return {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0
		};
		const kind = getAspectKind(width, height);
		const table = PRESET_TABLE[preset];
		if (!table) throw new Error(`Unknown safe-area preset "${preset}". Known: none, ${Object.keys(PRESET_TABLE).join(", ")}`);
		const f = table[kind];
		return {
			top: Math.round(height * f.top),
			right: Math.round(width * f.right),
			bottom: Math.round(height * f.bottom),
			left: Math.round(width * f.left)
		};
	}
	/** Safe content box as { x, y, width, height }. */
	function getSafeBox(width, height, preset = "broadcast") {
		const i = getSafeArea(width, height, preset);
		return {
			x: i.left,
			y: i.top,
			width: Math.max(0, width - i.left - i.right),
			height: Math.max(0, height - i.top - i.bottom)
		};
	}
	// packages/superimg-stdlib/dist/vector.js
	//! Semantic SVG authoring nodes. `Vector` bridges layout into an SVG namespace;
	//! the namespaced factories retain native SVG concepts without widening the
	//! top-level primitive catalog.
	function formatVectorPoints(points) {
		if (typeof points === "string") return points;
		return points.map((point) => Array.isArray(point) ? `${point[0]},${point[1]}` : `${point.x},${point.y}`).join(" ");
	}
	const VECTOR_NODE_TYPES = /* @__PURE__ */ new Set([
		"VectorCircle",
		"VectorRect",
		"VectorLine",
		"VectorEllipse",
		"VectorPolyline",
		"VectorPolygon",
		"VectorViewport",
		"VectorLinearGradient",
		"VectorRadialGradient",
		"VectorStop",
		"VectorPattern",
		"VectorFilter",
		"VectorGaussianBlur",
		"VectorMerge",
		"VectorMergeNode",
		"VectorTurbulence",
		"VectorDisplacementMap",
		"Vector",
		"VectorGroup",
		"VectorPath",
		"VectorDefs",
		"VectorMask",
		"VectorClip",
		"VectorText",
		"VectorRun"
	]);
	// packages/superimg-stdlib/dist/layout3.js
	//! Bind persistent subjects to immutable design data. No clock, storage or approval policy.
	//! Pure authored scene resolution. No clock, DOM, host commands, or mutable rig instances.
	const IDENTITY_MATRIX = Object.freeze({
		a: 1,
		b: 0,
		c: 0,
		d: 1,
		e: 0,
		f: 0
	});
	function multiplySceneMatrices(l, r) {
		return {
			a: l.a * r.a + l.c * r.b,
			b: l.b * r.a + l.d * r.b,
			c: l.a * r.c + l.c * r.d,
			d: l.b * r.c + l.d * r.d,
			e: l.a * r.e + l.c * r.f + l.e,
			f: l.b * r.e + l.d * r.f + l.f
		};
	}
	const qualify = (scope, id) => `${scope}/${encodeURIComponent(id)}`;
	function assertId(id) {
		if (typeof id !== "string" || !id || id.trim() !== id) throw new TypeError("Scene identities must be nonempty trimmed strings");
	}
	function semanticNode(id, semantic = {}, parentId = null) {
		const actions = [...new Set(semantic.actions ?? [])];
		for (const a of actions) if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(a)) throw new TypeError(`Invalid scene action ${a}`);
		return {
			id,
			kind: semantic.kind ?? "instance",
			role: semantic.role ?? null,
			label: semantic.label ?? null,
			state: semantic.state ?? null,
			space: semantic.space ?? "world",
			parentId,
			childIds: [],
			tags: [...semantic.tags ?? []],
			actions,
			visible: true,
			opacity: 1,
			transform: {},
			animation: null,
			properties: {},
			metadata: { ...semantic.metadata ?? {} }
		};
	}
	function semanticAttrs(node) {
		return {
			"data-si-node": node.id,
			...node.actions.length ? { "data-si-actions": node.actions.join(" ") } : {}
		};
	}
	function mapChild(c, fn) {
		return Array.isArray(c) ? mapChildren(c, fn) : isMediaElement(c) ? fn(c) : c;
	}
	function mapChildren(children, fn) {
		let changed;
		for (let index = 0; index < children.length; index++) {
			const child = children[index], next = mapChild(child, fn);
			if (!changed && next !== child) {
				changed = [];
				for (let before = 0; before < index; before++) changed.push(children[before]);
			}
			if (changed) changed.push(next);
		}
		return changed ?? children;
	}
	/** Resolve once into an ordinary tree and a packet describing that exact tree. */
	function resolveSceneTree(tree, options = {}) {
		if (tree.type === "Instance") throw new TypeError("Instance must be placed inside Scene");
		if (tree.type === "Scene") {
			if (!tree.sceneResolver) throw new TypeError("Use Scene() to create an authored spatial scene");
			return tree.sceneResolver(options);
		}
		const children = mapChildren(tree.children, (n) => resolveSceneTree(n, options));
		const sem = tree.props.semantic;
		const props = sem && typeof tree.props["data-si-node"] !== "string" ? {
			...tree.props,
			...semanticAttrs(semanticNode(qualify(options.prefix ?? "media", sem.id ?? tree.props.id ?? ""), sem))
		} : tree.props;
		if (sem) assertId(sem.id ?? tree.props.id ?? "");
		return props === tree.props && children === tree.children ? tree : {
			...tree,
			props,
			children
		};
	}
	//! One resolved text style shared by approximate geometry and HTML paint.
	const laidOutTypography = /* @__PURE__ */ new WeakMap();
	function finite$3(value) {
		return typeof value === "number" && Number.isFinite(value) ? value : void 0;
	}
	function resolveTypography(el, canvasWidth) {
		const explicit = finite$3(el.props.size);
		const scale = canvasWidth / 1920;
		const variant = el.props.variant;
		const sizes = variant === "display" ? [28, 96] : variant === "title" ? [20, 40] : variant === "caption" ? [11, 14] : variant === "label" ? [10, 12] : [14, 18];
		return {
			fontSize: explicit !== void 0 && explicit > 0 ? explicit : Math.max(sizes[0], Math.round(sizes[1] * scale)),
			fontWeight: finite$3(el.props.weight) ?? (variant === "display" || variant === "title" ? 700 : 500),
			fontFamily: typeof el.props.fontFamily === "string" ? el.props.fontFamily : "Inter, system-ui, sans-serif",
			lineHeight: finite$3(el.props.lineHeight) ?? 1.2,
			letterSpacing: finite$3(el.props.letterSpacing),
			textAlign: typeof el.props.align === "string" ? el.props.align : "left",
			whiteSpace: finite$3(el.props.maxWidth) !== void 0 ? "pre-wrap" : "nowrap"
		};
	}
	function rememberTypography(el, style) {
		laidOutTypography.set(el, style);
		return el;
	}
	function typographyForPaint(el, canvasWidth) {
		return laidOutTypography.get(el) ?? resolveTypography(el, canvasWidth);
	}
	//! Resolve primitive geometry onto `node.layout` before lowering.
	[...VECTOR_NODE_TYPES];
	const layoutMetadata = /* @__PURE__ */ new WeakMap();
	function rememberLayout(node, parentContent, content) {
		layoutMetadata.set(node, {
			parentContent: { ...parentContent },
			content: { ...content }
		});
		return node;
	}
	function num(value) {
		return typeof value === "number" && Number.isFinite(value) ? value : void 0;
	}
	function resolvePad$1(pad) {
		if (typeof pad === "number" && Number.isFinite(pad)) return {
			top: pad,
			right: pad,
			bottom: pad,
			left: pad
		};
		if (pad && typeof pad === "object") {
			const p = pad;
			const x = num(p.x) ?? 0;
			const y = num(p.y) ?? 0;
			return {
				top: num(p.top) ?? y,
				right: num(p.right) ?? x,
				bottom: num(p.bottom) ?? y,
				left: num(p.left) ?? x
			};
		}
		return {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0
		};
	}
	function inset$1(box, pad) {
		return {
			x: box.x + pad.left,
			y: box.y + pad.top,
			width: Math.max(0, box.width - pad.left - pad.right),
			height: Math.max(0, box.height - pad.top - pad.bottom)
		};
	}
	function withLayout(el, layout, children) {
		return {
			...el,
			layout,
			children: children ?? el.children
		};
	}
	function childText$1(el) {
		const parts = [];
		const walk = (c) => {
			if (typeof c === "string" || typeof c === "number") parts.push(String(c));
			else if (Array.isArray(c)) c.forEach(walk);
			else if (isMediaElement(c)) c.children.forEach(walk);
		};
		el.children.forEach(walk);
		return parts.join("");
	}
	/** Each evaluation owns its measurement memo; authored nodes may be reused safely. */
	function createLayoutPass(canvasWidth, measurer) {
		const wordWidths = /* @__PURE__ */ new Map();
		const intrinsicMemo = /* @__PURE__ */ new WeakMap();
		function measureTextNode(el, parent) {
			const { fontSize: size, fontFamily, fontWeight, letterSpacing, lineHeight } = resolveTypography(el, canvasWidth);
			const fontStyle = fontStyleOf(el);
			const maxWidth = num(el.props.maxWidth) ?? parent.width;
			const text = childText$1(el) || " ";
			const measureOpts = {
				fontSize: size,
				fontFamily,
				fontWeight,
				fontStyle,
				...letterSpacing !== void 0 ? { letterSpacing } : {},
				lineHeight,
				...measurer !== void 0 ? { measurer } : {},
				wordWidths
			};
			const wrapped = wrapText(text, maxWidth, measureOpts);
			const measured = measureText(text, measureOpts);
			const rawW = Math.max(measured.width, ...wrapped.lines.map((line) => line.width));
			const lines = wrapped.lines.map((line) => line.text);
			const whiteSpace = lines.length > 1 ? "pre" : "nowrap";
			const metricsExact = measurer?.measure(text, {
				fontFamily,
				fontSize: size,
				fontWeight,
				fontStyle,
				...letterSpacing !== void 0 ? { letterSpacing } : {}
			}).exact ?? false;
			return {
				x: parent.x,
				y: parent.y,
				width: Math.min(maxWidth, rawW),
				height: wrapped.totalHeight || measured.height,
				whiteSpace,
				lines,
				lineWidths: wrapped.lines.map((line) => line.width),
				metricsExact
			};
		}
		function resolvedBox(el, parent) {
			const intrinsic = intrinsicSize(el, parent);
			const width = el.props.width === "fill" ? parent.width : num(el.props.width) ?? Math.max(0, intrinsic.width);
			const height = el.props.height === "fill" ? parent.height : num(el.props.height) ?? Math.max(0, intrinsic.height);
			return {
				x: parent.x + (num(el.props.x) ?? 0),
				y: parent.y + (num(el.props.y) ?? 0),
				width,
				height
			};
		}
		function isFillWidth(el) {
			if (el.type === "Spacer") return el.props.width === "fill" || el.props.width === void 0 && el.props.height === void 0;
			if (el.type === "Text") return false;
			return el.props.width === "fill";
		}
		function isFillHeight(el) {
			if (el.type === "Spacer") return el.props.height === "fill" || el.props.width === void 0 && el.props.height === void 0;
			if (el.type === "Text") return false;
			return el.props.height === "fill";
		}
		function contentSize(el, parent) {
			const pad = resolvePad$1(el.props.pad);
			const kids = el.children.filter(isMediaElement);
			const inner = {
				x: parent.x + pad.left,
				y: parent.y + pad.top,
				width: Math.max(0, (num(el.props.width) ?? parent.width) - pad.left - pad.right),
				height: Math.max(0, (num(el.props.height) ?? parent.height) - pad.top - pad.bottom)
			};
			const sizes = kids.map((k) => intrinsicSize(k, inner));
			const gapTotal = (num(el.props.gap) ?? 0) * Math.max(0, kids.length - 1);
			if (el.type === "Stack" && el.props.direction === "row") return {
				width: sizes.reduce((sum, s) => sum + s.width, 0) + gapTotal + pad.left + pad.right,
				height: Math.max(0, ...sizes.map((s) => s.height)) + pad.top + pad.bottom
			};
			if (el.type === "Stack") return {
				width: Math.max(0, ...sizes.map((s) => s.width)) + pad.left + pad.right,
				height: sizes.reduce((sum, s) => sum + s.height, 0) + gapTotal + pad.top + pad.bottom
			};
			return {
				width: Math.max(0, ...sizes.map((s) => s.width)) + pad.left + pad.right,
				height: Math.max(0, ...sizes.map((s) => s.height)) + pad.top + pad.bottom
			};
		}
		function intrinsicSize(el, parent) {
			let entries = intrinsicMemo.get(el);
			if (!entries) intrinsicMemo.set(el, entries = /* @__PURE__ */ new Map());
			const key = el.type === "Text" ? String(num(el.props.maxWidth) ?? parent.width) : `${parent.width}:${parent.height}`;
			const cached = entries.get(key);
			if (cached) return cached;
			const size = measureIntrinsicSize(el, parent);
			entries.set(key, size);
			return size;
		}
		function measureIntrinsicSize(el, parent) {
			if (el.type === "Text") {
				const m = measureTextNode(el, parent);
				return {
					width: m.width,
					height: m.height,
					whiteSpace: m.whiteSpace,
					lines: m.lines,
					lineWidths: m.lineWidths,
					metricsExact: m.metricsExact
				};
			}
			if (el.type === "Spacer") return {
				width: num(el.props.width) ?? 0,
				height: num(el.props.height) ?? 0
			};
			if (el.type === "Code") {
				const code = typeof el.props.code === "string" ? el.props.code : childText$1(el);
				const lines = Math.max(1, code.split("\n").length);
				return {
					width: num(el.props.width) ?? parent.width,
					height: lines * 14 * 1.45 + 24
				};
			}
			const w = num(el.props.width);
			const h = num(el.props.height);
			if (w !== void 0 && h !== void 0) return {
				width: w,
				height: h
			};
			const content = contentSize(el, parent);
			return {
				width: w ?? (isFillWidth(el) ? 0 : content.width),
				height: h ?? (isFillHeight(el) ? 0 : content.height)
			};
		}
		function layoutChildren(children, parent) {
			return children.map((child) => {
				if (!isMediaElement(child)) return child;
				return layoutElement(child, parent);
			});
		}
		function layoutFrame(el, parent) {
			const outer = resolvedBox(el, parent);
			const inner = inset$1(outer, resolvePad$1(el.props.pad));
			return rememberLayout(withLayout(el, outer, layoutChildren(el.children, inner)), parent, inner);
		}
		function layoutStack(el, parent) {
			if (el.props.x !== void 0 || el.props.y !== void 0) throw new Error("Stack cannot take x/y — wrap in a Frame to position or slide");
			const pad = resolvePad$1(el.props.pad);
			const frame = resolvedBox(el, parent);
			const inner = inset$1(frame, pad);
			const direction = el.props.direction === "row" ? "row" : "column";
			const gap = num(el.props.gap) ?? 0;
			const nodes = el.children.filter(isMediaElement);
			const others = el.children.filter((c) => !isMediaElement(c));
			if (nodes.length === 0) return rememberLayout(withLayout(el, frame, others), parent, inner);
			const mainMax = direction === "row" ? inner.width : inner.height;
			const crossMax = direction === "row" ? inner.height : inner.width;
			const sizes = nodes.map((n) => intrinsicSize(n, inner));
			const fillFlags = nodes.map((n) => direction === "row" ? isFillWidth(n) : isFillHeight(n));
			const fixed = sizes.reduce((sum, s, i) => sum + (fillFlags[i] ? 0 : direction === "row" ? s.width : s.height), 0);
			const fillCount = fillFlags.filter(Boolean).length;
			const gapTotal = gap * Math.max(0, nodes.length - 1);
			const leftover = Math.max(0, mainMax - fixed - gapTotal);
			const fillShare = fillCount > 0 ? leftover / fillCount : 0;
			const mains = nodes.map((n, i) => {
				if (fillFlags[i]) return fillShare;
				return direction === "row" ? sizes[i].width : sizes[i].height;
			});
			const used = mains.reduce((a, b) => a + b, 0) + gapTotal;
			const justify = typeof el.props.justify === "string" ? el.props.justify : "start";
			let cursor = 0;
			if (justify === "center") cursor = (mainMax - used) / 2;
			else if (justify === "end") cursor = mainMax - used;
			const align = typeof el.props.align === "string" ? el.props.align : "stretch";
			const laid = [];
			for (let i = 0; i < nodes.length; i++) {
				const main = mains[i];
				const node = nodes[i];
				const stretchText = direction === "column" && align === "center" && node.type === "Text";
				const fillCross = direction === "row" ? isFillHeight(node) : isFillWidth(node);
				const crossIntrinsic = direction === "row" ? sizes[i].height : sizes[i].width;
				const cross = align === "stretch" || fillCross || stretchText ? crossMax : crossIntrinsic;
				let crossOff = 0;
				if (!fillCross && !stretchText && align === "center") crossOff = (crossMax - cross) / 2;
				else if (!fillCross && !stretchText && align === "end") crossOff = crossMax - cross;
				const childBox = direction === "row" ? {
					x: inner.x + cursor,
					y: inner.y + crossOff,
					width: main,
					height: cross
				} : {
					x: inner.x + crossOff,
					y: inner.y + cursor,
					width: cross,
					height: main
				};
				const placed = stretchText && node.props.align === void 0 ? {
					...node,
					props: {
						...node.props,
						align: "center"
					}
				} : node;
				if (placed !== node) {
					const measurements = intrinsicMemo.get(node);
					if (measurements) intrinsicMemo.set(placed, measurements);
				}
				laid.push(layoutElement(placed, childBox));
				cursor += main + gap;
				if (justify === "space-between" && fillCount === 0 && nodes.length > 1 && i < nodes.length - 1) cursor += leftover / (nodes.length - 1);
			}
			return rememberLayout(withLayout(el, frame, [...laid, ...others]), parent, inner);
		}
		function layoutText(el, parent) {
			const measured = intrinsicSize(el, parent);
			const typography = resolveTypography(el, canvasWidth);
			if (measured.whiteSpace) typography.whiteSpace = measured.whiteSpace;
			if (measured.lines) typography.lines = measured.lines;
			if (measured.lineWidths) typography.lineWidths = measured.lineWidths;
			typography.metricsExact = measured.metricsExact === true;
			const align = typeof el.props.align === "string" ? el.props.align : "left";
			const box = {
				width: measured.width,
				height: measured.height
			};
			if (align === "center") return rememberTypography(rememberLayout(withLayout(el, {
				x: parent.x,
				y: parent.y,
				width: parent.width,
				height: measured.height
			}), parent, parent), typography);
			let x = parent.x;
			if (align === "right") x = parent.x + parent.width - box.width;
			return rememberTypography(rememberLayout(withLayout(el, {
				x,
				y: parent.y,
				...box
			}), parent, parent), typography);
		}
		function layoutSafe(el, parent) {
			const preset = typeof el.props.preset === "string" ? el.props.preset : "broadcast";
			const box = getSafeBox(parent.width, parent.height, preset);
			const inner = {
				x: parent.x + box.x,
				y: parent.y + box.y,
				width: box.width,
				height: box.height
			};
			return withLayout(el, inner, layoutChildren(el.children, inner));
		}
		function layoutVectorDescendant(el, parent) {
			if (el.type === "Vector") return layoutVector(el, parent);
			const children = el.children.map((child) => isMediaElement(child) ? layoutVectorDescendant(child, parent) : child);
			return {
				...el,
				children
			};
		}
		function layoutVector(el, parent) {
			const outer = resolvedBox(el, parent);
			return withLayout(el, outer, el.children.map((child) => isMediaElement(child) ? layoutVectorDescendant(child, outer) : child));
		}
		function layoutGeneric(el, parent) {
			const box = {
				x: parent.x + (num(el.props.x) ?? 0),
				y: parent.y + (num(el.props.y) ?? 0),
				width: num(el.props.width) ?? parent.width,
				height: num(el.props.height) ?? parent.height
			};
			return withLayout(el, box, layoutChildren(el.children, box));
		}
		function layoutElement(el, parent) {
			switch (el.type) {
				case "Frame":
				case "Fill":
				case "Image":
				case "Video":
				case "Plate":
				case "Html": return layoutFrame(el, parent);
				case "Stack": return layoutStack(el, parent);
				case "Text": return layoutText(el, parent);
				case "Safe": return layoutSafe(el, parent);
				case "Code": return layoutFrame(el, parent);
				case "Vector": return layoutVector(el, parent);
				case "Spacer": return withLayout(el, {
					x: parent.x,
					y: parent.y,
					width: num(el.props.width) ?? parent.width,
					height: num(el.props.height) ?? parent.height
				});
				default: return layoutGeneric(el, parent);
			}
		}
		return layoutElement;
	}
	function fontStyleOf(el) {
		const value = el.props.fontStyle;
		return value === "italic" || value === "oblique" ? "italic" : "normal";
	}
	function layoutTree(root, canvas) {
		root = resolveSceneTree(root);
		const width = num(root.props.width) ?? canvas?.width ?? root.layout?.width ?? 1920;
		const height = num(root.props.height) ?? canvas?.height ?? root.layout?.height ?? 1080;
		return createLayoutPass(width, canvas?.measurer)(root, {
			x: 0,
			y: 0,
			width,
			height
		});
	}
	// packages/superimg-stdlib/dist/escape-html.js
	/** Escape text inserted by layout-tree primitives. */
	function escapeHtml$1(value) {
		const entities = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#039;"
		};
		return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
	}
	// packages/superimg-stdlib/dist/tree/lower.js
	//! Lower a media tree to an HTML or SVG markup string.
	function clampReveal(value) {
		if (typeof value !== "number" || !Number.isFinite(value)) return void 0;
		return Math.max(0, Math.min(1, value));
	}
	function sliceStringLinesByReveal(lines, reveal) {
		const total = lines.reduce((sum, line) => sum + Array.from(String(line)).length, 0);
		let remaining = Math.round(reveal * total);
		if (remaining <= 0) return [];
		if (remaining >= total) return [...lines];
		const out = [];
		for (const line of lines) {
			if (remaining <= 0) break;
			const chars = Array.from(String(line));
			const slice = chars.slice(0, remaining).join("");
			remaining -= Math.min(remaining, chars.length);
			out.push(slice);
		}
		return out;
	}
	// packages/superimg-stdlib/dist/code.js
	var code_exports = /* @__PURE__ */ __exportAll$1({
		getLangs: () => getLangs,
		getThemes: () => getThemes,
		highlight: () => highlight,
		tokenize: () => tokenize$1
	});
	//! Deterministic, synchronous syntax highlighting for rendered code blocks.
	//!
	//! Player frames need a synchronous pure function. Pulling the full Shiki
	//! grammar/runtime graph into every Player made the base preview hundreds of
	//! kilobytes larger, so the stdlib uses a compact lexer with stable inline
	//! colors. Documentation sites can still use Shiki on the server.
	const PALETTES = {
		"dark-plus": {
			background: "#1e1e1e",
			foreground: "#d4d4d4",
			keyword: "#569cd6",
			string: "#ce9178",
			number: "#b5cea8",
			comment: "#6a9955",
			punctuation: "#d4d4d4"
		},
		"github-light": {
			background: "#ffffff",
			foreground: "#24292f",
			keyword: "#cf222e",
			string: "#0a3069",
			number: "#0550ae",
			comment: "#6e7781",
			punctuation: "#24292f"
		},
		"github-dark": {
			background: "#0d1117",
			foreground: "#c9d1d9",
			keyword: "#ff7b72",
			string: "#a5d6ff",
			number: "#79c0ff",
			comment: "#8b949e",
			punctuation: "#c9d1d9"
		},
		dracula: {
			background: "#282a36",
			foreground: "#f8f8f2",
			keyword: "#ff79c6",
			string: "#f1fa8c",
			number: "#bd93f9",
			comment: "#6272a4",
			punctuation: "#f8f8f2"
		},
		nord: {
			background: "#2e3440",
			foreground: "#d8dee9",
			keyword: "#81a1c1",
			string: "#a3be8c",
			number: "#b48ead",
			comment: "#616e88",
			punctuation: "#d8dee9"
		}
	};
	const KEYWORDS = /* @__PURE__ */ new Set([
		"as",
		"async",
		"await",
		"break",
		"case",
		"catch",
		"class",
		"const",
		"continue",
		"def",
		"default",
		"delete",
		"do",
		"else",
		"enum",
		"export",
		"extends",
		"false",
		"fn",
		"for",
		"from",
		"func",
		"function",
		"if",
		"impl",
		"import",
		"in",
		"interface",
		"let",
		"match",
		"mod",
		"new",
		"null",
		"package",
		"pub",
		"return",
		"self",
		"static",
		"struct",
		"switch",
		"this",
		"throw",
		"true",
		"try",
		"type",
		"undefined",
		"use",
		"var",
		"while",
		"with",
		"yield"
	]);
	const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|<!--[\s\S]*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[^\w\s]+)/g;
	function escapeHtml(value) {
		return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
	}
	function span(color, value) {
		return `<span style="color:${color}">${escapeHtml(value)}</span>`;
	}
	function tokenColor(token, palette) {
		if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#") || token.startsWith("<!--")) return palette.comment;
		if (token.startsWith("\"") || token.startsWith("'") || token.startsWith("`")) return palette.string;
		if (/^\d/.test(token)) return palette.number;
		if (KEYWORDS.has(token)) return palette.keyword;
		if (/^[^\w\s]+$/.test(token)) return palette.punctuation;
		return null;
	}
	/** Same lexer as `highlight`, as tokens instead of HTML spans. */
	function tokenize$1(code, theme = "dark-plus") {
		const palette = PALETTES[theme] ?? PALETTES["dark-plus"];
		const tokens = [];
		let cursor = 0;
		for (const match of code.matchAll(new RegExp(TOKEN_RE.source, "g"))) {
			const index = match.index ?? 0;
			if (index > cursor) tokens.push({
				text: code.slice(cursor, index),
				color: null
			});
			const token = match[0];
			tokens.push({
				text: token,
				color: tokenColor(token, palette)
			});
			cursor = index + token.length;
		}
		if (cursor < code.length) tokens.push({
			text: code.slice(cursor),
			color: null
		});
		return {
			background: palette.background,
			foreground: palette.foreground,
			tokens
		};
	}
	function highlightTokens(source, palette) {
		return tokenize$1(source, Object.keys(PALETTES).find((name) => PALETTES[name] === palette) ?? "dark-plus").tokens.map((token) => token.color ? span(token.color, token.text) : escapeHtml(token.text)).join("");
	}
	function highlight(code, options) {
		const theme = options.theme ?? "dark-plus";
		const palette = PALETTES[theme];
		const content = highlightTokens(code, palette);
		const html = `<pre class="shiki ${theme}" style="background-color:${palette.background};color:${palette.foreground}" tabindex="0"><code>${content}</code></pre>`;
		return options.lineNumbers ? addLineNumbers(html) : html;
	}
	function addLineNumbers(html) {
		return html.replace(/(<code[^>]*>)([\s\S]*?)(<\/code>)/, (_, open, content, close) => {
			const lines = content.split("\n");
			const padding = String(lines.length).length;
			return `${open}${lines.map((line, index) => {
				return `<span class="line"><span class="line-number" style="user-select:none;opacity:0.5;margin-right:1em;">${String(index + 1).padStart(padding, " ")}</span>${line}</span>`;
			}).join("\n")}${close}`;
		});
	}
	function getThemes() {
		return [
			"dark-plus",
			"github-light",
			"github-dark",
			"dracula",
			"nord"
		];
	}
	function getLangs() {
		return [
			"javascript",
			"js",
			"typescript",
			"ts",
			"json",
			"html",
			"css",
			"python",
			"py",
			"rust",
			"go",
			"bash",
			"sh",
			"markdown",
			"md"
		];
	}
	// packages/superimg-stdlib/dist/colord.js
	for (var r$1 = {
		grad: .9,
		turn: 360,
		rad: 360 / (2 * Math.PI)
	}, t$1 = function(r) {
		return "string" == typeof r ? r.length > 0 : "number" == typeof r;
	}, n$1 = function(r, t, n) {
		return void 0 === t && (t = 0), void 0 === n && (n = Math.pow(10, t)), Math.round(n * r) / n + 0;
	}, u$1 = function(r) {
		var t = Math.round(100 * r) / 100;
		return Math.round(255 * t) === 255 * r ? t : Math.round(1e3 * r) / 1e3;
	}, e$1 = function(r, t, n) {
		return void 0 === t && (t = 0), void 0 === n && (n = 1), r > n ? n : r > t ? r : t;
	}, o$1 = function(r) {
		return (r = isFinite(r) ? r % 360 : 0) < 0 ? r + 360 : r;
	}, a$1 = function(r, t) {
		return void 0 === t && (t = 0), n$1(r, t) % 360;
	}, i$1 = function(r) {
		return {
			r: e$1(r.r, 0, 255),
			g: e$1(r.g, 0, 255),
			b: e$1(r.b, 0, 255),
			a: e$1(r.a)
		};
	}, s = function(r) {
		return {
			r: n$1(r.r),
			g: n$1(r.g),
			b: n$1(r.b),
			a: u$1(r.a)
		};
	}, d = /^#([0-9a-f]{3,8})$/i, h$1 = function(r, t) {
		var n = r.charCodeAt(t);
		return (15 & n) + 9 * (n >> 6);
	}, b$1 = function(r, t) {
		return h$1(r, t) << 4 | h$1(r, t + 1);
	}, f$1 = [], g = 0; g < 256; g++) f$1.push((g < 16 ? "0" : "") + g.toString(16));
	var c$1 = function(r) {
		return f$1[e$1(r, 0, 255)];
	};
	var v = function(r) {
		var t = r.r, n = r.g, u = r.b, e = r.a, o = Math.max(t, n, u), a = o - Math.min(t, n, u), i = a ? o === t ? (n - u) / a : o === n ? 2 + (u - t) / a : 4 + (t - n) / a : 0;
		return {
			h: 60 * (i < 0 ? i + 6 : i),
			s: o ? a / o * 100 : 0,
			v: o / 255 * 100,
			a: e
		};
	};
	var l = function(r) {
		var t = r.h, n = r.s, u = r.v, e = r.a;
		t = t / 360 * 6, n /= 100, u /= 100;
		var o = Math.floor(t), a = u * (1 - n), i = u * (1 - (t - o) * n), s = u * (1 - (1 - t + o) * n), d = o % 6;
		return {
			r: 255 * [
				u,
				i,
				a,
				a,
				s,
				u
			][d],
			g: 255 * [
				s,
				u,
				u,
				i,
				a,
				a
			][d],
			b: 255 * [
				a,
				a,
				s,
				u,
				u,
				i
			][d],
			a: e
		};
	};
	var p$1 = function(r) {
		return {
			h: o$1(r.h),
			s: e$1(r.s, 0, 100),
			l: e$1(r.l, 0, 100),
			a: e$1(r.a)
		};
	};
	var m = function(r) {
		return {
			h: a$1(r.h),
			s: n$1(r.s),
			l: n$1(r.l),
			a: u$1(r.a)
		};
	};
	var y = function(r) {
		return l((n = (t = r).s, {
			h: t.h,
			s: (n *= ((u = t.l) < 50 ? u : 100 - u) / 100) > 0 ? 2 * n / (u + n) * 100 : 0,
			v: u + n,
			a: t.a
		}));
		var t, n, u;
	};
	var N = function(r) {
		return {
			h: (t = v(r)).h,
			s: (e = (200 - (n = t.s)) * (u = t.v) / 100) > 0 && e < 200 ? n * u / 100 / (e <= 100 ? e : 200 - e) * 100 : 0,
			l: e / 2,
			a: t.a
		};
		var t, n, u, e;
	};
	var M = /^hsla?\(\s*([+-]?(?:\d*\.\d+|\d+))(deg|rad|grad|turn)?\s*,\s*([+-]?(?:\d*\.\d+|\d+))%\s*,\s*([+-]?(?:\d*\.\d+|\d+))%\s*(?:,\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s*)?\)$/i;
	var x = /^hsla?\(\s*([+-]?(?:\d*\.\d+|\d+))(deg|rad|grad|turn)?\s+([+-]?(?:\d*\.\d+|\d+))%\s+([+-]?(?:\d*\.\d+|\d+))%\s*(?:\/\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s*)?\)$/i;
	var H = /^rgba?\(\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s*,\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s*,\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s*(?:,\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s*)?\)$/i;
	var $ = /^rgba?\(\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s+([+-]?(?:\d*\.\d+|\d+))(%)?\s+([+-]?(?:\d*\.\d+|\d+))(%)?\s*(?:\/\s*([+-]?(?:\d*\.\d+|\d+))(%)?\s*)?\)$/i;
	var j = {
		string: [
			[function(r) {
				if (!d.test(r)) return null;
				var t = r.length;
				return t <= 5 ? {
					r: 17 * h$1(r, 1),
					g: 17 * h$1(r, 2),
					b: 17 * h$1(r, 3),
					a: 5 === t ? 17 * h$1(r, 4) / 255 : 1
				} : 7 === t || 9 === t ? {
					r: b$1(r, 1),
					g: b$1(r, 3),
					b: b$1(r, 5),
					a: 9 === t ? b$1(r, 7) / 255 : 1
				} : null;
			}, "hex"],
			[function(r) {
				var t = H.exec(r) || $.exec(r);
				return t ? t[2] !== t[4] || t[4] !== t[6] ? null : i$1({
					r: Number(t[1]) / (t[2] ? 100 / 255 : 1),
					g: Number(t[3]) / (t[4] ? 100 / 255 : 1),
					b: Number(t[5]) / (t[6] ? 100 / 255 : 1),
					a: void 0 === t[7] ? 1 : Number(t[7]) / (t[8] ? 100 : 1)
				}) : null;
			}, "rgb"],
			[function(t) {
				var n = M.exec(t) || x.exec(t);
				if (!n) return null;
				var u, e;
				return y(p$1({
					h: (u = n[1], e = n[2], void 0 === e && (e = "deg"), Number(u) * (r$1[e] || 1)),
					s: Number(n[3]),
					l: Number(n[4]),
					a: void 0 === n[5] ? 1 : Number(n[5]) / (n[6] ? 100 : 1)
				}));
			}, "hsl"]
		],
		object: [
			[function(r) {
				var n = r.r, u = r.g, e = r.b, o = r.a, a = void 0 === o ? 1 : o;
				return t$1(n) && t$1(u) && t$1(e) ? i$1({
					r: Number(n),
					g: Number(u),
					b: Number(e),
					a: Number(a)
				}) : null;
			}, "rgb"],
			[function(r) {
				var n = r.h, u = r.s, e = r.l, o = r.a, a = void 0 === o ? 1 : o;
				if (!t$1(n) || !t$1(u) || !t$1(e)) return null;
				return y(p$1({
					h: Number(n),
					s: Number(u),
					l: Number(e),
					a: Number(a)
				}));
			}, "hsl"],
			[function(r) {
				var n = r.h, u = r.s, a = r.v, i = r.a, s = void 0 === i ? 1 : i;
				if (!t$1(n) || !t$1(u) || !t$1(a)) return null;
				return l(function(r) {
					return {
						h: o$1(r.h),
						s: e$1(r.s, 0, 100),
						v: e$1(r.v, 0, 100),
						a: e$1(r.a)
					};
				}({
					h: Number(n),
					s: Number(u),
					v: Number(a),
					a: Number(s)
				}));
			}, "hsv"]
		]
	};
	var w = function(r, t) {
		for (var n = 0; n < t.length; n++) {
			var u = t[n][0](r);
			if (u) return [u, t[n][1]];
		}
		return [null, void 0];
	};
	var S = function(r) {
		return "string" == typeof r ? w(r.trim(), j.string) : "object" == typeof r && null !== r ? w(r, j.object) : [null, void 0];
	};
	var E = function(r, t) {
		var n = N(r);
		return {
			h: n.h,
			s: e$1(n.s + 100 * t, 0, 100),
			l: n.l,
			a: n.a
		};
	};
	var R = function(r) {
		return (299 * r.r + 587 * r.g + 114 * r.b) / 1e3 / 255;
	};
	var q = function(r, t) {
		var n = N(r);
		return {
			h: n.h,
			s: n.s,
			l: e$1(n.l + 100 * t, 0, 100),
			a: n.a
		};
	};
	var A = function() {
		function r(r) {
			this.parsed = S(r)[0], this.rgba = this.parsed || {
				r: 0,
				g: 0,
				b: 0,
				a: 1
			};
		}
		return r.prototype.isValid = function() {
			return null !== this.parsed;
		}, r.prototype.brightness = function() {
			return n$1(R(this.rgba), 2);
		}, r.prototype.isDark = function() {
			return R(this.rgba) < .5;
		}, r.prototype.isLight = function() {
			return R(this.rgba) >= .5;
		}, r.prototype.toHex = function() {
			return r = s(this.rgba), t = r.r, u = r.g, e = r.b, a = (o = r.a) < 1 ? c$1(n$1(255 * o)) : "", "#" + c$1(t) + c$1(u) + c$1(e) + a;
			var r, t, u, e, o, a;
		}, r.prototype.toRgb = function() {
			return s(this.rgba);
		}, r.prototype.toRgbString = function() {
			return r = s(this.rgba), t = r.r, n = r.g, u = r.b, (e = r.a) < 1 ? "rgba(" + t + ", " + n + ", " + u + ", " + e + ")" : "rgb(" + t + ", " + n + ", " + u + ")";
			var r, t, n, u, e;
		}, r.prototype.toHsl = function() {
			return m(N(this.rgba));
		}, r.prototype.toHslString = function() {
			return r = m(N(this.rgba)), t = r.h, n = r.s, u = r.l, (e = r.a) < 1 ? "hsla(" + t + ", " + n + "%, " + u + "%, " + e + ")" : "hsl(" + t + ", " + n + "%, " + u + "%)";
			var r, t, n, u, e;
		}, r.prototype.toHsv = function() {
			return r = v(this.rgba), {
				h: a$1(r.h),
				s: n$1(r.s),
				v: n$1(r.v),
				a: u$1(r.a)
			};
			var r;
		}, r.prototype.invert = function() {
			return C({
				r: 255 - (r = this.rgba).r,
				g: 255 - r.g,
				b: 255 - r.b,
				a: r.a
			});
			var r;
		}, r.prototype.saturate = function(r) {
			return void 0 === r && (r = .1), C(E(this.rgba, r));
		}, r.prototype.desaturate = function(r) {
			return void 0 === r && (r = .1), C(E(this.rgba, -r));
		}, r.prototype.grayscale = function() {
			return C(E(this.rgba, -1));
		}, r.prototype.lighten = function(r) {
			return void 0 === r && (r = .1), C(q(this.rgba, r));
		}, r.prototype.darken = function(r) {
			return void 0 === r && (r = .1), C(q(this.rgba, -r));
		}, r.prototype.rotate = function(r) {
			return void 0 === r && (r = 15), this.hue(N(this.rgba).h + r);
		}, r.prototype.alpha = function(r) {
			return "number" == typeof r ? C({
				r: (t = this.rgba).r,
				g: t.g,
				b: t.b,
				a: r
			}) : u$1(this.rgba.a);
			var t;
		}, r.prototype.hue = function(r) {
			var t = N(this.rgba);
			return "number" == typeof r ? C({
				h: r,
				s: t.s,
				l: t.l,
				a: t.a
			}) : a$1(t.h);
		}, r.prototype.isEqual = function(r) {
			return this.toHex() === C(r).toHex();
		}, r;
	}();
	var C = function(r) {
		return r instanceof A ? r : new A(r);
	};
	var D = [];
	var F = function(r) {
		r.forEach(function(r) {
			D.indexOf(r) < 0 && (r(A, j), D.push(r));
		});
	};
	// packages/superimg-stdlib/dist/segments.js
	const COMMAND = 0;
	const NUMBER = 1;
	const EOD = 2;
	const PARAMS = {
		A: 7,
		a: 7,
		C: 6,
		c: 6,
		H: 1,
		h: 1,
		L: 2,
		l: 2,
		M: 2,
		m: 2,
		Q: 4,
		q: 4,
		S: 4,
		s: 4,
		T: 2,
		t: 2,
		V: 1,
		v: 1,
		Z: 0,
		z: 0
	};
	function tokenize(d) {
		const tokens = new Array();
		while (d !== "") if (d.match(/^([ \t\r\n,]+)/)) d = d.substr(RegExp.$1.length);
		else if (d.match(/^([aAcChHlLmMqQsStTvVzZ])/)) {
			tokens[tokens.length] = {
				type: COMMAND,
				text: RegExp.$1
			};
			d = d.substr(RegExp.$1.length);
		} else if (d.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/)) {
			tokens[tokens.length] = {
				type: NUMBER,
				text: `${parseFloat(RegExp.$1)}`
			};
			d = d.substr(RegExp.$1.length);
		} else return [];
		tokens[tokens.length] = {
			type: EOD,
			text: ""
		};
		return tokens;
	}
	function isType(token, type) {
		return token.type === type;
	}
	function parsePath(d) {
		const segments = [];
		const tokens = tokenize(d);
		let mode = "BOD";
		let index = 0;
		let token = tokens[index];
		while (!isType(token, EOD)) {
			let paramsCount = 0;
			const params = [];
			if (mode === "BOD") {
				if (token.text === "M" || token.text === "m") {
					index++;
					paramsCount = PARAMS[token.text];
					mode = token.text;
				} else return parsePath("M0,0" + d);
			} else if (isType(token, NUMBER)) paramsCount = PARAMS[mode];
			else {
				index++;
				paramsCount = PARAMS[token.text];
				mode = token.text;
			}
			if (index + paramsCount < tokens.length) {
				for (let i = index; i < index + paramsCount; i++) {
					const numbeToken = tokens[i];
					if (isType(numbeToken, NUMBER)) params[params.length] = +numbeToken.text;
					else throw new Error("Param not a number: " + mode + "," + numbeToken.text);
				}
				if (typeof PARAMS[mode] === "number") {
					const segment = {
						key: mode,
						data: params
					};
					segments.push(segment);
					index += paramsCount;
					token = tokens[index];
					if (mode === "M") mode = "L";
					if (mode === "m") mode = "l";
				} else throw new Error("Bad segment: " + mode);
			} else throw new Error("Path data ended short");
		}
		return segments;
	}
	function absolutize(segments) {
		let cx = 0, cy = 0;
		let subx = 0, suby = 0;
		const out = [];
		for (const { key, data } of segments) switch (key) {
			case "M":
				out.push({
					key: "M",
					data: [...data]
				});
				[cx, cy] = data;
				[subx, suby] = data;
				break;
			case "m":
				cx += data[0];
				cy += data[1];
				out.push({
					key: "M",
					data: [cx, cy]
				});
				subx = cx;
				suby = cy;
				break;
			case "L":
				out.push({
					key: "L",
					data: [...data]
				});
				[cx, cy] = data;
				break;
			case "l":
				cx += data[0];
				cy += data[1];
				out.push({
					key: "L",
					data: [cx, cy]
				});
				break;
			case "C":
				out.push({
					key: "C",
					data: [...data]
				});
				cx = data[4];
				cy = data[5];
				break;
			case "c": {
				const newdata = data.map((d, i) => i % 2 ? d + cy : d + cx);
				out.push({
					key: "C",
					data: newdata
				});
				cx = newdata[4];
				cy = newdata[5];
				break;
			}
			case "Q":
				out.push({
					key: "Q",
					data: [...data]
				});
				cx = data[2];
				cy = data[3];
				break;
			case "q": {
				const newdata = data.map((d, i) => i % 2 ? d + cy : d + cx);
				out.push({
					key: "Q",
					data: newdata
				});
				cx = newdata[2];
				cy = newdata[3];
				break;
			}
			case "A":
				out.push({
					key: "A",
					data: [...data]
				});
				cx = data[5];
				cy = data[6];
				break;
			case "a":
				cx += data[5];
				cy += data[6];
				out.push({
					key: "A",
					data: [
						data[0],
						data[1],
						data[2],
						data[3],
						data[4],
						cx,
						cy
					]
				});
				break;
			case "H":
				out.push({
					key: "H",
					data: [...data]
				});
				cx = data[0];
				break;
			case "h":
				cx += data[0];
				out.push({
					key: "H",
					data: [cx]
				});
				break;
			case "V":
				out.push({
					key: "V",
					data: [...data]
				});
				cy = data[0];
				break;
			case "v":
				cy += data[0];
				out.push({
					key: "V",
					data: [cy]
				});
				break;
			case "S":
				out.push({
					key: "S",
					data: [...data]
				});
				cx = data[2];
				cy = data[3];
				break;
			case "s": {
				const newdata = data.map((d, i) => i % 2 ? d + cy : d + cx);
				out.push({
					key: "S",
					data: newdata
				});
				cx = newdata[2];
				cy = newdata[3];
				break;
			}
			case "T":
				out.push({
					key: "T",
					data: [...data]
				});
				cx = data[0];
				cy = data[1];
				break;
			case "t":
				cx += data[0];
				cy += data[1];
				out.push({
					key: "T",
					data: [cx, cy]
				});
				break;
			case "Z":
			case "z":
				out.push({
					key: "Z",
					data: []
				});
				cx = subx;
				cy = suby;
		}
		return out;
	}
	function normalize(segments) {
		const out = [];
		let lastType = "";
		let cx = 0, cy = 0;
		let subx = 0, suby = 0;
		let lcx = 0, lcy = 0;
		for (const { key, data } of segments) {
			switch (key) {
				case "M":
					out.push({
						key: "M",
						data: [...data]
					});
					[cx, cy] = data;
					[subx, suby] = data;
					break;
				case "C":
					out.push({
						key: "C",
						data: [...data]
					});
					cx = data[4];
					cy = data[5];
					lcx = data[2];
					lcy = data[3];
					break;
				case "L":
					out.push({
						key: "L",
						data: [...data]
					});
					[cx, cy] = data;
					break;
				case "H":
					cx = data[0];
					out.push({
						key: "L",
						data: [cx, cy]
					});
					break;
				case "V":
					cy = data[0];
					out.push({
						key: "L",
						data: [cx, cy]
					});
					break;
				case "S": {
					let cx1 = 0, cy1 = 0;
					if (lastType === "C" || lastType === "S") {
						cx1 = cx + (cx - lcx);
						cy1 = cy + (cy - lcy);
					} else {
						cx1 = cx;
						cy1 = cy;
					}
					out.push({
						key: "C",
						data: [
							cx1,
							cy1,
							...data
						]
					});
					lcx = data[0];
					lcy = data[1];
					cx = data[2];
					cy = data[3];
					break;
				}
				case "T": {
					const [x, y] = data;
					let x1 = 0, y1 = 0;
					if (lastType === "Q" || lastType === "T") {
						x1 = cx + (cx - lcx);
						y1 = cy + (cy - lcy);
					} else {
						x1 = cx;
						y1 = cy;
					}
					const cx1 = cx + 2 * (x1 - cx) / 3;
					const cy1 = cy + 2 * (y1 - cy) / 3;
					const cx2 = x + 2 * (x1 - x) / 3;
					const cy2 = y + 2 * (y1 - y) / 3;
					out.push({
						key: "C",
						data: [
							cx1,
							cy1,
							cx2,
							cy2,
							x,
							y
						]
					});
					lcx = x1;
					lcy = y1;
					cx = x;
					cy = y;
					break;
				}
				case "Q": {
					const [x1, y1, x, y] = data;
					const cx1 = cx + 2 * (x1 - cx) / 3;
					const cy1 = cy + 2 * (y1 - cy) / 3;
					const cx2 = x + 2 * (x1 - x) / 3;
					const cy2 = y + 2 * (y1 - y) / 3;
					out.push({
						key: "C",
						data: [
							cx1,
							cy1,
							cx2,
							cy2,
							x,
							y
						]
					});
					lcx = x1;
					lcy = y1;
					cx = x;
					cy = y;
					break;
				}
				case "A": {
					const r1 = Math.abs(data[0]);
					const r2 = Math.abs(data[1]);
					const angle = data[2];
					const largeArcFlag = data[3];
					const sweepFlag = data[4];
					const x = data[5];
					const y = data[6];
					if (r1 === 0 || r2 === 0) {
						out.push({
							key: "C",
							data: [
								cx,
								cy,
								x,
								y,
								x,
								y
							]
						});
						cx = x;
						cy = y;
					} else if (cx !== x || cy !== y) {
						arcToCubicCurves(cx, cy, x, y, r1, r2, angle, largeArcFlag, sweepFlag).forEach(function(curve) {
							out.push({
								key: "C",
								data: curve
							});
						});
						cx = x;
						cy = y;
					}
					break;
				}
				case "Z":
					out.push({
						key: "Z",
						data: []
					});
					cx = subx;
					cy = suby;
			}
			lastType = key;
		}
		return out;
	}
	function degToRad$1(degrees) {
		return Math.PI * degrees / 180;
	}
	function rotate(x, y, angleRad) {
		return [x * Math.cos(angleRad) - y * Math.sin(angleRad), x * Math.sin(angleRad) + y * Math.cos(angleRad)];
	}
	function arcToCubicCurves(x1, y1, x2, y2, r1, r2, angle, largeArcFlag, sweepFlag, recursive) {
		const angleRad = degToRad$1(angle);
		let params = [];
		let f1 = 0, f2 = 0, cx = 0, cy = 0;
		if (recursive) [f1, f2, cx, cy] = recursive;
		else {
			[x1, y1] = rotate(x1, y1, -angleRad);
			[x2, y2] = rotate(x2, y2, -angleRad);
			const x = (x1 - x2) / 2;
			const y = (y1 - y2) / 2;
			let h = x * x / (r1 * r1) + y * y / (r2 * r2);
			if (h > 1) {
				h = Math.sqrt(h);
				r1 = h * r1;
				r2 = h * r2;
			}
			const sign = largeArcFlag === sweepFlag ? -1 : 1;
			const r1Pow = r1 * r1;
			const r2Pow = r2 * r2;
			const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
			const right = r1Pow * y * y + r2Pow * x * x;
			const k = sign * Math.sqrt(Math.abs(left / right));
			cx = k * r1 * y / r2 + (x1 + x2) / 2;
			cy = k * -r2 * x / r1 + (y1 + y2) / 2;
			f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)));
			f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)));
			if (x1 < cx) f1 = Math.PI - f1;
			if (x2 < cx) f2 = Math.PI - f2;
			if (f1 < 0) f1 = Math.PI * 2 + f1;
			if (f2 < 0) f2 = Math.PI * 2 + f2;
			if (sweepFlag && f1 > f2) f1 = f1 - Math.PI * 2;
			if (!sweepFlag && f2 > f1) f2 = f2 - Math.PI * 2;
		}
		let df = f2 - f1;
		if (Math.abs(df) > Math.PI * 120 / 180) {
			const f2old = f2;
			const x2old = x2;
			const y2old = y2;
			if (sweepFlag && f2 > f1) f2 = f1 + Math.PI * 120 / 180 * 1;
			else f2 = f1 + Math.PI * 120 / 180 * -1;
			x2 = cx + r1 * Math.cos(f2);
			y2 = cy + r2 * Math.sin(f2);
			params = arcToCubicCurves(x2, y2, x2old, y2old, r1, r2, angle, 0, sweepFlag, [
				f2,
				f2old,
				cx,
				cy
			]);
		}
		df = f2 - f1;
		const c1 = Math.cos(f1);
		const s1 = Math.sin(f1);
		const c2 = Math.cos(f2);
		const s2 = Math.sin(f2);
		const t = Math.tan(df / 4);
		const hx = 4 / 3 * r1 * t;
		const hy = 4 / 3 * r2 * t;
		const m1 = [x1, y1];
		const m2 = [x1 + hx * s1, y1 - hy * c1];
		const m3 = [x2 + hx * s2, y2 - hy * c2];
		const m4 = [x2, y2];
		m2[0] = 2 * m1[0] - m2[0];
		m2[1] = 2 * m1[1] - m2[1];
		if (recursive) return [
			m2,
			m3,
			m4
		].concat(params);
		else {
			params = [
				m2,
				m3,
				m4
			].concat(params);
			const curves = [];
			for (let i = 0; i < params.length; i += 3) {
				const r1 = rotate(params[i][0], params[i][1], angleRad);
				const r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
				const r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
				curves.push([
					r1[0],
					r1[1],
					r2[0],
					r2[1],
					r3[0],
					r3[1]
				]);
			}
			return curves;
		}
	}
	/**
	* Internal shared path parsing and bezier math.
	* Used by path.ts, svg/draw.ts, and svg/morph.ts.
	* NOT exported to consumers.
	*/
	/** Point on a cubic bezier at parameter t (De Casteljau) */
	function cubicPoint(x0, y0, c1x, c1y, c2x, c2y, x1, y1, t) {
		const mt = 1 - t;
		const mt2 = mt * mt;
		const t2 = t * t;
		return {
			x: mt2 * mt * x0 + 3 * mt2 * t * c1x + 3 * mt * t2 * c2x + t2 * t * x1,
			y: mt2 * mt * y0 + 3 * mt2 * t * c1y + 3 * mt * t2 * c2y + t2 * t * y1
		};
	}
	/** Tangent vector of a cubic bezier at parameter t */
	function cubicTangent(x0, y0, c1x, c1y, c2x, c2y, x1, y1, t) {
		const mt = 1 - t;
		return {
			x: 3 * mt * mt * (c1x - x0) + 6 * mt * t * (c2x - c1x) + 3 * t * t * (x1 - c2x),
			y: 3 * mt * mt * (c1y - y0) + 6 * mt * t * (c2y - c1y) + 3 * t * t * (y1 - c2y)
		};
	}
	const LUT_SAMPLES = 64;
	function buildCubicLUT(seg) {
		const lut = [0];
		let total = 0;
		let px = seg.x0, py = seg.y0;
		for (let i = 1; i <= LUT_SAMPLES; i++) {
			const t = i / LUT_SAMPLES;
			const pt = cubicPoint(seg.x0, seg.y0, seg.c1x, seg.c1y, seg.c2x, seg.c2y, seg.x1, seg.y1, t);
			const dx = pt.x - px;
			const dy = pt.y - py;
			total += Math.sqrt(dx * dx + dy * dy);
			lut.push(total);
			px = pt.x;
			py = pt.y;
		}
		return {
			lut,
			length: total
		};
	}
	/** Find bezier parameter t for a target arc length using binary search on LUT */
	function lutLookup(lut, targetLen) {
		const total = lut[lut.length - 1] ?? 0;
		if (targetLen <= 0) return 0;
		if (targetLen >= total) return 1;
		let lo = 0, hi = lut.length - 1;
		while (lo < hi - 1) {
			const mid = lo + hi >> 1;
			if ((lut[mid] ?? 0) < targetLen) lo = mid;
			else hi = mid;
		}
		const loVal = lut[lo] ?? 0;
		const segLen = (lut[hi] ?? 0) - loVal;
		const frac = segLen > 0 ? (targetLen - loVal) / segLen : 0;
		return (lo + frac) / LUT_SAMPLES;
	}
	const cache = /* @__PURE__ */ new Map();
	/** Parse and normalize an SVG path string. Results are cached. */
	function normalizePath(d) {
		const cached = cache.get(d);
		if (cached) return cached;
		const raw = normalize(absolutize(parsePath(d)));
		const segments = [];
		const cumulative = [];
		let cx = 0, cy = 0;
		let total = 0;
		for (const seg of raw) switch (seg.key) {
			case "M": {
				const mx = seg.data[0];
				const my = seg.data[1];
				if (mx !== void 0 && my !== void 0) {
					cx = mx;
					cy = my;
				}
				break;
			}
			case "L": {
				const x1 = seg.data[0];
				const y1 = seg.data[1];
				if (x1 === void 0 || y1 === void 0) break;
				const dx = x1 - cx, dy = y1 - cy;
				const length = Math.sqrt(dx * dx + dy * dy);
				segments.push({
					type: "L",
					x0: cx,
					y0: cy,
					x1,
					y1,
					length
				});
				total += length;
				cumulative.push(total);
				cx = x1;
				cy = y1;
				break;
			}
			case "C": {
				const c1x = seg.data[0];
				const c1y = seg.data[1];
				const c2x = seg.data[2];
				const c2y = seg.data[3];
				const x1 = seg.data[4];
				const y1 = seg.data[5];
				if (c1x === void 0 || c1y === void 0 || c2x === void 0 || c2y === void 0 || x1 === void 0 || y1 === void 0) break;
				const base = {
					type: "C",
					x0: cx,
					y0: cy,
					c1x,
					c1y,
					c2x,
					c2y,
					x1,
					y1
				};
				const { lut, length } = buildCubicLUT(base);
				segments.push({
					...base,
					lut,
					length
				});
				total += length;
				cumulative.push(total);
				cx = x1;
				cy = y1;
				break;
			}
		}
		const result = {
			rawSegments: raw,
			segments,
			cumulative,
			totalLength: total
		};
		cache.set(d, result);
		return result;
	}
	/** Get {x, y} at a fractional position (0-1) along the path */
	function pointAtProgress(np, t) {
		t = Math.max(0, Math.min(1, t));
		if (np.segments.length === 0) return {
			x: 0,
			y: 0
		};
		const targetLen = t * np.totalLength;
		let segIdx = 0;
		for (; segIdx < np.cumulative.length - 1; segIdx++) if ((np.cumulative[segIdx] ?? 0) >= targetLen) break;
		const seg = np.segments[segIdx];
		if (!seg) return {
			x: 0,
			y: 0
		};
		const localLen = targetLen - (segIdx > 0 ? np.cumulative[segIdx - 1] ?? 0 : 0);
		if (seg.type === "L") {
			const frac = seg.length > 0 ? localLen / seg.length : 0;
			return {
				x: seg.x0 + (seg.x1 - seg.x0) * frac,
				y: seg.y0 + (seg.y1 - seg.y0) * frac
			};
		}
		const bt = lutLookup(seg.lut, localLen);
		return cubicPoint(seg.x0, seg.y0, seg.c1x, seg.c1y, seg.c2x, seg.c2y, seg.x1, seg.y1, bt);
	}
	/** Get tangent angle in degrees at a fractional position (0-1) along the path */
	function angleAtProgress(np, t) {
		t = Math.max(0, Math.min(1, t));
		if (np.segments.length === 0) return 0;
		const targetLen = t * np.totalLength;
		let segIdx = 0;
		for (; segIdx < np.cumulative.length - 1; segIdx++) if ((np.cumulative[segIdx] ?? 0) >= targetLen) break;
		const seg = np.segments[segIdx];
		if (!seg) return 0;
		const localLen = targetLen - (segIdx > 0 ? np.cumulative[segIdx - 1] ?? 0 : 0);
		if (seg.type === "L") return Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0) * (180 / Math.PI);
		const bt = lutLookup(seg.lut, localLen);
		const tan = cubicTangent(seg.x0, seg.y0, seg.c1x, seg.c1y, seg.c2x, seg.c2y, seg.x1, seg.y1, bt);
		return Math.atan2(tan.y, tan.x) * (180 / Math.PI);
	}
	/** Serialize normalized segments back to a d string */
	function serializePath(segments) {
		return segments.map((s) => {
			if (s.key === "Z") return "Z";
			return `${s.key}${s.data.map((n) => Math.round(n * 1e3) / 1e3).join(",")}`;
		}).join(" ");
	}
	// packages/superimg-stdlib/dist/bezier.js
	var bezier_exports = /* @__PURE__ */ __exportAll({
		bounds: () => bounds,
		cubic: () => cubic,
		pointAt: () => pointAt,
		quadratic: () => quadratic,
		smooth: () => smooth,
		tangentAt: () => tangentAt
	});
	function r3$1(n) {
		return Math.round(n * 1e3) / 1e3;
	}
	/** Cubic bezier segment as SVG path fragment (no leading M). */
	function cubic(p0, c1, c2, p1) {
		return `M${r3$1(p0.x)},${r3$1(p0.y)} C${r3$1(c1.x)},${r3$1(c1.y)} ${r3$1(c2.x)},${r3$1(c2.y)} ${r3$1(p1.x)},${r3$1(p1.y)}`;
	}
	/** Quadratic bezier as SVG path (converted to cubic for consistency). */
	function quadratic(p0, c, p1) {
		const c1x = p0.x + 2 / 3 * (c.x - p0.x);
		const c1y = p0.y + 2 / 3 * (c.y - p0.y);
		const c2x = p1.x + 2 / 3 * (c.x - p1.x);
		const c2y = p1.y + 2 / 3 * (c.y - p1.y);
		return cubic(p0, {
			x: c1x,
			y: c1y
		}, {
			x: c2x,
			y: c2y
		}, p1);
	}
	/** Catmull-Rom spline through points → single closed/open path d string. */
	function smooth(points, tension = .5, closed = false) {
		if (points.length < 2) return "";
		const parts = [`M${r3$1(points[0].x)},${r3$1(points[0].y)}`];
		const n = points.length;
		const last = closed ? n : n - 1;
		for (let i = 0; i < last; i++) {
			const p0 = points[(i - 1 + n) % n];
			const p1 = points[i % n];
			const p2 = points[(i + 1) % n];
			const p3 = points[(i + 2) % n];
			const c1x = p1.x + (p2.x - p0.x) / 6 * tension;
			const c1y = p1.y + (p2.y - p0.y) / 6 * tension;
			const c2x = p2.x - (p3.x - p1.x) / 6 * tension;
			const c2y = p2.y - (p3.y - p1.y) / 6 * tension;
			parts.push(`C${r3$1(c1x)},${r3$1(c1y)} ${r3$1(c2x)},${r3$1(c2y)} ${r3$1(p2.x)},${r3$1(p2.y)}`);
		}
		if (closed) parts.push("Z");
		return parts.join(" ");
	}
	function pointAt(d, t) {
		return pointAtProgress(normalizePath(d), t);
	}
	function tangentAt(d, t) {
		return angleAtProgress(normalizePath(d), t);
	}
	/** Rough axis-aligned bounds of a path (samples along length). */
	function bounds(d) {
		const np = normalizePath(d);
		if (np.totalLength === 0) return {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		};
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		const samples = 32;
		for (let i = 0; i <= samples; i++) {
			const p = pointAtProgress(np, i / samples);
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	}
	// packages/superimg-stdlib/dist/tree.js
	//! Shared paint decisions for SVG lowering and the browser classifier.
	const MOTION_KEYS = /* @__PURE__ */ new Set([
		"x",
		"y",
		"scale",
		"rotate",
		"blur",
		"opacity",
		"phase",
		"style",
		"transform",
		"filter",
		"enter",
		"exit",
		"visible"
	]);
	const DIRECTION_DEG = {
		"to top": 0,
		"to right": 90,
		"to bottom": 180,
		"to left": 270,
		"to top right": 45,
		"to right top": 45,
		"to bottom right": 135,
		"to right bottom": 135,
		"to bottom left": 225,
		"to left bottom": 225,
		"to top left": 315,
		"to left top": 315
	};
	function isPlainColor(value) {
		const color = value.trim();
		if (!color || /gradient\s*\(|url\s*\(/i.test(color)) return false;
		return C(color).isValid();
	}
	function finite$2(value) {
		return typeof value === "number" && Number.isFinite(value) ? value : void 0;
	}
	function parseBorder(value) {
		const match = value.trim().match(/^(\d+(?:\.\d+)?)px\s+solid\s+(\S(?:.*\S)?)$/i);
		if (!match) return void 0;
		const width = Number(match[1]);
		const color = match[2];
		if (!Number.isFinite(width) || width < 0 || !isPlainColor(color)) return void 0;
		return {
			width,
			color
		};
	}
	function parseStop(stop) {
		const match = stop.trim().match(/^(.*\S)\s+(-?\d+(?:\.\d+)?)%$/);
		if (!match) return void 0;
		const color = match[1].trim();
		if (!isPlainColor(color)) return void 0;
		return {
			color,
			offset: `${match[2]}%`
		};
	}
	function parseStops(stops) {
		if (!Array.isArray(stops) || stops.length === 0) return void 0;
		const parsed = [];
		for (const stop of stops) {
			if (typeof stop !== "string") return void 0;
			const next = parseStop(stop);
			if (!next) return void 0;
			parsed.push(next);
		}
		return parsed;
	}
	function parseDegrees(value) {
		const match = value.trim().toLowerCase().match(/^(-?\d+(?:\.\d+)?)deg$/);
		if (!match) return void 0;
		return Number(match[1]);
	}
	function parseLinearAngle(at, angle) {
		if (typeof at === "string" && at.trim()) {
			const key = at.trim().toLowerCase().replace(/\s+/g, " ");
			if (key in DIRECTION_DEG) return DIRECTION_DEG[key];
			return parseDegrees(key);
		}
		if (typeof angle === "number" && Number.isFinite(angle)) return angle;
		if (typeof angle === "string") return parseDegrees(angle);
		return 180;
	}
	/** CSS linear-gradient angle → objectBoundingBox line. 0deg points up. */
	function linearEndpoints(deg) {
		const rad = deg * Math.PI / 180;
		const dx = Math.sin(rad);
		const dy = -Math.cos(rad);
		const length = Math.abs(dx) + Math.abs(dy);
		const hx = dx * length / 2;
		const hy = dy * length / 2;
		return {
			x1: .5 - hx,
			y1: .5 - hy,
			x2: .5 + hx,
			y2: .5 + hy
		};
	}
	function parseRadialCenter(at) {
		if (at === void 0 || at === "") return {
			cx: .5,
			cy: .5
		};
		if (typeof at !== "string") return void 0;
		const key = at.trim().toLowerCase();
		if (key === "" || key === "center") return {
			cx: .5,
			cy: .5
		};
		const match = key.match(/^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
		if (!match) return void 0;
		return {
			cx: Number(match[1]) / 100,
			cy: Number(match[2]) / 100
		};
	}
	function farthestCorner(cx, cy) {
		let radius = 0;
		for (const [x, y] of [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1]
		]) radius = Math.max(radius, Math.hypot(cx - x, cy - y));
		return radius;
	}
	function parseGradient(gradient) {
		if (!gradient || typeof gradient !== "object" || Array.isArray(gradient)) return void 0;
		const g = gradient;
		const stops = parseStops(g.stops);
		if (!stops) return void 0;
		if (g.kind === "linear") {
			const deg = parseLinearAngle(g.at, g.angle);
			if (deg === void 0) return void 0;
			return {
				kind: "linear",
				...linearEndpoints(deg),
				stops
			};
		}
		if (g.kind === "radial") {
			if (g.size !== void 0) return void 0;
			const center = parseRadialCenter(g.at);
			if (!center) return void 0;
			return {
				kind: "radial",
				...center,
				r: farthestCorner(center.cx, center.cy),
				stops
			};
		}
	}
	function readFilter(value) {
		return typeof value === "string" ? value.trim() : "";
	}
	function readMotion(value) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
		const m = value;
		if (!isMotionLike(m)) return void 0;
		return {
			x: finite$2(m.x) ?? 0,
			y: finite$2(m.y) ?? 0,
			scale: finite$2(m.scale) ?? 1,
			rotate: finite$2(m.rotate) ?? 0,
			opacity: finite$2(m.opacity) ?? 1,
			blur: finite$2(m.blur) ?? 0,
			filter: readFilter(m.filter)
		};
	}
	function isMotionLike(m) {
		if (typeof m.phase === "string" && typeof m.opacity === "number") return true;
		if (typeof m.transform === "string" && typeof m.opacity === "number") return true;
		if (typeof m.style === "string" && typeof m.opacity === "number" && (typeof m.x === "number" || typeof m.y === "number" || typeof m.scale === "number" || typeof m.rotate === "number")) return true;
		const keys = Object.keys(m).filter((key) => m[key] !== void 0);
		return keys.length > 0 && keys.every((key) => MOTION_KEYS.has(key)) && keys.some((key) => (key === "x" || key === "y" || key === "scale" || key === "rotate" || key === "blur") && typeof m[key] === "number");
	}
	function parseOpacity(value) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value !== "string") return void 0;
		const trimmed = value.trim();
		const percent = trimmed.match(/^(-?\d+(?:\.\d+)?)%$/);
		if (percent) return Number(percent[1]) / 100;
		if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return void 0;
		const n = Number(trimmed);
		return Number.isFinite(n) ? n : void 0;
	}
	function emptyScan() {
		return {
			opacityInvalid: false,
			blendModeInvalid: false,
			borderInvalid: false,
			borderRadiusInvalid: false,
			unsupportedStyle: [],
			rawStyle: false
		};
	}
	function absorbStyle(scan, style) {
		if (style == null || style === false || style === true) return;
		if (Array.isArray(style)) {
			for (const part of style) absorbStyle(scan, part);
			return;
		}
		const motion = readMotion(style);
		if (motion) {
			scan.motion = motion;
			return;
		}
		if (typeof style === "string") {
			if (style.trim()) scan.rawStyle = true;
			return;
		}
		if (typeof style !== "object") return;
		for (const [key, value] of Object.entries(style)) {
			if (value == null || value === false) continue;
			if (key === "mixBlendMode") {
				if (value === "normal" || value === "multiply" || value === "screen" || value === "overlay") scan.blendMode = value;
				else scan.blendModeInvalid = true;
				continue;
			}
			if (key === "opacity") {
				const opacity = parseOpacity(value);
				if (opacity === void 0) scan.opacityInvalid = true;
				else scan.opacity = opacity;
				continue;
			}
			if (key === "border") {
				if (typeof value !== "string") scan.borderInvalid = true;
				else {
					const border = parseBorder(value);
					if (!border) scan.borderInvalid = true;
					else scan.border = border;
				}
				continue;
			}
			if (key === "borderRadius") {
				if (typeof value === "number" && Number.isFinite(value) && value >= 0) scan.borderRadius = value;
				else scan.borderRadiusInvalid = true;
				continue;
			}
			scan.unsupportedStyle.push(key);
		}
	}
	function resolvePaint(el) {
		const scan = emptyScan();
		if (el.props.opacity !== void 0) {
			const opacity = parseOpacity(el.props.opacity);
			if (opacity === void 0) scan.opacityInvalid = true;
			else scan.opacity = opacity;
		}
		if (el.props.blendMode !== void 0) {
			const mode = el.props.blendMode;
			if (mode === "normal" || mode === "multiply" || mode === "screen" || mode === "overlay") scan.blendMode = mode;
			else scan.blendModeInvalid = true;
		}
		absorbStyle(scan, el.props.style);
		if (scan.motion && scan.opacity !== void 0) {
			scan.motion.opacity *= scan.opacity;
			scan.opacity = void 0;
		}
		const propMotion = readMotion(el.props.motion);
		const motion = propMotion ?? scan.motion;
		if (propMotion && scan.motion) motion.opacity = propMotion.opacity * scan.motion.opacity;
		else if (propMotion && scan.opacity !== void 0) {
			motion.opacity = propMotion.opacity * scan.opacity;
			scan.opacity = void 0;
		}
		let gradient;
		let gradientInvalid = false;
		const gradientProp = el.props.gradient;
		if (gradientProp !== void 0) {
			gradient = parseGradient(gradientProp);
			gradientInvalid = gradient === void 0;
		}
		let fill;
		const fillProp = typeof el.props.fill === "string" ? el.props.fill : typeof el.props.color === "string" && el.type === "Fill" ? el.props.color : void 0;
		if (!gradient && typeof fillProp === "string") {
			if (isPlainColor(fillProp)) fill = fillProp;
			else if (fillProp.trim()) gradientInvalid = true;
		}
		let radius = scan.borderRadius;
		let radiusInvalid = scan.borderRadiusInvalid;
		if (radius === void 0 && !radiusInvalid) {
			if (typeof el.props.radius === "number" && Number.isFinite(el.props.radius)) radius = el.props.radius;
			else if (typeof el.props.radius === "string" && el.props.radius.trim()) radiusInvalid = true;
		}
		let border = scan.border;
		let borderInvalid = scan.borderInvalid;
		if (!border && !borderInvalid && typeof el.props.border === "string") {
			const parsed = parseBorder(el.props.border);
			if (parsed) border = parsed;
			else if (el.props.border.trim()) borderInvalid = true;
		}
		let opacity = scan.opacity;
		if (motion && scan.opacity !== void 0 && motion === propMotion) opacity = void 0;
		return {
			...fill !== void 0 ? { fill } : {},
			...gradient !== void 0 ? { gradient } : {},
			gradientInvalid,
			...radius !== void 0 ? { radius } : {},
			radiusInvalid,
			...border !== void 0 ? { border } : {},
			borderInvalid,
			...opacity !== void 0 ? { opacity } : {},
			opacityInvalid: scan.opacityInvalid,
			...scan.blendMode !== void 0 ? { blendMode: scan.blendMode } : {},
			blendModeInvalid: scan.blendModeInvalid,
			...motion !== void 0 ? { motion } : {},
			clip: el.props.overflow === "hidden",
			unsupportedStyle: scan.unsupportedStyle,
			rawStyle: scan.rawStyle
		};
	}
	function hasPresentFilter(filter) {
		return filter.length > 0 && filter.toLowerCase() !== "none";
	}
	function motionHasBlur(motion) {
		return motion !== void 0 && Math.abs(motion.blur) > 1e-4;
	}
	//! Layout-aware media tree → real SVG. Browser-only nodes are omitted; `needsBrowser` reports them.
	//! Layout-aware media tree -> canonical cross-OS DisplayList v1 Frame IR.
	const DISPLAY_LIST_KIND = "@foxworth/superimg/display-list";
	const CODE_FONT_SIZE = 14;
	const CODE_LINE_HEIGHT = 1.45;
	const CODE_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, monospace";
	const GROUP_TYPES = /* @__PURE__ */ new Set([
		"Frame",
		"Stack",
		"Safe",
		"Spacer"
	]);
	function round4(value) {
		if (!Number.isFinite(value)) return 0;
		const rounded = Math.round(value * 1e4) / 1e4;
		return Object.is(rounded, -0) ? 0 : rounded;
	}
	function finite(value) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim()) {
			const n = Number(value.trim());
			if (Number.isFinite(n)) return n;
		}
	}
	function clamp01(value) {
		if (!Number.isFinite(value)) return 1;
		return Math.max(0, Math.min(1, value));
	}
	function isIdentityMatrix(m) {
		return Math.abs(m.a - 1) < 1e-6 && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && Math.abs(m.d - 1) < 1e-6 && Math.abs(m.e) < 1e-6 && Math.abs(m.f) < 1e-6;
	}
	function cleanMatrix(m) {
		if (isIdentityMatrix(m)) return void 0;
		return {
			a: round4(m.a),
			b: round4(m.b),
			c: round4(m.c),
			d: round4(m.d),
			e: round4(m.e),
			f: round4(m.f)
		};
	}
	function cleanRect(r) {
		return {
			x: round4(r.x),
			y: round4(r.y),
			width: round4(Math.max(0, r.width)),
			height: round4(Math.max(0, r.height))
		};
	}
	function normalizeColor(raw, extraAlpha) {
		const trimmed = raw.trim();
		if (!trimmed || trimmed.toLowerCase() === "none") return void 0;
		const parsed = C(trimmed);
		if (!parsed.isValid()) return void 0;
		const rgba = parsed.toRgb();
		const alpha = extraAlpha !== void 0 ? clamp01(rgba.a * extraAlpha) : clamp01(rgba.a);
		const r = Math.round(rgba.r).toString(16).padStart(2, "0");
		const g = Math.round(rgba.g).toString(16).padStart(2, "0");
		const b = Math.round(rgba.b).toString(16).padStart(2, "0");
		if (alpha >= 1 - 1 / 510) return `#${r}${g}${b}`;
		return `#${r}${g}${b}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
	}
	function parsePercentOrNumber(value, fallback) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string") {
			const t = value.trim();
			if (t.endsWith("%")) {
				const n = Number(t.slice(0, -1));
				if (Number.isFinite(n)) return n / 100;
			}
			const n = Number(t);
			if (Number.isFinite(n)) return n;
		}
		return fallback;
	}
	function convertGradient(g) {
		const stops = [];
		for (const s of g.stops) {
			const color = normalizeColor(s.color);
			if (!color) return void 0;
			const offset = clamp01(parsePercentOrNumber(s.offset, 0));
			stops.push({
				color,
				offset: round4(offset)
			});
		}
		if (stops.length === 0) return void 0;
		if (g.kind === "linear") return {
			kind: "linearGradient",
			x1: round4(g.x1),
			y1: round4(g.y1),
			x2: round4(g.x2),
			y2: round4(g.y2),
			stops
		};
		return {
			kind: "radialGradient",
			cx: round4(g.cx),
			cy: round4(g.cy),
			r: round4(g.r),
			stops
		};
	}
	function motionToMatrix(motion, box) {
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		let m = {
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: motion.x,
			f: motion.y
		};
		if (Math.abs(motion.rotate) > 1e-6 || Math.abs(motion.scale - 1) > 1e-6) {
			const rad = motion.rotate * Math.PI / 180;
			const cos = Math.cos(rad) * motion.scale;
			const sin = Math.sin(rad) * motion.scale;
			const toCenter = {
				a: 1,
				b: 0,
				c: 0,
				d: 1,
				e: cx,
				f: cy
			};
			const rotScale = {
				a: cos,
				b: sin,
				c: -sin,
				d: cos,
				e: 0,
				f: 0
			};
			const fromCenter = {
				a: 1,
				b: 0,
				c: 0,
				d: 1,
				e: -cx,
				f: -cy
			};
			m = multiplySceneMatrices(m, multiplySceneMatrices(toCenter, multiplySceneMatrices(rotScale, fromCenter)));
		}
		return m;
	}
	function parseSvgTransform(value) {
		if (!value) return IDENTITY_MATRIX;
		if (typeof value === "object" && !Array.isArray(value)) {
			const t = value;
			let m = IDENTITY_MATRIX;
			const x = finite(t.x) ?? 0;
			const y = finite(t.y) ?? 0;
			if (x !== 0 || y !== 0) m = multiplySceneMatrices(m, {
				a: 1,
				b: 0,
				c: 0,
				d: 1,
				e: x,
				f: y
			});
			const ox = finite(t.originX) ?? 0;
			const oy = finite(t.originY) ?? 0;
			const rotate = finite(t.rotate) ?? 0;
			const sx = finite(t.scaleX) ?? finite(t.scale) ?? 1;
			const sy = finite(t.scaleY) ?? finite(t.scale) ?? 1;
			if (rotate !== 0 || sx !== 1 || sy !== 1) {
				if (ox !== 0 || oy !== 0) m = multiplySceneMatrices(m, {
					a: 1,
					b: 0,
					c: 0,
					d: 1,
					e: ox,
					f: oy
				});
				if (rotate !== 0) {
					const rad = rotate * Math.PI / 180;
					const c = Math.cos(rad);
					const s = Math.sin(rad);
					m = multiplySceneMatrices(m, {
						a: c,
						b: s,
						c: -s,
						d: c,
						e: 0,
						f: 0
					});
				}
				if (sx !== 1 || sy !== 1) m = multiplySceneMatrices(m, {
					a: sx,
					b: 0,
					c: 0,
					d: sy,
					e: 0,
					f: 0
				});
				if (ox !== 0 || oy !== 0) m = multiplySceneMatrices(m, {
					a: 1,
					b: 0,
					c: 0,
					d: 1,
					e: -ox,
					f: -oy
				});
			}
			return m;
		}
		if (typeof value !== "string") return IDENTITY_MATRIX;
		let m = IDENTITY_MATRIX;
		const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
		let match;
		while (match = re.exec(value)) {
			const fn = match[1].toLowerCase();
			const nums = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
			let next = IDENTITY_MATRIX;
			if (fn === "matrix" && nums.length === 6) next = {
				a: nums[0],
				b: nums[1],
				c: nums[2],
				d: nums[3],
				e: nums[4],
				f: nums[5]
			};
			else if (fn === "translate" && nums.length >= 1) next = {
				a: 1,
				b: 0,
				c: 0,
				d: 1,
				e: nums[0],
				f: nums[1] ?? 0
			};
			else if (fn === "scale" && nums.length >= 1) next = {
				a: nums[0],
				b: 0,
				c: 0,
				d: nums[1] ?? nums[0],
				e: 0,
				f: 0
			};
			else if (fn === "rotate" && nums.length >= 1) {
				const rad = nums[0] * Math.PI / 180;
				const cos = Math.cos(rad);
				const sin = Math.sin(rad);
				if (nums.length >= 3) {
					const cx = nums[1];
					const cy = nums[2];
					next = multiplySceneMatrices({
						a: 1,
						b: 0,
						c: 0,
						d: 1,
						e: cx,
						f: cy
					}, multiplySceneMatrices({
						a: cos,
						b: sin,
						c: -sin,
						d: cos,
						e: 0,
						f: 0
					}, {
						a: 1,
						b: 0,
						c: 0,
						d: 1,
						e: -cx,
						f: -cy
					}));
				} else next = {
					a: cos,
					b: sin,
					c: -sin,
					d: cos,
					e: 0,
					f: 0
				};
			} else if (fn === "skewx" && nums.length >= 1) next = {
				a: 1,
				b: 0,
				c: Math.tan(nums[0] * Math.PI / 180),
				d: 1,
				e: 0,
				f: 0
			};
			else if (fn === "skewy" && nums.length >= 1) next = {
				a: 1,
				b: Math.tan(nums[0] * Math.PI / 180),
				c: 0,
				d: 1,
				e: 0,
				f: 0
			};
			m = multiplySceneMatrices(m, next);
		}
		return m;
	}
	function allocId(state, preferred, fallbackPrefix) {
		const base = preferred && preferred.trim().length > 0 ? preferred.trim() : `${fallbackPrefix}-${++state.seq}`;
		if (!state.usedIds.has(base)) {
			state.usedIds.add(base);
			return base;
		}
		let n = 1;
		while (state.usedIds.has(`${base}#${n}`)) n += 1;
		const id = `${base}#${n}`;
		state.usedIds.add(id);
		return id;
	}
	function preferredNodeId(el) {
		if (typeof el.props["data-si-part"] === "string" && el.props["data-si-part"]) return el.props["data-si-part"];
		if (typeof el.props.id === "string" && el.props.id) return el.props.id;
	}
	function pushIssue(state, el, code, message) {
		const nodeId = el && typeof el.props.id === "string" && el.props.id ? el.props.id : void 0;
		state.issues.push({
			...nodeId ? { nodeId } : {},
			code,
			message
		});
	}
	function checkPaintIssues(el, paint, state) {
		if (paint.rawStyle) pushIssue(state, el, "UNSUPPORTED_STYLE", `Raw CSS style string on ${el.type}`);
		for (const key of paint.unsupportedStyle) pushIssue(state, el, `UNSUPPORTED_STYLE:${key}`, `Unsupported CSS style property "${key}" on ${el.type}`);
		if (paint.opacityInvalid) pushIssue(state, el, "INVALID_OPACITY", `Invalid opacity on ${el.type}`);
		if (paint.blendModeInvalid) pushIssue(state, el, "UNSUPPORTED_BLEND_MODE", `Unsupported blendMode on ${el.type}`);
		if (paint.gradientInvalid) pushIssue(state, el, "UNSUPPORTED_GRADIENT", `Unsupported gradient on ${el.type}`);
		if (paint.borderInvalid) pushIssue(state, el, "UNSUPPORTED_BORDER", `Unsupported border on ${el.type}`);
		if (paint.radiusInvalid) pushIssue(state, el, "UNSUPPORTED_RADIUS", `Unsupported radius on ${el.type}`);
		if (el.props.kenBurns != null && el.props.kenBurns !== false) pushIssue(state, el, "UNSUPPORTED_KEN_BURNS", `kenBurns is browser-only on ${el.type}`);
		if (motionHasBlur(paint.motion)) pushIssue(state, el, "UNSUPPORTED_BLUR", `Motion blur filter is browser-only on ${el.type}`);
		if (paint.motion && hasPresentFilter(paint.motion.filter)) pushIssue(state, el, "UNSUPPORTED_FILTER", `CSS filter "${paint.motion.filter}" is browser-only on ${el.type}`);
	}
	function boxOf(el) {
		return el.layout ?? {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		};
	}
	function childText(el) {
		const parts = [];
		const walk = (child) => {
			if (typeof child === "string" || typeof child === "number") parts.push(String(child));
			else if (Array.isArray(child)) child.forEach(walk);
			else if (isMediaElement(child)) child.children.forEach(walk);
		};
		el.children.forEach(walk);
		return parts.join("");
	}
	function resolvePad(pad) {
		if (typeof pad === "number" && Number.isFinite(pad)) return {
			top: pad,
			right: pad,
			bottom: pad,
			left: pad
		};
		if (pad && typeof pad === "object") {
			const p = pad;
			const x = finite(p.x) ?? 0;
			const y = finite(p.y) ?? 0;
			return {
				top: finite(p.top) ?? y,
				right: finite(p.right) ?? x,
				bottom: finite(p.bottom) ?? y,
				left: finite(p.left) ?? x
			};
		}
		return {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0
		};
	}
	function verticalMetrics(state, family, size, weight, fontStyle, letterSpacing) {
		if (!state.measurer) return {
			ascent: size * .8,
			descent: size * .2
		};
		const measured = state.measurer.measure("Mg", {
			fontFamily: family,
			fontSize: size,
			fontWeight: weight,
			fontStyle,
			...letterSpacing !== void 0 ? { letterSpacing } : {}
		});
		return {
			ascent: measured.ascent,
			descent: measured.descent
		};
	}
	function baselineOffset(lineBox, ascent, descent) {
		return (lineBox - (ascent + descent)) / 2 + ascent;
	}
	function buildOpBase(id, bounds, inherited, localBlendMode) {
		const matrix = cleanMatrix(inherited.matrix);
		const blendMode = localBlendMode ?? inherited.blendMode;
		return {
			id,
			bounds: cleanRect(bounds),
			...matrix ? { matrix } : {},
			opacity: round4(clamp01(inherited.opacity)),
			...blendMode && blendMode !== "normal" ? { blendMode } : {},
			...inherited.clips.length > 0 ? { clips: [...inherited.clips] } : {}
		};
	}
	function transformClipRect(clip, matrix) {
		if (isIdentityMatrix(matrix)) return {
			x: round4(clip.x),
			y: round4(clip.y),
			width: round4(Math.max(0, clip.width)),
			height: round4(Math.max(0, clip.height)),
			...clip.radius !== void 0 && clip.radius > 0 ? { radius: round4(clip.radius) } : {}
		};
		const corners = [
			{
				x: clip.x,
				y: clip.y
			},
			{
				x: clip.x + clip.width,
				y: clip.y
			},
			{
				x: clip.x,
				y: clip.y + clip.height
			},
			{
				x: clip.x + clip.width,
				y: clip.y + clip.height
			}
		].map((p) => ({
			x: matrix.a * p.x + matrix.c * p.y + matrix.e,
			y: matrix.b * p.x + matrix.d * p.y + matrix.f
		}));
		const minX = Math.min(...corners.map((p) => p.x));
		const minY = Math.min(...corners.map((p) => p.y));
		const maxX = Math.max(...corners.map((p) => p.x));
		const maxY = Math.max(...corners.map((p) => p.y));
		const scaleAvg = (Math.hypot(matrix.a, matrix.b) + Math.hypot(matrix.c, matrix.d)) / 2;
		return {
			x: round4(minX),
			y: round4(minY),
			width: round4(Math.max(0, maxX - minX)),
			height: round4(Math.max(0, maxY - minY)),
			...clip.radius !== void 0 && clip.radius > 0 ? { radius: round4(clip.radius * scaleAvg) } : {}
		};
	}
	function deriveNodeState(el, paint, inherited, pushClip) {
		const box = boxOf(el);
		const localOpacity = paint.motion ? paint.motion.opacity : paint.opacity ?? 1;
		const nextMatrix = paint.motion ? multiplySceneMatrices(inherited.matrix, motionToMatrix(paint.motion, box)) : inherited.matrix;
		const nextOpacity = clamp01(inherited.opacity * clamp01(localOpacity));
		const nextBlendMode = paint.blendMode ?? inherited.blendMode;
		const nextClips = pushClip ? [...inherited.clips, transformClipRect({
			x: box.x,
			y: box.y,
			width: box.width,
			height: box.height,
			...paint.radius !== void 0 && paint.radius > 0 ? { radius: paint.radius } : {}
		}, nextMatrix)] : inherited.clips;
		return {
			matrix: nextMatrix,
			opacity: nextOpacity,
			...nextBlendMode ? { blendMode: nextBlendMode } : {},
			clips: nextClips
		};
	}
	function emitBoxPaint(el, paint, box, nodeState, state) {
		if (nodeState.opacity <= 0) return;
		let fill;
		if (paint.gradient) fill = convertGradient(paint.gradient);
		else if (paint.fill) {
			const color = normalizeColor(paint.fill);
			if (color) fill = {
				kind: "solid",
				color
			};
		}
		let stroke;
		if (paint.border && paint.border.width > 0) {
			const color = normalizeColor(paint.border.color);
			if (color) stroke = {
				color,
				width: round4(paint.border.width)
			};
		}
		if (!fill && !stroke) return;
		const id = allocId(state, preferredNodeId(el), el.type.toLowerCase());
		state.ops.push({
			...buildOpBase(id, box, nodeState, paint.blendMode),
			kind: "rect",
			...fill ? { fill } : {},
			...stroke ? { stroke } : {},
			...paint.radius !== void 0 && paint.radius > 0 ? { radius: round4(paint.radius) } : {}
		});
	}
	function emitText(el, state, inherited) {
		const paint = resolvePaint(el);
		checkPaintIssues(el, paint, state);
		const box = boxOf(el);
		const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
		if (nodeState.opacity <= 0) return;
		const type = typographyForPaint(el, state.canvasWidth);
		const rawLines = type.lines && type.lines.length > 0 ? type.lines : [childText(el)];
		const reveal = clampReveal(el.props.reveal);
		const linesText = reveal !== void 0 && reveal < 1 ? sliceStringLinesByReveal(rawLines, reveal) : rawLines;
		const fontStyle = el.props.fontStyle === "italic" ? "italic" : "normal";
		const align = type.textAlign === "center" || type.textAlign === "middle" ? "center" : type.textAlign === "right" || type.textAlign === "end" ? "right" : "left";
		const color = normalizeColor(typeof el.props.color === "string" && isPlainColor(el.props.color) ? el.props.color : "#111827") ?? "#111827";
		const metrics = verticalMetrics(state, type.fontFamily, type.fontSize, type.fontWeight, fontStyle, type.letterSpacing);
		const lineBox = type.lineHeight * type.fontSize;
		const bOffset = baselineOffset(lineBox, metrics.ascent, metrics.descent);
		const lines = linesText.map((text, index) => {
			const measuredWidth = type.lineWidths?.[index] !== void 0 && text === rawLines[index] ? type.lineWidths[index] : state.measurer ? state.measurer.measure(text, {
				fontFamily: type.fontFamily,
				fontSize: type.fontSize,
				fontWeight: type.fontWeight,
				fontStyle,
				...type.letterSpacing !== void 0 ? { letterSpacing: type.letterSpacing } : {}
			}).width : text.length * type.fontSize * .55;
			const x = align === "center" ? box.x + (box.width - measuredWidth) / 2 : align === "right" ? box.x + (box.width - measuredWidth) : box.x;
			const y = box.y + index * lineBox;
			return {
				text,
				x: round4(x),
				y: round4(y),
				baselineY: round4(y + bOffset),
				width: round4(measuredWidth)
			};
		});
		const id = allocId(state, preferredNodeId(el), "text");
		state.ops.push({
			...buildOpBase(id, box, nodeState, paint.blendMode),
			kind: "text",
			lines,
			fontFamily: type.fontFamily,
			fontSize: round4(type.fontSize),
			fontWeight: Math.round(type.fontWeight),
			fontStyle,
			...type.letterSpacing !== void 0 ? { letterSpacing: round4(type.letterSpacing) } : {},
			lineHeight: round4(type.lineHeight),
			align,
			color,
			metricsExact: type.metricsExact === true
		});
	}
	function emitImage(el, state, inherited) {
		const paint = resolvePaint(el);
		checkPaintIssues(el, paint, state);
		const box = boxOf(el);
		const radius = paint.radius !== void 0 && paint.radius > 0 ? paint.radius : void 0;
		const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
		if (nodeState.opacity <= 0) return;
		const src = typeof el.props.src === "string" ? el.props.src : typeof el.props.href === "string" ? el.props.href : "";
		if (!src) {
			pushIssue(state, el, "MISSING_IMAGE_SRC", "Image node is missing src");
			return;
		}
		const fit = el.props.fit === "contain" || el.props.fit === "fill" ? el.props.fit : "cover";
		const pixelArt = el.props.pixelArt === true ? true : void 0;
		const id = allocId(state, preferredNodeId(el), "image");
		state.ops.push({
			...buildOpBase(id, box, nodeState, paint.blendMode),
			kind: "image",
			asset: src,
			fit,
			...pixelArt !== void 0 ? { pixelArt } : {},
			...radius !== void 0 ? { radius: round4(radius) } : {}
		});
	}
	function tokenLines(tokens) {
		const lines = [[]];
		for (const token of tokens) token.text.split("\n").forEach((part, index) => {
			if (index > 0) lines.push([]);
			if (part) lines[lines.length - 1].push({
				text: part,
				color: token.color
			});
		});
		return lines;
	}
	function emitCode(el, state, inherited) {
		const paint = resolvePaint(el);
		checkPaintIssues(el, paint, state);
		const box = boxOf(el);
		const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
		if (nodeState.opacity <= 0) return;
		const source = typeof el.props.code === "string" ? el.props.code : childText(el);
		const colored = tokenize$1(source, typeof el.props.theme === "string" ? el.props.theme : "dark-plus");
		const reveal = clampReveal(el.props.reveal);
		const bg = normalizeColor(colored.background) ?? "#1e1e1e";
		const fg = normalizeColor(colored.foreground) ?? "#d4d4d4";
		const bgId = allocId(state, preferredNodeId(el) ? `${preferredNodeId(el)}/bg` : void 0, "code-bg");
		let stroke;
		if (paint.border && paint.border.width > 0) {
			const color = normalizeColor(paint.border.color);
			if (color) stroke = {
				color,
				width: round4(paint.border.width)
			};
		}
		state.ops.push({
			...buildOpBase(bgId, box, nodeState, paint.blendMode),
			kind: "rect",
			fill: {
				kind: "solid",
				color: bg
			},
			...stroke ? { stroke } : {},
			...paint.radius !== void 0 && paint.radius > 0 ? { radius: round4(paint.radius) } : {}
		});
		const rawTextLines = tokenLines(colored.tokens).map((line, i) => {
			const body = line.map((t) => t.text).join("");
			if (el.props.lineNumbers === true) {
				const gutterWidth = String(source.split("\n").length).length;
				return `${String(i + 1).padStart(gutterWidth, " ")} ${body}`;
			}
			return body;
		});
		const linesText = reveal !== void 0 && reveal < 1 ? sliceStringLinesByReveal(rawTextLines, reveal) : rawTextLines;
		const pad = resolvePad(el.props.pad);
		const advance = CODE_LINE_HEIGHT * CODE_FONT_SIZE;
		const metrics = verticalMetrics(state, CODE_FONT_FAMILY, CODE_FONT_SIZE, 400, "normal", void 0);
		const bOffset = baselineOffset(advance, metrics.ascent, metrics.descent);
		const x = box.x + pad.left;
		const y0 = box.y + pad.top;
		const lines = linesText.map((text, i) => {
			const y = y0 + i * advance;
			return {
				text,
				x: round4(x),
				y: round4(y),
				baselineY: round4(y + bOffset),
				width: round4(text.length * CODE_FONT_SIZE * .6)
			};
		});
		const textId = allocId(state, preferredNodeId(el) ? `${preferredNodeId(el)}/text` : void 0, "code-text");
		state.ops.push({
			...buildOpBase(textId, {
				x,
				y: y0,
				width: Math.max(0, box.width - pad.left - pad.right),
				height: Math.max(0, box.height - pad.top - pad.bottom)
			}, nodeState, paint.blendMode),
			kind: "text",
			lines,
			fontFamily: CODE_FONT_FAMILY,
			fontSize: CODE_FONT_SIZE,
			fontWeight: 400,
			fontStyle: "normal",
			lineHeight: CODE_LINE_HEIGHT,
			align: "left",
			color: fg,
			metricsExact: false
		});
	}
	function parseUrlRef(value) {
		if (typeof value !== "string") return void 0;
		const trimmed = value.trim();
		const match = trimmed.match(/^url\(\s*#([^)]+)\s*\)$/i);
		if (match) return match[1].trim();
		if (trimmed.startsWith("#")) return void 0;
	}
	function collectVectorDefs(el, defs) {
		for (const child of el.children) {
			if (!isMediaElement(child)) continue;
			if (child.type === "VectorDefs" || child.type === "defs") for (const def of child.children) {
				if (!isMediaElement(def)) continue;
				const id = typeof def.props.id === "string" ? def.props.id : void 0;
				if (!id) continue;
				if (def.type === "VectorLinearGradient" || def.type === "linearGradient") {
					const stops = collectGradientStops(def);
					if (stops.length > 0) defs.paints.set(id, {
						kind: "linearGradient",
						x1: round4(parsePercentOrNumber(def.props.x1, 0)),
						y1: round4(parsePercentOrNumber(def.props.y1, 0)),
						x2: round4(parsePercentOrNumber(def.props.x2, 1)),
						y2: round4(parsePercentOrNumber(def.props.y2, 0)),
						stops
					});
				} else if (def.type === "VectorRadialGradient" || def.type === "radialGradient") {
					const stops = collectGradientStops(def);
					if (stops.length > 0) defs.paints.set(id, {
						kind: "radialGradient",
						cx: round4(parsePercentOrNumber(def.props.cx, .5)),
						cy: round4(parsePercentOrNumber(def.props.cy, .5)),
						r: round4(parsePercentOrNumber(def.props.r, .5)),
						stops
					});
				} else if (def.type === "VectorClip" || def.type === "clipPath") {
					const rect = def.children.find((c) => isMediaElement(c) && (c.type === "rect" || c.type === "VectorRect"));
					if (rect) {
						const rx = finite(rect.props.rx) ?? finite(rect.props.ry);
						defs.clips.set(id, {
							x: round4(finite(rect.props.x) ?? 0),
							y: round4(finite(rect.props.y) ?? 0),
							width: round4(Math.max(0, finite(rect.props.width) ?? 0)),
							height: round4(Math.max(0, finite(rect.props.height) ?? 0)),
							...rx !== void 0 && rx > 0 ? { radius: round4(rx) } : {}
						});
					}
				}
			}
			else collectVectorDefs(child, defs);
		}
	}
	function collectGradientStops(gradEl) {
		const stops = [];
		for (const child of gradEl.children) {
			if (!isMediaElement(child)) continue;
			if (child.type !== "VectorStop" && child.type !== "stop") continue;
			const rawColor = typeof child.props.stopColor === "string" ? child.props.stopColor : typeof child.props["stop-color"] === "string" ? child.props["stop-color"] : void 0;
			if (!rawColor) continue;
			const color = normalizeColor(rawColor, finite(child.props.stopOpacity) ?? finite(child.props["stop-opacity"]));
			if (!color) continue;
			const offset = clamp01(parsePercentOrNumber(child.props.offset, 0));
			stops.push({
				color,
				offset: round4(offset)
			});
		}
		return stops;
	}
	function resolveVectorFill(el, inherited, defs) {
		const rawFill = el.props.fill !== void 0 ? el.props.fill : inherited.vectorPaint?.fill;
		const fillOpacity = finite(el.props.fillOpacity) ?? finite(el.props["fill-opacity"]) ?? inherited.vectorPaint?.fillOpacity;
		if (rawFill === void 0) {
			const color = normalizeColor("#000000", fillOpacity);
			return color ? {
				kind: "solid",
				color
			} : void 0;
		}
		if (typeof rawFill !== "string") return void 0;
		const trimmed = rawFill.trim();
		if (!trimmed || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "transparent") return void 0;
		const urlId = parseUrlRef(trimmed);
		if (urlId && defs.paints.has(urlId)) return defs.paints.get(urlId);
		if (defs.paints.has(trimmed)) return defs.paints.get(trimmed);
		const color = normalizeColor(trimmed, fillOpacity);
		return color ? {
			kind: "solid",
			color
		} : void 0;
	}
	function resolveVectorStroke(el, inherited) {
		const rawStroke = el.props.stroke !== void 0 ? el.props.stroke : inherited.vectorPaint?.stroke;
		if (typeof rawStroke !== "string") return void 0;
		const trimmed = rawStroke.trim();
		if (!trimmed || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "transparent") return void 0;
		const color = normalizeColor(trimmed, finite(el.props.strokeOpacity) ?? finite(el.props["stroke-opacity"]) ?? inherited.vectorPaint?.strokeOpacity);
		if (!color) return void 0;
		const width = finite(el.props.strokeWidth) ?? finite(el.props["stroke-width"]) ?? inherited.vectorPaint?.strokeWidth ?? 1;
		if (width <= 0) return void 0;
		const cap = el.props.strokeLinecap ?? el.props["stroke-linecap"];
		const join = el.props.strokeLinejoin ?? el.props["stroke-linejoin"];
		const rawDash = el.props.strokeDasharray ?? el.props["stroke-dasharray"];
		let dashArray;
		if (typeof rawDash === "number" && Number.isFinite(rawDash) && rawDash > 0) dashArray = [round4(rawDash)];
		else if (typeof rawDash === "string" && rawDash.trim() && rawDash.trim() !== "none") {
			const parsed = rawDash.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0).map(round4);
			if (parsed.length > 0) dashArray = parsed;
		}
		const dashOffset = finite(el.props.strokeDashoffset) ?? finite(el.props["stroke-dashoffset"]);
		return {
			color,
			width: round4(width),
			...cap === "butt" || cap === "round" || cap === "square" ? { lineCap: cap } : {},
			...join === "miter" || join === "round" || join === "bevel" ? { lineJoin: join } : {},
			...dashArray ? { dashArray } : {},
			...dashOffset !== void 0 ? { dashOffset: round4(dashOffset) } : {}
		};
	}
	function parsePointsList(points) {
		if (!points) return [];
		const nums = (typeof points === "string" ? points : formatVectorPoints(points)).trim().split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
		const out = [];
		for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
		return out;
	}
	function pointsBounds(pts) {
		if (pts.length === 0) return {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		};
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const [x, y] of pts) {
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		}
		return {
			x: minX,
			y: minY,
			width: Math.max(0, maxX - minX),
			height: Math.max(0, maxY - minY)
		};
	}
	function viewBoxMatrix(box, viewBox, fit) {
		if (viewBox.width <= 0 || viewBox.height <= 0 || box.width <= 0 || box.height <= 0) return {
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: box.x,
			f: box.y
		};
		const sx = box.width / viewBox.width;
		const sy = box.height / viewBox.height;
		if (fit === "fill") return {
			a: sx,
			b: 0,
			c: 0,
			d: sy,
			e: box.x - viewBox.x * sx,
			f: box.y - viewBox.y * sy
		};
		const scale = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
		return {
			a: scale,
			b: 0,
			c: 0,
			d: scale,
			e: box.x + (box.width - viewBox.width * scale) / 2 - viewBox.x * scale,
			f: box.y + (box.height - viewBox.height * scale) / 2 - viewBox.y * scale
		};
	}
	function emitVectorNode(el, state, inherited, defs, fallbackId) {
		if (el.props["data-si-hit"] === "1") return;
		if (typeof el.props.style === "string" && /display\s*:\s*none/i.test(el.props.style)) return;
		if (el.type === "VectorDefs" || el.type === "defs") return;
		if (el.type === "Html" || el.type === "Video" || el.type === "Plate") {
			pushIssue(state, el, "UNSUPPORTED_NODE", `${el.type} is browser-only`);
			return;
		}
		if (el.type === "foreignObject") {
			if (fallbackId !== void 0) {
				const fx = finite(el.props.x) ?? 0;
				const fy = finite(el.props.y) ?? 0;
				const fw = finite(el.props.width) ?? 0;
				const fh = finite(el.props.height) ?? 0;
				const childEls = el.children.filter(isMediaElement);
				const unwrapped = childEls.length === 1 && childEls[0].type === "div" ? childEls[0].children.filter(isMediaElement) : childEls;
				if (unwrapped.length === 1 && unwrapped[0].type === "Image") {
					const img = unwrapped[0];
					const asset = typeof img.props.src === "string" ? img.props.src : typeof img.props.href === "string" ? img.props.href : "";
					if (asset) {
						const ix = finite(img.props.x) ?? 0;
						const iy = finite(img.props.y) ?? 0;
						const iw = img.props.width === "fill" ? fw : finite(img.props.width) ?? fw;
						const ih = img.props.height === "fill" ? fh : finite(img.props.height) ?? fh;
						const fit = img.props.fit === "cover" || img.props.fit === "contain" || img.props.fit === "fill" ? img.props.fit : "fill";
						const imgOpacity = clamp01(inherited.opacity * clamp01(finite(img.props.opacity) ?? 1));
						if (imgOpacity > 0) {
							const id = allocId(state, preferredNodeId(img) ?? fallbackId, "image");
							state.ops.push({
								...buildOpBase(id, {
									x: fx + ix,
									y: fy + iy,
									width: iw,
									height: ih
								}, {
									...inherited,
									opacity: imgOpacity
								}),
								kind: "image",
								asset,
								fit,
								...img.props.pixelArt === true ? { pixelArt: true } : {}
							});
						}
						return;
					}
				}
			}
			pushIssue(state, el, "UNSUPPORTED_NODE", `foreignObject is browser-only`);
			return;
		}
		const localOpacity = finite(el.props.opacity) ?? 1;
		const nextOpacity = clamp01(inherited.opacity * clamp01(localOpacity));
		if (nextOpacity <= 0) return;
		const localTransform = parseSvgTransform(el.props.transform);
		const nextMatrix = multiplySceneMatrices(inherited.matrix, localTransform);
		const rawClip = typeof el.props.clip === "string" ? el.props.clip : parseUrlRef(el.props["clip-path"]);
		const nextClips = [...inherited.clips];
		if (rawClip && defs.clips.has(rawClip)) nextClips.push(transformClipRect(defs.clips.get(rawClip), nextMatrix));
		const nextVectorPaint = {
			fill: typeof el.props.fill === "string" ? el.props.fill : inherited.vectorPaint?.fill,
			fillOpacity: finite(el.props.fillOpacity) ?? finite(el.props["fill-opacity"]) ?? inherited.vectorPaint?.fillOpacity,
			stroke: typeof el.props.stroke === "string" ? el.props.stroke : inherited.vectorPaint?.stroke,
			strokeWidth: finite(el.props.strokeWidth) ?? finite(el.props["stroke-width"]) ?? inherited.vectorPaint?.strokeWidth,
			strokeOpacity: finite(el.props.strokeOpacity) ?? finite(el.props["stroke-opacity"]) ?? inherited.vectorPaint?.strokeOpacity
		};
		const nextBlendMode = el.props.blendMode === "normal" || el.props.blendMode === "multiply" || el.props.blendMode === "screen" || el.props.blendMode === "overlay" ? el.props.blendMode : inherited.blendMode;
		const nodeState = {
			matrix: nextMatrix,
			opacity: nextOpacity,
			...nextBlendMode ? { blendMode: nextBlendMode } : {},
			clips: nextClips,
			vectorPaint: nextVectorPaint
		};
		const partId = preferredNodeId(el) ?? fallbackId;
		if (el.type === "VectorGroup" || el.type === "g") {
			const childFallback = typeof el.props["data-si-part"] === "string" ? el.props["data-si-part"] : fallbackId;
			for (const child of el.children) if (isMediaElement(child)) emitVectorNode(child, state, nodeState, defs, childFallback);
			return;
		}
		if (el.type === "VectorViewport" || el.type === "svg") {
			const x = finite(el.props.x) ?? 0;
			const y = finite(el.props.y) ?? 0;
			const w = finite(el.props.width) ?? 0;
			const h = finite(el.props.height) ?? 0;
			const vb = el.props.viewBox;
			const subMatrix = vb && typeof vb === "object" ? viewBoxMatrix({
				x,
				y,
				width: w,
				height: h
			}, {
				x: vb.x ?? 0,
				y: vb.y ?? 0,
				width: vb.width ?? w,
				height: vb.height ?? h
			}, el.props.fit) : {
				a: 1,
				b: 0,
				c: 0,
				d: 1,
				e: x,
				f: y
			};
			const subState = {
				...nodeState,
				matrix: multiplySceneMatrices(nodeState.matrix, subMatrix)
			};
			for (const child of el.children) if (isMediaElement(child)) emitVectorNode(child, state, subState, defs, partId);
			return;
		}
		if (el.type === "VectorRect" || el.type === "rect") {
			const x = finite(el.props.x) ?? 0;
			const y = finite(el.props.y) ?? 0;
			const width = finite(el.props.width) ?? 0;
			const height = finite(el.props.height) ?? 0;
			const radius = finite(el.props.rx) ?? finite(el.props.ry);
			const fill = resolveVectorFill(el, inherited, defs);
			const stroke = resolveVectorStroke(el, inherited);
			if (!fill && !stroke) return;
			const id = allocId(state, partId, "rect");
			state.ops.push({
				...buildOpBase(id, {
					x,
					y,
					width,
					height
				}, nodeState),
				kind: "rect",
				...fill ? { fill } : {},
				...stroke ? { stroke } : {},
				...radius !== void 0 && radius > 0 ? { radius: round4(radius) } : {}
			});
			return;
		}
		if (el.type === "VectorCircle" || el.type === "circle") {
			const cx = finite(el.props.cx) ?? 0;
			const cy = finite(el.props.cy) ?? 0;
			const r = finite(el.props.r) ?? 0;
			const fill = resolveVectorFill(el, inherited, defs);
			const stroke = resolveVectorStroke(el, inherited);
			if (!fill && !stroke) return;
			const id = allocId(state, partId, "ellipse");
			state.ops.push({
				...buildOpBase(id, {
					x: cx - r,
					y: cy - r,
					width: 2 * r,
					height: 2 * r
				}, nodeState),
				kind: "ellipse",
				...fill ? { fill } : {},
				...stroke ? { stroke } : {}
			});
			return;
		}
		if (el.type === "VectorEllipse" || el.type === "ellipse") {
			const cx = finite(el.props.cx) ?? 0;
			const cy = finite(el.props.cy) ?? 0;
			const rx = finite(el.props.rx) ?? 0;
			const ry = finite(el.props.ry) ?? 0;
			const fill = resolveVectorFill(el, inherited, defs);
			const stroke = resolveVectorStroke(el, inherited);
			if (!fill && !stroke) return;
			const id = allocId(state, partId, "ellipse");
			state.ops.push({
				...buildOpBase(id, {
					x: cx - rx,
					y: cy - ry,
					width: 2 * rx,
					height: 2 * ry
				}, nodeState),
				kind: "ellipse",
				...fill ? { fill } : {},
				...stroke ? { stroke } : {}
			});
			return;
		}
		if (el.type === "VectorLine" || el.type === "line") {
			const x1 = finite(el.props.x1) ?? 0;
			const y1 = finite(el.props.y1) ?? 0;
			const x2 = finite(el.props.x2) ?? 0;
			const y2 = finite(el.props.y2) ?? 0;
			const stroke = resolveVectorStroke(el, inherited);
			if (!stroke) return;
			const bounds = pointsBounds([[x1, y1], [x2, y2]]);
			const id = allocId(state, partId, "line");
			state.ops.push({
				...buildOpBase(id, bounds, nodeState),
				kind: "path",
				d: `M ${round4(x1)} ${round4(y1)} L ${round4(x2)} ${round4(y2)}`,
				stroke
			});
			return;
		}
		if (el.type === "VectorPolyline" || el.type === "polyline" || el.type === "VectorPolygon" || el.type === "polygon") {
			const pts = parsePointsList(el.props.points);
			if (pts.length === 0) return;
			const closed = el.type === "VectorPolygon" || el.type === "polygon";
			const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${round4(x)} ${round4(y)}`).join(" ") + (closed ? " Z" : "");
			const fill = resolveVectorFill(el, inherited, defs);
			const stroke = resolveVectorStroke(el, inherited);
			if (!fill && !stroke) return;
			const fillRule = el.props.fillRule === "evenodd" || el.props["fill-rule"] === "evenodd" ? "evenodd" : void 0;
			const id = allocId(state, partId, closed ? "polygon" : "polyline");
			state.ops.push({
				...buildOpBase(id, pointsBounds(pts), nodeState),
				kind: "path",
				d,
				...fill ? { fill } : {},
				...fillRule ? { fillRule } : {},
				...stroke ? { stroke } : {}
			});
			return;
		}
		if (el.type === "VectorPath" || el.type === "path") {
			const d = typeof el.props.d === "string" ? el.props.d.trim() : "";
			if (!d) return;
			const fill = resolveVectorFill(el, inherited, defs);
			const stroke = resolveVectorStroke(el, inherited);
			if (!fill && !stroke) return;
			const fillRule = el.props.fillRule === "evenodd" || el.props["fill-rule"] === "evenodd" ? "evenodd" : void 0;
			const bounds = el.layout ?? {
				x: 0,
				y: 0,
				width: state.canvasWidth,
				height: state.canvasWidth
			};
			const id = allocId(state, partId, "path");
			state.ops.push({
				...buildOpBase(id, bounds, nodeState),
				kind: "path",
				d,
				...fill ? { fill } : {},
				...fillRule ? { fillRule } : {},
				...stroke ? { stroke } : {}
			});
			return;
		}
		if (el.type === "image" || el.type === "Image") {
			const asset = typeof el.props.href === "string" ? el.props.href : typeof el.props.src === "string" ? el.props.src : "";
			if (!asset) return;
			const x = finite(el.props.x) ?? 0;
			const y = finite(el.props.y) ?? 0;
			const width = finite(el.props.width) ?? 0;
			const height = finite(el.props.height) ?? 0;
			const par = typeof el.props.preserveAspectRatio === "string" ? el.props.preserveAspectRatio : "";
			const fit = el.props.fit === "cover" || el.props.fit === "contain" || el.props.fit === "fill" ? el.props.fit : par === "none" ? "fill" : par.includes("meet") ? "contain" : "cover";
			const pixelArt = el.props.pixelArt === true || el.props["image-rendering"] === "pixelated" ? true : void 0;
			const id = allocId(state, partId, "image");
			state.ops.push({
				...buildOpBase(id, {
					x,
					y,
					width,
					height
				}, nodeState),
				kind: "image",
				asset,
				fit,
				...pixelArt !== void 0 ? { pixelArt } : {}
			});
			return;
		}
		if (el.type === "VectorText" || el.type === "text") {
			const text = childText(el);
			const x = finite(el.props.x) ?? 0;
			const baselineY = finite(el.props.y) ?? 0;
			const fontSize = finite(el.props.size) ?? finite(el.props["font-size"]) ?? 16;
			const fontWeight = finite(el.props.weight) ?? finite(el.props["font-weight"]) ?? 400;
			const fontFamily = typeof el.props.family === "string" ? el.props.family : typeof el.props["font-family"] === "string" ? el.props["font-family"] : "Inter, system-ui, sans-serif";
			const fontStyle = el.props.styleName === "italic" || el.props["font-style"] === "italic" ? "italic" : "normal";
			const anchor = el.props.anchor ?? el.props["text-anchor"];
			const align = anchor === "middle" ? "center" : anchor === "end" ? "right" : "left";
			const fillColor = typeof el.props.fill === "string" ? normalizeColor(el.props.fill) : normalizeColor("#000000");
			const width = state.measurer ? state.measurer.measure(text, {
				fontFamily,
				fontSize,
				fontWeight,
				fontStyle
			}).width : text.length * fontSize * .55;
			const lineX = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
			const topY = baselineY - fontSize * .8;
			const id = allocId(state, partId, "vtext");
			state.ops.push({
				...buildOpBase(id, {
					x: lineX,
					y: topY,
					width,
					height: fontSize * 1.2
				}, nodeState),
				kind: "text",
				lines: [{
					text,
					x: round4(lineX),
					y: round4(topY),
					baselineY: round4(baselineY),
					width: round4(width)
				}],
				fontFamily,
				fontSize: round4(fontSize),
				fontWeight: Math.round(fontWeight),
				fontStyle,
				lineHeight: 1.2,
				align,
				color: fillColor ?? "#000000",
				metricsExact: Boolean(state.measurer)
			});
			return;
		}
		for (const child of el.children) if (isMediaElement(child)) emitVectorNode(child, state, nodeState, defs, partId);
	}
	function emitVectorRoot(el, state, inherited) {
		const paint = resolvePaint(el);
		checkPaintIssues(el, paint, state);
		const box = boxOf(el);
		const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
		if (nodeState.opacity <= 0) return;
		const defs = {
			paints: /* @__PURE__ */ new Map(),
			clips: /* @__PURE__ */ new Map()
		};
		collectVectorDefs(el, defs);
		const vb = el.props.viewBox;
		const vbMatrix = vb && typeof vb === "object" ? viewBoxMatrix(box, vb, el.props.fit) : {
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: box.x,
			f: box.y
		};
		const vectorState = {
			...nodeState,
			matrix: multiplySceneMatrices(nodeState.matrix, vbMatrix)
		};
		for (const child of el.children) if (isMediaElement(child)) emitVectorNode(child, state, vectorState, defs);
	}
	function emitNode(el, state, inherited) {
		if (el.type === "Html" || el.type === "Video" || el.type === "Plate" || el.type === "foreignObject") {
			pushIssue(state, el, "UNSUPPORTED_NODE", `${el.type} is browser-only and cannot be lowered to DisplayList`);
			return;
		}
		const className = [el.props.class, el.props.className].filter((v) => typeof v === "string" && v.length > 0);
		if (className.length > 0) pushIssue(state, el, "UNSUPPORTED_CLASSNAME", `className "${className.join(" ")}" requires browser CSS`);
		if (el.type === "Text") {
			emitText(el, state, inherited);
			return;
		}
		if (el.type === "Image") {
			emitImage(el, state, inherited);
			return;
		}
		if (el.type === "Code") {
			emitCode(el, state, inherited);
			return;
		}
		if (el.type === "Vector") {
			emitVectorRoot(el, state, inherited);
			return;
		}
		const paint = resolvePaint(el);
		checkPaintIssues(el, paint, state);
		const box = boxOf(el);
		const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
		if (nodeState.opacity <= 0) return;
		if (el.type === "Fill" || GROUP_TYPES.has(el.type)) emitBoxPaint(el, paint, box, nodeState, state);
		for (const child of el.children) if (isMediaElement(child)) emitNode(child, state, nodeState);
	}
	function collectAnchors(snapshots) {
		const anchors = [];
		const seen = /* @__PURE__ */ new Set();
		for (const snapshot of snapshots) {
			const visible = new Set(snapshot.nodes.filter((n) => n.visible && n.opacity > 0).map((n) => n.id));
			for (const instance of snapshot.instances) {
				if (!visible.has(instance.id)) continue;
				const entity = instance.entityId ?? instance.id;
				for (const [name, point] of Object.entries(instance.anchors)) {
					const key = `${entity}\0${name}`;
					if (seen.has(key)) continue;
					seen.add(key);
					anchors.push({
						entity,
						name,
						x: round4(point.x),
						y: round4(point.y)
					});
				}
			}
		}
		return anchors;
	}
	/**
	* Lower a media tree (including spatial Scenes, layout primitives, text, images, and Vector trees)
	* to a canonical, JSON-serializable, cross-OS DisplayList v1 frame.
	*/
	function lowerDisplayList(node, options = {}) {
		const resolved = resolveSceneTree(node);
		const width = finite(resolved.props.width) ?? options.width ?? finite(resolved.layout?.width) ?? 1920;
		const height = finite(resolved.props.height) ?? options.height ?? finite(resolved.layout?.height) ?? 1080;
		const laidOut = layoutTree(resolved, {
			width,
			height,
			...options.measurer !== void 0 ? { measurer: options.measurer } : {}
		});
		const state = {
			canvasWidth: width,
			...options.measurer !== void 0 ? { measurer: options.measurer } : {},
			ops: [],
			issues: [],
			usedIds: /* @__PURE__ */ new Set(),
			seq: 0
		};
		if (typeof options.background === "string" && options.background.trim()) {
			const bgColor = normalizeColor(options.background);
			if (bgColor) state.ops.push({
				id: allocId(state, "__background", "bg"),
				kind: "rect",
				bounds: cleanRect({
					x: 0,
					y: 0,
					width,
					height
				}),
				opacity: 1,
				fill: {
					kind: "solid",
					color: bgColor
				}
			});
			else state.issues.push({
				code: "UNSUPPORTED_BACKGROUND",
				message: `Background "${options.background}" is not a plain color`
			});
		}
		emitNode(laidOut, state, {
			matrix: IDENTITY_MATRIX,
			opacity: 1,
			clips: []
		});
		const snapshots = [];
		if (resolved.sceneSnapshot) snapshots.push(resolved.sceneSnapshot);
		if (resolved.sceneSnapshots) {
			for (const s of resolved.sceneSnapshots) if (!snapshots.includes(s)) snapshots.push(s);
		}
		const frame = {
			kind: DISPLAY_LIST_KIND,
			schemaVersion: 1,
			width: round4(width),
			height: round4(height),
			ops: state.ops,
			anchors: collectAnchors(snapshots),
			issues: state.issues
		};
		if (options.strict && frame.issues.length > 0) {
			const first = frame.issues[0];
			throw new TypeError(`DisplayList lowering failed (${first.code}${first.nodeId ? ` at ${first.nodeId}` : ""}): ${first.message}`);
		}
		return frame;
	}
	//! Which trees (and delivery config) cannot be painted by `lowerSvg`.
	//! Code primitive — lives outside primitives.ts so the browser player graph
	//! can import Html/Image/Video without pulling the lazy `code` capability.
	var require_ed5 = /* @__PURE__ */ __commonJSMin(((exports) => {
		/**
		* Character classes and associated utilities for the 5th edition of XML 1.0.
		*
		* @author Louis-Dominique Dubeau
		* @license MIT
		* @copyright Louis-Dominique Dubeau
		*/
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.CHAR = "	\n\r -퟿-�𐀀-􏿿";
		exports.S = " 	\r\n";
		exports.NAME_START_CHAR = ":A-Z_a-zÀ-ÖØ-öø-˿Ͱ-ͽͿ-῿‌‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�𐀀-󯿿";
		exports.NAME_CHAR = "-" + exports.NAME_START_CHAR + ".0-9·̀-ͯ‿-⁀";
		exports.CHAR_RE = new RegExp("^[" + exports.CHAR + "]$", "u");
		exports.S_RE = new RegExp("^[" + exports.S + "]+$", "u");
		exports.NAME_START_CHAR_RE = new RegExp("^[" + exports.NAME_START_CHAR + "]$", "u");
		exports.NAME_CHAR_RE = new RegExp("^[" + exports.NAME_CHAR + "]$", "u");
		exports.NAME_RE = new RegExp("^[" + exports.NAME_START_CHAR + "][" + exports.NAME_CHAR + "]*$", "u");
		exports.NMTOKEN_RE = new RegExp("^[" + exports.NAME_CHAR + "]+$", "u");
		var TAB = 9;
		var NL = 10;
		var CR = 13;
		var SPACE = 32;
		/** All characters in the ``S`` production. */
		exports.S_LIST = [
			SPACE,
			NL,
			CR,
			TAB
		];
		/**
		* Determines whether a codepoint matches the ``CHAR`` production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``CHAR``.
		*/
		function isChar(c) {
			return c >= SPACE && c <= 55295 || c === NL || c === CR || c === TAB || c >= 57344 && c <= 65533 || c >= 65536 && c <= 1114111;
		}
		exports.isChar = isChar;
		/**
		* Determines whether a codepoint matches the ``S`` (space) production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``S``.
		*/
		function isS(c) {
			return c === SPACE || c === NL || c === CR || c === TAB;
		}
		exports.isS = isS;
		/**
		* Determines whether a codepoint matches the ``NAME_START_CHAR`` production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``NAME_START_CHAR``.
		*/
		function isNameStartChar(c) {
			return c >= 65 && c <= 90 || c >= 97 && c <= 122 || c === 58 || c === 95 || c === 8204 || c === 8205 || c >= 192 && c <= 214 || c >= 216 && c <= 246 || c >= 248 && c <= 767 || c >= 880 && c <= 893 || c >= 895 && c <= 8191 || c >= 8304 && c <= 8591 || c >= 11264 && c <= 12271 || c >= 12289 && c <= 55295 || c >= 63744 && c <= 64975 || c >= 65008 && c <= 65533 || c >= 65536 && c <= 983039;
		}
		exports.isNameStartChar = isNameStartChar;
		/**
		* Determines whether a codepoint matches the ``NAME_CHAR`` production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``NAME_CHAR``.
		*/
		function isNameChar(c) {
			return isNameStartChar(c) || c >= 48 && c <= 57 || c === 45 || c === 46 || c === 183 || c >= 768 && c <= 879 || c >= 8255 && c <= 8256;
		}
		exports.isNameChar = isNameChar;
	}));
	var require_ed2 = /* @__PURE__ */ __commonJSMin(((exports) => {
		/**
		* Character classes and associated utilities for the 2nd edition of XML 1.1.
		*
		* @author Louis-Dominique Dubeau
		* @license MIT
		* @copyright Louis-Dominique Dubeau
		*/
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.CHAR = "-퟿-�𐀀-􏿿";
		exports.RESTRICTED_CHAR = "-\b\v\f---";
		exports.S = " 	\r\n";
		exports.NAME_START_CHAR = ":A-Z_a-zÀ-ÖØ-öø-˿Ͱ-ͽͿ-῿‌‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�𐀀-󯿿";
		exports.NAME_CHAR = "-" + exports.NAME_START_CHAR + ".0-9·̀-ͯ‿-⁀";
		exports.CHAR_RE = new RegExp("^[" + exports.CHAR + "]$", "u");
		exports.RESTRICTED_CHAR_RE = new RegExp("^[" + exports.RESTRICTED_CHAR + "]$", "u");
		exports.S_RE = new RegExp("^[" + exports.S + "]+$", "u");
		exports.NAME_START_CHAR_RE = new RegExp("^[" + exports.NAME_START_CHAR + "]$", "u");
		exports.NAME_CHAR_RE = new RegExp("^[" + exports.NAME_CHAR + "]$", "u");
		exports.NAME_RE = new RegExp("^[" + exports.NAME_START_CHAR + "][" + exports.NAME_CHAR + "]*$", "u");
		exports.NMTOKEN_RE = new RegExp("^[" + exports.NAME_CHAR + "]+$", "u");
		var TAB = 9;
		var NL = 10;
		var CR = 13;
		var SPACE = 32;
		/** All characters in the ``S`` production. */
		exports.S_LIST = [
			SPACE,
			NL,
			CR,
			TAB
		];
		/**
		* Determines whether a codepoint matches the ``CHAR`` production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``CHAR``.
		*/
		function isChar(c) {
			return c >= 1 && c <= 55295 || c >= 57344 && c <= 65533 || c >= 65536 && c <= 1114111;
		}
		exports.isChar = isChar;
		/**
		* Determines whether a codepoint matches the ``RESTRICTED_CHAR`` production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``RESTRICTED_CHAR``.
		*/
		function isRestrictedChar(c) {
			return c >= 1 && c <= 8 || c === 11 || c === 12 || c >= 14 && c <= 31 || c >= 127 && c <= 132 || c >= 134 && c <= 159;
		}
		exports.isRestrictedChar = isRestrictedChar;
		/**
		* Determines whether a codepoint matches the ``CHAR`` production and does not
		* match the ``RESTRICTED_CHAR`` production. ``isCharAndNotRestricted(x)`` is
		* equivalent to ``isChar(x) && !isRestrictedChar(x)``. This function is faster
		* than running the two-call equivalent.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``CHAR`` and does not match
		* ``RESTRICTED_CHAR``.
		*/
		function isCharAndNotRestricted(c) {
			return c === 9 || c === 10 || c === 13 || c > 31 && c < 127 || c === 133 || c > 159 && c <= 55295 || c >= 57344 && c <= 65533 || c >= 65536 && c <= 1114111;
		}
		exports.isCharAndNotRestricted = isCharAndNotRestricted;
		/**
		* Determines whether a codepoint matches the ``S`` (space) production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``S``.
		*/
		function isS(c) {
			return c === SPACE || c === NL || c === CR || c === TAB;
		}
		exports.isS = isS;
		/**
		* Determines whether a codepoint matches the ``NAME_START_CHAR`` production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``NAME_START_CHAR``.
		*/
		function isNameStartChar(c) {
			return c >= 65 && c <= 90 || c >= 97 && c <= 122 || c === 58 || c === 95 || c === 8204 || c === 8205 || c >= 192 && c <= 214 || c >= 216 && c <= 246 || c >= 248 && c <= 767 || c >= 880 && c <= 893 || c >= 895 && c <= 8191 || c >= 8304 && c <= 8591 || c >= 11264 && c <= 12271 || c >= 12289 && c <= 55295 || c >= 63744 && c <= 64975 || c >= 65008 && c <= 65533 || c >= 65536 && c <= 983039;
		}
		exports.isNameStartChar = isNameStartChar;
		/**
		* Determines whether a codepoint matches the ``NAME_CHAR`` production.
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches ``NAME_CHAR``.
		*/
		function isNameChar(c) {
			return isNameStartChar(c) || c >= 48 && c <= 57 || c === 45 || c === 46 || c === 183 || c >= 768 && c <= 879 || c >= 8255 && c <= 8256;
		}
		exports.isNameChar = isNameChar;
	}));
	var require_ed3 = /* @__PURE__ */ __commonJSMin(((exports) => {
		/**
		* Character class utilities for XML NS 1.0 edition 3.
		*
		* @author Louis-Dominique Dubeau
		* @license MIT
		* @copyright Louis-Dominique Dubeau
		*/
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.NC_NAME_START_CHAR = "A-Z_a-zÀ-ÖØ-öø-˿Ͱ-ͽͿ-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�𐀀-󯿿";
		exports.NC_NAME_CHAR = "-" + exports.NC_NAME_START_CHAR + ".0-9·̀-ͯ‿-⁀";
		exports.NC_NAME_START_CHAR_RE = new RegExp("^[" + exports.NC_NAME_START_CHAR + "]$", "u");
		exports.NC_NAME_CHAR_RE = new RegExp("^[" + exports.NC_NAME_CHAR + "]$", "u");
		exports.NC_NAME_RE = new RegExp("^[" + exports.NC_NAME_START_CHAR + "][" + exports.NC_NAME_CHAR + "]*$", "u");
		/**
		* Determines whether a codepoint matches [[NC_NAME_START_CHAR]].
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches.
		*/
		function isNCNameStartChar(c) {
			return c >= 65 && c <= 90 || c === 95 || c >= 97 && c <= 122 || c >= 192 && c <= 214 || c >= 216 && c <= 246 || c >= 248 && c <= 767 || c >= 880 && c <= 893 || c >= 895 && c <= 8191 || c >= 8204 && c <= 8205 || c >= 8304 && c <= 8591 || c >= 11264 && c <= 12271 || c >= 12289 && c <= 55295 || c >= 63744 && c <= 64975 || c >= 65008 && c <= 65533 || c >= 65536 && c <= 983039;
		}
		exports.isNCNameStartChar = isNCNameStartChar;
		/**
		* Determines whether a codepoint matches [[NC_NAME_CHAR]].
		*
		* @param c The code point.
		*
		* @returns ``true`` if the codepoint matches.
		*/
		function isNCNameChar(c) {
			return isNCNameStartChar(c) || c === 45 || c === 46 || c >= 48 && c <= 57 || c === 183 || c >= 768 && c <= 879 || c >= 8255 && c <= 8256;
		}
		exports.isNCNameChar = isNCNameChar;
	}));
	(/* @__PURE__ */ __commonJSMin(((exports) => {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.SaxesParser = exports.EVENTS = void 0;
		const ed5 = require_ed5();
		const ed2 = require_ed2();
		const NSed3 = require_ed3();
		var isS = ed5.isS;
		var isChar10 = ed5.isChar;
		var isNameStartChar = ed5.isNameStartChar;
		var isNameChar = ed5.isNameChar;
		var S_LIST = ed5.S_LIST;
		var NAME_RE = ed5.NAME_RE;
		var isChar11 = ed2.isChar;
		var isNCNameStartChar = NSed3.isNCNameStartChar;
		var isNCNameChar = NSed3.isNCNameChar;
		var NC_NAME_RE = NSed3.NC_NAME_RE;
		const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
		const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
		const rootNS = {
			__proto__: null,
			xml: XML_NAMESPACE,
			xmlns: XMLNS_NAMESPACE
		};
		const XML_ENTITIES = {
			__proto__: null,
			amp: "&",
			gt: ">",
			lt: "<",
			quot: "\"",
			apos: "'"
		};
		const EOC = -1;
		const NL_LIKE = -2;
		const S_BEGIN = 0;
		const S_BEGIN_WHITESPACE = 1;
		const S_DOCTYPE = 2;
		const S_DOCTYPE_QUOTE = 3;
		const S_DTD = 4;
		const S_DTD_QUOTED = 5;
		const S_DTD_OPEN_WAKA = 6;
		const S_DTD_OPEN_WAKA_BANG = 7;
		const S_DTD_COMMENT = 8;
		const S_DTD_COMMENT_ENDING = 9;
		const S_DTD_COMMENT_ENDED = 10;
		const S_DTD_PI = 11;
		const S_DTD_PI_ENDING = 12;
		const S_TEXT = 13;
		const S_ENTITY = 14;
		const S_OPEN_WAKA = 15;
		const S_OPEN_WAKA_BANG = 16;
		const S_COMMENT = 17;
		const S_COMMENT_ENDING = 18;
		const S_COMMENT_ENDED = 19;
		const S_CDATA = 20;
		const S_CDATA_ENDING = 21;
		const S_CDATA_ENDING_2 = 22;
		const S_PI_FIRST_CHAR = 23;
		const S_PI_REST = 24;
		const S_PI_BODY = 25;
		const S_PI_ENDING = 26;
		const S_XML_DECL_NAME_START = 27;
		const S_XML_DECL_NAME = 28;
		const S_XML_DECL_EQ = 29;
		const S_XML_DECL_VALUE_START = 30;
		const S_XML_DECL_VALUE = 31;
		const S_XML_DECL_SEPARATOR = 32;
		const S_XML_DECL_ENDING = 33;
		const S_OPEN_TAG = 34;
		const S_OPEN_TAG_SLASH = 35;
		const S_ATTRIB = 36;
		const S_ATTRIB_NAME = 37;
		const S_ATTRIB_NAME_SAW_WHITE = 38;
		const S_ATTRIB_VALUE = 39;
		const S_ATTRIB_VALUE_QUOTED = 40;
		const S_ATTRIB_VALUE_CLOSED = 41;
		const S_ATTRIB_VALUE_UNQUOTED = 42;
		const S_CLOSE_TAG = 43;
		const S_CLOSE_TAG_SAW_WHITE = 44;
		const TAB = 9;
		const NL = 10;
		const CR = 13;
		const SPACE = 32;
		const BANG = 33;
		const DQUOTE = 34;
		const AMP = 38;
		const SQUOTE = 39;
		const MINUS = 45;
		const FORWARD_SLASH = 47;
		const SEMICOLON = 59;
		const LESS = 60;
		const EQUAL = 61;
		const GREATER = 62;
		const QUESTION = 63;
		const OPEN_BRACKET = 91;
		const CLOSE_BRACKET = 93;
		const NEL = 133;
		const LS = 8232;
		const isQuote = (c) => c === DQUOTE || c === SQUOTE;
		const QUOTES = [DQUOTE, SQUOTE];
		const DOCTYPE_TERMINATOR = [
			...QUOTES,
			OPEN_BRACKET,
			GREATER
		];
		const DTD_TERMINATOR = [
			...QUOTES,
			LESS,
			CLOSE_BRACKET
		];
		const XML_DECL_NAME_TERMINATOR = [
			EQUAL,
			QUESTION,
			...S_LIST
		];
		const ATTRIB_VALUE_UNQUOTED_TERMINATOR = [
			...S_LIST,
			GREATER,
			AMP,
			LESS
		];
		function nsPairCheck(parser, prefix, uri) {
			switch (prefix) {
				case "xml":
					if (uri !== XML_NAMESPACE) parser.fail(`xml prefix must be bound to ${XML_NAMESPACE}.`);
					break;
				case "xmlns": if (uri !== XMLNS_NAMESPACE) parser.fail(`xmlns prefix must be bound to ${XMLNS_NAMESPACE}.`);
			}
			switch (uri) {
				case XMLNS_NAMESPACE:
					parser.fail(prefix === "" ? `the default namespace may not be set to ${uri}.` : `may not assign a prefix (even "xmlns") to the URI \
${XMLNS_NAMESPACE}.`);
					break;
				case XML_NAMESPACE: switch (prefix) {
					case "xml": break;
					case "":
						parser.fail(`the default namespace may not be set to ${uri}.`);
						break;
					default: parser.fail("may not assign the xml namespace to another prefix.");
				}
			}
		}
		function nsMappingCheck(parser, mapping) {
			for (const local of Object.keys(mapping)) nsPairCheck(parser, local, mapping[local]);
		}
		const isNCName = (name) => NC_NAME_RE.test(name);
		const isName = (name) => NAME_RE.test(name);
		const FORBIDDEN_START = 0;
		const FORBIDDEN_BRACKET = 1;
		const FORBIDDEN_BRACKET_BRACKET = 2;
		/**
		* The list of supported events.
		*/
		exports.EVENTS = [
			"xmldecl",
			"text",
			"processinginstruction",
			"doctype",
			"comment",
			"opentagstart",
			"attribute",
			"opentag",
			"closetag",
			"cdata",
			"error",
			"end",
			"ready"
		];
		const EVENT_NAME_TO_HANDLER_NAME = {
			xmldecl: "xmldeclHandler",
			text: "textHandler",
			processinginstruction: "piHandler",
			doctype: "doctypeHandler",
			comment: "commentHandler",
			opentagstart: "openTagStartHandler",
			attribute: "attributeHandler",
			opentag: "openTagHandler",
			closetag: "closeTagHandler",
			cdata: "cdataHandler",
			error: "errorHandler",
			end: "endHandler",
			ready: "readyHandler"
		};
		var SaxesParser = class {
			/**
			* @param opt The parser options.
			*/
			constructor(opt) {
				this.opt = opt !== null && opt !== void 0 ? opt : {};
				this.fragmentOpt = !!this.opt.fragment;
				const xmlnsOpt = this.xmlnsOpt = !!this.opt.xmlns;
				this.trackPosition = this.opt.position !== false;
				this.fileName = this.opt.fileName;
				if (xmlnsOpt) {
					this.nameStartCheck = isNCNameStartChar;
					this.nameCheck = isNCNameChar;
					this.isName = isNCName;
					this.processAttribs = this.processAttribsNS;
					this.pushAttrib = this.pushAttribNS;
					this.ns = Object.assign({ __proto__: null }, rootNS);
					const additional = this.opt.additionalNamespaces;
					if (additional != null) {
						nsMappingCheck(this, additional);
						Object.assign(this.ns, additional);
					}
				} else {
					this.nameStartCheck = isNameStartChar;
					this.nameCheck = isNameChar;
					this.isName = isName;
					this.processAttribs = this.processAttribsPlain;
					this.pushAttrib = this.pushAttribPlain;
				}
				this.stateTable = [
					this.sBegin,
					this.sBeginWhitespace,
					this.sDoctype,
					this.sDoctypeQuote,
					this.sDTD,
					this.sDTDQuoted,
					this.sDTDOpenWaka,
					this.sDTDOpenWakaBang,
					this.sDTDComment,
					this.sDTDCommentEnding,
					this.sDTDCommentEnded,
					this.sDTDPI,
					this.sDTDPIEnding,
					this.sText,
					this.sEntity,
					this.sOpenWaka,
					this.sOpenWakaBang,
					this.sComment,
					this.sCommentEnding,
					this.sCommentEnded,
					this.sCData,
					this.sCDataEnding,
					this.sCDataEnding2,
					this.sPIFirstChar,
					this.sPIRest,
					this.sPIBody,
					this.sPIEnding,
					this.sXMLDeclNameStart,
					this.sXMLDeclName,
					this.sXMLDeclEq,
					this.sXMLDeclValueStart,
					this.sXMLDeclValue,
					this.sXMLDeclSeparator,
					this.sXMLDeclEnding,
					this.sOpenTag,
					this.sOpenTagSlash,
					this.sAttrib,
					this.sAttribName,
					this.sAttribNameSawWhite,
					this.sAttribValue,
					this.sAttribValueQuoted,
					this.sAttribValueClosed,
					this.sAttribValueUnquoted,
					this.sCloseTag,
					this.sCloseTagSawWhite
				];
				this._init();
			}
			/**
			* Indicates whether or not the parser is closed. If ``true``, wait for
			* the ``ready`` event to write again.
			*/
			get closed() {
				return this._closed;
			}
			_init() {
				var _a;
				this.openWakaBang = "";
				this.text = "";
				this.name = "";
				this.piTarget = "";
				this.entity = "";
				this.q = null;
				this.tags = [];
				this.tag = null;
				this.topNS = null;
				this.chunk = "";
				this.chunkPosition = 0;
				this.i = 0;
				this.prevI = 0;
				this.carriedFromPrevious = void 0;
				this.forbiddenState = FORBIDDEN_START;
				this.attribList = [];
				const { fragmentOpt } = this;
				this.state = fragmentOpt ? S_TEXT : S_BEGIN;
				this.reportedTextBeforeRoot = this.reportedTextAfterRoot = this.closedRoot = this.sawRoot = fragmentOpt;
				this.xmlDeclPossible = !fragmentOpt;
				this.xmlDeclExpects = ["version"];
				this.entityReturnState = void 0;
				let { defaultXMLVersion } = this.opt;
				if (defaultXMLVersion === void 0) {
					if (this.opt.forceXMLVersion === true) throw new Error("forceXMLVersion set but defaultXMLVersion is not set");
					defaultXMLVersion = "1.0";
				}
				this.setXMLVersion(defaultXMLVersion);
				this.positionAtNewLine = 0;
				this.doctype = false;
				this._closed = false;
				this.xmlDecl = {
					version: void 0,
					encoding: void 0,
					standalone: void 0
				};
				this.line = 1;
				this.column = 0;
				this.ENTITIES = Object.create(XML_ENTITIES);
				(_a = this.readyHandler) === null || _a === void 0 || _a.call(this);
			}
			/**
			* The stream position the parser is currently looking at. This field is
			* zero-based.
			*
			* This field is not based on counting Unicode characters but is to be
			* interpreted as a plain index into a JavaScript string.
			*/
			get position() {
				return this.chunkPosition + this.i;
			}
			/**
			* The column number of the next character to be read by the parser.  *
			* This field is zero-based. (The first column in a line is 0.)
			*
			* This field reports the index at which the next character would be in the
			* line if the line were represented as a JavaScript string.  Note that this
			* *can* be different to a count based on the number of *Unicode characters*
			* due to how JavaScript handles astral plane characters.
			*
			* See [[column]] for a number that corresponds to a count of Unicode
			* characters.
			*/
			get columnIndex() {
				return this.position - this.positionAtNewLine;
			}
			/**
			* Set an event listener on an event. The parser supports one handler per
			* event type. If you try to set an event handler over an existing handler,
			* the old handler is silently overwritten.
			*
			* @param name The event to listen to.
			*
			* @param handler The handler to set.
			*/
			on(name, handler) {
				this[EVENT_NAME_TO_HANDLER_NAME[name]] = handler;
			}
			/**
			* Unset an event handler.
			*
			* @parma name The event to stop listening to.
			*/
			off(name) {
				this[EVENT_NAME_TO_HANDLER_NAME[name]] = void 0;
			}
			/**
			* Make an error object. The error object will have a message that contains
			* the ``fileName`` option passed at the creation of the parser. If position
			* tracking was turned on, it will also have line and column number
			* information.
			*
			* @param message The message describing the error to report.
			*
			* @returns An error object with a properly formatted message.
			*/
			makeError(message) {
				var _a;
				let msg = (_a = this.fileName) !== null && _a !== void 0 ? _a : "";
				if (this.trackPosition) {
					if (msg.length > 0) msg += ":";
					msg += `${this.line}:${this.column}`;
				}
				if (msg.length > 0) msg += ": ";
				return new Error(msg + message);
			}
			/**
			* Report a parsing error. This method is made public so that client code may
			* check for issues that are outside the scope of this project and can report
			* errors.
			*
			* @param message The error to report.
			*
			* @returns this
			*/
			fail(message) {
				const err = this.makeError(message);
				const handler = this.errorHandler;
				if (handler === void 0) throw err;
				else handler(err);
				return this;
			}
			/**
			* Write a XML data to the parser.
			*
			* @param chunk The XML data to write.
			*
			* @returns this
			*/
			write(chunk) {
				if (this.closed) return this.fail("cannot write after close; assign an onready handler.");
				let end = false;
				if (chunk === null) {
					end = true;
					chunk = "";
				} else if (typeof chunk === "object") chunk = chunk.toString();
				if (this.carriedFromPrevious !== void 0) {
					chunk = `${this.carriedFromPrevious}${chunk}`;
					this.carriedFromPrevious = void 0;
				}
				let limit = chunk.length;
				const lastCode = chunk.charCodeAt(limit - 1);
				if (!end && (lastCode === CR || lastCode >= 55296 && lastCode <= 56319)) {
					this.carriedFromPrevious = chunk[limit - 1];
					limit--;
					chunk = chunk.slice(0, limit);
				}
				const { stateTable } = this;
				this.chunk = chunk;
				this.i = 0;
				while (this.i < limit) stateTable[this.state].call(this);
				this.chunkPosition += limit;
				return end ? this.end() : this;
			}
			/**
			* Close the current stream. Perform final well-formedness checks and reset
			* the parser tstate.
			*
			* @returns this
			*/
			close() {
				return this.write(null);
			}
			/**
			* Get a single code point out of the current chunk. This updates the current
			* position if we do position tracking.
			*
			* This is the algorithm to use for XML 1.0.
			*
			* @returns The character read.
			*/
			getCode10() {
				const { chunk, i } = this;
				this.prevI = i;
				this.i = i + 1;
				if (i >= chunk.length) return EOC;
				const code = chunk.charCodeAt(i);
				this.column++;
				if (code < 55296) {
					if (code >= SPACE || code === TAB) return code;
					switch (code) {
						case NL:
							this.line++;
							this.column = 0;
							this.positionAtNewLine = this.position;
							return NL;
						case CR:
							if (chunk.charCodeAt(i + 1) === NL) this.i = i + 2;
							this.line++;
							this.column = 0;
							this.positionAtNewLine = this.position;
							return NL_LIKE;
						default:
							this.fail("disallowed character.");
							return code;
					}
				}
				if (code > 56319) {
					if (!(code >= 57344 && code <= 65533)) this.fail("disallowed character.");
					return code;
				}
				const final = 65536 + (code - 55296) * 1024 + (chunk.charCodeAt(i + 1) - 56320);
				this.i = i + 2;
				if (final > 1114111) this.fail("disallowed character.");
				return final;
			}
			/**
			* Get a single code point out of the current chunk. This updates the current
			* position if we do position tracking.
			*
			* This is the algorithm to use for XML 1.1.
			*
			* @returns {number} The character read.
			*/
			getCode11() {
				const { chunk, i } = this;
				this.prevI = i;
				this.i = i + 1;
				if (i >= chunk.length) return EOC;
				const code = chunk.charCodeAt(i);
				this.column++;
				if (code < 55296) {
					if (code > 31 && code < 127 || code > 159 && code !== LS || code === TAB) return code;
					switch (code) {
						case NL:
							this.line++;
							this.column = 0;
							this.positionAtNewLine = this.position;
							return NL;
						case CR: {
							const next = chunk.charCodeAt(i + 1);
							if (next === NL || next === NEL) this.i = i + 2;
						}
						case NEL:
						case LS:
							this.line++;
							this.column = 0;
							this.positionAtNewLine = this.position;
							return NL_LIKE;
						default:
							this.fail("disallowed character.");
							return code;
					}
				}
				if (code > 56319) {
					if (!(code >= 57344 && code <= 65533)) this.fail("disallowed character.");
					return code;
				}
				const final = 65536 + (code - 55296) * 1024 + (chunk.charCodeAt(i + 1) - 56320);
				this.i = i + 2;
				if (final > 1114111) this.fail("disallowed character.");
				return final;
			}
			/**
			* Like ``getCode`` but with the return value normalized so that ``NL`` is
			* returned for ``NL_LIKE``.
			*/
			getCodeNorm() {
				const c = this.getCode();
				return c === NL_LIKE ? NL : c;
			}
			unget() {
				this.i = this.prevI;
				this.column--;
			}
			/**
			* Capture characters into a buffer until encountering one of a set of
			* characters.
			*
			* @param chars An array of codepoints. Encountering a character in the array
			* ends the capture. (``chars`` may safely contain ``NL``.)
			*
			* @return The character code that made the capture end, or ``EOC`` if we hit
			* the end of the chunk. The return value cannot be NL_LIKE: NL is returned
			* instead.
			*/
			captureTo(chars) {
				let { i: start } = this;
				const { chunk } = this;
				while (true) {
					const c = this.getCode();
					const isNLLike = c === NL_LIKE;
					const final = isNLLike ? NL : c;
					if (final === EOC || chars.includes(final)) {
						this.text += chunk.slice(start, this.prevI);
						return final;
					}
					if (isNLLike) {
						this.text += `${chunk.slice(start, this.prevI)}\n`;
						start = this.i;
					}
				}
			}
			/**
			* Capture characters into a buffer until encountering a character.
			*
			* @param char The codepoint that ends the capture. **NOTE ``char`` MAY NOT
			* CONTAIN ``NL``.** Passing ``NL`` will result in buggy behavior.
			*
			* @return ``true`` if we ran into the character. Otherwise, we ran into the
			* end of the current chunk.
			*/
			captureToChar(char) {
				let { i: start } = this;
				const { chunk } = this;
				while (true) {
					let c = this.getCode();
					switch (c) {
						case NL_LIKE:
							this.text += `${chunk.slice(start, this.prevI)}\n`;
							start = this.i;
							c = NL;
							break;
						case EOC:
							this.text += chunk.slice(start);
							return false;
					}
					if (c === char) {
						this.text += chunk.slice(start, this.prevI);
						return true;
					}
				}
			}
			/**
			* Capture characters that satisfy ``isNameChar`` into the ``name`` field of
			* this parser.
			*
			* @return The character code that made the test fail, or ``EOC`` if we hit
			* the end of the chunk. The return value cannot be NL_LIKE: NL is returned
			* instead.
			*/
			captureNameChars() {
				const { chunk, i: start } = this;
				while (true) {
					const c = this.getCode();
					if (c === EOC) {
						this.name += chunk.slice(start);
						return EOC;
					}
					if (!isNameChar(c)) {
						this.name += chunk.slice(start, this.prevI);
						return c === NL_LIKE ? NL : c;
					}
				}
			}
			/**
			* Skip white spaces.
			*
			* @return The character that ended the skip, or ``EOC`` if we hit
			* the end of the chunk. The return value cannot be NL_LIKE: NL is returned
			* instead.
			*/
			skipSpaces() {
				while (true) {
					const c = this.getCodeNorm();
					if (c === EOC || !isS(c)) return c;
				}
			}
			setXMLVersion(version) {
				this.currentXMLVersion = version;
				if (version === "1.0") {
					this.isChar = isChar10;
					this.getCode = this.getCode10;
				} else {
					this.isChar = isChar11;
					this.getCode = this.getCode11;
				}
			}
			sBegin() {
				if (this.chunk.charCodeAt(0) === 65279) {
					this.i++;
					this.column++;
				}
				this.state = S_BEGIN_WHITESPACE;
			}
			sBeginWhitespace() {
				const iBefore = this.i;
				const c = this.skipSpaces();
				if (this.prevI !== iBefore) this.xmlDeclPossible = false;
				switch (c) {
					case LESS:
						this.state = S_OPEN_WAKA;
						if (this.text.length !== 0) throw new Error("no-empty text at start");
						break;
					case EOC: break;
					default:
						this.unget();
						this.state = S_TEXT;
						this.xmlDeclPossible = false;
				}
			}
			sDoctype() {
				var _a;
				const c = this.captureTo(DOCTYPE_TERMINATOR);
				switch (c) {
					case GREATER:
						(_a = this.doctypeHandler) === null || _a === void 0 || _a.call(this, this.text);
						this.text = "";
						this.state = S_TEXT;
						this.doctype = true;
						break;
					case EOC: break;
					default:
						this.text += String.fromCodePoint(c);
						if (c === OPEN_BRACKET) this.state = S_DTD;
						else if (isQuote(c)) {
							this.state = S_DOCTYPE_QUOTE;
							this.q = c;
						}
				}
			}
			sDoctypeQuote() {
				const q = this.q;
				if (this.captureToChar(q)) {
					this.text += String.fromCodePoint(q);
					this.q = null;
					this.state = S_DOCTYPE;
				}
			}
			sDTD() {
				const c = this.captureTo(DTD_TERMINATOR);
				if (c === EOC) return;
				this.text += String.fromCodePoint(c);
				if (c === CLOSE_BRACKET) this.state = S_DOCTYPE;
				else if (c === LESS) this.state = S_DTD_OPEN_WAKA;
				else if (isQuote(c)) {
					this.state = S_DTD_QUOTED;
					this.q = c;
				}
			}
			sDTDQuoted() {
				const q = this.q;
				if (this.captureToChar(q)) {
					this.text += String.fromCodePoint(q);
					this.state = S_DTD;
					this.q = null;
				}
			}
			sDTDOpenWaka() {
				const c = this.getCodeNorm();
				this.text += String.fromCodePoint(c);
				switch (c) {
					case BANG:
						this.state = S_DTD_OPEN_WAKA_BANG;
						this.openWakaBang = "";
						break;
					case QUESTION:
						this.state = S_DTD_PI;
						break;
					default: this.state = S_DTD;
				}
			}
			sDTDOpenWakaBang() {
				const char = String.fromCodePoint(this.getCodeNorm());
				const owb = this.openWakaBang += char;
				this.text += char;
				if (owb !== "-") {
					this.state = owb === "--" ? S_DTD_COMMENT : S_DTD;
					this.openWakaBang = "";
				}
			}
			sDTDComment() {
				if (this.captureToChar(MINUS)) {
					this.text += "-";
					this.state = S_DTD_COMMENT_ENDING;
				}
			}
			sDTDCommentEnding() {
				const c = this.getCodeNorm();
				this.text += String.fromCodePoint(c);
				this.state = c === MINUS ? S_DTD_COMMENT_ENDED : S_DTD_COMMENT;
			}
			sDTDCommentEnded() {
				const c = this.getCodeNorm();
				this.text += String.fromCodePoint(c);
				if (c === GREATER) this.state = S_DTD;
				else {
					this.fail("malformed comment.");
					this.state = S_DTD_COMMENT;
				}
			}
			sDTDPI() {
				if (this.captureToChar(QUESTION)) {
					this.text += "?";
					this.state = S_DTD_PI_ENDING;
				}
			}
			sDTDPIEnding() {
				const c = this.getCodeNorm();
				this.text += String.fromCodePoint(c);
				if (c === GREATER) this.state = S_DTD;
			}
			sText() {
				if (this.tags.length !== 0) this.handleTextInRoot();
				else this.handleTextOutsideRoot();
			}
			sEntity() {
				let { i: start } = this;
				const { chunk } = this;
				loop: while (true) switch (this.getCode()) {
					case NL_LIKE:
						this.entity += `${chunk.slice(start, this.prevI)}\n`;
						start = this.i;
						break;
					case SEMICOLON: {
						const { entityReturnState } = this;
						const entity = this.entity + chunk.slice(start, this.prevI);
						this.state = entityReturnState;
						let parsed;
						if (entity === "") {
							this.fail("empty entity name.");
							parsed = "&;";
						} else {
							parsed = this.parseEntity(entity);
							this.entity = "";
						}
						if (entityReturnState !== S_TEXT || this.textHandler !== void 0) this.text += parsed;
						break loop;
					}
					case EOC:
						this.entity += chunk.slice(start);
						break loop;
				}
			}
			sOpenWaka() {
				const c = this.getCode();
				if (isNameStartChar(c)) {
					this.state = S_OPEN_TAG;
					this.unget();
					this.xmlDeclPossible = false;
				} else switch (c) {
					case FORWARD_SLASH:
						this.state = S_CLOSE_TAG;
						this.xmlDeclPossible = false;
						break;
					case BANG:
						this.state = S_OPEN_WAKA_BANG;
						this.openWakaBang = "";
						this.xmlDeclPossible = false;
						break;
					case QUESTION:
						this.state = S_PI_FIRST_CHAR;
						break;
					default:
						this.fail("disallowed character in tag name");
						this.state = S_TEXT;
						this.xmlDeclPossible = false;
				}
			}
			sOpenWakaBang() {
				this.openWakaBang += String.fromCodePoint(this.getCodeNorm());
				switch (this.openWakaBang) {
					case "[CDATA[":
						if (!this.sawRoot && !this.reportedTextBeforeRoot) {
							this.fail("text data outside of root node.");
							this.reportedTextBeforeRoot = true;
						}
						if (this.closedRoot && !this.reportedTextAfterRoot) {
							this.fail("text data outside of root node.");
							this.reportedTextAfterRoot = true;
						}
						this.state = S_CDATA;
						this.openWakaBang = "";
						break;
					case "--":
						this.state = S_COMMENT;
						this.openWakaBang = "";
						break;
					case "DOCTYPE":
						this.state = S_DOCTYPE;
						if (this.doctype || this.sawRoot) this.fail("inappropriately located doctype declaration.");
						this.openWakaBang = "";
						break;
					default: if (this.openWakaBang.length >= 7) this.fail("incorrect syntax.");
				}
			}
			sComment() {
				if (this.captureToChar(MINUS)) this.state = S_COMMENT_ENDING;
			}
			sCommentEnding() {
				var _a;
				const c = this.getCodeNorm();
				if (c === MINUS) {
					this.state = S_COMMENT_ENDED;
					(_a = this.commentHandler) === null || _a === void 0 || _a.call(this, this.text);
					this.text = "";
				} else {
					this.text += `-${String.fromCodePoint(c)}`;
					this.state = S_COMMENT;
				}
			}
			sCommentEnded() {
				const c = this.getCodeNorm();
				if (c !== GREATER) {
					this.fail("malformed comment.");
					this.text += `--${String.fromCodePoint(c)}`;
					this.state = S_COMMENT;
				} else this.state = S_TEXT;
			}
			sCData() {
				if (this.captureToChar(CLOSE_BRACKET)) this.state = S_CDATA_ENDING;
			}
			sCDataEnding() {
				const c = this.getCodeNorm();
				if (c === CLOSE_BRACKET) this.state = S_CDATA_ENDING_2;
				else {
					this.text += `]${String.fromCodePoint(c)}`;
					this.state = S_CDATA;
				}
			}
			sCDataEnding2() {
				var _a;
				const c = this.getCodeNorm();
				switch (c) {
					case GREATER:
						(_a = this.cdataHandler) === null || _a === void 0 || _a.call(this, this.text);
						this.text = "";
						this.state = S_TEXT;
						break;
					case CLOSE_BRACKET:
						this.text += "]";
						break;
					default:
						this.text += `]]${String.fromCodePoint(c)}`;
						this.state = S_CDATA;
				}
			}
			sPIFirstChar() {
				const c = this.getCodeNorm();
				if (this.nameStartCheck(c)) {
					this.piTarget += String.fromCodePoint(c);
					this.state = S_PI_REST;
				} else if (c === QUESTION || isS(c)) {
					this.fail("processing instruction without a target.");
					this.state = c === QUESTION ? S_PI_ENDING : S_PI_BODY;
				} else {
					this.fail("disallowed character in processing instruction name.");
					this.piTarget += String.fromCodePoint(c);
					this.state = S_PI_REST;
				}
			}
			sPIRest() {
				const { chunk, i: start } = this;
				while (true) {
					const c = this.getCodeNorm();
					if (c === EOC) {
						this.piTarget += chunk.slice(start);
						return;
					}
					if (!this.nameCheck(c)) {
						this.piTarget += chunk.slice(start, this.prevI);
						const isQuestion = c === QUESTION;
						if (isQuestion || isS(c)) {
							if (this.piTarget === "xml") {
								if (!this.xmlDeclPossible) this.fail("an XML declaration must be at the start of the document.");
								this.state = isQuestion ? S_XML_DECL_ENDING : S_XML_DECL_NAME_START;
							} else this.state = isQuestion ? S_PI_ENDING : S_PI_BODY;
						} else {
							this.fail("disallowed character in processing instruction name.");
							this.piTarget += String.fromCodePoint(c);
						}
						break;
					}
				}
			}
			sPIBody() {
				if (this.text.length === 0) {
					const c = this.getCodeNorm();
					if (c === QUESTION) this.state = S_PI_ENDING;
					else if (!isS(c)) this.text = String.fromCodePoint(c);
				} else if (this.captureToChar(QUESTION)) this.state = S_PI_ENDING;
			}
			sPIEnding() {
				var _a;
				const c = this.getCodeNorm();
				if (c === GREATER) {
					const { piTarget } = this;
					if (piTarget.toLowerCase() === "xml") this.fail("the XML declaration must appear at the start of the document.");
					(_a = this.piHandler) === null || _a === void 0 || _a.call(this, {
						target: piTarget,
						body: this.text
					});
					this.piTarget = this.text = "";
					this.state = S_TEXT;
				} else if (c === QUESTION) this.text += "?";
				else {
					this.text += `?${String.fromCodePoint(c)}`;
					this.state = S_PI_BODY;
				}
				this.xmlDeclPossible = false;
			}
			sXMLDeclNameStart() {
				const c = this.skipSpaces();
				if (c === QUESTION) {
					this.state = S_XML_DECL_ENDING;
					return;
				}
				if (c !== EOC) {
					this.state = S_XML_DECL_NAME;
					this.name = String.fromCodePoint(c);
				}
			}
			sXMLDeclName() {
				const c = this.captureTo(XML_DECL_NAME_TERMINATOR);
				if (c === QUESTION) {
					this.state = S_XML_DECL_ENDING;
					this.name += this.text;
					this.text = "";
					this.fail("XML declaration is incomplete.");
					return;
				}
				if (!(isS(c) || c === EQUAL)) return;
				this.name += this.text;
				this.text = "";
				if (!this.xmlDeclExpects.includes(this.name)) switch (this.name.length) {
					case 0:
						this.fail("did not expect any more name/value pairs.");
						break;
					case 1:
						this.fail(`expected the name ${this.xmlDeclExpects[0]}.`);
						break;
					default: this.fail(`expected one of ${this.xmlDeclExpects.join(", ")}`);
				}
				this.state = c === EQUAL ? S_XML_DECL_VALUE_START : S_XML_DECL_EQ;
			}
			sXMLDeclEq() {
				const c = this.getCodeNorm();
				if (c === QUESTION) {
					this.state = S_XML_DECL_ENDING;
					this.fail("XML declaration is incomplete.");
					return;
				}
				if (isS(c)) return;
				if (c !== EQUAL) this.fail("value required.");
				this.state = S_XML_DECL_VALUE_START;
			}
			sXMLDeclValueStart() {
				const c = this.getCodeNorm();
				if (c === QUESTION) {
					this.state = S_XML_DECL_ENDING;
					this.fail("XML declaration is incomplete.");
					return;
				}
				if (isS(c)) return;
				if (!isQuote(c)) {
					this.fail("value must be quoted.");
					this.q = SPACE;
				} else this.q = c;
				this.state = S_XML_DECL_VALUE;
			}
			sXMLDeclValue() {
				const c = this.captureTo([this.q, QUESTION]);
				if (c === QUESTION) {
					this.state = S_XML_DECL_ENDING;
					this.text = "";
					this.fail("XML declaration is incomplete.");
					return;
				}
				if (c === EOC) return;
				const value = this.text;
				this.text = "";
				switch (this.name) {
					case "version": {
						this.xmlDeclExpects = ["encoding", "standalone"];
						const version = value;
						this.xmlDecl.version = version;
						if (!/^1\.[0-9]+$/.test(version)) this.fail("version number must match /^1\\.[0-9]+$/.");
						else if (!this.opt.forceXMLVersion) this.setXMLVersion(version);
						break;
					}
					case "encoding":
						if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(value)) this.fail("encoding value must match /^[A-Za-z0-9][A-Za-z0-9._-]*$/.");
						this.xmlDeclExpects = ["standalone"];
						this.xmlDecl.encoding = value;
						break;
					case "standalone":
						if (value !== "yes" && value !== "no") this.fail("standalone value must match \"yes\" or \"no\".");
						this.xmlDeclExpects = [];
						this.xmlDecl.standalone = value;
				}
				this.name = "";
				this.state = S_XML_DECL_SEPARATOR;
			}
			sXMLDeclSeparator() {
				const c = this.getCodeNorm();
				if (c === QUESTION) {
					this.state = S_XML_DECL_ENDING;
					return;
				}
				if (!isS(c)) {
					this.fail("whitespace required.");
					this.unget();
				}
				this.state = S_XML_DECL_NAME_START;
			}
			sXMLDeclEnding() {
				var _a;
				if (this.getCodeNorm() === GREATER) {
					if (this.piTarget !== "xml") this.fail("processing instructions are not allowed before root.");
					else if (this.name !== "version" && this.xmlDeclExpects.includes("version")) this.fail("XML declaration must contain a version.");
					(_a = this.xmldeclHandler) === null || _a === void 0 || _a.call(this, this.xmlDecl);
					this.name = "";
					this.piTarget = this.text = "";
					this.state = S_TEXT;
				} else this.fail("The character ? is disallowed anywhere in XML declarations.");
				this.xmlDeclPossible = false;
			}
			sOpenTag() {
				var _a;
				const c = this.captureNameChars();
				if (c === EOC) return;
				const tag = this.tag = {
					name: this.name,
					attributes: Object.create(null)
				};
				this.name = "";
				if (this.xmlnsOpt) this.topNS = tag.ns = Object.create(null);
				(_a = this.openTagStartHandler) === null || _a === void 0 || _a.call(this, tag);
				this.sawRoot = true;
				if (!this.fragmentOpt && this.closedRoot) this.fail("documents may contain only one root.");
				switch (c) {
					case GREATER:
						this.openTag();
						break;
					case FORWARD_SLASH:
						this.state = S_OPEN_TAG_SLASH;
						break;
					default:
						if (!isS(c)) this.fail("disallowed character in tag name.");
						this.state = S_ATTRIB;
				}
			}
			sOpenTagSlash() {
				if (this.getCode() === GREATER) this.openSelfClosingTag();
				else {
					this.fail("forward-slash in opening tag not followed by >.");
					this.state = S_ATTRIB;
				}
			}
			sAttrib() {
				const c = this.skipSpaces();
				if (c === EOC) return;
				if (isNameStartChar(c)) {
					this.unget();
					this.state = S_ATTRIB_NAME;
				} else if (c === GREATER) this.openTag();
				else if (c === FORWARD_SLASH) this.state = S_OPEN_TAG_SLASH;
				else this.fail("disallowed character in attribute name.");
			}
			sAttribName() {
				const c = this.captureNameChars();
				if (c === EQUAL) this.state = S_ATTRIB_VALUE;
				else if (isS(c)) this.state = S_ATTRIB_NAME_SAW_WHITE;
				else if (c === GREATER) {
					this.fail("attribute without value.");
					this.pushAttrib(this.name, this.name);
					this.name = this.text = "";
					this.openTag();
				} else if (c !== EOC) this.fail("disallowed character in attribute name.");
			}
			sAttribNameSawWhite() {
				const c = this.skipSpaces();
				switch (c) {
					case EOC: return;
					case EQUAL:
						this.state = S_ATTRIB_VALUE;
						break;
					default:
						this.fail("attribute without value.");
						this.text = "";
						this.name = "";
						if (c === GREATER) this.openTag();
						else if (isNameStartChar(c)) {
							this.unget();
							this.state = S_ATTRIB_NAME;
						} else {
							this.fail("disallowed character in attribute name.");
							this.state = S_ATTRIB;
						}
				}
			}
			sAttribValue() {
				const c = this.getCodeNorm();
				if (isQuote(c)) {
					this.q = c;
					this.state = S_ATTRIB_VALUE_QUOTED;
				} else if (!isS(c)) {
					this.fail("unquoted attribute value.");
					this.state = S_ATTRIB_VALUE_UNQUOTED;
					this.unget();
				}
			}
			sAttribValueQuoted() {
				const { q, chunk } = this;
				let { i: start } = this;
				while (true) switch (this.getCode()) {
					case q:
						this.pushAttrib(this.name, this.text + chunk.slice(start, this.prevI));
						this.name = this.text = "";
						this.q = null;
						this.state = S_ATTRIB_VALUE_CLOSED;
						return;
					case AMP:
						this.text += chunk.slice(start, this.prevI);
						this.state = S_ENTITY;
						this.entityReturnState = S_ATTRIB_VALUE_QUOTED;
						return;
					case NL:
					case NL_LIKE:
					case TAB:
						this.text += `${chunk.slice(start, this.prevI)} `;
						start = this.i;
						break;
					case LESS:
						this.text += chunk.slice(start, this.prevI);
						this.fail("disallowed character.");
						return;
					case EOC:
						this.text += chunk.slice(start);
						return;
				}
			}
			sAttribValueClosed() {
				const c = this.getCodeNorm();
				if (isS(c)) this.state = S_ATTRIB;
				else if (c === GREATER) this.openTag();
				else if (c === FORWARD_SLASH) this.state = S_OPEN_TAG_SLASH;
				else if (isNameStartChar(c)) {
					this.fail("no whitespace between attributes.");
					this.unget();
					this.state = S_ATTRIB_NAME;
				} else this.fail("disallowed character in attribute name.");
			}
			sAttribValueUnquoted() {
				const c = this.captureTo(ATTRIB_VALUE_UNQUOTED_TERMINATOR);
				switch (c) {
					case AMP:
						this.state = S_ENTITY;
						this.entityReturnState = S_ATTRIB_VALUE_UNQUOTED;
						break;
					case LESS:
						this.fail("disallowed character.");
						break;
					case EOC: break;
					default:
						if (this.text.includes("]]>")) this.fail("the string \"]]>\" is disallowed in char data.");
						this.pushAttrib(this.name, this.text);
						this.name = this.text = "";
						if (c === GREATER) this.openTag();
						else this.state = S_ATTRIB;
				}
			}
			sCloseTag() {
				const c = this.captureNameChars();
				if (c === GREATER) this.closeTag();
				else if (isS(c)) this.state = S_CLOSE_TAG_SAW_WHITE;
				else if (c !== EOC) this.fail("disallowed character in closing tag.");
			}
			sCloseTagSawWhite() {
				switch (this.skipSpaces()) {
					case GREATER:
						this.closeTag();
						break;
					case EOC: break;
					default: this.fail("disallowed character in closing tag.");
				}
			}
			handleTextInRoot() {
				let { i: start, forbiddenState } = this;
				const { chunk, textHandler: handler } = this;
				scanLoop: while (true) switch (this.getCode()) {
					case LESS:
						this.state = S_OPEN_WAKA;
						if (handler !== void 0) {
							const { text } = this;
							const slice = chunk.slice(start, this.prevI);
							if (text.length !== 0) {
								handler(text + slice);
								this.text = "";
							} else if (slice.length !== 0) handler(slice);
						}
						forbiddenState = FORBIDDEN_START;
						break scanLoop;
					case AMP:
						this.state = S_ENTITY;
						this.entityReturnState = S_TEXT;
						if (handler !== void 0) this.text += chunk.slice(start, this.prevI);
						forbiddenState = FORBIDDEN_START;
						break scanLoop;
					case CLOSE_BRACKET:
						switch (forbiddenState) {
							case FORBIDDEN_START:
								forbiddenState = FORBIDDEN_BRACKET;
								break;
							case FORBIDDEN_BRACKET:
								forbiddenState = FORBIDDEN_BRACKET_BRACKET;
								break;
							case FORBIDDEN_BRACKET_BRACKET: break;
							default: throw new Error("impossible state");
						}
						break;
					case GREATER:
						if (forbiddenState === FORBIDDEN_BRACKET_BRACKET) this.fail("the string \"]]>\" is disallowed in char data.");
						forbiddenState = FORBIDDEN_START;
						break;
					case NL_LIKE:
						if (handler !== void 0) this.text += `${chunk.slice(start, this.prevI)}\n`;
						start = this.i;
						forbiddenState = FORBIDDEN_START;
						break;
					case EOC:
						if (handler !== void 0) this.text += chunk.slice(start);
						break scanLoop;
					default: forbiddenState = FORBIDDEN_START;
				}
				this.forbiddenState = forbiddenState;
			}
			handleTextOutsideRoot() {
				let { i: start } = this;
				const { chunk, textHandler: handler } = this;
				let nonSpace = false;
				outRootLoop: while (true) {
					const code = this.getCode();
					switch (code) {
						case LESS:
							this.state = S_OPEN_WAKA;
							if (handler !== void 0) {
								const { text } = this;
								const slice = chunk.slice(start, this.prevI);
								if (text.length !== 0) {
									handler(text + slice);
									this.text = "";
								} else if (slice.length !== 0) handler(slice);
							}
							break outRootLoop;
						case AMP:
							this.state = S_ENTITY;
							this.entityReturnState = S_TEXT;
							if (handler !== void 0) this.text += chunk.slice(start, this.prevI);
							nonSpace = true;
							break outRootLoop;
						case NL_LIKE:
							if (handler !== void 0) this.text += `${chunk.slice(start, this.prevI)}\n`;
							start = this.i;
							break;
						case EOC:
							if (handler !== void 0) this.text += chunk.slice(start);
							break outRootLoop;
						default: if (!isS(code)) nonSpace = true;
					}
				}
				if (!nonSpace) return;
				if (!this.sawRoot && !this.reportedTextBeforeRoot) {
					this.fail("text data outside of root node.");
					this.reportedTextBeforeRoot = true;
				}
				if (this.closedRoot && !this.reportedTextAfterRoot) {
					this.fail("text data outside of root node.");
					this.reportedTextAfterRoot = true;
				}
			}
			pushAttribNS(name, value) {
				var _a;
				const { prefix, local } = this.qname(name);
				const attr = {
					name,
					prefix,
					local,
					value
				};
				this.attribList.push(attr);
				(_a = this.attributeHandler) === null || _a === void 0 || _a.call(this, attr);
				if (prefix === "xmlns") {
					const trimmed = value.trim();
					if (this.currentXMLVersion === "1.0" && trimmed === "") this.fail("invalid attempt to undefine prefix in XML 1.0");
					this.topNS[local] = trimmed;
					nsPairCheck(this, local, trimmed);
				} else if (name === "xmlns") {
					const trimmed = value.trim();
					this.topNS[""] = trimmed;
					nsPairCheck(this, "", trimmed);
				}
			}
			pushAttribPlain(name, value) {
				var _a;
				const attr = {
					name,
					value
				};
				this.attribList.push(attr);
				(_a = this.attributeHandler) === null || _a === void 0 || _a.call(this, attr);
			}
			/**
			* End parsing. This performs final well-formedness checks and resets the
			* parser to a clean state.
			*
			* @returns this
			*/
			end() {
				var _a, _b;
				if (!this.sawRoot) this.fail("document must contain a root element.");
				const { tags } = this;
				while (tags.length > 0) {
					const tag = tags.pop();
					this.fail(`unclosed tag: ${tag.name}`);
				}
				if (this.state !== S_BEGIN && this.state !== S_TEXT) this.fail("unexpected end.");
				const { text } = this;
				if (text.length !== 0) {
					(_a = this.textHandler) === null || _a === void 0 || _a.call(this, text);
					this.text = "";
				}
				this._closed = true;
				(_b = this.endHandler) === null || _b === void 0 || _b.call(this);
				this._init();
				return this;
			}
			/**
			* Resolve a namespace prefix.
			*
			* @param prefix The prefix to resolve.
			*
			* @returns The namespace URI or ``undefined`` if the prefix is not defined.
			*/
			resolve(prefix) {
				var _a, _b;
				let uri = this.topNS[prefix];
				if (uri !== void 0) return uri;
				const { tags } = this;
				for (let index = tags.length - 1; index >= 0; index--) {
					uri = tags[index].ns[prefix];
					if (uri !== void 0) return uri;
				}
				uri = this.ns[prefix];
				if (uri !== void 0) return uri;
				return (_b = (_a = this.opt).resolvePrefix) === null || _b === void 0 ? void 0 : _b.call(_a, prefix);
			}
			/**
			* Parse a qname into its prefix and local name parts.
			*
			* @param name The name to parse
			*
			* @returns
			*/
			qname(name) {
				const colon = name.indexOf(":");
				if (colon === -1) return {
					prefix: "",
					local: name
				};
				const local = name.slice(colon + 1);
				const prefix = name.slice(0, colon);
				if (prefix === "" || local === "" || local.includes(":")) this.fail(`malformed name: ${name}.`);
				return {
					prefix,
					local
				};
			}
			processAttribsNS() {
				var _a;
				const { attribList } = this;
				const tag = this.tag;
				{
					const { prefix, local } = this.qname(tag.name);
					tag.prefix = prefix;
					tag.local = local;
					const uri = tag.uri = (_a = this.resolve(prefix)) !== null && _a !== void 0 ? _a : "";
					if (prefix !== "") {
						if (prefix === "xmlns") this.fail("tags may not have \"xmlns\" as prefix.");
						if (uri === "") {
							this.fail(`unbound namespace prefix: ${JSON.stringify(prefix)}.`);
							tag.uri = prefix;
						}
					}
				}
				if (attribList.length === 0) return;
				const { attributes } = tag;
				const seen = /* @__PURE__ */ new Set();
				for (const attr of attribList) {
					const { name, prefix, local } = attr;
					let uri;
					let eqname;
					if (prefix === "") {
						uri = name === "xmlns" ? XMLNS_NAMESPACE : "";
						eqname = name;
					} else {
						uri = this.resolve(prefix);
						if (uri === void 0) {
							this.fail(`unbound namespace prefix: ${JSON.stringify(prefix)}.`);
							uri = prefix;
						}
						eqname = `{${uri}}${local}`;
					}
					if (seen.has(eqname)) this.fail(`duplicate attribute: ${eqname}.`);
					seen.add(eqname);
					attr.uri = uri;
					attributes[name] = attr;
				}
				this.attribList = [];
			}
			processAttribsPlain() {
				const { attribList } = this;
				const attributes = this.tag.attributes;
				for (const { name, value } of attribList) {
					if (attributes[name] !== void 0) this.fail(`duplicate attribute: ${name}.`);
					attributes[name] = value;
				}
				this.attribList = [];
			}
			/**
			* Handle a complete open tag. This parser code calls this once it has seen
			* the whole tag. This method checks for well-formeness and then emits
			* ``onopentag``.
			*/
			openTag() {
				var _a;
				this.processAttribs();
				const { tags } = this;
				const tag = this.tag;
				tag.isSelfClosing = false;
				(_a = this.openTagHandler) === null || _a === void 0 || _a.call(this, tag);
				tags.push(tag);
				this.state = S_TEXT;
				this.name = "";
			}
			/**
			* Handle a complete self-closing tag. This parser code calls this once it has
			* seen the whole tag. This method checks for well-formeness and then emits
			* ``onopentag`` and ``onclosetag``.
			*/
			openSelfClosingTag() {
				var _a, _b, _c;
				this.processAttribs();
				const { tags } = this;
				const tag = this.tag;
				tag.isSelfClosing = true;
				(_a = this.openTagHandler) === null || _a === void 0 || _a.call(this, tag);
				(_b = this.closeTagHandler) === null || _b === void 0 || _b.call(this, tag);
				if ((this.tag = (_c = tags[tags.length - 1]) !== null && _c !== void 0 ? _c : null) === null) this.closedRoot = true;
				this.state = S_TEXT;
				this.name = "";
			}
			/**
			* Handle a complete close tag. This parser code calls this once it has seen
			* the whole tag. This method checks for well-formeness and then emits
			* ``onclosetag``.
			*/
			closeTag() {
				const { tags, name } = this;
				this.state = S_TEXT;
				this.name = "";
				if (name === "") {
					this.fail("weird empty close tag.");
					this.text += "</>";
					return;
				}
				const handler = this.closeTagHandler;
				let l = tags.length;
				while (l-- > 0) {
					const tag = this.tag = tags.pop();
					this.topNS = tag.ns;
					handler === null || handler === void 0 || handler(tag);
					if (tag.name === name) break;
					this.fail("unexpected close tag.");
				}
				if (l === 0) this.closedRoot = true;
				else if (l < 0) {
					this.fail(`unmatched closing tag: ${name}.`);
					this.text += `</${name}>`;
				}
			}
			/**
			* Resolves an entity. Makes any necessary well-formedness checks.
			*
			* @param entity The entity to resolve.
			*
			* @returns The parsed entity.
			*/
			parseEntity(entity) {
				if (entity[0] !== "#") {
					const defined = this.ENTITIES[entity];
					if (defined !== void 0) return defined;
					this.fail(this.isName(entity) ? "undefined entity." : "disallowed character in entity name.");
					return `&${entity};`;
				}
				let num = NaN;
				if (entity[1] === "x" && /^#x[0-9a-f]+$/i.test(entity)) num = parseInt(entity.slice(2), 16);
				else if (/^#[0-9]+$/.test(entity)) num = parseInt(entity.slice(1), 10);
				if (!this.isChar(num)) {
					this.fail("malformed character entity.");
					return `&${entity};`;
				}
				return String.fromCodePoint(num);
			}
		};
		exports.SaxesParser = SaxesParser;
	})))();
	//! Fixed CSS named colors. System colors and currentColor depend on the host.
	new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(" "));
	//! Pure immutable SVG document tree and bounded named paint edits.
	//! Parsing, reference validation and serialization remain separate owners.
	//! Validation for the explicitly supported local SVG reference syntax.
	//! Parse SVG into the immutable document tree. Unsupported document features
	//! are rejected explicitly; this module does not fetch external resources.
	//! Deterministic XML serialization for the parsed SVG document tree.
	//! Realize validated SVG documents through the existing Vector tree.
	//! Trusted host-prepared native surface. Public source-module preparation and
	//! host admission remain separate from this low-level rendering primitive.
	// packages/superimg-stdlib/dist/draw.js
	/**
	* SVG stroke drawing (line reveal) animation.
	*
	* Returns stroke-dasharray and stroke-dashoffset values
	* for animating an SVG path being "drawn" from start to end.
	*
	* @example
	* ```ts
	* const d = "M10,80 Q95,10 180,80";
	* const draw = std.svg.draw(d, timeline.progress);
	* return `<path d="${d}" fill="none" stroke="white" stroke-width="3"
	*           stroke-dasharray="${draw.strokeDasharray}"
	*           stroke-dashoffset="${draw.strokeDashoffset}" />`;
	* ```
	*/
	const EASING_MAP$2 = easing_exports$1;
	function draw(d, progress, opts) {
		const { totalLength } = normalizePath(d);
		const start = opts?.start ?? 0;
		const end = opts?.end ?? 1;
		let t;
		if (start >= end) t = progress >= start ? 1 : 0;
		else {
			t = (progress - start) / (end - start);
			t = clamp01$1(t);
		}
		const easingOpt = opts?.easing;
		if (easingOpt) {
			const fn = typeof easingOpt === "function" ? easingOpt : EASING_MAP$2[easingOpt];
			if (fn) t = fn(t);
		}
		const offset = totalLength * (1 - t);
		return {
			strokeDasharray: `${Math.round(totalLength * 1e3) / 1e3}`,
			strokeDashoffset: `${Math.round(offset * 1e3) / 1e3}`
		};
	}
	/**
	* Draw multiple paths with lag_ratio-style stagger (shared reveal contract).
	*/
	function drawMany(paths, progress, opts) {
		const n = paths.length;
		if (n === 0) return [];
		const lag = opts?.lag ?? .15;
		const start = opts?.start ?? 0;
		const end = opts?.end ?? 1;
		let global = progress;
		if (start < end) global = clamp01$1((progress - start) / (end - start));
		else global = progress >= start ? 1 : 0;
		return paths.map((d, i) => {
			let local;
			if (n === 1 || lag <= 0) local = global;
			else {
				const fullLength = (n - 1) * lag + 1;
				local = clamp01$1(global * fullLength - i * lag);
			}
			return draw(d, local, { easing: opts?.easing });
		});
	}
	// packages/superimg-stdlib/dist/mix.js
	var t = function(t, r, a) {
		return void 0 === r && (r = 0), void 0 === a && (a = 1), t > a ? a : t > r ? t : r;
	};
	var r = function(t) {
		var r = t / 255;
		return r < .04045 ? r / 12.92 : Math.pow((r + .055) / 1.055, 2.4);
	};
	var a = function(t) {
		return 255 * (t > .0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - .055 : 12.92 * t);
	};
	var n = 96.422;
	var o = 100;
	var u = 82.521;
	var e = function(r) {
		var n, o, u = {
			x: .9555766 * (n = r).x + -.0230393 * n.y + .0631636 * n.z,
			y: -.0282895 * n.x + 1.0099416 * n.y + .0210077 * n.z,
			z: .0122982 * n.x + -.020483 * n.y + 1.3299098 * n.z
		};
		return o = {
			r: a(.032404542 * u.x - .015371385 * u.y - .004985314 * u.z),
			g: a(-.00969266 * u.x + .018760108 * u.y + 41556e-8 * u.z),
			b: a(556434e-9 * u.x - .002040259 * u.y + .010572252 * u.z),
			a: r.a
		}, {
			r: t(o.r, 0, 255),
			g: t(o.g, 0, 255),
			b: t(o.b, 0, 255),
			a: t(o.a)
		};
	};
	var i = function(a) {
		var e = r(a.r), i = r(a.g), f = r(a.b);
		return function(r) {
			return {
				x: t(r.x, 0, n),
				y: t(r.y, 0, o),
				z: t(r.z, 0, u),
				a: t(r.a)
			};
		}(function(t) {
			return {
				x: 1.0478112 * t.x + .0228866 * t.y + -.050127 * t.z,
				y: .0295424 * t.x + .9904844 * t.y + -.0170491 * t.z,
				z: -.0092345 * t.x + .0150436 * t.y + .7521316 * t.z,
				a: t.a
			};
		}({
			x: 100 * (.4124564 * e + .3575761 * i + .1804375 * f),
			y: 100 * (.2126729 * e + .7151522 * i + .072175 * f),
			z: 100 * (.0193339 * e + .119192 * i + .9503041 * f),
			a: a.a
		}));
	};
	var f = 216 / 24389;
	var p = 24389 / 27;
	var h = function(t) {
		var r = i(t), a = r.x / n, e = r.y / o, h = r.z / u;
		return a = a > f ? Math.cbrt(a) : (p * a + 16) / 116, {
			l: 116 * (e = e > f ? Math.cbrt(e) : (p * e + 16) / 116) - 16,
			a: 500 * (a - e),
			b: 200 * (e - (h = h > f ? Math.cbrt(h) : (p * h + 16) / 116)),
			alpha: r.a
		};
	};
	var c = function(r, a, i, c) {
		var b = function(t, r) {
			return t + (r - t) * i;
		};
		if ("rgb" === c) return {
			r: b(r.r, a.r),
			g: b(r.g, a.g),
			b: b(r.b, a.b),
			a: b(r.a, a.a)
		};
		var y, x = h(r), l = h(a);
		return function(t) {
			var r = (t.l + 16) / 116, a = t.a / 500 + r, i = r - t.b / 200;
			return e({
				x: (Math.pow(a, 3) > f ? Math.pow(a, 3) : (116 * a - 16) / p) * n,
				y: (t.l > 8 ? Math.pow((t.l + 16) / 116, 3) : t.l / p) * o,
				z: (Math.pow(i, 3) > f ? Math.pow(i, 3) : (116 * i - 16) / p) * u,
				a: t.alpha
			});
		}((y = {
			l: b(x.l, l.l),
			a: b(x.a, l.a),
			b: b(x.b, l.b),
			alpha: b(x.alpha, l.alpha)
		}, {
			l: t(y.l, 0, 400),
			a: y.a,
			b: y.b,
			alpha: t(y.alpha)
		}));
	};
	var b = function(t) {
		function r(t, r, a, n) {
			void 0 === a && (a = 5);
			for (var o = [], u = 1 / (a - 1), e = 0; e <= a - 1; e++) o.push(t.mix(r, u * e, n));
			return o;
		}
		t.prototype.mix = function(r, a, n) {
			void 0 === a && (a = .5);
			var o = r instanceof t ? r : new t(r);
			return new t(c(this.toRgb(), o.toRgb(), a, n));
		}, t.prototype.tints = function(t, a) {
			return r(this, "#fff", t, a);
		}, t.prototype.shades = function(t, a) {
			return r(this, "#000", t, a);
		}, t.prototype.tones = function(t, a) {
			return r(this, "#808080", t, a);
		};
	};
	// packages/superimg-stdlib/dist/gradient.js
	function formatStop(stop) {
		const offset = typeof stop.offset === "number" ? `${Math.round(stop.offset * 1e3) / 10}%` : stop.offset;
		return `${C(stop.color).toRgbString()} ${offset}`;
	}
	/** CSS `linear-gradient(...)` background value. */
	function linearGradient(stops, opts = {}) {
		return `linear-gradient(${opts.angle ?? 180}deg, ${stops.map(formatStop).join(", ")})`;
	}
	/** CSS `radial-gradient(...)` background value. */
	function radialGradient(stops, opts = {}) {
		const cx = opts.cx ?? "50%";
		const cy = opts.cy ?? "50%";
		opts.r;
		return `radial-gradient(circle at ${cx} ${cy}, ${stops.map(formatStop).join(", ")})`;
	}
	/** Interpolate between two stop lists for animated gradient morphs. */
	function animateGradientStops(stopsA, stopsB, progress) {
		const n = Math.max(stopsA.length, stopsB.length);
		const result = [];
		for (let i = 0; i < n; i++) {
			const a = stopsA[Math.min(i, stopsA.length - 1)];
			const b = stopsB[Math.min(i, stopsB.length - 1)];
			const offA = typeof a.offset === "number" ? a.offset : parseFloat(a.offset) / 100;
			const offset = offA + ((typeof b.offset === "number" ? b.offset : parseFloat(b.offset) / 100) - offA) * progress;
			const ca = C(a.color);
			const cb = C(b.color);
			result.push({
				offset,
				color: ca.mix(cb, progress).toHex()
			});
		}
		return result;
	}
	// packages/superimg-stdlib/dist/gradient2.js
	const COLOR_PRESETS = {
		cinematic: "1.1 0.1 -0.1 0 0.02  -0.05 1.05 0.05 0 0  -0.1 0.05 1.2 0 0.05  0 0 0 1 0",
		sepia: "0.393 0.769 0.189 0 0  0.349 0.686 0.168 0 0  0.272 0.534 0.131 0 0  0 0 0 1 0",
		noir: "0.5 0.5 0.5 0 -0.1  0.5 0.5 0.5 0 -0.1  0.5 0.5 0.5 0 -0.1  0 0 0 1 0",
		desaturate: "0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
	};
	/** Simple djb2 hash for deterministic IDs */
	function djb2(str) {
		let hash = 5381;
		for (let i = 0; i < str.length; i++) hash = (hash << 5) + hash + str.charCodeAt(i) | 0;
		return "f" + Math.abs(hash).toString(36);
	}
	function buildEffect(effect, idx) {
		const inName = idx === 0 ? "SourceGraphic" : `e${idx - 1}`;
		const outName = `e${idx}`;
		switch (effect.type) {
			case "blur": return `<feGaussianBlur in="${inName}" stdDeviation="${effect.radius}" result="${outName}"/>`;
			case "grain": {
				const freq = effect.frequency ?? .65;
				const oct = effect.octaves ?? 3;
				const seed = effect.seed ?? 0;
				const opacity = effect.opacity ?? .3;
				return [
					`<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" result="${outName}_noise"/>`,
					`<feColorMatrix in="${outName}_noise" type="saturate" values="0" result="${outName}_gray"/>`,
					`<feBlend in="${inName}" in2="${outName}_gray" mode="multiply" result="${outName}_blend"/>`,
					`<feComponentTransfer in="${outName}_blend" result="${outName}">`,
					`  <feFuncA type="linear" slope="${opacity}" intercept="${1 - opacity}"/>`,
					`</feComponentTransfer>`
				].join("\n    ");
			}
			case "colorMatrix": return `<feColorMatrix in="${inName}" type="matrix" values="${effect.values ? effect.values.join(" ") : COLOR_PRESETS[effect.preset ?? "cinematic"] ?? COLOR_PRESETS.cinematic}" result="${outName}"/>`;
			case "glow": {
				const color = effect.color ?? "white";
				const opacity = effect.opacity ?? .6;
				return [
					`<feGaussianBlur in="${inName}" stdDeviation="${effect.radius}" result="${outName}_blur"/>`,
					`<feFlood flood-color="${color}" flood-opacity="${opacity}" result="${outName}_color"/>`,
					`<feComposite in="${outName}_color" in2="${outName}_blur" operator="in" result="${outName}_glow"/>`,
					`<feMerge result="${outName}">`,
					`  <feMergeNode in="${outName}_glow"/>`,
					`  <feMergeNode in="${inName}"/>`,
					`</feMerge>`
				].join("\n    ");
			}
			case "displace": return [`<feTurbulence type="turbulence" baseFrequency="${effect.frequency ?? .05}" numOctaves="2" seed="${effect.seed ?? 0}" result="${outName}_turb"/>`, `<feDisplacementMap in="${inName}" in2="${outName}_turb" scale="${effect.scale}" xChannelSelector="R" yChannelSelector="G" result="${outName}"/>`].join("\n    ");
		}
	}
	function filter(effects) {
		const id = djb2(JSON.stringify(effects));
		effects.length > 0 && effects.length - 1;
		return {
			id,
			svg: `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">\n${effects.map((e, i) => `    ${buildEffect(e, i)}`).join("\n")}\n  </filter>`,
			css: `url(#${id})`
		};
	}
	/**
	* SVG path morphing — interpolate between two path d strings.
	*
	* Both paths must normalize to the same number and type of segments.
	* Use std.svg.shape generators for guaranteed-compatible shapes.
	*
	* @example
	* ```ts
	* const a = std.svg.shape.polygon(100, 100, 80, 10);
	* const b = std.svg.shape.star(100, 100, 80, 35, 5);
	* const d = std.svg.morph(a, b, timeline.progress);
	* // arc path (Manim path_along_arc feel):
	* const d2 = std.svg.morph(a, b, p, { arc: Math.PI / 2 });
	* ```
	*/
	const pairCache = /* @__PURE__ */ new Map();
	function getMorphPair(pathA, pathB) {
		const key = pathA + "|" + pathB;
		const cached = pairCache.get(key);
		if (cached) return cached;
		const npA = normalizePath(pathA);
		const npB = normalizePath(pathB);
		const segA = npA.rawSegments;
		const segB = npB.rawSegments;
		if (segA.length !== segB.length) throw new Error(`svg.morph: paths must have the same number of segments after normalization. Path A has ${segA.length} segments, path B has ${segB.length}. Use std.svg.shape generators for compatible shapes.`);
		for (let i = 0; i < segA.length; i++) {
			const a = segA[i];
			const b = segB[i];
			if (!a || !b) continue;
			if (a.key !== b.key) throw new Error(`svg.morph: segment ${i} type mismatch — path A has "${a.key}", path B has "${b.key}".`);
			if (a.data.length !== b.data.length) throw new Error(`svg.morph: segment ${i} data length mismatch — path A has ${a.data.length} values, path B has ${b.data.length}.`);
		}
		const pair = {
			segA,
			segB
		};
		pairCache.set(key, pair);
		return pair;
	}
	/**
	* Interpolate path coordinates. With `arc`, midpoints swing off the chord
	* for more organic morph motion.
	*/
	function morph(pathA, pathB, progress, opts = {}) {
		const t = Math.max(0, Math.min(1, progress));
		const { segA, segB } = getMorphPair(pathA, pathB);
		const arc = opts.arc ?? 0;
		const bow = arc !== 0 ? Math.sin(t * Math.PI) : 0;
		const cosA = arc !== 0 ? Math.cos(arc) : 1;
		const sinA = arc !== 0 ? Math.sin(arc) : 0;
		return serializePath(segA.map((sa, i) => {
			const sb = segB[i];
			return {
				key: sa.key,
				data: sa.data.map((val, j) => {
					const target = sb.data[j] ?? val;
					const linear = val + (target - val) * t;
					if (bow === 0) return linear;
					const dx = target - val;
					if (j % 2 === 0 && j + 1 < sa.data.length) {
						const dy = (sb.data[j + 1] ?? sa.data[j + 1] ?? 0) - (sa.data[j + 1] ?? 0);
						return linear + (dx * cosA - dy * sinA) * bow * .35;
					}
					if (j % 2 === 1) {
						const dxPrev = (sb.data[j - 1] ?? sa.data[j - 1] ?? 0) - (sa.data[j - 1] ?? 0);
						const dy = dx;
						return linear + (dxPrev * sinA + dy * cosA) * bow * .35;
					}
					return linear;
				})
			};
		}));
	}
	/**
	* Position lerp with arc path (for element centers, not path d strings).
	* Returns { x, y } along an arc from a→b.
	*/
	function arcPoint(from, to, progress, arcRadians = Math.PI / 2) {
		const t = Math.max(0, Math.min(1, progress));
		const mx = from.x + (to.x - from.x) * t;
		const my = from.y + (to.y - from.y) * t;
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const bow = Math.sin(t * Math.PI);
		const len = Math.hypot(dx, dy) || 1;
		const px = -dy / len;
		const py = dx / len;
		const mag = arcRadians / (Math.PI / 2) * (len * .35) * bow;
		return {
			x: mx + px * mag,
			y: my + py * mag
		};
	}
	/**
	* SVG shape generators — return path d strings.
	* Designed for compatibility with morph().
	*/
	const { PI, cos, sin, round } = Math;
	const TAU = PI * 2;
	function r3(n) {
		return round(n * 1e3) / 1e3;
	}
	/** Circle as SVG path (4 cubic bezier arcs) */
	function circle(cx, cy, r) {
		const k = r * .5522847498;
		return [
			`M${r3(cx)},${r3(cy - r)}`,
			`C${r3(cx + k)},${r3(cy - r)} ${r3(cx + r)},${r3(cy - k)} ${r3(cx + r)},${r3(cy)}`,
			`C${r3(cx + r)},${r3(cy + k)} ${r3(cx + k)},${r3(cy + r)} ${r3(cx)},${r3(cy + r)}`,
			`C${r3(cx - k)},${r3(cy + r)} ${r3(cx - r)},${r3(cy + k)} ${r3(cx - r)},${r3(cy)}`,
			`C${r3(cx - r)},${r3(cy - k)} ${r3(cx - k)},${r3(cy - r)} ${r3(cx)},${r3(cy - r)}`,
			"Z"
		].join(" ");
	}
	/** Star shape with alternating inner/outer vertices */
	function star(cx, cy, outerR, innerR, points) {
		const verts = [];
		const total = points * 2;
		for (let i = 0; i < total; i++) {
			const angle = i / total * TAU - PI / 2;
			const r = i % 2 === 0 ? outerR : innerR;
			const x = cx + cos(angle) * r;
			const y = cy + sin(angle) * r;
			verts.push(`${i === 0 ? "M" : "L"}${r3(x)},${r3(y)}`);
		}
		verts.push("Z");
		return verts.join(" ");
	}
	/** Regular polygon */
	function polygon(cx, cy, r, sides) {
		const verts = [];
		for (let i = 0; i < sides; i++) {
			const angle = i / sides * TAU - PI / 2;
			const x = cx + cos(angle) * r;
			const y = cy + sin(angle) * r;
			verts.push(`${i === 0 ? "M" : "L"}${r3(x)},${r3(y)}`);
		}
		verts.push("Z");
		return verts.join(" ");
	}
	/** Sine wave path */
	function wave(width, height, amplitude, frequency, phase = 0) {
		const cy = height / 2;
		const steps = Math.max(Math.ceil(frequency * 20), 40);
		const parts = [];
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const x = t * width;
			const y = cy + sin(t * TAU * frequency + phase) * amplitude;
			parts.push(`${i === 0 ? "M" : "L"}${r3(x)},${r3(y)}`);
		}
		return parts.join(" ");
	}
	/** Circular arc segment */
	function arc(cx, cy, r, startAngle, endAngle) {
		const startRad = startAngle * PI / 180;
		const endRad = endAngle * PI / 180;
		const x1 = cx + cos(startRad) * r;
		const y1 = cy + sin(startRad) * r;
		const x2 = cx + cos(endRad) * r;
		const y2 = cy + sin(endRad) * r;
		let sweep = endAngle - startAngle;
		if (sweep < 0) sweep += 360;
		const largeArc = sweep > 180 ? 1 : 0;
		return `M${r3(x1)},${r3(y1)} A${r3(r)},${r3(r)} 0 ${largeArc} 1 ${r3(x2)},${r3(y2)}`;
	}
	/** Rounded rectangle */
	function roundedRect(x, y, w, h, r) {
		r = Math.min(r, w / 2, h / 2);
		return [
			`M${r3(x + r)},${r3(y)}`,
			`L${r3(x + w - r)},${r3(y)}`,
			`Q${r3(x + w)},${r3(y)} ${r3(x + w)},${r3(y + r)}`,
			`L${r3(x + w)},${r3(y + h - r)}`,
			`Q${r3(x + w)},${r3(y + h)} ${r3(x + w - r)},${r3(y + h)}`,
			`L${r3(x + r)},${r3(y + h)}`,
			`Q${r3(x)},${r3(y + h)} ${r3(x)},${r3(y + h - r)}`,
			`L${r3(x)},${r3(y + r)}`,
			`Q${r3(x)},${r3(y)} ${r3(x + r)},${r3(y)}`,
			"Z"
		].join(" ");
	}
	const shape = {
		circle,
		star,
		polygon,
		wave,
		arc,
		roundedRect
	};
	/** Simple hash for auto-generating path IDs */
	function hashId(s) {
		let h = 5381;
		for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) | 0;
		return "tp" + Math.abs(h).toString(36);
	}
	function textPath(text, pathD, opts) {
		const id = opts?.id ?? hashId(pathD);
		const offset = opts?.offset ?? 0;
		const fontSize = opts?.fontSize ?? 48;
		const fill = opts?.fill ?? "white";
		const fontFamily = opts?.fontFamily ?? "inherit";
		const fontWeight = opts?.fontWeight ?? "normal";
		const letterSpacing = opts?.letterSpacing ?? "normal";
		return [
			`<defs><path id="${id}" d="${pathD}" fill="none"/></defs>`,
			`<text font-size="${fontSize}" fill="${fill}" font-family="${fontFamily}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}">`,
			`  <textPath href="#${id}" startOffset="${Math.round(offset * 100) / 100}%">${text}</textPath>`,
			`</text>`
		].join("\n");
	}
	var gradient_exports = /* @__PURE__ */ __exportAll({
		animate: () => animate,
		linear: () => linear,
		radial: () => radial
	});
	F([b]);
	function stableId(prefix, value) {
		const input = JSON.stringify(value);
		let hash = 5381;
		for (let i = 0; i < input.length; i++) hash = (hash << 5) + hash + input.charCodeAt(i) | 0;
		return `grad-${prefix}-${Math.abs(hash).toString(36)}`;
	}
	function stopEls(stops) {
		return stops.map((s) => {
			return `<stop offset="${typeof s.offset === "number" ? `${Math.round(s.offset * 1e3) / 10}%` : s.offset}" stop-color="${C(s.color).toRgbString()}"/>`;
		}).join("");
	}
	function angleToCoords(angle) {
		const rad = (angle - 90) * Math.PI / 180;
		return {
			x1: `${50 - Math.cos(rad) * 50}%`,
			y1: `${50 - Math.sin(rad) * 50}%`,
			x2: `${50 + Math.cos(rad) * 50}%`,
			y2: `${50 + Math.sin(rad) * 50}%`
		};
	}
	function linear(stops, opts = {}) {
		const id = opts.id ?? stableId("lin", {
			stops,
			opts
		});
		const coords = opts.angle != null ? angleToCoords(opts.angle) : {
			x1: "0%",
			y1: "0%",
			x2: "0%",
			y2: "100%"
		};
		return {
			id,
			defs: `<linearGradient id="${id}" x1="${opts.x1 ?? coords.x1}" y1="${opts.y1 ?? coords.y1}" x2="${opts.x2 ?? coords.x2}" y2="${opts.y2 ?? coords.y2}">${stopEls(stops)}</linearGradient>`,
			fill: `url(#${id})`
		};
	}
	function radial(stops, opts = {}) {
		const id = opts.id ?? stableId("rad", {
			stops,
			opts
		});
		return {
			id,
			defs: `<radialGradient id="${id}" cx="${opts.cx ?? "50%"}" cy="${opts.cy ?? "50%"}" r="${opts.r ?? "50%"}">${stopEls(stops)}</radialGradient>`,
			fill: `url(#${id})`
		};
	}
	function animate(stopsA, stopsB, progress, kind = "linear", opts) {
		const morphed = animateGradientStops(stopsA, stopsB, progress);
		const id = opts?.id ?? stableId(kind === "radial" ? "rad" : "lin", {
			stopsA,
			stopsB,
			kind,
			opts
		});
		return kind === "radial" ? radial(morphed, {
			...opts,
			id
		}) : linear(morphed, {
			...opts,
			id
		});
	}
	// packages/superimg-stdlib/dist/svg/woff.js
	//! Pure-TypeScript WOFF1 (`wOFF`, 0x774F4646) to SFNT unpacker and RFC 1950/1951
	//! zlib/DEFLATE decompressor. Keeps `@superimg/stdlib` runtime-neutral (no `node:zlib`).
	const WOFF1_MAGIC = 2001684038;
	function isWoff1(bytes) {
		if (bytes.byteLength < 44) return false;
		return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false) === WOFF1_MAGIC;
	}
	const FIXED_LIT_LENGTHS = (() => {
		const lengths = /* @__PURE__ */ new Uint8Array(288);
		lengths.fill(8, 0, 144);
		lengths.fill(9, 144, 256);
		lengths.fill(7, 256, 280);
		lengths.fill(8, 280, 288);
		return lengths;
	})();
	const FIXED_DIST_LENGTHS = (() => {
		const lengths = /* @__PURE__ */ new Uint8Array(32);
		lengths.fill(5);
		return lengths;
	})();
	const CL_ORDER = [
		16,
		17,
		18,
		0,
		8,
		7,
		9,
		6,
		10,
		5,
		11,
		4,
		12,
		3,
		13,
		2,
		14,
		1,
		15
	];
	const LENGTH_BASE = [
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		13,
		15,
		17,
		19,
		23,
		27,
		31,
		35,
		43,
		51,
		59,
		67,
		83,
		99,
		115,
		131,
		163,
		195,
		227,
		258
	];
	const LENGTH_EXTRA = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		2,
		2,
		2,
		2,
		3,
		3,
		3,
		3,
		4,
		4,
		4,
		4,
		5,
		5,
		5,
		5,
		0
	];
	const DIST_BASE = [
		1,
		2,
		3,
		4,
		5,
		7,
		9,
		13,
		17,
		25,
		33,
		49,
		65,
		97,
		129,
		193,
		257,
		385,
		513,
		769,
		1025,
		1537,
		2049,
		3073,
		4097,
		6145,
		8193,
		12289,
		16385,
		24577
	];
	const DIST_EXTRA = [
		0,
		0,
		0,
		0,
		1,
		1,
		2,
		2,
		3,
		3,
		4,
		4,
		5,
		5,
		6,
		6,
		7,
		7,
		8,
		8,
		9,
		9,
		10,
		10,
		11,
		11,
		12,
		12,
		13,
		13
	];
	function buildHuffman(lengths) {
		let maxBits = 0;
		for (let i = 0; i < lengths.length; i++) if (lengths[i] > maxBits) maxBits = lengths[i];
		if (maxBits === 0) return {
			maxBits: 0,
			map: /* @__PURE__ */ new Map()
		};
		const blCount = new Uint16Array(maxBits + 1);
		for (let i = 0; i < lengths.length; i++) {
			const len = lengths[i];
			if (len > 0) blCount[len]++;
		}
		const nextCode = new Uint32Array(maxBits + 1);
		let code = 0;
		for (let bits = 1; bits <= maxBits; bits++) {
			code = code + blCount[bits - 1] << 1;
			nextCode[bits] = code;
		}
		const map = /* @__PURE__ */ new Map();
		for (let symbol = 0; symbol < lengths.length; symbol++) {
			const len = lengths[symbol];
			if (len !== 0) {
				const c = nextCode[len];
				nextCode[len] = c + 1;
				map.set(len << 16 | c, symbol);
			}
		}
		return {
			maxBits,
			map
		};
	}
	const FIXED_LIT_TABLE = buildHuffman(FIXED_LIT_LENGTHS);
	const FIXED_DIST_TABLE = buildHuffman(FIXED_DIST_LENGTHS);
	/**
	* Inflate a zlib-wrapped (RFC 1950) or raw DEFLATE (RFC 1951) byte stream.
	*/
	function inflateZlibOrDeflate(input, expectedLength) {
		if (input.byteLength < 2) return void 0;
		let pos = 0;
		const cmf = input[0];
		const flg = input[1];
		if ((cmf & 15) === 8 && cmf >>> 4 <= 7 && ((cmf << 8) + flg) % 31 === 0) {
			pos = 2;
			if ((flg & 32) !== 0) {
				if (input.byteLength < 6) return void 0;
				pos = 6;
			}
		}
		let bitPos = pos * 8;
		const totalBits = input.byteLength * 8;
		const readBits = (n) => {
			if (n === 0) return 0;
			if (bitPos + n > totalBits) throw new RangeError("Unexpected EOF in DEFLATE stream");
			let val = 0;
			for (let i = 0; i < n; i++) {
				const byteIdx = bitPos >>> 3;
				const bitIdx = bitPos & 7;
				val |= (input[byteIdx] >>> bitIdx & 1) << i;
				bitPos++;
			}
			return val;
		};
		const decodeSymbol = (table) => {
			let code = 0;
			for (let len = 1; len <= table.maxBits; len++) {
				if (bitPos >= totalBits) throw new RangeError("Unexpected EOF in Huffman code");
				const byteIdx = bitPos >>> 3;
				const bitIdx = bitPos & 7;
				code = (code << 1 | input[byteIdx] >>> bitIdx & 1) >>> 0;
				bitPos++;
				const sym = table.map.get(len << 16 | code);
				if (sym !== void 0) return sym;
			}
			throw new Error("Invalid Huffman code");
		};
		let out = new Uint8Array(expectedLength && expectedLength > 0 ? expectedLength : Math.max(256, input.byteLength * 3));
		let outLen = 0;
		const ensureCapacity = (extra) => {
			if (outLen + extra <= out.length) return;
			let nextCap = Math.max(out.length * 2, outLen + extra);
			const next = new Uint8Array(nextCap);
			next.set(out.subarray(0, outLen));
			out = next;
		};
		try {
			let bfinal = 0;
			while (bfinal === 0) {
				bfinal = readBits(1);
				const btype = readBits(2);
				if (btype === 0) {
					bitPos = bitPos + 7 & -8;
					const byteIdx = bitPos >>> 3;
					if (byteIdx + 4 > input.byteLength) return void 0;
					const len = input[byteIdx] | input[byteIdx + 1] << 8;
					const nlen = input[byteIdx + 2] | input[byteIdx + 3] << 8;
					if ((len ^ 65535) !== nlen) return void 0;
					bitPos += 32;
					const dataStart = bitPos >>> 3;
					if (dataStart + len > input.byteLength) return void 0;
					ensureCapacity(len);
					out.set(input.subarray(dataStart, dataStart + len), outLen);
					outLen += len;
					bitPos += len * 8;
				} else if (btype === 1 || btype === 2) {
					let litTable = FIXED_LIT_TABLE;
					let distTable = FIXED_DIST_TABLE;
					if (btype === 2) {
						const hlit = readBits(5) + 257;
						const hdist = readBits(5) + 1;
						const hclen = readBits(4) + 4;
						const clLengths = /* @__PURE__ */ new Uint8Array(19);
						for (let i = 0; i < hclen; i++) clLengths[CL_ORDER[i]] = readBits(3);
						const clTable = buildHuffman(clLengths);
						const allLengths = new Uint8Array(hlit + hdist);
						let idx = 0;
						while (idx < hlit + hdist) {
							const sym = decodeSymbol(clTable);
							if (sym < 16) allLengths[idx++] = sym;
							else if (sym === 16) {
								if (idx === 0) return void 0;
								const prev = allLengths[idx - 1];
								const repeat = readBits(2) + 3;
								for (let r = 0; r < repeat && idx < allLengths.length; r++) allLengths[idx++] = prev;
							} else if (sym === 17) {
								const repeat = readBits(3) + 3;
								for (let r = 0; r < repeat && idx < allLengths.length; r++) allLengths[idx++] = 0;
							} else if (sym === 18) {
								const repeat = readBits(7) + 11;
								for (let r = 0; r < repeat && idx < allLengths.length; r++) allLengths[idx++] = 0;
							} else return;
						}
						litTable = buildHuffman(allLengths.subarray(0, hlit));
						distTable = buildHuffman(allLengths.subarray(hlit));
					}
					while (true) {
						const sym = decodeSymbol(litTable);
						if (sym === 256) break;
						if (sym < 256) {
							ensureCapacity(1);
							out[outLen++] = sym;
						} else {
							const lenIdx = sym - 257;
							if (lenIdx < 0 || lenIdx >= LENGTH_BASE.length) return void 0;
							const length = LENGTH_BASE[lenIdx] + readBits(LENGTH_EXTRA[lenIdx]);
							const distSym = decodeSymbol(distTable);
							if (distSym < 0 || distSym >= DIST_BASE.length) return void 0;
							const distance = DIST_BASE[distSym] + readBits(DIST_EXTRA[distSym]);
							if (distance > outLen) return void 0;
							ensureCapacity(length);
							for (let i = 0; i < length; i++) {
								out[outLen] = out[outLen - distance];
								outLen++;
							}
						}
					}
				} else return;
			}
		} catch {
			return;
		}
		if (expectedLength !== void 0 && outLen !== expectedLength) return void 0;
		return out.subarray(0, outLen);
	}
	/**
	* Unpack a WOFF 1.0 (`wOFF`) container into a standard SFNT (`.ttf` / `.otf`) byte buffer.
	*/
	function decodeWoff1ToSfnt(bytes) {
		if (!isWoff1(bytes)) return void 0;
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const flavor = view.getUint32(4, false);
		const numTables = view.getUint16(12, false);
		if (numTables === 0 || 44 + numTables * 20 > bytes.byteLength) return void 0;
		const entries = [];
		let sfntSize = 12 + numTables * 16;
		for (let i = 0; i < numTables; i++) {
			const base = 44 + i * 20;
			const tag = view.getUint32(base, false);
			const offset = view.getUint32(base + 4, false);
			const compLength = view.getUint32(base + 8, false);
			const origLength = view.getUint32(base + 12, false);
			const origChecksum = view.getUint32(base + 16, false);
			if (offset + compLength > bytes.byteLength || compLength > origLength) return;
			entries.push({
				tag,
				offset,
				compLength,
				origLength,
				origChecksum
			});
			sfntSize += origLength + 3 & -4;
		}
		const sfnt = new Uint8Array(sfntSize);
		const sfntView = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
		let maxPow2 = 1;
		let entrySelector = 0;
		while (maxPow2 * 2 <= numTables) {
			maxPow2 *= 2;
			entrySelector++;
		}
		const searchRange = maxPow2 * 16;
		const rangeShift = numTables * 16 - searchRange;
		sfntView.setUint32(0, flavor, false);
		sfntView.setUint16(4, numTables, false);
		sfntView.setUint16(6, searchRange, false);
		sfntView.setUint16(8, entrySelector, false);
		sfntView.setUint16(10, rangeShift, false);
		let writeOffset = 12 + numTables * 16;
		for (let i = 0; i < numTables; i++) {
			const entry = entries[i];
			const slice = bytes.subarray(entry.offset, entry.offset + entry.compLength);
			let tableBytes;
			if (entry.compLength === entry.origLength) tableBytes = slice;
			else {
				tableBytes = inflateZlibOrDeflate(slice, entry.origLength);
				if (!tableBytes || tableBytes.byteLength !== entry.origLength) return void 0;
			}
			const dirOffset = 12 + i * 16;
			sfntView.setUint32(dirOffset, entry.tag, false);
			sfntView.setUint32(dirOffset + 4, entry.origChecksum, false);
			sfntView.setUint32(dirOffset + 8, writeOffset, false);
			sfntView.setUint32(dirOffset + 12, entry.origLength, false);
			sfnt.set(tableBytes, writeOffset);
			writeOffset += entry.origLength + 3 & -4;
		}
		return sfnt;
	}
	// packages/superimg-stdlib/dist/svg.js
	//! Synchronous TTF/OTF/WOFF1 metrics. Glyph outlines are unused: advances come from
	//! hmtx, mapping from cmap, optional pair adjustments from kern format 0.
	const HEADER_SIZE = 12;
	const RECORD_SIZE = 16;
	function parseFontMetrics(rawBytes) {
		let bytes = rawBytes;
		if (isWoff1(rawBytes)) {
			const unpacked = decodeWoff1ToSfnt(rawBytes);
			if (!unpacked) throw new Error("Failed to unpack WOFF1 font container");
			bytes = unpacked;
		}
		if (bytes.byteLength < HEADER_SIZE) throw new Error("Font is too small to be SFNT");
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const scaler = view.getUint32(0);
		if (scaler !== 65536 && scaler !== 1330926671 && scaler !== 1953658213) throw new Error("Font is not a TrueType or CFF OpenType file");
		const tables = readTables(bytes, view);
		const head = required(tables, "head");
		const hhea = required(tables, "hhea");
		const hmtx = required(tables, "hmtx");
		const cmap = required(tables, "cmap");
		if (head.length < 20 || hhea.length < 36) throw new Error("Font head/hhea tables are truncated");
		const unitsPerEm = view.getUint16(head.offset + 18);
		if (unitsPerEm === 0) throw new Error("Font unitsPerEm is 0");
		const hheaAscent = view.getInt16(hhea.offset + 4);
		const hheaDescent = view.getInt16(hhea.offset + 6);
		const numberOfHMetrics = view.getUint16(hhea.offset + 34);
		if (numberOfHMetrics === 0) throw new Error("Font has no horizontal metrics");
		const typo = typoMetrics(view, tables.get("OS/2"));
		const ascent = typo?.ascent ?? hheaAscent;
		const descent = Math.abs(typo?.descent ?? hheaDescent);
		const glyphOf = readCmap(view, cmap);
		const advanceOf = glyphAdvance(view, hmtx, numberOfHMetrics);
		const pairs = readKern(view, tables.get("kern"));
		return {
			unitsPerEm,
			ascent,
			descent,
			advance(codePoint) {
				return advanceOf(glyphOf(codePoint) ?? 0);
			},
			kerning(left, right) {
				const a = glyphOf(left);
				const b = glyphOf(right);
				if (a === void 0 || b === void 0) return 0;
				return pairs.get(a << 16 | b) ?? 0;
			}
		};
	}
	function readTables(bytes, view) {
		const count = view.getUint16(4);
		const tables = /* @__PURE__ */ new Map();
		for (let index = 0; index < count; index++) {
			const record = HEADER_SIZE + index * RECORD_SIZE;
			if (record + RECORD_SIZE > bytes.byteLength) throw new Error("Font table directory is truncated");
			const tag = String.fromCharCode(bytes[record], bytes[record + 1], bytes[record + 2], bytes[record + 3]);
			const offset = view.getUint32(record + 8);
			const length = view.getUint32(record + 12);
			if (offset + length > bytes.byteLength) throw new Error(`Font table ${tag} is out of range`);
			tables.set(tag, {
				offset,
				length
			});
		}
		return tables;
	}
	function required(tables, tag) {
		const table = tables.get(tag);
		if (!table) throw new Error(`Font is missing the ${tag} table`);
		return table;
	}
	function typoMetrics(view, os2) {
		if (!os2 || os2.length < 72) return void 0;
		const ascent = view.getInt16(os2.offset + 68);
		const descent = view.getInt16(os2.offset + 70);
		if (ascent === 0 && descent === 0) return void 0;
		return {
			ascent,
			descent
		};
	}
	function glyphAdvance(view, hmtx, numberOfHMetrics) {
		const last = view.getUint16(hmtx.offset + (numberOfHMetrics - 1) * 4);
		return (glyphId) => {
			if (glyphId < numberOfHMetrics) return view.getUint16(hmtx.offset + glyphId * 4);
			return last;
		};
	}
	function readCmap(view, cmap) {
		if (cmap.length < 4) throw new Error("Font cmap is truncated");
		const start = cmap.offset;
		const count = view.getUint16(start + 2);
		const format4 = [];
		const format12 = [];
		for (let index = 0; index < count; index++) {
			const record = start + 4 + index * 8;
			if (record + 8 > start + cmap.length) throw new Error("Font cmap records are truncated");
			const platform = view.getUint16(record);
			const encoding = view.getUint16(record + 2);
			const offset = view.getUint32(record + 4);
			if (!(platform === 3 && (encoding === 1 || encoding === 10) || platform === 0)) continue;
			const sub = start + offset;
			if (sub + 2 > view.byteLength) continue;
			const format = view.getUint16(sub);
			const rank = platform === 3 ? 0 : 1;
			if (format === 12 && (encoding === 10 || platform === 0)) format12.push(parseCmap12(view, sub, rank));
			else if (format === 4 && (encoding === 1 || platform === 0)) format4.push(parseCmap4(view, sub, rank));
		}
		const usable = [...format12, ...format4].sort((left, right) => rankOf(left) - rankOf(right));
		return (codePoint) => {
			if (codePoint < 0) return void 0;
			for (const map of usable) {
				const glyph = map.glyphId(codePoint);
				if (glyph !== void 0 && glyph !== 0) return glyph;
			}
			for (const map of usable) {
				const glyph = map.glyphId(codePoint);
				if (glyph !== void 0) return glyph;
			}
		};
	}
	function rankOf(map) {
		return map.rank ?? 0;
	}
	function parseCmap4(view, offset, rank) {
		const length = view.getUint16(offset + 2);
		const segCount = view.getUint16(offset + 6) / 2;
		let cursor = offset + 14;
		const endCode = readU16s(view, cursor, segCount);
		cursor += segCount * 2 + 2;
		const startCode = readU16s(view, cursor, segCount);
		cursor += segCount * 2;
		const idDelta = readI16s(view, cursor, segCount);
		cursor += segCount * 2;
		const idRangeOffsetAt = cursor;
		const idRangeOffset = readU16s(view, cursor, segCount);
		const limit = offset + length;
		return {
			rank,
			glyphId(codePoint) {
				if (codePoint < 0 || codePoint > 65535) return void 0;
				let index = 0;
				while (index < segCount && (endCode[index] ?? 0) < codePoint) index++;
				if (index >= segCount) return void 0;
				const start = startCode[index] ?? 0;
				if (codePoint < start) return void 0;
				const delta = idDelta[index] ?? 0;
				const range = idRangeOffset[index] ?? 0;
				if (range === 0) return codePoint + delta & 65535;
				const glyphOffset = idRangeOffsetAt + index * 2 + range + (codePoint - start) * 2;
				if (glyphOffset + 2 > limit) return 0;
				const glyph = view.getUint16(glyphOffset);
				if (glyph === 0) return 0;
				return glyph + delta & 65535;
			}
		};
	}
	function parseCmap12(view, offset, rank) {
		const groups = view.getUint32(offset + 12);
		const records = [];
		let cursor = offset + 16;
		for (let index = 0; index < groups; index++) {
			records.push({
				start: view.getUint32(cursor),
				end: view.getUint32(cursor + 4),
				glyph: view.getUint32(cursor + 8)
			});
			cursor += 12;
		}
		return {
			rank,
			glyphId(codePoint) {
				if (codePoint < 0) return void 0;
				let lo = 0;
				let hi = records.length - 1;
				while (lo <= hi) {
					const mid = lo + hi >> 1;
					const group = records[mid];
					if (codePoint < group.start) hi = mid - 1;
					else if (codePoint > group.end) lo = mid + 1;
					else return group.glyph + (codePoint - group.start);
				}
			}
		};
	}
	function readKern(view, kern) {
		const pairs = /* @__PURE__ */ new Map();
		if (!kern || kern.length < 4) return pairs;
		if (view.getUint16(kern.offset) === 0) readMicrosoftKern(view, kern, pairs);
		else if (view.getUint32(kern.offset) === 65536) readAppleKern(view, kern, pairs);
		return pairs;
	}
	function readMicrosoftKern(view, kern, pairs) {
		const tables = view.getUint16(kern.offset + 2);
		let cursor = kern.offset + 4;
		const end = kern.offset + kern.length;
		for (let index = 0; index < tables && cursor + 6 <= end; index++) {
			const length = view.getUint16(cursor + 2);
			const coverage = view.getUint16(cursor + 4);
			const next = cursor + length;
			if (isFormat0Horizontal(coverage)) readKernPairs(view, cursor + 6, next, pairs);
			cursor = next;
		}
	}
	function readAppleKern(view, kern, pairs) {
		const tables = view.getUint32(kern.offset + 4);
		let cursor = kern.offset + 8;
		const end = kern.offset + kern.length;
		for (let index = 0; index < tables && cursor + 8 <= end; index++) {
			const length = view.getUint32(cursor);
			const coverage = view.getUint16(cursor + 4);
			const next = cursor + length;
			if (isFormat0Horizontal(coverage)) readKernPairs(view, cursor + 8, next, pairs);
			cursor = next;
		}
	}
	/** OpenType stores the subtable format in the high byte and horizontal in bit 0. */
	function isFormat0Horizontal(coverage) {
		return coverage >> 8 === 0 && ((coverage & 1) !== 0 || coverage === 0);
	}
	function readKernPairs(view, offset, end, pairs) {
		if (offset + 8 > end) return;
		const count = view.getUint16(offset);
		let cursor = offset + 8;
		for (let index = 0; index < count && cursor + 6 <= end; index++) {
			const left = view.getUint16(cursor);
			const right = view.getUint16(cursor + 2);
			pairs.set(left << 16 | right, view.getInt16(cursor + 4));
			cursor += 6;
		}
	}
	function readU16s(view, offset, count) {
		const values = [];
		for (let index = 0; index < count; index++) values.push(view.getUint16(offset + index * 2));
		return values;
	}
	function readI16s(view, offset, count) {
		const values = [];
		for (let index = 0; index < count; index++) values.push(view.getInt16(offset + index * 2));
		return values;
	}
	// packages/superimg-stdlib/dist/alea.js
	/**
	* Mash hash function for seeding
	*/
	function Mash() {
		let n = 4022871197;
		const mash = function(data) {
			data = data.toString();
			for (let i = 0; i < data.length; i++) {
				n += data.charCodeAt(i);
				let h = .02519603282416938 * n;
				n = h >>> 0;
				h -= n;
				h *= n;
				n = h >>> 0;
				h -= n;
				n += h * 4294967296;
			}
			return (n >>> 0) * 23283064365386963e-26;
		};
		mash.version = "Mash 0.9";
		return mash;
	}
	/**
	* Create a new Alea PRNG instance
	* @param args - Seed arguments (strings or numbers)
	* @returns PRNG function
	*/
	function Alea(...args) {
		let s0 = 0;
		let s1 = 0;
		let s2 = 0;
		let c = 1;
		if (args.length === 0) args = [+/* @__PURE__ */ new Date()];
		const mash = Mash();
		s0 = mash(" ");
		s1 = mash(" ");
		s2 = mash(" ");
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (arg === void 0) continue;
			s0 -= mash(arg);
			if (s0 < 0) s0 += 1;
			s1 -= mash(arg);
			if (s1 < 0) s1 += 1;
			s2 -= mash(arg);
			if (s2 < 0) s2 += 1;
		}
		const random = function() {
			const t = 2091639 * s0 + c * 23283064365386963e-26;
			s0 = s1;
			s1 = s2;
			return s2 = t - (c = t | 0);
		};
		random.next = random;
		random.uint32 = function() {
			return random() * 4294967296;
		};
		random.fract53 = function() {
			return random() + (random() * 2097152 | 0) * 11102230246251565e-32;
		};
		random.version = "Alea 0.9";
		random.args = args;
		random.exportState = function() {
			return [
				s0,
				s1,
				s2,
				c
			];
		};
		random.importState = function(state) {
			s0 = +state[0] || 0;
			s1 = +state[1] || 0;
			s2 = +state[2] || 0;
			c = +state[3] || 0;
		};
		return random;
	}
	const AleaFunction = Alea;
	AleaFunction.importState = function(state) {
		const random = Alea();
		random.importState(state);
		return random;
	};
	// packages/superimg-stdlib/dist/math2.js
	const SQRT3 = /*#__PURE__*/ Math.sqrt(3);
	const SQRT5 = /*#__PURE__*/ Math.sqrt(5);
	const F2 = .5 * (SQRT3 - 1);
	const G2 = (3 - SQRT3) / 6;
	const F3 = 1 / 3;
	const G3 = 1 / 6;
	(SQRT5 - 1) / 4;
	(5 - SQRT5) / 20;
	const fastFloor = (x) => Math.floor(x) | 0;
	const grad2 = /*#__PURE__*/ new Float64Array([
		1,
		1,
		-1,
		1,
		1,
		-1,
		-1,
		-1,
		1,
		0,
		-1,
		0,
		1,
		0,
		-1,
		0,
		0,
		1,
		0,
		-1,
		0,
		1,
		0,
		-1
	]);
	const grad3 = /*#__PURE__*/ new Float64Array([
		1,
		1,
		0,
		-1,
		1,
		0,
		1,
		-1,
		0,
		-1,
		-1,
		0,
		1,
		0,
		1,
		-1,
		0,
		1,
		1,
		0,
		-1,
		-1,
		0,
		-1,
		0,
		1,
		1,
		0,
		-1,
		1,
		0,
		1,
		-1,
		0,
		-1,
		-1
	]);
	/**
	* Creates a 2D noise function
	* @param random the random function that will be used to build the permutation table
	* @returns {NoiseFunction2D}
	*/
	function createNoise2D(random = Math.random) {
		const perm = buildPermutationTable(random);
		const permGrad2x = new Float64Array(perm).map((v) => grad2[v % 12 * 2]);
		const permGrad2y = new Float64Array(perm).map((v) => grad2[v % 12 * 2 + 1]);
		return function noise2D(x, y) {
			let n0 = 0;
			let n1 = 0;
			let n2 = 0;
			const s = (x + y) * F2;
			const i = fastFloor(x + s);
			const j = fastFloor(y + s);
			const t = (i + j) * G2;
			const X0 = i - t;
			const Y0 = j - t;
			const x0 = x - X0;
			const y0 = y - Y0;
			let i1, j1;
			if (x0 > y0) {
				i1 = 1;
				j1 = 0;
			} else {
				i1 = 0;
				j1 = 1;
			}
			const x1 = x0 - i1 + G2;
			const y1 = y0 - j1 + G2;
			const x2 = x0 - 1 + 2 * G2;
			const y2 = y0 - 1 + 2 * G2;
			const ii = i & 255;
			const jj = j & 255;
			let t0 = .5 - x0 * x0 - y0 * y0;
			if (t0 >= 0) {
				const gi0 = ii + perm[jj];
				const g0x = permGrad2x[gi0];
				const g0y = permGrad2y[gi0];
				t0 *= t0;
				n0 = t0 * t0 * (g0x * x0 + g0y * y0);
			}
			let t1 = .5 - x1 * x1 - y1 * y1;
			if (t1 >= 0) {
				const gi1 = ii + i1 + perm[jj + j1];
				const g1x = permGrad2x[gi1];
				const g1y = permGrad2y[gi1];
				t1 *= t1;
				n1 = t1 * t1 * (g1x * x1 + g1y * y1);
			}
			let t2 = .5 - x2 * x2 - y2 * y2;
			if (t2 >= 0) {
				const gi2 = ii + 1 + perm[jj + 1];
				const g2x = permGrad2x[gi2];
				const g2y = permGrad2y[gi2];
				t2 *= t2;
				n2 = t2 * t2 * (g2x * x2 + g2y * y2);
			}
			return 70 * (n0 + n1 + n2);
		};
	}
	/**
	* Creates a 3D noise function
	* @param random the random function that will be used to build the permutation table
	* @returns {NoiseFunction3D}
	*/
	function createNoise3D(random = Math.random) {
		const perm = buildPermutationTable(random);
		const permGrad3x = new Float64Array(perm).map((v) => grad3[v % 12 * 3]);
		const permGrad3y = new Float64Array(perm).map((v) => grad3[v % 12 * 3 + 1]);
		const permGrad3z = new Float64Array(perm).map((v) => grad3[v % 12 * 3 + 2]);
		return function noise3D(x, y, z) {
			let n0, n1, n2, n3;
			const s = (x + y + z) * F3;
			const i = fastFloor(x + s);
			const j = fastFloor(y + s);
			const k = fastFloor(z + s);
			const t = (i + j + k) * G3;
			const X0 = i - t;
			const Y0 = j - t;
			const Z0 = k - t;
			const x0 = x - X0;
			const y0 = y - Y0;
			const z0 = z - Z0;
			let i1, j1, k1;
			let i2, j2, k2;
			if (x0 >= y0) {
				if (y0 >= z0) {
					i1 = 1;
					j1 = 0;
					k1 = 0;
					i2 = 1;
					j2 = 1;
					k2 = 0;
				} else if (x0 >= z0) {
					i1 = 1;
					j1 = 0;
					k1 = 0;
					i2 = 1;
					j2 = 0;
					k2 = 1;
				} else {
					i1 = 0;
					j1 = 0;
					k1 = 1;
					i2 = 1;
					j2 = 0;
					k2 = 1;
				}
			} else if (y0 < z0) {
				i1 = 0;
				j1 = 0;
				k1 = 1;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else if (x0 < z0) {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 1;
				j2 = 1;
				k2 = 0;
			}
			const x1 = x0 - i1 + G3;
			const y1 = y0 - j1 + G3;
			const z1 = z0 - k1 + G3;
			const x2 = x0 - i2 + 2 * G3;
			const y2 = y0 - j2 + 2 * G3;
			const z2 = z0 - k2 + 2 * G3;
			const x3 = x0 - 1 + 3 * G3;
			const y3 = y0 - 1 + 3 * G3;
			const z3 = z0 - 1 + 3 * G3;
			const ii = i & 255;
			const jj = j & 255;
			const kk = k & 255;
			let t0 = .6 - x0 * x0 - y0 * y0 - z0 * z0;
			if (t0 < 0) n0 = 0;
			else {
				const gi0 = ii + perm[jj + perm[kk]];
				t0 *= t0;
				n0 = t0 * t0 * (permGrad3x[gi0] * x0 + permGrad3y[gi0] * y0 + permGrad3z[gi0] * z0);
			}
			let t1 = .6 - x1 * x1 - y1 * y1 - z1 * z1;
			if (t1 < 0) n1 = 0;
			else {
				const gi1 = ii + i1 + perm[jj + j1 + perm[kk + k1]];
				t1 *= t1;
				n1 = t1 * t1 * (permGrad3x[gi1] * x1 + permGrad3y[gi1] * y1 + permGrad3z[gi1] * z1);
			}
			let t2 = .6 - x2 * x2 - y2 * y2 - z2 * z2;
			if (t2 < 0) n2 = 0;
			else {
				const gi2 = ii + i2 + perm[jj + j2 + perm[kk + k2]];
				t2 *= t2;
				n2 = t2 * t2 * (permGrad3x[gi2] * x2 + permGrad3y[gi2] * y2 + permGrad3z[gi2] * z2);
			}
			let t3 = .6 - x3 * x3 - y3 * y3 - z3 * z3;
			if (t3 < 0) n3 = 0;
			else {
				const gi3 = ii + 1 + perm[jj + 1 + perm[kk + 1]];
				t3 *= t3;
				n3 = t3 * t3 * (permGrad3x[gi3] * x3 + permGrad3y[gi3] * y3 + permGrad3z[gi3] * z3);
			}
			return 32 * (n0 + n1 + n2 + n3);
		};
	}
	/**
	* Builds a random permutation table.
	* This is exported only for (internal) testing purposes.
	* Do not rely on this export.
	* @private
	*/
	function buildPermutationTable(random) {
		const tableSize = 512;
		const p = new Uint8Array(tableSize);
		for (let i = 0; i < tableSize / 2; i++) p[i] = i;
		for (let i = 0; i < tableSize / 2 - 1; i++) {
			const r = i + ~~(random() * (256 - i));
			const aux = p[i];
			p[i] = p[r];
			p[r] = aux;
		}
		for (let i = 256; i < tableSize; i++) p[i] = p[i - 256];
		return p;
	}
	/**
	* Math utilities for SuperImg templates
	*
	* Provides common mathematical functions for animations, transformations, and calculations.
	*/
	/**
	* Linear interpolation between two values.
	* @ai-hint t is NOT clamped — values outside [0,1] extrapolate. Clamp first if needed: `lerp(a, b, clamp(t, 0, 1))`.
	* @param a - Start value
	* @param b - End value
	* @param t - Interpolation factor (typically 0-1, but not clamped)
	* @returns Interpolated value: `a + (b - a) * t`
	*/
	function lerp(a, b, t) {
		return a + (b - a) * t;
	}
	/**
	* Clamp a value between min and max.
	* @ai-hint Commonly used with time: `clamp(time / 1.5, 0, 1)` creates a 0→1 ramp over 1.5 s.
	* @param val - Value to clamp
	* @param min - Minimum value
	* @param max - Maximum value
	* @returns Value restricted to [min, max]
	*/
	function clamp(val, min, max) {
		return Math.min(Math.max(val, min), max);
	}
	/**
	* Inverse of lerp: given a value between a and b, return the normalized t in [0, 1].
	* @ai-hint Use to convert a value back to progress: `inverseLerp(0, 100, 50)` → 0.5
	* @param a - Start of range
	* @param b - End of range
	* @param value - Value within (or outside) the range
	* @returns Normalized position: (value - a) / (b - a). Not clamped. When a === b (degenerate range), returns 0.
	*/
	function inverseLerp(a, b, value) {
		if (a === b) return 0;
		return (value - a) / (b - a);
	}
	/**
	* Map a value from one range to another, clamping output to [outMin, outMax].
	* @ai-hint Use when you want mapped values to never exceed the output range.
	* @param val - Input value
	* @param inMin - Input range minimum
	* @param inMax - Input range maximum
	* @param outMin - Output range minimum
	* @param outMax - Output range maximum
	* @returns Mapped and clamped value
	*/
	function mapClamp(val, inMin, inMax, outMin, outMax) {
		const t = inverseLerp(inMin, inMax, val);
		const clamped = Math.max(0, Math.min(1, t));
		return outMin + (outMax - outMin) * clamped;
	}
	/**
	* Map a value from one range to another.
	* @ai-hint Does NOT clamp — output can exceed [outMin, outMax] if input exceeds [inMin, inMax].
	* @param val - Input value
	* @param inMin - Input range minimum
	* @param inMax - Input range maximum
	* @param outMin - Output range minimum
	* @param outMax - Output range maximum
	* @returns Mapped value: `outMin + (val - inMin) * (outMax - outMin) / (inMax - inMin)`
	*/
	function map(val, inMin, inMax, outMin, outMax) {
		return (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
	}
	/**
	* Generate a random number between min and max.
	* @ai-hint Not deterministic — different result every frame. For smooth randomness, use `noise()` instead.
	* @param min - Minimum value (inclusive)
	* @param max - Maximum value (exclusive)
	* @returns Random float in [min, max)
	*/
	function random(min, max) {
		return Math.random() * (max - min) + min;
	}
	/**
	* Generate a random integer between min and max (inclusive)
	* @param min - Minimum value
	* @param max - Maximum value
	* @returns Random integer
	*/
	function randomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
	/**
	* Shuffle an array using Fisher-Yates algorithm
	* @param array - Array to shuffle
	* @returns New shuffled array
	*/
	function shuffle(array) {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = result[i];
			result[i] = result[j];
			result[j] = tmp;
		}
		return result;
	}
	let noise2DFn = createNoise2D();
	let noise3DFn = createNoise3D();
	/**
	* Set the noise seed for reproducible noise
	* @param seed - Seed value
	*/
	function setNoiseSeed(seed) {
		const prng = AleaFunction(seed);
		noise2DFn = createNoise2D(prng);
		noise3DFn = createNoise3D(prng);
	}
	/**
	* Simple 1D noise function for smooth random values
	* Uses 2D noise with y=0 for 1D output
	* @param x - Input coordinate
	* @returns Noise value between -1 and 1
	*/
	function noise(x) {
		return noise2DFn(x, 0);
	}
	/**
	* 2D noise function for smooth random values
	* @param x - X coordinate
	* @param y - Y coordinate
	* @returns Noise value between -1 and 1
	*/
	function noise2D(x, y) {
		return noise2DFn(x, y);
	}
	/**
	* 3D noise function for smooth random values
	* @param x - X coordinate
	* @param y - Y coordinate
	* @param z - Z coordinate
	* @returns Noise value between -1 and 1
	*/
	function noise3D(x, y, z) {
		return noise3DFn(x, y, z);
	}
	/**
	* Convert degrees to radians
	* @param deg - Degrees
	* @returns Radians
	*/
	function degToRad(deg) {
		return deg * (Math.PI / 180);
	}
	/**
	* Convert radians to degrees
	* @param rad - Radians
	* @returns Degrees
	*/
	function radToDeg(rad) {
		return rad * (180 / Math.PI);
	}
	/**
	* Hermite interpolation: smooth 0→1 transition between edge0 and edge1.
	* @ai-hint Used in shaders and smooth transitions. Returns 0 for x ≤ edge0, 1 for x ≥ edge1.
	* @param edge0 - Start of transition
	* @param edge1 - End of transition
	* @param x - Input value
	* @returns Value in [0, 1] with smooth edges
	*/
	function smoothstep(edge0, edge1, x) {
		const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
		return t * t * (3 - 2 * t);
	}
	/**
	* Step function: returns 0 if x < edge, 1 otherwise.
	* @ai-hint Fundamental in graphics. Use for hard cutoffs.
	* @param edge - Threshold
	* @param x - Input value
	* @returns 0 or 1
	*/
	function step(edge, x) {
		return x < edge ? 0 : 1;
	}
	/**
	* Fractional part of x (x - floor(x)).
	* @ai-hint Common for looping animations: fract(time) gives 0→1 each cycle.
	* @param x - Input value
	* @returns Value in [0, 1)
	*/
	function fract(x) {
		return x - Math.floor(x);
	}
	/**
	* Sign of x: -1 if negative, 0 if zero, 1 if positive.
	* @param x - Input value
	* @returns -1, 0, or 1
	*/
	function sign(x) {
		if (x > 0) return 1;
		if (x < 0) return -1;
		return 0;
	}
	/**
	* Wrap t to [0, length). Use for looping animations.
	* @ai-hint repeat(time, 2) gives 0→2, 0→2, ... for a 2-second loop.
	* @param t - Time or value
	* @param length - Period length
	* @returns Value in [0, length)
	*/
	function repeat$1(t, length) {
		return clamp(t - Math.floor(t / length) * length, 0, length);
	}
	/**
	* Oscillate between 0 and length (ping-pong). Use for back-and-forth motion.
	* @ai-hint pingPong(time, 1) goes 0→1→0→1... over time.
	* @param t - Time or value
	* @param length - Amplitude/period
	* @returns Value in [0, length]
	*/
	function pingPong(t, length) {
		const x = repeat$1(t, length * 2);
		return length - Math.abs(x - length);
	}
	// packages/superimg-stdlib/dist/math.js
	var math_exports = /* @__PURE__ */ __exportAll$1({
		clamp: () => clamp,
		degToRad: () => degToRad,
		fract: () => fract,
		inverseLerp: () => inverseLerp,
		lerp: () => lerp,
		map: () => map,
		mapClamp: () => mapClamp,
		noise: () => noise,
		noise2D: () => noise2D,
		noise3D: () => noise3D,
		pingPong: () => pingPong,
		radToDeg: () => radToDeg,
		random: () => random,
		randomInt: () => randomInt,
		repeat: () => repeat$1,
		setNoiseSeed: () => setNoiseSeed,
		shuffle: () => shuffle,
		sign: () => sign,
		smoothstep: () => smoothstep,
		step: () => step
	});
	// packages/superimg-stdlib/dist/color.js
	var color_exports = /* @__PURE__ */ __exportAll$1({
		alpha: () => alpha,
		animateGradientStops: () => animateGradientStops,
		darken: () => darken,
		desaturate: () => desaturate,
		hexToRgb: () => hexToRgb,
		hsl: () => hsl,
		hslToRgb: () => hslToRgb,
		isLight: () => isLight,
		lighten: () => lighten,
		linearGradient: () => linearGradient,
		mix: () => mix,
		parseColor: () => parseColor,
		radialGradient: () => radialGradient,
		rgbToHex: () => rgbToHex,
		rgbToHsl: () => rgbToHsl,
		saturate: () => saturate
	});
	/**
	* Color manipulation utilities for SuperImg templates
	*
	* Provides functions for color conversion, manipulation, and formatting.
	* Uses colord library for robust color operations.
	*/
	F([b]);
	/**
	* Convert hex color to RGB.
	* @ai-hint Accepts both "#FF0000" and "FF0000" (with or without `#`). Throws on invalid input.
	* @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
	* @returns RGB object `{ r: number, g: number, b: number }` with values in [0, 255]
	*/
	function hexToRgb(hex) {
		const c = C(hex.startsWith("#") ? hex : `#${hex}`);
		if (!c.isValid()) throw new Error(`Invalid hex color: ${hex}`);
		const { r, g, b } = c.toRgb();
		return {
			r,
			g,
			b
		};
	}
	/**
	* Convert RGB to hex color
	* @param r - Red (0-255)
	* @param g - Green (0-255)
	* @param b - Blue (0-255)
	* @returns Hex color string
	*/
	function rgbToHex(r, g, b) {
		return C({
			r,
			g,
			b
		}).toHex();
	}
	/**
	* Convert HSL to RGB
	* @param h - Hue (0-360)
	* @param s - Saturation (0-100)
	* @param l - Lightness (0-100)
	* @returns RGB object
	*/
	function hslToRgb(h, s, l) {
		const { r, g, b } = C({
			h,
			s,
			l
		}).toRgb();
		return {
			r,
			g,
			b
		};
	}
	/**
	* Convert RGB to HSL
	* @param r - Red (0-255)
	* @param g - Green (0-255)
	* @param b - Blue (0-255)
	* @returns HSL object
	*/
	function rgbToHsl(r, g, b) {
		const { h, s, l } = C({
			r,
			g,
			b
		}).toHsl();
		return {
			h: Math.round(h),
			s: Math.round(s),
			l: Math.round(l)
		};
	}
	/**
	* Create an HSL color string from hue, saturation, and lightness values.
	* @ai-hint Returns a CSS `hsl()` string, safe to use directly in style attributes.
	* @param h - Hue (0-360)
	* @param s - Saturation (0-100)
	* @param l - Lightness (0-100)
	* @returns CSS HSL color string, e.g. `"hsl(180, 50%, 50%)"`
	*/
	function hsl(h, s, l) {
		return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
	}
	/**
	* Parse a color string to RGB
	* Supports hex (#FF0000), rgb(r,g,b), hsl(h,s%,l%), and named colors
	* @param str - Color string
	* @returns RGB object
	*/
	function parseColor(str) {
		const c = C(str);
		if (!c.isValid()) throw new Error(`Invalid color format: ${str}`);
		const { r, g, b } = c.toRgb();
		return {
			r,
			g,
			b
		};
	}
	/**
	* Darken a color by a percentage.
	* @ai-hint amount is 0-100 (percentage), not 0-1. `darken('#fff', 50)` → mid-gray.
	* @param color - Color string (hex, rgb, hsl, named)
	* @param amount - Amount to darken (0-100), where 100 = black
	* @returns Darkened color as hex string
	*/
	function darken(color, amount) {
		return C(color).darken(amount / 100).toHex();
	}
	/**
	* Lighten a color by a percentage.
	* @ai-hint amount is 0-100 (percentage), not 0-1. `lighten('#000', 50)` → mid-gray.
	* @param color - Color string (hex, rgb, hsl, named)
	* @param amount - Amount to lighten (0-100), where 100 = white
	* @returns Lightened color as hex string
	*/
	function lighten(color, amount) {
		return C(color).lighten(amount / 100).toHex();
	}
	/**
	* Add alpha channel to a color.
	* @ai-hint Returns `rgba(...)` string, safe to use directly in CSS/HTML style attributes.
	* @param color - Color string (hex, rgb, hsl, named)
	* @param opacity - Opacity value in [0, 1] where 0 = transparent, 1 = opaque
	* @returns RGBA color string, e.g. `"rgba(255, 0, 0, 0.5)"`
	*/
	function alpha(color, opacity) {
		const { r, g, b, a } = C(color).alpha(opacity).toRgb();
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}
	/**
	* Mix two colors.
	* @ai-hint weight=1 returns c1, weight=0 returns c2 — opposite of CSS `color-mix()`.
	* @param c1 - First color
	* @param c2 - Second color
	* @param weight - Weight of first color in [0, 1]. 1 = all c1, 0 = all c2.
	* @returns Mixed color as hex string
	*/
	function mix(c1, c2, weight) {
		return C(c1).mix(c2, 1 - weight).toHex();
	}
	/**
	* Saturate a color by a percentage
	* @param color - Color string
	* @param amount - Amount to saturate (0-100)
	* @returns Saturated color as hex
	*/
	function saturate(color, amount) {
		return C(color).saturate(amount / 100).toHex();
	}
	/**
	* Desaturate a color by a percentage
	* @param color - Color string
	* @param amount - Amount to desaturate (0-100)
	* @returns Desaturated color as hex
	*/
	function desaturate(color, amount) {
		return C(color).desaturate(amount / 100).toHex();
	}
	/**
	* Check if a color is light (useful for text color decisions)
	* @param color - Color string
	* @returns True if color is light
	*/
	function isLight(color) {
		return C(color).isLight();
	}
	// packages/superimg-stdlib/dist/text.js
	var text_exports = /* @__PURE__ */ __exportAll$1({
		cursor: () => cursor,
		escapeHtml: () => escapeHtml$1,
		formatCompact: () => formatCompact,
		formatCurrency: () => formatCurrency,
		formatNumber: () => formatNumber,
		pad: () => pad,
		pluralize: () => pluralize,
		slugify: () => slugify,
		truncate: () => truncate,
		type: () => type,
		typeDuration: () => typeDuration,
		wrap: () => wrap
	});
	/**
	* Text manipulation utilities for SuperImg templates
	*
	* Provides functions for text formatting, truncation, and formatting.
	*/
	/**
	* Truncate a string to a maximum length
	* @param str - String to truncate
	* @param len - Maximum length
	* @param suffix - Suffix to append (default: "...")
	* @returns Truncated string
	*/
	function truncate(str, len, suffix = "...") {
		if (str.length <= len) return str;
		return str.substring(0, len - suffix.length) + suffix;
	}
	/**
	* Pluralize a word based on count
	* @param n - Count
	* @param singular - Singular form
	* @param plural - Plural form (optional, defaults to singular + 's')
	* @returns Pluralized word
	*/
	function pluralize(n, singular, plural) {
		if (n === 1) return singular;
		return plural || singular + "s";
	}
	/**
	* Format a number with locale-specific formatting
	* @param num - Number to format
	* @param locale - Locale string (e.g., "en-US", "de-DE")
	* @returns Formatted number string
	*/
	function formatNumber(num, locale = "en-US") {
		return new Intl.NumberFormat(locale).format(num);
	}
	/**
	* Format a number with compact notation (e.g. 1234 → "1.2K", 1_500_000 → "1.5M").
	* Uses Intl.NumberFormat's "compact" notation for proper i18n.
	*
	* @param num - Number to format
	* @param locale - Locale string (default: "en-US")
	* @returns Compact-notation string
	*/
	function formatCompact(num, locale = "en-US") {
		return new Intl.NumberFormat(locale, {
			notation: "compact",
			maximumFractionDigits: 1
		}).format(num);
	}
	/**
	* Format a number as currency
	* @param num - Number to format
	* @param currency - Currency code (e.g., "USD", "EUR")
	* @param locale - Locale string (e.g., "en-US", "de-DE")
	* @returns Formatted currency string
	*/
	function formatCurrency(num, currency = "USD", locale = "en-US") {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency
		}).format(num);
	}
	/**
	* Convert a string to a URL-friendly slug
	* @param str - String to slugify
	* @returns Slug string
	*/
	function slugify(str) {
		return str.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
	}
	/**
	* Pad a string to a specific length
	* @param str - String to pad
	* @param len - Target length
	* @param char - Padding character (default: " ")
	* @param side - Side to pad ("left", "right", or "both", default: "right")
	* @returns Padded string
	*/
	function pad(str, len, char = " ", side = "right") {
		const strLen = str.length;
		if (strLen >= len) return str;
		const padding = char.repeat(len - strLen);
		switch (side) {
			case "left": return padding + str;
			case "both": {
				const leftPad = Math.floor((len - strLen) / 2);
				const rightPad = len - strLen - leftPad;
				return char.repeat(leftPad) + str + char.repeat(rightPad);
			}
			default: return str + padding;
		}
	}
	/**
	* Wrap text into lines based on maximum characters per line
	* @param text - Text to wrap
	* @param maxCharsPerLine - Maximum characters per line
	* @returns Array of wrapped lines
	*/
	function wrap(text, maxCharsPerLine) {
		if (maxCharsPerLine <= 0) return [text];
		const words = text.split(" ");
		const lines = [];
		let currentLine = "";
		for (const word of words) {
			const testLine = currentLine ? currentLine + " " + word : word;
			if (testLine.length > maxCharsPerLine) {
				if (currentLine) {
					lines.push(currentLine);
					currentLine = word;
				} else {
					lines.push(word);
					currentLine = "";
				}
			} else currentLine = testLine;
		}
		if (currentLine) lines.push(currentLine);
		return lines.length > 0 ? lines : [""];
	}
	/**
	* Progress-driven text reveal.
	*
	* Takes a string and a progress value (0–1) and returns the visible portion.
	* Compose with `std.code.highlight()` for syntax-highlighted code typing,
	* or with `ctx.director()` / `track().*` to score and sync typing events.
	*
	* @param text - Full text to reveal
	* @param progress - Progress value, typically 0–1 (clamped internally)
	* @param options - Options for granularity
	* @returns TypeResult with visible text and state
	*
	* @example
	* ```ts
	* // Character-by-character (default)
	* const { visible, typing } = std.text.type("Hello!", progress);
	*
	* // Word-by-word
	* const { visible } = std.text.type("Hello World", progress, { by: 'word' });
	*
	* // Line-by-line (great for code)
	* const { visible } = std.text.type(CODE, progress, { by: 'line' });
	* const highlighted = std.code.highlight(visible, { lang: 'typescript' });
	* ```
	*/
	function type(text, progress, options) {
		const clamped = Math.max(0, Math.min(1, progress));
		const by = options?.by ?? "char";
		const variance = Math.max(0, Math.min(1, options?.variance ?? 0));
		let total;
		let index;
		let visible;
		switch (by) {
			case "word": {
				const words = text.split(/(\s+)/);
				const wordTokens = [];
				for (let i = 0; i < words.length; i++) if ((words[i] ?? "").trim().length > 0) wordTokens.push(i);
				total = wordTokens.length;
				index = Math.floor(clamped * total);
				if (index >= total) visible = text;
				else if (index <= 0) visible = "";
				else {
					const lastWordIdx = wordTokens[index - 1] ?? 0;
					visible = words.slice(0, lastWordIdx + 1).join("");
				}
				break;
			}
			case "line": {
				const lines = text.split("\n");
				total = lines.length;
				index = Math.floor(clamped * total);
				if (index >= total) visible = text;
				else if (index <= 0) visible = "";
				else visible = lines.slice(0, index).join("\n");
				break;
			}
			default:
				total = text.length;
				if (variance > 0 && total > 0) index = weightedCharIndex(text, clamped, variance);
				else index = Math.floor(clamped * total);
				visible = text.slice(0, Math.min(index, total));
		}
		const isTyping = clamped > 0 && clamped < 1;
		const cursorVisible = isTyping ? true : cursor(options?.time ?? 0, options?.cursorRate ?? 3);
		return {
			visible,
			typing: isTyping,
			done: clamped >= 1,
			index,
			total,
			cursorVisible
		};
	}
	/**
	* Compute character index using weighted progress for natural typing rhythm.
	* Heavier weights = more time spent on that character (slower typing).
	*/
	function weightedCharIndex(text, progress, variance) {
		const len = text.length;
		if (progress <= 0) return 0;
		if (progress >= 1) return len;
		let totalWeight = 0;
		const cumulative = new Float64Array(len + 1);
		for (let i = 0; i < len; i++) {
			let w = 1;
			const ch = text[i] ?? "";
			if (ch === "\n") w += 3 * variance;
			else if ("{()}[];:<>=".includes(ch)) w += 1.5 * variance;
			else if (i > 0 && (text[i - 1] ?? "") === " ") w += .5 * variance;
			totalWeight += w;
			cumulative[i + 1] = totalWeight;
		}
		const target = progress * totalWeight;
		let lo = 0;
		let hi = len;
		while (lo < hi) {
			const mid = lo + hi >> 1;
			if ((cumulative[mid + 1] ?? 0) <= target) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}
	/**
	* Calculate how many seconds a typing animation should take.
	*
	* Use the returned duration to derive progress:
	* ```ts
	* const dur = std.text.typeDuration(text, { speed: 40 });
	* const progress = std.math.clamp(time / dur, 0, 1);
	* const { visible } = std.text.type(text, progress);
	* ```
	*
	* @param text - The text that will be typed
	* @param options - Speed and granularity options
	* @returns Duration in seconds
	*/
	function typeDuration(text, options) {
		const by = options?.by ?? "char";
		const speed = options?.speed ?? {
			char: 30,
			word: 5,
			line: 2
		}[by];
		if (speed <= 0) return 0;
		let unitCount;
		switch (by) {
			case "word":
				unitCount = text.split(/\s+/).filter((w) => w.length > 0).length;
				break;
			case "line":
				unitCount = text.split("\n").length;
				break;
			default: unitCount = text.length;
		}
		return unitCount / speed;
	}
	/**
	* Blinking cursor helper.
	*
	* Returns true when cursor should be visible, false when hidden.
	* Toggles at the given rate (blinks per second).
	*
	* @param time - Current time in seconds (e.g., ctx.timeline.seconds)
	* @param rate - Blinks per second (default: 3)
	* @returns Whether the cursor should be visible
	*
	* @example
	* ```ts
	* const show = std.text.cursor(time);
	* return `${visible}${show ? '▋' : ''}`;
	* ```
	*/
	function cursor(time, rate = 3) {
		return Math.floor(time * rate) % 2 === 0;
	}
	// packages/superimg-stdlib/dist/responsive.js
	var responsive_exports = /* @__PURE__ */ __exportAll$1({
		createResponsive: () => createResponsive,
		responsive: () => responsive
	});
	function responsive(options, ctx) {
		if (ctx.isSquare && options.square !== void 0) return options.square;
		if (ctx.isPortrait && options.portrait !== void 0) return options.portrait;
		if (ctx.isLandscape && options.landscape !== void 0) return options.landscape;
		return options.default ?? options.landscape ?? options.portrait;
	}
	function createResponsive(ctx) {
		function select(options) {
			return responsive(options, ctx);
		}
		return select;
	}
	// packages/superimg-stdlib/dist/interpolate-number.js
	/** Numeric interpolation without the optional color implementation. */
	function interpolate(progress, inputRange, outputRange, easing) {
		if (inputRange.length < 2) throw new Error("interpolate: inputRange must have at least 2 values");
		if (inputRange.length !== outputRange.length) throw new Error("interpolate: inputRange and outputRange must have the same length");
		const last = inputRange.length - 1;
		const firstInput = inputRange[0];
		const lastInput = inputRange[last];
		const firstOutput = outputRange[0];
		const lastOutput = outputRange[last];
		if (progress <= firstInput) return firstOutput;
		if (progress >= lastInput) return lastOutput;
		let i = 1;
		while (i < last && progress > (inputRange[i] ?? lastInput)) i += 1;
		const inLo = inputRange[i - 1] ?? firstInput;
		const inHi = inputRange[i] ?? lastInput;
		const outLo = outputRange[i - 1] ?? firstOutput;
		const outHi = outputRange[i] ?? lastOutput;
		const segment = clamp01$1(inverseLerp$1(inLo, inHi, progress));
		const easingFn = typeof easing === "function" ? easing : easing === void 0 ? void 0 : easing_exports$1[easing];
		if (easing !== void 0 && !easingFn) throw new Error(`Unknown easing "${easing}". Valid names: ${EASING_NAMES.join(", ")}`);
		const eased = easingFn ? easingFn(segment) : segment;
		return lerp$1(outLo, outHi, eased);
	}
	// packages/superimg-stdlib/dist/tween.js
	/**
	* Tween utilities for SuperImg animations
	*
	* Composes easing + interpolation into a single call.
	*/
	const EASING_MAP$1 = {
		linear: linear$1,
		easeInQuad,
		easeOutQuad,
		easeInOutQuad,
		easeInSine,
		easeOutSine,
		easeInOutSine,
		easeInCubic,
		easeOutCubic,
		easeInOutCubic,
		easeInQuart,
		easeOutQuart,
		easeInOutQuart,
		easeInQuint,
		easeOutQuint,
		easeInOutQuint,
		easeInExpo,
		easeOutExpo,
		easeInOutExpo,
		easeInCirc,
		easeOutCirc,
		easeInOutCirc,
		easeInBack,
		easeOutBack,
		easeInOutBack,
		easeInElastic,
		easeOutElastic,
		easeInOutElastic,
		easeInBounce,
		easeOutBounce,
		easeInOutBounce
	};
	function resolveEasing$1(easingOpt) {
		if (easingOpt === void 0) return linear$1;
		if (typeof easingOpt === "function") return easingOpt;
		const fn = EASING_MAP$1[easingOpt];
		if (!fn) throw new Error(`Unknown easing "${easingOpt}". Valid names: ${EASING_NAMES.join(", ")}`);
		return fn;
	}
	/**
	* Interpolate from `from` to `to` with optional easing and time window.
	*
	* @param from - Start value
	* @param to - End value
	* @param progress - Progress in [0, 1] (or use options.start/end to remap)
	* @param easingOrOptions - Easing name, easing function, or options object
	* @returns Interpolated value
	*
	* Internal-only. Not exposed on `ctx.std`; template authors should use
	* `ctx.director()` for phased choreography or `std.interpolate()` for custom progress.
	* @example
	* ```ts
	* // Simple: linear interpolation
	* tween(0, 100, 0.5)  // 50
	*
	* // With easing
	* tween(0, 100, 0.5, 'easeOutCubic')  // ~87.5
	*
	* // With time window (animate only between 20% and 60% of scene)
	* tween(0, 100, timeline, { easing: 'easeOutCubic', start: 0.2, end: 0.6 })
	* ```
	*/
	function tween(from, to, progress, easingOrOptions) {
		let start = 0;
		let end = 1;
		let easingFn = linear$1;
		if (easingOrOptions === void 0) {} else if (typeof easingOrOptions === "string" || typeof easingOrOptions === "function") easingFn = resolveEasing$1(easingOrOptions);
		else {
			const opts = easingOrOptions;
			start = opts.start ?? 0;
			end = opts.end ?? 1;
			if (start > end) throw new Error(`tween options: start (${start}) must be <= end (${end})`);
			easingFn = resolveEasing$1(opts.easing);
		}
		let t;
		if (start === end) t = progress >= start ? 1 : 0;
		else {
			t = (progress - start) / (end - start);
			t = clamp01$1(t);
		}
		const eased = easingFn(t);
		return lerp$1(from, to, eased);
	}
	// packages/superimg-stdlib/dist/interpolate.js
	/**
	* Multi-segment interpolation for SuperImg animations
	*
	* Maps a progress value through multiple keyframes, like Remotion's interpolate().
	* Supports arbitrary input ranges (not just 0-1) and per-segment easing.
	*
	* @example
	* ```ts
	* // Fade in, hold, fade out
	* const opacity = std.interpolate(timeline.progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
	*
	* // Color transition through multiple stops
	* const bg = std.interpolateColor(timeline, [0, 0.5, 1], ["#f00", "#0f0", "#00f"]);
	* ```
	*/
	F([b]);
	/**
	* Multi-segment numeric interpolation.
	*
	* Maps `progress` through paired input/output ranges. Each adjacent pair
	* of values defines a segment. Values outside the input range clamp to the
	* nearest endpoint. Easing is applied per segment.
	*
	* @example
	* ```ts
	* // Linear ramp
	* std.interpolate(0.5, [0, 1], [0, 100])  // 50
	*
	* // Multi-segment: fade in, hold, fade out
	* std.interpolate(0.9, [0, 0.2, 0.8, 1], [0, 1, 1, 0])  // 0.5
	*
	* // With easing
	* std.interpolate(0.5, [0, 1], [0, 100], "easeOutCubic")
	* ```
	*/
	/**
	* Multi-segment color interpolation.
	*
	* Maps `progress` through paired input ranges and color stops.
	* Interpolates in RGB color space using colord. Values outside the input
	* range clamp to the nearest color.
	*
	* @example
	* ```ts
	* // Two-stop gradient
	* std.interpolateColor(0.5, [0, 1], ["#ff0000", "#0000ff"])
	*
	* // Multi-stop: red → green → blue
	* std.interpolateColor(0.25, [0, 0.5, 1], ["#ff0000", "#00ff00", "#0000ff"])
	* ```
	*/
	function interpolateColor(progress, inputRange, colors, easing) {
		if (inputRange.length < 2) throw new Error("interpolateColor: inputRange must have at least 2 values");
		if (inputRange.length !== colors.length) throw new Error("interpolateColor: inputRange and colors must have the same length");
		const last = inputRange.length - 1;
		const firstInput = inputRange[0];
		const lastInput = inputRange[last];
		const firstColor = colors[0];
		const lastColor = colors[last];
		if (progress <= firstInput) return firstColor;
		if (progress >= lastInput) return lastColor;
		let i = 1;
		while (i < last && progress > (inputRange[i] ?? lastInput)) i++;
		const inLo = inputRange[i - 1] ?? firstInput;
		const inHi = inputRange[i] ?? lastInput;
		const colorLo = colors[i - 1] ?? firstColor;
		const colorHi = colors[i] ?? lastColor;
		let segT = clamp01$1(inverseLerp(inLo, inHi, progress));
		if (easing) segT = tween(0, 1, segT, easing);
		return C(colorLo).mix(colorHi, segT).toHex();
	}
	// packages/superimg-stdlib/dist/carousel.js
	/**
	* Carousel — one active item at a time; previous items exit their slot.
	* Use for thread slides, wizard steps, single-card transitions.
	*
	* Next item begins entering when the current item starts exiting (crossfade overlap).
	*/
	function carousel(items, opts) {
		const count = items.length;
		const lead = opts.lead ?? .05;
		const trail = opts.trail ?? .05;
		const enterFrac = opts.enter ?? .35;
		const exitFrac = opts.exit ?? .2;
		const last = opts.last ?? "hold";
		const parent = clamp01$1(opts.during);
		const contentStart = lead;
		const contentEnd = 1 - trail;
		const contentSpan = Math.max(.001, contentEnd - contentStart);
		const slot = count > 0 ? contentSpan / count : contentSpan;
		const step = count > 1 ? slot * (1 - exitFrac) : 0;
		function state(index) {
			if (index < 0 || index >= count) return {
				index,
				enter: 0,
				exit: 0,
				visible: false,
				active: false,
				state: "hidden"
			};
			const itemStart = contentStart + index * step;
			const itemEnd = itemStart + slot;
			const enterEnd = itemStart + slot * enterFrac;
			const exitStart = itemEnd - slot * exitFrac;
			const isLast = index === count - 1;
			const globalP = parent;
			if (globalP < itemStart) return {
				index,
				enter: 0,
				exit: 0,
				visible: false,
				active: false,
				state: "hidden"
			};
			if (isLast && last === "hold" && globalP >= enterEnd) return {
				index,
				enter: 1,
				exit: 0,
				visible: true,
				active: true,
				state: "hold"
			};
			if (globalP >= itemEnd) return {
				index,
				enter: 1,
				exit: 1,
				visible: false,
				active: false,
				state: "gone"
			};
			if (globalP < enterEnd) {
				const enter = interpolate(globalP, [itemStart, enterEnd], [0, 1], "easeOutCubic");
				return {
					index,
					enter,
					exit: 0,
					visible: enter > 0,
					active: true,
					state: "entering"
				};
			}
			if (globalP >= exitStart) {
				const exit = interpolate(globalP, [exitStart, itemEnd], [0, 1], "easeInCubic");
				return {
					index,
					enter: 1,
					exit,
					visible: exit < 1,
					active: true,
					state: "exiting"
				};
			}
			return {
				index,
				enter: 1,
				exit: 0,
				visible: true,
				active: true,
				state: "hold"
			};
		}
		return {
			count,
			state,
			each(fn) {
				items.forEach((item, i) => fn(item, state(i), i));
			}
		};
	}
	// packages/superimg-stdlib/dist/stack.js
	/**
	* Stack — ordered reveal; items stay visible once shown (chat, FAQ, lists).
	* Optional weights give longer content more of the parent phase window.
	*/
	function resolveWeights(count, weights) {
		if (count === 0) return [];
		if (!weights) return Array.from({ length: count }, () => 1);
		if (weights.length !== count) throw new Error(`stack(): weights length (${weights.length}) must match items length (${count})`);
		return weights.map((w, i) => {
			if (!Number.isFinite(w) || w <= 0) throw new Error(`stack(): weights[${i}] must be a finite number > 0 (got ${w})`);
			return w;
		});
	}
	/** Cumulative [start, end) windows in content-normalized [0, 1] for each item. */
	function stackSlotWindows(count, weights) {
		const w = resolveWeights(count, weights);
		const total = w.reduce((a, b) => a + b, 0) || 1;
		let acc = 0;
		return w.map((wi) => {
			const fraction = wi / total;
			const start = acc;
			const end = acc + fraction;
			acc = end;
			return {
				start,
				end,
				fraction
			};
		});
	}
	function stack(items, opts) {
		const count = items.length;
		const lead = opts.lead ?? .05;
		const trail = opts.trail ?? .05;
		const enterFrac = opts.enter ?? .35;
		const parent = clamp01$1(opts.during);
		const contentStart = lead;
		const contentEnd = 1 - trail;
		const contentSpan = Math.max(.001, contentEnd - contentStart);
		const windows = stackSlotWindows(count, opts.weights);
		function state(index) {
			if (index < 0 || index >= count) return {
				index,
				enter: 0,
				slot: 0,
				visible: false,
				active: false,
				state: "hidden"
			};
			const win = windows[index];
			const itemStart = contentStart + win.start * contentSpan;
			const itemEnd = contentStart + win.end * contentSpan;
			const enterEnd = itemStart + Math.max(1e-4, itemEnd - itemStart) * enterFrac;
			const globalP = parent;
			const slotP = clamp01$1(interpolate(globalP, [itemStart, itemEnd], [0, 1]));
			if (globalP < itemStart) return {
				index,
				enter: 0,
				slot: 0,
				visible: false,
				active: false,
				state: "hidden"
			};
			if (globalP < enterEnd) {
				const enterP = interpolate(globalP, [itemStart, enterEnd], [0, 1], "easeOutCubic");
				return {
					index,
					enter: enterP,
					slot: slotP,
					visible: enterP > 0,
					active: true,
					state: "entering"
				};
			}
			return {
				index,
				enter: 1,
				slot: slotP,
				visible: true,
				active: true,
				state: "revealed"
			};
		}
		return {
			count,
			state,
			each(fn) {
				items.forEach((item, i) => fn(item, state(i), i));
			}
		};
	}
	// packages/superimg-stdlib/dist/layout-timeline.js
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
	// packages/superimg-stdlib/dist/oscillate.js
	/**
	* Continuous motion primitives — pure functions of time, render-safe.
	*
	* All functions accept time in seconds (from `ctx.timeline.seconds`).
	* `period` can be a string ("1s", "500ms") or a number (seconds).
	*/
	function parsePeriod(period) {
		if (typeof period === "number") return period;
		const s = period.trim();
		if (s.endsWith("ms")) return parseFloat(s) / 1e3;
		if (s.endsWith("s")) return parseFloat(s);
		throw new Error(`oscillate: period "${period}" must end with "s" or "ms"`);
	}
	/**
	* Smooth sine oscillation between `from` and `to` over `period`.
	*
	* @example
	* // Float a card up and down
	* const floatY = std.oscillate(time, { period: "2s", from: -4, to: 4 });
	* const pulseScale = std.oscillate(time, { period: "1s", from: 0.98, to: 1.02 });
	*/
	function oscillate(time, opts) {
		const period = parsePeriod(opts.period);
		const from = opts.from ?? -1;
		const to = opts.to ?? 1;
		const t = time / period * Math.PI * 2;
		const sine = (Math.sin(t) + 1) / 2;
		return from + (to - from) * sine;
	}
	/**
	* 0→1 sawtooth that resets each period.
	*
	* @example
	* const spinAngle = std.loop(time, { period: "3s" }) * 360;
	*/
	function loop(time, opts) {
		const period = parsePeriod(opts.period);
		return repeat$2(time, period) / period;
	}
	/**
	* 0→1→0 triangle that bounces each period.
	*
	* @example
	* const breathe = std.pingpong(time, { period: "2s" });
	*/
	function pingpong(time, opts) {
		const period = parsePeriod(opts.period);
		return pingPong$1(time, period / 2) / (period / 2);
	}
	/**
	* Seeded smooth noise — deterministic, no `Math.random()`.
	* Different seeds produce different patterns; same seed + time always gives the same value.
	*
	* @example
	* const jitterX = std.wiggle(time, 0, { freq: 2, amp: 8 });
	* const jitterY = std.wiggle(time, 1, { freq: 2, amp: 8 });
	*/
	function wiggle(time, seed, opts) {
		const freq = opts?.freq ?? 1;
		const amp = opts?.amp ?? 1;
		const t = time * freq + seed * 1234.5678;
		return amp * (Math.sin(t * 1) * .5 + Math.sin(t * 1.7) * .25 + Math.sin(t * 3.1) * .125 + Math.sin(t * 5.3) * .063);
	}
	// packages/superimg-stdlib/dist/timing.js
	/**
	* Timing craft helpers — duration, readability, and ms↔fraction conversion.
	*
	* Encodes animator skill tables as pure functions of text/distance/time.
	*/
	/** Count whitespace-separated words (empty → 0). */
	function wordCount(text) {
		return text.trim().split(/\s+/).filter(Boolean).length;
	}
	/**
	* Settled on-screen hold for readable text (animator skill).
	* `max(min, words / 3)` seconds — ~3 words/s, floor 0.8s.
	*/
	function readTimeSeconds(textOrWords, opts) {
		const words = typeof textOrWords === "number" ? textOrWords : wordCount(textOrWords);
		const wordsPerSec = (opts?.wpm ?? 180) / 60;
		const min = opts?.min ?? .8;
		if (words <= 0) return min;
		return Math.max(min, words / wordsPerSec);
	}
	/**
	* Build a full scene length: enter + settled hold + faster exit.
	*/
	function sceneDuration(opts) {
		const enter = opts.enter ?? .5;
		const exit = opts.exit ?? enter / 1.25;
		const hasText = opts.text != null || opts.words != null;
		return enter + Math.max(opts.holdMin ?? 0, hasText ? readTimeSeconds(opts.text ?? opts.words, { min: .8 }) + (opts.pad ?? .5) : 1.5) + exit;
	}
	/**
	* Sub-linear travel duration (Carbon-style): 2× distance ≈ 1.3× time.
	*/
	function durationForDistance(baseMs, distancePx, refPx = 100) {
		const ratio = Math.max(.25, distancePx / Math.max(1, refPx));
		return baseMs * Math.pow(ratio, .4);
	}
	/** Convert milliseconds to a 0–1 fraction of a parent window in seconds. */
	function msToFraction(ms, windowSeconds) {
		if (windowSeconds <= 0) return 0;
		return Math.min(1, Math.max(0, ms / 1e3 / windowSeconds));
	}
	/** Quantize seconds to a beat grid (default 120bpm). */
	function snapToBeat(seconds, bpm = 120, subdivision = 1) {
		const beat = 60 / bpm / Math.max(1, subdivision);
		if (beat <= 0) return seconds;
		return Math.round(seconds / beat) * beat;
	}
	/** Namespace object for `std.timing`. */
	const timing = {
		wordCount,
		readTimeSeconds,
		/** Alias matching skill wording. */
		readTime: readTimeSeconds,
		sceneDuration,
		durationForDistance,
		msToFraction,
		snapToBeat
	};
	// packages/superimg-stdlib/dist/stagger.js
	/**
	* Stagger utilities for SuperImg animations
	*
	* Distributes progress across multiple items so each starts
	* slightly after the previous, creating cascading animations.
	*
	* Omakase: default easing is easeOutCubic; use `stagger.ms` for
	* 30–80ms gaps with a hard 500ms total cascade cap.
	*/
	/**
	* Compute fraction options that honor eachMs + capMs.
	* Shrinks each when (n-1)*eachMs would exceed capMs.
	*/
	function staggerPlan(count, opts) {
		const eachMs0 = opts.eachMs ?? 50;
		const capMs = opts.capMs ?? 500;
		const n = Math.max(1, count);
		const totalGap = Math.min(capMs, eachMs0 * Math.max(0, n - 1));
		const eachMs = n <= 1 ? 0 : totalGap / (n - 1);
		const each = msToFraction(eachMs, opts.windowSeconds);
		const totalGapSec = totalGap / 1e3;
		const durSec = Math.max(.05, opts.windowSeconds - totalGapSec);
		const duration = Math.min(1, durSec / Math.max(1e-9, opts.windowSeconds));
		if (each * (n - 1) >= .95) {
			const cappedEach = n <= 1 ? 0 : .5 / (n - 1);
			return {
				each: cappedEach,
				duration: Math.max(.05, 1 - cappedEach * (n - 1)),
				eachMs,
				totalMs: totalGap
			};
		}
		return {
			each,
			duration: Math.max(.05, duration),
			eachMs,
			totalMs: totalGap
		};
	}
	/**
	* Distribute progress across items for staggered animations.
	*
	* @example Count-based
	* ```ts
	* const progresses = std.stagger(3, timeline.progress, { duration: 0.4 });
	* ```
	*
	* @example Items-based
	* ```ts
	* const staggered = std.stagger(["A", "B", "C"], timeline.progress, { from: "center" });
	* ```
	*/
	function staggerImpl(countOrItems, progress, options, meta) {
		const isArray = Array.isArray(countOrItems);
		const count = isArray ? countOrItems.length : countOrItems;
		const easing = options?.easing ?? "easeOutCubic";
		if (count <= 0) return [];
		if (count === 1) {
			const p = applyEasing(clamp01$1(progress), easing);
			if (isArray) return [{
				item: countOrItems[0],
				progress: p,
				index: 0,
				active: p > 0 && p < 1,
				done: p >= 1,
				startMs: 0,
				eachMs: meta?.eachMs,
				totalStaggerMs: meta?.totalMs
			}];
			return [p];
		}
		let each;
		let dur;
		if (options?.each != null) {
			each = options.each;
			dur = Math.max(.05, 1 - each * (count - 1));
		} else if (options?.duration != null) {
			dur = options.duration;
			each = (1 - dur) / (count - 1);
		} else {
			each = 1 / (count + 1);
			dur = 1 - each * (count - 1);
		}
		const delays = computeDelays(count, options?.from ?? "start");
		const results = [];
		const starts = [];
		for (let i = 0; i < count; i++) {
			const start = (delays[i] ?? 0) * each * (count - 1);
			starts.push(start);
			const end = start + dur;
			let itemProgress;
			if (start === end) itemProgress = progress >= start ? 1 : 0;
			else itemProgress = clamp01$1((progress - start) / (end - start));
			results.push(applyEasing(itemProgress, easing));
		}
		if (isArray) return results.map((p, i) => ({
			item: countOrItems[i],
			progress: p,
			index: i,
			active: p > 0 && p < 1,
			done: p >= 1,
			startMs: meta ? (starts[i] ?? 0) * (meta.totalMs / Math.max(1e-9, each * (count - 1) || 1)) * (meta.eachMs > 0 ? 1 : 0) : void 0,
			eachMs: meta?.eachMs,
			totalStaggerMs: meta?.totalMs
		}));
		return results;
	}
	/** Enrich items with correct startMs from plan. */
	function staggerMsImpl(items, progress, opts) {
		const plan = staggerPlan(items.length, opts);
		const staggered = staggerImpl(items, progress, {
			each: plan.each,
			from: opts.from,
			easing: opts.easing ?? "easeOutCubic"
		}, {
			eachMs: plan.eachMs,
			totalMs: plan.totalMs
		});
		const delays = computeDelays(items.length, opts.from ?? "start");
		for (let i = 0; i < staggered.length; i++) {
			const entry = staggered[i];
			entry.startMs = (delays[i] ?? 0) * plan.totalMs;
			entry.eachMs = plan.eachMs;
			entry.totalStaggerMs = plan.totalMs;
		}
		return staggered;
	}
	function staggerBase(countOrItems, progress, options) {
		return staggerImpl(countOrItems, progress, options);
	}
	const stagger = staggerBase;
	function applyEasing(t, easing) {
		if (!easing || t === 0 || t === 1) return t;
		return tween(0, 1, t, easing);
	}
	/**
	* Compute normalized delay multipliers (0-1) for each index.
	* 0 = starts first, 1 = starts last.
	*/
	function computeDelays(count, from) {
		const last = count - 1;
		const delays = [];
		switch (from) {
			case "start":
				for (let i = 0; i < count; i++) delays.push(i / last);
				break;
			case "end":
				for (let i = 0; i < count; i++) delays.push((last - i) / last);
				break;
			case "center": {
				const mid = last / 2;
				const maxDist = mid;
				for (let i = 0; i < count; i++) delays.push(maxDist === 0 ? 0 : Math.abs(i - mid) / maxDist);
				break;
			}
			case "edges": {
				const mid = last / 2;
				const maxDist = mid;
				for (let i = 0; i < count; i++) delays.push(maxDist === 0 ? 0 : 1 - Math.abs(i - mid) / maxDist);
				break;
			}
		}
		return delays;
	}
	/**
	* Index of the item currently leading a stagger (highest progress above threshold).
	* Useful for syncing external UI (e.g. phone mockup) with staggered cards.
	*/
	function staggerLead(items, progress, options) {
		if (items.length === 0) return 0;
		const threshold = options?.threshold ?? .35;
		const staggered = stagger(items, progress, options);
		let best = 0;
		let bestP = -1;
		for (const entry of staggered) if (entry.progress >= threshold && entry.progress > bestP) {
			bestP = entry.progress;
			best = entry.index;
		}
		return bestP < 0 ? 0 : best;
	}
	function staggerMsOverload(countOrItems, progress, opts) {
		if (Array.isArray(countOrItems)) return staggerMsImpl(countOrItems, progress, opts);
		return staggerImpl(countOrItems, progress, {
			each: staggerPlan(countOrItems, opts).each,
			from: opts.from,
			easing: opts.easing ?? "easeOutCubic"
		});
	}
	stagger.lead = staggerLead;
	stagger.plan = staggerPlan;
	stagger.ms = staggerMsOverload;
	// packages/superimg-stdlib/dist/phase-recipes.js
	/**
	* Named phase layouts — establish → develop → resolve craft recipes.
	*/
	/** Percent phase configs (sum 100%). */
	const PHASE_RECIPES = {
		/** Current director default — balanced card. */
		card: {
			enter: "15%",
			hold: "70%",
			exit: "15%"
		},
		/** General video: slightly longer establish, exit band for resolve. */
		establish: {
			enter: "20%",
			hold: "62%",
			exit: "18%"
		},
		/** Social / short-form beats. */
		punchy: {
			enter: "25%",
			hold: "50%",
			exit: "25%"
		},
		/** Data / reading — long settle. */
		"hold-heavy": {
			enter: "12%",
			hold: "76%",
			exit: "12%"
		},
		/** Short-form openers. */
		hook: {
			enter: "30%",
			hold: "50%",
			exit: "20%"
		}
	};
	function recipe(name) {
		const r = PHASE_RECIPES[name];
		if (!r) throw new Error(`Unknown phase recipe "${name}". Known: ${Object.keys(PHASE_RECIPES).join(", ")}`);
		return { ...r };
	}
	/**
	* Text-driven scene: enter + readTime hold + faster exit → layoutTimeline.
	*/
	function fromText(text, opts) {
		const enter = opts?.enter ?? .5;
		const exitSpeed = opts?.exitSpeed ?? 1.25;
		return layoutTimeline({
			enter,
			hold: Math.max(opts?.holdMin ?? 0, readTimeSeconds(text)) + (opts?.pad ?? .5),
			exit: enter / exitSpeed
		});
	}
	/** Namespace for `std.phases`. */
	const phases = {
		recipe,
		fromText,
		RECIPES: PHASE_RECIPES
	};
	// packages/superimg-stdlib/dist/path.js
	/**
	* Motion along SVG paths.
	*
	* Get position, angle, and CSS transform at any point along an SVG path.
	* Caches parsed paths so calling every frame is free after the first parse.
	*
	* @example
	* ```ts
	* const pt = std.path("M0,0 C100,0 100,100 200,100", timeline.progress);
	* return `<div style="position:absolute; ${pt.transform}">🚀</div>`;
	* ```
	*/
	const EASING_MAP = easing_exports$1;
	function resolveEasing(e) {
		if (e === void 0) return void 0;
		if (typeof e === "function") return e;
		return EASING_MAP[e];
	}
	function buildPoint(np, progress, opts) {
		let t = clamp01$1(progress);
		const easingFn = resolveEasing(opts?.easing);
		if (easingFn) t = easingFn(t);
		const { x, y } = pointAtProgress(np, t);
		const angle = angleAtProgress(np, t);
		const showRotate = opts?.rotate !== false;
		const finalAngle = angle + (opts?.rotateOffset ?? 0);
		return {
			x,
			y,
			angle: finalAngle,
			transform: showRotate ? `translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px) rotate(${Math.round(finalAngle * 100) / 100}deg)` : `translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px)`
		};
	}
	/**
	* Get position along an SVG path at a given progress (0-1).
	*
	* @example
	* ```ts
	* const pos = std.path("M0,540 C480,100 1440,100 1920,540", timeline.progress);
	* return `<div style="position:absolute; transform: ${pos.transform}">✈️</div>`;
	* ```
	*/
	function path(d, progress, opts) {
		return buildPoint(normalizePath(d), progress, opts);
	}
	/**
	* Pre-parse a path for metadata access and explicit reuse.
	*
	* @example
	* ```ts
	* const flight = std.path.parse("M0,540 C480,100 1440,100 1920,540");
	* console.log(flight.length); // total arc length
	* const pos = flight.at(timeline.progress);
	* ```
	*/
	function createMotionPath(d) {
		const np = normalizePath(d);
		return {
			at(progress, opts) {
				return buildPoint(np, progress, opts);
			},
			get length() {
				return np.totalLength;
			}
		};
	}
	path.parse = createMotionPath;
	// packages/superimg-stdlib/dist/svg/base.js
	var base_exports = /* @__PURE__ */ __exportAll$1({
		arcPoint: () => arcPoint,
		bezier: () => bezier_exports,
		draw: () => draw,
		drawMany: () => drawMany,
		filter: () => filter,
		fitText: () => fitText,
		gradient: () => gradient_exports,
		measureText: () => measureText,
		morph: () => morph,
		shape: () => shape,
		textPath: () => textPath,
		wrapText: () => wrapText
	});
	// packages/superimg-stdlib/dist/layout2.js
	function assertFiniteNonNegative(value, label) {
		if (!Number.isFinite(value) || value < 0) throw new Error(`layout: ${label} must be a finite non-negative number, got ${value}`);
	}
	/**
	* Vertically partition `area` into rows. Returns one Box per input row, in order.
	*
	* - Each row with a fixed `height` consumes that many pixels from the top.
	* - At most one row may set `fill: true`; it receives the remaining height.
	* - `gap` is inserted between rows (not before the first or after the last).
	* - If fixed rows + gaps exceed `area.height`, throws.
	*
	* Rows do not need to fill the area; unused space is simply left below the last row.
	*/
	function partitionY(area, rows, opts = {}) {
		const gap = opts.gap ?? 0;
		assertFiniteNonNegative(gap, "options.gap");
		let fillIndex = -1;
		let fixedTotal = 0;
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;
			if (row.fill) {
				if (fillIndex !== -1) throw new Error(`layout.partitionY: at most one row may set fill:true (rows ${fillIndex} and ${i})`);
				fillIndex = i;
			} else {
				const h = row.height ?? 0;
				assertFiniteNonNegative(h, `rows[${i}].height`);
				fixedTotal += h;
			}
		}
		const gapTotal = rows.length > 0 ? gap * (rows.length - 1) : 0;
		const consumedWithoutFill = fixedTotal + gapTotal;
		if (consumedWithoutFill > area.height + 1e-6) throw new Error(`layout.partitionY: rows + gaps (${consumedWithoutFill}) exceed area height (${area.height})`);
		const fillHeight = fillIndex === -1 ? 0 : area.height - consumedWithoutFill;
		const result = [];
		let y = area.y;
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;
			const h = row.fill ? fillHeight : row.height ?? 0;
			result.push({
				x: area.x,
				y,
				width: area.width,
				height: h
			});
			y += h;
			if (i < rows.length - 1) y += gap;
		}
		return result;
	}
	/**
	* Shrink a box by padding. Convenience alias for the four subtractions you'd
	* otherwise write inline; the value is in naming the concept.
	*
	* `x` / `y` are shorthands for `left`+`right` / `top`+`bottom`. Explicit
	* `top`/`bottom`/`left`/`right` take precedence over `x`/`y` when both are set.
	*/
	function inset(area, pad = {}) {
		const top = pad.top ?? pad.y ?? 0;
		const bottom = pad.bottom ?? pad.y ?? 0;
		const left = pad.left ?? pad.x ?? 0;
		const right = pad.right ?? pad.x ?? 0;
		for (const [v, label] of [
			[top, "top"],
			[bottom, "bottom"],
			[left, "left"],
			[right, "right"]
		]) assertFiniteNonNegative(v, label);
		return {
			x: area.x + left,
			y: area.y + top,
			width: Math.max(0, area.width - left - right),
			height: Math.max(0, area.height - top - bottom)
		};
	}
	/**
	* Content box inside a safe-area preset (broadcast, social, title, …).
	* Pair with the Safe primitive or getSafeArea() for insets.
	*/
	function safeBox(width, height, preset = "broadcast") {
		return getSafeBox(width, height, preset);
	}
	/** Horizontally partition `area` into columns (mirror of partitionY). */
	function partitionX(area, cols, opts = {}) {
		const gap = opts.gap ?? 0;
		assertFiniteNonNegative(gap, "options.gap");
		let fillIndex = -1;
		let fixedTotal = 0;
		for (let i = 0; i < cols.length; i++) {
			const col = cols[i];
			if (!col) continue;
			if (col.fill) {
				if (fillIndex !== -1) throw new Error(`layout.partitionX: at most one col may set fill:true`);
				fillIndex = i;
			} else {
				const w = col.width ?? 0;
				assertFiniteNonNegative(w, `cols[${i}].width`);
				fixedTotal += w;
			}
		}
		const gapTotal = cols.length > 0 ? gap * (cols.length - 1) : 0;
		const consumed = fixedTotal + gapTotal;
		if (consumed > area.width + 1e-6) throw new Error(`layout.partitionX: cols + gaps (${consumed}) exceed area width (${area.width})`);
		const fillWidth = fillIndex === -1 ? 0 : area.width - consumed;
		const result = [];
		let x = area.x;
		for (let i = 0; i < cols.length; i++) {
			const col = cols[i];
			if (!col) continue;
			const w = col.fill ? fillWidth : col.width ?? 0;
			result.push({
				x,
				y: area.y,
				width: w,
				height: area.height
			});
			x += w;
			if (i < cols.length - 1) x += gap;
		}
		return result;
	}
	/** Divide area into a cols×rows grid of equal cells. */
	function grid(area, opts) {
		const { cols, rows, gap = 0 } = opts;
		assertFiniteNonNegative(gap, "options.gap");
		if (cols < 1 || rows < 1) throw new Error("layout.grid: cols and rows must be >= 1");
		const cellW = (area.width - gap * (cols - 1)) / cols;
		const cellH = (area.height - gap * (rows - 1)) / rows;
		const cells = [];
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({
			x: area.x + c * (cellW + gap),
			y: area.y + r * (cellH + gap),
			width: cellW,
			height: cellH
		});
		return cells;
	}
	/** Address a cell (or span) within a grid produced by `grid()`. */
	function place(gridArea, gridOpts, cell) {
		const cells = grid(gridArea, gridOpts);
		const { col, row, colSpan = 1, rowSpan = 1 } = cell;
		const origin = cells[row * gridOpts.cols + col];
		if (!origin) throw new Error(`layout.place: invalid col=${col} row=${row}`);
		if (colSpan === 1 && rowSpan === 1) return origin;
		const gap = gridOpts.gap ?? 0;
		const cellW = (gridArea.width - gap * (gridOpts.cols - 1)) / gridOpts.cols;
		const cellH = (gridArea.height - gap * (gridOpts.rows - 1)) / gridOpts.rows;
		return {
			x: origin.x,
			y: origin.y,
			width: cellW * colSpan + gap * (colSpan - 1),
			height: cellH * rowSpan + gap * (rowSpan - 1)
		};
	}
	/** Tile `tile` count times along an axis within `area`. */
	function repeat(area, tile, count, opts = {}) {
		const axis = opts.axis ?? "x";
		const gap = opts.gap ?? 0;
		assertFiniteNonNegative(gap, "options.gap");
		const result = [];
		for (let i = 0; i < count; i++) if (axis === "x") result.push({
			x: area.x + i * (tile.width + gap),
			y: area.y,
			width: tile.width,
			height: tile.height
		});
		else result.push({
			x: area.x,
			y: area.y + i * (tile.height + gap),
			width: tile.width,
			height: tile.height
		});
		return result;
	}
	/** Equal spacing for N items along an axis inside `track`. */
	function distribute(track, count, itemSize, axis = "x") {
		if (count < 1) return [];
		const trackSize = axis === "x" ? track.width : track.height;
		const totalItem = count * itemSize;
		const gap = count > 1 ? (trackSize - totalItem) / (count - 1) : 0;
		const result = [];
		for (let i = 0; i < count; i++) {
			const offset = i * (itemSize + gap);
			result.push(axis === "x" ? {
				x: track.x + offset,
				y: track.y,
				width: itemSize,
				height: track.height
			} : {
				x: track.x,
				y: track.y + offset,
				width: track.width,
				height: itemSize
			});
		}
		return result;
	}
	/** Position `child` within `parent` at an anchor point. */
	function align(parent, child, anchor = "center") {
		let x = parent.x;
		let y = parent.y;
		switch (anchor) {
			case "top-left": break;
			case "top":
				x = parent.x + (parent.width - child.width) / 2;
				break;
			case "top-right":
				x = parent.x + parent.width - child.width;
				break;
			case "left":
				y = parent.y + (parent.height - child.height) / 2;
				break;
			case "center":
				x = parent.x + (parent.width - child.width) / 2;
				y = parent.y + (parent.height - child.height) / 2;
				break;
			case "right":
				x = parent.x + parent.width - child.width;
				y = parent.y + (parent.height - child.height) / 2;
				break;
			case "bottom-left":
				y = parent.y + parent.height - child.height;
				break;
			case "bottom":
				x = parent.x + (parent.width - child.width) / 2;
				y = parent.y + parent.height - child.height;
				break;
			case "bottom-right":
				x = parent.x + parent.width - child.width;
				y = parent.y + parent.height - child.height;
		}
		return {
			x,
			y,
			width: child.width,
			height: child.height
		};
	}
	// packages/superimg-stdlib/dist/layout.js
	var layout_exports = /* @__PURE__ */ __exportAll$1({
		align: () => align,
		distribute: () => distribute,
		grid: () => grid,
		inset: () => inset,
		partitionX: () => partitionX,
		partitionY: () => partitionY,
		place: () => place,
		repeat: () => repeat,
		safeBox: () => safeBox
	});
	// packages/superimg-core/src/native/jsc-runtime.ts
	function createPreparedNativeStdlib() {
		const std = createStaticStdlib();
		Object.assign(std, {
			math: math_exports,
			color: color_exports,
			text: text_exports,
			responsive: responsive_exports,
			code: code_exports,
			carousel,
			stack,
			layoutTimeline,
			oscillate,
			loop,
			pingpong,
			wiggle,
			spring,
			stagger,
			interpolateColor,
			timing,
			phases,
			motion,
			getSafeArea,
			getSafeBox,
			path,
			createMotionPath,
			layout: layout_exports
		});
		Object.assign(std.svg, base_exports);
		return std;
	}
	function decodeBase64(input) {
		const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		const clean = input.replace(/\s/g, "");
		if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean)) throw new TypeError("Invalid base64");
		const bytes = [];
		for (let i = 0; i < clean.length; i += 4) {
			const n = alphabet.indexOf(clean[i]) << 18 | alphabet.indexOf(clean[i + 1]) << 12 | (clean[i + 2] === "=" ? 0 : alphabet.indexOf(clean[i + 2])) << 6 | (clean[i + 3] === "=" ? 0 : alphabet.indexOf(clean[i + 3]));
			bytes.push(n >>> 16 & 255);
			if (clean[i + 2] !== "=") bytes.push(n >>> 8 & 255);
			if (clean[i + 3] !== "=") bytes.push(n & 255);
		}
		return new Uint8Array(bytes);
	}
	function createNativeRuntime() {
		const baseStdlib = createPreparedNativeStdlib();
		const sessions = /* @__PURE__ */ new Map();
		let nextId = 0;
		return {
			loadArtifact(payload) {
				const compiled = compileTemplate(payload.programCode);
				if (!compiled.media) throw compiled.error ?? /* @__PURE__ */ new Error("Expected a media artifact");
				const template = compiled.media;
				const faces = [];
				for (const font of payload.fonts ?? []) try {
					faces.push({
						family: font.family,
						weight: font.weight ?? 400,
						style: font.style ?? "normal",
						metrics: parseFontMetrics(decodeBase64(font.base64))
					});
				} catch {}
				const id = String(++nextId);
				sessions.set(id, {
					template,
					job: payload.job,
					measurer: createTextMeasurer(faces)
				});
				const { width, height, fps, durationSeconds, totalFrames, animated } = payload.job;
				return {
					id,
					width: Number(width),
					height: Number(height),
					fps: Number(fps),
					durationSeconds: Number(durationSeconds),
					totalFrames: Number(totalFrames),
					animated: Boolean(animated),
					editions: Object.keys(template.editions ?? {}),
					defaultData: {
						...template.sample,
						...payload.job.data ?? {}
					}
				};
			},
			sampleArtifact(id, request = {}) {
				const session = sessions.get(id);
				if (!session) throw new Error(`Unknown artifact: ${id}`);
				const { template, job, measurer } = session;
				const edition = request.edition ? template.editions?.[request.edition] : void 0;
				const width = request.width ?? edition?.size.width ?? Number(job.width);
				const height = request.height ?? edition?.size.height ?? Number(job.height);
				const fps = Number(job.fps);
				const totalFrames = Number(job.totalFrames);
				const duration = Number(job.durationSeconds);
				const frame = Math.max(0, Math.min(totalFrames - 1, Math.round(request.frame ?? Math.max(0, Math.min(duration, request.seconds ?? 0)) * fps)));
				const data = {
					...template.sample,
					...job.data ?? {},
					...request.data
				};
				const assetResolver = (key) => key;
				const ctx = job.animated ? createRenderContext(frame, fps, totalFrames, width, height, data, {}, assetResolver, void 0, void 0, void 0, baseStdlib) : job.medium === "svg" ? createSvgRenderContext(width, height, {
					data,
					assetResolver
				}, baseStdlib) : createImageRenderContext(width, height, {
					data,
					assetResolver
				}, baseStdlib);
				Object.assign(ctx, {
					scale: request.scale ?? 1,
					safeArea: request.safeArea ?? {
						top: 0,
						left: 0,
						bottom: 0,
						right: 0
					},
					reduceMotion: request.reduceMotion ?? false
				});
				return lowerDisplayList((edition?.render ?? template.render)(ctx), {
					width,
					height,
					measurer,
					...typeof job.background === "string" ? { background: job.background } : {},
					...request.strict !== void 0 ? { strict: request.strict } : {}
				});
			},
			disposeArtifact(id) {
				sessions.delete(id);
			}
		};
	}
	function installNativeRuntime(target = globalThis) {
		const runtime = createNativeRuntime();
		Object.assign(target, { __superimgNative: runtime });
		return runtime;
	}
	// packages/superimg-core/src/native/jsc-runtime-entry.ts
	installNativeRuntime(globalThis);
})();
