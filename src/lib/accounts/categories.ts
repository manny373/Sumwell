/**
 * Transaction categories — Phase 3c.
 *
 * A curated, original category vocabulary for the prototype. Category values on
 * transactions are free-form strings, so this module provides the canonical
 * spellings the UI offers for inline correction plus a small normalizer for
 * CSV-imported values. The normalizer only fixes case/whitespace and maps
 * exact (case-insensitive) matches onto the canonical spelling — it never
 * guesses what an unknown word means, so nothing is silently re-labeled.
 */

export const CATEGORY_GROUPS: { label: string; categories: string[] }[] = [
  { label: "Income", categories: ["income", "refund", "gift"] },
  {
    label: "Housing & bills",
    categories: ["housing", "utilities", "internet", "phone", "insurance"],
  },
  {
    label: "Food & essentials",
    categories: ["groceries", "dining", "health", "personal care"],
  },
  {
    label: "Transport",
    categories: ["transport", "fuel", "auto", "auto loan"],
  },
  {
    label: "Loans & debt",
    categories: ["credit card", "student loan", "mortgage", "loan payment"],
  },
  {
    label: "Savings & transfers",
    categories: ["transfers", "savings"],
  },
  {
    label: "Subscriptions & discretionary",
    categories: ["subscription", "entertainment", "shopping", "travel"],
  },
  { label: "Giving", categories: ["giving", "charity", "tithe"] },
  { label: "Everything else", categories: ["other", "uncategorized"] },
];

/** Canonical category spellings (the vocabulary the UI suggests). */
export const CANONICAL_CATEGORIES: readonly string[] = CATEGORY_GROUPS.flatMap(
  (g) => g.categories,
);

const canonicalSet = new Set(CANONICAL_CATEGORIES);

/** "Groceries " / "GROCERIES" -> "groceries"; unknown -> kept as typed. */
export function normalizeCategory(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "uncategorized";
  const lower = cleaned.toLowerCase();
  return canonicalSet.has(lower) ? lower : cleaned;
}

/** All a household's transaction categories, from the data (never invented). */
export function knownCategoriesFrom(
  transactions: readonly { category: string }[],
): string[] {
  const seen = new Set<string>();
  for (const t of transactions) seen.add(t.category || "uncategorized");
  return [...seen];
}

/** "uncategorized" is shown as an honest badge, never hidden. */
export function isUncategorized(category: string): boolean {
  return category === "" || category.toLowerCase() === "uncategorized";
}