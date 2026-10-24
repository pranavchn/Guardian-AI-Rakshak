#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include "esp_camera.h"
#include <WebServer.h>
#include "html.h"
#include "cloud_client.h"
#include <vector>

WiFiServer server(100);  // Create a server object with port 100
WebServer webServer(81);

byte Stop[17] = { 0xff, 0x55, 0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x00, 0xf0, 0x00, 0x00, 0x00, 0x00 };  // Stop command buffer
String sendBuff;                                                                                                           // Buffer used to store data received from the serial port
String Version = "1.0.1";
bool ED_client = true;                                                                                                     // Track whether there is a flag for client connection
bool WA_en = false;                                                                                                        // Flag to enable client-side data processing
byte dataLen, index_a = 0;
char buffer[52];
unsigned char prevc = 0;
bool isStart = false;

unsigned char readBuffer(int index_r) {
  return buffer[index_r];
}
void writeBuffer(int index_w, unsigned char c) {
  buffer[index_w] = c;
}

#define gpLED 4  // LED GPIO pins
#define RXD2 15  // GPIO pin of RXD2 (Serial2 input)
#define TXD2 33  // GPIO pin of TXD2 (Serial2 output)
void CameraWebServer_init();
void enable_led(bool en);

// ---------------- SMART RAKSHAK CLOUD MODE (separate from LOCAL logic) ----------------
// Cloud mode is deliberately disabled by default. Do not enable until the
// deployed backend URL, device token, and API contract have been verified.
#define SMART_RAKSHAK_CLOUD_MODE_ENABLED 1
static const char* CLOUD_API_BASE_URL = "https://robotfastapicommunication-8789951438.asia-south1.run.app";
static const char* CLOUD_DEVICE_ID = "QD001";
// Supply a device-specific token locally; never commit a real token to shared code.
static const char* CLOUD_DEVICE_AUTH_TOKEN = "SET_YOUR_DEVICE_AUTH_TOKEN_HERE";

bool handleCloudCommand(const CloudClient::Command& command);
void handleCloudStatus(const String& message);

bool handleCloudCommand(const CloudClient::Command& command) {
  // Called only while CLOUD mode is selected. This cloud-only lockout does not
  // alter the existing LOCAL web-control path. No remote reset is supported.
  //static bool cloudEmergencyLatched = false;
  std::vector<uint8_t> data;

 /* if (command.type == "EMERGENCY_STOP") {
  cloudEmergencyLatched = true;

  const uint8_t stopPacket[] = {
    0xFF, 0x55, 0x07, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x03
  };

  Serial2.write(stopPacket, sizeof(stopPacket));
  Serial.println("[CLOUD] EMERGENCY STOP sent");
  return true;
}*/

  if (command.type == "STOP") {
  const uint8_t stopPacket[] = {
    0xFF, 0x55, 0x07, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x03
  };

  Serial2.write(stopPacket, sizeof(stopPacket));
  Serial.println("[CLOUD] MOTOR DATA: FF 55 07 00 00 00 00 00 00 03");
  return true;
}
  /*if (cloudEmergencyLatched) {
    Serial.println("[CLOUD] Motion rejected: emergency stop is latched");
    return false;
  }*/

  if (command.type == "FORWARD" ||
    command.type == "BACKWARD" ||
    command.type == "LEFT" ||
    command.type == "RIGHT" ||
    command.type == "LEFTUP" ||
    command.type == "RIGHTUP" ||
    command.type == "LEFTDOWN" ||
    command.type == "RIGHTDOWN" ||
    command.type == "ANTICLOCKWISE" ||
    command.type == "CLOCKWISE") {

  uint8_t direction = 0x00;

  if (command.type == "FORWARD") direction = 0x01;
  else if (command.type == "BACKWARD") direction = 0x02;
  else if (command.type == "LEFT") direction = 0x03;
  else if (command.type == "RIGHT") direction = 0x04;
  else if (command.type == "LEFTUP") direction = 0x05;
  else if (command.type == "LEFTDOWN") direction = 0x06;
  else if (command.type == "RIGHTUP") direction = 0x07;
  else if (command.type == "RIGHTDOWN") direction = 0x08;
  else if (command.type == "ANTICLOCKWISE") direction = 0x09;
  else if (command.type == "CLOCKWISE") direction = 0x0A;

  data = {
    0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x01, 0x0C, 0x00, direction
  };

  Serial2.write(data.data(), data.size());
  Serial.println("[CLOUD] Movement command executed: " + command.type);
  return true;
}

  if (command.type == "SET_SPEED") {
    uint8_t speedByte = 0;
    if (command.speed == 1) speedByte = 0x82;
    else if (command.speed == 2) speedByte = 0xA0;
    else if (command.speed == 3) speedByte = 0xBE;
    else if (command.speed == 4) speedByte = 0xDC;
    else if (command.speed == 5) speedByte = 0xFF;
    else return false;

    data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0D, 0x00, speedByte };
    Serial2.write(data.data(), data.size());
    return true;
  }

  if (command.type == "SET_SERVO") {
    if (command.servoAngle < 0 || command.servoAngle > 180) return false;
    data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00,
             (uint8_t)command.servoAngle };
    Serial2.write(data.data(), data.size());
    return true;
  }

  // Image capture and any other command types require a separately verified
  // implementation. Do not claim execution when no action has occurred.
  Serial.println("Rejected unsupported cloud command: " + command.type);
  return false;
}

