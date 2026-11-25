import { describe, expect, it } from "vitest";
import { setShotHold } from "./index.js";

describe("setShotHold", () => {
  it("preserves all bytes except the hold value, including CRLF and ignored code fences", () => {
    const source = "# Film\r\n\r\n~~~md\r\n```shot id=one hold=99\r\n~~~\r\n```shot\tid=one  hold=2.00 still=1  extra=x \t\r\n  Hello!  \r\n```\r\n";
    expect(setShotHold(source, { id: "one", seconds: 3.2 }).text).toBe(source.replace("hold=2.00", "hold=3.2"));
  });
  it("inserts a hold without changing trailing whitespace", () => {
    const source = "```shot id=one\t \nHello\n```";
    expect(setShotHold(source, { id: "one", seconds: 2 }).text).toBe("```shot id=one hold=2\t \nHello\n```");
  });
  it("rejects ambiguous ids, duplicate holds, invalid seconds and still beyond hold", () => {
    const shot = "```shot id=x hold=4 still=2\nHi\n```\n";
    expect(() => setShotHold(shot + shot, { id: "x", seconds: 3 })).toThrow();
    expect(() => setShotHold(shot.replace("hold=4", "hold=4 hold=5"), { id: "x", seconds: 3 })).toThrow();
    expect(() => setShotHold(shot, { id: "x", seconds: 1 })).toThrow();
    expect(() => setShotHold(shot, { id: "x", seconds: NaN })).toThrow();
  });
});
