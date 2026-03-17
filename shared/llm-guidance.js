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

Read the JSON metadata block first. Use the course title, description, skill level, section title, lecture title, source language, and transcript update information to infer the lecture's topic, tone, terminology, and teaching intent.

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
- Prefer polished, lecture-ready phrasing over literal word-by-word translation.
- Make the Korean read naturally when spoken aloud by an instructor, but keep the lesson meaning intact.
- Keep technical terms, product names, APIs, class names, framework names, gameplay tags, and UI labels consistent.
- Preserve explicit identifiers exactly when the source clearly contains them.
- When the speaker is clearly naming or renaming a variable, function, class, tag, stack, widget, or symbol, you may restore the most obvious code-style identifier from spoken clues such as "underscore", casing, or common technical phrasing if the local context makes it highly likely.
- This applies to obvious cases such as spoken names that strongly indicate forms like _FrontEnd, GameHUD, RegisterWidgetStack, BlueprintCallable, or Modal, but only when the nearby cues clearly show that the speaker is naming a concrete identifier.
- Do not convert spoken descriptions into guessed code identifiers, CamelCase names, dotted paths, enum values, or symbols unless the exact identifier is clearly present or overwhelmingly certain from the source.
- Use established technical vocabulary when it improves clarity, but do not over-normalize ambiguous wording.
- If the code-style reconstruction is not highly confident, keep the spoken form instead of inventing a cleaner identifier.
- Do not invent facts that are not present in the transcript or clearly implied by the metadata.
- Read the metadata carefully to infer the lecture's teaching intent, audience level, and terminology before translating.
- When captions are fragmented because of timing, use the surrounding cues and local context to make each cue sound natural, but still translate only the current cue and keep cue boundaries unchanged.
- Avoid unnatural fragments such as bare noun phrases when nearby cues make the intended meaning clear.
- If ASR or caption text is noisy or ambiguous, translate conservatively and stay close to the probable spoken meaning.
- Do not replace uncertain literals, keywords, or identifiers with different concrete guesses such as different numbers, null values, or renamed symbols.
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
