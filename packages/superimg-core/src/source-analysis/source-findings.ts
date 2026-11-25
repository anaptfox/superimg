import type {
  JsonObject,
  RuntimeFinding,
  ValidationIssue,
} from "@superimg/types";
import {
  scanSourceFootguns,
  type SourceFootgunOptions,
} from "../validation/scanners.js";

/**
 * Return portable, machine-oriented findings that can be produced from source
 * text without loading the authored module or executing a collection provider.
 */
export function analyzeMediaSourceFindings(
  source: string,
  options: SourceFootgunOptions = {},
): readonly RuntimeFinding[] {
  return Object.freeze(
    scanSourceFootguns(source, options).map((issue) =>
      Object.freeze(validationIssueToRuntimeFinding(issue))
    ),
  );
}

function validationIssueToRuntimeFinding(issue: ValidationIssue): RuntimeFinding {
  const details: JsonObject = {};
  if (issue.context !== undefined) details.context = issue.context;
  if (issue.frame !== undefined) details.frame = issue.frame;
  if (issue.progress !== undefined) details.progress = issue.progress;
  if (issue.nodeId !== undefined) details.nodeId = issue.nodeId;
  if (issue.nodePath !== undefined) details.nodePath = issue.nodePath;
  if (issue.relatedIds !== undefined) details.relatedIds = [...issue.relatedIds];

  return {
    severity: issue.severity,
    category: "authoring",
    code: issue.code,
    message: issue.message,
    ...(issue.suggestion === undefined ? {} : { suggestion: issue.suggestion }),
    ...(Object.keys(details).length === 0 ? {} : { details }),
  };
}
