/**
 * Integration + registry tests for GPT-Image 2.5 (Flare and Sunburst) on
 * Fal.ai, OpenRouter, and the OpenAI Images API, plus the shared GPT-Image
 * custom-size snapping (multiples of 16, long edge <= 3840, total pixels
 * within [655,360, 8,294,400]).
 *
 * Run via: node scripts/run-gpt-image-2-5-test.mjs
 *
 * Request-shape checks use a throwaway key (the provider answers 401 before
 * generating, so nothing is billed). Live generations hit Fal.ai and
 * OpenRouter with keys from .env.local (authorized per CLAUDE.md); the
 * OpenAI direct provider is shape-checked only (no OPENAI_API_KEY on file).
 */
import {
  PROVIDERS,
  getApiModelId,
  getAllModels,
  getUniqueModelNames,
  getProvidersForModelName,
  modelSupportsImageToImage,
  getModelSupportedImageSizes,
  modelUsesImagesApi,
} from "../src/providers/index";
import { generateWithFal } from "../src/providers/fal";
import { generateWithOpenRouter } from "../src/providers/openrouter";
import { generateWithOpenAI } from "../src/providers/openai";
import type { AspectRatio, ImageSize } from "../src/types";

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

const FAL_FLARE = "openai/gpt-image-2.5/flare";
const FAL_SUNBURST = "openai/gpt-image-2.5/sunburst";
const OR_FLARE = "openai/gpt-image-2.5-flare";
const OR_SUNBURST = "openai/gpt-image-2.5-sunburst";
const OAI_FLARE = "gpt-image-2.5-flare";
const OAI_SUNBURST = "gpt-image-2.5-sunburst";

const FAL_BASE = "https://fal.run";
const OR_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const OAI_GEN_URL = "https://api.openai.com/v1/images/generations";
const OAI_EDIT_URL = "https://api.openai.com/v1/images/edits";

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
    (c) =>
      c.method === "POST" && /fal\.run|openrouter\.ai|api\.openai\.com/.test(c.url),
  );
}

// Fires a Fal request with a throwaway key and returns what went out on the
// wire. Fal rejects the key before generating, so nothing is billed.
async function falShape(
  modelId: string,
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  inputImages?: string[],
): Promise<Captured | undefined> {
  installCapture();
  await generateWithFal({
    prompt: "shape check",
    providerId: "fal",
    modelId,
    apiKey: "invalid-key-shape-check",
    aspectRatio,
    imageSize,
    inputImages,
  });
  const req = genRequest();
  restoreFetch();
  return req;
}

