# Calibração Automática de Sensores - Plano Completo
## CSJBot - Firmware Implementation

---

## 📋 SENSORES A CALIBRAR

### 1. **Sensores de Distância (LiDAR/Ultrassom)**
```
Função: Detecção de obstáculos
Tipo: Contínuo (360°)
Calibração: Offset e escala
Frequência: A cada 24h ou 500km
```

### 2. **Sensores IMU (Acelerômetro + Giroscópio)**
```
Função: Orientação e movimento
Tipo: 3-eixos
Calibração: Bias e escala
Frequência: A cada 12h ou antes de navegação crítica
```

### 3. **Odômetro (Encoders nas Rodas)**
```
Função: Medição de distância percorrida
Tipo: Pulsos por rotação
Calibração: Pulsos/metro
Frequência: A cada 100km ou mensalmente
```

### 4. **Bússola (Magnetômetro)**
```
Função: Orientação absoluta
Tipo: 3-eixos
Calibração: Offset magnético
Frequência: A cada 7 dias ou em novo ambiente
```

### 5. **Câmera (Visão Computacional)**
```
Função: Localização visual
Tipo: Calibração de lente
Calibração: Distorção e foco
Frequência: A cada 30 dias ou se movida
```

### 6. **Sensores de Bateria**
```
Função: Monitoramento de energia
Tipo: Voltagem e corrente
Calibração: Offset de voltagem
Frequência: A cada 100 ciclos de carga
```

### 7. **Sensores de Temperatura**
```
Função: Monitoramento térmico
Tipo: Múltiplos pontos
Calibração: Offset de temperatura
Frequência: A cada 6 meses
```

---

## 🎯 ESTRATÉGIA DE CALIBRAÇÃO

### Fase 1: Calibração Inicial (Setup)
```
Quando: Primeira inicialização
Duração: 5-10 minutos
Passos:
  1. Colocar robô em superfície plana
  2. Deixar imóvel por 30 segundos
  3. Executar calibração de IMU
  4. Executar calibração de bússola
  5. Executar calibração de odômetro
  6. Salvar valores em EEPROM
```

### Fase 2: Calibração Periódica (Manutenção)
```
Quando: A cada 24h ou 500km
Duração: 2-5 minutos
Passos:
  1. Verificar sensores críticos
  2. Comparar com valores baseline
  3. Se desvio > 5%, recalibrar
  4. Atualizar histórico
```

### Fase 3: Calibração Sob Demanda (Manual)
```
Quando: Usuário solicita ou erro detectado
Duração: Variável
Passos:
  1. Parar todas as operações
  2. Executar calibração completa
  3. Validar resultados
  4. Retomar operações
```

---

## 🔧 IMPLEMENTAÇÃO NO FIRMWARE

### Estrutura de Dados
```c
typedef struct {
  // IMU Calibration
  float imu_bias_x, imu_bias_y, imu_bias_z;
  float imu_scale_x, imu_scale_y, imu_scale_z;
  
  // Magnetometer Calibration
  float mag_offset_x, mag_offset_y, mag_offset_z;
  float mag_scale_x, mag_scale_y, mag_scale_z;
  
  // Odometer Calibration
  float pulses_per_meter_left;
  float pulses_per_meter_right;
  
  // LiDAR Calibration
  float lidar_offset_distance;
  float lidar_angle_offset;
  
  // Camera Calibration
  float camera_focal_length;
  float camera_principal_point_x;
  float camera_principal_point_y;
  float camera_distortion_k1, camera_distortion_k2;
  
  // Battery Calibration
  float battery_voltage_offset;
  float battery_voltage_scale;
  
  // Temperature Calibration
  float temp_offset;
  
  // Metadata
  uint32_t timestamp;
  uint16_t calibration_count;
  uint8_t status; // 0=invalid, 1=valid, 2=needs_recalibration
} SensorCalibration_t;
```

### Estados de Calibração
```c
typedef enum {
  CALIB_IDLE = 0,
  CALIB_IMU_INIT = 1,
  CALIB_IMU_RUNNING = 2,
  CALIB_MAG_INIT = 3,
  CALIB_MAG_RUNNING = 4,
  CALIB_ODOM_INIT = 5,
  CALIB_ODOM_RUNNING = 6,
  CALIB_LIDAR_INIT = 7,
  CALIB_LIDAR_RUNNING = 8,
  CALIB_CAMERA_INIT = 9,
  CALIB_CAMERA_RUNNING = 10,
  CALIB_COMPLETE = 11,
  CALIB_ERROR = 12
} CalibrationState_t;
```

