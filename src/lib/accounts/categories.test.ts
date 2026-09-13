import { describe, expect, test } from "bun:test";
import {
  CANONICAL_CATEGORIES,
  CATEGORY_GROUPS,
  isUncategorized,
  knownCategoriesFrom,
  normalizeCategory,
} from "./categories";

describe("normalizeCategory", () => {
  test("maps canonical spellings case-insensitively with whitespace fixed", () => {
    expect(normalizeCategory("GROCERIES")).toBe("groceries");
    expect(normalizeCategory("  Credit Card ")).toBe("credit card");
    expect(normalizeCategory("Student Loan")).toBe("student loan");
    expect(normalizeCategory("loan payment")).toBe("loan payment");
  });

  test("never guesses unknown words — they are kept as typed", () => {
    expect(normalizeCategory("Dining Out")).toBe("Dining Out");
    expect(normalizeCategory("Cat Cafe")).toBe("Cat Cafe");
  });

  test("empty input becomes uncategorized", () => {
    expect(normalizeCategory("")).toBe("uncategorized");
    expect(normalizeCategory("   ")).toBe("uncategorized");
  });
});

describe("the canonical vocabulary", () => {
  test("every group has non-empty categories and ids are unique", () => {
    expect(CATEGORY_GROUPS.length).toBeGreaterThan(0);
    for (const group of CATEGORY_GROUPS) {
      expect(group.categories.length).toBeGreaterThan(0);
    }
    expect(new Set(CANONICAL_CATEGORIES).size).toBe(CANONICAL_CATEGORIES.length);
    expect(CANONICAL_CATEGORIES).toContain("groceries");
    expect(CANONICAL_CATEGORIES).toContain("loan payment");
    expect(CANONICAL_CATEGORIES).toContain("giving");
  });
});

describe("knownCategoriesFrom / isUncategorized", () => {
  test("collects distinct categories from real data, mapping empty to uncategorized", () => {
    expect(
      knownCategoriesFrom([
        { category: "groceries" },
        { category: "groceries" },
        { category: "" },
        { category: "housing" },
      ]),
    ).toEqual(["groceries", "uncategorized", "housing"]);
  });

  test("isUncategorized recognizes blank and the canonical spelling only", () => {
    expect(isUncategorized("")).toBe(true);
    expect(isUncategorized("UNCATEGORIZED")).toBe(true);
    expect(isUncategorized("uncategorized")).toBe(true);
    expect(isUncategorized("housing")).toBe(false);
  });
});