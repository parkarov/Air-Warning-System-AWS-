#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <ESP32Servo.h>
#include <esp_mac.h>
#include <sys/time.h>
#include <stdarg.h>
#include <time.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include "secret.h"
#include "aws_protocol.h"

#define PIN_PM_VO        5
#define PIN_PM_LED       10
#define PIN_MQ135        8
#define PIN_SERVO        4

#define PM_DIVIDER_RATIO 1.5f
#define MQ_DIVIDER_RATIO 1.5f
#define PM_CLEAN_AIR_V   0.6f
#define GAS_CLEAN_MV     800.0f
#define GAS_BAD_MV       2500.0f
#define GAS_WARMUP_MS    120000UL

#define NOISE_FULL_SCALE 1500.0f

#define GAUGE_NODE_ID    1
#define NODE_STALE_MS    150000UL
#define AIR_PERIOD_MS    10000UL

#define BUF_CAP          64
#define SIM_PERIOD_MS    60000
#define MAX_NODES        8

#define AWS_IOT_PUBLISH_TOPIC "esp32/pub"
#define WIFI_TIMEOUT_MS       20000UL
#define NTP_TIMEOUT_MS        10000UL
#define SERIAL_ECHO           1

#define LOG_ENABLED      0
#define OUTPUT_SIMULATED 0
#define SIM_NODE_ID_MIN  100

struct RxItem  { uint8_t mac[6]; uint8_t len; bool simulated; uint8_t data[32]; };
struct Record  { char topic[40]; char json[320]; };
struct AirReading { float pm25; float gasIdx; bool gasWarm; };
struct NodeState { bool used; uint8_t id; SensorPacket pkt; uint32_t lastRxMs; float score; };
struct Features { float tempC, humidity, noiseNorm, lightNorm, pm25, gasIdx; };

static_assert(sizeof(SensorPacket) <= 32, "SensorPacket must fit RxItem.data");

static QueueHandle_t rawQ, sampleQ, uploadQ;
static Servo gauge;
static AirReading gAir = {0, 0, false};
static NodeState gNodes[MAX_NODES];
static SemaphoreHandle_t gSerialMux;
static WiFiClientSecure gNet;
static MQTTClient gMqtt(512);

static void logf(const char *fmt, ...) {
#if LOG_ENABLED
  char buf[160];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  if (gSerialMux) xSemaphoreTake(gSerialMux, portMAX_DELAY);
  Serial.print("# ");
  Serial.println(buf);
  if (gSerialMux) xSemaphoreGive(gSerialMux);
#else
  (void)fmt;
#endif
}

static void warnf(const char *fmt, ...) {
  char buf[160];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  if (gSerialMux) xSemaphoreTake(gSerialMux, portMAX_DELAY);
  Serial.print("# WARNING: ");
  Serial.println(buf);
  if (gSerialMux) xSemaphoreGive(gSerialMux);
}

static void emitRecord(const char *json) {
  if (gSerialMux) xSemaphoreTake(gSerialMux, portMAX_DELAY);
  Serial.println(json);
  if (gSerialMux) xSemaphoreGive(gSerialMux);
}

static int64_t timestampMs(bool &synced) {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  synced = tv.tv_sec > 1700000000L;
  if (!synced) return (int64_t)millis();
  return (int64_t)tv.tv_sec * 1000 + tv.tv_usec / 1000;
}

