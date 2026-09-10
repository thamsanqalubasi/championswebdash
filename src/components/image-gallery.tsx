import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";

type ImageGalleryProps = {
  images: string[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDelete?: (index: number) => void;
  deleting?: boolean;
};

export function ImageGallery({ images, currentIndex, open, onClose, onNavigate, onDelete, deleting }: ImageGalleryProps) {
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goPrev = useCallback(() => {
    onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1);
  }, [currentIndex, images.length, onNavigate]);

  const goNext = useCallback(() => {
    onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0);
  }, [currentIndex, images.length, onNavigate]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, goPrev, goNext]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || images.length === 0) return null;

  const currentSrc = images[currentIndex] ?? "";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/50 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {onDelete ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm("Delete this image?")) onDelete(currentIndex);
            }}
            className="flex items-center gap-2 rounded-xl bg-red-600/80 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        ) : (
          <div />
        )}

        <div className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
          {currentIndex + 1} / {images.length}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors backdrop-blur-sm"
          aria-label="Close gallery"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main image */}
      <div
        className="flex h-full w-full items-center justify-center px-20 py-24"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentSrc}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
          draggable={false}
        />
      </div>

      {/* Left arrow */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 transition-all shadow-xl backdrop-blur-sm"
          aria-label="Previous image"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      {/* Right arrow */}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 transition-all shadow-xl backdrop-blur-sm"
          aria-label="Next image"
        >
          <ChevronRight size={26} />
        </button>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 rounded-2xl bg-black/60 p-2 max-w-[90vw] overflow-x-auto backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((src, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onNavigate(idx)}
              className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                idx === currentIndex
                  ? "border-white opacity-100 scale-105 shadow-lg"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
