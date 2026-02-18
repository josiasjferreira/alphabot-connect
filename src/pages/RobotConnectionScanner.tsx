import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Wifi, Bluetooth, Search, Loader2, CheckCircle, XCircle, AlertCircle,
  Radio, Cpu, Gamepad2, HelpCircle, Eye, Send, Star,
} from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useRobotConnectionScanner } from '@/hooks/useRobotConnectionScanner';
import { useRobotBluetooth } from '@/hooks/useRobotBluetooth';
import type { PortScanResult } from '@/services/robotConnectionScanner';

const serviceIcon = (type: PortScanResult['serviceType']) => {
  switch (type) {
    case 'sensors': return <Radio className="w-4 h-4 text-success" />;
    case 'control': return <Gamepad2 className="w-4 h-4 text-primary" />;
    case 'other': return <Cpu className="w-4 h-4 text-muted-foreground" />;
    default: return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
  }
};

const serviceLabel = (type: PortScanResult['serviceType']) => {
  switch (type) {
    case 'sensors': return 'Sensores';
    case 'control': return 'Controle';
    case 'other': return 'Outro';
    default: return 'Desconhecido';
  }
};

const statusBadge = (status: PortScanResult['status']) => {
  switch (status) {
    case 'open': return <Badge variant="default" className="bg-success text-success-foreground">Aberta</Badge>;
    case 'closed': return <Badge variant="secondary">Fechada</Badge>;
    default: return <Badge variant="outline">Desconhecida</Badge>;
  }
};

