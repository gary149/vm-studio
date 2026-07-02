import type {
  GenerationRequest,
  GenerationResult,
  AspectRatio,
  ImageSize,
} from "../types";
import { extractImageFromDataUrl, fetchImageFromUrl } from "./utils";
import { getApiModelId } from "./index";

const FAL_BASE_URL = "https://fal.run";

// Calculate Z-Image dimensions based on aspect ratio and image size
function getZImageDimensions(
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
): { width: number; height: number } {
  // Base sizes for each resolution tier (long edge)
  const baseSizes: Record<ImageSize, number> = {
    "1K": 1024,
    "2K": 2048,
    "4K": 4096,
  };

  const baseSize = baseSizes[imageSize] || 1024;

  // Aspect ratio multipliers [width, height]
  const ratios: Record<AspectRatio, [number, number]> = {
    auto: [4, 3],
    "1:1": [1, 1],
    "16:9": [16, 9],
    "9:16": [9, 16],
    "4:3": [4, 3],
    "3:4": [3, 4],
    "3:2": [3, 2],
    "2:3": [2, 3],
    "5:4": [5, 4],
    "4:5": [4, 5],
    "21:9": [21, 9],
  };

  const [wRatio, hRatio] = ratios[aspectRatio] || [4, 3];

  // Calculate dimensions where the longer edge equals baseSize
  if (wRatio >= hRatio) {
    const width = baseSize;
    const height = Math.round((baseSize * hRatio) / wRatio);
    return { width, height };
  } else {
    const height = baseSize;
    const width = Math.round((baseSize * wRatio) / hRatio);
    return { width, height };
  }
}

// Map aspect ratio to GPT-Image size enum
// t2i: "1024x1024", "1536x1024", "1024x1536" (no "auto")
// edit: adds "auto" option
function getGptImageSize(aspectRatio: AspectRatio, allowAuto: boolean): string {
  const mapping: Partial<Record<AspectRatio, string>> = {
    "1:1": "1024x1024",
    "3:2": "1536x1024",
    "16:9": "1536x1024",
    "4:3": "1536x1024",
    "21:9": "1536x1024",
    "5:4": "1024x1024",
    "2:3": "1024x1536",
    "9:16": "1024x1536",
    "3:4": "1024x1536",
    "4:5": "1024x1536",
  };
  if (aspectRatio === "auto") {
    return allowAuto ? "auto" : "1024x1024";
  }
  return mapping[aspectRatio] || "1024x1024";
}

// Snap a width/height pair to GPT-Image 2 constraints:
// multiples of 16, long edge <= 3840.
function snapGptImage2Dimensions(dims: {
  width: number;
  height: number;
}): { width: number; height: number } {
  const longEdge = Math.max(dims.width, dims.height);
  const scale = longEdge > 3840 ? 3840 / longEdge : 1;
  const snap = (n: number) => Math.max(16, Math.floor((n * scale) / 16) * 16);
  return { width: snap(dims.width), height: snap(dims.height) };
}

// Map aspect ratio to GPT-Image 2 size (preset enum or custom dimensions).
// "auto" is only valid on the /edit endpoint; on t2i it returns 422.
// Preset enums are all 1K-tier, so 2K/4K always uses custom dimensions.
function getGptImage2Size(
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  allowAuto: boolean,
): string | { width: number; height: number } {
  if (aspectRatio === "auto") {
    if (allowAuto) return "auto";
    return imageSize === "1K"
      ? "landscape_4_3"
      : snapGptImage2Dimensions(getZImageDimensions("4:3", imageSize));
  }

  if (imageSize === "1K") {
    const enumMapping: Partial<Record<AspectRatio, string>> = {
      "1:1": "square_hd",
      "4:3": "landscape_4_3",
      "3:4": "portrait_4_3",
      "16:9": "landscape_16_9",
      "9:16": "portrait_16_9",
    };
    const enumValue = enumMapping[aspectRatio];
    if (enumValue) return enumValue;
  }

  return snapGptImage2Dimensions(getZImageDimensions(aspectRatio, imageSize));
}

