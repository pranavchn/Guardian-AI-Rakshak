/**
 * Smart Rakshak — Robot Control & Telemetry Types
 * Physical AI Robot Platform
 */

export type RobotCommandType =
  | 'FORWARD'
  | 'BACKWARD'
  | 'LEFT'
  | 'RIGHT'
  | 'LEFT_UP'
  | 'RIGHT_UP'
  | 'LEFT_DOWN'
  | 'RIGHT_DOWN'
  | 'ROTATE_LEFT'
  | 'ROTATE_RIGHT'
  | 'STOP'
  | 'EMERGENCY_STOP'
  | 'RESET_EMERGENCY_STOP'
  | 'SET_SPEED'
  | 'SET_SERVO'
  | 'CAPTURE_IMAGE'
  | 'BUZZER_1'
  | 'BUZZER_2'
  | 'BUZZER_3'
  | 'BUZZER_4'
  | 'CAMERA_LED_ON'
  | 'CAMERA_LED_OFF'
  | 'MODE_TRACKING'
  | 'MODE_AVOIDANCE'
  | 'MODE_FOLLOW'
  | 'MODE_STANDBY';

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

export type HelperCategory =
  | 'ACCESSIBILITY'
  | 'NAVIGATION'
  | 'SMART_HOME'
  | 'CAREGIVER_ALERT'
  | 'GENERAL_HELP'
  | 'VISUAL_INSPECTION';

export interface HelperAssistanceEvent {
  eventId: string;
  timestamp: string;
  category: HelperCategory;
  summary: string;
  details?: string;
  status: 'COMPLETED' | 'PREPARED_FOR_REVIEW' | 'SAVED' | 'SIMULATED_ACTION' | 'ADVISORY';
  caregiverNotified: boolean;
  persistedToFirestore?: boolean;
}

export interface HelperAssistantResponse {
  success: boolean;
  response: string;
  category: HelperCategory;
  recommendedAction: string;
  stepByStepGuidance?: string[];
  caregiverAssistanceAppropriate: boolean;
  caregiverReason?: string;
  suggestedRobotCommand?: RobotCommandType | null;
  suggestedSmartHomeAction?: {
    device: string;
    action: 'TURN_ON' | 'TURN_OFF' | 'TOGGLE' | 'SET_LEVEL';
    targetState?: boolean;
  } | null;
  sourceEngine: 'GEMINI_3_8_FLASH' | 'GEMINI_2_5_FLASH' | 'HEURISTIC_SAFETY_ASSISTANT';
}

export interface HelperVisionAnalysisResponse {
  success: boolean;
  sceneDescription: string;
  visibleObjects: string[];
  potentialObstacles: string[];
  recommendedAction: string;
  limitations: string;
  sourceEngine: 'GEMINI_3_8_FLASH' | 'GEMINI_2_5_FLASH' | 'HEURISTIC_VISION_ASSISTANT';
}

export interface CaregiverDraftResponse {
  success: boolean;
  urgency: 'ROUTINE' | 'ADVISORY' | 'URGENT';
  message: string;
  suggestedAction: string;
  timestamp: string;
}

// ==========================================
// GUARDIAN MODE TYPES (Child Safety & Companion)
// ==========================================

export type GuardianCategory =
  | 'EDUCATION'
  | 'SAFETY_GUIDANCE'
  | 'OBSTACLE_AVOIDANCE'
  | 'EMOTIONAL_SUPPORT'
  | 'ASSISTANCE_REQUEST'
  | 'VISUAL_INSPECTION'
  | 'GENERAL_COMPANION';

export interface GuardianCompanionResponse {
  success: boolean;
  response: string;
  category: GuardianCategory;
  recommendedNextStep: string;
  encourageAdultContact: boolean;
  adultContactReason?: string;
  suggestedAction?: string;
  sourceEngine: 'GEMINI_3_8_FLASH' | 'HEURISTIC_SAFETY_COMPANION';
}

export interface GuardianSafetyGuidanceResponse {
  success: boolean;
  situation: string;
  guidanceSteps: string[];
  reassurance: string;
  mustContactAdultImmediately: boolean;
  cautionAdvice: string;
  sourceEngine: 'GEMINI_3_8_FLASH' | 'HEURISTIC_SAFETY_COMPANION';
}

export interface GuardianVisionAnalysisResponse {
  success: boolean;
  sceneDescription: string;
  visibleObservations: string[];
  potentialConcerns: string[];
  recommendedNextSteps: string;
  analysisLimitations: string;
  sourceEngine: 'GEMINI_3_8_FLASH' | 'HEURISTIC_VISION_ASSISTANT';
}

export interface GuardianAssistanceRequest {
  requestId: string;
  timestamp: string;
  category: string;
  childRequest: string;
  preparedAlertMessage: string;
  recommendedAction: string;
  status: 'MESSAGE_PREPARED' | 'SAVED_TO_AUDIT' | 'COPIED_TO_CLIPBOARD';
  urgency: 'NORMAL' | 'ELEVATED' | 'IMMEDIATE';
}

export interface GuardianSafetyEvent {
  eventId: string;
  timestamp: string;
  category: GuardianCategory;
  summary: string;
  details?: string;
  recommendedAction: string;
  status: 'COMPLETED' | 'PREPARED_FOR_ADULT' | 'SAVED' | 'SIMULATED_DEMO';
  adultNotified: boolean;
  persistedToFirestore?: boolean;
}

// ==========================================
// PROTECTION MODE TYPES (Home Safety & Hazard Awareness)
// ==========================================

export type ProtectionAssessmentCategory =
  | 'Low Concern'
  | 'Caution'
  | 'Potential Hazard'
  | 'Inconclusive';

export interface ProtectionHazardObservation {
  id: string;
  description: string;
  approximateLocation?: string;
  reasonForAttention: string;
  recommendedNextStep: string;
  uncertaintyOrLimitations?: string;
  conditionType: 'OBSERVED_CONDITION' | 'POSSIBLE_RISK';
}

export interface ProtectionAnalysisResponse {
  success: boolean;
  assessmentCategory: ProtectionAssessmentCategory;
  categoryRationale: string;
  overallSummary: string;
  visibleConditions: string[];
  identifiedHazards: ProtectionHazardObservation[];
  recommendedActions: string[];
  timestamp: string;
  analysisLimitations: string;
  isInconclusive: boolean;
  sourceEngine: 'GEMINI_3_8_FLASH' | 'HEURISTIC_SAFETY_ANALYZER';
}

export interface ProtectionFollowUpResponse {
  success: boolean;
  answer: string;
  safetyAdvice?: string;
  sourceEngine: 'GEMINI_3_8_FLASH' | 'HEURISTIC_SAFETY_ANALYZER';
}

export interface ProtectionSafetyEvent {
  eventId: string;
  timestamp: string;
  source: 'UPLOADED_ROBOT_CAMERA_IMAGE' | 'STORED_CAMERA_CAPTURE';
  shortSummary: string;
  assessmentCategory: ProtectionAssessmentCategory;
  identifiedObservations: string[];
  recommendedActions: string[];
  status: 'COMPLETED' | 'INCONCLUSIVE' | 'FAILED';
  imageUrl?: string;
  persistedToFirestore?: boolean;
}

