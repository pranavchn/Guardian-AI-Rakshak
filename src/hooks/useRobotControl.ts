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

export function useRobotControl(robotId: string = 'QD001') {
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [firestoreInfo, setFirestoreInfo] = useState<FirestoreConnectionInfo>({
    connected: false,
    projectId: 'qd00n-ai-robot',
    databaseId: 'qd00n-ai-robot-db',
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

      if (pendingData?.pending) {
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
 * Maps Smart Rakshak commands to the native ACEBOTT QD001 ESP32 WebServer (Port 81) query parameters.
 * Baseline endpoint on Port 81: /control?var=car&val=<0..4>
 */
function getLocalCommandQuery(
  command: RobotCommandType,
  effectiveSpeed: number,
  effectiveServo: number
): { path: string; query: string } | null {
  switch (command) {
    case 'FORWARD':
      return { path: '/control', query: 'var=car&val=1' };
    case 'BACKWARD':
      return { path: '/control', query: 'var=car&val=2' };
    case 'LEFT':
      return { path: '/control', query: 'var=car&val=3' };
    case 'RIGHT':
      return { path: '/control', query: 'var=car&val=4' };
    case 'STOP':
    case 'EMERGENCY_STOP':
    case 'RESET_EMERGENCY_STOP':
      return { path: '/control', query: 'var=car&val=0' };
    case 'SET_SPEED':
      return { path: '/control', query: `var=speed&val=${encodeURIComponent(effectiveSpeed)}` };
    case 'SET_SERVO':
      return { path: '/control', query: `var=servo&val=${encodeURIComponent(effectiveServo)}` };
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
      // LOCAL MODE: Send directly to the robot's local WebServer
      // (DEMO and LIVE + CLOUD modes remain completely untouched below)
      // ==============================================================
      if (config.controlMode === 'LOCAL') {
        const targetIp = config.localIpAddress || status?.ipAddress || '192.168.31.137';
        const targetPort = config.localPort || status?.localPort || 81;
        const mapping = getLocalCommandQuery(command, effectiveSpeed, effectiveServo);

        if (!mapping) {
          setLastActionStatus(`Unsupported local command: ${command}`);
          return null;
        }

        const targetUrl = `http://${targetIp}:${targetPort}${mapping.path}${mapping.query ? '?' + mapping.query : ''}`;
        setLastActionStatus(`Local -> ${command} (${targetIp}:${targetPort})`);

        const isHttpsContext = typeof window !== 'undefined' && window.location.protocol === 'https:';

        // When hosted over HTTPS (e.g. Cloud Run / AI Studio preview), the browser strictly blocks
        // insecure HTTP requests to local private IPs (Mixed Content & Private Network Access).
        // Avoid attempting fetch() which triggers an immediate TypeError: Failed to fetch.
        if (isHttpsContext) {
          const failureMsg = `Browser Mixed Content restriction: This HTTPS dashboard cannot directly call local HTTP (${targetUrl}). Run dashboard locally on http://localhost:3000 to use LOCAL mode, or switch to CLOUD mode.`;
          setLastActionStatus('Blocked: Mixed Content (Use http://localhost:3000)');
          console.warn(`[LOCAL Mode Notice] ${failureMsg}`);

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
              details: failureMsg,
            },
          };

          setCommandHistory((prev) => [localCmd, ...prev.slice(0, 24)]);
          return null;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          const res = await fetch(targetUrl, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const successStatus = res.ok ? 'COMPLETED' : 'FAILED';
          const statusText = res.ok ? `Local OK: ${command}` : `Local HTTP ${res.status}: ${command}`;
          setLastActionStatus(statusText);

          const localCmd: RobotCommand = {
            commandId: `local-${Date.now()}`,
            robotId,
            command,
            speed: effectiveSpeed,
            servo: effectiveServo,
            status: successStatus,
            source: options.source || 'WEB_UI',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10000).toISOString(),
            executedAt: new Date().toISOString(),
            ackDetails: {
              executionStatus: successStatus,
              executionTimestamp: new Date().toISOString(),
              details: `Dispatched directly to ${targetUrl} (HTTP ${res.status})`,
            },
          };

          setCommandHistory((prev) => [localCmd, ...prev.slice(0, 24)]);
          return localCmd;
        } catch (err: unknown) {
          const isTimeout = err instanceof DOMException && err.name === 'AbortError';

          if (isTimeout) {
            const timeoutMsg = `Timeout reaching robot at ${targetIp}:${targetPort}`;
            setLastActionStatus(timeoutMsg);
            console.warn(`[LOCAL Mode Warning] Timeout reaching ${targetUrl}:`, err);

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
                details: timeoutMsg,
              },
            };

            setCommandHistory((prev) => [localCmd, ...prev.slice(0, 24)]);
            return null;
          }

          // When fetch throws (e.g. CORS response-masking, connection refused, or unreachable IP),
          // the browser suppresses the network response. We MUST NOT treat this failure as proof
          // that the command was received or executed by the hardware.
          const statusText = `Local Dispatched (Unconfirmed): ${command}`;
          setLastActionStatus(statusText);
          console.warn(`[LOCAL Mode Network Notice] Dispatch attempted to ${targetUrl} (delivery unconfirmed):`, err);

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
              details: `Dispatch attempted to ${targetUrl}; response not received or blocked by browser CORS policy (${err instanceof Error ? err.message : 'Failed to fetch'})`,
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
    activePressedRef.current = null;
    setActivePressedCommand(null);
    setLastActionStatus('EMERGENCY STOP TRIGGERED');

    // In LOCAL mode, dispatch stop directly to the robot immediately (only in HTTP context)
    if (config.controlMode === 'LOCAL') {
      const isHttpsContext = typeof window !== 'undefined' && window.location.protocol === 'https:';
      if (!isHttpsContext) {
        const targetIp = config.localIpAddress || status?.ipAddress || '192.168.31.137';
        const targetPort = config.localPort || status?.localPort || 81;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);
          await fetch(`http://${targetIp}:${targetPort}/control?var=car&val=0`, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (err) {
          console.warn('Local emergency stop direct send error:', err);
        }
      }
    }

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
  }, [robotId, fetchData, config.controlMode, config.localIpAddress, config.localPort, status?.ipAddress, status?.localPort]);

  // Movement control: Press handler (Hold-to-run or single step)
  const handleMovementPress = useCallback(
    (command: RobotCommandType) => {
      activePressedRef.current = command;
      setActivePressedCommand(command);
      sendCommand(command);
    },
    [sendCommand]
  );

  // Movement control: Release handler (Only if holdToRun is active)
  const handleMovementRelease = useCallback(
    (_command?: RobotCommandType) => {
      if (holdToRun && activePressedRef.current !== null) {
        activePressedRef.current = null;
        setActivePressedCommand(null);
        // SAFETY: Send STOP command immediately upon release
        sendCommand('STOP');
      } else {
        activePressedRef.current = null;
        setActivePressedCommand(null);
      }
    },
    [holdToRun, sendCommand]
  );

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
