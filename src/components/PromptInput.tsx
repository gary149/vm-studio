import { h, JSX } from 'preact';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  disabled?: boolean;
}

export function PromptInput({ value, onChange, onPrevious, onNext, disabled }: PromptInputProps) {
  const handleInput = (e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
    onChange(e.currentTarget.value);
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const isAtStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
    const isAtEnd = textarea.selectionStart === textarea.value.length;

    if (e.key === 'ArrowUp' && isAtStart && onPrevious) {
      e.preventDefault();
      onPrevious();
    } else if (e.key === 'ArrowDown' && isAtEnd && onNext) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div class="field">
      <label class="field-label">Prompt</label>
      <textarea
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Describe the image you want to generate..."
        class="input textarea"
      />
    </div>
  );
}
