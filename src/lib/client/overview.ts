/**
 * All-your-money overview — Phase 4b (Finding 10).
 *
 * One consolidated view of assets / debts / net worth built from the SAME
 * canonical household records the rest of the app uses (accounts + debts),
 * with identity resolved through `accountId` so nothing is double-counted:
 *
 *   - Assets come from owned ACCOUNT records (checking, savings, manual
 *     assets = spendable cash; brokerage, retirement = investable, NOT
 *     spendable cash). A null balance on any owned account makes that group's
 *     total "Unknown" — never 0.
 *   - Liabilities come from DEBT records (the canonical source the debt
 *     strategies and Plan tab use). Every debt is inspectable: a debt with a
 *     linked account record resolves to that account; a debt without one is
 *     still listed and labeled "tracked as debt — no account record".
 *   - Credit cards additionally expose available credit separately from the
 *     balance you owe.
 *   - Net worth = known assets − debt balances. When an owned account's
 *     balance is unknown the net worth is "Unknown", never an invented 0.
 *
 * The Medical Bill was previously a debt with no account record; it now has
 * one (acc-medical) so it appears in Accounts and here. A test enforces the
 * identity rule over the seed: every seeded debt maps to an account record
 * whose balance magnitude equals the debt balance, and every seeded
 * credit-type account maps back to a debt.
 *
 * All money stays integer cents; `null` means unknown.
 */
import type { Account } from "~/lib/finance/types";
import { isCreditAccount, isInvestmentAccount } from "~/lib/accounts/accounts";
import { formatCents } from "~/lib/money";
import type { Household } from "./types";

export interface MoneyLine {
  accountId: string;
  name: string;
  /** null = unknown — rendered "Unknown", never 0. */
  cents: number | null;
  /** e.g. "not spendable cash" for investable accounts. */
  note?: string;
}

export interface AssetGroup {
  id: "cash" | "investable";
  label: string;
  /** Why these count / don't count toward spendable cash. */
  note: string;
  lines: MoneyLine[];
  /** null when any line's balance is unknown. */
  totalCents: number | null;
}

export interface LiabilityRow {
  debtId: string;
  name: string;
  /** Positive magnitude owed. Debts always carry a known balance in the model. */
  cents: number;
  /** The account record that is this debt's inspection point, when linked. */
  accountId: string | null;
  /** "Paid off" when the balance on record is zero. */
  note?: string;
}

export interface AllYourMoneyView {
  assetGroups: AssetGroup[];
  /** null when any owned account balance is unknown. */
  assetsTotalCents: number | null;
  liabilities: LiabilityRow[];
  /** Sum of debt balances (known by construction in this model). */
  liabilitiesTotalCents: number;
  /** assets − liabilities; null when asset totals are unknown. */
  netWorthCents: number | null;
  /** Sum of available credit on card accounts; null when none is known. */
  availableCreditCents: number | null;
  /** Owned accounts whose balance is unknown — shown as "Unknown", never 0. */
  unknownAccounts: MoneyLine[];
  /** Debts with no linked account record — listed, but not account-inspectable. */
  unlinkedDebts: LiabilityRow[];
  /** True when every debt with a balance has a linked account record. */
  allDebtsInspectable: boolean;
}

/** Union of component values we are allowed to sum — null-safe sum with
 *  "unknown poisons the total" semantics: null+known = null. */
function sumOrUnknown(centsList: Array<number | null>): number | null {
  let total = 0;
  for (const cents of centsList) {
    if (cents === null || cents === undefined) return null;
    total += cents;
  }
  return total;
}

/** Assets that are spendable cash vs investable (not spendable) cash. */
function ownedBalance(account: Account): number | null {
  return account.currentBalanceCents ?? account.availableBalanceCents;
}

/**
 * Build the overview. `household.debts` is the canonical liability source;
 * account records resolve debts to their inspection points via `accountId`.
 * Credit-type accounts NOT covered by a debt record are still liabilities —
 * they are folded in as unlinked rows so the overview never silently drops a
 * negative balance it doesn't understand.
 */
