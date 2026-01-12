# VM Studio Miro Port - Implementation Plan

## Overview

This document details the step-by-step implementation for porting VM Studio from Figma to Miro. Based on the research document, the port is highly feasible with approximately **70% code reuse** for business logic and providers.

---

## 1. Project Structure

```
vm-studio-miro/
├── src/
│   ├── index.ts              # Headless entry (icon click handler)
│   ├── app.tsx               # Panel UI entry (replaces ui.tsx)
│   ├── board.ts              # NEW: Miro board operations
│   ├── storage.ts            # NEW: Miro storage wrapper
│   ├── providers/            # COPY: Direct reuse from Figma
│   │   ├── index.ts
│   │   ├── generate.ts
│   │   ├── fal.ts
│   │   ├── gemini.ts
│   │   ├── openai.ts
│   │   ├── openrouter.ts
│   │   └── utils.ts
│   ├── components/           # ADAPT: Adjust for 320dp width
│   │   ├── PromptInput.tsx
│   │   ├── ProviderPicker.tsx
│   │   ├── ApiKeyInput.tsx
│   │   ├── CountInput.tsx
│   │   ├── AspectRatioSelect.tsx
│   │   ├── ImageSizeSelect.tsx
│   │   ├── GenerateButton.tsx
│   │   ├── ErrorBanner.tsx
│   │   └── ThumbnailStrip.tsx
│   ├── positioning.ts        # ADAPT: Miro coordinate system
│   └── types/
│       └── index.ts          # ADAPT: Remove Figma event handlers
├── assets/
│   └── icon.svg
├── app-manifest.yaml         # NEW: Miro manifest
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 2. File Migration Matrix

### Direct Copy (100% Reuse)

| File | Reason |
|------|--------|
| `src/providers/fal.ts` | Pure HTTP client, no Figma dependencies |
| `src/providers/gemini.ts` | Pure HTTP client, no Figma dependencies |
| `src/providers/openai.ts` | Pure HTTP client, no Figma dependencies |
| `src/providers/openrouter.ts` | Pure HTTP client, no Figma dependencies |
| `src/providers/generate.ts` | Provider router, no Figma dependencies |
| `src/providers/utils.ts` | Base64 utilities |
| `src/providers/index.ts` | Provider configs |

### Adapt (Partial Reuse)

| File | Changes Required |
|------|------------------|
| `src/types/index.ts` | Remove `EventHandler` imports, remove Figma interfaces |
| `src/positioning.ts` | Replace `SceneNode` with generic `BoardItem` interface |
| `src/components/*.tsx` | Adjust layouts for 320dp width |
| `src/styles.css` | Replace Figma CSS vars, 320dp width |
| `src/ui.tsx` → `app.tsx` | Direct Miro SDK calls, remove emit/on pattern |

### Rewrite Completely

| File | Replacement | Reason |
|------|-------------|--------|
| `src/main.ts` | `board.ts` + `storage.ts` + `index.ts` | Figma sandbox pattern not applicable |
| `manifest.json` | `app-manifest.yaml` | Different manifest format |
| `package.json` | New dependencies | Miro SDK instead of Figma tooling |

---

## 3. Implementation Steps

### Phase 1: Project Bootstrap

#### Step 1.1: Initialize Miro App

```bash
npx create-miro-app@latest vm-studio-miro
# Select: Preact, TypeScript
```

#### Step 1.2: Create `app-manifest.yaml`

```yaml
appName: VM Studio
sdkVersion: SDK_V2
sdkUri: http://localhost:3000
scopes:
  - boards:read
  - boards:write
```

#### Step 1.3: Update `package.json`

**Add:**
- `@mirohq/websdk-types` - Type definitions
- `preact` - Same framework

**Remove:**
- `@create-figma-plugin/*`
- `@figma/plugin-typings`

---

### Phase 2: Core Infrastructure

#### Step 2.1: Create `src/storage.ts`

```typescript
const COLLECTION_NAME = 'vm-studio-settings';

export async function loadSettings(): Promise<PluginSettings> {
  const storage = miro.board.storage.collection(COLLECTION_NAME);
  const settings = await storage.get('settings');
  return settings || DEFAULT_SETTINGS;
}

export async function saveSettings(partial: PartialPluginSettings): Promise<void> {
  const storage = miro.board.storage.collection(COLLECTION_NAME);
  const current = await storage.get('settings') || DEFAULT_SETTINGS;
  const updated = { ...current, ...partial };
  if (partial.apiKeys) {
    updated.apiKeys = { ...current.apiKeys, ...partial.apiKeys };
  }
  await storage.set('settings', updated);
}
```

#### Step 2.2: Create `src/board.ts`

```typescript
import type { Position } from './types';

export async function createImageOnBoard(
  imageUrl: string,  // base64 data URL or HTTPS URL
  position: Position,
  title: string
): Promise<void> {
  await miro.board.createImage({
    url: imageUrl,
    x: position.x,
    y: position.y,
    title: title,
  });
}

export async function getViewportCenter(): Promise<Position> {
  const viewport = await miro.board.viewport.get();
  return {
    x: viewport.x + viewport.width / 2,
    y: viewport.y + viewport.height / 2,
  };
}

export async function showNotification(message: string): Promise<void> {
  await miro.board.notifications.show({
    type: 'info',
    message: message,
    autoHideTimeMs: 3000,
  });
}

export async function zoomToPositions(positions: Position[]): Promise<void> {
  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));

  await miro.board.viewport.set({
    viewport: {
      x: minX - 100,
      y: minY - 100,
      width: maxX - minX + 200,
      height: maxY - minY + 200,
    },
    padding: { top: 50, bottom: 50, left: 50, right: 50 },
  });
}
```

**Key Difference from Figma:** No placeholder pattern. Miro cannot update image URLs after creation. Images appear only after generation completes.

#### Step 2.3: Adapt `src/positioning.ts`

```typescript
// BEFORE (Figma)
export function getCollisionFreePositions(
  pageChildren: readonly SceneNode[],
): Position[]

// AFTER (Miro)
interface BoardItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCollisionFreePositions(
  pageChildren: BoardItem[],
): Position[]
```

---

### Phase 3: Types Adaptation

Update `src/types/index.ts`:

**Remove:**
```typescript
import { EventHandler } from "@create-figma-plugin/utilities";

// Remove all Handler interfaces
export interface GenerateImageHandler extends EventHandler { ... }
export interface LoadSettingsHandler extends EventHandler { ... }
```

**Keep:**
```typescript
export type ProviderId = "fal" | "openrouter" | "gemini" | "openai";
export interface ProviderConfig { ... }
export interface ModelConfig { ... }
export interface GenerationRequest { ... }
export interface GenerationResult { ... }
export interface PluginSettings { ... }
export interface UIState { ... }
```

**Adapt InputImage:**
```typescript
export interface InputImage {
  id: string;          // Miro item ID
  dataUrl: string;     // Full data URL (Miro stores URLs)
  thumbnail: string;
  width: number;
  height: number;
  name: string;
}
```

---

### Phase 4: UI Panel Implementation

#### Step 4.1: Create `src/index.ts`

```typescript
async function init() {
  await miro.board.ui.openPanel({
    url: 'app.html',
  });
}

miro.onReady(init);
```

#### Step 4.2: Adapt `src/app.tsx` (from `ui.tsx`)

**Before (Figma message passing):**
```typescript
emit<GenerateImageHandler>("generate-image", { prompt, ... });
```

**After (Miro direct calls):**
```typescript
import { createImageOnBoard, getViewportCenter, showNotification } from './board';
import { generateImage } from './providers/generate';

const handleGenerate = async () => {
  const result = await generateImage(request, setStatus);
  if (result.success && result.imageData) {
    const dataUrl = `data:${result.mimeType};base64,${uint8ArrayToBase64(result.imageData)}`;
    const center = await getViewportCenter();
    await createImageOnBoard(dataUrl, center, state.prompt);
    await showNotification('Image generated!');
  }
};
```

**Selection handling:**
```typescript
useEffect(() => {
  const handleSelection = async (event: { items: any[] }) => {
    const images = event.items.filter(item => item.type === 'image');
    setState(prev => ({ ...prev, inputImages: images }));
  };

  miro.board.ui.on('selection:update', handleSelection);
  return () => miro.board.ui.off('selection:update', handleSelection);
}, []);
```

---

### Phase 5: UI Component Adaptations

#### ProviderPicker - Combined Dropdown (320dp)

```tsx
// Single select with grouped options (saves space)
<select value={selectedModelId} onChange={handleChange}>
  <optgroup label="Fal.ai">
    <option value="fal-ai/nano-banana-pro">Nano Banana Pro</option>
  </optgroup>
  <optgroup label="OpenAI">
    <option value="gpt-image-1.5">GPT-Image 1.5</option>
  </optgroup>
</select>
```

#### AspectRatioSelect + ImageSizeSelect - Stack Vertically

```css
/* For 320dp width, stack instead of row */
.row {
  flex-direction: column;
  gap: 8px;
}
```

---

### Phase 6: CSS Adaptations

```css
:root {
  --panel-width: 320px;
}

