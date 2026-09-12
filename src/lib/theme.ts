/**
 * Theme — light/dark/system preference.
 *
 * The .dark class on <html> flips every --sw-* variable in the brand module,
 * so components never branch on theme in JS. This module only persists the
 * user's preference and applies the class (plus an early, pre-paint script
 * that prevents a flash of the wrong theme).
 */

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "sw-theme";
/** Dispatched on window after the theme changes (styleguide reads CSS vars on it). */
export const THEME_EVENT = "sw:theme";

export function getStoredPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable — fall through to system */
  }
  return "system";
}

export function resolvePref(pref: ThemePref): ResolvedTheme {
  if (pref !== "system") return pref;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function applyTheme(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(
    "dark",
    resolvePref(pref) === "dark",
  );
}

/**
 * Runs inline in <head> before first paint so the correct theme is set before
 * any CSS variables are resolved (no flash of the wrong theme after SSR).
 */
export const themeInitScript = `(function(){try{var k="sw-theme";var p=localStorage.getItem(k);var dark=p==="dark"||((!p||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");}catch(e){}})();`;