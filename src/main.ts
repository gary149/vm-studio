import { emit, on, showUI } from '@create-figma-plugin/utilities';
import type {
  PluginSettings,
  PartialPluginSettings,
  GenerationRequest,
  InputImage,
  GenerateImageHandler,
  LoadSettingsHandler,
  SaveSettingsHandler,
  GenerationCompleteHandler,
  GenerationProgressHandler,
  SettingsLoadedHandler,
  SettingsSavedHandler,
  SelectionChangedHandler
} from './types';
import { generateImage } from './providers/generate';

// Convert Uint8Array to base64 (atob/btoa not available in Figma sandbox)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;

  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? chars[b3 & 63] : '=';
  }

  return result;
}

// Export selected images/frames as thumbnails only (fast)
// Full resolution export happens only at generation time
async function exportSelectedThumbnails(): Promise<InputImage[]> {
  const selection = figma.currentPage.selection;
  const images: InputImage[] = [];

  for (const node of selection) {
    // Only process nodes that can be exported
    if (!('exportAsync' in node)) continue;

    const nodeHeight = 'height' in node ? (node as { height: number }).height : 100;
    const nodeWidth = 'width' in node ? (node as { width: number }).width : 100;

    try {
      // Export small thumbnail (25px height) - fast enough without caching
      const scale = Math.min(25 / nodeHeight, 1);
      const thumbData = await (node as ExportMixin).exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: scale }
      });
      const thumbBase64 = uint8ArrayToBase64(thumbData);
      const thumbnail = `data:image/png;base64,${thumbBase64}`;

      images.push({
        id: node.id,
        base64: '',
        thumbnail,
        width: nodeWidth,
        height: nodeHeight,
        name: node.name
      });
    } catch (error) {
      console.error(`Failed to export thumbnail for node ${node.id}:`, error);
    }
  }

  return images;
}

// Export full resolution images - called only at generation time
async function exportFullResolutionImages(nodeIds: string[]): Promise<string[]> {
  const images: string[] = [];

  for (const nodeId of nodeIds) {
    const node = figma.getNodeById(nodeId);
    if (!node || !('exportAsync' in node)) continue;

    try {
      const pngData = await (node as ExportMixin).exportAsync({ format: 'PNG' });
      const base64 = uint8ArrayToBase64(pngData);
      images.push(base64);
    } catch (error) {
      console.error(`Failed to export node ${nodeId}:`, error);
    }
  }

  return images;
}

const SETTINGS_KEY = 'vm-studio-settings';

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeoutId: number | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay) as unknown as number;
  }) as T;
}

// Track current input image IDs for generation
let currentInputImageIds: string[] = [];

export default function () {
  // Show UI with appropriate size
  showUI({
    height: 460,
    width: 340
  });

  // Debounced selection change handler (150ms delay)
  const handleSelectionChange = debounce(async () => {
    const images = await exportSelectedThumbnails();
    currentInputImageIds = images.map(img => img.id);
    emit<SelectionChangedHandler>('selection-changed', { images });
  }, 150);

  // Listen for selection changes
  figma.on('selectionchange', handleSelectionChange);

  // Emit initial selection state after a short delay
  setTimeout(async () => {
    const images = await exportSelectedThumbnails();
    currentInputImageIds = images.map(img => img.id);
    emit<SelectionChangedHandler>('selection-changed', { images });
  }, 100);

  // Handle messages from UI
  on<GenerateImageHandler>('generate-image', async (payload: GenerationRequest & { count: number }) => {
    const { count, aspectRatio, imageSize, ...baseRequest } = payload;
    const total = Math.max(count || 1, 1);

    // Export full resolution images at generation time (not on selection change)
    let inputImages: string[] = [];
    if (currentInputImageIds.length > 0) {
      inputImages = await exportFullResolutionImages(currentInputImageIds);
    }
    const request = { ...baseRequest, aspectRatio, imageSize, inputImages };

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

          node.name = request.prompt;

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
        lastProviderId: 'fal',
        lastModelId: 'fal-ai/nano-banana-pro',
        apiKeys: {
          'fal': '',
          'openrouter': '',
          'gemini': ''
        }
      };
      // Ensure all provider keys exist (for migration from older versions)
      if (!settings.apiKeys.fal) {
        settings.apiKeys.fal = '';
      }
      if (!settings.apiKeys.openrouter) {
        settings.apiKeys.openrouter = '';
      }
      if (!settings.apiKeys.gemini) {
        settings.apiKeys.gemini = '';
      }
      emit<SettingsLoadedHandler>('settings-loaded', settings);
    } catch (error) {
      emit<SettingsLoadedHandler>('settings-loaded', {
        lastProviderId: 'fal',
        lastModelId: 'fal-ai/nano-banana-pro',
        apiKeys: {
          'fal': '',
          'openrouter': '',
          'gemini': ''
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
