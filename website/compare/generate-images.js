import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FAL_API_KEY =
  "REDACTED_KEY";
const FAL_BASE_URL = "https://fal.run";

const MODELS = [
  { id: "fal-ai/nano-banana-pro", slug: "nano-banana-pro" },
  { id: "fal-ai/flux-2/turbo", slug: "flux2-turbo" },
  { id: "fal-ai/flux-2/klein/9b", slug: "flux2-klein-9b" },
  { id: "fal-ai/gpt-image-1.5", slug: "gpt-image-1-5" },
  { id: "fal-ai/bytedance/seedream/v4.5", slug: "seedream-v4-5" },
  { id: "fal-ai/z-image/turbo", slug: "z-image-turbo" },
];

const PROMPTS = [
  {
    id: "01-portrait",
    category: "Portrait",
    prompt:
      "Professional headshot of a 35-year-old woman with auburn hair, natural freckles, wearing a navy blazer, soft window lighting, shallow depth of field",
  },
  {
    id: "02-text",
    category: "Text Rendering",
    prompt:
      "Vintage coffee shop chalkboard menu with handwritten text 'DAILY SPECIALS' at the top, listing 'Espresso $3.50' and 'Cappuccino $4.75', rustic wooden frame",
  },
  {
    id: "03-product",
    category: "Product",
    prompt:
      "Luxury perfume bottle on white marble surface, dramatic rim lighting, crystal-clear glass with amber liquid inside, minimalist product photography",
  },
  {
    id: "04-architecture",
    category: "Architecture",
    prompt:
      "Modern minimalist living room with floor-to-ceiling windows overlooking city skyline at dusk, white sectional sofa, polished concrete floors",
  },
  {
    id: "05-fantasy",
    category: "Fantasy",
    prompt:
      "Mystical elven warrior with silver armor and flowing white cape, holding a glowing blue sword, standing in ancient forest with magical particles",
  },
  {
    id: "06-food",
    category: "Food",
    prompt:
      "Gourmet burger on wooden board, toasted brioche bun, melting cheddar cheese, crispy bacon, fresh lettuce, dripping sauce, food magazine style",
  },
  {
    id: "07-fashion",
    category: "Fashion",
    prompt:
      "Fashion model in oversized beige trench coat, standing on rainy Paris street at night, neon reflections on wet pavement, editorial Vogue style",
  },
  {
    id: "08-wildlife",
    category: "Wildlife",
    prompt:
      "Majestic snow leopard resting on rocky mountain ledge, piercing blue-green eyes, thick spotted fur with snowflakes, golden hour backlighting",
  },
  {
    id: "09-abstract",
    category: "Abstract",
    prompt:
      "Fluid abstract painting with swirling navy blue and gold metallic tones, organic flowing shapes, high contrast, modern art gallery piece",
  },
  {
    id: "10-scifi",
    category: "Sci-Fi",
    prompt:
      "Futuristic cyberpunk cityscape at night, massive holographic advertisements, flying vehicles between towering skyscrapers, rain-slicked streets with neon reflections",
  },
];

function buildRequestBody(modelId, prompt) {
  const base = {
    prompt,
    num_images: 1,
    output_format: "png",
    sync_mode: true,
  };

  if (modelId.includes("flux-2")) {
    return { ...base, image_size: { width: 1024, height: 1024 } };
  } else if (modelId.includes("gpt-image")) {
    return { ...base, image_size: "1024x1024", quality: "high" };
  } else if (modelId.includes("z-image")) {
    return {
      ...base,
      image_size: { width: 1024, height: 1024 },
      num_inference_steps: 8,
    };
  } else if (modelId.includes("seedream")) {
    return { ...base, image_size: { width: 1024, height: 1024 } };
  } else {
    // Nano Banana Pro and others
    return { ...base, aspect_ratio: "1:1", resolution: "1K" };
  }
}

function getEndpoint(modelId) {
  if (modelId.includes("seedream")) {
    return `${FAL_BASE_URL}/${modelId}/text-to-image`;
  }
  return `${FAL_BASE_URL}/${modelId}`;
}

async function generateImage(modelId, prompt) {
  const endpoint = getEndpoint(modelId);
  const body = buildRequestBody(modelId, prompt);

  const startTime = performance.now();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${FAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const endTime = performance.now();
  const duration_ms = Math.round(endTime - startTime);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || error.message || `HTTP ${response.status}`
    );
  }

  const data = await response.json();
  const imageUrl = data.images[0].url;

  // Download image
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  return { imageBuffer, duration_ms };
}

async function main() {
  const results = [];
  const imagesDir = path.join(__dirname, "images");

  // Ensure base images directory exists
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  let processed = 0;
  const total = MODELS.length * PROMPTS.length;

  for (const model of MODELS) {
    // Create model directory
    const modelDir = path.join(imagesDir, model.slug);
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    for (const promptData of PROMPTS) {
      processed++;
      console.log(
        `[${processed}/${total}] ${model.slug} - ${promptData.category}...`
      );

      try {
        const { imageBuffer, duration_ms } = await generateImage(
          model.id,
          promptData.prompt
        );

        const imagePath = path.join(modelDir, `${promptData.id}.png`);
        fs.writeFileSync(imagePath, imageBuffer);

        const result = {
          model_id: model.id,
          model_slug: model.slug,
          prompt_id: promptData.id,
          prompt_category: promptData.category,
          prompt_text: promptData.prompt,
          generation_time_ms: duration_ms,
          image_path: `images/${model.slug}/${promptData.id}.png`,
          success: true,
        };

        results.push(result);
        console.log(`  ✓ ${duration_ms}ms - saved to ${result.image_path}`);

        // Save results after each generation (in case of interruption)
        fs.writeFileSync(
          path.join(__dirname, "generation-results.json"),
          JSON.stringify(results, null, 2)
        );

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ✗ Failed: ${error.message}`);
        results.push({
          model_id: model.id,
          model_slug: model.slug,
          prompt_id: promptData.id,
          prompt_category: promptData.category,
          prompt_text: promptData.prompt,
          generation_time_ms: 0,
          image_path: null,
          success: false,
          error: error.message,
        });

        // Save results even on failure
        fs.writeFileSync(
          path.join(__dirname, "generation-results.json"),
          JSON.stringify(results, null, 2)
        );
      }
    }
  }

  console.log("\n=== Generation Complete ===");
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`Success: ${successful}/${total}`);
  console.log(`Failed: ${failed}/${total}`);

  // Calculate average times per model
  console.log("\nAverage generation times:");
  for (const model of MODELS) {
    const modelResults = results.filter(
      (r) => r.model_slug === model.slug && r.success
    );
    if (modelResults.length > 0) {
      const avgTime =
        modelResults.reduce((sum, r) => sum + r.generation_time_ms, 0) /
        modelResults.length;
      console.log(`  ${model.slug}: ${Math.round(avgTime)}ms`);
    }
  }

  console.log(`\nResults saved to generation-results.json`);
}

main().catch(console.error);
