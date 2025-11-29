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
    height: 420,
    width: 340
  });

  // Handle messages from UI
  on<GenerateImageHandler>('generate-image', async (payload: GenerationRequest) => {
    try {
      // Send progress updates
      const onProgress = (status: string) => {
        emit<GenerationProgressHandler>('generation-progress', { status });
      };

      onProgress('Starting generation...');

      const result = await generateImage(payload, onProgress);

      if (result.success && result.imageData) {
        onProgress('Creating image node...');

        // Create image in Figma
        const image = figma.createImage(result.imageData);
        const node = figma.createRectangle();

        // Get image dimensions (default to 512x512 if unknown)
        const { width, height } = await image.getSizeAsync();
        node.resize(width || 512, height || 512);

        // Apply image as fill
        node.fills = [{
          type: 'IMAGE',
          imageHash: image.hash,
          scaleMode: 'FILL'
        }];

        // Name the node with the prompt (truncated)
        const truncatedPrompt = payload.prompt.length > 50
          ? payload.prompt.substring(0, 47) + '...'
          : payload.prompt;
        node.name = `Generated: ${truncatedPrompt}`;

        // Position at viewport center or selection
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
          // Position relative to selection
          const selectedNode = selection[0];
          node.x = selectedNode.x + selectedNode.width + 20;
          node.y = selectedNode.y;
        } else {
          // Position at viewport center
          const viewport = figma.viewport.center;
          node.x = viewport.x - (node.width / 2);
          node.y = viewport.y - (node.height / 2);
        }

        // Select the new node
        figma.currentPage.appendChild(node);
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);

        emit<GenerationCompleteHandler>('generation-complete', {
          success: true,
          imageData: result.imageData,
          mimeType: result.mimeType
        });

        figma.notify('Image generated successfully!');
      } else {
        emit<GenerationCompleteHandler>('generation-complete', {
          success: false,
          error: result.error || 'Unknown error'
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
      // Return default settings on error
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

      // Merge API keys
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
