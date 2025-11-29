import { render } from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import '!./styles.css';

import {
  PromptInput,
  ProviderPicker,
  ApiKeyInput,
  CountInput,
  AspectRatioSelect,
  ImageSizeSelect,
  GenerateButton,
  ErrorBanner
} from './components';

import { getProviderList, getProvider, getDefaultModel } from './providers';
import type {
  ProviderId,
  UIState,
  PluginSettings,
  AspectRatio,
  ImageSize,
  GenerateImageHandler,
  LoadSettingsHandler,
  SaveSettingsHandler,
  GenerationCompleteHandler,
  GenerationProgressHandler,
  SettingsLoadedHandler
} from './types';

type TabValue = 'generate' | 'settings';

function Plugin() {
  const providers = getProviderList();

  const [activeTab, setActiveTab] = useState<TabValue>('generate');

  const [state, setState] = useState<UIState>({
    prompt: '',
    providerId: 'openrouter',
    modelId: 'google/gemini-3-pro-image-preview',
    apiKey: '',
    count: 1,
    aspectRatio: 'auto',
    imageSize: '1K',
    isGenerating: false,
    error: null,
    status: null
  });

  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
    'openrouter': ''
  });

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabValue);
  }, []);

  useEffect(() => {
    emit<LoadSettingsHandler>('load-settings');
  }, []);

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

    const handleGenerationComplete = (result: { success: boolean; error?: string }) => {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        status: null,
        error: result.success ? null : (result.error || 'Generation failed')
      }));
    };

    on<SettingsLoadedHandler>('settings-loaded', handleSettingsLoaded);
    on<GenerationProgressHandler>('generation-progress', handleGenerationProgress);
    on<GenerationCompleteHandler>('generation-complete', handleGenerationComplete);
  }, []);

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

    emit<SaveSettingsHandler>('save-settings', {
      apiKeys: { [state.providerId]: value }
    });
  }, [state.providerId]);

  const handlePromptChange = useCallback((value: string) => {
    setState(prev => ({ ...prev, prompt: value }));
  }, []);

  const handleCountChange = useCallback((value: number) => {
    setState(prev => ({ ...prev, count: value }));
  }, []);

  const handleAspectRatioChange = useCallback((value: AspectRatio) => {
    setState(prev => ({ ...prev, aspectRatio: value }));
  }, []);

  const handleImageSizeChange = useCallback((value: ImageSize) => {
    setState(prev => ({ ...prev, imageSize: value }));
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
      apiKey: state.apiKey,
      count: state.count,
      aspectRatio: state.aspectRatio,
      imageSize: state.imageSize
    });
  }, [state.prompt, state.providerId, state.modelId, state.apiKey, state.count, state.aspectRatio, state.imageSize]);

  const handleDismissError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Cmd/Ctrl+Enter to generate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!state.isGenerating && state.prompt.trim() && state.apiKey.trim()) {
          handleGenerate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isGenerating, state.prompt, state.apiKey, handleGenerate]);

  const currentProvider = getProvider(state.providerId);

  return (
    <div class="app">
      <nav class="navbar">
        <div class="navbar-tabs">
          <button
            class={`tab-button ${activeTab === 'generate' ? 'tab-button--active' : ''}`}
            onClick={() => handleTabChange('generate')}
          >
            Generate
          </button>
          <button
            class={`tab-button ${activeTab === 'settings' ? 'tab-button--active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            Settings
          </button>
        </div>
      </nav>

      {activeTab === 'generate' && (
        <Fragment>
          <div class="content">
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

            <CountInput
              value={state.count}
              onChange={handleCountChange}
              disabled={state.isGenerating}
              min={1}
            />

            <div class="row">
              <AspectRatioSelect
                value={state.aspectRatio}
                onChange={handleAspectRatioChange}
                disabled={state.isGenerating}
              />
              <ImageSizeSelect
                value={state.imageSize}
                onChange={handleImageSizeChange}
                disabled={state.isGenerating}
              />
            </div>
          </div>

          <footer class="footer">
            <GenerateButton
              onClick={handleGenerate}
              disabled={!state.prompt.trim() || !state.apiKey.trim()}
              isGenerating={state.isGenerating}
              status={state.status}
            />
          </footer>
        </Fragment>
      )}

      {activeTab === 'settings' && (
        <div class="content">
          <ApiKeyInput
            value={state.apiKey}
            onChange={handleApiKeyChange}
            providerName={currentProvider?.name || 'Provider'}
            disabled={state.isGenerating}
          />
        </div>
      )}
    </div>
  );
}

export default render(Plugin);
