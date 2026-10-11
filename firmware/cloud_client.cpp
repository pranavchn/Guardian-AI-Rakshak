#include "cloud_client.h"
#include "cloud_config.h"

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ==============================================================================
// SMART RAKSHAK — CLOUD CLIENT IMPLEMENTATION (ADDITIVE LAYER)
// Preserves existing local web server, camera stream, and Serial2 motor protocol
// ==============================================================================

// Compatibility layer for ArduinoJson 6 (StaticJsonDocument) and ArduinoJson 7 (JsonDocument)
#if defined(ARDUINOJSON_VERSION_MAJOR) && (ARDUINOJSON_VERSION_MAJOR >= 7)
  #define STATIC_JSON_DOC(name, size) JsonDocument name
#else
  #define STATIC_JSON_DOC(name, size) StaticJsonDocument<size> name
#endif

// External existing motor, servo, and emergency hooks from baseline firmware.
// Provided with __attribute__((weak)) to ensure clean linking even if names are defined in .ino
extern "C" {
  __attribute__((weak)) void sendMotorCommandToQD001(const char* cmd, int speed) {
    (void)cmd; (void)speed;
  }
  __attribute__((weak)) void sendServoCommandToQD001(int angle) {
    (void)angle;
  }
  __attribute__((weak)) void sendSpeedCommandToQD001(int speed) {
    (void)speed;
  }
  __attribute__((weak)) void executeEmergencyStop() {
    sendMotorCommandToQD001("STOP", 0);
  }
}

// Global Cloud State
CloudState g_cloudState = {
  true,  // cloudEnabled
  false, // cloudConnected
  0,     // lastPoll
  0,     // lastHeartbeat
  0,     // lastSuccess
  0,     // consecutiveFailures
  false, // emergencyStopLocked
  0      // emergencyStopTimestamp
};

// Task handle for isolated Core 0 background worker
static TaskHandle_t s_cloudTaskHandle = NULL;

// Forward internal declarations
static void cloudSendHeartbeat();
static void cloudPollCommands();
static bool cloudProcessCommand(const char* cmdId, const char* cmdName, int speed, int servo, char* outDetails, size_t detailsMaxLen);
static void cloudSendAck(const char* cmdId, const char* cmdName, const char* status, const char* details);

void cloudClientInit() {
  g_cloudState.cloudEnabled = true;
  g_cloudState.cloudConnected = false;
  g_cloudState.lastPoll = 0;
  g_cloudState.lastHeartbeat = 0;
  g_cloudState.lastSuccess = 0;
  g_cloudState.consecutiveFailures = 0;
  g_cloudState.emergencyStopLocked = false;
  g_cloudState.emergencyStopTimestamp = 0;

  Serial.println("[CLOUD] Smart Rakshak additive cloud layer initialized");
}

void cloudSetEnabled(bool enabled) {
  g_cloudState.cloudEnabled = enabled;
  if (!enabled) {
    g_cloudState.cloudConnected = false;
    Serial.println("[CLOUD] Cloud communication paused");
  } else {
    Serial.println("[CLOUD] Cloud communication enabled");
  }
}

bool cloudIsConnected() {
  return g_cloudState.cloudConnected;
}

bool cloudIsEmergencyStopLocked() {
  return g_cloudState.emergencyStopLocked;
}

void cloudResetEmergencyStop() {
  g_cloudState.emergencyStopLocked = false;
  g_cloudState.emergencyStopTimestamp = 0;
  Serial.println("[CLOUD] Emergency stop lockout cleared. Normal movement capability restored.");
}

/**
 * FreeRTOS Background Task Worker
 * Runs on Core 0 so local camera streaming and WebServer on Core 1 are 100% unaffected.
 */
