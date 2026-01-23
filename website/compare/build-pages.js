import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load data
const evaluations = JSON.parse(
  fs.readFileSync(path.join(__dirname, "evaluations.json"), "utf-8")
);
const generationResults = JSON.parse(
  fs.readFileSync(path.join(__dirname, "generation-results.json"), "utf-8")
);

// Model metadata
const MODELS = {
  "nano-banana-pro": {
    id: "fal-ai/nano-banana-pro",
    name: "Nano Banana Pro",
    shortName: "Nano Banana",
    maxRes: "4K (4096×4096)",
    cost: "$0.15",
    costNote: "per image",
    architecture: "Multimodal LLM",
    providers: "fal.ai, OpenRouter, Google AI",
    icon: `<svg width="14" height="14" viewBox="0 0 65 65" fill="currentColor"><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z"/></svg>`,
  },
  "flux2-turbo": {
    id: "fal-ai/flux-2/turbo",
    name: "FLUX.2 Turbo",
    shortName: "FLUX.2 Turbo",
    maxRes: "1K (1024×1024)",
    cost: "$0.008",
    costNote: "per megapixel",
    architecture: "Diffusion (Turbo)",
    providers: "fal.ai",
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M0 20.683L12.01 2.5 24 20.683h-2.233L12.009 5.878 3.471 18.806h12.122l1.239 1.877H0z"/></svg>`,
  },
  "flux2-klein-9b": {
    id: "fal-ai/flux-2/klein/9b",
    name: "FLUX.2 Klein 9B",
    shortName: "FLUX.2 Klein",
    maxRes: "1K (1024×1024)",
    cost: "$0.011",
    costNote: "per megapixel",
    architecture: "Diffusion (Klein)",
    providers: "fal.ai",
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M0 20.683L12.01 2.5 24 20.683h-2.233L12.009 5.878 3.471 18.806h12.122l1.239 1.877H0z"/></svg>`,
  },
  "gpt-image-1-5": {
    id: "fal-ai/gpt-image-1.5",
    name: "GPT-Image 1.5",
    shortName: "GPT-Image",
    maxRes: "1K (1024×1024)",
    cost: "$0.009–$0.20",
    costNote: "low–high quality",
    architecture: "Multimodal LLM",
    providers: "fal.ai, OpenAI",
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>`,
  },
  "seedream-v4-5": {
    id: "fal-ai/bytedance/seedream/v4.5",
    name: "Seedream v4.5",
    shortName: "Seedream",
    maxRes: "2K (2048×2048)",
    cost: "$0.04",
    costNote: "per image",
    architecture: "Diffusion",
    providers: "fal.ai",
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  },
  "z-image-turbo": {
    id: "fal-ai/z-image/turbo",
    name: "Z-Image Turbo",
    shortName: "Z-Image",
    maxRes: "1K (1024×1024)",
    cost: "$0.005",
    costNote: "per megapixel",
    architecture: "Diffusion (Turbo)",
    providers: "fal.ai",
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16l-8 8 8 8H4l8-8-8-8z"/></svg>`,
  },
};

const PROMPTS = [
  { id: "01-portrait", category: "Portrait", prompt: "Professional headshot of a 35-year-old woman with auburn hair, natural freckles, wearing a navy blazer, soft window lighting, shallow depth of field" },
  { id: "02-text", category: "Text Rendering", prompt: "Vintage coffee shop chalkboard menu with handwritten text 'DAILY SPECIALS' at the top, listing 'Espresso $3.50' and 'Cappuccino $4.75', rustic wooden frame" },
  { id: "03-product", category: "Product", prompt: "Luxury perfume bottle on white marble surface, dramatic rim lighting, crystal-clear glass with amber liquid inside, minimalist product photography" },
  { id: "04-architecture", category: "Architecture", prompt: "Modern minimalist living room with floor-to-ceiling windows overlooking city skyline at dusk, white sectional sofa, polished concrete floors" },
  { id: "05-fantasy", category: "Fantasy", prompt: "Mystical elven warrior with silver armor and flowing white cape, holding a glowing blue sword, standing in ancient forest with magical particles" },
  { id: "06-food", category: "Food", prompt: "Gourmet burger on wooden board, toasted brioche bun, melting cheddar cheese, crispy bacon, fresh lettuce, dripping sauce, food magazine style" },
  { id: "07-fashion", category: "Fashion", prompt: "Fashion model in oversized beige trench coat, standing on rainy Paris street at night, neon reflections on wet pavement, editorial Vogue style" },
  { id: "08-wildlife", category: "Wildlife", prompt: "Majestic snow leopard resting on rocky mountain ledge, piercing blue-green eyes, thick spotted fur with snowflakes, golden hour backlighting" },
  { id: "09-abstract", category: "Abstract", prompt: "Fluid abstract painting with swirling navy blue and gold metallic tones, organic flowing shapes, high contrast, modern art gallery piece" },
  { id: "10-scifi", category: "Sci-Fi", prompt: "Futuristic cyberpunk cityscape at night, massive holographic advertisements, flying vehicles between towering skyscrapers, rain-slicked streets with neon reflections" },
];