void handleCloudStatus(const String& message) {
  Serial.print("[CLOUD] ");
  Serial.println(message);
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);
  CameraWebServer_init();  // Initialize camera web server

  // Cloud mode is optional and isolated. LOCAL behavior remains the default.
  CloudClient::setStatusHandler(handleCloudStatus);
  CloudClient::setCommandHandler(handleCloudCommand);
#if SMART_RAKSHAK_CLOUD_MODE_ENABLED
  CloudClient::Config cloudConfig = {
    CLOUD_API_BASE_URL,
    CLOUD_DEVICE_ID,
    CLOUD_DEVICE_AUTH_TOKEN
  };
  if (CloudClient::begin(cloudConfig)) {
    CloudClient::setMode(CloudClient::Mode::CLOUD);
  } else {
    CloudClient::setMode(CloudClient::Mode::LOCAL);
    Serial.println("[CLOUD] Configuration incomplete; continuing in LOCAL mode");
  }
#else
  Serial.println("[CLOUD] Disabled at build time; continuing in LOCAL mode");
#endif

 

  server.begin();          // Start the server
  delay(100);

  pinMode(gpLED, OUTPUT);  // Set gpLED pin as output
  for (int i = 0; i < 5; i++) {
    digitalWrite(gpLED, HIGH);  // Turn on LED
    delay(20);
    digitalWrite(gpLED, LOW);  // Turn off LED
    delay(50);
  }

  testCloudRun();

  webServer.on("/", []() {
    webServer.send(200, "text/html", html);
  });

  webServer.on("/control", []() {
    String cmd = webServer.arg("cmd");
    Serial.println(cmd);
    std::vector<uint8_t> data;
    if (cmd == "car") {
      String direction = webServer.arg("direction");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0C, 0x00 };
      if (direction == "Forward") {
        data.push_back(0x01);
      }
      if (direction == "Backward") {
        data.push_back(0x02);
      }
      if (direction == "Left") {
        data.push_back(0x03);
      }
      if (direction == "Right") {
        data.push_back(0x04);
      }
      if (direction == "Anticlockwise") {
        data.push_back(0x09);
      }
      if (direction == "Clockwise") {
        data.push_back(0x0A);
      }
      if (direction == "stop") {
        data.push_back(0x00);
      }
      if (direction == "LeftUp") {
        data.push_back(0x05);
      }
      if (direction == "RightUp") {
        data.push_back(0x07);
      }
      if (direction == "LeftDown") {
        data.push_back(0x06);
      }
      if (direction == "RightDown") {
        data.push_back(0x08);
      }
    }

    if (cmd == "speed") {
      String value = webServer.arg("value");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0D, 0x00 };
      if (value == "1") { data.push_back(0x82); }
      if (value == "2") { data.push_back(0xA0); }
      if (value == "3") { data.push_back(0xBE); }
      if (value == "4") { data.push_back(0xDC); }
      if (value == "5") { data.push_back(0xFF); }
    }

    if (cmd == "servo") {
      String angle = webServer.arg("angle");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, angle.toInt() };
    }

    if (cmd == "LED") {
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05, 0x00, 0x01 };  //Turn on LED
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05, 0x00, 0x00 };  //Turn off LED
    }

    if (cmd == "CAM_LED") {
      String value = webServer.arg("value");
      if (value == "1"){  // Turn on LED
        analogWrite(gpLED, 100);
        digitalWrite(gpLED, HIGH);  // Turn on LED
        value=-1;
      } else if (value == "0"){  // Turn off LED
        analogWrite(gpLED, 0);
        digitalWrite(gpLED, LOW);  // Turn off LED
        value=-1;
      }
    }

    if (cmd == "Buzzer") {
      String value = webServer.arg("value");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x03, 0x00 };
      if (value == "1") {
        data.push_back(0x01);  //1
      }
      if (value == "2") {
        data.push_back(0x02);  //2
      }
      if (value == "3") {
        data.push_back(0x03);  //3
      }
      if (value == "4") {
        data.push_back(0x04);  //4
      }
    }

    if (cmd == "Track") {
      String value = webServer.arg("value");
      if (value == "1") {
        data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04 };  //Mode 1
      }
      if (value == "2") {
        data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05 };  //Mode 2
      }
    }

    if (cmd == "Avoidance") {
      data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06 };
    }

    if (cmd == "Follow") {
      data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07 };
    }

    if (cmd == "Shooting") {
      data = { 0xFF, 0x55, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x08 };
    }

    if (cmd == "stopA") {
      data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03 };
    }


    uint8_t *buffer = &data[0];
    
    Serial2.write(buffer, data.size());
    Serial.print("MOTOR DATA: ");
    for (int i = 0; i < data.size(); i++) {
      Serial.printf("%02X ", data[i]);
    }
    Serial.println();


    webServer.send(200, "text/plain", "ok");
  });
  webServer.begin();
}

