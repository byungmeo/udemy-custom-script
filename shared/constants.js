export const CUSTOM_SCRIPT_METADATA_START = "<<<UDEMY_CUSTOM_SCRIPT_METADATA>>>";
export const CUSTOM_SCRIPT_METADATA_END = "<<<END_METADATA>>>";

export const STORAGE_KEYS = {
  SETTINGS: "settings",
  SCRIPT_INDEX: "script_index",
  PROVIDER_SECRETS: "provider_secrets",
  PROVIDER_CACHE: "provider_cache",
  TRANSLATION_JOBS: "translation_jobs",
  TRANSLATION_SESSIONS: "translation_sessions",
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
  aiProvider: "openai",
  openAiModel: "gpt-5-mini",
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
  BACKGROUND_GET_PROVIDER_SETTINGS: "background:get-provider-settings",
  BACKGROUND_UPDATE_PROVIDER_SETTINGS: "background:update-provider-settings",
  BACKGROUND_REFRESH_OPENAI_MODELS: "background:refresh-openai-models",
  BACKGROUND_TRANSLATE_ACTIVE_TAB_SCRIPT: "background:translate-active-tab-script",
  BACKGROUND_CANCEL_ACTIVE_TAB_TRANSLATION: "background:cancel-active-tab-translation",
  BACKGROUND_RESOLVE_PAGE_SCRIPT: "background:resolve-page-script",
  BACKGROUND_FETCH_RESOURCE: "background:fetch-resource",
  BACKGROUND_OPEN_OPTIONS_PAGE: "background:open-options-page",
  BROADCAST_EXTENSION_STATE_CHANGED: "broadcast:extension-state-changed",
};
