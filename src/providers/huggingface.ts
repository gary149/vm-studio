import { InferenceClient } from "@huggingface/inference";
import type {
  GenerationRequest,
  GenerationResult,
  AspectRatio,
  ImageSize,
} from "../types";

// Calculate dimensions based on aspect ratio and image size
function getDimensions(
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

export async function generateWithHuggingFace(
  request: GenerationRequest,
  onProgress?: (status: string) => void,
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, imageSize, inputImages } =
    request;

  if (!apiKey) {
    return { success: false, error: "Hugging Face token is required" };
  }

  onProgress?.("Sending request to Hugging Face...");

  try {
    const client = new InferenceClient(apiKey);
    const hasInputImages = inputImages && inputImages.length > 0;

    // Calculate dimensions
    const dimensions = getDimensions(aspectRatio || "auto", imageSize || "1K");

    if (hasInputImages) {
      // Image-to-image generation
      onProgress?.("Processing image-to-image request...");

      // Convert base64 to Blob
      const base64Data = inputImages[0];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const imageBlob = new Blob([bytes], { type: "image/png" });

      const resultBlob = await client.imageToImage({
        model: modelId,
        inputs: imageBlob,
        provider: "fal-ai",
        parameters: {
          prompt,
          width: dimensions.width,
          height: dimensions.height,
        },
      });

      onProgress?.("Processing response...");

      const arrayBuffer = await resultBlob.arrayBuffer();
      const imageData = new Uint8Array(arrayBuffer);
      return {
        success: true,
        imageData,
        mimeType: resultBlob.type || "image/png",
      };
    } else {
      // Text-to-image generation
      onProgress?.("Generating image...");

      const result = await client.textToImage({
        model: modelId,
        inputs: prompt,
        provider: "fal-ai",
        parameters: {
          width: dimensions.width,
          height: dimensions.height,
          num_inference_steps: 8,
        },
      });

      onProgress?.("Processing response...");

      // SDK returns Blob at runtime but TypeScript infers string for provider calls
      // Handle both cases for robustness
      let arrayBuffer: ArrayBuffer;
      let mimeType = "image/png";

      if (typeof result === "string") {
        // Result is a URL, fetch the image
        const response = await fetch(result);
        arrayBuffer = await response.arrayBuffer();
        mimeType = response.headers.get("content-type") || "image/png";
      } else {
        // Result is a Blob
        arrayBuffer = await (result as Blob).arrayBuffer();
        mimeType = (result as Blob).type || "image/png";
      }

      const imageData = new Uint8Array(arrayBuffer);
      return {
        success: true,
        imageData,
        mimeType,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}
