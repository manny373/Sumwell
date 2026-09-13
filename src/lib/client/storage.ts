/**
 * localStorage persistence for the client data layer — Phase 3a.
 *
 * One key ("sumwell:v1") holds the whole app state. Loading is defensive:
 * corrupt, truncated, or schema-unknown data returns null ("start over")
 * instead of crashing the app. Saving is best-effort (quota/privacy-mode
 * failures are swallowed — the session simply won't survive a reload).
 *
 * localStorage is passed in so tests can use a fake; defaults to the browser
 * global and degrades to a no-op storage when absent (SSR).
 */
import type { PersistedAppState } from "./types";

export const STORAGE_KEY = "sumwell:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Browser localStorage when available (client only), else null. */
export function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Minimal shape validation so a bad string can never crash the app. */
export function isPersistedState(value: unknown): value is PersistedAppState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.onboarded !== "boolean") return false;
  if (typeof v.savedAt !== "string") return false;
  if (v.household === null) return true;
  if (typeof v.household !== "object") return false;
  const h = v.household as Record<string, unknown>;
  if (h.source !== "demo" && h.source !== "manual") return false;
  if (typeof h.label !== "string") return false;
  if (typeof h.createdAt !== "string" || typeof h.generatedAt !== "string") {
    return false;
  }
  for (const key of [
    "accounts",
    "transactions",
    "paychecks",
    "obligations",
    "debts",
    "goals",
    "automationRules",
  ]) {
    if (!Array.isArray(h[key])) return false;
  }
  if (typeof h.givingPlan !== "object" || h.givingPlan === null) return false;
  const assumptions = h.assumptions as Record<string, unknown> | undefined;
  if (typeof assumptions !== "object" || assumptions === null) return false;
  if (
    typeof assumptions.essentialsPerCycleCents !== "number" ||
    typeof assumptions.bufferCents !== "number" ||
    !Array.isArray(assumptions.goalContributions)
  ) {
    return false;
  }
  // Obligations need at least the fields the Home plan reads.
  for (const obligation of h.obligations as Array<Record<string, unknown>>) {
    if (
      typeof obligation.name !== "string" ||
      typeof obligation.amountCents !== "number"
    ) {
      return false;
    }
  }
  return true;
}

/** Read + validate persisted state. Returns null for any failure. */
export function loadPersisted(storage: StorageLike | null): PersistedAppState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedState(parsed) ? parsed : null;
  } catch {
    // Corrupt/old data → fall back to "start over"; never crash.
    return null;
  }
}

/**
 * True when a saved payload EXISTS but could not be read (corrupt JSON or a
 * shape this version no longer understands). Distinct from "nothing saved
 * yet", which is a normal first-visit state and never an error.
 */
export function storageIsCorrupt(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null || raw === "") return false;
    return loadPersisted(storage) === null;
  } catch {
    return false;
  }
}

/** Save the app state (best-effort). */
export function savePersisted(state: PersistedAppState | null, storage: StorageLike | null): void {
  if (!storage) return;
  try {
    if (state === null) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or privacy mode — nothing to do; the session just won't persist.
  }
}

/** Delete all persisted app state. */
export function clearPersisted(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — clearing is best-effort.
  }
}