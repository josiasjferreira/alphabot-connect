// src/hooks/useInteractionSync.ts — Auto-sync interactions when WebSocket is connected
import { useEffect, useRef } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { getUnsyncedInteractions, markInteractionsSynced } from '@/db/interactionDatabase';

const SYNC_INTERVAL = 30_000; // 30s

export const useInteractionSync = (send: (msg: any) => void) => {
  const { connectionStatus, addLog } = useRobotStore();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const syncPending = async () => {
      try {
        const pending = await getUnsyncedInteractions();
        if (pending.length === 0) return;

        // Send each interaction via WebSocket
        for (const record of pending) {
          send({
            type: 'chat' as const,
            data: {
              command: JSON.stringify({
                action: 'sync_interaction',
                payload: record,
              }),
            },
            timestamp: Date.now(),
          });
        }

        // Mark all as synced
        await markInteractionsSynced(pending.map(r => r.id));
        addLog(`${pending.length} interação(ões) sincronizada(s)`, 'success');
      } catch (err) {
        console.error('[InteractionSync] Failed:', err);
      }
    };

    // Sync immediately on connect
    syncPending();

    // Then periodically
    intervalRef.current = setInterval(syncPending, SYNC_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [connectionStatus, send, addLog]);
};
