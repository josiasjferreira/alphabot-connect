import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Volume2, Gauge, Moon, Sun, RotateCcw, Trash2, Zap, Activity, Network, Brain, RefreshCw, Search, Tag, X, Plus, Pencil, Check, Video, Music, Link } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Progress } from '@/components/ui/progress';
import { getAllKnowledge, searchKnowledge, seedKnowledgeIfEmpty, clearAllMessages, upsertKnowledge, deleteKnowledge, type KnowledgeItem, type MediaAttachment } from '@/db/chatDatabase';
import { useSyncStatus } from '@/hooks/useSyncStatus';

const Settings = () => {
  const { t } = useTranslation();
  const { ip, port, connectionStatus, offlineMode, setConnection, setOfflineMode, clearLogs } = useRobotStore();
  const { connect, disconnect } = useWebSocket();
  const { maxSpeed, ttsVolume, ttsRate, darkMode, setMaxSpeed, setTtsVolume, setTtsRate, setDarkMode } = useSettingsStore();

  const [localIp, setLocalIp] = useState(ip);
  const [localPort, setLocalPort] = useState(port);

  // Connection test state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Real-time latency state
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [latencyActive, setLatencyActive] = useState(false);
  const latencyInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Network diagnostics
  const [netDiag, setNetDiag] = useState<{ dns: string; gateway: string; signal: number; packetLoss: number } | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);

  // Knowledge base state
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formMedia, setFormMedia] = useState<MediaAttachment[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { syncState, isSyncing, doSync, formatLastSync } = useSyncStatus();

  const loadKnowledge = useCallback(async () => {
    setKnowledgeLoading(true);
    await seedKnowledgeIfEmpty();
    const items = knowledgeSearch.trim()
      ? await searchKnowledge(knowledgeSearch)
      : await getAllKnowledge();
    setKnowledgeItems(items);
    setKnowledgeLoading(false);
  }, [knowledgeSearch]);

  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);

  const handleKnowledgeSync = async () => {
    await doSync(true); // simulated
    await loadKnowledge();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormTags('');
    setFormMedia([]);
    setEditingItem(null);
    setShowAddForm(false);
  };

  const openAddForm = () => {
    resetForm();
    setShowAddForm(true);
    setExpandedItem(null);
  };

  const openEditForm = (item: KnowledgeItem) => {
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormTags(item.tags.join(', '));
    setFormMedia(item.media || []);
    setEditingItem(item);
    setShowAddForm(true);
    setExpandedItem(null);
  };

  const handleSaveItem = async () => {
    const title = formTitle.trim();
    const content = formContent.trim();
    if (!title || !content) return;

    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
    const validMedia = formMedia.filter(m => m.url.trim());
    const item: KnowledgeItem = editingItem
      ? { ...editingItem, title, content, tags, media: validMedia, version: editingItem.version + 1, updatedAt: Date.now(), synced: false }
      : { id: `k-${Date.now()}`, title, content, tags, media: validMedia, version: 1, source: 'local', updatedAt: Date.now(), synced: false };

    await upsertKnowledge(item);
    resetForm();
    await loadKnowledge();
  };

  const handleDeleteItem = async (id: string) => {
    await deleteKnowledge(id);
    setDeleteConfirm(null);
    setExpandedItem(null);
    await loadKnowledge();
  };

  const handleReconnect = () => { disconnect(); setConnection(localIp, localPort); connect(); };
  const handleToggleDark = (checked: boolean) => { setDarkMode(checked); document.documentElement.classList.toggle('dark', checked); };
  const isConnected = connectionStatus === 'connected';

  // Test connection
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestLatency(null);
    const start = performance.now();
    try {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${localIp}:${localPort}`);
        const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 5000);
        ws.onopen = () => { clearTimeout(timeout); const latency = Math.round(performance.now() - start); setTestLatency(latency); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error('fail')); };
      });
      setTestStatus('success');
    } catch {
      // Simulate for offline/demo
      await new Promise(r => setTimeout(r, 1200));
      const simLatency = 15 + Math.round(Math.random() * 80);
      setTestLatency(simLatency);
      setTestStatus(offlineMode ? 'success' : 'fail');
    }
  };

  // Real-time latency ping
  useEffect(() => {
    if (latencyActive) {
      const ping = () => {
        const simLatency = 10 + Math.round(Math.random() * 60 + Math.sin(Date.now() / 2000) * 20);
        setLatencyHistory(prev => [...prev.slice(-29), simLatency]);
      };
      ping();
      latencyInterval.current = setInterval(ping, 1000);
    } else {
      if (latencyInterval.current) clearInterval(latencyInterval.current);
      setLatencyHistory([]);
    }
    return () => { if (latencyInterval.current) clearInterval(latencyInterval.current); };
  }, [latencyActive]);

  const avgLatency = latencyHistory.length > 0 ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) : 0;
  const maxLatency = latencyHistory.length > 0 ? Math.max(...latencyHistory) : 0;
  const minLatency = latencyHistory.length > 0 ? Math.min(...latencyHistory) : 0;

  // Network diagnostics
  const runNetDiag = async () => {
    setDiagRunning(true);
    setNetDiag(null);
    await new Promise(r => setTimeout(r, 1800));
    setNetDiag({
      dns: `${Math.round(5 + Math.random() * 25)}ms`,
      gateway: `192.168.${Math.floor(Math.random() * 10)}.1`,
      signal: Math.round(60 + Math.random() * 35),
      packetLoss: Math.round(Math.random() * 5 * 10) / 10,
    });
    setDiagRunning(false);
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title={t('settings.title')} />

      <div className="p-4 space-y-4">
        {/* Connection */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-5 h-5 text-primary" /> {t('settings.connection')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? t('settings.connected') : t('settings.disconnected')}
                  {offlineMode && ` (${t('settings.offline')})`}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">{t('settings.robotIp')}</Label>
                <input type="text" value={localIp} onChange={(e) => setLocalIp(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-background border-2 border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">{t('settings.port')}</Label>
                <input type="text" value={localPort} onChange={(e) => setLocalPort(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-background border-2 border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleReconnect} className="flex-1 h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> {t('settings.reconnect')}
                </button>
                <button onClick={() => { disconnect(); setOfflineMode(!offlineMode); }}
                  className="flex-1 h-12 rounded-xl border-2 border-border bg-card text-muted-foreground font-semibold text-sm flex items-center justify-center gap-2">
                  {offlineMode ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  {offlineMode ? t('settings.online') : t('settings.offline')}
                </button>
              </div>

              {/* Test Connection Button */}
              <button onClick={handleTestConnection} disabled={testStatus === 'testing'}
                className="w-full h-12 rounded-xl border-2 border-primary/40 bg-primary/5 text-primary font-semibold text-sm flex items-center justify-center gap-2 active:bg-primary/10 disabled:opacity-50">
                <Zap className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-pulse' : ''}`} />
                {testStatus === 'testing' ? t('settings.testingConnection') : t('settings.testConnection')}
              </button>
              {testStatus !== 'idle' && testStatus !== 'testing' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${testStatus === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${testStatus === 'success' ? 'bg-success' : 'bg-destructive'}`} />
                  {testStatus === 'success'
                    ? `${t('settings.testSuccess')} — ${testLatency}ms`
                    : t('settings.testFail')}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Real-time Latency */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-success" /> {t('settings.latency.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('settings.latency.monitor')}</span>
                <Switch checked={latencyActive} onCheckedChange={setLatencyActive} />
              </div>

              {latencyActive && latencyHistory.length > 0 && (
                <>
                  {/* Mini chart */}
                  <div className="h-16 flex items-end gap-0.5 bg-muted/30 rounded-lg p-1 overflow-hidden">
                    {latencyHistory.map((l, i) => (
                      <div key={i} className="flex-1 rounded-t-sm transition-all duration-300"
                        style={{
                          height: `${Math.min(100, (l / 100) * 100)}%`,
                          backgroundColor: l < 30 ? 'hsl(var(--success))' : l < 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                          opacity: 0.5 + (i / latencyHistory.length) * 0.5,
                        }} />
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.latency.avg')}</p>
                      <p className="text-lg font-bold text-foreground">{avgLatency}ms</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.latency.min')}</p>
                      <p className="text-lg font-bold text-success">{minLatency}ms</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.latency.max')}</p>
                      <p className="text-lg font-bold text-destructive">{maxLatency}ms</p>
                    </div>
                  </div>

                  {/* Quality indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('settings.latency.quality')}</span>
                    <Progress value={Math.max(0, 100 - avgLatency)} className="flex-1 h-2" />
                    <span className={`text-xs font-bold ${avgLatency < 30 ? 'text-success' : avgLatency < 60 ? 'text-warning' : 'text-destructive'}`}>
                      {avgLatency < 30 ? '🟢' : avgLatency < 60 ? '🟡' : '🔴'}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Network Diagnostics */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="w-5 h-5 text-secondary" /> {t('settings.netDiag.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button onClick={runNetDiag} disabled={diagRunning}
                className="w-full h-12 rounded-xl border-2 border-secondary/40 bg-secondary/5 text-secondary font-semibold text-sm flex items-center justify-center gap-2 active:bg-secondary/10 disabled:opacity-50">
                <Network className={`w-4 h-4 ${diagRunning ? 'animate-spin' : ''}`} />
                {diagRunning ? t('settings.netDiag.running') : t('settings.netDiag.run')}
              </button>

              {netDiag && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">DNS</p>
                      <p className="text-sm font-bold text-foreground">{netDiag.dns}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">Gateway</p>
                      <p className="text-sm font-bold text-foreground">{netDiag.gateway}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.netDiag.signal')}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={netDiag.signal} className="flex-1 h-2" />
                        <span className="text-sm font-bold text-foreground">{netDiag.signal}%</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.netDiag.packetLoss')}</p>
                      <p className={`text-sm font-bold ${netDiag.packetLoss < 2 ? 'text-success' : 'text-destructive'}`}>
                        {netDiag.packetLoss}%
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Speed */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="w-5 h-5 text-warning" /> {t('settings.maxSpeed')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('settings.speedLimit')}</span>
                <span className="text-lg font-bold text-foreground">{maxSpeed}%</span>
              </div>
              <Slider value={[maxSpeed]} onValueChange={([v]) => setMaxSpeed(v)} min={10} max={100} step={5} />
              <p className="text-xs text-muted-foreground">{t('settings.speedHint')}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Voice */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-secondary" /> {t('settings.voiceSynthesis')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t('settings.volume')}</span>
                  <span className="text-sm font-bold text-foreground">{Math.round(ttsVolume * 100)}%</span>
                </div>
                <Slider value={[ttsVolume * 100]} onValueChange={([v]) => setTtsVolume(v / 100)} min={0} max={100} step={5} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t('settings.speechRate')}</span>
                  <span className="text-sm font-bold text-foreground">{ttsRate.toFixed(1)}x</span>
                </div>
                <Slider value={[ttsRate * 100]} onValueChange={([v]) => setTtsRate(v / 100)} min={50} max={200} step={10} />
              </div>
              <button onClick={() => {
                const u = new SpeechSynthesisUtterance(t('settings.testVoiceText'));
                u.lang = 'pt-BR'; u.volume = ttsVolume; u.rate = ttsRate; speechSynthesis.speak(u);
              }} className="w-full h-12 rounded-xl border-2 border-border bg-card text-foreground font-semibold text-sm flex items-center justify-center gap-2 active:bg-muted">
                <Volume2 className="w-4 h-4" /> {t('settings.testVoice')}
              </button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {darkMode ? <Moon className="w-5 h-5 text-accent" /> : <Sun className="w-5 h-5 text-warning" />} {t('settings.appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('settings.darkMode')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.darkModeHint')}</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={handleToggleDark} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Knowledge Base */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" /> {t('settings.knowledge.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{t('settings.knowledge.items')}</p>
                  <p className="text-lg font-bold text-foreground">{knowledgeItems.length}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{t('settings.knowledge.sources')}</p>
                  <p className="text-lg font-bold text-foreground">
                    {new Set(knowledgeItems.map(k => k.source)).size}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{t('settings.knowledge.lastSync')}</p>
                  <p className="text-sm font-bold text-foreground">{formatLastSync()}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button onClick={handleKnowledgeSync} disabled={isSyncing}
                  className="flex-1 h-10 rounded-xl border-2 border-primary/40 bg-primary/5 text-primary font-semibold text-sm flex items-center justify-center gap-2 active:bg-primary/10 disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? t('settings.knowledge.syncing') : t('settings.knowledge.syncNow')}
                </button>
                <button onClick={openAddForm}
                  className="h-10 px-4 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t('settings.knowledge.add')}
                </button>
              </div>

              {/* Add/Edit Form */}
              {showAddForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 p-3 rounded-xl border-2 border-primary/30 bg-primary/5">
                  <p className="text-xs font-semibold text-primary">
                    {editingItem ? t('settings.knowledge.editing') : t('settings.knowledge.adding')}
                  </p>
                  <input
                    type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value.slice(0, 100))}
                    placeholder={t('settings.knowledge.titlePlaceholder')}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <textarea
                    value={formContent} onChange={(e) => setFormContent(e.target.value.slice(0, 1000))}
                    placeholder={t('settings.knowledge.contentPlaceholder')}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <input
                    type="text" value={formTags} onChange={(e) => setFormTags(e.target.value.slice(0, 200))}
                    placeholder={t('settings.knowledge.tagsPlaceholder')}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />

                  {/* Media Attachments */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">{t('settings.knowledge.media')}</p>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setFormMedia([...formMedia, { type: 'audio', url: '' }])}
                          className="h-6 px-2 rounded bg-muted text-muted-foreground text-[10px] font-medium flex items-center gap-1 hover:bg-muted/80">
                          <Music className="w-3 h-3" /> {t('settings.knowledge.addAudio')}
                        </button>
                        <button type="button" onClick={() => setFormMedia([...formMedia, { type: 'video', url: '' }])}
                          className="h-6 px-2 rounded bg-muted text-muted-foreground text-[10px] font-medium flex items-center gap-1 hover:bg-muted/80">
                          <Video className="w-3 h-3" /> {t('settings.knowledge.addVideo')}
                        </button>
                      </div>
                    </div>
                    {formMedia.map((m, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="text-muted-foreground flex-shrink-0">
                          {m.type === 'audio' ? <Music className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                        </span>
                        <input
                          type="url"
                          value={m.url}
                          onChange={(e) => {
                            const updated = [...formMedia];
                            updated[idx] = { ...m, url: e.target.value };
                            setFormMedia(updated);
                          }}
                          placeholder={m.type === 'audio' ? t('settings.knowledge.audioUrlPlaceholder') : t('settings.knowledge.videoUrlPlaceholder')}
                          className="flex-1 h-8 px-2 rounded bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          value={m.label || ''}
                          onChange={(e) => {
                            const updated = [...formMedia];
                            updated[idx] = { ...m, label: e.target.value };
                            setFormMedia(updated);
                          }}
                          placeholder={t('settings.knowledge.mediaLabel')}
                          className="w-24 h-8 px-2 rounded bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <button type="button" onClick={() => setFormMedia(formMedia.filter((_, i) => i !== idx))}
                          className="text-destructive/60 hover:text-destructive">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={handleSaveItem} disabled={!formTitle.trim() || !formContent.trim()}
                      className="flex-1 h-10 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40">
                      <Check className="w-4 h-4" /> {t('settings.knowledge.save')}
                    </button>
                    <button onClick={resetForm}
                      className="h-10 px-4 rounded-lg border border-border text-muted-foreground text-sm font-medium">
                      {t('settings.knowledge.cancel')}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={knowledgeSearch}
                  onChange={(e) => setKnowledgeSearch(e.target.value)}
                  placeholder={t('settings.knowledge.search')}
                  className="w-full h-10 pl-9 pr-8 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {knowledgeSearch && (
                  <button onClick={() => setKnowledgeSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Knowledge list */}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {knowledgeLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4 animate-pulse">{t('settings.knowledge.loading')}</p>
                ) : knowledgeItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('settings.knowledge.empty')}</p>
                ) : (
                  knowledgeItems.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                      className="p-3 rounded-xl bg-muted/20 border border-border/50 cursor-pointer active:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {item.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium">
                                <Tag className="w-2.5 h-2.5" /> {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          item.source === 'remote' ? 'bg-primary/10 text-primary' :
                          item.source === 'seed' ? 'bg-muted text-muted-foreground' :
                          'bg-accent/10 text-accent-foreground'
                        }`}>
                          {item.source}
                        </span>
                      </div>
                      {expandedItem === item.id && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 pt-2 border-t border-border/30">
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.content}</p>
                          {item.media && item.media.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {item.media.map((m, mi) => (
                                <div key={mi} className="rounded-lg overflow-hidden border border-border/50">
                                  {m.type === 'audio' ? (
                                    <div className="flex items-center gap-2 p-2 bg-muted/20">
                                      <Music className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                      <span className="text-[10px] text-muted-foreground flex-1 truncate">{m.label || m.url}</span>
                                      <audio controls preload="none" src={m.url} className="h-7 max-w-[160px]" />
                                    </div>
                                  ) : (
                                    <div>
                                      <video controls preload="none" src={m.url} className="w-full max-h-36 bg-black" />
                                      {m.label && <p className="text-[10px] text-muted-foreground p-1.5">{m.label}</p>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-2">
                            v{item.version} • {new Date(item.updatedAt).toLocaleDateString()}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditForm(item); }}
                              className="flex-1 h-8 rounded-lg border border-primary/30 text-primary text-xs font-medium flex items-center justify-center gap-1 active:bg-primary/10"
                            >
                              <Pencil className="w-3 h-3" /> {t('settings.knowledge.edit')}
                            </button>
                            {deleteConfirm === item.id ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                className="flex-1 h-8 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> {t('settings.knowledge.confirmDelete')}
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }}
                                className="flex-1 h-8 rounded-lg border border-destructive/30 text-destructive text-xs font-medium flex items-center justify-center gap-1 active:bg-destructive/10"
                              >
                                <Trash2 className="w-3 h-3" /> {t('settings.knowledge.delete')}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.39 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" /> {t('settings.data')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button onClick={clearLogs} className="w-full h-12 rounded-xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2 active:bg-destructive/10">
                {t('settings.clearLogs')}
              </button>
              <button onClick={async () => { await clearAllMessages(); localStorage.removeItem('alphabot-chat-history'); window.location.reload(); }}
                className="w-full h-12 rounded-xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2 active:bg-destructive/10">
                {t('settings.clearChatHistory')}
              </button>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-xs text-center text-muted-foreground py-4">{t('settings.version')}</p>
      </div>
    </div>
  );
};

export default Settings;
