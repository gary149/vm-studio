import type { ProviderId, ProviderConfig } from '../types';

// Provider configurations
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  'fal': {
    id: 'fal',
    name: 'Fal.ai',
    requiresApiKey: true,
    apiKeyUrl: 'https://fal.ai/dashboard/keys',
    models: [
      { id: 'fal-ai/nano-banana-pro', name: 'Nano Banana Pro', supportsImageGeneration: true },
    ]
  },
  'openrouter': {
    id: 'openrouter',
    name: 'OpenRouter',
    requiresApiKey: true,
    apiKeyUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'google/gemini-3-pro-image-preview', name: 'Nano Banana Pro', supportsImageGeneration: true },
    ]
  },
  'gemini': {
    id: 'gemini',
    name: 'Google AI Studio',
    requiresApiKey: true,
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', supportsImageGeneration: true },
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
