import { useCallback, useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "yeonsik-note-theme-mode";
const LEGACY_THEME_STORAGE_KEY = "local-sync-memo-theme-mode";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedValue =
      window.localStorage.getItem(THEME_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    return isThemeMode(storedValue) ? storedValue : "system";
  } catch {
    return "system";
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }

  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function useThemeMode() {
  const [themeMode, setThemeModeState] =
    useState<ThemeMode>(readStoredThemeMode);
  const [systemTheme, setSystemTheme] =
    useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme: ResolvedTheme =
    themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(DARK_QUERY);
    const handleChange = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themeMode = themeMode;
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    void invoke("set_launcher_icon_mode", { mode: resolvedTheme }).catch(() => undefined);
  }, [resolvedTheme]);

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    setThemeModeState(nextMode);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    } catch {
      // Theme is a local preference; failing to persist should not block the app.
    }
  }, []);

  return {
    resolvedTheme,
    setThemeMode,
    themeMode,
  };
}
