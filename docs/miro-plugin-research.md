# Miro Plugin Research for VM Studio

## Executive Summary

This document outlines the feasibility and technical approach for porting VM Studio (currently a Figma plugin for AI image generation) to the Miro platform. The analysis shows that **porting is highly feasible** due to similar architectures between Figma and Miro's plugin systems.

## Platform Comparison: Figma vs Miro

| Aspect | Figma Plugin | Miro App |
|--------|--------------|----------|
| Terminology | "Plugin" | "App" |
| Architecture | Sandboxed + UI (iframe) | Iframe-based |
| Framework Support | Preact, React, Vue | Preact, React, Vue, Vanilla |
| Build Tool | `@create-figma-plugin` | `create-miro-app` |
| SDK Version | Figma Plugin API | Miro Web SDK v2 |
| UI Container | Plugin window | App Panel (368dp fixed width) or Modal |
| Configuration | `manifest.json` | `app-manifest.yaml` |

## Miro Web SDK Capabilities

### 1. Image Creation

Miro supports creating images on the board via `miro.board.createImage()`:

```javascript
const image = await miro.board.createImage({
  title: 'Generated Image',
  url: 'https://example.com/image.png', // or base64 data URL
  x: 0,
  y: 0,
  width: 800,
  rotation: 0.0,
});
```

**Key Features:**
- Supports **public URLs** and **base64 data URLs** (`data:image/<format>;base64,<data>`)
- Auto-scales to maintain aspect ratio when only width or height is specified
- Supports title, alt text, position (x, y), rotation
- **Limitation:** Cannot update the `url` after creation (must delete and recreate)

### 2. Board Item Types

Miro supports creating/manipulating these item types:
- **Images** ✅ (our primary use case)
- Sticky Notes
- Shapes
- Frames
- Cards
- Text
- Connectors
- Lines

### 3. Selection & Events

```javascript
// Listen for selection changes
miro.board.ui.on('selection:update', async (event) => {
  const selectedItems = event.items;
  const images = selectedItems.filter(item => item.type === 'image');
  // Process selected images for image-to-image generation
});

// Other available events
miro.board.ui.on('items:create', handler);  // Item created
miro.board.ui.on('experimental:items:update', handler);  // Item moved/resized
```

### 4. Viewport Control

```javascript
// Get current viewport
const viewport = await miro.board.viewport.get();

// Set viewport (pan to generated images)
await miro.board.viewport.set({
  viewport: { x: 0, y: 0, width: 1920, height: 1080 },
  padding: { top: 100, bottom: 100, left: 100, right: 100 },
});

// Zoom to specific items
await miro.board.viewport.zoomTo(items);
```

### 5. Storage Options

| Storage Type | Limit | Persists on Board Copy | Use Case |
|--------------|-------|------------------------|----------|
| App Metadata | 30 KB | ✅ Yes | Small settings |
| Storage Collection | Larger | ❌ No | API keys, preferences |
| localStorage | Browser limit | N/A (domain-level) | Cross-board settings |