// Get timing for a model/prompt combo
function getTiming(modelSlug, promptId) {
  const result = generationResults.find(
    (r) => r.model_slug === modelSlug && r.prompt_id === promptId
  );
  return result ? result.generation_time_ms : 0;
}

// Get average timing for a model
function getAvgTiming(modelSlug) {
  const results = generationResults.filter((r) => r.model_slug === modelSlug);
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.generation_time_ms, 0);
  return Math.round(total / results.length);
}

// Get evaluation for a model/prompt
function getEvaluation(modelSlug, promptId) {
  const promptEvals = evaluations.evaluations[promptId];
  if (!promptEvals) return null;
  return promptEvals.find((e) => e.model_slug === modelSlug);
}

// Compare two models for a prompt - returns winner slug or null for tie
function getWinner(modelA, modelB, promptId) {
  const evalA = getEvaluation(modelA, promptId);
  const evalB = getEvaluation(modelB, promptId);
  if (!evalA || !evalB) return null;
  if (evalA.quality_score > evalB.quality_score) return modelA;
  if (evalB.quality_score > evalA.quality_score) return modelB;
  return null; // tie
}

// Generate all model pairs
function getAllPairs() {
  const models = Object.keys(MODELS);
  const pairs = [];
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      pairs.push([models[i], models[j]]);
    }
  }
  return pairs;
}

// Calculate comparison stats
function getComparisonStats(modelA, modelB) {
  let winsA = 0;
  let winsB = 0;
  const winners = {};

  for (const prompt of PROMPTS) {
    const winner = getWinner(modelA, modelB, prompt.id);
    winners[prompt.id] = winner;
    if (winner === modelA) winsA++;
    else if (winner === modelB) winsB++;
  }

  return {
    winsA,
    winsB,
    winners,
    avgSpeedA: getAvgTiming(modelA),
    avgSpeedB: getAvgTiming(modelB),
    textWinner: winners["02-text"],
    photoWinner: winners["01-portrait"],
  };
}

// Format time in seconds
function formatTime(ms) {
  return (ms / 1000).toFixed(1) + "s";
}

// Generate slug for comparison page
function getComparisonSlug(modelA, modelB) {
  return `${modelA}-vs-${modelB}`;
}

