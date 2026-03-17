import { MESSAGE_TYPES } from "../shared/constants.js";
import {
  buildClipboardPackage,
  buildDefaultLlmTranslationGuidance,
  LLM_TARGET_LANGUAGE_OPTIONS,
} from "../shared/llm-guidance.js";
import {
  AI_PROVIDER_OPTIONS,
  CUSTOM_OPENAI_MODEL_VALUE,
  formatOpenAiModelLabel,
  OPENAI_MODEL_OPTIONS,
} from "../shared/ai-providers.js";
import {
  applyTranslations,
  getUiLanguageOptions,
  normalizeUiLanguage,
  t,
} from "../shared/ui-i18n.js";

const elements = {
  uiLanguage: document.querySelector("#ui-language"),
  subtitleMode: document.querySelector("#subtitle-mode"),
  subtitleOrder: document.querySelector("#subtitle-order"),
  overlayEnabled: document.querySelector("#overlay-enabled"),
  subtitleBottomOffset: document.querySelector("#subtitle-bottom-offset"),
  subtitleBottomOffsetValue: document.querySelector("#subtitle-bottom-offset-value"),
  subtitleLineGap: document.querySelector("#subtitle-line-gap"),
  subtitleLineGapValue: document.querySelector("#subtitle-line-gap-value"),
  translatedFontFamily: document.querySelector("#translated-font-family"),
  translatedFontSize: document.querySelector("#translated-font-size"),
  translatedFontSizeValue: document.querySelector("#translated-font-size-value"),
  translatedBackgroundOpacity: document.querySelector(
    "#translated-background-opacity"
  ),
  translatedBackgroundOpacityValue: document.querySelector(
    "#translated-background-opacity-value"
  ),
  translatedPaddingX: document.querySelector("#translated-padding-x"),
  translatedPaddingXValue: document.querySelector("#translated-padding-x-value"),
  translatedPaddingY: document.querySelector("#translated-padding-y"),
  translatedPaddingYValue: document.querySelector("#translated-padding-y-value"),
  sourceFontFamily: document.querySelector("#source-font-family"),
  sourceFontSize: document.querySelector("#source-font-size"),
  sourceFontSizeValue: document.querySelector("#source-font-size-value"),
  sourceBackgroundOpacity: document.querySelector("#source-background-opacity"),
  sourceBackgroundOpacityValue: document.querySelector(
    "#source-background-opacity-value"
  ),
  sourcePaddingX: document.querySelector("#source-padding-x"),
  sourcePaddingXValue: document.querySelector("#source-padding-x-value"),
  sourcePaddingY: document.querySelector("#source-padding-y"),
  sourcePaddingYValue: document.querySelector("#source-padding-y-value"),
  saveSettings: document.querySelector("#save-settings"),
  settingsStatus: document.querySelector("#settings-status"),
  aiProvider: document.querySelector("#ai-provider"),
  openAiApiKey: document.querySelector("#openai-api-key"),
  openAiApiKeyStatus: document.querySelector("#openai-api-key-status"),
  openAiModelPreset: document.querySelector("#openai-model-preset"),
  openAiModelListStatus: document.querySelector("#openai-model-list-status"),
  openAiModel: document.querySelector("#openai-model"),
  refreshOpenAiModels: document.querySelector("#refresh-openai-models"),
  saveProviderSettings: document.querySelector("#save-provider-settings"),
  providerSettingsStatus: document.querySelector("#provider-settings-status"),
  llmTargetLanguage: document.querySelector("#llm-target-language"),
  llmGuidanceMode: document.querySelector("#llm-guidance-mode"),
  includeLlmGuidance: document.querySelector("#include-llm-guidance"),
  llmGuidanceText: document.querySelector("#llm-guidance-text"),
  saveLlmGuidance: document.querySelector("#save-llm-guidance"),
  resetLlmGuidance: document.querySelector("#reset-llm-guidance"),
  llmGuidanceStatus: document.querySelector("#llm-guidance-status"),
  importFile: document.querySelector("#import-file"),
  importText: document.querySelector("#import-text"),
  importScript: document.querySelector("#import-script"),
  clearImport: document.querySelector("#clear-import"),
  importStatus: document.querySelector("#import-status"),
  importCard: document.querySelector("#import-card"),
  libraryCard: document.querySelector("#library-card"),
  libraryList: document.querySelector("#library-list"),
  libraryStatus: document.querySelector("#library-status"),
};

