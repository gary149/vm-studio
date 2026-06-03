/**
 * Integration + registry tests for Microsoft MAI-Image-2.5 support.
 *
 * Run via: node scripts/run-mai-test.mjs  (bundles this with esbuild, then runs)
 *
 * Network tests hit the real Fal.ai and OpenRouter APIs using keys from
 * .env.local (authorized per CLAUDE.md).
 */
import {
  PROVIDERS,
  getApiModelId,
  getAllModels,
  getUniqueModelNames,
  getProvidersForModelName,
  modelSupportsImageToImage,
  getModelSupportedImageSizes,
  getOutputModalities,
} from "../src/providers/index";
import { generateWithFal } from "../src/providers/fal";
import { generateWithOpenRouter } from "../src/providers/openrouter";
import type { AspectRatio } from "../src/types";

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

const FAL_ID = "microsoft/mai-image-2.5";
const OR_ID = "openrouter/microsoft/mai-image-2.5";
const API_SLUG = "microsoft/mai-image-2.5";

// PNG magic bytes
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
function isWebp(data: Uint8Array): boolean {
  return (
    data.length > 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  );
}

// ---- Capturing fetch wrapper: records outgoing requests, delegates to real fetch ----
interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
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
    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers)) {
        headers[k.toLowerCase()] = String(v);
      }
    }
    captured.push({ url, method, headers, body });
    return realFetch(input, init);
  }) as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}
// The first captured request is the generation POST (subsequent ones may be
// image downloads when the API returns a URL rather than inline data).
function genRequest(): Captured | undefined {
  return captured.find(
    (c) => c.method === "POST" && /fal\.run|openrouter\.ai/.test(c.url),
  );
}