**Recommendation:** Use **Storage Collection** for API keys (similar to Figma's `clientStorage`):

```javascript
const storage = miro.board.storage.collection('vm-studio-settings');
await storage.set('apiKeys', { fal: 'key1', openai: 'key2' });
const keys = await storage.get('apiKeys');

// Listen for changes
storage.onValue('apiKeys', (value) => console.log('Keys updated:', value));
```

### 6. UI: Panels & Modals

**App Panel (Primary UI):**
- Opens in left sidebar
- Fixed width: 368dp (320dp usable)
- Height: matches viewport
- Multiple users can see simultaneously

```javascript
await miro.board.ui.openPanel({ url: 'panel.html' });
await miro.board.ui.closePanel();
```

**Modal (Complex Workflows):**
- Blocking overlay
- Customizable dimensions
- One modal at a time

```javascript
if (await miro.board.ui.canOpenModal()) {
  await miro.board.ui.openModal({
    url: 'modal.html',
    width: 600,
    height: 400,
  });
}
```

## App Manifest Configuration

```yaml
# app-manifest.yaml
appName: VM Studio
sdkVersion: SDK_V2
sdkUri: https://your-domain.com  # or http://localhost:3000 for dev
scopes:
  - boards:read
  - boards:write
```

## Competitive Landscape

### Miro's Built-in AI Image Creator

Miro has a **native AI image generation** feature ("Create with AI" → "Images"):
- Available on Free, Starter, Business, Enterprise plans
- Uses Miro's credit system
- Can use board content as context

**Our Differentiation:**
1. **Multiple AI Providers** - FAL.ai (5 models), OpenAI, Gemini, OpenRouter
2. **BYO API Keys** - No credit system, use your own accounts
3. **More Models** - Access to Nano Banana, Z-Image, Seedream, FLUX.2, GPT-Image
4. **Image-to-Image** - Transform existing images with AI
5. **Batch Generation** - Generate multiple images with smart placement
6. **Higher Resolutions** - Up to 4K output

## Technical Migration Strategy

### Architecture Mapping

| Figma Component | Miro Equivalent |
|-----------------|-----------------|
| `figma.createImage()` | `miro.board.createImage()` |
| `figma.currentPage.selection` | `selection:update` event |
| `figma.viewport.scrollAndZoomIntoView()` | `miro.board.viewport.zoomTo()` |
| `figma.clientStorage` | `miro.board.storage.collection()` |
| Plugin UI window | App Panel (368dp width) |
| `figma.createRectangle()` (placeholder) | `miro.board.createShape()` |
| `figma.notify()` | `miro.board.notifications.show()` |

### Code Reuse Opportunities

**Can be reused with minimal changes:**
- `/src/providers/*` - All AI provider integrations (FAL, OpenAI, Gemini, OpenRouter)
- `/src/types/index.ts` - Type definitions
- `/src/positioning.ts` - Positioning algorithm (adapt coordinates)
- `/src/components/*` - Preact components (adjust for 320dp width)

**Needs significant adaptation:**
- `/src/main.ts` - Sandbox handler → Miro board API calls
- `/src/ui.tsx` - Panel layout for narrower width

### UI Considerations

Miro panel is **narrower** (320dp vs Figma's flexible width):
- May need to stack elements vertically
- Consider collapsible sections
- Model picker might need a different layout
- Thumbnails strip may need to be smaller or scrollable

## Development Setup

### Bootstrap New Miro App

```bash
npx create-miro-app@latest vm-studio-miro
# Select: Preact, TypeScript
```

### Project Structure

```
vm-studio-miro/
├── src/
│   ├── app.tsx          # Panel UI (Preact)
│   ├── index.ts         # Headless entry point
│   ├── providers/       # Copy from Figma plugin
│   ├── components/      # Adapt from Figma plugin
│   └── types/           # Copy from Figma plugin
├── app-manifest.yaml
├── package.json
└── tsconfig.json
```

## Required Scopes/Permissions

```yaml
scopes:
  - boards:read          # Read board content, selection
  - boards:write         # Create images, modify items
```

## Network Domains

The app manifest may need to whitelist API domains:
- `fal.run`
- `api.openai.com`
- `generativelanguage.googleapis.com`
- `openrouter.ai`

## Implementation Roadmap

### Phase 1: Core Functionality
1. Set up Miro app with Preact/TypeScript
2. Port AI provider integrations
3. Implement basic text-to-image generation
4. Add API key storage

### Phase 2: UI & UX
1. Adapt UI components for 320dp panel width
2. Implement prompt history
3. Add model/provider selection
4. Implement settings tab

### Phase 3: Advanced Features
1. Selection tracking for image-to-image
2. Smart positioning for batch generation
3. Export selected images as input
4. Viewport centering on generated images

### Phase 4: Polish & Publishing
1. Add error handling and notifications
2. Create app icon and assets
3. Test on different plans/permissions
4. Submit to Miro Marketplace

## Resources

- [Miro Developer Portal](https://developers.miro.com/)
- [Web SDK Introduction](https://developers.miro.com/docs/miro-web-sdk-introduction)
- [Web SDK Reference](https://developers.miro.com/docs/sdk-reference)
- [Image Item Reference](https://developers.miro.com/docs/websdk-reference-image)
- [App Panels & Modals](https://developers.miro.com/docs/app-panels-and-modals)
- [Storage](https://developers.miro.com/docs/storage)
- [App Examples (GitHub)](https://github.com/miroapp/app-examples)
- [OpenAI + Miro Integration Video](https://developers.miro.com/docs/video-integrate-openai-miro)

## Conclusion

Porting VM Studio to Miro is **highly feasible** with the following advantages:

1. **Similar Architecture** - Both use iframe-based UI with sandboxed board access
2. **Same Framework** - Both support Preact/TypeScript
3. **Comparable APIs** - Image creation, selection events, viewport control, storage
4. **Code Reuse** - AI provider integrations can be copied directly

**Main challenges:**
1. Narrower UI panel (320dp) requires layout adaptation
2. Different storage API (but conceptually similar)
3. Cannot update image URLs after creation (minor limitation)

**Time estimate:** 2-3 weeks for a full-featured port, given the high code reusability.
