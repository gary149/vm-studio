/**
 * Registry + request-shape tests for Krea 2 support (Large, Medium, Turbo on Fal).
 *
 * Run via: node scripts/run-krea-test.mjs  (bundles this with esbuild, then runs)
 *
 * Request-shape tests use a mocked fetch (no network, no key needed).
 * Live generation tests hit the real Fal.ai API using FAL_API_KEY from
 * .env.local (authorized per CLAUDE.md) and are skipped when it's missing.
 */
import {
  PROVIDERS,
  getApiModelId,
  getAllModels,
  getUniqueModelNames,
  getProvidersForModelName,
  modelSupportsImageToImage,
  getModelSupportedImageSizes,
} from "../src/providers/index";
import { generateWithFal } from "../src/providers/fal";
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

const LARGE_ID = "krea/v2/large/text-to-image";
const MEDIUM_ID = "krea/v2/medium/text-to-image";
const TURBO_ID = "fal-ai/krea-2/turbo";

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

// ---- Fetch wrappers ----
interface Captured {
  url: string;
  method: string;
  body: any;
}
const realFetch = globalThis.fetch.bind(globalThis);
let captured: Captured[] = [];

// 1x1 transparent PNG
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// Mock mode: capture the request and return a canned Fal response (no network)
function installMock() {
  captured = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    let body: any = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        /* leave as-is */
      }
    }
    captured.push({ url, method: init?.method || "GET", body });
    return new Response(
      JSON.stringify({
        images: [
          {
            url: `data:image/png;base64,${TINY_PNG_B64}`,
            content_type: "image/png",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
}

// Live mode: capture the request, delegate to the real fetch
function installCapture() {
  captured = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    let body: any = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        /* leave as-is */
      }
    }
    captured.push({ url, method: init?.method || "GET", body });
    return realFetch(input, init);
  }) as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}
function genRequest(): Captured | undefined {
  return captured.find((c) => c.method === "POST" && c.url.includes("fal.run"));
}

