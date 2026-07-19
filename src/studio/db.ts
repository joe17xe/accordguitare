// Studio IA — persistance locale (IndexedDB), versionnée avec migration dès le départ.
// Aucun backend, aucun user_id : les données appartiennent à l'appareil.
// IndexedDB brut (aucune dépendance ajoutée). Les blobs audio vont ici, jamais en localStorage.

import type { Project, ChordSegment, UsageCounter } from './types';

const DB_NAME = 'fretbywood-studio';
/** Version du schéma. Incrémenter et ajouter un cas dans migrate() pour toute évolution. */
export const DB_VERSION = 1;

const STORE_PROJECTS = 'projects';
const STORE_SEGMENTS = 'chordSegments';
const STORE_ARTIFACTS = 'artifacts';
const STORE_AUDIO = 'audioBlobs';
const STORE_ARTIFACT_BLOBS = 'artifactBlobs';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

/** Applique les migrations de schéma de façon incrémentale (oldVersion -> DB_VERSION). */
function migrate(db: IDBDatabase, oldVersion: number): void {
  // v1 : schéma initial
  if (oldVersion < 1) {
    const projects = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
    projects.createIndex('updatedAt', 'updatedAt');
    projects.createIndex('mode', 'mode');

    const segments = db.createObjectStore(STORE_SEGMENTS, { keyPath: 'id' });
    segments.createIndex('projectId', 'projectId');

    const artifacts = db.createObjectStore(STORE_ARTIFACTS, { keyPath: 'id' });
    artifacts.createIndex('projectId', 'projectId');

    db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
    db.createObjectStore(STORE_ARTIFACT_BLOBS, { keyPath: 'id' });
    db.createObjectStore(STORE_META, { keyPath: 'key' });
  }
  // if (oldVersion < 2) { … } // futures migrations ici
}

/** Ouvre (et migre au besoin) la base. Idempotent : la même promesse est réutilisée. */
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible dans cet environnement.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => migrate(req.result, e.oldVersion);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Ouverture IndexedDB échouée'));
  });
  return dbPromise;
}

/** Demande au navigateur de rendre le stockage persistant (best-effort, utile sur iOS/WKWebView). */
export async function persistStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* non supporté : on continue */
  }
  return false;
}

// --- Helpers bas niveau ------------------------------------------------------

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Requête IndexedDB échouée'));
  });
}

async function tx<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result: T;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error ?? new Error('Transaction IndexedDB échouée'));
    t.onabort = () => reject(t.error ?? new Error('Transaction IndexedDB annulée'));
    Promise.resolve(run(t)).then((r) => { result = r; }).catch(reject);
  });
}

function newId(): string {
  // crypto.randomUUID est disponible dans les navigateurs modernes et la WebView Capacitor.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// --- Projets -----------------------------------------------------------------

export async function createProject(
  input: { title: string; mode: Project['mode'] }
): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: newId(),
    title: input.title,
    mode: input.mode,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  await tx(STORE_PROJECTS, 'readwrite', (t) => reqToPromise(t.objectStore(STORE_PROJECTS).add(project)));
  return project;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return tx(STORE_PROJECTS, 'readonly', (t) => reqToPromise(t.objectStore(STORE_PROJECTS).get(id)));
}

/** Liste les projets, du plus récemment modifié au plus ancien. */
export async function listProjects(): Promise<Project[]> {
  const all = await tx(STORE_PROJECTS, 'readonly', (t) =>
    reqToPromise<Project[]>(t.objectStore(STORE_PROJECTS).getAll())
  );
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  return tx(STORE_PROJECTS, 'readwrite', async (t) => {
    const store = t.objectStore(STORE_PROJECTS);
    const current = await reqToPromise<Project | undefined>(store.get(id));
    if (!current) throw new Error(`Projet introuvable : ${id}`);
    const next: Project = { ...current, ...patch, id, updatedAt: Date.now() };
    await reqToPromise(store.put(next));
    return next;
  });
}

