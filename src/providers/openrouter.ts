import type { GenerationRequest, GenerationResult } from '../types';

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

    // Add image config if aspect ratio or size specified
    if (aspectRatio || imageSize) {
      const imageConfig: Record<string, string> = {};
      if (aspectRatio) imageConfig.aspect_ratio = aspectRatio;
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

async function extractImageFromDataUrl(dataUrl: string): Promise<GenerationResult> {
  try {
    // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return { success: false, error: 'Invalid data URL format' };
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const imageData = base64ToUint8Array(base64Data);

    return {
      success: true,
      imageData,
      mimeType
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to extract image from data URL: ${message}` };
  }
}

async function fetchImageFromUrl(url: string): Promise<GenerationResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `Failed to download image: HTTP ${response.status}` };
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const imageData = new Uint8Array(arrayBuffer);

    return {
      success: true,
      imageData,
      mimeType: blob.type || 'image/png'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to download image: ${message}` };
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Decode base64 without using atob (not available in Figma sandbox)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Remove padding and calculate length
  let bufferLength = Math.floor(base64.length * 0.75);
  if (base64[base64.length - 1] === '=') bufferLength--;
  if (base64[base64.length - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;

  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return bytes;
}