static float clamp01(float x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

static float trapezoid(float x, float loBad, float loOk, float hiOk, float hiBad) {
  if (x <= loBad || x >= hiBad) return 0;
  if (x < loOk) return (x - loBad) / (loOk - loBad);
  if (x > hiOk) return (hiBad - x) / (hiBad - hiOk);
  return 1;
}
static float falling(float x, float ok, float bad) { return clamp01((bad - x) / (bad - ok)); }

static float predictComfort(const Features &f) {
  float sTemp  = trapezoid(f.tempC, 18, 23, 26, 32);
  float sHum   = trapezoid(f.humidity, 20, 40, 60, 85);
  float sNoise = falling(f.noiseNorm, 0.15f, 0.70f);
  float sLight = trapezoid(f.lightNorm, 0.05f, 0.25f, 0.80f, 1.0f);
  float sPm    = falling(f.pm25, 15, 75);
  float sGas   = falling(f.gasIdx, 20, 80);

  float weighted = 0.25f * sTemp + 0.10f * sHum + 0.20f * sNoise +
                   0.10f * sLight + 0.20f * sPm + 0.15f * sGas;
  float worst = sTemp;
  float all[] = {sHum, sNoise, sLight, sPm, sGas};
  for (float v : all) if (v < worst) worst = v;
  return 100.0f * (0.7f * weighted + 0.3f * worst);
}

static const char *comfortLabel(float s) { return s >= 75 ? "GOOD" : (s >= 50 ? "FAIR" : "POOR"); }

static float readPm25() {
  const int N = 20;
  float sumMv = 0;
  for (int i = 0; i < N; i++) {
    digitalWrite(PIN_PM_LED, LOW);
    delayMicroseconds(280);
    sumMv += analogReadMilliVolts(PIN_PM_VO);
    delayMicroseconds(40);
    digitalWrite(PIN_PM_LED, HIGH);
    delayMicroseconds(9680);
  }
  float v = (sumMv / N) / 1000.0f * PM_DIVIDER_RATIO;
  float ug = (v - PM_CLEAN_AIR_V) * 200.0f;
  return ug < 0 ? 0 : ug;
}

static float readGasIndex(bool &warm) {
  warm = millis() > GAS_WARMUP_MS;
  float sum = 0;
  for (int i = 0; i < 16; i++) sum += analogReadMilliVolts(PIN_MQ135);
  float mv = (sum / 16) * MQ_DIVIDER_RATIO;
  float idx = (mv - GAS_CLEAN_MV) / (GAS_BAD_MV - GAS_CLEAN_MV) * 100.0f;
  idx = idx < 0 ? 0 : (idx > 100 ? 100 : idx);
  return warm ? idx : 0;
}

static void onRecv(ESPNOW_RECV_ARGS) {
  if (len <= 0 || len > (int)sizeof(((RxItem *)0)->data)) return;
  RxItem it;
  memcpy(it.mac, ESPNOW_SRC_MAC, 6);
  it.len = (uint8_t)len;
  it.simulated = false;
  memcpy(it.data, data, len);
  xQueueSend(rawQ, &it, 0);
}

static void sendAck(const uint8_t *mac, uint8_t nodeId, uint8_t seq) {
  if (!esp_now_is_peer_exist(mac)) {
    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, mac, 6);
    peer.channel = 0;
    peer.ifidx = WIFI_IF_STA;
    peer.encrypt = false;
    if (esp_now_add_peer(&peer) != ESP_OK) return;
  }
  AckPacket a;
  a.version = AWS_PROTO_VERSION;
  a.type = PKT_ACK;
  a.nodeId = nodeId;
  a.seq = seq;
  a.crc = aws_crc8((const uint8_t *)&a, sizeof(a) - 1);
  esp_now_send(mac, (const uint8_t *)&a, sizeof(a));
}

