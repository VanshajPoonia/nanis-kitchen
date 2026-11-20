// Voice notes live in IndexedDB beside the book in localStorage. Nothing leaves the browser.
// Each recipe id maps to [{ name, type, data: Blob }], one entry per voice note.
const DB_NAME = 'nanis-kitchen-audio';
const STORE = 'memos';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export const putAudio = (id, parts) => run('readwrite', (s) => s.put(parts, id));
export const getAudio = (id) => run('readonly', (s) => s.get(id));
export const removeAudio = (id) => run('readwrite', (s) => s.delete(id));
export const clearAudio = () => run('readwrite', (s) => s.clear());
export const audioIds = () => run('readonly', (s) => s.getAllKeys());
