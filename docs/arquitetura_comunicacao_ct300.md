# Arquitetura de Comunicação CT300-H13307 ↔ AlphaBot Companion
## Documento de Referência para Migração v2.1.0

**Data:** 21 de fevereiro de 2026  
**Analista:** Josias Ferreira (Iascom)  
**Base:** Engenharia reversa do Delivery_i18n_amy V5.3.8 (Build 229)

---

## 1. RESUMO ARQUITETURAL

### 1.1 Visão Geral da Comunicação

```
┌──────────────────────────────────────────────────────────────────────┐
│                      ROBÔ CT300-H13307                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ Tablet Android  │  │ Módulo SLAM    │  │ Firmware (MCU)       │  │
│  │ 192.168.99.101  │  │ Slamware       │  │ sensor_calibration.c │  │
│  │ (Delivery App)  │  │ 192.168.99.2   │  │ (EEPROM, sensores)   │  │
│  │ HTTP :80        │  │ TCP :1445      │  │ Serial UART          │  │
│  │ MQTT :1883      │  │                │  │                      │  │
│  └───────┬─────┬──┘  └───────┬────────┘  └──────────┬───────────┘  │
│          │     │              │                       │              │
│          │     └──── WiFi ────┴───── Serial ──────────┘              │
│          │          (gateway: 192.168.99.1)                          │
└──────────┼──────────────────────────────────────────────────────────┘
           │ WiFi (hotspot robô ou RoboKen_Controle)
           │
┌──────────┴──────────────────────────────────────────────────────────┐
│                   APP (AlphaBot Companion)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │agent-mqtt│ │agent-slam│ │agent-http│ │agent-bt  │ │   UI     │ │
│  │(telemetry│ │(pose,nav)│ │(REST API)│ │(serial)  │ │(React)   │ │
│  │ status)  │ │1445 TCP  │ │ :80      │ │SPP/BLE   │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      shared-core                             │   │
│  │  DTOs, enums, contratos de mensagem, utils de protocolo     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Canais de Comunicação Identificados

| Canal          | Endereço              | Porta | Protocolo   | Direção      | Uso Principal                    |
|----------------|-----------------------|-------|-------------|--------------|----------------------------------|
| SLAM/Slamware  | 192.168.99.2          | 1445  | TCP binário | Bidirecional | Pose, mapa, navegação            |
| MQTT Broker    | 192.168.99.1 / .101   | 1883  | MQTT v3.1.1 | Pub/Sub      | Telemetria, status, comandos     |
| HTTP REST      | 192.168.99.101        | 80    | HTTP/JSON   | Req/Res      | Config, pedidos, calibração      |
| WebSocket      | 192.168.99.101        | 8080  | WS/JSON     | Bidirecional | Câmera, chat, emergência         |
| Bluetooth      | N/A                   | SPP   | Serial/JSON | Bidirecional | Calibração, movimento (fallback) |
| Push Tencent   | tpns.sh.tencent.com   | 443   | HTTPS       | Server→App   | Notificações de pedidos          |

---

## 2. CONTRATO DE COMUNICAÇÃO POR CANAL

### 2.1 SLAM (192.168.99.2:1445)

**SDK:** Slamtec Slamware SDK  
**Protocolo:** TCP binário proprietário (Slamware RPC)

| Operação              | Direção   | Dados Trafegados                                    |
|-----------------------|-----------|-----------------------------------------------------|
| getPose()             | App←Robot | `{ x: float, y: float, theta: float }`             |
| getMap()              | App←Robot | Mapa em bitmap (grid occupancy) ou vetor            |
| goTo(x,y,theta)       | App→Robot | Coordenada destino + orientação                     |
| getCurrentPath()      | App←Robot | Array de waypoints `[{x,y}, ...]`                   |
| cancelNavigation()    | App→Robot | Cancela rota ativa                                  |
| getObstacles()        | App←Robot | Lista de obstáculos detectados `[{x,y,radius}, ...]`|
| setSpeed(linear,ang)  | App→Robot | Velocidade linear (m/s) e angular (rad/s)           |
| getLocalizationQuality| App←Robot | Score 0-100 da qualidade SLAM                       |

**Formato WebSocket equivalente (para nosso app):**
```typescript
interface SlamPose {
  x: number;       // metros
  y: number;       // metros  
  theta: number;   // radianos
  timestamp: number;
  quality: number;  // 0-100
}
```

### 2.2 MQTT — Tópicos e Payloads

**Broker:** Eclipse Paho v3.1.1 → Mosquitto (porta WS: 9001 ou 1883)

#### Tópicos Confirmados (engenharia reversa):

| Tópico                                    | Pub/Sub | QoS | Payload (JSON)                                |
|-------------------------------------------|---------|-----|-----------------------------------------------|
| `robot/{SN}/status`                       | Pub     | 0   | `RobotStateBean` (heartbeat 5s)               |
| `robot/{SN}/position`                     | Pub     | 0   | `{ x, y, theta, timestamp }`                  |
| `robot/{SN}/battery`                      | Pub     | 0   | `ChargeBean { percent, voltage, charging }`    |
| `robot/{SN}/command`                      | Sub     | 1   | `{ cmd, params, timestamp }`                   |
| `robot/{SN}/task/new`                     | Sub     | 1   | `TaskBean { deskId, dishList, priority }`      |
| `robot/{SN}/calibration/progress`         | Pub     | 0   | `CalibrationProgress { state, progress, sensor }` |
| `robot/{SN}/calibration/complete`         | Pub     | 1   | `CalibrationData { ...offsets, ...scales }`    |
| `robot/{SN}/calibration/error`            | Pub     | 1   | `{ error: string, state: number }`             |
| `robot/{SN}/movement/{direction}`         | Sub     | 0   | `{ speed, duration, timestamp }`               |
| `robot/{SN}/movement/stop`               | Sub     | 0   | `{ timestamp }`                                |
| `robot/{SN}/log`                          | Pub     | 0   | `{ level, message, timestamp }`                |
| `csjbot/{SN}/#`                           | Pub/Sub | 0   | Namespace alternativo (compatibilidade)        |
| `kitchen/order/ready`                     | Sub     | 1   | `{ orderId, deskId, timestamp }`               |
| `slamware/#`                              | Pub     | 0   | Dados brutos SLAM                              |
| `sensor/#`                                | Pub     | 0   | Telemetria de sensores                         |

