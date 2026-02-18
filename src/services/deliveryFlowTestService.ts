/**
 * DeliveryFlowTestService — Simulated end-to-end delivery flow
 * Tests HTTP, MQTT and WebSocket integration in 6 phases.
 * All communication is simulated locally for diagnostic purposes.
 * 
 * TODO: Replace simulated clients with real HTTP/MQTT/WebSocket when robot API is confirmed.
 */

export interface DeliveryFlowStep {
  phase: string;
  step: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  protocol: 'HTTP' | 'MQTT' | 'WS' | 'INTERNAL';
  timestamp: number;
  duration?: number;
  error?: string;
  details?: string;
}

export type DeliveryStatus = 'IDLE' | 'PREPARING' | 'DELIVERING' | 'ARRIVED' | 'RETURNING' | 'COMPLETED' | 'FAILED';

export interface DeliveryFlowConfig {
  robotSN: string;
  robotIP: string;
  httpPort: number;
  mqttPort: number;
  wsPort: number;
  tableNumber: number;
  tableCoords: { x: number; y: number; theta: number };
  baseCoords: { x: number; y: number; theta: number };
  deliveryDurationMs: number;
  returnDurationMs: number;
  waitAtTableMs: number;
}

export const DEFAULT_FLOW_CONFIG: DeliveryFlowConfig = {
  robotSN: 'CT300-H13307',
  robotIP: '192.168.99.2',
  httpPort: 8080,
  mqttPort: 1883,
  wsPort: 9090,
  tableNumber: 5,
  tableCoords: { x: 50, y: 75, theta: 0 },
  baseCoords: { x: 0, y: 0, theta: 0 },
  deliveryDurationMs: 10000,
  returnDurationMs: 5000,
  waitAtTableMs: 5000,
};

type StepCallback = (step: DeliveryFlowStep) => void;
type StatusCallback = (status: DeliveryStatus) => void;
type PositionCallback = (pos: { x: number; y: number; progress: number }) => void;
type LogCallback = (msg: string, level: 'info' | 'success' | 'warning' | 'error') => void;

// --- Simulated clients ---

class SimulatedHttpClient {
  private baseUrl: string;
  private latencyMs: number;

  constructor(ip: string, port: number) {
    this.baseUrl = `http://${ip}:${port}`;
    this.latencyMs = 150 + Math.random() * 300;
  }

  async post(path: string, body: any): Promise<{ status: number; data: any }> {
    await this.delay();
    return { status: 200, data: { ok: true, path, received: body, ts: Date.now() } };
  }

  async get(path: string): Promise<{ status: number; data: any }> {
    await this.delay();
    if (path.includes('/auth/login')) return { status: 200, data: { token: 'sim_token_' + Date.now(), expiresIn: 3600 } };
    if (path.includes('/config/robot')) return { status: 200, data: { model: 'CT300', firmware: '2.3.1', sensors: ['lidar', 'imu', 'camera'] } };
    if (path.includes('/map/tables')) return { status: 200, data: [
      { tableNumber: 1, x: 20, y: 30, theta: 0 },
      { tableNumber: 3, x: 35, y: 50, theta: 90 },
      { tableNumber: 5, x: 50, y: 75, theta: 0 },
      { tableNumber: 8, x: 70, y: 40, theta: 180 },
    ]};
    return { status: 200, data: { ok: true, path } };
  }

  private delay() { return new Promise(r => setTimeout(r, this.latencyMs)); }
}

class SimulatedMqttClient {
  connected = false;
  subscriptions: string[] = [];
  publishedMessages: { topic: string; payload: any; ts: number }[] = [];

  async connect(): Promise<void> {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    this.connected = true;
  }

  subscribe(topics: string[]) {
    this.subscriptions.push(...topics);
  }

  publish(topic: string, payload: any) {
    this.publishedMessages.push({ topic, payload, ts: Date.now() });
  }

  disconnect() { this.connected = false; }
}

class SimulatedWsClient {
  connected = false;
  framesReceived = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  async connect(): Promise<void> {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    this.connected = true;
  }

  startStream(onFrame?: () => void) {
    this.interval = setInterval(() => {
      this.framesReceived++;
      onFrame?.();
    }, 200);
  }

  stopStream() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  disconnect() {
    this.stopStream();
    this.connected = false;
  }
}

