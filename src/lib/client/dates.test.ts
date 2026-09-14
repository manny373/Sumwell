import { describe, expect, test } from "bun:test";
import {
  addDays,
  daysBetween,
  formatCycleRange,
  formatMonthDay,
  formatMonthYear,
  formatPayoffDateLabel,
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

  test("month-end boundaries: 31st-in-short-month clamps INSIDE the month", () => {
    // Due day 31 after Apr 20 → Apr 30 (April has 30 days), NOT May 1.
    expect(nextMonthlyOccurrence(31, "2026-04-20")).toBe("2026-04-30");
    // …and the next occurrence after that clamp is May 31 (never skipped).
    expect(nextMonthlyOccurrence(31, "2026-04-30")).toBe("2026-05-31");
    expect(nextMonthlyOccurrence(31, "2026-01-31")).toBe("2026-02-28");
    expect(nextMonthlyOccurrence(30, "2026-02-28")).toBe("2026-03-30");
  });

  test("formatPayoffDateLabel: multi-year payoff shows YEAR + months, never a bare day", () => {
    // 25 months out from Sep 2026 lands in Oct 2028 — the year must show.
    expect(formatPayoffDateLabel(25, "2028-10-01")).toBe("Oct 2028 (~25 months)");
    expect(formatPayoffDateLabel(3, "2026-12-01")).toBe("Dec 2026 (~3 months)");
    expect(formatMonthYear("2028-10-01")).toBe("Oct 2028");
    // Not paid within the modeled horizon — never labeled as a payoff.
    expect(formatPayoffDateLabel(null, null)).toBe("Beyond the modeled horizon");
    expect(formatPayoffDateLabel(25, null)).toBe("Beyond the modeled horizon");
  });

  test("formatCycleRange is wrap-safe and includes the year when crossing", () => {
    expect(formatCycleRange("2026-09-10", "2026-09-25")).toBe("Thu, Sep 10 – Fri, Sep 25");
    // Crossing into a new year → both ends carry the year.
    expect(formatCycleRange("2026-12-20", "2027-01-05")).toContain("2026");
    expect(formatCycleRange("2026-12-20", "2027-01-05")).toContain("2027");
  });
});