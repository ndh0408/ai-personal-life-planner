import { apiClient } from './client';

export interface AiKeyStatus {
  enabled: boolean;
  provider: 'OPENAI' | null;
  maskedApiKey: string | null;
  lastTestStatus: 'SUCCESS' | 'FAILED' | null;
  lastTestedAt: string | null;
}

export interface TestAiKeyResponse {
  status: 'SUCCESS' | 'FAILED';
  maskedApiKey: string;
  message?: string;
}

export const aiKeyApi = {
  setupOpenAi(apiKey: string) {
    return apiClient.request<AiKeyStatus>('POST', '/ai-key/setup-openai', { apiKey });
  },
  test() {
    return apiClient.request<TestAiKeyResponse>('POST', '/ai-key/test');
  },
  status() {
    return apiClient.request<AiKeyStatus>('GET', '/ai-key/status');
  },
  remove() {
    return apiClient.request<void>('DELETE', '/ai-key');
  },
};
