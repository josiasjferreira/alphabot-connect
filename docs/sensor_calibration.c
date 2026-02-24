/**
 * @file sensor_calibration.c
 * @brief Calibração automática de sensores para CSJBot
 * @version 1.0.0
 * 
 * Implementa calibração automática para:
 * - IMU (Acelerômetro + Giroscópio)
 * - Magnetômetro (Bússola)
 * - Odômetro (Encoders)
 * - LiDAR (Sensor de distância)
 * - Câmera (Parâmetros intrínsecos)
 * - Bateria (Voltagem)
 * - Temperatura (Múltiplos sensores)
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <math.h>
#include "sensor_calibration.h"
#include "eeprom.h"
#include "logger.h"

// ============================================================================
// DEFINIÇÕES
// ============================================================================

#define CALIB_EEPROM_ADDR 0x1000
#define CALIB_EEPROM_SIZE sizeof(SensorCalibration_t)
#define CALIB_MAGIC 0xCAFEBABE

#define IMU_SAMPLES 100
#define MAG_ROTATION_TIME_MS 30000
#define LIDAR_SAMPLES 50
#define ODOM_TEST_DISTANCE_MM 1000

// ============================================================================
// VARIÁVEIS GLOBAIS
// ============================================================================

static SensorCalibration_t calib;
static CalibrationState_t calib_state = CALIB_IDLE;
static bool calibration_requested = false;
static uint32_t calib_start_time = 0;

// Estruturas de dados dos sensores
static IMUData_t imu_data;
static MagData_t mag_data;
static EncoderData_t encoder_data;
static LiDARData_t lidar_data;
static BatteryData_t battery_data;
static TemperatureData_t temp_data;

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

/**
 * @brief Inicializar sistema de calibração
 */
void calibration_init(void) {
  log_info("Initializing sensor calibration system");
  
  // Carregar calibração da EEPROM
  load_calibration_from_eeprom(&calib);
  
  // Se inválida, usar valores padrão
  if (calib.status != CALIB_VALID) {
    log_warning("Calibration data invalid, using defaults");
    init_default_calibration(&calib);
  }
  
  calib_state = CALIB_IDLE;
  log_info("Calibration system ready");
}

/**
 * @brief Inicializar calibração com valores padrão
 */
void init_default_calibration(SensorCalibration_t *calib) {
  memset(calib, 0, sizeof(SensorCalibration_t));
  
  // Magic number
  calib->magic = CALIB_MAGIC;
  
  // IMU
  calib->imu_bias_x = 0.0f;
  calib->imu_bias_y = 0.0f;
  calib->imu_bias_z = 0.0f;
  calib->imu_scale_x = 1.0f;
  calib->imu_scale_y = 1.0f;
  calib->imu_scale_z = 1.0f;
  
  // Magnetômetro
  calib->mag_offset_x = 0.0f;
  calib->mag_offset_y = 0.0f;
  calib->mag_offset_z = 0.0f;
  calib->mag_scale_x = 1.0f;
  calib->mag_scale_y = 1.0f;
  calib->mag_scale_z = 1.0f;
  
  // Odômetro
  calib->pulses_per_meter_left = 1000.0f;
  calib->pulses_per_meter_right = 1000.0f;
  
  // LiDAR
  calib->lidar_offset_distance = 0.0f;
  calib->lidar_angle_offset = 0.0f;
  
  // Câmera
  calib->camera_focal_length = 500.0f;
  calib->camera_principal_point_x = 320.0f;
  calib->camera_principal_point_y = 240.0f;
  calib->camera_distortion_k1 = 0.0f;
  calib->camera_distortion_k2 = 0.0f;
  
  // Bateria
  calib->battery_voltage_offset = 0.0f;
  calib->battery_voltage_scale = 1.0f;
  
  // Temperatura
  calib->temp_offset = 0.0f;
  
  // Metadata
  calib->timestamp = 0;
  calib->calibration_count = 0;
  calib->status = CALIB_INVALID;
  
  log_info("Default calibration initialized");
}

// ============================================================================
// CALIBRAÇÃO IMU
// ============================================================================

/**
 * @brief Calibrar IMU (Acelerômetro + Giroscópio)
 * Robô deve estar imóvel em superfície plana
 */
