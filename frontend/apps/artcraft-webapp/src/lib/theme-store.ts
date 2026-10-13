import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyThemeToDocument(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: (theme: ThemeMode) => {
        const resolved = theme === "system" ? getSystemTheme() : theme;
        applyThemeToDocument(resolved);
        set({ theme, resolvedTheme: resolved });
      },
      toggleTheme: () => {
        const current = get().resolvedTheme;
        const next = current === "dark" ? "light" : "dark";
        applyThemeToDocument(next);
        set({ theme: next, resolvedTheme: next });
      },
    }),
    {
      name: "artcraft-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved =
            state.theme === "system" ? getSystemTheme() : state.theme;
          applyThemeToDocument(resolved);
          state.resolvedTheme = resolved;
        }
      },
    }
  )
);

// Global listener for system theme preference
if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  mediaQuery.addEventListener("change", (e) => {
    const store = useThemeStore.getState();
    if (store.theme === "system") {
      const resolved = e.matches ? "light" : "dark";
      applyThemeToDocument(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });

  // Apply immediately on script load to prevent flash
  try {
    const stored = localStorage.getItem("artcraft-theme");
    const parsed = stored ? JSON.parse(stored) : null;
    const mode: ThemeMode = parsed?.state?.theme || "dark";
    const resolved = mode === "system" ? getSystemTheme() : mode;
    applyThemeToDocument(resolved);
  } catch {
    applyThemeToDocument("dark");
  }
}