// Map aspect ratio to FLUX.2 size (enum or custom dimensions)
function getFlux2ImageSize(
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
): string | { width: number; height: number } {
  // FLUX.2 supported enum values
  const enumMapping: Partial<Record<AspectRatio, string>> = {
    "1:1": "square_hd",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
  };

  if (aspectRatio === "auto") {
    return "landscape_4_3"; // FLUX.2 default
  }

  const enumValue = enumMapping[aspectRatio];
  if (enumValue) {
    return enumValue;
  }

  // Fallback to custom dimensions for unsupported ratios (3:2, 2:3, 5:4, 4:5, 21:9)
  return getZImageDimensions(aspectRatio, imageSize);
}

// Map aspect ratio to Krea 2's supported enum values
// (1:1, 4:3, 3:2, 16:9, 2.35:1, 4:5, 2:3, 9:16); unsupported ratios
// snap to the closest available value.
function getKrea2AspectRatio(aspectRatio: AspectRatio): string {
  const mapping: Record<AspectRatio, string> = {
    auto: "1:1", // Krea 2 default
    "1:1": "1:1",
    "16:9": "16:9",
    "9:16": "9:16",
    "4:3": "4:3",
    "3:4": "4:5", // 0.75 is closer to 4:5 (0.8) than to 2:3 (0.67)
    "3:2": "3:2",
    "2:3": "2:3",
    "5:4": "4:3", // 1.25 is closest to 4:3 (1.33)
    "4:5": "4:5",
    "21:9": "2.35:1",
  };
  return mapping[aspectRatio] || "1:1";
}

interface FalImageFile {
  url: string;
  content_type: string;
  file_name?: string;
}

interface FalResponse {
  images: FalImageFile[];
  description?: string;
}

interface FalValidationError {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
}

interface FalErrorResponse {
  detail?: string | FalValidationError[];
  error?: string;
  message?: string;
}

function formatFalError(data: FalErrorResponse, status: number): string {
  if (typeof data.detail === "string" && data.detail) return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    // Group Pydantic union errors by field; pick the most informative msg per field.
    const byField = new Map<string, string>();
    for (const e of data.detail) {
      const loc = Array.isArray(e.loc)
        ? e.loc.filter((p) => p !== "body" && typeof p === "string")
        : [];
      const field = loc[0] ? String(loc[0]) : "";
      const msg = e.msg || "Invalid value";
      if (!byField.has(field) || msg.length > (byField.get(field)?.length || 0)) {
        byField.set(field, msg);
      }
    }
    return Array.from(byField.entries())
      .map(([field, msg]) => (field ? `${field}: ${msg}` : msg))
      .join("; ");
  }
  if (data.error) return data.error;
  if (data.message) return data.message;
  return `HTTP ${status}`;
}

