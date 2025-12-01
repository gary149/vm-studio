import type { GenerationRequest, GenerationResult, ProviderId } from '../types';
import { generateWithFal } from './fal';
import { generateWithGemini } from './gemini';
import { generateWithOpenRouter } from './openrouter';

type GeneratorFn = (
  request: GenerationRequest,
  onProgress?: (status: string) => void
) => Promise<GenerationResult>;

// Provider generator registry - add new providers here
const PROVIDER_GENERATORS: Record<ProviderId, GeneratorFn> = {
  'fal': generateWithFal,
  'gemini': generateWithGemini,
  'openrouter': generateWithOpenRouter,
};

export async function generateImage(
  request: GenerationRequest,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const generator = PROVIDER_GENERATORS[request.providerId];
  if (!generator) {
    return { success: false, error: `Unknown provider: ${request.providerId}` };
  }
  return generator(request, onProgress);
}
