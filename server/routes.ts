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
import type { DeviceAckPayload, DeviceHeartbeatPayload, RobotCommand, RobotCommandType } from '../src/types/robot.ts';

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
  const robotId = (req.query.robotId as string) || dataStore.getDefaultRobotId();
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

// Cache of last synced speed per target IP to guarantee motors are never at speed 0
const lastSyncedSpeedByIp = new Map<string, number>();

// Promise-chain queue per target IP so that local commands (like FORWARD followed by STOP)
// execute sequentially in strict FIFO order, preventing ESP32 embedded server race conditions
const localDispatchQueueByIp = new Map<string, Promise<any>>();

function enqueueLocalDispatch<T>(ip: string, task: () => Promise<T>): Promise<T> {
  const current = localDispatchQueueByIp.get(ip) || Promise.resolve();
  const next = current.then(task, task); // Always continue chain even on error
  localDispatchQueueByIp.set(ip, next);
  return next;
}

function getCommandQuery(
  command: RobotCommandType,
  speed?: number,
  servo?: number
): string | null {
  const effectiveSpeed =
    typeof speed === 'number' ? Math.max(1, Math.min(5, speed)) : 3;

  const effectiveServo =
    typeof servo === 'number' ? Math.max(0, Math.min(180, servo)) : 90;

  switch (command) {
    case 'FORWARD':
      return 'cmd=car&direction=Forward';

    case 'BACKWARD':
      return 'cmd=car&direction=Backward';

    case 'LEFT':
      return 'cmd=car&direction=Left';

    case 'RIGHT':
      return 'cmd=car&direction=Right';

    case 'LEFT_UP':
      return 'cmd=car&direction=LeftUp';

    case 'RIGHT_UP':
      return 'cmd=car&direction=RightUp';

    case 'LEFT_DOWN':
      return 'cmd=car&direction=LeftDown';

    case 'RIGHT_DOWN':
      return 'cmd=car&direction=RightDown';

    case 'ROTATE_LEFT':
      return 'cmd=car&direction=Anticlockwise';

    case 'ROTATE_RIGHT':
      return 'cmd=car&direction=Clockwise';

    case 'STOP':
    case 'EMERGENCY_STOP':
    case 'RESET_EMERGENCY_STOP':
      return 'cmd=car&direction=stop';

    case 'SET_SPEED':
      return `cmd=speed&value=${encodeURIComponent(effectiveSpeed)}`;

    case 'SET_SERVO':
      return `cmd=servo&angle=${encodeURIComponent(effectiveServo)}`;

    case 'BUZZER_1':
      return 'cmd=Buzzer&value=1';

    case 'BUZZER_2':
      return 'cmd=Buzzer&value=2';

    case 'BUZZER_3':
      return 'cmd=Buzzer&value=3';

    case 'BUZZER_4':
      return 'cmd=Buzzer&value=4';

    case 'CAMERA_LED_ON':
      return 'cmd=CAM_LED&value=1';

    case 'CAMERA_LED_OFF':
      return 'cmd=CAM_LED&value=0';

    case 'MODE_TRACKING':
      return 'cmd=Track&value=1';

    case 'MODE_AVOIDANCE':
      return 'cmd=Avoidance';

    case 'MODE_FOLLOW':
      return 'cmd=Follow';

    case 'MODE_STANDBY':
      return 'cmd=Track&value=0';

    default:
      return null;
  }
}

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
    'LEFT_UP',
    'RIGHT_UP',
    'LEFT_DOWN',
    'RIGHT_DOWN',
    'ROTATE_LEFT',
    'ROTATE_RIGHT',
    'STOP',
    'EMERGENCY_STOP',
    'RESET_EMERGENCY_STOP',
    'SET_SPEED',
    'SET_SERVO',
    'CAPTURE_IMAGE',
    'BUZZER_1',
    'BUZZER_2',
    'BUZZER_3',
    'BUZZER_4',
    'CAMERA_LED_ON',
    'CAMERA_LED_OFF',
    'MODE_TRACKING',
    'MODE_AVOIDANCE',
    'MODE_FOLLOW',
    'MODE_STANDBY',
  ];

  if (!validCommands.includes(command)) {
    res.status(400).json({
      error: 'INVALID_COMMAND',
      message: `Command "${command}" is not an authorized robot command.`,
    });
    return;
  }

  const config = dataStore.getConfig();

  // If currently in LOCAL mode, route commands directly to local dispatch rather than enqueuing
  if (config.controlMode === 'LOCAL') {
    const targetIp = config.localIpAddress || '192.168.31.137';
    return enqueueLocalDispatch(targetIp, async () => {
      try {
        const query = getCommandQuery(command, speed, servo);
        if (!query) {
          res.status(400).json({ error: 'UNSUPPORTED_LOCAL_COMMAND', message: `Command ${command} not supported locally` });
          return;
        }

        // Auto-sync speed before movement if needed
        const isMovement = [
          'FORWARD', 'BACKWARD', 'LEFT', 'RIGHT',
          'LEFT_UP', 'RIGHT_UP', 'LEFT_DOWN', 'RIGHT_DOWN',
          'ROTATE_LEFT', 'ROTATE_RIGHT'
        ].includes(command);
        const effectiveSpeed = typeof speed === 'number' ? Math.max(1, Math.min(5, speed)) : 3;
        if (isMovement && lastSyncedSpeedByIp.get(targetIp) !== effectiveSpeed) {
          try {
            const speedController = new AbortController();
            const speedTimeout = setTimeout(() => speedController.abort(), 1200);
            await fetch(`http://${targetIp}:81/control?cmd=speed&value=${effectiveSpeed}`, {
              method: 'GET',
              signal: speedController.signal,
            });
            clearTimeout(speedTimeout);
            lastSyncedSpeedByIp.set(targetIp, effectiveSpeed);
          } catch (speedErr) {
            console.warn(`[Local Relay Speed Sync Warning] Could not preload speed ${effectiveSpeed}:`, speedErr);
          }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const upstreamRes = await fetch(`http://${targetIp}:81/control?${query}`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const localCmd: RobotCommand = {
          commandId: `local-${Date.now()}`,
          robotId: robotId || dataStore.getDefaultRobotId(),
          command,
          speed: effectiveSpeed,
          servo: typeof servo === 'number' ? servo : 90,
          status: upstreamRes.ok ? 'COMPLETED' : 'FAILED',
          source: source || 'WEB_UI',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10000).toISOString(),
          executedAt: upstreamRes.ok ? new Date().toISOString() : undefined,
          ackDetails: {
            executionStatus: upstreamRes.ok ? 'COMPLETED' : 'FAILED',
            executionTimestamp: new Date().toISOString(),
            details: upstreamRes.ok
              ? `HTTP 200 delivered to http://${targetIp}:81/control?${query} (HTTP transport delivery confirmed; does not verify physical motor movement)`
              : `Local dispatch error: HTTP ${upstreamRes.status}`,
          },
        };

        dataStore.recordLocalCommand(localCmd);

        res.status(upstreamRes.status).json({
          success: upstreamRes.ok,
          command: localCmd,
          queueLength: 0,
          deliveryOnly: true,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Local dispatch failed';
        res.status(502).json({
          success: false,
          error: 'LOCAL_DISPATCH_FAILED',
          message: errorMsg,
        });
      }
    });
  }

  try {
    const enqueued = await dataStore.enqueueCommand(command, {
      robotId,
      speed: typeof speed === 'number' ? speed : undefined,
      servo: typeof servo === 'number' ? servo : undefined,
      source: source || 'WEB_UI',
    });

    // If in DEMO mode with autoSimulatePolling turned on, immediately trigger simulator cycle
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
  const robotId = req.body.robotId || dataStore.getDefaultRobotId();
  const config = dataStore.getConfig();

  // In LOCAL mode, dispatch STOP directly to ESP32 without enqueuing to DEMO queue
  if (config.controlMode === 'LOCAL') {
    const targetIp = config.localIpAddress || '192.168.31.137';
    return enqueueLocalDispatch(targetIp, async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const upstreamRes = await fetch(`http://${targetIp}:81/control?var=car&val=0`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const stopCmd: RobotCommand = {
          commandId: `local-estop-${Date.now()}`,
          robotId,
          command: 'EMERGENCY_STOP',
          status: upstreamRes.ok ? 'COMPLETED' : 'FAILED',
          source: req.body.source || 'EMERGENCY_WATCHDOG',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10000).toISOString(),
          executedAt: upstreamRes.ok ? new Date().toISOString() : undefined,
          ackDetails: {
            executionStatus: upstreamRes.ok ? 'COMPLETED' : 'FAILED',
            executionTimestamp: new Date().toISOString(),
            details: upstreamRes.ok
              ? `HTTP 200 delivered to http://${targetIp}:81/control?var=car&val=0 (HTTP transport delivery confirmed; does not verify physical motor movement)`
              : `Local emergency stop failed with HTTP ${upstreamRes.status}`,
          },
        };

        dataStore.recordLocalCommand(stopCmd);

        res.status(upstreamRes.status).json({
          emergencyStopActive: true,
          command: stopCmd,
          message: 'LOCAL EMERGENCY STOP: var=car&val=0 delivered to ESP32 on port 81.',
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Local emergency stop failed';
        res.status(502).json({
          emergencyStopActive: false,
          error: 'LOCAL_ESTOP_FAILED',
          message: errorMsg,
        });
      }
    });
  }

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

/// POST /api/robot/local-dispatch
// Direct local relay for LOCAL mode: calls ESP32 directly at 192.168.31.137:81/control.
// Strictly locked to the configured robot IP, port 81, and the /control endpoint.
// Uses sequential FIFO dispatch queue to prevent concurrent request collisions on ESP32 web server.
apiRouter.post('/robot/local-dispatch', async (req: Request, res: Response) => {
  const config = dataStore.getConfig();
  const configuredIp = config.localIpAddress || '192.168.31.137';
  const targetIp = (req.body.ip || configuredIp).trim();
  const targetPort = 81; // Strictly locked to port 81

  // Restrict requests to the configured robot IP only (no arbitrary destinations)
  if (targetIp !== configuredIp && targetIp !== '192.168.31.137') {
    res.status(400).json({
      ok: false,
      error: 'INVALID_DESTINATION',
      message: `Destination IP ${targetIp} is not authorized. Must target configured robot IP.`,
    });
    return;
  }

  // Determine query parameters from command type or explicit query string
  let query = (typeof req.body.query === 'string' ? req.body.query : '').trim();
  const command = req.body.command as RobotCommandType | undefined;
  const speed = typeof req.body.speed === 'number' ? Math.max(1, Math.min(5, req.body.speed)) : 3;
  const servo = typeof req.body.servo === 'number' ? req.body.servo : 90;

  if (command) {
    const mapped = getCommandQuery(command, speed, servo);
    if (mapped) {
      query = mapped;
      if (command === 'SET_SPEED') {
        lastSyncedSpeedByIp.set(targetIp, speed);
      }
    } else {
      res.status(400).json({
        ok: false,
        error: 'UNSUPPORTED_COMMAND',
        message: `Command "${command}" is not supported in local direct mode.`,
      });
      return;
    }
  }

  // Validate supported native hardware command formats.
  const isAuthorizedCar =
    /^cmd=car&direction=(Forward|Backward|Left|Right|LeftUp|RightUp|LeftDown|RightDown|Anticlockwise|Clockwise|stop)$/.test(query);

  const isAuthorizedSpeed =
    /^cmd=speed&value=[1-5]$/.test(query);

  const isAuthorizedServo =
    /^cmd=servo&angle=(0|[1-9][0-9]?|1[0-7][0-9]|180)$/.test(query);

  const isAuthorizedBuzzer =
    /^cmd=Buzzer&value=[1-4]$/.test(query);

  const isAuthorizedCameraLed =
    /^cmd=CAM_LED&value=[0-1]$/.test(query);

  const isAuthorizedTrack =
    /^cmd=Track&value=[0-2]$/.test(query);

  const isAuthorizedMode =
    /^cmd=(Avoidance|Follow)$/.test(query);

  if (
    !isAuthorizedCar &&
    !isAuthorizedSpeed &&
    !isAuthorizedServo &&
    !isAuthorizedBuzzer &&
    !isAuthorizedCameraLed &&
    !isAuthorizedTrack &&
    !isAuthorizedMode
  ) {
    res.status(400).json({
      ok: false,
      error: 'INVALID_QUERY',
      message: `Query parameter "${query}" is not an authorized /control parameter.`,
    });
    return;
  }

  const isMovement = command && [
    'FORWARD', 'BACKWARD', 'LEFT', 'RIGHT',
    'LEFT_UP', 'RIGHT_UP', 'LEFT_DOWN', 'RIGHT_DOWN',
    'ROTATE_LEFT', 'ROTATE_RIGHT'
  ].includes(command);

  return enqueueLocalDispatch(targetIp, async () => {
    // Auto-sync speed to robot hardware before movement if not yet confirmed in this session
    if (isMovement && lastSyncedSpeedByIp.get(targetIp) !== speed) {
      try {
        const speedUrl = `http://${targetIp}:${targetPort}/control?var=speed&val=${speed}`;
        const speedController = new AbortController();
        const speedTimeout = setTimeout(() => speedController.abort(), 1200);
        await fetch(speedUrl, { method: 'GET', signal: speedController.signal });
        clearTimeout(speedTimeout);
        lastSyncedSpeedByIp.set(targetIp, speed);
      } catch (speedErr) {
        console.warn(`[Local Relay Speed Sync Warning] Could not preload speed ${speed} to ${targetIp}:81:`, speedErr);
      }
    }

    const targetUrl = `http://${targetIp}:${targetPort}/control?${query}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // Strict 2-second timeout

      const upstreamRes = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const bodyText = await upstreamRes.text().catch(() => '');

      // Record successful local execution directly in dataStore (without enqueuing to pending queue)
      let recordedCommand: RobotCommand | undefined;
      if (command) {
        recordedCommand = {
          commandId: `local-${Date.now()}`,
          robotId: req.body.robotId || dataStore.getDefaultRobotId(),
          command,
          speed,
          servo,
          status: upstreamRes.ok ? 'COMPLETED' : 'FAILED',
          source: req.body.source || 'WEB_UI',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10000).toISOString(),
          executedAt: upstreamRes.ok ? new Date().toISOString() : undefined,
          ackDetails: {
            executionStatus: upstreamRes.ok ? 'COMPLETED' : 'FAILED',
            executionTimestamp: new Date().toISOString(),
            details: upstreamRes.ok
              ? `HTTP 200 delivered to http://${targetIp}:${targetPort}/control?${query} (HTTP transport delivery confirmed; does not verify physical motor movement)`
              : `Local relay error: HTTP ${upstreamRes.status}`,
          },
        };
        dataStore.recordLocalCommand(recordedCommand);
      }

      res.status(upstreamRes.status).json({
        ok: upstreamRes.ok,
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        deliveryOnly: true,
        targetUrl,
        query,
        data: bodyText,
        command: recordedCommand,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        res.status(504).json({
          ok: false,
          status: 504,
          error: 'TIMEOUT',
          message: `Connection timed out after 2000ms reaching robot at ${targetIp}:${targetPort}`,
          targetUrl,
        });
        return;
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        ok: false,
        status: 502,
        error: 'CONNECTION_FAILED',
        message: `Robot unreachable at ${targetIp}:${targetPort}: ${errorMsg}`,
        targetUrl,
      });
    }
  });
});

