import type { ProviderId, ProviderConfig, GenerationRequest, GenerationResult } from '../types';

// Provider configurations
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  'google-ai': {
    id: 'google-ai',
    name: 'Google AI Studio',
    requiresApiKey: true,
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', supportsImageGeneration: true },
      { id: 'imagen-3.0-generate-002', name: 'Imagen 3', supportsImageGeneration: true },
    ]
  },
  'openrouter': {
    id: 'openrouter',
    name: 'OpenRouter',
    requiresApiKey: true,
    models: [
      { id: 'google/gemini-3-pro-image-preview', name: 'Nano Banana Pro', supportsImageGeneration: true },
    ]
  }
};

export function getProvider(providerId: ProviderId): ProviderConfig {
  return PROVIDERS[providerId];
}

export function getProviderList(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

export function getDefaultModel(providerId: ProviderId): string {
  const provider = PROVIDERS[providerId];
  return provider.models[0]?.id || '';
}
