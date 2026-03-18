import {ChatOpenAI} from '@langchain/openai';

export type NvidiaModelConfig = {
  provider: 'nvidia';
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
};

export function getNvidiaRuntimeSummary() {
  return {
    provider: 'nvidia' as const,
    configured: Boolean(process.env.NVIDIA_API_KEY),
    baseUrl: process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
    model: process.env.NVIDIA_MODEL ?? 'nvidia/nemotron-3-super-120b-a12b',
  };
}

export function getNvidiaModelConfig(): NvidiaModelConfig {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is required for the worker model provider');
  }

  return {
    provider: 'nvidia',
    apiKey,
    baseUrl: process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
    model: process.env.NVIDIA_MODEL ?? 'nvidia/nemotron-3-super-120b-a12b',
    temperature: Number(process.env.NVIDIA_TEMPERATURE ?? '0.1'),
    maxTokens: Number(process.env.NVIDIA_MAX_TOKENS ?? '4096'),
  };
}

export function createNvidiaChatModel(config: NvidiaModelConfig = getNvidiaModelConfig()) {
  return new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    configuration: {
      baseURL: config.baseUrl,
    },
  });
}
