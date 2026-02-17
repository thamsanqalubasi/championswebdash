import { useEffect, useCallback } from "react";

type ImageGalleryProps = {
  images: string[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function ImageGallery({ images, currentIndex, open, onClose, onNavigate }: ImageGalleryProps) {
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white text-2xl hover:bg-white/20 transition-colors"
        aria-label="Close gallery"
      >
        &times;
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white/90">
        {currentIndex + 1} of {images.length}
      </div>

      {/* Previous button */}
      {hasPrev && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white text-2xl hover:bg-white/20 transition-colors"
          aria-label="Previous image"
        >
          &#8249;
        </button>
      )}

      {/* Next button */}
      {hasNext && (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white text-2xl hover:bg-white/20 transition-colors"
          aria-label="Next image"
        >
          &#8250;
        </button>
      )}

      {/* Image */}
      <div className="flex h-full w-full items-center justify-center p-16">
        <img
          src={currentSrc}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          className="max-h-full max-w-full object-contain rounded-lg select-none"
          draggable={false}
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 rounded-lg bg-black/60 p-2 max-w-[90vw] overflow-x-auto">
          {images.map((src, idx) => (
            <button
              key={src}
              type="button"
              onClick={() => onNavigate(idx)}
              className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                idx === currentIndex ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
