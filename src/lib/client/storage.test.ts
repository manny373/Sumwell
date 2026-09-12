import { describe, expect, test } from "bun:test";
import { demoHousehold } from "./household";
import {
  STORAGE_KEY,
  clearPersisted,
  isPersistedState,
  loadPersisted,
  savePersisted,
  type StorageLike,
} from "./storage";

/** Minimal in-memory localStorage stand-in. */
function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const validState = () => ({
  version: 1 as const,
  onboarded: true,
  household: demoHousehold("2026-09-12T00:00:00Z"),
  savedAt: "2026-09-12T04:00:00Z",
});

describe("storage", () => {
  test("round-trip survives serialization with all money intact (cents)", () => {
    const storage = fakeStorage();
    const household = demoHousehold("2026-09-12T00:00:00Z");
    savePersisted(
      { version: 1, onboarded: true, household, savedAt: "2026-09-12T04:00:00Z" },
      storage,
    );
    const loaded = loadPersisted(storage)!;
    expect(loaded.onboarded).toBe(true);
    expect(loaded.household!.accounts).toEqual(household.accounts);
    expect(loaded.household!.obligations).toEqual(household.obligations);
    expect(loaded.household!.assumptions).toEqual(household.assumptions);
    // Spot-check an integer-cent amount survived the JSON round trip exactly.
    expect(loaded.household!.accounts[0].availableBalanceCents).toBe(179994);
  });

  test("corrupt JSON falls back to null (start over), never crashes", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, "{definitely not json::");
    expect(loadPersisted(storage)).toBeNull();
  });

  test("unknown schema versions and wrong shapes are rejected", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, onboarded: true }));
    expect(loadPersisted(storage)).toBeNull();

    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, onboarded: true, savedAt: "x", household: { source: "alien" } }),
    );
    expect(loadPersisted(storage)).toBeNull();
  });

  test("missing arrays inside the household are rejected", () => {
    const storage = fakeStorage();
    const state = {
      version: 1,
      onboarded: true,
      savedAt: "x",
      household: { source: "demo", label: "Demo household" },
    };
    expect(isPersistedState(state)).toBe(false);
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    expect(loadPersisted(storage)).toBeNull();
  });

  test("onboarded with no household is a valid persisted state", () => {
    const state = { version: 1, onboarded: true, household: null, savedAt: "x" };
    expect(isPersistedState(state)).toBe(true);
  });

  test("saving null clears the key; clearPersisted leaves nothing", () => {
    const storage = fakeStorage();
    savePersisted(
      { version: 1, onboarded: true, household: null, savedAt: "x" },
      storage,
    );
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    savePersisted(null, storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    savePersisted({ version: 1, onboarded: true, household: null, savedAt: "x" }, storage);
    clearPersisted(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("missing storage (SSR) is a graceful null", () => {
    expect(loadPersisted(null)).toBeNull();
    expect(savePersisted(validState(), null)).toBeUndefined();
  });
});