// GET /api/robot/commands (Pending queue)
apiRouter.get('/robot/commands', async (req: Request, res: Response) => {
  const robotId = (req.query.robotId as string) || dataStore.getDefaultRobotId();
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
  const robotId = (req.query.robotId as string) || dataStore.getDefaultRobotId();
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
  const robotId = req.body.robotId || dataStore.getDefaultRobotId();
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
  const robotId = (req.query.robotId as string) || dataStore.getDefaultRobotId();
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
  const robotId = (req.query.robotId as string) || dataStore.getDefaultRobotId();
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
  const robotId = (req.query.robotId as string) || (req.headers['x-robot-id'] as string) || dataStore.getDefaultRobotId();
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
        robotId: robotId || dataStore.getDefaultRobotId(),
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
  const targetRobot = robotId || dataStore.getDefaultRobotId();

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
// 3B. HELPER MODE FUNCTIONAL APIS
// ==========================================

interface SimulatedSmartDevice {
  id: string;
  name: string;
  type: 'LIGHT' | 'FAN' | 'PLUG' | 'HEATER';
  location: string;
  isOn: boolean;
  powerWatts: number;
}

const simulatedDevices: Record<string, SimulatedSmartDevice> = {
  'light_living': { id: 'light_living', name: 'Living Room Overhead Light', type: 'LIGHT', location: 'Living Room', isOn: false, powerWatts: 0 },
  'lamp_bedside': { id: 'lamp_bedside', name: 'Bedside Night Lamp', type: 'LIGHT', location: 'Bedroom', isOn: true, powerWatts: 8 },
  'fan_ceiling': { id: 'fan_ceiling', name: 'Ceiling Circulation Fan', type: 'FAN', location: 'Living Room', isOn: false, powerWatts: 0 },
  'plug_heater': { id: 'plug_heater', name: 'Bedroom Heater Smart Plug', type: 'PLUG', location: 'Bedroom', isOn: false, powerWatts: 0 },
};

// POST /api/helper/assist (AI Personal Assistant)
apiRouter.post('/helper/assist', async (req: Request, res: Response) => {
  const { request } = req.body;
  if (!request || typeof request !== 'string') {
    res.status(400).json({ error: 'Request text string is required' });
    return;
  }

  try {
    const result = await geminiService.helperAssist(request);

    // Save event to history
    await dataStore.recordHelperEvent({
      category: result.category,
      summary: `AI Assistant: "${request.substring(0, 50)}${request.length > 50 ? '...' : ''}"`,
      details: result.response,
      status: 'COMPLETED',
      caregiverNotified: Boolean(result.caregiverAssistanceAppropriate),
    });

    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Helper assist processing failed';
    res.status(500).json({ error: 'HELPER_ASSIST_FAILED', message: errorMsg });
  }
});

// POST /api/helper/vision-analyze (Visual Assistance with uploaded base64 or stored image)
apiRouter.post('/helper/vision-analyze', async (req: Request, res: Response) => {
  const { imageBase64, imageId, question, robotId } = req.body;
  let targetImageBase64 = imageBase64;

  if (!targetImageBase64 && imageId) {
    const images = await dataStore.getCameraImages(robotId || 'SR-01');
    const found = images.find((i) => i.imageId === imageId);
    if (found) targetImageBase64 = found.url;
  }

  if (!targetImageBase64) {
    const images = await dataStore.getCameraImages(robotId || 'SR-01');
    if (images.length > 0) targetImageBase64 = images[0].url;
  }

  if (!targetImageBase64) {
    res.status(400).json({ error: 'Image data or valid imageId is required for visual analysis' });
    return;
  }

  try {
    const result = await geminiService.helperVisionAnalyze(targetImageBase64, question || 'Describe my surroundings.');

    // Save event to history
    await dataStore.recordHelperEvent({
      category: 'VISUAL_INSPECTION',
      summary: `Visual Inspection: ${result.sceneDescription.substring(0, 60)}...`,
      details: result.recommendedAction,
      status: 'COMPLETED',
      caregiverNotified: false,
    });

    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Visual analysis failed';
    res.status(500).json({ error: 'VISUAL_ANALYSIS_FAILED', message: errorMsg });
  }
});

// POST /api/helper/caregiver-draft (Caregiver Assistance)
apiRouter.post('/helper/caregiver-draft', async (req: Request, res: Response) => {
  const { reason, userNotes, roomLocation } = req.body;
  if (!reason || typeof reason !== 'string') {
    res.status(400).json({ error: 'Reason for caregiver assistance is required' });
    return;
  }

  try {
    const draft = await geminiService.draftCaregiverMessage(reason, userNotes, roomLocation);

    // Save event to history
    await dataStore.recordHelperEvent({
      category: 'CAREGIVER_ALERT',
      summary: `Caregiver Alert Drafted: "${reason}" (${draft.urgency})`,
      details: draft.message,
      status: 'PREPARED_FOR_REVIEW',
      caregiverNotified: false,
    });

    res.json(draft);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Caregiver message drafting failed';
    res.status(500).json({ error: 'CAREGIVER_DRAFT_FAILED', message: errorMsg });
  }
});

// GET /api/helper/events (Assistance History)
apiRouter.get('/helper/events', async (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '30', 10);
  try {
    const data = await dataStore.getHelperEvents(limit);
    res.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch helper events';
    res.status(500).json({ error: 'FETCH_EVENTS_FAILED', message: errorMsg });
  }
});

// POST /api/helper/events (Save event manually)
apiRouter.post('/helper/events', async (req: Request, res: Response) => {
  const { category, summary, details, status, caregiverNotified } = req.body;
  if (!category || !summary) {
    res.status(400).json({ error: 'category and summary are required' });
    return;
  }

  try {
    const saved = await dataStore.recordHelperEvent({
      category,
      summary,
      details,
      status: status || 'COMPLETED',
      caregiverNotified: Boolean(caregiverNotified),
    });
    res.json({ success: true, event: saved });
  } catch (err: unknown) {
    res.status(500).json({ error: 'RECORD_EVENT_FAILED' });
  }
});

// GET & POST /api/helper/smart-home (Smart Home Assistance)
apiRouter.get('/helper/smart-home/devices', (_req: Request, res: Response) => {
  res.json({
    connectedToPhysicalBridge: false,
    bridgeType: 'SIMULATED_DEMONSTRATION',
    notice: 'No physical smart home bridge (e.g. Matter / Home Assistant hub) is connected. Device toggles below are executed in an interactive labelled simulation.',
    devices: Object.values(simulatedDevices),
  });
});

apiRouter.post('/helper/smart-home/toggle', async (req: Request, res: Response) => {
  const { deviceId, targetState } = req.body;
  const device = simulatedDevices[deviceId];
  if (!device) {
    res.status(404).json({ error: 'DEVICE_NOT_FOUND', message: `Device ${deviceId} was not found` });
    return;
  }

  device.isOn = typeof targetState === 'boolean' ? targetState : !device.isOn;
  if (device.type === 'LIGHT') device.powerWatts = device.isOn ? 15 : 0;
  if (device.type === 'FAN') device.powerWatts = device.isOn ? 45 : 0;
  if (device.type === 'PLUG') device.powerWatts = device.isOn ? 1200 : 0;

  // Record event in history
  await dataStore.recordHelperEvent({
    category: 'SMART_HOME',
    summary: `Simulated Smart Home: ${device.name} turned ${device.isOn ? 'ON' : 'OFF'}`,
    details: `Device: ${device.name} (${device.location}), Power: ${device.powerWatts}W`,
    status: 'SIMULATED_ACTION',
    caregiverNotified: false,
  });

  res.json({
    success: true,
    simulated: true,
    device,
    message: `[Simulated Appliance Hub] ${device.name} is now ${device.isOn ? 'ON' : 'OFF'}. (Demonstration only; physical bridge not connected).`,
  });
});

// ==========================================
// GUARDIAN MODE APIS (Child Safety & Companion)
// ==========================================

// POST /api/guardian/companion (Child-friendly conversational AI companion)
apiRouter.post('/guardian/companion', async (req: Request, res: Response) => {
  const { request } = req.body;
  if (!request || typeof request !== 'string') {
    res.status(400).json({ error: 'Request string is required' });
    return;
  }

  try {
    const result = await geminiService.guardianCompanion(request);

    // Save event to history
    await dataStore.recordGuardianEvent({
      category: result.category,
      summary: `Child Companion: "${request.length > 50 ? request.substring(0, 47) + '...' : request}"`,
      details: result.response,
      recommendedAction: result.recommendedNextStep,
      status: 'COMPLETED',
      adultNotified: Boolean(result.encourageAdultContact),
    });

    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Companion processing failed';
    res.status(500).json({ error: 'GUARDIAN_COMPANION_FAILED', message: errorMsg });
  }
});

// POST /api/guardian/safety-guidance (Child Safety Guidance for Home Situations)
apiRouter.post('/guardian/safety-guidance', async (req: Request, res: Response) => {
  const { situation, details } = req.body;
  if (!situation || typeof situation !== 'string') {
    res.status(400).json({ error: 'Situation string is required' });
    return;
  }

  try {
    const result = await geminiService.guardianSafetyGuidance(situation, details);

    // Save event to history
    await dataStore.recordGuardianEvent({
      category: 'SAFETY_GUIDANCE',
      summary: `Safety Guidance: "${situation}"`,
      details: result.guidanceSteps.join(' · '),
      recommendedAction: result.cautionAdvice,
      status: 'COMPLETED',
      adultNotified: Boolean(result.mustContactAdultImmediately),
    });

    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Safety guidance processing failed';
    res.status(500).json({ error: 'GUARDIAN_SAFETY_GUIDANCE_FAILED', message: errorMsg });
  }
});

// POST /api/guardian/vision-analyze (Camera-Based Environmental Safety Analysis)
apiRouter.post('/guardian/vision-analyze', async (req: Request, res: Response) => {
  const { imageBase64, imageId, question, robotId } = req.body;
  let targetImageBase64 = imageBase64;

  if (!targetImageBase64 && imageId) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    const found = images.find((i) => i.imageId === imageId);
    if (found) targetImageBase64 = found.url;
  }

  if (!targetImageBase64) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    if (images.length > 0) targetImageBase64 = images[0].url;
  }

  if (!targetImageBase64) {
    res.status(400).json({ error: 'Image data or valid imageId is required for visual safety analysis' });
    return;
  }

  try {
    const result = await geminiService.guardianVisionAnalyze(targetImageBase64, question || 'Check the room for obstacles or safety concerns.');

    // Save event to history
    await dataStore.recordGuardianEvent({
      category: 'VISUAL_INSPECTION',
      summary: `Visual Safety: ${result.sceneDescription.substring(0, 50)}...`,
      details: result.potentialConcerns.join(', '),
      recommendedAction: result.recommendedNextSteps,
      status: 'COMPLETED',
      adultNotified: false,
    });

    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Visual safety analysis failed';
    res.status(500).json({ error: 'GUARDIAN_VISION_ANALYSIS_FAILED', message: errorMsg });
  }
});

