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
        id: "google/nano-banana-lite",
        name: "Nano Banana 2 Lite",
        supportsImageGeneration: true,
        supportsImageToImage: true, // Has a /edit endpoint (accepts image_urls)
        supportedImageSizes: ["1K"], // Fixed 1K output; no resolution param
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
      {
        id: "ideogram/v4",
        name: "Ideogram 4",
        supportsImageGeneration: true,
        supportsImageToImage: true, // /image-to-image endpoint (single image_url)
        supportedImageSizes: ["1K", "2K"], // Native 2K max; no 4K tier
      },
      {
        id: "krea/v2/large/text-to-image",
        name: "Krea 2 Large",
        supportsImageGeneration: true,
        supportsImageToImage: false, // No /edit endpoint; text-to-image only
        supportedImageSizes: ["1K"], // No resolution param; aspect_ratio only
      },
      {
        id: "krea/v2/medium/text-to-image",
        name: "Krea 2 Medium",
        supportsImageGeneration: true,
        supportsImageToImage: false, // No /edit endpoint; text-to-image only
        supportedImageSizes: ["1K"], // No resolution param; aspect_ratio only
      },
      {
        id: "fal-ai/krea-2/turbo",
        name: "Krea 2 Turbo",
        supportsImageGeneration: true,
        supportsImageToImage: false, // Text-to-image only
        supportedImageSizes: ["1K"],
      },
      {
        id: "microsoft/mai-image-2.5",
        name: "MAI-Image 2.5",
        supportsImageGeneration: true,
        supportsImageToImage: false, // No /edit endpoint; text-to-image only
        supportedImageSizes: ["1K"], // No resolution param; single tier
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
        // GA endpoint (replaces "google/gemini-3.1-flash-image-preview").
        id: "google/gemini-3.1-flash-image",
        name: "Nano Banana 2",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        // GA endpoint (replaces "google/gemini-3-pro-image-preview").
        id: "google/gemini-3-pro-image",
        name: "Nano Banana Pro",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K", "2K", "4K"],
      },
      {
        id: "google/gemini-3.1-flash-lite-image",
        name: "Nano Banana 2 Lite",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K"],
      },
      {
        // Dedicated Images API model. Replaces the "openai/gpt-5.4-image-2"
        // chat wrapper: same underlying image model, lower cost per image.
        // `id` is prefixed to stay unique vs the Fal entry, which shares the
        // same API slug. `apiModelId` carries the real OpenRouter model id.
        id: "openrouter/openai/gpt-image-2",
        apiModelId: "openai/gpt-image-2",
        name: "GPT-Image 2",
        supportsImageGeneration: true,
        supportsImageToImage: true, // Up to 16 reference images
        supportedImageSizes: ["1K"], // No resolution tiers on the Images API
        useImagesApi: true,
      },
      {
        // `id` is prefixed to stay unique vs the Fal entry, which shares the
        // same API slug. `apiModelId` carries the real OpenRouter model id.
        id: "openrouter/microsoft/mai-image-2.5",
        apiModelId: "microsoft/mai-image-2.5",
        name: "MAI-Image 2.5",
        supportsImageGeneration: true,
        supportsImageToImage: true, // Images API accepts one reference image
        supportedImageSizes: ["1K"],
        useImagesApi: true,
      },
      {
        id: "bytedance-seed/seedream-4.5",
        name: "Seedream v4.5",
        supportsImageGeneration: true,
        supportsImageToImage: true, // Up to 14 reference images
        supportedImageSizes: ["1K", "2K", "4K"],
        useImagesApi: true,
      },
      {
        id: "krea/krea-2-large",
        name: "Krea 2 Large",
        supportsImageGeneration: true,
        supportsImageToImage: true, // One reference image
        supportedImageSizes: ["1K"], // 1K only; aspect_ratio picks dimensions
        useImagesApi: true,
      },
      {
        id: "krea/krea-2-medium",
        name: "Krea 2 Medium",
        supportsImageGeneration: true,
        supportsImageToImage: true, // One reference image
        supportedImageSizes: ["1K"], // 1K only; aspect_ratio picks dimensions
        useImagesApi: true,
      },
      {
        // OpenRouter's "Krea 2 Medium Turbo" is the same distilled Turbo model
        // Fal serves as "fal-ai/krea-2/turbo"; shared name groups the providers.
        id: "krea/krea-2-medium-turbo",
        name: "Krea 2 Turbo",
        supportsImageGeneration: true,
        supportsImageToImage: true, // One reference image
        supportedImageSizes: ["1K"], // 1K only; aspect_ratio picks dimensions
        useImagesApi: true,
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
      {
        // Launched GA (no "-preview" suffix). Lite is 1K-only.
        id: "gemini-3.1-flash-lite-image",
        name: "Nano Banana 2 Lite",
        supportsImageGeneration: true,
        supportsImageToImage: true,
        supportedImageSizes: ["1K"],
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

// Resolve the internal model `id` to the identifier sent to the provider's API.
// Falls back to the id itself when no explicit `apiModelId` is configured.
export function getApiModelId(modelId: string): string {
  for (const provider of Object.values(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return model.apiModelId ?? model.id;
  }
  return modelId;
}

// OpenRouter only: whether the model is served by the dedicated Images API
// (POST /api/v1/images) rather than chat completions.
export function modelUsesImagesApi(modelId: string): boolean {
  for (const provider of Object.values(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return model.useImagesApi === true;
  }
  return false;
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
