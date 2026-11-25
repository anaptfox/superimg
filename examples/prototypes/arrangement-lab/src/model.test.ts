import { test } from "node:test";
import assert from "node:assert/strict";
import { accept, controlSpec, evaluate, fields, newLane, patch, seed, validateControls } from "./model";
test("both control paths preserve the three arrangement contracts and card recipe", () => {
    for (const example of ["overlap", "comparison", "process", "brand"] as const) {
        const doc = seed(example);
        const result = evaluate(doc);
        assert.equal(result.ok, true, JSON.stringify(result.messages));
        assert.match(result.html!, example === "brand" ? /brand-card/ : /arrangement/);
        validateControls(controlSpec(doc, "message"), fields(doc, "message"));
    }
});
test("context changes editable fields and resolves enum choices from the arrangement schema", () => {
    const doc = seed("overlap");
    assert.deepEqual(fields(doc, "clock").find(f => f.path === "spec.timeRef.unit")?.options, ["ms", "s", "min", "hour", "day"]);
    assert(fields(doc, "track-0").some(f => f.path === "spec.tracks.0.intervals.0.end"));
    assert(!fields(doc, "clock").some(f => f.path.includes("question")));
});
test("a targeted edit preserves unrelated state and advances only on acceptance", () => {
    const lane = newLane("overlap");
    const edited = { ...lane, doc: patch(lane.doc, "spec.question", "When did the events overlap?") };
    assert.equal(lane.doc.spec.question, "Did these overlap?");
    assert.deepEqual(edited.doc.spec.tracks, lane.doc.spec.tracks);
    const next = accept(edited, 0);
    assert.equal(next.revision, 1);
    assert.deepEqual(next.accepted, edited.doc);
    assert.throws(() => accept(next, 0), /Stale revision/);
});
test("invalid shape, semantic failure, and unknown keys never replace the accepted preview", () => {
    const lane = newLane("overlap");
    const original = structuredClone(lane.accepted);
    for (const bad of [patch(lane.doc, "spec.question", ""), patch(lane.doc, "spec.tracks.0.intervals.0.end", -2), { ...lane.doc, unexpected: true }]) {
        assert.equal(evaluate(bad).ok, false);
        assert.throws(() => accept({ ...lane, doc: bad }, 0));
        assert.deepEqual(lane.accepted, original);
    }
});
test("catalog controls reject wrong props, dangling children and unauthorized bindings", () => {
    const doc = seed("process");
    const allowed = fields(doc, "message");
    const wrong = controlSpec(doc, "message");
    wrong.elements["spec.question"]!.props.value = { bad: true };
    assert.throws(() => validateControls(wrong, allowed));
    const dangling = controlSpec(doc, "message");
    dangling.elements.controls!.children!.push("absent");
    assert.throws(() => validateControls(dangling, allowed));
    const arbitrary = controlSpec(doc, "message");
    arbitrary.elements["spec.question"]!.props.path = "spec.nodes.0.id";
    assert.throws(() => validateControls(arbitrary, allowed), /Unapproved/);
});
test("brand recipe enforces content limits, theme catalog and literal text", () => {
    const card = seed("brand");
    assert.equal(evaluate(patch(card, "spec.headline", "x".repeat(73))).ok, false);
    assert.equal(evaluate(patch(card, "spec.theme", "invented")).ok, false);
    const text = evaluate(patch(card, "spec.headline", "<script>alert(1)</script>"));
    assert.equal(text.ok, true);
    assert(!text.html!.includes("<script>"));
    assert.deepEqual(fields(card, "brand").map(f => f.path), ["spec.theme"]);
});
