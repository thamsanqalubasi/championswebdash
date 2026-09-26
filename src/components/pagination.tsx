import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  itemsPerPage?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  itemsPerPage,
  totalPages: propTotalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  const activePageSize = itemsPerPage ?? pageSize ?? 10;
  const totalPages = propTotalPages ?? Math.max(1, Math.ceil(totalItems / activePageSize));

  if (totalItems <= activePageSize && totalPages <= 1) {
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

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border-color/60 text-xs text-muted ${className}`}
    >
      <div className="font-medium">
        Showing <strong className="text-foreground">{startItem}</strong> to{" "}
        <strong className="text-foreground">{endItem}</strong> of{" "}
        <strong className="text-foreground">{totalItems}</strong> entries
      </div>

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