let currentSettings = null;
let customGuidanceDraft = "";
let currentLanguage = "en";
let providerSettings = null;
let remoteOpenAiModels = [];
let scriptRowResizeObserver = null;

function setStatus(target, text, isError = false) {
  target.textContent = text;
  target.style.color = isError ? "#b42318" : "#4b5166";
}

function populateUiLanguageOptions() {
  const value = elements.uiLanguage.value;
  elements.uiLanguage.replaceChildren();

  for (const option of getUiLanguageOptions()) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = t(currentLanguage, option.labelKey);
    elements.uiLanguage.appendChild(element);
  }

  elements.uiLanguage.value = value || currentLanguage;
}

function populateAiProviderOptions() {
  const value = elements.aiProvider.value;
  elements.aiProvider.replaceChildren();

  for (const option of AI_PROVIDER_OPTIONS) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent =
      option.value === "openai" ? t(currentLanguage, "common.openai") : option.label;
    elements.aiProvider.appendChild(element);
  }

  elements.aiProvider.value = value || "openai";
}

function populateOpenAiModelOptions() {
  const value = elements.openAiModelPreset.value;
  elements.openAiModelPreset.replaceChildren();

  const mergedOptions = [...OPENAI_MODEL_OPTIONS];
  const knownValues = new Set(mergedOptions.map((option) => option.value));

  for (const remoteModel of remoteOpenAiModels) {
    if (!knownValues.has(remoteModel)) {
      mergedOptions.splice(mergedOptions.length - 1, 0, {
        value: remoteModel,
        label: remoteModel,
      });
      knownValues.add(remoteModel);
    }
  }

  for (const option of mergedOptions) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent =
      option.value === CUSTOM_OPENAI_MODEL_VALUE
        ? t(currentLanguage, "options.customModel")
        : formatOpenAiModelLabel(option.value) || option.label;
    elements.openAiModelPreset.appendChild(element);
  }

  elements.openAiModelPreset.value = value || OPENAI_MODEL_OPTIONS[0].value;
}

function getKnownOpenAiModelValues() {
  return new Set(
    [...OPENAI_MODEL_OPTIONS.map((option) => option.value), ...remoteOpenAiModels].filter(
      (value) => value !== CUSTOM_OPENAI_MODEL_VALUE
    )
  );
}

function syncOpenAiModelSelection(model) {
  const normalizedModel = String(model ?? "").trim();
  const knownValues = getKnownOpenAiModelValues();
  const isKnownModel = normalizedModel && knownValues.has(normalizedModel);

  elements.openAiModelPreset.value = isKnownModel
    ? normalizedModel
    : CUSTOM_OPENAI_MODEL_VALUE;
  elements.openAiModel.disabled = isKnownModel;
  elements.openAiModel.value = normalizedModel;
}

function populateTargetLanguageOptions() {
  const value = elements.llmTargetLanguage.value;
  elements.llmTargetLanguage.replaceChildren();

  for (const option of LLM_TARGET_LANGUAGE_OPTIONS) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = t(currentLanguage, `targetLanguage.${option.value}`);
    elements.llmTargetLanguage.appendChild(element);
  }

  elements.llmTargetLanguage.value = value || "ko";
}

function applyOptionsLanguage(language) {
  currentLanguage = normalizeUiLanguage(language);
  document.documentElement.lang = currentLanguage;
  document.title = t(currentLanguage, "options.documentTitle");
  applyTranslations(document.body, currentLanguage);
  populateUiLanguageOptions();
  populateAiProviderOptions();
  populateOpenAiModelOptions();
  populateTargetLanguageOptions();
  renderPlayerSettingSummaries();
  renderGuidanceEditor();
  renderLibrary();
  renderProviderState();
}

