import { render } from "@create-figma-plugin/ui";
import { emit, on } from "@create-figma-plugin/utilities";
import { h, Fragment } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import "!./styles.css";

import {
  PromptInput,
  ProviderPicker,
  ApiKeyInput,
  CountInput,
  AspectRatioSelect,
  ImageSizeSelect,
  GenerateButton,
  ErrorBanner,
  ThumbnailStrip,
} from "./components";

import {
  getProviderList,
  getProvider,
  modelSupportsImageToImage,
  getModelSupportedImageSizes,
} from "./providers";
import type {
  ProviderId,
  UIState,
  PluginSettings,
  AspectRatio,
  ImageSize,
  InputImage,
  GenerateImageHandler,
  LoadSettingsHandler,
  SaveSettingsHandler,
  GenerationCompleteHandler,
  GenerationProgressHandler,
  SettingsLoadedHandler,
  SettingsSavedHandler,
  SelectionChangedHandler,
  DeselectNodeHandler,
  LoadPromptHistoryHandler,
  SavePromptHistoryHandler,
  PromptHistoryLoadedHandler,
} from "./types";

type TabValue = "generate" | "settings" | "help";

function Plugin() {
  const providers = getProviderList();

  const [activeTab, setActiveTab] = useState<TabValue>("generate");

  const [state, setState] = useState<UIState>({
    prompt: "",
    providerId: "fal",
    modelId: "fal-ai/nano-banana-pro",
    apiKey: "",
    count: 1,
    aspectRatio: "auto",
    imageSize: "1K",
    generatingCount: 0,
    error: null,
    status: null,
    inputImages: [],
  });

  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
    fal: "",
    openrouter: "",
    gemini: "",
    openai: "",
  });

  // Prompt history
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [draftPrompt, setDraftPrompt] = useState<string>("");
  const [cursorPosition, setCursorPosition] = useState<"start" | "end" | undefined>(undefined);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabValue);
  }, []);

  useEffect(() => {
    emit<LoadSettingsHandler>("load-settings");
    emit<LoadPromptHistoryHandler>("load-prompt-history");
  }, []);

  useEffect(() => {
    const handleSettingsLoaded = (settings: PluginSettings) => {
      setState((prev) => ({
        ...prev,
        providerId: settings.lastProviderId,
        modelId: settings.lastModelId,
        apiKey: settings.apiKeys[settings.lastProviderId] || "",
      }));
      setApiKeys(settings.apiKeys);
    };

    const handleGenerationProgress = ({ status }: { status: string }) => {
      setState((prev) => ({ ...prev, status }));
    };

    const handleGenerationComplete = (result: {
      success: boolean;
      error?: string;
    }) => {
      setState((prev) => ({
        ...prev,
        generatingCount: Math.max(0, prev.generatingCount - 1),
        status: prev.generatingCount <= 1 ? null : prev.status,
        error: result.success
          ? prev.error
          : result.error || "Generation failed",
      }));
    };

    const handleSelectionChanged = ({ images }: { images: InputImage[] }) => {
      setState((prev) => ({ ...prev, inputImages: images }));
    };

    const handlePromptHistoryLoaded = ({ history }: { history: string[] }) => {
      setPromptHistory(history);
    };

    on<SettingsLoadedHandler>("settings-loaded", handleSettingsLoaded);
    on<SettingsSavedHandler>("settings-saved", () => {});
    on<GenerationProgressHandler>(
      "generation-progress",
      handleGenerationProgress,
    );
    on<GenerationCompleteHandler>(
      "generation-complete",
      handleGenerationComplete,
    );
    on<SelectionChangedHandler>("selection-changed", handleSelectionChanged);
    on<PromptHistoryLoadedHandler>("prompt-history-loaded", handlePromptHistoryLoaded);
  }, []);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      apiKey: apiKeys[prev.providerId] || "",
    }));
  }, [state.providerId, apiKeys]);

  // Save prompt history when it changes (skip empty initial state)
  useEffect(() => {
    if (promptHistory.length > 0) {
      emit<SavePromptHistoryHandler>("save-prompt-history", { history: promptHistory });
    }
  }, [promptHistory]);

  const handleModelChange = useCallback(
    (modelId: string, providerId: ProviderId) => {
      const supportedSizes = getModelSupportedImageSizes(modelId);

      setState((prev) => {
        // Reset imageSize if current size isn't supported by new model
        const newImageSize = supportedSizes.includes(prev.imageSize)
          ? prev.imageSize
          : supportedSizes[0];

        return {
          ...prev,
          modelId,
          providerId,
          apiKey: apiKeys[providerId] || "",
          imageSize: newImageSize,
        };
      });

      emit<SaveSettingsHandler>("save-settings", {
        lastModelId: modelId,
        lastProviderId: providerId,
      });
    },
    [apiKeys],
  );

  const handleApiKeyChange = useCallback(
    (providerId: ProviderId, value: string) => {
      // Update apiKeys state
      setApiKeys((prev) => ({ ...prev, [providerId]: value }));

      // If this is the currently selected provider, also update the UI state
      if (providerId === state.providerId) {
        setState((prev) => ({ ...prev, apiKey: value }));
      }

      emit<SaveSettingsHandler>("save-settings", {
        apiKeys: { [providerId]: value },
      });
    },
    [state.providerId],
  );

  const handlePromptChange = useCallback((value: string) => {
    setState((prev) => ({ ...prev, prompt: value }));
    setHistoryIndex(-1); // Reset history index when typing
    setCursorPosition(undefined);
  }, []);

  const handlePromptPrevious = useCallback(() => {
    if (promptHistory.length === 0) return;

    // Save current input as draft before navigating into history
    if (historyIndex === -1) {
      setDraftPrompt(state.prompt);
    }

    const newIndex =
      historyIndex === -1
        ? promptHistory.length - 1
        : Math.max(0, historyIndex - 1);

    setHistoryIndex(newIndex);
    setState((prev) => ({ ...prev, prompt: promptHistory[newIndex] }));
    setCursorPosition("start");
  }, [promptHistory, historyIndex, state.prompt]);

  const handlePromptNext = useCallback(() => {
    if (historyIndex === -1) return;

    const newIndex = historyIndex + 1;

    if (newIndex >= promptHistory.length) {
      // Restore draft when going past history
      setHistoryIndex(-1);
      setState((prev) => ({ ...prev, prompt: draftPrompt }));
    } else {
      setHistoryIndex(newIndex);
      setState((prev) => ({ ...prev, prompt: promptHistory[newIndex] }));
    }
    setCursorPosition("end");
  }, [promptHistory, historyIndex, draftPrompt]);

  const handleCountChange = useCallback((value: number) => {
    setState((prev) => ({ ...prev, count: value }));
  }, []);

  const handleAspectRatioChange = useCallback((value: AspectRatio) => {
    setState((prev) => ({ ...prev, aspectRatio: value }));
  }, []);

  const handleImageSizeChange = useCallback((value: ImageSize) => {
    setState((prev) => ({ ...prev, imageSize: value }));
  }, []);

  const handleRemoveImage = useCallback((nodeId: string) => {
    emit<DeselectNodeHandler>("deselect-node", { nodeId });
  }, []);

  const handleGenerate = useCallback(() => {
    if (!state.prompt.trim()) {
      setState((prev) => ({ ...prev, error: "Please enter a prompt" }));
      return;
    }

    if (!state.apiKey.trim()) {
      setState((prev) => ({ ...prev, error: "Please enter an API key" }));
      return;
    }

    // Add to history if not duplicate of last entry
    const trimmedPrompt = state.prompt.trim();
    if (promptHistory[promptHistory.length - 1] !== trimmedPrompt) {
      setPromptHistory((prev) => [...prev, trimmedPrompt]);
    }
    setHistoryIndex(-1);

    setState((prev) => ({
      ...prev,
      generatingCount: prev.generatingCount + 1,
      error: null,
      status: "Generating...",
    }));

    emit<GenerateImageHandler>("generate-image", {
      prompt: state.prompt,
      providerId: state.providerId,
      modelId: state.modelId,
      apiKey: state.apiKey,
      count: state.count,
      aspectRatio: state.aspectRatio,
      imageSize: state.imageSize,
      // inputImages are exported at generation time from node IDs
    });
  }, [
    state.prompt,
    state.providerId,
    state.modelId,
    state.apiKey,
    state.count,
    state.aspectRatio,
    state.imageSize,
    state.inputImages,
    promptHistory,
  ]);

  const handleDismissError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const currentProvider = getProvider(state.providerId);

  // Check if image-to-image is supported for current model
  const hasInputImages = state.inputImages.length > 0;
  const currentModelSupportsI2I = modelSupportsImageToImage(state.modelId);
  const i2iUnsupported = hasInputImages && !currentModelSupportsI2I;

  // Cmd/Ctrl+Enter to generate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (state.prompt.trim() && state.apiKey.trim() && !i2iUnsupported) {
          handleGenerate();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.prompt, state.apiKey, i2iUnsupported, handleGenerate]);

  return (
    <div class="app">
      <nav class="navbar">
        <div class="navbar-tabs">
          <button
            class={`tab-button ${activeTab === "generate" ? "tab-button--active" : ""}`}
            onClick={() => handleTabChange("generate")}
          >
            Generate
          </button>
          <button
            class={`tab-button ${activeTab === "settings" ? "tab-button--active" : ""}`}
            onClick={() => handleTabChange("settings")}
          >
            Settings
          </button>
          <button
            style="margin-left: auto;"
            class={`tab-button ${activeTab === "help" ? "tab-button--active" : ""}`}
            onClick={() => handleTabChange("help")}
          >
            Help
          </button>
        </div>
      </nav>

      {activeTab === "generate" && (
        <Fragment>
          <div class="content">
            <ErrorBanner message={state.error} onDismiss={handleDismissError} />

            <PromptInput
              value={state.prompt}
              onChange={handlePromptChange}
              onPrevious={handlePromptPrevious}
              onNext={handlePromptNext}
              placeholder={
                hasInputImages
                  ? "Prompt for selected images..."
                  : "Describe the image you want to generate..."
              }
              isEditingMode={hasInputImages}
              cursorPosition={cursorPosition}
            />

            <ThumbnailStrip images={state.inputImages} onRemove={handleRemoveImage} />

            {i2iUnsupported && (
              <div class="i2i-unsupported-warning">
                Selected model does not support image-to-image
              </div>
            )}

            <ProviderPicker
              selectedModelId={state.modelId}
              onModelChange={handleModelChange}
            />

            {!state.apiKey.trim() && (
              <div class="api-key-warning">
                {currentProvider?.name} API key not set.{" "}
                <span
                  class="api-key-warning-link"
                  onClick={() => handleTabChange("settings")}
                >
                  Go to Settings
                </span>
              </div>
            )}

            <CountInput
              value={state.count}
              onChange={handleCountChange}
              min={1}
            />

            <div class="row">
              <AspectRatioSelect
                value={state.aspectRatio}
                onChange={handleAspectRatioChange}
              />
              <ImageSizeSelect
                value={state.imageSize}
                onChange={handleImageSizeChange}
                availableSizes={getModelSupportedImageSizes(state.modelId)}
              />
            </div>
          </div>

          <footer class="footer">
            <GenerateButton
              onClick={handleGenerate}
              disabled={
                !state.prompt.trim() || !state.apiKey.trim() || i2iUnsupported
              }
              generatingCount={state.generatingCount}
              status={state.status}
            />
          </footer>
        </Fragment>
      )}

      {activeTab === "settings" && (
        <div class="content">
          {providers.map((provider) => (
            <ApiKeyInput
              key={provider.id}
              value={apiKeys[provider.id] || ""}
              onChange={(value) => handleApiKeyChange(provider.id, value)}
              providerName={provider.name}
              modelCount={provider.models.length}
              apiKeyUrl={provider.apiKeyUrl}
            />
          ))}
        </div>
      )}

      {activeTab === "help" && (
        <div class="content help-content">
          <section class="help-section">
            <div class="help-section-title">Getting Started</div>
            <div class="help-step">
              <span class="help-step-num">1</span>
              <div>
                <strong>Add your API key</strong> in Settings for your preferred provider
              </div>
            </div>
            <div class="help-step">
              <span class="help-step-num">2</span>
              <div>
                <strong>Write a prompt</strong> describing the image you want
              </div>
            </div>
            <div class="help-step">
              <span class="help-step-num">3</span>
              <div>
                <strong>Click Generate</strong> and images place automatically on your canvas
              </div>
            </div>
          </section>

          <hr class="help-divider" />

          <section class="help-section">
            <div class="help-section-title">Image Editing</div>
            <div class="help-text">
              Select existing frames or images in Figma, then describe changes. The plugin will transform your selection based on your prompt.
            </div>
          </section>

          <hr class="help-divider" />

          <section class="help-section">
            <div class="help-section-title">Batch Generation</div>
            <div class="help-text">
              Set Count higher than 1 to generate multiple images at once. They arrange in a smart grid that avoids existing objects. Generate again within 30 seconds to continue the same grid.
            </div>
          </section>

          <hr class="help-divider" />

          <section class="help-section">
            <div class="help-section-title">Options</div>
            <div class="help-option"><strong>Model</strong> - Choose AI model and provider</div>
            <div class="help-option"><strong>Count</strong> - Number of images to generate</div>
            <div class="help-option"><strong>Aspect Ratio</strong> - Output dimensions (1:1, 16:9, etc.)</div>
            <div class="help-option"><strong>Resolution</strong> - 1K, 2K, or 4K output size</div>
          </section>

          <hr class="help-divider" />

          <section class="help-section">
            <div class="help-section-title">Shortcuts</div>
            <div class="help-shortcut-row">
              <span class="help-shortcut">⌘/Ctrl + Enter</span>
              <span>Generate</span>
            </div>
            <div class="help-shortcut-row">
              <span class="help-shortcut">↑ ↓</span>
              <span>Prompt history</span>
            </div>
          </section>

          <hr class="help-divider" />

          <section class="help-section">
            <div class="help-text help-text--muted">
              API keys are stored locally and only sent to the selected provider.
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default render(Plugin);
