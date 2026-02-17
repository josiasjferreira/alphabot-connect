// src/services/chatSyncService.ts — Sync engine for Chat IA local-first DB
import {
  getUnsyncedMessages,
  markMessagesSynced,
  upsertKnowledge,
  setSyncMeta,
  getSyncMeta,
  type KnowledgeItem,
  type ChatMessage,
} from '@/db/chatDatabase';

// TODO: conectar endpoint real de backend
const DEFAULT_SYNC_ENDPOINT = '/api/chat-knowledge-sync';

export interface SyncConfig {
  endpoint: string;
}

export interface SyncResult {
  success: boolean;
  newKnowledge: number;
  uploadedMessages: number;
  error?: string;
}

interface SyncUpPayload {
  messages: ChatMessage[];
  lastSync: string | null;
  deviceId: string;
}

interface SyncDownResponse {
  knowledge: KnowledgeItem[];
  serverTimestamp: string;
}

function getDeviceId(): string {
  let id = localStorage.getItem('alphabot-device-id');
  if (!id) {
    id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('alphabot-device-id', id);
  }
  return id;
}

/**
 * Attempt to sync with remote backend.
 * If the endpoint is unavailable (offline, 404, etc.), falls back gracefully.
 */
export async function syncChatData(
  config: SyncConfig = { endpoint: DEFAULT_SYNC_ENDPOINT }
): Promise<SyncResult> {
  try {
    const lastSync = await getSyncMeta('lastSync');
    const unsyncedMsgs = await getUnsyncedMessages();

    const payload: SyncUpPayload = {
      messages: unsyncedMsgs,
      lastSync,
      deviceId: getDeviceId(),
    };

    // TODO: conectar endpoint real de backend
    // Attempt real sync
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    const data: SyncDownResponse = await response.json();

    // Merge downloaded knowledge (version-based conflict resolution)
    let newCount = 0;
    for (const item of data.knowledge) {
      await upsertKnowledge({ ...item, synced: true });
      newCount++;
    }

    // Mark uploaded messages as synced
    if (unsyncedMsgs.length > 0) {
      await markMessagesSynced(unsyncedMsgs.map(m => m.id));
    }

    const syncTime = data.serverTimestamp || new Date().toISOString();
    await setSyncMeta('lastSync', syncTime);

    return {
      success: true,
      newKnowledge: newCount,
      uploadedMessages: unsyncedMsgs.length,
    };
  } catch (err) {
    console.warn('[ChatSync] Sync failed, staying offline:', err);

    // Even if sync fails, update the attempt timestamp
    await setSyncMeta('lastSyncAttempt', new Date().toISOString());

    return {
      success: false,
      newKnowledge: 0,
      uploadedMessages: 0,
      error: err instanceof Error ? err.message : 'Unknown sync error',
    };
  }
}

/**
 * Simulate a sync for testing/demo (when real endpoint is not available).
 * Returns some fake knowledge items to demonstrate the flow.
 */
export async function simulateSync(): Promise<SyncResult> {
  const unsyncedMsgs = await getUnsyncedMessages();

  // Simulated new knowledge from "server"
  const simulatedKnowledge: KnowledgeItem[] = [
    {
      id: `k-sync-${Date.now()}`,
      title: 'Atualização de Firmware',
      content: 'Nova versão do firmware v2.3.1 disponível. Melhorias: autonomia de bateria +15%, novo modo de patrulha silenciosa.',
      tags: ['firmware', 'atualização', 'ota'],
      version: Date.now(),
      source: 'remote',
      updatedAt: Date.now(),
      synced: true,
    },
  ];

  for (const item of simulatedKnowledge) {
    await upsertKnowledge(item);
  }

  if (unsyncedMsgs.length > 0) {
    await markMessagesSynced(unsyncedMsgs.map(m => m.id));
  }

  const syncTime = new Date().toISOString();
  await setSyncMeta('lastSync', syncTime);

  return {
    success: true,
    newKnowledge: simulatedKnowledge.length,
    uploadedMessages: unsyncedMsgs.length,
  };
}