// --- Main service ---

export class DeliveryFlowTestService {
  private steps: DeliveryFlowStep[] = [];
  private config: DeliveryFlowConfig;
  private robotPosition = { x: 0, y: 0 };
  private currentStatus: DeliveryStatus = 'IDLE';
  private taskId = '';
  private aborted = false;

  private httpClient!: SimulatedHttpClient;
  private mqttClient!: SimulatedMqttClient;
  private wsClient!: SimulatedWsClient;

  // Callbacks
  private onStep: StepCallback = () => {};
  private onStatus: StatusCallback = () => {};
  private onPosition: PositionCallback = () => {};
  private onLog: LogCallback = () => {};

  constructor(config: Partial<DeliveryFlowConfig> = {}) {
    this.config = { ...DEFAULT_FLOW_CONFIG, ...config };
  }

  setCallbacks(cbs: { onStep?: StepCallback; onStatus?: StatusCallback; onPosition?: PositionCallback; onLog?: LogCallback }) {
    if (cbs.onStep) this.onStep = cbs.onStep;
    if (cbs.onStatus) this.onStatus = cbs.onStatus;
    if (cbs.onPosition) this.onPosition = cbs.onPosition;
    if (cbs.onLog) this.onLog = cbs.onLog;
  }

  abort() { this.aborted = true; }

  getSteps(): DeliveryFlowStep[] { return [...this.steps]; }

  // --- Phase 1: Initial Connection ---
  private async phase1(): Promise<boolean> {
    this.onLog('═══ FASE 1: Conexão Inicial ═══', 'info');

    // 1.1 HTTP Login
    this.addStep('FASE 1', 'HTTP Login', 'IN_PROGRESS', 'HTTP');
    try {
      const res = await this.httpClient.post('/auth/login', { serialNumber: this.config.robotSN });
      this.completeStep('HTTP Login', 'COMPLETED', `Token: ${res.data.token?.substring(0, 12)}…`);
      this.onLog('✓ 1.1 Login HTTP simulado com sucesso', 'success');
    } catch (e) { return this.failStep('HTTP Login', e); }

    // 1.2 HTTP GetConfig
    this.addStep('FASE 1', 'HTTP GetConfig', 'IN_PROGRESS', 'HTTP');
    try {
      const res = await this.httpClient.get(`/config/robot/${this.config.robotSN}`);
      this.completeStep('HTTP GetConfig', 'COMPLETED', `Model: ${res.data.model}, FW: ${res.data.firmware}`);
      this.onLog(`✓ 1.2 Config obtida: ${res.data.model} (${res.data.firmware})`, 'success');
    } catch (e) { return this.failStep('HTTP GetConfig', e); }

    // 1.3 HTTP GetTableCoordinates
    this.addStep('FASE 1', 'HTTP GetTableCoordinates', 'IN_PROGRESS', 'HTTP');
    try {
      const res = await this.httpClient.get('/map/tables');
      const table = res.data.find((t: any) => t.tableNumber === this.config.tableNumber);
      if (table) this.config.tableCoords = { x: table.x, y: table.y, theta: table.theta };
      this.completeStep('HTTP GetTableCoordinates', 'COMPLETED', `Mesa ${this.config.tableNumber}: (${this.config.tableCoords.x}, ${this.config.tableCoords.y})`);
      this.onLog(`✓ 1.3 Coordenadas mesa ${this.config.tableNumber}: (${this.config.tableCoords.x}, ${this.config.tableCoords.y})`, 'success');
    } catch (e) { return this.failStep('HTTP GetTableCoordinates', e); }

    // 1.4 MQTT Connect
    this.addStep('FASE 1', 'MQTT Connect', 'IN_PROGRESS', 'MQTT');
    try {
      await this.mqttClient.connect();
      this.completeStep('MQTT Connect', 'COMPLETED', `Broker: ${this.config.robotIP}:${this.config.mqttPort}`);
      this.onLog('✓ 1.4 MQTT conectado (simulado)', 'success');
    } catch (e) { return this.failStep('MQTT Connect', e); }

    // 1.5 MQTT Subscribe
    this.addStep('FASE 1', 'MQTT Subscribe', 'IN_PROGRESS', 'MQTT');
    const topics = [`robot/${this.config.robotSN}/status`, `robot/${this.config.robotSN}/task/new`, `robot/${this.config.robotSN}/position`];
    this.mqttClient.subscribe(topics);
    this.completeStep('MQTT Subscribe', 'COMPLETED', `${topics.length} tópicos`);
    this.onLog(`✓ 1.5 Inscrito em ${topics.length} tópicos MQTT`, 'success');

    // 1.6 WebSocket Connect
    this.addStep('FASE 1', 'WebSocket Connect', 'IN_PROGRESS', 'WS');
    try {
      await this.wsClient.connect();
      this.completeStep('WebSocket Connect', 'COMPLETED', `Câmera: ${this.config.robotIP}:${this.config.wsPort}`);
      this.onLog('✓ 1.6 WebSocket câmera conectado (simulado)', 'success');
    } catch (e) { return this.failStep('WebSocket Connect', e); }

    return true;
  }

