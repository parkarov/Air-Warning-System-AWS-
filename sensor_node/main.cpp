#include <Arduino.h>
#include <DHT.h>

#define DHT_PIN   4 
#define DHT_TYPE  DHT11
#define SOUND_PIN 1 
#define LDR_PIN   2 

DHT dht(DHT_PIN, DHT_TYPE);

int readAnalogAvg(int pin, int samples = 10) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(200);
  }
  return sum / samples;
}

int readSoundLevel(int pin, int windowMs = 50) {
  int sMin = 4095, sMax = 0;
  unsigned long start = millis();
  while (millis() - start < windowMs) {
    int v = analogRead(pin);
    if (v < sMin) sMin = v;
    if (v > sMax) sMax = v;
  }
  return sMax - sMin;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  dht.begin();
  delay(1000);
  Serial.println("AWS sensor test started");
}

void loop() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  int sound  = readSoundLevel(SOUND_PIN);
  int light  = readAnalogAvg(LDR_PIN);

  if (isnan(temp) || isnan(hum)) {
    Serial.println("DHT11 read failed");
  } else {
    Serial.printf("Temp: %.1f C | Humidity: %.1f %% | Sound: %d | Light: %d\n",
                  temp, hum, sound, light);
  }

  delay(2000);   // DHT11 อ่านได้ไม่เกินประมาณ 1 ครั้ง/วินาที
}