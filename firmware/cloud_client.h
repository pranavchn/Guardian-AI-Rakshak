#ifndef CLOUD_CLIENT_H
#define CLOUD_CLIENT_H

#include <Arduino.h>

// ==============================================================================
// SMART RAKSHAK — CLOUD CLIENT MODULE HEADER
// Additive Cloud Communication Layer for ESP32-CAM
// ==============================================================================

// Cloud Communication State Tracking
struct CloudState {
  bool cloudEnabled;                  // Whether cloud communication is enabled
  bool cloudConnected;                // Whether the last cloud communication succeeded
  unsigned long lastPoll;             // Timestamp of last command poll attempt (millis)
  unsigned long lastHeartbeat;        // Timestamp of last heartbeat attempt (millis)
  unsigned long lastSuccess;          // Timestamp of last successful cloud response (millis)
  int consecutiveFailures;            // Number of consecutive failed HTTP requests
  bool emergencyStopLocked;           // True when robot is locked by EMERGENCY_STOP
  unsigned long emergencyStopTimestamp; // Timestamp when emergency stop was triggered
};

extern CloudState g_cloudState;

/**
 * Initializes the Cloud communication subsystem.
 * Non-blocking; initializes state variables and timers.
 */
void cloudClientInit();

/**
 * Non-blocking periodic loop function to be called from loop() or a dedicated FreeRTOS task.
 * Manages periodic heartbeat and command polling.
 * Does NOT block local camera, Serial2, or web server execution.
 */
void cloudClientLoop();

/**
 * Launches the Cloud client as an isolated FreeRTOS background task on Core 0.
 * Recommended deployment pattern:
 * Keeps Core 1 dedicated to CameraWebServer, local web interface, and Serial2 timing.
 */
void startCloudTask();

/**
 * Stops the FreeRTOS background task if running.
 */
void stopCloudTask();

/**
 * Manually enable or disable cloud polling without rebooting.
 */
void cloudSetEnabled(bool enabled);

/**
 * Check current cloud connectivity status.
 */
bool cloudIsConnected();

/**
 * Emergency Stop Lockout Controls:
 * In-flight, delayed, duplicate, and queued cloud movement commands cannot execute
 * after an emergency stop until explicitly cleared via cloudResetEmergencyStop().
 */
bool cloudIsEmergencyStopLocked();
void cloudResetEmergencyStop();

#endif // CLOUD_CLIENT_H
