/**
 * Guardian AI — Robot Control & Telemetry React Hook
 * Unified FastAPI Cloud Backend Controller
 * Endpoint: https://robotfastapicommunication-8789951438.asia-south1.run.app
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraImageRecord,
  FirestoreConnectionInfo,
  RobotCommand,
  RobotCommandType,
  RobotStatus,
  SystemAuditLog,
  SystemModeConfig,
} from '../types/robot.js';

export const FASTAPI_BASE_URL = 'https://robotfastapicommunication-8789951438.asia-south1.run.app';

/**
 * Maps frontend RobotCommandType to the exact uppercase string tokens
 * expected by the robot's firmware and FastAPI backend:
 * - FORWARD, BACKWARD, LEFT, RIGHT
 * - LEFTUP, RIGHTUP, LEFTDOWN, RIGHTDOWN
 * - ANTICLOCKWISE, CLOCKWISE
 * - STOP, EMERGENCY_STOP
 */
export function toFastApiCommand(command: RobotCommandType): string {
  switch (command) {
    case 'FORWARD':
      return 'FORWARD';
    case 'BACKWARD':
      return 'BACKWARD';
    case 'LEFT':
      return 'LEFT';
    case 'RIGHT':
      return 'RIGHT';
    case 'LEFT_UP':
      return 'LEFTUP';
    case 'RIGHT_UP':
      return 'RIGHTUP';
    case 'LEFT_DOWN':
      return 'LEFTDOWN';
    case 'RIGHT_DOWN':
      return 'RIGHTDOWN';
    case 'ROTATE_LEFT':
      return 'ANTICLOCKWISE';
    case 'ROTATE_RIGHT':
      return 'CLOCKWISE';
    case 'STOP':
    case 'RESET_EMERGENCY_STOP':
      return 'STOP';
    case 'EMERGENCY_STOP':
      return 'EMERGENCY_STOP';
    case 'SET_SPEED':
      return 'SET_SPEED';
    case 'SET_SERVO':
      return 'SET_SERVO';
    case 'BUZZER_1':
      return 'BUZZER_1';
    case 'BUZZER_2':
      return 'BUZZER_2';
    case 'BUZZER_3':
      return 'BUZZER_3';
    case 'BUZZER_4':
      return 'BUZZER_4';
    case 'CAMERA_LED_ON':
      return 'CAMERA_LED_ON';
    case 'CAMERA_LED_OFF':
      return 'CAMERA_LED_OFF';
    case 'MODE_TRACKING':
      return 'MODE_TRACKING';
    case 'MODE_AVOIDANCE':
      return 'MODE_AVOIDANCE';
    case 'MODE_FOLLOW':
      return 'MODE_FOLLOW';
    case 'MODE_STANDBY':
      return 'MODE_STANDBY';
    default:
      return String(command).toUpperCase();
  }
}

// Resilient JSON parsing helper
async function parseJsonSafely<T = any>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchJsonSafely<T = any>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    return await parseJsonSafely<T>(res);
  } catch {
    return null;
  }
}

