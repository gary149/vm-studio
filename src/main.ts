import { emit, on, showUI } from '@create-figma-plugin/utilities';
import type {
  PluginSettings,
  PartialPluginSettings,
  GenerationRequest,
  GenerateImageHandler,
  LoadSettingsHandler,
  SaveSettingsHandler,
  GenerationCompleteHandler,
  GenerationProgressHandler,
  SettingsLoadedHandler,
  SettingsSavedHandler
} from './types';
import { generateImage } from './providers/generate';

const SETTINGS_KEY = 'vm-studio-settings';

export default function () {
  // Show UI with appropriate size
  showUI({
    height: 460,
    width: 340
  });

  // Handle messages from UI
  on<GenerateImageHandler>('generate-image', async (payload: GenerationRequest & { count: number }) => {
    const { count, ...request } = payload;
    const total = Math.max(count || 1, 1);

    try {
      const onProgress = (status: string) => {
        emit<GenerationProgressHandler>('generation-progress', { status });
      };

      const statusText = total > 1 ? `Generating ${total} images...` : 'Generating image...';
      onProgress(statusText);

      // Run all generations in parallel
      const promises = Array.from({ length: total }, () =>
        generateImage(request, () => {
          onProgress(statusText);
        })
      );

      const results = await Promise.all(promises);

      // Process all results
      const nodes: SceneNode[] = [];
      let successCount = 0;
      let lastError = '';

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        if (result.success && result.imageData) {
          const image = figma.createImage(result.imageData);
          const node = figma.createRectangle();

          const { width, height } = await image.getSizeAsync();
          node.resize(width || 512, height || 512);

          node.fills = [{
            type: 'IMAGE',
            imageHash: image.hash,
            scaleMode: 'FILL'
          }];

          const truncatedPrompt = request.prompt.length > 40
            ? request.prompt.substring(0, 37) + '...'
            : request.prompt;
          node.name = `Generated ${i + 1}: ${truncatedPrompt}`;

          // Position nodes in a grid
          const selection = figma.currentPage.selection;
          const baseX = selection.length > 0
            ? selection[0].x + selection[0].width + 20
            : figma.viewport.center.x - (node.width / 2);
          const baseY = selection.length > 0
            ? selection[0].y
            : figma.viewport.center.y - (node.height / 2);

          // Arrange in a row with spacing
          node.x = baseX + (i * (node.width + 20));
          node.y = baseY;

          figma.currentPage.appendChild(node);
          nodes.push(node);
          successCount++;
        } else {
          lastError = result.error || 'Unknown error';
        }
      }

      if (nodes.length > 0) {
        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
      }

      if (successCount === total) {
        emit<GenerationCompleteHandler>('generation-complete', { success: true });
        figma.notify(`${successCount} image${successCount > 1 ? 's' : ''} generated!`);
      } else if (successCount > 0) {
        emit<GenerationCompleteHandler>('generation-complete', {
          success: true,
          error: `${successCount}/${total} succeeded. Last error: ${lastError}`
        });
        figma.notify(`${successCount}/${total} images generated`);
      } else {
        emit<GenerationCompleteHandler>('generation-complete', {
          success: false,
          error: lastError || 'All generations failed'
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      emit<GenerationCompleteHandler>('generation-complete', {
        success: false,
        error: message
      });
    }
  });

  // Handle settings load
  on<LoadSettingsHandler>('load-settings', async () => {
    try {
      const stored = await figma.clientStorage.getAsync(SETTINGS_KEY);
      const settings: PluginSettings = stored || {
        lastProviderId: 'openrouter',
        lastModelId: 'google/gemini-3-pro-image-preview',
        apiKeys: {
          'openrouter': ''
        }
      };
      emit<SettingsLoadedHandler>('settings-loaded', settings);
    } catch (error) {
      emit<SettingsLoadedHandler>('settings-loaded', {
        lastProviderId: 'openrouter',
        lastModelId: 'google/gemini-3-pro-image-preview',
        apiKeys: {
          'openrouter': ''
        }
      });
    }
  });

  // Handle settings save
  on<SaveSettingsHandler>('save-settings', async (payload: PartialPluginSettings) => {
    try {
      const current = await figma.clientStorage.getAsync(SETTINGS_KEY) || {};
      const updated = { ...current, ...payload };

      if (payload.apiKeys) {
        updated.apiKeys = { ...current.apiKeys, ...payload.apiKeys };
      }

      await figma.clientStorage.setAsync(SETTINGS_KEY, updated);
      emit<SettingsSavedHandler>('settings-saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  });
}
