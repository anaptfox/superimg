//! Browser-safe craft linter over MediaIR motions. O(motions), no rendering.
//! Opinion-only (CRAFT_IR_*): correctness problems (zero-frame motions, NaN)
//! belong in capabilities.issues, never here. Thresholds cite
//! skills/animator/references/motion-craft.md; rules without a direct quote are
//! marked "inferred".

import type {
  MediaIREasing,
  MediaIRFrameRange,
  MediaIRMotion,
  MediaIR,
} from "@superimg/types";

export interface MediaIRLintIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  suggestion: string;
  motionId?: string;
  sceneId?: string;
  frame?: number;
}

export interface MediaIRLintOptions {
  /** CRAFT_IR_* codes to suppress. */
  disable?: string[];
  /** Escalate non-info issues to error (check --craft-strict). */
  strict?: boolean;
}

/** Properties where linear easing is legitimate: loops, fills, drift. */
const LINEAR_SAFE_PROPERTIES = new Set([
  "rotate",
  "rotation",
  "progress",
  "offset",
  "marquee",
  "drift",
]);

/** Phase names treated as read/hold windows (mirrors critique guessHoldPhase). */
const HOLD_PHASE_RE = /^(hold|main|body|read|steady)/i;

const OVERSHOOT_NAME_RE = /back|elastic|bounce/i;

const frames = (r: MediaIRFrameRange): number => r.endFrame - r.startFrame;

const easingKey = (e: MediaIREasing | undefined): string => {
  if (!e) return "default";
  if (e.kind === "named") return `named:${e.name}`;
  return `spring:${e.stiffness}/${e.damping}/${e.mass ?? 1}`;
};

const isLinear = (m: MediaIRMotion): boolean =>
  (m.easing?.kind === "named" && m.easing.name === "linear") ||
  (m.easing === undefined && m.pattern === "linear");

/** Underdamped spring: damping < 2·√(stiffness·mass) → oscillates/overshoots. */
const isUnderdampedSpring = (e: MediaIREasing | undefined): boolean =>
  e?.kind === "spring" && e.damping < 2 * Math.sqrt(e.stiffness * (e.mass ?? 1));

const isOvershoot = (e: MediaIREasing | undefined): boolean =>
  (e?.kind === "named" && OVERSHOOT_NAME_RE.test(e.name)) || isUnderdampedSpring(e);

type Rule = (ir: MediaIR, push: (issue: MediaIRLintIssue) => void) => void;

const lintLinearNonLoop: Rule = (ir, push) => {
  for (const m of ir.motions) {
    if (m.kind === "sampled" || !isLinear(m)) continue;
    if (m.property !== undefined && LINEAR_SAFE_PROPERTIES.has(m.property)) continue;
    push({
      severity: "warning",
      code: "CRAFT_IR_LINEAR_NON_LOOP",
      // motion-craft.md: "linear — rotation loops, marquees, progress fills… nothing else"
      message: `Motion "${m.id}" uses linear easing on ${m.property ?? "positional"} motion`,
      suggestion: "Use an easeOut*/spring curve; reserve linear for loops and progress fills",
      motionId: m.id,
      sceneId: m.sceneId,
      frame: m.enter.startFrame,
    });
  }
};

const lintExitNotFaster: Rule = (ir, push) => {
  for (const m of ir.motions) {
    if (!m.exit) continue;
    const enterLen = frames(m.enter);
    const exitLen = frames(m.exit);
    if (enterLen <= 0 || exitLen <= enterLen * 1.05) continue;
    push({
      severity: "warning",
      code: "CRAFT_IR_EXIT_NOT_FASTER",
      // motion-craft.md: "Exits ~25% faster than enters"
      message: `Motion "${m.id}" exits slower than it enters (${exitLen} vs ${enterLen} frames)`,
      suggestion: "Make the exit ~25% faster than the enter",
      motionId: m.id,
      sceneId: m.sceneId,
      frame: m.exit.startFrame,
    });
  }
};

const lintOvershootOnExit: Rule = (ir, push) => {
  for (const m of ir.motions) {
    if (!m.exit || !isOvershoot(m.exitEasing)) continue;
    push({
      severity: "warning",
      code: "CRAFT_IR_OVERSHOOT_ON_EXIT",
      // motion-craft.md: "Entrances only. Never overshoot an exit."
      message: `Motion "${m.id}" overshoots on exit (${easingKey(m.exitEasing)})`,
      suggestion: "Exit with easeIn*/critically-damped settle; overshoot is for entrances only",
      motionId: m.id,
      sceneId: m.sceneId,
      frame: m.exit.startFrame,
    });
  }
};

const lintNoEasingContrast: Rule = (ir, push) => {
  const byScene = new Map<string, MediaIRMotion[]>();
  for (const m of ir.motions) {
    if (m.kind === "sampled" || !m.easing) continue;
    (byScene.get(m.sceneId) ?? byScene.set(m.sceneId, []).get(m.sceneId)!).push(m);
  }
  for (const [sceneId, motions] of byScene) {
    if (motions.length < 4) continue;
    const distinct = new Set(motions.map((m) => easingKey(m.easing)));
    if (distinct.size > 1) continue;
    push({
      severity: "info",
      code: "CRAFT_IR_NO_EASING_CONTRAST",
      // Inferred from staging principle + curve-selection table (no direct quote).
      message: `Scene "${sceneId}": all ${motions.length} motions share one easing (${[...distinct][0]})`,
      suggestion: "Vary curves to create hierarchy — hero motions earn expressive easing, support stays plain",
      sceneId,
    });
  }
};

