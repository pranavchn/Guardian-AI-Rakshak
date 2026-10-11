#ifndef CLOUD_CONFIG_H
#define CLOUD_CONFIG_H

// ==============================================================================
// SMART RAKSHAK — CLOUD CONFIGURATION CONSTANTS
// Step 6B: Additive ESP32-CAM Cloud Communication Layer Configuration
// ==============================================================================

// 1. Cloud Run Service Base URL
// IMPORTANT: Do NOT use the existing qd002-test service for Smart Rakshak!
// qd002-test (https://qd002-test-341464014035.asia-southeast1.run.app) is exclusively
// the baseline connectivity test and must remain 100% untouched.
//
// For local testing: Set to your development proxy or deployed Cloud Run instance.
// Production: Set to the dedicated Smart Rakshak Cloud Run service URL once deployed.
// Example: "https://smart-rakshak-backend-qd00n-ai-robot.a.run.app"
const char* const CLOUD_API_BASE_URL = "https://smart-rakshak-backend-qd00n-ai-robot.a.run.app";

// 2. Robot Identity Configuration
const char* const ROBOT_ID = "QD001";
const char* const FIRMWARE_VERSION = "v2.4.2-cloud-rakshak";

// 3. Device Authentication Token Configuration
// SECURITY POLICY:
// - In LIVE mode, this token must match DEVICE_AUTH_TOKEN on the Cloud Run server.
// - NEVER print this token to Serial logs.
// - NEVER log this token in network responses or error payloads.
// - NEVER expose this token in frontend web code.
//
// TOKEN ROTATION & REVOCATION PROCEDURE:
// 1) Store secondary active token in Google Cloud Secret Manager / Cloud Run env (e.g. DEVICE_AUTH_TOKEN_NEXT).
// 2) Flash or OTA update the ESP32-CAM firmware with the new token.
// 3) Promote new token to primary on Cloud Run; revoke and retire old token.
const char* const DEVICE_AUTH_TOKEN = "SET_YOUR_DEVICE_AUTH_TOKEN_HERE";

// 4. Cloud Timers and Intervals (in milliseconds)
const unsigned long CLOUD_HEARTBEAT_INTERVAL_MS = 15000; // 15s periodic telemetry heartbeat
const unsigned long CLOUD_POLL_INTERVAL_MS      = 1200;  // 1.2s non-blocking command polling
const unsigned long CLOUD_HTTP_TIMEOUT_MS       = 3000;  // 3s strict timeout (prevents blocking)

// 5. FreeRTOS Task Configuration (when running isolated cloud task on Core 0)
#define CLOUD_TASK_STACK_SIZE 8192
#define CLOUD_TASK_PRIORITY   1
#define CLOUD_TASK_CORE       0

// 6. Arduino Core & Architecture Notes:
// - Recommended ESP32 Arduino Core: 2.0.x (IDF 4.4) for native OV2640 DMA camera stability.
// - Core 3.x (IDF 5.1) is also supported with our dual-version compatibility layer.
// - Hardware: ACEBOTT QD001 ESP32-CAM module.

#endif // CLOUD_CONFIG_H