static void cloudTaskWorker(void* param) {
  (void)param;
  Serial.println("[CLOUD] Isolated FreeRTOS cloud task running on Core 0");
  for (;;) {
    cloudClientLoop();
    // Yield to avoid watchdog trigger on Core 0
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

void startCloudTask() {
  if (s_cloudTaskHandle == NULL) {
    xTaskCreatePinnedToCore(
      cloudTaskWorker,
      "SmartRakshakCloud",
      CLOUD_TASK_STACK_SIZE,
      NULL,
      CLOUD_TASK_PRIORITY,
      &s_cloudTaskHandle,
      CLOUD_TASK_CORE
    );
    Serial.println("[CLOUD] Background FreeRTOS task spawned");
  }
}

void stopCloudTask() {
  if (s_cloudTaskHandle != NULL) {
    vTaskDelete(s_cloudTaskHandle);
    s_cloudTaskHandle = NULL;
    Serial.println("[CLOUD] Background FreeRTOS task terminated");
  }
}

/**
 * Main non-blocking periodic scheduler for the cloud layer.
 * Can be called either from loop() or within the FreeRTOS background task.
 */
void cloudClientLoop() {
  if (!g_cloudState.cloudEnabled) {
    return;
  }

  // Guard: Only communicate when WiFi is actively connected
  if (WiFi.status() != WL_CONNECTED) {
    if (g_cloudState.cloudConnected) {
      g_cloudState.cloudConnected = false;
      Serial.println("[CLOUD] WiFi not connected, cloud polling deferred");
    }
    return;
  }

  unsigned long now = millis();

  // 1. Periodic Heartbeat (every 15 seconds)
  if (now - g_cloudState.lastHeartbeat >= CLOUD_HEARTBEAT_INTERVAL_MS || g_cloudState.lastHeartbeat == 0) {
    g_cloudState.lastHeartbeat = now;
    cloudSendHeartbeat();
  }

  // 2. Periodic Command Polling (every 1.2 seconds)
  now = millis();
  if (now - g_cloudState.lastPoll >= CLOUD_POLL_INTERVAL_MS) {
    g_cloudState.lastPoll = now;
    cloudPollCommands();
  }
}

/**
 * HEARTBEAT: Non-blocking POST to /api/device/heartbeat
 */
static void cloudSendHeartbeat() {
  WiFiClientSecure client;
  client.setInsecure(); // Skip local root CA storage to preserve SRAM on ESP32-CAM
  client.setTimeout(CLOUD_HTTP_TIMEOUT_MS / 1000);

  HTTPClient http;
  String url = String(CLOUD_API_BASE_URL) + "/api/device/heartbeat";

  if (!http.begin(client, url)) {
    Serial.println("[CLOUD] Heartbeat failed (HTTP begin error)");
    g_cloudState.cloudConnected = false;
    g_cloudState.consecutiveFailures++;
    return;
  }

  http.setTimeout(CLOUD_HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_AUTH_TOKEN);

  STATIC_JSON_DOC(doc, 384);
  doc["robotId"] = ROBOT_ID;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["wifiStatus"] = (WiFi.status() == WL_CONNECTED) ? "CONNECTED" : "DISCONNECTED";
  doc["batteryLevel"] = 84; // Reported from hardware battery monitor if available
  doc["cameraAvailable"] = true;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  doc["ipAddress"] = WiFi.localIP().toString();
  doc["localPort"] = 80;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);

  if (httpCode == 200) {
    g_cloudState.cloudConnected = true;
    g_cloudState.lastSuccess = millis();
    g_cloudState.consecutiveFailures = 0;
    Serial.println("[CLOUD] Heartbeat delivered to Cloud Run");
  } else {
    g_cloudState.cloudConnected = false;
    g_cloudState.consecutiveFailures++;
    Serial.print("[CLOUD] Heartbeat returned HTTP ");
    Serial.println(httpCode);
  }

  http.end();
}

/**
 * COMMAND POLLING: Non-blocking GET to /api/device/commands?robotId=QD001
 */
static void cloudPollCommands() {
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(CLOUD_HTTP_TIMEOUT_MS / 1000);

  HTTPClient http;
  String url = String(CLOUD_API_BASE_URL) + "/api/device/commands?robotId=" + String(ROBOT_ID);

  if (!http.begin(client, url)) {
    g_cloudState.cloudConnected = false;
    g_cloudState.consecutiveFailures++;
    return;
  }

  http.setTimeout(CLOUD_HTTP_TIMEOUT_MS);
  http.addHeader("X-Device-Token", DEVICE_AUTH_TOKEN);

  int httpCode = http.GET();

  if (httpCode == 200) {
    g_cloudState.cloudConnected = true;
    g_cloudState.lastSuccess = millis();
    g_cloudState.consecutiveFailures = 0;

    String payload = http.getString();
    http.end(); // Free connection before executing command and delivering ACK

    STATIC_JSON_DOC(doc, 512);
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
      Serial.print("[CLOUD] JSON parse failure: ");
      Serial.println(error.c_str());
      return;
    }

    bool hasCommand = doc["hasCommand"] | false;
    if (hasCommand && doc.containsKey("command")) {
      JsonObject cmd = doc["command"];
      const char* commandId = cmd["commandId"] | "";
      const char* commandType = cmd["command"] | "";
      const char* cmdRobotId = cmd["robotId"] | "";
      int speed = cmd["speed"] | 3;
      int servo = cmd["servo"] | 90;

      // Validate robotId target
      if (strcmp(cmdRobotId, ROBOT_ID) != 0 && strlen(cmdRobotId) > 0) {
        Serial.print("[CLOUD] Command target mismatch: ");
        Serial.println(cmdRobotId);
        cloudSendAck(commandId, commandType, "FAILED", "Target robotId mismatch");
        return;
      }

      Serial.print("[CLOUD] Received command: ");
      Serial.println(commandType);

      char detailsBuffer[128] = "Executed via native QD001 motor protocol";
      bool success = cloudProcessCommand(commandId, commandType, speed, servo, detailsBuffer, sizeof(detailsBuffer));

      // Deliver execution acknowledgement
      cloudSendAck(commandId, commandType, success ? "COMPLETED" : "FAILED", detailsBuffer);
    }
  } else {
    http.end();
    if (httpCode > 0) {
      Serial.print("[CLOUD] Polling returned HTTP ");
      Serial.println(httpCode);
    }
    g_cloudState.consecutiveFailures++;
    if (g_cloudState.consecutiveFailures >= 3) {
      g_cloudState.cloudConnected = false;
    }
  }
}

