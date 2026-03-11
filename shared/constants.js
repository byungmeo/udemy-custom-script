export const CUSTOM_SCRIPT_METADATA_START = "<<<UDEMY_CUSTOM_SCRIPT_METADATA>>>";
export const CUSTOM_SCRIPT_METADATA_END = "<<<END_METADATA>>>";

export const STORAGE_KEYS = {
  SETTINGS: "settings",
  SCRIPT_INDEX: "script_index",
};

export const DEFAULT_SETTINGS = {
  uiLanguage: "en",
  subtitleMode: "translation_only",
  bilingualOrder: "translation_first",
  overlayEnabled: true,
  translatedFontFamily: "system",
  translatedFontSize: 28,
  translatedBackgroundOpacity: 72,
  translatedBoxPaddingX: 16,
  translatedBoxPaddingY: 10,
  sourceFontFamily: "system",
  sourceFontSize: 22,
  sourceBackgroundOpacity: 56,
  sourceBoxPaddingX: 16,
  sourceBoxPaddingY: 10,
  subtitleBottomOffset: 24,
  subtitleLineGap: 8,
  includeLlmGuidanceOnCopy: true,
  llmTargetLanguage: "ko",
  llmGuidanceMode: "default",
  llmTranslationGuidance: "",
};

export const MESSAGE_TYPES = {
  CONTENT_GET_PAGE_SNAPSHOT: "content:get-page-snapshot",
  BACKGROUND_GET_ACTIVE_TAB_STATUS: "background:get-active-tab-status",
  BACKGROUND_EXPORT_ACTIVE_TAB_SCRIPT: "background:export-active-tab-script",
  BACKGROUND_SAVE_IMPORTED_SCRIPT: "background:save-imported-script",
  BACKGROUND_GET_LIBRARY: "background:get-library",
  BACKGROUND_GET_SCRIPT_TEXT: "background:get-script-text",
  BACKGROUND_DELETE_SCRIPT: "background:delete-script",
  BACKGROUND_GET_SETTINGS: "background:get-settings",
  BACKGROUND_UPDATE_SETTINGS: "background:update-settings",
  BACKGROUND_RESOLVE_PAGE_SCRIPT: "background:resolve-page-script",
  BACKGROUND_FETCH_RESOURCE: "background:fetch-resource",
  BACKGROUND_OPEN_OPTIONS_PAGE: "background:open-options-page",
  BROADCAST_EXTENSION_STATE_CHANGED: "broadcast:extension-state-changed",
};
