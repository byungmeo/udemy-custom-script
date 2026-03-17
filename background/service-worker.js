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
  filterAndSortOpenAiModels,
  normalizeAiProvider,
  normalizeOpenAiModel,
} from "../shared/ai-providers.js";
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
import {
  cancelOpenAiResponse,
  createOpenAiChunkTranslationResponse,
  extractOpenAiOutputText,
  getOpenAiResponse,
  listOpenAiModels,
  parseOpenAiChunkTranslations,
} from "./openai-provider.js";

const activeTranslationControllers = new Map();
const activeTranslationKeepAliveTimers = new Map();
const DEFAULT_TRANSLATION_CHUNK_SIZE = 40;
const OPENAI_PROMPT_CACHE_VERSION = "p3";
const TRANSLATION_KEEPALIVE_INTERVAL_MS = 20_000;
const TRANSLATION_KEEPALIVE_LOG_EVERY = 3;

function stopTranslationKeepAlive(lookupKey) {
  const timer = activeTranslationKeepAliveTimers.get(lookupKey);
  if (!timer) {
    return;
  }

  clearInterval(timer);
  activeTranslationKeepAliveTimers.delete(lookupKey);
}

function startTranslationKeepAlive(lookupKey, jobId) {
  stopTranslationKeepAlive(lookupKey);

  let heartbeatCount = 0;
  const timer = setInterval(() => {
    void chrome.runtime
      .getPlatformInfo()
      .then(() => {
        heartbeatCount += 1;
        if (heartbeatCount % TRANSLATION_KEEPALIVE_LOG_EVERY === 0) {
          console.info("[UCS][AI] Keepalive heartbeat", {
            lookupKey,
            jobId,
            heartbeatCount,
          });
        }
      })
      .catch((error) => {
        console.warn("[UCS][AI] Keepalive heartbeat failed", {
          lookupKey,
          jobId,
          message: error?.message || "Unknown keepalive failure.",
        });
      });
  }, TRANSLATION_KEEPALIVE_INTERVAL_MS);

  activeTranslationKeepAliveTimers.set(lookupKey, timer);
}

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
    aiProvider: normalizeAiProvider(rawSettings?.aiProvider),
    openAiModel: normalizeOpenAiModel(rawSettings?.openAiModel),
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

function normalizeProviderSecrets(rawSecrets = {}) {
  return {
    openAiApiKey: String(rawSecrets?.openAiApiKey ?? "").trim(),
  };
}

async function getProviderSecrets() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.PROVIDER_SECRETS);
  return normalizeProviderSecrets(stored[STORAGE_KEYS.PROVIDER_SECRETS] || {});
}

function normalizeProviderCache(rawCache = {}) {
  return {
    openAiModels: Array.isArray(rawCache?.openAiModels)
      ? filterAndSortOpenAiModels(rawCache.openAiModels)
      : [],
    openAiModelsFetchedAt: String(rawCache?.openAiModelsFetchedAt ?? ""),
  };
}

async function getProviderCache() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.PROVIDER_CACHE);
  return normalizeProviderCache(stored[STORAGE_KEYS.PROVIDER_CACHE] || {});
}

async function updateProviderCache(nextCache) {
  const current = await getProviderCache();
  const merged = normalizeProviderCache({
    ...current,
    ...nextCache,
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.PROVIDER_CACHE]: merged,
  });

  return merged;
}

function normalizeTranslationJob(rawJob = {}) {
  return {
    jobId: String(rawJob?.jobId ?? "").trim(),
    lookupKey: String(rawJob?.lookupKey ?? "").trim(),
    provider: String(rawJob?.provider ?? "").trim(),
    model: String(rawJob?.model ?? "").trim(),
    openAiResponseId: String(rawJob?.openAiResponseId ?? "").trim(),
    streamedCharacters: Number.isFinite(Number(rawJob?.streamedCharacters))
      ? Number(rawJob.streamedCharacters)
      : 0,
    totalCueCount: Number.isFinite(Number(rawJob?.totalCueCount))
      ? Number(rawJob.totalCueCount)
      : 0,
    totalChunks: Number.isFinite(Number(rawJob?.totalChunks))
      ? Number(rawJob.totalChunks)
      : 0,
    completedChunks: Number.isFinite(Number(rawJob?.completedChunks))
      ? Number(rawJob.completedChunks)
      : 0,
    activeChunkIndex: Number.isFinite(Number(rawJob?.activeChunkIndex))
      ? Number(rawJob.activeChunkIndex)
      : 0,
    activeChunkCueCount: Number.isFinite(Number(rawJob?.activeChunkCueCount))
      ? Number(rawJob.activeChunkCueCount)
      : 0,
    status: ["running", "succeeded", "failed", "cancelled"].includes(rawJob?.status)
      ? rawJob.status
      : "failed",
    startedAt: String(rawJob?.startedAt ?? ""),
    completedAt: String(rawJob?.completedAt ?? ""),
    fileName: String(rawJob?.fileName ?? "").trim(),
    errorMessage: String(rawJob?.errorMessage ?? "").trim(),
  };
}

