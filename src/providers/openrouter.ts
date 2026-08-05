import type { AspectRatio, GenerationRequest, GenerationResult } from "../types";
import {
  base64ToUint8Array,
  extractImageFromDataUrl,
  fetchImageFromUrl,
} from "./utils";
import {
  getApiModelId,
  getModelSupportedImageSizes,
  modelUsesImagesApi,
} from "./index";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const OPENROUTER_HEADERS = (apiKey: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
  "HTTP-Referer": "https://figma.com",
  "X-Title": "VM Studio Figma Plugin",
});

interface OpenRouterImageUrl {
  type: string;
  image_url: {
    url: string;
  };
}

interface OpenRouterMessage {
  role: string;
  content?:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  images?: OpenRouterImageUrl[];
  refusal?: string | null;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: OpenRouterMessage;
  }>;
  error?: {
    message: string;
    code: string | number;
  };
}

// Response shape of the dedicated Images API (POST /api/v1/images)
interface OpenRouterImagesResponse {
  data?: Array<{ b64_json?: string; media_type?: string }>;
  error?: {
    message: string;
    code: string | number;
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const errorText = await response.text().catch(() => "");
  let errorMessage = `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(errorText) as OpenRouterResponse;
    if (parsed.error?.message) errorMessage = parsed.error.message;
  } catch {
    if (errorText) errorMessage = errorText.slice(0, 300);
  }
  return errorMessage;
}

// Aspect ratios accepted per model family on the Images API. OpenRouter
// rejects unsupported values with HTTP 400 (no server-side clamping), so
// unsupported ratios snap to the numerically closest accepted one.
// Seedream 4.5 accepts every ratio the plugin offers - no entry needed.
const KREA_2_RATIOS: AspectRatio[] = [
  "1:1",
  "4:3",
  "3:2",
  "16:9",
  "4:5",
  "2:3",
  "9:16",
];
const MAI_IMAGE_RATIOS: AspectRatio[] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
];
const GPT_IMAGE_RATIOS: AspectRatio[] = [
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "21:9",
];

function getAcceptedRatios(apiModelId: string): AspectRatio[] | null {
  if (apiModelId.startsWith("krea/")) return KREA_2_RATIOS;
  if (apiModelId.includes("mai-image")) return MAI_IMAGE_RATIOS;
  if (apiModelId.includes("gpt-image")) return GPT_IMAGE_RATIOS;
  return null; // pass through unchanged
}

function ratioValue(ratio: string): number {
  const [w, h] = ratio.split(":");
  return Number(w) / Number(h);
}

function snapAspectRatio(
  ratio: AspectRatio,
  accepted: AspectRatio[] | null,
): AspectRatio {
  if (!accepted || accepted.includes(ratio)) return ratio;
  const target = ratioValue(ratio);
  let closest = accepted[0];
  let closestDistance = Infinity;
  for (const candidate of accepted) {
    // Log-space distance treats e.g. 2:1 and 1:2 as equally far from 1:1
    const distance = Math.abs(Math.log(ratioValue(candidate) / target));
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }
  return closest;
}

// Models limited to a single reference image on the Images API
function acceptsSingleReferenceOnly(apiModelId: string): boolean {
  return apiModelId.startsWith("krea/") || apiModelId.includes("mai-image");
}

// Image-only models (Seedream, Krea, MAI-Image, GPT-Image) are served by the
// dedicated Images API rather than chat completions.
async function generateViaImagesApi(
  request: GenerationRequest,
  onProgress?: (status: string) => void,
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, imageSize, inputImages } =
    request;
  const apiModelId = getApiModelId(modelId);

  onProgress?.("Sending request to OpenRouter...");

  try {
    const body: Record<string, unknown> = {
      model: apiModelId,
      prompt,
    };

    const hasAspectRatio = aspectRatio && aspectRatio !== "auto";
    if (hasAspectRatio) {
      body.aspect_ratio = snapAspectRatio(
        aspectRatio,
        getAcceptedRatios(apiModelId),
      );
    }

    // Only models with multiple size tiers accept the resolution param
    const hasResolutionTiers = getModelSupportedImageSizes(modelId).some(
      (size) => size !== "1K",
    );
    if (imageSize && hasResolutionTiers) {
      body.resolution = imageSize;
    }

    if (inputImages && inputImages.length > 0) {
      if (acceptsSingleReferenceOnly(apiModelId) && inputImages.length > 1) {
        return {
          success: false,
          error:
            "This model accepts a single input image. Select one layer and try again.",
        };
      }
      body.input_references = inputImages.map((base64) => ({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}` },
      }));
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
      method: "POST",
      headers: OPENROUTER_HEADERS(apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `OpenRouter error: ${await readErrorMessage(response)}`,
      };
    }

    onProgress?.("Processing response...");

    const data: OpenRouterImagesResponse = await response.json();
    const image = data.data?.[0];

    if (!image?.b64_json) {
      return { success: false, error: "No image in OpenRouter response" };
    }

    onProgress?.("Extracting image data...");
    return {
      success: true,
      imageData: base64ToUint8Array(image.b64_json),
      mimeType: image.media_type || "image/png",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}

