import type { GenerationRequest, GenerationResult } from '../types';
import { generateWithGoogleAI } from './google-ai';
import { generateWithOpenRouter } from './openrouter';

export async function generateImage(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  switch (request.providerId) {
    case 'google-ai':
      return generateWithGoogleAI(request, onProgress);
    case 'openrouter':
      return generateWithOpenRouter(request, onProgress);
    default:
      return { success: false, error: `Unknown provider: ${request.providerId}` };
  }
}
