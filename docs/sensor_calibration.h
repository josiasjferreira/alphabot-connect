/**
 * @file sensor_calibration.h
 * @brief Header para calibração automática de sensores
 * @version 1.0.0
 */

#ifndef SENSOR_CALIBRATION_H
#define SENSOR_CALIBRATION_H

#include <stdint.h>
#include <stdbool.h>

// ============================================================================
// ENUMERAÇÕES
// ============================================================================

/**
 * @enum CalibrationStatus_t
 * @brief Status de calibração
 */
typedef enum {
  CALIB_INVALID = 0,              ///< Calibração inválida
  CALIB_VALID = 1,                ///< Calibração válida
  CALIB_NEEDS_RECALIBRATION = 2   ///< Recalibração necessária
} CalibrationStatus_t;

/**
 * @enum CalibrationState_t
 * @brief Estado da máquina de calibração
 */
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
  CALIB_BATTERY_INIT = 11,
  CALIB_BATTERY_RUNNING = 12,
  CALIB_TEMP_INIT = 13,
  CALIB_TEMP_RUNNING = 14,
  CALIB_VALIDATE = 15,
  CALIB_COMPLETE = 16,
  CALIB_ERROR = 17
} CalibrationState_t;

// ============================================================================
// ESTRUTURAS DE DADOS
// ============================================================================

/**
 * @struct IMUData_t
 * @brief Dados do IMU (Acelerômetro + Giroscópio)
 */
typedef struct {
  float ax, ay, az;  ///< Aceleração (m/s²)
  float gx, gy, gz;  ///< Velocidade angular (rad/s)
  uint32_t timestamp; ///< Timestamp (ms)
} IMUData_t;

/**
 * @struct MagData_t
 * @brief Dados do Magnetômetro
 */
typedef struct {
  float mx, my, mz;  ///< Campo magnético (Gauss)
  uint32_t timestamp; ///< Timestamp (ms)
} MagData_t;

/**
 * @struct EncoderData_t
 * @brief Dados dos Encoders
 */
typedef struct {
  uint32_t left_count;   ///< Contagem esquerda
  uint32_t right_count;  ///< Contagem direita
  uint32_t timestamp;    ///< Timestamp (ms)
} EncoderData_t;

/**
 * @struct LiDARData_t
 * @brief Dados do LiDAR
 */
typedef struct {
  float distance;     ///< Distância (m)
  float angle;        ///< Ângulo (rad)
  uint32_t timestamp; ///< Timestamp (ms)
} LiDARData_t;

/**
 * @struct BatteryData_t
 * @brief Dados da Bateria
 */
typedef struct {
  float voltage;      ///< Voltagem (V)
  float current;      ///< Corrente (A)
  float percentage;   ///< Percentual (%)
  uint32_t timestamp; ///< Timestamp (ms)
} BatteryData_t;

/**
 * @struct TemperatureData_t
 * @brief Dados de Temperatura
 */
typedef struct {
  float temperature;  ///< Temperatura (°C)
  uint32_t timestamp; ///< Timestamp (ms)
} TemperatureData_t;

/**
 * @struct SensorCalibration_t
 * @brief Dados de calibração de todos os sensores
 */
typedef struct {
  // Magic number para validação
  uint32_t magic;
  
  // ========== IMU Calibration ==========
  float imu_bias_x;    ///< Bias do acelerômetro X (m/s²)
  float imu_bias_y;    ///< Bias do acelerômetro Y (m/s²)
  float imu_bias_z;    ///< Bias do acelerômetro Z (m/s²)
  float imu_scale_x;   ///< Escala do acelerômetro X
  float imu_scale_y;   ///< Escala do acelerômetro Y
  float imu_scale_z;   ///< Escala do acelerômetro Z
  
  // ========== Magnetometer Calibration ==========
  float mag_offset_x;  ///< Offset do magnetômetro X
  float mag_offset_y;  ///< Offset do magnetômetro Y
  float mag_offset_z;  ///< Offset do magnetômetro Z
  float mag_scale_x;   ///< Escala do magnetômetro X
  float mag_scale_y;   ///< Escala do magnetômetro Y
  float mag_scale_z;   ///< Escala do magnetômetro Z
  
  // ========== Odometer Calibration ==========
  float pulses_per_meter_left;   ///< Pulsos/metro roda esquerda
  float pulses_per_meter_right;  ///< Pulsos/metro roda direita
  
  // ========== LiDAR Calibration ==========
  float lidar_offset_distance;   ///< Offset de distância (m)
  float lidar_angle_offset;      ///< Offset de ângulo (rad)
  
  // ========== Camera Calibration ==========
  float camera_focal_length;        ///< Comprimento focal (pixels)
  float camera_principal_point_x;   ///< Ponto principal X (pixels)
  float camera_principal_point_y;   ///< Ponto principal Y (pixels)
  float camera_distortion_k1;       ///< Coeficiente de distorção k1
  float camera_distortion_k2;       ///< Coeficiente de distorção k2
  
  // ========== Battery Calibration ==========
  float battery_voltage_offset;  ///< Offset de voltagem (V)
  float battery_voltage_scale;   ///< Escala de voltagem
  
  // ========== Temperature Calibration ==========
  float temp_offset;  ///< Offset de temperatura (°C)
  
  // ========== Metadata ==========
  uint32_t timestamp;            ///< Timestamp da calibração (ms)
  uint16_t calibration_count;    ///< Número de calibrações realizadas
  uint8_t status;                ///< Status da calibração (CalibrationStatus_t)
  
} SensorCalibration_t;

