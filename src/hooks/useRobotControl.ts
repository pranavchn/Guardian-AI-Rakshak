/**
 * Smart Rakshak — Robot Control & Telemetry React Hook
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraImageRecord,
  CommandStatus,
  FirestoreConnectionInfo,
  RobotCommand,
  RobotCommandType,
  RobotStatus,
  SystemAuditLog,
  SystemModeConfig,
} from '../types/robot.js';

// Safe JSON parsing helper to guard against unexpected HTML (SPA fallbacks, auth redirects, 502/503 pages)
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

// Resilient fetch helper that catches network drops, aborts, and transient connection losses without throwing
async function fetchJsonSafely<T = any>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    return await parseJsonSafely<T>(res);
  } catch {
    return null;
  }
}

export function useRobotControl(robotId: string = 'SR-01') {
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [firestoreInfo, setFirestoreInfo] = useState<FirestoreConnectionInfo>({
    connected: false,
    projectId: 'smart-rakshak-robot',
    databaseId: '(default)',
    region: 'asia-south1',
    collections: ['robots', 'robotCommands', 'robotCommandHistory', 'robotHeartbeats', 'cameraImages', 'systemLogs'],
  });
  const [config, setConfig] = useState<SystemModeConfig>({
    mode: 'DEMO',
    controlMode: 'CLOUD',
    localIpAddress: '192.168.31.137',
    localPort: 81,
    autoSimulatePolling: false,
  });
  const [pendingCommands, setPendingCommands] = useState<RobotCommand[]>([]);
  const [commandHistory, setCommandHistory] = useState<RobotCommand[]>([]);
  const [images, setImages] = useState<CameraImageRecord[]>([]);
  const [logs, setLogs] = useState<SystemAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [activePressedCommand, setActivePressedCommand] = useState<RobotCommandType | null>(null);
  const [holdToRun, setHoldToRun] = useState<boolean>(true); // Hold to run (auto-stops on release)
  const [speed, setSpeed] = useState<number>(3);
  const [servoAngle, setServoAngle] = useState<number>(90);
  const [lastActionStatus, setLastActionStatus] = useState<string>('Ready');

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activePressedRef = useRef<RobotCommandType | null>(null);
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedLocalSpeedRef = useRef<number | null>(null);
  const pressStartTimeRef = useRef<number>(0);
  const scheduledStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localSeqRef = useRef<number>(0);

  // Fetch telemetry and queue data
  const fetchData = useCallback(async () => {
    try {
      const encodedId = encodeURIComponent(robotId);
      const [statusData, pendingData, historyData, imagesData, logsData] = await Promise.all([
        fetchJsonSafely<{ status?: RobotStatus; config?: SystemModeConfig; firestore?: FirestoreConnectionInfo }>(
          `/api/robot/status?robotId=${encodedId}`
        ),
        fetchJsonSafely<{ pending?: RobotCommand[] }>(`/api/robot/commands?robotId=${encodedId}`),
        fetchJsonSafely<{ history?: RobotCommand[] }>(`/api/robot/commands/history?robotId=${encodedId}&limit=25`),
        fetchJsonSafely<{ images?: CameraImageRecord[] }>(`/api/robot/camera/images?robotId=${encodedId}`),
        fetchJsonSafely<{ logs?: SystemAuditLog[] }>('/api/system/logs?limit=30'),
      ]);

      if (statusData) {
        if (statusData.status) setStatus(statusData.status);
        if (statusData.config) setConfig(statusData.config);
        if (statusData.firestore) setFirestoreInfo(statusData.firestore);
      }

      // In LOCAL mode, commands are direct-dispatched; suppress pending queue display so stale demo commands do not show
      if (statusData?.config?.controlMode === 'LOCAL' || config.controlMode === 'LOCAL') {
        setPendingCommands([]);
      } else if (pendingData?.pending) {
        setPendingCommands(pendingData.pending);
      }

      if (historyData?.history) {
        setCommandHistory(historyData.history);
      }

      if (imagesData?.images) {
        setImages(imagesData.images);
      }

      if (logsData?.logs) {
        setLogs(logsData.logs);
      }
    } catch (err) {
      console.warn('Notice: Background polling retry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [robotId]);

  useEffect(() => {
    fetchData();
    pollIntervalRef.current = setInterval(fetchData, 1500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchData]);

/**
 * Maps Smart Rakshak commands to native ESP32 WebServer (Port 81) query parameters.
 * Baseline endpoint on Port 81: /control?var=car&val=<0..4>
 */
