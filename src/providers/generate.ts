import type { GenerationRequest, GenerationResult } from '../types';
import { generateWithOpenRouter } from './openrouter';
import { generateWithReplicate } from './replicate';

export async function generateImage(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  switch (request.providerId) {
    case 'replicate':
      return generateWithReplicate(request, onProgress);
    case 'openrouter':
    default:
      return generateWithOpenRouter(request, onProgress);
  }
}
