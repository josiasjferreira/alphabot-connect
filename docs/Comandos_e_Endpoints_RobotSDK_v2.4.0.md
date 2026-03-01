# Comandos e Endpoints - RobotSDK v2.4.0

## 1. Endpoints HTTP/HTTPS

### Base URLs
```
https://bdpro.csjbot.com:8443/          (Servidor padrão)
https://awscloud.csjbot.com:8443/       (Servidor i18n)
https://www.csjbot.com:8443/            (Download)
```

### Endpoints Conhecidos

#### Logging e Eventos
```
POST /csjbot-service/api/androidLog/event
Query Parameters:
  - eventId: string (identificador do evento)
Request Body:
  - JSON com dados do evento
Response:
  - HTTP 200 OK com ResponseBody
```

#### Download de Arquivos
```
GET /[url]
Streaming: true
Response:
  - Arquivo binário (GIF, APK, etc.)
```

#### Publicação MQTT via HTTP
```
POST /[endpoint]
Request Body:
  - Mensagem MQTT
Response:
  - Status de publicação
```

---

## 2. Tópicos MQTT

### Estrutura de Tópicos
```
robot/
├── camera/
│   ├── start
│   ├── stop
│   ├── frame
│   └── status
├── audio/
│   ├── play
│   ├── tts
│   ├── record
│   └── status
├── motion/
│   ├── cmd
│   ├── gesture
│   ├── status
│   └── feedback
├── sensors/
│   ├── imu
│   ├── distance
│   ├── touch
│   └── telemetry
├── status
└── telemetry
```

### Tópicos de Câmera
```
robot/camera/start
  Payload: {"resolution": "1920x1080", "fps": 30}
  Descrição: Iniciar captura de câmera

robot/camera/stop
  Payload: {}
  Descrição: Parar captura de câmera

robot/camera/frame
  Payload: {"data": "base64_encoded_image", "timestamp": 1234567890}
  Descrição: Frame de câmera (publicado pelo robô)

robot/camera/status
  Payload: {"connected": true, "fps": 30, "resolution": "1920x1080"}
  Descrição: Status da câmera (publicado pelo robô)
```

### Tópicos de Áudio
```
robot/audio/play
  Payload: {"text": "Olá", "language": "pt-BR", "speed": 1.0}
  Descrição: Reproduzir áudio/TTS

robot/audio/tts
  Payload: {"text": "Texto para síntese", "voice": "default"}
  Descrição: Síntese de fala

robot/audio/record
  Payload: {"duration": 5000, "sampleRate": 16000}
  Descrição: Iniciar gravação de áudio

robot/audio/status
  Payload: {"recording": false, "playing": false, "volume": 80}
  Descrição: Status de áudio (publicado pelo robô)
```

### Tópicos de Movimento
```
robot/motion/cmd
  Payload: {
    "action": "head_left_right|head_up_down|left_hand|right_hand",
    "model": "alice|alicebig",
    "executor": "processor|vip|resident",
    "intensity": 0.5,
    "duration": 1000
  }
  Descrição: Comando de movimento

robot/motion/gesture
  Payload: {
    "gesture": "wave|point|thumbsup|nod",
    "intensity": 0.8
  }
  Descrição: Executar gesto pré-programado

robot/motion/status
  Payload: {"executing": false, "lastAction": "head_left_right", "progress": 100}
  Descrição: Status de movimento (publicado pelo robô)

robot/motion/feedback
  Payload: {"action": "head_left_right", "success": true, "duration": 1200}
  Descrição: Feedback de movimento executado (publicado pelo robô)
```

### Tópicos de Sensores
```
robot/sensors/imu
  Payload: {
    "accel": {"x": 0.1, "y": 0.2, "z": 9.8},
    "gyro": {"x": 0.01, "y": 0.02, "z": 0.03},
    "timestamp": 1234567890
  }
  Descrição: Dados de IMU (publicado pelo robô)

robot/sensors/distance
  Payload: {
    "front": 1.5,
    "left": 2.0,
    "right": 1.8,
    "timestamp": 1234567890
  }
  Descrição: Dados de sensores de distância (publicado pelo robô)

robot/sensors/touch
  Payload: {
    "head": false,
    "left_hand": false,
    "right_hand": true,
    "timestamp": 1234567890
  }
  Descrição: Status de sensores de toque (publicado pelo robô)

robot/sensors/telemetry
  Payload: {
    "battery": 85,
    "temperature": 35.5,
    "cpu_load": 45,
    "memory": 512
  }
  Descrição: Telemetria geral (publicado pelo robô)
```

