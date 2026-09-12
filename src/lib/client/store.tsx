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
import { todayISO } from "./dates";
import { demoHousehold, manualHouseholdFor } from "./household";
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

  const value = useMemo<ClientStore>(
    () => ({
      status,
      onboarded: app?.onboarded ?? false,
      household: app?.household ?? null,
      loadDemo,
      saveManual,
      replaceHousehold,
      startOver,
    }),
    [status, app, loadDemo, saveManual, replaceHousehold, startOver],
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