import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export type ThemeMode = "light" | "dark";

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem("cc_theme") as ThemeMode | null;
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "compact" | "menu-item";
}

export function ThemeToggle({
  className,
  showLabel,
  variant = "default",
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const onToggle = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("cc_theme", nextTheme);
    applyTheme(nextTheme);
  };

  const isDark = theme === "dark";

  if (variant === "menu-item") {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={className || "flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"}
        aria-label="Toggle theme"
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Sun size={18} className="text-amber-400" />
          ) : (
            <Moon size={18} className="text-blue-600 dark:text-blue-400" />
          )}
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
          {isDark ? "Dark On" : "Light On"}
        </span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={className || "flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition shadow-xs"}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <Sun size={17} className="text-amber-400 transition-transform hover:rotate-45" />
        ) : (
          <Moon size={17} className="text-blue-600 dark:text-blue-400 transition-transform hover:-rotate-12" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={className || "flex items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface shadow-xs transition"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun size={15} className="text-amber-400" />
      ) : (
        <Moon size={15} className="text-blue-600 dark:text-blue-400" />
      )}
      {showLabel !== false && (
        <span>{isDark ? "Light" : "Dark"}</span>
      )}
    </button>
  );
}
