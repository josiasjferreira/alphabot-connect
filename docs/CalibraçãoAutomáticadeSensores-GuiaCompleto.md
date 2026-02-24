# Calibração Automática de Sensores - Guia Completo
## CSJBot - Implementação Firmware + API

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Sensores Calibrados](#sensores-calibrados)
4. [Implementação Firmware](#implementação-firmware)
5. [API REST e MQTT](#api-rest-e-mqtt)
6. [Testes e Validação](#testes-e-validação)
7. [Integração com Aplicativo](#integração-com-aplicativo)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

### Objetivo
Implementar sistema automático de calibração de sensores que:
- ✅ Calibra automaticamente todos os sensores
- ✅ Persiste dados em EEPROM
- ✅ Monitora desvio contínuo
- ✅ Fornece interface HTTP + MQTT
- ✅ Valida calibração automaticamente

### Benefícios
- 🎯 Melhor precisão de navegação
- 🎯 Reduz erros de odometria
- 🎯 Detecta problemas de hardware
- 🎯 Aumenta confiabilidade
- 🎯 Facilita manutenção

### Tempo de Implementação
- Firmware: 4-6 horas
- API: 2-3 horas
- Testes: 2-3 horas
- **Total: 8-12 horas**

---

## 🏗️ ARQUITETURA

```
┌─────────────────────────────────────────────────────────────┐
│                    APLICATIVO (TypeScript)                  │
│  CalibrationClient → HTTP/MQTT → Monitorar Progresso       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    ROBÔ (Firmware C)                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  HTTP REST API                                          ││
│  │  - /api/calibration/request                            ││
│  │  - /api/calibration/progress                           ││
│  │  - /api/calibration/data                               ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  MQTT Topics                                            ││
│  │  - robot/{sn}/calibration/progress                     ││
│  │  - robot/{sn}/calibration/complete                     ││
│  │  - robot/{sn}/calibration/error                        ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Calibration Engine (sensor_calibration.c)             ││
│  │  - Máquina de estados                                  ││
│  │  - Algoritmos de calibração                            ││
│  │  - Validação                                           ││
│  │  - Monitoramento de desvio                             ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Persistência (EEPROM)                                 ││
│  │  - SensorCalibration_t (struct)                        ││
│  │  - Backup automático                                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 SENSORES CALIBRADOS

### 1. IMU (Acelerômetro + Giroscópio)
```
Função: Detecção de movimento e orientação
Calibração: Bias e escala
Tempo: ~2 minutos (100 amostras)
Validação: Desvio padrão < 0.5 m/s²
```

### 2. Magnetômetro (Bússola)
```
Função: Orientação absoluta
Calibração: Offset e escala (3-eixos)
Tempo: ~30 segundos (rotação 360°)
Validação: Escala 0.5-2.0
```

### 3. Odômetro (Encoders)
```
Função: Medição de distância
Calibração: Pulsos por metro
Tempo: ~1 minuto (movimento 1m)
Validação: Erro < 15% entre rodas
```

### 4. LiDAR (Sensor de Distância)
```
Função: Detecção de obstáculos
Calibração: Offset de distância
Tempo: ~1 minuto (50 amostras)
Validação: Offset < 100mm
```

### 5. Câmera (Visão Computacional)
```
Função: Localização visual
Calibração: Parâmetros intrínsecos
Tempo: ~30 segundos
Validação: Focal length 100-1000px
```

### 6. Bateria
```
Função: Monitoramento de energia
Calibração: Offset de voltagem
Tempo: ~10 segundos
Validação: Offset < 1V
```

### 7. Temperatura
```
Função: Monitoramento térmico
Calibração: Offset de temperatura
Tempo: ~10 segundos
Validação: Offset < 5°C
```

---

## 💻 IMPLEMENTAÇÃO FIRMWARE

### Passo 1: Adicionar Arquivos

```bash
# Copiar arquivos para projeto firmware
cp sensor_calibration.h firmware/include/
cp sensor_calibration.c firmware/src/
```

### Passo 2: Integrar no Build

**CMakeLists.txt:**
```cmake
# Adicionar calibração
target_sources(firmware PRIVATE
  src/sensor_calibration.c
)

target_include_directories(firmware PRIVATE
  include
)
```

### Passo 3: Inicializar no Main

**main.c:**
```c
#include "sensor_calibration.h"

int main(void) {
  // ... inicialização de hardware ...
  
  // Inicializar calibração
  calibration_init();
  
  // Loop principal
  while (1) {
    // ... outras tarefas ...
    
    // Atualizar máquina de estados de calibração
    calibration_update();
    
    delay_ms(100);
  }
  
  return 0;
}
```

### Passo 4: Implementar Funções Auxiliares

**sensor_drivers.c:**
```c
// Implementar funções de leitura de sensores
bool read_imu_raw(IMUData_t *imu_data) {
  // Ler do IMU via I2C/SPI
  // Preencher estrutura
  // Retornar true se sucesso
}

bool read_magnetometer_raw(MagData_t *mag_data) {
  // Ler do magnetômetro
}

// ... outras funções ...
```

### Passo 5: Compilar e Testar

```bash
# Compilar
make clean && make

# Fazer upload
make upload

# Verificar logs
miniterm.py /dev/ttyUSB0 115200
```

---

## 🌐 API REST E MQTT

### Passo 1: Implementar Endpoints HTTP

**firmware/http_handlers.c:**
```c
// GET /api/calibration/data
void handle_get_calibration_data(HttpRequest *req, HttpResponse *res) {
  const SensorCalibration_t *calib = get_calibration_data();
  
  // Serializar para JSON
  json_object_t json = json_create_object();
  json_add_number(json, "status", calib->status);
  json_add_number(json, "imuBiasX", calib->imu_bias_x);
  // ... adicionar outros campos ...
  
  http_send_json(res, json);
}

// POST /api/calibration/request
void handle_request_calibration(HttpRequest *req, HttpResponse *res) {
  request_calibration();
  
  json_object_t json = json_create_object();
  json_add_bool(json, "success", true);
  json_add_string(json, "message", "Calibration requested");
  
  http_send_json(res, json);
}

// ... outros endpoints ...
```

### Passo 2: Registrar Rotas

**firmware/http_server.c:**
```c
void setup_calibration_routes(HttpServer *server) {
  http_register_handler(server, "GET", "/api/calibration/data", 
                       handle_get_calibration_data);
  http_register_handler(server, "POST", "/api/calibration/request",
                       handle_request_calibration);
  http_register_handler(server, "GET", "/api/calibration/progress",
                       handle_get_calibration_progress);
  http_register_handler(server, "GET", "/api/calibration/state",
                       handle_get_calibration_state);
  // ... outros handlers ...
}
```

### Passo 3: Publicar Tópicos MQTT

**firmware/mqtt_publisher.c:**
```c
void publish_calibration_progress(void) {
  const SensorCalibration_t *calib = get_calibration_data();
  CalibrationState_t state = get_calibration_state();
  
  // Criar JSON
  json_object_t json = json_create_object();
  json_add_number(json, "state", state);
  json_add_string(json, "stateString", 
                 CalibrationClient.stateToString(state));
  // ... adicionar progresso ...
  
  // Publicar
  mqtt_publish(mqtt_client, 
              "robot/SN/calibration/progress",
              json_to_string(json));
}
```

---

## 🧪 TESTES E VALIDAÇÃO

### Teste 1: Compilação
```bash
make clean && make
# Verificar se compila sem erros
```

### Teste 2: Inicialização
```
Conectar via serial e verificar:
✓ Initializing sensor calibration system
✓ Calibration system ready
```

### Teste 3: Calibração Básica
```bash
# Usar CalibrationClient TypeScript
const client = new CalibrationClient('SN', '192.168.99.1', '192.168.99.1');
await client.connect();
await client.requestCalibration();
```

### Teste 4: Validação de Dados
```bash
# Executar suite de testes
npm run test:calibration

# Verificar:
✓ TEST 1: Initial State Check
✓ TEST 2: Request Calibration
✓ TEST 3: Monitor Progress
✓ TEST 4: Validate Calibration Data
✓ TEST 5: Check Persistence
✓ TEST 6: Test Reset
✓ TEST 7: Test Import/Export
✓ TEST 8: Test Individual Sensors
✓ TEST 9: Test Drift Monitoring
✓ TEST 10: Test Error Recovery
```

---

## 🔌 INTEGRAÇÃO COM APLICATIVO

### Passo 1: Instalar Cliente

```bash
npm install mqtt axios
```

### Passo 2: Usar CalibrationClient

**src/services/calibrationService.ts:**
```typescript
import { CalibrationClient } from './calibration_api';

export class CalibrationService {
  private client: CalibrationClient;
  
  async initialize(robotSN: string, robotIP: string) {
    this.client = new CalibrationClient(robotSN, robotIP, robotIP);
    await this.client.connect();
  }
  
  async startCalibration() {
    const response = await this.client.requestCalibration();
    
    this.client.onProgress((progress) => {
      // Atualizar UI
      this.updateProgress(progress);
    });
    
    this.client.onComplete((data) => {
      // Calibração completa
      this.onCalibrationComplete(data);
    });
  }
}
```

### Passo 3: UI para Calibração

**src/components/CalibrationPanel.tsx:**
```typescript
export function CalibrationPanel() {
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState('');
  
  const handleStartCalibration = async () => {
    await calibrationService.startCalibration();
  };
  
  return (
    <div className="calibration-panel">
      <h2>Sensor Calibration</h2>
      <button onClick={handleStartCalibration}>
        Start Calibration
      </button>
      <ProgressBar value={progress} />
      <p>State: {state}</p>
    </div>
  );
}
```

---

## 🔧 TROUBLESHOOTING

### Problema: "Calibration request failed"
```
❌ Erro: HTTP 500 ou timeout
✅ Solução:
  1. Verificar se robô está online
  2. Verificar IP e porta
  3. Verificar firewall
  4. Verificar logs do robô
```

### Problema: "IMU calibration failed"
```
❌ Erro: Desvio padrão alto
✅ Solução:
  1. Colocar robô em superfície plana
  2. Deixar imóvel por 30 segundos
  3. Verificar se IMU está solto
  4. Verificar conexão I2C/SPI
```

### Problema: "Odometer calibration error"
```
❌ Erro: Erro > 15% entre rodas
✅ Solução:
  1. Verificar se rodas estão alinhadas
  2. Verificar se encoders estão funcionando
  3. Limpar rodas de sujeira
  4. Calibrar novamente
```

### Problema: "Calibration data invalid"
```
❌ Erro: Status = INVALID
✅ Solução:
  1. Resetar calibração
  2. Executar calibração completa novamente
  3. Verificar EEPROM
  4. Verificar se dados não foram corrompidos
```

### Problema: "Timeout durante calibração"
```
❌ Erro: Calibração não completa em tempo
✅ Solução:
  1. Aumentar timeout em CalibrationClient
  2. Verificar se sensores estão respondendo
  3. Verificar carga do processador
  4. Verificar se há tarefas bloqueantes
```

---

## 📊 MONITORAMENTO

### Verificar Status

```bash
# Via HTTP
curl http://192.168.99.1/api/calibration/state

# Via MQTT
mosquitto_sub -h 192.168.99.1 -t "robot/+/calibration/progress"
```

### Logs

```bash
# Conectar via serial
miniterm.py /dev/ttyUSB0 115200

# Procurar por:
✓ Calibration started
✓ IMU calibration complete
✓ Magnetometer calibration complete
✓ Odometer calibration complete
✓ LiDAR calibration complete
✓ Camera calibration complete
✓ Battery calibration complete
✓ Temperature calibration complete
✓ Calibration complete!
```

---

## 📈 PERFORMANCE

### Tempo de Calibração
```
IMU:           ~2 min
Magnetômetro:  ~30 seg
Odômetro:      ~1 min
LiDAR:         ~1 min
Câmera:        ~30 seg
Bateria:       ~10 seg
Temperatura:   ~10 seg
─────────────────────
TOTAL:         ~5-6 min
```

### Uso de Memória
```
Estrutura SensorCalibration_t:  ~200 bytes
EEPROM:                         ~1 KB
RAM (durante calibração):       ~5 KB
```

### Precisão Esperada
```
IMU:           ±0.1 m/s²
Magnetômetro:  ±5°
Odômetro:      ±2%
LiDAR:         ±50 mm
Câmera:        ±2 pixels
Bateria:       ±0.1 V
Temperatura:   ±1°C
```

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Implementar firmware
2. ✅ Implementar API HTTP
3. ✅ Implementar MQTT
4. ✅ Testar com robô real
5. ✅ Integrar com aplicativo
6. ✅ Deploy em produção

---

## 📚 REFERÊNCIAS

- **Arquivo Firmware:** `sensor_calibration.c` e `sensor_calibration.h`
- **API TypeScript:** `calibration_api.ts`
- **Testes:** `calibration_tests.ts`
- **Plano Técnico:** `CALIBRACAO_SENSORES_PLANO.md`

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Firmware
- [ ] Adicionar arquivos `sensor_calibration.c/h`
- [ ] Implementar funções de leitura de sensores
- [ ] Integrar no build
- [ ] Compilar sem erros
- [ ] Fazer upload
- [ ] Verificar inicialização

### API
- [ ] Implementar endpoints HTTP
- [ ] Implementar tópicos MQTT
- [ ] Testar conexão
- [ ] Testar calibração
- [ ] Validar dados

### Aplicativo
- [ ] Instalar CalibrationClient
- [ ] Implementar CalibrationService
- [ ] Criar UI
- [ ] Testar integração
- [ ] Deploy

### Validação
- [ ] Executar 10 testes
- [ ] Verificar precisão
- [ ] Verificar persistência
- [ ] Verificar recuperação de erro
- [ ] Documentar resultados

---

**Implementação completa de calibração automática! 🎉**
