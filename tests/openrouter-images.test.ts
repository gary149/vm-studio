/**
 * Integration + registry tests for the OpenRouter Images API models:
 * Seedream v4.5, Krea 2 Large/Medium/Turbo, GPT-Image 2 (direct model),
 * and the GA (non-preview) Nano Banana chat models.
 *
 * Run via: node scripts/run-openrouter-images-test.mjs
 *
 * Network tests hit the real OpenRouter API using OPENROUTER_API_KEY from
 * .env.local (authorized per CLAUDE.md).
 */
import {
  PROVIDERS,
  MIGRATED_MODEL_IDS,
  getApiModelId,
  getAllModels,
  getUniqueModelNames,
  getProvidersForModelName,
  modelSupportsImageToImage,
  getModelSupportedImageSizes,
  modelUsesImagesApi,
} from "../src/providers/index";
import { generateWithOpenRouter } from "../src/providers/openrouter";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? ` -- ${detail}` : ""));
    console.log(`  ✗ ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const SEEDREAM_ID = "bytedance-seed/seedream-4.5";
const KREA_LARGE_ID = "krea/krea-2-large";
const KREA_MEDIUM_ID = "krea/krea-2-medium";
const KREA_TURBO_ID = "krea/krea-2-medium-turbo";
const GPT_IMAGE_2_ID = "openrouter/openai/gpt-image-2";
const GPT_IMAGE_2_SLUG = "openai/gpt-image-2";
const NB2_ID = "google/gemini-3.1-flash-image";
const NB_PRO_ID = "google/gemini-3-pro-image";

const IMAGES_URL = "https://openrouter.ai/api/v1/images";
const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// 1x1 red PNG (valid base64 payload for reference-image requests)
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function isPng(data: Uint8Array): boolean {
  return (
    data.length > 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  );
}
function isJpeg(data: Uint8Array): boolean {
  return data.length > 3 && data[0] === 0xff && data[1] === 0xd8;
}

// ---- Capturing fetch wrapper: records outgoing requests, delegates to real fetch ----
interface Captured {
  url: string;
  method: string;
  body: any;
}
const realFetch = globalThis.fetch.bind(globalThis);
let captured: Captured[] = [];
function installCapture() {
  captured = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    const method = init?.method || "GET";
    let body: any = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        /* leave as-is */
      }
    }
    captured.push({ url, method, body });
    return realFetch(input, init);
  }) as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}
function genRequest(): Captured | undefined {
  return captured.find(
    (c) => c.method === "POST" && /openrouter\.ai/.test(c.url),
  );
}

async function main() {
  const OR_KEY = process.env.OPENROUTER_API_KEY || "";

  console.log("\n=== 1. Registry / config assertions (no network) ===");

  const or = PROVIDERS.openrouter.models;
  const byId = (id: string) => or.find((m) => m.id === id);

  // New Images API models exist with the expected shape
  const seedream = byId(SEEDREAM_ID);
  check("OpenRouter registry has Seedream v4.5", !!seedream);
  check(
    "Seedream: name matches Fal entry for provider grouping",
    seedream?.name === "Seedream v4.5",
  );
  check("Seedream: i2i supported", seedream?.supportsImageToImage === true);
  check(
    "Seedream: 1K/2K/4K tiers",
    JSON.stringify(seedream?.supportedImageSizes) ===
      JSON.stringify(["1K", "2K", "4K"]),
  );

  for (const [id, name] of [
    [KREA_LARGE_ID, "Krea 2 Large"],
    [KREA_MEDIUM_ID, "Krea 2 Medium"],
    [KREA_TURBO_ID, "Krea 2 Turbo"],
  ] as const) {
    const m = byId(id);
    check(`OpenRouter registry has ${name} (${id})`, !!m);
    check(`${name}: name matches Fal entry`, m?.name === name);
    check(`${name}: i2i supported (one reference)`, m?.supportsImageToImage === true);
    check(
      `${name}: single 1K tier`,
      JSON.stringify(m?.supportedImageSizes) === JSON.stringify(["1K"]),
    );
  }

  const gptImage2 = byId(GPT_IMAGE_2_ID);
  check("OpenRouter GPT-Image 2 uses the direct model id", !!gptImage2);
  check(
    "OpenRouter GPT-Image 2: old chat-wrapper id removed",
    !byId("openai/gpt-5.4-image-2"),
  );
  check(
    "OpenRouter GPT-Image 2: single 1K tier (no resolution param)",
    JSON.stringify(gptImage2?.supportedImageSizes) === JSON.stringify(["1K"]),
  );

  // GA banana ids (previews replaced)
  check("Nano Banana 2 uses GA id", !!byId(NB2_ID));
  check("Nano Banana Pro uses GA id", !!byId(NB_PRO_ID));
  check(
    "No '-preview' ids remain in the OpenRouter registry",
    or.every((m) => !m.id.includes("-preview")),
    or.map((m) => m.id).join(","),
  );

  // Images API routing flags
  for (const id of [
    SEEDREAM_ID,
    KREA_LARGE_ID,
    KREA_MEDIUM_ID,
    KREA_TURBO_ID,
    GPT_IMAGE_2_ID,
    "openrouter/microsoft/mai-image-2.5",
  ]) {
    check(`modelUsesImagesApi('${id}') === true`, modelUsesImagesApi(id) === true);
  }
  for (const id of [NB2_ID, NB_PRO_ID, "google/gemini-3.1-flash-lite-image"]) {
    check(
      `modelUsesImagesApi('${id}') === false (chat completions)`,
      modelUsesImagesApi(id) === false,
    );
  }

  // No apiModelId overrides needed: internal ids ARE the OpenRouter slugs
  for (const id of [SEEDREAM_ID, KREA_LARGE_ID, KREA_TURBO_ID]) {
    check(`getApiModelId('${id}') falls through to id`, getApiModelId(id) === id);
  }
  // GPT-Image 2 shares its slug with the Fal entry, so the OpenRouter id is
  // prefixed and resolves through apiModelId
  check(
    `getApiModelId('${GPT_IMAGE_2_ID}') === '${GPT_IMAGE_2_SLUG}'`,
    getApiModelId(GPT_IMAGE_2_ID) === GPT_IMAGE_2_SLUG,
    getApiModelId(GPT_IMAGE_2_ID),
  );

  // Global uniqueness across all providers
  const allIds = getAllModels().map((m) => m.id);
  const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  check("All model internal ids are globally unique", dupes.length === 0, dupes.join(","));

  // Provider grouping in the model picker
  const groupings: Array<[string, string]> = [
    ["Seedream v4.5", "fal,openrouter"],
    ["Krea 2 Large", "fal,openrouter"],
    ["Krea 2 Medium", "fal,openrouter"],
    ["Krea 2 Turbo", "fal,openrouter"],
    ["GPT-Image 2", "fal,openai,openrouter"],
    ["Nano Banana 2", "fal,gemini,openrouter"],
  ];
  for (const [name, expected] of groupings) {
    check(
      `'${name}' appears once in unique model names`,
      getUniqueModelNames().filter((n) => n === name).length === 1,
    );
    const providers = getProvidersForModelName(name)
      .map((p) => p.providerId)
      .sort()
      .join(",");
    check(`'${name}' offered by [${expected}]`, providers === expected, providers);
  }

  // Persisted-settings migration map: every replaced id maps to a live entry
  const migrationEntries = Object.entries(MIGRATED_MODEL_IDS);
  check("Migration map covers the three replaced ids", migrationEntries.length === 3);
  for (const [oldId, newId] of migrationEntries) {
    check(
      `Migration source '${oldId}' is no longer registered`,
      !getAllModels().some((m) => m.id === oldId),
    );
    check(
      `Migration target '${newId}' exists in the registry`,
      getAllModels().some((m) => m.id === newId),
    );
  }

  // i2i capability lookups by id
  check(
    "modelSupportsImageToImage(seedream OR) === true",
    modelSupportsImageToImage(SEEDREAM_ID) === true,
  );
  check(
    "modelSupportsImageToImage(krea large OR) === true",
    modelSupportsImageToImage(KREA_LARGE_ID) === true,
  );
  check(
    "Fal Krea entries stay t2i-only",
    modelSupportsImageToImage("krea/v2/large/text-to-image") === false &&
      modelSupportsImageToImage("fal-ai/krea-2/turbo") === false,
  );

  console.log("\n=== 2. Single-reference guard (no network) ===");
  {
    installCapture();
    const res = await generateWithOpenRouter({
      prompt: "combine these",
      providerId: "openrouter",
      modelId: KREA_LARGE_ID,
      apiKey: OR_KEY || "test-key",
      aspectRatio: "auto",
      imageSize: "1K",
      inputImages: [TINY_PNG_B64, TINY_PNG_B64],
    });
    const req = genRequest();
    restoreFetch();

    check("Krea with 2 input images fails fast", res.success === false);
    check(
      "Krea multi-input error mentions single input image",
      (res.error || "").includes("single input image"),
      res.error,
    );
    check("Krea multi-input sends no network request", req === undefined);
  }

  console.log("\n=== 3. Live request shape + generation (Images API) ===");
  if (!OR_KEY) {
    console.log("  ! OPENROUTER_API_KEY missing - skipping live tests");
  } else {
    // --- Krea Turbo t2i with an aspect ratio Krea does NOT accept (21:9):
    //     must snap to 16:9 client-side or OpenRouter returns HTTP 400.
    {
      installCapture();
      const res = await generateWithOpenRouter({
        prompt: "a red bicycle leaning on a brick wall, golden hour",
        providerId: "openrouter",
        modelId: KREA_TURBO_ID,
        apiKey: OR_KEY,
        aspectRatio: "21:9",
        imageSize: "1K",
      });
      const req = genRequest();
      restoreFetch();

      check("Krea Turbo posts to /api/v1/images", req?.url === IMAGES_URL, req?.url);
      check(
        "Krea Turbo snaps unsupported 21:9 to 16:9",
        req?.body?.aspect_ratio === "16:9",
        JSON.stringify(req?.body?.aspect_ratio),
      );
      check(
        "Krea Turbo omits resolution (single 1K tier)",
        req?.body && !("resolution" in req.body),
      );
      check("Krea Turbo [21:9] generation succeeded", res.success === true, res.error);
      if (res.success && res.imageData) {
        check(
          `Krea Turbo returned a real image (${res.imageData.length} bytes, mime=${res.mimeType})`,
          (isPng(res.imageData) || isJpeg(res.imageData)) && res.imageData.length > 1000,
        );
      }
    }

    // --- Krea Medium t2i with a supported ratio passes through unchanged
    {
      installCapture();
      const res = await generateWithOpenRouter({
        prompt: "a ceramic mug on a wooden desk, soft window light",
        providerId: "openrouter",
        modelId: KREA_MEDIUM_ID,
        apiKey: OR_KEY,
        aspectRatio: "4:5",
        imageSize: "1K",
      });
      const req = genRequest();
      restoreFetch();

      check(
        "Krea Medium passes supported 4:5 through unchanged",
        req?.body?.aspect_ratio === "4:5",
        JSON.stringify(req?.body?.aspect_ratio),
      );
      check("Krea Medium [4:5] generation succeeded", res.success === true, res.error);
    }

    // --- Krea Large i2i with one reference image
    {
      installCapture();
      const res = await generateWithOpenRouter({
        prompt: "recolor this to a deep blue, keep everything else",
        providerId: "openrouter",
        modelId: KREA_LARGE_ID,
        apiKey: OR_KEY,
        aspectRatio: "auto",
        imageSize: "1K",
        inputImages: [TINY_PNG_B64],
      });
      const req = genRequest();
      restoreFetch();

      const refs = req?.body?.input_references;
      check(
        "Krea Large i2i sends one input_references entry",
        Array.isArray(refs) && refs.length === 1,
        JSON.stringify(refs)?.slice(0, 120),
      );
      check(
        "Krea Large i2i reference is a base64 data URL",
        refs?.[0]?.type === "image_url" &&
          typeof refs?.[0]?.image_url?.url === "string" &&
          refs[0].image_url.url.startsWith("data:image/png;base64,"),
      );
      check(
        "Krea Large i2i omits aspect_ratio for 'auto'",
        req?.body && !("aspect_ratio" in req.body),
      );
      check("Krea Large i2i generation succeeded", res.success === true, res.error);
    }

    // --- Seedream t2i at 2K with 21:9 (both supported natively)
    {
      installCapture();
      const res = await generateWithOpenRouter({
        prompt: "a wide cinematic desert landscape at dusk, film grain",
        providerId: "openrouter",
        modelId: SEEDREAM_ID,
        apiKey: OR_KEY,
        aspectRatio: "21:9",
        imageSize: "2K",
      });
      const req = genRequest();
      restoreFetch();

      check("Seedream posts to /api/v1/images", req?.url === IMAGES_URL, req?.url);
      check(
        "Seedream sends resolution '2K'",
        req?.body?.resolution === "2K",
        JSON.stringify(req?.body?.resolution),
      );
      check(
        "Seedream passes native 21:9 through unchanged",
        req?.body?.aspect_ratio === "21:9",
        JSON.stringify(req?.body?.aspect_ratio),
      );
      check("Seedream [2K 21:9] generation succeeded", res.success === true, res.error);
      if (res.success && res.imageData) {
        check(
          `Seedream returned a real image (${res.imageData.length} bytes, mime=${res.mimeType})`,
          (isPng(res.imageData) || isJpeg(res.imageData)) && res.imageData.length > 10000,
        );
      }
    }

    // --- GPT-Image 2 t2i with 5:4 (unsupported: snaps to 4:3)
    {
      installCapture();
      const res = await generateWithOpenRouter({
        prompt: "a minimal product photo of white sneakers on gray",
        providerId: "openrouter",
        modelId: GPT_IMAGE_2_ID,
        apiKey: OR_KEY,
        aspectRatio: "5:4",
        imageSize: "1K",
      });
      const req = genRequest();
      restoreFetch();

      check("GPT-Image 2 posts to /api/v1/images", req?.url === IMAGES_URL, req?.url);
      check(
        `GPT-Image 2 body.model === '${GPT_IMAGE_2_SLUG}' (resolved api slug)`,
        req?.body?.model === GPT_IMAGE_2_SLUG,
        req?.body?.model,
      );
      check(
        "GPT-Image 2 snaps unsupported 5:4 to 4:3",
        req?.body?.aspect_ratio === "4:3",
        JSON.stringify(req?.body?.aspect_ratio),
      );
      check("GPT-Image 2 generation succeeded", res.success === true, res.error);
      if (res.success && res.imageData) {
        check(
          `GPT-Image 2 returned a real image (${res.imageData.length} bytes, mime=${res.mimeType})`,
          (isPng(res.imageData) || isJpeg(res.imageData)) && res.imageData.length > 1000,
        );
      }
    }

    // --- GA Nano Banana 2 still rides chat completions with the new id
    {
      installCapture();
      const res = await generateWithOpenRouter({
        prompt: "a tiny robot watering a sunflower, illustration",
        providerId: "openrouter",
        modelId: NB2_ID,
        apiKey: OR_KEY,
        aspectRatio: "16:9",
        imageSize: "1K",
      });
      const req = genRequest();
      restoreFetch();

      check("Nano Banana 2 posts to /chat/completions", req?.url === CHAT_URL, req?.url);
      check("Nano Banana 2 body.model uses the GA id", req?.body?.model === NB2_ID);
      check(
        "Nano Banana 2 requests modalities ['text','image']",
        JSON.stringify(req?.body?.modalities) === JSON.stringify(["text", "image"]),
        JSON.stringify(req?.body?.modalities),
      );
      check(
        "Nano Banana 2 sends image_config {aspect_ratio, image_size}",
        req?.body?.image_config?.aspect_ratio === "16:9" &&
          req?.body?.image_config?.image_size === "1K",
        JSON.stringify(req?.body?.image_config),
      );
      check("Nano Banana 2 (GA) generation succeeded", res.success === true, res.error);
      if (res.success && res.imageData) {
        check(
          `Nano Banana 2 returned a real image (${res.imageData.length} bytes, mime=${res.mimeType})`,
          (isPng(res.imageData) || isJpeg(res.imageData)) && res.imageData.length > 1000,
        );
      }
    }
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
