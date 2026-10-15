/**
 * Smart Rakshak — REST API Routes
 *
 * Implements:
 * - /api/robot/* : Client web application commands and telemetry
 * - /api/device/* : ESP32-CAM polling, heartbeat, ack, and camera upload
 * - /api/ai/* : Gemini natural language intent translation and vision analysis
 * - /api/system/* : System mode, Firestore metadata, audit logs, and hardware integration specs
 */

import express, { type Request, type Response } from 'express';
import { geminiService } from './geminiService.ts';
import { dataStore } from './store.ts';
import type { DeviceAckPayload, DeviceHeartbeatPayload, RobotCommandType } from '../src/types/robot.ts';

export const apiRouter = express.Router();

// ==========================================
// DEVICE AUTHENTICATION MIDDLEWARE
// ==========================================
function authenticateDevice(req: Request, res: Response, next: () => void): void {
  const config = dataStore.getConfig();
  const token = req.headers['x-device-token'] as string || req.query.token as string;
  const expectedToken = dataStore.getDeviceToken();

  // Allow in DEMO mode for browser testing without DEVICE_AUTH_TOKEN
  if (config.mode === 'DEMO' && (!token || token === 'demo_token')) {
    return next();
  }

  // In LIVE mode, if DEVICE_AUTH_TOKEN is missing or empty on server, fail safely
  if (!expectedToken) {
    dataStore.logAudit('AUTH', 'ERROR', 'Device authentication rejected: DEVICE_AUTH_TOKEN is not configured on server');
    res.status(500).json({
      error: 'SERVER_AUTH_MISCONFIGURED',
      message: 'Server DEVICE_AUTH_TOKEN environment variable is not configured. Device authentication failed safely.',
    });
    return;
  }

  // Never expose token strings or substrings in logs or API responses
  if (!token || token !== expectedToken) {
    dataStore.logAudit('AUTH', 'WARN', 'Unauthorized device API access attempt', {
      ip: req.ip,
      url: req.originalUrl,
    });
    res.status(401).json({
      error: 'UNAUTHORIZED_DEVICE',
      message: 'Invalid or missing X-Device-Token header. Hardware access denied.',
    });
    return;
  }

  next();
}

// ==========================================
// 1. CLIENT / ROBOT TELEMETRY & CONTROL APIS
// ==========================================

// GET /api/robot/status
apiRouter.get('/robot/status', async (req: Request, res: Response) => {
  const robotId = (req.query.robotId as string) || 'QD001';
  try {
    const status = await dataStore.getRobotStatus(robotId);
    const config = dataStore.getConfig();
    const firestore = dataStore.getFirestoreDetails();
    res.json({ status, config, firestore });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve robot status';
    const config = dataStore.getConfig();
    const firestore = dataStore.getFirestoreDetails();
    res.status(503).json({
      error: 'FIRESTORE_ERROR',
      message: errorMsg,
      config,
      firestore,
    });
  }
});

