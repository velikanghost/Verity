"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "verity-theme";
const THEME_CHANGE_EVENT = "verity-theme-change";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isTheme(stored)) return stored;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = getStoredTheme();
    setTheme(storedTheme);
    applyTheme(storedTheme);

    function handleThemeChange(event: Event) {
      const nextTheme = (event as CustomEvent<Theme>).detail;
      if (!isTheme(nextTheme)) return;
      setTheme(nextTheme);
      applyTheme(nextTheme);
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[32px] bg-parchment-card text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface"
      onClick={() => {
        const nextTheme = isDark ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
        window.dispatchEvent(
          new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: nextTheme }),
        );
      }}
      type="button"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
