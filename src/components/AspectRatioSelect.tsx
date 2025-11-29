import { h, JSX } from 'preact';
import type { AspectRatio } from '../types';

interface AspectRatioSelectProps {
  value: AspectRatio;
  onChange: (value: AspectRatio) => void;
  disabled?: boolean;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '4:3', label: 'Landscape (4:3)' },
  { value: '16:9', label: 'Wide (16:9)' },
  { value: '3:4', label: 'Portrait (3:4)' },
  { value: '9:16', label: 'Tall (9:16)' }
];

export function AspectRatioSelect({ value, onChange, disabled }: AspectRatioSelectProps) {
  const handleChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    onChange(e.currentTarget.value as AspectRatio);
  };

  return (
    <div class="field">
      <label class="field-label">Aspect Ratio</label>
      <div class="select-wrapper">
        <select
          class="select"
          value={value}
          onChange={handleChange}
          disabled={disabled}
        >
          {ASPECT_RATIOS.map(ratio => (
            <option key={ratio.value} value={ratio.value}>
              {ratio.label}
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
