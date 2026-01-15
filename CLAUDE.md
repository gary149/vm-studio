# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VM Studio is a Figma plugin for AI image generation. It supports multiple AI providers (Fal.ai, Google AI Studio, OpenRouter, OpenAI) and models, with text-to-image and image-to-image capabilities.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Production build with typecheck and minify
npm run watch        # Development mode with typecheck and hot reload
```

## Architecture

### Figma Plugin Architecture (Sandbox + UI)

The plugin uses @create-figma-plugin with a two-process model:

- **`src/main.ts`** - Figma sandbox (has access to Figma API, no DOM)
  - Handles image placement, node selection, settings persistence
  - Communicates with UI via `emit()` and `on()` event handlers
  - Uses `figma.clientStorage` for persisting settings and prompt history

- **`src/ui.tsx`** - UI layer (Preact, has DOM, no Figma API)
  - Manages UI state, user interactions, provider/model selection
  - Communicates with sandbox via typed event handlers defined in `src/types/index.ts`

### Provider System

Providers are defined in `src/providers/`:
- **`index.ts`** - Provider/model registry with `PROVIDERS` config object
- **`generate.ts`** - Router that dispatches to provider-specific generators
- **`fal.ts`, `gemini.ts`, `openrouter.ts`, `openai.ts`** - Provider implementations

Each provider implements `GeneratorFn`: `(request, onProgress?) => Promise<GenerationResult>`

### Adding a New Model to an Existing Provider

For adding a model to an existing provider (e.g., a new Fal.ai model):

1. **Research the API** - Check the provider's API docs (e.g., https://fal.ai/models/{model-id}/api) for:
   - Endpoint structure (base path, `/edit` suffix for i2i, `/text-to-image` suffix)
   - Required/optional parameters (image_size, num_images, output_format, etc.)
   - Image size format (enum values like `square_hd`, `landscape_4_3` or custom `{width, height}`)

2. **Add model config** in `src/providers/index.ts`:
   ```typescript
   {
     id: "fal-ai/model-name",
     name: "Display Name",
     supportsImageGeneration: true,
     supportsImageToImage: true,  // Check if model has /edit endpoint
     supportedImageSizes: ["1K"], // Based on API capabilities
   }
   ```

3. **Update generator logic** in `src/providers/fal.ts` if the model needs special handling:
   - The code uses `modelId.includes()` patterns to detect model types:
     - `isFlux2 = modelId.includes("flux-2")` - FLUX.2 models
     - `isSeedream = modelId.includes("seedream")` - Seedream models
     - `isGptImage = modelId.includes("gpt-image")` - GPT-Image models
     - `isZImage = modelId.includes("z-image")` - Z-Image models
   - If the new model fits an existing pattern, it works automatically
   - Otherwise, add a new detection pattern and body construction block

4. **Update website** in `website/index.html`:
   - Add model row to the models table (copy existing row structure)
   - Update model count in section header and FAQ

### Adding a New Provider

For adding an entirely new provider:

1. Add to `ProviderId` type in `src/types/index.ts`
2. Add config to `PROVIDERS` in `src/providers/index.ts`
3. Create generator in `src/providers/{name}.ts`
4. Register in `PROVIDER_GENERATORS` in `src/providers/generate.ts`
5. Add domain to `networkAccess.allowedDomains` in `package.json`

### Image Placement

`src/positioning.ts` handles smart grid placement:
- `getPlacementOrigin()` - Determines where to start placing (right of selection or viewport center)
- `getCollisionFreePositions()` - Diagonal expansion algorithm to find non-overlapping positions
- Grid cursor persists for 30 seconds to continue sequential generations in same grid

### Key Types

- `ProviderId` - Provider identifiers: "fal" | "openrouter" | "gemini" | "openai"
- `GenerationRequest` - Input for image generation
- `GenerationResult` - Output with `imageData: Uint8Array` or error
- `PluginSettings` - Persisted settings including API keys
- Event handlers (e.g., `GenerateImageHandler`) define sandbox↔UI communication

### Components

UI components in `src/components/` are Preact functional components using @create-figma-plugin/ui. All exported from `index.ts`.

## Landing Page

The `website/` directory contains a static landing page for vmstudio.ai:

- **`index.html`** - Single-page site with Linear-inspired split layout design
  - Left panel: Fixed hero with logo, title, CTA, and navigation
  - Right panel: Scrollable content (features bento grid, models table, FAQ, final CTA)
- **`styles.css`** - Dark theme CSS with custom properties, responsive breakpoints
- **`assets/`** - Logo SVG, favicons, hero video (`hero-demo.mp4`), and OG image

The page is pure HTML/CSS/JS with no build step. Do not change the title or meta descriptions when updating.