async function main() {
  const FAL_KEY = process.env.FAL_API_KEY || "";
  const OR_KEY = process.env.OPENROUTER_API_KEY || "";

  console.log("\n=== 1. Registry / config assertions (no network) ===");
  {
    const fal = PROVIDERS.fal.models;
    const or = PROVIDERS.openrouter.models;
    const oai = PROVIDERS.openai.models;
    const falFlare = fal.find((m) => m.id === FAL_FLARE);
    const falSunburst = fal.find((m) => m.id === FAL_SUNBURST);
    const orFlare = or.find((m) => m.id === OR_FLARE);
    const orSunburst = or.find((m) => m.id === OR_SUNBURST);
    const oaiFlare = oai.find((m) => m.id === OAI_FLARE);
    const oaiSunburst = oai.find((m) => m.id === OAI_SUNBURST);

    check("Fal registry has Flare", !!falFlare);
    check("Fal registry has Sunburst", !!falSunburst);
    check("OpenRouter registry has Flare", !!orFlare);
    check("OpenRouter registry has Sunburst", !!orSunburst);
    check("OpenAI registry has Flare", !!oaiFlare);
    check("OpenAI registry has Sunburst", !!oaiSunburst);

    check(
      "Flare shares display name 'GPT-Image 2.5 Flare' across providers",
      [falFlare, orFlare, oaiFlare].every((m) => m?.name === "GPT-Image 2.5 Flare"),
    );
    check(
      "Sunburst shares display name 'GPT-Image 2.5 Sunburst' across providers",
      [falSunburst, orSunburst, oaiSunburst].every(
        (m) => m?.name === "GPT-Image 2.5 Sunburst",
      ),
    );

    for (const id of [FAL_FLARE, FAL_SUNBURST, OR_FLARE, OR_SUNBURST, OAI_FLARE, OAI_SUNBURST]) {
      check(`modelSupportsImageToImage('${id}') === true`, modelSupportsImageToImage(id) === true);
      check(`getApiModelId('${id}') falls through to id`, getApiModelId(id) === id, getApiModelId(id));
    }
    for (const id of [FAL_FLARE, FAL_SUNBURST]) {
      check(
        `Fal '${id}' offers 1K/2K/4K`,
        JSON.stringify(getModelSupportedImageSizes(id)) === JSON.stringify(["1K", "2K", "4K"]),
      );
      check(`modelUsesImagesApi('${id}') === false (Fal)`, modelUsesImagesApi(id) === false);
    }
    for (const id of [OR_FLARE, OR_SUNBURST]) {
      check(
        `OpenRouter '${id}' is 1K only`,
        JSON.stringify(getModelSupportedImageSizes(id)) === JSON.stringify(["1K"]),
      );
      check(`modelUsesImagesApi('${id}') === true (Images API)`, modelUsesImagesApi(id) === true);
    }
    for (const id of [OAI_FLARE, OAI_SUNBURST]) {
      check(
        `OpenAI '${id}' is 1K only`,
        JSON.stringify(getModelSupportedImageSizes(id)) === JSON.stringify(["1K"]),
      );
    }

    const allIds = getAllModels().map((m) => m.id);
    const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
    check("All model internal ids are globally unique", dupes.length === 0, dupes.join(","));

    for (const name of ["GPT-Image 2.5 Flare", "GPT-Image 2.5 Sunburst"]) {
      check(
        `'${name}' appears once in unique model names`,
        getUniqueModelNames().filter((n) => n === name).length === 1,
      );
      const providers = getProvidersForModelName(name)
        .map((p) => p.providerId)
        .sort()
        .join(",");
      check(`'${name}' offered by [fal,openai,openrouter]`, providers === "fal,openai,openrouter", providers);
    }
  }

  console.log("\n=== 2. Fal request shape: endpoints + size snapping (throwaway key) ===");
  {
    // Endpoint layout: /text-to-image for t2i, /edit for i2i
    const t2i = await falShape(FAL_FLARE, "1:1", "1K");
    check(
      "Flare t2i posts to /openai/gpt-image-2.5/flare/text-to-image",
      t2i?.url === `${FAL_BASE}/${FAL_FLARE}/text-to-image`,
      t2i?.url,
    );
    check("Flare t2i 1K 1:1 uses square_hd preset", t2i?.body?.image_size === "square_hd", JSON.stringify(t2i?.body?.image_size));
    check(
      "Flare t2i body has num_images=1, quality=high, output_format=png, sync_mode=true",
      t2i?.body?.num_images === 1 &&
        t2i?.body?.quality === "high" &&
        t2i?.body?.output_format === "png" &&
        t2i?.body?.sync_mode === true,
      JSON.stringify(t2i?.body),
    );

    const edit = await falShape(FAL_SUNBURST, "auto", "1K", [TINY_PNG_B64]);
    check(
      "Sunburst i2i posts to /openai/gpt-image-2.5/sunburst/edit",
      edit?.url === `${FAL_BASE}/${FAL_SUNBURST}/edit`,
      edit?.url,
    );
    check("Sunburst i2i sends image_urls[] data URIs", Array.isArray(edit?.body?.image_urls) && edit.body.image_urls[0].startsWith("data:image/png;base64,"));
    check("Sunburst i2i auto -> image_size 'auto' (allowed on /edit)", edit?.body?.image_size === "auto", JSON.stringify(edit?.body?.image_size));

    const t2iAuto = await falShape(FAL_SUNBURST, "auto", "1K");
    check("Sunburst t2i auto -> landscape_4_3 (no 'auto' on t2i)", t2iAuto?.body?.image_size === "landscape_4_3", JSON.stringify(t2iAuto?.body?.image_size));

    // Custom-size snapping (shared with GPT-Image 2)
    const cases: Array<[AspectRatio, ImageSize, { width: number; height: number }, string]> = [
      ["1:1", "2K", { width: 2048, height: 2048 }, "2K 1:1 passes through"],
      ["16:9", "4K", { width: 3840, height: 2160 }, "4K 16:9 caps at 3840x2160 (max edge, exactly max pixels)"],
      ["1:1", "4K", { width: 2880, height: 2880 }, "4K 1:1 scales down to 2880x2880 (pixel ceiling)"],
      ["4:3", "4K", { width: 3312, height: 2480 }, "4K 4:3 scales down under the pixel ceiling"],
      ["21:9", "1K", { width: 1248, height: 544 }, "1K 21:9 scales up to 1248x544 (pixel floor)"],
      ["3:2", "1K", { width: 1024, height: 672 }, "1K 3:2 stays 1024x672 (already inside bounds)"],
    ];
    for (const [ar, size, expected, label] of cases) {
      const req = await falShape(FAL_FLARE, ar, size);
      const got = req?.body?.image_size;
      check(
        `${label} -> ${expected.width}x${expected.height}`,
        got?.width === expected.width && got?.height === expected.height,
        JSON.stringify(got),
      );
      const pixels = (got?.width ?? 0) * (got?.height ?? 0);
      check(
        `  ${ar} ${size}: multiples of 16, edge <= 3840, pixels in [655360, 8294400]`,
        got?.width % 16 === 0 &&
          got?.height % 16 === 0 &&
          Math.max(got?.width, got?.height) <= 3840 &&
          pixels >= 655_360 &&
          pixels <= 8_294_400,
        `pixels=${pixels}`,
      );
    }
  }

  console.log("\n=== 3. OpenAI direct request shape (throwaway key) ===");
  {
    installCapture();
    await generateWithOpenAI({
      prompt: "shape check",
      providerId: "openai",
      modelId: OAI_FLARE,
      apiKey: "invalid-key-shape-check",
      aspectRatio: "16:9",
      imageSize: "1K",
    });
    const gen = genRequest();
    restoreFetch();
    check("OpenAI Flare t2i posts to /v1/images/generations", gen?.url === OAI_GEN_URL, gen?.url);
    check(`OpenAI Flare body.model === '${OAI_FLARE}'`, gen?.body?.model === OAI_FLARE, gen?.body?.model);
    check("OpenAI Flare 16:9 -> size 1536x1024", gen?.body?.size === "1536x1024", gen?.body?.size);

    installCapture();
    await generateWithOpenAI({
      prompt: "shape check",
      providerId: "openai",
      modelId: OAI_SUNBURST,
      apiKey: "invalid-key-shape-check",
      aspectRatio: "auto",
      imageSize: "1K",
      inputImages: [TINY_PNG_B64],
    });
    const edit = genRequest();
    restoreFetch();
    check("OpenAI Sunburst i2i posts to /v1/images/edits", edit?.url === OAI_EDIT_URL, edit?.url);
    check(`OpenAI Sunburst body.model === '${OAI_SUNBURST}'`, edit?.body?.model === OAI_SUNBURST, edit?.body?.model);
    check("OpenAI Sunburst i2i sends images[].image_url data URI", Array.isArray(edit?.body?.images) && edit.body.images[0]?.image_url?.startsWith("data:image/png;base64,"));
  }

  console.log("\n=== 4. Fal live generation ===");
  if (!FAL_KEY) {
    console.log("  ! FAL_API_KEY missing - skipping Fal live tests");
  } else {
    const liveCases: Array<[string, AspectRatio, ImageSize, string]> = [
      [FAL_FLARE, "21:9", "1K", "Flare 1K 21:9 (pixel-floor path)"],
      [FAL_FLARE, "1:1", "4K", "Flare 4K 1:1 (pixel-ceiling path)"],
      [FAL_SUNBURST, "1:1", "1K", "Sunburst 1K 1:1 (preset path)"],
    ];
    for (const [modelId, ar, size, label] of liveCases) {
      installCapture();
      const res = await generateWithFal({
        prompt: "a single red apple on a white background, studio photo",
        providerId: "fal",
        modelId,
        apiKey: FAL_KEY,
        aspectRatio: ar,
        imageSize: size,
      });
      const req = genRequest();
      restoreFetch();
      check(`${label} posts to /${modelId}/text-to-image`, req?.url === `${FAL_BASE}/${modelId}/text-to-image`, req?.url);
      check(`${label} generation succeeded`, res.success === true, res.error);
      if (res.success && res.imageData) {
        check(
          `${label} returned a real image (${res.imageData.length} bytes, mime=${res.mimeType})`,
          (isPng(res.imageData) || isJpeg(res.imageData)) && res.imageData.length > 10000,
        );
      }
    }
  }

  console.log("\n=== 5. OpenRouter live generation via Images API ===");
  if (!OR_KEY) {
    console.log("  ! OPENROUTER_API_KEY missing - skipping OpenRouter live tests");
  } else {
    const liveCases: Array<[string, AspectRatio, string, string]> = [
      [OR_FLARE, "5:4", "4:3", "Flare (5:4 snaps to 4:3)"],
      [OR_SUNBURST, "16:9", "16:9", "Sunburst (16:9 passes through)"],
    ];
    for (const [modelId, ar, expectedRatio, label] of liveCases) {
      installCapture();
      const res = await generateWithOpenRouter({
        prompt: "a minimal product photo of white sneakers on gray",
        providerId: "openrouter",
        modelId,
        apiKey: OR_KEY,
        aspectRatio: ar,
        imageSize: "1K",
      });
      const req = genRequest();
      restoreFetch();
      check(`${label} posts to /api/v1/images`, req?.url === OR_IMAGES_URL, req?.url);
      check(`${label} body.model === '${modelId}'`, req?.body?.model === modelId, req?.body?.model);
      check(`${label} body.aspect_ratio === '${expectedRatio}'`, req?.body?.aspect_ratio === expectedRatio, JSON.stringify(req?.body?.aspect_ratio));
      check(`${label} omits resolution (1K only)`, req?.body && !("resolution" in req.body));
      check(`${label} generation succeeded`, res.success === true, res.error);
      if (res.success && res.imageData) {
        check(
          `${label} returned a real image (${res.imageData.length} bytes, mime=${res.mimeType})`,
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