function renderPlayerSettingSummaries() {
  elements.subtitleBottomOffsetValue.textContent = t(
    currentLanguage,
    "options.bottomOffsetValue",
    { value: elements.subtitleBottomOffset.value }
  );
  elements.subtitleLineGapValue.textContent = t(
    currentLanguage,
    "options.lineGapValue",
    { value: elements.subtitleLineGap.value }
  );
  elements.translatedFontSizeValue.textContent = t(
    currentLanguage,
    "options.fontSizeValue",
    { value: elements.translatedFontSize.value }
  );
  elements.translatedBackgroundOpacityValue.textContent = t(
    currentLanguage,
    "options.opacityValue",
    { value: elements.translatedBackgroundOpacity.value }
  );
  elements.translatedPaddingXValue.textContent = t(
    currentLanguage,
    "options.paddingXValue",
    { value: elements.translatedPaddingX.value }
  );
  elements.translatedPaddingYValue.textContent = t(
    currentLanguage,
    "options.paddingYValue",
    { value: elements.translatedPaddingY.value }
  );
  elements.sourceFontSizeValue.textContent = t(currentLanguage, "options.fontSizeValue", {
    value: elements.sourceFontSize.value,
  });
  elements.sourceBackgroundOpacityValue.textContent = t(
    currentLanguage,
    "options.opacityValue",
    { value: elements.sourceBackgroundOpacity.value }
  );
  elements.sourcePaddingXValue.textContent = t(currentLanguage, "options.paddingXValue", {
    value: elements.sourcePaddingX.value,
  });
  elements.sourcePaddingYValue.textContent = t(currentLanguage, "options.paddingYValue", {
    value: elements.sourcePaddingY.value,
  });
}

function syncScriptRowHeights() {
  const importCard = elements.importCard;
  const libraryCard = elements.libraryCard;
  const libraryList = elements.libraryList;
  const libraryStatus = elements.libraryStatus;

  if (!importCard || !libraryCard || !libraryList || !libraryStatus) {
    return;
  }

  if (window.innerWidth <= 920) {
    libraryCard.style.height = "";
    libraryList.style.maxHeight = "";
    return;
  }

  const importHeight = importCard.offsetHeight;
  if (!importHeight) {
    return;
  }

  libraryCard.style.height = `${importHeight}px`;

  const title = libraryCard.querySelector("h2");
  const titleHeight = title ? title.offsetHeight : 0;
  const statusHeight = libraryStatus.offsetHeight;
  const cardStyle = window.getComputedStyle(libraryCard);
  const listStyle = window.getComputedStyle(libraryList);
  const cardPaddingTop = Number.parseFloat(cardStyle.paddingTop || "0");
  const cardPaddingBottom = Number.parseFloat(cardStyle.paddingBottom || "0");
  const listGap = Number.parseFloat(listStyle.rowGap || listStyle.gap || "0");
  const availableHeight =
    importHeight -
    cardPaddingTop -
    cardPaddingBottom -
    titleHeight -
    statusHeight -
    10 -
    10 -
    listGap;

  libraryList.style.maxHeight = `${Math.max(180, Math.floor(availableHeight))}px`;
}

function renderGuidanceEditor() {
  const mode = elements.llmGuidanceMode.value;
  const targetLanguage = elements.llmTargetLanguage.value;
  const generatedGuidance = buildDefaultLlmTranslationGuidance(targetLanguage);

  if (mode === "default") {
    elements.llmGuidanceText.value = generatedGuidance;
    elements.llmGuidanceText.readOnly = true;
    return;
  }

  elements.llmGuidanceText.readOnly = false;
  elements.llmGuidanceText.value = customGuidanceDraft || "";
}

