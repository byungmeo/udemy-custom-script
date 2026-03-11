# Udemy Custom Script Format

This document defines the v1 text format for import/export of custom transcripts.

## Scope

- The metadata block is validated by [../schemas/udemy-custom-script-metadata.schema.json](../schemas/udemy-custom-script-metadata.schema.json).
- The transcript body remains plain text and is validated by the extension's parser, not by JSON Schema.

## File Structure

The file is UTF-8 text with two parts:

1. A metadata marker line: `<<<UDEMY_CUSTOM_SCRIPT_METADATA>>>`
2. A JSON metadata object that matches the schema
3. A metadata end marker line: `<<<END_METADATA>>>`
4. Zero or more transcript cue blocks

## Cue Block Structure

Each cue block uses exactly three logical fields in this order:

```text
{timeline}
{source_text}
{translated_text}
```

Blocks are separated by a blank line.

## Normalization Rules

- `timeline` uses the original cue time range, for example `00:05.440 --> 00:06.160`.
- `source_text` is the original transcript text for the cue.
- `translated_text` is the translated transcript text for the cue.
- In v1, `source_text` and `translated_text` must each serialize to a single physical line.
- If an extracted cue contains internal line breaks, normalize them to spaces before export.
- If translated text does not exist yet, keep the third line present but empty.
- `section_index` and `lecture_index` may be `0` when the current Udemy page does not expose a reliable index.

## Example

```text
<<<UDEMY_CUSTOM_SCRIPT_METADATA>>>
{
  "format_version": 1,
  "provider": "udemy",
  "identity": {
    "lookup_key": "udemy__course-12345__section-1__lecture-67890__lang-en",
    "course_id": "12345",
    "course_slug": "example-course",
    "section_id": "111",
    "section_index": 1,
    "lecture_id": "67890",
    "lecture_index": 3,
    "lecture_slug": "what-is-common-ui",
    "transcript_language": "en"
  },
  "course": {
    "title": "Example Course",
    "description": "First paragraph.\\n\\nSecond paragraph.",
    "level": "beginner",
    "level_label": "Beginner",
    "default_language": "en",
    "caption_available": true
  },
  "transcript": {
    "language": "en",
    "updated_at": "2026-03-12T09:00:00+09:00"
  },
  "section": {
    "title": "Section 1: Introduction"
  },
  "lecture": {
    "title": "What is Common UI?"
  }
}
<<<END_METADATA>>>
00:05.440 --> 00:06.160
Welcome.
환영합니다.

00:06.160 --> 00:12.040
Before we start at the beginning of the course, I'd like to talk about the plugin that we rely on heavily
본격적으로 강의를 시작하기 전에, 이후에 우리가 아주 많이 의존하게 될 플러그인에 대해 먼저 이야기해보겠습니다.
```

## Notes

- `identity.lookup_key` is the primary fast-match key used to decide whether a saved script applies to the current course, section, lecture, and transcript language.
- `course.level` should be a stable machine-friendly code. `course.level_label` keeps the display text shown by Udemy or a derived fallback label.
- `course.description` should preserve paragraph boundaries with `\n\n` when the source page provides structured HTML paragraphs.
- The file name may mirror the lookup key, but metadata remains the source of truth.
- If the format changes in a way that affects parsing, increment `format_version`.
