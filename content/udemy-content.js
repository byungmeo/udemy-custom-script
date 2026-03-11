(function () {
  const MESSAGE_TYPES = {
    CONTENT_GET_PAGE_SNAPSHOT: "content:get-page-snapshot",
    BACKGROUND_RESOLVE_PAGE_SCRIPT: "background:resolve-page-script",
    BACKGROUND_UPDATE_SETTINGS: "background:update-settings",
    BACKGROUND_FETCH_RESOURCE: "background:fetch-resource",
    BACKGROUND_OPEN_OPTIONS_PAGE: "background:open-options-page",
    BROADCAST_EXTENSION_STATE_CHANGED: "broadcast:extension-state-changed",
  };

  const UI_MESSAGES = {
    en: {
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

  const state = {
    pageContext: null,
    settings: null,
    match: null,
    currentCueIndex: -1,
    rafId: null,
    root: null,
    subtitles: null,
    panel: null,
    toolbarItem: null,
    controlButton: null,
    sourceLine: null,
    translatedLine: null,
    statusLabel: null,
    overlayToggle: null,
    modeToggle: null,
    orderToggle: null,
    openOptionsButton: null,
    panelOpen: false,
    lastUrl: location.href,
    lastRouteKey: "",
    lastObservedSignature: "",
    apiCourseCache: new Map(),
    apiLectureCache: new Map(),
    vttCache: new Map(),
    syncTimerId: null,
    syncRetryTimerIds: new Set(),
    syncInFlight: false,
    syncPending: false,
  };

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getUiLanguage() {
    return state.settings?.uiLanguage === "ko" ? "ko" : "en";
  }

  function t(key) {
    const language = getUiLanguage();
    return UI_MESSAGES[language]?.[key] || UI_MESSAGES.en[key] || key;
  }

  function normalizeParagraphWhitespace(value) {
    const normalized = String(value || "").replace(/\r\n?/g, "\n");
    const paragraphs = normalized
      .split(/\n{2,}/)
      .map((paragraph) =>
        paragraph
          .replace(/[^\S\n]+/g, " ")
          .replace(/\n+/g, " ")
          .trim()
      )
      .filter(Boolean);

    return paragraphs.join("\n\n");
  }

  function slugify(value, fallback) {
    const normalized = normalizeWhitespace(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  function parseUrlContext() {
    const url = new URL(location.href);
    const segments = url.pathname.split("/").filter(Boolean);
    const courseIndex = segments.indexOf("course");
    const lectureIndex = segments.indexOf("lecture");

    return {
      pageUrl: location.href,
      courseSlug:
        courseIndex >= 0 && segments[courseIndex + 1]
          ? segments[courseIndex + 1]
          : "unknown-course",
      lectureId:
        lectureIndex >= 0 && segments[lectureIndex + 1]
          ? segments[lectureIndex + 1]
          : "unknown-lecture",
    };
  }

  function readMetaContent(selector) {
    return normalizeWhitespace(document.querySelector(selector)?.content || "");
  }

  function safeParseJson(rawValue) {
    try {
      return JSON.parse(rawValue);
    } catch (_error) {
      return null;
    }
  }

  function normalizeLanguageCode(value) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
      return "";
    }

    const localeMatch = normalized.match(/^([a-z]{2,3})(?:[-_][a-z0-9]{2,8})*$/i);
    if (localeMatch) {
      return localeMatch[1].toLowerCase();
    }

    return normalized.toLowerCase();
  }

  function htmlToPlainText(value, options = {}) {
    const preserveParagraphs = Boolean(options.preserveParagraphs);
    const rawValue = String(value ?? "");
    const normalized = preserveParagraphs
      ? normalizeParagraphWhitespace(rawValue)
      : normalizeWhitespace(rawValue);

    if (!normalized) {
      return "";
    }

    if (!/[<>]/.test(rawValue)) {
      return normalized;
    }

    const htmlSource = preserveParagraphs
      ? rawValue
          .replace(/<\s*br\s*\/?>/gi, "\n")
          .replace(/<\/\s*(p|div|section|article|li|ul|ol|h[1-6])\s*>/gi, "\n\n")
          .replace(/<\s*li\b[^>]*>/gi, "- ")
      : rawValue;
    const template = document.createElement("template");
    template.innerHTML = htmlSource;
    return preserveParagraphs
      ? normalizeParagraphWhitespace(template.content.textContent || "")
      : normalizeWhitespace(template.content.textContent || "");
  }

  function memoizePromise(cache, key, loader) {
    if (!key) {
      return loader();
    }

    if (cache.has(key)) {
      return cache.get(key);
    }

    const promise = Promise.resolve()
      .then(loader)
      .catch((error) => {
        cache.delete(key);
        throw error;
      });

    cache.set(key, promise);
    return promise;
  }

  async function fetchBackgroundResource(url, responseType) {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.BACKGROUND_FETCH_RESOURCE,
      payload: {
        url: new URL(url, location.origin).href,
        responseType,
      },
    });

    if (!response?.ok) {
      throw new Error(response?.error?.message || "Resource fetch failed.");
    }

    return response.data;
  }

  async function fetchJson(url) {
    return fetchBackgroundResource(url, "json");
  }

  async function fetchText(url) {
    return fetchBackgroundResource(url, "text");
  }

  function buildCourseDetailsApiUrl(courseId) {
    const params = new URLSearchParams();
    params.set(
      "fields[course]",
      "title,headline,description,prerequisites,objectives,target_audiences,url,is_published,is_approved,is_practice_test_course,content_length_video,instructional_level,locale,content_length_practice_test_questions,content_info,num_subscribers,visible_instructors,is_paid,is_private,is_owner_terms_banned,is_owned_by_instructor_team,image_240x135,instructor_status,is_cpe_compliant,is_google_partner_course,google_survey_url,organization_id,is_organization_only,cpe_field_of_study,cpe_program_level,num_cpe_credits,is_in_user_subscription,course_has_labels,is_course_available_in_org,has_labs_in_course_prompt_setting,primary_category,primary_subcategory"
    );
    params.set("fields[locale]", "simple_english_title");
    params.set("use_remote_version", "true");
    params.set("caching_intent", "True");
    return `/api-2.0/courses/${encodeURIComponent(courseId)}/?${params.toString()}`;
  }

  function buildLectureDetailsApiUrl(courseId, lectureId) {
    const params = new URLSearchParams();
    params.set(
      "fields[lecture]",
      "asset,description,download_url,is_free,last_watched_second"
    );
    params.set(
      "fields[asset]",
      "asset_type,length,media_license_token,course_is_drmed,media_sources,captions,thumbnail_sprite,slides,slide_urls,download_urls,external_url"
    );
    return `/api-2.0/users/me/subscribed-courses/${encodeURIComponent(courseId)}/lectures/${encodeURIComponent(lectureId)}/?${params.toString()}`;
  }

  function fetchCourseDetails(courseId) {
    return memoizePromise(state.apiCourseCache, String(courseId), () =>
      fetchJson(buildCourseDetailsApiUrl(courseId))
    );
  }

  function fetchLectureDetails(courseId, lectureId) {
    return memoizePromise(
      state.apiLectureCache,
      `${courseId}:${lectureId}`,
      () => fetchJson(buildLectureDetailsApiUrl(courseId, lectureId))
    );
  }

  function fetchVttFile(url) {
    return memoizePromise(state.vttCache, url, () => fetchText(url));
  }

  async function fetchUdemyApiContext(pageContext) {
    const courseId = normalizeWhitespace(pageContext.courseId);
    const lectureId = normalizeWhitespace(pageContext.lectureId);

    if (
      !courseId ||
      courseId === "unknown-course" ||
      courseId.startsWith("slug:") ||
      !lectureId ||
      lectureId === "unknown-lecture"
    ) {
      return {
        course: null,
        lecture: null,
      };
    }

    const [courseResult, lectureResult] = await Promise.allSettled([
      fetchCourseDetails(courseId),
      fetchLectureDetails(courseId, lectureId),
    ]);

    return {
      course: courseResult.status === "fulfilled" ? courseResult.value : null,
      lecture: lectureResult.status === "fulfilled" ? lectureResult.value : null,
    };
  }

  function getCourseTakingModuleArgs() {
    const element = document.querySelector("[data-module-id='course-taking'][data-module-args]");
    const rawValue = element?.getAttribute("data-module-args");

    if (!rawValue) {
      return null;
    }

    return safeParseJson(rawValue);
  }

  function parseLectureAriaLabel() {
    const label = normalizeWhitespace(
      document
        .querySelector("[class*='lecture-view--container'][aria-label]")
        ?.getAttribute("aria-label") || ""
    );

    if (!label) {
      return null;
    }

    const patterns = [
      /section\s+(\d+)\s*:\s*(.+?),\s*lecture\s+(\d+)\s*:\s*(.+)$/i,
      /섹션\s*(\d+)\s*:\s*(.+?),\s*강의\s*(\d+)\s*:\s*(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = label.match(pattern);
      if (match) {
        return {
          sectionIndex: Number(match[1]),
          sectionTitle: `Section ${match[1]}: ${normalizeWhitespace(match[2])}`,
          lectureIndex: Number(match[3]),
          lectureTitle: normalizeWhitespace(match[4]),
        };
      }
    }

    return {
      sectionIndex: 0,
      sectionTitle: "Unknown Section",
      lectureIndex: 0,
      lectureTitle: label,
    };
  }

  function extractVideoAssetId() {
    const element = document.querySelector("[id^='shaka-video-container-']");
    const match = element?.id?.match(/shaka-video-container-(\d+)/);
    return match?.[1] || "";
  }

  function selectPreferredCaption(captions, preferredLanguages) {
    const availableCaptions = Array.isArray(captions)
      ? captions.filter((caption) => caption?.url)
      : [];

    if (!availableCaptions.length) {
      return null;
    }

    const normalizedPreferred = preferredLanguages
      .map((value) => normalizeLanguageCode(value))
      .filter(Boolean);

    for (const preferredLanguage of normalizedPreferred) {
      const manualMatch = availableCaptions.find(
        (caption) =>
          caption.source !== "auto" &&
          normalizeLanguageCode(caption.locale_id) === preferredLanguage
      );
      if (manualMatch) {
        return manualMatch;
      }

      const exactMatch = availableCaptions.find(
        (caption) => normalizeLanguageCode(caption.locale_id) === preferredLanguage
      );
      if (exactMatch) {
        return exactMatch;
      }
    }

    return availableCaptions.find((caption) => caption.source !== "auto") || availableCaptions[0];
  }

  function parseVttTimeToSeconds(value) {
    const normalized = normalizeWhitespace(String(value).replace(",", "."));
    const parts = normalized.split(":");

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return Number(minutes) * 60 + Number(seconds);
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    }

    return Number.NaN;
  }

  function parseVttTextToCues(vttText) {
    const lines = String(vttText || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/);
    const cues = [];
    let index = 0;

    while (index < lines.length && /^WEBVTT/i.test(lines[index].trim())) {
      index += 1;
    }

    while (index < lines.length) {
      while (index < lines.length && !lines[index].trim()) {
        index += 1;
      }

      if (index >= lines.length) {
        break;
      }

      if (/^(NOTE|STYLE|REGION)\b/i.test(lines[index].trim())) {
        while (index < lines.length && lines[index].trim()) {
          index += 1;
        }
        continue;
      }

      let timeline = lines[index].trim();
      if (!timeline.includes("-->")) {
        index += 1;
        timeline = lines[index]?.trim() || "";
      }

      if (!timeline.includes("-->")) {
        index += 1;
        continue;
      }

      const [startText, endText] = timeline.split("-->").map((part) => part.trim());
      const startSeconds = parseVttTimeToSeconds(startText);
      const endSeconds = parseVttTimeToSeconds(endText.split(/\s+/)[0]);
      index += 1;

      const textLines = [];
      while (index < lines.length && lines[index].trim()) {
        textLines.push(lines[index]);
        index += 1;
      }

      if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
        continue;
      }

      const sourceText = htmlToPlainText(textLines.join(" "));
      if (!sourceText) {
        continue;
      }

      cues.push({
        timeline: formatCueTimeline(startSeconds, endSeconds),
        sourceText,
        translatedText: "",
      });
    }

    return cues;
  }

  function findFirstText(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = normalizeWhitespace(element?.textContent || "");
      if (text) {
        return text;
      }
    }
    return "";
  }

  function guessPageContext() {
    const urlContext = parseUrlContext();
    const moduleArgs = getCourseTakingModuleArgs();
    const ariaInfo = parseLectureAriaLabel();
    const captionedLanguages = Array.isArray(moduleArgs?.courseLeadData?.captionedLanguages)
      ? moduleArgs.courseLeadData.captionedLanguages.map((entry) =>
          normalizeWhitespace(entry)
        )
      : [];
    const courseTitle =
      findFirstText([
        "[data-purpose='course-header-title']",
        "[data-purpose='course-title-url']",
        "h1",
      ]) ||
      readMetaContent("meta[property='og:title']") ||
      document.title.replace(/\s*\|\s*Udemy\s*$/i, "");
    const lectureTitle =
      findFirstText([
        "[data-purpose='lecture-title']",
        "[data-purpose='curriculum-item-link-current']",
      ]) ||
      ariaInfo?.lectureTitle ||
      courseTitle;
    const sectionTitle =
      findFirstText([
        "[data-purpose='section-panel-current']",
        "[data-purpose='course-curriculum'] [aria-current='true'] [data-purpose='section-title']",
      ]) ||
      ariaInfo?.sectionTitle ||
      "Unknown Section";
    const courseDescription =
      readMetaContent("meta[name='description']") ||
      readMetaContent("meta[property='og:description']");
    const defaultLanguage = "unknown";

    return {
      ...urlContext,
      courseId:
        moduleArgs?.courseId != null
          ? String(moduleArgs.courseId)
          : urlContext.courseSlug
            ? `slug:${urlContext.courseSlug}`
            : "unknown-course",
      courseTitle,
      courseDescription,
      level: "unknown",
      defaultLanguage,
      captionAvailable: captionedLanguages.length > 0,
      captionedLanguages,
      transcriptLanguage: "unknown",
      transcriptUpdatedAt:
        moduleArgs?.courseLeadData?.last_update_date ||
        new Date().toISOString(),
      sectionId:
        ariaInfo?.sectionIndex != null ? `section:${ariaInfo.sectionIndex}` : "unknown-section",
      sectionIndex: ariaInfo?.sectionIndex ?? 0,
      sectionTitle,
      lectureIndex: ariaInfo?.lectureIndex ?? 0,
      lectureId:
        urlContext.lectureId ||
        (moduleArgs?.initialCurriculumItemId != null
          ? String(moduleArgs.initialCurriculumItemId)
          : "unknown-lecture"),
      lectureSlug: slugify(lectureTitle, "unknown-lecture"),
      lectureTitle,
      videoAssetId: extractVideoAssetId(),
    };
  }

  function formatCueTime(seconds) {
    const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
    const hours = Math.floor(totalMilliseconds / 3_600_000);
    const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
    const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
    const milliseconds = totalMilliseconds % 1000;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(secs).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
    }

    const totalMinutes = Math.floor(totalMilliseconds / 60_000);
    return `${String(totalMinutes).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}.${String(milliseconds).padStart(3, "0")}`;
  }

  function formatCueTimeline(startTime, endTime) {
    return `${formatCueTime(startTime)} --> ${formatCueTime(endTime)}`;
  }

  function getVideoElement() {
    return document.querySelector("video");
  }

  async function waitForTrackCues(track, timeoutMs) {
    if (track?.cues?.length) {
      return true;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (track?.cues?.length) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return Boolean(track?.cues?.length);
  }

  async function extractTrackBasedCues(includeCues) {
    const video = getVideoElement();
    if (!video || !video.textTracks) {
      return {
        cues: [],
        transcriptProbe: {
          source: "video-text-tracks",
          detectedTrackCount: 0,
        },
      };
    }

    const tracks = Array.from(video.textTracks);
    const subtitleTracks = tracks.filter((track) =>
      ["subtitles", "captions"].includes(track.kind)
    );
    const candidateTracks = subtitleTracks.length ? subtitleTracks : tracks;
    const originalModes = new Map();

    for (const track of candidateTracks) {
      originalModes.set(track, track.mode);
      if (track.mode === "disabled") {
        track.mode = "hidden";
      }
      await waitForTrackCues(track, 500);
    }

    const selectedTrack =
      candidateTracks.find((track) => track.cues?.length) || candidateTracks[0] || null;

    for (const track of candidateTracks) {
      const originalMode = originalModes.get(track);
      if (typeof originalMode === "string") {
        track.mode = originalMode;
      }
    }

    const transcriptLanguage =
      selectedTrack?.language ||
      selectedTrack?.label ||
      document.documentElement.lang ||
      "und";

    const cues =
      includeCues && selectedTrack?.cues
        ? Array.from(selectedTrack.cues)
            .map((cue) => ({
              timeline: formatCueTimeline(cue.startTime, cue.endTime),
              sourceText: normalizeWhitespace(cue.text),
              translatedText: "",
            }))
            .filter((cue) => cue.sourceText)
        : [];

    return {
      cues,
      transcriptProbe: {
        source: "video-text-tracks",
        detectedTrackCount: candidateTracks.length,
        selectedLanguage: normalizeLanguageCode(transcriptLanguage) || transcriptLanguage,
        cueCount: selectedTrack?.cues?.length || 0,
      },
      transcriptLanguage: normalizeLanguageCode(transcriptLanguage) || transcriptLanguage,
      captionAvailable: Boolean(selectedTrack),
    };
  }

  async function extractApiBasedCues(pageContext, trackExtraction, includeCues) {
    const apiContext = await fetchUdemyApiContext(pageContext);
    const course = apiContext.course;
    const lecture = apiContext.lecture;
    const captions = Array.isArray(lecture?.asset?.captions) ? lecture.asset.captions : [];
    const preferredCaption = selectPreferredCaption(captions, [
      trackExtraction?.transcriptLanguage,
      pageContext.transcriptLanguage,
      pageContext.defaultLanguage,
      course?.locale?.locale,
    ]);
    const transcriptLanguage =
      normalizeLanguageCode(preferredCaption?.locale_id) ||
      normalizeLanguageCode(course?.locale?.locale) ||
      "";
    const captionedLanguages = captions
      .map((caption) => normalizeWhitespace(caption.video_label || caption.locale_id))
      .filter(Boolean);
    let apiCues = [];
    if (includeCues && preferredCaption?.url) {
      try {
        apiCues = parseVttTextToCues(await fetchVttFile(preferredCaption.url));
      } catch (_error) {
        apiCues = [];
      }
    }

    return {
      cues: apiCues,
      transcriptProbe: {
        source: "udemy-lecture-api",
        detectedTrackCount: captions.length,
        selectedLanguage: transcriptLanguage,
        cueCount: apiCues.length,
      },
      transcriptLanguage,
      captionAvailable: Boolean(captions.length || pageContext.captionAvailable),
      enrichment: {
        courseTitle: normalizeWhitespace(course?.title),
        courseDescription: htmlToPlainText(course?.description || course?.headline, {
          preserveParagraphs: true,
        }),
        level: normalizeWhitespace(course?.instructional_level),
        defaultLanguage: normalizeLanguageCode(course?.locale?.locale),
        captionedLanguages,
        transcriptUpdatedAt:
          preferredCaption?.created || lecture?.asset?.captions?.[0]?.created || "",
        videoAssetId:
          lecture?.asset?.id != null ? String(lecture.asset.id) : normalizeWhitespace(pageContext.videoAssetId),
      },
    };
  }

  function mergePageContext(pageContext, trackExtraction, apiExtraction) {
    const enrichment = apiExtraction?.enrichment || {};
    const mergedTranscriptLanguage =
      apiExtraction?.transcriptLanguage ||
      trackExtraction?.transcriptLanguage ||
      pageContext.transcriptLanguage;

    if (enrichment.courseTitle) {
      pageContext.courseTitle = enrichment.courseTitle;
    }

    if (enrichment.courseDescription) {
      pageContext.courseDescription = enrichment.courseDescription;
    }

    if (enrichment.level) {
      pageContext.level = enrichment.level;
    }

    if (enrichment.defaultLanguage) {
      pageContext.defaultLanguage = enrichment.defaultLanguage;
    }

    pageContext.captionAvailable = Boolean(
      pageContext.captionAvailable ||
      trackExtraction?.captionAvailable ||
      apiExtraction?.captionAvailable
    );

    if (Array.isArray(enrichment.captionedLanguages) && enrichment.captionedLanguages.length) {
      pageContext.captionedLanguages = enrichment.captionedLanguages;
    }

    if (mergedTranscriptLanguage) {
      pageContext.transcriptLanguage = mergedTranscriptLanguage;
    }

    if (enrichment.transcriptUpdatedAt) {
      pageContext.transcriptUpdatedAt = enrichment.transcriptUpdatedAt;
    }

    if (enrichment.lectureTitle) {
      pageContext.lectureTitle = enrichment.lectureTitle;
      pageContext.lectureSlug = slugify(enrichment.lectureTitle, "unknown-lecture");
    }

    if (!pageContext.lectureIndex && enrichment.lectureIndex > 0) {
      pageContext.lectureIndex = enrichment.lectureIndex;
    }

    if (enrichment.videoAssetId) {
      pageContext.videoAssetId = enrichment.videoAssetId;
    }

    if (
      (!pageContext.defaultLanguage || pageContext.defaultLanguage === "unknown") &&
      mergedTranscriptLanguage &&
      mergedTranscriptLanguage !== "und"
    ) {
      pageContext.defaultLanguage = mergedTranscriptLanguage;
    }
  }

  async function buildPageSnapshot(includeCues) {
    const pageContext = guessPageContext();
    const trackExtraction = await extractTrackBasedCues(includeCues);
    const apiExtraction = await extractApiBasedCues(
      pageContext,
      trackExtraction,
      includeCues
    );
    const extraction = includeCues
      ? apiExtraction.cues?.length
        ? apiExtraction
        : trackExtraction.cues?.length
          ? trackExtraction
          : apiExtraction.captionAvailable
            ? apiExtraction
            : trackExtraction
      : apiExtraction.captionAvailable
        ? apiExtraction
        : trackExtraction;

    mergePageContext(pageContext, trackExtraction, apiExtraction);

    return {
      ok: true,
      pageContext,
      transcriptProbe: extraction.transcriptProbe,
      cues: extraction.cues || [],
    };
  }

  function getCurrentRouteKey() {
    const urlContext = parseUrlContext();
    return `${urlContext.courseSlug}::${urlContext.lectureId}`;
  }

  function buildObservationSignature() {
    const lectureLabel = normalizeWhitespace(
      document
        .querySelector("[class*='lecture-view--container'][aria-label]")
        ?.getAttribute("aria-label") || ""
    );
    const courseModuleReady = Boolean(
      document.querySelector("[data-module-id='course-taking'][data-module-args]")
    );
    const video = getVideoElement();
    const videoSource = normalizeWhitespace(video?.currentSrc || video?.src || "");

    return JSON.stringify({
      routeKey: getCurrentRouteKey(),
      lectureLabel,
      courseModuleReady,
      hasVideo: Boolean(video),
      videoSource,
      videoAssetId: extractVideoAssetId(),
    });
  }

  function clearSubtitleLines() {
    if (state.translatedLine) {
      state.translatedLine.textContent = "";
      state.translatedLine.style.display = "none";
    }

    if (state.sourceLine) {
      state.sourceLine.textContent = "";
      state.sourceLine.style.display = "none";
    }
  }

  function resetResolvedState(statusText = "Loading...") {
    stopRenderLoop();
    closeSettingsPanel();
    state.pageContext = null;
    state.match = null;
    state.currentCueIndex = -1;
    clearSubtitleLines();

    if (state.statusLabel) {
      state.statusLabel.textContent = statusText;
    }

    if (state.root) {
      state.root.style.display = "none";
    }

    updateQuickSettingsUi(false);
  }

  function clearPendingSyncTimers() {
    if (state.syncTimerId) {
      window.clearTimeout(state.syncTimerId);
      state.syncTimerId = null;
    }

    for (const timerId of state.syncRetryTimerIds) {
      window.clearTimeout(timerId);
    }
    state.syncRetryTimerIds.clear();
  }

  function scheduleSyncPageState(delayMs = 0) {
    if (state.syncTimerId) {
      window.clearTimeout(state.syncTimerId);
    }

    state.syncTimerId = window.setTimeout(() => {
      state.syncTimerId = null;
      void syncPageState();
    }, delayMs);
  }

  function queueSyncRetryBurst(delays = [0, 400, 1200, 3000]) {
    for (const delayMs of delays) {
      const timerId = window.setTimeout(() => {
        state.syncRetryTimerIds.delete(timerId);
        scheduleSyncPageState(0);
      }, delayMs);

      state.syncRetryTimerIds.add(timerId);
    }
  }

  function handleObservedPageState() {
    const nextRouteKey = getCurrentRouteKey();
    const nextSignature = buildObservationSignature();
    const routeChanged = nextRouteKey !== state.lastRouteKey;
    const signatureChanged = nextSignature !== state.lastObservedSignature;

    if (!routeChanged && !signatureChanged) {
      return;
    }

    state.lastUrl = location.href;
    state.lastRouteKey = nextRouteKey;
    state.lastObservedSignature = nextSignature;

    if (routeChanged) {
      clearPendingSyncTimers();
      resetResolvedState();
      queueSyncRetryBurst();
      return;
    }

    scheduleSyncPageState(150);
  }

  function getVideoContainer(video) {
    let node = video?.parentElement || null;

    while (node && node !== document.body) {
      if (getComputedStyle(node).position !== "static") {
        return node;
      }
      node = node.parentElement;
    }

    return video?.parentElement || null;
  }

  function getVideoControlsContainer() {
    return document.querySelector("[data-purpose='video-controls']");
  }

  function clampNumber(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function getNumericSetting(key, fallback, minimum, maximum) {
    const numericValue = Number(state.settings?.[key]);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return clampNumber(numericValue, minimum, maximum);
  }

  function resolveFontFamily(settingKey, fallback = "system") {
    const value = state.settings?.[settingKey] || fallback;

    switch (value) {
      case "serif":
        return '"Georgia", "Times New Roman", serif';
      case "mono":
        return '"Consolas", "SFMono-Regular", "Courier New", monospace';
      default:
        return '"Segoe UI", system-ui, sans-serif';
    }
  }

  async function persistOverlaySettings(patch) {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.BACKGROUND_UPDATE_SETTINGS,
      payload: {
        settings: patch,
      },
    });

    if (response?.ok) {
      state.settings = response.settings;
      renderCurrentCue();
    }
  }

  function closeSettingsPanel() {
    state.panelOpen = false;

    if (state.panel) {
      state.panel.hidden = true;
    }

    if (state.controlButton) {
      state.controlButton.setAttribute("aria-expanded", "false");
    }
  }

  function toggleSettingsPanel(forceOpen) {
    const nextOpen =
      typeof forceOpen === "boolean" ? forceOpen : !state.panelOpen;
    state.panelOpen = nextOpen;

    if (state.panel) {
      state.panel.hidden = !nextOpen;
    }

    if (state.controlButton) {
      state.controlButton.setAttribute("aria-expanded", String(nextOpen));
    }
  }

  function updateQuickSettingsUi(hasScript) {
    if (!state.settings) {
      return;
    }

    if (state.statusLabel) {
      state.statusLabel.textContent = hasScript
        ? t("content.scriptReady")
        : t("content.noScript");
    }

    if (state.controlButton) {
      state.controlButton.dataset.scriptReady = String(hasScript);
      state.controlButton.setAttribute("aria-expanded", String(state.panelOpen));
      state.controlButton.setAttribute("title", t("content.controlButtonTitle"));

      const label = state.controlButton.querySelector(
        ".udemy-custom-script-toolbar-label"
      );
      if (label) {
        label.textContent = t("content.controlButtonLabel");
      }
    }

    if (state.panel) {
      const eyebrow = state.panel.querySelector(
        ".udemy-custom-script-settings-eyebrow"
      );
      if (eyebrow) {
        eyebrow.textContent = t("content.panelEyebrow");
      }
    }

    if (state.overlayToggle) {
      state.overlayToggle.dataset.active = String(state.settings.overlayEnabled);
      state.overlayToggle.textContent = state.settings.overlayEnabled
        ? t("content.overlayOn")
        : t("content.overlayOff");
    }

    if (state.modeToggle) {
      state.modeToggle.dataset.active = String(
        state.settings.subtitleMode === "bilingual"
      );
      state.modeToggle.textContent =
        state.settings.subtitleMode === "translation_only"
          ? t("content.translationOnly")
          : t("content.bilingual");
    }

    if (state.orderToggle) {
      state.orderToggle.textContent =
        state.settings.bilingualOrder === "translation_first"
          ? t("content.orderTranslationFirst")
          : t("content.orderSourceFirst");
    }

    if (state.openOptionsButton) {
      state.openOptionsButton.textContent = t("content.openFullOptions");
    }
  }

  function applySubtitleLayout() {
    if (!state.root || !state.subtitles || !state.settings) {
      return;
    }

    state.root.style.setProperty(
      "--udemy-custom-script-translated-font-family",
      resolveFontFamily("translatedFontFamily")
    );
    state.root.style.setProperty(
      "--udemy-custom-script-source-font-family",
      resolveFontFamily("sourceFontFamily")
    );
    state.root.style.setProperty(
      "--udemy-custom-script-translated-font-size",
      `${getNumericSetting("translatedFontSize", 28, 18, 42)}px`
    );
    state.root.style.setProperty(
      "--udemy-custom-script-source-font-size",
      `${getNumericSetting("sourceFontSize", 22, 14, 36)}px`
    );
    state.root.style.setProperty(
      "--udemy-custom-script-translated-background-opacity",
      `${(getNumericSetting("translatedBackgroundOpacity", 72, 0, 100) / 100).toFixed(2)}`
    );
    state.root.style.setProperty(
      "--udemy-custom-script-source-background-opacity",
      `${(getNumericSetting("sourceBackgroundOpacity", 56, 0, 100) / 100).toFixed(2)}`
    );
    state.root.style.setProperty(
      "--udemy-custom-script-translated-padding-x",
      `${getNumericSetting("translatedBoxPaddingX", 16, 4, 40)}px`
    );
    state.root.style.setProperty(
      "--udemy-custom-script-translated-padding-y",
      `${getNumericSetting("translatedBoxPaddingY", 10, 2, 28)}px`
    );
    state.root.style.setProperty(
      "--udemy-custom-script-source-padding-x",
      `${getNumericSetting("sourceBoxPaddingX", 16, 4, 40)}px`
    );
    state.root.style.setProperty(
      "--udemy-custom-script-source-padding-y",
      `${getNumericSetting("sourceBoxPaddingY", 10, 2, 28)}px`
    );

    state.subtitles.style.bottom = `${getNumericSetting("subtitleBottomOffset", 24, 0, 120)}px`;
    state.subtitles.style.gap = `${getNumericSetting("subtitleLineGap", 8, 0, 32)}px`;
  }

  function ensureOverlay() {
    const video = getVideoElement();
    if (!video) {
      return null;
    }

    const container = getVideoContainer(video);
    if (!container) {
      return null;
    }

    if (!state.root) {
      state.root = document.createElement("div");
      state.root.className = "udemy-custom-script-root";

      state.subtitles = document.createElement("div");
      state.subtitles.className = "udemy-custom-script-subtitles";

      state.translatedLine = document.createElement("div");
      state.translatedLine.className = "udemy-custom-script-line";
      state.translatedLine.dataset.role = "translated";

      state.sourceLine = document.createElement("div");
      state.sourceLine.className = "udemy-custom-script-line";
      state.sourceLine.dataset.role = "source";

      state.subtitles.append(state.translatedLine, state.sourceLine);
      state.root.append(state.subtitles);
    }

    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    if (!container.contains(state.root)) {
      container.appendChild(state.root);
    }

    applySubtitleLayout();
    return state.root;
  }

  function ensureToolbarControl() {
    const controls = getVideoControlsContainer();
    if (!controls) {
      return null;
    }

    if (!state.toolbarItem) {
      state.toolbarItem = document.createElement("div");
      state.toolbarItem.className = "udemy-custom-script-toolbar-item";

      state.controlButton = document.createElement("button");
      state.controlButton.type = "button";
      state.controlButton.className = "udemy-custom-script-toolbar-button";
      state.controlButton.setAttribute("aria-haspopup", "dialog");
      state.controlButton.setAttribute("aria-expanded", "false");
      state.controlButton.setAttribute("title", t("content.controlButtonTitle"));
      state.controlButton.innerHTML = `
        <span class="udemy-custom-script-toolbar-icon" aria-hidden="true">CC</span>
        <span class="udemy-custom-script-toolbar-label">${t("content.controlButtonLabel")}</span>
      `;

      state.panel = document.createElement("div");
      state.panel.className = "udemy-custom-script-settings-popover";
      state.panel.hidden = true;
      state.panel.innerHTML = `
        <div class="udemy-custom-script-settings-header">
          <div>
            <div class="udemy-custom-script-settings-eyebrow">${t("content.panelEyebrow")}</div>
            <div class="udemy-custom-script-settings-status">${t("content.noScript")}</div>
          </div>
        </div>
        <div class="udemy-custom-script-settings-actions">
          <button type="button" data-action="toggle-overlay">${t("content.overlayOn")}</button>
          <button type="button" data-action="toggle-mode">${t("content.translationOnly")}</button>
          <button type="button" data-action="toggle-order">${t("content.orderTranslationFirst")}</button>
        </div>
        <div class="udemy-custom-script-settings-footer">
          <button type="button" data-action="open-options" class="secondary">${t("content.openFullOptions")}</button>
        </div>
      `;

      state.statusLabel = state.panel.querySelector(
        ".udemy-custom-script-settings-status"
      );
      state.overlayToggle = state.panel.querySelector(
        '[data-action="toggle-overlay"]'
      );
      state.modeToggle = state.panel.querySelector('[data-action="toggle-mode"]');
      state.orderToggle = state.panel.querySelector('[data-action="toggle-order"]');
      state.openOptionsButton = state.panel.querySelector(
        '[data-action="open-options"]'
      );

      state.controlButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleSettingsPanel();
      });

      state.overlayToggle.addEventListener("click", () => {
        void persistOverlaySettings({
          overlayEnabled: !state.settings?.overlayEnabled,
        });
      });

      state.modeToggle.addEventListener("click", () => {
        void persistOverlaySettings({
          subtitleMode:
            state.settings?.subtitleMode === "translation_only"
              ? "bilingual"
              : "translation_only",
        });
      });

      state.orderToggle.addEventListener("click", () => {
        void persistOverlaySettings({
          bilingualOrder:
            state.settings?.bilingualOrder === "translation_first"
              ? "source_first"
              : "translation_first",
        });
      });

      state.openOptionsButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSettingsPanel();

        try {
          const response = await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.BACKGROUND_OPEN_OPTIONS_PAGE,
          });

          if (response?.ok) {
            return;
          }
        } catch (_error) {
          // Fall through to a direct open when messaging is unavailable.
        }

        window.open(
          chrome.runtime.getURL("options/options.html"),
          "_blank",
          "noopener"
        );
      });

      document.addEventListener(
        "pointerdown",
        (event) => {
          if (!state.panelOpen || !state.toolbarItem) {
            return;
          }

          if (state.toolbarItem.contains(event.target)) {
            return;
          }

          closeSettingsPanel();
        },
        true
      );

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeSettingsPanel();
        }
      });

      state.toolbarItem.append(state.controlButton, state.panel);
    }

    if (!controls.contains(state.toolbarItem)) {
      controls.appendChild(state.toolbarItem);
    }

    updateQuickSettingsUi(Boolean(state.match?.matched && state.match.script?.cues?.length));
    return state.toolbarItem;
  }

  function findCueIndexForTime(cues, currentTime) {
    let low = 0;
    let high = cues.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cue = cues[mid];

      if (currentTime < cue.startSeconds) {
        high = mid - 1;
      } else if (currentTime > cue.endSeconds) {
        low = mid + 1;
      } else {
        return mid;
      }
    }

    return -1;
  }

  function renderCurrentCue() {
    ensureOverlay();
    ensureToolbarControl();

    if (!state.settings) {
      return;
    }

    const hasScript = Boolean(state.match?.matched && state.match.script?.cues?.length);
    const video = getVideoElement();
    const cues = state.match?.script?.cues || [];
    const currentTime = video?.currentTime ?? 0;
    const cueIndex = hasScript ? findCueIndexForTime(cues, currentTime) : -1;
    const cue = cueIndex >= 0 ? cues[cueIndex] : null;

    state.currentCueIndex = cueIndex;
    updateQuickSettingsUi(hasScript);

    if (!state.root) {
      return;
    }

    applySubtitleLayout();

    state.root.style.display =
      hasScript && state.settings.overlayEnabled ? "block" : "none";

    if (!cue || !state.settings.overlayEnabled) {
      state.translatedLine.textContent = "";
      state.sourceLine.textContent = "";
      state.translatedLine.style.display = "none";
      state.sourceLine.style.display = "none";
      return;
    }

    const translatedText = cue.translatedText || "";
    const sourceText = cue.sourceText || "";
    const showBilingual = state.settings.subtitleMode === "bilingual";
    const translationFirst = state.settings.bilingualOrder === "translation_first";

    if (showBilingual) {
      if (translationFirst) {
        state.translatedLine.textContent = translatedText || sourceText;
        state.sourceLine.textContent = sourceText;
      } else {
        state.translatedLine.textContent = sourceText;
        state.sourceLine.textContent = translatedText || sourceText;
      }

      state.translatedLine.style.display = "block";
      state.sourceLine.style.display = "block";
      state.translatedLine.dataset.role = translationFirst ? "translated" : "source";
      state.sourceLine.dataset.role = translationFirst ? "source" : "translated";
    } else {
      state.translatedLine.textContent = translatedText || sourceText;
      state.sourceLine.textContent = "";
      state.translatedLine.style.display = "block";
      state.sourceLine.style.display = "none";
      state.translatedLine.dataset.role = "translated";
    }
  }

  function startRenderLoop() {
    stopRenderLoop();

    const tick = () => {
      renderCurrentCue();
      state.rafId = window.requestAnimationFrame(tick);
    };

    state.rafId = window.requestAnimationFrame(tick);
  }

  function stopRenderLoop() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  async function syncPageState() {
    if (state.syncInFlight) {
      state.syncPending = true;
      return;
    }

    state.syncInFlight = true;
    const routeKeyAtStart = getCurrentRouteKey();

    try {
      if (!location.pathname.includes("/learn/lecture/")) {
        resetResolvedState("Unavailable");
        return;
      }

      const snapshot = await buildPageSnapshot(false);
      if (routeKeyAtStart !== getCurrentRouteKey()) {
        state.syncPending = true;
        return;
      }

      state.pageContext = snapshot.pageContext;
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.BACKGROUND_RESOLVE_PAGE_SCRIPT,
        payload: {
          pageContext: snapshot.pageContext,
        },
      });

      if (routeKeyAtStart !== getCurrentRouteKey()) {
        state.syncPending = true;
        return;
      }

      if (!response?.ok) {
        return;
      }

      state.settings = response.settings;
      state.match = response.match;
      state.lastUrl = location.href;
      state.lastRouteKey = routeKeyAtStart;
      state.lastObservedSignature = buildObservationSignature();
      renderCurrentCue();
      startRenderLoop();

      if (
        !snapshot.pageContext.courseId ||
        snapshot.pageContext.courseId === "unknown-course" ||
        String(snapshot.pageContext.courseId).startsWith("slug:")
      ) {
        scheduleSyncPageState(600);
      }
    } catch (_error) {
      // Ignore runtime disconnects while the extension reloads.
    } finally {
      state.syncInFlight = false;
      if (state.syncPending) {
        state.syncPending = false;
        scheduleSyncPageState(0);
      }
    }
  }

  function watchRouteChanges() {
    const observer = new MutationObserver(() => {
      handleObservedPageState();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "data-module-args", "src"],
    });

    const originalPushState = history.pushState;
    history.pushState = function pushStatePatched(...args) {
      originalPushState.apply(this, args);
      handleObservedPageState();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function replaceStatePatched(...args) {
      originalReplaceState.apply(this, args);
      handleObservedPageState();
    };

    window.addEventListener("popstate", () => {
      handleObservedPageState();
    });

    window.addEventListener("load", () => {
      handleObservedPageState();
    });
  }

  function initializePageSync() {
    state.lastUrl = location.href;
    state.lastRouteKey = getCurrentRouteKey();
    state.lastObservedSignature = buildObservationSignature();
    clearPendingSyncTimers();
    resetResolvedState();
    queueSyncRetryBurst();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE_TYPES.CONTENT_GET_PAGE_SNAPSHOT) {
      buildPageSnapshot(Boolean(message.payload?.includeCues))
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            ok: false,
            error: {
              code: "PAGE_SNAPSHOT_FAILED",
              message: "Failed to inspect the current Udemy lecture page.",
              details: error.message,
            },
          });
        });
      return true;
    }

    if (message?.type === MESSAGE_TYPES.BROADCAST_EXTENSION_STATE_CHANGED) {
      scheduleSyncPageState(0);
    }

    return false;
  });

  watchRouteChanges();
  initializePageSync();
})();
