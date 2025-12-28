import { emit, on, showUI } from "@create-figma-plugin/utilities";
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
  SelectionChangedHandler,
} from "./types";
import { generateImage } from "./providers/generate";
import { getPlacementOrigin, getEstimatedCellSize } from "./positioning";

// Convert Uint8Array to base64 (atob/btoa not available in Figma sandbox)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const len = bytes.length;

  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : "=";
    result += i + 2 < len ? chars[b3 & 63] : "=";
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
    if (!("exportAsync" in node)) continue;

    const nodeHeight =
      "height" in node ? (node as { height: number }).height : 100;
    const nodeWidth = "width" in node ? (node as { width: number }).width : 100;

    try {
      // Export small thumbnail (25px height) - fast enough without caching
      const scale = Math.min(25 / nodeHeight, 1);
      const thumbData = await (node as ExportMixin).exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: scale },
      });
      const thumbBase64 = uint8ArrayToBase64(thumbData);
      const thumbnail = `data:image/png;base64,${thumbBase64}`;

      images.push({
        id: node.id,
        base64: "",
        thumbnail,
        width: nodeWidth,
        height: nodeHeight,
        name: node.name,
      });
    } catch (error) {
      console.error(`Failed to export thumbnail for node ${node.id}:`, error);
    }
  }

  return images;
}

// Export full resolution images - called only at generation time
async function exportFullResolutionImages(
  nodeIds: string[],
): Promise<string[]> {
  const images: string[] = [];

  for (const nodeId of nodeIds) {
    const node = figma.getNodeById(nodeId);
    if (!node || !("exportAsync" in node)) continue;

    try {
      const pngData = await (node as ExportMixin).exportAsync({
        format: "PNG",
      });
      const base64 = uint8ArrayToBase64(pngData);
      images.push(base64);
    } catch (error) {
      console.error(`Failed to export node ${nodeId}:`, error);
    }
  }

  return images;
}