  // --- Phase 2: Receive Task ---
  private async phase2(): Promise<boolean> {
    this.onLog('═══ FASE 2: Receber Tarefa ═══', 'info');

    // 2.1 Simulate task via MQTT
    this.addStep('FASE 2', 'MQTT Receive /task/new', 'IN_PROGRESS', 'MQTT');
    this.taskId = `task_${Date.now()}`;
    const task = { id: this.taskId, tableNumber: this.config.tableNumber, dishList: ['Prato A', 'Prato B'], priority: 'normal' };
    this.completeStep('MQTT Receive /task/new', 'COMPLETED', `Task: ${this.taskId.substring(0, 16)}…`);
    this.onLog(`✓ 2.1 Tarefa recebida: mesa ${task.tableNumber} — ${task.dishList.join(', ')}`, 'success');

    // 2.2 HTTP UpdateStatus → PREPARING
    this.addStep('FASE 2', 'HTTP UpdateStatus → PREPARING', 'IN_PROGRESS', 'HTTP');
    try {
      await this.httpClient.post('/order/update', { id: this.taskId, status: 'PREPARING' });
      this.setStatus('PREPARING');
      this.completeStep('HTTP UpdateStatus → PREPARING', 'COMPLETED');
      this.onLog('✓ 2.2 Status → PREPARING', 'success');
    } catch (e) { return this.failStep('HTTP UpdateStatus → PREPARING', e); }

    // 2.3 Validate
    this.addStep('FASE 2', 'Validar dados da tarefa', 'IN_PROGRESS', 'INTERNAL');
    const valid = task.id && task.tableNumber > 0 && task.dishList.length > 0;
    if (!valid) return this.failStep('Validar dados da tarefa', new Error('Dados inválidos'));
    this.completeStep('Validar dados da tarefa', 'COMPLETED', 'Dados OK');
    this.onLog('✓ 2.3 Dados da tarefa validados', 'success');

    return true;
  }

  // --- Phase 3: Start Navigation ---
  private async phase3(): Promise<boolean> {
    this.onLog('═══ FASE 3: Iniciar Navegação ═══', 'info');

    // 3.1 MQTT goto
    this.addStep('FASE 3', 'MQTT Send /command goto', 'IN_PROGRESS', 'MQTT');
    this.mqttClient.publish(`robot/${this.config.robotSN}/command`, { command: 'goto', targetX: this.config.tableCoords.x, targetY: this.config.tableCoords.y });
    this.completeStep('MQTT Send /command goto', 'COMPLETED', `goto(${this.config.tableCoords.x}, ${this.config.tableCoords.y})`);
    this.onLog(`✓ 3.1 Comando goto → (${this.config.tableCoords.x}, ${this.config.tableCoords.y})`, 'success');

    // 3.2 HTTP → DELIVERING
    this.addStep('FASE 3', 'HTTP UpdateStatus → DELIVERING', 'IN_PROGRESS', 'HTTP');
    try {
      await this.httpClient.post('/order/update', { id: this.taskId, status: 'DELIVERING' });
      this.setStatus('DELIVERING');
      this.completeStep('HTTP UpdateStatus → DELIVERING', 'COMPLETED');
      this.onLog('✓ 3.2 Status → DELIVERING', 'success');
    } catch (e) { return this.failStep('HTTP UpdateStatus → DELIVERING', e); }

    // 3.3 Start position publishing & video stream
    this.addStep('FASE 3', 'Iniciar publicação de posição + vídeo', 'IN_PROGRESS', 'INTERNAL');
    this.wsClient.startStream();
    this.completeStep('Iniciar publicação de posição + vídeo', 'COMPLETED', 'Position @ 1Hz, Video stream started');
    this.onLog('✓ 3.3 Publicação de posição e stream de vídeo iniciados', 'success');

    return true;
  }

