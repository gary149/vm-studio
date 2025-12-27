import { h } from 'preact';
import type { InputImage } from '../types';

interface ThumbnailStripProps {
  images: InputImage[];
  maxHeight?: number;
}

export function ThumbnailStrip({ images, maxHeight = 25 }: ThumbnailStripProps) {
  if (images.length === 0) return null;

  return (
    <div class="thumbnail-strip">
      <div class="thumbnail-strip-images">
        {images.map(img => (
          <div key={img.id} class="thumbnail-item" title={img.name}>
            <img
              src={img.thumbnail}
              alt={img.name}
              style={{ height: `${maxHeight}px`, width: 'auto' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
