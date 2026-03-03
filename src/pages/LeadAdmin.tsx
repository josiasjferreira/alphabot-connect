// src/pages/LeadAdmin.tsx — Admin view for captured leads (offline)
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAllLeads, getLeadCount, exportLeadsCSV, clearAllLeads, type KenLead } from '@/db/leadDatabase';
import { ArrowLeft, Download, Trash2, Users, Search } from 'lucide-react';

export default function LeadAdmin() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<KenLead[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');

  const loadLeads = useCallback(async () => {
    const all = await getAllLeads();
    setLeads(all);
    setCount(await getLeadCount());
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleExport = async () => {
    const csv = await exportLeadsCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ken_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!confirm(`Apagar todos os ${count} leads? Esta ação não pode ser desfeita.`)) return;
    await clearAllLeads();
    loadLeads();
  };

  const filtered = search
    ? leads.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.whatsapp.includes(search.replace(/\D/g, ''))
      )
    : leads;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Leads Capturados</h1>
          <p className="text-xs text-muted-foreground">{count} cadastro(s) • offline</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={count === 0}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClear} disabled={count === 0}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou WhatsApp..."
            className="pl-9 h-10"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{search ? 'Nenhum resultado' : 'Nenhum lead capturado ainda'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((lead, i) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-card rounded-xl border border-border p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {lead.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
