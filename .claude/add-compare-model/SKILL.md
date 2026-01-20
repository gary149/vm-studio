---
name: add-compare-model
description: Add a new AI image model to the VM Studio comparison system. Use when the user wants to add a new model to the comparison pages, include a model in comparisons, or update the model comparison system. Triggers on requests like "add [model] to compare", "include [model] in comparisons", "add new model to comparison pages", or "update compare models with [model]". Handles the complete workflow including API research, image generation, quality evaluation, data updates, and page regeneration.
---

# Add Model to Comparisons

Add a new AI image model to the VM Studio comparison system at `website/compare/`.

## Files to Modify

| File | Purpose |
|------|---------|
| `website/compare/generate-images.js` | Add model to MODELS array, update buildRequestBody() |
| `website/compare/build-pages.js` | Add model metadata to MODELS object |
| `website/compare/evaluations.json` | Add quality scores for all 10 prompts |
| `website/compare/generation-results.json` | Timing data (auto-updated by script) |
| `website/compare/index.html` | Hub page with leaderboard (regenerate manually) |

## Workflow

### 1. Gather Model Info

Ask user for:
- **Model name**: Display name (e.g., "FLUX.1 Pro")
- **fal.ai model ID**: API identifier (e.g., "fal-ai/flux-pro")
- **URL slug**: For directories/URLs (e.g., "flux1-pro")

### 2. Research fal.ai API

Fetch `https://fal.ai/models/{model-id}/api` to determine:

```
Endpoint pattern:
- Most models: https://fal.run/{model-id}
- Seedream models: https://fal.run/{model-id}/text-to-image

Image size format:
- Default: { width: 1024, height: 1024 }
- GPT-Image: "1024x1024"
- Nano Banana: aspect_ratio: "1:1", resolution: "1K"

Special params:
- z-image: num_inference_steps: 8
- gpt-image: quality: "high"

Pricing:
- Per image or per megapixel
- Get exact cost from fal.ai pricing page
```

### 3. Update generate-images.js

Add to MODELS array (line ~11):
```javascript
{ id: "fal-ai/new-model", slug: "new-model-slug" },
```

Update buildRequestBody() (~line 83) if special params needed:
```javascript
} else if (modelId.includes("new-model")) {
  return { ...base, image_size: { width: 1024, height: 1024 } };
}
```

Update getEndpoint() (~line 109) if different URL pattern needed.

### 4. Generate Images

```bash
cd website/compare && node generate-images.js
```

Creates 10 images in `images/{slug}/` and updates `generation-results.json`.

**Tip**: To generate only for the new model, temporarily comment out other models in the MODELS array.

### 5. Evaluate Images

Launch **10 parallel Task agents** to evaluate the new images. See [references/evaluation-criteria.md](references/evaluation-criteria.md) for prompt-specific criteria.

Each agent prompt:
```
Evaluate the AI-generated image at website/compare/images/{slug}/{prompt-id}.png

Prompt category: {category}
Original prompt: {prompt text from generate-images.js PROMPTS array}

Score 1-10 on criteria for this category (see evaluation-criteria.md).
Return JSON:
{
  "model_slug": "{slug}",
  "prompt_id": "{prompt-id}",
  "quality_score": <1-10>,
  "criteria_passed": ["criterion1", "criterion2"],
  "criteria_failed": ["criterion3"],
  "commentary": "One sentence evaluation"
}
```

### 6. Update evaluations.json

Add new model's results to each prompt in `evaluations.evaluations`:
```json
{
  "evaluations": {
    "01-portrait": [
      // existing entries...
      { "model_slug": "new-slug", "quality_score": 8, "criteria_passed": [...], "criteria_failed": [...], "commentary": "..." }
    ]
    // repeat for all 10 prompts
  }
}
```

### 7. Update build-pages.js

Add to MODELS object (~line 16):
```javascript
"new-model-slug": {
  id: "fal-ai/new-model",
  name: "New Model Name",
  shortName: "Short Name",
  maxRes: "1K (1024×1024)",
  cost: "$0.XX",
  costNote: "per image",
  architecture: "Diffusion",
  providers: "fal.ai",
  icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>`,
},
```

### 8. Regenerate Comparison Pages & Sitemap

```bash
cd website/compare && node build-pages.js
```

With N models, generates N×(N-1)/2 comparison pages + sitemap.xml (auto-generated).

### 9. Update Hub Page

Edit `website/compare/index.html`:

1. **Update stats** in hub-hero section:
   - Model count
   - Comparison count: N×(N-1)/2
   - Image count: N×10

2. **Add to leaderboard** in leaderboard-section:
   - Calculate total wins across all comparisons
   - Insert row in correct rank position

3. **Add comparison links** in comparisons-grid:
   - Add all N-1 new comparison links
   - Include score and winner for each

4. **Update ItemList schema** in `<head>`:
   - Update `numberOfItems` count
   - Add new ListItem entries for each new comparison

### 10. Verify

```bash
cd website && npx serve -p 3001
```

Check:
- [ ] Hub page shows correct model/comparison/image counts
- [ ] New model appears in leaderboard at correct rank
- [ ] All new comparison links work
- [ ] Comparison pages show correct images and scores

## Quick Checklist

- [ ] Model in generate-images.js MODELS
- [ ] buildRequestBody() handles model (if special params)
- [ ] 10 images in images/{slug}/
- [ ] generation-results.json has timing data
- [ ] 10 evaluations in evaluations.json
- [ ] Model in build-pages.js MODELS with pricing
- [ ] Comparison pages + sitemap regenerated
- [ ] Hub page updated (stats, leaderboard, links, ItemList schema)
- [ ] Verified in browser
