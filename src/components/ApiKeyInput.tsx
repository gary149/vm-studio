import { h, JSX } from "preact";
import { useState } from "preact/hooks";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  providerName: string;
  apiKeyUrl?: string;
  disabled?: boolean;
}

export function ApiKeyInput({
  value,
  onChange,
  providerName,
  apiKeyUrl,
  disabled,
}: ApiKeyInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  };

  return (
    <div class="field">
      <div class="field-label-row">
        <label class="field-label">{providerName} API Key</label>
        {apiKeyUrl && (
          <a
            href={apiKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="field-link"
          >
            Get API Key
          </a>
        )}
      </div>
      <div class="input-wrapper">
        <input
          type={isVisible ? "text" : "password"}
          value={value}
          onInput={handleInput}
          disabled={disabled}
          placeholder="Enter your API key"
          class="input input--with-icon"
        />
        <button
          type="button"
          style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: var(--color-text-tertiary);"
          onClick={() => setIsVisible(!isVisible)}
          disabled={disabled}
        >
          {isVisible ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
