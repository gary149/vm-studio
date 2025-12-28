import { h, JSX } from "preact";
import type { ProviderId } from "../types";
import {
  getUniqueModelNames,
  getProvidersForModelName,
  getAllModels,
} from "../providers";

interface ProviderPickerProps {
  selectedModelId: string;
  onModelChange: (modelId: string, providerId: ProviderId) => void;
  disabled?: boolean;
}

const ChevronIcon = () => (
  <svg
    class="select-chevron"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function ProviderPicker({
  selectedModelId,
  onModelChange,
  disabled,
}: ProviderPickerProps) {
  const allModels = getAllModels();
  const modelNames = getUniqueModelNames();

  // Find current model info
  const currentModel = allModels.find((m) => m.id === selectedModelId);
  const currentModelName = currentModel?.name || modelNames[0];

  // Get providers available for current model name
  const availableProviders = getProvidersForModelName(currentModelName);

  const handleModelNameChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    const newModelName = e.currentTarget.value;
    const providers = getProvidersForModelName(newModelName);
    if (providers.length > 0) {
      // Auto-select first provider for this model
      onModelChange(providers[0].id, providers[0].providerId);
    }
  };

  const handleProviderChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    const newModelId = e.currentTarget.value;
    const model = allModels.find((m) => m.id === newModelId);
    if (model) {
      onModelChange(newModelId, model.providerId);
    }
  };

  return (
    <div class="row">
      <div class="field">
        <label class="field-label">Model</label>
        <div class="select-wrapper">
          <select
            value={currentModelName}
            onChange={handleModelNameChange}
            disabled={disabled}
            class="select"
          >
            {modelNames.map((name) => (
              <option key={name} value={name}>
                {name}
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
            value={selectedModelId}
            onChange={handleProviderChange}
            disabled={disabled}
            class="select"
          >
            {availableProviders.map((model) => (
              <option key={model.id} value={model.id}>
                {model.providerName}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
      </div>
    </div>
  );
}
