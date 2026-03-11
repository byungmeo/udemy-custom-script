import {
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  STORAGE_KEYS,
} from "../shared/constants.js";
import {
  buildMetadataFromSnapshot,
  buildPageIdentityFromContext,
} from "../shared/metadata.js";
import {
  parseCustomScript,
  serializeCustomScript,
} from "../shared/custom-script-format.js";
import { buildClipboardPackage } from "../shared/llm-guidance.js";
import { buildLookupKey, buildSuggestedFileName } from "../shared/lookup-key.js";
import {
  getDefaultUiLanguage,
  normalizeUiLanguage,
} from "../shared/ui-i18n.js";
import {
  deleteScriptRecord,
  getScriptRecord,
  listScriptIndex,
  saveScriptRecord,
} from "./transcript-repository.js";

function clampNumber(value, minimum, maximum, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, numericValue));
}

function normalizeSettings(rawSettings = {}) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(rawSettings || {}),
  };

  const legacyFontFamily = rawSettings?.subtitleFontFamily;
  const legacyFontSize = rawSettings?.subtitleFontSize;
  const legacyBackgroundOpacity = rawSettings?.subtitleBackgroundOpacity;

  return {
    ...merged,
    uiLanguage: normalizeUiLanguage(
      rawSettings?.uiLanguage || getDefaultUiLanguage()
    ),
    overlayEnabled:
      rawSettings?.overlayEnabled === false ||
      rawSettings?.overlayEnabled === "false"
        ? false
        : true,
    translatedFontFamily:
      rawSettings?.translatedFontFamily ||
      legacyFontFamily ||
      DEFAULT_SETTINGS.translatedFontFamily,
    translatedFontSize: clampNumber(
      rawSettings?.translatedFontSize ?? legacyFontSize,
      18,
      42,
      DEFAULT_SETTINGS.translatedFontSize
    ),
    translatedBackgroundOpacity: clampNumber(
      rawSettings?.translatedBackgroundOpacity ?? legacyBackgroundOpacity,
      0,
      100,
      DEFAULT_SETTINGS.translatedBackgroundOpacity
    ),
    translatedBoxPaddingX: clampNumber(
      rawSettings?.translatedBoxPaddingX,
      4,
      40,
      DEFAULT_SETTINGS.translatedBoxPaddingX
    ),
    translatedBoxPaddingY: clampNumber(
      rawSettings?.translatedBoxPaddingY,
      2,
      28,
      DEFAULT_SETTINGS.translatedBoxPaddingY
    ),
    sourceFontFamily:
      rawSettings?.sourceFontFamily ||
      legacyFontFamily ||
      DEFAULT_SETTINGS.sourceFontFamily,
    sourceFontSize: clampNumber(
      rawSettings?.sourceFontSize,
      14,
      36,
      DEFAULT_SETTINGS.sourceFontSize
    ),
    sourceBackgroundOpacity: clampNumber(
      rawSettings?.sourceBackgroundOpacity,
      0,
      100,
      DEFAULT_SETTINGS.sourceBackgroundOpacity
    ),
    sourceBoxPaddingX: clampNumber(
      rawSettings?.sourceBoxPaddingX,
      4,
      40,
      DEFAULT_SETTINGS.sourceBoxPaddingX
    ),
    sourceBoxPaddingY: clampNumber(
      rawSettings?.sourceBoxPaddingY,
      2,
      28,
      DEFAULT_SETTINGS.sourceBoxPaddingY
    ),
    subtitleBottomOffset: clampNumber(
      rawSettings?.subtitleBottomOffset,
      0,
      120,
      DEFAULT_SETTINGS.subtitleBottomOffset
    ),
    subtitleLineGap: clampNumber(
      rawSettings?.subtitleLineGap,
      0,
      32,
      DEFAULT_SETTINGS.subtitleLineGap
    ),
    llmTargetLanguage:
      rawSettings?.llmTargetLanguage || DEFAULT_SETTINGS.llmTargetLanguage,
    llmGuidanceMode:
      rawSettings?.llmGuidanceMode === "custom" ? "custom" : "default",
    includeLlmGuidanceOnCopy:
      rawSettings?.includeLlmGuidanceOnCopy === false ||
      rawSettings?.includeLlmGuidanceOnCopy === "false"
        ? false
        : true,
    llmTranslationGuidance: String(rawSettings?.llmTranslationGuidance ?? ""),
  };
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  return normalizeSettings(stored[STORAGE_KEYS.SETTINGS] || {});
}