async function getTranslationJobs() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.TRANSLATION_JOBS);
  const rawJobs = stored[STORAGE_KEYS.TRANSLATION_JOBS] || {};
  const normalizedJobs = {};

  for (const [lookupKey, rawJob] of Object.entries(rawJobs)) {
    const normalizedJob = normalizeTranslationJob(rawJob);
    if (normalizedJob.lookupKey) {
      normalizedJobs[lookupKey] = normalizedJob;
    }
  }

  return normalizedJobs;
}

async function saveTranslationJobs(nextJobs) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TRANSLATION_JOBS]: nextJobs,
  });
}

async function upsertTranslationJob(lookupKey, jobPatch) {
  const jobs = await getTranslationJobs();
  const currentJob = jobs[lookupKey] || {
    jobId: "",
    lookupKey,
    provider: "",
    model: "",
    openAiResponseId: "",
    streamedCharacters: 0,
    totalCueCount: 0,
    totalChunks: 0,
    completedChunks: 0,
    activeChunkIndex: 0,
    activeChunkCueCount: 0,
    status: "failed",
    startedAt: "",
    completedAt: "",
    fileName: "",
    errorMessage: "",
  };
  jobs[lookupKey] = normalizeTranslationJob({
    ...currentJob,
    ...jobPatch,
    lookupKey,
  });
  await saveTranslationJobs(jobs);
  return jobs[lookupKey];
}

async function getTranslationJob(lookupKey) {
  const jobs = await getTranslationJobs();
  return jobs[lookupKey] || null;
}

function normalizeIndexedCue(rawCue = {}, fallbackIndex = 0) {
  return {
    timeline: String(rawCue?.timeline ?? "").trim(),
    sourceText: String(rawCue?.sourceText ?? "").trim(),
    translatedText: String(rawCue?.translatedText ?? "").trim(),
    originalIndex: Number.isFinite(Number(rawCue?.originalIndex))
      ? Number(rawCue.originalIndex)
      : fallbackIndex,
    entryId: String(rawCue?.entryId || `cue-${fallbackIndex + 1}`).trim(),
  };
}

function createIndexedCues(cues = []) {
  return cues.map((cue, index) =>
    normalizeIndexedCue(
      {
        ...cue,
        originalIndex: index,
        entryId: `cue-${index + 1}`,
      },
      index
    )
  );
}

function snapshotTranslationSettings(settings = {}) {
  return {
    llmTargetLanguage: String(settings?.llmTargetLanguage || "ko"),
    llmGuidanceMode: settings?.llmGuidanceMode === "custom" ? "custom" : "default",
    llmTranslationGuidance: String(settings?.llmTranslationGuidance ?? ""),
  };
}

function normalizeTranslationSession(rawSession = {}) {
  const cues = Array.isArray(rawSession?.cues)
    ? rawSession.cues.map((cue, index) => normalizeIndexedCue(cue, index))
    : [];
  const translatedTexts = Array.from(
    { length: Math.max(cues.length, Array.isArray(rawSession?.translatedTexts) ? rawSession.translatedTexts.length : 0) },
    (_value, index) => String(rawSession?.translatedTexts?.[index] ?? "")
  );

  return {
    lookupKey: String(rawSession?.lookupKey ?? "").trim(),
    jobId: String(rawSession?.jobId ?? "").trim(),
    provider: String(rawSession?.provider ?? "").trim(),
    model: String(rawSession?.model ?? "").trim(),
    chunkSize: Number.isFinite(Number(rawSession?.chunkSize))
      ? Number(rawSession.chunkSize)
      : DEFAULT_TRANSLATION_CHUNK_SIZE,
    metadata:
      rawSession?.metadata && typeof rawSession.metadata === "object"
        ? rawSession.metadata
        : null,
    cues,
    translatedTexts,
    settings: snapshotTranslationSettings(rawSession?.settings || {}),
    partialSaveEnabled: rawSession?.partialSaveEnabled !== false,
    createdAt: String(rawSession?.createdAt ?? ""),
    updatedAt: String(rawSession?.updatedAt ?? ""),
  };
}

async function getTranslationSessions() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.TRANSLATION_SESSIONS);
  const rawSessions = stored[STORAGE_KEYS.TRANSLATION_SESSIONS] || {};
  const normalizedSessions = {};

  for (const [lookupKey, rawSession] of Object.entries(rawSessions)) {
    const normalizedSession = normalizeTranslationSession(rawSession);
    if (normalizedSession.lookupKey) {
      normalizedSessions[lookupKey] = normalizedSession;
    }
  }

  return normalizedSessions;
}

async function saveTranslationSessions(nextSessions) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TRANSLATION_SESSIONS]: nextSessions,
  });
}

