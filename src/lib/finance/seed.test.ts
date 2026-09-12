import { describe, expect, test } from "bun:test";
import { createDemoSnapshot, DEMO_LABEL, DEMO_SNAPSHOT_VERSION } from "./seed";

describe("demo snapshot — deterministic and clearly synthetic", () => {
  test("identical data on every call (no randomness, no clock)", () => {
    const a = createDemoSnapshot();
    const b = createDemoSnapshot();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.isFrozen(a)).toBe(true);
  });

  test("carries a synthetic/demo label and version", () => {
    const seed = createDemoSnapshot();
    expect(DEMO_LABEL.toLowerCase()).toContain("synthetic");
    expect(DEMO_SNAPSHOT_VERSION).toMatch(/^\d{4}\.\d{2}\.\d$/);
    expect(seed.household).toBe("Demo household");
  });

  test("every entity is labeled demo", () => {
    const seed = createDemoSnapshot();
    for (const a of seed.accounts) expect(a.source).toBe("demo");
    for (const t of seed.transactions) expect(t.source).toBe("demo");
    for (const p of seed.paychecks) expect(p.source).toBe("demo");
    for (const o of seed.obligations) expect(o.source).toBe("demo");
    for (const d of seed.debts) expect(d.source).toBe("demo");
    for (const g of seed.goals) expect(g.source).toBe("demo");
    expect(seed.givingPlan.source).toBe("demo");
    for (const r of seed.automationRules) {
      expect(r.source).toBe("demo");
      expect(r.simulated).toBe(true); // draft rules never execute
      expect(r.status).not.toBe("active");
    }
  });

  test("mid-month paycheck household: rent on the 1st, biweekly pay, next check estimated", () => {
    const seed = createDemoSnapshot();
    const rent = seed.obligations.find((o) => o.id === "ob-rent")!;
    expect(rent.dueDay).toBe(1);
    expect(rent.essential).toBe(true);
    expect(seed.paychecks.map((p) => p.date)).toEqual([
      "2026-08-26",
      "2026-09-10",
      "2026-09-25",
    ]);
    expect(seed.paychecks[2].received).toBe(false); // estimated until it arrives
  });

  test("federal and private student loans are kept SEPARATE", () => {
    const seed = createDemoSnapshot();
    const loans = seed.debts.filter((d) => d.category === "studentLoan");
    expect(loans).toHaveLength(2);
    expect(loans.some((d) => d.name.includes("Federal"))).toBe(true);
    expect(loans.some((d) => d.name.includes("Private"))).toBe(true);
    expect(loans.map((d) => d.id).sort()).toEqual(["debt-federal", "debt-private"]);
    const accounts = seed.accounts.filter((a) => a.type === "studentLoan");
    expect(accounts).toHaveLength(2);
  });

  test("all money fields are safe integers (no floats on the money path)", () => {
    const seed = createDemoSnapshot();
    for (const a of seed.accounts) {
      for (const v of [a.currentBalanceCents, a.availableBalanceCents, a.availableCreditCents, a.creditLimitCents]) {
        if (v !== null) expect(Number.isSafeInteger(v)).toBe(true);
      }
    }
    for (const t of seed.transactions) {
      expect(Number.isSafeInteger(t.amountCents)).toBe(true);
      if (t.principalCents !== null) expect(Number.isSafeInteger(t.principalCents)).toBe(true);
      if (t.interestCents !== null) expect(Number.isSafeInteger(t.interestCents)).toBe(true);
    }
    for (const p of seed.paychecks) {
      expect(Number.isSafeInteger(p.grossCents)).toBe(true);
      expect(Number.isSafeInteger(p.netCents)).toBe(true);
    }
    for (const o of seed.obligations) expect(Number.isSafeInteger(o.amountCents)).toBe(true);
    for (const d of seed.debts) {
      expect(Number.isSafeInteger(d.balanceCents)).toBe(true);
      expect(Number.isSafeInteger(d.minPaymentCents)).toBe(true);
    }
    for (const g of seed.goals) {
      expect(Number.isSafeInteger(g.targetCents)).toBe(true);
      expect(Number.isSafeInteger(g.savedCents)).toBe(true);
    }
  });

  test("internal coherence: available balance already reflects pending; goal matches savings", () => {
    const seed = createDemoSnapshot();
    const checking = seed.accounts.find((a) => a.id === "acc-checking")!;
    const pending = seed.transactions
      .filter((t) => t.accountId === "acc-checking" && t.status === "pending")
      .reduce((s, t) => s + Math.abs(t.amountCents), 0);
    expect(pending).toBe(4217);
    expect(checking.currentBalanceCents! - pending).toBe(checking.availableBalanceCents);

    const savings = seed.accounts.find((a) => a.id === "acc-savings")!;
    const emergency = seed.goals.find((g) => g.id === "goal-emergency")!;
    expect(emergency.savedCents).toBe(savings.currentBalanceCents);
  });

  test("loan payment split is consistent with the stated balance and interest rate", () => {
    const seed = createDemoSnapshot();
    const payment = seed.transactions.find((t) => t.id === "txn-auto-payment-0905")!;
    expect(payment.principalCents! + payment.interestCents!).toBe(Math.abs(payment.amountCents));
    const auto = seed.debts.find((d) => d.id === "debt-auto")!;
    // Monthly interest on $12,450.80 at 6.49% ≈ $67.34.
    expect(payment.interestCents).toBe(6734);
    expect(auto.aprBps).toBe(649);
  });
});