---

## 📝 ALGORITMOS DE CALIBRAÇÃO

### 1. Calibração IMU (Acelerômetro + Giroscópio)

**Objetivo:** Remover bias e escala dos sensores

```c
void calibrate_imu(void) {
  // Coletar 100 amostras com robô imóvel
  float acc_x_sum = 0, acc_y_sum = 0, acc_z_sum = 0;
  float gyro_x_sum = 0, gyro_y_sum = 0, gyro_z_sum = 0;
  
  for (int i = 0; i < 100; i++) {
    read_imu_raw(&imu_data);
    
    acc_x_sum += imu_data.ax;
    acc_y_sum += imu_data.ay;
    acc_z_sum += imu_data.az;
    
    gyro_x_sum += imu_data.gx;
    gyro_y_sum += imu_data.gy;
    gyro_z_sum += imu_data.gz;
    
    delay_ms(10);
  }
  
  // Calcular média (bias)
  calib.imu_bias_x = acc_x_sum / 100.0f;
  calib.imu_bias_y = acc_y_sum / 100.0f;
  calib.imu_bias_z = (acc_z_sum / 100.0f) - 9.81f; // Remover gravidade
  
  // Gyro bias
  float gyro_bias_x = gyro_x_sum / 100.0f;
  float gyro_bias_y = gyro_y_sum / 100.0f;
  float gyro_bias_z = gyro_z_sum / 100.0f;
  
  // Escala (assumir 1.0 por enquanto)
  calib.imu_scale_x = 1.0f;
  calib.imu_scale_y = 1.0f;
  calib.imu_scale_z = 1.0f;
  
  // Salvar em EEPROM
  save_calibration_to_eeprom(&calib);
}
```

### 2. Calibração Magnetômetro (Bússola)

**Objetivo:** Remover offset magnético ambiental

```c
void calibrate_magnetometer(void) {
  // Coletar dados enquanto robô rotaciona
  float mag_x_min = 32767, mag_x_max = -32768;
  float mag_y_min = 32767, mag_y_max = -32768;
  float mag_z_min = 32767, mag_z_max = -32768;
  
  // Rotacionar 360° lentamente (30 segundos)
  uint32_t start_time = get_time_ms();
  
  while ((get_time_ms() - start_time) < 30000) {
    read_magnetometer_raw(&mag_data);
    
    // Encontrar min/max
    if (mag_data.mx < mag_x_min) mag_x_min = mag_data.mx;
    if (mag_data.mx > mag_x_max) mag_x_max = mag_data.mx;
    
    if (mag_data.my < mag_y_min) mag_y_min = mag_data.my;
    if (mag_data.my > mag_y_max) mag_y_max = mag_data.my;
    
    if (mag_data.mz < mag_z_min) mag_z_min = mag_data.mz;
    if (mag_data.mz > mag_z_max) mag_z_max = mag_data.mz;
    
    delay_ms(50);
  }
  
  // Calcular offset (ponto médio)
  calib.mag_offset_x = (mag_x_max + mag_x_min) / 2.0f;
  calib.mag_offset_y = (mag_y_max + mag_y_min) / 2.0f;
  calib.mag_offset_z = (mag_z_max + mag_z_min) / 2.0f;
  
  // Calcular escala (raio)
  float avg_delta_x = (mag_x_max - mag_x_min) / 2.0f;
  float avg_delta_y = (mag_y_max - mag_y_min) / 2.0f;
  float avg_delta_z = (mag_z_max - mag_z_min) / 2.0f;
  
  float avg_delta = (avg_delta_x + avg_delta_y + avg_delta_z) / 3.0f;
  
  calib.mag_scale_x = avg_delta / avg_delta_x;
  calib.mag_scale_y = avg_delta / avg_delta_y;
  calib.mag_scale_z = avg_delta / avg_delta_z;
  
  save_calibration_to_eeprom(&calib);
}
```

### 3. Calibração Odômetro (Encoders)

**Objetivo:** Determinar pulsos por metro

