import { EditorHapticEvent, ProjectState } from '../types';

const DB_NAME = 'HapticStudioDB';
const DB_VERSION = 1;
const VIDEO_STORE_NAME = 'videoStore';
const VIDEO_KEY = 'currentVideo';
const PROJECT_STATE_KEY = 'hapticProjectState';

// --- IndexedDB for Video Blob ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        db.createObjectStore(VIDEO_STORE_NAME);
      }
    };
  });
}

export async function saveVideo(blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VIDEO_STORE_NAME);
    const request = store.put(blob, VIDEO_KEY);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
  });
}

export async function loadVideo(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VIDEO_STORE_NAME);
    const request = store.get(VIDEO_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (request.result) {
        resolve(URL.createObjectURL(request.result));
      } else {
        resolve(null);
      }
    };
  });
}

async function clearVideo(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VIDEO_STORE_NAME);
    const request = store.delete(VIDEO_KEY);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
  });
}

// --- LocalStorage for Project State ---

export function saveProjectState(state: ProjectState): void {
  try {
    localStorage.setItem(PROJECT_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save project state:", error);
  }
}

export function loadProjectState(): ProjectState | null {
  try {
    const savedState = localStorage.getItem(PROJECT_STATE_KEY);
    if (savedState) {
      return JSON.parse(savedState) as ProjectState;
    }
    return null;
  } catch (error) {
    console.error("Failed to load project state:", error);
    return null;
  }
}

function clearProjectState(): void {
  localStorage.removeItem(PROJECT_STATE_KEY);
}

// --- Combined Clear ---
export async function clearAllProjectData(): Promise<void> {
    await clearVideo();
    clearProjectState();
}
