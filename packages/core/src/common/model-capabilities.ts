export const DEEPSEEK_V4_MODELS = new Set(["deepseek-v4-flash", "deepseek-v4-pro"]);

/**
 * Model used for context compaction (conversation summarization). Since this
 * project exclusively targets DeepSeek models, we always use the fast/cheap
 * flash variant for compaction regardless of the session's active model.
 */
export const COMPACTION_MODEL = "deepseek-v4-flash";

export const NON_MULTIMODAL_MODELS = new Set([
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "deepseek-chat",
  "deepseek-reasoner",
]);

export function defaultsToThinkingMode(model: string): boolean {
  return DEEPSEEK_V4_MODELS.has(model);
}

export function supportsMultimodal(model: string): boolean {
  return !NON_MULTIMODAL_MODELS.has(model.trim());
}