#### Payloads Detalhados:

**RobotStateBean (heartbeat a cada 5s):**
```json
{
  "sn": "H13307",
  "status": "IDLE",           // IDLE | DELIVERY | CHARGING | PATROL | RECEPTION
  "batteryLevel": 85,
  "speed": 0.0,
  "x": 5.2, "y": 3.8, "theta": 1.57,
  "slamStatus": "OK",
  "motorStatus": "OK",
  "sensorStatus": "OK",
  "timestamp": 1708500000000
}
```

**TaskBean (novo pedido via MQTT):**
```json
{
  "id": 1001,
  "deskId": 12,
  "tableNumber": "A12",
  "dishList": [
    { "dishId": 501, "name": "Pad Thai", "quantity": 2, "imageUrl": "..." }
  ],
  "priority": 1,
  "status": "pending",
  "timestamp": 1708500000000
}
```

**CalibrationProgress:**
```json
{
  "state": 2,
  "stateString": "Calibrating IMU",
  "progress": 45,
  "currentSensor": "imu",
  "sensors": [
    { "name": "imu", "status": "running", "progress": 45 },
    { "name": "magnetometer", "status": "idle", "progress": 0 }
  ],
  "estimatedTimeRemaining": 120
}
```

### 2.3 HTTP REST — Endpoints Confirmados

**Base URL:** `http://192.168.99.101:80/api`

| Método | Endpoint                       | Request Body                  | Response                       |
|--------|--------------------------------|-------------------------------|--------------------------------|
| GET    | /api/ping                      | -                             | `{ status: "ok" }`            |
| POST   | /api/auth/login                | `{ sn, mac }`                | `{ token }`                    |
| GET    | /api/config/robot/{sn}         | -                             | `RobotConfigBean`             |
| GET    | /api/order/pending             | -                             | `List<TaskBean>`               |
| POST   | /api/order/update              | `TaskBean`                    | `{ success }`                  |
| POST   | /api/calibration/request       | `{ sensors: string[] }`       | `CalibrationResponse`          |
| GET    | /api/calibration/progress      | -                             | `CalibrationProgress`          |
| GET    | /api/calibration/data          | -                             | `CalibrationData`              |
| POST   | /api/calibration/reset         | `{ robotSN, timestamp }`      | `CalibrationResponse`          |
| POST   | /api/calibration/export        | -                             | `CalibrationData`              |
| POST   | /api/calibration/import        | `CalibrationData`             | `CalibrationResponse`          |
| POST   | /api/movement/forward          | `{ speed, distance }`         | `{ success }`                  |
| POST   | /api/movement/backward         | `{ speed, distance }`         | `{ success }`                  |
| POST   | /api/movement/rotate           | `{ angle, speed }`            | `{ success }`                  |
| POST   | /api/movement/stop             | -                             | `{ success }`                  |
| POST   | /api/movement/goto             | `{ x, y, theta, speed }`     | `{ success }`                  |
| GET    | /api/sensors/{type}            | -                             | `SensorReading`                |
| GET    | /api/map/download?map_id=      | -                             | Binary (mapa SLAM)             |
| GET    | /api/map/tables                | -                             | `MapAndTableNumberBean`        |
| GET    | /api/enterPage                 | -                             | -                              |
| GET    | /api/getAnswerV3               | -                             | Chat/ASR response              |
| GET    | /api/hardware/info             | -                             | `HardwareBean`                 |
| GET    | /api/update/check?version=     | -                             | `UpdateBean`                   |

