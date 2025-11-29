import { render } from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import '!./output.css';

import {
  PromptInput,
  ProviderPicker,
  ApiKeyInput,
  GenerateButton,
  ErrorBanner
} from './components';

import { getProviderList, getProvider, getDefaultModel } from './providers';
import type {
  ProviderId,
  UIState,
  PluginSettings,
  GenerateImageHandler,
  LoadSettingsHandler,
  SaveSettingsHandler,
  GenerationCompleteHandler,
  GenerationProgressHandler,
  SettingsLoadedHandler
} from './types';

function Plugin() {
  const providers = getProviderList();

  const [state, setState] = useState<UIState>({
    prompt: '',
    providerId: 'google-ai',
    modelId: 'gemini-2.0-flash-exp',
    apiKey: '',
    isGenerating: false,
    error: null,
    status: null
  });

  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
    'google-ai': '',
    'openrouter': ''
  });

  // Load settings on mount
  useEffect(() => {
    emit<LoadSettingsHandler>('load-settings');
  }, []);

  // Listen for messages from sandbox
  useEffect(() => {
    const handleSettingsLoaded = (settings: PluginSettings) => {
      setState(prev => ({
        ...prev,
        providerId: settings.lastProviderId,
        modelId: settings.lastModelId,
        apiKey: settings.apiKeys[settings.lastProviderId] || ''
      }));
      setApiKeys(settings.apiKeys);
    };

    const handleGenerationProgress = ({ status }: { status: string }) => {
      setState(prev => ({ ...prev, status }));
    };

    const handleGenerationComplete = (result: { success: boolean; imageData?: Uint8Array; mimeType?: string; error?: string }) => {
      if (result.success) {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          status: null,
          error: null
        }));
      } else {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          status: null,
          error: result.error || 'Generation failed'
        }));
      }
    };

    on<SettingsLoadedHandler>('settings-loaded', handleSettingsLoaded);
    on<GenerationProgressHandler>('generation-progress', handleGenerationProgress);
    on<GenerationCompleteHandler>('generation-complete', handleGenerationComplete);
  }, []);

  // Update API key when provider changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      apiKey: apiKeys[prev.providerId] || ''
    }));
  }, [state.providerId, apiKeys]);

  const handleProviderChange = useCallback((providerId: ProviderId) => {
    const defaultModel = getDefaultModel(providerId);
    setState(prev => ({
      ...prev,
      providerId,
      modelId: defaultModel,
      apiKey: apiKeys[providerId] || ''
    }));

    // Save provider preference
    emit<SaveSettingsHandler>('save-settings', {
      lastProviderId: providerId,
      lastModelId: defaultModel
    });
  }, [apiKeys]);

  const handleModelChange = useCallback((modelId: string) => {
    setState(prev => ({ ...prev, modelId }));
    emit<SaveSettingsHandler>('save-settings', { lastModelId: modelId });
  }, []);

  const handleApiKeyChange = useCallback((value: string) => {
    setState(prev => ({ ...prev, apiKey: value }));
    setApiKeys(prev => ({ ...prev, [state.providerId]: value }));

    // Save API key
    emit<SaveSettingsHandler>('save-settings', {
      apiKeys: { [state.providerId]: value }
    });
  }, [state.providerId]);

  const handlePromptChange = useCallback((value: string) => {
    setState(prev => ({ ...prev, prompt: value }));
  }, []);

  const handleGenerate = useCallback(() => {
    if (!state.prompt.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter a prompt' }));
      return;
    }

    if (!state.apiKey.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter an API key' }));
      return;
    }

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      status: 'Starting...'
    }));

    emit<GenerateImageHandler>('generate-image', {
      prompt: state.prompt,
      providerId: state.providerId,
      modelId: state.modelId,
      apiKey: state.apiKey
    });
  }, [state.prompt, state.providerId, state.modelId, state.apiKey]);

  const handleDismissError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const currentProvider = getProvider(state.providerId);

  return (
    <div class="flex flex-col h-full p-4 gap-4 bg-white dark:bg-neutral-900">
      <div class="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-700">
        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h1 class="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          VM Studio
        </h1>
      </div>

      <div class="flex-1 flex flex-col gap-4 overflow-y-auto">
        <ErrorBanner message={state.error} onDismiss={handleDismissError} />

        <PromptInput
          value={state.prompt}
          onChange={handlePromptChange}
          disabled={state.isGenerating}
        />

        <ProviderPicker
          providers={providers}
          selectedProviderId={state.providerId}
          selectedModelId={state.modelId}
          onProviderChange={handleProviderChange}
          onModelChange={handleModelChange}
          disabled={state.isGenerating}
        />

        <ApiKeyInput
          value={state.apiKey}
          onChange={handleApiKeyChange}
          providerName={currentProvider?.name || 'Provider'}
          disabled={state.isGenerating}
        />
      </div>

      <div class="pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <GenerateButton
          onClick={handleGenerate}
          disabled={!state.prompt.trim() || !state.apiKey.trim()}
          isGenerating={state.isGenerating}
          status={state.status}
        />
      </div>
    </div>
  );
}

export default render(Plugin);
