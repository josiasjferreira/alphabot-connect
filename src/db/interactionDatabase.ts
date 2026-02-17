// src/db/interactionDatabase.ts — IndexedDB for storing user interaction data (photos, audio, texts)
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface InteractionRecord {
  id: string;
  clientName: string;
  clientWhatsapp: string;
  productId: string;
  texts: string[]; // interaction notes / conversation snippets
  createdAt: number;
  synced: boolean;
}

interface InteractionDB extends DBSchema {
  interactions: {
    key: string;
    value: InteractionRecord;
    indexes: { 'by-createdAt': number; 'by-synced': number };
  };
}

const DB_NAME = 'AlphaBotInteractions';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<InteractionDB> | null = null;

async function getDB(): Promise<IDBPDatabase<InteractionDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<InteractionDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('interactions')) {
        const store = db.createObjectStore('interactions', { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
        store.createIndex('by-synced', 'synced' as any);
      }
    },
  });
  return dbInstance;
}

export async function saveInteraction(record: InteractionRecord): Promise<void> {
  const db = await getDB();
  await db.put('interactions', record);
}

export async function getAllInteractions(limit = 200): Promise<InteractionRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('interactions', 'by-createdAt');
  return all.slice(-limit);
}

export async function getUnsyncedInteractions(): Promise<InteractionRecord[]> {
  const db = await getDB();
  const all = await db.getAll('interactions');
  return all.filter(r => !r.synced);
}

export async function markInteractionsSynced(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('interactions', 'readwrite');
  for (const id of ids) {
    const record = await tx.store.get(id);
    if (record) await tx.store.put({ ...record, synced: true });
  }
  await tx.done;
}

export async function clearAllInteractions(): Promise<void> {
  const db = await getDB();
  await db.clear('interactions');
}