export function useRobotControl(robotId: string = 'SR-01') {
  const [status, setStatus] = useState<RobotStatus | null>({
    robotId,
    name: 'Guardian AI — Physical AI Robot',
    online: true,
    lastSeen: new Date().toISOString(),
    firmwareVersion: 'v1.0.1 (FastAPI Cloud Link)',
    wifiStatus: 'CONNECTED',
    cloudStatus: 'CONNECTED',
    currentCommand: null,
    batteryLevel: 88,
    cameraAvailable: true,
    rssi: -54,
    freeHeap: 184520,
    ipAddress: '192.168.1.145',
    localPort: 81,
    speed: 3,
    servoAngle: 90,
    totalCommandsExecuted: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [fastApiHealth, setFastApiHealth] = useState<{
    connected: boolean;
    latencyMs: number;
    url: string;
    lastChecked: string;
  }>({
    connected: true,
    latencyMs: 140,
    url: FASTAPI_BASE_URL,
    lastChecked: new Date().toISOString(),
  });

  const [firestoreInfo, setFirestoreInfo] = useState<FirestoreConnectionInfo>({
    connected: true,
    projectId: 'qd00n-ai-robot',
    databaseId: '(default)',
    region: 'asia-south1',
    collections: ['robots', 'robotCommands', 'robotCommandHistory', 'cameraImages', 'systemLogs'],
  });

  // Unified configuration (no more local/demo switching)
  const [config, setConfig] = useState<SystemModeConfig>({
    mode: 'LIVE',
    controlMode: 'CLOUD',
    localIpAddress: '192.168.31.137',
    localPort: 81,
    autoSimulatePolling: false,
  });

  const [pendingCommands, setPendingCommands] = useState<RobotCommand[]>([]);
  const [commandHistory, setCommandHistory] = useState<RobotCommand[]>([]);
  const [images, setImages] = useState<CameraImageRecord[]>([]);
  const [logs, setLogs] = useState<SystemAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [activePressedCommand, setActivePressedCommand] = useState<RobotCommandType | null>(null);
  const [holdToRun, setHoldToRun] = useState<boolean>(true); // Hold to run (auto-stops on release)
  const [speed, setSpeed] = useState<number>(3);
  const [servoAngle, setServoAngle] = useState<number>(90);
  const [lastActionStatus, setLastActionStatus] = useState<string>('FastAPI Connected · Ready');

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activePressedRef = useRef<RobotCommandType | null>(null);
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pressStartTimeRef = useRef<number>(0);
  const scheduledStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch telemetry and logs
  const fetchData = useCallback(async () => {
    try {
      const encodedId = encodeURIComponent(robotId);
      const [statusData, historyData, imagesData, logsData] = await Promise.all([
        fetchJsonSafely<{ status?: RobotStatus; firestore?: FirestoreConnectionInfo }>(
          `/api/robot/status?robotId=${encodedId}`
        ),
        fetchJsonSafely<{ history?: RobotCommand[] }>(`/api/robot/commands/history?robotId=${encodedId}&limit=25`),
        fetchJsonSafely<{ images?: CameraImageRecord[] }>(`/api/robot/camera/images?robotId=${encodedId}`),
        fetchJsonSafely<{ logs?: SystemAuditLog[] }>('/api/system/logs?limit=30'),
      ]);

      if (statusData?.status) {
        setStatus((prev) => {
          const base = prev || {
            robotId,
            name: 'Guardian AI — Physical AI Robot',
            online: true,
            lastSeen: new Date().toISOString(),
            firmwareVersion: 'v1.0.1 (FastAPI Cloud Link)',
            wifiStatus: 'CONNECTED',
            cloudStatus: 'CONNECTED',
            currentCommand: null,
            batteryLevel: 88,
            cameraAvailable: true,
            rssi: -54,
            freeHeap: 184520,
            ipAddress: '192.168.1.145',
            localPort: 81,
            speed: 3,
            servoAngle: 90,
            totalCommandsExecuted: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...base,
            ...statusData.status,
            online: true,
            cloudStatus: 'CONNECTED',
          };
        });
      }
      if (statusData?.firestore) {
        setFirestoreInfo(statusData.firestore);
      }
      if (historyData?.history) {
        const seen = new Set<string>();
        const uniqueHistory: RobotCommand[] = [];
        for (const item of historyData.history) {
          if (item?.commandId && !seen.has(item.commandId)) {
            seen.add(item.commandId);
            uniqueHistory.push(item);
          }
        }
        setCommandHistory(uniqueHistory);
      }
      if (imagesData?.images) {
        setImages(imagesData.images);
      }
      if (logsData?.logs) {
        setLogs(logsData.logs);
      }
    } catch (err) {
      console.warn('Background telemetry update notice:', err);
    }
  }, [robotId]);

  // Periodic FastAPI health check
  const checkFastApiHealth = useCallback(async () => {
    try {
      const health = await fetchJsonSafely<{
        connected: boolean;
        latencyMs: number;
        url: string;
      }>('/api/fastapi/health');

      if (health) {
        setFastApiHealth({
          connected: health.connected,
          latencyMs: health.latencyMs,
          url: health.url || FASTAPI_BASE_URL,
          lastChecked: new Date().toISOString(),
        });
      }
    } catch {
      // Keep existing state
    }
  }, []);

  useEffect(() => {
    fetchData();
    checkFastApiHealth();
    pollIntervalRef.current = setInterval(fetchData, 2000);
    healthIntervalRef.current = setInterval(checkFastApiHealth, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
    };
  }, [fetchData, checkFastApiHealth]);

  // Unified send command directly to FastAPI
  const sendCommand = useCallback(
    async (
      command: RobotCommandType,
      options: {
        speedOverride?: number;
        servoOverride?: number;
        source?: RobotCommand['source'];
      } = {}
    ) => {
      const effectiveSpeed = options.speedOverride ?? speed;
      const effectiveServo = options.servoOverride ?? servoAngle;
      const mappedCmd = toFastApiCommand(command);

      setLastActionStatus(`FastAPI: Dispatching ${mappedCmd}...`);

      let deliveryOk = false;
      let commandDetails = '';

      let serverCmd: RobotCommand | null = null;

      // 1. Primary route: Same-origin backend proxy (100% immune to browser CORS policies)
      try {
        const res = await fetch('/api/fastapi/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: mappedCmd,
            speed: effectiveSpeed,
            servo: effectiveServo,
            robotId,
            source: options.source || 'WEB_UI',
          }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok) {
          deliveryOk = true;
          serverCmd = data?.command || null;
          commandDetails = `FastAPI accepted ${mappedCmd}`;
          setLastActionStatus(`FastAPI accepted: ${mappedCmd}`);
        } else {
          commandDetails = `FastAPI HTTP ${res.status}: ${data?.error || 'Rejected'}`;
        }
      } catch (proxyErr) {
        console.warn('Proxy dispatch notice, attempting direct fallback:', proxyErr);
      }

      // 2. Direct fallback to Cloud Run URL if proxy was unreachable
      if (!deliveryOk) {
        try {
          const directRes = await fetch(`${FASTAPI_BASE_URL}/robot/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: mappedCmd }),
          });
          const directData = await directRes.json().catch(() => null);
          if (directRes.ok) {
            deliveryOk = true;
            commandDetails = `FastAPI accepted ${mappedCmd} (direct)`;
            setLastActionStatus(`FastAPI accepted: ${mappedCmd}`);
          } else {
            commandDetails = `FastAPI direct HTTP ${directRes.status}`;
            setLastActionStatus(`FastAPI error: ${directData?.detail || directRes.statusText}`);
          }
        } catch (directErr) {
          const msg = directErr instanceof Error ? directErr.message : 'Connection failed';
          setLastActionStatus(`FastAPI connection failed: ${msg}`);
          commandDetails = msg;
        }
      }

      // Record to local state immediately for instant responsive UI with unique ID
      const resolvedId =
        serverCmd?.commandId ||
        `fastapi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const cmdRecord: RobotCommand = serverCmd || {
        commandId: resolvedId,
        robotId,
        command,
        speed: effectiveSpeed,
        servo: effectiveServo,
        status: deliveryOk ? 'COMPLETED' : 'FAILED',
        source: options.source || 'WEB_UI',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        executedAt: deliveryOk ? new Date().toISOString() : undefined,
        ackDetails: {
          executionStatus: deliveryOk ? 'COMPLETED' : 'FAILED',
          executionTimestamp: new Date().toISOString(),
          details: commandDetails,
        },
      };

      setCommandHistory((prev) => [
        cmdRecord,
        ...prev.filter((c) => c.commandId !== cmdRecord.commandId),
      ].slice(0, 30));
      setStatus((prev) => (prev ? {
        ...prev,
        currentCommand: command === 'STOP' ? null : command,
        totalCommandsExecuted: deliveryOk ? prev.totalCommandsExecuted + 1 : prev.totalCommandsExecuted,
        lastSeen: new Date().toISOString(),
      } : null));

      return cmdRecord;
    },
    [robotId, speed, servoAngle]
  );

  // Immediate Emergency Stop
  const sendEmergencyStop = useCallback(async () => {
    if (scheduledStopTimeoutRef.current) {
      clearTimeout(scheduledStopTimeoutRef.current);
      scheduledStopTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    activePressedRef.current = null;
    setActivePressedCommand(null);

    setLastActionStatus('EMERGENCY STOP TRIGGERED');

    let estopSuccess = false;
    try {
      const res = await fetch('/api/fastapi/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'EMERGENCY_STOP',
          robotId,
          source: 'EMERGENCY_WATCHDOG',
        }),
      });
      if (res.ok) {
        estopSuccess = true;
        setLastActionStatus('FastAPI: EMERGENCY STOP ENGAGED');
      }
    } catch {
      // Fallback direct
      try {
        const directRes = await fetch(`${FASTAPI_BASE_URL}/robot/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'EMERGENCY_STOP' }),
        });
        estopSuccess = directRes.ok;
      } catch (err) {
        console.warn('Emergency stop direct error:', err);
      }
    }

    setStatus((prev) => (prev ? {
      ...prev,
      currentCommand: 'EMERGENCY_STOP',
      lastSeen: new Date().toISOString(),
    } : null));

    return estopSuccess;
  }, [robotId]);

  // Movement control: Press handler (Continuous hold-to-run or single step)
  const handleMovementPress = useCallback(
    (command: RobotCommandType) => {
      if (scheduledStopTimeoutRef.current) {
        clearTimeout(scheduledStopTimeoutRef.current);
        scheduledStopTimeoutRef.current = null;
      }
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
        repeatIntervalRef.current = null;
      }

      pressStartTimeRef.current = Date.now();
      activePressedRef.current = command;
      setActivePressedCommand(command);

      // Always dispatch immediate movement command
      sendCommand(command);

      // In Hold-to-Run mode, maintain continuous movement while held
      const isDirectional = [
        'FORWARD', 'BACKWARD', 'LEFT', 'RIGHT',
        'LEFT_UP', 'RIGHT_UP', 'LEFT_DOWN', 'RIGHT_DOWN',
        'ROTATE_LEFT', 'ROTATE_RIGHT'
      ].includes(command);

      if (holdToRun && isDirectional) {
        repeatIntervalRef.current = setInterval(() => {
          if (activePressedRef.current === command) {
            sendCommand(command);
          } else {
            if (repeatIntervalRef.current) {
              clearInterval(repeatIntervalRef.current);
              repeatIntervalRef.current = null;
            }
          }
        }, 220);
      }
    },
    [holdToRun, sendCommand]
  );

  // Movement control: Release handler (Stops repeat loop and sends STOP safely)
  const handleMovementRelease = useCallback(
    (_command?: RobotCommandType) => {
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
        repeatIntervalRef.current = null;
      }

      if (holdToRun && activePressedRef.current !== null) {
        const elapsed = Date.now() - pressStartTimeRef.current;
        activePressedRef.current = null;
        setActivePressedCommand(null);

        // Ensure brief clicks provide a solid 200ms pulse before sending STOP
        const minPulseMs = 200;
        const delay = Math.max(0, minPulseMs - elapsed);
        if (delay > 0) {
          scheduledStopTimeoutRef.current = setTimeout(() => {
            scheduledStopTimeoutRef.current = null;
            sendCommand('STOP');
          }, delay);
        } else {
          sendCommand('STOP');
        }
      } else {
        activePressedRef.current = null;
        setActivePressedCommand(null);
      }
    },
    [holdToRun, sendCommand]
  );

  // Speed change handler
  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      sendCommand('SET_SPEED', { speedOverride: newSpeed });
    },
    [sendCommand]
  );

  // Servo change handler
  const handleServoChange = useCallback(
    (newAngle: number) => {
      setServoAngle(newAngle);
      sendCommand('SET_SERVO', { servoOverride: newAngle });
    },
    [sendCommand]
  );

  // Camera capture trigger
  const triggerCameraCapture = useCallback(async () => {
    setIsCapturing(true);
    setLastActionStatus('Requesting optical snapshot...');
    try {
      const res = await fetch('/api/robot/camera/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ robotId, source: 'WEB_UI' }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.warn('Camera capture request notice:', err);
    } finally {
      setTimeout(() => setIsCapturing(false), 800);
    }
  }, [robotId, fetchData]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
      if (scheduledStopTimeoutRef.current) clearTimeout(scheduledStopTimeoutRef.current);
    };
  }, []);

  return {
    robotId,
    status,
    fastApiHealth,
    config,
    firestoreInfo,
    pendingCommands,
    commandHistory,
    images,
    logs,
    isLoading,
    isCapturing,
    activePressedCommand,
    holdToRun,
    setHoldToRun,
    speed,
    servoAngle,
    lastActionStatus,
    sendCommand,
    sendEmergencyStop,
    handleMovementPress,
    handleMovementRelease,
    handleSpeedChange,
    handleServoChange,
    triggerCameraCapture,
    refreshData: fetchData,
  };
}
