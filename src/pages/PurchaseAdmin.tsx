import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getAllPurchases,
  exportPurchasesCSV,
  updatePurchaseStatus,
  generateEmailBody,
  type EbookPurchase,
} from '@/db/purchaseDatabase';
import {
  ArrowLeft, Download, Search, CheckCircle2, Clock,
  BookOpen, Mail, RefreshCw, Copy, ShoppingBag, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PurchaseAdmin() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<EbookPurchase[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await getAllPurchases();
    setPurchases(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = purchases.filter(p =>
    p.customerName.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.whatsapp.includes(search.replace(/\D/g, ''))
  );

  const confirmedCount = purchases.filter(p => p.status === 'confirmed').length;

  const handleToggleStatus = async (id: string, current: string) => {
    const next = current === 'confirmed' ? 'pending' : 'confirmed';
    await updatePurchaseStatus(id, next as 'pending' | 'confirmed');
    toast.success(next === 'confirmed' ? 'Pagamento confirmado!' : 'Status revertido para pendente');
    load();
  };

  const handleExportCSV = async () => {
    const csv = await exportPurchasesCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ebook-vendas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const handleCopyEmailReport = () => {
    const body = generateEmailBody(purchases);
    navigator.clipboard.writeText(body).then(() => {
      toast.success('Relatório copiado! Cole no e-mail para josias@onlifecomercio.com.br');
    }).catch(() => {
      toast.error('Falha ao copiar. Tente exportar CSV.');
    });
  };

  const handleShareWhatsApp = () => {
    const body = generateEmailBody(purchases);
    const phone = '5511999999999'; // número do Josias
    const url = `https://wa.me/5511999999999?text=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleOpenMailto = () => {
    const subject = encodeURIComponent(`Relatório de Vendas — E-book A Revolução Humanoide — ${new Date().toLocaleDateString('pt-BR')}`);
    const body = encodeURIComponent(generateEmailBody(purchases));
    window.open(`mailto:josias@onlifecomercio.com.br?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Vendas do E-book
          </h1>
          <p className="text-xs text-muted-foreground">A Revolução Humanoide</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{purchases.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-success">{confirmedCount}</p>
          <p className="text-[10px] text-muted-foreground">Confirmados</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-warning">{purchases.length - confirmedCount}</p>
          <p className="text-[10px] text-muted-foreground">Pendentes</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 flex gap-2">
        <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex-1 gap-1.5">
          <Download className="w-4 h-4" /> CSV
        </Button>
        <Button onClick={handleCopyEmailReport} variant="outline" size="sm" className="flex-1 gap-1.5">
          <Copy className="w-4 h-4" /> Copiar Relatório
        </Button>
        <Button onClick={handleOpenMailto} variant="default" size="sm" className="flex-1 gap-1.5">
          <Mail className="w-4 h-4" /> E-mail
        </Button>
        <Button onClick={handleShareWhatsApp} variant="default" size="sm" className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </Button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou WhatsApp..."
            className="pl-10 h-11 rounded-xl"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-4 pb-6 space-y-2 overflow-auto">
        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum resultado encontrado' : 'Nenhuma venda registrada ainda'}
            </p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-xl p-3 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{p.customerName}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.whatsapp}</p>
                </div>
                <Button
                  variant={p.status === 'confirmed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleStatus(p.id, p.status)}
                  className={`gap-1 text-xs shrink-0 ${p.status === 'confirmed' ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`}
                >
                  {p.status === 'confirmed' ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Confirmado</>
                  ) : (
                    <><Clock className="w-3.5 h-3.5" /> Pendente</>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(p.createdAt).toLocaleString('pt-BR')}
              </p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}