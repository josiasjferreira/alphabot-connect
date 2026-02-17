// src/db/chatDatabase.ts — Local-first IndexedDB layer for Chat IA
import { openDB, DBSchema, IDBPDatabase } from 'idb';

/* ───────── Data Models ───────── */

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  createdAt: number; // epoch ms
  synced: boolean;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  version: number;
  source: string; // 'local' | 'remote' | 'seed'
  updatedAt: number;
  synced: boolean;
}

export interface SyncMeta {
  key: string; // e.g. 'lastSync'
  value: string;
}

/* ───────── DB Schema ───────── */

interface ChatIADB extends DBSchema {
  chatMessages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-createdAt': number; 'by-synced': number };
  };
  knowledge: {
    key: string;
    value: KnowledgeItem;
    indexes: { 'by-tags': string[]; 'by-version': number };
  };
  syncMeta: {
    key: string;
    value: SyncMeta;
  };
}

const DB_NAME = 'AlphaBotChatIA';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ChatIADB> | null = null;

export async function getChatDB(): Promise<IDBPDatabase<ChatIADB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ChatIADB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('chatMessages')) {
        const msgStore = db.createObjectStore('chatMessages', { keyPath: 'id' });
        msgStore.createIndex('by-createdAt', 'createdAt');
        msgStore.createIndex('by-synced', 'synced' as any);
      }
      if (!db.objectStoreNames.contains('knowledge')) {
        const knowStore = db.createObjectStore('knowledge', { keyPath: 'id' });
        knowStore.createIndex('by-tags', 'tags', { multiEntry: true });
        knowStore.createIndex('by-version', 'version');
      }
      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    },
  });
  return dbInstance;
}

/* ───────── Chat Messages CRUD ───────── */

export async function addChatMessage(msg: ChatMessage): Promise<void> {
  const db = await getChatDB();
  await db.put('chatMessages', msg);
}

export async function getAllMessages(limit = 200): Promise<ChatMessage[]> {
  const db = await getChatDB();
  const all = await db.getAllFromIndex('chatMessages', 'by-createdAt');
  return all.slice(-limit);
}

export async function getUnsyncedMessages(): Promise<ChatMessage[]> {
  const db = await getChatDB();
  const all = await db.getAll('chatMessages');
  return all.filter(m => !m.synced);
}

export async function markMessagesSynced(ids: string[]): Promise<void> {
  const db = await getChatDB();
  const tx = db.transaction('chatMessages', 'readwrite');
  for (const id of ids) {
    const msg = await tx.store.get(id);
    if (msg) await tx.store.put({ ...msg, synced: true });
  }
  await tx.done;
}

export async function clearAllMessages(): Promise<void> {
  const db = await getChatDB();
  await db.clear('chatMessages');
}

/* ───────── Knowledge CRUD ───────── */

export async function upsertKnowledge(item: KnowledgeItem): Promise<void> {
  const db = await getChatDB();
  const existing = await db.get('knowledge', item.id);
  if (!existing || item.version >= existing.version) {
    await db.put('knowledge', item);
  }
}

export async function getAllKnowledge(): Promise<KnowledgeItem[]> {
  const db = await getChatDB();
  return db.getAll('knowledge');
}

export async function searchKnowledge(query: string): Promise<KnowledgeItem[]> {
  const db = await getChatDB();
  const all = await db.getAll('knowledge');
  const q = query.toLowerCase();
  return all.filter(
    k =>
      k.title.toLowerCase().includes(q) ||
      k.content.toLowerCase().includes(q) ||
      k.tags.some(t => t.toLowerCase().includes(q))
  );
}

/* ───────── Sync Meta ───────── */

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getChatDB();
  const entry = await db.get('syncMeta', key);
  return entry?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getChatDB();
  await db.put('syncMeta', { key, value });
}

/* ───────── Seed Knowledge ───────── */

const SEED_KNOWLEDGE: Omit<KnowledgeItem, 'synced'>[] = [
  {
    id: 'k-nav',
    title: 'Navegação',
    content: 'O Ken pode navegar usando comandos como "ir para frente", "virar à esquerda", "virar à direita", "recuar". Use o joystick ou comandos de voz.',
    tags: ['navegação', 'movimento', 'joystick'],
    version: 1,
    source: 'seed',
    updatedAt: Date.now(),
  },
  {
    id: 'k-battery',
    title: 'Bateria e Energia',
    content: 'Verifique a bateria dizendo "status da bateria". Quando abaixo de 20%, o Ken sugere retorno à base de carregamento.',
    tags: ['bateria', 'energia', 'status'],
    version: 1,
    source: 'seed',
    updatedAt: Date.now(),
  },
  {
    id: 'k-camera',
    title: 'Câmera',
    content: 'O Ken possui câmera integrada. Diga "ativar câmera" ou acesse pelo Dashboard. O feed é transmitido via WebSocket.',
    tags: ['câmera', 'vídeo', 'feed'],
    version: 1,
    source: 'seed',
    updatedAt: Date.now(),
  },
  {
    id: 'k-emergency',
    title: 'Parada de Emergência',
    content: 'Diga "parar" ou "emergência" para parar o Ken imediatamente. Também pode usar o botão vermelho na tela de controle.',
    tags: ['emergência', 'parar', 'segurança'],
    version: 1,
    source: 'seed',
    updatedAt: Date.now(),
  },
  {
    id: 'k-offline',
    title: 'Modo Offline',
    content: 'O app funciona offline com dados locais. Quando a Internet retornar, sincronize para obter novos conhecimentos e enviar logs.',
    tags: ['offline', 'sincronização', 'rede'],
    version: 1,
    source: 'seed',
    updatedAt: Date.now(),
  },
  {
    id: 'k-ken-identity',
    title: 'Quem é o Ken',
    content: 'Ken é um robô de telepresença modelo CT300-H13307, fabricado pela CsjBot. Ele pode se mover, conversar, navegar autonomamente e auxiliar em tarefas.',
    tags: ['ken', 'robô', 'identidade'],
    version: 1,
    source: 'seed',
    updatedAt: Date.now(),
  },
];

export async function seedKnowledgeIfEmpty(): Promise<void> {
  const db = await getChatDB();
  const count = await db.count('knowledge');
  if (count === 0) {
    const tx = db.transaction('knowledge', 'readwrite');
    for (const item of SEED_KNOWLEDGE) {
      await tx.store.put({ ...item, synced: true });
    }
    await tx.done;
  }
}
