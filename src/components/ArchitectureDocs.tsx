/**
 * Smart Rakshak — Architecture, Firestore Schema & ESP32-CAM Firmware Specification Modal
 */

import React, { useState } from 'react';
import {
  X,
  Database,
  Cloud,
  Cpu,
  FileCode,
  Shield,
  Copy,
  Check,
  Server,
  Layers,
} from 'lucide-react';

interface ArchitectureDocsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureDocs: React.FC<ArchitectureDocsProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'FIRESTORE' | 'STORAGE' | 'DEVICE_API' | 'FIRMWARE' | 'DEPLOY'>('OVERVIEW');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">
                Smart Rakshak — Architecture & Integration Specification
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Robot: Smart Rakshak Platform · Google Cloud Run · Firebase Firestore · Google Cloud Storage
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'OVERVIEW'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            System Overview
          </button>
          <button
            onClick={() => setActiveTab('FIRESTORE')}
            className={`px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'FIRESTORE'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Firestore Schema
          </button>
          <button
            onClick={() => setActiveTab('STORAGE')}
            className={`px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'STORAGE'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cloud Storage Structure
          </button>
          <button
            onClick={() => setActiveTab('DEVICE_API')}
            className={`px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'DEVICE_API'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ESP32 Device REST API
          </button>
          <button
            onClick={() => setActiveTab('FIRMWARE')}
            className={`px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'FIRMWARE'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ESP32 Firmware Additions
          </button>
          <button
            onClick={() => setActiveTab('DEPLOY')}
            className={`px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'DEPLOY'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cloud Run Deployment
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed font-sans">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-sm font-semibold text-slate-100 mb-2">Architectural Principles</h4>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-100">Additive Design:</strong> The cloud system wraps around the existing hardware firmware. Existing local control (<code className="text-sky-300 font-mono">/control</code> endpoint, local camera server, and Serial2 motor commands) remains completely functional without internet.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-100">Outbound Device-Polling Architecture:</strong> Because ESP32-CAM sits behind private NAT/Wi-Fi routers, Cloud Run never initiates inbound sockets. Instead, the ESP32 periodically polls <code className="text-sky-300 font-mono">GET /api/device/commands</code> via outbound HTTPS.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-100">Safety Watchdog & Timeout:</strong> Every movement command includes an expiration timestamp (10s). If Wi-Fi is lost during movement, the device-side watchdog automatically cuts motors after 500ms. STOP and EMERGENCY_STOP commands atomically purge all pending movements.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-100">Protected Services:</strong> Smart Rakshak runs in its own dedicated, isolated microservice container.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Architecture ASCII diagram */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                <pre>{`[ Web Application (React + TypeScript) ]
               │
               ▼ HTTPS (REST + JWT/Token)
[ Cloud Run Service: smart-rakshak-backend ] ──► [ Firestore & Cloud Storage ]
               ▲
               │ Outbound HTTPS Polling (Every 250ms - 500ms)
[ ESP32-CAM Module ]
     ├─► [ Existing Camera Web Server (Port 80 / Local /control) ]  <- UNTOUCHED
     ├─► [ New FreeRTOS Cloud Polling Task ]
     └─► [ Existing Serial2 UART: 115200 baud ]
               │
               ▼
[ Smart Rakshak Motor Controller Board ] (Differential Motors, Ultrasonic, Servos, Buzzer, LED)`}</pre>
              </div>
            </div>
          )}

          {/* TAB 2: FIRESTORE SCHEMA */}
          {activeTab === 'FIRESTORE' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                  <span>
                    Project: <strong className="text-amber-400">smart-rakshak-robot</strong>
                  </span>
                  <span>
                    Database ID: <strong className="text-sky-400">(default)</strong>
                  </span>
                  <span>
                    Region: <strong className="text-emerald-400">asia-south1</strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans pt-1">
                  Using server-side Application Default Credentials (ADC) without requiring or exposing service-account JSON keys.
                </p>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Collection 1: robots */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-sky-400 font-bold block mb-1">robots/&#123;robotId&#125; (e.g. robots/SR-01)</span>
                  <pre className="text-slate-400 text-[11px]">{`{
  robotId: "SR-01",
  name: "Smart Rakshak — Physical AI Robot",
  online: true,                       // Boolean computed via heartbeat watchdog
  lastSeen: "2026-10-10T07:45:00Z",
  firmwareVersion: "v2.4.1-cloud-rakshak",
  wifiStatus: "CONNECTED",            // "CONNECTED" | "DISCONNECTED" | "WEAK" | "OFFLINE"
  cloudStatus: "CONNECTED",           // "CONNECTED" | "DISCONNECTED" | "POLLING"
  currentCommand: "FORWARD" | null,
  batteryLevel: 84,                   // 0 - 100%
  cameraAvailable: true,
  rssi: -58,                          // dBm signal
  freeHeap: 184520,                   // SRAM bytes free
  ipAddress: "192.168.1.145",
  speed: 3,                           // 1 - 5
  servoAngle: 90,                     // 0 - 180 degrees
  totalCommandsExecuted: 142,
  createdAt: "2026-10-10T00:00:00Z",
  updatedAt: "2026-10-10T07:45:00Z"
}`}</pre>
                </div>

                {/* Collection 2: robotCommands */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-amber-400 font-bold block mb-1">robotCommands/&#123;commandId&#125; (Active Queue)</span>
                  <pre className="text-slate-400 text-[11px]">{`{
  commandId: "cmd_1742080001_a9c2",
  robotId: "SR-01",
  command: "FORWARD",                 // "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP" | "EMERGENCY_STOP" | "SET_SPEED" | "SET_SERVO" | "CAPTURE_IMAGE"
  speed: 3,
  servo: 90,
  status: "PENDING",                  // "PENDING" | "EXECUTING" | "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELLED"
  createdAt: "2026-10-10T07:45:10Z",
  expiresAt: "2026-10-10T07:45:20Z",  // Safety: expires after 10s if not picked up
  source: "WEB_UI"                    // "WEB_UI" | "AI_NATURAL_LANGUAGE" | "EMERGENCY_WATCHDOG"
}`}</pre>
                </div>

                {/* Collection 3: robotCommandHistory */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-1">robotCommandHistory/&#123;commandId&#125; (Archived Acknowledged)</span>
                  <pre className="text-slate-400 text-[11px]">{`{
  commandId: "cmd_1742080001_a9c2",
  robotId: "SR-01",
  command: "FORWARD",
  status: "COMPLETED",
  createdAt: "2026-10-10T07:45:10Z",
  completedAt: "2026-10-10T07:45:11Z",
  ackDetails: {
    executionStatus: "COMPLETED",
    executionTimestamp: "2026-10-10T07:45:11Z",
    details: "Motor Serial2 packet sent successfully"
  }
}`}</pre>
                </div>

                {/* Collection 4: cameraImages */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-sky-400 font-bold block mb-1">cameraImages/&#123;imageId&#125; (Captured Frames)</span>
                  <pre className="text-slate-400 text-[11px]">{`{
  imageId: "img_1742080045_3b9f",
  robotId: "SR-01",
  storagePath: "gs://smart-rakshak-captures/SR-01/capture_1742080045.jpg",
  contentType: "image/jpeg",
  size: 34210,
  createdAt: "2026-10-10T07:45:45Z",
  captureSource: "ESP32_CAM_MANUAL",
  aiAnalysis: {
    summary: "Clear path ahead. Obstacle detected at 2.4 meters.",
    detectedObstacles: ["Low barrier"],
    isSafeToAdvance: true,
    analyzedAt: "2026-10-10T07:45:48Z"
  }
}`}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STORAGE */}
          {activeTab === 'STORAGE' && (
            <div className="space-y-4">
              <p className="text-slate-400">
                Google Cloud Storage Bucket: <code className="text-amber-400 font-mono">gs://smart-rakshak-captures/</code>
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs">
                <pre>{`gs://smart-rakshak-captures/
  └── SR-01/
      ├── captures/
      │   ├── 2026-10-10_074501_front.jpg
      │   ├── 2026-10-10_074812_front.jpg
      │   └── ...
      ├── telemetry_logs/
      │   └── 2026-10-10_session.jsonl
      └── firmware/
          └── firmware_manifest.json`}</pre>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h4 className="text-sm font-semibold text-slate-100 mb-2">Storage Access Security</h4>
                <p className="text-xs text-slate-300">
                  The ESP32-CAM never accesses Google Cloud Storage directly with service-account credentials.
                  Instead, the ESP32 uploads JPEG payloads to the Cloud Run endpoint <code className="text-sky-300 font-mono">POST /api/device/camera/upload</code> using its device token. Cloud Run streams the bytes to GCS and signs public retrieval URLs.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: DEVICE REST API */}
          {activeTab === 'DEVICE_API' && (
            <div className="space-y-4">
              <p className="text-slate-400">
                The ESP32-CAM communicates with Cloud Run using these authenticated endpoints:
              </p>

              <div className="space-y-3 font-mono text-xs">
                {/* 1. Poll Commands */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between text-sky-400 font-bold mb-1">
                    <span>GET /api/device/commands?robotId=SR-01</span>
                    <span className="text-[10px] text-slate-500 font-sans">Every 250-500ms</span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans mb-1">
                    Header: <code className="text-slate-200">X-Device-Token: [DEVICE_AUTH_TOKEN]</code>
                  </p>
                  <pre className="text-slate-400 text-[11px]">{`Response 200 OK:
{
  "hasCommand": true,
  "command": {
    "commandId": "cmd_1742080001_a9c2",
    "robotId": "SR-01",
    "command": "FORWARD",
    "speed": 3,
    "servo": 90,
    "createdAt": "2026-10-10T07:45:10Z"
  }
}`}</pre>
                </div>

                {/* 2. Ack Command */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
                    <span>POST /api/device/ack</span>
                    <span className="text-[10px] text-slate-500 font-sans">Immediately after execution</span>
                  </div>
                  <pre className="text-slate-400 text-[11px]">{`Request Body:
{
  "robotId": "SR-01",
  "commandId": "cmd_1742080001_a9c2",
  "command": "FORWARD",
  "executionStatus": "COMPLETED",     // "COMPLETED" | "FAILED"
  "executionTimestamp": "2026-10-10T07:45:11Z",
  "details": "Serial2 forward packet written"
}`}</pre>
                </div>

                {/* 3. Heartbeat */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between text-amber-400 font-bold mb-1">
                    <span>POST /api/device/heartbeat</span>
                    <span className="text-[10px] text-slate-500 font-sans">Every 5-10 seconds</span>
                  </div>
                  <pre className="text-slate-400 text-[11px]">{`Request Body:
{
  "robotId": "SR-01",
  "firmwareVersion": "v2.4.1-cloud-rakshak",
  "wifiStatus": "CONNECTED",
  "batteryLevel": 84,
  "cameraAvailable": true,
  "freeHeap": 184520,
  "rssi": -58,
  "ipAddress": "192.168.1.145",
  "localPort": 80
}`}</pre>
                </div>

                {/* 4. Camera Upload */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between text-purple-400 font-bold mb-1">
                    <span>POST /api/device/camera/upload</span>
                    <span className="text-[10px] text-slate-500 font-sans">Triggered by CAPTURE_IMAGE</span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Headers: <code className="text-slate-200">Content-Type: image/jpeg</code>, <code className="text-slate-200">X-Device-Token: [TOKEN]</code>
                    <br />
                    Body: Raw binary bytes of the captured JPEG from <code className="text-sky-300 font-mono">esp_camera_fb_get()</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FIRMWARE ADDITIONS */}
          {activeTab === 'FIRMWARE' && (
            <div className="space-y-4">
              <div className="bg-amber-950/40 p-4 rounded-xl border border-amber-500/30">
                <h4 className="text-sm font-semibold text-amber-300 mb-1">Strict Safety Guarantee</h4>
                <p className="text-xs text-slate-300">
                  We <strong>DO NOT</strong> modify existing local endpoints (<code className="text-sky-300 font-mono">/control</code>, <code className="text-sky-300 font-mono">/stream</code>, <code className="text-sky-300 font-mono">/capture</code>).
                  The existing camera web server continues running on core 1.
                  The cloud client runs as an <strong>isolated FreeRTOS background task</strong> on core 0.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-200">
                  Additive Cloud Layer (<code className="text-sky-400 font-mono">firmware/cloud_client.cpp</code> & <code className="text-sky-400 font-mono">cloud_client.h</code>):
                </span>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto text-slate-300">
                  <pre>{`// ============================================================
// SMART RAKSHAK ADDITIVE CLOUD LAYER (Non-blocking Module)
// Does NOT touch existing local web server, camera, or Serial2 protocol
// ============================================================
#include "cloud_client.h"
#include "cloud_config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// Re-use existing baseline motor/servo hooks (UNCHANGED)
extern void sendMotorCommandToHardware(const char* cmd, int speed);
extern void sendServoCommandToHardware(int angle);
extern void sendSpeedCommandToHardware(int speed);
extern void executeEmergencyStop();

// Heartbeat interval: 20s | Polling interval: 1.5s | Timeout: 3s
// In loop():
//   localServer.handleClient(); // Highest priority local control
//   cloudClientLoop();          // Non-blocking additive cloud layer`}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CLOUD RUN DEPLOYMENT */}
          {activeTab === 'DEPLOY' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-sm font-semibold text-slate-100">
                  Google Cloud Run Deployment Instructions
                </h4>
                <p className="text-slate-400 text-xs">
                  Target Project: <code className="text-amber-400 font-mono">Smart Rakshak AI Robot</code>
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-3">
                <div>
                  <span className="text-slate-400 block mb-1">1. Build Container Image:</span>
                  <pre className="text-sky-300 bg-slate-900 p-2 rounded">
                    gcloud builds submit --tag gcr.io/smart-rakshak-robot/smart-rakshak-control
                  </pre>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">2. Deploy to Dedicated Cloud Run Service:</span>
                  <pre className="text-sky-300 bg-slate-900 p-2 rounded whitespace-pre-wrap">
{`gcloud run deploy smart-rakshak-backend \\
  --image gcr.io/smart-rakshak-robot/smart-rakshak-control \\
  --platform managed \\
  --region asia-southeast1 \\
  --allow-unauthenticated \\
  --set-env-vars DEFAULT_ROBOT_ID="SR-01",DEVICE_AUTH_TOKEN="YOUR_SECURE_DEVICE_TOKEN",HEARTBEAT_TIMEOUT_MS="15000",COMMAND_EXPIRATION_MS="10000"`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
