/**
 * Type-only exercise file for score().
 *
 * Not a runtime test. Purpose: prove that the migration examples from
 * DESIGN_score.md type-check against the declared shape. tsc --noEmit must
 * succeed for this file. Nothing is executed.
 */

import { score } from "./score.js";
import type {
  EasingSpec,
  MotionOpts,
  MotionResult,
  Score,
  TweenOpts,
  ValueOpts,
  ValueResult,
} from "./score.js";

// =============================================================================
// SHAPES — touch every member so TS checks them all
// =============================================================================

declare const s: Score<"enter" | "hold" | "exit">;

// probes
const _probe_progress: number = s.progress;
const _probe_seconds: number = s.seconds;
const _probe_active: "enter" | "hold" | "exit" | "idle" = s.active;
const _probe_within: number = s.within("enter");

// motion — minimal
const m1: MotionResult = s.motion();
const _opacity: number = m1.opacity;
const _transform: string = m1.transform;
const _filter: string = m1.filter;
const _style: string = m1.style;
const _enter: number = m1.enter;
const _exit: number = m1.exit;
const _visible: boolean = m1.visible;
const _phase: "before" | "entering" | "steady" | "exiting" | "after" = m1.phase;

// motion — with every option
const _m2: MotionResult = s.motion({
  x: 0,
  y: 20,
  scale: 0.8,
  rotate: -5,
  blur: 10,
  fromOpacity: 0,
  during: "enter",
  at: 0.15,
  duration: 0.8,
  easing: "easeOutCubic",
  exitEasing: "easeInCubic",
  exit: { y: -30 },
});

// motion with window escape hatch
const _m3: MotionResult = s.motion({ window: [0, 0.7] });

// tween — return is a scalar
const _tween_val: number = s.tween(0, 100, { during: "enter", at: 0.2 });

// tween — pattern
const _pulse: number = s.tween(1, 1.04, { during: "hold", pattern: "sine" });

// value — preserves input type, returns opacity companion
const v_num: ValueResult<number> = s.value(0.65, { fadeOn: "exit" });
const _vnum_current: number = v_num.current;
const _vnum_opacity: number = v_num.opacity;

const v_str: ValueResult<string> = s.value("Hello", { during: ["hold", "exit"] });
const _vstr_current: string = v_str.current;

// =============================================================================
// EASING specs — every variant must be assignable
// =============================================================================

const _e1: EasingSpec = "linear";
const _e2: EasingSpec = "easeOutCubic";
const _e3: EasingSpec = "easeOutBack";
const _e4: EasingSpec = "spring";
const _e5: EasingSpec = "spring(200,20)";
const _e6: EasingSpec = (t: number) => t * t;

// =============================================================================
// MIGRATION SAMPLES from DESIGN_score.md — all must type-check
// =============================================================================

// tweet.video.ts — editor-shortcuts dialect
{
  const t = score({ enter: 0.1, hold: 0.75, exit: 0.15 });
  const text = t.motion({ during: "hold", at: 0, duration: 0.8 });
  const metrics = t.motion({ during: "hold", at: 0.8 });
  void text;
  void metrics;
  // @ts-expect-error — "bogus" not in this template's phases
  t.motion({ during: "bogus" });
}

// stats-card.video.ts
{
  const t = score({ enter: 0.3, hold: 0.45, exit: 0.25 });
  const value = t.motion({ y: 15, at: 0.15 });
  void value;
}

// speaker-split.video.ts — techlahoma dialect with window
{
  const t = score({ enter: 0.08, hold: 0.83, exit: 0.09 });
  const photo = t.motion({ window: [0, 0.08] });
  void photo;
}

// list.video.ts — stagger
{
  const t = score({ enter: 0.15, hold: 0.7, exit: 0.15 });
  const items = ["a", "b", "c", "d", "e"];
  items.forEach((_item, i) => {
    const n = t.motion({
      scale: 0.5,
      at: i / items.length,
      easing: "easeOutElastic",
    });
    void n;
  });
}

// Custom phase names — `during` is typed
{
  const t = score({ intro: 0.1, reveal: 0.4, settle: 0.35, outro: 0.15 });
  const hero = t.motion({ during: "reveal", at: 0.2 });
  const subtitle = t.motion({ during: "settle" });
  const _prog: number = t.within("outro");
  const _active: "intro" | "reveal" | "settle" | "outro" | "idle" = t.active;
  void hero;
  void subtitle;
  // @ts-expect-error — "hold" isn't in this layout
  t.within("hold");
}

// Default phase layout (no arg)
{
  const t = score();
  const card = t.motion({ during: "enter" });
  const body = t.motion({ during: "hold", at: 0.3 });
  const _prog: number = t.within("exit");
  void card;
  void body;
}

// exit: false keeps an element pinned after entering
{
  const t = score({ enter: 0.1, hold: 0.8, exit: 0.1 });
  const watermark = t.motion({ exit: false });
  void watermark;
}

// exit: custom direction
{
  const t = score();
  const banner = t.motion({ y: 40, exit: { y: -40 } });
  void banner;
}

// =============================================================================
// NEGATIVE CASES — must NOT type-check
// =============================================================================

declare const t2: Score<"enter" | "hold" | "exit">;

// @ts-expect-error — `during` must match the phase layout
t2.motion({ during: "bogus" });

// @ts-expect-error — `within` requires a known phase name
t2.within("idle");

// @ts-expect-error — probe fields are read-only
t2.progress = 0.5;

// Opts type parameter flows through correctly
type HasDuring<P extends string> = MotionOpts<P>["during"];
type _check1 = Exclude<HasDuring<"a" | "b">, undefined>;
const _hd: _check1 = "a";
// @ts-expect-error — "c" not in the P
const _hd_bad: _check1 = "c";
void _hd;
void _hd_bad;

// TweenOpts / ValueOpts constrained the same way
type _Tween = TweenOpts<"enter" | "hold">;
const _to: _Tween = { during: "enter", at: 0.2, pattern: "sine" };
// @ts-expect-error — phase name out of range
const _to_bad: _Tween = { during: "exit" };
void _to;
void _to_bad;

type _Value = ValueOpts<"a" | "b">;
const _vo_single: _Value = { fadeOn: "a" };
const _vo_array: _Value = { fadeOn: ["a", "b"] };
// @ts-expect-error — "c" not allowed
const _vo_bad: _Value = { fadeOn: "c" };
void _vo_single;
void _vo_array;
void _vo_bad;
