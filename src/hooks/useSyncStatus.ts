// src/hooks/useSyncStatus.ts — Connectivity + sync status management
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSyncMeta } from '@/db/chatDatabase';
import { syncChatData, simulateSync, type SyncResult } from '@/services/chatSyncService';

export type SyncState = 'offline' | 'online-synced' | 'online-pending';

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('offline');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const autoSyncRef = useRef(false);

  // Load last sync time
  useEffect(() => {
    getSyncMeta('lastSync').then(val => {
      setLastSync(val);
    });
  }, []);

  // Listen for connectivity changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Derive sync state
  useEffect(() => {
    if (!isOnline) {
      setSyncState('offline');
      return;
    }
    // If last sync is old (> 1 hour), mark as pending
    if (!lastSync) {
      setSyncState('online-pending');
      return;
    }
    const lastSyncDate = new Date(lastSync).getTime();
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - lastSyncDate > oneHour) {
      setSyncState('online-pending');
    } else {
      setSyncState('online-synced');
    }
  }, [isOnline, lastSync]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && !autoSyncRef.current && syncState === 'online-pending') {
      autoSyncRef.current = true;
      // Don't auto-sync immediately, just set flag
    }
  }, [isOnline, syncState]);

  const doSync = useCallback(async (useSimulation = false): Promise<SyncResult> => {
    setIsSyncing(true);
    try {
      const result = useSimulation ? await simulateSync() : await syncChatData();
      setLastResult(result);
      if (result.success) {
        const syncTime = await getSyncMeta('lastSync');
        setLastSync(syncTime);
        setSyncState('online-synced');
      }
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const formatLastSync = useCallback((): string => {
    if (!lastSync) return '—';
    const d = new Date(lastSync);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'Agora mesmo';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return d.toLocaleDateString();
  }, [lastSync]);

  return {
    isOnline,
    syncState,
    isSyncing,
    lastSync,
    lastResult,
    doSync,
    formatLastSync,
  };
}
