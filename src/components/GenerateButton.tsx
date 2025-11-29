import { h, Fragment } from 'preact';

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  status?: string | null;
}

export function GenerateButton({ onClick, disabled, isGenerating, status }: GenerateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isGenerating}
      class="btn btn--primary"
    >
      {isGenerating ? (
        <Fragment>
          <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1" />
          </svg>
          <span>{status || 'Generating...'}</span>
        </Fragment>
      ) : (
        <Fragment>
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span>Generate</span>
        </Fragment>
      )}
    </button>
  );
}