// POST /api/guardian/assistance-draft (Request Assistance / Message Formulator)
apiRouter.post('/guardian/assistance-draft', async (req: Request, res: Response) => {
  const { reason, notes, roomLocation } = req.body;
  if (!reason || typeof reason !== 'string') {
    res.status(400).json({ error: 'Reason for assistance request is required' });
    return;
  }

  try {
    const draft = await geminiService.guardianDraftAssistance(reason, notes, roomLocation);

    // Save event to history
    await dataStore.recordGuardianEvent({
      category: 'ASSISTANCE_REQUEST',
      summary: `Child Assistance Request: "${reason}" (${draft.urgency})`,
      details: draft.preparedAlertMessage,
      recommendedAction: draft.recommendedAction,
      status: 'PREPARED_FOR_ADULT',
      adultNotified: false,
    });

    res.json(draft);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Assistance drafting failed';
    res.status(500).json({ error: 'GUARDIAN_ASSISTANCE_DRAFT_FAILED', message: errorMsg });
  }
});

// GET /api/guardian/events (Safety Events & Assistance History)
apiRouter.get('/guardian/events', async (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '30', 10);
  try {
    const data = await dataStore.getGuardianEvents(limit);
    res.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch guardian events';
    res.status(500).json({ error: 'FETCH_GUARDIAN_EVENTS_FAILED', message: errorMsg });
  }
});

