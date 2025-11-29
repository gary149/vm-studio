import type { GenerationRequest, GenerationResult } from '../types';
import { generateWithOpenRouter } from './openrouter';

export async function generateImage(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  return generateWithOpenRouter(request, onProgress);
}
