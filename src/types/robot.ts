/**
 * Smart Rakshak — Robot Control & Telemetry Types
 * ACEBOTT QD001 Robot Platform
 */

export type RobotCommandType =
  | 'FORWARD'
  | 'BACKWARD'
  | 'LEFT'
  | 'RIGHT'
  | 'STOP'
  | 'EMERGENCY_STOP'
  | 'RESET_EMERGENCY_STOP'
  | 'SET_SPEED'
  | 'SET_SERVO'
  | 'CAPTURE_IMAGE';

export type CommandStatus =
  | 'PENDING'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export type CommandSource =
  | 'WEB_UI'
  | 'KEYBOARD'
  | 'AI_NATURAL_LANGUAGE'
  | 'EMERGENCY_WATCHDOG'
  | 'SIMULATOR';

export interface RobotCommand {
  commandId: string;
  robotId: string;
  command: RobotCommandType;
  speed?: number; // 1 to 5 (default 3)
  servo?: number; // 0 to 180 degrees (default 90)
  status: CommandStatus;
  createdAt: string;
  expiresAt: string;
  source: CommandSource;
  executedAt?: string;
  completedAt?: string;
  ackDetails?: {
    executionStatus: 'COMPLETED' | 'FAILED';
    executionTimestamp: string;
    details?: string;
  };
}

export interface RobotStatus {
  robotId: string;
  name: string;
  online: boolean;
  lastSeen: string;
  firmwareVersion: string;
  wifiStatus: 'CONNECTED' | 'DISCONNECTED' | 'WEAK' | 'OFFLINE';
  cloudStatus: 'CONNECTED' | 'DISCONNECTED' | 'POLLING';
  currentCommand: RobotCommandType | null;
  batteryLevel: number; // percentage 0-100
  cameraAvailable: boolean;
  rssi?: number; // dBm
  freeHeap?: number; // bytes
  ipAddress?: string;
  localPort?: number;
  speed: number;
  servoAngle: number;
  totalCommandsExecuted: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceHeartbeatPayload {
  robotId: string;
  firmwareVersion?: string;
  wifiStatus?: 'CONNECTED' | 'DISCONNECTED' | 'WEAK' | 'OFFLINE';
  batteryLevel?: number;
  cameraAvailable?: boolean;
  freeHeap?: number;
  rssi?: number;
  ipAddress?: string;
  localPort?: number;
}

export interface DeviceAckPayload {
  robotId: string;
  commandId: string;
  command: RobotCommandType;
  executionStatus: 'COMPLETED' | 'FAILED';
  executionTimestamp: string;
  details?: string;
}

export interface CameraImageRecord {
  imageId: string;
  robotId: string;
  storagePath: string;
  url: string;
  createdAt: string;
  captureSource: 'ESP32_CAM_AUTO' | 'ESP32_CAM_MANUAL' | 'SIMULATOR';
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  aiAnalysis?: {
    summary: string;
    detectedObstacles: string[];
    isSafeToAdvance: boolean;
    analyzedAt: string;
  };
}

export interface SystemAuditLog {
  logId: string;
  timestamp: string;
  category: 'AUTH' | 'COMMAND' | 'HEARTBEAT' | 'CAMERA' | 'SAFETY' | 'AI' | 'SYSTEM';
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: Record<string, unknown>;
}

export interface SystemModeConfig {
  mode: 'LIVE' | 'DEMO';
  controlMode: 'CLOUD' | 'LOCAL';
  localIpAddress: string;
  localPort: number;
  autoSimulatePolling: boolean;
}

export interface FirestoreConnectionInfo {
  connected: boolean;
  projectId: string;
  databaseId: string;
  region: string;
  collections: string[];
}
