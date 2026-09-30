// The Finder's saved boards, in IndexedDB. A board with every sport's props
// runs to several megabytes -- past what localStorage holds on an iPhone,
// where the save used to fail silently and every open started from nothing.
// IndexedDB keeps it, and its writes don't block the page the way a big
// localStorage JSON string does. Every call degrades to "nothing saved"
// when storage is unavailable (private mode, tests).
const DB_NAME = 'krazy-finder';
const STORE = 'boards';
let opening = null;

function database() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return opening;
}

function run(mode, action) {
  return database().then(db => db && new Promise(resolve => {
    try {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  }));
}

export const storedBoard = sport => run('readonly', store => store.get(sport)).then(value => value || null);
export const storeBoard = (sport, value) => run('readwrite', store => store.put(value, sport));