function applySettingsToForm(settings) {
  currentSettings = settings;
  customGuidanceDraft = settings.llmTranslationGuidance || "";

  applyOptionsLanguage(settings.uiLanguage || "en");

  elements.uiLanguage.value = settings.uiLanguage;
  elements.subtitleMode.value = settings.subtitleMode;
  elements.subtitleOrder.value = settings.bilingualOrder;
  elements.overlayEnabled.value = String(settings.overlayEnabled);
  elements.subtitleBottomOffset.value = String(settings.subtitleBottomOffset);
  elements.subtitleLineGap.value = String(settings.subtitleLineGap);
  elements.aiProvider.value = settings.aiProvider;
  elements.openAiModel.value = settings.openAiModel;
  elements.translatedFontFamily.value = settings.translatedFontFamily;
  elements.translatedFontSize.value = String(settings.translatedFontSize);
  elements.translatedBackgroundOpacity.value = String(
    settings.translatedBackgroundOpacity
  );
  elements.translatedPaddingX.value = String(settings.translatedBoxPaddingX);
  elements.translatedPaddingY.value = String(settings.translatedBoxPaddingY);
  elements.sourceFontFamily.value = settings.sourceFontFamily;
  elements.sourceFontSize.value = String(settings.sourceFontSize);
  elements.sourceBackgroundOpacity.value = String(
    settings.sourceBackgroundOpacity
  );
  elements.sourcePaddingX.value = String(settings.sourceBoxPaddingX);
  elements.sourcePaddingY.value = String(settings.sourceBoxPaddingY);
  elements.llmTargetLanguage.value = settings.llmTargetLanguage;
  elements.llmGuidanceMode.value = settings.llmGuidanceMode;
  elements.includeLlmGuidance.value = String(settings.includeLlmGuidanceOnCopy);

  renderPlayerSettingSummaries();
  renderGuidanceEditor();
  syncScriptRowHeights();
}

function renderProviderState() {
  if (!elements.openAiApiKeyStatus) {
    return;
  }

  const hasOpenAiApiKey = Boolean(providerSettings?.hasOpenAiApiKey);
  elements.openAiApiKeyStatus.textContent = hasOpenAiApiKey
    ? t(currentLanguage, "options.openAiApiKeyStored")
    : t(currentLanguage, "options.openAiApiKeyMissing");

  if (providerSettings?.openAiModelsFetchedAt) {
    elements.openAiModelListStatus.textContent = t(
      currentLanguage,
      "options.modelListFetchedAt",
      {
        date: new Date(providerSettings.openAiModelsFetchedAt).toLocaleString(
          currentLanguage
        ),
      }
    );
  } else {
    elements.openAiModelListStatus.textContent = t(
      currentLanguage,
      hasOpenAiApiKey
        ? "options.modelListReadyWithStoredKey"
        : "options.modelListUnavailable"
    );
  }
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_SETTINGS,
  });

  if (!response?.ok) {
    applyOptionsLanguage("en");
    setStatus(
      elements.settingsStatus,
      t("en", "options.failedToLoadSettings"),
      true
    );
    return;
  }

  applySettingsToForm(response.settings);
}

async function loadProviderSettings() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_PROVIDER_SETTINGS,
  });

  if (!response?.ok) {
    setStatus(
      elements.providerSettingsStatus,
      t(currentLanguage, "options.failedToLoadSettings"),
      true
    );
    return;
  }

  providerSettings = response.providerSettings;
  remoteOpenAiModels = providerSettings.openAiModels || [];
  elements.aiProvider.value = providerSettings.aiProvider;
  populateOpenAiModelOptions();
  syncOpenAiModelSelection(providerSettings.openAiModel);
  elements.openAiApiKey.value = "";
  renderProviderState();
}

async function persistSettings(nextSettings, statusTarget, successMessageKey) {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_UPDATE_SETTINGS,
    payload: {
      settings: nextSettings,
    },
  });

  if (!response?.ok) {
    setStatus(statusTarget, t(currentLanguage, "options.failedToSaveSettings"), true);
    return null;
  }

  applySettingsToForm(response.settings);
  setStatus(statusTarget, t(currentLanguage, successMessageKey));
  return response.settings;
}