```c
void calibrate_odometer(void) {
  // Mover robô 1 metro em linha reta
  // Contar pulsos dos encoders
  
  uint32_t pulses_left = 0, pulses_right = 0;
  
  // Reset contadores
  reset_encoder_counters();
  
  // Mover 1 metro (1000mm)
  move_forward_distance(1000); // mm
  
  // Ler contadores
  pulses_left = get_left_encoder_count();
  pulses_right = get_right_encoder_count();
  
  // Calcular pulsos por metro
  calib.pulses_per_meter_left = pulses_left / 1.0f;
  calib.pulses_per_meter_right = pulses_right / 1.0f;
  
  // Validar (deve ser similar)
  float error = fabs(pulses_left - pulses_right) / ((pulses_left + pulses_right) / 2.0f);
  
  if (error > 0.1f) { // 10% de erro
    log_error("Odometer calibration error: %.2f%%", error * 100);
    return;
  }
  
  save_calibration_to_eeprom(&calib);
}
```

### 4. Calibração LiDAR

**Objetivo:** Validar leituras de distância

```c
void calibrate_lidar(void) {
  // Colocar objeto a distância conhecida (ex: 1 metro)
  // Coletar 50 leituras
  
  float distance_sum = 0;
  
  for (int i = 0; i < 50; i++) {
    float distance = read_lidar_distance();
    distance_sum += distance;
    delay_ms(20);
  }
  
  float avg_distance = distance_sum / 50.0f;
  
  // Calcular offset (esperado 1.0m)
  calib.lidar_offset_distance = 1.0f - avg_distance;
  
  // Validar (offset deve ser < 50mm)
  if (fabs(calib.lidar_offset_distance) > 0.05f) {
    log_warning("LiDAR offset large: %.3fm", calib.lidar_offset_distance);
  }
  
  save_calibration_to_eeprom(&calib);
}
```

### 5. Calibração Câmera

**Objetivo:** Calibrar parâmetros intrínsecos

```c
void calibrate_camera(void) {
  // Usar padrão de calibração (checkerboard)
  // Capturar múltiplas imagens em diferentes ângulos
  
  // Nota: Implementação simplificada
  // Em produção, usar OpenCV ou biblioteca similar
  
  // Parâmetros típicos para câmera VGA (640x480)
  calib.camera_focal_length = 500.0f; // pixels
  calib.camera_principal_point_x = 320.0f; // centro X
  calib.camera_principal_point_y = 240.0f; // centro Y
  
  // Distorção (coeficientes de radial)
  calib.camera_distortion_k1 = 0.0f;
  calib.camera_distortion_k2 = 0.0f;
  
  save_calibration_to_eeprom(&calib);
}
```

---

## 🔄 MÁQUINA DE ESTADOS DE CALIBRAÇÃO

```c
void calibration_state_machine(void) {
  static CalibrationState_t state = CALIB_IDLE;
  
  switch (state) {
    case CALIB_IDLE:
      if (calibration_requested) {
        state = CALIB_IMU_INIT;
        log_info("Starting calibration sequence");
      }
      break;
    
    case CALIB_IMU_INIT:
      log_info("Initializing IMU calibration");
      state = CALIB_IMU_RUNNING;
      break;
    
    case CALIB_IMU_RUNNING:
      calibrate_imu();
      state = CALIB_MAG_INIT;
      break;
    
    case CALIB_MAG_INIT:
      log_info("Initializing Magnetometer calibration");
      state = CALIB_MAG_RUNNING;
      break;
    
    case CALIB_MAG_RUNNING:
      calibrate_magnetometer();
      state = CALIB_ODOM_INIT;
      break;
    
    case CALIB_ODOM_INIT:
      log_info("Initializing Odometer calibration");
      state = CALIB_ODOM_RUNNING;
      break;
    
    case CALIB_ODOM_RUNNING:
      calibrate_odometer();
      state = CALIB_LIDAR_INIT;
      break;
    
    case CALIB_LIDAR_INIT:
      log_info("Initializing LiDAR calibration");
      state = CALIB_LIDAR_RUNNING;
      break;
    
    case CALIB_LIDAR_RUNNING:
      calibrate_lidar();
      state = CALIB_CAMERA_INIT;
      break;
    
    case CALIB_CAMERA_INIT:
      log_info("Initializing Camera calibration");
      state = CALIB_CAMERA_RUNNING;
      break;
    
    case CALIB_CAMERA_RUNNING:
      calibrate_camera();
      state = CALIB_COMPLETE;
      break;
    
    case CALIB_COMPLETE:
      log_info("Calibration complete!");
      calib.status = 1; // valid
      calib.timestamp = get_time_ms();
      calib.calibration_count++;
      state = CALIB_IDLE;
      calibration_requested = false;
      break;
    
    case CALIB_ERROR:
      log_error("Calibration error!");
      calib.status = 0; // invalid
      state = CALIB_IDLE;
      calibration_requested = false;
      break;
  }
}
```