async function updateSettings(nextSettings) {
  const current = await getSettings();
  const merged = normalizeSettings({
    ...current,
    ...nextSettings,
  });
  await chrome.storage.sync.set({
    [STORAGE_KEYS.SETTINGS]: merged,
  });
  await broadcastExtensionStateChanged();
  return merged;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tabs[0] || null;
}

async function requestPageSnapshot(tabId, includeCues) {
  return chrome.tabs.sendMessage(tabId, {
    type: MESSAGE_TYPES.CONTENT_GET_PAGE_SNAPSHOT,
    payload: {
      includeCues,
    },
  });
}

function isAllowedResourceUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === "https://www.udemy.com" ||
      parsed.hostname.endsWith(".udemycdn.com")
    );
  } catch (_error) {
    return false;
  }
}

async function fetchExtensionResource(url, responseType) {
  if (!isAllowedResourceUrl(url)) {
    throw new Error("Blocked resource origin.");
  }

  const response = await fetch(url, {
    credentials: "include",
    headers:
      responseType === "json"
        ? {
            accept: "application/json, text/plain, */*",
          }
        : {
            accept: "text/vtt, text/plain, */*",
          },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return responseType === "json" ? response.json() : response.text();
}

function createErrorResponse(code, message, details = null) {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };
}

async function resolveScriptForPageContext(pageContext) {
  const identity = buildPageIdentityFromContext(pageContext);
  const lookupKey = buildLookupKey(identity);
  const record = await getScriptRecord(lookupKey);

  if (!record) {
    return {
      matched: false,
      lookupKey,
      script: null,
    };
  }

  return {
    matched: true,
    lookupKey,
    script: {
      lookupKey: record.lookupKey,
      metadata: record.metadata,
      cues: record.parsed.cues,
      rawText: record.rawText,
      savedAt: record.savedAt,
      fileName: record.fileName,
    },
  };
}

async function handleGetActiveTabStatus() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return createErrorResponse(
      "NO_ACTIVE_TAB",
      "No active browser tab is available."
    );
  }

  try {
    const snapshot = await requestPageSnapshot(tab.id, false);
    if (!snapshot?.ok) {
      return snapshot || createErrorResponse("SNAPSHOT_FAILED", "Could not inspect the current tab.");
    }

    const match = await resolveScriptForPageContext(snapshot.pageContext);

    return {
      ok: true,
      tab: {
        id: tab.id,
        title: tab.title || "",
        url: tab.url || "",
      },
      pageContext: snapshot.pageContext,
      transcriptProbe: snapshot.transcriptProbe,
      match,
    };
  } catch (error) {
    return createErrorResponse(
      "CONTENT_SCRIPT_UNAVAILABLE",
      "The content script is not available on the active tab.",
      error.message
    );
  }
}

async function handleExportActiveTabScript() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return createErrorResponse(
      "NO_ACTIVE_TAB",
      "No active browser tab is available."
    );
  }

  try {
    const settings = await getSettings();
    const snapshot = await requestPageSnapshot(tab.id, true);
    if (!snapshot?.ok) {
      return snapshot || createErrorResponse("SNAPSHOT_FAILED", "Could not inspect the current tab.");
    }

    if (!snapshot.cues?.length) {
      return createErrorResponse(
        "NO_TRANSCRIPT_CUES",
        "No transcript cues were detected. Try enabling captions or starting playback before exporting."
      );
    }

    const metadata = buildMetadataFromSnapshot(snapshot.pageContext, snapshot);
    const rawText = serializeCustomScript({
      metadata,
      cues: snapshot.cues,
    });
    const clipboardText = buildClipboardPackage(rawText, settings);

    return {
      ok: true,
      lookupKey: metadata.identity.lookup_key,
      fileName: buildSuggestedFileName(metadata),
      metadata,
      cueCount: snapshot.cues.length,
      clipboardText,
      includedLlmGuidance: Boolean(settings.includeLlmGuidanceOnCopy),
      rawText,
    };
  } catch (error) {
    return createErrorResponse(
      "EXPORT_FAILED",
      "Failed to build a custom script from the current page.",
      error.message
    );
  }
}

