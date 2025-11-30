import type { GenerationRequest, GenerationResult } from '../types';
import { fetchImageFromUrl } from './utils';

const REPLICATE_BASE_URL = 'https://api.replicate.com/v1';
const MODEL_VERSION = 'dd58413c945870f8e6dc8204654079c60d577e76dc46a920c24dbe6a84a4cd9d';

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string;
  error?: string;
  urls?: {
    get: string;
  };
}

export async function generateWithReplicate(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const { prompt, apiKey, aspectRatio, imageSize } = request;

  if (!apiKey) {
    return { success: false, error: 'Replicate API key is required' };
  }

  onProgress?.('Creating prediction...');

  // Build input parameters
  const input: Record<string, unknown> = {
    prompt,
    output_format: 'png',
    safety_filter_level: 'block_only_high'
  };

  // Map our params to Replicate's expected params
  if (aspectRatio && aspectRatio !== 'auto') {
    input.aspect_ratio = aspectRatio;
  }
  if (imageSize) {
    input.resolution = imageSize;
  }

  // Create prediction
  let createResponse: Response;
  try {
    createResponse = await fetch(`${REPLICATE_BASE_URL}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input
      })
    });
  } catch (error) {
    return { success: false, error: `Network error creating prediction: ${formatError(error)}` };
  }

  if (!createResponse.ok) {
    const errorData = await createResponse.json().catch(() => ({}));
    const errorMessage = (errorData as { detail?: string }).detail || `HTTP ${createResponse.status}`;
    return { success: false, error: `Replicate error: ${errorMessage}` };
  }

  let prediction: ReplicatePrediction;
  try {
    prediction = await createResponse.json();
  } catch (error) {
    return { success: false, error: `Failed to parse prediction response: ${formatError(error)}` };
  }

  if (!prediction.id) {
    return { success: false, error: 'No prediction ID in response' };
  }

  onProgress?.('Generating image...');

  // Poll for completion
  const pollUrl = prediction.urls?.get || `${REPLICATE_BASE_URL}/predictions/${prediction.id}`;
  let result = prediction;
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes max

  while (result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled') {
    if (attempts >= maxAttempts) {
      return { success: false, error: 'Generation timed out' };
    }

    await sleep(1000);
    attempts++;

    let pollResponse: Response;
    try {
      pollResponse = await fetch(pollUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
    } catch (error) {
      return { success: false, error: `Network error polling status: ${formatError(error)}` };
    }

    if (!pollResponse.ok) {
      return { success: false, error: `Failed to check prediction status: HTTP ${pollResponse.status}` };
    }

    try {
      result = await pollResponse.json();
    } catch (error) {
      return { success: false, error: `Failed to parse poll response: ${formatError(error)}` };
    }

    if (result.status === 'processing') {
      onProgress?.('Processing...');
    }
  }

  if (result.status === 'failed') {
    return { success: false, error: result.error || 'Generation failed' };
  }

  if (result.status === 'canceled') {
    return { success: false, error: 'Generation was canceled' };
  }

  if (!result.output) {
    return { success: false, error: 'No output in prediction result' };
  }

  onProgress?.('Downloading image...');

  // Fetch the image from the URL
  return await fetchImageFromUrl(result.output);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else if (error && typeof error === 'object') {
    return JSON.stringify(error);
  }
  return 'Unknown error';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
