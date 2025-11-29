import { EventHandler } from '@create-figma-plugin/utilities';

// Provider types
export type ProviderId = 'openrouter';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  models: ModelConfig[];
  requiresApiKey: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  supportsImageGeneration: boolean;
}

// Generation types
export interface GenerationRequest {
  prompt: string;
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
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
  name: 'generate-image';
  handler: (payload: GenerationRequest & { count: number }) => void;
}

export interface LoadSettingsHandler extends EventHandler {
  name: 'load-settings';
  handler: () => void;
}

export interface SaveSettingsHandler extends EventHandler {
  name: 'save-settings';
  handler: (payload: PartialPluginSettings) => void;
}

export interface GenerationCompleteHandler extends EventHandler {
  name: 'generation-complete';
  handler: (payload: GenerationResult) => void;
}

export interface GenerationProgressHandler extends EventHandler {
  name: 'generation-progress';
  handler: (payload: { status: string }) => void;
}

export interface SettingsLoadedHandler extends EventHandler {
  name: 'settings-loaded';
  handler: (payload: PluginSettings) => void;
}

export interface SettingsSavedHandler extends EventHandler {
  name: 'settings-saved';
  handler: () => void;
}

// UI State
export interface UIState {
  prompt: string;
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  count: number;
  isGenerating: boolean;
  error: string | null;
  status: string | null;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  lastProviderId: 'openrouter',
  lastModelId: 'google/gemini-3-pro-image-preview',
  apiKeys: {
    'openrouter': ''
  }
};
