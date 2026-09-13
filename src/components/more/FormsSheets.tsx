import { useMemo, useState } from "react";
import type {
  Account,
  AccountType,
  ConnectionStatus,
  Transaction,
  TransactionKind,
  TransactionStatus,
} from "~/lib/finance/types";
import { ACCOUNT_TYPE_LABELS, CONNECTION_META } from "~/lib/accounts/accounts";
import { CATEGORY_GROUPS } from "~/lib/accounts/categories";
import { nextIdWithPrefix } from "~/lib/client/household";
import { parseDollarsToCents } from "~/lib/money";
import { useClientData } from "~/lib/client/store";
import type { Household } from "~/lib/client/types";
import { Button } from "~/components/Button";
import { Sheet } from "~/components/Dialog";
import { Select } from "~/components/Select";
import { TextField } from "~/components/TextField";
import { todayISO } from "~/lib/client/dates";

/** Connection states a user can create/simulate (never demo — demo is ours). */
const CREATEABLE_STATUSES: ConnectionStatus[] = [
  "manual",
  "connected",
  "stale",
  "reconnectRequired",
  "unsupported",
  "disconnected",
];

const ALL_ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

/* -------------------------------------------------------- add account --- */

export function AddAccountSheet({
  open,
  household,
  onClose,
}: {
  open: boolean;
  household: Household;
  onClose: () => void;
}) {
  const store = useClientData();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [institution, setInstitution] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("manual");
  const [current, setCurrent] = useState("");
  const [available, setAvailable] = useState("");
  const [credit, setCredit] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isCard = type === "creditCard";
  const isCreditType = ["creditCard", "loan", "studentLoan", "autoLoan", "mortgage"].includes(type);

  function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give the account a name.");
      return;
    }
    const currentCents = current.trim() === "" ? null : parseDollarsToCents(current);
    const availableCents = available.trim() === "" ? null : parseDollarsToCents(available);
    const creditCents = isCard && credit.trim() !== "" ? parseDollarsToCents(credit) : null;
    const limitCents = isCard && limit.trim() !== "" ? parseDollarsToCents(limit) : null;
    if (current.trim() !== "" && currentCents === null) {
      setError(`"${current}" isn't a valid balance — use dollars and cents, e.g. 1250.00.`);
      return;
    }
    if (available.trim() !== "" && availableCents === null) {
      setError(`"${available}" isn't a valid available balance.`);
      return;
    }
    if (creditCents === null && isCard && credit.trim() !== "") {
      setError(`"${credit}" isn't a valid available-credit amount.`);
      return;
    }
    if (limitCents === null && isCard && limit.trim() !== "") {
      setError(`"${limit}" isn't a valid credit limit.`);
      return;
    }

    const account: Account = {
      id: nextIdWithPrefix("acc-manual-", household.accounts.map((a) => a.id)),
      name: trimmedName,
      type,
      connectionStatus: status,
      source: "manual",
      owner: household.label,
      currency: "USD",
      // Credit/loan balances are stored NEGATIVE in the model; the form asks
      // for a positive "what you owe" and we flip the sign. Spendable accounts
      // stay positive. Unknown stays null (never 0).
      currentBalanceCents:
        currentCents === null ? null : isCreditType ? -currentCents : currentCents,
      availableBalanceCents: isCreditType ? null : availableCents,
      availableCreditCents: creditCents,
      creditLimitCents: limitCents,
      externalId: null,
      institution: institution.trim() === "" ? null : institution.trim(),
      openedAt: null,
      updatedAt: new Date().toISOString(),
    };
    store.addAccount(account);
    onClose();
    setName("");
    setInstitution("");
    setCurrent("");
    setAvailable("");
    setCredit("");
    setLimit("");
    setType("checking");
    setStatus("manual");
    setError(null);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add account">
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-ink-muted">
          This adds a manual record on this device. It is never connected to a real bank — for
          credit or loan accounts the balance is what you owe.
        </p>

        <TextField label="Account name" required value={name} onChange={setName} placeholder="e.g. Second Checking" />
        <TextField
          label="Institution"
          value={institution}
          onChange={setInstitution}
          placeholder="e.g. Demo Community Bank (synthetic)"
          hint="A display label only — no institution is contacted."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ALL_ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select
            label="Connection state"
            value={status}
            onChange={(e) => setStatus(e.target.value as ConnectionStatus)}
          >
            {CREATEABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONNECTION_META[s].label}
              </option>
            ))}
          </Select>
        </div>
        {status !== "manual" ? (
          <p className="rounded-control bg-warning-soft px-3 py-2 text-caption font-medium text-warning">
            Simulated state for exploring the prototype — a “Connected” badge here does not connect
            to anything.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label={isCreditType ? "Balance (what you owe)" : "Balance"}
            numeric
            prefix="$"
            value={current}
            onChange={setCurrent}
            placeholder="Optional — leave blank if unknown"
          />
          <TextField
            label="Available balance"
            numeric
            prefix="$"
            value={available}
            onChange={setAvailable}
            placeholder="Optional"
          />
        </div>
        {isCard ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Available credit"
              numeric
              prefix="$"
              value={credit}
              onChange={setCredit}
              placeholder="Optional"
            />
            <TextField
              label="Credit limit"
              numeric
              prefix="$"
              value={limit}
              onChange={setLimit}
              placeholder="Optional"
            />
          </div>
        ) : null}
        <p className="text-caption text-ink-faint">
          Unknown balances stay “Unknown” — Sumwell never shows 0 for a missing number.
        </p>

        {error ? (
          <p role="alert" className="text-body-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add account</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ----------------------------------------------------- add transaction --- */

const KIND_OPTIONS: { value: TransactionKind; label: string }[] = [
  { value: "expense", label: "Expense (spending)" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer (not spending)" },
  { value: "loanPayment", label: "Loan payment" },
];

export function AddTransactionSheet({
  open,
  household,
  onClose,
  defaultAccountId = null,
}: {
  open: boolean;
  household: Household;
  onClose: () => void;
  defaultAccountId?: string | null;
}) {
  const store = useClientData();
  const spendable = household.accounts.filter(
    (a) => a.type === "checking" || a.type === "savings" || a.type === "creditCard",
  );
  const options = spendable.length > 0 ? spendable : household.accounts;

  const [accountId, setAccountId] = useState(
    defaultAccountId && options.some((o) => o.id === defaultAccountId)
      ? defaultAccountId
      : (options[0]?.id ?? ""),
  );
  const [date, setDate] = useState(todayISO());
  const [merchant, setMerchant] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [category, setCategory] = useState("other");
  const [status, setStatus] = useState<TransactionStatus>("posted");
  const [principal, setPrincipal] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmedMerchant = merchant.trim();
    if (!trimmedMerchant) {
      setError("Describe the transaction (merchant or payer).");
      return;
    }
    const cents = parseDollarsToCents(amount);
    if (amount.trim() === "" || cents === null || cents <= 0) {
      setError("Enter a positive dollar amount, e.g. 42.17.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Date must be YYYY-MM-DD.");
      return;
    }
    const signed = direction === "out" ? -cents : cents;
    let principalCents: number | null = null;
    let interestCents: number | null = null;
    if (kind === "loanPayment" && principal.trim() !== "") {
      const p = parseDollarsToCents(principal);
      if (p === null || p < 0) {
        setError("Principal must be a positive amount (or leave blank).");
        return;
      }
      if (p > cents) {
        setError("Principal can't exceed the payment amount.");
        return;
      }
      principalCents = p;
      interestCents = cents - p;
    }

    const txn: Transaction = {
      id: nextIdWithPrefix("manual-", household.transactions.map((t) => t.id)),
      accountId,
      merchant: trimmedMerchant,
      amountCents: signed,
      kind,
      status,
      category: category === "uncategorized" ? "uncategorized" : category,
      transactedAt: date,
      postedAt: status === "posted" ? date : null,
      splits: [],
      isExcluded: false,
      principalCents,
      interestCents,
      source: "manual",
    };
    store.addTransaction(txn);
    onClose();
    setMerchant("");
    setAmount("");
    setPrincipal("");
    setCategory(kind === "expense" ? "other" : kind === "income" ? "income" : "transfers");
    setStatus("posted");
    setDirection("out");
    setKind("expense");
    setError(null);
  }

  const catOptions = useMemo(
    () =>
      CATEGORY_GROUPS.flatMap((g) => [
        <optgroup key={g.label} label={g.label}>
          {g.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </optgroup>,
      ]),
    [],
  );

  return (
    <Sheet open={open} onClose={onClose} title="Add transaction">
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-ink-muted">
          Manual entry — labeled “Manual”. It does not change the account balance above and does
          not connect to anything.
        </p>

        <Select label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {options.length === 0 ? (
            <option value="">No accounts yet</option>
          ) : (
            options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))
          )}
        </Select>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={setDate}
            className="sm:col-span-1"
          />
          <TextField
            label="Merchant / description"
            required
            value={merchant}
            onChange={setMerchant}
            placeholder="e.g. Corner Grocery"
          />
        </div>

        <div>
          <span id="sw-direction-label" className="text-body-sm font-medium text-ink">
            Direction
          </span>
          <div role="radiogroup" aria-labelledby="sw-direction-label" className="mt-1.5 flex gap-2">
            {(["out", "in"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={direction === d}
                onClick={() => setDirection(d)}
                className={
                  direction === d
                    ? "h-9 rounded-control bg-brand-600 px-4 text-body-sm font-semibold text-ink-inverse"
                    : "h-9 rounded-control border border-line-strong bg-surface-raised px-4 text-body-sm font-medium text-ink-muted hover:bg-surface-sunken"
                }
              >
                {d === "out" ? "Money out" : "Money in"}
              </button>
            ))}
          </div>
        </div>

        <TextField
          label="Amount"
          required
          numeric
          prefix="$"
          value={amount}
          onChange={setAmount}
          placeholder={direction === "out" ? "42.17" : "2153.84"}
          hint={
            direction === "out"
              ? "Stored as a negative amount (money out)."
              : "Stored as a positive amount (money in)."
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Kind" value={kind} onChange={(e) => setKind(e.target.value as TransactionKind)}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TransactionStatus)}
          >
            <option value="posted">Posted</option>
            <option value="pending">Pending</option>
          </Select>
        </div>

        {kind === "loanPayment" ? (
          <TextField
            label="Principal portion (optional)"
            numeric
            prefix="$"
            value={principal}
            onChange={setPrincipal}
            hint="When known. Interest is the rest of the payment — the payment still counts once."
          />
        ) : (
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="uncategorized">Uncategorized</option>
            {catOptions}
          </Select>
        )}
        {kind === "loanPayment" ? (
          <p className="text-caption text-ink-faint">
            Loan payments count once in spending; transfers are never spending.
          </p>
        ) : kind === "transfer" ? (
          <p className="text-caption text-ink-faint">
            Labeled as a transfer — it will never appear as spending.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-body-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={options.length === 0}
          >
            Add transaction
          </Button>
        </div>
      </div>
    </Sheet>
  );
}