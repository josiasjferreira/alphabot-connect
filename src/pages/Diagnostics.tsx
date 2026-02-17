import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Play, Camera, Mic, Wifi, Battery, Thermometer, Cpu, HardDrive } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';

interface TestResult {
  id: string;
  status: 'idle' | 'running' | 'pass' | 'fail';
  detail?: string;
}

const diagnosticTests = [
  { id: 'cpu', icon: Cpu, labelKey: 'diagnostics.tests.cpu' },
  { id: 'memory', icon: HardDrive, labelKey: 'diagnostics.tests.memory' },
  { id: 'battery', icon: Battery, labelKey: 'diagnostics.tests.battery' },
  { id: 'temperature', icon: Thermometer, labelKey: 'diagnostics.tests.temperature' },
  { id: 'wifi', icon: Wifi, labelKey: 'diagnostics.tests.wifi' },
  { id: 'camera', icon: Camera, labelKey: 'diagnostics.tests.camera' },
  { id: 'microphone', icon: Mic, labelKey: 'diagnostics.tests.microphone' },
];

const Diagnostics = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState<TestResult[]>(
    diagnosticTests.map(t => ({ id: t.id, status: 'idle' }))
  );
  const [running, setRunning] = useState(false);

  const runAllTests = async () => {
    setRunning(true);
    for (let i = 0; i < diagnosticTests.length; i++) {
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'running' } : r));
      await new Promise(res => setTimeout(res, 800 + Math.random() * 700));
      const pass = Math.random() > 0.15;
      setResults(prev => prev.map((r, idx) => idx === i ? {
        ...r,
        status: pass ? 'pass' : 'fail',
        detail: pass ? t('diagnostics.ok') : t('diagnostics.failed'),
      } : r));
    }
    setRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running': return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'pass': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'fail': return <XCircle className="w-5 h-5 text-destructive" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('diagnostics.title')} />
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {passCount > 0 && <span className="text-success font-semibold">{passCount} ✓</span>}
            {failCount > 0 && <span className="text-destructive font-semibold ml-2">{failCount} ✗</span>}
          </div>
          <Button onClick={runAllTests} disabled={running} className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {t('diagnostics.runAll')}
          </Button>
        </div>

        <div className="space-y-2">
          {diagnosticTests.map((test, i) => (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-card"
            >
              <test.icon className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">{t(test.labelKey)}</span>
              {getStatusIcon(results[i].status)}
              {results[i].detail && (
                <span className={`text-xs ${results[i].status === 'pass' ? 'text-success' : 'text-destructive'}`}>
                  {results[i].detail}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Diagnostics;