export function allYourMoneyView(household: Household): AllYourMoneyView {
  const accounts = household.accounts;
  const debts = household.debts;

  /* ------------------------------------------------ assets (accounts) ---- */
  const cashLines: MoneyLine[] = [];
  const investableLines: MoneyLine[] = [];
  const unknownAccounts: MoneyLine[] = [];

  for (const account of accounts) {
    const isLiabilityAccount = isCreditAccount(account);
    if (isLiabilityAccount) continue; // handled under liabilities via debts
    const group = isInvestmentAccount(account) ? investableLines : cashLines;
    const cents = ownedBalance(account);
    if (cents === null || cents === undefined) {
      unknownAccounts.push({ accountId: account.id, name: account.name, cents: null });
      group.push({ accountId: account.id, name: account.name, cents: null });
    } else if (cents >= 0) {
      // Owned accounts are positive by convention; negative balances here are
      // a data anomaly — keep them visible rather than silently dropping them.
      const availableNote =
        account.type === "checking" &&
        account.availableBalanceCents !== null &&
        account.availableBalanceCents !== undefined &&
        account.availableBalanceCents !== account.currentBalanceCents
          ? `Available today: ${formatCents(account.availableBalanceCents)}`
          : undefined;
      group.push({ accountId: account.id, name: account.name, cents, note: availableNote });
    } else {
      group.push({
        accountId: account.id,
        name: account.name,
        cents,
        note: "Negative balance on record — review this account",
      });
    }
  }

  const assetGroups: AssetGroup[] = [
    {
      id: "cash" as const,
      label: "Cash",
      note: "Money you can move today — checking, savings, and manual assets.",
      lines: cashLines,
      totalCents: sumOrUnknown(cashLines.map((l) => l.cents)),
    },
    {
      id: "investable" as const,
      label: "Investments",
      note: "Brokerage and retirement — real money, but NOT spendable cash.",
      lines: investableLines,
      totalCents: sumOrUnknown(investableLines.map((l) => l.cents)),
    },
  ].filter((g) => g.lines.length > 0);

  const assetsTotalCents = sumOrUnknown(
    assetGroups.flatMap((g) => g.lines.map((l) => l.cents)),
  );

  /* ------------------------------------------- liabilities (debts) ------- */
  const debtById = new Map(debts.map((d) => [d.id, d] as const));
  const liabilities: LiabilityRow[] = debts
    .filter((d) => d.balanceCents > 0)
    .map((d) => ({
      debtId: d.id,
      name: d.name,
      cents: d.balanceCents,
      accountId: d.accountId ?? null,
    }));
  const zeroBalanceDebts = debts.filter((d) => d.balanceCents <= 0);
  for (const d of zeroBalanceDebts) {
    liabilities.push({
      debtId: d.id,
      name: d.name,
      cents: 0,
      accountId: d.accountId ?? null,
      note: "Paid off — zero balance on record",
    });
  }

  // Credit-type account records with no matching debt: still liabilities
  // (the overview never drops a negative balance it doesn't understand).
  const unlinkedDebts: LiabilityRow[] = [];
  for (const account of accounts) {
    if (!isCreditAccount(account)) continue;
    const covered = debts.some((d) => d.accountId === account.id);
    if (covered) continue;
    const balance = ownedBalance(account);
    if (balance !== null && balance !== undefined && balance < 0) {
      unlinkedDebts.push({
        debtId: `acc-${account.id}`,
        name: account.name,
        cents: Math.abs(balance),
        accountId: account.id,
        note: "Account record only — no matching debt strategy entry",
      });
    }
  }

  const liabilitiesTotalCents = liabilities
    .concat(unlinkedDebts)
    .reduce((s, r) => s + r.cents, 0);

  const netWorthCents =
    assetsTotalCents === null ? null : assetsTotalCents - liabilitiesTotalCents;

  /* --------------------------------------------- available credit --------- */
  const creditValues = accounts
    .filter((a) => a.type === "creditCard")
    .map((a) => a.availableCreditCents)
    .filter((c): c is number => c !== null && c !== undefined);
  const availableCreditCents =
    creditValues.length > 0
      ? creditValues.reduce((s, c) => s + c, 0)
      : null;

  const allDebtsInspectable =
    unlinkedDebts.length === 0 &&
    [...debtById.values()].every(
      (d) => d.balanceCents <= 0 || (d.accountId ?? null) !== null,
    );

  return {
    assetGroups,
    assetsTotalCents,
    liabilities,
    liabilitiesTotalCents,
    netWorthCents,
    availableCreditCents,
    unknownAccounts,
    unlinkedDebts,
    allDebtsInspectable,
  };
}

/**
 * Identity rule check (Finding 10): every debt with a positive balance maps
 * (via accountId) to an account record whose balance magnitude equals the
 * debt balance, and every credit-type account maps back to a debt. Returns
 * the problems found — an empty array means the household's debts and
 * accounts are consistent. The UI treats a non-empty result as "review
 * needed"; the seed test asserts empty.
 */
export function debtAccountIdentityProblems(household: Household): string[] {
  const problems: string[] = [];
  for (const debt of household.debts) {
    if (debt.balanceCents <= 0) continue;
    const account = household.accounts.find((a) => a.id === debt.accountId);
    if (!account) {
      problems.push(`Debt "${debt.name}" has no linked account record.`);
      continue;
    }
    const magnitude =
      account.currentBalanceCents === null || account.currentBalanceCents === undefined
        ? null
        : Math.abs(account.currentBalanceCents);
    if (magnitude === null) {
      problems.push(
        `Debt "${debt.name}" links to "${account.name}" whose balance is unknown.`,
      );
    } else if (magnitude !== debt.balanceCents) {
      problems.push(
        `Debt "${debt.name}" (${debt.balanceCents}) does not match its account balance (${magnitude}).`,
      );
    }
  }
  for (const account of household.accounts) {
    if (!isCreditAccount(account)) continue;
    const matches = household.debts.filter((d) => d.accountId === account.id);
    if (matches.length === 0) {
      problems.push(
        `Credit account "${account.name}" has no matching debt record.`,
      );
    }
  }
  return problems;
}
