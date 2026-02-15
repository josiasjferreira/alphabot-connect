// src/lib/offline.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AlphaBotDB extends DBSchema {
  commands: {
    key: number;
    value: {
      id: number;
      command: string;
      timestamp: number;
      executed: boolean;
    };
  };
  telemetry: {
    key: number;
    value: {
      id: number;
      battery: number;
      temperature: number;
      timestamp: number;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

let db: IDBPDatabase<AlphaBotDB>;

export async function initDB() {
  db = await openDB<AlphaBotDB>('AlphaBotDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('commands')) {
        db.createObjectStore('commands', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('telemetry')) {
        db.createObjectStore('telemetry', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
  return db;
}

export async function saveCommand(command: string) {
  if (!db) await initDB();
  const id = Date.now();
  await db.put('commands', {
    id,
    command,
    timestamp: id,
    executed: false,
  });
  return id;
}

export async function getPendingCommands() {
  if (!db) await initDB();
  const commands = await db.getAll('commands');
  return commands.filter(cmd => !cmd.executed);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onConnectivityChange(callback: (online: boolean) => void) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}

export function processOfflineCommand(text: string): string {
  const commands: Record<string, string> = {
    'mover frente': '➡️ Movendo para frente',
    'mover trás': '⬅️ Movendo para trás',
    'mover direita': '↗️ Virando à direita',
    'mover esquerda': '↖️ Virando à esquerda',
    'parar': '⏸️ Robô parado',
    'status': '📊 Bateria: 85%, Sensores: OK, Temperatura: 38°C',
  };

  const normalizedText = text.toLowerCase().trim();
  
  for (const [key, value] of Object.entries(commands)) {
    if (normalizedText.includes(key)) {
      return value;
    }
  }

  return '❓ Comando não reconhecido. Tente: mover frente/trás/direita/esquerda, parar, status';
}
