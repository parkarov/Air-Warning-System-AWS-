#include <Arduino.h>
#include <DHT.h>

#define RX_PIN 18
#define TX_PIN 17

#define DHT_PIN   4
#define DHT_TYPE  DHT11
#define SOUND_AO  5
#define SOUND_DO  6
#define LDR_HAS_ANALOG 0   // 1 = โมดูล 4 pin (มี AO), 0 = โมดูล 3 pin (มีแค่ DO)
#define LDR_PIN 7          // 4 pin: ต่อ AO / 3 pin: ต่อ DO

#define BUFFER_SIZE 2048
#define SEND_INTERVAL_MS 1000   // DHT11 อ่านได้ไม่เร็วกว่า ~1 วินาที/ครั้ง
#define SOUND_WINDOW_MS  50     // ช่วงเวลาเก็บตัวอย่างเสียง

DHT dht(DHT_PIN, DHT_TYPE);

uint32_t seq = 0;
unsigned long lastSend = 0;
float lastTemp = NAN, lastHum = NAN;

// วัดความดังเสียง: KY-037 ให้สัญญาณ AC รอบค่ากลาง
// จึงหา peak-to-peak ในช่วงเวลาสั้น ๆ แทนการอ่านค่าเดียว
int readSoundP2P() {
  int vmin = 4095, vmax = 0;
  unsigned long t0 = millis();
  while (millis() - t0 < SOUND_WINDOW_MS) {
    int v = analogRead(SOUND_AO);
    if (v < vmin) vmin = v;
    if (v > vmax) vmax = v;
  }
  return vmax - vmin;
}

uint8_t xorChecksum(const char *s) {
  uint8_t cs = 0;
  while (*s) cs ^= (uint8_t)*s++;
  return cs;
}

void setup() {
  Serial.setRxBufferSize(BUFFER_SIZE);
  Serial.begin(1000000);

  Serial2.setRxBufferSize(BUFFER_SIZE);
  Serial2.setTxBufferSize(BUFFER_SIZE);
  Serial2.begin(1000000, SERIAL_8N1, RX_PIN, TX_PIN);

  analogReadResolution(12);          // 0-4095
  pinMode(SOUND_DO, INPUT);
  #if !LDR_HAS_ANALOG
    pinMode(LDR_PIN, INPUT);
  #endif
  dht.begin();
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) lastTemp = t;       // ถ้าอ่านพลาด ใช้ค่าล่าสุดแทน
  if (!isnan(h)) lastHum  = h;

  int soundP2P = readSoundP2P();
  int soundDig = digitalRead(SOUND_DO);

#if LDR_HAS_ANALOG
  int light = analogRead(LDR_PIN);   // 0-4095
#else
  int light = digitalRead(LDR_PIN);  // 0 หรือ 1
#endif

  char body[96];
  snprintf(body, sizeof(body), "%lu,%.1f,%.1f,%d,%d,%d",
           (unsigned long)seq++, lastTemp, lastHum, soundP2P, soundDig, light);

  char packet[128];
  snprintf(packet, sizeof(packet), "$%s*%02X\n", body, xorChecksum(body));

  Serial.print(packet);    // ไป PC
  Serial2.print(packet);   // ไปอุปกรณ์ปลายทางผ่าน UART
}