static void printMac() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  logf("gw MAC (paste into node GATEWAY_MAC): 0x%02X, 0x%02X, 0x%02X, 0x%02X, 0x%02X, 0x%02X",
       mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static void rxTask(void *) {
  static int16_t lastSeq[256];
  for (int i = 0; i < 256; i++) lastSeq[i] = -1;

  for (;;) {
    RxItem it;
    xQueueReceive(rawQ, &it, portMAX_DELAY);

    if (it.len != sizeof(SensorPacket)) { logf("rx bad length, dropped"); continue; }
    SensorPacket p;
    memcpy(&p, it.data, sizeof(p));
    if (p.version != AWS_PROTO_VERSION || p.type != PKT_DATA ||
        p.crc != aws_crc8((const uint8_t *)&p, sizeof(p) - 1)) {
      logf("rx bad header/CRC, dropped");
      continue;
    }

    if (!it.simulated) sendAck(it.mac, p.nodeId, p.seq);

    if (p.seq == lastSeq[p.nodeId]) {
      logf("rx duplicate node=%u seq=%u", p.nodeId, p.seq);
      continue;
    }
    lastSeq[p.nodeId] = p.seq;

    if (xQueueSend(sampleQ, &p, 0) != pdTRUE) logf("rx sampleQ full, dropped");
  }
}

static NodeState *findNode(uint8_t id, bool create) {
  for (auto &n : gNodes) if (n.used && n.id == id) return &n;
  if (!create) return nullptr;
  for (auto &n : gNodes) if (!n.used) { n = NodeState(); n.used = true; n.id = id; return &n; }
  return nullptr;
}

static void handlePacket(const SensorPacket &p) {
  NodeState *n = findNode(p.nodeId, true);
  if (!n) { logf("ai node table full, dropped"); return; }

  Features f;
  f.tempC     = p.tempC;
  f.humidity  = p.humidity;
  f.noiseNorm = clamp01(p.noise / NOISE_FULL_SCALE);
  f.lightNorm = clamp01(p.light / 4095.0f);
  f.pm25      = gAir.pm25;
  f.gasIdx    = gAir.gasIdx;
  float score = predictComfort(f);

  n->pkt = p;
  n->lastRxMs = millis();
  n->score = score;

  bool synced;
  int64_t ts = timestampMs(synced);

  if (!OUTPUT_SIMULATED && p.nodeId >= SIM_NODE_ID_MIN) return;

  Record r;
  snprintf(r.topic, sizeof(r.topic), "%s", AWS_IOT_PUBLISH_TOPIC);
  int len = snprintf(r.json, sizeof(r.json),
           "{\"device_id\":\"node-%u\",\"ts\":%lld,\"ts_synced\":%s,\"seq\":%u,\"uptime_ms\":%lu,"
           "\"temp_c\":%.1f,\"humidity\":%.1f,\"light\":%u,\"noise\":%u,"
           "\"pm25\":%.1f,\"gas_idx\":%.1f,\"gas_warm\":%s,"
           "\"comfort\":%.1f,\"label\":\"%s\",\"gw_ms\":%lu,\"simulated\":%s}",
           p.nodeId, (long long)ts, synced ? "true" : "false", p.seq, (unsigned long)p.uptimeMs,
           p.tempC, p.humidity, p.light, p.noise,
           gAir.pm25, gAir.gasIdx, gAir.gasWarm ? "true" : "false",
           score, comfortLabel(score), (unsigned long)millis(),
           p.nodeId >= SIM_NODE_ID_MIN ? "true" : "false");
  if (len < 0 || len >= (int)sizeof(r.json)) {
    logf("ai record too long, dropped node=%u seq=%u", p.nodeId, p.seq);
    return;
  }
  if (xQueueSend(uploadQ, &r, 0) != pdTRUE) logf("ai uploadQ full, dropped");
}

static void updateGauge() {
  static float gaugeScore = 0;
  static bool init = false;
  static uint8_t logDiv = 0;

  NodeState *n = findNode(GAUGE_NODE_ID, false);
  if (!n || millis() - n->lastRxMs > NODE_STALE_MS) {
    if (logDiv++ % 10 == 0) logf("gauge node missing/stale, holding position");
    return;
  }
  if (!init) { gaugeScore = n->score; init = true; }
  else gaugeScore += 0.3f * (n->score - gaugeScore);

  int angle = (int)((100.0f - gaugeScore) * 1.8f);
  gauge.write(angle);
  if (logDiv++ % 5 == 0) logf("gauge node=%u score=%.1f angle=%d", GAUGE_NODE_ID, gaugeScore, angle);
}

static void senseAiTask(void *) {
  uint32_t lastAir = 0, lastGauge = 0;
  bool first = true;
  for (;;) {
    if (first || millis() - lastAir >= AIR_PERIOD_MS) {
      gAir.pm25   = readPm25();
      gAir.gasIdx = readGasIndex(gAir.gasWarm);
      lastAir = millis();
      first = false;
      logf("air pm25=%.1f ug/m3 gas_idx=%.1f%s", gAir.pm25, gAir.gasIdx,
           gAir.gasWarm ? "" : " (MQ-135 warming up)");
    }
    SensorPacket p;
    if (xQueueReceive(sampleQ, &p, pdMS_TO_TICKS(250)) == pdTRUE) handlePacket(p);
    if (millis() - lastGauge >= 1000) { updateGauge(); lastGauge = millis(); }
  }
}

static void onMqttMessage(String &topic, String &payload) {
  logf("incoming: %s - %s", topic.c_str(), payload.c_str());
}

static bool cloudEnsureConnected() {
  static uint32_t nextAttempt = 0;
  if (WiFi.status() == WL_CONNECTED && gMqtt.connected()) return true;
  if (millis() < nextAttempt) return false;
  nextAttempt = millis() + 5000;

  if (WiFi.status() != WL_CONNECTED) {
    logf("cloud Wi-Fi down, reconnecting");
    WiFi.reconnect();
    return false;
  }
  logf("cloud connecting to AWS IoT");
  if (!gMqtt.connect(THINGNAME)) {
    logf("cloud MQTT connect failed (err %d)", (int)gMqtt.lastError());
    return false;
  }
  gMqtt.subscribe("esp32/sub");
  logf("cloud AWS IoT connected");
  return true;
}

static bool cloudPublish(const char *topic, const char *payload) {
  if (!cloudEnsureConnected()) return false;
  if (!gMqtt.publish(topic, payload)) {
    logf("cloud publish failed (err %d)", (int)gMqtt.lastError());
    return false;
  }
#if SERIAL_ECHO
  emitRecord(payload);
#endif
  return true;
}

static void uploadTask(void *) {
  static Record ring[BUF_CAP];
  int head = 0, count = 0;
  uint32_t nextTry = 0;
  bool wasDown = false;

  for (;;) {
    Record r;
    if (gMqtt.connected()) gMqtt.loop();
    if (xQueueReceive(uploadQ, &r, pdMS_TO_TICKS(500)) == pdTRUE) {
      if (count == BUF_CAP) {
        head = (head + 1) % BUF_CAP;
        count--;
        logf("upload buffer full, oldest record dropped");
      }
      ring[(head + count) % BUF_CAP] = r;
      count++;
    }

    if (count == 0) cloudEnsureConnected();
    if (count > 0 && millis() >= nextTry) {
      while (count > 0) {
        if (!cloudPublish(ring[head].topic, ring[head].json)) {
          if (!wasDown) logf("upload cloud down, buffering");
          wasDown = true;
          nextTry = millis() + 3000;
          break;
        }
        if (wasDown) { logf("upload cloud back, flushing %d", count); wasDown = false; }
        head = (head + 1) % BUF_CAP;
        count--;
      }
      if (count > 0) logf("upload buffered=%d", count);
    }
  }
}

static float jitter(float amp) { return (random(-1000, 1001) / 1000.0f) * amp; }

static void simNodeTask(void *) {
  struct Sim { uint8_t id; float t, h; uint16_t light, noise; uint8_t seq; };
  Sim sims[2] = {
    {101, 24.5f, 50.0f, 2000,  60, 0},
    {102, 31.0f, 78.0f,  900, 700, 0},
  };
  for (;;) {
    for (auto &s : sims) {
      SensorPacket p;
      p.version  = AWS_PROTO_VERSION;
      p.type     = PKT_DATA;
      p.nodeId   = s.id;
      p.seq      = s.seq++;
      p.uptimeMs = millis();
      p.tempC    = s.t + jitter(0.5f);
      p.humidity = s.h + jitter(2.0f);
      p.light    = s.light + (int)jitter(150);
      p.noise    = s.noise + (int)jitter(30);
      p.crc      = aws_crc8((const uint8_t *)&p, sizeof(p) - 1);

      RxItem it = {};
      it.len = sizeof(p);
      it.simulated = true;
      memcpy(it.data, &p, sizeof(p));
      xQueueSend(rawQ, &it, 0);
      if (random(0, 10) == 0) xQueueSend(rawQ, &it, 0);

      vTaskDelay(pdMS_TO_TICKS(1000));
    }
    vTaskDelay(pdMS_TO_TICKS(SIM_PERIOD_MS - 2000));
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  gSerialMux = xSemaphoreCreateMutex();

  pinMode(PIN_PM_LED, OUTPUT);
  digitalWrite(PIN_PM_LED, HIGH);
  analogReadResolution(12);

  gauge.setPeriodHertz(50);
  gauge.attach(PIN_SERVO, 500, 2400);
  gauge.write(90);

  rawQ    = xQueueCreate(16, sizeof(RxItem));
  sampleQ = xQueueCreate(16, sizeof(SensorPacket));
  uploadQ = xQueueCreate(16, sizeof(Record));
  if (!rawQ || !sampleQ || !uploadQ) { logf("gw queue alloc failed"); while (true) delay(1000); }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < WIFI_TIMEOUT_MS) delay(250);

  if (WiFi.status() == WL_CONNECTED) {
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    t0 = millis();
    while (time(nullptr) < 1700000000L && millis() - t0 < NTP_TIMEOUT_MS) delay(250);
    if (time(nullptr) < 1700000000L) warnf("NTP time not set, ts will be uptime and TLS may fail");

    if (WiFi.channel() != ESPNOW_CHANNEL)
      warnf("router is on Wi-Fi channel %d but ESPNOW_CHANNEL is %d: set ESPNOW_CHANNEL to %d in aws_protocol.h on the gateway AND every node",
            WiFi.channel(), ESPNOW_CHANNEL, WiFi.channel());
  } else {
    warnf("Wi-Fi not connected (check WIFI_SSID/WIFI_PASSWORD, 2.4 GHz only). Records will buffer; retrying in background.");
    esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  }
  logf("gw MAC (paste into node GATEWAY_MAC): %s", WiFi.macAddress().c_str());

  gNet.setCACert(AWS_CERT_CA);
  gNet.setCertificate(AWS_CERT_CRT);
  gNet.setPrivateKey(AWS_CERT_PRIVATE);
  gMqtt.begin(AWS_IOT_ENDPOINT, 8883, gNet);
  gMqtt.setOptions(60, true, 5000);
  gMqtt.onMessage(onMqttMessage);

  if (esp_now_init() != ESP_OK) { logf("gw ESP-NOW init failed"); while (true) delay(1000); }
  esp_now_register_recv_cb(onRecv);

  xTaskCreate(rxTask,      "rx",     4096, nullptr, 5, nullptr);
  xTaskCreate(senseAiTask, "senseAI", 6144, nullptr, 3, nullptr);
  xTaskCreate(uploadTask,  "upload", 12288, nullptr, 1, nullptr);
  xTaskCreate(simNodeTask, "sim",    4096, nullptr, 2, nullptr);
  logf("gw started");
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(60000));
}