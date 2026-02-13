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
  DeselectNodeHandler,
  LoadPromptHistoryHandler,
  SavePromptHistoryHandler,
  PromptHistoryLoadedHandler,
} from "./types";
import { generateImage } from "./providers/generate";
import {
  getPlacementOrigin,
  getEstimatedCellSize,
  getCollisionFreePositions,
  getCollisionFreePositionNearAnchor,
} from "./positioning";

// Convert Uint8Array to base64 (atob/btoa not available in Figma sandbox)
// Optimized: uses array accumulation + join instead of string concatenation (O(n) vs O(n²))
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const len = bytes.length;
  const numChunks = Math.ceil(len / 3);
  const result = new Array<string>(numChunks * 4);
  let resultIndex = 0;

  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    result[resultIndex++] = chars[b1 >> 2];
    result[resultIndex++] = chars[((b1 & 3) << 4) | (b2 >> 4)];
    result[resultIndex++] = i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : "=";
    result[resultIndex++] = i + 2 < len ? chars[b3 & 63] : "=";
  }

  return result.join("");
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
    const node = await figma.getNodeByIdAsync(nodeId);
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
const PROMPT_HISTORY_KEY = "vm-studio-prompt-history";
const MAX_PROMPT_HISTORY = 50;

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

interface GridCursorState {
  originX: number;
  originY: number;
  nextSlotIndex: number;
  cellWidth: number;
  cellHeight: number;
  updatedAt: number;
}

interface PlaceholderPlacementMeta {
  slotAnchorX: number;
  slotAnchorY: number;
  stepX: number;
  stepY: number;
}

const gridCursorsByPage = new Map<string, GridCursorState>();
const GRID_CURSOR_TTL_MS = 30000;
const MAX_COLUMNS = 12;
const GRID_SPACING = 60;

function pruneStaleGridCursors(now: number): void {
  const stalePageIds: string[] = [];
  gridCursorsByPage.forEach((cursor, pageId) => {
    if (now - cursor.updatedAt >= GRID_CURSOR_TTL_MS) {
      stalePageIds.push(pageId);
    }
  });
  for (const pageId of stalePageIds) {
    gridCursorsByPage.delete(pageId);
  }
}

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
  node.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      gradientStops: [
        { position: 0, color: { r: 0.95, g: 0.95, b: 0.97, a: 1 } },
        { position: 1, color: { r: 0.8, g: 0.8, b: 0.85, a: 1 } },
      ],
    },
  ];
  node.cornerRadius = 8;
  // Lock placeholder to prevent user from deleting/moving during generation
  node.locked = true;
  figma.currentPage.appendChild(node);
  return node;
}

