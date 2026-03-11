export const CUSTOM_SCRIPT_LLM_GUIDANCE_START =
  "<<<UDEMY_CUSTOM_SCRIPT_LLM_GUIDANCE>>>";
export const CUSTOM_SCRIPT_LLM_GUIDANCE_END = "<<<END_LLM_GUIDANCE>>>";
export const CUSTOM_SCRIPT_TO_TRANSLATE_START =
  "<<<UDEMY_CUSTOM_SCRIPT_TO_TRANSLATE>>>";
export const CUSTOM_SCRIPT_TO_TRANSLATE_END = "<<<END_SCRIPT_TO_TRANSLATE>>>";

export const LLM_TARGET_LANGUAGE_OPTIONS = [
  { value: "ko", label: "Korean" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "zh-Hans", label: "Simplified Chinese" },
  { value: "zh-Hant", label: "Traditional Chinese" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function getTargetLanguageLabel(targetLanguage) {
  const normalized = normalizeWhitespace(targetLanguage);
  return (
    LLM_TARGET_LANGUAGE_OPTIONS.find((item) => item.value === normalized)?.label ||
    "the requested target language"
  );
}

export function buildDefaultLlmTranslationGuidance(targetLanguage = "ko") {
  const targetLanguageLabel = getTargetLanguageLabel(targetLanguage);

  return `You are translating a Udemy lecture transcript packaged in a custom script format.

Read the JSON metadata block first. Use the course title, description, skill level, section title, lecture title, source language, and transcript update information to infer the lecture's topic, tone, and terminology.

Translate the transcript into ${targetLanguageLabel} unless the surrounding user prompt explicitly asks for a different target language.

Output rules:
- Return only the completed custom script.
- Keep the metadata markers unchanged.
- Keep the JSON metadata structure, keys, values, and spacing unchanged unless the user explicitly asks to edit metadata.
- Keep each cue block structure exactly as three lines.
- Keep line 1 timeline unchanged.
- Keep line 2 source text unchanged.
- Write the translation only on line 3.
- If line 3 is already filled, replace it with a better translation in the requested target language.
- Do not add explanations, markdown fences, notes, summaries, or extra sections.
- Do not merge or split cue blocks.

Translation policy:
- Prefer natural lecture-ready phrasing over literal word-by-word translation.
- Keep technical terms, product names, APIs, class names, framework names, gameplay tags, and UI labels consistent.
- Use established technical vocabulary when it improves clarity.
- Do not invent facts that are not present in the transcript or clearly implied by the metadata.
- Read the metadata carefully to infer the lecture's teaching intent, audience level, and terminology before translating.
- When captions are fragmented because of timing, translate each cue faithfully without adding unrelated context.
- Keep the lecture's instructional intent intact and avoid translations that change the meaning of the lesson.`;
}

export function getEffectiveLlmTranslationGuidance(settings = {}) {
  if (settings.llmGuidanceMode === "custom") {
    const customGuidance = String(settings.llmTranslationGuidance ?? "").trim();
    if (customGuidance) {
      return customGuidance.replace(/\r\n?/g, "\n");
    }
  }

  return buildDefaultLlmTranslationGuidance(settings.llmTargetLanguage || "ko");
}

export function buildClipboardPackage(rawText, settings = {}) {
  const normalizedRawText = String(rawText ?? "").trim();
  if (!normalizedRawText) {
    return "";
  }

  if (!settings.includeLlmGuidanceOnCopy) {
    return normalizedRawText;
  }

  const guidance = getEffectiveLlmTranslationGuidance(settings);

  return [
    CUSTOM_SCRIPT_LLM_GUIDANCE_START,
    guidance,
    CUSTOM_SCRIPT_LLM_GUIDANCE_END,
    CUSTOM_SCRIPT_TO_TRANSLATE_START,
    normalizedRawText,
    CUSTOM_SCRIPT_TO_TRANSLATE_END,
  ].join("\n\n");
}