### 2.4 Push Tencent (TPNS)

| Evento                  | Direção       | Payload                                    | Reação no App                     |
|-------------------------|---------------|--------------------------------------------|-----------------------------------|
| Novo pedido             | Server→Robot  | `CallBackPushBean { orderId, deskId }`     | Adicionar à fila de delivery      |
| Comando remoto          | Server→Robot  | `{ cmd: 'lock' | 'unlock' | 'reboot' }`   | Executar ação no robô             |
| Broadcast               | Server→Todos  | `{ message, priority }`                    | Exibir alerta em todos os robôs   |
| Update disponível       | Server→Robot  | `UpdateBean { version, downloadUrl }`      | Iniciar download OTA              |

---

## 3. FLUXOS PRINCIPAIS

### 3.1 Conexão Inicial ao Robô

```
1. Usuário ativa hotspot do robô (ou conecta ao WiFi RoboKen_Controle)
2. App detecta gateway 192.168.99.1
3. App testa HTTP: GET http://192.168.99.101:80/api/ping
4. App conecta SLAM: TCP 192.168.99.2:1445
5. App conecta MQTT: ws://192.168.99.101:9001 (ou :1883)
6. App inscreve em tópicos: robot/H13307/#, csjbot/H13307/#
7. App inicia heartbeat: publica robot/H13307/status a cada 5s
8. App recebe pose SLAM e atualiza mapa na UI
```

### 3.2 Ciclo de Delivery

```
1. [IDLE] → Robô publica status IDLE via MQTT
2. [RECEBE PEDIDO] → MQTT: robot/{SN}/task/new (ou Push Tencent)
3. [PREPARING] → HTTP: POST /api/order/update { status: "preparing" }
4. [DELIVERY] → SLAM: goTo(mesa.x, mesa.y, mesa.theta)
   └→ MQTT: publica posição a cada 1s
   └→ Detecção de obstáculos via SLAM
5. [ARRIVED] → MQTT: publica status "arrived"
   └→ TTS: "Seu pedido chegou!"
   └→ Aguarda confirmação (touch/voz)
6. [RETURNING] → SLAM: goTo(base.x, base.y, 0)
7. [IDLE] → Ciclo completo
```

### 3.3 Calibração de Sensores

```
1. App envia: MQTT robot/{SN}/calibration/start { sensors: ['all'] }
   └→ Ou HTTP: POST /api/calibration/request
2. Firmware executa máquina de estados:
   IDLE → IMU_INIT → IMU_RUNNING → MAG_INIT → MAG_RUNNING → ...
3. Firmware publica progresso: MQTT robot/{SN}/calibration/progress
4. App exibe barra de progresso em tempo real
5. Firmware publica resultado: MQTT robot/{SN}/calibration/complete
6. Dados salvos em EEPROM (magic: 0xCAFEBABE)
```

---

## 4. AVALIAÇÃO DE VIABILIDADE DE MIGRAÇÃO

### 4.1 Base de Sucesso ✅

| Aspecto                    | Status | Justificativa                                                    |
|----------------------------|--------|------------------------------------------------------------------|
| Contratos MQTT             | ✅ 1:1 | Tópicos e payloads JSON são reutilizáveis diretamente            |
| HTTP REST API              | ✅ 1:1 | Endpoints compatíveis com fetch() do browser                     |
| Modelo de dados (DTOs)     | ✅ 1:1 | Beans Java → interfaces TypeScript (mapeamento direto)           |
| Máquina de estados         | ✅ 1:1 | robotStateMachine.ts já implementa estados equivalentes          |
| Calibração                 | ✅ 1:1 | calibration_api.ts fornece contrato completo para migração       |
| Command Bridge             | ✅ 1:1 | robotCommandBridge.ts já implementa cascata BT→WS→HTTP          |
| Multi-canal redundante     | ✅     | Sistema já tem 4 canais: BT, WS, HTTP, MQTT                    |

### 4.2 Adaptações Necessárias ⚠️

| Aspecto                    | Risco  | Adaptação Necessária                                             |
|----------------------------|--------|------------------------------------------------------------------|
| SLAM TCP 1445              | ⚠️ Alto | Browser não suporta TCP raw → usar WebSocket proxy ou HTTP polling|
| Push Tencent               | ⚠️ Médio| Substituir por Web Push API ou MQTT retained messages            |
| Mixed Content (HTTPS→WS)   | ⚠️ Médio| WSS :8084/:8883 ou PWA instalado                                |
| APKs embarcados (ASR/Face) | ❌ N/A  | Funcionalidades nativas Android → Web Speech API + MediaDevices  |
| Serial Port (UART)         | ⚠️ Médio| Web Serial API (Chrome only) ou Bluetooth como bridge            |

