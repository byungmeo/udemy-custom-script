export const AI_PROVIDER_OPTIONS = [
  {
    value: "openai",
    label: "OpenAI",
  },
];

export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
export const CUSTOM_OPENAI_MODEL_VALUE = "__custom__";

const OPENAI_MODEL_PRESETS = [
  "gpt-5-mini",
  "gpt-5",
  "gpt-4.1-mini",
  "gpt-4.1",
];

const OPENAI_EXCLUDED_MODEL_PATTERNS = [
  /audio/i,
  /transcrib/i,
  /tts/i,
  /speech/i,
  /realtime/i,
  /search/i,
  /image/i,
  /vision/i,
  /dall[- ]?e/i,
  /whisper/i,
  /embed/i,
  /moderat/i,
  /codex/i,
];
const OPENAI_DATED_MODEL_PATTERN = /-\d{4}-\d{2}-\d{2}$/i;
const OPENAI_MODEL_PRICING = {
  "gpt-5-mini": {
    input: "$0.25",
    cachedInput: "$0.025",
    output: "$2.00",
  },
  "gpt-5": {
    input: "$1.25",
    cachedInput: "$0.125",
    output: "$10.00",
  },
  "gpt-4.1-mini": {
    input: "$0.40",
    cachedInput: "$0.10",
    output: "$1.60",
  },
  "gpt-4.1": {
    input: "$2.00",
    cachedInput: "$0.50",
    output: "$8.00",
  },
};

function tokenizeModelVersion(modelId) {
  return String(modelId)
    .match(/\d+(?:\.\d+)?/g)
    ?.map((token) => Number(token))
    .filter((value) => Number.isFinite(value)) || [];
}

export function isLikelyTextGenerationModel(modelId) {
  const normalized = String(modelId ?? "").trim();
  if (!normalized) {
    return false;
  }

  if (OPENAI_DATED_MODEL_PATTERN.test(normalized)) {
    return false;
  }

  if (OPENAI_EXCLUDED_MODEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return /^(gpt|o\d)/i.test(normalized);
}

export function compareOpenAiModels(leftModelId, rightModelId) {
  const leftNormalized = String(leftModelId ?? "").trim();
  const rightNormalized = String(rightModelId ?? "").trim();
  const leftIsMini = /\bmini\b/i.test(leftNormalized);
  const rightIsMini = /\bmini\b/i.test(rightNormalized);

  if (leftIsMini !== rightIsMini) {
    return leftIsMini ? -1 : 1;
  }

  const leftTokens = tokenizeModelVersion(leftNormalized);
  const rightTokens = tokenizeModelVersion(rightNormalized);
  const tokenCount = Math.max(leftTokens.length, rightTokens.length);

  for (let index = 0; index < tokenCount; index += 1) {
    const leftToken = leftTokens[index] ?? -1;
    const rightToken = rightTokens[index] ?? -1;

    if (leftToken !== rightToken) {
      return rightToken - leftToken;
    }
  }

  return leftNormalized.localeCompare(rightNormalized);
}

export function sortOpenAiModels(modelIds) {
  return [...modelIds].sort(compareOpenAiModels);
}

export function filterAndSortOpenAiModels(modelIds) {
  return sortOpenAiModels(
    [...new Set(modelIds.map((value) => String(value ?? "").trim()).filter(Boolean))].filter(
      isLikelyTextGenerationModel
    )
  );
}

export function getOpenAiModelPricing(modelId) {
  return OPENAI_MODEL_PRICING[String(modelId ?? "").trim()] || null;
}

export function formatOpenAiModelLabel(modelId) {
  const normalized = String(modelId ?? "").trim();
  if (!normalized) {
    return "";
  }

  const pricing = getOpenAiModelPricing(normalized);
  if (!pricing) {
    return normalized;
  }

  return `${normalized} (${pricing.input} in / ${pricing.output} out)`;
}

export const OPENAI_MODEL_OPTIONS = [
  ...sortOpenAiModels(OPENAI_MODEL_PRESETS).map((value) => ({
    value,
    label: formatOpenAiModelLabel(value),
  })),
  { value: CUSTOM_OPENAI_MODEL_VALUE, label: "Custom model" },
];

export function normalizeAiProvider(value) {
  return value === "openai" ? "openai" : "openai";
}

export function normalizeOpenAiModel(value) {
  const normalized = String(value ?? "").trim();
  return normalized || DEFAULT_OPENAI_MODEL;
}
