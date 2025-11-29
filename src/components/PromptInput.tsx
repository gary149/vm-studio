import { h, JSX } from 'preact';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PromptInput({ value, onChange, disabled, placeholder }: PromptInputProps) {
  const handleInput = (e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
    onChange(e.currentTarget.value);
  };

  return (
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        Prompt
      </label>
      <textarea
        value={value}
        onInput={handleInput}
        disabled={disabled}
        placeholder={placeholder || "Describe the image you want to generate..."}
        class="w-full h-24 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
