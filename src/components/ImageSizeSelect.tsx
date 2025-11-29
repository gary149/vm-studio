import { h, JSX } from 'preact';
import type { ImageSize } from '../types';

interface ImageSizeSelectProps {
  value: ImageSize;
  onChange: (value: ImageSize) => void;
  disabled?: boolean;
}

const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: '1K', label: '1K (1024px)' },
  { value: '2K', label: '2K (2048px)' },
  { value: '4K', label: '4K (4096px)' }
];

export function ImageSizeSelect({ value, onChange, disabled }: ImageSizeSelectProps) {
  const handleChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    onChange(e.currentTarget.value as ImageSize);
  };

  return (
    <div class="field">
      <label class="field-label">Size</label>
      <div class="select-wrapper">
        <select
          class="select"
          value={value}
          onChange={handleChange}
          disabled={disabled}
        >
          {IMAGE_SIZES.map(size => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
        <svg class="select-chevron" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
