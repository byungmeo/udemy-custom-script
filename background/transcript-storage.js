const DATABASE_NAME = "udemy-custom-script";
const DATABASE_VERSION = 1;

let openPromise = null;

export function openTranscriptDatabase() {
  if (openPromise) {
    return openPromise;
  }

  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("scripts")) {
        database.createObjectStore("scripts", {
          keyPath: "lookupKey",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return openPromise;
}
