import { describe, expect, it } from "vitest";
import {
  acceptDraft,
  proposeDraft,
  type DraftDecision,
  type DraftStore,
} from "@foxworth/boundary/drafts";
import {
  admitAll,
  bindProjection,
  compileInteractions,
  installInteractions,
  projectInteractions,
  realizeDirect,
} from "@foxworth/boundary";
import { createDraft, type Draft } from "@foxworth/boundary/program";
import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";
import {
  MEDIA_ARTIFACT_ROTATE_CONTRACT,
  mediaArtifactRotate,
} from "./rotate-draft.js";

function createMemoryDraftStore(): DraftStore & { decisions: DraftDecision[] } {
  const byDigest = new Map<string, Draft>();
  const decisions: DraftDecision[] = [];
  return {
    decisions,
    put(draft) {
      byDigest.set(draft.draftDigest, draft);
    },
    get(draftDigest) {
      return byDigest.get(draftDigest);
    },
    list() {
      return Object.freeze([...byDigest.values()]);
    },
    recordDecision(decision) {
      decisions.push(decision);
    },
  };
}

describe("media.artifact.rotate draft flow", () => {
  it("accept never mutates the live Media Program; recompile shows missing-direct until realized", async () => {
    const liveBefore = MEDIA_COMPILED_INTERACTIONS.program;
    expect(
      liveBefore.interactions.some((entry) => entry.contract.id === "media.artifact.rotate"),
    ).toBe(false);

    const store = createMemoryDraftStore();
    const draft = createDraft({
      contract: MEDIA_ARTIFACT_ROTATE_CONTRACT,
      gap: "no interaction rotates an artifact raster today",
      proposer: "model",
      createdAt: "2026-09-06T12:00:00Z",
    });
    await proposeDraft(store, draft);
    const accepted = await acceptDraft(store, {
      draftDigest: draft.draftDigest,
      decidedBy: "author",
      decidedAt: "2026-09-06T12:05:00Z",
    });

    expect(accepted.contract.id).toBe("media.artifact.rotate");
    expect(MEDIA_COMPILED_INTERACTIONS.program).toBe(liveBefore);
    expect(store.decisions[0]?.status).toBe("accepted");

    const compiled = compileInteractions({ rotate: mediaArtifactRotate });
    const projection = projectInteractions(compiled, {
      rotate: {
        interaction: compiled.handles.rotate,
        modes: ["direct"],
      },
    });
    const missing = installInteractions(compiled, {
      installationId: "deploy:media:rotate-missing:1",
      bindings: [],
      realizationIds: {},
    });
    const bound = bindProjection(projection, missing.installation, { admit: admitAll });
    expect(bound.status).toBe("unrealized");
    if (bound.status !== "unrealized") throw new Error("expected unrealized");
    expect(bound.report.issues.map((issue) => issue.reason)).toEqual(["missing-direct"]);
    expect(bound.report.issues[0]?.interactionId).toBe("media.artifact.rotate");

    const realized = installInteractions(compiled, {
      installationId: "deploy:media:rotate-realized:1",
      realizations: {
        rotate: realizeDirect(() => ({ artifactId: "card" }), "demo:1:rotate"),
      },
    });
    const ready = bindProjection(projection, realized.installation, { admit: admitAll });
    expect(ready.status).toBe("bound");
  });
});