function getLocalCommandQuery(
  command: RobotCommandType,
  effectiveSpeed: number,
  effectiveServo: number
): { path: string; query: string } | null {
  switch (command) {
    case 'FORWARD':
      return { path: '/control', query: 'cmd=car&direction=Forward' };

    case 'BACKWARD':
      return { path: '/control', query: 'cmd=car&direction=Backward' };

    case 'LEFT':
      return { path: '/control', query: 'cmd=car&direction=Left' };

    case 'RIGHT':
      return { path: '/control', query: 'cmd=car&direction=Right' };

    case 'LEFT_UP':
      return { path: '/control', query: 'cmd=car&direction=LeftUp' };

    case 'RIGHT_UP':
      return { path: '/control', query: 'cmd=car&direction=RightUp' };

    case 'LEFT_DOWN':
      return { path: '/control', query: 'cmd=car&direction=LeftDown' };

    case 'RIGHT_DOWN':
      return { path: '/control', query: 'cmd=car&direction=RightDown' };

    case 'ROTATE_LEFT':
      return { path: '/control', query: 'cmd=car&direction=Anticlockwise' };

    case 'ROTATE_RIGHT':
      return { path: '/control', query: 'cmd=car&direction=Clockwise' };

    case 'STOP':
    case 'EMERGENCY_STOP':
    case 'RESET_EMERGENCY_STOP':
      return { path: '/control', query: 'cmd=car&direction=stop' };

    case 'SET_SPEED':
      return {
        path: '/control',
        query: `cmd=speed&value=${encodeURIComponent(effectiveSpeed)}`,
      };

    case 'SET_SERVO':
      return {
        path: '/control',
        query: `cmd=servo&angle=${encodeURIComponent(effectiveServo)}`,
      };

    case 'BUZZER_1':
      return { path: '/control', query: 'cmd=Buzzer&value=1' };

    case 'BUZZER_2':
      return { path: '/control', query: 'cmd=Buzzer&value=2' };

    case 'BUZZER_3':
      return { path: '/control', query: 'cmd=Buzzer&value=3' };

    case 'BUZZER_4':
      return { path: '/control', query: 'cmd=Buzzer&value=4' };

    case 'CAMERA_LED_ON':
      return { path: '/control', query: 'cmd=CAM_LED&value=1' };

    case 'CAMERA_LED_OFF':
      return { path: '/control', query: 'cmd=CAM_LED&value=0' };

    case 'MODE_TRACKING':
      return { path: '/control', query: 'cmd=Track&value=1' };

    case 'MODE_AVOIDANCE':
      return { path: '/control', query: 'cmd=Avoidance' };

    case 'MODE_FOLLOW':
      return { path: '/control', query: 'cmd=Follow' };

    case 'MODE_STANDBY':
      return { path: '/control', query: 'cmd=Track&value=0' };

    case 'CAPTURE_IMAGE':
      return { path: '/capture', query: '' };

    default:
      return null;
  }
}

  // Send robot movement or config command
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

      // ==============================================================
      // LOCAL MODE: Send directly to the robot's local WebServer via same-origin relay
      // (DEMO and LIVE + CLOUD modes remain completely untouched below)
      // ==============================================================
      if (config.controlMode === 'LOCAL') {
        const targetIp = config.localIpAddress || status?.ipAddress || '192.168.31.137';
        const mapping = getLocalCommandQuery(command, effectiveSpeed, effectiveServo);

        if (!mapping) {
          setLastActionStatus(`Unsupported local command: ${command}`);
          return null;
        }

        const currentSeq = ++localSeqRef.current;
        setLastActionStatus(`Local -> ${command} (${targetIp}:81)`);

        try {
          const res = await fetch('/api/robot/local-dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ip: targetIp,
              command,
              query: mapping.query,
              speed: effectiveSpeed,
              servo: effectiveServo,
              robotId,
            }),
          });

          const data = await parseJsonSafely(res);
          const isDelivered = res.ok && data?.ok && data?.status === 200;
          const statusResult: CommandStatus = isDelivered ? 'COMPLETED' : 'FAILED';
          const statusText = isDelivered
            ? (command === 'STOP' ? 'Local: Motors Stopped' : `Local HTTP 200: ${command} delivered (Transport only)`)
            : `Relay Failed: ${data?.message || `HTTP ${res.status}`}`;

          if (currentSeq === localSeqRef.current) {
            setLastActionStatus(statusText);
          }

          const localCmd: RobotCommand = {
            commandId: `local-${Date.now()}`,
            robotId,
            command,
            speed: effectiveSpeed,
            servo: effectiveServo,
            status: statusResult,
            source: options.source || 'WEB_UI',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10000).toISOString(),
            executedAt: isDelivered ? new Date().toISOString() : undefined,
            ackDetails: {
              executionStatus: statusResult,
              executionTimestamp: new Date().toISOString(),
              details: isDelivered
                ? `HTTP 200 delivered to http://${targetIp}:81${mapping.path}?${mapping.query} via local relay (HTTP transport delivery confirmed; does not verify physical motor movement)`
                : `Local relay error: ${data?.message || `HTTP ${res.status}`}`,
            },
          };

          setCommandHistory((prev) => [localCmd, ...prev.filter((c) => c.commandId !== localCmd.commandId).slice(0, 24)]);
          return isDelivered ? localCmd : null;
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Network error';
          const failureText = `Local Relay Error: ${errorMsg}`;
          if (currentSeq === localSeqRef.current) {
            setLastActionStatus(failureText);
          }
          console.warn(`[LOCAL Mode Relay Warning] Failed to dispatch via local relay:`, err);

          const localCmd: RobotCommand = {
            commandId: `local-${Date.now()}`,
            robotId,
            command,
            speed: effectiveSpeed,
            servo: effectiveServo,
            status: 'FAILED',
            source: options.source || 'WEB_UI',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10000).toISOString(),
            ackDetails: {
              executionStatus: 'FAILED',
              executionTimestamp: new Date().toISOString(),
              details: `Relay error: ${errorMsg}`,
            },
          };

          setCommandHistory((prev) => [localCmd, ...prev.slice(0, 24)]);
          return null;
        }
      }

      // ==============================================================
      // CLOUD / DEMO MODES: Queue command via Cloud Run backend
      // ==============================================================
      setLastActionStatus(`Sending ${command}...`);
      try {
        const res = await fetch('/api/robot/commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            robotId,
            command,
            speed: effectiveSpeed,
            servo: effectiveServo,
            source: options.source || 'WEB_UI',
          }),
        });

        const data = await parseJsonSafely(res);
        if (res.ok && data) {
          setLastActionStatus(`Dispatched: ${command}`);
          // Immediate re-fetch for responsiveness
          fetchData();
          return data.command as RobotCommand;
        } else {
          setLastActionStatus(`Failed: ${data?.message || 'Error'}`);
        }
      } catch (err: unknown) {
        setLastActionStatus('Network error sending command');
      }
      return null;
    },
    [robotId, speed, servoAngle, fetchData, config.controlMode, config.localIpAddress, config.localPort, status?.ipAddress, status?.localPort]
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

    // In LOCAL mode, dispatch stop directly to the robot immediately via local relay (zero cloud/demo queuing)
    if (config.controlMode === 'LOCAL') {
      const targetIp = config.localIpAddress || status?.ipAddress || '192.168.31.137';
      setLastActionStatus('EMERGENCY STOP TRIGGERED (LOCAL)');
      try {
        const res = await fetch('/api/robot/local-dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: targetIp,
            command: 'STOP',
            query: 'var=car&val=0',
            robotId,
            source: 'EMERGENCY_WATCHDOG',
          }),
        });
        const isOk = res.ok;
        setLastActionStatus(isOk ? 'EMERGENCY STOP (LOCAL): Sent var=car&val=0 (HTTP 200)' : 'Emergency Stop Relay Failed');
        return isOk;
      } catch (err) {
        console.warn('Local emergency stop relay send error:', err);
        setLastActionStatus('Emergency Stop Failed (Local Relay)');
        return false;
      }
    }

    setLastActionStatus('EMERGENCY STOP TRIGGERED');
    try {
      const res = await fetch('/api/robot/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ robotId, source: 'EMERGENCY_WATCHDOG' }),
      });
      fetchData();
      return res.ok;
    } catch {
      return false;
    }
  }, [robotId, fetchData, config.controlMode, config.localIpAddress, status?.ipAddress]);

  // Movement control: Press handler (Continuous hold-to-run refresh or single step)
  const handleMovementPress = useCallback(
    (command: RobotCommandType) => {
      // Clear any pending scheduled stops or previous repeat intervals
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

      // In Hold-to-Run mode, maintain continuous movement by refreshing every 200ms while held
      // (prevents hardware watchdog cuts and matches continuous driving on hardware)
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
        }, 200);
      }
    },
    [holdToRun, sendCommand]
  );

  // Movement control: Release handler (Stops repeat loop and dispatches STOP safely)
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

        // Ensure motors receive a minimum continuous pulse of at least 250ms on brief taps
        // to overcome mechanical inertia and backlash before STOP is dispatched.
        const minPulseMs = 250;
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

  // Auto-synchronize speed to robot whenever LOCAL mode is activated or speed changes
  useEffect(() => {
    if (config.controlMode === 'LOCAL' && lastSyncedLocalSpeedRef.current !== speed) {
      lastSyncedLocalSpeedRef.current = speed;
      sendCommand('SET_SPEED', { speedOverride: speed });
    }
  }, [config.controlMode, speed, sendCommand]);

  // Clean up repeat interval and scheduled stop on unmount
  useEffect(() => {
    return () => {
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
        repeatIntervalRef.current = null;
      }
      if (scheduledStopTimeoutRef.current) {
        clearTimeout(scheduledStopTimeoutRef.current);
        scheduledStopTimeoutRef.current = null;
      }
    };
  }, []);

  // Change speed
  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      sendCommand('SET_SPEED', { speedOverride: newSpeed });
    },
    [sendCommand]
  );

  // Change servo angle
  const handleServoChange = useCallback(
    (newAngle: number) => {
      setServoAngle(newAngle);
      sendCommand('SET_SERVO', { servoOverride: newAngle });
    },
    [sendCommand]
  );

  // Trigger camera capture
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

  // Update mode configuration (LIVE vs DEMO, CLOUD vs LOCAL)
  const updateModeConfig = useCallback(
    async (newConfig: Partial<SystemModeConfig>) => {
      try {
        const res = await fetch('/api/system/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig),
        });
        const data = await parseJsonSafely(res);
        if (res.ok && data) {
          setConfig(data.config);
          fetchData();
        }
      } catch (err) {
        console.warn('Failed to update system mode:', err);
      }
    },
    [fetchData]
  );

  // Trigger manual simulation cycle for testing in DEMO mode
  const simulateCycle = useCallback(async () => {
    try {
      const res = await fetch('/api/demo/simulate-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ robotId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.warn('Failed to trigger demo cycle:', err);
    }
  }, [robotId, fetchData]);

  return {
    robotId,
    status,
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
    updateModeConfig,
    simulateCycle,
    refreshData: fetchData,
  };
}
