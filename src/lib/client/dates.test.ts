import { describe, expect, test } from "bun:test";
import {
  addDays,
  daysBetween,
  formatMonthDay,
  formatWeekdayMonthDay,
  nextMonthlyOccurrence,
  parseISODate,
  relativeDaysLabel,
} from "./dates";

describe("dates", () => {
  test("parseISODate round-trips and rejects junk", () => {
    expect(parseISODate("2026-09-12")).toEqual({ y: 2026, m: 9, d: 12 });
    expect(() => parseISODate("2026-13-01")).toThrow();
    expect(() => parseISODate("not-a-date")).toThrow();
  });

  test("addDays stays month- and year-aware", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 2)).toBe("2027-01-02");
    expect(addDays("2026-09-11", -1)).toBe("2026-09-10");
  });

  test("daysBetween is exact in both directions", () => {
    expect(daysBetween("2026-09-12", "2026-09-25")).toBe(13);
    expect(daysBetween("2026-09-25", "2026-09-12")).toBe(-13);
    expect(daysBetween("2026-09-01", "2026-10-01")).toBe(30);
  });

  test("nextMonthlyOccurrence: same-month, month rollover, year rollover", () => {
    expect(nextMonthlyOccurrence(15, "2026-09-10")).toBe("2026-09-15");
    expect(nextMonthlyOccurrence(1, "2026-09-10")).toBe("2026-10-01");
    expect(nextMonthlyOccurrence(1, "2026-12-10")).toBe("2027-01-01");
    // Strictly after — a bill due day 12, after Sep 11, lands Sep 12.
    expect(nextMonthlyOccurrence(12, "2026-09-11")).toBe("2026-09-12");
  });

  test("nextMonthlyOccurrence clamps impossible days to month length", () => {
    expect(nextMonthlyOccurrence(31, "2026-09-10")).toBe("2026-09-30");
    expect(nextMonthlyOccurrence(31, "2026-09-30")).toBe("2026-10-31");
    // 2024 is a leap year.
    expect(nextMonthlyOccurrence(29, "2024-02-10")).toBe("2024-02-29");
    // 2026 is not.
    expect(nextMonthlyOccurrence(29, "2026-02-10")).toBe("2026-02-28");
  });

  test("formatting helpers are deterministic (UTC-anchored)", () => {
    expect(formatMonthDay("2026-09-25")).toBe("Sep 25");
    expect(formatWeekdayMonthDay("2026-09-25")).toBe("Fri, Sep 25");
  });

  test("relativeDaysLabel covers today/tomorrow/N days", () => {
    expect(relativeDaysLabel(0)).toBe("today");
    expect(relativeDaysLabel(1)).toBe("tomorrow");
    expect(relativeDaysLabel(13)).toBe("in 13 days");
    expect(() => relativeDaysLabel(-1)).toThrow();
  });
});