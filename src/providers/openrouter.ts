import type { GenerationRequest, GenerationResult } from '../types';
import { extractImageFromDataUrl, fetchImageFromUrl } from './utils';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterImageUrl {
  type: string;
  image_url: {
    url: string;
  };
}

interface OpenRouterMessage {
  role: string;
  content?: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
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

export async function generateWithOpenRouter(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, imageSize } = request;

  if (!apiKey) {
    return { success: false, error: 'OpenRouter API key is required' };
  }

  onProgress?.('Sending request to OpenRouter...');

  try {
    const url = `${OPENROUTER_BASE_URL}/chat/completions`;

    const body: Record<string, unknown> = {
      model: modelId,
      messages: [{
        role: 'user',
        content: `Generate an image: ${prompt}`
      }]
    };

    // Add image config if aspect ratio (non-auto) or size specified
    const hasAspectRatio = aspectRatio && aspectRatio !== 'auto';
    if (hasAspectRatio || imageSize) {
      const imageConfig: Record<string, string> = {};
      if (hasAspectRatio) imageConfig.aspect_ratio = aspectRatio;
      if (imageSize) imageConfig.image_size = imageSize;
      body.image_config = imageConfig;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://figma.com',
        'X-Title': 'VM Studio Figma Plugin'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as OpenRouterResponse).error?.message || `HTTP ${response.status}`;
      return { success: false, error: `OpenRouter error: ${errorMessage}` };
    }

    onProgress?.('Processing response...');

    const data: OpenRouterResponse = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message) {
      return { success: false, error: 'No message in OpenRouter response' };
    }

    // Check for images array (new format from Gemini 3 Pro)
    if (message.images && message.images.length > 0) {
      const imageUrl = message.images[0]?.image_url?.url;
      if (imageUrl) {
        onProgress?.('Extracting image data...');
        return await extractImageFromDataUrl(imageUrl);
      }
    }

    // Fallback: check content field
    const content = message.content;

    if (!content) {
      return { success: false, error: 'No content or images in OpenRouter response' };
    }

    // Handle different response formats
    let imageUrl: string | null = null;

    if (typeof content === 'string') {
      // Check if content is a URL or base64
      if (content.startsWith('http')) {
        imageUrl = content;
      } else if (content.startsWith('data:image')) {
        return await extractImageFromDataUrl(content);
      }
    } else if (Array.isArray(content)) {
      // Array format with image_url
      const imagePart = content.find(part => part.type === 'image_url');
      if (imagePart?.image_url?.url) {
        const url = imagePart.image_url.url;
        if (url.startsWith('data:image')) {
          return await extractImageFromDataUrl(url);
        }
        imageUrl = url;
      }
    }

    if (imageUrl) {
      onProgress?.('Downloading image...');
      return await fetchImageFromUrl(imageUrl);
    }

    return { success: false, error: 'Could not extract image from response' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}

