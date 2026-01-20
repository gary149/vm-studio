# Image Evaluation Criteria

Score each image 1-10 based on prompt-specific criteria.

## Prompts and Criteria

### 01-portrait (Portrait)
**Prompt**: Professional headshot of a 35-year-old woman with auburn hair, natural freckles, wearing a navy blazer, soft window lighting, shallow depth of field

**Criteria**:
- Realistic skin texture and natural appearance
- Auburn hair color accuracy
- Visible natural freckles
- Navy blazer visible and realistic
- Soft, natural window lighting
- Shallow depth of field (background blur)
- Professional headshot composition

### 02-text (Text Rendering)
**Prompt**: Vintage coffee shop chalkboard menu with handwritten text 'DAILY SPECIALS' at the top, listing 'Espresso $3.50' and 'Cappuccino $4.75', rustic wooden frame

**Criteria**:
- "DAILY SPECIALS" text readable and correctly spelled
- "Espresso $3.50" readable and correctly spelled
- "Cappuccino $4.75" readable and correctly spelled
- Chalkboard texture visible
- Handwritten style appearance
- Rustic wooden frame present
- Vintage aesthetic

### 03-product (Product)
**Prompt**: Luxury perfume bottle on white marble surface, dramatic rim lighting, crystal-clear glass with amber liquid inside, minimalist product photography

**Criteria**:
- Crystal-clear glass bottle visible
- Amber liquid inside bottle
- White marble surface
- Dramatic rim lighting effect
- Minimalist composition
- Product photography quality
- Luxury aesthetic

### 04-architecture (Architecture)
**Prompt**: Modern minimalist living room with floor-to-ceiling windows overlooking city skyline at dusk, white sectional sofa, polished concrete floors

**Criteria**:
- Floor-to-ceiling windows
- City skyline visible through windows
- Dusk lighting/atmosphere
- White sectional sofa
- Polished concrete floors
- Modern minimalist style
- Realistic interior proportions

### 05-fantasy (Fantasy)
**Prompt**: Mystical elven warrior with silver armor and flowing white cape, holding a glowing blue sword, standing in ancient forest with magical particles

**Criteria**:
- Elven features (pointed ears, ethereal appearance)
- Silver armor visible
- Flowing white cape
- Glowing blue sword
- Ancient forest setting
- Magical particles/effects
- Fantasy aesthetic cohesion

### 06-food (Food)
**Prompt**: Gourmet burger on wooden board, toasted brioche bun, melting cheddar cheese, crispy bacon, fresh lettuce, dripping sauce, food magazine style

**Criteria**:
- Toasted brioche bun visible
- Melting cheddar cheese
- Crispy bacon visible
- Fresh lettuce
- Dripping sauce
- Wooden board/surface
- Food magazine quality/styling

### 07-fashion (Fashion)
**Prompt**: Fashion model in oversized beige trench coat, standing on rainy Paris street at night, neon reflections on wet pavement, editorial Vogue style

**Criteria**:
- Oversized beige trench coat
- Rainy street setting
- Night atmosphere
- Neon reflections on wet pavement
- Paris street aesthetic
- Editorial/Vogue quality
- Fashion model pose/composition

### 08-wildlife (Wildlife)
**Prompt**: Majestic snow leopard resting on rocky mountain ledge, piercing blue-green eyes, thick spotted fur with snowflakes, golden hour backlighting

**Criteria**:
- Snow leopard accurately depicted
- Rocky mountain ledge setting
- Blue-green eyes
- Spotted fur pattern
- Snowflakes visible
- Golden hour backlighting
- Majestic/regal pose

### 09-abstract (Abstract)
**Prompt**: Fluid abstract painting with swirling navy blue and gold metallic tones, organic flowing shapes, high contrast, modern art gallery piece

**Criteria**:
- Navy blue tones present
- Gold metallic tones present
- Swirling/fluid movement
- Organic flowing shapes
- High contrast
- Abstract (non-representational)
- Gallery-quality appearance

### 10-scifi (Sci-Fi)
**Prompt**: Futuristic cyberpunk cityscape at night, massive holographic advertisements, flying vehicles between towering skyscrapers, rain-slicked streets with neon reflections

**Criteria**:
- Futuristic cityscape
- Night setting
- Holographic advertisements
- Flying vehicles
- Towering skyscrapers
- Rain-slicked streets
- Neon reflections
- Cyberpunk aesthetic

## Scoring Guide

| Score | Description |
|-------|-------------|
| 9-10 | Exceptional - All criteria met, professional quality |
| 7-8 | Good - Most criteria met, minor issues |
| 5-6 | Average - Some criteria met, noticeable issues |
| 3-4 | Poor - Few criteria met, significant issues |
| 1-2 | Failed - Criteria largely unmet, major problems |

## Output Format

```json
{
  "model_slug": "model-name",
  "prompt_id": "01-portrait",
  "quality_score": 8,
  "criteria_passed": [
    "Realistic skin texture",
    "Auburn hair color",
    "Navy blazer visible"
  ],
  "criteria_failed": [
    "Freckles not visible"
  ],
  "commentary": "Strong portrait with natural lighting, but freckles are missing."
}
```