/** Supprime définitivement un projet, ses segments, artefacts et blobs associés. */
export async function deleteProject(id: string): Promise<void> {
  await tx(
    [STORE_PROJECTS, STORE_SEGMENTS, STORE_ARTIFACTS, STORE_AUDIO, STORE_ARTIFACT_BLOBS],
    'readwrite',
    async (t) => {
      await reqToPromise(t.objectStore(STORE_PROJECTS).delete(id));
      await reqToPromise(t.objectStore(STORE_AUDIO).delete(id));
      for (const storeName of [STORE_SEGMENTS, STORE_ARTIFACTS]) {
        const store = t.objectStore(storeName);
        const keys = await reqToPromise<IDBValidKey[]>(store.index('projectId').getAllKeys(id));
        for (const k of keys) await reqToPromise(store.delete(k));
      }
      const artifactBlobs = t.objectStore(STORE_ARTIFACT_BLOBS);
      const blobKeys = await reqToPromise<IDBValidKey[]>(artifactBlobs.getAllKeys());
      for (const k of blobKeys) {
        if (typeof k === 'string' && k.startsWith(`${id}:`)) await reqToPromise(artifactBlobs.delete(k));
      }
    }
  );
}

// --- Blob audio --------------------------------------------------------------

export async function putAudioBlob(projectId: string, blob: Blob): Promise<void> {
  await tx(STORE_AUDIO, 'readwrite', (t) =>
    reqToPromise(t.objectStore(STORE_AUDIO).put({ id: projectId, blob, mimeType: blob.type, createdAt: Date.now() }))
  );
}

export async function getAudioBlob(projectId: string): Promise<Blob | undefined> {
  const rec = await tx(STORE_AUDIO, 'readonly', (t) =>
    reqToPromise<{ blob: Blob } | undefined>(t.objectStore(STORE_AUDIO).get(projectId))
  );
  return rec?.blob;
}

// --- Segments d'accords ------------------------------------------------------

/** Remplace l'intégralité des segments d'un projet. */
export async function putChordSegments(projectId: string, segments: ChordSegment[]): Promise<void> {
  await tx(STORE_SEGMENTS, 'readwrite', async (t) => {
    const store = t.objectStore(STORE_SEGMENTS);
    const existing = await reqToPromise<IDBValidKey[]>(store.index('projectId').getAllKeys(projectId));
    for (const k of existing) await reqToPromise(store.delete(k));
    for (const seg of segments) await reqToPromise(store.put({ ...seg, projectId }));
  });
}

export async function listChordSegments(projectId: string): Promise<ChordSegment[]> {
  const all = await tx(STORE_SEGMENTS, 'readonly', (t) =>
    reqToPromise<ChordSegment[]>(t.objectStore(STORE_SEGMENTS).index('projectId').getAll(projectId))
  );
  return all.sort((a, b) => a.order - b.order);
}

// --- Compteur d'usage --------------------------------------------------------

const USAGE_KEY = 'usage';

export async function getUsage(): Promise<UsageCounter> {
  const rec = await tx(STORE_META, 'readonly', (t) =>
    reqToPromise<{ key: string; value: UsageCounter } | undefined>(t.objectStore(STORE_META).get(USAGE_KEY))
  );
  return rec?.value ?? { analysesRun: 0, transcriptionsRun: 0 };
}

export async function incrementUsage(field: keyof UsageCounter): Promise<void> {
  await tx(STORE_META, 'readwrite', async (t) => {
    const store = t.objectStore(STORE_META);
    const rec = await reqToPromise<{ key: string; value: UsageCounter } | undefined>(store.get(USAGE_KEY));
    const value: UsageCounter = rec?.value ?? { analysesRun: 0, transcriptionsRun: 0 };
    value[field] += 1;
    await reqToPromise(store.put({ key: USAGE_KEY, value }));
  });
}
