import {
  CUSTOM_SCRIPT_METADATA_END,
  CUSTOM_SCRIPT_METADATA_START,
} from "./constants.js";
import { buildLookupKey } from "./lookup-key.js";
import {
  normalizeMetadata,
  parseCueTimeline,
  validateMetadata,
} from "./metadata.js";

function normalizeLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseMetadataBlock(rawText) {
  const startIndex = rawText.indexOf(CUSTOM_SCRIPT_METADATA_START);
  const endIndex = rawText.indexOf(CUSTOM_SCRIPT_METADATA_END);

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error("Custom script metadata markers are missing or malformed.");
  }

  const jsonStart = startIndex + CUSTOM_SCRIPT_METADATA_START.length;
  const metadataText = rawText.slice(jsonStart, endIndex).trim();

  if (!metadataText) {
    throw new Error("The metadata block is empty.");
  }

  const parsedMetadata = JSON.parse(metadataText);
  const metadata = normalizeMetadata(parsedMetadata);
  const validation = validateMetadata(metadata);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    metadata,
    bodyText: rawText.slice(endIndex + CUSTOM_SCRIPT_METADATA_END.length),
  };
}

function parseCueBlocks(bodyText) {
  const trimmed = bodyText.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/\r?\n\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error(`Invalid cue block: "${block}"`);
      }

      const timeline = normalizeLine(lines[0]);
      const sourceText = normalizeLine(lines[1]);
      const translatedText = normalizeLine(lines.slice(2).join(" "));
      const { startSeconds, endSeconds } = parseCueTimeline(timeline);

      return {
        timeline,
        sourceText,
        translatedText,
        startSeconds,
        endSeconds,
      };
    });
}

export function parseCustomScript(rawText) {
  const { metadata, bodyText } = parseMetadataBlock(rawText);
  metadata.identity.lookup_key = buildLookupKey(metadata.identity);
  const cues = parseCueBlocks(bodyText);
  const normalizedText = serializeCustomScript({
    metadata,
    cues,
  });

  return {
    metadata,
    cues,
    normalizedText,
  };
}

export function serializeCustomScript({ metadata, cues }) {
  const normalizedMetadata = normalizeMetadata(metadata);
  normalizedMetadata.identity.lookup_key = buildLookupKey(
    normalizedMetadata.identity
  );
  const validation = validateMetadata(normalizedMetadata);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const metadataText = JSON.stringify(normalizedMetadata, null, 2);
  const cueBlocks = (cues || []).map((cue) =>
    [
      normalizeLine(cue.timeline),
      normalizeLine(cue.sourceText),
      normalizeLine(cue.translatedText),
    ].join("\n")
  );

  return [
    CUSTOM_SCRIPT_METADATA_START,
    metadataText,
    CUSTOM_SCRIPT_METADATA_END,
    ...cueBlocks,
  ].join("\n\n");
}
