/**
 * Integration + registry tests for Nano Banana 2.1 on Fal.ai, OpenRouter, and
 * Google AI Studio.
 *
 * Run via: node scripts/run-nano-banana-2-1-test.mjs
 *
 * Request-shape checks use a throwaway key (the provider answers 401 before
 * generating, so nothing is billed). Live generations hit all three providers
 * with keys from .env.local (authorized per CLAUDE.md).
 */
import { crc32, deflateSync } from "node:zlib";
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
import { generateWithGemini } from "../src/providers/gemini";
import type {
  AspectRatio,
  GenerationRequest,
  GenerationResult,
  ImageSize,
} from "../src/types";

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

const FAL_ID = "google/nano-banana-2.1";
const OR_ID = "google/gemini-nano-banana-2.1";
const GEMINI_ID = "gemini-nano-banana-2.1";
const NAME = "Nano Banana 2.1";

const FAL_BASE = "https://fal.run";
const OR_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_ID}:generateContent`;

// 1x1 red PNG (valid base64 payload for shape-only reference-image requests)
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// 256x256 RGB PNG: red square centered on white. Big enough for a real edit.
function makeReferencePng(): string {
  const size = 256;
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inSquare = x >= 64 && x < 192 && y >= 64 && y < 192;
      const px = row + 1 + x * 3;
      raw[px] = 255;
      raw[px + 1] = inSquare ? 0 : 255;
      raw[px + 2] = inSquare ? 0 : 255;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

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

// Pixel dimensions from a PNG IHDR or a JPEG SOFn marker
function imageDimensions(
  data: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (isPng(data)) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (isJpeg(data)) {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) return null;
      const marker = data[i + 1];
      const len = view.getUint16(i + 2);
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
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
      c.method === "POST" &&
      /fal\.run|openrouter\.ai|generativelanguage\.googleapis\.com/.test(c.url),
  );
}

type Generator = (request: GenerationRequest) => Promise<GenerationResult>;

// Runs one generation with request capture; returns the outgoing request too.
async function run(
  generator: Generator,
  request: GenerationRequest,
): Promise<{ req: Captured | undefined; res: GenerationResult }> {
  installCapture();
  const res = await generator(request);
  const req = genRequest();
  restoreFetch();
  return { req, res };
}

function shapeRequest(
  providerId: GenerationRequest["providerId"],
  modelId: string,
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  inputImages?: string[],
): GenerationRequest {
  return {
    prompt: "shape check",
    providerId,
    modelId,
    apiKey: "invalid-key-shape-check",
    aspectRatio,
    imageSize,
    inputImages,
  };
}

function checkLiveImage(
  label: string,
  res: GenerationResult,
  expectLongEdgeAtLeast: number,
) {
  check(`${label} generation succeeded`, res.success === true, res.error);
  if (!res.success || !res.imageData) return;
  const dims = imageDimensions(res.imageData);
  check(
    `${label} returned a real image (${res.imageData.length} bytes, mime=${res.mimeType}, ${dims ? `${dims.width}x${dims.height}` : "?"})`,
    (isPng(res.imageData) || isJpeg(res.imageData)) &&
      res.imageData.length > 10000,
  );
  check(
    `${label} long edge >= ${expectLongEdgeAtLeast}px`,
    !!dims && Math.max(dims.width, dims.height) >= expectLongEdgeAtLeast,
    dims ? `${dims.width}x${dims.height}` : "unreadable dimensions",
  );
}

async function main() {
  const FAL_KEY = process.env.FAL_API_KEY || "";
  const OR_KEY = process.env.OPENROUTER_API_KEY || "";
  const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
  const REFERENCE_PNG = makeReferencePng();
  const EDIT_PROMPT =
    "Turn the red square into a blue circle. Keep the white background.";
  const T2I_PROMPT =
    "a single red apple on a white background, studio product photo";

  console.log("\n=== 1. Registry / config assertions (no network) ===");
  {
    const entries = [
      ["Fal", PROVIDERS.fal.models.find((m) => m.id === FAL_ID)],
      ["OpenRouter", PROVIDERS.openrouter.models.find((m) => m.id === OR_ID)],
      ["Google AI Studio", PROVIDERS.gemini.models.find((m) => m.id === GEMINI_ID)],
    ] as const;
    for (const [provider, model] of entries) {
      check(`${provider} registry has ${NAME}`, !!model);
      check(`${provider} entry is named '${NAME}'`, model?.name === NAME, model?.name);
    }

    for (const id of [FAL_ID, OR_ID, GEMINI_ID]) {
      check(`modelSupportsImageToImage('${id}') === true`, modelSupportsImageToImage(id) === true);
      check(`getApiModelId('${id}') falls through to id`, getApiModelId(id) === id, getApiModelId(id));
      check(
        `'${id}' offers 1K/2K/4K`,
        JSON.stringify(getModelSupportedImageSizes(id)) === JSON.stringify(["1K", "2K", "4K"]),
      );
      check(`modelUsesImagesApi('${id}') === false`, modelUsesImagesApi(id) === false);
    }

    const allIds = getAllModels().map((m) => m.id);
    const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
    check("All model internal ids are globally unique", dupes.length === 0, dupes.join(","));

    check(
      `'${NAME}' appears once in unique model names`,
      getUniqueModelNames().filter((n) => n === NAME).length === 1,
    );
    const providers = getProvidersForModelName(NAME)
      .map((p) => p.providerId)
      .sort()
      .join(",");
    check(`'${NAME}' offered by [fal,gemini,openrouter]`, providers === "fal,gemini,openrouter", providers);

    check(
      "Default per-provider models unchanged (2.1 is not models[0])",
      PROVIDERS.fal.models[0].id === "fal-ai/nano-banana-2" &&
        PROVIDERS.openrouter.models[0].id === "google/gemini-3.1-flash-image" &&
        PROVIDERS.gemini.models[0].id === "gemini-3.1-flash-image",
    );
  }

  console.log("\n=== 2. Request shapes (throwaway key) ===");
  {
    // Fal: base path for t2i, /edit for i2i, aspect_ratio + resolution
    const falT2i = await run(generateWithFal, shapeRequest("fal", FAL_ID, "16:9", "2K"));
    check(`Fal t2i posts to /${FAL_ID}`, falT2i.req?.url === `${FAL_BASE}/${FAL_ID}`, falT2i.req?.url);
    check(
      "Fal t2i body: aspect_ratio=16:9, resolution=2K, num_images=1, png, sync_mode",
      falT2i.req?.body?.aspect_ratio === "16:9" &&
        falT2i.req?.body?.resolution === "2K" &&
        falT2i.req?.body?.num_images === 1 &&
        falT2i.req?.body?.output_format === "png" &&
        falT2i.req?.body?.sync_mode === true,
      JSON.stringify(falT2i.req?.body),
    );
    check("Fal t2i omits image_urls", falT2i.req?.body && !("image_urls" in falT2i.req.body));

    const falAuto = await run(generateWithFal, shapeRequest("fal", FAL_ID, "auto", "1K"));
    check("Fal 'auto' omits aspect_ratio (model default is auto)", falAuto.req?.body && !("aspect_ratio" in falAuto.req.body), JSON.stringify(falAuto.req?.body));

    const falEdit = await run(generateWithFal, shapeRequest("fal", FAL_ID, "1:1", "1K", [TINY_PNG_B64, TINY_PNG_B64]));
    check(`Fal i2i posts to /${FAL_ID}/edit`, falEdit.req?.url === `${FAL_BASE}/${FAL_ID}/edit`, falEdit.req?.url);
    check(
      "Fal i2i sends every reference as image_urls[] data URIs",
      Array.isArray(falEdit.req?.body?.image_urls) &&
        falEdit.req.body.image_urls.length === 2 &&
        falEdit.req.body.image_urls[0].startsWith("data:image/png;base64,"),
    );

    // OpenRouter: chat completions with image_config
    const orT2i = await run(generateWithOpenRouter, shapeRequest("openrouter", OR_ID, "4:5", "2K"));
    check("OpenRouter posts to /api/v1/chat/completions", orT2i.req?.url === OR_CHAT_URL, orT2i.req?.url);
    check(`OpenRouter body.model === '${OR_ID}'`, orT2i.req?.body?.model === OR_ID, orT2i.req?.body?.model);
    check(
      "OpenRouter body.modalities === [text, image]",
      JSON.stringify(orT2i.req?.body?.modalities) === JSON.stringify(["text", "image"]),
    );
    check(
      "OpenRouter image_config: aspect_ratio=4:5, image_size=2K",
      orT2i.req?.body?.image_config?.aspect_ratio === "4:5" &&
        orT2i.req?.body?.image_config?.image_size === "2K",
      JSON.stringify(orT2i.req?.body?.image_config),
    );

    const orEdit = await run(generateWithOpenRouter, shapeRequest("openrouter", OR_ID, "auto", "1K", [TINY_PNG_B64]));
    const orParts = orEdit.req?.body?.messages?.[0]?.content;
    check(
      "OpenRouter i2i sends image_url part before the text prompt",
      Array.isArray(orParts) &&
        orParts[0]?.type === "image_url" &&
        orParts[0]?.image_url?.url?.startsWith("data:image/png;base64,") &&
        orParts[orParts.length - 1]?.type === "text",
      JSON.stringify(orParts)?.slice(0, 200),
    );
    check(
      "OpenRouter 'auto' omits image_config.aspect_ratio",
      orEdit.req?.body?.image_config && !("aspect_ratio" in orEdit.req.body.image_config),
      JSON.stringify(orEdit.req?.body?.image_config),
    );

    // Google AI Studio: generateContent with imageConfig
    const gT2i = await run(generateWithGemini, shapeRequest("gemini", GEMINI_ID, "21:9", "4K"));
    check(`Gemini posts to models/${GEMINI_ID}:generateContent`, gT2i.req?.url === GEMINI_URL, gT2i.req?.url);
    check(
      "Gemini imageConfig: aspectRatio=21:9, imageSize=4K",
      gT2i.req?.body?.generationConfig?.imageConfig?.aspectRatio === "21:9" &&
        gT2i.req?.body?.generationConfig?.imageConfig?.imageSize === "4K",
      JSON.stringify(gT2i.req?.body?.generationConfig),
    );

    const gEdit = await run(generateWithGemini, shapeRequest("gemini", GEMINI_ID, "1:1", "1K", [TINY_PNG_B64]));
    const gParts = gEdit.req?.body?.contents?.[0]?.parts;
    check(
      "Gemini i2i sends inlineData part before the text prompt",
      Array.isArray(gParts) &&
        gParts[0]?.inlineData?.mimeType === "image/png" &&
        typeof gParts[gParts.length - 1]?.text === "string",
      JSON.stringify(gParts)?.slice(0, 200),
    );
  }

  console.log("\n=== 3. Fal live generation ===");
  if (!FAL_KEY) {
    console.log("  ! FAL_API_KEY missing - skipping Fal live tests");
  } else {
    const t2i = await run(generateWithFal, {
      prompt: T2I_PROMPT,
      providerId: "fal",
      modelId: FAL_ID,
      apiKey: FAL_KEY,
      aspectRatio: "16:9",
      imageSize: "2K",
    });
    checkLiveImage("Fal t2i 2K 16:9", t2i.res, 1900);

    const edit = await run(generateWithFal, {
      prompt: EDIT_PROMPT,
      providerId: "fal",
      modelId: FAL_ID,
      apiKey: FAL_KEY,
      aspectRatio: "1:1",
      imageSize: "1K",
      inputImages: [REFERENCE_PNG],
    });
    check("Fal i2i hit /edit", edit.req?.url === `${FAL_BASE}/${FAL_ID}/edit`, edit.req?.url);
    checkLiveImage("Fal i2i 1K 1:1", edit.res, 900);
  }

  console.log("\n=== 4. OpenRouter live generation (chat completions) ===");
  if (!OR_KEY) {
    console.log("  ! OPENROUTER_API_KEY missing - skipping OpenRouter live tests");
  } else {
    const t2i = await run(generateWithOpenRouter, {
      prompt: T2I_PROMPT,
      providerId: "openrouter",
      modelId: OR_ID,
      apiKey: OR_KEY,
      aspectRatio: "16:9",
      imageSize: "1K",
    });
    checkLiveImage("OpenRouter t2i 1K 16:9", t2i.res, 900);

    const edit = await run(generateWithOpenRouter, {
      prompt: EDIT_PROMPT,
      providerId: "openrouter",
      modelId: OR_ID,
      apiKey: OR_KEY,
      aspectRatio: "1:1",
      imageSize: "1K",
      inputImages: [REFERENCE_PNG],
    });
    checkLiveImage("OpenRouter i2i 1K 1:1", edit.res, 900);
  }

  console.log("\n=== 5. Google AI Studio live generation ===");
  if (!GEMINI_KEY) {
    console.log("  ! GEMINI_API_KEY missing - skipping Google AI Studio live tests");
  } else {
    const t2i = await run(generateWithGemini, {
      prompt: T2I_PROMPT,
      providerId: "gemini",
      modelId: GEMINI_ID,
      apiKey: GEMINI_KEY,
      aspectRatio: "1:1",
      imageSize: "2K",
    });
    checkLiveImage("Gemini t2i 2K 1:1", t2i.res, 1900);

    const edit = await run(generateWithGemini, {
      prompt: EDIT_PROMPT,
      providerId: "gemini",
      modelId: GEMINI_ID,
      apiKey: GEMINI_KEY,
      aspectRatio: "1:1",
      imageSize: "1K",
      inputImages: [REFERENCE_PNG],
    });
    checkLiveImage("Gemini i2i 1K 1:1", edit.res, 900);
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
