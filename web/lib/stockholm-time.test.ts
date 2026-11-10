import { describe, expect, it } from "vitest";
import { isoWeek, periodKey, stockholmDate } from "./stockholm-time";

const at = (iso: string) => new Date(iso);

describe("stockholmDate", () => {
  it("rolls over at Stockholm midnight, not UTC midnight (winter, UTC+1)", () => {
    expect(stockholmDate(at("2026-11-10T22:59:59Z"))).toBe("2026-11-10");
    expect(stockholmDate(at("2026-11-10T23:00:00Z"))).toBe("2026-11-11");
  });

  it("rolls over at Stockholm midnight in summer time (UTC+2)", () => {
    expect(stockholmDate(at("2026-06-30T21:59:59Z"))).toBe("2026-06-30");
    expect(stockholmDate(at("2026-06-30T22:00:00Z"))).toBe("2026-07-01");
  });

  it("handles the DST switch nights", () => {
    // Spring forward: 2026-03-29 02:00 CET → 03:00 CEST
    expect(stockholmDate(at("2026-03-28T23:30:00Z"))).toBe("2026-03-29");
    expect(stockholmDate(at("2026-03-29T01:30:00Z"))).toBe("2026-03-29");
    // Fall back: 2026-10-25 03:00 CEST → 02:00 CET
    expect(stockholmDate(at("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
    expect(stockholmDate(at("2026-10-25T22:59:59Z"))).toBe("2026-10-25");
  });
});

describe("isoWeek", () => {
  it.each([
    ["2026-11-10", "2026-W46"],
    ["2026-01-01", "2026-W01"], // Thursday → week 1 of 2026
    ["2026-12-31", "2026-W53"], // 2026 has 53 ISO weeks
    ["2027-01-03", "2026-W53"], // Sunday still belongs to 2026's last week
    ["2027-01-04", "2027-W01"],
    ["2024-12-30", "2025-W01"], // Monday belongs to next ISO year
    ["2021-01-03", "2020-W53"],
  ])("%s → %s", (date, expected) => {
    expect(isoWeek(date)).toBe(expected);
  });
});

describe("periodKey (business rule 2: frequency windows in Europe/Stockholm)", () => {
  it("daily uses the Stockholm calendar date", () => {
    expect(periodKey("daily", at("2026-11-10T23:30:00Z"))).toBe("2026-11-11");
  });

  it("weekly starts on Monday 00:00 Stockholm time", () => {
    expect(periodKey("weekly", at("2026-11-15T22:59:59Z"))).toBe("2026-W46"); // Sun 23:59:59
    expect(periodKey("weekly", at("2026-11-15T23:00:00Z"))).toBe("2026-W47"); // Mon 00:00
  });

  it("monthly uses the Stockholm calendar month", () => {
    expect(periodKey("monthly", at("2026-11-30T22:59:59Z"))).toBe("2026-11");
    expect(periodKey("monthly", at("2026-11-30T23:00:00Z"))).toBe("2026-12");
  });

  it("once has a single window forever", () => {
    expect(periodKey("once", at("2026-01-01T00:00:00Z"))).toBe("once");
    expect(periodKey("once", at("2030-06-15T12:00:00Z"))).toBe("once");
  });
});
