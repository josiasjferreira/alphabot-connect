// src/db/purchaseDatabase.ts — IndexedDB offline storage for e-book purchases
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface EbookPurchase {
  id: string;
  customerName: string;
  email: string;
  whatsapp: string;
  product: string;
  status: 'pending' | 'confirmed';
  notificationSent: boolean;
  createdAt: number;
}

interface PurchaseDB extends DBSchema {
  ebook_purchases: {
    key: string;
    value: EbookPurchase;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'AlphaBotPurchases';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<PurchaseDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PurchaseDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<PurchaseDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('ebook_purchases')) {
        const store = db.createObjectStore('ebook_purchases', { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
      }
    },
  });
  return dbInstance;
}

export async function savePurchase(
  customerName: string,
  email: string,
  whatsapp: string,
  product = 'A Revolução Humanoide'
): Promise<EbookPurchase> {
  const db = await getDB();
  const purchase: EbookPurchase = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    customerName,
    email,
    whatsapp,
    product,
    status: 'pending',
    notificationSent: false,
    createdAt: Date.now(),
  };
  await db.put('ebook_purchases', purchase);
  return purchase;
}

export async function getAllPurchases(): Promise<EbookPurchase[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('ebook_purchases', 'by-createdAt');
  return all.reverse();
}

export async function getPurchaseCount(): Promise<number> {
  const db = await getDB();
  return db.count('ebook_purchases');
}

export async function exportPurchasesCSV(): Promise<string> {
  const purchases = await getAllPurchases();
  const header = 'Nome,Email,WhatsApp,Produto,Status,Data';
  const rows = purchases.map(p => {
    const date = new Date(p.createdAt).toLocaleString('pt-BR');
    return `"${p.customerName}","${p.email}","${p.whatsapp}","${p.product}","${p.status}","${date}"`;
  });
  return [header, ...rows].join('\n');
}