async function upsertTranslationSession(lookupKey, sessionPatch) {
  const sessions = await getTranslationSessions();
  const currentSession = sessions[lookupKey] || {
    lookupKey,
    jobId: "",
    provider: "",
    model: "",
    chunkSize: DEFAULT_TRANSLATION_CHUNK_SIZE,
    metadata: null,
    cues: [],
    translatedTexts: [],
    settings: snapshotTranslationSettings({}),
    partialSaveEnabled: true,
    createdAt: "",
    updatedAt: "",
  };

  const nextSession = normalizeTranslationSession({
    ...currentSession,
    ...sessionPatch,
    lookupKey,
    createdAt: currentSession.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  sessions[lookupKey] = nextSession;
  await saveTranslationSessions(sessions);
  return nextSession;
}

async function getTranslationSession(lookupKey) {
  const sessions = await getTranslationSessions();
  return sessions[lookupKey] || null;
}

async function deleteTranslationSession(lookupKey) {
  const sessions = await getTranslationSessions();
  if (!(lookupKey in sessions)) {
    return;
  }

  delete sessions[lookupKey];
  await saveTranslationSessions(sessions);
}

function getChunkCuesForIndex(session, chunkIndex) {
  const safeChunkIndex = Math.max(1, Number(chunkIndex) || 1);
  const chunkSize = Math.max(1, Number(session?.chunkSize) || DEFAULT_TRANSLATION_CHUNK_SIZE);
  const cues = Array.isArray(session?.cues) ? session.cues : [];
  const start = (safeChunkIndex - 1) * chunkSize;
  return cues.slice(start, start + chunkSize);
}

function buildTranslatedCuesFromSession(session) {
  return (session?.cues || []).map((cue) => ({
    timeline: cue.timeline,
    sourceText: cue.sourceText,
    translatedText: String(session?.translatedTexts?.[cue.originalIndex] ?? "").trim(),
  }));
}

async function persistChunkTranslationsToSession(lookupKey, chunkCues, chunkTranslations) {
  const session = await getTranslationSession(lookupKey);
  if (!session) {
    throw new Error("The translation session no longer exists.");
  }

  const nextTranslatedTexts = [...session.translatedTexts];
  chunkCues.forEach((cue, index) => {
    nextTranslatedTexts[cue.originalIndex] = String(chunkTranslations[index] ?? "").trim();
  });

  return upsertTranslationSession(lookupKey, {
    translatedTexts: nextTranslatedTexts,
  });
}

function isSessionFullyTranslated(session) {
  const cues = Array.isArray(session?.cues) ? session.cues : [];
  const translatedTexts = Array.isArray(session?.translatedTexts)
    ? session.translatedTexts
    : [];

  if (!cues.length) {
    return false;
  }

  return cues.every((cue) => Boolean(String(translatedTexts[cue.originalIndex] ?? "").trim()));
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForCompletedOpenAiResponse({
  apiKey,
  responseId,
  maxAttempts = 5,
  delayMs = 1200,
}) {
  let lastResponse = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const responseJson = await getOpenAiResponse({
      apiKey,
      responseId,
    });
    lastResponse = responseJson;

    if (extractOpenAiOutputText(responseJson).trim()) {
      return responseJson;
    }

    if (attempt < maxAttempts) {
      console.info("[UCS][AI] Final response not ready yet, retrying", {
        responseId,
        attempt,
        maxAttempts,
      });
      await delay(delayMs);
    }
  }

  return lastResponse;
}

async function recoverCompletedChunkFromResponse(job, session, apiKey) {
  const chunkIndex = Math.max(1, Number(job?.activeChunkIndex) || Number(job?.completedChunks || 0) + 1);
  const chunkCues = getChunkCuesForIndex(session, chunkIndex);
  if (!chunkCues.length) {
    throw new Error("The interrupted translation chunk could not be located.");
  }

  const responseJson = await waitForCompletedOpenAiResponse({
    apiKey,
    responseId: job.openAiResponseId,
  });
  const chunkTranslations = parseOpenAiChunkTranslations(responseJson, chunkCues);
  const updatedSession = await persistChunkTranslationsToSession(
    job.lookupKey,
    chunkCues,
    chunkTranslations
  );
  await persistPartialTranslationRecord(
    job.lookupKey,
    updatedSession,
    Math.max(Number(job.completedChunks || 0), chunkIndex),
    Number(job.totalChunks || 0)
  );
  await upsertTranslationJob(job.lookupKey, {
    completedChunks: Math.max(Number(job.completedChunks || 0), chunkIndex),
    activeChunkIndex: chunkIndex,
    activeChunkCueCount: chunkCues.length,
    streamedCharacters: 0,
    openAiResponseId: "",
    status: "running",
    errorMessage: "",
  });

  console.info("[UCS][AI] Recovered completed chunk after service worker restart", {
    lookupKey: job.lookupKey,
    jobId: job.jobId,
    chunkIndex,
    totalChunks: job.totalChunks,
    responseId: job.openAiResponseId,
  });
}

async function reconcileTranslationJob(job, secrets) {
  if (!job || job.provider !== "openai" || job.status !== "running") {
    return job;
  }

  if (activeTranslationControllers.has(job.lookupKey)) {
    return job;
  }

  const session = await getTranslationSession(job.lookupKey);
  if (!session) {
    await upsertTranslationJob(job.lookupKey, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage:
        "The translation session was interrupted and the local recovery data is missing. Please run the translation again.",
    });
    return getTranslationJob(job.lookupKey);
  }

  if (!secrets.openAiApiKey) {
    return job;
  }

  if (!job.openAiResponseId) {
    if (isSessionFullyTranslated(session)) {
      await finalizeTranslationSession(job.lookupKey);
      return getTranslationJob(job.lookupKey);
    }

    console.info("[UCS][AI] Resuming translation after service worker restart", {
      lookupKey: job.lookupKey,
      jobId: job.jobId,
      completedChunks: job.completedChunks,
      totalChunks: job.totalChunks,
    });
    startTranslationPipeline({
      lookupKey: job.lookupKey,
      jobId: job.jobId,
      apiKey: secrets.openAiApiKey,
      model: job.model,
    });
    return getTranslationJob(job.lookupKey);
  }

  const responseJson = await getOpenAiResponse({
    apiKey: secrets.openAiApiKey,
    responseId: job.openAiResponseId,
  });
  const status = String(responseJson?.status ?? "").trim();

  if (status === "cancelled" || status === "canceled") {
    await deleteTranslationSession(job.lookupKey);
    await upsertTranslationJob(job.lookupKey, {
      status: "cancelled",
      completedAt: new Date().toISOString(),
      errorMessage: "",
    });
    return getTranslationJob(job.lookupKey);
  }

  if (status === "failed" || status === "incomplete") {
    await deleteTranslationSession(job.lookupKey);
    await upsertTranslationJob(job.lookupKey, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage:
        responseJson?.error?.message ||
        "The OpenAI background response did not complete successfully.",
    });
    return getTranslationJob(job.lookupKey);
  }

  if (status === "completed") {
    await recoverCompletedChunkFromResponse(job, session, secrets.openAiApiKey);
    const refreshedSession = await getTranslationSession(job.lookupKey);
    if (refreshedSession && isSessionFullyTranslated(refreshedSession)) {
      await finalizeTranslationSession(job.lookupKey);
      return getTranslationJob(job.lookupKey);
    }

    startTranslationPipeline({
      lookupKey: job.lookupKey,
      jobId: job.jobId,
      apiKey: secrets.openAiApiKey,
      model: job.model,
    });
    return getTranslationJob(job.lookupKey);
  }

  return job;
}

