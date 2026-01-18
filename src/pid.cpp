#include <Arduino.h>
#include <Wire.h>
#include "MPU9250.h"
#include <PID_v1.h>

// Crear instancia del MPU9250
MPU9250 mpu;

// ==== Pines ====
#define PIN_SERVO 15
#define PIN_TEST 4
#define PIN_TEST2 16
#define PIN_ACS712 34  // Sensor de corriente ACS712

// ==== Variables compartidas ====
volatile float ax, ay, az, gx, gy, gz;
volatile unsigned long lastReadMicros = 0;

// ==== Variables del filtro y PID ====
float angleX = 0, angleY = 0;
float angleX_prev = 0, angleY_prev = 0;

// ==== Variables del sensor de corriente ACS712 ====
float currentOffset = 2387.06;  // Valor ADC calibrado en corriente cero
const float ACS712_SENSITIVITY = 0.066;  // 66mV/A para ACS712-30A
const float ADC_VOLTAGE = 3.3;           // Voltaje de referencia del ADC del ESP32
const int ADC_RESOLUTION = 4096;         // Resolución del ADC (12 bits)
float current_A = 0.0;                   // Corriente medida en amperios

// Variables PID (double para compatibilidad con librería)
double setpoint = 0.0;
double pidInput = 0.0;
double pidOutput = 0.0;

// Parámetros PID
#define KP 31.1
#define KI 0
#define KD 0.6

#define ALPHA 0.9975f

// Crear controlador PID
PID myPID(&pidInput, &pidOutput, &setpoint, KP, KI, KD, DIRECT);

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire.setClock(100000); // Reducido de 400kHz a 100kHz para mayor estabilidad

  pinMode(PIN_TEST, OUTPUT);
  pinMode(PIN_TEST2, OUTPUT);
  pinMode(PIN_ACS712, INPUT);

  // Inicializa MPU9250
  Serial.println("Iniciando MPU9250...");
  
  if (!mpu.setup(0x68)) {  // cambiar a 0x69 si AD0 está en HIGH
    Serial.println("❌ Error al inicializar MPU9250");
    while(1) {
      Serial.println("❌ MPU9250 no detectado");
      delay(5000);
    }
  }
  
  Serial.println("✅ MPU9250 conectado y configurado");

  // ==== Configuración PID ====
  myPID.SetMode(AUTOMATIC);
  myPID.SetOutputLimits(-90, 90);
  myPID.SetSampleTime(5); // 5ms para coincidir con delay del loop

  // ==== PWM para servo ====
  ledcSetup(0, 50, 16); // Canal 0, 50Hz, 16 bits de resolución
  ledcAttachPin(PIN_SERVO, 0);
}

void loop() {
  // ====== TAREA 1: Lectura MPU ======
  //digitalWrite(PIN_TEST, HIGH);
  digitalWrite(PIN_TEST2, HIGH);
  
  // Leer datos del MPU9250
  if (mpu.update()) {
    // Obtener datos (ya en unidades físicas)
    ax = mpu.getAccX(); // en g
    ay = mpu.getAccY();
    az = mpu.getAccZ();
    gx = mpu.getGyroX(); // en deg/s
    gy = mpu.getGyroY();
    gz = mpu.getGyroZ();
  }
  
  lastReadMicros = micros();

  //digitalWrite(PIN_TEST, LOW);

  // ====== TAREA 2: Filtro + PID ======
  float dt = 0.005; // ciclo ~200 Hz (ajustar si se desea más precisión)

  // Calcular ángulos (acelerómetro) - ax, ay, az ya están en unidades g
  float accelX = atan2f(ay, sqrtf(ax * ax + az * az)) * 180.0f / M_PI;
  float accelY = atan2f(-ax, sqrtf(ay * ay + az * az)) * 180.0f / M_PI;

  // Filtro complementario - gx, gy, gz ya están en grados/s
  angleX = ALPHA * (angleX_prev + gx * dt) + (1 - ALPHA) * accelX;
  angleY = ALPHA * (angleY_prev + gy * dt) + (1 - ALPHA) * accelY;
  angleX_prev = angleX;
  angleY_prev = angleY;
  angleX = angleX - 3;
  
  // Actualizar entrada del PID y calcular
  pidInput = angleX;
  myPID.Compute();
  
  // ====== TAREA 3: Lectura de corriente ======
  // Leer sensor de corriente ACS712
  int adcValue = analogRead(PIN_ACS712);
  
  // Convertir a voltaje
  float voltage = (adcValue * ADC_VOLTAGE) / ADC_RESOLUTION;
  
  // Calcular corriente
  float offsetVoltage = (currentOffset * ADC_VOLTAGE) / ADC_RESOLUTION;
  float voltageDiff = voltage - offsetVoltage;
  current_A = voltageDiff / ACS712_SENSITIVITY;
  
  float output = pidOutput;
 
  // Servo control - Rango completo 270°
  /* Mapeo para servo de 270°: 500µs = 0°, 2500µs = 270° */
  int pwm_us = map(output, -90, 90, 1638, 4000);
   
  int duty = (int)(pwm_us); // 20 ms período
  ledcWrite(0, duty); // Canal 0
  

  // Mostrar datos
  Serial.printf("AngX: %.2f\tPID: %.2f\tCorriente: %.2f A\n", pidInput, pidOutput, current_A);
  digitalWrite(PIN_TEST2, LOW);

  // Mantener frecuencia ~200 Hz mejorable a 500 Hz con 2 ms de delay mas de 500Hz no viable 
  delay(5);
}