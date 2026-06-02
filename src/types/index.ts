import { EventHandler } from "@create-figma-plugin/utilities";

// Provider types
export type ProviderId = "fal" | "openrouter" | "gemini" | "openai";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  models: ModelConfig[];
  requiresApiKey: boolean;
  apiKeyUrl?: string;
}

export interface ModelConfig {
  // Globally-unique internal/UI identifier (used by the provider picker and
  // model lookups). Usually equal to the provider's API slug.
  id: string;
  // The identifier sent to the provider's API. Defaults to `id`. Set this only
  // when two providers expose the same API slug (e.g. "microsoft/mai-image-2.5"
  // on both Fal and OpenRouter) and `id` must be disambiguated to stay unique.
  apiModelId?: string;
  name: string;
  supportsImageGeneration: boolean;
  supportsImageToImage: boolean;
  supportedImageSizes: ImageSize[];
  // OpenRouter only: the output modalities to request via the `modalities`
  // param. Defaults to ["text", "image"]. Image-only models (e.g. MAI-Image)
  // must use ["image"] or OpenRouter returns "No endpoints found that support
  // the requested output modalities".
  outputModalities?: Array<"text" | "image">;
}

// Input image from Figma selection
export interface InputImage {
  id: string;
  base64: string;
  thumbnail: string;
  width: number;
  height: number;
  name: string;
}

// Generation types
export type AspectRatio =
  | "auto"
  | "1:1"
  | "9:16"
  | "16:9"
  | "3:4"
  | "4:3"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5"
  | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface GenerationRequest {
  prompt: string;
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  inputImages?: string[];
}

export interface GenerationResult {
  success: boolean;
  imageData?: Uint8Array;
  mimeType?: string;
  error?: string;
}

// Settings types
export interface PluginSettings {
  lastProviderId: ProviderId;
  lastModelId: string;
  apiKeys: Record<ProviderId, string>;
}

// For saving partial settings
export interface PartialPluginSettings {
  lastProviderId?: ProviderId;
  lastModelId?: string;
  apiKeys?: Partial<Record<ProviderId, string>>;
}

// Event handlers for UI <-> Sandbox communication
export interface GenerateImageHandler extends EventHandler {
  name: "generate-image";
  handler: (payload: GenerationRequest & { count: number }) => void;
}

export interface LoadSettingsHandler extends EventHandler {
  name: "load-settings";
  handler: () => void;
}

export interface SaveSettingsHandler extends EventHandler {
  name: "save-settings";
  handler: (payload: PartialPluginSettings) => void;
}

export interface GenerationCompleteHandler extends EventHandler {
  name: "generation-complete";
  handler: (payload: GenerationResult) => void;
}

export interface GenerationProgressHandler extends EventHandler {
  name: "generation-progress";
  handler: (payload: { status: string }) => void;
}

export interface SettingsLoadedHandler extends EventHandler {
  name: "settings-loaded";
  handler: (payload: PluginSettings) => void;
}

export interface SettingsSavedHandler extends EventHandler {
  name: "settings-saved";
  handler: () => void;
}

export interface SelectionChangedHandler extends EventHandler {
  name: "selection-changed";
  handler: (payload: { images: InputImage[] }) => void;
}

export interface DeselectNodeHandler extends EventHandler {
  name: "deselect-node";
  handler: (payload: { nodeId: string }) => void;
}

// Prompt history persistence
export interface LoadPromptHistoryHandler extends EventHandler {
  name: "load-prompt-history";
  handler: () => void;
}

export interface SavePromptHistoryHandler extends EventHandler {
  name: "save-prompt-history";
  handler: (payload: { history: string[] }) => void;
}

export interface PromptHistoryLoadedHandler extends EventHandler {
  name: "prompt-history-loaded";
  handler: (payload: { history: string[] }) => void;
}

// UI State
export interface UIState {
  prompt: string;
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  count: number;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  generatingCount: number;
  error: string | null;
  status: string | null;
  inputImages: InputImage[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  lastProviderId: "fal",
  lastModelId: "fal-ai/nano-banana-pro",
  apiKeys: {
    fal: "",
    openrouter: "",
    gemini: "",
    openai: "",
  },
};
