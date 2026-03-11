import { buildLookupKey } from "./lookup-key.js";

const COURSE_LEVEL_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
  all_levels: "All Levels",
  unknown: "Unknown",
};

function normalizeText(value, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function normalizeMultilineText(value, fallback = "") {
  const normalized = String(value ?? fallback).replace(/\r\n?/g, "\n");
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/[^\S\n]+/g, " ")
        .replace(/\n+/g, " ")
        .trim()
    )
    .filter(Boolean);

  return paragraphs.join("\n\n");
}

function normalizeSlug(value, fallback) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeLanguage(value) {
  const normalized = normalizeText(value, "und");
  const localeMatch = normalized.match(/^([a-z]{2,3})(?:[-_][a-z0-9]{2,8})*$/i);
  if (localeMatch) {
    return localeMatch[1].toLowerCase();
  }
  if (!normalized || normalized === "unknown") {
    return "und";
  }
  return normalized.toLowerCase();
}

function normalizeLevelCode(value) {
  const normalized = normalizeText(value, "");
  const simplified = normalized.toLowerCase().replace(/[-_]+/g, " ").trim();

  if (!normalized || simplified === "unknown") {
    return "unknown";
  }

  if (
    simplified === "beginner" ||
    simplified === "beginner level" ||
    /초급/.test(normalized) ||
    /입문/.test(normalized)
  ) {
    return "beginner";
  }

  if (
    simplified === "intermediate" ||
    simplified === "intermediate level" ||
    /중급/.test(normalized)
  ) {
    return "intermediate";
  }

  if (
    simplified === "expert" ||
    simplified === "expert level" ||
    simplified === "advanced" ||
    simplified === "advanced level" ||
    /고급/.test(normalized) ||
    /전문가/.test(normalized)
  ) {
    return "expert";
  }

  if (
    simplified === "all levels" ||
    simplified === "all level" ||
    simplified === "all_levels" ||
    /모든\s*수준/.test(normalized) ||
    /전체\s*수준/.test(normalized)
  ) {
    return "all_levels";
  }

  return (
    simplified.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown"
  );
}

function resolveCourseLevel(levelValue, levelLabelValue = "") {
  let rawLevel = levelValue;
  let rawLabel = levelLabelValue;

  if (rawLevel && typeof rawLevel === "object") {
    rawLabel =
      rawLevel.label ||
      rawLevel.level_label ||
      rawLevel.display_label ||
      rawLabel;
    rawLevel = rawLevel.code || rawLevel.level || rawLevel.value || rawLabel;
  }

  const levelText = normalizeText(rawLevel, "");
  const labelText = normalizeText(rawLabel, "");
  const code = normalizeLevelCode(levelText || labelText || "unknown");
  const label =
    labelText ||
    (levelText && levelText !== code
      ? levelText
      : COURSE_LEVEL_LABELS[code] || COURSE_LEVEL_LABELS.unknown);

  return {
    code,
    label,
  };
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return Math.floor(number);
}

function ensureDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

export function buildPageIdentityFromContext(pageContext) {
  const transcriptLanguage = normalizeLanguage(
    pageContext.transcriptLanguage || pageContext.defaultLanguage || "und"
  );

  const identity = {
    course_id: normalizeText(
      pageContext.courseId,
      pageContext.courseSlug ? `slug:${pageContext.courseSlug}` : "unknown-course"
    ),
    course_slug: normalizeSlug(pageContext.courseSlug, "unknown-course"),
    section_id: normalizeText(pageContext.sectionId, "unknown-section"),
    section_index: toInteger(pageContext.sectionIndex, 0),
    lecture_id: normalizeText(pageContext.lectureId, "unknown-lecture"),
    lecture_index: toInteger(pageContext.lectureIndex, 0),
    lecture_slug: normalizeSlug(
      pageContext.lectureSlug || pageContext.lectureTitle,
      "unknown-lecture"
    ),
    transcript_language: transcriptLanguage,
  };

  return {
    ...identity,
    lookup_key: buildLookupKey(identity),
  };
}