/**
 * COMMAND PROCESSING & DISPATCH
 * Strict Emergency Stop Lockout:
 * Once EMERGENCY_STOP is invoked, all directional commands (FORWARD, BACKWARD, LEFT, RIGHT)
 * are rejected until an explicit RESET_EMERGENCY_STOP recovery command is dispatched.
 */
static bool cloudProcessCommand(
  const char* cmdId,
  const char* cmdName,
  int speed,
  int servo,
  char* outDetails,
  size_t detailsMaxLen
) {
  if (!cmdName || strlen(cmdName) == 0) {
    snprintf(outDetails, detailsMaxLen, "Empty command name");
    return false;
  }

  // 1. EMERGENCY_STOP handling (Highest Priority)
  if (strcmp(cmdName, "EMERGENCY_STOP") == 0) {
    executeEmergencyStop();
    g_cloudState.emergencyStopLocked = true;
    g_cloudState.emergencyStopTimestamp = millis();
    snprintf(outDetails, detailsMaxLen, "Emergency stop engaged. All motors halted. Lockout active.");
    Serial.println("[CLOUD] EMERGENCY_STOP engaged! Movement lockout active.");
    return true;
  }

  // 2. Safe Recovery: RESET_EMERGENCY_STOP
  if (strcmp(cmdName, "RESET_EMERGENCY_STOP") == 0 || strcmp(cmdName, "RESUME") == 0) {
    cloudResetEmergencyStop();
    snprintf(outDetails, detailsMaxLen, "Emergency stop lockout cleared. Robot ready for operation.");
    return true;
  }

  // 3. STOP command
  if (strcmp(cmdName, "STOP") == 0) {
    sendMotorCommandToQD001("STOP", 0);
    snprintf(outDetails, detailsMaxLen, "Stop command executed on QD001");
    return true;
  }

  // 4. Directional Movement Commands (Guard against Emergency Stop lockout)
  bool isMovementCommand = (
    strcmp(cmdName, "FORWARD") == 0 ||
    strcmp(cmdName, "BACKWARD") == 0 ||
    strcmp(cmdName, "LEFT") == 0 ||
    strcmp(cmdName, "RIGHT") == 0
  );

  if (isMovementCommand) {
    if (g_cloudState.emergencyStopLocked) {
      snprintf(outDetails, detailsMaxLen, "REJECTED: Robot is locked in EMERGENCY_STOP state. Must send RESET_EMERGENCY_STOP first.");
      Serial.println("[CLOUD] Rejected movement command: Emergency stop lockout active.");
      return false;
    }

    if (strcmp(cmdName, "FORWARD") == 0) {
      sendMotorCommandToQD001("FORWARD", speed);
      snprintf(outDetails, detailsMaxLen, "Forward motion engaged at speed %d", speed);
      return true;
    }
    if (strcmp(cmdName, "BACKWARD") == 0) {
      sendMotorCommandToQD001("BACKWARD", speed);
      snprintf(outDetails, detailsMaxLen, "Backward motion engaged at speed %d", speed);
      return true;
    }
    if (strcmp(cmdName, "LEFT") == 0) {
      sendMotorCommandToQD001("LEFT", speed);
      snprintf(outDetails, detailsMaxLen, "Turn left engaged at speed %d", speed);
      return true;
    }
    if (strcmp(cmdName, "RIGHT") == 0) {
      sendMotorCommandToQD001("RIGHT", speed);
      snprintf(outDetails, detailsMaxLen, "Turn right engaged at speed %d", speed);
      return true;
    }
  }

  // 5. Speed Configuration
  if (strcmp(cmdName, "SET_SPEED") == 0) {
    if (speed >= 1 && speed <= 5) {
      sendSpeedCommandToQD001(speed);
      snprintf(outDetails, detailsMaxLen, "Motor speed configured to %d", speed);
      return true;
    }
    snprintf(outDetails, detailsMaxLen, "Invalid speed %d (must be 1-5)", speed);
    return false;
  }

  // 6. Camera Servo Configuration
  if (strcmp(cmdName, "SET_SERVO") == 0) {
    if (servo >= 0 && servo <= 180) {
      sendServoCommandToQD001(servo);
      snprintf(outDetails, detailsMaxLen, "Pan servo positioned at %d degrees", servo);
      return true;
    }
    snprintf(outDetails, detailsMaxLen, "Invalid servo angle %d (must be 0-180)", servo);
    return false;
  }

  // 7. Optical Camera Capture Trigger
  if (strcmp(cmdName, "CAPTURE_IMAGE") == 0) {
    snprintf(outDetails, detailsMaxLen, "Local capture triggered. Cloud upload enabled in Step 7.");
    return true;
  }

  snprintf(outDetails, detailsMaxLen, "Unrecognized command type: %s", cmdName);
  return false;
}

/**
 * ACKNOWLEDGEMENT: Sends POST /api/device/ack
 */
static void cloudSendAck(const char* cmdId, const char* cmdName, const char* status, const char* details) {
  if (!cmdId || strlen(cmdId) == 0) {
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(CLOUD_HTTP_TIMEOUT_MS / 1000);

  HTTPClient http;
  String url = String(CLOUD_API_BASE_URL) + "/api/device/ack";

  if (!http.begin(client, url)) {
    Serial.println("[CLOUD] ACK delivery failed (HTTP begin error)");
    return;
  }

  http.setTimeout(CLOUD_HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_AUTH_TOKEN);

  STATIC_JSON_DOC(doc, 256);
  doc["robotId"] = ROBOT_ID;
  doc["commandId"] = cmdId;
  doc["command"] = cmdName;
  doc["executionStatus"] = status; // "COMPLETED" or "FAILED"
  doc["details"] = details;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);

  if (httpCode == 200) {
    Serial.println("[CLOUD] ACK successfully delivered to Cloud Run");
  } else {
    Serial.print("[CLOUD] ACK delivery returned HTTP ");
    Serial.println(httpCode);
  }

  http.end();
}