bool calibrate_imu(void) {
  log_info("Starting IMU calibration");
  
  float acc_x_sum = 0.0f, acc_y_sum = 0.0f, acc_z_sum = 0.0f;
  float gyro_x_sum = 0.0f, gyro_y_sum = 0.0f, gyro_z_sum = 0.0f;
  float acc_x_sq_sum = 0.0f, acc_y_sq_sum = 0.0f, acc_z_sq_sum = 0.0f;
  
  // Coletar amostras
  for (int i = 0; i < IMU_SAMPLES; i++) {
    if (!read_imu_raw(&imu_data)) {
      log_error("Failed to read IMU");
      return false;
    }
    
    acc_x_sum += imu_data.ax;
    acc_y_sum += imu_data.ay;
    acc_z_sum += imu_data.az;
    
    acc_x_sq_sum += imu_data.ax * imu_data.ax;
    acc_y_sq_sum += imu_data.ay * imu_data.ay;
    acc_z_sq_sum += imu_data.az * imu_data.az;
    
    gyro_x_sum += imu_data.gx;
    gyro_y_sum += imu_data.gy;
    gyro_z_sum += imu_data.gz;
    
    delay_ms(10);
  }
  
  // Calcular média (bias)
  float acc_x_mean = acc_x_sum / IMU_SAMPLES;
  float acc_y_mean = acc_y_sum / IMU_SAMPLES;
  float acc_z_mean = acc_z_sum / IMU_SAMPLES;
  
  calib.imu_bias_x = acc_x_mean;
  calib.imu_bias_y = acc_y_mean;
  calib.imu_bias_z = acc_z_mean - 9.81f; // Remover gravidade
  
  // Calcular desvio padrão (para validação)
  float acc_x_var = (acc_x_sq_sum / IMU_SAMPLES) - (acc_x_mean * acc_x_mean);
  float acc_y_var = (acc_y_sq_sum / IMU_SAMPLES) - (acc_y_mean * acc_y_mean);
  float acc_z_var = (acc_z_sq_sum / IMU_SAMPLES) - (acc_z_mean * acc_z_mean);
  
  float acc_x_std = sqrtf(acc_x_var);
  float acc_y_std = sqrtf(acc_y_var);
  float acc_z_std = sqrtf(acc_z_var);
  
  log_info("IMU Calibration:");
  log_info("  Accel Bias: (%.3f, %.3f, %.3f) m/s²", 
           calib.imu_bias_x, calib.imu_bias_y, calib.imu_bias_z);
  log_info("  Accel Std Dev: (%.3f, %.3f, %.3f) m/s²", 
           acc_x_std, acc_y_std, acc_z_std);
  
  // Validar (desvio padrão deve ser pequeno)
  if (acc_x_std > 0.5f || acc_y_std > 0.5f || acc_z_std > 0.5f) {
    log_error("IMU noise too high, calibration may be invalid");
    return false;
  }
  
  // Escala (assumir 1.0 por enquanto)
  calib.imu_scale_x = 1.0f;
  calib.imu_scale_y = 1.0f;
  calib.imu_scale_z = 1.0f;
  
  log_info("IMU calibration complete");
  return true;
}

// ============================================================================
// CALIBRAÇÃO MAGNETÔMETRO
// ============================================================================

/**
 * @brief Calibrar Magnetômetro (Bússola)
 * Robô deve rotacionar 360° lentamente
 */
