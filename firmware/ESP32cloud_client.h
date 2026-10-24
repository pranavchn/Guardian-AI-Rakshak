/*
 * cloud_client.h
 * Smart Rakshak — isolated cloud-mode client interface.
 *
 * The main sketch retains ownership of local behavior, motor protocol,
 * mode selection policy, safety interlocks, and command execution.
 */
#pragma once

#include <Arduino.h>

namespace CloudClient {
enum class Mode : uint8_t {
  LOCAL = 0,
  CLOUD = 1
};

struct Config {
  const char* baseUrl;
  const char* deviceId;
  const char* authToken;
};

struct Command {
  String id;
  String type;
  String value;
  int speed = 0;
  int servoAngle = -1;
};

// Return true only if the command is recognized and safely accepted.
// Do not return true for a no-op or an unexecuted command.
using CommandHandler = bool (*)(const Command& command);
using StatusHandler = void (*)(const String& message);

// Call once in setup() after configuration is available.
bool begin(const Config& config);

// Cloud mode is opt-in; the sketch should start in LOCAL mode.
void setMode(Mode mode);
Mode getMode();

void setCommandHandler(CommandHandler handler);
void setStatusHandler(StatusHandler handler);

// Call repeatedly from loop(). No cloud requests occur in LOCAL mode.
void update();
}
