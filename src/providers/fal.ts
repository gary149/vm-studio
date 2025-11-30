import type { GenerationRequest, GenerationResult } from '../types';
import { extractImageFromDataUrl } from './utils';

const FAL_ENDPOINT = 'https://fal.run/fal-ai/nano-banana-pro';

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
  const { prompt, apiKey, aspectRatio, imageSize } = request;

  if (!apiKey) {
    return { success: false, error: 'Fal.ai API key is required' };
  }

  onProgress?.('Sending request to Fal.ai...');

  try {
    const body: Record<string, unknown> = {
      prompt,
      num_images: 1,
      output_format: 'png',
      sync_mode: true  // Return data URI directly, avoids CDN fetch
    };

    // Map aspect ratio (our values match Fal.ai's format)
    if (aspectRatio && aspectRatio !== 'auto') {
      body.aspect_ratio = aspectRatio;
    }

    // Map image size to resolution (our values match Fal.ai's)
    if (imageSize) {
      body.resolution = imageSize;
    }

    const response = await fetch(FAL_ENDPOINT, {
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
