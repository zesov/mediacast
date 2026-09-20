import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'podcast-favorites';
const DB_VERSION = 2;
const FAVORITES_STORE = 'favorites';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('podcasts')) {
            db.deleteObjectStore('podcasts');
          }
          if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
            const store = db.createObjectStore(FAVORITES_STORE, { keyPath: 'key' });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('title', 'title', { unique: false });
          }
        }
      },
    });
  }
  return dbPromise;
}

export type FavoriteType = 'podcast' | 'live' | 'peertube';

export interface FavoriteItem {
  key: string;
  type: FavoriteType;
  id: string | number;
  title: string;
  description: string;
  image?: string;
  lastUpdateTime?: number;
  addedAt: number;
  streamUrl?: string;
  groupTitle?: string;
  uuid?: string;
  name?: string;
  previewUrl?: string;
}

export function makeKey(type: FavoriteType, id: string | number): string {
  return `${type}:${id}`;
}

export function parseKey(key: string): { type: FavoriteType; id: string | number } {
  const [type, id] = key.split(':');
  return { type: type as FavoriteType, id: isNaN(Number(id)) ? id : Number(id) };
}

export async function addFavorite(item: Omit<FavoriteItem, 'key'>): Promise<void> {
  const db = await getDB();
  const key = makeKey(item.type, item.id);
  await db.put(FAVORITES_STORE, { ...item, key });
}

export async function removeFavorite(type: FavoriteType, id: string | number): Promise<void> {
  const db = await getDB();
  const key = makeKey(type, id);
  await db.delete(FAVORITES_STORE, key);
}

export async function isFavorite(type: FavoriteType, id: string | number): Promise<boolean> {
  const db = await getDB();
  const key = makeKey(type, id);
  const item = await db.get(FAVORITES_STORE, key);
  return item !== undefined;
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  const db = await getDB();
  return db.getAll(FAVORITES_STORE);
}

export async function getFavoritesByType(type: FavoriteType): Promise<FavoriteItem[]> {
  const all = await getFavorites();
  return all.filter(item => item.type === type);
}

export async function toggleFavorite(item: Omit<FavoriteItem, 'key'>): Promise<boolean> {
  const currentlyFavorited = await isFavorite(item.type, item.id);
  if (currentlyFavorited) {
    await removeFavorite(item.type, item.id);
    return false;
  } else {
    await addFavorite(item);
    return true;
  }
}

export async function removeAllFavorites(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;
}