// POST /api/guardian/events (Save event manually)
apiRouter.post('/guardian/events', async (req: Request, res: Response) => {
  const { category, summary, details, recommendedAction, status, adultNotified } = req.body;
  if (!category || !summary) {
    res.status(400).json({ error: 'category and summary are required' });
    return;
  }

  try {
    const saved = await dataStore.recordGuardianEvent({
      category,
      summary,
      details,
      recommendedAction: recommendedAction || 'Check with adult',
      status: status || 'COMPLETED',
      adultNotified: Boolean(adultNotified),
    });
    res.json({ success: true, event: saved });
  } catch {
    res.status(500).json({ error: 'RECORD_GUARDIAN_EVENT_FAILED' });
  }
});

// ==========================================
// 3D. PROTECTION MODE APIS (Home Safety Awareness & Hazard Detection)
// ==========================================

// POST /api/protection/vision-analyze (Actual multimodal image analysis with Gemini)
apiRouter.post('/api/protection/vision-analyze', async (req: Request, res: Response) => {
  const { imageBase64, imageId, userFocus, robotId } = req.body;
  let targetImageBase64 = imageBase64;

  if (!targetImageBase64 && imageId) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    const found = images.find((i) => i.imageId === imageId);
    if (found) targetImageBase64 = found.url;
  }

  if (!targetImageBase64) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    if (images.length > 0) targetImageBase64 = images[0].url;
  }

  if (!targetImageBase64) {
    res.status(400).json({
      error: 'NO_IMAGE_PROVIDED',
      message: 'Please upload a photo captured from the robot camera or select an existing camera capture.',
    });
    return;
  }

  try {
    const analysis = await geminiService.protectionVisionAnalyze(targetImageBase64, userFocus);

    // Persist safety event to Firestore / in-memory store
    let savedEvent = null;
    try {
      savedEvent = await dataStore.recordProtectionEvent({
        source: imageBase64 ? 'UPLOADED_ROBOT_CAMERA_IMAGE' : 'STORED_CAMERA_CAPTURE',
        shortSummary:
          analysis.overallSummary.length > 80
            ? analysis.overallSummary.substring(0, 77) + '...'
            : analysis.overallSummary,
        assessmentCategory: analysis.assessmentCategory,
        identifiedObservations: analysis.identifiedHazards.map(
          (h) => `${h.description} (${h.conditionType === 'OBSERVED_CONDITION' ? 'Observed' : 'Risk'})`
        ),
        recommendedActions: analysis.recommendedActions,
        status: analysis.isInconclusive ? 'INCONCLUSIVE' : 'COMPLETED',
      });
    } catch (saveErr) {
      console.warn('Protection event persistence warning:', saveErr);
    }

    res.json({
      success: true,
      analysis,
      event: savedEvent,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Protection visual analysis failed';
    res.status(500).json({
      error: 'PROTECTION_VISION_ANALYSIS_FAILED',
      message: errorMsg,
    });
  }
});

