/**
 * All-your-money overview + debt↔account identity — Phase 4b (Finding 10).
 *
 * Hand-worked expectations over the demo seed (as of the 2026-09-10 snapshot):
 *   assets:  checking 1,842.11 + savings 8,450.00 + brokerage 5,150.00
 *            + 401(k) 34,210.90 = 49,653.01
 *   debts:   card 3,287.44 + auto 12,450.80 + federal 21,300.00
 *            + private 18,700.00 + medical 1,240.00 = 56,978.24
 *   net worth = 49,653.01 − 56,978.24 = −7,325.23
 *   available credit (card) = 3,712.56
 */
import { describe, expect, test } from "bun:test";
import { demoHousehold } from "./household";
import {
  allYourMoneyView,
  debtAccountIdentityProblems,
} from "./overview";
import type { Household } from "./types";

const household = demoHousehold("2026-09-12T00:00:00Z");

describe("allYourMoneyView over the demo seed (hand-worked arithmetic)", () => {
  const view = allYourMoneyView(household);

  test("assets come from owned accounts, grouped cash vs investable", () => {
    expect(view.assetGroups.map((g) => g.id)).toEqual(["cash", "investable"]);
    const cash = view.assetGroups.find((g) => g.id === "cash")!;
    const investable = view.assetGroups.find((g) => g.id === "investable")!;
    expect(cash.lines.map((l) => l.accountId)).toEqual(["acc-checking", "acc-savings"]);
    // 1,842.11 + 8,450.00
    expect(cash.totalCents).toBe(184211 + 845000);
    expect(investable.lines.map((l) => l.accountId)).toEqual([
      "acc-401k",
      "acc-brokerage",
    ]);
    // 5,150.00 + 34,210.90
    expect(investable.totalCents).toBe(515000 + 3421090);
    expect(investable.note).toContain("NOT spendable cash");
    // Checking's available balance is shown next to its statement balance.
    const checking = cash.lines.find((l) => l.accountId === "acc-checking")!;
    expect(checking.cents).toBe(184211);
  });

  test("assets total is the canonical account sum; net worth is exact", () => {
    const cash = view.assetGroups.find((g) => g.id === "cash")!;
    const investable = view.assetGroups.find((g) => g.id === "investable")!;
    expect(view.assetsTotalCents).toBe(cash.totalCents! + investable.totalCents!);
    expect(view.assetsTotalCents).toBe(184211 + 845000 + 515000 + 3421090); // 49,653.01
    expect(view.liabilitiesTotalCents).toBe(
      328744 + 1245080 + 2130000 + 1870000 + 124000, // 56,978.24
    );
    expect(view.netWorthCents).toBe(4965301 - 5697824); // −7,325.23
    // Medical Bill is a debt AND now an account record — no double counting:
    expect(view.liabilities.map((l) => l.debtId)).toContain("debt-medical");
  });

  test("available credit is separate from balances owed", () => {
    expect(view.availableCreditCents).toBe(371256); // $3,712.56
    const card = view.liabilities.find((l) => l.debtId === "debt-card")!;
    expect(card.cents).toBe(328744);
  });

  test("every seeded debt maps to an account; every account is inspectable", () => {
    for (const debt of household.debts) {
      expect(debt.accountId, debt.name).toBeTruthy();
      const account = household.accounts.find((a) => a.id === debt.accountId);
      expect(account, `account for ${debt.name}`).toBeTruthy();
      expect(Math.abs(account!.currentBalanceCents!), debt.name).toBe(
        debt.balanceCents,
      );
    }
    expect(view.allDebtsInspectable).toBe(true);
    expect(view.unlinkedDebts).toEqual([]);
    expect(view.unknownAccounts).toEqual([]);
    expect(debtAccountIdentityProblems(household)).toEqual([]);
  });
});

describe("unknown balances are 'Unknown', never 0, and poison totals honestly", () => {
  test("a null-balance owned account makes assets and net worth Unknown", () => {
    const h: Household = {
      ...household,
      accounts: household.accounts.map((a) =>
        a.id === "acc-savings"
          ? { ...a, currentBalanceCents: null, availableBalanceCents: null }
          : a,
      ),
    };
    const view = allYourMoneyView(h);
    expect(view.unknownAccounts.map((u) => u.accountId)).toEqual(["acc-savings"]);
    const cash = view.assetGroups.find((g) => g.id === "cash")!;
    expect(cash.totalCents).toBeNull();
    expect(view.assetsTotalCents).toBeNull();
    expect(view.netWorthCents).toBeNull();
    // Liabilities stay exact — debts always carry known balances.
    expect(view.liabilitiesTotalCents).toBe(5697824);
  });

  test("a credit card with no available-credit record yields null, not 0", () => {
    const h: Household = {
      ...household,
      accounts: household.accounts.map((a) =>
        a.id === "acc-card" ? { ...a, availableCreditCents: null } : a,
      ),
    };
    expect(allYourMoneyView(h).availableCreditCents).toBeNull();
  });
});

describe("liability rows keep every debt inspectable", () => {
  test("a debt without an account record is listed and flagged, never dropped", () => {
    const h: Household = {
      ...household,
      debts: household.debts.map((d) =>
        d.id === "debt-medical" ? { ...d, accountId: null } : d,
      ),
    };
    const view = allYourMoneyView(h);
    const medical = view.liabilities.find((l) => l.debtId === "debt-medical")!;
    expect(medical.accountId).toBeNull();
    expect(view.allDebtsInspectable).toBe(false);
    // Both sides of the broken link are flagged: the debt has no account
    // record AND the account record has no matching debt.
    const problems = debtAccountIdentityProblems(h);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("Medical Bill");
    expect(problems[1]).toContain("Medical Bill");
  });

  test("a zero-balance debt is labeled paid off, not dropped or double-counted", () => {
    const h: Household = {
      ...household,
      debts: household.debts.map((d) =>
        d.id === "debt-medical" ? { ...d, balanceCents: 0 } : d,
      ),
    };
    const view = allYourMoneyView(h);
    const medical = view.liabilities.find((l) => l.debtId === "debt-medical")!;
    expect(medical.cents).toBe(0);
    expect(medical.note).toContain("Paid off");
    expect(view.liabilitiesTotalCents).toBe(5697824 - 124000);
  });

  test("a credit-type account with no debt record surfaces as an unlinked liability", () => {
    const extraAccount = {
      ...household.accounts[2], // acc-card
      id: "acc-extra-card",
      name: "Second Card (manual)",
      currentBalanceCents: -50000,
      availableBalanceCents: null,
      availableCreditCents: null,
      source: "manual" as const,
      connectionStatus: "manual" as const,
    };
    const h: Household = { ...household, accounts: [...household.accounts, extraAccount] };
    const view = allYourMoneyView(h);
    expect(view.unlinkedDebts).toHaveLength(1);
    expect(view.unlinkedDebts[0].name).toBe("Second Card (manual)");
    expect(view.unlinkedDebts[0].cents).toBe(50000);
    expect(view.allDebtsInspectable).toBe(false);
    expect(view.liabilitiesTotalCents).toBe(5697824 + 50000);
  });
});