// Generate HTML for a comparison page
function generateComparisonPage(modelA, modelB) {
  const metaA = MODELS[modelA];
  const metaB = MODELS[modelB];
  const stats = getComparisonStats(modelA, modelB);
  const overallWinner = stats.winsA > stats.winsB ? modelA : stats.winsB > stats.winsA ? modelB : null;

  // Determine strengths
  const strengthsA = [];
  const strengthsB = [];

  if (stats.avgSpeedA < stats.avgSpeedB) strengthsA.push("Faster generation");
  else if (stats.avgSpeedB < stats.avgSpeedA) strengthsB.push("Faster generation");

  if (stats.photoWinner === modelA) strengthsA.push("Better photorealism");
  else if (stats.photoWinner === modelB) strengthsB.push("Better photorealism");

  if (stats.textWinner === modelA) strengthsA.push("Better text rendering");
  else if (stats.textWinner === modelB) strengthsB.push("Better text rendering");

  // Build prompt sections
  let promptSections = "";
  for (let i = 0; i < PROMPTS.length; i++) {
    const prompt = PROMPTS[i];
    const evalA = getEvaluation(modelA, prompt.id);
    const evalB = getEvaluation(modelB, prompt.id);
    const timeA = getTiming(modelA, prompt.id);
    const timeB = getTiming(modelB, prompt.id);
    const winner = stats.winners[prompt.id];

    const winnerBadge = winner
      ? `<span class="prompt-winner ${winner === modelA ? "winner-a" : "winner-b"}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          ${winner === modelA ? metaA.shortName : metaB.shortName} wins
        </span>`
      : `<span class="prompt-winner tie">Tie</span>`;

    promptSections += `
            <article class="prompt-item">
                <div class="prompt-header">
                    <div class="prompt-meta">
                        <span class="prompt-number">${String(i + 1).padStart(2, "0")}</span>
                        <span class="prompt-category">${prompt.category}</span>
                    </div>
                    ${winnerBadge}
                </div>

                <div class="prompt-text">${prompt.prompt}</div>

                <div class="comparison-grid">
                    <div class="comparison-card model-a">
                        <div class="image-container">
                            <img src="/compare/images/${modelA}/${prompt.id}.png" alt="${metaA.name} - ${prompt.category}" width="1024" height="1024"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>
                            <span class="result-badge ${winner === modelA ? "pass" : winner === modelB ? "fail" : "tie"}">
                                ${winner === modelA
                                  ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                                  : winner === modelB
                                    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
                                    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`}
                            </span>
                            ${winner === modelA ? `<span class="award-badge gold"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Winner</span>` : ""}
                        </div>
                        <div class="card-footer">
                            <div class="card-header-row">
                                <span class="card-model-name">${metaA.name}</span>
                                <span class="card-gen-time">${formatTime(timeA)}</span>
                            </div>
                            <p class="card-commentary">${evalA ? evalA.commentary : ""}</p>
                        </div>
                    </div>

                    <div class="comparison-card model-b">
                        <div class="image-container">
                            <img src="/compare/images/${modelB}/${prompt.id}.png" alt="${metaB.name} - ${prompt.category}" width="1024" height="1024"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>
                            <span class="result-badge ${winner === modelB ? "pass" : winner === modelA ? "fail" : "tie"}">
                                ${winner === modelB
                                  ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                                  : winner === modelA
                                    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
                                    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`}
                            </span>
                            ${winner === modelB ? `<span class="award-badge gold"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Winner</span>` : ""}
                        </div>
                        <div class="card-footer">
                            <div class="card-header-row">
                                <span class="card-model-name">${metaB.name}</span>
                                <span class="card-gen-time">${formatTime(timeB)}</span>
                            </div>
                            <p class="card-commentary">${evalB ? evalB.commentary : ""}</p>
                        </div>
                    </div>
                </div>
            </article>`;
  }

  // Generate related comparisons (other pages)
  const allPairs = getAllPairs();
  const currentSlug = getComparisonSlug(modelA, modelB);
  const otherPairs = allPairs
    .filter((p) => getComparisonSlug(p[0], p[1]) !== currentSlug)
    .slice(0, 3);

  let relatedLinks = otherPairs
    .map(
      ([a, b]) => `
                    <a href="/compare/${getComparisonSlug(a, b)}/" class="related-card">
                        <span>${MODELS[a].name} vs ${MODELS[b].name}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </a>`
    )
    .join("");

  relatedLinks += `
                    <a href="/compare/" class="related-card">
                        <span>View all comparisons</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </a>`;

  const html = `<!DOCTYPE html>
<html lang="en" class="dark">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- SEO Meta Tags -->
    <title>${metaA.name} vs ${metaB.name} | Side-by-Side AI Comparison</title>
    <meta name="description"
        content="Compare ${metaA.name} vs ${metaB.name} with 10 test prompts. See side-by-side AI images, speed benchmarks, and pricing to pick the best model.">
    <meta name="keywords" content="${metaA.name} vs ${metaB.name}, AI image generator comparison, best AI image model, text to image comparison">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://vmstudio.ai/compare/${getComparisonSlug(modelA, modelB)}/">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${metaA.name} vs ${metaB.name}: Complete AI Image Comparison">
    <meta property="og:description" content="10 test prompts with side-by-side results. Compare portraits, text rendering, landscapes, and more.">
    <meta property="og:url" content="https://vmstudio.ai/compare/${getComparisonSlug(modelA, modelB)}/">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${metaA.name} vs ${metaB.name}: AI Image Comparison">
    <meta name="twitter:description" content="10 test prompts, actual outputs, speed measurements.">

    <!-- Favicon -->
    <link rel="icon" href="/favicon.ico" sizes="48x48">
    <link rel="icon" type="image/svg+xml" href="/assets/logo.svg">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">

    <!-- Styles -->
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/compare/compare.css">

    <!-- Schema.org Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${metaA.name} vs ${metaB.name}: AI Image Model Comparison",
        "description": "${metaA.name} and ${metaB.name} compared with 10 test prompts and side-by-side outputs.",
        "image": {
            "@type": "ImageObject",
            "url": "https://vmstudio.ai/compare/images/${modelA}/01-portrait.png",
            "width": 1024,
            "height": 1024
        },
        "author": {
            "@type": "Organization",
            "name": "VM Studio",
            "url": "https://vmstudio.ai"
        },
        "publisher": {
            "@type": "Organization",
            "name": "VM Studio",
            "logo": {
                "@type": "ImageObject",
                "url": "https://vmstudio.ai/assets/logo.svg"
            }
        },
        "datePublished": "2026-01-20",
        "dateModified": "2026-01-20"
    }
    </script>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://vmstudio.ai/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Compare",
                "item": "https://vmstudio.ai/compare/"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": "${metaA.name} vs ${metaB.name}",
                "item": "https://vmstudio.ai/compare/${getComparisonSlug(modelA, modelB)}/"
            }
        ]
    }
    </script>
</head>

<body>
    <div class="compare-layout">
        <!-- Header -->
        <header class="compare-header">
            <a href="/" class="logo">
                <img src="/assets/logo.svg" alt="VM Studio Logo" width="24" height="24">
                <span>VM Studio</span>
            </a>
            <nav class="compare-nav">
                <a href="/#features">Features</a>
                <a href="/#models">Models</a>
                <a href="/compare/">All Comparisons</a>
                <a href="https://www.figma.com/community/plugin/1588675833256652136" target="_blank"
                    class="btn btn-sm btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"></path>
                        <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"></path>
                        <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"></path>
                        <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"></path>
                        <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"></path>
                    </svg>
                    Add to Figma
                </a>
            </nav>
        </header>

        <!-- Hero Section -->
        <section class="compare-hero">
            <nav class="breadcrumb" aria-label="Breadcrumb">
                <a href="/">Home</a>
                <span>/</span>
                <a href="/compare/">Compare</a>
                <span>/</span>
                <span aria-current="page">${metaA.name} vs ${metaB.name}</span>
            </nav>

            <h1 class="compare-title">${metaA.name} vs ${metaB.name}</h1>
            <p class="compare-subtitle">We ran both models through 10 prompts and measured the results. Below you'll find the actual outputs, generation times, and our notes on each.</p>

            <!-- Quick Verdict -->
            <div class="verdict-card">
                <div class="verdict-header">
                    <span class="verdict-label">Quick Verdict</span>
                    <div class="verdict-stats">
                        <span class="verdict-stat">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <rect x="7" y="7" width="3" height="9"></rect>
                                <rect x="14" y="7" width="3" height="5"></rect>
                            </svg>
                            10 prompts tested
                        </span>
                        <span class="verdict-stat">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            Jan 2026
                        </span>
                    </div>
                </div>
                <div class="verdict-content">
                    <div class="verdict-model">
                        <span class="model-badge model-a">
                            ${metaA.icon}
                            ${metaA.name}
                        </span>
                        <span class="verdict-strength">${strengthsA.length > 0 ? strengthsA.join(", ") : "Balanced performance"}</span>
                    </div>
                    <div class="verdict-model">
                        <span class="model-badge model-b">
                            ${metaB.icon}
                            ${metaB.name}
                        </span>
                        <span class="verdict-strength">${strengthsB.length > 0 ? strengthsB.join(", ") : "Balanced performance"}</span>
                    </div>
                </div>
                <div class="verdict-stats-bar">
                    <div class="stat-item">
                        <span class="stat-label">Winner Score</span>
                        <span class="stat-value">${stats.winsA}-${stats.winsB} ${overallWinner ? `<span class="${overallWinner === modelA ? "winner-a" : "winner-b"}">(${MODELS[overallWinner].shortName})</span>` : ""}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Avg Speed</span>
                        <span class="stat-value ${stats.avgSpeedA < stats.avgSpeedB ? "winner-a" : ""}">${metaA.shortName}: ${formatTime(stats.avgSpeedA)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Avg Speed</span>
                        <span class="stat-value ${stats.avgSpeedB < stats.avgSpeedA ? "winner-b" : ""}">${metaB.shortName}: ${formatTime(stats.avgSpeedB)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Best at Text</span>
                        <span class="stat-value ${stats.textWinner === modelA ? "winner-a" : stats.textWinner === modelB ? "winner-b" : ""}">${stats.textWinner ? MODELS[stats.textWinner].shortName : "Tie"}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Best at Photos</span>
                        <span class="stat-value ${stats.photoWinner === modelA ? "winner-a" : stats.photoWinner === modelB ? "winner-b" : ""}">${stats.photoWinner ? MODELS[stats.photoWinner].shortName : "Tie"}</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- Visual Comparison Gallery -->
        <section class="compare-gallery" id="gallery">
            <div class="gallery-intro">
                <h2>The 10 test prompts</h2>
                <p>Same prompt, same settings (1024×1024, default parameters). Different model.</p>
            </div>
${promptSections}
        </section>

        <!-- Feature Comparison Table -->
        <section class="compare-features" id="features">
            <div class="section-header">
                <h2>Specs</h2>
                <p>What each model can do.</p>
            </div>

            <div class="feature-table">
                <div class="table-header">
                    <span>Feature</span>
                    <span>${metaA.name}</span>
                    <span>${metaB.name}</span>
                </div>

                <div class="table-row">
                    <span class="feature-name">Text-to-Image</span>
                    <span class="col-value"><span class="check">Yes</span></span>
                    <span class="col-value"><span class="check">Yes</span></span>
                </div>

                <div class="table-row">
                    <span class="feature-name">Image-to-Image</span>
                    <span class="col-value"><span class="check">Yes</span></span>
                    <span class="col-value"><span class="check">Yes</span></span>
                </div>

                <div class="table-row">
                    <span class="feature-name">Max Resolution</span>
                    <span class="col-value">${metaA.maxRes}</span>
                    <span class="col-value">${metaB.maxRes}</span>
                </div>

                <div class="table-row">
                    <span class="feature-name">Average Speed</span>
                    <span class="col-value ${stats.avgSpeedA < stats.avgSpeedB ? "highlight" : ""}">${formatTime(stats.avgSpeedA)}</span>
                    <span class="col-value ${stats.avgSpeedB < stats.avgSpeedA ? "highlight" : ""}">${formatTime(stats.avgSpeedB)}</span>
                </div>

                <div class="table-row">
                    <div>
                        <span class="feature-name">Cost</span>
                        <span class="feature-note">via fal.ai</span>
                    </div>
                    <span class="col-value">${metaA.cost}<br><small>${metaA.costNote}</small></span>
                    <span class="col-value">${metaB.cost}<br><small>${metaB.costNote}</small></span>
                </div>

                <div class="table-row">
                    <span class="feature-name">Architecture</span>
                    <span class="col-value">${metaA.architecture}</span>
                    <span class="col-value">${metaB.architecture}</span>
                </div>

                <div class="table-row">
                    <span class="feature-name">Providers</span>
                    <span class="col-value">${metaA.providers}</span>
                    <span class="col-value">${metaB.providers}</span>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="compare-cta">
            <div class="cta-card">
                <h2>Use both models in VM Studio</h2>
                <p>Install VM Studio and compare ${metaA.name} vs ${metaB.name} on your own prompts.</p>
                <a href="https://www.figma.com/community/plugin/1588675833256652136" target="_blank"
                    class="btn btn-primary btn-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"></path>
                        <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"></path>
                        <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"></path>
                        <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"></path>
                        <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"></path>
                    </svg>
                    Add to Figma
                </a>
            </div>

            <!-- Related Comparisons -->
            <div class="related-comparisons">
                <h3>More Model Comparisons</h3>
                <div class="related-grid">
${relatedLinks}
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="compare-footer">
            <div class="footer-content">
                <a href="/" class="logo">
                    <img src="/assets/logo.svg" alt="VM Studio Logo" width="24" height="24">
                    <span>VM Studio</span>
                </a>
                <div class="footer-links">
                    <a href="/#features">Features</a>
                    <a href="/#models">Models</a>
                    <a href="/compare/">Compare</a>
                    <a href="https://www.figma.com/community/plugin/1588675833256652136" target="_blank">Figma</a>
                </div>
                <span class="copyright">© 2026 VM Studio</span>
            </div>
        </footer>
    </div>
</body>

</html>`;

  return html;
}

// Generate sitemap.xml
function generateSitemap(pairs) {
  const urls = [
    // Hub page
    `  <url>
    <loc>https://vmstudio.ai/compare/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`,
    // Comparison pages
    ...pairs.map(
      ([modelA, modelB]) => `  <url>
    <loc>https://vmstudio.ai/compare/${getComparisonSlug(modelA, modelB)}/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// Main execution
function main() {
  const pairs = getAllPairs();
  console.log(`Generating ${pairs.length} comparison pages...`);

  for (const [modelA, modelB] of pairs) {
    const slug = getComparisonSlug(modelA, modelB);
    const dir = path.join(__dirname, slug);

    // Create directory
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Generate and write HTML
    const html = generateComparisonPage(modelA, modelB);
    fs.writeFileSync(path.join(dir, "index.html"), html);

    const stats = getComparisonStats(modelA, modelB);
    console.log(`  ✓ ${slug}/ (${stats.winsA}-${stats.winsB})`);
  }

  // Generate sitemap
  const sitemap = generateSitemap(pairs);
  fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap);
  console.log(`  ✓ sitemap.xml (${pairs.length + 1} URLs)`);

  console.log(`\nDone! Generated ${pairs.length} comparison pages + sitemap.`);
}

main();