// Also support route without /api prefix mount since apiRouter is mounted at /api
apiRouter.post('/protection/vision-analyze', async (req: Request, res: Response) => {
  const { imageBase64, imageId, userFocus, robotId } = req.body;
  let targetImageBase64 = imageBase64;

  if (!targetImageBase64 && imageId) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    const found = images.find((i) => i.imageId === imageId);
    if (found) targetImageBase64 = found.url;
  }

  if (!targetImageBase64) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    if (images.length > 0) targetImageBase64 = images[0].url;
  }

  if (!targetImageBase64) {
    res.status(400).json({
      error: 'NO_IMAGE_PROVIDED',
      message: 'Please upload a photo captured from the robot camera or select an existing camera capture.',
    });
    return;
  }

  try {
    const analysis = await geminiService.protectionVisionAnalyze(targetImageBase64, userFocus);

    let savedEvent = null;
    try {
      savedEvent = await dataStore.recordProtectionEvent({
        source: imageBase64 ? 'UPLOADED_ROBOT_CAMERA_IMAGE' : 'STORED_CAMERA_CAPTURE',
        shortSummary:
          analysis.overallSummary.length > 80
            ? analysis.overallSummary.substring(0, 77) + '...'
            : analysis.overallSummary,
        assessmentCategory: analysis.assessmentCategory,
        identifiedObservations: analysis.identifiedHazards.map(
          (h) => `${h.description} (${h.conditionType === 'OBSERVED_CONDITION' ? 'Observed' : 'Risk'})`
        ),
        recommendedActions: analysis.recommendedActions,
        status: analysis.isInconclusive ? 'INCONCLUSIVE' : 'COMPLETED',
      });
    } catch (saveErr) {
      console.warn('Protection event persistence warning:', saveErr);
    }

    res.json({
      success: true,
      analysis,
      event: savedEvent,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Protection visual analysis failed';
    res.status(500).json({
      error: 'PROTECTION_VISION_ANALYSIS_FAILED',
      message: errorMsg,
    });
  }
});

