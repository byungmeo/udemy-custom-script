import { MESSAGE_TYPES } from "../shared/constants.js";
import {
  applyTranslations,
  normalizeUiLanguage,
  t,
} from "../shared/ui-i18n.js";

const elements = {
  pageSummary: document.querySelector("#page-summary"),
  transcriptSummary: document.querySelector("#transcript-summary"),
  matchSummary: document.querySelector("#match-summary"),
  footerStatus: document.querySelector("#footer-status"),
  refresh: document.querySelector("#refresh"),
  copyScript: document.querySelector("#copy-script"),
  translateScript: document.querySelector("#translate-script"),
  openOptions: document.querySelector("#open-options"),
};

let currentLanguage = "en";
let statusPollTimer = null;
let latestStatusResponse = null;

function getErrorText(response, fallbackText) {
  return (
    response?.error?.message ||
    response?.error?.details ||
    fallbackText
  );
}

function setFooterStatus(text, tone = "") {
  elements.footerStatus.textContent = text;
  elements.footerStatus.className = `footer ${tone}`.trim();
}

function applyPopupLanguage(language) {
  currentLanguage = normalizeUiLanguage(language);
  document.documentElement.lang = currentLanguage;
  document.title = t(currentLanguage, "popup.documentTitle");
  applyTranslations(document.body, currentLanguage);
  if (!elements.translateScript.dataset.mode) {
    elements.translateScript.textContent = t(currentLanguage, "popup.translateWithAi");
  }
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

function startStatusPolling() {
  if (statusPollTimer) {
    return;
  }

  statusPollTimer = setInterval(() => {
    void refreshStatus();
  }, 2000);
}

function setTranslateButtonMode(mode) {
  elements.translateScript.dataset.mode = mode;
  elements.translateScript.textContent =
    mode === "cancel"
      ? t(currentLanguage, "popup.cancelAiTranslation")
      : t(currentLanguage, "popup.translateWithAi");
}

async function loadUiLanguage() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_SETTINGS,
  });

  applyPopupLanguage(response?.ok ? response.settings.uiLanguage : "en");
}

function renderStatus(response, { preserveFooter = false } = {}) {
  if (!response?.ok) {
    latestStatusResponse = null;
    elements.pageSummary.textContent =
      response?.error?.message ||
      t(currentLanguage, "popup.activeTabCouldNotBeInspected");
    elements.transcriptSummary.textContent = t(
      currentLanguage,
      "popup.noTranscriptData"
    );
    elements.matchSummary.textContent = t(currentLanguage, "popup.noMatchInfo");
    if (!preserveFooter) {
      setFooterStatus(t(currentLanguage, "popup.openUdemyAndTryAgain"), "status-error");
    }
    elements.translateScript.disabled = false;
    setTranslateButtonMode("translate");
    stopStatusPolling();
    return;
  }

  latestStatusResponse = response;
  const { pageContext, transcriptProbe, match, translationJob } = response;
  elements.pageSummary.textContent = `${pageContext.courseTitle} / ${pageContext.lectureTitle}`;

  if (transcriptProbe?.cueCount) {
    elements.transcriptSummary.textContent = t(currentLanguage, "popup.cueDetected", {
      count: transcriptProbe.cueCount,
      source: transcriptProbe.source,
      language:
        transcriptProbe.selectedLanguage ||
        t(currentLanguage, "popup.unknownLanguage"),
    });
  } else if (transcriptProbe?.detectedTrackCount) {
    elements.transcriptSummary.textContent = t(
      currentLanguage,
      "popup.trackDetected",
      {
        count: transcriptProbe.detectedTrackCount,
        source: transcriptProbe.source,
        language:
          transcriptProbe.selectedLanguage ||
          t(currentLanguage, "popup.unknownLanguage"),
      }
    );
  } else {
    elements.transcriptSummary.textContent = t(
      currentLanguage,
      "popup.noTracksDetected"
    );
  }

  elements.matchSummary.textContent = match?.matched
    ? t(currentLanguage, "popup.savedScriptFound", {
        lookupKey: match.lookupKey,
      })
    : t(currentLanguage, "popup.noSavedScript", {
        lookupKey: match?.lookupKey || t(currentLanguage, "popup.thisPage"),
      });

  if (translationJob?.status === "running") {
    if (!preserveFooter) {
      setFooterStatus(
        translationJob.totalChunks > 0
          ? t(currentLanguage, "popup.translationChunkProgress", {
              currentChunk:
                translationJob.activeChunkIndex || translationJob.completedChunks + 1,
              totalChunks: translationJob.totalChunks,
              completedChunks: translationJob.completedChunks,
              streamedCharacters: translationJob.streamedCharacters,
            })
          : t(currentLanguage, "popup.translationRunningPersisted"),
        "status-ok"
      );
    }
    elements.translateScript.disabled = false;
    setTranslateButtonMode("cancel");
    startStatusPolling();
    return;
  }

  elements.translateScript.disabled = false;
  setTranslateButtonMode("translate");
  stopStatusPolling();

  if (translationJob?.status === "succeeded" && translationJob.fileName) {
    if (!preserveFooter) {
      setFooterStatus(
        t(currentLanguage, "popup.translationSucceededPersisted", {
          fileName: translationJob.fileName,
        }),
        "status-ok"
      );
    }
    return;
  }

  if (translationJob?.status === "failed" && translationJob.errorMessage) {
    if (!preserveFooter) {
      setFooterStatus(
        t(currentLanguage, "popup.translationFailedPersisted", {
          message: translationJob.errorMessage,
        }),
        "status-error"
      );
    }
    return;
  }

  if (translationJob?.status === "cancelled") {
    if (!preserveFooter) {
      setFooterStatus(t(currentLanguage, "popup.translationCancelled"), "status-ok");
    }
    return;
  }

  if (!preserveFooter) {
    setFooterStatus(t(currentLanguage, "common.ready"), "status-ok");
  }
}

