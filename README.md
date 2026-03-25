# Udemy Custom Script

Chrome extension for exporting Udemy lecture transcripts into a custom JSON-based format, importing translated scripts, optionally translating them with OpenAI, and rendering those saved scripts back on top of the Udemy player.

The extension is built around a user-controlled subtitle workflow:
- export the current lecture transcript with structured metadata
- translate it externally with an LLM or another workflow of your choice
- or run direct AI translation with your own OpenAI API key
- import the completed script back into the extension
- watch the lecture with configurable custom subtitles inside the Udemy player

The manual copy/import workflow remains a first-class path even when direct AI translation is enabled.

## Current Scope

- Detect the current Udemy lecture page
- Probe transcript cues from Udemy caption sources and the video `textTracks` API when captions are available
- Export the current lecture into the custom text format defined in [docs/custom-script-format.md](docs/custom-script-format.md)
- Import translated custom scripts and store them locally
- Translate the active lecture with OpenAI using a chunk-based background pipeline
- Persist translation jobs and sessions so chunk progress can recover after MV3 interruptions
- Save partial AI draft output between completed chunks when it is safe to do so
- Match saved scripts back to the current lecture using `lookup_key`
- Render saved subtitles as a custom overlay on the player
- Let the user switch between translation-only and bilingual display modes
- Let the user customize subtitle layout, font, background, spacing, and LLM guidance settings
- Support English and Korean as extension UI languages
- Localize manifest-facing metadata such as the extension name and description through `_locales`

## Project Structure

- `_locales/`: Chrome extension locale resources for manifest and store-facing metadata
- `background/`: service worker, storage repository, IndexedDB access, AI translation orchestration
- `content/`: Udemy page integration and subtitle overlay
- `popup/`: quick export/status actions
- `options/`: settings, import, AI provider configuration, and local library management
- `shared/`: format, metadata, lookup-key, provider, and guidance logic
- `docs/`: custom script format and store/publishing documentation
- `schemas/`: JSON Schema for the metadata block

## Load The Extension

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this repository folder.

## Usage

### Manual workflow

1. Open a Udemy lecture page.
2. Start playback or enable captions so caption data is available.
3. Open the extension popup and click `Copy custom script`.
4. Translate the exported script externally.
5. Open the extension options page and import the translated script.
6. Return to the lecture page and the saved script will render as a custom overlay when the lookup key matches.

### Direct AI workflow

1. Open the options page and add your own OpenAI API key.
2. Choose an OpenAI model.
3. Open a Udemy lecture page and start playback or enable captions.
4. Open the extension popup and click `Translate with AI`.
5. The extension translates the lecture in chunks, persists progress, and saves the assembled script when complete.

## Localization

- The extension package currently supports English and Korean.
- Manifest-facing strings are localized through `_locales/en/messages.json` and `_locales/ko/messages.json`.
- Chrome uses the localized manifest `name` and `description` for supported locales, so Korean users can see a Korean extension title while English users keep the English title.
- Localized Chrome Web Store detailed descriptions, screenshots, and media are still managed separately in the store dashboard.

## Privacy And Storage

- The extension stores settings and saved scripts in the browser.
- OpenAI API keys are stored locally in the current browser profile.
- Script index metadata is stored locally and mirrored to `chrome.storage.sync` when quota allows.
- Full script bodies are stored locally in `IndexedDB`.
- Translation jobs and resumable AI translation sessions are stored in browser storage while a translation is in progress.
- The extension does not require a custom backend service.
- Transcript retrieval only targets Udemy pages and Udemy caption resources needed for the active lecture.
- If the user explicitly starts direct AI translation, transcript content, metadata context, and user guidance needed for the request are sent to OpenAI using the user's own API key.

## Release Packaging

- Do not upload the whole repository as the Chrome Web Store package.
- Exclude `sample_data/`, local notes, and any other non-runtime assets from the release zip.
- Only include files required by `manifest.json` and the runtime extension pages.

## Publishing Checklist

- Confirm the options page, popup, and in-player controls are fully localized for both supported UI languages.
- Verify permission justifications for `storage`, `tabs`, `https://www.udemy.com/*`, `https://*.udemycdn.com/*`, and `https://api.openai.com/*`.
- Prepare store screenshots that show:
  - transcript export from the popup
  - direct AI translation status or options
  - options page customization
  - in-player bilingual subtitle rendering
- Prepare a privacy disclosure response for the Chrome Web Store dashboard.
- Re-test against at least one captioned lecture and one non-captioned lecture before each release.
- See [docs/publishing-checklist.md](docs/publishing-checklist.md) and [docs/store-overview.md](docs/store-overview.md) for release copy and submission prep.

## Notes

- This project is not affiliated with or endorsed by Udemy.
- If Udemy changes how lecture metadata or captions are exposed, extraction logic will need to be updated.
- Keep [AGENTS.md](AGENTS.md), [docs/custom-script-format.md](docs/custom-script-format.md), and store listing copy aligned before release.