// POST /api/robot/commands
apiRouter.post('/robot/commands', async (req: Request, res: Response) => {
  const { command, robotId, speed, servo, source } = req.body;

  if (!command) {
    res.status(400).json({ error: 'Command type is required.' });
    return;
  }

  const validCommands: RobotCommandType[] = [
    'FORWARD',
    'BACKWARD',
    'LEFT',
    'RIGHT',
    'STOP',
    'EMERGENCY_STOP',
    'RESET_EMERGENCY_STOP',
    'SET_SPEED',
    'SET_SERVO',
    'CAPTURE_IMAGE',
  ];

  if (!validCommands.includes(command)) {
    res.status(400).json({
      error: 'INVALID_COMMAND',
      message: `Command "${command}" is not an authorized robot command.`,
    });
    return;
  }

  try {
    const enqueued = await dataStore.enqueueCommand(command, {
      robotId,
      speed: typeof speed === 'number' ? speed : undefined,
      servo: typeof servo === 'number' ? servo : undefined,
      source: source || 'WEB_UI',
    });

    // If in DEMO mode with autoSimulatePolling turned on, immediately trigger simulator cycle
    const config = dataStore.getConfig();
    if (config.mode === 'DEMO' && config.autoSimulatePolling) {
      setTimeout(async () => {
        const poll = await dataStore.pollNextCommand(enqueued.robotId);
        if (poll.hasCommand && poll.command) {
          setTimeout(async () => {
            await dataStore.acknowledgeCommand({
              robotId: poll.command!.robotId,
              commandId: poll.command!.commandId,
              command: poll.command!.command,
              executionStatus: 'COMPLETED',
              executionTimestamp: new Date().toISOString(),
              details: 'Executed in Virtual Simulation Engine',
            });
          }, 150);
        }
      }, 100);
    }

    const pending = await dataStore.getPendingCommands(enqueued.robotId);
    res.status(201).json({
      success: true,
      command: enqueued,
      queueLength: pending.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to enqueue command';
    res.status(503).json({
      success: false,
      error: 'COMMAND_DISPATCH_FAILED',
      message: errorMsg,
    });
  }
});

// POST /api/robot/emergency-stop
apiRouter.post('/robot/emergency-stop', async (req: Request, res: Response) => {
  const robotId = req.body.robotId || 'QD001';
  try {
    const stopCmd = await dataStore.enqueueCommand('EMERGENCY_STOP', {
      robotId,
      source: req.body.source || 'EMERGENCY_WATCHDOG',
    });

    res.status(200).json({
      emergencyStopActive: true,
      command: stopCmd,
      message: 'EMERGENCY STOP ENGAGED: All movement commands purged immediately.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Emergency stop dispatch failed';
    res.status(503).json({
      emergencyStopActive: false,
      error: 'EMERGENCY_STOP_FAILED',
      message: errorMsg,
    });
  }
});

// GET /api/robot/commands (Pending queue)
apiRouter.get('/robot/commands', async (req: Request, res: Response) => {
  const robotId = (req.query.robotId as string) || 'QD001';
  try {
    const pending = await dataStore.getPendingCommands(robotId);
    res.json({ pending });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch pending commands';
    res.status(503).json({
      error: 'FIRESTORE_ERROR',
      message: errorMsg,
    });
  }
});

// GET /api/robot/commands/history
apiRouter.get('/robot/commands/history', async (req: Request, res: Response) => {
  const robotId = (req.query.robotId as string) || 'QD001';
  const limit = parseInt((req.query.limit as string) || '30', 10);
  try {
    const history = await dataStore.getCommandHistory(robotId, limit);
    res.json({ history });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch command history';
    res.status(503).json({
      error: 'FIRESTORE_ERROR',
      message: errorMsg,
    });
  }
});

// POST /api/robot/camera/capture
apiRouter.post('/robot/camera/capture', async (req: Request, res: Response) => {
  const robotId = req.body.robotId || 'QD001';
  try {
    const captureCmd = await dataStore.enqueueCommand('CAPTURE_IMAGE', {
      robotId,
      source: req.body.source || 'WEB_UI',
    });

    const config = dataStore.getConfig();
    if (config.mode === 'DEMO' && config.autoSimulatePolling) {
      setTimeout(async () => {
        const poll = await dataStore.pollNextCommand(robotId);
        if (poll.hasCommand && poll.command) {
          await dataStore.acknowledgeCommand({
            robotId,
            commandId: poll.command.commandId,
            command: 'CAPTURE_IMAGE',
            executionStatus: 'COMPLETED',
            executionTimestamp: new Date().toISOString(),
            details: 'Simulated OV2640 frame captured',
          });
          await generateDemoCapture(robotId);
        }
      }, 250);
    }

    res.status(202).json({
      success: true,
      message: 'Camera capture request dispatched to device queue',
      command: captureCmd,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Camera capture dispatch failed';
    res.status(503).json({
      success: false,
      error: 'CAPTURE_DISPATCH_FAILED',
      message: errorMsg,
    });
  }
});

// GET /api/robot/camera/images
apiRouter.get('/robot/camera/images', async (req: Request, res: Response) => {
  const robotId = (req.query.robotId as string) || 'QD001';
  try {
    const images = await dataStore.getCameraImages(robotId);
    res.json({ images });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch camera images';
    res.status(503).json({
      error: 'FIRESTORE_ERROR',
      message: errorMsg,
    });
  }
});

// ==========================================
// 2. DEVICE-SIDE APIS (ESP32-CAM POLLING)
// ==========================================

// GET /api/device/commands (Polled outbound by ESP32-CAM)
apiRouter.get('/device/commands', authenticateDevice, async (req: Request, res: Response) => {
  const robotId = (req.query.robotId as string) || 'QD001';
  try {
    const result = await dataStore.pollNextCommand(robotId);

    if (result.hasCommand && result.command) {
      res.json({
        hasCommand: true,
        command: {
          commandId: result.command.commandId,
          robotId: result.command.robotId,
          command: result.command.command,
          speed: result.command.speed,
          servo: result.command.servo,
          createdAt: result.command.createdAt,
        },
      });
    } else {
      res.json({
        hasCommand: false,
        message: 'Queue idle',
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to poll commands';
    res.status(503).json({
      hasCommand: false,
      error: 'FIRESTORE_POLL_FAILED',
      message: errorMsg,
    });
  }
});

// POST /api/device/ack (Sent outbound by ESP32-CAM after execution)
apiRouter.post('/device/ack', authenticateDevice, async (req: Request, res: Response) => {
  const payload = req.body as DeviceAckPayload;

  if (!payload || !payload.commandId || !payload.executionStatus) {
    res.status(400).json({ error: 'Missing required fields: commandId, executionStatus' });
    return;
  }

  try {
    const updated = await dataStore.acknowledgeCommand(payload);

    if (!updated) {
      res.status(404).json({
        error: 'COMMAND_NOT_FOUND',
        message: `Command with ID ${payload.commandId} was not found or already completed/expired`,
      });
      return;
    }

    res.json({
      acknowledged: true,
      commandId: updated.commandId,
      status: updated.status,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to acknowledge command';
    res.status(503).json({
      acknowledged: false,
      error: 'FIRESTORE_ACK_FAILED',
      message: errorMsg,
    });
  }
});

// POST /api/device/heartbeat (Sent outbound by ESP32-CAM every 5-10s)
apiRouter.post('/device/heartbeat', authenticateDevice, async (req: Request, res: Response) => {
  const payload = req.body as DeviceHeartbeatPayload;

  if (!payload || !payload.robotId) {
    res.status(400).json({ error: 'robotId is required in heartbeat payload' });
    return;
  }

  try {
    const updatedStatus = await dataStore.processHeartbeat(payload);

    res.json({
      received: true,
      robotId: payload.robotId,
      serverTime: new Date().toISOString(),
      status: {
        online: updatedStatus.online,
        cloudStatus: updatedStatus.cloudStatus,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process heartbeat';
    res.status(503).json({
      received: false,
      error: 'FIRESTORE_HEARTBEAT_FAILED',
      message: errorMsg,
    });
  }
});

// POST /api/device/camera/upload (ESP32-CAM uploads captured JPEG)
apiRouter.post('/device/camera/upload', authenticateDevice, async (req: Request, res: Response) => {
  const robotId = (req.query.robotId as string) || (req.headers['x-robot-id'] as string) || 'QD001';
  let imageBase64: string = '';
  let contentType = 'image/jpeg';
  let size = 0;

  // Handle binary buffer vs JSON base64
  if (Buffer.isBuffer(req.body)) {
    size = req.body.length;
    contentType = (req.headers['content-type'] as string) || 'image/jpeg';
    imageBase64 = `data:${contentType};base64,${req.body.toString('base64')}`;
  } else if (req.body && req.body.imageBase64) {
    imageBase64 = req.body.imageBase64;
    contentType = req.body.contentType || 'image/jpeg';
    size = Math.round((imageBase64.length * 3) / 4);
  } else {
    res.status(400).json({ error: 'No image data received. Send binary JPEG or JSON with imageBase64.' });
    return;
  }

  const storagePath = `gs://smart-rakshak-captures/${robotId}/capture_${Date.now()}.jpg`;

  try {
    const record = await dataStore.recordCameraImage({
      robotId,
      storagePath,
      url: imageBase64,
      captureSource: 'ESP32_CAM_MANUAL',
      contentType,
      size,
      width: 640,
      height: 480,
    });

    res.status(201).json({
      success: true,
      imageId: record.imageId,
      storagePath: record.storagePath,
      createdAt: record.createdAt,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to store camera image';
    res.status(503).json({
      error: 'FIRESTORE_UPLOAD_FAILED',
      message: errorMsg,
    });
  }
});

// ==========================================
// 3. AI / GEMINI SERVICE APIS
// ==========================================

// POST /api/ai/command (Translates natural language to validated robot command)
apiRouter.post('/ai/command', async (req: Request, res: Response) => {
  const { input, robotId, executeImmediately } = req.body;

  if (!input || typeof input !== 'string') {
    res.status(400).json({ error: 'Text input string is required' });
    return;
  }

  try {
    const translation = await geminiService.translateCommand(input);

    let enqueuedCommand = null;
    if (translation.valid && translation.commandType && executeImmediately) {
      enqueuedCommand = await dataStore.enqueueCommand(translation.commandType, {
        robotId: robotId || 'QD001',
        speed: translation.speed,
        servo: translation.servo,
        source: 'AI_NATURAL_LANGUAGE',
      });
    }

    res.json({
      success: true,
      translation,
      executed: Boolean(enqueuedCommand),
      enqueuedCommand,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown AI error';
    res.status(500).json({ error: 'AI_PROCESSING_ERROR', message: errorMsg });
  }
});

// POST /api/ai/vision-analyze (Multimodal vision analysis on captured image)
apiRouter.post('/ai/vision-analyze', async (req: Request, res: Response) => {
  const { imageId, robotId, prompt } = req.body;
  const targetRobot = robotId || 'QD001';

  const images = await dataStore.getCameraImages(targetRobot);
  const targetImage = imageId ? images.find((i) => i.imageId === imageId) : images[0];

  if (!targetImage) {
    res.status(404).json({ error: 'No camera images found to analyze' });
    return;
  }

  try {
    const analysis = await geminiService.analyzeVision(targetImage.url, prompt);
    const updated = await dataStore.updateImageAiAnalysis(targetImage.imageId, analysis);

    res.json({
      success: true,
      imageId: targetImage.imageId,
      analysis,
      updatedImage: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to analyze frame';
    res.status(500).json({ error: 'VISION_ANALYSIS_FAILED', message: errorMsg });
  }
});

// ==========================================
// 4. SYSTEM / CONFIG / LOGS / DEMO TOOLS
// ==========================================

// GET & POST /api/system/mode
apiRouter.get('/system/mode', (_req: Request, res: Response) => {
  res.json({
    config: dataStore.getConfig(),
    firestore: dataStore.getFirestoreDetails(),
  });
});

apiRouter.post('/system/mode', (req: Request, res: Response) => {
  const updated = dataStore.setConfig(req.body);
  res.json({ success: true, config: updated, firestore: dataStore.getFirestoreDetails() });
});

// GET /api/system/logs
apiRouter.get('/system/logs', async (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  try {
    const logs = await dataStore.getAuditLogs(limit);
    res.json({ logs });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch audit logs';
    res.status(503).json({
      error: 'FIRESTORE_ERROR',
      message: errorMsg,
    });
  }
});

// POST /api/demo/simulate-cycle (Simulates ESP32 poll, heartbeat, and execution)
apiRouter.post('/demo/simulate-cycle', async (req: Request, res: Response) => {
  const robotId = req.body.robotId || 'QD001';

  // 1. Send simulated heartbeat
  await dataStore.processHeartbeat({
    robotId,
    firmwareVersion: 'v2.4.1-cloud-rakshak',
    wifiStatus: 'CONNECTED',
    batteryLevel: Math.max(20, Math.floor(Math.random() * 25) + 75),
    cameraAvailable: true,
    freeHeap: 184500 - Math.floor(Math.random() * 10000),
    rssi: -55 - Math.floor(Math.random() * 10),
    ipAddress: '192.168.1.145',
    localPort: 80,
  });

  // 2. Poll command
  const poll = await dataStore.pollNextCommand(robotId);
  let ackResult = null;

  if (poll.hasCommand && poll.command) {
    const cmd = poll.command;
    ackResult = await dataStore.acknowledgeCommand({
      robotId,
      commandId: cmd.commandId,
      command: cmd.command,
      executionStatus: 'COMPLETED',
      executionTimestamp: new Date().toISOString(),
      details: `Hardware Serial2 instruction executed for ${cmd.command}`,
    });

    if (cmd.command === 'CAPTURE_IMAGE') {
      await generateDemoCapture(robotId);
    }
  }

  const robotStatus = await dataStore.getRobotStatus(robotId);

  res.json({
    simulated: true,
    heartbeatUpdated: true,
    polledCommand: poll.command || null,
    ackResult,
    robotStatus,
  });
});

/**
 * Helper to generate an updated simulated camera capture in Demo Mode
 */
async function generateDemoCapture(robotId: string): Promise<void> {
  const angles = ['FORWARD CORRIDOR', 'LEFT SECTOR', 'RIGHT PERIMETER'];
  const label = angles[Math.floor(Math.random() * angles.length)];
  const timestamp = new Date().toLocaleTimeString();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <defs>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#020617"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="gridGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#030712"/>
      </linearGradient>
    </defs>
    <rect width="640" height="310" fill="url(#skyGrad)"/>
    <rect y="310" width="640" height="170" fill="url(#gridGrad)"/>
    <line x1="320" y1="310" x2="320" y2="480" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,4"/>
    <line x1="160" y1="310" x2="40" y2="480" stroke="#475569" stroke-width="1"/>
    <line x1="480" y1="310" x2="600" y2="480" stroke="#475569" stroke-width="1"/>
    <rect x="290" y="270" width="60" height="50" fill="#f59e0b" fill-opacity="0.15" stroke="#f59e0b" stroke-width="2" rx="4"/>
    <circle cx="320" cy="295" r="8" fill="#ef4444" fill-opacity="0.5"/>
    <circle cx="320" cy="295" r="40" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="8,4"/>
    <text x="24" y="36" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold">ACEBOTT QD001 OV2640 LIVE CAPTURE</text>
    <text x="24" y="56" fill="#94a3b8" font-family="monospace" font-size="11">TARGET: ${label} · TIME: ${timestamp}</text>
    <text x="490" y="36" fill="#22c55e" font-family="monospace" font-size="12">STATUS: CAPTURED</text>
    <text x="490" y="56" fill="#94a3b8" font-family="monospace" font-size="11">STORAGE: GCS // OK</text>
  </svg>`;

  const base64Data = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await dataStore.recordCameraImage({
    robotId,
    storagePath: `gs://smart-rakshak-captures/${robotId}/cap_${Date.now()}.jpg`,
    url: base64Data,
    captureSource: 'ESP32_CAM_MANUAL',
    contentType: 'image/svg+xml',
    size: 15420,
    width: 640,
    height: 480,
    aiAnalysis: {
      summary: `Optical capture verified at ${timestamp}. Sector scan indicates normal terrain.`,
      detectedObstacles: ['Calibrated ground marker', 'Path clearance verified'],
      isSafeToAdvance: true,
      analyzedAt: new Date().toISOString(),
    },
  });
}
