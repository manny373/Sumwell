import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_EVENT,
  THEME_KEY,
  applyTheme,
  getStoredPref,
  resolvePref,
  type ResolvedTheme,
  type ThemePref,
} from "~/lib/theme";
import { cn } from "~/lib/cn";
import { MoonIcon, SunIcon } from "~/components/icons";

type ThemeContextValue = {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (pref: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  pref: "system",
  resolved: "light",
  setPref: () => {},
});

/**
 * Applies the persisted theme to <html> (the .dark class flips the brand CSS
 * variables) and keeps React state in sync. Dispatches THEME_EVENT so things
 * like the styleguide's computed-style swatches can re-read tokens.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const apply = (p: ThemePref) => {
      applyTheme(p);
      setResolved(resolvePref(p));
      window.dispatchEvent(new Event(THEME_EVENT));
    };
    const initial = getStoredPref();
    setPrefState(initial);
    apply(initial);
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const onSystemChange = () => {
      if (getStoredPref() === "system") apply("system");
    };
    mq?.addEventListener("change", onSystemChange);
    return () => mq?.removeEventListener("change", onSystemChange);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    applyTheme(p);
    setResolved(resolvePref(p));
    try {
      window.localStorage.setItem(THEME_KEY, p);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const value = useMemo(
    () => ({ pref, resolved, setPref }),
    [pref, resolved, setPref],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function iconButtonClass(className?: string): string {
  return cn(
    "inline-grid h-10 w-10 shrink-0 place-items-center rounded-control text-ink-muted transition-colors duration-150",
    "hover:bg-surface-sunken hover:text-ink",
    className,
  );
}

/** Toggles light/dark (icons are swapped via CSS, so SSR output is stable). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPref } = useTheme();
  const next: ThemePref = resolved === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={`Switch to ${next} theme`}
      className={iconButtonClass(className)}
    >
      <SunIcon className="h-5 w-5 dark:hidden" />
      <MoonIcon className="hidden h-5 w-5 dark:block" />
    </button>
  );
}