# 📘 Guia Completo: Conexão Bluetooth com o Robô CT300

**AlphaBot Companion v1.2.4 • Iascom**  
**Última atualização:** 2026-02-18

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Modos de Conexão](#3-modos-de-conexão)
4. [Passo a Passo: Conexão via APK (Android Nativo)](#4-passo-a-passo-conexão-via-apk-android-nativo)
5. [Passo a Passo: Conexão via Navegador (Web Bluetooth)](#5-passo-a-passo-conexão-via-navegador-web-bluetooth)
6. [Protocolo de Comunicação](#6-protocolo-de-comunicação)
7. [Leitura de Sensores](#7-leitura-de-sensores)
8. [Diagnóstico e Troubleshooting](#8-diagnóstico-e-troubleshooting)
9. [Limitações Conhecidas](#9-limitações-conhecidas)
10. [Próximos Passos](#10-próximos-passos)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────┐        ┌─────────────────────────┐
│  Tablet/Celular     │        │  Robô CT300             │
│                     │        │                         │
│  AlphaBot App       │◄──────►│  Controlador Principal  │
│  (Capacitor/Web)    │   BT   │  (Microcontrolador)     │
│                     │  SPP   │                         │
│  ┌───────────────┐  │  ou    │  ┌───────────────────┐  │
│  │ useBluetoothSerial│  BLE   │  │ Sensores:         │  │
│  │ (hook)        │  │        │  │ - LiDAR           │  │
│  └───────────────┘  │        │  │ - IMU             │  │
│                     │        │  │ - Ultrassônico    │  │
│  ┌───────────────┐  │        │  │ - Bateria         │  │
│  │ robotCommand  │  │        │  │ - Temperatura     │  │
│  │ Bridge        │  │        │  └───────────────────┘  │
│  └───────────────┘  │        │                         │
└─────────────────────┘        └─────────────────────────┘
```

### Canais de Comunicação (por prioridade)

| Prioridade | Canal | Latência | Uso Principal |
|------------|-------|----------|---------------|
| 1 (mais alta) | **Bluetooth SPP** | ~10-50ms | Controle de motores, leitura de sensores |
| 2 | **WebSocket** | ~50-200ms | Streaming de vídeo, telemetria |
| 3 (fallback) | **HTTP REST** | ~200-500ms | Configuração, status, fallback |

---

## 2. Pré-requisitos

### No Tablet/Celular

- [ ] Android 7.0+ (API 24+) ou navegador Chrome 56+
- [ ] Bluetooth ativado nas configurações do sistema
- [ ] Localização ativada (obrigatório no Android para scan Bluetooth)
- [ ] App AlphaBot instalado (APK) **OU** acesso via Chrome ao app web
- [ ] Permissões concedidas:
  - `Bluetooth` (pareamento e conexão)
  - `Localização` (descoberta de dispositivos)
  - `Nearby Devices` (Android 12+)

### No Robô CT300

- [ ] Robô ligado e módulo Bluetooth ativo
- [ ] Identificar o **nome Bluetooth** do robô (ex: `CT300-H13307`, `HC-05`, `ESP32-BT`)
- [ ] Identificar o **endereço MAC** do módulo BT (ex: `00:1A:7D:DA:71:13`)
- [ ] Saber o **tipo de módulo** Bluetooth instalado:
  - **HC-05/HC-06**: SPP clássico (mais comum em robôs)
  - **ESP32**: SPP + BLE dual-mode
  - **nRF52**: BLE UART (Nordic UART Service)
  - **Módulo proprietário**: verificar documentação do fabricante

---

## 3. Modos de Conexão

### Modo A: SPP (Serial Port Profile) — **RECOMENDADO**

- **Quando usar**: App instalado via APK no tablet do robô
- **Vantagem**: Comunicação serial robusta, bidirecional, sem limitação de tamanho de pacote
- **Plugin**: `@e-is/capacitor-bluetooth-serial`
- **Requisito**: Dispositivo previamente pareado nas configurações do Android

### Modo B: BLE UART (Bluetooth Low Energy)

- **Quando usar**: Acesso via navegador Chrome (Web Bluetooth API)
- **Vantagem**: Não precisa de APK, funciona em qualquer Chrome desktop/mobile
- **Limitação**: Pacotes limitados a 20 bytes por write, requer chunking
- **Serviços suportados**:
  - Nordic UART Service: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
  - Generic Serial: `0000ffe0-0000-1000-8000-00805f9b34fb`

---

## 4. Passo a Passo: Conexão via APK (Android Nativo — SPP)

Este é o método **recomendado** para o tablet embarcado do robô.

### 4.1. Parear o Dispositivo no Android

1. Abra **Configurações** → **Bluetooth** no tablet
2. Certifique-se de que o Bluetooth está **LIGADO**
3. Toque em **"Parear novo dispositivo"** (ou "Buscar dispositivos")
4. Na lista, localize o nome do módulo BT do robô (ex: `CT300-H13307`)
5. Toque no nome para parear
6. Se solicitado, insira o PIN:
   - HC-05/HC-06: PIN padrão é `1234` ou `0000`
   - ESP32: normalmente sem PIN
   - Módulo proprietário: consulte documentação
7. Confirme que o status mudou para **"Pareado"** ✓

> ⚠️ **IMPORTANTE**: O pareamento no Android é obrigatório para SPP. O app não consegue parear automaticamente — isso é uma restrição do sistema operacional.

### 4.2. Conectar pelo App AlphaBot

1. Abra o app **AlphaBot Companion**
2. Navegue até a tela **Controle** (ícone de joystick) ou **Diagnósticos**
3. Toque no botão **"Conectar Bluetooth"** (ícone BT azul)
4. O app tentará automaticamente:
   - Detectar o plugin SPP nativo ✓
   - Listar dispositivos pareados ✓
   - Conectar ao primeiro dispositivo encontrado
5. Observe o status no cabeçalho:
   - 🔵 **Scanning**: Buscando dispositivos...
   - 🟡 **Paired**: Pareado, estabelecendo canal serial...
   - 🟢 **Connected**: Conectado e pronto para enviar comandos ✓
   - 🔴 **Error**: Falha na conexão

### 4.3. Verificar a Conexão

1. Vá para a tela **Robot Connection Scanner** (menu → Scanner)
2. Na aba **Bluetooth**, toque **"Listar Dispositivos SPP"**
3. Você verá a lista de dispositivos pareados com status
4. Toque **"Testar Conexão"** no dispositivo desejado
5. O app enviará `PING\n` e aguardará resposta
6. Resultado esperado:
   - ✅ `PONG` ou resposta JSON → Comunicação funcionando
   - ⚠️ `Conectado, sem resposta` → Conexão OK, mas robô não respondeu
   - ❌ `Erro` → Verificar se o robô está com BT ativo

### 4.4. Testar Envio de Comandos

1. Vá para a tela **Controle** (joystick)
2. Com a conexão ativa (status verde), mova o joystick
3. O app envia comandos JSON via serial:
```json
{"type":"move","angle":45,"speed":50,"rotation":0,"timestamp":1708300000000}
```
4. Para parar: solte o joystick → envia `{"type":"stop",...}`
5. Botão vermelho de emergência → envia `{"type":"emergency_stop",...}`

---

## 5. Passo a Passo: Conexão via Navegador (Web Bluetooth — BLE)

Use este método quando não tiver o APK instalado.

### 5.1. Requisitos do Navegador

- **Chrome 56+** (desktop ou Android)
- **Edge 79+**
- ❌ **Safari**: NÃO suporta Web Bluetooth
- ❌ **Firefox**: NÃO suporta Web Bluetooth
- Habilitar flag se necessário: `chrome://flags/#enable-web-bluetooth`

### 5.2. Conectar pelo Navegador

1. Acesse o app via URL: `https://tele-bot-companion.lovable.app`
2. Navegue até **Controle** ou **Diagnósticos**
3. Toque em **"Conectar Bluetooth"**
4. O Chrome exibirá um **popup nativo de seleção de dispositivo**:
   ```
   ┌──────────────────────────────┐
   │ Escolher dispositivo BLE    │
   │                              │
   │  📱 CT300-H13307             │
   │  📱 ESP32-Robot              │
   │  📱 Dispositivo BLE         │
   │                              │
   │  [Cancelar]  [Conectar]     │
   └──────────────────────────────┘
   ```
5. Selecione o dispositivo do robô
6. O app tentará:
   - Conectar ao GATT server
   - Descobrir serviço UART (Nordic ou Generic Serial)
   - Estabelecer canal TX/RX para comunicação bidirecional

### 5.3. Limitações do Web Bluetooth

| Aspecto | SPP (APK) | BLE (Navegador) |
|---------|-----------|------------------|
| Pareamento | Via Android Settings | Via popup do Chrome |
| Reconexão automática | ✅ Sim | ❌ Requer gesto do usuário |
| Tamanho do pacote | Ilimitado | 20 bytes (MTU padrão) |
| Velocidade | ~115200 baud | ~20 bytes/intervalo |
| Streaming contínuo | ✅ Sim | ⚠️ Com chunking |
| Funciona offline | ✅ Sim | ❌ Precisa de HTTPS |

---

## 6. Protocolo de Comunicação

### 6.1. Formato dos Comandos (App → Robô)

Todos os comandos são JSON terminados por `\n` (newline):

```json
// Movimento
{"type":"move","angle":90,"speed":75,"rotation":0,"timestamp":1708300000000}

// Parar
{"type":"stop","angle":0,"speed":0,"rotation":0,"timestamp":1708300000001}

// Parada de emergência
{"type":"emergency_stop","timestamp":1708300000002}

// Solicitar status
{"type":"status_request","timestamp":1708300000003}

// Ir para coordenada (delivery)
{"type":"goto","x":50,"y":75,"speed":30,"timestamp":1708300000004}

// Retornar à base
{"type":"goto_base","timestamp":1708300000005}

// Controle de LED
{"type":"led","color":"green","pattern":"solid","timestamp":1708300000006}
```

### 6.2. Formato das Respostas (Robô → App)

O robô deve responder em JSON terminado por `\n`:

```json
// Status dos sensores
{
  "battery": 85,
  "temperature": 42.5,
  "x": 12.5,
  "y": 34.2,
  "theta": 1.57,
  "speed": 0.5,
  "lidar_dist": [120, 250, 400, 180],
  "imu_accel": [0.01, -0.02, 9.81],
  "ultrasonic": [30, 45, 60],
  "motor_status": "ok",
  "timestamp": 1708300000100
}

// Confirmação de comando
{"ack":"move","status":"ok","timestamp":1708300000101}

// Erro
{"error":"motor_fault","code":503,"timestamp":1708300000102}
```

### 6.3. Implementação no Microcontrolador (Exemplo Arduino/ESP32)

```cpp
// Exemplo para ESP32 com BluetoothSerial
#include "BluetoothSerial.h"
#include <ArduinoJson.h>

BluetoothSerial SerialBT;

void setup() {
  Serial.begin(115200);
  SerialBT.begin("CT300-H13307"); // Nome que aparece no scan
  Serial.println("Bluetooth SPP iniciado. Aguardando conexão...");
}

void loop() {
  if (SerialBT.available()) {
    String line = SerialBT.readStringUntil('\n');
    
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, line);
    
    if (err) {
      SerialBT.println("{\"error\":\"invalid_json\"}");
      return;
    }
    
    const char* type = doc["type"];
    
    if (strcmp(type, "move") == 0) {
      int angle = doc["angle"];
      int speed = doc["speed"];
      int rotation = doc["rotation"];
      // Acionar motores aqui
      moverRobo(angle, speed, rotation);
      SerialBT.println("{\"ack\":\"move\",\"status\":\"ok\"}");
      
    } else if (strcmp(type, "stop") == 0) {
      pararMotores();
      SerialBT.println("{\"ack\":\"stop\",\"status\":\"ok\"}");
      
    } else if (strcmp(type, "emergency_stop") == 0) {
      paradaEmergencia();
      SerialBT.println("{\"ack\":\"emergency_stop\",\"status\":\"ok\"}");
      
    } else if (strcmp(type, "status_request") == 0) {
      enviarStatusSensores();
      
    } else if (strcmp(type, "goto") == 0) {
      float x = doc["x"];
      float y = doc["y"];
      navegarPara(x, y);
      SerialBT.println("{\"ack\":\"goto\",\"status\":\"ok\"}");
    }
  }
  
  // Enviar telemetria periodicamente (1Hz)
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry >= 1000) {
    enviarStatusSensores();
    lastTelemetry = millis();
  }
}

void enviarStatusSensores() {
  StaticJsonDocument<512> doc;
  doc["battery"] = lerBateria();        // 0-100
  doc["temperature"] = lerTemperatura(); // °C
  doc["x"] = getPosX();                 // metros
  doc["y"] = getPosY();                 // metros
  doc["theta"] = getOrientacao();       // radianos
  doc["speed"] = getVelocidade();       // m/s
  
  // Array de distâncias LiDAR (cm)
  JsonArray lidar = doc.createNestedArray("lidar_dist");
  lidar.add(lerLidar(0));
  lidar.add(lerLidar(90));
  lidar.add(lerLidar(180));
  lidar.add(lerLidar(270));
  
  doc["timestamp"] = millis();
  
  String output;
  serializeJson(doc, output);
  SerialBT.println(output);
}
```

---

## 7. Leitura de Sensores

### 7.1. Como o App Recebe Dados dos Sensores

```
Robô (ESP32/Arduino)              App (AlphaBot)
       │                                │
       │ ── JSON via BT Serial ──────►  │
       │    {"battery":85,"x":12.5,...}  │
       │                                │
       │                    useBluetoothSerial.ts
       │                    ├─ SPP: readUntil('\n')
       │                    └─ BLE: characteristicvaluechanged
       │                                │
       │                    JSON.parse(data)
       │                                │
       │                    useRobotStore → updateStatus()
       │                                │
       │                    UI atualiza automaticamente
       │                    (bateria, temp, posição, etc.)
```

### 7.2. Dados Atualmente Suportados pelo App

| Sensor | Campo JSON | Tipo | Onde aparece no App |
|--------|-----------|------|---------------------|
| Bateria | `battery` | number (0-100) | Telemetria, StatusHeader |
| Temperatura | `temperature` | number (°C) | Telemetria |
| Posição X | `x` | number (metros) | Mapa 2D, Delivery |
| Posição Y | `y` | number (metros) | Mapa 2D, Delivery |
| Orientação | `theta` | number (rad) | Mapa 2D |
| Velocidade | `speed` | number (m/s) | Telemetria |
| LiDAR | `lidar_dist` | number[] (cm) | Telemetria |
| IMU | `imu_accel` | number[3] | Telemetria |
| Ultrassônico | `ultrasonic` | number[] (cm) | Telemetria |
| Status Motor | `motor_status` | string | Diagnósticos |

---

## 8. Diagnóstico e Troubleshooting

### 8.1. Problemas Comuns

#### ❌ "Nenhum dispositivo encontrado"

**Causa**: Bluetooth ou Localização desativados  
**Solução**:
1. Verifique: Configurações → Bluetooth → **LIGADO**
2. Verifique: Configurações → Localização → **LIGADA** (obrigatório no Android)
3. No Android 12+: Configurações → Apps → AlphaBot → Permissões → **"Dispositivos próximos"** → Permitir

#### ❌ "Plugin SPP indisponível"

**Causa**: Usando o navegador web em vez do APK  
**Solução**:
1. O SPP só funciona no app instalado via APK
2. No navegador, use BLE (Web Bluetooth)
3. Para instalar o APK: compile com `npm run build && npx cap sync android`

#### ❌ "GATT indisponível" ou "Conexão recusada"

**Causa**: Módulo BT do robô não suporta BLE UART  
**Solução**:
1. Módulos HC-05/HC-06 são **somente SPP** — não funcionam via Web Bluetooth
2. Use o APK para conexão SPP
3. Ou troque para um módulo ESP32 ou nRF52 que suporte BLE

#### ❌ "Conectado, sem resposta"

**Causa**: Robô conectado mas não responde ao protocolo JSON  
**Solução**:
1. Verifique se o firmware do robô implementa o protocolo JSON descrito na seção 6
2. Use o **Scanner de Conexão** no app para enviar `PING` e ver a resposta bruta
3. Se o robô usa outro protocolo, adapte o `encodeCommand()` no hook

#### ❌ Joystick não move o robô

**Causa**: Comandos sendo enviados mas robô não os processa  
**Solução**:
1. Verifique o status BT no cabeçalho: deve estar **verde** (Connected)
2. Verifique nos logs do app: `BT CMD [offline]` = sem conexão ativa
3. Use o Scanner para testar envio manual de `{"type":"move","angle":0,"speed":50,"rotation":0,"timestamp":0}`
4. No lado do robô, verifique o Serial Monitor para confirmar recebimento

### 8.2. Ferramentas de Diagnóstico no App

| Tela | O que testar |
|------|-------------|
| **Robot Connection Scanner** → Bluetooth | Listar pareados, testar PING |
| **Diagnósticos** | Status geral, logs em tempo real |
| **Telemetria** | Dados dos sensores sendo recebidos |
| **Delivery Flow Test** | Fluxo E2E com modo real |
| **MQTT Monitor** | Mensagens MQTT (se aplicável) |

---

## 9. Limitações Conhecidas

### 9.1. O que funciona HOJE

- ✅ Pareamento e conexão SPP (via APK)
- ✅ Pareamento e conexão BLE UART (via Chrome)
- ✅ Envio de comandos JSON (move, stop, emergency_stop)
- ✅ Recepção de dados de sensores (battery, temperature, position)
- ✅ Reconexão ao último dispositivo salvo
- ✅ Scanner de diagnóstico com teste de PING
- ✅ Mapa 2D com posição real (quando dados são recebidos)

### 9.2. O que falta implementar

- ❌ **Áudio bidirecional via Bluetooth**: BT SPP/BLE não tem banda para streaming de áudio. Necessário usar WiFi (WebSocket/WebRTC) para áudio
- ❌ **Vídeo via Bluetooth**: Impossível — largura de banda insuficiente. Usar WebSocket para streaming de câmera MJPEG
- ❌ **Calibração automática de sensores**: Requer implementação no firmware do robô
- ❌ **OTA via Bluetooth**: Update de firmware requer implementação DFU no módulo BLE

### 9.3. Áudio e Vídeo — Caminho Correto

```
ÁUDIO (bidirecional):
  Tablet ◄──── WiFi (WebSocket/WebRTC) ────► Robô
  - Microfone do tablet → robô (comandos de voz)
  - Alto-falante do robô → tablet (feedback)
  - NÃO usar Bluetooth para áudio streaming

VÍDEO (câmera do robô):  
  Tablet ◄──── WiFi (WebSocket MJPEG) ────► Robô
  - Câmera do robô → tablet (visualização)
  - Endereço típico: ws://192.168.99.2:9090
  - NÃO usar Bluetooth para vídeo
```

---

## 10. Próximos Passos

### Para fazer o robô se mover via app:

1. **No firmware do robô**: Implementar o parser JSON descrito na seção 6.3
2. **Parear**: Seguir os passos da seção 4.1
3. **Conectar**: Seguir os passos da seção 4.2
4. **Testar**: Usar o Scanner para enviar PING e verificar resposta
5. **Controlar**: Usar o joystick na tela de Controle

### Para áudio e vídeo:

1. **WiFi**: Garantir que tablet e robô estão na mesma rede (ex: 192.168.99.x)
2. **WebSocket**: Configurar endpoint de vídeo no robô (ex: `ws://192.168.99.2:9090`)
3. **Áudio**: Implementar WebRTC ou WebSocket para streaming de voz

---

## Resumo Rápido

```
┌─────────────────────────────────────────────────┐
│           CHECKLIST DE CONEXÃO RÁPIDA           │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Ligar Bluetooth no tablet         [  ]      │
│  2. Ligar Localização no tablet       [  ]      │
│  3. Parear robô nas Configurações     [  ]      │
│  4. Abrir AlphaBot app                [  ]      │
│  5. Tocar "Conectar Bluetooth"        [  ]      │
│  6. Aguardar status VERDE             [  ]      │
│  7. Testar com Scanner → PING        [  ]      │
│  8. Usar joystick para mover          [  ]      │
│                                                 │
│  BT = Controle + Sensores (JSON serial)         │
│  WiFi = Áudio + Vídeo (WebSocket/WebRTC)        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

*Documento gerado por AlphaBot Companion v1.2.4 • Iascom*
