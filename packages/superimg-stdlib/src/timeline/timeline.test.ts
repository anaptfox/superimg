import { describe, it, expect } from "vitest";
import { timeline } from "./timeline.js";

describe("timeline", () => {
  it("creates a timeline with current time and duration", () => {
    const tl = timeline(2.5, 10);
    expect(tl).toBeDefined();
  });
});

describe("at()", () => {
  it("creates an event with correct properties", () => {
    const tl = timeline(0, 10);
    const event = tl.at("enter", 0, 2);
    expect(event.id).toBe("enter");
    expect(event.start).toBe(0);
    expect(event.end).toBe(2);
    expect(event.duration).toBe(2);
  });

  it("calculates progress = 0 before event starts", () => {
    const tl = timeline(0, 10);
    const event = tl.at("later", 5, 2);
    expect(event.progress).toBe(0);
    expect(event.active).toBe(false);
  });

  it("calculates progress during event", () => {
    const tl = timeline(1, 10);
    const event = tl.at("test", 0, 2);
    expect(event.progress).toBe(0.5);
    expect(event.active).toBe(true);
  });

  it("calculates progress = 1 after event ends", () => {
    const tl = timeline(5, 10);
    const event = tl.at("early", 0, 2);
    expect(event.progress).toBe(1);
    expect(event.active).toBe(false);
  });

  // BOUNDARY PRECISION (from plan)
  it("progress = 0 at exact start boundary", () => {
    const tl = timeline(5, 10);
    const event = tl.at("test", 5, 2);
    expect(event.progress).toBe(0);
  });

  it("progress = 1 at exact end boundary", () => {
    const tl = timeline(7, 10);
    const event = tl.at("test", 5, 2);
    expect(event.progress).toBe(1);
  });
});

describe("get()", () => {
  it("retrieves previously created event", () => {
    const tl = timeline(1, 10);
    tl.at("enter", 0, 2);
    const event = tl.get("enter");
    expect(event.id).toBe("enter");
    expect(event.progress).toBe(0.5);
  });

  it("throws for unknown event id", () => {
    const tl = timeline(0, 10);
    expect(() => tl.get("nonexistent")).toThrow();
  });

  it("recalculates progress at current time", () => {
    const tl = timeline(1, 10);
    tl.at("test", 0, 2);
    // get() should return progress at current time (1), not creation time
    expect(tl.get("test").progress).toBe(0.5);
  });
});

describe("current()", () => {
  it("returns null when no events defined", () => {
    const tl = timeline(0, 10);
    expect(tl.current()).toBeNull();
  });

  it("returns null when no event is active", () => {
    const tl = timeline(5, 10);
    tl.at("early", 0, 2);
    expect(tl.current()).toBeNull();
  });

  it("returns active event", () => {
    const tl = timeline(1, 10);
    tl.at("first", 0, 2);
    tl.at("second", 3, 2);
    const current = tl.current();
    expect(current?.id).toBe("first");
  });

  it("returns first active when multiple overlap", () => {
    const tl = timeline(1, 10);
    tl.at("a", 0, 3);
    tl.at("b", 0.5, 3);
    // Both active at time=1, should return first defined
    const current = tl.current();
    expect(current?.id).toBe("a");
  });
});

describe("follow()", () => {
  it("creates event after another with gap", () => {
    const tl = timeline(0, 10);
    tl.at("first", 0, 2);
    const second = tl.follow("first", { id: "second", gap: 0.5, duration: 1 });
    expect(second.start).toBe(2.5); // first.end (2) + gap (0.5)
    expect(second.end).toBe(3.5);
    expect(second.duration).toBe(1);
  });

  it("defaults gap to 0", () => {
    const tl = timeline(0, 10);
    tl.at("first", 0, 2);
    const second = tl.follow("first", { id: "second", duration: 1 });
    expect(second.start).toBe(2); // Immediately after
  });

  it("throws if afterId does not exist", () => {
    const tl = timeline(0, 10);
    expect(() => tl.follow("nonexistent", { id: "x", duration: 1 })).toThrow();
  });

  it("can chain multiple follow calls", () => {
    const tl = timeline(0, 10);
    tl.at("a", 0, 1);
    tl.follow("a", { id: "b", duration: 1 });
    const c = tl.follow("b", { id: "c", gap: 0.5, duration: 1 });
    expect(c.start).toBe(2.5); // a(0-1) + b(1-2) + gap(0.5) = 2.5
  });
});

