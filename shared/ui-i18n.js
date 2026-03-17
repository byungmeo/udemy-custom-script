const UI_MESSAGES = {
  en: {
    "common.appName": "Udemy Custom Script",
    "common.english": "English",
    "common.korean": "Korean",
    "common.enabled": "Enabled",
    "common.disabled": "Disabled",
    "common.save": "Save",
    "common.clear": "Clear",
    "common.copy": "Copy",
    "common.delete": "Delete",
    "common.openai": "OpenAI",
    "common.ready": "Ready.",
    "popup.documentTitle": "Udemy Custom Script",
    "popup.subtitle":
      "Export the current lecture transcript into the custom JSON-based format and inspect whether a saved script already exists for this page.",
    "popup.currentPage": "Current Page",
    "popup.transcriptProbe": "Transcript Probe",
    "popup.savedMatch": "Saved Match",
    "popup.checkingActiveTab": "Checking the active tab...",
    "popup.noDataYet": "No data yet.",
    "popup.refresh": "Refresh",
    "popup.copyCustomScript": "Copy custom script",
    "popup.openOptions": "Open options",
    "popup.translateWithAi": "Translate with AI",
    "popup.cancelAiTranslation": "Cancel AI translation",
    "popup.activeTabCouldNotBeInspected": "The active tab could not be inspected.",
    "popup.noTranscriptData": "No transcript data available.",
    "popup.noMatchInfo": "No match information available.",
    "popup.openUdemyAndTryAgain": "Open a Udemy lecture page and try again.",
    "popup.noTracksDetected": "No caption tracks were detected yet on this lecture page.",
    "popup.savedScriptFound": "Saved script found for {lookupKey}.",
    "popup.noSavedScript": "No saved script for {lookupKey}.",
    "popup.inspectingActiveTab": "Inspecting the active tab...",
    "popup.buildingCustomScript": "Building the custom script...",
    "popup.exportFailed": "Could not export the current lecture script.",
    "popup.unknownLanguage": "unknown language",
    "popup.thisPage": "this page",
    "popup.thisLecture": "this lecture",
    "popup.cueDetected":
      "{count} cue(s) detected via {source} ({language}).",
    "popup.trackDetected":
      "Caption track(s) detected via {source} ({count} track(s), {language}).",
    "popup.copiedToClipboard":
      "Copied {fileName} ({cueCount} cue(s)){guidanceSuffix} to the clipboard.",
    "popup.guidanceSuffix": " with LLM guidance",
    "popup.translatingWithAi": "Translating the current lecture with {provider}...",
    "popup.translationSaved":
      "Saved translated script {fileName} via {provider} ({cueCount} cue(s)).",
    "popup.translationRunningPersisted":
      "AI translation is still running in the background for this lecture.",
    "popup.translationChunkProgress":
      "Translating chunk {currentChunk}/{totalChunks} ({completedChunks} completed, {streamedCharacters} characters received for the current chunk).",
    "popup.translationCancelling": "Cancelling the current AI translation...",
    "popup.translationCancelled": "The current AI translation was cancelled.",
    "popup.translationSucceededPersisted":
      "The latest AI translation for this lecture was saved as {fileName}.",
    "popup.translationFailedPersisted":
      "The latest AI translation for this lecture failed: {message}",
    "popup.confirmOverwriteSavedScript":
      "A saved script already exists for {fileName}. If this AI translation finishes, it will replace the saved script for this lecture. Continue?",
    "options.documentTitle": "Udemy Custom Script Options",
    "options.heroSubtitle":
      "Manage display preferences, import translated scripts, and inspect the local script library used by the Udemy player overlay.",
    "options.playerSettings": "Player Settings",
    "options.uiLanguage": "Display UI language",
    "options.subtitleMode": "Subtitle mode",
    "options.translationOnly": "Translation only",
    "options.bilingual": "Bilingual",
    "options.bilingualOrder": "Bilingual order",
    "options.translationFirst": "Translation first",
    "options.sourceFirst": "Source first",
    "options.overlay": "Overlay",
    "options.subtitleBottomOffset": "Subtitle bottom offset",
    "options.subtitleLineGap": "Line gap between translation and source",
    "options.saveSettings": "Save settings",
    "options.translationLine": "Translation Line",
    "options.sourceLine": "Source Line",
    "options.fontFamily": "Font family",
    "options.systemSans": "System Sans",
    "options.readableSerif": "Readable Serif",
    "options.technicalMono": "Technical Mono",
    "options.fontSize": "Font size",
    "options.backgroundOpacity": "Background opacity",
    "options.horizontalPadding": "Horizontal background padding",
    "options.verticalPadding": "Vertical background padding",
    "options.importScript": "Import Script",
    "options.loadFromFile": "Load from file",
    "options.pasteCustomScript": "Paste a full custom script",
    "options.importPlaceholder":
      "Paste the exported custom script with the JSON metadata block here.",
    "options.importAndSave": "Import and save",
    "options.llmGuidance": "LLM Guidance",
    "options.llmCardCopy":
      "Control the default translation guidance that is added when you copy a script for GPT, Gemini, or another external LLM. If you use ChatGPT or a similar tool repeatedly, it can be useful to teach this guidance once in memory and then switch the copy option to raw script only for later runs.",
    "options.preferredTargetLanguage": "Preferred target language",
    "options.guidanceMode": "Guidance mode",
    "options.guidanceModeDefault": "Use generated default guidance",
    "options.guidanceModeCustom": "Use custom guidance",
    "options.includeGuidanceWhenCopying": "Include guidance when copying",
    "options.includeGuidanceDefault": "Included by default",
    "options.copyRawScriptOnly": "Copy raw script only",
    "options.guidanceText": "Guidance text",
    "options.guidancePlaceholder":
      "Switch to custom mode to edit the guidance directly.",
    "options.saveGuidance": "Save guidance",
    "options.restoreDefaultGuidance": "Restore default guidance",
    "options.savedScriptLibrary": "Saved Script Library",
    "options.aiProviders": "AI Providers",
    "options.aiCardCopy":
      "Configure direct AI translation for this extension. You must create your own API key in the provider dashboard, API billing is separate from ChatGPT subscriptions, and charges may vary by model and token usage. If you already subscribe to ChatGPT or a similar service, that product experience may often be better than direct API calls in translation quality, speed, or overall cost, so compare before relying on API translation here.",
    "options.aiProvider": "AI provider",
    "options.openAiApiKey": "OpenAI API key",
    "options.openAiApiKeyHelp":
      "Stored locally in this browser profile. If a key is already saved, leave this field blank to keep it. Enter a new key only when you want to replace the saved one.",
    "options.openAiApiKeyBillingHelp":
      "Create this key yourself in the OpenAI Platform dashboard. Usage may incur charges, and the amount depends on the selected model and token usage.",
    "options.openAiApiKeyPlaceholder": "sk-...",
    "options.openAiModel": "OpenAI model",
    "options.openAiModelPreset": "OpenAI model preset",
    "options.openAiModelPricingHelp":
      "When shown, prices are current OpenAI list prices per 1M input and output tokens. Cached-input pricing can differ by model.",
    "options.openAiApiGuidanceHelp":
      "If the LLM Guidance section is set to custom mode, that custom guidance is also appended to AI translation requests.",
    "options.customModel": "Custom model",
    "options.customOpenAiModel": "Custom OpenAI model",
    "options.customOpenAiModelPlaceholder": "Enter a model id",
    "options.refreshModelList": "Refresh model list",
    "options.refreshingModelList": "Refreshing OpenAI model list...",
    "options.modelListUpdated": "OpenAI model list updated.",
    "options.modelListUnavailable":
      "Using preset models. Add and save an OpenAI API key, then refresh the model list.",
    "options.modelListReadyWithStoredKey":
      "Using preset models right now. An API key is already saved, so you can click Refresh model list at any time.",
    "options.modelListFetchedAt": "Last refreshed: {date}",
    "options.saveProviderSettings": "Save provider settings",
    "options.providerSettingsSaved": "Provider settings saved.",
    "options.openAiApiKeyStored":
      "An OpenAI API key is already saved in this browser. The stored value is hidden for security.",
    "options.openAiApiKeyMissing": "No OpenAI API key is currently saved.",
    "options.savedAt": "Saved {date}",
    "options.partialTranslationProgress":
      "Partial AI draft: {completedChunks}/{totalChunks} chunks assembled.",
    "targetLanguage.ko": "Korean",
    "targetLanguage.en": "English",
    "targetLanguage.ja": "Japanese",
    "targetLanguage.zh-Hans": "Simplified Chinese",
    "targetLanguage.zh-Hant": "Traditional Chinese",
    "targetLanguage.es": "Spanish",
    "targetLanguage.fr": "French",
    "targetLanguage.de": "German",
    "options.failedToLoadSettings": "Failed to load settings.",
    "options.failedToSaveSettings": "Failed to save settings.",
    "options.playerSettingsSaved": "Player settings saved.",
    "options.guidanceSaved": "LLM guidance saved.",
    "options.defaultGuidanceRestored": "Default guidance restored.",
    "options.failedToLoadLibrary": "Failed to load the script library.",
    "options.noSavedScriptsYet": "No saved scripts yet.",
    "options.savedScriptCount": "{count} saved script(s).",
    "options.failedToLoadScript": "Failed to load the selected script.",
    "options.copiedScript":
      "Copied {fileName}{guidanceSuffix} to the clipboard.",
    "options.failedToDeleteScript": "Failed to delete the selected script.",
    "options.pasteBeforeImport": "Paste a custom script before importing.",
    "options.importFailed": "Import failed.",
    "options.savedScript": "Saved {fileName}.",
    "options.loadedFile": "Loaded {fileName}.",
    "options.bottomOffsetValue": "{value}px from bottom",
    "options.lineGapValue": "{value}px between lines",
    "options.fontSizeValue": "{value}px",
    "options.opacityValue": "{value}% opacity",
    "options.paddingXValue": "{value}px horizontal padding",
    "options.paddingYValue": "{value}px vertical padding",
    "content.controlButtonTitle": "Custom Script settings",
    "content.controlButtonLabel": "Script",
    "content.panelEyebrow": "Custom Script",
    "content.noScript": "No script",
    "content.scriptReady": "Script ready",
    "content.overlayOn": "Overlay On",
    "content.overlayOff": "Overlay Off",
    "content.translationOnly": "Translation Only",
    "content.bilingual": "Bilingual",
    "content.orderTranslationFirst": "Order: TR -> EN",
    "content.orderSourceFirst": "Order: EN -> TR",
    "content.openFullOptions": "Open full options",
  },
  ko: {
    "common.appName": "Udemy Custom Script",
    "common.english": "English",
    "common.korean": "한국어",
    "common.enabled": "사용",
    "common.disabled": "사용 안 함",
    "common.save": "저장",
    "common.clear": "비우기",
    "common.copy": "복사",
    "common.delete": "삭제",
    "common.openai": "OpenAI",
    "common.ready": "준비되었습니다.",
    "popup.documentTitle": "Udemy Custom Script",
    "popup.subtitle":
      "현재 강의 대본을 커스텀 JSON 포맷으로 내보내고, 이 페이지에 저장된 스크립트가 있는지 확인합니다.",
    "popup.currentPage": "현재 페이지",
    "popup.transcriptProbe": "대본 탐지",
    "popup.savedMatch": "저장된 스크립트",
    "popup.checkingActiveTab": "활성 탭을 확인하는 중...",
    "popup.noDataYet": "아직 데이터가 없습니다.",
    "popup.refresh": "새로고침",
    "popup.copyCustomScript": "커스텀 스크립트 복사",
    "popup.openOptions": "옵션 열기",
    "popup.translateWithAi": "AI로 번역",
    "popup.cancelAiTranslation": "AI 번역 중단",
    "popup.activeTabCouldNotBeInspected": "활성 탭을 확인할 수 없습니다.",
    "popup.noTranscriptData": "대본 데이터가 없습니다.",
    "popup.noMatchInfo": "매칭 정보가 없습니다.",
    "popup.openUdemyAndTryAgain": "Udemy 강의 페이지를 열고 다시 시도하세요.",
    "popup.noTracksDetected": "이 강의 페이지에서는 아직 자막 트랙이 감지되지 않았습니다.",
    "popup.savedScriptFound": "{lookupKey}에 해당하는 저장된 스크립트를 찾았습니다.",
    "popup.noSavedScript": "{lookupKey}에 해당하는 저장된 스크립트가 없습니다.",
    "popup.inspectingActiveTab": "활성 탭을 확인하는 중...",
    "popup.buildingCustomScript": "커스텀 스크립트를 생성하는 중...",
    "popup.exportFailed": "현재 강의 스크립트를 내보낼 수 없습니다.",
    "popup.unknownLanguage": "알 수 없는 언어",
    "popup.thisPage": "현재 페이지",
    "popup.thisLecture": "현재 강의",
    "popup.cueDetected":
      "{source}에서 {count}개의 cue를 감지했습니다. ({language})",
    "popup.trackDetected":
      "{source}에서 자막 트랙 {count}개를 감지했습니다. ({language})",
    "popup.copiedToClipboard":
      "{fileName} ({cueCount}개 cue){guidanceSuffix}를 클립보드에 복사했습니다.",
    "popup.guidanceSuffix": "와 LLM 지침",
    "popup.translatingWithAi": "{provider}로 현재 강의를 번역하는 중...",
    "popup.translationSaved":
      "{provider}로 번역한 스크립트 {fileName}을(를) 저장했습니다. ({cueCount}개 cue)",
    "popup.translationRunningPersisted":
      "이 강의에 대한 AI 번역이 백그라운드에서 아직 진행 중입니다.",
    "popup.translationChunkProgress":
      "{totalChunks}개 중 {currentChunk}번째 청크를 번역 중입니다. 완료 {completedChunks}개, 현재 청크 수신 문자 수 {streamedCharacters}.",
    "popup.translationCancelling": "현재 AI 번역을 중단하는 중...",
    "popup.translationCancelled": "현재 AI 번역을 중단했습니다.",
    "popup.translationSucceededPersisted":
      "이 강의의 최신 AI 번역 결과가 {fileName}(으)로 저장되었습니다.",
    "popup.translationFailedPersisted":
      "이 강의의 최신 AI 번역이 실패했습니다: {message}",
    "popup.confirmOverwriteSavedScript":
      "{fileName}에 해당하는 저장된 스크립트가 이미 있습니다. 이번 AI 번역이 완료되면 현재 강의의 저장된 스크립트를 덮어쓰게 됩니다. 계속할까요?",
    "options.documentTitle": "Udemy Custom Script 옵션",
    "options.heroSubtitle":
      "표시 설정을 관리하고, 번역된 스크립트를 가져오고, Udemy 플레이어 오버레이에서 사용하는 로컬 스크립트 라이브러리를 확인합니다.",
    "options.playerSettings": "플레이어 설정",
    "options.uiLanguage": "확장 UI 언어",
    "options.subtitleMode": "자막 모드",
    "options.translationOnly": "번역문만",
    "options.bilingual": "원문 + 번역문",
    "options.bilingualOrder": "이중 자막 순서",
    "options.translationFirst": "번역문 먼저",
    "options.sourceFirst": "원문 먼저",
    "options.overlay": "오버레이",
    "options.subtitleBottomOffset": "자막 하단 오프셋",
    "options.subtitleLineGap": "번역문과 원문 사이 줄 간격",
    "options.saveSettings": "설정 저장",
    "options.translationLine": "번역문 줄",
    "options.sourceLine": "원문 줄",
    "options.fontFamily": "폰트 패밀리",
    "options.systemSans": "System Sans",
    "options.readableSerif": "Readable Serif",
    "options.technicalMono": "Technical Mono",
    "options.fontSize": "폰트 크기",
    "options.backgroundOpacity": "배경 투명도",
    "options.horizontalPadding": "가로 배경 패딩",
    "options.verticalPadding": "세로 배경 패딩",
    "options.importScript": "스크립트 가져오기",
    "options.loadFromFile": "파일에서 불러오기",
    "options.pasteCustomScript": "전체 커스텀 스크립트 붙여넣기",
    "options.importPlaceholder":
      "JSON 메타데이터 블록이 포함된 커스텀 스크립트를 붙여넣으세요.",
    "options.importAndSave": "가져와서 저장",
    "options.llmGuidance": "LLM 지침",
    "options.llmCardCopy":
      "GPT, Gemini 등 외부 LLM에 스크립트를 복사할 때 함께 넣을 기본 번역 지침을 관리합니다. ChatGPT 같은 도구를 반복적으로 사용할 경우에는 처음 1회 지침을 메모리에 학습시킨 뒤, 이후에는 복사 시 지침 포함 옵션을 원본 스크립트만 복사로 바꿔 사용하는 것도 좋습니다.",
    "options.preferredTargetLanguage": "기본 번역 목표 언어",
    "options.guidanceMode": "지침 모드",
    "options.guidanceModeDefault": "생성된 기본 지침 사용",
    "options.guidanceModeCustom": "사용자 지정 지침 사용",
    "options.includeGuidanceWhenCopying": "복사 시 지침 포함",
    "options.includeGuidanceDefault": "기본 포함",
    "options.copyRawScriptOnly": "원본 스크립트만 복사",
    "options.guidanceText": "지침 내용",
    "options.guidancePlaceholder":
      "사용자 지정 모드로 전환하면 지침을 직접 수정할 수 있습니다.",
    "options.saveGuidance": "지침 저장",
    "options.restoreDefaultGuidance": "기본 지침 복원",
    "options.savedScriptLibrary": "저장된 스크립트 라이브러리",
    "options.aiProviders": "AI 제공자",
    "options.aiCardCopy":
      "이 확장의 직접 AI 번역을 설정합니다. API 키는 제공자 대시보드에서 직접 만들어야 하고, ChatGPT 구독과 별개로 API 요금이 청구될 수 있으며, 비용은 모델과 토큰 사용량에 따라 달라질 수 있습니다. 이미 ChatGPT 같은 서비스를 구독 중이라면, 직접 API를 호출하는 것보다 번역 품질, 속도, 전체 비용 측면에서 더 나은 경우가 많으니 비교해보고 사용하는 것이 좋습니다.",
    "options.aiProvider": "AI 제공자",
    "options.openAiApiKey": "OpenAI API 키",
    "options.openAiApiKeyHelp":
      "현재 브라우저 프로필의 로컬 저장소에 보관됩니다. 이미 저장된 키가 있다면 이 입력칸을 비워 두면 유지됩니다. 저장된 키를 바꾸고 싶을 때만 새 키를 입력하세요.",
    "options.openAiApiKeyBillingHelp":
      "이 키는 OpenAI Platform 대시보드에서 직접 생성해야 합니다. 사용량에 따라 요금이 청구될 수 있으며, 금액은 선택한 모델과 토큰 사용량에 따라 달라집니다.",
    "options.openAiApiKeyPlaceholder": "sk-...",
    "options.openAiModel": "OpenAI 모델",
    "options.openAiModelPreset": "OpenAI 모델 프리셋",
    "options.openAiModelPricingHelp":
      "표시되는 가격은 알 수 있는 경우 현재 OpenAI 공식 가격 기준의 1M 입력/출력 토큰 단가입니다. 캐시 입력 단가는 모델마다 다를 수 있습니다.",
    "options.openAiApiGuidanceHelp":
      "LLM 지침 섹션이 사용자 지정 모드인 경우, 그 사용자 지정 지침도 AI 번역 API 요청에 함께 첨부됩니다.",
    "options.customModel": "사용자 지정 모델",
    "options.customOpenAiModel": "사용자 지정 OpenAI 모델",
    "options.customOpenAiModelPlaceholder": "모델 ID를 입력하세요",
    "options.refreshModelList": "모델 목록 새로고침",
    "options.refreshingModelList": "OpenAI 모델 목록을 새로고침하는 중...",
    "options.modelListUpdated": "OpenAI 모델 목록을 업데이트했습니다.",
    "options.modelListUnavailable":
      "프리셋 모델을 사용 중입니다. OpenAI API 키를 추가하고 저장한 뒤 모델 목록을 새로고침하세요.",
    "options.modelListReadyWithStoredKey":
      "현재는 프리셋 모델을 사용 중입니다. API 키는 이미 저장되어 있으니 언제든 모델 목록 새로고침을 누르면 됩니다.",
    "options.modelListFetchedAt": "마지막 새로고침: {date}",
    "options.saveProviderSettings": "제공자 설정 저장",
    "options.providerSettingsSaved": "제공자 설정을 저장했습니다.",
    "options.openAiApiKeyStored":
      "이 브라우저에 OpenAI API 키가 이미 저장되어 있습니다. 보안상 저장된 값은 표시하지 않습니다.",
    "options.openAiApiKeyMissing": "현재 저장된 OpenAI API 키가 없습니다.",
    "options.savedAt": "저장 시각 {date}",
    "options.partialTranslationProgress":
      "부분 AI 초안: 전체 {totalChunks}개 중 {completedChunks}개 청크를 조립했습니다.",
    "targetLanguage.ko": "한국어",
    "targetLanguage.en": "영어",
    "targetLanguage.ja": "일본어",
    "targetLanguage.zh-Hans": "중국어 간체",
    "targetLanguage.zh-Hant": "중국어 번체",
    "targetLanguage.es": "스페인어",
    "targetLanguage.fr": "프랑스어",
    "targetLanguage.de": "독일어",
    "options.failedToLoadSettings": "설정을 불러오지 못했습니다.",
    "options.failedToSaveSettings": "설정을 저장하지 못했습니다.",
    "options.playerSettingsSaved": "플레이어 설정을 저장했습니다.",
    "options.guidanceSaved": "LLM 지침을 저장했습니다.",
    "options.defaultGuidanceRestored": "기본 지침으로 복원했습니다.",
    "options.failedToLoadLibrary": "스크립트 라이브러리를 불러오지 못했습니다.",
    "options.noSavedScriptsYet": "저장된 스크립트가 아직 없습니다.",
    "options.savedScriptCount": "저장된 스크립트 {count}개",
    "options.failedToLoadScript": "선택한 스크립트를 불러오지 못했습니다.",
    "options.copiedScript":
      "{fileName}{guidanceSuffix}를 클립보드에 복사했습니다.",
    "options.failedToDeleteScript": "선택한 스크립트를 삭제하지 못했습니다.",
    "options.pasteBeforeImport": "가져오기 전에 커스텀 스크립트를 붙여넣으세요.",
    "options.importFailed": "가져오기에 실패했습니다.",
    "options.savedScript": "{fileName}을(를) 저장했습니다.",
    "options.loadedFile": "{fileName}을(를) 불러왔습니다.",
    "options.bottomOffsetValue": "하단에서 {value}px",
    "options.lineGapValue": "줄 간격 {value}px",
    "options.fontSizeValue": "{value}px",
    "options.opacityValue": "투명도 {value}%",
    "options.paddingXValue": "가로 패딩 {value}px",
    "options.paddingYValue": "세로 패딩 {value}px",
    "content.controlButtonTitle": "Custom Script 설정",
    "content.controlButtonLabel": "스크립트",
    "content.panelEyebrow": "Custom Script",
    "content.noScript": "스크립트 없음",
    "content.scriptReady": "스크립트 준비됨",
    "content.overlayOn": "오버레이 켜짐",
    "content.overlayOff": "오버레이 꺼짐",
    "content.translationOnly": "번역문만",
    "content.bilingual": "원문 + 번역문",
    "content.orderTranslationFirst": "순서: 번역문 -> 원문",
    "content.orderSourceFirst": "순서: 원문 -> 번역문",
    "content.openFullOptions": "전체 옵션 열기",
  },
};

