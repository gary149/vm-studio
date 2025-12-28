import { h, JSX } from "preact";

interface CountInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
}

export function CountInput({
  value,
  onChange,
  disabled,
  min = 1,
}: CountInputProps) {
  const handleInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const num = parseInt(e.currentTarget.value, 10);
    if (!isNaN(num) && num >= min) {
      onChange(num);
    }
  };

  return (
    <div class="field">
      <label class="field-label">Images</label>
      <input
        type="number"
        value={value}
        onInput={handleInput}
        disabled={disabled}
        min={min}
        class="input"
      />
    </div>
  );
}