function getPlayerSettingsFromForm() {
  return {
    uiLanguage: elements.uiLanguage.value,
    subtitleMode: elements.subtitleMode.value,
    bilingualOrder: elements.subtitleOrder.value,
    overlayEnabled: elements.overlayEnabled.value === "true",
    subtitleBottomOffset: Number(elements.subtitleBottomOffset.value),
    subtitleLineGap: Number(elements.subtitleLineGap.value),
    translatedFontFamily: elements.translatedFontFamily.value,
    translatedFontSize: Number(elements.translatedFontSize.value),
    translatedBackgroundOpacity: Number(
      elements.translatedBackgroundOpacity.value
    ),
    translatedBoxPaddingX: Number(elements.translatedPaddingX.value),
    translatedBoxPaddingY: Number(elements.translatedPaddingY.value),
    sourceFontFamily: elements.sourceFontFamily.value,
    sourceFontSize: Number(elements.sourceFontSize.value),
    sourceBackgroundOpacity: Number(elements.sourceBackgroundOpacity.value),
    sourceBoxPaddingX: Number(elements.sourcePaddingX.value),
    sourceBoxPaddingY: Number(elements.sourcePaddingY.value),
  };
}

async function savePlayerSettings() {
  await persistSettings(
    getPlayerSettingsFromForm(),
    elements.settingsStatus,
    "options.playerSettingsSaved"
  );
}

async function saveProviderSettings() {
  const selectedModelPreset = elements.openAiModelPreset.value;
  const resolvedModel =
    selectedModelPreset === CUSTOM_OPENAI_MODEL_VALUE
      ? elements.openAiModel.value.trim()
      : selectedModelPreset;

  if (!resolvedModel) {
    setStatus(
      elements.providerSettingsStatus,
      t(currentLanguage, "options.failedToSaveSettings"),
      true
    );
    return;
  }

  const payload = {
    aiProvider: elements.aiProvider.value,
    openAiModel: resolvedModel,
  };

  const nextApiKey = elements.openAiApiKey.value.trim();
  if (nextApiKey) {
    payload.openAiApiKey = nextApiKey;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_UPDATE_PROVIDER_SETTINGS,
    payload,
  });

  if (!response?.ok) {
    setStatus(
      elements.providerSettingsStatus,
      response.error?.message || t(currentLanguage, "options.failedToSaveSettings"),
      true
    );
    return;
  }

  providerSettings = response.providerSettings;
  remoteOpenAiModels = providerSettings.openAiModels || remoteOpenAiModels;
  elements.openAiApiKey.value = "";
  currentSettings = {
    ...(currentSettings || {}),
    aiProvider: providerSettings.aiProvider,
    openAiModel: providerSettings.openAiModel,
  };
  populateOpenAiModelOptions();
  syncOpenAiModelSelection(providerSettings.openAiModel);
  renderProviderState();
  setStatus(
    elements.providerSettingsStatus,
    t(currentLanguage, "options.providerSettingsSaved")
  );
}

async function refreshOpenAiModels() {
  setStatus(
    elements.providerSettingsStatus,
    t(currentLanguage, "options.refreshingModelList")
  );

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_REFRESH_OPENAI_MODELS,
  });

  if (!response?.ok) {
    setStatus(
      elements.providerSettingsStatus,
      response.error?.message || t(currentLanguage, "options.failedToLoadSettings"),
      true
    );
    return;
  }

  remoteOpenAiModels = response.models || [];
  providerSettings = {
    ...(providerSettings || {}),
    openAiModels: remoteOpenAiModels,
    openAiModelsFetchedAt: response.fetchedAt,
  };
  populateOpenAiModelOptions();
  syncOpenAiModelSelection(elements.openAiModel.value);
  renderProviderState();
  setStatus(
    elements.providerSettingsStatus,
    t(currentLanguage, "options.modelListUpdated")
  );
}

