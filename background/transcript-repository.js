import { STORAGE_KEYS } from "../shared/constants.js";
import { buildSuggestedFileName } from "../shared/lookup-key.js";
import { openTranscriptDatabase } from "./transcript-storage.js";

async function getIndexMap() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.SCRIPT_INDEX);
  return stored[STORAGE_KEYS.SCRIPT_INDEX] || {};
}

async function setIndexMap(indexMap) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.SCRIPT_INDEX]: indexMap,
  });
}

function computeHash(input) {
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
}

export async function saveScriptRecord(parsedScript) {
  const db = await openTranscriptDatabase();
  const transaction = db.transaction("scripts", "readwrite");
  const store = transaction.objectStore("scripts");
  const savedAt = new Date().toISOString();
  const lookupKey = parsedScript.metadata.identity.lookup_key;
  const fileName = buildSuggestedFileName(parsedScript.metadata);
  const rawText = parsedScript.normalizedText;
  const hash = computeHash(rawText);
  const record = {
    lookupKey,
    fileName,
    metadata: parsedScript.metadata,
    parsed: {
      cues: parsedScript.cues,
    },
    rawText,
    savedAt,
    hash,
  };

  await new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  const indexMap = await getIndexMap();
  indexMap[lookupKey] = {
    lookupKey,
    fileName,
    savedAt,
    hash,
    courseTitle: parsedScript.metadata.course.title,
    sectionTitle: parsedScript.metadata.section.title,
    lectureTitle: parsedScript.metadata.lecture.title,
    transcriptLanguage: parsedScript.metadata.transcript.language,
  };
  await setIndexMap(indexMap);

  return {
    lookupKey,
    fileName,
    savedAt,
    metadata: parsedScript.metadata,
  };
}

export async function getScriptRecord(lookupKey) {
  if (!lookupKey) {
    return null;
  }

  const db = await openTranscriptDatabase();
  const transaction = db.transaction("scripts", "readonly");
  const store = transaction.objectStore("scripts");

  return new Promise((resolve, reject) => {
    const request = store.get(lookupKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteScriptRecord(lookupKey) {
  const db = await openTranscriptDatabase();
  const transaction = db.transaction("scripts", "readwrite");
  const store = transaction.objectStore("scripts");

  await new Promise((resolve, reject) => {
    const request = store.delete(lookupKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  const indexMap = await getIndexMap();
  delete indexMap[lookupKey];
  await setIndexMap(indexMap);
}

export async function listScriptIndex() {
  const indexMap = await getIndexMap();
  return Object.values(indexMap).sort((left, right) =>
    right.savedAt.localeCompare(left.savedAt)
  );
}
