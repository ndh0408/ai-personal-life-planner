// Self-registering prompt modules. Order matters only if two prompts share an id.
import './prompts/capture-classifier';
import './prompts/assistant-system';
import './prompts/weekly-review';

export { registry } from './registry';
export type {
  PromptId,
  PromptDefinition,
  AnyPrompt,
} from './registry';

export { captureClassifierV1 } from './prompts/capture-classifier';
export { assistantSystemV1 } from './prompts/assistant-system';
export { weeklyReviewV1 } from './prompts/weekly-review';