function getLlmSettingsFromForm({ forceDefault = false } = {}) {
  const guidanceMode = forceDefault ? "default" : elements.llmGuidanceMode.value;
  const targetLanguage = elements.llmTargetLanguage.value;
  const customGuidance =
    guidanceMode === "custom"
      ? elements.llmGuidanceText.value.trim()
      : customGuidanceDraft;

  return {
    includeLlmGuidanceOnCopy: elements.includeLlmGuidance.value === "true",
    llmTargetLanguage: targetLanguage,
    llmGuidanceMode: guidanceMode,
    llmTranslationGuidance: customGuidance,
  };
}

async function saveLlmGuidance(forceDefault = false) {
  if (forceDefault) {
    customGuidanceDraft = "";
    elements.llmGuidanceMode.value = "default";
    renderGuidanceEditor();
  } else if (elements.llmGuidanceMode.value === "custom") {
    customGuidanceDraft = elements.llmGuidanceText.value.trim();
  }

  await persistSettings(
    getLlmSettingsFromForm({ forceDefault }),
    elements.llmGuidanceStatus,
    forceDefault
      ? "options.defaultGuidanceRestored"
      : "options.guidanceSaved"
  );
}

let libraryItems = [];

function renderLibrary() {
  elements.libraryList.replaceChildren();

  if (!libraryItems.length) {
    setStatus(elements.libraryStatus, t(currentLanguage, "options.noSavedScriptsYet"));
    return;
  }

  setStatus(
    elements.libraryStatus,
    t(currentLanguage, "options.savedScriptCount", {
      count: libraryItems.length,
    })
  );

  for (const item of libraryItems) {
    const translationProgress = item.translationProgress || {};
    const partialProgressMarkup = translationProgress.isPartial
      ? `<div class="library-item-meta">${t(
          currentLanguage,
          "options.partialTranslationProgress",
          {
            completedChunks: translationProgress.completedChunks || 0,
            totalChunks: translationProgress.totalChunks || 0,
          }
        )}</div>`
      : "";
    const row = document.createElement("div");
    row.className = "library-item";
    row.innerHTML = `
      <div>
        <div class="library-item-title">${item.courseTitle} / ${item.lectureTitle}</div>
        <div class="library-item-meta">${item.sectionTitle}</div>
        <div class="library-item-meta">${item.lookupKey}</div>
        ${partialProgressMarkup}
        <div class="library-item-meta">${t(currentLanguage, "options.savedAt", {
          date: new Date(item.savedAt).toLocaleString(currentLanguage),
        })}</div>
      </div>
      <div class="library-item-actions">
        <button type="button" data-action="copy" data-lookup-key="${item.lookupKey}">${t(currentLanguage, "common.copy")}</button>
        <button type="button" class="secondary" data-action="delete" data-lookup-key="${item.lookupKey}">${t(currentLanguage, "common.delete")}</button>
      </div>
    `;
    elements.libraryList.appendChild(row);
  }

  syncScriptRowHeights();
}

async function loadLibrary() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_LIBRARY,
  });

  if (!response?.ok) {
    setStatus(elements.libraryStatus, t(currentLanguage, "options.failedToLoadLibrary"), true);
    return;
  }

  libraryItems = response.items || [];
  renderLibrary();
}

async function copyScriptText(lookupKey) {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_SCRIPT_TEXT,
    payload: {
      lookupKey,
    },
  });

  if (!response?.ok) {
    setStatus(elements.libraryStatus, t(currentLanguage, "options.failedToLoadScript"), true);
    return;
  }

  const clipboardText = buildClipboardPackage(
    response.script.rawText,
    currentSettings || {}
  );
  await navigator.clipboard.writeText(clipboardText);
  setStatus(
    elements.libraryStatus,
    t(currentLanguage, "options.copiedScript", {
      fileName: response.script.fileName,
      guidanceSuffix: currentSettings?.includeLlmGuidanceOnCopy
        ? ` ${t(currentLanguage, "popup.guidanceSuffix").trim()}`
        : "",
    })
  );
}

async function deleteScript(lookupKey) {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_DELETE_SCRIPT,
    payload: {
      lookupKey,
    },
  });

  if (!response?.ok) {
    setStatus(elements.libraryStatus, t(currentLanguage, "options.failedToDeleteScript"), true);
    return;
  }

  await loadLibrary();
}

