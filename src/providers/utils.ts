import type { GenerationResult } from "../types";

// Pre-computed lookup table for base64 decoding (created once, reused)
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(i)] = i;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  // Decode base64 without using atob (not available in Figma sandbox)
  // Remove padding and calculate length
  let bufferLength = Math.floor(base64.length * 0.75);
  if (base64[base64.length - 1] === "=") bufferLength--;
  if (base64[base64.length - 2] === "=") bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;

  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = BASE64_LOOKUP[base64.charCodeAt(i)];
    const encoded2 = BASE64_LOOKUP[base64.charCodeAt(i + 1)];
    const encoded3 = BASE64_LOOKUP[base64.charCodeAt(i + 2)];
    const encoded4 = BASE64_LOOKUP[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return bytes;
}

export async function extractImageFromDataUrl(
  dataUrl: string,
): Promise<GenerationResult> {
  try {
    // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return { success: false, error: "Invalid data URL format" };
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const imageData = base64ToUint8Array(base64Data);

    return {
      success: true,
      imageData,
      mimeType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to extract image from data URL: ${message}`,
    };
  }
}

export async function fetchImageFromUrl(
  url: string,
): Promise<GenerationResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to download image: HTTP ${response.status}`,
      };
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const imageData = new Uint8Array(arrayBuffer);

    return {
      success: true,
      imageData,
      mimeType: blob.type || "image/png",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to download image: ${message}` };
  }
}
