import { useState, type ReactNode } from "react";
import { Search, Plus, Download, ChevronRight, MoreHorizontal, Filter, ListFilter } from "lucide-react";

type FilterTab = {
  key: string;
  label: string;
  count?: number;
};

type DataTableHeaderProps = {
  title?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterTab[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
  actions?: ReactNode;
};

export function DataTableHeader({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  activeFilter,
  onFilterChange,
  actions,
}: DataTableHeaderProps) {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border-color bg-surface-elevated pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border-color/50">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {filters.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => onFilterChange(filter.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  {filter.label}
                  {filter.count !== undefined && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      isActive ? "bg-foreground text-surface" : "bg-muted/10 text-muted"
                    }`}>
                      {filter.count}
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-foreground rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const getStatusStyles = (s: string) => {
    const val = s.toLowerCase();
    if (["occupied", "active", "completed", "paid"].includes(val)) {
      return "bg-green-50 text-green-700 border-green-200/50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30";
    }
    if (["vacant", "open", "draft", "pending"].includes(val)) {
      return "bg-sky-50 text-sky-700 border-sky-200/50 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/30";
    }
    if (["maintenance", "in_progress", "notice", "partial"].includes(val)) {
      return "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30";
    }
    if (["cancelled", "overdue", "ended", "expired"].includes(val)) {
      return "bg-red-50 text-red-700 border-red-200/50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30";
    }
    return "bg-muted/5 text-muted border-border-color";
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStatusStyles(status)} ${className}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function TableRowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {children}
    </div>
  );
}

export function TableActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
}: {
  icon: any;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "danger" | "success";
  disabled?: boolean;
}) {
  const variants = {
    default: "text-muted hover:text-foreground hover:bg-surface-elevated",
    danger: "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20",
    success: "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20",
  };

  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${variants[variant]}`}
    >
      <Icon size={16} />
    </button>
  );
}