async function updateProviderSecrets(nextSecrets) {
  const current = await getProviderSecrets();
  const merged = normalizeProviderSecrets({
    ...current,
    ...nextSecrets,
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.PROVIDER_SECRETS]: merged,
  });

  return merged;
}

async function getProviderSettings() {
  const settings = await getSettings();
  const secrets = await getProviderSecrets();
  const cache = await getProviderCache();

  return {
    aiProvider: settings.aiProvider,
    openAiModel: settings.openAiModel,
    hasOpenAiApiKey: Boolean(secrets.openAiApiKey),
    openAiModels: cache.openAiModels,
    openAiModelsFetchedAt: cache.openAiModelsFetchedAt,
  };
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
    const secrets = await getProviderSecrets();
    const translationJob = await reconcileTranslationJob(
      await getTranslationJob(match.lookupKey),
      secrets
    );

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
      translationJob,
    };
  } catch (error) {
    return createErrorResponse(
      "ACTIVE_TAB_STATUS_FAILED",
      "The active lecture status could not be refreshed.",
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

async function buildActiveTabCustomScript() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active browser tab is available.");
  }

  const snapshot = await requestPageSnapshot(tab.id, true);
  if (!snapshot?.ok) {
    throw new Error(snapshot?.error?.message || "Could not inspect the current tab.");
  }

  if (!snapshot.cues?.length) {
    throw new Error(
      "No transcript cues were detected. Try enabling captions or starting playback before translating."
    );
  }

  const metadata = buildMetadataFromSnapshot(snapshot.pageContext, snapshot);
  const rawText = serializeCustomScript({
    metadata,
    cues: snapshot.cues,
  });

  return {
    rawText,
    metadata,
    cues: snapshot.cues,
    cueCount: snapshot.cues.length,
  };
}

function splitCueChunks(cues, chunkSize = DEFAULT_TRANSLATION_CHUNK_SIZE) {
  const chunks = [];

  for (let index = 0; index < cues.length; index += chunkSize) {
    chunks.push(cues.slice(index, index + chunkSize));
  }

  return chunks;
}

function buildCompactMetadataContext(metadata, settings) {
  const courseDescription = String(metadata?.course?.description ?? "").trim();

  return {
    course_id: metadata?.identity?.course_id || "",
    course_slug: metadata?.identity?.course_slug || "",
    provider: metadata?.provider || "udemy",
    target_language: settings.llmTargetLanguage,
    transcript_language: metadata?.transcript?.language || "",
    course_title: metadata?.course?.title || "",
    course_level: metadata?.course?.level_label || metadata?.course?.level || "",
    course_default_language: metadata?.course?.default_language || "",
    course_description: courseDescription.slice(0, 1600),
  };
}

