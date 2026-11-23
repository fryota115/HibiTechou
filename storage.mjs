import { dayKey, seed } from "./calendar.mjs";

export function openStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("hibi-techou", 1);
    request.onupgradeneeded = () => {
      const documents = request.result.createObjectStore("documents");
      documents.put(seed(dayKey()), "planner");
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("手帖を開いている他の画面を閉じてください。"));
  });
}

export function readPlanner(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction("documents").objectStore("documents").get("planner");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function updatePlanner(database, mutate) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("documents", "readwrite");
    const store = transaction.objectStore("documents");
    const request = store.get("planner");
    let planner;
    let failure;
    request.onsuccess = () => {
      try {
        planner = request.result;
        mutate(planner);
        store.put(planner, "planner");
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(planner);
    transaction.onabort = () => reject(failure || transaction.error || new Error("保存できませんでした。"));
  });
}
