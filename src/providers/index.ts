import type { ProviderId, ProviderConfig, ImageSize } from "../types";

// Provider configurations
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  fal: {
    id: "fal",
    name: "Fal.ai",
    requiresApiKey: true,
    apiKeyUrl: "https://fal.ai/dashboard/keys",
    models: [
      {
        id: "fal-ai/nano-banana-2",
        name: "Nano Banana 2",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "fal-ai/nano-banana-pro",
        name: "Nano Banana Pro",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "fal-ai/z-image/turbo",
        name: "Z-Image Turbo",
        supportsImageGeneration: true,
        supportsImageToImage: false,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "fal-ai/bytedance/seedream/v4.5",
        name: "Seedream v4.5",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "fal-ai/gpt-image-1.5",
        name: "GPT-Image 1.5",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K"],
      },
      {
        id: "openai/gpt-image-2",
        name: "GPT-Image 2",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "fal-ai/flux-2/turbo",
        name: "FLUX.2 [dev] Turbo",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K"],
      },
      {
        id: "fal-ai/flux-2/klein/9b",
        name: "FLUX.2 [klein] 9B",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K"],
      },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    requiresApiKey: true,
    apiKeyUrl: "https://openrouter.ai/keys",
    models: [
      {
        id: "google/gemini-3.1-flash-image-preview",
        name: "Nano Banana 2",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "google/gemini-3-pro-image-preview",
        name: "Nano Banana Pro",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "openai/gpt-5.4-image-2",
        name: "GPT-Image 2",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
    ],
  },
  gemini: {
    id: "gemini",
    name: "Google AI Studio",
    requiresApiKey: true,
    apiKeyUrl: "https://aistudio.google.com/apikey",
    models: [
      {
        id: "gemini-3.1-flash-image-preview",
        name: "Nano Banana 2",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "gemini-3-pro-image-preview",
        name: "Nano Banana Pro",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    requiresApiKey: true,
    apiKeyUrl: "https://platform.openai.com/api-keys",
    models: [
      {
        id: "gpt-image-1.5",
        name: "GPT-Image 1.5",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K"],
      },
      {
        id: "gpt-image-2",
        name: "GPT-Image 2",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K"],
      },
    ],
  },
};

export function getProvider(providerId: ProviderId): ProviderConfig {
  return PROVIDERS[providerId];
}

export function getProviderList(): ProviderConfig[] {
  return Object.values(PROVIDERS).sort((a, b) => a.name.localeCompare(b.name));
}

export function getDefaultModel(providerId: ProviderId): string {
  const provider = PROVIDERS[providerId];
  return provider.models[0]?.id || "";
}

export interface FlatModel {
  id: string;
  name: string;
  providerId: ProviderId;
  providerName: string;
}

export function getAllModels(): FlatModel[] {
  return Object.values(PROVIDERS).flatMap((provider) =>
    provider.models.map((model) => ({
      id: model.id,
      name: model.name,
      providerId: provider.id,
      providerName: provider.name,
    })),
  );
}

// Get unique model names (sorted alphabetically)
export function getUniqueModelNames(): string[] {
  const names = new Set<string>();
  for (const provider of Object.values(PROVIDERS)) {
    for (const model of provider.models) {
      names.add(model.name);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

// Get providers that offer a model with the given name (sorted alphabetically)
export function getProvidersForModelName(modelName: string): FlatModel[] {
  return getAllModels()
    .filter((m) => m.name === modelName)
    .sort((a, b) => a.providerName.localeCompare(b.providerName));
}

export function getProviderForModel(modelId: string): ProviderId | null {
  for (const provider of Object.values(PROVIDERS)) {
    if (provider.models.some((m) => m.id === modelId)) {
      return provider.id;
    }
  }
  return null;
}

export function modelSupportsImageToImage(modelId: string): boolean {
  for (const provider of Object.values(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return model.supportsImageToImage;
  }
  return false;
}

export function getModelSupportedImageSizes(modelId: string): ImageSize[] {
  for (const provider of Object.values(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return model.supportedImageSizes;
  }
  return ["1K"];
}
