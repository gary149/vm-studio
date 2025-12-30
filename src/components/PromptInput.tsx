import { h, JSX } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  placeholder?: string;
  isEditingMode?: boolean;
  cursorPosition?: "start" | "end";
}

export function PromptInput({
  value,
  onChange,
  onPrevious,
  onNext,
  disabled,
  placeholder = "Describe the image you want to generate...",
  isEditingMode,
  cursorPosition,
}: PromptInputProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set cursor position when navigating history
  useEffect(() => {
    if (textareaRef.current && cursorPosition) {
      const pos = cursorPosition === "start" ? 0 : textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(pos, pos);
      textareaRef.current.focus();
    }
  }, [cursorPosition, value]);

  const handleInput = (e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
    onChange(e.currentTarget.value);
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const isAtStart =
      textarea.selectionStart === 0 && textarea.selectionEnd === 0;
    const isAtEnd = textarea.selectionStart === textarea.value.length;

    if (e.key === "ArrowUp" && isAtStart && onPrevious) {
      e.preventDefault();
      onPrevious();
    } else if (e.key === "ArrowDown" && isAtEnd && onNext) {
      e.preventDefault();
      onNext();
    }
  };

  const handleCopy = () => {
    if (value) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    }
  };

  return (
    <div class="field">
      <div class="field-label-row">
        <label class="field-label">
          Prompt{isEditingMode && " (editing mode)"}
        </label>
        <button
          type="button"
          class="field-link"
          onClick={handleCopy}
          disabled={!value}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        class="input textarea"
      />
    </div>
  );
}
