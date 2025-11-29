import { h, JSX } from 'preact';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PromptInput({ value, onChange, disabled }: PromptInputProps) {
  const handleInput = (e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
    onChange(e.currentTarget.value);
  };

  return (
    <div class="field">
      <label class="field-label">Prompt</label>
      <textarea
        value={value}
        onInput={handleInput}
        disabled={disabled}
        placeholder="Describe the image you want to generate..."
        class="input textarea"
      />
    </div>
  );
}
