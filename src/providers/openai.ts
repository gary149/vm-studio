import type { GenerationRequest, GenerationResult, AspectRatio } from "../types";
import { base64ToUint8Array } from "./utils";

const OPENAI_BASE_URL = "https://api.openai.com/v1/images";

// Map aspect ratio to OpenAI size
// GPT Image sizes: 1024x1024, 1536x1024, 1024x1536, auto
function getOpenAISize(aspectRatio: AspectRatio): string {
  const mapping: Partial<Record<AspectRatio, string>> = {
    "1:1": "1024x1024",
    "3:2": "1536x1024",
    "16:9": "1536x1024",
    "4:3": "1536x1024",
    "5:4": "1024x1024",
    "21:9": "1536x1024",
    "2:3": "1024x1536",
    "9:16": "1024x1536",
    "3:4": "1024x1536",
    "4:5": "1024x1536",
  };

  if (aspectRatio === "auto") return "auto";
  return mapping[aspectRatio] || "1024x1024";
}

interface OpenAIResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message: string;
    code?: string;
  };
}

export async function generateWithOpenAI(
  request: GenerationRequest,
  onProgress?: (status: string) => void,
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, inputImages } = request;

  if (!apiKey) {
    return { success: false, error: "OpenAI API key is required" };
  }

  onProgress?.("Sending request to OpenAI...");

  try {
    const hasInputImages = inputImages && inputImages.length > 0;

    const endpoint = hasInputImages
      ? `${OPENAI_BASE_URL}/edits`
      : `${OPENAI_BASE_URL}/generations`;

    const body: Record<string, unknown> = {
      model: modelId,
      prompt,
      n: 1,
      size: getOpenAISize(aspectRatio || "auto"),
      output_format: "png",
    };

    // Add input images for editing
    if (hasInputImages) {
      body.image = inputImages.map((b64) => `data:image/png;base64,${b64}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = (await response
        .json()
        .catch(() => ({}))) as OpenAIResponse;
      const errorMessage =
        errorData.error?.message || `HTTP ${response.status}`;
      return { success: false, error: `OpenAI error: ${errorMessage}` };
    }

    onProgress?.("Processing response...");

    const data: OpenAIResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      return { success: false, error: "No images in OpenAI response" };
    }

    const base64Data = data.data[0].b64_json;
    if (!base64Data) {
      return { success: false, error: "No image data in OpenAI response" };
    }

    onProgress?.("Extracting image data...");

    const imageData = base64ToUint8Array(base64Data);

    return {
      success: true,
      imageData,
      mimeType: "image/png",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}
