import { t } from "./i18n.js";
const DB_NAME = "roam-epub-importer";
const DB_VERSION = 2;
const STORE = "jobs";
const BOOKS = "books";
const persistedBooks = new Set();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BOOKS)) db.createObjectStore(BOOKS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(stores, mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, mode);
      const result = action(transaction);
      // A successful request is not a committed transaction: quota errors can
      // still abort it. Only a committed transaction is a saved checkpoint.
      transaction.oncomplete = () => resolve(typeof result === "function" ? result() : result);
      transaction.onerror = () => reject(transaction.error || new Error(t("Could not save local progress")));
      transaction.onabort = () => reject(transaction.error || new Error(t("Local progress save was aborted")));
    });
  } finally {
    db.close();
  }
}

export async function saveJob(job) {
  const { book, ...state } = job;
  const needsBook = !persistedBooks.has(job.id);
  await transact([STORE, BOOKS], "readwrite", transaction => {
    if (needsBook) transaction.objectStore(BOOKS).put({ id: job.id, book });
    transaction.objectStore(STORE).put({ ...state, bookKey: job.id });
  });
  persistedBooks.add(job.id);
}

async function hydrate(state) {
  if (!state || state.book) return state;
  const stored = await transact([BOOKS], "readonly", transaction => {
    const request = transaction.objectStore(BOOKS).get(state.bookKey);
    return () => request.result;
  });
  if (!stored?.book) throw new Error(t("The local EPUB cache is missing. Select the original file again."));
  persistedBooks.add(state.id);
  return { ...state, book: stored.book };
}

export async function getJob(id) {
  const state = await transact([STORE], "readonly", transaction => {
    const request = transaction.objectStore(STORE).get(id);
    return () => request.result;
  });
  return hydrate(state);
}

export async function removeJob(id) {
  await transact([STORE, BOOKS], "readwrite", transaction => {
    transaction.objectStore(STORE).delete(id);
    transaction.objectStore(BOOKS).delete(id);
  });
  persistedBooks.delete(id);
}

export async function listJobs() {
  const states = await transact([STORE], "readonly", transaction => {
    const request = transaction.objectStore(STORE).getAll();
    return () => request.result;
  });
  return Promise.all(states.map(hydrate));
}

