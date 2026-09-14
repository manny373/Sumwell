/**
 * Client data store (React) — Phase 3a.
 *
 * A tiny typed store that:
 *   - hydrates from localStorage on the client (never on the server),
 *   - exposes the current household and the two onboarding actions
 *     (loadDemo / saveManual) plus startOver,
 *   - persists every mutation back under "sumwell:v1".
 *
 * "loading" until hydration means first paint (and any SSR render) shows the
 * loading state instead of a wrong redirect.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Account,
  AutomationRuleStatus,
  GivingPlan,
  Transaction,
} from "~/lib/finance/types";
import type { ImportDraft } from "~/lib/accounts/import";
import { todayISO } from "./dates";
import {
  demoHousehold,
  manualHouseholdFor,
  withAccountConnectionStatus,
  withAddedAccount,
  withAddedTransaction,
  withAllRulesPaused,
  withDebtExtraBudget,
  withAdoptedDebtExtra,
  withDeletedAccount,
  withDuplicateIgnored,
  withGivingPlan,
  withGoalPriority,
  withImportedTransactions,
  withRuleStatus,
  withTransactionCategory,
  withTransactionDuplicate,
  withTransactionExcluded,
  withTransactionPosted,
  withTransactionTransfer,
} from "./household";
import {
  clearPersisted,
  defaultStorage,
  loadPersisted,
  savePersisted,
  storageIsCorrupt,
} from "./storage";
import type {
  Household,
  ManualOnboardingInputs,
  PersistedAppState,
} from "./types";

export type StoreStatus = "loading" | "ready";

export interface ClientStore {
  status: StoreStatus;
  /** True once onboarding completed (either path). */
  onboarded: boolean;
  /** True when saved data existed but couldn't be read (corrupt/privacy). */
  loadError: boolean;
  household: Household | null;
  /** "Try the demo" — one tap, straight to Home. */
  loadDemo(): void;
  /** Build + persist a manual household and mark onboarding done. */
  saveManual(inputs: ManualOnboardingInputs): void;
  /** Replace the household (edit path) without re-onboarding. */
  replaceHousehold(inputs: ManualOnboardingInputs): void;
  /** Clear everything and return to onboarding. */
  startOver(): void;
  /* ---------------------------------------------------- Phase 3b edits */
  /** Replace the giving plan (mode, amount/percent, enabled). */
  setGivingPlan(plan: GivingPlan): void;
  /** Pause/resume one automation rule (draft = armed preview). */
  setRuleStatus(ruleId: string, status: AutomationRuleStatus): void;
  /** Pause every rule; false = resume all paused rules to draft. */
  setAllRulesPaused(paused: boolean): void;
  /** Move a goal to a priority (1 = highest); others renumber. */
  setGoalPriority(goalId: string, priority: number): void;
  /** Set the monthly extra debt budget used by both debt strategies. */
  setDebtExtraBudget(cents: number): void;
  /** Adopt a monthly extra debt payment — flows into the Home plan. */
  setAdoptedDebtExtra(cents: number): void;
  /* ---------------------------------------------------- Phase 3c edits */
  /** Add a manual/simulated account record. */
  addAccount(account: Account): void;
  /** Delete an account + its transactions (prototype scope). */
  deleteAccount(accountId: string): void;
  /** Prepend one manual transaction. */
  addTransaction(transaction: Transaction): void;
  /** Import validated CSV drafts — source "imported", never "connected". */
  importTransactions(drafts: readonly ImportDraft[], accountId: string): void;
  /** Inline category correction. */
  setTransactionCategory(txnId: string, category: string): void;
  /** Exclusions toggle (leaves all totals). */
  setTransactionExcluded(txnId: string, excluded: boolean): void;
  /** Mark as duplicate of another txn (auto-excludes) or clear. */
  setTransactionDuplicate(txnId: string, ofTxnId: string | null): void;
  /** User reviewed a possible-duplicate flag and chose to keep it. */
  setDuplicateIgnored(txnId: string, ignored: boolean): void;
  /** Reconcile pending → posted. */
  markTransactionPosted(txnId: string): void;
  /** Re-label a user-entered expense as a transfer (not spending). */
  markTransactionTransfer(txnId: string): void;
  /** Simulated reconnect / connection-status change (prototype only). */
  setAccountConnectionStatus(accountId: string, status: Account["connectionStatus"]): void;
}

const ClientDataContext = createContext<ClientStore | null>(null);