### Tópicos de Status
```
robot/status
  Payload: {
    "state": "idle|busy|error",
    "uptime": 3600,
    "version": "2.4.0",
    "timestamp": 1234567890
  }
  Descrição: Status geral do robô (publicado pelo robô)

robot/telemetry
  Payload: {
    "camera": {"fps": 30, "connected": true},
    "audio": {"recording": false, "playing": false},
    "motion": {"executing": false},
    "sensors": {"imu": true, "distance": true},
    "network": {"signal": 85, "latency": 45}
  }
  Descrição: Telemetria consolidada (publicado pelo robô)
```

---

## 3. Constantes de Eventos (Câmera)

```
EVENT_PACKET = 0                    // Pacote de dados recebido
EVENT_CONNECT_SUCCESS = 1           // Conexão bem-sucedida
EVENT_CONNECT_TIME_OUT = 2          // Timeout de conexão
EVENT_CONNECT_FAILD = 3             // Falha na conexão
EVENT_DISCONNET = 4                 // Desconectado
EVENT_RECONNECTED = 5               // Reconectado

CONNECT_TIME_OUT = 5000 ms          // Timeout de conexão
HEART_BEAT_INTERVAL = 5 segundos    // Intervalo de heartbeat
SEND_FAILED = 21                    // Falha no envio
DUPLICATE_PIC_ERROR = 1000          // Erro de frame duplicado
```

---

## 4. Estruturas de Dados

### MessagePacket (Câmera)
```java
class MessagePacket {
  int eventType;              // EVENT_PACKET, EVENT_CONNECT_SUCCESS, etc.
  byte[] payload;             // Dados do frame ou comando
  long timestamp;             // Timestamp do pacote
  int sequenceNumber;         // Número de sequência
}
```

### Comando de Movimento
```json
{
  "action": "head_left_right|head_up_down|left_hand|right_hand",
  "model": "alice|alicebig",
  "executor": "processor|vip|resident",
  "intensity": 0.0-1.0,
  "duration": 1000,
  "repeat": 1,
  "delay": 0
}
```

### Dados de IMU
```json
{
  "accel_x": 0.0,
  "accel_y": 0.0,
  "accel_z": 9.8,
  "gyro_x": 0.0,
  "gyro_y": 0.0,
  "gyro_z": 0.0,
  "timestamp": 1234567890,
  "sequence": 1
}
```

### Resposta de Áudio (TTS)
```json
{
  "text": "Olá, como você está?",
  "language": "pt-BR",
  "speed": 1.0,
  "volume": 80,
  "duration": 2500
}
```

---

## 5. Fluxos de Comunicação

### Fluxo de Câmera
```
1. Cliente: Conectar a host:porta
2. Servidor: Enviar EVENT_CONNECT_SUCCESS
3. Servidor: Enviar frames periodicamente (EVENT_PACKET)
4. Cliente: Processar frames
5. Cliente: Enviar heartbeat a cada 5 segundos
6. Servidor: Responder com heartbeat
7. Cliente: Desconectar (EVENT_DISCONNECT)
```

### Fluxo de Movimento via MQTT
```
1. Cliente: Publicar em robot/motion/cmd
   {"action": "head_left_right", "intensity": 0.5}
2. Robô: Receber comando
3. Robô: Executar movimento
4. Robô: Publicar em robot/motion/status (executing: true)
5. Robô: Publicar em robot/motion/feedback (success: true)
6. Cliente: Receber feedback
```

### Fluxo de Áudio via MQTT
```
1. Cliente: Publicar em robot/audio/tts
   {"text": "Olá", "language": "pt-BR"}
2. Robô: Processar com iFlytek AIUI
3. Robô: Gerar áudio (TTS)
4. Robô: Reproduzir áudio
5. Robô: Publicar em robot/audio/status (playing: true)
6. Robô: Publicar em robot/audio/status (playing: false) quando terminar
```

