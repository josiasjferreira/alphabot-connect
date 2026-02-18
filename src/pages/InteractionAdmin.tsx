import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Download, Trash2, RefreshCw, Search, Phone, Package, Clock, CheckCircle, AlertCircle, ChevronDown, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatusHeader from '@/components/StatusHeader';
import { getAllInteractions, getUnsyncedInteractions, clearAllInteractions, type InteractionRecord } from '@/db/interactionDatabase';

const InteractionAdmin = () => {
  const { t } = useTranslation();
  const [interactions, setInteractions] = useState<InteractionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [all, pending] = await Promise.all([
      getAllInteractions(500),
      getUnsyncedInteractions(),
    ]);
    setInteractions(all.reverse()); // newest first
    setPendingCount(pending.length);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = search.trim()
    ? interactions.filter(r =>
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.clientWhatsapp.includes(search) ||
        r.productId.toLowerCase().includes(search.toLowerCase()) ||
        r.texts.some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    : interactions;

  // Group by unique clients (non-empty name)
  const uniqueClients = new Set(interactions.filter(r => r.clientName && r.clientName !== 'anônimo').map(r => r.clientName));

  // Chart data: interactions per product
  const CHART_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--warning))',
    'hsl(var(--success))',
    'hsl(var(--destructive))',
    'hsl(var(--accent))',
  ];

  const productChartData = useMemo(() => {
    const map = new Map<string, number>();
    interactions.forEach(r => {
      map.set(r.productId, (map.get(r.productId) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [interactions]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Data/Hora', 'Cliente', 'WhatsApp', 'Produto', 'Detalhes', 'Sincronizado'];
    const rows = filtered.map(r => [
      r.id,
      new Date(r.createdAt).toLocaleString(),
      r.clientName,
      r.clientWhatsapp,
      r.productId,
      r.texts.join(' | '),
      r.synced ? 'Sim' : 'Não',
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interacoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(filtered, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interacoes_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    await clearAllInteractions();
    setShowConfirmClear(false);
    await loadData();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title={t('interactionAdmin.title')} />

      <div className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border shadow-card p-3 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{uniqueClients.size}</p>
            <p className="text-[10px] text-muted-foreground">{t('interactionAdmin.clients')}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-2xl border border-border shadow-card p-3 text-center">
            <Package className="w-5 h-5 text-secondary mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{interactions.length}</p>
            <p className="text-[10px] text-muted-foreground">{t('interactionAdmin.total')}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border border-border shadow-card p-3 text-center">
            <AlertCircle className={`w-5 h-5 mx-auto mb-1 ${pendingCount > 0 ? 'text-warning' : 'text-success'}`} />
            <p className="text-xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground">{t('interactionAdmin.pending')}</p>
          </motion.div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 h-11 px-3 rounded-xl bg-card border border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('interactionAdmin.searchPlaceholder')}
              className="flex-1 bg-transparent text-foreground text-sm focus:outline-none"
            />
          </div>
          <button onClick={loadData} className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 text-secondary-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="flex-1 h-11 rounded-xl bg-primary/10 border border-primary/30 text-primary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {t('interactionAdmin.exportCSV')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleExportJSON}
            disabled={filtered.length === 0}
            className="flex-1 h-11 rounded-xl bg-secondary/10 border border-secondary/30 text-secondary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {t('interactionAdmin.exportJSON')}
          </motion.button>
        </div>

        {/* Product Chart */}
        {productChartData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-2xl border border-border shadow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t('interactionAdmin.chartTitle')}</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productChartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'hsl(var(--foreground))',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {productChartData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Interaction List */}
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('interactionAdmin.noData')}</p>
            </div>
          )}

          {filtered.map((record) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${record.synced ? 'bg-success' : 'bg-warning'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {record.clientName || '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(record.createdAt)}
                      {record.clientWhatsapp && (
                        <span className="flex items-center gap-0.5 ml-2">
                          <Phone className="w-3 h-3" /> {record.clientWhatsapp}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                    {record.productId}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground ml-2 transition-transform ${expandedId === record.id ? 'rotate-180' : ''}`} />
              </button>

              {expandedId === record.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-4 pb-3 border-t border-border"
                >
                  <div className="pt-2 space-y-1">
                    {record.texts.map((text, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {text}</p>
                    ))}
                    <div className="flex items-center gap-1 mt-2">
                      {record.synced ? (
                        <span className="text-[10px] text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t('interactionAdmin.synced')}</span>
                      ) : (
                        <span className="text-[10px] text-warning flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t('interactionAdmin.notSynced')}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Clear All */}
        <div className="pt-2">
          {!showConfirmClear ? (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="w-full h-12 rounded-xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2 active:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
              {t('interactionAdmin.clearAll')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 h-12 rounded-xl border-2 border-border text-muted-foreground font-semibold text-sm"
              >
                {t('interactionAdmin.cancel')}
              </button>
              <button
                onClick={handleClear}
                className="flex-1 h-12 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('interactionAdmin.confirmClear')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractionAdmin;
