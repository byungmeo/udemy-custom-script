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
  openOptions: document.querySelector("#open-options"),
};

let currentLanguage = "en";

function setFooterStatus(text, tone = "") {
  elements.footerStatus.textContent = text;
  elements.footerStatus.className = `footer ${tone}`.trim();
}

function applyPopupLanguage(language) {
  currentLanguage = normalizeUiLanguage(language);
  document.documentElement.lang = currentLanguage;
  document.title = t(currentLanguage, "popup.documentTitle");
  applyTranslations(document.body, currentLanguage);
}

async function loadUiLanguage() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_SETTINGS,
  });

  applyPopupLanguage(response?.ok ? response.settings.uiLanguage : "en");
}

function renderStatus(response) {
  if (!response?.ok) {
    elements.pageSummary.textContent =
      response?.error?.message ||
      t(currentLanguage, "popup.activeTabCouldNotBeInspected");
    elements.transcriptSummary.textContent = t(
      currentLanguage,
      "popup.noTranscriptData"
    );
    elements.matchSummary.textContent = t(currentLanguage, "popup.noMatchInfo");
    setFooterStatus(t(currentLanguage, "popup.openUdemyAndTryAgain"), "status-error");
    return;
  }

  const { pageContext, transcriptProbe, match } = response;
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
  setFooterStatus(t(currentLanguage, "common.ready"), "status-ok");
}

async function refreshStatus() {
  setFooterStatus(t(currentLanguage, "popup.inspectingActiveTab"));
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_GET_ACTIVE_TAB_STATUS,
  });
  renderStatus(response);
}

async function copyScript() {
  setFooterStatus(t(currentLanguage, "popup.buildingCustomScript"));
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_EXPORT_ACTIVE_TAB_SCRIPT,
  });

  if (!response?.ok) {
    setFooterStatus(
      response?.error?.message || t(currentLanguage, "popup.exportFailed"),
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

elements.refresh.addEventListener("click", () => {
  void refreshStatus();
});

elements.copyScript.addEventListener("click", () => {
  void copyScript();
});

elements.openOptions.addEventListener("click", () => {
  void chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BACKGROUND_OPEN_OPTIONS_PAGE,
  });
});

await loadUiLanguage();
await refreshStatus();