function formatMessage(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_match, key) =>
    params[key] != null ? String(params[key]) : ""
  );
}

export function normalizeUiLanguage(language) {
  return language === "ko" ? "ko" : "en";
}

export function getDefaultUiLanguage() {
  const browserLanguage =
    globalThis.chrome?.i18n?.getUILanguage?.() ||
    globalThis.navigator?.language ||
    "en";

  return /^ko\b/i.test(browserLanguage) ? "ko" : "en";
}

export function getUiLanguageOptions() {
  return [
    { value: "en", labelKey: "common.english" },
    { value: "ko", labelKey: "common.korean" },
  ];
}

export function t(language, key, params = {}) {
  const normalizedLanguage = normalizeUiLanguage(language);
  const table = UI_MESSAGES[normalizedLanguage] || UI_MESSAGES.en;
  const fallbackTable = UI_MESSAGES.en;
  const template = table[key] || fallbackTable[key] || key;
  return formatMessage(template, params);
}

export function applyTranslations(root, language) {
  const normalizedLanguage = normalizeUiLanguage(language);
  const elementList = [root, ...root.querySelectorAll("[data-i18n], [data-i18n-placeholder]")];

  for (const element of elementList) {
    if (element.dataset?.i18n) {
      element.textContent = t(normalizedLanguage, element.dataset.i18n);
    }

    if (element.dataset?.i18nPlaceholder) {
      element.setAttribute(
        "placeholder",
        t(normalizedLanguage, element.dataset.i18nPlaceholder)
      );
    }
  }
}
