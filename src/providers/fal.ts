import type { GenerationRequest, GenerationResult, AspectRatio, ImageSize } from '../types';
import { extractImageFromDataUrl } from './utils';

const FAL_BASE_URL = 'https://fal.run';

// Calculate Z-Image dimensions based on aspect ratio and image size
function getZImageDimensions(aspectRatio: AspectRatio, imageSize: ImageSize): { width: number; height: number } {
  // Base sizes for each resolution tier (long edge)
  const baseSizes: Record<ImageSize, number> = {
    '1K': 1024,
    '2K': 2048,
    '4K': 4096
  };

  const baseSize = baseSizes[imageSize] || 1024;

  // Aspect ratio multipliers [width, height]
  const ratios: Record<AspectRatio, [number, number]> = {
    'auto': [4, 3],
    '1:1': [1, 1],
    '16:9': [16, 9],
    '9:16': [9, 16],
    '4:3': [4, 3],
    '3:4': [3, 4],
    '3:2': [3, 2],
    '2:3': [2, 3],
    '5:4': [5, 4],
    '4:5': [4, 5],
    '21:9': [21, 9]
  };

  const [wRatio, hRatio] = ratios[aspectRatio] || [4, 3];

  // Calculate dimensions where the longer edge equals baseSize
  if (wRatio >= hRatio) {
    const width = baseSize;
    const height = Math.round(baseSize * hRatio / wRatio);
    return { width, height };
  } else {
    const height = baseSize;
    const width = Math.round(baseSize * wRatio / hRatio);
    return { width, height };
  }
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

interface FalErrorResponse {
  detail?: string;
  error?: string;
}

export async function generateWithFal(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, imageSize, inputImages } = request;

  if (!apiKey) {
    return { success: false, error: 'Fal.ai API key is required' };
  }

  onProgress?.('Sending request to Fal.ai...');

  try {
    const hasInputImages = inputImages && inputImages.length > 0;
    const isZImage = modelId.includes('z-image');

    // Use /edit endpoint for image-to-image
    const endpoint = hasInputImages
      ? `${FAL_BASE_URL}/${modelId}/edit`
      : `${FAL_BASE_URL}/${modelId}`;

    const body: Record<string, unknown> = {
      prompt,
      num_images: 1,
      output_format: 'png',
      sync_mode: true  // Return data URI directly, avoids CDN fetch
    };

    // Add input images for image-to-image
    if (hasInputImages) {
      body.image_urls = inputImages.map(base64 => `data:image/png;base64,${base64}`);
    }

    if (isZImage) {
      // Z-Image supports custom width/height dimensions
      body.image_size = getZImageDimensions(aspectRatio || 'auto', imageSize || '1K');
      body.num_inference_steps = 8;
    } else {
      // Other Fal models use aspect_ratio and resolution
      if (aspectRatio && aspectRatio !== 'auto') {
        body.aspect_ratio = aspectRatio;
      }
      if (imageSize) {
        body.resolution = imageSize;
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as FalErrorResponse;
      const errorMessage = errorData.detail || errorData.error || `HTTP ${response.status}`;
      return { success: false, error: `Fal.ai error: ${errorMessage}` };
    }

    onProgress?.('Processing response...');

    const data: FalResponse = await response.json();

    if (!data.images || data.images.length === 0) {
      return { success: false, error: 'No images in Fal.ai response' };
    }

    // With sync_mode: true, the URL is a data URI
    const dataUrl = data.images[0].url;

    onProgress?.('Extracting image data...');
    return await extractImageFromDataUrl(dataUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}