async function main() {
  const FAL_KEY = process.env.FAL_API_KEY || "";
  const OR_KEY = process.env.OPENROUTER_API_KEY || "";

  console.log("\n=== 1. Registry / config assertions (no network) ===");

  const falModel = PROVIDERS.fal.models.find((m) => m.id === FAL_ID);
  const orModel = PROVIDERS.openrouter.models.find((m) => m.id === OR_ID);

  check("Fal registry has MAI entry", !!falModel);
  check("OpenRouter registry has MAI entry", !!orModel);
  check(
    "Both MAI entries share display name 'MAI-Image 2.5'",
    falModel?.name === "MAI-Image 2.5" && orModel?.name === "MAI-Image 2.5",
  );
  check("Fal MAI: t2i supported", falModel?.supportsImageGeneration === true);
  check(
    "Fal MAI: i2i NOT supported (no /edit endpoint)",
    falModel?.supportsImageToImage === false,
  );
  check(
    "OpenRouter MAI: i2i NOT supported (text input only)",
    orModel?.supportsImageToImage === false,
  );
  check(
    "Fal MAI: single 1K size tier",
    JSON.stringify(falModel?.supportedImageSizes) === JSON.stringify(["1K"]),
  );

  // Uniqueness of internal ids across the whole registry
  const allIds = getAllModels().map((m) => m.id);
  const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  check("All model internal ids are globally unique", dupes.length === 0, dupes.join(","));

  // apiModelId resolution
  check(
    `getApiModelId('${FAL_ID}') === '${API_SLUG}'`,
    getApiModelId(FAL_ID) === API_SLUG,
    getApiModelId(FAL_ID),
  );
  check(
    `getApiModelId('${OR_ID}') === '${API_SLUG}'`,
    getApiModelId(OR_ID) === API_SLUG,
    getApiModelId(OR_ID),
  );
  check(
    "getApiModelId falls back to id for normal models",
    getApiModelId("fal-ai/nano-banana-2") === "fal-ai/nano-banana-2",
  );

  // Provider picker disambiguation: one model name, two distinct-id providers
  check(
    "'MAI-Image 2.5' appears once in unique model names",
    getUniqueModelNames().filter((n) => n === "MAI-Image 2.5").length === 1,
  );
  const maiProviders = getProvidersForModelName("MAI-Image 2.5");
  check("MAI-Image 2.5 offered by exactly 2 providers", maiProviders.length === 2, String(maiProviders.length));
  check(
    "MAI provider option ids are distinct (picker can select either)",
    maiProviders[0]?.id !== maiProviders[1]?.id,
  );
  check(
    "MAI providers are fal + openrouter",
    maiProviders.map((p) => p.providerId).sort().join(",") === "fal,openrouter",
  );

  // by-id lookups resolve per-provider correctly
  check("modelSupportsImageToImage(FAL_ID) === false", modelSupportsImageToImage(FAL_ID) === false);
  check("modelSupportsImageToImage(OR_ID) === false", modelSupportsImageToImage(OR_ID) === false);
  check(
    "getModelSupportedImageSizes(OR_ID) === ['1K']",
    JSON.stringify(getModelSupportedImageSizes(OR_ID)) === JSON.stringify(["1K"]),
  );
  check(
    "getOutputModalities(OR_ID) === ['image']",
    JSON.stringify(getOutputModalities(OR_ID)) === JSON.stringify(["image"]),
  );
  check(
    "getOutputModalities(normal OR model) defaults to ['text','image']",
    JSON.stringify(getOutputModalities("google/gemini-3.1-flash-image-preview")) ===
      JSON.stringify(["text", "image"]),
  );

  // ---- Request-body shape (capture without a key -> generator returns early, so
  //      we capture WITH key but assert on the body that goes out for Fal) ----
  console.log("\n=== 2. Fal request body shape (live) ===");
  if (!FAL_KEY) {
    console.log("  ! FAL_API_KEY missing - skipping Fal body + generation tests");
  } else {
    for (const ar of ["auto", "16:9", "1:1"] as AspectRatio[]) {
      installCapture();
      const res = await generateWithFal({
        prompt: "a single red apple on a white background, studio photo",
        providerId: "fal",
        modelId: FAL_ID,
        apiKey: FAL_KEY,
        aspectRatio: ar,
        imageSize: "1K",
      });
      const req = genRequest();
      restoreFetch();

      check(
        `Fal[${ar}] POSTs to /${API_SLUG} (resolved api slug, not internal id)`,
        req?.url === `https://fal.run/${API_SLUG}`,
        req?.url,
      );
      check(
        `Fal[${ar}] does NOT hit /edit (t2i only)`,
        !!req && !req.url.includes("/edit"),
      );
      check(
        `Fal[${ar}] body.aspect_ratio === '${ar}'`,
        req?.body?.aspect_ratio === ar,
        JSON.stringify(req?.body),
      );
      check(
        `Fal[${ar}] body omits unsupported 'resolution' param`,
        req?.body && !("resolution" in req.body),
      );
      check(
        `Fal[${ar}] body omits unsupported 'image_size' param`,
        req?.body && !("image_size" in req.body),
      );
      check(
        `Fal[${ar}] body has num_images=1, sync_mode=true, output_format=png`,
        req?.body?.num_images === 1 &&
          req?.body?.sync_mode === true &&
          req?.body?.output_format === "png",
      );
      // generation result
      check(
        `Fal[${ar}] generation succeeded`,
        res.success === true,
        res.error,
      );
      if (res.success && res.imageData) {
        check(
          `Fal[${ar}] returned a real PNG (${res.imageData.length} bytes)`,
          isPng(res.imageData) && res.imageData.length > 1000,
          `mime=${res.mimeType}`,
        );
      }
    }
  }

  console.log("\n=== 3. OpenRouter generation (live) ===");
  if (!OR_KEY) {
    console.log("  ! OPENROUTER_API_KEY missing - skipping OpenRouter tests");
  } else {
    installCapture();
    const res = await generateWithOpenRouter({
      prompt: "a single yellow banana on a white background, studio photo",
      providerId: "openrouter",
      modelId: OR_ID,
      apiKey: OR_KEY,
      aspectRatio: "auto",
      imageSize: "1K",
    });
    const req = genRequest();
    restoreFetch();

    check(
      `OpenRouter body.model === '${API_SLUG}' (resolved api slug, not internal id)`,
      req?.body?.model === API_SLUG,
      req?.body?.model,
    );
    check(
      "OpenRouter MAI requests modalities ['image'] only (image-only output)",
      JSON.stringify(req?.body?.modalities) === JSON.stringify(["image"]),
      JSON.stringify(req?.body?.modalities),
    );
    check("OpenRouter generation succeeded", res.success === true, res.error);
    if (res.success && res.imageData) {
      check(
        `OpenRouter returned a real image (${res.imageData.length} bytes, mime=${res.mimeType})`,
        (isPng(res.imageData) || isJpeg(res.imageData) || isWebp(res.imageData)) &&
          res.imageData.length > 1000,
      );
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
