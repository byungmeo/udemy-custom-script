# AGENTS.md

## Scope
- This repository builds a Chrome extension that extracts Udemy lecture transcripts, wraps them in a custom script format, and renders saved custom subtitles inside the Udemy player.
- Prefer actual product behavior over any leftover tutorial/template code.

## Use The Project Skill
- If the local skill `udemy-custom-script-extension` is available, use it for work in this repository.
- The skill holds the project-specific workflow, file map, format invariants, and AI translation pipeline notes so AGENTS can stay short.

## Canonical Sources
- Custom script format: `docs/custom-script-format.md`
- Metadata schema: `schemas/udemy-custom-script-metadata.schema.json`
- Store/release docs: `docs/store-overview.md`, `docs/publishing-checklist.md`

## Product Invariants
- Preserve the manual `copy -> external LLM/manual edit -> import` workflow even when direct AI translation changes.
- Preserve the custom script format: JSON metadata between explicit markers, followed by fixed 3-line cue blocks.
- `identity.lookup_key` is the canonical lecture matching key.
- Keep transcript language and course default language as separate concepts.
- Missing `translatedText` must not break playback; source-text fallback remains valid.
- AI provider code must stay modular. Provider-specific prompt/transport rules belong behind provider boundaries.

## Translation Pipeline Rules
- Treat direct AI translation as additive, not a replacement for manual import/export.
- Persist enough state to recover from MV3 service worker interruption.
- Do not overwrite an existing completed saved script with partial AI output during an in-progress translation.
- Partial chunk saves are allowed when they do not destroy an existing completed script.

## Architecture Map
- `content/`: Udemy page extraction, overlay injection, playback synchronization, player controls
- `background/service-worker.js`: message router, AI translation orchestration, job/session lifecycle
- `background/transcript-repository.js` and `background/transcript-storage.js`: saved-script persistence
- `shared/custom-script-format.js`, `shared/metadata.js`, `shared/lookup-key.js`: canonical format and identity logic
- `shared/llm-guidance.js`, `shared/ai-providers.js`: LLM guidance and provider configuration
- `popup/` and `options/`: export/import, provider settings, library management, user controls

## Working Rules
- Before changing the data model, verify what Udemy page data is actually available.
- Keep import/export deterministic. Avoid accepting multiple ambiguous formats unless there is a hard compatibility reason.
- Treat storage and migration changes as data-safety work.
- When changing AI translation, re-check chunking, cancellation, recovery, partial save behavior, and final assembly.
- When changing player rendering, verify both playback sync and settings propagation.

## Minimum Verification
- Run `node --check` on every touched JS file.
- If format or identity changes, verify export/import round-trip and lecture matching.
- If translation changes, verify at least:
  - translation start
  - chunk progress
  - cancel/resume behavior
  - partial save behavior
  - final save behavior
- If overlay changes, verify subtitle timing and fallback behavior during playback.