async function importScript() {
  const rawText = elements.importText.value.trim();
  if (!rawText) {
    setStatus(elements.importStatus, t(currentLanguage, "options.pasteBeforeImport"), true);
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_SAVE_IMPORTED_SCRIPT,
    payload: {
      rawText,
    },
  });

  if (!response?.ok) {
    setStatus(
      elements.importStatus,
      response.error?.message || t(currentLanguage, "options.importFailed"),
      true
    );
    return;
  }

  setStatus(
    elements.importStatus,
    t(currentLanguage, "options.savedScript", {
      fileName: response.saved.fileName,
    })
  );
  await loadLibrary();
}

elements.saveSettings.addEventListener("click", () => {
  void savePlayerSettings();
});

elements.saveProviderSettings.addEventListener("click", () => {
  void saveProviderSettings();
});

elements.refreshOpenAiModels.addEventListener("click", () => {
  void refreshOpenAiModels();
});

elements.openAiModelPreset.addEventListener("change", () => {
  const selectedModelPreset = elements.openAiModelPreset.value;
  const isCustom = selectedModelPreset === CUSTOM_OPENAI_MODEL_VALUE;

  elements.openAiModel.disabled = !isCustom;
  if (!isCustom) {
    elements.openAiModel.value = selectedModelPreset;
    return;
  }

  elements.openAiModel.focus();
});

elements.saveLlmGuidance.addEventListener("click", () => {
  if (elements.llmGuidanceMode.value === "custom") {
    customGuidanceDraft = elements.llmGuidanceText.value.trim();
  }
  void saveLlmGuidance(false);
});

elements.resetLlmGuidance.addEventListener("click", () => {
  void saveLlmGuidance(true);
});

elements.uiLanguage.addEventListener("change", () => {
  applyOptionsLanguage(elements.uiLanguage.value);
});

elements.llmGuidanceMode.addEventListener("change", () => {
  if (elements.llmGuidanceMode.value === "custom") {
    customGuidanceDraft =
      currentSettings?.llmTranslationGuidance || customGuidanceDraft || "";
  }
  renderGuidanceEditor();
});

elements.llmTargetLanguage.addEventListener("change", renderGuidanceEditor);

elements.llmGuidanceText.addEventListener("input", () => {
  if (elements.llmGuidanceMode.value === "custom") {
    customGuidanceDraft = elements.llmGuidanceText.value;
  }
});

elements.importScript.addEventListener("click", () => {
  void importScript();
});

elements.clearImport.addEventListener("click", () => {
  elements.importText.value = "";
  elements.importFile.value = "";
  setStatus(elements.importStatus, "");
});

elements.importFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  elements.importText.value = text;
  setStatus(
    elements.importStatus,
    t(currentLanguage, "options.loadedFile", {
      fileName: file.name,
    })
  );
  syncScriptRowHeights();
});

for (const input of [
  elements.subtitleBottomOffset,
  elements.subtitleLineGap,
  elements.translatedFontSize,
  elements.translatedBackgroundOpacity,
  elements.translatedPaddingX,
  elements.translatedPaddingY,
  elements.sourceFontSize,
  elements.sourceBackgroundOpacity,
  elements.sourcePaddingX,
  elements.sourcePaddingY,
]) {
  input.addEventListener("input", renderPlayerSettingSummaries);
}

elements.libraryList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const lookupKey = button.dataset.lookupKey;
  if (!lookupKey) {
    return;
  }

  if (button.dataset.action === "copy") {
    void copyScriptText(lookupKey);
  }

  if (button.dataset.action === "delete") {
    void deleteScript(lookupKey);
  }
});

window.addEventListener("resize", syncScriptRowHeights);

if ("ResizeObserver" in window && elements.importCard) {
  scriptRowResizeObserver = new ResizeObserver(() => {
    syncScriptRowHeights();
  });
  scriptRowResizeObserver.observe(elements.importCard);
}

applyOptionsLanguage("en");
await loadSettings();
await loadProviderSettings();
await loadLibrary();
syncScriptRowHeights();