function shouldRetryChunkBySplitting(error, chunkCues) {
  const message = String(error?.message || "");
  return (
    chunkCues.length > 1 &&
    (message.includes("translated entries for") ||
      message.includes("without translated entries") ||
      message.includes("did not return any translated entries") ||
      message.includes("did not return a translated entry for entry_id") ||
      message.includes("returned duplicate translations for entry_id") ||
      message.includes("returned unknown entry ids"))
  );
}

async function requestChunkTranslations({
  lookupKey,
  jobId,
  chunkLabel,
  chunkIndex,
  totalChunks,
  chunkCues,
  apiKey,
  model,
  courseContext,
  lectureContext,
  settings,
  promptCacheKey,
  promptCacheRetention,
  controller,
}) {
  let chunkTranslations = null;

  await createOpenAiChunkTranslationResponse({
    apiKey,
    model,
    courseContext,
    lectureContext,
    chunkCues,
    settings,
    promptCacheKey,
    promptCacheRetention,
    signal: controller.signal,
    onEvent: async (event) => {
      const eventType = String(event?.type ?? "").trim();
      const responseId = String(
        event?.response?.id ?? event?.response_id ?? event?.id ?? ""
      ).trim();

      if (responseId) {
        await upsertTranslationJob(lookupKey, {
          openAiResponseId: responseId,
        });

        if (
          eventType === "response.created" ||
          eventType === "response.in_progress"
        ) {
          console.info("[UCS][AI] OpenAI chunk event", {
            lookupKey,
            jobId,
            chunkLabel,
            chunkIndex,
            totalChunks,
            eventType,
            responseId,
          });
        }
      }

      if (eventType === "response.output_text.delta") {
        const deltaText = String(event?.delta ?? "");
        const currentJob = await getTranslationJob(lookupKey);
        const updatedJob = await upsertTranslationJob(lookupKey, {
          streamedCharacters:
            Number(currentJob?.streamedCharacters || 0) + deltaText.length,
        });
        if (
          updatedJob.streamedCharacters > 0 &&
          updatedJob.streamedCharacters % 2000 < deltaText.length
        ) {
          console.info("[UCS][AI] Chunk streaming progress", {
            lookupKey,
            jobId,
            chunkLabel,
            chunkIndex,
            totalChunks,
            responseId: updatedJob.openAiResponseId,
            streamedCharacters: updatedJob.streamedCharacters,
          });
        }
        return;
      }

      if (eventType === "response.completed") {
        const currentJob = await getTranslationJob(lookupKey);
        const finalResponseId = responseId || currentJob?.openAiResponseId || "";
        if (!finalResponseId) {
          throw new Error("OpenAI completed the chunk response without an id.");
        }

        const responseJson = await waitForCompletedOpenAiResponse({
          apiKey,
          responseId: finalResponseId,
        });
        chunkTranslations = parseOpenAiChunkTranslations(responseJson, chunkCues);
        console.info("[UCS][AI] Chunk completed", {
          lookupKey,
          jobId,
          chunkLabel,
          chunkIndex,
          totalChunks,
          responseId: finalResponseId,
          cachedInputTokens:
            responseJson?.usage?.input_tokens_details?.cached_tokens ??
            responseJson?.usage?.cached_input_tokens ??
            0,
        });
        return;
      }

      if (eventType === "response.failed") {
        throw new Error(
          event?.error?.message || "The OpenAI chunk response failed."
        );
      }

      if (eventType === "response.cancelled" || eventType === "response.canceled") {
        throw new Error("The OpenAI chunk response was cancelled.");
      }
    },
  });

  if (!chunkTranslations) {
    throw new Error(`${chunkLabel} completed without translated entries.`);
  }

  return chunkTranslations;
}

async function translateChunkWithFallback({
  lookupKey,
  jobId,
  chunkLabel,
  chunkIndex,
  totalChunks,
  chunkCues,
  apiKey,
  model,
  courseContext,
  lectureContext,
  settings,
  promptCacheKey,
  promptCacheRetention,
  controller,
}) {
  try {
    return await requestChunkTranslations({
      lookupKey,
      jobId,
      chunkLabel,
      chunkIndex,
      totalChunks,
      chunkCues,
      apiKey,
      model,
      courseContext,
      lectureContext,
      settings,
      promptCacheKey,
      promptCacheRetention,
      controller,
    });
  } catch (error) {
    if (!shouldRetryChunkBySplitting(error, chunkCues)) {
      throw error;
    }

    const midpoint = Math.ceil(chunkCues.length / 2);
    const leftChunk = chunkCues.slice(0, midpoint);
    const rightChunk = chunkCues.slice(midpoint);

    console.warn("[UCS][AI] Splitting chunk after mismatch", {
      lookupKey,
      jobId,
      chunkLabel,
      chunkIndex,
      totalChunks,
      originalCueCount: chunkCues.length,
      leftCueCount: leftChunk.length,
      rightCueCount: rightChunk.length,
      message: error?.message || "Chunk translation mismatch.",
    });

    const leftTranslations = await translateChunkWithFallback({
      lookupKey,
      jobId,
      chunkLabel: `${chunkLabel}.1`,
      chunkIndex,
      totalChunks,
      chunkCues: leftChunk,
      apiKey,
      model,
      courseContext,
      lectureContext,
      settings,
      promptCacheKey,
      promptCacheRetention,
      controller,
    });

    const rightTranslations = await translateChunkWithFallback({
      lookupKey,
      jobId,
      chunkLabel: `${chunkLabel}.2`,
      chunkIndex,
      totalChunks,
      chunkCues: rightChunk,
      apiKey,
      model,
      courseContext,
      lectureContext,
      settings,
      promptCacheKey,
      promptCacheRetention,
      controller,
    });

    return [...leftTranslations, ...rightTranslations];
  }
}

