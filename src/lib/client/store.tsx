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
import type { AutomationRuleStatus, GivingPlan } from "~/lib/finance/types";
import { todayISO } from "./dates";
import {
  demoHousehold,
  manualHouseholdFor,
  withAllRulesPaused,
  withDebtExtraBudget,
  withGivingPlan,
  withGoalPriority,
  withRuleStatus,
} from "./household";
import {
  clearPersisted,
  defaultStorage,
  loadPersisted,
  savePersisted,
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
}

const ClientDataContext = createContext<ClientStore | null>(null);

function currentState(onboarded: boolean, household: Household | null): PersistedAppState {
  return { version: 1, onboarded, household, savedAt: new Date().toISOString() };
}

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [app, setApp] = useState<PersistedAppState | null>(null);

  // Hydrate once on the client. SSR never sees localStorage.
  useEffect(() => {
    setApp(loadPersisted(defaultStorage()));
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

  const value = useMemo<ClientStore>(
    () => ({
      status,
      onboarded: app?.onboarded ?? false,
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
    }),
    [
      status,
      app,
      loadDemo,
      saveManual,
      replaceHousehold,
      startOver,
      setGivingPlan,
      setRuleStatus,
      setAllRulesPaused,
      setGoalPriority,
      setDebtExtraBudget,
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