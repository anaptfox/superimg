import { describe, expect, it } from "vitest";
import { daysInMonth, firstWeekdayOfMonth } from "./monthly-events.media";

describe("monthly-events calendar", () => {
  it("uses the month and year even when no event supplies a weekday", () => {
    expect(firstWeekdayOfMonth("March", "2026")).toBe(0);
    expect(firstWeekdayOfMonth("September", "2026")).toBe(2);
    expect(firstWeekdayOfMonth("February", "2000")).toBe(2);
  });

  it("observes the Gregorian century exception for leap years", () => {
    expect(daysInMonth("February", "2024")).toBe(29);
    expect(daysInMonth("February", "2025")).toBe(28);
    expect(daysInMonth("February", "1900")).toBe(28);
    expect(daysInMonth("February", "2000")).toBe(29);
    expect(daysInMonth("February", "2100")).toBe(28);
    expect(daysInMonth("April", "2026")).toBe(30);
  });
});
