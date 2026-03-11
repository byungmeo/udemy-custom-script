# Publishing Checklist

## Release Blockers To Clear

- Finish UI localization coverage for all user-facing extension surfaces:
  - popup
  - options page
  - in-player toolbar and popover
- Verify that all default strings and statuses are correct in both English and Korean
- Confirm that non-captioned lectures fail gracefully
- Confirm that saved scripts re-attach correctly after page reload and SPA lecture navigation

## Package Preparation

- Build the release zip from runtime files only
- Exclude `sample_data/` from the uploaded package
- Exclude any local notes, HAR files, HTML captures, and development-only assets
- Re-check icon sizes and visual clarity at 16, 32, 64, and 128

## Store Submission Material

- Final extension name
- Final short summary
- Final detailed description
- `_locales/en/messages.json` and `_locales/ko/messages.json` checked against the final manifest metadata
- At least one English and one Korean listing draft if localized store listings will be used
- Screenshots for popup, options page, and in-player subtitle rendering
- Privacy disclosure answers
- Support contact and homepage links if you want them visible in the listing

## Functional QA

- Captioned lecture export
- Non-captioned lecture handling
- Import translated script
- Saved script match after lecture revisit
- In-player subtitle rendering
- Translation-only mode
- Bilingual mode
- Source-first and translation-first ordering
- Source and translation style customization
- LLM guidance copy on/off
- Options page open from popup and from the player toolbar

## After Any Permission Or Manifest Change

- Reload the unpacked extension
- Refresh Udemy tabs
- Re-check export, import, and player rendering flows