  // --- Phase 4: During Delivery ---
  private async phase4(): Promise<boolean> {
    this.onLog(`═══ FASE 4: Durante Entrega (${this.config.deliveryDurationMs / 1000}s) ═══`, 'info');
    this.addStep('FASE 4', 'Monitorar entrega', 'IN_PROGRESS', 'INTERNAL');

    const { tableCoords, deliveryDurationMs } = this.config;
    const startTime = Date.now();
    let positionPublishCount = 0;
    let statePublishCount = 0;

    return new Promise<boolean>((resolve) => {
      const interval = setInterval(() => {
        if (this.aborted) { clearInterval(interval); this.failStep('Monitorar entrega', new Error('Abortado')); resolve(false); return; }

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / deliveryDurationMs, 1);
        this.robotPosition.x = tableCoords.x * progress;
        this.robotPosition.y = tableCoords.y * progress;
        const distance = Math.sqrt(Math.pow(this.robotPosition.x - tableCoords.x, 2) + Math.pow(this.robotPosition.y - tableCoords.y, 2));

        // Publish position every tick (~1s)
        positionPublishCount++;
        this.mqttClient.publish(`robot/${this.config.robotSN}/position`, { x: +this.robotPosition.x.toFixed(1), y: +this.robotPosition.y.toFixed(1), ts: Date.now() });

        // Publish state every 5 ticks
        if (positionPublishCount % 5 === 0) {
          statePublishCount++;
          this.mqttClient.publish(`robot/${this.config.robotSN}/state`, { status: this.currentStatus, battery: 85 - statePublishCount, speed: 0.5 });
        }

        this.onPosition({ x: +this.robotPosition.x.toFixed(1), y: +this.robotPosition.y.toFixed(1), progress: +(progress * 100).toFixed(0) });
        this.onLog(`  Pos: (${this.robotPosition.x.toFixed(1)}, ${this.robotPosition.y.toFixed(1)}) | Dist: ${distance.toFixed(1)}m | ${(progress * 100).toFixed(0)}%`, 'info');

        if (distance < 0.5 || elapsed >= deliveryDurationMs) {
          clearInterval(interval);
          this.robotPosition = { x: tableCoords.x, y: tableCoords.y };
          this.completeStep('Monitorar entrega', 'COMPLETED', `${positionPublishCount} pos msgs, ${statePublishCount} state msgs, ${this.wsClient.framesReceived} frames`);
          this.onLog(`✓ 4 Entrega monitorada: ${positionPublishCount} posições publicadas`, 'success');
          resolve(true);
        }
      }, 1000);
    });
  }

  // --- Phase 5: Arrival ---
  private async phase5(): Promise<boolean> {
    this.onLog('═══ FASE 5: Chegada na Mesa ═══', 'info');

    // 5.1 MQTT pause
    this.addStep('FASE 5', 'MQTT Send /command pause', 'IN_PROGRESS', 'MQTT');
    this.mqttClient.publish(`robot/${this.config.robotSN}/command`, { command: 'pause' });
    this.completeStep('MQTT Send /command pause', 'COMPLETED');
    this.onLog('✓ 5.1 Comando pause enviado', 'success');

    // 5.2 HTTP → ARRIVED
    this.addStep('FASE 5', 'HTTP UpdateStatus → ARRIVED', 'IN_PROGRESS', 'HTTP');
    try {
      await this.httpClient.post('/order/update', { id: this.taskId, status: 'ARRIVED', position: this.robotPosition });
      this.setStatus('ARRIVED');
      this.completeStep('HTTP UpdateStatus → ARRIVED', 'COMPLETED');
      this.onLog('✓ 5.2 Status → ARRIVED', 'success');
    } catch (e) { return this.failStep('HTTP UpdateStatus → ARRIVED', e); }

    // 5.3 Stop position
    this.addStep('FASE 5', 'Parar publicação de posição', 'IN_PROGRESS', 'INTERNAL');
    this.wsClient.stopStream();
    this.completeStep('Parar publicação de posição', 'COMPLETED');
    this.onLog('✓ 5.3 Publicação parada', 'success');

    return true;
  }

  // --- Phase 6: Return to Base ---
  private async phase6(): Promise<boolean> {
    this.onLog('═══ FASE 6: Retorno à Base ═══', 'info');

    // 6.1 Wait (simulating pickup)
    this.addStep('FASE 6', `Aguardar ${this.config.waitAtTableMs / 1000}s (entrega)`, 'IN_PROGRESS', 'INTERNAL');
    await this.sleep(this.config.waitAtTableMs);
    this.completeStep(`Aguardar ${this.config.waitAtTableMs / 1000}s (entrega)`, 'COMPLETED');
    this.onLog(`✓ 6.1 Aguardou ${this.config.waitAtTableMs / 1000}s na mesa`, 'success');

    // 6.2 MQTT goto base
    this.addStep('FASE 6', 'MQTT Send /command goto base', 'IN_PROGRESS', 'MQTT');
    this.mqttClient.publish(`robot/${this.config.robotSN}/command`, { command: 'goto', targetX: 0, targetY: 0 });
    this.completeStep('MQTT Send /command goto base', 'COMPLETED');
    this.onLog('✓ 6.2 Comando retorno à base enviado', 'success');

    // 6.3 HTTP → RETURNING
    this.addStep('FASE 6', 'HTTP UpdateStatus → RETURNING', 'IN_PROGRESS', 'HTTP');
    try {
      await this.httpClient.post('/order/update', { id: this.taskId, status: 'RETURNING' });
      this.setStatus('RETURNING');
      this.completeStep('HTTP UpdateStatus → RETURNING', 'COMPLETED');
      this.onLog('✓ 6.3 Status → RETURNING', 'success');
    } catch (e) { return this.failStep('HTTP UpdateStatus → RETURNING', e); }

    // 6.4 Simulate return journey
    this.addStep('FASE 6', 'Retorno à base', 'IN_PROGRESS', 'INTERNAL');
    const returnSteps = 5;
    for (let i = 1; i <= returnSteps; i++) {
      if (this.aborted) return this.failStep('Retorno à base', new Error('Abortado'));
      await this.sleep(this.config.returnDurationMs / returnSteps);
      const progress = i / returnSteps;
      this.robotPosition.x = this.config.tableCoords.x * (1 - progress);
      this.robotPosition.y = this.config.tableCoords.y * (1 - progress);
      this.onPosition({ x: +this.robotPosition.x.toFixed(1), y: +this.robotPosition.y.toFixed(1), progress: +(progress * 100).toFixed(0) });
      this.mqttClient.publish(`robot/${this.config.robotSN}/position`, { x: +this.robotPosition.x.toFixed(1), y: +this.robotPosition.y.toFixed(1) });
    }
    this.robotPosition = { x: 0, y: 0 };
    this.completeStep('Retorno à base', 'COMPLETED', 'Posição: (0, 0)');
    this.onLog('✓ 6.4 Robô retornou à base', 'success');

    // 6.5 HTTP → COMPLETED
    this.addStep('FASE 6', 'HTTP UpdateStatus → COMPLETED', 'IN_PROGRESS', 'HTTP');
    try {
      await this.httpClient.post('/order/update', { id: this.taskId, status: 'COMPLETED' });
      this.setStatus('COMPLETED');
      this.completeStep('HTTP UpdateStatus → COMPLETED', 'COMPLETED');
      this.onLog('✓ 6.5 Status → COMPLETED', 'success');
    } catch (e) { return this.failStep('HTTP UpdateStatus → COMPLETED', e); }

    return true;
  }

  // --- Run complete flow ---
  async runCompleteFlow(): Promise<DeliveryFlowStep[]> {
    this.steps = [];
    this.aborted = false;
    this.currentStatus = 'IDLE';
    this.robotPosition = { x: 0, y: 0 };

    this.httpClient = new SimulatedHttpClient(this.config.robotIP, this.config.httpPort);
    this.mqttClient = new SimulatedMqttClient();
    this.wsClient = new SimulatedWsClient();

    this.onLog('╔══════════════════════════════════════════════╗', 'info');
    this.onLog('║   TESTE DE FLUXO COMPLETO DE DELIVERY        ║', 'info');
    this.onLog('╚══════════════════════════════════════════════╝', 'info');
    this.onLog(`Robô: ${this.config.robotSN} | IP: ${this.config.robotIP} | Mesa: ${this.config.tableNumber}`, 'info');

    const startTime = Date.now();
    const phases = [
      () => this.phase1(),
      () => this.phase2(),
      () => this.phase3(),
      () => this.phase4(),
      () => this.phase5(),
      () => this.phase6(),
    ];

    for (const phase of phases) {
      if (this.aborted) break;
      const ok = await phase();
      if (!ok) break;
    }

    const totalTime = Date.now() - startTime;
    const passed = this.steps.filter(s => s.status === 'COMPLETED').length;
    const failed = this.steps.filter(s => s.status === 'FAILED').length;

    this.onLog('', 'info');
    this.onLog(`══ RESULTADO: ${failed === 0 ? '✅ SUCESSO' : '❌ FALHAS'} ══`, failed === 0 ? 'success' : 'error');
    this.onLog(`Passos: ${passed}/${this.steps.length} | Falhas: ${failed} | Tempo: ${(totalTime / 1000).toFixed(1)}s`, 'info');
    this.onLog(`MQTT msgs: ${this.mqttClient.publishedMessages.length} | WS frames: ${this.wsClient.framesReceived}`, 'info');

    this.disconnect();
    return this.steps;
  }

  // --- Helpers ---
  private setStatus(status: DeliveryStatus) {
    this.currentStatus = status;
    this.onStatus(status);
  }

  private addStep(phase: string, step: string, status: DeliveryFlowStep['status'], protocol: DeliveryFlowStep['protocol']) {
    const s: DeliveryFlowStep = { phase, step, status, protocol, timestamp: Date.now() };
    this.steps.push(s);
    this.onStep(s);
  }

  private completeStep(step: string, status: 'COMPLETED' | 'FAILED', details?: string) {
    const s = [...this.steps].reverse().find(s => s.step === step);
    if (s) {
      s.status = status;
      s.duration = Date.now() - s.timestamp;
      if (details) s.details = details;
      this.onStep(s);
    }
  }

  private failStep(step: string, error: any): false {
    const msg = error instanceof Error ? error.message : String(error);
    this.completeStep(step, 'FAILED');
    const s = [...this.steps].reverse().find(s => s.step === step);
    if (s) s.error = msg;
    this.onLog(`✗ ${step}: ${msg}`, 'error');
    this.setStatus('FAILED');
    return false;
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  disconnect() {
    this.mqttClient?.disconnect();
    this.wsClient?.disconnect();
  }

  generateReport(): string {
    const passed = this.steps.filter(s => s.status === 'COMPLETED').length;
    const failed = this.steps.filter(s => s.status === 'FAILED').length;
    const totalTime = this.steps.length > 1 ? (this.steps[this.steps.length - 1].timestamp + (this.steps[this.steps.length - 1].duration || 0)) - this.steps[0].timestamp : 0;

    let report = `RELATÓRIO DE FLUXO DE DELIVERY\n${'═'.repeat(50)}\nTotal: ${this.steps.length} | ✓ ${passed} | ✗ ${failed} | Tempo: ${(totalTime / 1000).toFixed(1)}s\n\n`;

    let currentPhase = '';
    this.steps.forEach((s, i) => {
      if (s.phase !== currentPhase) { currentPhase = s.phase; report += `\n${currentPhase}\n`; }
      const icon = s.status === 'COMPLETED' ? '✓' : s.status === 'FAILED' ? '✗' : '…';
      report += `  ${i + 1}. [${s.protocol}] ${s.step} — ${icon} ${s.status} (${s.duration ?? 0}ms)${s.error ? ` ERR: ${s.error}` : ''}${s.details ? ` | ${s.details}` : ''}\n`;
    });

    report += `\n${'═'.repeat(50)}\n${failed === 0 ? '✅ FLUXO BEM-SUCEDIDO' : '❌ FLUXO COM FALHAS'}\n`;
    return report;
  }
}
