# Udemy Custom Script

Chrome extension for exporting Udemy lecture transcripts into a custom JSON-based format, importing translated scripts, and rendering those saved scripts back on top of the Udemy player.

The extension is built around a user-controlled translation workflow:
- export the current lecture transcript with structured metadata
- translate it externally with an LLM or another workflow of your choice
- import the completed script back into the extension
- watch the lecture with configurable custom subtitles inside the Udemy player

## Current Scope

- Detect the current Udemy lecture page
- Probe transcript cues from Udemy caption sources and the video `textTracks` API when captions are available
- Export the current lecture into the custom text format defined in [docs/custom-script-format.md](docs/custom-script-format.md)
- Import translated custom scripts and store them locally
- Match saved scripts back to the current lecture using `lookup_key`
- Render saved subtitles as a custom overlay on the player
- Let the user switch between translation-only and bilingual display modes
- Let the user customize subtitle layout, font, background, spacing, and LLM guidance settings
- Support English and Korean as extension UI languages

## Project Structure

- `background/`: service worker, storage repository, IndexedDB access
- `content/`: Udemy page integration and subtitle overlay
- `popup/`: quick export/status actions
- `options/`: settings, import, and local library management
- `shared/`: format, metadata, and lookup-key logic
- `docs/`: custom script format documentation
- `schemas/`: JSON Schema for the metadata block

## Load The Extension

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this repository folder.

## Usage

1. Open a Udemy lecture page.
2. Start playback or enable captions so caption data is available.
3. Open the extension popup and click `Copy custom script`.
4. Translate the exported script externally.
5. Open the extension options page and import the translated script.
6. Return to the lecture page and the saved script will render as a custom overlay when the lookup key matches.

## Privacy And Storage

- The extension stores settings and saved scripts in the browser.
- Script index metadata is stored in `chrome.storage.sync`.
- Full script bodies are stored locally in `IndexedDB`.
- The current implementation does not require a custom backend service.
- Transcript retrieval only targets Udemy pages and Udemy caption resources needed for the active lecture.

## Release Packaging

- Do not upload the whole repository as the Chrome Web Store package.
- Exclude `sample_data/`, local notes, and any other non-runtime assets from the release zip.
- Only include files required by `manifest.json` and the runtime extension pages.

## Publishing Checklist

- Confirm the options page, popup, and in-player controls are fully localized for both supported UI languages.
- Verify permission justifications for `storage`, `tabs`, `https://www.udemy.com/*`, and `https://*.udemycdn.com/*`.
- Prepare store screenshots that show:
  - transcript export from the popup
  - options page customization
  - in-player bilingual subtitle rendering
- Prepare a privacy disclosure response for the Chrome Web Store dashboard.
- Re-test against at least one captioned lecture and one non-captioned lecture before each release.
- See [docs/publishing-checklist.md](docs/publishing-checklist.md) and [docs/store-overview.md](docs/store-overview.md) for release copy and submission prep.

## Notes

- This project is not affiliated with or endorsed by Udemy.
- If Udemy changes how lecture metadata or captions are exposed, extraction logic will need to be updated.
- The runtime feature set is ahead of the public documentation in a few places. Keep [AGENTS.md](AGENTS.md), [docs/custom-script-format.md](docs/custom-script-format.md), and store listing copy aligned before release.

