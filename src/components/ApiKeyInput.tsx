import { h, JSX } from 'preact';
import { useState } from 'preact/hooks';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  providerName: string;
  disabled?: boolean;
}

export function ApiKeyInput({ value, onChange, providerName, disabled }: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);

  const handleInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  };

  const toggleVisibility = () => {
    setShowKey(!showKey);
  };

  return (
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {providerName} API Key
      </label>
      <div class="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          onInput={handleInput}
          disabled={disabled}
          placeholder="Enter your API key..."
          class="w-full px-3 py-2 pr-10 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-50"
        >
          {showKey ? (
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        Your API key is stored locally in Figma's client storage.
      </p>
    </div>
  );
}
