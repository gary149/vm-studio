import { h, JSX } from 'preact';
import type { ProviderId, ProviderConfig, ModelConfig } from '../types';

interface ProviderPickerProps {
  providers: ProviderConfig[];
  selectedProviderId: ProviderId;
  selectedModelId: string;
  onProviderChange: (providerId: ProviderId) => void;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

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
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Provider
        </label>
        <select
          value={selectedProviderId}
          onChange={handleProviderChange}
          disabled={disabled}
          class="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {providers.map(provider => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Model
        </label>
        <select
          value={selectedModelId}
          onChange={handleModelChange}
          disabled={disabled}
          class="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {models.map(model => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
