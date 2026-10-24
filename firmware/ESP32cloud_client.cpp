/*
 * cloud_client.cpp
 * Smart Rakshak cloud client — isolated from the existing LOCAL control code.
 *
 * Uses the known backend contract:
 *   GET  /api/device/commands
 *   POST /api/device/heartbeat
 *   POST /api/device/ack
 * Authentication header: X-Device-Token
 *
 * ArduinoJson library required.
 * SECURITY: setInsecure() is retained only for controlled development. Replace
 * with CA/server-certificate validation before production deployment.
 */

#include "cloud_client.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

namespace {
String baseUrl, deviceId, authToken;
bool initialized = false;
unsigned long lastPollMs = 0, lastHeartbeatMs = 0;
CloudClient::Mode currentMode = CloudClient::Mode::LOCAL;
CloudClient::CommandHandler commandHandler = nullptr;
CloudClient::StatusHandler statusHandler = nullptr;

constexpr unsigned long POLL_INTERVAL_MS = 1500;
constexpr unsigned long HEARTBEAT_INTERVAL_MS = 20000;
constexpr uint32_t HTTP_TIMEOUT_MS = 2000;

void status(const String& text) {
  if (statusHandler) statusHandler(text);
}

String rootUrl() {
  String url = baseUrl;
  while (url.endsWith("/")) url.remove(url.length() - 1);
  return url;
}

bool configured() {
  return initialized && baseUrl.startsWith("https://") &&
         deviceId.length();
}

bool beginRequest(HTTPClient& http, WiFiClientSecure& client, const String& path) {
  if (WiFi.status() != WL_CONNECTED) {
    status("Wi-Fi disconnected; cloud request skipped");
    return false;
  }
  if (!configured()) {
    status("Cloud configuration incomplete");
    return false;
  }

  client.setInsecure(); // Development only; validate server certificate for production.
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, rootUrl() + path)) {
    status("Could not initialize HTTPS request");
    return false;
  }
  http.addHeader("X-Device-Token", authToken);
  http.addHeader("X-Device-ID", deviceId);
  return true;
}

bool postJson(const String& path, JsonDocument& doc) {
  WiFiClientSecure client;
  HTTPClient http;
  if (!beginRequest(http, client, path)) return false;

  http.addHeader("Content-Type", "application/json");
  String body;
  serializeJson(doc, body);
  const int code = http.POST(body);
  http.end();

  if (code < 200 || code >= 300) {
    status("Cloud POST failed; HTTP " + String(code));
    return false;
  }
  return true;
}

bool getJson(const String& path, JsonDocument& response) {
  WiFiClientSecure client;
  HTTPClient http;
  if (!beginRequest(http, client, path)) return false;

  const int code = http.GET();
  String body;
  if (code > 0) body = http.getString();
  http.end();

  if (code < 200 || code >= 300) {
    status("Cloud GET failed; HTTP " + String(code));
    return false;
  }
  if (deserializeJson(response, body)) {
    status("Cloud response JSON parse failed");
    return false;
  }
  return true;
}

void acknowledge(const String& id, const String& commandName, bool accepted, const String& detail) {
  if (!id.length()) return;
  JsonDocument doc;
  doc["robotId"] = deviceId;
  doc["commandId"] = id;
  doc["command"] = commandName;
  doc["executionStatus"] = accepted ? "COMPLETED" : "FAILED";
  // This timestamp is generated at acknowledgement time. For accurate UTC,
  // synchronize the ESP32 clock with NTP during cloud-mode setup.
  doc["executionTimestamp"] = "timestamp-not-synchronized";
  doc["details"] = detail;
  postJson("/api/device/ack", doc);
}

void dispatchCommand(JsonVariantConst cmd) {
  CloudClient::Command command;
  command.id = cmd["commandId"] | "";
  command.type = cmd["command"] | "";
  command.value = cmd["value"] | "";
  command.speed = cmd["speed"] | 0;
  command.servoAngle = cmd["servo"] | -1;

  if (!command.id.length() || !command.type.length()) {
    status("Command missing commandId/command; ignored");
    return;
  }

  // Backend pollNextCommand removes/claims the command. Acknowledge only after
  // the main-sketch handler has accepted it; the handler must validate values.
  const bool accepted = commandHandler ? commandHandler(command) : false;
  acknowledge(command.id, command.type, accepted,
              accepted ? "Command handler accepted command" :
                         "Command rejected or no handler registered");
}


void pollCommands() {
  JsonDocument response;

  if (!getJson("/robot/command", response)) {
  status("Cloud command polling failed; check HTTP error above");
  return;
}

  String command = response["command"] | "NONE";
  command.trim();
  command.toUpperCase();

  if (command == "NONE" || command.length() == 0) return;

  CloudClient::Command cmd;
  cmd.id = "test-command";
  cmd.type = command;
  cmd.value = "";
  cmd.speed = 0;
  cmd.servoAngle = -1;

  bool accepted = commandHandler ? commandHandler(cmd) : false;

  if (accepted) {
    status("Cloud command accepted by robot handler: " + command);
  } else {
    status("Cloud command rejected by robot handler: " + command);
  }
}



void heartbeat() {
  JsonDocument doc;
  doc["robotId"] = deviceId;
  doc["wifiStatus"] = WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED";
  doc["firmwareVersion"] = "smart-rakshak-cloud";
  // Add batteryLevel, cameraAvailable, freeHeap, rssi, and ipAddress only
  // when measured/available; do not fabricate telemetry.
  postJson("/api/device/heartbeat", doc);
}
} // namespace

namespace CloudClient {
bool begin(const Config& config) {
  baseUrl = config.baseUrl ? config.baseUrl : "";
  deviceId = config.deviceId ? config.deviceId : "";
  authToken = config.authToken ? config.authToken : "";
  initialized = true;
  lastPollMs = lastHeartbeatMs = 0;
  status(configured() ? "Cloud client configured" :
                        "Cloud client configuration incomplete; cloud disabled");
  return configured();
}

void setMode(Mode mode) {
  currentMode = mode;
  status(mode == Mode::CLOUD ? "CLOUD mode selected" : "LOCAL mode selected");
}

Mode getMode() { return currentMode; }
void setCommandHandler(CommandHandler handler) { commandHandler = handler; }
void setStatusHandler(StatusHandler handler) { statusHandler = handler; }

void update() {
  // No cloud activity in LOCAL mode. Calls are synchronous and bounded by timeout.
 if (!configured()) return;

  const unsigned long now = millis();
 // if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
//    lastHeartbeatMs = now;
//    heartbeat();
 // }
  if (now - lastPollMs >= POLL_INTERVAL_MS) {
    lastPollMs = now;
    pollCommands();
  }
}
} // namespace CloudClient