async function handleSaveImportedScript(rawText) {
  try {
    const parsed = parseCustomScript(rawText);
    const result = await saveScriptRecord(parsed);
    await broadcastExtensionStateChanged();

    return {
      ok: true,
      saved: {
        lookupKey: result.lookupKey,
        fileName: result.fileName,
        savedAt: result.savedAt,
        metadata: result.metadata,
      },
    };
  } catch (error) {
    return createErrorResponse(
      "IMPORT_FAILED",
      "Failed to parse or save the imported custom script.",
      error.message
    );
  }
}

async function handleGetLibrary() {
  const items = await listScriptIndex();
  return {
    ok: true,
    items,
  };
}

async function handleGetScriptText(lookupKey) {
  const record = await getScriptRecord(lookupKey);
  if (!record) {
    return createErrorResponse(
      "SCRIPT_NOT_FOUND",
      "The requested script does not exist."
    );
  }

  return {
    ok: true,
    script: {
      lookupKey: record.lookupKey,
      rawText: record.rawText,
      metadata: record.metadata,
      fileName: record.fileName,
      savedAt: record.savedAt,
    },
  };
}

async function handleDeleteScript(lookupKey) {
  await deleteScriptRecord(lookupKey);
  await broadcastExtensionStateChanged();
  return {
    ok: true,
    lookupKey,
  };
}

async function handleResolvePageScript(pageContext) {
  const settings = await getSettings();
  const match = await resolveScriptForPageContext(pageContext);
  return {
    ok: true,
    settings,
    match,
  };
}

async function handleFetchResource(payload) {
  const url = String(payload?.url || "");
  const responseType = payload?.responseType === "json" ? "json" : "text";
  const data = await fetchExtensionResource(url, responseType);

  return {
    ok: true,
    data,
  };
}

async function handleOpenOptionsPage() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("options/options.html"),
  });
  return {
    ok: true,
  };
}

async function broadcastExtensionStateChanged() {
  const tabs = await chrome.tabs.query({
    url: ["https://www.udemy.com/*"],
  });

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) {
        return;
      }

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.BROADCAST_EXTENSION_STATE_CHANGED,
        });
      } catch (_error) {
        // Ignore tabs where the content script is not ready.
      }
    })
  );
}

async function bootstrapSettings() {
  const settings = await getSettings();
  await chrome.storage.sync.set({
    [STORAGE_KEYS.SETTINGS]: settings,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void bootstrapSettings();
});

chrome.runtime.onStartup?.addListener(() => {
  void bootstrapSettings();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MESSAGE_TYPES.BACKGROUND_GET_ACTIVE_TAB_STATUS:
        return handleGetActiveTabStatus();
      case MESSAGE_TYPES.BACKGROUND_EXPORT_ACTIVE_TAB_SCRIPT:
        return handleExportActiveTabScript();
      case MESSAGE_TYPES.BACKGROUND_SAVE_IMPORTED_SCRIPT:
        return handleSaveImportedScript(message.payload?.rawText || "");
      case MESSAGE_TYPES.BACKGROUND_GET_LIBRARY:
        return handleGetLibrary();
      case MESSAGE_TYPES.BACKGROUND_GET_SCRIPT_TEXT:
        return handleGetScriptText(message.payload?.lookupKey || "");
      case MESSAGE_TYPES.BACKGROUND_DELETE_SCRIPT:
        return handleDeleteScript(message.payload?.lookupKey || "");
      case MESSAGE_TYPES.BACKGROUND_GET_SETTINGS:
        return {
          ok: true,
          settings: await getSettings(),
        };
      case MESSAGE_TYPES.BACKGROUND_UPDATE_SETTINGS:
        return {
          ok: true,
          settings: await updateSettings(message.payload?.settings || {}),
        };
      case MESSAGE_TYPES.BACKGROUND_RESOLVE_PAGE_SCRIPT:
        return handleResolvePageScript(message.payload?.pageContext || {});
      case MESSAGE_TYPES.BACKGROUND_FETCH_RESOURCE:
        return handleFetchResource(message.payload || {});
      case MESSAGE_TYPES.BACKGROUND_OPEN_OPTIONS_PAGE:
        return handleOpenOptionsPage();
      default:
        return createErrorResponse(
          "UNKNOWN_MESSAGE",
          "Unsupported runtime message."
        );
    }
  })()
    .then(sendResponse)
    .catch((error) => {
      sendResponse(
        createErrorResponse(
          "UNHANDLED_ERROR",
          "An unexpected error occurred.",
          error.message
        )
      );
    });

  return true;
});
