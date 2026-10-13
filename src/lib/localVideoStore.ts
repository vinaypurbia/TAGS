// ── Saves generated product videos into a folder on THIS PC instead of Cloudinary ──────────────────
// Uses the browser's File System Access API: desktop Chrome / Edge only, over https.
// A website is never told the real Windows path of a folder, so the root folder's path is typed once
// (it is only used for DISPLAY, e.g. in the product card). The folder itself is chosen with the picker.

export type LocalVideoRef = {
  folder: string;      // sub-folder named after the product
  file: string;        // file name inside that folder
  relPath: string;     // "<folder>/<file>"
  path: string;        // full path for display, e.g. D:\TAGS Videos\Pushpa Toy\pushpa-toy-20261007-1432.mp4
  sizeBytes: number;
  savedAt: string;     // ISO date
  mime?: string;
};

const DB_NAME = 'tags-local-video';
const STORE = 'handles';
const ROOT_KEY = 'root-folder';
const ROOT_PATH_KEY = 'tags_video_root_path';

export const isLocalFolderSupported = (): boolean =>
  typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function' && (window as any).isSecureContext !== false;

// ── tiny IndexedDB wrapper — folder handles can be stored there, so the folder is remembered ──
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key: string): Promise<any> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoredRoot(): Promise<any | null> {
  try { return (await idbGet(ROOT_KEY)) || null; } catch { return null; }
}

// Opens the folder picker (needs a click). The chosen folder is remembered for next time.
export async function pickRootFolder(): Promise<any> {
  const handle = await (window as any).showDirectoryPicker({ id: 'tags-product-videos', mode: 'readwrite' });
  await idbSet(ROOT_KEY, handle);
  return handle;
}

// Returns the saved root folder if the browser lets us write to it. `interactive` = may show the browser's
// "Allow" prompt (only works straight after a click). The browser asks again each new session.
export async function ensureRootPermission(interactive: boolean): Promise<any | null> {
  const handle = await getStoredRoot();
  if (!handle) return null;
  const opts = { mode: 'readwrite' };
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return handle;
    if (!interactive) return null;
    if ((await handle.requestPermission(opts)) === 'granted') return handle;
  } catch { /* handle no longer valid */ }
  return null;
}

// The Windows path of the root folder, typed by the admin once — display only
export const getRootPathText = (): string => { try { return localStorage.getItem(ROOT_PATH_KEY) || ''; } catch { return ''; } };
export const setRootPathText = (v: string) => { try { localStorage.setItem(ROOT_PATH_KEY, v.trim()); } catch { /* ignore */ } };

// Folder name from the product name: illegal Windows characters removed, never empty, never a reserved name
export function safeFolderName(name: string): string {
  let s = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (s.length > 80) s = s.slice(0, 80).trim().replace(/[. ]+$/, '');
  if (!s) s = 'product';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s += '_';
  return s;
}
const fileSlug = (name: string) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'video';
const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export function buildDisplayPath(folder: string, file: string): string {
  const root = getRootPathText().replace(/[\\/]+$/, '');
  return root ? `${root}\\${folder}\\${file}` : `${folder}\\${file}`;
}

export const fmtBytes = (n?: number): string => {
  const b = Number(n) || 0;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
};

// Writes the video to  <root>/<Product name>/<product-name>-<date>.mp4  and returns the reference to store on the product
export async function saveVideoToFolder(productName: string, blob: Blob, rootHandle?: any): Promise<LocalVideoRef> {
  const root = rootHandle || (await ensureRootPermission(false));
  if (!root) throw new Error('No video folder is connected. Choose the folder on your PC first, then allow access.');
  const folder = safeFolderName(productName);
  const ext = (blob.type || '').includes('mp4') ? 'mp4' : 'webm';
  const file = `${fileSlug(productName)}-${stamp(new Date())}.${ext}`;
  const dir = await root.getDirectoryHandle(folder, { create: true });
  const fh = await dir.getFileHandle(file, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return { folder, file, relPath: `${folder}/${file}`, path: buildDisplayPath(folder, file), sizeBytes: blob.size, savedAt: new Date().toISOString(), mime: blob.type || undefined };
}

// Reads a saved video back from the PC folder (for playing it, posting it, or showing it on the website)
export async function readVideoFromFolder(ref: { folder: string; file: string }, interactive = true, rootHandle?: any): Promise<File> {
  const root = rootHandle || (await ensureRootPermission(interactive));
  if (!root) throw new Error('Allow access to your video folder first (use the Allow access button in the Video tab).');
  try {
    const dir = await root.getDirectoryHandle(ref.folder);
    const fh = await dir.getFileHandle(ref.file);
    return await fh.getFile();
  } catch (e: any) {
    if (e?.name === 'NotFoundError') throw new Error(`The video "${ref.folder}\\${ref.file}" was not found in your connected folder. Was it moved or deleted, or is a different root folder connected?`);
    throw new Error(e?.message || 'Could not open the video from your PC folder.');
  }
}