// POST /api/protection/follow-up (Contextual follow-up questioning on the uploaded image)
apiRouter.post('/protection/follow-up', async (req: Request, res: Response) => {
  const { imageBase64, imageId, previousAnalysis, question, robotId } = req.body;

  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'Question text string is required' });
    return;
  }

  let targetImageBase64 = imageBase64;
  if (!targetImageBase64 && imageId) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    const found = images.find((i) => i.imageId === imageId);
    if (found) targetImageBase64 = found.url;
  }
  if (!targetImageBase64) {
    const images = await dataStore.getCameraImages(robotId || dataStore.getDefaultRobotId());
    if (images.length > 0) targetImageBase64 = images[0].url;
  }

  if (!targetImageBase64) {
    res.status(400).json({ error: 'Image is required for contextual follow-up question' });
    return;
  }

  try {
    const followUp = await geminiService.protectionFollowUp(
      targetImageBase64,
      previousAnalysis || {
        success: true,
        assessmentCategory: 'Caution',
        categoryRationale: 'General review',
        overallSummary: 'Indoor floor environment',
        visibleConditions: [],
        identifiedHazards: [],
        recommendedActions: [],
        timestamp: new Date().toISOString(),
        analysisLimitations: 'Single static frame',
        isInconclusive: false,
        sourceEngine: 'HEURISTIC_SAFETY_ANALYZER',
      },
      question
    );

    res.json(followUp);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Follow-up question failed';
    res.status(500).json({ error: 'PROTECTION_FOLLOW_UP_FAILED', message: errorMsg });
  }
});

