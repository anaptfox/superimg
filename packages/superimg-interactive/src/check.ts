//! Interactive semantic contract checks, separate from neutral media checks.

import type { SceneGuide, SceneSnapshot } from "./contracts.js";

export interface InteractiveCheckIssue {
  readonly code:
    | "INTERACTIVE_STATE_UNKNOWN"
    | "INTERACTIVE_NODE_UNKNOWN"
    | "INTERACTIVE_FOCUS_UNKNOWN";
  readonly message: string;
  readonly stepId: string;
}

export interface InteractiveCheckResult {
  readonly ok: boolean;
  readonly issues: readonly InteractiveCheckIssue[];
}

export function checkInteractiveScene(
  snapshot: SceneSnapshot,
  guide: SceneGuide,
): InteractiveCheckResult {
  const nodes = new Set(snapshot.nodes.map((node) => node.id));
  const states = new Set(Object.keys(snapshot.states));
  const issues: InteractiveCheckIssue[] = [];
  for (const step of guide.steps) {
    if (step.scene.state && !states.has(step.scene.state)) {
      issues.push({
        code: "INTERACTIVE_STATE_UNKNOWN",
        stepId: step.id,
        message: `Guide step \"${step.id}\" references unknown state \"${step.scene.state}\"`,
      });
    }
    for (const operation of step.scene.operations ?? []) {
      if (!nodes.has(operation.target)) {
        issues.push({
          code: "INTERACTIVE_NODE_UNKNOWN",
          stepId: step.id,
          message: `Guide step \"${step.id}\" references unknown node \"${operation.target}\"`,
        });
      }
    }
    for (const target of [step.scene.camera?.fit?.target, step.scene.camera?.follow?.target]) {
      if (target && !nodes.has(target)) {
        issues.push({
          code: "INTERACTIVE_NODE_UNKNOWN",
          stepId: step.id,
          message: `Guide step \"${step.id}\" references unknown camera node \"${target}\"`,
        });
      }
    }
    if (step.focusNodeId && !nodes.has(step.focusNodeId)) {
      issues.push({
        code: "INTERACTIVE_FOCUS_UNKNOWN",
        stepId: step.id,
        message: `Guide step \"${step.id}\" references unknown focus node \"${step.focusNodeId}\"`,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}
