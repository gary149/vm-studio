import { h, JSX } from "preact";
import type { Quality } from "../types";

interface QualitySelectProps {
  value: Quality;
  onChange: (value: Quality) => void;
  disabled?: boolean;
}

const QUALITY_LABELS: Record<Quality, string> = {
  low: "Low (fastest)",
  medium: "Medium",
  high: "High (slowest)",
};

const QUALITY_OPTIONS: Quality[] = ["low", "medium", "high"];

export function QualitySelect({
  value,
  onChange,
  disabled,
}: QualitySelectProps) {
  const handleChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    onChange(e.currentTarget.value as Quality);
  };

  return (
    <div class="field">
      <label class="field-label">Quality</label>
      <div class="select-wrapper">
        <select
          class="select"
          value={value}
          onChange={handleChange}
          disabled={disabled}
        >
          {QUALITY_OPTIONS.map((q) => (
            <option key={q} value={q}>
              {QUALITY_LABELS[q]}
            </option>
          ))}
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