export async function generateWithFal(
  request: GenerationRequest,
  onProgress?: (status: string) => void,
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, imageSize, inputImages } =
    request;

  if (!apiKey) {
    return { success: false, error: "Fal.ai API key is required" };
  }

  onProgress?.("Sending request to Fal.ai...");

  try {
    const hasInputImages = inputImages && inputImages.length > 0;
    const isZImage = modelId.includes("z-image");
    const isSeedream = modelId.includes("seedream");
    const isGptImage2 = modelId.includes("gpt-image-2");
    const isGptImage = modelId.includes("gpt-image-1");
    const isFlux2 = modelId.includes("flux-2");
    // "fal-ai/krea-2/turbo" (open-weights Turbo) vs "krea/v2/..." (Medium/Large
    // partner endpoints) — different API slugs and request formats.
    const isKrea2Turbo = modelId.includes("krea-2");
    const isKrea2 = modelId.includes("krea/v2");
    const isMaiImage = modelId.includes("mai-image");
    const isNanoBananaLite = modelId.includes("nano-banana-lite");

    // The path segment on fal.run is the API slug, which may differ from the
    // internal model id (see getApiModelId).
    const apiModelId = getApiModelId(modelId);

    // Determine endpoint based on model and whether we have input images
    let endpoint: string;
    if (isSeedream) {
      // Seedream uses /text-to-image and /edit suffixes
      endpoint = hasInputImages
        ? `${FAL_BASE_URL}/${apiModelId}/edit`
        : `${FAL_BASE_URL}/${apiModelId}/text-to-image`;
    } else {
      // Other models use base path for t2i, /edit suffix for i2i
      endpoint = hasInputImages
        ? `${FAL_BASE_URL}/${apiModelId}/edit`
        : `${FAL_BASE_URL}/${apiModelId}`;
    }

    // Build body based on model type
    const body: Record<string, unknown> = { prompt };

    // Add input images for image-to-image
    if (hasInputImages) {
      body.image_urls = inputImages.map(
        (base64) => `data:image/png;base64,${base64}`,
      );
    }

    if (isGptImage2) {
      // GPT-Image 2: preset enums (square_hd, landscape_4_3, ...) or custom {width, height}
      body.num_images = 1;
      body.image_size = getGptImage2Size(
        aspectRatio || "auto",
        imageSize || "1K",
        !!hasInputImages,
      );
      body.quality = "high";
      body.output_format = "png";
      body.sync_mode = true;
    } else if (isGptImage) {
      // GPT-Image: t2i doesn't support "auto" size, edit does
      body.image_size = getGptImageSize(
        aspectRatio || "auto",
        !!hasInputImages,
      );
      body.quality = "high";
      body.output_format = "png";
      body.sync_mode = true;
    } else if (isFlux2 || isKrea2Turbo) {
      // FLUX.2 models (turbo, klein/9b) and Krea 2 Turbo share the same
      // enum-based image_size format
      body.num_images = 1;
      body.image_size = getFlux2ImageSize(aspectRatio || "auto", imageSize || "1K");
      body.output_format = "png";
      body.sync_mode = true;
    } else if (isKrea2) {
      // Krea 2 Medium/Large: aspect_ratio enum only; no num_images,
      // output_format, sync_mode, or resolution params in the schema
      body.aspect_ratio = getKrea2AspectRatio(aspectRatio || "auto");
    } else if (isZImage) {
      // Z-Image: custom dimensions, inference steps
      body.num_images = 1;
      body.output_format = "png";
      body.sync_mode = true;
      body.image_size = getZImageDimensions(
        aspectRatio || "auto",
        imageSize || "1K",
      );
      body.num_inference_steps = 8;
    } else if (isSeedream) {
      // Seedream: custom dimensions
      body.num_images = 1;
      body.output_format = "png";
      body.sync_mode = true;
      body.image_size = getZImageDimensions(
        aspectRatio || "auto",
        imageSize || "2K",
      );
    } else if (isMaiImage || isNanoBananaLite) {
      // MAI-Image 2.5 & Nano Banana 2 Lite: aspect_ratio enum (incl. "auto"),
      // no resolution param (fixed 1K output). Nano Banana 2 Lite also supports
      // i2i via the /edit endpoint (image_urls is set generically above).
      body.num_images = 1;
      body.output_format = "png";
      body.sync_mode = true;
      body.aspect_ratio = aspectRatio || "auto";
    } else {
      // Other Fal models: standard params
      body.num_images = 1;
      body.output_format = "png";
      body.sync_mode = true;
      if (aspectRatio && aspectRatio !== "auto") {
        body.aspect_ratio = aspectRatio;
      }
      if (imageSize) {
        body.resolution = imageSize;
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = (await response
        .json()
        .catch(() => ({}))) as FalErrorResponse;
      return {
        success: false,
        error: `Fal.ai error: ${formatFalError(errorData, response.status)}`,
      };
    }

    onProgress?.("Processing response...");

    const data: FalResponse = await response.json();

    if (!data.images || data.images.length === 0) {
      return { success: false, error: "No images in Fal.ai response" };
    }

    const imageUrl = data.images[0].url;

    // Check if it's a data URI or a regular URL
    if (imageUrl.startsWith("data:")) {
      onProgress?.("Extracting image data...");
      return await extractImageFromDataUrl(imageUrl);
    } else {
      onProgress?.("Downloading image...");
      return await fetchImageFromUrl(imageUrl);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}