function currentState(onboarded: boolean, household: Household | null): PersistedAppState {
  return { version: 1, onboarded, household, savedAt: new Date().toISOString() };
}

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [app, setApp] = useState<PersistedAppState | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Hydrate once on the client. SSR never sees localStorage.
  useEffect(() => {
    const storage = defaultStorage();
    setLoadError(storageIsCorrupt(storage));
    setApp(loadPersisted(storage));
    setStatus("ready");
  }, []);

  // Persist every committed state (idempotent; null entry clears the key).
  useEffect(() => {
    if (status !== "ready") return;
    savePersisted(app, defaultStorage());
  }, [app, status]);

  const loadDemo = useCallback(() => {
    setApp(currentState(true, demoHousehold()));
  }, []);

  const saveManual = useCallback((inputs: ManualOnboardingInputs) => {
    setApp(currentState(true, manualHouseholdFor(inputs, new Date().toISOString())));
  }, []);

  const replaceHousehold = useCallback((inputs: ManualOnboardingInputs) => {
    setApp(currentState(true, manualHouseholdFor(inputs, new Date().toISOString())));
  }, []);

  const startOver = useCallback(() => {
    clearPersisted(defaultStorage());
    setApp(null);
    setLoadError(false);
  }, []);

  /** Apply a pure household mutation and persist. */
  const mutate = useCallback((fn: (h: Household) => Household) => {
    setApp((prev) => {
      if (!prev?.household) return prev;
      return currentState(true, fn(prev.household));
    });
  }, []);

  const setGivingPlan = useCallback(
    (plan: GivingPlan) => mutate((h) => withGivingPlan(h, plan)),
    [mutate],
  );
  const setRuleStatus = useCallback(
    (ruleId: string, status: AutomationRuleStatus) =>
      mutate((h) => withRuleStatus(h, ruleId, status)),
    [mutate],
  );
  const setAllRulesPaused = useCallback(
    (paused: boolean) => mutate((h) => withAllRulesPaused(h, paused)),
    [mutate],
  );
  const setGoalPriority = useCallback(
    (goalId: string, priority: number) =>
      mutate((h) => withGoalPriority(h, goalId, priority)),
    [mutate],
  );
  const setDebtExtraBudget = useCallback(
    (cents: number) => mutate((h) => withDebtExtraBudget(h, cents)),
    [mutate],
  );
  const setAdoptedDebtExtra = useCallback(
    (cents: number) => mutate((h) => withAdoptedDebtExtra(h, cents)),
    [mutate],
  );

  /* ---------------------------------------------------- Phase 3c actions */
  const addAccount = useCallback(
    (account: Account) => mutate((h) => withAddedAccount(h, account)),
    [mutate],
  );
  const deleteAccount = useCallback(
    (accountId: string) => mutate((h) => withDeletedAccount(h, accountId)),
    [mutate],
  );
  const addTransaction = useCallback(
    (transaction: Transaction) => mutate((h) => withAddedTransaction(h, transaction)),
    [mutate],
  );
  const importTransactions = useCallback(
    (drafts: readonly ImportDraft[], accountId: string) =>
      mutate((h) => withImportedTransactions(h, drafts, accountId)),
    [mutate],
  );
  const setTransactionCategory = useCallback(
    (txnId: string, category: string) =>
      mutate((h) => withTransactionCategory(h, txnId, category)),
    [mutate],
  );
  const setTransactionExcluded = useCallback(
    (txnId: string, excluded: boolean) =>
      mutate((h) => withTransactionExcluded(h, txnId, excluded)),
    [mutate],
  );
  const setTransactionDuplicate = useCallback(
    (txnId: string, ofTxnId: string | null) =>
      mutate((h) => withTransactionDuplicate(h, txnId, ofTxnId)),
    [mutate],
  );
  const setDuplicateIgnored = useCallback(
    (txnId: string, ignored: boolean) =>
      mutate((h) => withDuplicateIgnored(h, txnId, ignored)),
    [mutate],
  );
  const markTransactionPosted = useCallback(
    (txnId: string) => mutate((h) => withTransactionPosted(h, txnId)),
    [mutate],
  );
  const markTransactionTransfer = useCallback(
    (txnId: string) => mutate((h) => withTransactionTransfer(h, txnId)),
    [mutate],
  );
  const setAccountConnectionStatus = useCallback(
    (accountId: string, status: Account["connectionStatus"]) =>
      mutate((h) => withAccountConnectionStatus(h, accountId, status)),
    [mutate],
  );

  const value = useMemo<ClientStore>(
    () => ({
      status,
      onboarded: app?.onboarded ?? false,
      loadError,
      household: app?.household ?? null,
      loadDemo,
      saveManual,
      replaceHousehold,
      startOver,
      setGivingPlan,
      setRuleStatus,
      setAllRulesPaused,
      setGoalPriority,
      setDebtExtraBudget,
      setAdoptedDebtExtra,
      addAccount,
      deleteAccount,
      addTransaction,
      importTransactions,
      setTransactionCategory,
      setTransactionExcluded,
      setTransactionDuplicate,
      setDuplicateIgnored,
      markTransactionPosted,
      markTransactionTransfer,
      setAccountConnectionStatus,
    }),
    [
      status,
      app,
      loadError,
      loadDemo,
      saveManual,
      replaceHousehold,
      startOver,
      setGivingPlan,
      setRuleStatus,
      setAllRulesPaused,
      setGoalPriority,
      setDebtExtraBudget,
      setAdoptedDebtExtra,
      addAccount,
      deleteAccount,
      addTransaction,
      importTransactions,
      setTransactionCategory,
      setTransactionExcluded,
      setTransactionDuplicate,
      setDuplicateIgnored,
      markTransactionPosted,
      markTransactionTransfer,
      setAccountConnectionStatus,
    ],
  );

  return <ClientDataContext.Provider value={value}>{children}</ClientDataContext.Provider>;
}

export function useClientData(): ClientStore {
  const value = useContext(ClientDataContext);
  if (!value) {
    throw new Error("useClientData must be used inside <ClientDataProvider>");
  }
  return value;
}

/** Current ISO date used by screens for plan building. */
export function useToday(): string {
  return todayISO();
}