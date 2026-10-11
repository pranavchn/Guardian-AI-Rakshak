# Smart Rakshak — Additive ESP32-CAM Cloud Layer (Step 6B)

This directory contains the production-grade, additive Cloud Communication Layer for the **ACEBOTT QD001 ESP32-CAM** robot.

---

## 1. Safety & Architecture Baseline Guarantees

1. **Zero Modifications to Local Functions**:
   - The local camera web server (`Port 80`), local car control WebServer (`Port 81`), and native `WiFiServer` (`Port 100`) remain 100% untouched.
   - Local driving via `/control` and streaming via `/stream` and `/capture` continue working at $< 10\text{ ms}$ latency even if Internet/Cloud is offline.
2. **Native QD001 Serial2 Motor Protocol Preserved**:
   - The existing hardware UART connection (`Serial2` at 115200 baud) is reused directly.
   - Cloud commands are mapped to the existing motor dispatch functions; no synthetic serial packets or speed protocols are introduced.
3. **Emergency Stop Lockout & Safe Recovery**:
   - When `EMERGENCY_STOP` is triggered (via Cloud Run, Web UI, or local watchdog), all motors halt immediately.
   - The firmware enters an **Emergency Stop Lockout** state (`g_cloudState.emergencyStopLocked = true`).
   - Any queued, in-flight, delayed, or duplicate movement commands (`FORWARD`, `BACKWARD`, `LEFT`, `RIGHT`) arriving while locked are **immediately rejected** with HTTP ACK `FAILED`.
   - Motion is restored only when an explicit `RESET_EMERGENCY_STOP` command is dispatched from the operator.
4. **Cloud Run Service Separation**:
   - The existing `qd002-test` Cloud Run service (`https://qd002-test-341464014035.asia-southeast1.run.app`) is exclusively a baseline connectivity probe and is strictly preserved without modification.
   - Smart Rakshak robot commands and telemetry communicate with the dedicated Cloud Run service specified in `cloud_config.h`.

---

## 2. File Manifest

| File | Purpose |
| :--- | :--- |
| `cloud_config.h` | Configuration constants: Cloud Run URL, Robot ID, Token policy, intervals, and timeouts. |
| `cloud_client.h` | Header declaring `cloudClientInit()`, `cloudClientLoop()`, `startCloudTask()`, and safety functions. |
| `cloud_client.cpp` | Implementation of non-blocking HTTPS client, heartbeat, command poller, E-Stop lockout, and ACK dispatcher. |
| `README.md` | This technical integration guide. |

---

## 3. How to Integrate into `acebott-esp32-car-camera.ino`

Integration requires only **3 lines of code** in your main sketch:

```cpp
// 1. Include the additive cloud client header at the top:
#include "cloud_client.h"

void setup() {
  // ... existing camera, WiFi, Serial2, and WebServer initialization ...

  // 2. Initialize the cloud client layer (after WiFi connects):
  cloudClientInit();

  // OPTION A (Recommended): Launch as isolated background FreeRTOS task on Core 0:
  startCloudTask();
}

void loop() {
  // ... existing local handlers (server.handleClient(), etc.) ...

  // OPTION B (Alternative): If not using FreeRTOS task, run non-blocking loop:
  // cloudClientLoop();
}
```

### Motor Dispatch Function Linkage
`cloud_client.cpp` expects these baseline functions (provided in `acebott-esp32-car-camera.ino`):
- `sendMotorCommandToQD001(const char* cmd, int speed)` — e.g. mapping to existing `/control` handler
- `sendServoCommandToQD001(int angle)`
- `sendSpeedCommandToQD001(int speed)`
- `executeEmergencyStop()`

---

## 4. FreeRTOS Task vs Non-Blocking Loop

- **FreeRTOS Background Task (`startCloudTask()`)**:
  - Pinned to **Core 0** with 8192 bytes stack and priority 1.
  - Leaves **Core 1** 100% dedicated to CameraWebServer, OV2640 DMA frames, and local WebServer.
  - Yields periodically (`vTaskDelay(100ms)`) to prevent IDLE task starvation.
- **Network Timeouts**:
  - All HTTP requests enforce a strict 3-second timeout (`CLOUD_HTTP_TIMEOUT_MS = 3000`).
  - If the router loses WAN access, the cloud task gracefully backs off without interrupting local control.

---

## 5. Security & Device Authentication Token Management

- **Single Token Architecture**: The device presents `X-Device-Token` in HTTPS headers.
- **Zero Exposure**:
  - The token is never printed to `Serial`.
  - The token is never returned in REST responses or error payloads.
  - The token is never included in client-side web bundles.
- **Rotation Procedure**:
  1. Add new token to Google Cloud Secret Manager / Cloud Run environment.
  2. Update token on ESP32-CAM via Over-The-Air (OTA) update or secure NVS flash.
  3. Revoke previous token on Cloud Run.

---

## 6. Arduino Core & Library Compatibility

- **Recommended Core**: **ESP32 Arduino Core 2.0.x** (ESP-IDF 4.4) for tested OV2640 camera driver stability.
- **Core 3.x Compatibility**: Dual-compatible with both Core 2.0.x and 3.x.
- **ArduinoJson**: Dual-compatible with ArduinoJson v6 (`StaticJsonDocument`) and v7 (`JsonDocument`).