---

## 💾 PERSISTÊNCIA EM EEPROM

```c
#define CALIB_EEPROM_ADDR 0x1000
#define CALIB_EEPROM_SIZE sizeof(SensorCalibration_t)

void save_calibration_to_eeprom(SensorCalibration_t *calib) {
  eeprom_write(CALIB_EEPROM_ADDR, (uint8_t *)calib, CALIB_EEPROM_SIZE);
  log_info("Calibration saved to EEPROM");
}

void load_calibration_from_eeprom(SensorCalibration_t *calib) {
  eeprom_read(CALIB_EEPROM_ADDR, (uint8_t *)calib, CALIB_EEPROM_SIZE);
  
  if (calib->status == 1) {
    log_info("Calibration loaded from EEPROM (count: %d)", calib->calibration_count);
  } else {
    log_warning("Calibration data invalid, using defaults");
    init_default_calibration(calib);
  }
}

void init_default_calibration(SensorCalibration_t *calib) {
  memset(calib, 0, sizeof(SensorCalibration_t));
  
  // Valores padrão
  calib->imu_scale_x = 1.0f;
  calib->imu_scale_y = 1.0f;
  calib->imu_scale_z = 1.0f;
  
  calib->mag_scale_x = 1.0f;
  calib->mag_scale_y = 1.0f;
  calib->mag_scale_z = 1.0f;
  
  calib->pulses_per_meter_left = 1000.0f; // Valor padrão
  calib->pulses_per_meter_right = 1000.0f;
  
  calib->camera_focal_length = 500.0f;
  calib->camera_principal_point_x = 320.0f;
  calib->camera_principal_point_y = 240.0f;
  
  calib->status = 0; // invalid
}
```

---

## 🔍 VALIDAÇÃO DE CALIBRAÇÃO

```c
bool validate_calibration(SensorCalibration_t *calib) {
  // Verificar se valores estão dentro de limites razoáveis
  
  // IMU
  if (fabs(calib->imu_bias_x) > 2.0f ||
      fabs(calib->imu_bias_y) > 2.0f ||
      fabs(calib->imu_bias_z) > 2.0f) {
    log_error("IMU bias out of range");
    return false;
  }
  
  // Magnetômetro
  if (calib->mag_scale_x < 0.5f || calib->mag_scale_x > 2.0f ||
      calib->mag_scale_y < 0.5f || calib->mag_scale_y > 2.0f ||
      calib->mag_scale_z < 0.5f || calib->mag_scale_z > 2.0f) {
    log_error("Magnetometer scale out of range");
    return false;
  }
  
  // Odômetro
  if (calib->pulses_per_meter_left < 500.0f ||
      calib->pulses_per_meter_left > 2000.0f) {
    log_error("Odometer pulses out of range");
    return false;
  }
  
  // LiDAR
  if (fabs(calib->lidar_offset_distance) > 0.1f) {
    log_error("LiDAR offset too large");
    return false;
  }
  
  return true;
}
```

---

## 📊 MONITORAMENTO CONTÍNUO

```c
void monitor_sensor_drift(void) {
  // Executar a cada 1 hora
  
  static uint32_t last_check = 0;
  uint32_t now = get_time_ms();
  
  if ((now - last_check) < 3600000) { // 1 hora
    return;
  }
  
  last_check = now;
  
  // Ler sensores
  read_imu_raw(&current_imu);
  read_magnetometer_raw(&current_mag);
  
  // Comparar com calibração
  float imu_drift_x = fabs(current_imu.ax - calib.imu_bias_x);
  float imu_drift_y = fabs(current_imu.ay - calib.imu_bias_y);
  float imu_drift_z = fabs(current_imu.az - calib.imu_bias_z);
  
  // Se desvio > 10%, marcar para recalibração
  if (imu_drift_x > 1.0f || imu_drift_y > 1.0f || imu_drift_z > 1.0f) {
    log_warning("IMU drift detected, recalibration needed");
    calib.status = 2; // needs_recalibration
  }
}
```

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ Implementar estrutura de dados
2. ✅ Implementar algoritmos de calibração
3. ✅ Implementar máquina de estados
4. ✅ Implementar persistência em EEPROM
5. ➡️ Criar interface de controle (API/MQTT)
6. ➡️ Criar testes e validação
7. ➡️ Integrar com aplicativo

---

**Plano de calibração automática completo! 🚀**