// Replace a placeholder with the generated image
async function replacePlaceholder(
  placeholder: RectangleNode,
  imageData: Uint8Array,
  prompt: string,
  placement: PlaceholderPlacementMeta,
): Promise<void> {
  const image = figma.createImage(imageData);
  const { width, height } = await image.getSizeAsync();
  const actualWidth = width || 512;
  const actualHeight = height || 512;
  const previousWidth = Math.round(placeholder.width);
  const previousHeight = Math.round(placeholder.height);
  const sizeChanged =
    previousWidth !== actualWidth || previousHeight !== actualHeight;

  // Resize to actual image dimensions
  placeholder.resize(actualWidth, actualHeight);

  if (sizeChanged) {
    const currentFreePosition = getCollisionFreePositionNearAnchor(
      { x: placeholder.x, y: placeholder.y },
      actualWidth,
      actualHeight,
      placement.stepX,
      placement.stepY,
      figma.currentPage.children,
      placeholder.id,
    );

    const overlapsAtCurrentPosition =
      currentFreePosition.x !== placeholder.x ||
      currentFreePosition.y !== placeholder.y;

    // Re-anchor near the slot position if resize introduced a collision.
    if (overlapsAtCurrentPosition) {
      const reanchoredPosition = getCollisionFreePositionNearAnchor(
        { x: placement.slotAnchorX, y: placement.slotAnchorY },
        actualWidth,
        actualHeight,
        placement.stepX,
        placement.stepY,
        figma.currentPage.children,
        placeholder.id,
      );
      placeholder.x = reanchoredPosition.x;
      placeholder.y = reanchoredPosition.y;
    }
  }

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
  // Unlock the node now that generation is complete
  placeholder.locked = false;
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

  // Handle deselect node from UI
  on<DeselectNodeHandler>("deselect-node", ({ nodeId }) => {
    const currentSelection = figma.currentPage.selection;
    const newSelection = currentSelection.filter((node) => node.id !== nodeId);
    figma.currentPage.selection = newSelection;
  });

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
        const pageId = figma.currentPage.id;
        const now = Date.now();
        pruneStaleGridCursors(now);
        const pageCursor = gridCursorsByPage.get(pageId);

        // Check if we should continue an existing grid or start fresh
        const shouldContinueGrid =
          selection.length === 0 &&
          pageCursor !== undefined &&
          now - pageCursor.updatedAt < GRID_CURSOR_TTL_MS &&
          pageCursor.cellWidth === cellWidth &&
          pageCursor.cellHeight === cellHeight;

        let activeCursor: GridCursorState;

        if (!shouldContinueGrid) {
          // Start a fresh grid
          const origin = getPlacementOrigin(
            selection,
            figma.viewport.center,
            cellWidth,
            cellHeight,
          );
          activeCursor = {
            originX: origin.x,
            originY: origin.y,
            nextSlotIndex: 0,
            cellWidth,
            cellHeight,
            updatedAt: now,
          };
        } else {
          activeCursor = pageCursor!;
        }
        const startIndex = activeCursor.nextSlotIndex;

        // Calculate collision-free positions
        const positions = getCollisionFreePositions(
          { x: activeCursor.originX, y: activeCursor.originY },
          total,
          cellWidth,
          cellHeight,
          GRID_SPACING,
          MAX_COLUMNS,
          figma.currentPage.children,
          startIndex,
        );

        // Advance by attempted slots to keep strict append progression.
        activeCursor.nextSlotIndex += total;
        activeCursor.updatedAt = now;
        gridCursorsByPage.set(pageId, activeCursor);

        // Create placeholders immediately
        const placeholders: Array<{
          node: RectangleNode;
          placement: PlaceholderPlacementMeta;
        }> = [];
        const stepX = cellWidth + GRID_SPACING;
        const stepY = cellHeight + GRID_SPACING;
        for (let i = 0; i < total; i++) {
          const slotIndex = startIndex + i;
          const col = slotIndex % MAX_COLUMNS;
          const row = Math.floor(slotIndex / MAX_COLUMNS);
          const slotAnchorX = activeCursor.originX + col * stepX;
          const slotAnchorY = activeCursor.originY + row * stepY;

          const placeholder = createPlaceholder(
            positions[i].x,
            positions[i].y,
            cellWidth,
            cellHeight,
            i,
          );
          placeholders.push({
            node: placeholder,
            placement: { slotAnchorX, slotAnchorY, stepX, stepY },
          });
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

        const promises = placeholders.map(async ({ node: placeholder, placement }) => {
          try {
            const result = await generateImage(request, () => {
              onProgress(statusText);
            });

            if (result.success && result.imageData) {
              await replacePlaceholder(
                placeholder,
                result.imageData,
                request.prompt,
                placement,
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
          openai: "",
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
      if (!settings.apiKeys.openai) {
        settings.apiKeys.openai = "";
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
          openai: "",
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

  // Handle prompt history load
  on<LoadPromptHistoryHandler>("load-prompt-history", async () => {
    try {
      const history: string[] =
        (await figma.clientStorage.getAsync(PROMPT_HISTORY_KEY)) || [];
      emit<PromptHistoryLoadedHandler>("prompt-history-loaded", { history });
    } catch (error) {
      console.error("Failed to load prompt history:", error);
      emit<PromptHistoryLoadedHandler>("prompt-history-loaded", { history: [] });
    }
  });

  // Handle prompt history save
  on<SavePromptHistoryHandler>(
    "save-prompt-history",
    async (payload: { history: string[] }) => {
      try {
        // Keep only the last MAX_PROMPT_HISTORY entries
        const trimmedHistory = payload.history.slice(-MAX_PROMPT_HISTORY);
        await figma.clientStorage.setAsync(PROMPT_HISTORY_KEY, trimmedHistory);
      } catch (error) {
        console.error("Failed to save prompt history:", error);
      }
    },
  );
}
