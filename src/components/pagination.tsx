import { ChevronLeft, ChevronRight, Rows3 } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  itemsPerPage?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  itemsPerPage,
  totalPages: propTotalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 50, 100],
  className = "",
}: PaginationProps) {
  const activePageSize = itemsPerPage ?? pageSize ?? 10;
  const totalPages = propTotalPages ?? Math.max(1, Math.ceil(totalItems / activePageSize));

  // Only hide pagination if totalItems <= 10 and only 1 page exists
  if (totalItems <= 10 && totalPages <= 1) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * activePageSize + 1;
  const endItem = Math.min(currentPage * activePageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      const leftBound = Math.max(2, currentPage - 1);
      const rightBound = Math.min(totalPages - 1, currentPage + 1);

      if (leftBound > 2) {
        pages.push("...");
      }

      for (let i = leftBound; i <= rightBound; i++) {
        pages.push(i);
      }

      if (rightBound < totalPages - 1) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  const handleSizeSelect = (newSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border-color/60 text-xs text-muted ${className}`}
    >
      {/* Left: Summary and Page Size Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="font-medium">
          Showing <strong className="text-foreground">{startItem}</strong> to{" "}
          <strong className="text-foreground">{endItem}</strong> of{" "}
          <strong className="text-foreground">{totalItems}</strong> entries
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 bg-surface-elevated/70 px-2 py-1 rounded-xl border border-border-color/60">
            <Rows3 size={13} className="text-muted" />
            <span className="text-[11px] font-medium text-muted">Rows:</span>
            <div className="flex items-center gap-1">
              {pageSizeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSizeSelect(opt)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition ${
                    activePageSize === opt
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                  title={`Show ${opt} rows per page`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="flex items-center gap-1 rounded-xl border border-border-color bg-surface px-2.5 py-1.5 font-bold text-foreground hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
          title="Previous Page"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {pages.map((p, idx) => {
          if (p === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1 text-muted select-none"
              >
                ...
              </span>
            );
          }

          const pageNum = Number(p);
          const isActive = pageNum === currentPage;

          return (
            <button
              key={`page-${pageNum}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
              className={`min-w-[32px] h-8 rounded-xl px-2.5 text-xs font-black transition shadow-xs ${
                isActive
                  ? "bg-blue-600 text-white shadow-blue-500/20"
                  : "border border-border-color bg-surface text-foreground hover:bg-surface-elevated"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="flex items-center gap-1 rounded-xl border border-border-color bg-surface px-2.5 py-1.5 font-bold text-foreground hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
          title="Next Page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
