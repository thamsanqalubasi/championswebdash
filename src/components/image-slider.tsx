import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Image as ImageIcon } from "lucide-react";
import { ImageGallery } from "./image-gallery";

type ImageSliderProps = {
  images: string[];
  alt?: string;
  className?: string;
  aspectRatio?: "video" | "square" | "photo" | "tall";
  showThumbnails?: boolean;
  onDelete?: (index: number) => void;
  deletingIndex?: number | null;
};

export function ImageSlider({
  images,
  alt = "Image",
  className = "",
  aspectRatio = "video",
  showThumbnails = false,
  onDelete,
  deletingIndex,
}: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const safeImages = images.filter(Boolean);

  const goPrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((i) => (i > 0 ? i - 1 : safeImages.length - 1));
  }, [safeImages.length]);

  const goNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((i) => (i < safeImages.length - 1 ? i + 1 : 0));
  }, [safeImages.length]);

  const aspectClass: Record<string, string> = {
    video: "aspect-video",
    square: "aspect-square",
    photo: "aspect-[4/3]",
    tall: "aspect-[3/4]",
  };

  if (safeImages.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-border-color bg-surface-elevated/40 ${aspectClass[aspectRatio]} ${className}`}
      >
        <div className="flex flex-col items-center gap-2 text-muted/40">
          <ImageIcon size={32} />
          <span className="text-xs">No photos</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative select-none ${className}`}>
      <div
        className={`group relative overflow-hidden rounded-xl bg-black cursor-pointer ${aspectClass[aspectRatio]}`}
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src={safeImages[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          draggable={false}
        />
        <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
          <Maximize2 size={14} />
        </div>
        {safeImages.length > 1 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
            {currentIndex + 1} / {safeImages.length}
          </div>
        )}
        {safeImages.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all shadow-md"
            aria-label="Previous image"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {safeImages.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all shadow-md"
            aria-label="Next image"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
      {safeImages.length > 1 && !showThumbnails && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {safeImages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === currentIndex ? "w-5 bg-blue-600" : "w-1.5 bg-muted/30 hover:bg-muted/60"
              }`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
      {showThumbnails && safeImages.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {safeImages.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                i === currentIndex ? "border-blue-600 shadow-md" : "border-transparent opacity-60 hover:opacity-90"
              }`}
            >
              <img src={src} alt={`Thumb ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
      <ImageGallery
        images={safeImages}
        currentIndex={currentIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrentIndex}
        onDelete={onDelete}
        deleting={deletingIndex !== undefined && deletingIndex !== null}
      />
    </div>
  );
}
