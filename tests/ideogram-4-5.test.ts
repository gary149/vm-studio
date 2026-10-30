/**
 * Integration + registry tests for Ideogram 4.5 on Fal.ai and the Google AI
 * Studio move to GA Nano Banana ids.
 *
 * Run via: node scripts/run-ideogram-4-5-test.mjs
 *
 * Request-shape checks use a throwaway key (the provider answers 401 before
 * generating, so nothing is billed). Live generations use keys from .env.local
 * (authorized per CLAUDE.md). Set TEST_OUTPUT_DIR to keep the generated images.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import {
  MIGRATED_MODEL_IDS,
  PROVIDERS,
  getModelSupportedImageSizes,
  getProvidersForModelName,
  modelSupportsImageToImage,
} from "../src/providers/index";
import { generateWithFal } from "../src/providers/fal";
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

const FAL_ID = "ideogram/v4.5";
const NAME = "Ideogram 4.5";
const FAL_BASE = "https://fal.run";

// Sizes the ideogram/v4.5 schema accepts for explicit dimensions on text-to-image
const T2I_SIZES = new Set(
  "1024x1024 1024x3072 1120x896 1152x2944 1152x864 1248x3328 1248x832 1280x3072 1280x720 1280x800 1296x3168 1440x2560 1440x2880 1440x720 1600x2560 1664x2496 1728x2304 1792x2240 2048x2048 2240x1792 2304x1728 2496x1664 2560x1440 2560x1600 2880x1440 2944x1152 3072x1024 3072x1280 3168x1296 3328x1248 720x1280 720x1440 800x1280 832x1248 864x1152 896x1120".split(
    " ",
  ),
);

const RATIOS: Exclude<AspectRatio, "auto">[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9",
];

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

type Generator = (request: GenerationRequest) => Promise<GenerationResult>;

// Runs one generation with request capture; returns the outgoing request too.
async function run(
  generator: Generator,
  request: GenerationRequest,
): Promise<{ req: Captured | undefined; res: GenerationResult }> {
  installCapture();
  const res = await generator(request);
  const req = captured.find((c) => c.method === "POST");
  restoreFetch();
  return { req, res };
}

function falShape(
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  inputImages?: string[],
): GenerationRequest {
  return {
    prompt: "shape check",
    providerId: "fal",
    modelId: FAL_ID,
    apiKey: "invalid-key-shape-check",
    aspectRatio,
    imageSize,
    inputImages,
  };
}

function checkLiveImage(
  label: string,
  res: GenerationResult,
  expected?: { width: number; height: number },
) {
  check(`${label} generation succeeded`, res.success === true, res.error);
  if (!res.success || !res.imageData) return;
  const dims = imageDimensions(res.imageData);
  check(
    `${label} returned a real image (${res.imageData.length} bytes, mime=${res.mimeType}, ${dims ? `${dims.width}x${dims.height}` : "?"})`,
    (isPng(res.imageData) || isJpeg(res.imageData)) &&
      res.imageData.length > 10000,
  );
  if (expected) {
    check(
      `${label} delivered ${expected.width}x${expected.height}`,
      dims?.width === expected.width && dims?.height === expected.height,
      dims ? `${dims.width}x${dims.height}` : "unreadable dimensions",
    );
  }
  const outDir = process.env.TEST_OUTPUT_DIR;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    const ext = isPng(res.imageData) ? "png" : "jpg";
    const file = label.replace(/[^a-z0-9.-]+/gi, "_") + "." + ext;
    writeFileSync(join(outDir, file), res.imageData);
  }
}

async function main() {
  const FAL_KEY = process.env.FAL_API_KEY || "";
  const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
  const REFERENCE_PNG = makeReferencePng();
  const EDIT_PROMPT =
    "Turn the red square into a blue circle. Keep the white background.";
  const T2I_PROMPT =
    'a minimalist poster on a white background with the words "VM STUDIO" in bold black letters';

  console.log("\n=== 1. Registry / config assertions (no network) ===");
  {
    const model = PROVIDERS.fal.models.find((m) => m.id === FAL_ID);
    check(`Fal registry has ${NAME}`, model?.name === NAME, model?.name);
    check("Ideogram 4 is still registered", PROVIDERS.fal.models.some((m) => m.id === "ideogram/v4"));
    check(`modelSupportsImageToImage('${FAL_ID}') === true`, modelSupportsImageToImage(FAL_ID) === true);
    check(
      `'${FAL_ID}' offers 1K/2K only`,
      JSON.stringify(getModelSupportedImageSizes(FAL_ID)) === JSON.stringify(["1K", "2K"]),
    );
    const providers = getProvidersForModelName(NAME).map((p) => p.providerId).join(",");
    check(`'${NAME}' offered by [fal]`, providers === "fal", providers);

    for (const [from, to] of [
      ["gemini-3.1-flash-image-preview", "gemini-3.1-flash-image"],
      ["gemini-3-pro-image-preview", "gemini-3-pro-image"],
    ]) {
      check(`Saved '${from}' migrates to '${to}'`, MIGRATED_MODEL_IDS[from] === to, MIGRATED_MODEL_IDS[from]);
      check(`Gemini registry has '${to}'`, PROVIDERS.gemini.models.some((m) => m.id === to));
      check(`Gemini registry dropped '${from}'`, !PROVIDERS.gemini.models.some((m) => m.id === from));
    }
    for (const id of Object.values(MIGRATED_MODEL_IDS)) {
      check(
        `Migration target '${id}' exists in the registry`,
        Object.values(PROVIDERS).some((p) => p.models.some((m) => m.id === id)),
      );
    }
  }

  console.log("\n=== 2. Request shapes (throwaway key) ===");
  {
    const t2i = await run(generateWithFal, falShape("16:9", "2K"));
    check(`t2i posts to /${FAL_ID}`, t2i.req?.url === `${FAL_BASE}/${FAL_ID}`, t2i.req?.url);
    check(
      "t2i body: quality=high, num_images=1, sync_mode, no output_format",
      t2i.req?.body?.quality === "high" &&
        t2i.req?.body?.num_images === 1 &&
        t2i.req?.body?.sync_mode === true &&
        !("output_format" in t2i.req.body),
      JSON.stringify(t2i.req?.body),
    );
    check("t2i omits image_url", t2i.req?.body && !("image_url" in t2i.req.body));

    const auto = await run(generateWithFal, falShape("auto", "1K"));
    check(
      "t2i 'auto' falls back to 1024x1024",
      auto.req?.body?.image_size?.width === 1024 && auto.req?.body?.image_size?.height === 1024,
      JSON.stringify(auto.req?.body?.image_size),
    );

    // Every ratio/tier combination must land on a size the schema accepts
    for (const ratio of RATIOS) {
      for (const tier of ["1K", "2K"] as ImageSize[]) {
        const { req } = await run(generateWithFal, falShape(ratio, tier));
        const size = `${req?.body?.image_size?.width}x${req?.body?.image_size?.height}`;
        check(`t2i ${ratio} ${tier} -> ${size} is a supported size`, T2I_SIZES.has(size));

        const edit = await run(generateWithFal, falShape(ratio, tier, [TINY_PNG_B64]));
        const { width, height } = edit.req?.body?.image_size ?? {};
        check(
          `edit ${ratio} ${tier} -> ${width}x${height} meets /edit rules`,
          width % 32 === 0 && height % 32 === 0 && width * height <= 4194304,
        );
      }
    }

    const edit = await run(generateWithFal, falShape("auto", "1K", [TINY_PNG_B64]));
    check(`i2i posts to /${FAL_ID}/edit`, edit.req?.url === `${FAL_BASE}/${FAL_ID}/edit`, edit.req?.url);
    check("i2i sends image_url as a data URI", edit.req?.body?.image_url?.startsWith("data:image/png;base64,"));
    check("i2i 'auto' keeps the source framing", edit.req?.body?.image_size === "auto");
    check("i2i omits image_urls", edit.req?.body && !("image_urls" in edit.req.body));
    check("single input omits reference_image_urls", edit.req?.body && !("reference_image_urls" in edit.req.body));

    const refs = await run(generateWithFal, falShape("1:1", "1K", Array(5).fill(TINY_PNG_B64)));
    check(
      "5 inputs: first is image_url, other 4 are reference_image_urls",
      !!refs.req?.body?.image_url && refs.req?.body?.reference_image_urls?.length === 4,
    );

    const tooMany = await run(generateWithFal, falShape("1:1", "1K", Array(6).fill(TINY_PNG_B64)));
    check("6 inputs are rejected before any request", !tooMany.req && tooMany.res.success === false, tooMany.res.error);

    // Ideogram 4 keeps its own endpoint and single-image limit
    const v4Edit = await run(generateWithFal, { ...falShape("1:1", "1K", [TINY_PNG_B64]), modelId: "ideogram/v4" });
    check(
      "Ideogram 4 i2i still posts to /image-to-image",
      v4Edit.req?.url === `${FAL_BASE}/ideogram/v4/image-to-image`,
      v4Edit.req?.url,
    );
    check("Ideogram 4 body still forces png", v4Edit.req?.body?.output_format === "png");
    const v4Multi = await run(generateWithFal, { ...falShape("1:1", "1K", [TINY_PNG_B64, TINY_PNG_B64]), modelId: "ideogram/v4" });
    check("Ideogram 4 still rejects multiple inputs", !v4Multi.req && v4Multi.res.success === false);
  }

  console.log("\n=== 3. Fal live generation ===");
  if (!FAL_KEY) {
    console.log("  ! FAL_API_KEY missing - skipping Fal live tests");
  } else {
    const live = (
      aspectRatio: AspectRatio,
      imageSize: ImageSize,
      prompt: string,
      inputImages?: string[],
    ) =>
      generateWithFal({
        prompt,
        providerId: "fal",
        modelId: FAL_ID,
        apiKey: FAL_KEY,
        aspectRatio,
        imageSize,
        inputImages,
      });

    const results = await Promise.all([
      live("16:9", "2K", T2I_PROMPT),
      live("21:9", "1K", T2I_PROMPT),
      live("16:9", "1K", EDIT_PROMPT, [REFERENCE_PNG]),
      live("auto", "1K", EDIT_PROMPT, [REFERENCE_PNG, REFERENCE_PNG]),
    ]);
    checkLiveImage("Fal t2i 2K 16:9", results[0], { width: 2560, height: 1440 });
    checkLiveImage("Fal t2i 1K 21:9", results[1], { width: 3072, height: 1280 });
    checkLiveImage("Fal i2i 1K 16:9", results[2], { width: 1024, height: 576 });
    checkLiveImage("Fal i2i auto with reference", results[3]);
  }

  console.log("\n=== 4. Google AI Studio GA ids, live ===");
  if (!GEMINI_KEY) {
    console.log("  ! GEMINI_API_KEY missing - skipping Google AI Studio live tests");
  } else {
    for (const modelId of ["gemini-3.1-flash-image", "gemini-3-pro-image"]) {
      const base = { providerId: "gemini", modelId, apiKey: GEMINI_KEY, aspectRatio: "1:1", imageSize: "1K" } as const;
      const [t2i, edit] = await Promise.all([
        generateWithGemini({ ...base, prompt: T2I_PROMPT }),
        generateWithGemini({ ...base, prompt: EDIT_PROMPT, inputImages: [REFERENCE_PNG] }),
      ]);
      checkLiveImage(`${modelId} t2i 1K 1:1`, t2i);
      checkLiveImage(`${modelId} i2i 1K 1:1`, edit);
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