export function buildMetadataFromSnapshot(pageContext, snapshot) {
  const identity = buildPageIdentityFromContext(pageContext);
  const courseLevel = resolveCourseLevel(
    pageContext.level,
    pageContext.levelLabel
  );

  return {
    format_version: 1,
    provider: "udemy",
    identity,
    course: {
      title: normalizeText(pageContext.courseTitle, "Unknown Course"),
      description: normalizeMultilineText(pageContext.courseDescription, ""),
      level: courseLevel.code,
      level_label: courseLevel.label,
      default_language: normalizeLanguage(pageContext.defaultLanguage),
      caption_available: Boolean(snapshot.transcriptProbe?.cueCount || pageContext.captionAvailable),
    },
    transcript: {
      language: identity.transcript_language,
      updated_at: ensureDateTime(pageContext.transcriptUpdatedAt || Date.now()),
    },
    section: {
      title: normalizeText(pageContext.sectionTitle, "Unknown Section"),
    },
    lecture: {
      title: normalizeText(pageContext.lectureTitle, "Unknown Lecture"),
    },
  };
}

export function normalizeMetadata(metadata) {
  const pageContext = {
    courseId: metadata?.identity?.course_id,
    courseSlug: metadata?.identity?.course_slug,
    sectionId: metadata?.identity?.section_id,
    sectionIndex: metadata?.identity?.section_index,
    lectureId: metadata?.identity?.lecture_id,
    lectureIndex: metadata?.identity?.lecture_index,
    lectureSlug: metadata?.identity?.lecture_slug,
    transcriptLanguage:
      metadata?.identity?.transcript_language || metadata?.transcript?.language,
    defaultLanguage: metadata?.course?.default_language,
    courseTitle: metadata?.course?.title,
    courseDescription: metadata?.course?.description,
    level: metadata?.course?.level,
    levelLabel: metadata?.course?.level_label,
    captionAvailable: metadata?.course?.caption_available,
    transcriptUpdatedAt: metadata?.transcript?.updated_at,
    sectionTitle: metadata?.section?.title,
    lectureTitle: metadata?.lecture?.title,
  };

  const normalized = buildMetadataFromSnapshot(pageContext, {
    transcriptProbe: {
      cueCount: metadata?.course?.caption_available ? 1 : 0,
    },
  });

  normalized.format_version = Number(metadata?.format_version) || 1;
  normalized.provider = normalizeText(metadata?.provider, "udemy");
  return normalized;
}

export function validateMetadata(metadata) {
  const errors = [];

  if (metadata?.format_version !== 1) {
    errors.push("format_version must be 1.");
  }

  if (metadata?.provider !== "udemy") {
    errors.push('provider must be "udemy".');
  }

  if (!metadata?.identity?.course_id) {
    errors.push("identity.course_id is required.");
  }

  if (metadata?.identity?.section_index == null || metadata.identity.section_index < 0) {
    errors.push("identity.section_index must be 0 or greater.");
  }

  if (!metadata?.identity?.lecture_id) {
    errors.push("identity.lecture_id is required.");
  }

  if (metadata?.identity?.lecture_index == null || metadata.identity.lecture_index < 0) {
    errors.push("identity.lecture_index must be 0 or greater.");
  }

  if (!metadata?.identity?.transcript_language) {
    errors.push("identity.transcript_language is required.");
  }

  if (!metadata?.course?.title) {
    errors.push("course.title is required.");
  }

  if (!metadata?.course?.level) {
    errors.push("course.level is required.");
  }

  if (!metadata?.course?.level_label) {
    errors.push("course.level_label is required.");
  }

  if (!metadata?.course?.default_language) {
    errors.push("course.default_language is required.");
  }

  if (!metadata?.transcript?.language) {
    errors.push("transcript.language is required.");
  }

  if (!metadata?.transcript?.updated_at) {
    errors.push("transcript.updated_at is required.");
  }

  if (!metadata?.section?.title) {
    errors.push("section.title is required.");
  }

  if (!metadata?.lecture?.title) {
    errors.push("lecture.title is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function parseCueTimeline(timeline) {
  const [startText, endText] = String(timeline).split(/\s*-->\s*/);

  if (!startText || !endText) {
    throw new Error(`Invalid cue timeline: ${timeline}`);
  }

  const start = parseCueTimestamp(startText);
  const end = parseCueTimestamp(endText);

  return {
    startSeconds: start,
    endSeconds: end,
  };
}

function parseCueTimestamp(timestamp) {
  const match = String(timestamp).trim().match(
    /^(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})$/
  );

  if (!match) {
    throw new Error(`Invalid cue timestamp: ${timestamp}`);
  }

  const [, hoursText, minutesText, secondsText, millisecondsText] = match;
  const hours = Number(hoursText || 0);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  const milliseconds = Number(millisecondsText);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}
