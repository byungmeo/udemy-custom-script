function sanitizeSegment(value, fallback = "unknown") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function buildLookupKey(identity) {
  return [
    "udemy",
    `course-${sanitizeSegment(identity.course_id || identity.course_slug, "unknown-course")}`,
    `section-${sanitizeSegment(String(identity.section_index ?? 0), "0")}`,
    `lecture-${sanitizeSegment(identity.lecture_id || identity.lecture_slug, "unknown-lecture")}`,
    `lang-${sanitizeSegment(identity.transcript_language, "und")}`,
  ].join("__");
}

export function buildSuggestedFileName(metadata) {
  return `${metadata.identity.lookup_key}.md`;
}
