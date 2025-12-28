// Positioning engine for smart image placement in Figma

export interface GridConfig {
  maxColumns: number;
  spacing: number;
}

export interface Position {
  x: number;
  y: number;
}

const DEFAULT_CONFIG: GridConfig = {
  maxColumns: 12,
  spacing: 20,
};

/**
 * Calculate grid positions for N images
 * Uses a simple row-based layout that wraps at maxColumns
 */
export function calculateGridPositions(
  count: number,
  cellWidth: number,
  cellHeight: number,
  origin: Position,
  config: GridConfig = DEFAULT_CONFIG,
): Position[] {
  const positions: Position[] = [];
  const columns = Math.min(count, config.maxColumns);

  for (let i = 0; i < count; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);

    positions.push({
      x: origin.x + col * (cellWidth + config.spacing),
      y: origin.y + row * (cellHeight + config.spacing),
    });
  }

  return positions;
}

/**
 * Find the origin point for placing new images
 * - If there's a selection: place to the right of the selection bounds
 * - Otherwise: center on viewport
 */
export function getPlacementOrigin(
  selection: readonly SceneNode[],
  viewportCenter: Position,
  cellWidth: number,
  cellHeight: number,
  gap: number = 40,
): Position {
  if (selection.length === 0) {
    // Center on viewport
    return {
      x: viewportCenter.x - cellWidth / 2,
      y: viewportCenter.y - cellHeight / 2,
    };
  }

  // Find the rightmost edge of selection
  let maxRight = -Infinity;
  let minTop = Infinity;

  for (const node of selection) {
    const right = node.x + node.width;
    if (right > maxRight) {
      maxRight = right;
    }
    if (node.y < minTop) {
      minTop = node.y;
    }
  }

  return {
    x: maxRight + gap,
    y: minTop,
  };
}

/**
 * Get estimated cell size based on aspect ratio and image size settings
 * This is used for placeholder sizing before actual image dimensions are known
 */
export function getEstimatedCellSize(
  aspectRatio: string,
  imageSize: string,
): { width: number; height: number } {
  // Base sizes for each resolution tier
  const baseSizes: Record<string, number> = {
    "1K": 1024,
    "2K": 2048,
    "4K": 4096,
  };

  const baseSize = baseSizes[imageSize] || 1024;

  // Aspect ratio multipliers [width, height]
  const ratios: Record<string, [number, number]> = {
    auto: [4, 3],
    "1:1": [1, 1],
    "16:9": [16, 9],
    "9:16": [9, 16],
    "4:3": [4, 3],
    "3:4": [3, 4],
    "3:2": [3, 2],
    "2:3": [2, 3],
    "5:4": [5, 4],
    "4:5": [4, 5],
    "21:9": [21, 9],
  };

  const [wRatio, hRatio] = ratios[aspectRatio] || [4, 3];

  // Calculate dimensions where the longer edge equals baseSize
  if (wRatio >= hRatio) {
    const width = baseSize;
    const height = Math.round((baseSize * hRatio) / wRatio);
    return { width, height };
  } else {
    const height = baseSize;
    const width = Math.round((baseSize * wRatio) / hRatio);
    return { width, height };
  }
}