function buildLectureContext(metadata) {
  return {
    section_id: metadata?.identity?.section_id || "",
    section_index: metadata?.identity?.section_index || 0,
    section_title: metadata?.section?.title || "",
    lecture_id: metadata?.identity?.lecture_id || "",
    lecture_index: metadata?.identity?.lecture_index || 0,
    lecture_title: metadata?.lecture?.title || "",
    lecture_lookup_key: metadata?.identity?.lookup_key || "",
  };
}

function buildPromptCacheKey(metadata, settings) {
  const courseId = metadata?.identity?.course_id || "unknown-course";
  const targetLanguage = settings.llmTargetLanguage || "unknown-language";
  const guidanceSignature =
    settings.llmGuidanceMode === "custom"
      ? `gc${computeShortHash(settings.llmTranslationGuidance || "")}`
      : `gd${OPENAI_PROMPT_CACHE_VERSION}`;

  return `ucs_oai_${OPENAI_PROMPT_CACHE_VERSION}_c${courseId}_t${targetLanguage}_${guidanceSignature}`.slice(
    0,
    64
  );
}

function resolvePromptCacheRetention(model) {
  const normalizedModel = String(model ?? "").trim().toLowerCase();
  if (/^gpt-5(?!.*mini)/.test(normalizedModel) || /^gpt-4\.1(?!.*mini)/.test(normalizedModel)) {
    return "24h";
  }

  return undefined;
}

function computeShortHash(value) {
  const input = String(value ?? "");
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

async function saveTranslatedCueSet({
  metadata,
  cues,
  provider,
  model,
  lookupKey,
  partialTranslation = false,
  completedChunks = 0,
  totalChunks = 0,
  markTranslationSucceeded = true,
}) {
  const translatedRawText = serializeCustomScript({
    metadata,
    cues,
  });
  const parsed = parseCustomScript(translatedRawText);
  const result = await saveScriptRecord(parsed, {
    partialTranslation,
    completedChunks,
    totalChunks,
    provider,
    model,
  });

  if (markTranslationSucceeded) {
    await upsertTranslationJob(lookupKey, {
      provider,
      model,
      status: "succeeded",
      completedAt: new Date().toISOString(),
      fileName: result.fileName,
      errorMessage: "",
      completedChunks: 0,
      activeChunkIndex: 0,
      activeChunkCueCount: 0,
      streamedCharacters: 0,
      openAiResponseId: "",
    });
  } else {
    await upsertTranslationJob(lookupKey, {
      fileName: result.fileName,
    });
  }

  await broadcastExtensionStateChanged();
  return result;
}

async function persistPartialTranslationRecord(lookupKey, session, completedChunks, totalChunks) {
  if (!session?.partialSaveEnabled || !session?.metadata) {
    return null;
  }

  return saveTranslatedCueSet({
    metadata: session.metadata,
    cues: buildTranslatedCuesFromSession(session),
    provider: session.provider,
    model: session.model,
    lookupKey,
    partialTranslation: completedChunks < totalChunks,
    completedChunks,
    totalChunks,
    markTranslationSucceeded: false,
  });
}

function isChunkTranslated(session, chunkCues) {
  return chunkCues.every((cue) =>
    Boolean(String(session?.translatedTexts?.[cue.originalIndex] ?? "").trim())
  );
}

async function finalizeTranslationSession(lookupKey) {
  const session = await getTranslationSession(lookupKey);
  if (!session || !session.metadata) {
    throw new Error("The translation session is missing metadata.");
  }

  if (!isSessionFullyTranslated(session)) {
    throw new Error("The translation session is incomplete and cannot be finalized yet.");
  }

  const result = await saveTranslatedCueSet({
    metadata: session.metadata,
    cues: buildTranslatedCuesFromSession(session),
    provider: session.provider,
    model: session.model,
    lookupKey,
  });
  await deleteTranslationSession(lookupKey);
  return result;
}

async function runTranslationPipeline({
  lookupKey,
  jobId,
  apiKey,
  model,
}) {
  const session = await getTranslationSession(lookupKey);
  if (!session || !session.metadata) {
    throw new Error("The translation session is unavailable.");
  }

  const cueChunks = splitCueChunks(session.cues, session.chunkSize);
  const courseContext = buildCompactMetadataContext(session.metadata, session.settings);
  const lectureContext = buildLectureContext(session.metadata);
  const promptCacheKey = buildPromptCacheKey(session.metadata, session.settings);
  const promptCacheRetention = resolvePromptCacheRetention(model);
  const controller = new AbortController();
  activeTranslationControllers.set(lookupKey, controller);
  startTranslationKeepAlive(lookupKey, jobId);

  try {
    let currentSession = session;

    for (let chunkIndex = 0; chunkIndex < cueChunks.length; chunkIndex += 1) {
      const chunkCues = cueChunks[chunkIndex];
      if (isChunkTranslated(currentSession, chunkCues)) {
        await upsertTranslationJob(lookupKey, {
          completedChunks: Math.max(chunkIndex + 1, Number((await getTranslationJob(lookupKey))?.completedChunks || 0)),
          activeChunkIndex: chunkIndex + 1,
          activeChunkCueCount: chunkCues.length,
          streamedCharacters: 0,
          openAiResponseId: "",
        });
        continue;
      }

      await upsertTranslationJob(lookupKey, {
        activeChunkIndex: chunkIndex + 1,
        activeChunkCueCount: chunkCues.length,
        streamedCharacters: 0,
        openAiResponseId: "",
        completedChunks: chunkIndex,
        status: "running",
        errorMessage: "",
      });
      console.info("[UCS][AI] Chunk started", {
        lookupKey,
        jobId,
        chunkIndex: chunkIndex + 1,
        totalChunks: cueChunks.length,
        chunkCueCount: chunkCues.length,
      });

      const chunkTranslations = await translateChunkWithFallback({
        lookupKey,
        jobId,
        chunkLabel: `chunk-${chunkIndex + 1}`,
        chunkIndex: chunkIndex + 1,
        totalChunks: cueChunks.length,
        chunkCues,
        apiKey,
        model,
        courseContext,
        lectureContext,
        settings: session.settings,
        promptCacheKey,
        promptCacheRetention,
        controller,
      });

      currentSession = await persistChunkTranslationsToSession(
        lookupKey,
        chunkCues,
        chunkTranslations
      );
      await persistPartialTranslationRecord(
        lookupKey,
        currentSession,
        chunkIndex + 1,
        cueChunks.length
      );

      await upsertTranslationJob(lookupKey, {
        completedChunks: chunkIndex + 1,
        streamedCharacters: 0,
        openAiResponseId: "",
      });
    }

    const result = await finalizeTranslationSession(lookupKey);
    console.info("[UCS][AI] Translation completed", {
      lookupKey,
      jobId,
      fileName: result.fileName,
      totalChunks: cueChunks.length,
    });
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      await deleteTranslationSession(lookupKey);
      await upsertTranslationJob(lookupKey, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
        errorMessage: "",
      });
      console.info("[UCS][AI] Translation aborted locally", {
        lookupKey,
        jobId,
      });
      return null;
    }

    await deleteTranslationSession(lookupKey);
    await upsertTranslationJob(lookupKey, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage: error?.message || "Translation failed.",
    });
    console.error("[UCS][AI] Translation pipeline error", {
      lookupKey,
      jobId,
      message: error?.message || "Translation failed.",
    });
    throw error;
  } finally {
    stopTranslationKeepAlive(lookupKey);
    activeTranslationControllers.delete(lookupKey);
  }
}