// Chat-multimodal models (the Gemini "Nano Banana" family) generate images
// through chat completions with image output modality.
async function generateViaChatCompletions(
  request: GenerationRequest,
  onProgress?: (status: string) => void,
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, imageSize, inputImages } =
    request;

  onProgress?.("Sending request to OpenRouter...");

  try {
    const url = `${OPENROUTER_BASE_URL}/chat/completions`;
    const hasInputImages = inputImages && inputImages.length > 0;

    // Build message content - images first, then text
    let messageContent:
      | string
      | Array<{ type: string; text?: string; image_url?: { url: string } }>;

    if (hasInputImages) {
      const contentParts: Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
      }> = [];

      // Add input images first
      for (const base64 of inputImages) {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${base64}` },
        });
      }

      // Add text prompt
      contentParts.push({
        type: "text",
        text: prompt,
      });

      messageContent = contentParts;
    } else {
      messageContent = `Generate an image: ${prompt}`;
    }

    const body: Record<string, unknown> = {
      model: getApiModelId(modelId),
      modalities: ["text", "image"],
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    };

    // Add image config if aspect ratio (non-auto) or size specified
    const hasAspectRatio = aspectRatio && aspectRatio !== "auto";
    if (hasAspectRatio || imageSize) {
      const imageConfig: Record<string, string> = {};
      if (hasAspectRatio) imageConfig.aspect_ratio = aspectRatio;
      if (imageSize) imageConfig.image_size = imageSize;
      body.image_config = imageConfig;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: OPENROUTER_HEADERS(apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `OpenRouter error: ${await readErrorMessage(response)}`,
      };
    }

    onProgress?.("Processing response...");

    const data: OpenRouterResponse = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message) {
      return { success: false, error: "No message in OpenRouter response" };
    }

    // Check for images array (new format from Gemini 3 Pro)
    if (message.images && message.images.length > 0) {
      const imageUrl = message.images[0]?.image_url?.url;
      if (imageUrl) {
        onProgress?.("Extracting image data...");
        return await extractImageFromDataUrl(imageUrl);
      }
    }

    // Fallback: check content field
    const content = message.content;

    if (!content) {
      return {
        success: false,
        error: "No content or images in OpenRouter response",
      };
    }

    // Handle different response formats
    let imageUrl: string | null = null;

    if (typeof content === "string") {
      // Check if content is a URL or base64
      if (content.startsWith("http")) {
        imageUrl = content;
      } else if (content.startsWith("data:image")) {
        return await extractImageFromDataUrl(content);
      }
    } else if (Array.isArray(content)) {
      // Array format with image_url
      const imagePart = content.find((part) => part.type === "image_url");
      if (imagePart?.image_url?.url) {
        const url = imagePart.image_url.url;
        if (url.startsWith("data:image")) {
          return await extractImageFromDataUrl(url);
        }
        imageUrl = url;
      }
    }

    if (imageUrl) {
      onProgress?.("Downloading image...");
      return await fetchImageFromUrl(imageUrl);
    }

    return { success: false, error: "Could not extract image from response" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}

export async function generateWithOpenRouter(
  request: GenerationRequest,
  onProgress?: (status: string) => void,
): Promise<GenerationResult> {
  if (!request.apiKey) {
    return { success: false, error: "OpenRouter API key is required" };
  }

  if (modelUsesImagesApi(request.modelId)) {
    return generateViaImagesApi(request, onProgress);
  }
  return generateViaChatCompletions(request, onProgress);
}
