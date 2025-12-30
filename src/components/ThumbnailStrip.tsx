import { h } from "preact";
import type { InputImage } from "../types";

interface ThumbnailStripProps {
  images: InputImage[];
  maxHeight?: number;
  onRemove?: (id: string) => void;
}

export function ThumbnailStrip({
  images,
  maxHeight = 25,
  onRemove,
}: ThumbnailStripProps) {
  if (images.length === 0) return null;

  return (
    <div class="thumbnail-strip">
      <div class="thumbnail-strip-images">
        {images.map((img) => (
          <div key={img.id} class="thumbnail-item" title={img.name}>
            <img
              src={img.thumbnail}
              alt={img.name}
              style={{ height: `${maxHeight}px`, width: "auto" }}
            />
            {onRemove && (
              <button
                class="thumbnail-close"
                onClick={() => onRemove(img.id)}
                aria-label="Remove"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
