import type { GenerationRequest, GenerationResult } from '../types';
import { base64ToUint8Array } from './utils';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export async function generateWithGemini(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey, aspectRatio, imageSize } = request;

  if (!apiKey) {
    return { success: false, error: 'Google AI Studio API key is required' };
  }

  onProgress?.('Sending request to Google AI Studio...');

  try {
    const url = `${GEMINI_ENDPOINT}/${modelId}:generateContent`;

    const body: Record<string, unknown> = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    // Add image config if aspect ratio or size specified
    const hasAspectRatio = aspectRatio && aspectRatio !== 'auto';
    if (hasAspectRatio || imageSize) {
      const imageConfig: Record<string, string> = {};
      if (hasAspectRatio) imageConfig.aspectRatio = aspectRatio;
      if (imageSize) imageConfig.imageSize = imageSize;
      (body.generationConfig as Record<string, unknown>).imageConfig = imageConfig;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as GeminiResponse;
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      return { success: false, error: `Google AI Studio error: ${errorMessage}` };
    }

    onProgress?.('Processing response...');

    const data: GeminiResponse = await response.json();
    const parts = data.candidates?.[0]?.content?.parts;

    if (!parts || parts.length === 0) {
      return { success: false, error: 'No content in Google AI Studio response' };
    }

    // Find the image part
    const imagePart = parts.find(p => p.inlineData?.data);
    if (!imagePart?.inlineData) {
      return { success: false, error: 'No image in Google AI Studio response' };
    }

    onProgress?.('Extracting image data...');

    const { mimeType, data: base64Data } = imagePart.inlineData;
    const imageData = base64ToUint8Array(base64Data);

    return {
      success: true,
      imageData,
      mimeType
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to generate image: ${message}` };
  }
}