function startTranslationPipeline(task) {
  if (activeTranslationControllers.has(task.lookupKey)) {
    return;
  }

  void runTranslationPipeline(task).catch(() => {
    // runTranslationPipeline already persists the final job state and logs the error.
  });
}

async function handleGetProviderSettings() {
  return {
    ok: true,
    providerSettings: await getProviderSettings(),
  };
}

async function handleUpdateProviderSettings(payload) {
  const nextSettings = {};
  if (payload && "aiProvider" in payload) {
    nextSettings.aiProvider = normalizeAiProvider(payload.aiProvider);
  }
  if (payload && "openAiModel" in payload) {
    nextSettings.openAiModel = normalizeOpenAiModel(payload.openAiModel);
  }

  const updatedSettings = await updateSettings(nextSettings);
  const secretPatch = {};
  if (payload && "openAiApiKey" in payload) {
    secretPatch.openAiApiKey = payload.openAiApiKey;
  }
  const updatedSecrets = await updateProviderSecrets(secretPatch);

  return {
    ok: true,
    providerSettings: {
      aiProvider: updatedSettings.aiProvider,
      openAiModel: updatedSettings.openAiModel,
      hasOpenAiApiKey: Boolean(updatedSecrets.openAiApiKey),
    },
  };
}

async function handleTranslateActiveTabScript() {
  const settings = await getSettings();
  const secrets = await getProviderSecrets();
  const { cueCount, metadata, cues } = await buildActiveTabCustomScript();
  const lookupKey = metadata.identity.lookup_key;
  const jobId = crypto.randomUUID();
  const indexedCues = createIndexedCues(cues);
  const cueChunks = splitCueChunks(indexedCues);
  const existingRecord = await getScriptRecord(lookupKey);
  const partialSaveEnabled =
    !existingRecord || existingRecord?.translationProgress?.isPartial === true;
  const promptCacheKey = buildPromptCacheKey(metadata, settings);
  const promptCacheRetention = resolvePromptCacheRetention(settings.openAiModel);

  if (settings.aiProvider !== "openai") {
    return createErrorResponse(
      "UNSUPPORTED_PROVIDER",
      "The selected AI provider is not supported yet."
    );
  }

  if (!secrets.openAiApiKey) {
    return createErrorResponse(
      "OPENAI_API_KEY_MISSING",
      "OpenAI API key is missing. Add it in the options page first."
    );
  }

  await upsertTranslationSession(lookupKey, {
    jobId,
    provider: settings.aiProvider,
    model: settings.openAiModel,
    chunkSize: DEFAULT_TRANSLATION_CHUNK_SIZE,
    metadata,
    cues: indexedCues,
    translatedTexts: new Array(indexedCues.length).fill(""),
    settings: snapshotTranslationSettings(settings),
    partialSaveEnabled,
  });

  await upsertTranslationJob(lookupKey, {
    jobId,
    provider: settings.aiProvider,
    model: settings.openAiModel,
    openAiResponseId: "",
    streamedCharacters: 0,
    totalCueCount: cueCount,
    totalChunks: cueChunks.length,
    completedChunks: 0,
    activeChunkIndex: 1,
    activeChunkCueCount: cueChunks[0]?.length || 0,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: "",
    fileName: "",
    errorMessage: "",
  });
  console.info("[UCS][AI] Translation started", {
    lookupKey,
    provider: settings.aiProvider,
    model: settings.openAiModel,
    cueCount,
    totalChunks: cueChunks.length,
    promptCacheKey,
    promptCacheRetention: promptCacheRetention || "default",
    jobId,
  });
  startTranslationPipeline({
    lookupKey,
    jobId,
    apiKey: secrets.openAiApiKey,
    model: settings.openAiModel,
  });

  return {
    ok: true,
    started: true,
    cueCount,
    totalChunks: cueChunks.length,
    provider: settings.aiProvider,
    model: settings.openAiModel,
    translationJob: await getTranslationJob(lookupKey),
  };
}