const RobotConnectionScanner = () => {
  const { t } = useTranslation();
  const scanner = useRobotConnectionScanner();
  const bt = useRobotBluetooth();
  const [activeTab, setActiveTab] = useState('ip');

  const openPorts = scanner.state.results.filter(r => r.status === 'open');

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('scanner.title')} />

      <div className="flex-1 p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="ip" className="gap-2">
              <Wifi className="w-4 h-4" /> IP / Portas
            </TabsTrigger>
            <TabsTrigger value="bt" className="gap-2">
              <Bluetooth className="w-4 h-4" /> Bluetooth
            </TabsTrigger>
          </TabsList>

          {/* ============ IP TAB ============ */}
          <TabsContent value="ip" className="space-y-4 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configuração do Scanner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">IP Alvo</Label>
                  <Input
                    value={scanner.ip}
                    onChange={e => scanner.setIp(e.target.value)}
                    placeholder="127.0.0.1"
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Portas (separadas por vírgula)</Label>
                  <Input
                    value={scanner.portsText}
                    onChange={e => scanner.parsePortsText(e.target.value)}
                    placeholder="80, 8080, 9090..."
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={scanner.startScan}
                  disabled={scanner.state.scanning}
                  className="w-full gap-2"
                >
                  {scanner.state.scanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {scanner.state.scanning
                    ? `Escaneando porta ${scanner.state.currentPort}...`
                    : 'Escanear Portas do Robô'}
                </Button>
                {scanner.state.scanning && (
                  <Progress value={scanner.state.progress} className="h-2" />
                )}
              </CardContent>
            </Card>

            {/* Results summary */}
            {scanner.state.results.length > 0 && (
              <div className="flex gap-2 text-xs">
                <Badge variant="default" className="bg-success">{openPorts.length} aberta(s)</Badge>
                <Badge variant="secondary">{scanner.state.results.length - openPorts.length} fechada(s)</Badge>
              </div>
            )}

            {/* Results list */}
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2">
                {scanner.state.results.map((r, i) => (
                  <motion.div
                    key={r.port}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className={r.status === 'open' ? 'border-success/50' : 'opacity-60'}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {r.status === 'open' ? (
                            <CheckCircle className="w-5 h-5 text-success shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm">:{r.port}</span>
                              {statusBadge(r.status)}
                              {r.status === 'open' && (
                                <Badge variant="outline" className="gap-1 text-xs">
                                  {serviceIcon(r.serviceType)}
                                  {serviceLabel(r.serviceType)}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto">{r.latencyMs}ms</span>
                            </div>
                            {r.responsePreview && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{r.responsePreview}</p>
                            )}
                          </div>
                          {r.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 gap-1"
                              onClick={() => scanner.testDetails(r.port)}
                              disabled={scanner.detailLoading}
                            >
                              <Eye className="w-3 h-3" /> Detalhes
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {/* Detail panel */}
            {scanner.detailLoading && (
              <Card>
                <CardContent className="p-4 flex items-center gap-2 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Testando detalhes...
                </CardContent>
              </Card>
            )}
            {scanner.detailResult && (
              <Card className="border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detalhes — Porta :{scanner.detailResult.port}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {scanner.detailResult.httpResponses.map((hr, i) => (
                    <div key={i} className="text-xs border rounded p-2">
                      <div className="font-mono font-bold">
                        {hr.path} → HTTP {hr.status}
                      </div>
                      <pre className="mt-1 whitespace-pre-wrap text-muted-foreground max-h-32 overflow-auto">
                        {hr.body || '(vazio)'}
                      </pre>
                    </div>
                  ))}
                  {scanner.detailResult.wsResponse !== null && (
                    <div className="text-xs border rounded p-2">
                      <div className="font-mono font-bold">WebSocket</div>
                      <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {scanner.detailResult.wsResponse || '(sem resposta)'}
                      </pre>
                    </div>
                  )}
                  {scanner.detailResult.httpResponses.length === 0 && scanner.detailResult.wsResponse === null && (
                    <p className="text-xs text-muted-foreground">Nenhuma resposta HTTP ou WebSocket obtida.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ============ BLUETOOTH TAB ============ */}
          <TabsContent value="bt" className="space-y-4 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Scanner Bluetooth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bt.btAvailable && (
                  <div className="flex gap-2 text-xs">
                    <Badge variant={bt.btAvailable.ble ? 'default' : 'secondary'}>
                      BLE: {bt.btAvailable.ble ? 'Disponível' : 'Indisponível'}
                    </Badge>
                    <Badge variant={bt.btAvailable.spp ? 'default' : 'secondary'}>
                      SPP: {bt.btAvailable.spp ? 'Disponível' : 'Indisponível'}
                    </Badge>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Mensagem de Teste</Label>
                  <Input
                    value={bt.testMessage}
                    onChange={e => bt.setTestMessage(e.target.value)}
                    placeholder="PING"
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={bt.scanDevices}
                  disabled={bt.scanning}
                  className="w-full gap-2"
                >
                  {bt.scanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bluetooth className="w-4 h-4" />
                  )}
                  {bt.scanning ? 'Buscando...' : 'Procurar Dispositivos Bluetooth'}
                </Button>
              </CardContent>
            </Card>

            {/* Devices list */}
            {bt.devices.length > 0 && (
              <div className="space-y-2">
                {bt.devices.map((device) => (
                  <Card
                    key={device.id}
                    className={device.id === bt.selectedRobot ? 'border-primary' : ''}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Bluetooth className={`w-5 h-5 shrink-0 ${
                          device.status === 'connected' ? 'text-success' :
                          device.status === 'error' ? 'text-destructive' :
                          'text-muted-foreground'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{device.name}</span>
                            <Badge variant="outline" className="text-[10px]">{device.mode.toUpperCase()}</Badge>
                            {device.id === bt.selectedRobot && (
                              <Badge className="gap-1 text-[10px] bg-primary">
                                <Star className="w-3 h-3" /> Robô
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate">{device.address}</p>
                          {device.lastTestResponse && (
                            <p className="text-xs mt-1 truncate text-muted-foreground">
                              {device.lastTestResponse}
                            </p>
                          )}
                          {device.serviceType && device.serviceType !== 'unknown' && (
                            <Badge variant="outline" className="mt-1 gap-1 text-xs">
                              {serviceIcon(device.serviceType as any)}
                              {serviceLabel(device.serviceType as any)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => bt.testDevice(device.id)}
                            disabled={bt.testing === device.id}
                          >
                            {bt.testing === device.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Testar
                          </Button>
                          {device.id !== bt.selectedRobot && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-xs"
                              onClick={() => bt.markAsRobot(device.id)}
                            >
                              <Star className="w-3 h-3" /> Robô
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {bt.devices.length === 0 && !bt.scanning && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Bluetooth className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Toque em "Procurar Dispositivos" para iniciar
              </div>
            )}

            {/* BT Logs */}
            {bt.logs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Log Bluetooth</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-1">
                      {bt.logs.map((log, i) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground">{log}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RobotConnectionScanner;