### Fluxo de Sensores via MQTT
```
1. Robô: Ler sensores (IMU, distância, toque)
2. Robô: Publicar em robot/sensors/imu, robot/sensors/distance, etc.
3. Robô: Publicar a cada 100ms (ou conforme configurado)
4. Cliente: Inscrever-se em robot/sensors/+
5. Cliente: Receber dados em tempo real
6. Cliente: Atualizar dashboard
```

---

## 6. Configuração de Conexão

### MQTT
```
Broker: localhost:1883 (padrão) ou configurável
ClientID: robot-controller-web
Username: (opcional)
Password: (opcional)
QoS: 1 (At least once)
KeepAlive: 60 segundos
CleanSession: true
```

### Câmera
```
Host: localhost (ou IP do robô)
Port: 5000 (padrão, configurável)
Timeout: 5000 ms
HeartbeatInterval: 5 segundos
BufferSize: 1024 KB
```

### Áudio
```
SampleRate: 16000 Hz
Channels: 1 (mono)
BitDepth: 16 bits
Bitrate: 128 kbps
Codec: PCM ou MP3
```

---

## 7. Códigos de Erro

### HTTP
```
200 OK                  // Sucesso
400 Bad Request         // Requisição inválida
401 Unauthorized        // Não autorizado
403 Forbidden           // Acesso proibido
404 Not Found           // Recurso não encontrado
500 Internal Error      // Erro interno do servidor
503 Service Unavailable // Serviço indisponível
```

### MQTT
```
0   Connection Accepted
1   Connection Refused - unacceptable protocol version
2   Connection Refused - identifier rejected
3   Connection Refused - Server unavailable
4   Connection Refused - bad user name or password
5   Connection Refused - not authorized
```

### Câmera
```
0   EVENT_PACKET
1   EVENT_CONNECT_SUCCESS
2   EVENT_CONNECT_TIME_OUT
3   EVENT_CONNECT_FAILD
4   EVENT_DISCONNET
5   EVENT_RECONNECTED
21  SEND_FAILED
1000 DUPLICATE_PIC_ERROR
```

---

## 8. Exemplo de Implementação (JavaScript)

### Cliente MQTT
```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'robot-controller-web',
  keepalive: 60,
  clean: true
});

client.on('connect', () => {
  console.log('Conectado ao broker MQTT');
  client.subscribe('robot/+/+', (err) => {
    if (!err) {
      console.log('Inscrito em tópicos do robô');
    }
  });
});

client.on('message', (topic, message) => {
  console.log(`Mensagem recebida em ${topic}:`, message.toString());
});

// Enviar comando de movimento
function moveRobot(action, intensity = 0.5) {
  const payload = JSON.stringify({
    action: action,
    model: 'alice',
    executor: 'processor',
    intensity: intensity
  });
  client.publish('robot/motion/cmd', payload);
}

// Enviar comando de áudio
function speakRobot(text, language = 'pt-BR') {
  const payload = JSON.stringify({
    text: text,
    language: language,
    speed: 1.0
  });
  client.publish('robot/audio/tts', payload);
}
```

### Conexão com Câmera
```javascript
const net = require('net');

const socket = new net.Socket();
socket.connect(5000, 'localhost', () => {
  console.log('Conectado ao servidor de câmera');
});

socket.on('data', (data) => {
  // Processar MessagePacket
  const eventType = data.readUInt32LE(0);
  const payload = data.slice(4);
  
  if (eventType === 1) { // EVENT_CONNECT_SUCCESS
    console.log('Câmera conectada com sucesso');
  } else if (eventType === 0) { // EVENT_PACKET
    // Processar frame de vídeo
    processFrame(payload);
  }
});

socket.on('error', (err) => {
  console.error('Erro na conexão com câmera:', err);
});

socket.on('close', () => {
  console.log('Desconectado do servidor de câmera');
});
```

---

## 9. Checklist de Integração

- [ ] Configurar conexão MQTT
- [ ] Implementar cliente de câmera (NIO)
- [ ] Implementar captura de áudio (Web Audio API)
- [ ] Criar interface de controle de movimentos
- [ ] Criar dashboard de sensores
- [ ] Implementar reconexão automática
- [ ] Adicionar logging e debug
- [ ] Testar latência e performance
- [ ] Implementar tratamento de erros
- [ ] Adicionar autenticação
- [ ] Documentar API
- [ ] Testar com robô real

---

**Fim da Documentação de Comandos e Endpoints**