### 4.3 Riscos Técnicos

1. **SLAM TCP direto é impossível no browser** — Slamware SDK usa TCP :1445 com protocolo binário proprietário. Solução: criar um proxy WebSocket no tablet Android que exponha a API SLAM via WS/HTTP.

2. **Latência MQTT via WebSocket** — A camada WS adiciona ~5-15ms de overhead vs MQTT nativo. Aceitável para controle manual, mas pode impactar navegação autônoma de alta precisão.

3. **Certificados TLS** — WSS requer certificado válido no broker. Em rede local, usar certificado auto-assinado requer configuração manual no browser.

---

## 5. ESTRUTURA PROPOSTA NO LOVABLE

```
src/
├── shared-core/                   # Contratos compartilhados
│   ├── types/
│   │   ├── robot.ts               # RobotStateBean, ChargeBean, HealthBean
│   │   ├── delivery.ts            # TaskBean, DeskBean, DishBean
│   │   ├── slam.ts                # SlamPose, MapData, NavTarget
│   │   ├── calibration.ts         # CalibrationData, CalibrationState
│   │   ├── mqtt.ts                # MQTTMessage, tópicos tipados
│   │   └── api.ts                 # ResponseBean<T>, endpoints
│   └── constants.ts               # IPs, portas, timeouts, magic numbers
│
├── services/
│   ├── RobotMQTTClient.ts         # ✅ Existente — agent-mqtt
│   ├── RobotHTTPClient.ts         # ✅ Existente — agent-http
│   ├── robotCommandBridge.ts      # ✅ Existente — agent-robot-action
│   ├── SlamwareClient.ts          # 🆕 agent-slam (via WS proxy)
│   ├── CalibrationService.ts      # 🆕 API calibração HTTP+MQTT
│   └── DeliveryService.ts         # 🆕 Orquestrador de entregas
│
├── hooks/
│   ├── useMQTT.ts                 # ✅ Existente — singleton MQTT
│   ├── useSlam.ts                 # 🆕 Hook para pose/mapa SLAM
│   └── useCalibration.ts          # ✅ Existente — adaptado
│
├── store/
│   ├── useMQTTConfigStore.ts      # ✅ Existente
│   ├── useRobotStore.ts           # ✅ Existente
│   └── useDeliveryStore.ts        # 🆕 Estado de entregas
│
└── pages/                         # ✅ Existentes + novas
```

### 5.1 Responsabilidades por Módulo

| Módulo                  | Equivalente Original     | Responsabilidade                                    |
|-------------------------|--------------------------|-----------------------------------------------------|
| `RobotMQTTClient.ts`   | `MqttService.java`       | Conexão MQTT, pub/sub, auto-discovery               |
| `RobotHTTPClient.ts`   | `NetApiService.java`     | REST API local (calibração, config, status)          |
| `robotCommandBridge.ts` | `RobotActionAgent`       | Dispatch multi-canal BT→WS→HTTP→MQTT                |
| `SlamwareClient.ts`    | `SlamAgent`              | Comunicação com módulo SLAM (pose, nav, mapa)        |
| `CalibrationService.ts`| `sensor_calibration.c`   | Orquestra calibração via HTTP+MQTT dual-channel      |
| `useMQTT.ts`           | `MqttAgent`              | Singleton hook para acesso global ao broker          |
| `shared-core/types/`   | `bean/` (47 Data Beans)  | DTOs tipados em TypeScript                           |

---

## 6. CONCLUSÃO

A migração da arquitetura de comunicação do Delivery_i18n_amy V5.3.8 para o AlphaBot Companion é **tecnicamente viável** com as seguintes condições:

1. **Reutilização direta (>80%):** Contratos MQTT, endpoints HTTP, DTOs e máquina de estados podem ser migrados quase 1:1.

2. **Adaptação obrigatória:** SLAM TCP→WebSocket proxy; Push Tencent→Web Push/MQTT; funcionalidades nativas Android→Web APIs.

3. **Arquitetura já preparada:** O projeto atual já possui `RobotMQTTClient`, `RobotHTTPClient`, `robotCommandBridge` e `useMQTT` que cobrem 4 dos 6 canais de comunicação identificados.

4. **Próximos passos:** Implementar `SlamwareClient`, `CalibrationService` e tipos compartilhados do `shared-core`.

---

*AlphaBot Companion v2.1.0 • Iascom*
