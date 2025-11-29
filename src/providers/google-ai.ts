import type { GenerationRequest, GenerationResult } from '../types';

const GOOGLE_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GoogleAIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export async function generateWithGoogleAI(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey } = request;

  if (!apiKey) {
    return { success: false, error: 'Google AI API key is required' };
  }

  onProgress?.('Sending request to Google AI...');

  try {
    // For Imagen models, use a different endpoint
    if (modelId.startsWith('imagen')) {
      return await generateWithImagen(request, onProgress);
    }

    // For Gemini models with image generation
    const url = `${GOOGLE_AI_BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [{
          text: `Generate an image based on this description: ${prompt}`
        }]
      }],
      generationConfig: {
        responseModalities: ["image", "text"],
        responseMimeType: "image/png"
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as GoogleAIResponse).error?.message || `HTTP ${response.status}`;
      return { success: false, error: `Google AI error: ${errorMessage}` };
    }

    onProgress?.('Processing response...');

    const data: GoogleAIResponse = await response.json();

    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(part => part.inlineData);

    if (!imagePart?.inlineData) {
      return { success: false, error: 'No image generated in response' };
    }

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

async function generateWithImagen(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const { prompt, modelId, apiKey } = request;

  const url = `${GOOGLE_AI_BASE_URL}/models/${modelId}:predict?key=${apiKey}`;

  const body = {
    instances: [{
      prompt: prompt
    }],
    parameters: {
      sampleCount: 1,
      aspectRatio: request.aspectRatio || "1:1",
      outputOptions: {
        mimeType: "image/png"
      }
    }
  };

  onProgress?.('Generating with Imagen...');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Imagen error: ${errorText}` };
  }

  const data = await response.json();

  // Imagen returns predictions array with bytesBase64Encoded
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    return { success: false, error: 'No image in Imagen response' };
  }

  const imageData = base64ToUint8Array(prediction.bytesBase64Encoded);

  return {
    success: true,
    imageData,
    mimeType: 'image/png'
  };
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
