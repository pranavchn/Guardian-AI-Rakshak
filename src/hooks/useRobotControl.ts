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
    localIpAddress: '192.168.4.1',
    localPort: 80,
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

  // Fetch telemetry and queue data
  const fetchData = useCallback(async () => {
    try {
      const encodedId = encodeURIComponent(robotId);
      const [statusRes, pendingRes, historyRes, imagesRes, logsRes] = await Promise.all([
        fetch(`/api/robot/status?robotId=${encodedId}`),
        fetch(`/api/robot/commands?robotId=${encodedId}`),
        fetch(`/api/robot/commands/history?robotId=${encodedId}&limit=25`),
        fetch(`/api/robot/camera/images?robotId=${encodedId}`),
        fetch('/api/system/logs?limit=30'),
      ]);

      const statusData = await parseJsonSafely(statusRes);
      if (statusData) {
        if (statusData.status) setStatus(statusData.status);
        if (statusData.config) setConfig(statusData.config);
        if (statusData.firestore) setFirestoreInfo(statusData.firestore);
      }

      const pendingData = await parseJsonSafely(pendingRes);
      if (pendingData) {
        setPendingCommands(pendingData.pending || []);
      }

      const historyData = await parseJsonSafely(historyRes);
      if (historyData) {
        setCommandHistory(historyData.history || []);
      }

      const imagesData = await parseJsonSafely(imagesRes);
      if (imagesData) {
        setImages(imagesData.images || []);
      }

      const logsData = await parseJsonSafely(logsRes);
      if (logsData) {
        setLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('Failed to poll robot status:', err);
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
      setLastActionStatus(`Sending ${command}...`);
      try {
        const res = await fetch('/api/robot/commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            robotId,
            command,
            speed: options.speedOverride ?? speed,
            servo: options.servoOverride ?? servoAngle,
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
    [robotId, speed, servoAngle, fetchData]
  );

  // Immediate Emergency Stop
  const sendEmergencyStop = useCallback(async () => {
    setActivePressedCommand(null);
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
  }, [robotId, fetchData]);

  // Movement control: Press handler (Hold-to-run or single step)
  const handleMovementPress = useCallback(
    (command: RobotCommandType) => {
      setActivePressedCommand(command);
      sendCommand(command);
    },
    [sendCommand]
  );

  // Movement control: Release handler (Only if holdToRun is active)
  const handleMovementRelease = useCallback(
    (command: RobotCommandType) => {
      if (holdToRun && activePressedCommand === command) {
        setActivePressedCommand(null);
        // SAFETY: Send STOP command immediately upon release
        sendCommand('STOP');
      } else {
        setActivePressedCommand(null);
      }
    },
    [holdToRun, activePressedCommand, sendCommand]
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
      console.error(err);
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
        console.error('Failed to update system mode:', err);
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
      console.error('Failed to trigger demo cycle:', err);
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