// GET /api/protection/events (Protection Safety Event History)
apiRouter.get('/protection/events', async (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '30', 10);
  try {
    const data = await dataStore.getProtectionEvents(limit);
    res.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch protection events';
    res.status(500).json({ error: 'FETCH_PROTECTION_EVENTS_FAILED', message: errorMsg });
  }
});

// POST /api/protection/events (Save event manually)
apiRouter.post('/protection/events', async (req: Request, res: Response) => {
  const { source, shortSummary, assessmentCategory, identifiedObservations, recommendedActions, status } = req.body;
  if (!shortSummary || !assessmentCategory) {
    res.status(400).json({ error: 'shortSummary and assessmentCategory are required' });
    return;
  }

  try {
    const saved = await dataStore.recordProtectionEvent({
      source: source || 'UPLOADED_ROBOT_CAMERA_IMAGE',
      shortSummary,
      assessmentCategory,
      identifiedObservations: Array.isArray(identifiedObservations) ? identifiedObservations : [],
      recommendedActions: Array.isArray(recommendedActions) ? recommendedActions : [],
      status: status || 'COMPLETED',
    });
    res.json({ success: true, event: saved });
  } catch {
    res.status(500).json({ error: 'RECORD_PROTECTION_EVENT_FAILED' });
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
  const robotId = req.body.robotId || dataStore.getDefaultRobotId();

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
    <text x="24" y="36" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold">SMART RAKSHAK OV2640 LIVE CAPTURE</text>
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