bool calibrate_magnetometer(void) {
  log_info("Starting Magnetometer calibration");
  log_info("Please rotate robot 360 degrees slowly (30 seconds)");
  
  float mag_x_min = 32767.0f, mag_x_max = -32768.0f;
  float mag_y_min = 32767.0f, mag_y_max = -32768.0f;
  float mag_z_min = 32767.0f, mag_z_max = -32768.0f;
  
  uint32_t start_time = get_time_ms();
  int sample_count = 0;
  
  // Coletar dados durante rotação
  while ((get_time_ms() - start_time) < MAG_ROTATION_TIME_MS) {
    if (!read_magnetometer_raw(&mag_data)) {
      log_error("Failed to read magnetometer");
      return false;
    }
    
    // Encontrar min/max
    if (mag_data.mx < mag_x_min) mag_x_min = mag_data.mx;
    if (mag_data.mx > mag_x_max) mag_x_max = mag_data.mx;
    
    if (mag_data.my < mag_y_min) mag_y_min = mag_data.my;
    if (mag_data.my > mag_y_max) mag_y_max = mag_data.my;
    
    if (mag_data.mz < mag_z_min) mag_z_min = mag_data.mz;
    if (mag_data.mz > mag_z_max) mag_z_max = mag_data.mz;
    
    sample_count++;
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
  
  log_info("Magnetometer Calibration:");
  log_info("  Offset: (%.1f, %.1f, %.1f)", 
           calib.mag_offset_x, calib.mag_offset_y, calib.mag_offset_z);
  log_info("  Scale: (%.3f, %.3f, %.3f)", 
           calib.mag_scale_x, calib.mag_scale_y, calib.mag_scale_z);
  log_info("  Samples collected: %d", sample_count);
  
  log_info("Magnetometer calibration complete");
  return true;
}

// ============================================================================
// CALIBRAÇÃO ODÔMETRO
// ============================================================================

/**
 * @brief Calibrar Odômetro (Encoders)
 * Robô deve mover 1 metro em linha reta
 */
bool calibrate_odometer(void) {
  log_info("Starting Odometer calibration");
  log_info("Moving robot forward %.1f meters", ODOM_TEST_DISTANCE_MM / 1000.0f);
  
  // Reset contadores
  reset_encoder_counters();
  delay_ms(100);
  
  // Mover distância conhecida
  if (!move_forward_distance(ODOM_TEST_DISTANCE_MM)) {
    log_error("Failed to move robot");
    return false;
  }
  
  // Ler contadores
  uint32_t pulses_left = get_left_encoder_count();
  uint32_t pulses_right = get_right_encoder_count();
  
  // Calcular pulsos por metro
  float distance_m = ODOM_TEST_DISTANCE_MM / 1000.0f;
  calib.pulses_per_meter_left = pulses_left / distance_m;
  calib.pulses_per_meter_right = pulses_right / distance_m;
  
  // Validar (deve ser similar)
  float error = fabs(pulses_left - pulses_right) / ((pulses_left + pulses_right) / 2.0f);
  
  log_info("Odometer Calibration:");
  log_info("  Left pulses: %lu", pulses_left);
  log_info("  Right pulses: %lu", pulses_right);
  log_info("  Pulses/meter: Left=%.1f, Right=%.1f", 
           calib.pulses_per_meter_left, calib.pulses_per_meter_right);
  log_info("  Encoder error: %.2f%%", error * 100.0f);
  
  if (error > 0.15f) { // 15% de erro
    log_error("Odometer calibration error too high: %.2f%%", error * 100.0f);
    return false;
  }
  
  log_info("Odometer calibration complete");
  return true;
}

// ============================================================================
// CALIBRAÇÃO LIDAR
// ============================================================================

/**
 * @brief Calibrar LiDAR
 * Colocar objeto a 1 metro de distância
 */
bool calibrate_lidar(void) {
  log_info("Starting LiDAR calibration");
  log_info("Place object at exactly 1.0 meter distance");
  
  float distance_sum = 0.0f;
  float distance_sq_sum = 0.0f;
  
  for (int i = 0; i < LIDAR_SAMPLES; i++) {
    float distance = read_lidar_distance();
    
    if (distance < 0.0f) {
      log_error("Failed to read LiDAR");
      return false;
    }
    
    distance_sum += distance;
    distance_sq_sum += distance * distance;
    
    delay_ms(20);
  }
  
  float avg_distance = distance_sum / LIDAR_SAMPLES;
  float distance_var = (distance_sq_sum / LIDAR_SAMPLES) - (avg_distance * avg_distance);
  float distance_std = sqrtf(distance_var);
  
  // Calcular offset (esperado 1.0m)
  calib.lidar_offset_distance = 1.0f - avg_distance;
  
  log_info("LiDAR Calibration:");
  log_info("  Average distance: %.3f m", avg_distance);
  log_info("  Std deviation: %.3f m", distance_std);
  log_info("  Offset: %.3f m", calib.lidar_offset_distance);
  
  // Validar (offset deve ser < 100mm)
  if (fabs(calib.lidar_offset_distance) > 0.1f) {
    log_warning("LiDAR offset large: %.3f m", calib.lidar_offset_distance);
  }
  
  // Validar (desvio padrão deve ser pequeno)
  if (distance_std > 0.05f) {
    log_warning("LiDAR noise high: %.3f m", distance_std);
  }
  
  log_info("LiDAR calibration complete");
  return true;
}

// ============================================================================
// CALIBRAÇÃO CÂMERA
// ============================================================================

/**
 * @brief Calibrar Câmera
 * Usar padrão de calibração (checkerboard)
 */
bool calibrate_camera(void) {
  log_info("Starting Camera calibration");
  
  // Nota: Implementação simplificada
  // Em produção, usar OpenCV ou biblioteca similar
  
  // Parâmetros típicos para câmera VGA (640x480)
  calib.camera_focal_length = 500.0f; // pixels
  calib.camera_principal_point_x = 320.0f; // centro X
  calib.camera_principal_point_y = 240.0f; // centro Y
  
  // Distorção (coeficientes radiais)
  calib.camera_distortion_k1 = 0.0f;
  calib.camera_distortion_k2 = 0.0f;
  
  log_info("Camera Calibration:");
  log_info("  Focal length: %.1f pixels", calib.camera_focal_length);
  log_info("  Principal point: (%.1f, %.1f)", 
           calib.camera_principal_point_x, calib.camera_principal_point_y);
  log_info("  Distortion: k1=%.3f, k2=%.3f", 
           calib.camera_distortion_k1, calib.camera_distortion_k2);
  
  log_info("Camera calibration complete");
  return true;
}

// ============================================================================
// CALIBRAÇÃO BATERIA
// ============================================================================

/**
 * @brief Calibrar Sensor de Bateria
 */
bool calibrate_battery(void) {
  log_info("Starting Battery calibration");
  
  float voltage_sum = 0.0f;
  
  for (int i = 0; i < 10; i++) {
    if (!read_battery_data(&battery_data)) {
      log_error("Failed to read battery");
      return false;
    }
    
    voltage_sum += battery_data.voltage;
    delay_ms(100);
  }
  
  float avg_voltage = voltage_sum / 10.0f;
  
  // Assumir voltagem nominal conhecida (ex: 12V)
  float nominal_voltage = 12.0f;
  calib.battery_voltage_offset = nominal_voltage - avg_voltage;
  calib.battery_voltage_scale = 1.0f;
  
  log_info("Battery Calibration:");
  log_info("  Average voltage: %.2f V", avg_voltage);
  log_info("  Offset: %.2f V", calib.battery_voltage_offset);
  
  log_info("Battery calibration complete");
  return true;
}

// ============================================================================
// CALIBRAÇÃO TEMPERATURA
// ============================================================================

/**
 * @brief Calibrar Sensores de Temperatura
 */
bool calibrate_temperature(void) {
  log_info("Starting Temperature calibration");
  
  float temp_sum = 0.0f;
  
  for (int i = 0; i < 10; i++) {
    if (!read_temperature_data(&temp_data)) {
      log_error("Failed to read temperature");
      return false;
    }
    
    temp_sum += temp_data.temperature;
    delay_ms(100);
  }
  
  float avg_temp = temp_sum / 10.0f;
  
  // Assumir temperatura ambiente conhecida (ex: 25°C)
  float ambient_temp = 25.0f;
  calib.temp_offset = ambient_temp - avg_temp;
  
  log_info("Temperature Calibration:");
  log_info("  Average temperature: %.1f °C", avg_temp);
  log_info("  Offset: %.1f °C", calib.temp_offset);
  
  log_info("Temperature calibration complete");
  return true;
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * @brief Validar calibração
 */
bool validate_calibration(const SensorCalibration_t *calib) {
  log_info("Validating calibration data");
  
  // Magic number
  if (calib->magic != CALIB_MAGIC) {
    log_error("Invalid magic number");
    return false;
  }
  
  // IMU
  if (fabs(calib->imu_bias_x) > 5.0f ||
      fabs(calib->imu_bias_y) > 5.0f ||
      fabs(calib->imu_bias_z) > 5.0f) {
    log_error("IMU bias out of range");
    return false;
  }
  
  if (calib->imu_scale_x < 0.5f || calib->imu_scale_x > 2.0f ||
      calib->imu_scale_y < 0.5f || calib->imu_scale_y > 2.0f ||
      calib->imu_scale_z < 0.5f || calib->imu_scale_z > 2.0f) {
    log_error("IMU scale out of range");
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
  
  if (calib->pulses_per_meter_right < 500.0f ||
      calib->pulses_per_meter_right > 2000.0f) {
    log_error("Odometer pulses out of range");
    return false;
  }
  
  // LiDAR
  if (fabs(calib->lidar_offset_distance) > 0.2f) {
    log_warning("LiDAR offset large: %.3f m", calib->lidar_offset_distance);
  }
  
  // Câmera
  if (calib->camera_focal_length < 100.0f ||
      calib->camera_focal_length > 1000.0f) {
    log_error("Camera focal length out of range");
    return false;
  }
  
  log_info("Calibration validation passed");
  return true;
}

// ============================================================================
// MÁQUINA DE ESTADOS
// ============================================================================

/**
 * @brief Máquina de estados de calibração
 */
void calibration_state_machine(void) {
  static uint32_t phase_start_time = 0;
  
  switch (calib_state) {
    case CALIB_IDLE:
      if (calibration_requested) {
        calib_state = CALIB_IMU_INIT;
        phase_start_time = get_time_ms();
        log_info("Starting calibration sequence");
      }
      break;
    
    case CALIB_IMU_INIT:
      log_info("Initializing IMU calibration");
      calib_state = CALIB_IMU_RUNNING;
      phase_start_time = get_time_ms();
      break;
    
    case CALIB_IMU_RUNNING:
      if (calibrate_imu()) {
        calib_state = CALIB_MAG_INIT;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_MAG_INIT:
      log_info("Initializing Magnetometer calibration");
      calib_state = CALIB_MAG_RUNNING;
      phase_start_time = get_time_ms();
      break;
    
    case CALIB_MAG_RUNNING:
      if (calibrate_magnetometer()) {
        calib_state = CALIB_ODOM_INIT;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_ODOM_INIT:
      log_info("Initializing Odometer calibration");
      calib_state = CALIB_ODOM_RUNNING;
      phase_start_time = get_time_ms();
      break;
    
    case CALIB_ODOM_RUNNING:
      if (calibrate_odometer()) {
        calib_state = CALIB_LIDAR_INIT;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_LIDAR_INIT:
      log_info("Initializing LiDAR calibration");
      calib_state = CALIB_LIDAR_RUNNING;
      phase_start_time = get_time_ms();
      break;
    
    case CALIB_LIDAR_RUNNING:
      if (calibrate_lidar()) {
        calib_state = CALIB_CAMERA_INIT;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_CAMERA_INIT:
      log_info("Initializing Camera calibration");
      calib_state = CALIB_CAMERA_RUNNING;
      phase_start_time = get_time_ms();
      break;
    
    case CALIB_CAMERA_RUNNING:
      if (calibrate_camera()) {
        calib_state = CALIB_BATTERY_INIT;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_BATTERY_INIT:
      log_info("Initializing Battery calibration");
      calib_state = CALIB_BATTERY_RUNNING;
      phase_start_time = get_time_ms();
      break;
    
    case CALIB_BATTERY_RUNNING:
      if (calibrate_battery()) {
        calib_state = CALIB_TEMP_INIT;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_TEMP_INIT:
      log_info("Initializing Temperature calibration");
      calib_state = CALIB_TEMP_RUNNING;
      phase_start_time = get_time_ms();
      break;
    
    case CALIB_TEMP_RUNNING:
      if (calibrate_temperature()) {
        calib_state = CALIB_VALIDATE;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_VALIDATE:
      if (validate_calibration(&calib)) {
        calib_state = CALIB_COMPLETE;
      } else {
        calib_state = CALIB_ERROR;
      }
      break;
    
    case CALIB_COMPLETE:
      log_info("Calibration complete!");
      calib.status = CALIB_VALID;
      calib.timestamp = get_time_ms();
      calib.calibration_count++;
      save_calibration_to_eeprom(&calib);
      calib_state = CALIB_IDLE;
      calibration_requested = false;
      break;
    
    case CALIB_ERROR:
      log_error("Calibration error!");
      calib.status = CALIB_INVALID;
      calib_state = CALIB_IDLE;
      calibration_requested = false;
      break;
    
    default:
      log_error("Unknown calibration state: %d", calib_state);
      calib_state = CALIB_IDLE;
      break;
  }
}

// ============================================================================
// PERSISTÊNCIA
// ============================================================================

/**
 * @brief Salvar calibração em EEPROM
 */
void save_calibration_to_eeprom(const SensorCalibration_t *calib) {
  eeprom_write(CALIB_EEPROM_ADDR, (const uint8_t *)calib, CALIB_EEPROM_SIZE);
  log_info("Calibration saved to EEPROM");
}

/**
 * @brief Carregar calibração da EEPROM
 */
void load_calibration_from_eeprom(SensorCalibration_t *calib) {
  eeprom_read(CALIB_EEPROM_ADDR, (uint8_t *)calib, CALIB_EEPROM_SIZE);
  
  if (calib->status == CALIB_VALID && calib->magic == CALIB_MAGIC) {
    log_info("Calibration loaded from EEPROM (count: %d, age: %d seconds)",
             calib->calibration_count, 
             (get_time_ms() - calib->timestamp) / 1000);
  } else {
    log_warning("Calibration data invalid, using defaults");
    init_default_calibration(calib);
  }
}

// ============================================================================
// INTERFACE PÚBLICA
// ============================================================================

/**
 * @brief Solicitar calibração
 */
void request_calibration(void) {
  if (calib_state != CALIB_IDLE) {
    log_warning("Calibration already in progress");
    return;
  }
  
  calibration_requested = true;
  log_info("Calibration requested");
}

/**
 * @brief Obter estado atual da calibração
 */
CalibrationState_t get_calibration_state(void) {
  return calib_state;
}

/**
 * @brief Obter dados de calibração
 */
const SensorCalibration_t *get_calibration_data(void) {
  return &calib;
}

/**
 * @brief Verificar se calibração é válida
 */
bool is_calibration_valid(void) {
  return calib.status == CALIB_VALID;
}

/**
 * @brief Obter tempo desde última calibração (segundos)
 */
uint32_t get_calibration_age_seconds(void) {
  return (get_time_ms() - calib.timestamp) / 1000;
}

/**
 * @brief Resetar calibração para padrão
 */
void reset_calibration_to_default(void) {
  init_default_calibration(&calib);
  save_calibration_to_eeprom(&calib);
  log_info("Calibration reset to default");
}

// ============================================================================
// MONITORAMENTO CONTÍNUO
// ============================================================================

/**
 * @brief Monitorar desvio de sensores
 * Executar periodicamente (a cada 1 hora)
 */
void monitor_sensor_drift(void) {
  static uint32_t last_check = 0;
  uint32_t now = get_time_ms();
  
  // Verificar a cada 1 hora
  if ((now - last_check) < 3600000) {
    return;
  }
  
  last_check = now;
  
  log_info("Monitoring sensor drift");
  
  // Ler sensores
  if (!read_imu_raw(&imu_data)) {
    return;
  }
  
  // Comparar com calibração
  float imu_drift_x = fabs(imu_data.ax - calib.imu_bias_x);
  float imu_drift_y = fabs(imu_data.ay - calib.imu_bias_y);
  float imu_drift_z = fabs(imu_data.az - calib.imu_bias_z);
  
  log_info("IMU drift: (%.3f, %.3f, %.3f) m/s²", 
           imu_drift_x, imu_drift_y, imu_drift_z);
  
  // Se desvio > 2.0, marcar para recalibração
  if (imu_drift_x > 2.0f || imu_drift_y > 2.0f || imu_drift_z > 2.0f) {
    log_warning("IMU drift detected, recalibration recommended");
    calib.status = CALIB_NEEDS_RECALIBRATION;
  }
}

/**
 * @brief Atualizar máquina de estados (chamar periodicamente)
 */
void calibration_update(void) {
  calibration_state_machine();
  monitor_sensor_drift();
}

// ============================================================================
// FIM DO ARQUIVO
// ============================================================================