async function main() {
  const FAL_KEY = process.env.FAL_API_KEY || "";

  console.log("\n=== 1. Registry / config assertions (no network) ===");

  const large = PROVIDERS.fal.models.find((m) => m.id === LARGE_ID);
  const medium = PROVIDERS.fal.models.find((m) => m.id === MEDIUM_ID);
  const turbo = PROVIDERS.fal.models.find((m) => m.id === TURBO_ID);

  check("Fal registry has Krea 2 Large entry", !!large);
  check("Fal registry has Krea 2 Medium entry", !!medium);
  check("Fal registry has Krea 2 Turbo entry", !!turbo);
  check(
    "Display names are Krea 2 Large / Medium / Turbo",
    large?.name === "Krea 2 Large" &&
      medium?.name === "Krea 2 Medium" &&
      turbo?.name === "Krea 2 Turbo",
  );
  for (const [label, m] of [
    ["Large", large],
    ["Medium", medium],
    ["Turbo", turbo],
  ] as const) {
    check(`Krea 2 ${label}: t2i supported`, m?.supportsImageGeneration === true);
    check(
      `Krea 2 ${label}: i2i NOT supported (no /edit endpoint)`,
      m?.supportsImageToImage === false,
    );
    check(
      `Krea 2 ${label}: single 1K size tier`,
      JSON.stringify(m?.supportedImageSizes) === JSON.stringify(["1K"]),
    );
  }

  // Uniqueness of internal ids across the whole registry
  const allIds = getAllModels().map((m) => m.id);
  const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  check("All model internal ids are globally unique", dupes.length === 0, dupes.join(","));

  // No apiModelId override: the internal id IS the fal.run slug
  for (const id of [LARGE_ID, MEDIUM_ID, TURBO_ID]) {
    check(`getApiModelId('${id}') falls through to id`, getApiModelId(id) === id);
  }

  // Provider picker: each Krea name maps to exactly one provider (fal)
  for (const name of ["Krea 2 Large", "Krea 2 Medium", "Krea 2 Turbo"]) {
    check(
      `'${name}' appears once in unique model names`,
      getUniqueModelNames().filter((n) => n === name).length === 1,
    );
    const providers = getProvidersForModelName(name);
    check(
      `'${name}' offered by fal only`,
      providers.length === 1 && providers[0]?.providerId === "fal",
    );
  }

  // by-id lookups
  for (const id of [LARGE_ID, MEDIUM_ID, TURBO_ID]) {
    check(`modelSupportsImageToImage('${id}') === false`, modelSupportsImageToImage(id) === false);
    check(
      `getModelSupportedImageSizes('${id}') === ['1K']`,
      JSON.stringify(getModelSupportedImageSizes(id)) === JSON.stringify(["1K"]),
    );
  }

  console.log("\n=== 2. Krea 2 Medium/Large request shape (mocked fetch) ===");

  // Plugin aspect ratio -> expected Krea 2 enum value
  const kreaAspectCases: Array<[AspectRatio, string]> = [
    ["auto", "1:1"],
    ["1:1", "1:1"],
    ["16:9", "16:9"],
    ["9:16", "9:16"],
    ["3:4", "4:5"], // snapped to closest supported ratio
    ["5:4", "4:3"], // snapped to closest supported ratio
    ["21:9", "2.35:1"], // snapped to closest supported ratio
  ];

  for (const modelId of [LARGE_ID, MEDIUM_ID]) {
    for (const [ar, expected] of kreaAspectCases) {
      installMock();
      const res = await generateWithFal({
        prompt: "test prompt",
        providerId: "fal",
        modelId,
        apiKey: "test-key",
        aspectRatio: ar,
        imageSize: "1K",
      });
      const req = genRequest();
      restoreFetch();

      check(
        `${modelId}[${ar}] POSTs to base slug (no /edit, no suffix juggling)`,
        req?.url === `https://fal.run/${modelId}`,
        req?.url,
      );
      check(
        `${modelId}[${ar}] body.aspect_ratio === '${expected}'`,
        req?.body?.aspect_ratio === expected,
        JSON.stringify(req?.body),
      );
      check(
        `${modelId}[${ar}] body omits params not in the Krea 2 schema`,
        !!req?.body &&
          !("num_images" in req.body) &&
          !("output_format" in req.body) &&
          !("sync_mode" in req.body) &&
          !("resolution" in req.body) &&
          !("image_size" in req.body),
        JSON.stringify(req?.body),
      );
      check(`${modelId}[${ar}] mocked generation succeeded`, res.success === true, res.error);
    }
  }

  console.log("\n=== 3. Krea 2 Turbo request shape (mocked fetch) ===");

  // Plugin aspect ratio -> expected image_size (enum or custom dims)
  const turboCases: Array<[AspectRatio, unknown]> = [
    ["auto", "square_hd"], // Krea 2 Turbo's documented default (FLUX.2 uses landscape_4_3)
    ["1:1", "square_hd"],
    ["16:9", "landscape_16_9"],
    ["9:16", "portrait_16_9"],
    ["3:2", { width: 1024, height: 683 }], // custom dims fallback
  ];

  for (const [ar, expected] of turboCases) {
    installMock();
    const res = await generateWithFal({
      prompt: "test prompt",
      providerId: "fal",
      modelId: TURBO_ID,
      apiKey: "test-key",
      aspectRatio: ar,
      imageSize: "1K",
    });
    const req = genRequest();
    restoreFetch();

    check(
      `Turbo[${ar}] POSTs to /${TURBO_ID}`,
      req?.url === `https://fal.run/${TURBO_ID}`,
      req?.url,
    );
    check(
      `Turbo[${ar}] body.image_size === ${JSON.stringify(expected)}`,
      JSON.stringify(req?.body?.image_size) === JSON.stringify(expected),
      JSON.stringify(req?.body?.image_size),
    );
    check(
      `Turbo[${ar}] body has num_images=1, sync_mode=true, output_format=png`,
      req?.body?.num_images === 1 &&
        req?.body?.sync_mode === true &&
        req?.body?.output_format === "png",
    );
    check(`Turbo[${ar}] mocked generation succeeded`, res.success === true, res.error);
  }

  console.log("\n=== 4. Live generation (real Fal.ai API) ===");
  if (!FAL_KEY) {
    console.log("  ! FAL_API_KEY missing - skipping live generation tests");
  } else {
    for (const modelId of [MEDIUM_ID, TURBO_ID]) {
      installCapture();
      const res = await generateWithFal({
        prompt: "a single red apple on a white background, studio photo",
        providerId: "fal",
        modelId,
        apiKey: FAL_KEY,
        aspectRatio: "1:1",
        imageSize: "1K",
      });
      restoreFetch();

      check(`Live[${modelId}] generation succeeded`, res.success === true, res.error);
      if (res.success && res.imageData) {
        check(
          `Live[${modelId}] returned real image data (${res.imageData.length} bytes)`,
          res.imageData.length > 1000,
          `mime=${res.mimeType}`,
        );
        if (modelId === TURBO_ID) {
          check(`Live[${modelId}] returned a PNG`, isPng(res.imageData), `mime=${res.mimeType}`);
        }
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
