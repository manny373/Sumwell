import { describe, expect, test } from "bun:test";
import type { Account, ConnectionStatus } from "~/lib/finance/types";
import {
  CONNECTION_META,
  balanceView,
  canSimulateReconnect,
  formatDate,
  formatDateTime,
  institutionLabel,
  isCreditAccount,
  isInvestmentAccount,
  isSpendableCash,
  needsReconnectBanner,
  sourceLabel,
} from "./accounts";

function account(over: Partial<Account> & { id: string }): Account {
  return {
    name: "Account",
    type: "checking",
    connectionStatus: "demo",
    source: "demo",
    owner: "You",
    currency: "USD",
    currentBalanceCents: 180000,
    availableBalanceCents: 180000,
    availableCreditCents: null,
    creditLimitCents: null,
    externalId: null,
    institution: null,
    openedAt: null,
    updatedAt: "2026-09-10T08:30:00Z",
    ...over,
  };
}

describe("balanceView — current vs available vs available credit, unknown ≠ 0", () => {
  test("credit card shows you-owe balance plus available credit and limit", () => {
    const card = account({
      id: "cc",
      type: "creditCard",
      currentBalanceCents: -328744,
      availableCreditCents: 371256,
      creditLimitCents: 700000,
    });
    const view = balanceView(card);
    expect(view.isDebt).toBe(true);
    expect(view.primary).toEqual({ label: "Balance", cents: 328744, note: "you owe" });
    expect(view.lines).toEqual([
      { label: "Available credit", cents: 371256 },
      { label: "Credit limit", cents: 700000 },
    ]);
  });

  test("credit card with unknown available credit omits the line instead of showing 0", () => {
    const card = account({
      id: "cc",
      type: "creditCard",
      currentBalanceCents: -10000,
      availableCreditCents: null,
      creditLimitCents: null,
    });
    const view = balanceView(card);
    expect(view.lines).toEqual([]);
    expect(view.primary.cents).toBe(10000);
  });

  test("loan shows the magnitude owed", () => {
    const loan = account({ id: "ln", type: "loan", currentBalanceCents: -2500000 });
    const view = balanceView(loan);
    expect(view.isDebt).toBe(true);
    expect(view.primary).toEqual({ label: "Balance", cents: 2500000, note: "you owe" });
    expect(view.lines).toEqual([]);
  });

  test("checking shows available only when it differs from current", () => {
    const differing = account({
      id: "chk",
      currentBalanceCents: 180000,
      availableBalanceCents: 175200,
    });
    expect(balanceView(differing)).toMatchObject({
      isDebt: false,
      primary: { label: "Balance", cents: 180000 },
      lines: [{ label: "Available", cents: 175200 }],
    });

    const same = account({ id: "chk2", currentBalanceCents: 180000, availableBalanceCents: 180000 });
    expect(balanceView(same).lines).toEqual([]);

    const unknown = account({ id: "chk3", currentBalanceCents: 180000, availableBalanceCents: null });
    expect(balanceView(unknown).lines).toEqual([]);
  });

  test("retirement balance is real money but rendered with no spendable claim", () => {
    const ret = account({ id: "ret", type: "retirement", currentBalanceCents: 1234567 });
    const view = balanceView(ret);
    expect(view.isDebt).toBe(false);
    expect(view.primary.cents).toBe(1234567);
    expect(isSpendableCash(ret)).toBe(false);
    expect(isInvestmentAccount(ret)).toBe(true);
  });
});

describe("account classification", () => {
  test("only checking and savings are spendable cash", () => {
    expect(isSpendableCash(account({ id: "a", type: "checking" }))).toBe(true);
    expect(isSpendableCash(account({ id: "b", type: "savings" }))).toBe(true);
    for (const type of ["creditCard", "loan", "studentLoan", "autoLoan", "mortgage", "brokerage", "retirement", "manualAsset"] as const) {
      expect(isSpendableCash(account({ id: type, type }))).toBe(false);
    }
  });

  test("brokerage and retirement are investments (not spendable)", () => {
    expect(isInvestmentAccount(account({ id: "b", type: "brokerage" }))).toBe(true);
    expect(isInvestmentAccount(account({ id: "r", type: "retirement" }))).toBe(true);
    expect(isInvestmentAccount(account({ id: "c", type: "checking" }))).toBe(false);
  });

  test("credit/loan types are debts the household owes", () => {
    for (const type of ["creditCard", "loan", "studentLoan", "autoLoan", "mortgage"] as const) {
      expect(isCreditAccount(account({ id: type, type }))).toBe(true);
    }
    for (const type of ["checking", "savings", "brokerage", "retirement", "manualAsset"] as const) {
      expect(isCreditAccount(account({ id: type, type }))).toBe(false);
    }
  });
});

describe("connection states — every state shown truthfully", () => {
  test("every connection status has a badge label and honest description", () => {
    const labels: Record<ConnectionStatus, string> = {
      demo: "Demo",
      manual: "Manual",
      connected: "Connected",
      stale: "Stale",
      reconnectRequired: "Reconnect required",
      unsupported: "Unsupported",
      disconnected: "Disconnected",
    };
    for (const [status, label] of Object.entries(labels) as [ConnectionStatus, string][]) {
      expect(CONNECTION_META[status].label).toBe(label);
      expect(CONNECTION_META[status].description.length).toBeGreaterThan(10);
    }
  });

  test("reconnect banner targets trouble states only", () => {
    expect(needsReconnectBanner("stale")).toBe(true);
    expect(needsReconnectBanner("reconnectRequired")).toBe(true);
    expect(needsReconnectBanner("unsupported")).toBe(true);
    expect(needsReconnectBanner("disconnected")).toBe(true);
    expect(needsReconnectBanner("demo")).toBe(false);
    expect(needsReconnectBanner("manual")).toBe(false);
    expect(needsReconnectBanner("connected")).toBe(false);
  });

  test("reconnect simulation never applies to demo/manual records", () => {
    expect(canSimulateReconnect(account({ id: "a", connectionStatus: "demo" }))).toBe(false);
    expect(canSimulateReconnect(account({ id: "b", connectionStatus: "manual" }))).toBe(false);
    expect(canSimulateReconnect(account({ id: "c", connectionStatus: "connected" }))).toBe(true);
    expect(canSimulateReconnect(account({ id: "d", connectionStatus: "stale" }))).toBe(true);
  });

  test("institution label falls back honestly, never invents a bank", () => {
    expect(institutionLabel(account({ id: "a", connectionStatus: "demo" }))).toBe(
      "Synthetic demo institution",
    );
    expect(institutionLabel(account({ id: "b", connectionStatus: "manual" }))).toBe(
      "Manual entry — no institution",
    );
    expect(
      institutionLabel(
        account({ id: "c", connectionStatus: "connected", institution: "Test Bank" }),
      ),
    ).toBe("Test Bank");
    expect(institutionLabel(account({ id: "d", connectionStatus: "disconnected" }))).toBe(
      "Institution not listed",
    );
  });
});

describe("labels & dates", () => {
  test("sourceLabel maps to badge copy", () => {
    expect(sourceLabel("demo")).toBe("Demo");
    expect(sourceLabel("manual")).toBe("Manual");
    expect(sourceLabel("imported")).toBe("Imported");
  });

  test("formatDate/formatDateTime are UTC-anchored and deterministic", () => {
    expect(formatDate("2026-09-10")).toBe("Sep 10, 2026");
    expect(formatDateTime("2026-09-10T08:30:00Z")).toBe("Sep 10, 2026, 8:30 AM");
  });
});