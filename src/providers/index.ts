import type { ProviderId, ProviderConfig } from '../types';

// Provider configurations
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  'openrouter': {
    id: 'openrouter',
    name: 'OpenRouter',
    requiresApiKey: true,
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    models: [
      { id: 'google/gemini-3-pro-image-preview', name: 'Nano Banana Pro', supportsImageGeneration: true },
    ]
  },
  'replicate': {
    id: 'replicate',
    name: 'Replicate',
    requiresApiKey: true,
    apiKeyUrl: 'https://replicate.com/account/api-tokens',
    models: [
      { id: 'google/nano-banana-pro', name: 'Nano Banana Pro', supportsImageGeneration: true },
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
