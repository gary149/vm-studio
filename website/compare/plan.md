# SEO Comparison Pages - Complete

## Status: ✅ DONE

All comparison pages have been generated with real data.

---

## Models Tested (6 total)

| Model | API ID | Cost | Billing |
|-------|--------|------|---------|
| Nano Banana Pro | `fal-ai/nano-banana-pro` | $0.15 | per image |
| FLUX.2 Turbo | `fal-ai/flux-2/turbo` | $0.008 | per megapixel |
| FLUX.2 Klein 9B | `fal-ai/flux-2/klein/9b` | $0.011 | per megapixel |
| GPT-Image 1.5 | `fal-ai/gpt-image-1.5` | $0.009–$0.20 | low–high quality |
| Seedream v4.5 | `fal-ai/bytedance/seedream/v4.5` | $0.04 | per image |
| Z-Image Turbo | `fal-ai/z-image/turbo` | $0.005 | per megapixel |

**Total Comparisons:** 15 pages (6 choose 2)
**Total Images:** 60 unique (6 models × 10 prompts)
**Image Format:** PNG (1024×1024)
**Pricing Source:** fal.ai (January 2026)

---

## 10 Test Prompts

| # | Category | Prompt |
|---|----------|--------|
| 01 | Portrait | Professional headshot of a 35-year-old woman with auburn hair, natural freckles, wearing a navy blazer, soft window lighting, shallow depth of field |
| 02 | Text Rendering | Vintage coffee shop chalkboard menu with handwritten text 'DAILY SPECIALS' at the top, listing 'Espresso $3.50' and 'Cappuccino $4.75', rustic wooden frame |
| 03 | Product | Luxury perfume bottle on white marble surface, dramatic rim lighting, crystal-clear glass with amber liquid inside, minimalist product photography |
| 04 | Architecture | Modern minimalist living room with floor-to-ceiling windows overlooking city skyline at dusk, white sectional sofa, polished concrete floors |
| 05 | Fantasy | Mystical elven warrior with silver armor and flowing white cape, holding a glowing blue sword, standing in ancient forest with magical particles |
| 06 | Food | Gourmet burger on wooden board, toasted brioche bun, melting cheddar cheese, crispy bacon, fresh lettuce, dripping sauce, food magazine style |
| 07 | Fashion | Fashion model in oversized beige trench coat, standing on rainy Paris street at night, neon reflections on wet pavement, editorial Vogue style |
| 08 | Wildlife | Majestic snow leopard resting on rocky mountain ledge, piercing blue-green eyes, thick spotted fur with snowflakes, golden hour backlighting |
| 09 | Abstract | Fluid abstract painting with swirling navy blue and gold metallic tones, organic flowing shapes, high contrast, modern art gallery piece |
| 10 | Sci-Fi | Futuristic cyberpunk cityscape at night, massive holographic advertisements, flying vehicles between towering skyscrapers, rain-slicked streets with neon reflections |

---

## Results Summary

### Average Generation Times

| Model | Avg Time |
|-------|----------|
| Z-Image Turbo | 1.5s |
| FLUX.2 Klein 9B | 1.5s |
| FLUX.2 Turbo | 2.6s |
| Seedream v4.5 | 15.9s |
| Nano Banana Pro | 18.6s |
| GPT-Image 1.5 | 40.0s |

### Head-to-Head Results