const SETTINGS_KEY = "vm-studio-settings";

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): T {
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

// Track grid cursor for sequential generations (wraps after 12 columns)
let gridCursor: {
  originX: number;
  originY: number;
  col: number;
  row: number;
  cellWidth: number;
  cellHeight: number;
} | null = null;
let gridCursorTime = 0;
const MAX_COLUMNS = 12;
const GRID_SPACING = 20;

// Create a placeholder rectangle for an image being generated
function createPlaceholder(
  x: number,
  y: number,
  width: number,
  height: number,
  index: number,
): RectangleNode {
  const node = figma.createRectangle();
  node.name = `Generating... (${index + 1})`;
  node.resize(width, height);
  node.x = x;
  node.y = y;
  node.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  node.cornerRadius = 8;
  figma.currentPage.appendChild(node);
  return node;
}

// Replace a placeholder with the generated image
async function replacePlaceholder(
  placeholder: RectangleNode,
  imageData: Uint8Array,
  prompt: string,
): Promise<void> {
  const image = figma.createImage(imageData);
  const { width, height } = await image.getSizeAsync();

  // Resize to actual image dimensions
  placeholder.resize(width || 512, height || 512);

  // Apply image fill
  placeholder.fills = [
    {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: "FILL",
    },
  ];

  placeholder.name = prompt;
  placeholder.cornerRadius = 0;
}

export default function () {
  // Show UI with appropriate size
  showUI({
    height: 460,
    width: 340,
  });

  // Debounced selection change handler (150ms delay)
  const handleSelectionChange = debounce(async () => {
    const images = await exportSelectedThumbnails();
    currentInputImageIds = images.map((img) => img.id);
    emit<SelectionChangedHandler>("selection-changed", { images });
  }, 150);

  // Listen for selection changes
  figma.on("selectionchange", handleSelectionChange);

  // Emit initial selection state after a short delay
  setTimeout(async () => {
    const images = await exportSelectedThumbnails();
    currentInputImageIds = images.map((img) => img.id);
    emit<SelectionChangedHandler>("selection-changed", { images });
  }, 100);

  // Handle messages from UI
  on<GenerateImageHandler>(
    "generate-image",
    async (payload: GenerationRequest & { count: number }) => {
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
          emit<GenerationProgressHandler>("generation-progress", { status });
        };

        // Estimate cell size based on settings
        const { width: cellWidth, height: cellHeight } = getEstimatedCellSize(
          aspectRatio || "auto",
          imageSize || "1K",
        );

        // Calculate grid positions
        const selection = figma.currentPage.selection;
        const now = Date.now();

        // Check if we should continue an existing grid or start fresh
        const shouldContinueGrid =
          selection.length === 0 &&
          gridCursor &&
          now - gridCursorTime < 30000 &&
          gridCursor.cellWidth === cellWidth &&
          gridCursor.cellHeight === cellHeight;

        if (!shouldContinueGrid) {
          // Start a fresh grid
          const origin = getPlacementOrigin(
            selection,
            figma.viewport.center,
            cellWidth,
            cellHeight,
          );
          gridCursor = {
            originX: origin.x,
            originY: origin.y,
            col: 0,
            row: 0,
            cellWidth,
            cellHeight,
          };
        }

        // Calculate positions using grid cursor
        const positions: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < total; i++) {
          positions.push({
            x:
              gridCursor!.originX +
              gridCursor!.col * (cellWidth + GRID_SPACING),
            y:
              gridCursor!.originY +
              gridCursor!.row * (cellHeight + GRID_SPACING),
          });

          // Advance cursor
          gridCursor!.col++;
          if (gridCursor!.col >= MAX_COLUMNS) {
            gridCursor!.col = 0;
            gridCursor!.row++;
          }
        }

        gridCursorTime = now;

        // Create placeholders immediately
        const placeholders: RectangleNode[] = [];
        for (let i = 0; i < total; i++) {
          const placeholder = createPlaceholder(
            positions[i].x,
            positions[i].y,
            cellWidth,
            cellHeight,
            i,
          );
          placeholders.push(placeholder);
        }

        // Scroll to center on placeholders (without changing zoom)
        const centerX =
          positions.reduce((sum, p) => sum + p.x, 0) / positions.length +
          cellWidth / 2;
        const centerY =
          positions.reduce((sum, p) => sum + p.y, 0) / positions.length +
          cellHeight / 2;
        figma.viewport.center = { x: centerX, y: centerY };

        const statusText =
          total > 1 ? `Generating ${total} images...` : "Generating image...";
        onProgress(statusText);

        // Run all generations in parallel, replacing placeholders as they complete
        let successCount = 0;
        let lastError = "";

        const promises = placeholders.map(async (placeholder, i) => {
          try {
            const result = await generateImage(request, () => {
              onProgress(statusText);
            });

            if (result.success && result.imageData) {
              await replacePlaceholder(
                placeholder,
                result.imageData,
                request.prompt,
              );
              successCount++;
            } else {
              // Remove placeholder on failure
              placeholder.remove();
              lastError = result.error || "Unknown error";
            }
          } catch (error) {
            placeholder.remove();
            lastError =
              error instanceof Error ? error.message : "Unknown error";
          }
        });

        await Promise.all(promises);

        if (successCount === total) {
          emit<GenerationCompleteHandler>("generation-complete", {
            success: true,
          });
          figma.notify(
            `${successCount} image${successCount > 1 ? "s" : ""} generated!`,
          );
        } else if (successCount > 0) {
          emit<GenerationCompleteHandler>("generation-complete", {
            success: true,
            error: `${successCount}/${total} succeeded. Last error: ${lastError}`,
          });
          figma.notify(`${successCount}/${total} images generated`);
        } else {
          emit<GenerationCompleteHandler>("generation-complete", {
            success: false,
            error: lastError || "All generations failed",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        emit<GenerationCompleteHandler>("generation-complete", {
          success: false,
          error: message,
        });
      }
    },
  );

  // Handle settings load
  on<LoadSettingsHandler>("load-settings", async () => {
    try {
      const stored = await figma.clientStorage.getAsync(SETTINGS_KEY);
      const settings: PluginSettings = stored || {
        lastProviderId: "fal",
        lastModelId: "fal-ai/nano-banana-pro",
        apiKeys: {
          fal: "",
          openrouter: "",
          gemini: "",
        },
      };
      // Ensure all provider keys exist (for migration from older versions)
      if (!settings.apiKeys.fal) {
        settings.apiKeys.fal = "";
      }
      if (!settings.apiKeys.openrouter) {
        settings.apiKeys.openrouter = "";
      }
      if (!settings.apiKeys.gemini) {
        settings.apiKeys.gemini = "";
      }
      emit<SettingsLoadedHandler>("settings-loaded", settings);
    } catch (error) {
      emit<SettingsLoadedHandler>("settings-loaded", {
        lastProviderId: "fal",
        lastModelId: "fal-ai/nano-banana-pro",
        apiKeys: {
          fal: "",
          openrouter: "",
          gemini: "",
        },
      });
    }
  });

  // Handle settings save
  on<SaveSettingsHandler>(
    "save-settings",
    async (payload: PartialPluginSettings) => {
      try {
        const current =
          (await figma.clientStorage.getAsync(SETTINGS_KEY)) || {};
        const updated = { ...current, ...payload };

        if (payload.apiKeys) {
          updated.apiKeys = { ...current.apiKeys, ...payload.apiKeys };
        }

        await figma.clientStorage.setAsync(SETTINGS_KEY, updated);
        emit<SettingsSavedHandler>("settings-saved");
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    },
  );
}
