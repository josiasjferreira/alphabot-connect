// src/db/leadDatabase.ts — IndexedDB offline storage for Ken leads
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface KenLead {
  id: string;
  name: string;
  whatsapp: string;
  source: string;
  createdAt: number;
}

interface LeadDB extends DBSchema {
  ken_leads: {
    key: string;
    value: KenLead;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'AlphaBotLeads';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<LeadDB> | null = null;

async function getDB(): Promise<IDBPDatabase<LeadDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<LeadDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('ken_leads')) {
        const store = db.createObjectStore('ken_leads', { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
      }
    },
  });
  return dbInstance;
}

export async function saveLead(name: string, whatsapp: string, source = 'Feira Cais do Sertão'): Promise<KenLead> {
  const db = await getDB();
  const lead: KenLead = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    whatsapp,
    source,
    createdAt: Date.now(),
  };
  await db.put('ken_leads', lead);
  return lead;
}

export async function getAllLeads(): Promise<KenLead[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('ken_leads', 'by-createdAt');
  return all.reverse(); // newest first
}

export async function getLeadCount(): Promise<number> {
  const db = await getDB();
  return db.count('ken_leads');
}

export async function clearAllLeads(): Promise<void> {
  const db = await getDB();
  await db.clear('ken_leads');
}

export async function exportLeadsCSV(): Promise<string> {
  const leads = await getAllLeads();
  const header = 'Nome,WhatsApp,Origem,Data';
  const rows = leads.map(l => {
    const date = new Date(l.createdAt).toLocaleString('pt-BR');
    return `"${l.name}","${l.whatsapp}","${l.source}","${date}"`;
  });
  return [header, ...rows].join('\n');
}
