import { describe, expect, it } from "vitest";
import { createMediaIR } from "@superimg/types";
import {
  computeMediaIRHashes,
  diffMediaIR,
  queryMediaIR,
  serializeMediaIR,
  validateMediaIR,
} from "../ir/index.js";

describe("schema-0 Media IR", () => {
  it("uses final coordinates and opaque extension envelopes", () => {
    const base = createMediaIR({
      sourceId: "launch",
      entryId: "intro",
      variantId: "dark",
      editionId: "square",
    });
    const withoutHashes = {
      ...base,
      extensions: {
        "superimg/interactive": {
          schemaVersion: 0 as const,
          payload: {
            guideId: "tour",
            ownerDefined: { nested: [true, 7, null] },
          },
        },
      },
    };
    const ir = validateMediaIR({
      ...withoutHashes,
      hashes: computeMediaIRHashes(withoutHashes, base.hashes.programHash),
    });

    expect(ir.identity).toEqual({
      sourceId: "launch",
      entryId: "intro",
      variantId: "dark",
      editionId: "square",
    });
    expect(JSON.parse(serializeMediaIR(ir)).extensions).toEqual(ir.extensions);
  });

  it("accepts overlapping phases in author order", () => {
    const duration = 12;
    const ir = createMediaIR({
      durationSeconds: duration,
      phases: [
        { name: "stuck", start: 0, end: 4.8 / duration },
        { name: "out", start: 4.8 / duration, end: 11.8 / duration },
        { name: "hop", start: 1 / duration, end: 1.45 / duration },
      ],
    });
    const validated = validateMediaIR({
      ...ir,
      hashes: computeMediaIRHashes(ir, ir.hashes.programHash),
    });
    expect(validated.scenes[0]?.phases.map((phase) => phase.name)).toEqual(["stuck", "out", "hop"]);
  });

  it("rejects a phase that leaves [0, 1] or runs backwards", () => {
    const pastEnd = createMediaIR({ phases: [{ name: "late", start: 0.2, end: 1.01 }] });
    expect(() => validateMediaIR(pastEnd)).toThrow(/normalized inside \[0, 1\]/);
    const backwards = createMediaIR({ phases: [{ name: "back", start: 0.8, end: 0.2 }] });
    expect(() => validateMediaIR(backwards)).toThrow(/normalized inside \[0, 1\]/);
  });

  it("rejects nonzero schema versions", () => {
    expect(() => validateMediaIR({ ...createMediaIR(), schemaVersion: 1 })).toThrow(
      /Unsupported schemaVersion 1/,
    );
  });

  it("rejects fields outside the final schema-0 shape", () => {
    expect(() =>
      validateMediaIR({
        ...createMediaIR(),
        unknownField: true,
      }),
    ).toThrow(/MediaIR\.unknownField is not part of Media IR schema 0/);

    expect(() =>
      validateMediaIR({
        ...createMediaIR(),
        identity: {
          ...createMediaIR().identity,
          unexpectedCoordinate: "unknown",
        },
      }),
    ).toThrow(/identity\..+ is not part of Media IR schema 0/);

    const withUnknownRangeField = createMediaIR();
    expect(() =>
      validateMediaIR({
        ...withUnknownRangeField,
        scenes: [
          {
            ...withUnknownRangeField.scenes[0],
            range: {
              ...withUnknownRangeField.scenes[0]!.range,
              inclusive: true,
            },
          },
        ],
      }),
    ).toThrow(/scenes\[0\]\.range\.inclusive is not part of Media IR schema 0/);

    expect(() =>
      validateMediaIR({
        ...createMediaIR(),
        extensions: {
          "superimg/interactive": {
            schemaVersion: 0,
            payload: {},
            legacyField: true,
          },
        },
      }),
    ).toThrow(/extensions\.superimg\/interactive\.legacyField is not part of Media IR schema 0/);
  });

  it("rejects invalid schema-0 enum values", () => {
    expect(() =>
      validateMediaIR({
        ...createMediaIR(),
        capabilities: {
          ...createMediaIR().capabilities,
          temporal: "best-effort",
        },
      }),
    ).toThrow(/capabilities\.temporal must be one of canonical, sampled, opaque/);

    expect(() =>
      validateMediaIR({
        ...createMediaIR(),
        tracks: [
          {
            id: "music",
            kind: "soundtrack",
            sceneId: "default",
            range: { startFrame: 0, endFrame: 90 },
          },
        ],
      }),
    ).toThrow(/tracks\[0\]\.kind must be one of/);

    expect(() =>
      validateMediaIR({
        ...createMediaIR(),
        motions: [
          {
            id: "default::title",
            localId: "title",
            sceneId: "default",
            kind: "keyframes",
            enter: { startFrame: 0, endFrame: 30 },
          },
        ],
      }),
    ).toThrow(/motions\[0\]\.kind must be one of/);
  });

  it("preserves schema-0 clock, coverage, identity, and digest invariants", () => {
    const base = createMediaIR();

    expect(() =>
      validateMediaIR({
        ...base,
        clock: { ...base.clock, totalFrames: base.clock.totalFrames - 1 },
      }),
    ).toThrow(/totalFrames must equal/);

    expect(() =>
      validateMediaIR({
        ...base,
        scenes: [
          {
            ...base.scenes[0]!,
            range: { startFrame: 1, endFrame: base.clock.totalFrames },
          },
        ],
      }),
    ).toThrow(/scene ranges must be sorted and contiguous/);

    expect(() =>
      validateMediaIR({
        ...base,
        observations: {
          ...base.observations,
          markupRuns: [
            {
              ...base.observations.markupRuns[0]!,
              range: { startFrame: 1, endFrame: base.clock.totalFrames },
            },
          ],
        },
      }),
    ).toThrow(/markupRuns must be sorted and contiguous/);

    expect(() =>
      validateMediaIR({
        ...base,
        assets: [
          {
            id: "logo",
            kind: "image",
            src: "logo.png",
            remote: false,
          },
        ],
      }),
    ).toThrow(/needs contentHash or missing_asset issue/);

    expect(() =>
      validateMediaIR({
        ...base,
        hashes: { ...base.hashes, programHash: "b".repeat(64) },
      }),
    ).toThrow(/provenance\.programHash must equal hashes\.programHash/);
  });

  it("diffs and queries canonical motion coordinates", () => {
    const before = createMediaIR({ sourceId: "demo" });
    const after = createMediaIR({
      sourceId: "demo",
      override: {
        motions: [
          {
            id: "default::title.enter",
            localId: "title.enter",
            sceneId: "default",
            kind: "motion",
            enter: { startFrame: 0, endFrame: 20 },
          },
        ],
      },
    });

    expect(diffMediaIR(before, after).identity.added).toContain(
      "motion:default::title.enter",
    );
    expect(queryMediaIR(after, { motionId: "title.enter" }).motions).toHaveLength(1);
  });
});
