import {
  CUSTOM_SCRIPT_LLM_GUIDANCE_END,
  CUSTOM_SCRIPT_LLM_GUIDANCE_START,
  CUSTOM_SCRIPT_TO_TRANSLATE_END,
  CUSTOM_SCRIPT_TO_TRANSLATE_START,
  getEffectiveLlmTranslationGuidance,
  getTargetLanguageLabel,
} from "../shared/llm-guidance.js";
import { filterAndSortOpenAiModels } from "../shared/ai-providers.js";

function buildTranslationRequest(rawText, settings) {
  return {
    instructions: `${getEffectiveLlmTranslationGuidance(settings)}

Return a JSON object with one field named "translated_script". That field must contain only the completed custom script itself, without any extra wrapper markers.`,
    input: String(rawText ?? "").trim(),
  };
}

function buildChunkTranslationRequest({
  courseContext,
  lectureContext,
  chunkCues,
  settings,
}) {
  const targetLanguageLabel = getTargetLanguageLabel(settings.llmTargetLanguage || "ko");
  const customGuidance =
    settings.llmGuidanceMode === "custom"
      ? String(settings.llmTranslationGuidance ?? "").trim()
      : "";

  const instructions = [
    `You are translating one chunk of a Udemy lecture transcript into ${targetLanguageLabel}.`,
    "Read the translation context first and keep terminology, lecture intent, and style consistent.",
    "Write natural, lecture-ready Korean that sounds like an instructor speaking, not a literal machine translation.",
    "Return only valid JSON that matches the requested schema.",
    "The translations array must contain exactly one object for each source entry.",
    "Each translation object must repeat the exact entry_id from the input and provide the translated_text for that entry.",
    "Do not omit, merge, duplicate, reorder, summarize, or explain any entries.",
    "Preserve technical terms, API names, class names, framework names, UI labels, and product names when appropriate.",
    "Preserve explicit identifiers exactly when they are clearly present in the source.",
    "If the speaker is clearly naming or renaming a variable, function, class, tag, stack, widget, or symbol, you may restore the most obvious code-style identifier from spoken clues such as underscore, casing, or common technical phrasing when the nearby entries make that intent highly likely.",
    "This is appropriate for obvious cases such as names strongly indicating forms like _FrontEnd, GameHUD, RegisterWidgetStack, BlueprintCallable, or Modal, but only when the local context clearly shows that a concrete identifier is being named.",
    "Do not convert spoken descriptions into guessed CamelCase names, dotted identifiers, enum values, or code symbols unless the exact identifier is clearly present or overwhelmingly certain from the source.",
    "When short fragmented captions appear, use nearby entries in the same chunk to make each translated line sound natural, but still translate only that entry and keep entry boundaries unchanged.",
    "Avoid abrupt fragments like bare nouns when the local context makes the intended meaning clear.",
    "If the source is noisy or ambiguous, translate conservatively and stay close to the probable spoken meaning.",
    "If code-style reconstruction is not highly confident, keep the spoken form instead of inventing a cleaner identifier.",
    "Do not replace uncertain literals, keywords, identifiers, or values with different concrete guesses such as null, 0, or renamed symbols unless the source clearly supports that choice.",
    customGuidance ? `Additional user guidance:\n${customGuidance}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const input = JSON.stringify(
    {
      course_context: courseContext,
      lecture_context: lectureContext,
      entries: chunkCues.map((cue, index) => ({
        entry_id: String(cue?.entryId || `entry-${index + 1}`),
        timeline: cue.timeline,
        source_text: cue.sourceText,
      })),
    },
    null,
    2
  );

  return {
    instructions,
    input,
  };
}

export function sanitizeOpenAiTranslatedScript(text) {
  return String(text ?? "")
    .replaceAll(CUSTOM_SCRIPT_LLM_GUIDANCE_START, "")
    .replaceAll(CUSTOM_SCRIPT_LLM_GUIDANCE_END, "")
    .replaceAll(CUSTOM_SCRIPT_TO_TRANSLATE_START, "")
    .replaceAll(CUSTOM_SCRIPT_TO_TRANSLATE_END, "")
    .trim();
}

export function extractOpenAiOutputText(responseJson) {
  if (typeof responseJson?.output_text === "string" && responseJson.output_text) {
    return responseJson.output_text;
  }

  const output = Array.isArray(responseJson?.output) ? responseJson.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }

  return "";
}

export async function translateWithOpenAi({
  apiKey,
  model,
  rawText,
  settings,
}) {
  const trimmedApiKey = String(apiKey ?? "").trim();
  if (!trimmedApiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const request = buildTranslationRequest(rawText, settings);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${trimmedApiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: request.instructions,
      input: request.input,
      text: {
        format: {
          type: "json_schema",
          name: "translated_script_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              translated_script: {
                type: "string",
              },
            },
            required: ["translated_script"],
          },
        },
      },
    }),
  });

  const responseJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      responseJson?.error?.message ||
      `OpenAI request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const outputText = extractOpenAiOutputText(responseJson);
  if (!outputText) {
    throw new Error("OpenAI returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (_error) {
    throw new Error("OpenAI returned a response that was not valid JSON.");
  }

  const translatedScript = sanitizeOpenAiTranslatedScript(parsed?.translated_script);
  if (!translatedScript) {
    throw new Error("OpenAI did not return translated_script content.");
  }

  return {
    translatedScript,
    providerResponseId: responseJson?.id || "",
    model: responseJson?.model || model,
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  const responseJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      responseJson?.error?.message ||
      `${fallbackMessage} (status ${response.status}).`;
    throw new Error(message);
  }

  return responseJson;
}

export async function createOpenAiBackgroundResponse({
  apiKey,
  model,
  rawText,
  settings,
  signal,
  onEvent,
}) {
  const trimmedApiKey = String(apiKey ?? "").trim();
  if (!trimmedApiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const request = buildTranslationRequest(rawText, settings);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${trimmedApiKey}`,
    },
    body: JSON.stringify({
      model,
      background: true,
      stream: true,
      instructions: request.instructions,
      input: request.input,
      text: {
        format: {
          type: "json_schema",
          name: "translated_script_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              translated_script: {
                type: "string",
              },
            },
            required: ["translated_script"],
          },
        },
      },
    }),
    signal,
  });

  if (!response.ok) {
    const responseJson = await response.json().catch(() => ({}));
    const message =
      responseJson?.error?.message ||
      `OpenAI background request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (reader) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      const dataLines = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (!dataLines.length) {
        continue;
      }

      const data = dataLines.join("\n");
      if (data === "[DONE]") {
        continue;
      }

      let parsedEvent;
      try {
        parsedEvent = JSON.parse(data);
      } catch (_error) {
        continue;
      }

      await onEvent?.(parsedEvent);
    }
  }
}

export async function createOpenAiChunkTranslationResponse({
  apiKey,
  model,
  courseContext,
  lectureContext,
  chunkCues,
  settings,
  promptCacheKey,
  promptCacheRetention,
  signal,
  onEvent,
}) {
  const trimmedApiKey = String(apiKey ?? "").trim();
  if (!trimmedApiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const request = buildChunkTranslationRequest({
    courseContext,
    lectureContext,
    chunkCues,
    settings,
  });

  const body = {
    model,
    background: true,
    stream: true,
    instructions: request.instructions,
    input: request.input,
    text: {
      format: {
        type: "json_schema",
        name: "translated_chunk_result",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            translations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  entry_id: {
                    type: "string",
                  },
                  translated_text: {
                    type: "string",
                  },
                },
                required: ["entry_id", "translated_text"],
              },
            },
          },
          required: ["translations"],
        },
      },
    },
  };

  if (promptCacheKey) {
    body.prompt_cache_key = promptCacheKey;
  }

  if (promptCacheRetention) {
    body.prompt_cache_retention = promptCacheRetention;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${trimmedApiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const responseJson = await response.json().catch(() => ({}));
    const message =
      responseJson?.error?.message ||
      `OpenAI chunk request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (reader) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      const dataLines = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (!dataLines.length) {
        continue;
      }

      const data = dataLines.join("\n");
      if (data === "[DONE]") {
        continue;
      }

      let parsedEvent;
      try {
        parsedEvent = JSON.parse(data);
      } catch (_error) {
        continue;
      }

      await onEvent?.(parsedEvent);
    }
  }
}

export async function listOpenAiModels({ apiKey }) {
  const trimmedApiKey = String(apiKey ?? "").trim();
  if (!trimmedApiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      authorization: `Bearer ${trimmedApiKey}`,
    },
  });

  const responseJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      responseJson?.error?.message ||
      `OpenAI model request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const models = Array.isArray(responseJson?.data) ? responseJson.data : [];

  return filterAndSortOpenAiModels(
    models.map((entry) => String(entry?.id ?? "").trim())
  );
}

export async function getOpenAiResponse({ apiKey, responseId }) {
  const trimmedApiKey = String(apiKey ?? "").trim();
  const trimmedResponseId = String(responseId ?? "").trim();
  if (!trimmedApiKey) {
    throw new Error("OpenAI API key is missing.");
  }
  if (!trimmedResponseId) {
    throw new Error("OpenAI response id is missing.");
  }

  const response = await fetch(
    `https://api.openai.com/v1/responses/${encodeURIComponent(trimmedResponseId)}`,
    {
      headers: {
        authorization: `Bearer ${trimmedApiKey}`,
      },
    }
  );

  return parseJsonResponse(response, "OpenAI response lookup failed");
}

export async function cancelOpenAiResponse({ apiKey, responseId }) {
  const trimmedApiKey = String(apiKey ?? "").trim();
  const trimmedResponseId = String(responseId ?? "").trim();
  if (!trimmedApiKey) {
    throw new Error("OpenAI API key is missing.");
  }
  if (!trimmedResponseId) {
    throw new Error("OpenAI response id is missing.");
  }

  const response = await fetch(
    `https://api.openai.com/v1/responses/${encodeURIComponent(trimmedResponseId)}/cancel`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${trimmedApiKey}`,
      },
    }
  );

  return parseJsonResponse(response, "OpenAI response cancel failed");
}

export function parseOpenAiChunkTranslations(responseJson, expectedEntries) {
  const outputText = extractOpenAiOutputText(responseJson);
  if (!outputText.trim()) {
    throw new Error("OpenAI returned an empty final response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (_error) {
    throw new Error("OpenAI returned a final response that was not valid JSON.");
  }

  const translations = Array.isArray(parsed?.translations)
    ? parsed.translations
    : [];

  if (!translations.length) {
    throw new Error("OpenAI did not return any translated entries.");
  }

  const normalizedExpectedEntries = Array.isArray(expectedEntries)
    ? expectedEntries.map((entry, index) => ({
        entryId: String(entry?.entryId || `entry-${index + 1}`),
        timeline: String(entry?.timeline || ""),
      }))
    : [];

  if (!normalizedExpectedEntries.length) {
    throw new Error("No source entries were provided for chunk translation validation.");
  }

  const usesObjectFormat = translations.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof entry.entry_id === "string"
  );

  if (!usesObjectFormat) {
    const legacyTranslations = translations.map((value) => String(value ?? "").trim());
    if (legacyTranslations.length !== normalizedExpectedEntries.length) {
      throw new Error(
        `OpenAI returned ${legacyTranslations.length} translated entries for ${normalizedExpectedEntries.length} source entries.`
      );
    }

    return legacyTranslations;
  }

  if (translations.length !== normalizedExpectedEntries.length) {
    throw new Error(
      `OpenAI returned ${translations.length} translated entries for ${normalizedExpectedEntries.length} source entries.`
    );
  }

  const translationMap = new Map();

  for (const entry of translations) {
    const entryId = String(entry?.entry_id || "").trim();
    const translatedText = String(entry?.translated_text ?? "").trim();

    if (!entryId) {
      throw new Error("OpenAI returned a translated entry without entry_id.");
    }

    if (translationMap.has(entryId)) {
      throw new Error(`OpenAI returned duplicate translations for entry_id "${entryId}".`);
    }

    translationMap.set(entryId, translatedText);
  }

  const resolvedTranslations = [];
  for (const entry of normalizedExpectedEntries) {
    if (!translationMap.has(entry.entryId)) {
      throw new Error(
        `OpenAI did not return a translated entry for entry_id "${entry.entryId}".`
      );
    }

    resolvedTranslations.push(translationMap.get(entry.entryId));
  }

  const unknownEntryIds = [...translationMap.keys()].filter(
    (entryId) =>
      !normalizedExpectedEntries.some((expectedEntry) => expectedEntry.entryId === entryId)
  );
  if (unknownEntryIds.length) {
    throw new Error(
      `OpenAI returned unknown entry ids: ${unknownEntryIds.slice(0, 3).join(", ")}`
    );
  }

  return resolvedTranslations;
}
