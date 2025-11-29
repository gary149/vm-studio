import { h, JSX } from 'preact';
import type { ProviderId, ProviderConfig } from '../types';

interface ProviderPickerProps {
  providers: ProviderConfig[];
  selectedProviderId: ProviderId;
  selectedModelId: string;
  onProviderChange: (providerId: ProviderId) => void;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

const ChevronIcon = () => (
  <svg class="select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function ProviderPicker({
  providers,
  selectedProviderId,
  selectedModelId,
  onProviderChange,
  onModelChange,
  disabled
}: ProviderPickerProps) {
  const selectedProvider = providers.find(p => p.id === selectedProviderId);
  const models = selectedProvider?.models || [];

  const handleProviderChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    onProviderChange(e.currentTarget.value as ProviderId);
  };

  const handleModelChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    onModelChange(e.currentTarget.value);
  };

  return (
    <div class="row">
      <div class="field">
        <label class="field-label">Model</label>
        <div class="select-wrapper">
          <select
            value={selectedModelId}
            onChange={handleModelChange}
            disabled={disabled}
            class="select"
          >
            {models.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
      </div>

      <div class="field">
        <label class="field-label">Provider</label>
        <div class="select-wrapper">
          <select
            value={selectedProviderId}
            onChange={handleProviderChange}
            disabled={disabled}
            class="select"
          >
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
      </div>
    </div>
  );
}