const lintHoldOccupiedByMotion: Rule = (ir, push) => {
  for (const scene of ir.scenes) {
    const sceneLen = frames(scene.range);
    for (const phase of scene.phases) {
      if (!HOLD_PHASE_RE.test(phase.name)) continue;
      const phaseStart = scene.range.startFrame + Math.floor(phase.start * sceneLen);
      const phaseEnd = scene.range.startFrame + Math.ceil(phase.end * sceneLen);
      if (phaseEnd <= phaseStart) continue;
      for (const m of ir.motions) {
        if (m.sceneId !== scene.id) continue;
        const spans = [m.enter, ...(m.exit ? [m.exit] : [])];
        const covering = spans.find(
          (s) => s.startFrame <= phaseStart && s.endFrame >= phaseEnd,
        );
        if (!covering) continue;
        push({
          severity: "warning",
          code: "CRAFT_IR_HOLD_OCCUPIED_BY_MOTION",
          // motion-craft.md deceleration-tail principle; only detectable with IR frame data.
          message: `Motion "${m.id}" moves through the entire "${phase.name}" phase — content never settles`,
          suggestion: "End the move before the hold so the frame reads at rest",
          motionId: m.id,
          sceneId: scene.id,
          frame: phaseStart,
        });
      }
    }
  }
};

const siblingGroups = (ir: MediaIR): MediaIRMotion[][] => {
  const groups = new Map<string, MediaIRMotion[]>();
  for (const m of ir.motions) {
    if (m.kind === "sampled") continue;
    const key = `${m.sceneId}|${m.kind}|${m.property ?? ""}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }
  return [...groups.values()].filter((g) => g.length >= 3);
};

const lintStaggerCollision: Rule = (ir, push) => {
  for (const group of siblingGroups(ir)) {
    const starts = group.map((m) => m.enter.startFrame);
    if (Math.max(...starts) - Math.min(...starts) > 1) continue;
    push({
      severity: "warning",
      code: "CRAFT_IR_STAGGER_COLLISION",
      // motion-craft.md stagger math section.
      message: `${group.length} sibling motions in "${group[0]!.sceneId}" start on the same frame`,
      suggestion: "Stagger sibling entrances (std.stagger) instead of firing them together",
      motionId: group[0]!.id,
      sceneId: group[0]!.sceneId,
      frame: Math.min(...starts),
    });
  }
};

const lintStaggerTooTight: Rule = (ir, push) => {
  for (const group of siblingGroups(ir)) {
    const sorted = [...group].sort((a, b) => a.enter.startFrame - b.enter.startFrame);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i]!.enter.startFrame - sorted[i - 1]!.enter.startFrame);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap <= 1) continue; // collision rule's territory
    const avgDur =
      sorted.reduce((a, m) => a + frames(m.enter), 0) / sorted.length;
    if (avgDur >= 3 * avgGap) continue;
    push({
      severity: "info",
      code: "CRAFT_IR_STAGGER_TOO_TIGHT",
      // motion-craft.md: "item duration ≥ 3–5× stagger interval… 100ms items with 100ms gaps fire like a machine gun"
      message: `Staggered siblings in "${sorted[0]!.sceneId}" overlap too little (avg ${Math.round(avgDur)}f items, ${Math.round(avgGap)}f gaps)`,
      suggestion: "Lengthen item duration to ≥3× the stagger interval so items overlap",
      motionId: sorted[0]!.id,
      sceneId: sorted[0]!.sceneId,
      frame: sorted[0]!.enter.startFrame,
    });
  }
};

const lintAsymmetricPop: Rule = (ir, push) => {
  for (const m of ir.motions) {
    if (!m.exit || frames(m.exit) < 3 || frames(m.enter) > 1) continue;
    push({
      severity: "warning",
      code: "CRAFT_IR_ASYMMETRIC_POP",
      // Inferred from weight/settle + exits-faster-than-enters framing.
      message: `Motion "${m.id}" pops in (${frames(m.enter)}f) but eases out (${frames(m.exit)}f) — backwards`,
      suggestion: "Give the entrance the longer, eased move; keep the exit quick",
      motionId: m.id,
      sceneId: m.sceneId,
      frame: m.enter.startFrame,
    });
  }
};

const lintLongEnter: Rule = (ir, push) => {
  const fps = ir.clock.fps > 0 ? ir.clock.fps : 30;
  for (const m of ir.motions) {
    const seconds = frames(m.enter) / fps;
    if (seconds <= 1.0) continue;
    push({
      severity: "info",
      code: "CRAFT_IR_LONG_ENTER",
      // motion-craft.md: functional moves stay at UI speed; emphasis moments run 1.5-2× longer.
      message: `Motion "${m.id}" enters over ${seconds.toFixed(2)}s`,
      suggestion: "Fine for a deliberate hero/emphasis moment; tighten if this is a functional move",
      motionId: m.id,
      sceneId: m.sceneId,
      frame: m.enter.startFrame,
    });
  }
};

const RULES: Rule[] = [
  lintLinearNonLoop,
  lintExitNotFaster,
  lintOvershootOnExit,
  lintNoEasingContrast,
  lintHoldOccupiedByMotion,
  lintStaggerCollision,
  lintStaggerTooTight,
  lintAsymmetricPop,
  lintLongEnter,
];

export function lintMediaIR(
  ir: MediaIR,
  options: MediaIRLintOptions = {},
): MediaIRLintIssue[] {
  const disabled = new Set(options.disable ?? []);
  const issues: MediaIRLintIssue[] = [];
  const push = (issue: MediaIRLintIssue) => {
    if (disabled.has(issue.code)) return;
    issues.push(
      options.strict && issue.severity !== "info"
        ? { ...issue, severity: "error" }
        : issue,
    );
  };
  for (const rule of RULES) rule(ir, push);
  return issues.sort(
    (a, b) => (a.frame ?? 0) - (b.frame ?? 0) || a.code.localeCompare(b.code),
  );
}