// ============================================================================
// FUNÇÕES PÚBLICAS
// ============================================================================

/**
 * @brief Inicializar sistema de calibração
 */
void calibration_init(void);

/**
 * @brief Inicializar calibração com valores padrão
 * @param calib Ponteiro para estrutura de calibração
 */
void init_default_calibration(SensorCalibration_t *calib);

/**
 * @brief Solicitar calibração
 */
void request_calibration(void);

/**
 * @brief Obter estado atual da calibração
 * @return Estado da calibração
 */
CalibrationState_t get_calibration_state(void);

/**
 * @brief Obter dados de calibração
 * @return Ponteiro para dados de calibração
 */
const SensorCalibration_t *get_calibration_data(void);

/**
 * @brief Verificar se calibração é válida
 * @return true se válida, false caso contrário
 */
bool is_calibration_valid(void);

/**
 * @brief Obter tempo desde última calibração (segundos)
 * @return Idade da calibração em segundos
 */
uint32_t get_calibration_age_seconds(void);

/**
 * @brief Resetar calibração para padrão
 */
void reset_calibration_to_default(void);

/**
 * @brief Salvar calibração em EEPROM
 * @param calib Ponteiro para estrutura de calibração
 */
void save_calibration_to_eeprom(const SensorCalibration_t *calib);

/**
 * @brief Carregar calibração da EEPROM
 * @param calib Ponteiro para estrutura de calibração
 */
void load_calibration_from_eeprom(SensorCalibration_t *calib);

/**
 * @brief Atualizar máquina de estados (chamar periodicamente)
 */
void calibration_update(void);

/**
 * @brief Monitorar desvio de sensores
 */
void monitor_sensor_drift(void);

// ============================================================================
// FUNÇÕES DE CALIBRAÇÃO INDIVIDUAIS
// ============================================================================

/**
 * @brief Calibrar IMU
 * @return true se bem-sucedido, false caso contrário
 */
bool calibrate_imu(void);

/**
 * @brief Calibrar Magnetômetro
 * @return true se bem-sucedido, false caso contrário
 */
bool calibrate_magnetometer(void);

/**
 * @brief Calibrar Odômetro
 * @return true se bem-sucedido, false caso contrário
 */
bool calibrate_odometer(void);

/**
 * @brief Calibrar LiDAR
 * @return true se bem-sucedido, false caso contrário
 */
bool calibrate_lidar(void);

/**
 * @brief Calibrar Câmera
 * @return true se bem-sucedido, false caso contrário
 */
bool calibrate_camera(void);

/**
 * @brief Calibrar Sensor de Bateria
 * @return true se bem-sucedido, false caso contrário
 */
bool calibrate_battery(void);

/**
 * @brief Calibrar Sensores de Temperatura
 * @return true se bem-sucedido, false caso contrário
 */
bool calibrate_temperature(void);

/**
 * @brief Validar calibração
 * @param calib Ponteiro para estrutura de calibração
 * @return true se válida, false caso contrário
 */
bool validate_calibration(const SensorCalibration_t *calib);

// ============================================================================
// FUNÇÕES AUXILIARES (implementadas em outros arquivos)
// ============================================================================

/**
 * @brief Ler dados brutos do IMU
 * @param imu_data Ponteiro para estrutura IMUData_t
 * @return true se bem-sucedido, false caso contrário
 */
bool read_imu_raw(IMUData_t *imu_data);

/**
 * @brief Ler dados brutos do Magnetômetro
 * @param mag_data Ponteiro para estrutura MagData_t
 * @return true se bem-sucedido, false caso contrário
 */
bool read_magnetometer_raw(MagData_t *mag_data);

/**
 * @brief Ler dados da Bateria
 * @param battery_data Ponteiro para estrutura BatteryData_t
 * @return true se bem-sucedido, false caso contrário
 */
bool read_battery_data(BatteryData_t *battery_data);

/**
 * @brief Ler dados de Temperatura
 * @param temp_data Ponteiro para estrutura TemperatureData_t
 * @return true se bem-sucedido, false caso contrário
 */
bool read_temperature_data(TemperatureData_t *temp_data);

/**
 * @brief Ler distância do LiDAR
 * @return Distância em metros, ou -1.0 se erro
 */
float read_lidar_distance(void);

/**
 * @brief Mover robô para frente uma distância conhecida
 * @param distance_mm Distância em milímetros
 * @return true se bem-sucedido, false caso contrário
 */
bool move_forward_distance(uint32_t distance_mm);

/**
 * @brief Resetar contadores de encoders
 */
void reset_encoder_counters(void);

/**
 * @brief Obter contagem do encoder esquerdo
 * @return Contagem de pulsos
 */
uint32_t get_left_encoder_count(void);

/**
 * @brief Obter contagem do encoder direito
 * @return Contagem de pulsos
 */
uint32_t get_right_encoder_count(void);

/**
 * @brief Obter tempo em milissegundos
 * @return Tempo em ms
 */
uint32_t get_time_ms(void);

/**
 * @brief Delay em milissegundos
 * @param ms Tempo em milissegundos
 */
void delay_ms(uint32_t ms);

#endif // SENSOR_CALIBRATION_H
