# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VM Studio is a Figma plugin for AI image generation. It supports multiple AI providers (Fal.ai, Google AI Studio, OpenRouter, OpenAI, Hugging Face) and models, with text-to-image and image-to-image capabilities.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Production build with typecheck and minify
npm run watch        # Development mode with typecheck and hot reload
```

## Testing

You are authorized to use variables from `.env.local` for running tests.

When testing new providers or models:
1. Create a standalone test script (e.g., `test-{feature}.mjs`)
2. Use `dotenv` to load `.env.local`: `dotenv.config({ path: ".env.local" })`
3. Test text-to-image with various sizes and aspect ratios
4. Test image-to-image separately (don't assume it works if t2i works)
5. Clean up test files after verification

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
- **`fal.ts`, `gemini.ts`, `openrouter.ts`, `openai.ts`, `huggingface.ts`** - Provider implementations

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

#### Step 1: Research and Test the API First

Before writing any code, create a test script (`test-{provider}.mjs`) to verify:
- API endpoint format and authentication method
- Request/response structure
- Which models are supported and their capabilities
- Different parameter options (sizes, aspect ratios, etc.)
- Whether image-to-image is actually supported (test it, don't assume!)

**Prefer direct fetch calls over SDKs** - SDKs add bundle size and complexity. Use the provider's REST API directly with `fetch()`. Only use an SDK if the API is too complex (e.g., requires OAuth, WebSocket polling, or cryptographic signing).

Example test script pattern:
```javascript
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const response = await fetch("https://api.provider.com/v1/images/generate", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.PROVIDER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prompt: "test", width: 1024, height: 1024 }),
});
const result = await response.json();
```

#### Step 2: Update Type Definitions

1. Add to `ProviderId` type in `src/types/index.ts`:
   ```typescript
   export type ProviderId = "fal" | "openrouter" | ... | "newprovider";
   ```

2. Add to `DEFAULT_SETTINGS.apiKeys` in `src/types/index.ts`:
   ```typescript
   apiKeys: {
     ...existing,
     newprovider: "",
   }
   ```

#### Step 3: Add Provider Config

Add config to `PROVIDERS` in `src/providers/index.ts`:
```typescript
newprovider: {
  id: "newprovider",
  name: "Provider Display Name",
  requiresApiKey: true,
  apiKeyUrl: "https://provider.com/api-keys",
  models: [
    {
      id: "model-id",
      name: "Model Display Name",
      supportsImageGeneration: true,
      supportsImageToImage: false,  // Only set true if tested!
      supportedImageSizes: ["1K", "2K"],  // Based on actual testing
    },
  ],
},
```

#### Step 4: Create Provider Generator

Create `src/providers/{name}.ts` implementing the generator function:
- Handle both text-to-image and image-to-image (if supported)
- Convert response to `Uint8Array` for `GenerationResult.imageData`
- Use `onProgress?.()` for status updates
- Handle errors gracefully with descriptive messages

#### Step 5: Register the Generator

In `src/providers/generate.ts`:
```typescript
import { generateWithNewProvider } from "./newprovider";

const PROVIDER_GENERATORS: Record<ProviderId, GeneratorFn> = {
  ...existing,
  newprovider: generateWithNewProvider,
};
```

#### Step 6: Update Other Files

1. Add API key to `src/main.ts` (2 places + migration block):
   - Default settings object
   - Fallback in catch block
   - Migration: `if (!settings.apiKeys.newprovider) settings.apiKeys.newprovider = "";`

2. Add API key to `src/ui.tsx` initial state

3. Add domains to `package.json` `networkAccess.allowedDomains`

#### Step 7: Build and Test

```bash
npm run build  # Must pass with no TypeScript errors
```

### Provider-Specific Notes

#### Hugging Face (`huggingface.ts`)

**Exception: Uses SDK due to API complexity.** The HF Inference Providers API requires:
1. Model ID mapping lookup from `https://huggingface.co/api/partners/{provider}/models`
2. Queue-based request handling with polling for completion
3. Different endpoint formats per provider backend
4. HF tokens don't work directly with provider APIs (must go through HF router)

The `@huggingface/inference` SDK handles all this complexity internally. Replicating it with direct fetch calls would require 100+ lines of code for model mapping, queue polling, and response parsing.

Configuration:
- Models are identified by HF model IDs (e.g., `Tongyi-MAI/Z-Image-Turbo`)
- Required domains: `router.huggingface.co`, `huggingface.co`, `queue.fal.run`
- Returns `Blob` by default, but TypeScript may infer `string` - handle both cases

Key learnings:
- Always test image-to-image separately - a model may support t2i but not i2i via the inference API
- Some models have long queue times for non-square aspect ratios
- Check `https://huggingface.co/api/partners/fal-ai/models` for supported model mappings

### Image Placement

`src/positioning.ts` handles smart grid placement:
- `getPlacementOrigin()` - Determines where to start placing (right of selection or viewport center)
- `getCollisionFreePositions()` - Diagonal expansion algorithm to find non-overlapping positions
- Grid cursor persists for 30 seconds to continue sequential generations in same grid

### Key Types

- `ProviderId` - Provider identifiers: "fal" | "openrouter" | "gemini" | "openai" | "huggingface"
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