.content {
  padding: var(--space-2);  /* Reduced from space-3 */
}

.input, .select {
  max-width: 100%;
  box-sizing: border-box;
}

/* Replace Figma CSS vars */
--color-bg: #ffffff;
--color-text: #333333;

/* Optional: Use @mirohq/mirotone for Miro-native styling */
```

---

### Phase 7: Image-to-Image Handling

```typescript
async function exportSelectedImages(): Promise<InputImage[]> {
  const selection = await miro.board.getSelection();
  const images = selection.filter(item => item.type === 'image');

  const inputImages: InputImage[] = [];

  for (const img of images) {
    try {
      const response = await fetch(img.url);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      inputImages.push({
        id: img.id,
        dataUrl: base64,
        thumbnail: img.url,
        width: img.width,
        height: img.height,
        name: img.title || 'Selected Image',
      });
    } catch (error) {
      console.error('Failed to fetch image:', error);
    }
  }

  return inputImages;
}
```

**CORS Note:** Miro-hosted images are accessible. External images may have CORS issues.

---

## 4. API Mapping Reference

| Figma API | Miro SDK |
|-----------|----------|
| `figma.createImage(bytes)` | N/A (not needed) |
| `figma.createRectangle()` | `miro.board.createShape()` |
| N/A | `miro.board.createImage({ url })` |
| `figma.currentPage.selection` | `miro.board.getSelection()` |
| `figma.on('selectionchange')` | `miro.board.ui.on('selection:update')` |
| `figma.viewport.center` | `miro.board.viewport.get()` |
| `figma.viewport.scrollAndZoomIntoView()` | `miro.board.viewport.zoomTo()` |
| `figma.clientStorage.getAsync()` | `storage.collection().get()` |
| `figma.clientStorage.setAsync()` | `storage.collection().set()` |
| `figma.notify()` | `miro.board.notifications.show()` |
| `node.exportAsync()` | Fetch from `item.url` |

---

## 5. Generation Flow Comparison

### Figma Flow:
1. UI emits `generate-image` to sandbox
2. Sandbox creates placeholder rectangles
3. Sandbox calls provider API
4. Sandbox replaces placeholder with image fill
5. Sandbox emits `generation-complete` to UI

### Miro Flow (Simplified):
1. UI shows loading state
2. UI directly calls provider API
3. UI calls `miro.board.createImage()` with data URL
4. UI shows notification

**No placeholder pattern in Miro** - images appear after generation completes.

---

## 6. Testing Checklist

### Basic Generation
- [ ] Text prompt generates image
- [ ] Image appears at viewport center
- [ ] Notification shows on success

### Multi-Image Generation
- [ ] Count selector works
- [ ] Images placed in grid layout
- [ ] No overlapping with existing items

### Image-to-Image
- [ ] Selection detection works
- [ ] Thumbnails display correctly
- [ ] Generated image uses input as reference

### Settings Persistence
- [ ] API keys saved across sessions
- [ ] Last model/provider remembered

### Provider Switching
- [ ] All providers work (Fal, OpenAI, Gemini, OpenRouter)
- [ ] API key switching works

### UI at 320dp
- [ ] All controls visible without horizontal scroll
- [ ] Form elements properly sized
- [ ] No text truncation

### Error Handling
- [ ] Invalid API key shows error
- [ ] Network failure handled gracefully
- [ ] Empty prompt prevented

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| CORS issues with image URLs | Use Miro-hosted images only for i2i |
| No placeholder pattern | Show loading overlay on UI instead |
| 320dp width too narrow | Use collapsible sections or modal |
| Storage limits (30KB) | Store only API keys, not history |

---

## 8. Files to Create/Modify

### New Files (Miro-specific)
1. `vm-studio-miro/app-manifest.yaml`
2. `vm-studio-miro/src/index.ts`
3. `vm-studio-miro/src/board.ts`
4. `vm-studio-miro/src/storage.ts`
5. `vm-studio-miro/src/app.tsx`

### Copy Directly
1. `src/providers/fal.ts`
2. `src/providers/gemini.ts`
3. `src/providers/openai.ts`
4. `src/providers/openrouter.ts`
5. `src/providers/generate.ts`
6. `src/providers/utils.ts`
7. `src/providers/index.ts`

### Adapt
1. `src/types/index.ts` - Remove EventHandler interfaces
2. `src/positioning.ts` - Replace SceneNode with BoardItem
3. `src/components/*` - Adjust for 320dp width
4. `src/styles.css` - New CSS variables, narrower layout