async function handleCancelActiveTabTranslation() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return createErrorResponse(
      "NO_ACTIVE_TAB",
      "No active browser tab is available."
    );
  }

  const snapshot = await requestPageSnapshot(tab.id, false);
  if (!snapshot?.ok) {
    return snapshot || createErrorResponse("SNAPSHOT_FAILED", "Could not inspect the current tab.");
  }

  const identity = buildPageIdentityFromContext(snapshot.pageContext);
  const lookupKey = buildLookupKey(identity);
  const job = await getTranslationJob(lookupKey);

  if (!job || job.status !== "running") {
    return createErrorResponse(
      "NO_RUNNING_TRANSLATION",
      "No AI translation is currently running for this lecture."
    );
  }

  const secrets = await getProviderSecrets();
  if (job.provider === "openai" && job.openAiResponseId && secrets.openAiApiKey) {
    try {
      await cancelOpenAiResponse({
        apiKey: secrets.openAiApiKey,
        responseId: job.openAiResponseId,
      });
    } catch (_error) {
      // Fall back to aborting the local stream even if cancel fails remotely.
    }
  }

  const controller = activeTranslationControllers.get(lookupKey);
  controller?.abort();
  console.info("[UCS][AI] Cancel requested", {
    lookupKey,
    jobId: job.jobId,
    responseId: job.openAiResponseId,
  });

  await deleteTranslationSession(lookupKey);
  await upsertTranslationJob(lookupKey, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
    errorMessage: "",
  });

  return {
    ok: true,
    translationJob: await getTranslationJob(lookupKey),
  };
}

async function handleRefreshOpenAiModels() {
  const secrets = await getProviderSecrets();
  if (!secrets.openAiApiKey) {
    return createErrorResponse(
      "OPENAI_API_KEY_MISSING",
      "OpenAI API key is missing. Add it in the options page first."
    );
  }

  const models = await listOpenAiModels({
    apiKey: secrets.openAiApiKey,
  });
  const cache = await updateProviderCache({
    openAiModels: models,
    openAiModelsFetchedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    models: cache.openAiModels,
    fetchedAt: cache.openAiModelsFetchedAt,
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
      case MESSAGE_TYPES.BACKGROUND_GET_PROVIDER_SETTINGS:
        return handleGetProviderSettings();
      case MESSAGE_TYPES.BACKGROUND_UPDATE_PROVIDER_SETTINGS:
        return handleUpdateProviderSettings(message.payload || {});
      case MESSAGE_TYPES.BACKGROUND_REFRESH_OPENAI_MODELS:
        return handleRefreshOpenAiModels();
      case MESSAGE_TYPES.BACKGROUND_TRANSLATE_ACTIVE_TAB_SCRIPT:
        return handleTranslateActiveTabScript();
      case MESSAGE_TYPES.BACKGROUND_CANCEL_ACTIVE_TAB_TRANSLATION:
        return handleCancelActiveTabTranslation();
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
      console.error("Unhandled background error:", error);
      sendResponse(
        createErrorResponse(
          "UNHANDLED_ERROR",
          error?.message || "An unexpected error occurred.",
          error?.stack || error?.details || null
        )
      );
    });

  return true;
});