| Comparison | Score | Winner |
|------------|-------|--------|
| GPT-Image 1.5 vs Z-Image Turbo | 10-0 | GPT-Image |
| Seedream v4.5 vs Z-Image Turbo | 8-2 | Seedream |
| Nano Banana Pro vs Z-Image Turbo | 7-3 | Nano Banana |
| FLUX.2 Turbo vs Z-Image Turbo | 7-3 | FLUX.2 Turbo |
| FLUX.2 Klein 9B vs Z-Image Turbo | 6-4 | FLUX.2 Klein |
| GPT-Image 1.5 vs Seedream v4.5 | 6-4 | GPT-Image |
| Nano Banana Pro vs FLUX.2 Turbo | 5-5 | Tie |
| Nano Banana Pro vs FLUX.2 Klein 9B | 4-6 | FLUX.2 Klein |
| Nano Banana Pro vs GPT-Image 1.5 | 4-6 | GPT-Image |
| Nano Banana Pro vs Seedream v4.5 | 4-6 | Seedream |
| FLUX.2 Turbo vs FLUX.2 Klein 9B | 3-7 | FLUX.2 Klein |
| FLUX.2 Turbo vs Seedream v4.5 | 3-7 | Seedream |
| FLUX.2 Klein 9B vs Seedream v4.5 | 3-7 | Seedream |
| FLUX.2 Turbo vs GPT-Image 1.5 | 2-8 | GPT-Image |
| FLUX.2 Klein 9B vs GPT-Image 1.5 | 2-8 | GPT-Image |

---

## File Structure

```
website/compare/
├── plan.md                              # This file
├── compare.css                          # Styles
├── generate-images.js                   # Image generation script
├── build-pages.js                       # Page generation script
├── generation-results.json              # Timing data for all 60 images
├── evaluations.json                     # Vision evaluations for all 60 images
├── images/
│   ├── nano-banana-pro/                 # 10 images
│   ├── flux2-turbo/                     # 10 images
│   ├── flux2-klein-9b/                  # 10 images
│   ├── gpt-image-1-5/                   # 10 images
│   ├── seedream-v4-5/                   # 10 images
│   └── z-image-turbo/                   # 10 images
└── [15 comparison directories]/
    └── index.html
```

### Generated Comparison Pages

1. `nano-banana-pro-vs-flux2-turbo/`
2. `nano-banana-pro-vs-flux2-klein-9b/`
3. `nano-banana-pro-vs-gpt-image-1-5/`
4. `nano-banana-pro-vs-seedream-v4-5/`
5. `nano-banana-pro-vs-z-image-turbo/`
6. `flux2-turbo-vs-flux2-klein-9b/`
7. `flux2-turbo-vs-gpt-image-1-5/`
8. `flux2-turbo-vs-seedream-v4-5/`
9. `flux2-turbo-vs-z-image-turbo/`
10. `flux2-klein-9b-vs-gpt-image-1-5/`
11. `flux2-klein-9b-vs-seedream-v4-5/`
12. `flux2-klein-9b-vs-z-image-turbo/`
13. `gpt-image-1-5-vs-seedream-v4-5/`
14. `gpt-image-1-5-vs-z-image-turbo/`
15. `seedream-v4-5-vs-z-image-turbo/`

---

## Completed Phases

### ✅ Phase 1: Image Generation
- Created `generate-images.js`
- Generated 60 images (6 models × 10 prompts)
- Recorded timing data to `generation-results.json`

### ✅ Phase 2: Vision Evaluation
- Used parallel Claude agents to evaluate all images
- Scored each image on prompt-specific criteria
- Saved evaluations to `evaluations.json`

### ✅ Phase 3: Pricing Research
- Fetched current pricing from fal.ai
- Added cost and billing method per model

### ✅ Phase 4: Page Generation
- Created `build-pages.js` template engine
- Generated all 15 comparison HTML pages
- Includes: stats bar, verdict, image grid, feature table, CTA

---

## Remaining Tasks

- [x] Create hub page at `/compare/index.html` linking all comparisons
- [x] Delete old manual template at `flux2-turbo-vs-nano-banana-pro/` (now auto-generated)
- [ ] Verify pages in browser
- [ ] Test mobile responsiveness

---

## Scripts Usage

### Regenerate all pages
```bash
cd website/compare
node build-pages.js
```

### Regenerate images (if needed)
```bash
cd website/compare
node generate-images.js
```
