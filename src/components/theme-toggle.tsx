import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem("cc_theme") as ThemeMode | null;
  if (stored) {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

  const onToggle = () => {
    const updated = nextTheme;
    setTheme(updated);
    localStorage.setItem("cc_theme", updated);
    applyTheme(updated);
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground hover:bg-surface"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "Light" : "Dark"} mode
    </button>
  );
}