void loop() {
  WiFiClient client = server.available();  // Check if any client is connected to the server
  if (client) {
    WA_en = true;      // Enable client data processing
    ED_client = true;  // Set client connection flag

    while (client.connected()) {
      if (client.available()) {
        unsigned char clientBuff = client.read() & 0xff;  // Read data from client
        Serial2.write(clientBuff);                        // Send data to Serial2
        Serial.write(clientBuff);                         // Print data to serial monitor
        if (clientBuff == 0x55 && isStart == false) {
          if (prevc == 0xff) {
            index_a = 1;
            isStart = true;
          }
        } else {
          prevc = clientBuff;
          if (isStart) {
            if (index_a == 2) {
              dataLen = clientBuff;
            } else if (index_a > 2) {
              dataLen--;
            }
            writeBuffer(index_a, clientBuff);
          }
        }
        index_a++;
        if (index_a > 120) {
          index_a = 0;
          isStart = false;
        }
        if (isStart && dataLen == 0 && index_a > 3) {
          isStart = false;
          int device = readBuffer(10);
          int val = readBuffer(12);
          if (device == 0x06){
            if (val == 1){  // Turn on LED
              analogWrite(gpLED, 100);
              digitalWrite(gpLED, HIGH);  // Turn on LED
              val=-1;
            } else if (val == 0){  // Turn off LED
              analogWrite(gpLED, 0);
              digitalWrite(gpLED, LOW);  // Turn off LED
              val=-1;
            }
          }
          index_a = 0;
        }
      }
      if (Serial.available()) {
        char c = Serial.read();   // Read data from serial monitor
        sendBuff += c;            // Add data to send buffer
        Serial2.print(sendBuff);  // Send data to Serial2
        sendBuff = "";            // clear send buffer
      }
      // OLD AP-mode check — disabled because camera is now in WIFI_STA mode
/*
      static unsigned long Test_time = 0;
      if (millis() - Test_time > 1000) {
        Test_time = millis();
        if (0 == (WiFi.softAPgetStationNum()))  // Check if the soft AP has no connected sites
        {
          Serial2.write(Stop, 17);  // Send stop command to Serial2
          break;                    // exit while loop
        }
      }
      */
    }
    Serial2.write(Stop, 17);  // Send stop command to Serial2
    client.stop();            // Disconnect client
  } else {
    if (ED_client == true) {
      ED_client = false;
      Serial2.write(Stop, 17);  // Send stop command to Serial2
    }
  }
  webServer.handleClient();

#if SMART_RAKSHAK_CLOUD_MODE_ENABLED
  CloudClient::update();
#endif
}

void testCloudRun()
{
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;

  String url = "https://qd002-test-8789951438.asia-south1.run.app";

  if (https.begin(client, url))
  {
    https.addHeader("Content-Type", "application/json");

    int httpCode = https.POST("{\"value\":10}");

    Serial.print("Cloud HTTP Code: ");
    Serial.println(httpCode);

    if (httpCode > 0)
    {
      String response = https.getString();

      Serial.print("Cloud Response: ");
      Serial.println(response);

      if (response.indexOf("\"received\":10") >= 0)
      {
        Serial.println("Cloud command 10 received - LED ON");

        enable_led(true);
        
      }
    }

    https.end();
  }
  else
  {
    Serial.println("Cloud connection failed");
  }
}