async function refreshStatus({ preserveFooter = false } = {}) {
  if (!preserveFooter) {
    setFooterStatus(t(currentLanguage, "popup.inspectingActiveTab"));
  }
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_ACTIVE_TAB_STATUS,
  });
  renderStatus(response, { preserveFooter });
}

async function copyScript() {
  setFooterStatus(t(currentLanguage, "popup.buildingCustomScript"));
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_EXPORT_ACTIVE_TAB_SCRIPT,
  });

  if (!response?.ok) {
    setFooterStatus(
      getErrorText(response, t(currentLanguage, "popup.exportFailed")),
      "status-error"
    );
    return;
  }

  await navigator.clipboard.writeText(response.clipboardText || response.rawText);
  setFooterStatus(
    t(currentLanguage, "popup.copiedToClipboard", {
      fileName: response.fileName,
      cueCount: response.cueCount,
      guidanceSuffix: response.includedLlmGuidance
        ? t(currentLanguage, "popup.guidanceSuffix")
        : "",
    }),
    "status-ok"
  );
}

async function translateScript() {
  const savedMatch = latestStatusResponse?.match;
  if (savedMatch?.matched) {
    const shouldContinue = window.confirm(
      t(currentLanguage, "popup.confirmOverwriteSavedScript", {
        fileName:
          savedMatch?.script?.fileName ||
          savedMatch?.lookupKey ||
          t(currentLanguage, "popup.thisLecture"),
      })
    );

    if (!shouldContinue) {
      setFooterStatus(t(currentLanguage, "common.ready"), "status-ok");
      return;
    }
  }

  elements.translateScript.disabled = true;
  setFooterStatus(
    t(currentLanguage, "popup.translatingWithAi", {
      provider: t(currentLanguage, "common.openai"),
    })
  );

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_TRANSLATE_ACTIVE_TAB_SCRIPT,
  });

  if (!response?.ok) {
    elements.translateScript.disabled = false;
    setFooterStatus(
      getErrorText(response, t(currentLanguage, "popup.exportFailed")),
      "status-error"
    );
    return;
  }

  setFooterStatus(
    t(currentLanguage, "popup.translationRunningPersisted"),
    "status-ok"
  );
  elements.translateScript.disabled = false;
  await refreshStatus();
}

async function cancelTranslation() {
  elements.translateScript.disabled = true;
  setFooterStatus(t(currentLanguage, "popup.translationCancelling"));

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_CANCEL_ACTIVE_TAB_TRANSLATION,
  });

  if (!response?.ok) {
    elements.translateScript.disabled = false;
    setFooterStatus(
      getErrorText(response, t(currentLanguage, "popup.exportFailed")),
      "status-error"
    );
    return;
  }

  elements.translateScript.disabled = false;
  await refreshStatus();
}

elements.refresh.addEventListener("click", () => {
  void refreshStatus();
});

elements.copyScript.addEventListener("click", () => {
  void copyScript();
});

elements.translateScript.addEventListener("click", () => {
  if (elements.translateScript.dataset.mode === "cancel") {
    void cancelTranslation();
    return;
  }

  void translateScript();
});

elements.openOptions.addEventListener("click", () => {
  void chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_OPEN_OPTIONS_PAGE,
  });
});

await loadUiLanguage();
await refreshStatus();

window.addEventListener("beforeunload", () => {
  stopStatusPolling();
});