describe("stagger()", () => {
  it("creates events with calculated offsets", () => {
    const tl = timeline(0, 10);
    const result = tl.stagger(["a", "b", "c"], {
      start: 0,
      each: 0.2,
      duration: 0.5,
    });

    const a = result.get("a");
    const b = result.get("b");
    const c = result.get("c");

    expect(a.start).toBe(0);
    expect(b.start).toBe(0.2);
    expect(c.start).toBe(0.4);

    expect(a.duration).toBe(0.5);
    expect(b.duration).toBe(0.5);
    expect(c.duration).toBe(0.5);
  });

  it("supports get by index", () => {
    const tl = timeline(0, 10);
    const result = tl.stagger(["x", "y"], { each: 0.1, duration: 0.3 });
    expect(result.get(0).id).toBe("x");
    expect(result.get(1).id).toBe("y");
  });

  it("all() returns all events", () => {
    const tl = timeline(0, 10);
    const result = tl.stagger(["a", "b"], { each: 0.1, duration: 0.3 });
    const all = result.all();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe("a");
    expect(all[1].id).toBe("b");
  });

  it("map() transforms all events", () => {
    const tl = timeline(0.15, 10);
    const result = tl.stagger(["a", "b"], { each: 0.1, duration: 0.3 });
    const progresses = result.map((e) => e.progress);
    expect(progresses[0]).toBe(0.5); // time=0.15, a starts at 0, duration 0.3
    expect(progresses[1]).toBeCloseTo(0.167, 2); // time=0.15, b starts at 0.1
  });

  it("calculates each from totalDuration if provided", () => {
    const tl = timeline(0, 10);
    // 3 items, total 1.0s, each item 0.5s duration
    // each = (1.0 - 0.5) / (3 - 1) = 0.25
    const result = tl.stagger(["a", "b", "c"], {
      totalDuration: 1.0,
      duration: 0.5,
    });

    expect(result.get("a").start).toBe(0);
    expect(result.get("b").start).toBeCloseTo(0.25, 5);
    expect(result.get("c").start).toBeCloseTo(0.5, 5);
  });

  it("defaults start to 0", () => {
    const tl = timeline(0, 10);
    const result = tl.stagger(["a"], { each: 0.1, duration: 0.3 });
    expect(result.get("a").start).toBe(0);
  });
});

describe("scope()", () => {
  it("returns a new timeline re-zeroed to scope start", () => {
    const tl = timeline(3, 10);
    const scoped = tl.scope(2, 5);
    // Time 3 globally = time 1 in scope (3 - 2)
    const event = scoped.at("test", 0, 3);
    expect(event.start).toBe(0); // Relative to scope
    expect(event.end).toBe(3);
    expect(event.progress).toBeCloseTo(1 / 3, 5); // 1 / 3
  });

  it("progress is relative to scope, not global", () => {
    const tl = timeline(3, 10);
    const scoped = tl.scope(2, 5);
    // Scope is 2-5 (3 seconds). Time 3 = 1 second into scope
    const event = scoped.at("test", 0, 3);
    expect(event.progress).toBeCloseTo(1 / 3, 5);
  });

  it("start/end are relative to scope", () => {
    const tl = timeline(0, 10);
    const scoped = tl.scope(2, 5);
    const event = scoped.at("local", 0, 1);
    expect(event.start).toBe(0);
    expect(event.end).toBe(1);
  });

  // NESTED SCOPE (from plan - CRITICAL)
  it("nested scopes re-zero further", () => {
    const tl = timeline(3, 10);
    const outer = tl.scope(2, 6); // time = 1 in outer scope
    const inner = outer.scope(0, 2); // time = 1 in inner scope
    const e = inner.at("x", 0, 2);
    expect(e.progress).toBe(0.5); // 1 / 2
  });

  // CURRENT() RETURNS LOCAL IDS (from plan - CRITICAL)
  it("current() returns LOCAL ids only", () => {
    const tl = timeline(3, 10);
    tl.at("global", 0, 10); // Global event

    const scoped = tl.scope(2, 5);
    scoped.at("local", 0, 3); // Local event

    // current() on scoped should return local event, not global
    const current = scoped.current();
    expect(current?.id).toBe("local");
  });

  it("get() only finds events in this scope", () => {
    const tl = timeline(0, 10);
    tl.at("global", 0, 5);

    const scoped = tl.scope(0, 5);
    scoped.at("local", 0, 2);

    expect(scoped.get("local").id).toBe("local");
    expect(() => scoped.get("global")).toThrow(); // Not visible in scope
  });

  it("handles time before scope start", () => {
    const tl = timeline(0, 10); // Time 0 is before scope start
    const scoped = tl.scope(2, 5);
    const event = scoped.at("test", 0, 1);
    expect(event.progress).toBe(0); // Not started yet
  });

  it("handles time after scope end", () => {
    const tl = timeline(10, 10); // Time 10 is after scope end
    const scoped = tl.scope(2, 5);
    const event = scoped.at("test", 0, 3);
    expect(event.progress).toBe(1); // Already completed
  });
});

describe("edge cases", () => {
  it("handles zero-duration event", () => {
    const tl = timeline(1, 10);
    const event = tl.at("instant", 1, 0);
    expect(event.progress).toBe(1); // Immediately complete
    expect(event.active).toBe(false);
  });

  it("handles negative time (before timeline)", () => {
    const tl = timeline(-1, 10);
    const event = tl.at("test", 0, 2);
    expect(event.progress).toBe(0);
  });

  it("handles time beyond duration", () => {
    const tl = timeline(15, 10);
    const event = tl.at("test", 0, 2);
    expect(event.progress).toBe(1);
  });

  it("multiple timelines are independent", () => {
    const tl1 = timeline(1, 10);
    const tl2 = timeline(5, 10);

    tl1.at("a", 0, 2);
    tl2.at("a", 0, 2);

    expect(tl1.get("a").progress).toBe(0.5);
    expect(tl2.get("a").progress).toBe(1);
  });
});
