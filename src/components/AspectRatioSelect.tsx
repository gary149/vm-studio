import { h, JSX } from "preact";
import type { AspectRatio } from "../types";

interface AspectRatioSelectProps {
  value: AspectRatio;
  onChange: (value: AspectRatio) => void;
  disabled?: boolean;
}

const LANDSCAPE_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "5:4", label: "5:4 Photo" },
  { value: "4:3", label: "4:3 Standard" },
  { value: "3:2", label: "3:2 Classic" },
  { value: "16:9", label: "16:9 Wide" },
  { value: "21:9", label: "21:9 Ultra-wide" },
];

const PORTRAIT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "4:5", label: "4:5 Photo" },
  { value: "3:4", label: "3:4 Standard" },
  { value: "2:3", label: "2:3 Classic" },
  { value: "9:16", label: "9:16 Tall" },
];

export function AspectRatioSelect({
  value,
  onChange,
  disabled,
}: AspectRatioSelectProps) {
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
          <option value="auto">Auto</option>
          <option value="1:1">1:1 Square</option>
          <optgroup label="Landscape">
            {LANDSCAPE_RATIOS.map((ratio) => (
              <option key={ratio.value} value={ratio.value}>
                {ratio.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Portrait">
            {PORTRAIT_RATIOS.map((ratio) => (
              <option key={ratio.value} value={ratio.value}>
                {ratio.label}
              </option>
            ))}
          </optgroup>
        </select>
        <svg class="select-chevron" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
