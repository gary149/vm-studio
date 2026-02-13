// Positioning engine for smart image placement in Figma

export interface GridConfig {
  maxColumns: number;
  spacing: number;
}

export interface Position {
  x: number;
  y: number;
}

// Bounds with precomputed right/bottom for efficient collision checks
interface NormalizedBounds {
  x: number;
  y: number;
  right: number;
  bottom: number;
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
  startIndex: number = 0,
): Position[] {
  const positions: Position[] = [];
  const columns = Math.max(config.maxColumns, 1);

  for (let i = 0; i < count; i++) {
    const slotIndex = startIndex + i;
    const col = slotIndex % columns;
    const row = Math.floor(slotIndex / columns);

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

/**
 * Collect bounds of all page objects
 */
function collectPageBounds(pageChildren: readonly SceneNode[]): NormalizedBounds[] {
  const bounds: NormalizedBounds[] = [];

  for (const node of pageChildren) {
    bounds.push({
      x: node.x,
      y: node.y,
      right: node.x + node.width,
      bottom: node.y + node.height,
    });
  }

  return bounds;
}

function collectPageBoundsExcludingNode(
  pageChildren: readonly SceneNode[],
  excludeNodeId?: string,
): NormalizedBounds[] {
  if (!excludeNodeId) {
    return collectPageBounds(pageChildren);
  }

  const bounds: NormalizedBounds[] = [];
  for (const node of pageChildren) {
    if (node.id === excludeNodeId) continue;
    bounds.push({
      x: node.x,
      y: node.y,
      right: node.x + node.width,
      bottom: node.y + node.height,
    });
  }
  return bounds;
}

/**
 * Check if two rectangles overlap
 */
function rectsOverlap(a: NormalizedBounds, b: NormalizedBounds): boolean {
  return !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
}

/**
 * Check if a position is free (no collisions)
 */
function isPositionFree(
  x: number,
  y: number,
  width: number,
  height: number,
  existingBounds: NormalizedBounds[],
): boolean {
  const testRect: NormalizedBounds = {
    x,
    y,
    right: x + width,
    bottom: y + height,
  };

  for (const bounds of existingBounds) {
    if (rectsOverlap(testRect, bounds)) {
      return false;
    }
  }
  return true;
}

/**
 * Find first free position using diagonal expansion from start position.
 * Checks both right and down directions, preferring closer positions.
 */
function findFreePosition(
  startX: number,
  startY: number,
  width: number,
  height: number,
  existingBounds: NormalizedBounds[],
  stepX: number,
  stepY: number,
): Position {
  const maxSteps = 100;

  // Diagonal expansion: check positions in order of distance from start
  // (0,0), (1,0), (0,1), (2,0), (1,1), (0,2), (3,0), (2,1), (1,2), (0,3), ...
  for (let distance = 0; distance < maxSteps; distance++) {
    for (let col = 0; col <= distance; col++) {
      const row = distance - col;

      const x = startX + col * stepX;
      const y = startY + row * stepY;

      if (isPositionFree(x, y, width, height, existingBounds)) {
        return { x, y };
      }
    }
  }

  // Fallback to start position if no free space found
  return { x: startX, y: startY };
}

/**
 * Find the nearest collision-free position around an anchor.
 * Uses diagonal expansion in right/down directions only.
 */
export function getCollisionFreePositionNearAnchor(
  anchor: Position,
  width: number,
  height: number,
  stepX: number,
  stepY: number,
  pageChildren: readonly SceneNode[],
  excludeNodeId?: string,
): Position {
  const existingBounds = collectPageBoundsExcludingNode(pageChildren, excludeNodeId);
  return findFreePosition(
    anchor.x,
    anchor.y,
    width,
    height,
    existingBounds,
    stepX,
    stepY,
  );
}

/**
 * Get collision-free positions for N images
 * Scans from intended grid positions to find free space
 */
export function getCollisionFreePositions(
  origin: Position,
  count: number,
  cellWidth: number,
  cellHeight: number,
  spacing: number,
  maxColumns: number,
  pageChildren: readonly SceneNode[],
  startIndex: number = 0,
): Position[] {
  // Collect existing bounds
  const existingBounds = collectPageBounds(pageChildren);

  // Fast path: if no existing objects, use simple grid
  if (existingBounds.length === 0) {
    return calculateGridPositions(count, cellWidth, cellHeight, origin, {
      maxColumns,
      spacing,
    }, startIndex);
  }

  const positions: Position[] = [];
  const stepX = cellWidth + spacing;
  const stepY = cellHeight + spacing;

  for (let i = 0; i < count; i++) {
    // Calculate intended grid position
    const slotIndex = startIndex + i;
    const col = slotIndex % maxColumns;
    const row = Math.floor(slotIndex / maxColumns);
    const intendedX = origin.x + col * stepX;
    const intendedY = origin.y + row * stepY;

    // Find nearest free position
    const freePos = findFreePosition(
      intendedX,
      intendedY,
      cellWidth,
      cellHeight,
      existingBounds,
      stepX,
      stepY,
    );

    positions.push(freePos);

    // Add this position to existing bounds for subsequent images
    existingBounds.push({
      x: freePos.x,
      y: freePos.y,
      right: freePos.x + cellWidth,
      bottom: freePos.y + cellHeight,
    });
  }

  return positions;
}
