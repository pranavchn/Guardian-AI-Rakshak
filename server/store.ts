/**
 * Smart Rakshak — Firestore & In-Memory Data Store Engine
 *
 * Implements real Google Cloud Firestore persistence for CLOUD mode using
 * server-side Application Default Credentials (ADC) without requiring
 * or exposing service-account JSON keys.
 *
 * Firestore Database Target:
 * - GCP Project ID: smart-rakshak-robot
 * - Firestore Database ID: (default)
 * - Region: asia-south1
 *
 * Collections:
 * - robots/{robotId}
 * - robotCommands/{commandId}
 * - robotCommandHistory/{commandId}
 * - robotHeartbeats/{heartbeatId}
 * - cameraImages/{imageId}
 * - systemLogs/{logId}
 *
 * In DEMO mode, operations remain in-memory for instant testing.
 */

import { Firestore } from '@google-cloud/firestore';
import type {
  CameraImageRecord,
  CommandStatus,
  DeviceAckPayload,
  DeviceHeartbeatPayload,
  RobotCommand,
  RobotCommandType,
  RobotStatus,
  SystemAuditLog,
  SystemModeConfig,
  HelperAssistanceEvent,
  GuardianSafetyEvent,
  ProtectionSafetyEvent,
} from '../src/types/robot.ts';

export class RobotDataStore {
  private firestore: Firestore | null = null;
  private isFirestoreConnected: boolean = false;
  private firestoreProjectId: string;
  private firestoreDatabaseId: string;
  private modeEpoch: number = 0;

  // In-memory state (always active for DEMO mode and local cache/fallback)
  private robot: RobotStatus;
  private pendingCommands: Map<string, RobotCommand> = new Map();
  private commandHistory: RobotCommand[] = [];
  private heartbeats: DeviceHeartbeatPayload[] = [];
  private images: CameraImageRecord[] = [];
  private auditLogs: SystemAuditLog[] = [];
  private helperEvents: HelperAssistanceEvent[] = [];
  private guardianEvents: GuardianSafetyEvent[] = [];
  private protectionEvents: ProtectionSafetyEvent[] = [];

  private config: SystemModeConfig = {
    mode: 'DEMO', // DEMO mode uses in-memory; CLOUD mode persists to Firestore
    controlMode: 'CLOUD',
    localIpAddress: '192.168.31.137',
    localPort: 81,
    autoSimulatePolling: false,
  };

  private heartbeatTimeoutMs: number;
  private commandExpirationMs: number;
  private defaultRobotId: string;
  private deviceAuthToken: string;

  constructor() {
    this.defaultRobotId = process.env.DEFAULT_ROBOT_ID || 'SR-01';
    this.deviceAuthToken = process.env.DEVICE_AUTH_TOKEN ? process.env.DEVICE_AUTH_TOKEN.trim() : '';
    this.heartbeatTimeoutMs = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '15000', 10);
    this.commandExpirationMs = parseInt(process.env.COMMAND_EXPIRATION_MS || '10000', 10);

    this.firestoreProjectId = process.env.GCP_PROJECT_ID || process.env.FIRESTORE_PROJECT_ID || 'smart-rakshak-robot';
    this.firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';

    const now = new Date().toISOString();
    this.robot = {
      robotId: this.defaultRobotId,
      name: 'Guardian AI — Physical AI Robot',
      online: false,
      lastSeen: new Date(Date.now() - 30000).toISOString(),
      firmwareVersion: 'v2.4.1-cloud-rakshak',
      wifiStatus: 'OFFLINE',
      cloudStatus: 'DISCONNECTED',
      currentCommand: null,
      batteryLevel: 84,
      cameraAvailable: true,
      rssi: -58,
      freeHeap: 184520,
      ipAddress: '192.168.1.145',
      localPort: 80,
      speed: 3,
      servoAngle: 90,
      totalCommandsExecuted: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.seedSampleImages();
    this.initializeFirestore();
  }

  /**
   * Initializes Google Cloud Firestore using server-side Application Default Credentials (ADC)
   */
  private initializeFirestore(): void {
    // DEMO mode: absolutely no Firestore initialization or network activity
    if (!this.isFirestoreActive()) {
      this.firestore = null;
      this.isFirestoreConnected = false;
      return;
    }

    try {
      this.firestore = new Firestore({
        projectId: this.firestoreProjectId,
        databaseId: this.firestoreDatabaseId,
      });

      this.logAudit(
        'SYSTEM',
        'INFO',
        'Initializing Firestore client with ADC credentials',
        {
          projectId: this.firestoreProjectId,
          databaseId: this.firestoreDatabaseId,
        }
      );

      const currentEpoch = this.modeEpoch;

      // Probe Firestore only in LIVE + CLOUD
      this.firestore
        .collection('robots')
        .doc(this.defaultRobotId)
        .get()
        .then((doc) => {
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return;
          }
          this.isFirestoreConnected = true;

          this.logAudit(
            'SYSTEM',
            'INFO',
            `Connected to Firestore database: ${this.firestoreDatabaseId}`,
            {
              exists: doc.exists,
            }
          );

          if (doc.exists) {
            const data = doc.data() as Partial<RobotStatus>;
            this.robot = {
              ...this.robot,
              ...data,
            };
          } else {
            if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
              return;
            }
            this.syncRobotToFirestore().catch((syncErr: unknown) => {
              if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
                return;
              }
              this.isFirestoreConnected = false;
              const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
              console.error('[Firestore Initial Probe Sync Error]', syncMsg);
            });
          }
        })
        .catch((err) => {
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return;
          }
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[Firestore Probe Connection Failed]', errMsg);
          this.isFirestoreConnected = false;
        });

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.firestore = null;
      this.isFirestoreConnected = false;

      console.warn('[Firestore] Client init notice:', errorMsg);
      this.logAudit('SAFETY', 'ERROR', 'Firestore client initialization failed', { error: errorMsg });
    }
  }

  /**
   * Lazily obtains or initializes the Firestore client.
   * Throws immediately if system is not in LIVE + CLOUD or if client cannot be created.
   */
  private getFirestoreClient(): Firestore {
    if (!this.isFirestoreActive()) {
      throw new Error('Firestore is disabled because system is not in LIVE + CLOUD mode.');
    }
    if (!this.firestore) {
      this.initializeFirestore();
    }
    if (!this.firestore) {
      this.isFirestoreConnected = false;
      throw new Error('Firestore client is unavailable or failed to initialize.');
    }
    return this.firestore;
  }

  /**
   * DEMO mode isolation rule:
   * When mode === 'DEMO', the application must use in-memory data only and must NOT
   * read from or write to Firestore, even if controlMode === 'CLOUD'.
   * Firestore should be used only when: mode === 'LIVE' && controlMode === 'CLOUD'.
   */
  public isFirestoreActive(): boolean {
    return this.config.mode === 'LIVE' && this.config.controlMode === 'CLOUD';
  }

  public isCloudModeActive(): boolean {
    return this.isFirestoreActive();
  }

  public getFirestoreDetails() {
    return {
      connected: this.isFirestoreConnected && this.isFirestoreActive(),
      active: this.isFirestoreActive(),
      projectId: this.firestoreProjectId,
      databaseId: this.firestoreDatabaseId,
      region: process.env.GCP_REGION || 'asia-south1',
      collections: [
        'robots',
        'robotCommands',
        'robotCommandHistory',
        'robotHeartbeats',
        'cameraImages',
        'systemLogs',
        'helperEvents',
        'guardianEvents',
        'protectionEvents',
      ],
    };
  }

  public getDeviceToken(): string {
    return process.env.DEVICE_AUTH_TOKEN ? process.env.DEVICE_AUTH_TOKEN.trim() : '';
  }

  public getDefaultRobotId(): string {
    return this.defaultRobotId;
  }

  public getConfig(): SystemModeConfig {
    return { ...this.config };
  }

  public setConfig(update: Partial<SystemModeConfig>): SystemModeConfig {
    const prevActive = this.isFirestoreActive();
    const newMode = update.mode ?? this.config.mode;
    const newControlMode = update.controlMode ?? this.config.controlMode;
    const willBeActive = newMode === 'LIVE' && newControlMode === 'CLOUD';

    // 1. If switching from LIVE + CLOUD to DEMO or LOCAL:
    // Disable Firestore immediately BEFORE updating config and BEFORE creating the mode-change audit entry!
    if (prevActive && !willBeActive) {
      this.modeEpoch++;
      this.firestore = null;
      this.isFirestoreConnected = false;
    }

    this.config = { ...this.config, ...update };
    this.logAudit('SYSTEM', 'INFO', `System mode set to ${this.config.mode} / ${this.config.controlMode}`);

    if (this.isFirestoreActive()) {
      if (!this.firestore) {
        this.initializeFirestore();
      } else if (!prevActive) {
        const epoch = this.modeEpoch;
        this.syncRobotToFirestore().catch((syncErr: unknown) => {
          if (!this.isFirestoreActive() || this.modeEpoch !== epoch) return;
          this.isFirestoreConnected = false;
          const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
          console.error('[Firestore Mode Switch Sync Error]', syncMsg);
        });
      }
    } else {
      this.modeEpoch++;
      this.firestore = null;
      this.isFirestoreConnected = false;
    }
    return this.config;
  }

  /**
   * Retrieves robot telemetry status.
   * In LIVE + CLOUD mode, reads directly from Firestore collection 'robots'.
   * In DEMO or LOCAL mode, uses in-memory state.
   */
  public async getRobotStatus(robotId: string = this.defaultRobotId): Promise<RobotStatus> {
    this.checkTimeouts();

    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during getRobotStatus', { error: msg });
        throw new Error(`Firestore is unavailable. Cannot read robot status: ${msg}`);
      }

      try {
        const docRef = db.collection('robots').doc(robotId);
        const snapshot = await docRef.get();

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { ...this.robot };
        }

        this.isFirestoreConnected = true;

        if (snapshot.exists) {
          const cloudData = snapshot.data() as Partial<RobotStatus>;
          this.robot = {
            ...this.robot,
            ...cloudData,
            robotId,
          };
          this.checkTimeouts();
          return { ...this.robot };
        } else {
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return { ...this.robot };
          }
          // Sync robot if document doesn't exist yet
          await docRef.set(this.robot, { merge: true });
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return { ...this.robot };
          }
          this.isFirestoreConnected = true;
          return { ...this.robot };
        }
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { ...this.robot };
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore read error';
        this.logAudit('SAFETY', 'ERROR', 'Firestore getRobotStatus read failure', {
          robotId,
          error: msg,
        });
        throw new Error(`Firestore read failed in LIVE + CLOUD mode: ${msg}`);
      }
    }

    return { ...this.robot };
  }

  /**
   * Processes device heartbeat.
   * In LIVE + CLOUD mode, persists to 'robotHeartbeats' and 'robots/{robotId}' in Firestore.
   */
  public async processHeartbeat(payload: DeviceHeartbeatPayload): Promise<RobotStatus> {
    const now = new Date().toISOString();

    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during heartbeat', { error: msg });
        throw new Error(`Firestore is unavailable. Cannot persist heartbeat in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        const heartbeatId = `hb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const updatedDoc: Partial<RobotStatus> = {
          lastSeen: now,
          online: true,
          cloudStatus: 'CONNECTED',
          updatedAt: now,
          ...(payload.firmwareVersion && { firmwareVersion: payload.firmwareVersion }),
          ...(payload.wifiStatus && { wifiStatus: payload.wifiStatus }),
          ...(payload.batteryLevel !== undefined && { batteryLevel: payload.batteryLevel }),
          ...(payload.cameraAvailable !== undefined && { cameraAvailable: payload.cameraAvailable }),
          ...(payload.freeHeap !== undefined && { freeHeap: payload.freeHeap }),
          ...(payload.rssi !== undefined && { rssi: payload.rssi }),
          ...(payload.ipAddress && { ipAddress: payload.ipAddress }),
          ...(payload.localPort && { localPort: payload.localPort }),
        };

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { ...this.robot };
        }

        await Promise.all([
          db.collection('robots').doc(payload.robotId).set(updatedDoc, { merge: true }),
          db.collection('robotHeartbeats').doc(heartbeatId).set({
            heartbeatId,
            ...payload,
            timestamp: now,
          }),
        ]);

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { ...this.robot };
        }

        this.isFirestoreConnected = true;
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { ...this.robot };
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore heartbeat failure';
        this.logAudit('SAFETY', 'ERROR', 'Firestore heartbeat write failure', {
          robotId: payload.robotId,
          error: msg,
        });
        throw new Error(`Firestore heartbeat write failed: ${msg}`);
      }
    }

    // Update in-memory state
    this.robot.lastSeen = now;
    this.robot.online = true;
    this.robot.cloudStatus = 'CONNECTED';
    this.robot.updatedAt = now;

    if (payload.firmwareVersion) this.robot.firmwareVersion = payload.firmwareVersion;
    if (payload.wifiStatus) this.robot.wifiStatus = payload.wifiStatus;
    if (payload.batteryLevel !== undefined) this.robot.batteryLevel = payload.batteryLevel;
    if (payload.cameraAvailable !== undefined) this.robot.cameraAvailable = payload.cameraAvailable;
    if (payload.freeHeap !== undefined) this.robot.freeHeap = payload.freeHeap;
    if (payload.rssi !== undefined) this.robot.rssi = payload.rssi;
    if (payload.ipAddress) this.robot.ipAddress = payload.ipAddress;
    if (payload.localPort) this.robot.localPort = payload.localPort;

    this.heartbeats.unshift(payload);
    if (this.heartbeats.length > 50) this.heartbeats.pop();

    this.logAudit('HEARTBEAT', 'INFO', `Heartbeat from ${payload.robotId}`, {
      battery: payload.batteryLevel,
      rssi: payload.rssi,
      ip: payload.ipAddress,
    });

    return { ...this.robot };
  }

  /**
   * Enqueues a validated robot command.
   * In LIVE + CLOUD mode, writes to 'robotCommands' collection in Firestore.
   * If Firestore write fails, the command is NOT reported as queued and an error is thrown.
   */
  public async enqueueCommand(
    commandType: RobotCommandType,
    params: {
      robotId?: string;
      speed?: number;
      servo?: number;
      source?: RobotCommand['source'];
    } = {}
  ): Promise<RobotCommand> {
    const robotId = params.robotId || this.defaultRobotId;
    const now = new Date();
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(now.getTime() + this.commandExpirationMs).toISOString();

    const command: RobotCommand = {
      commandId,
      robotId,
      command: commandType,
      speed: params.speed ?? this.robot.speed,
      servo: params.servo ?? this.robot.servoAngle,
      status: 'PENDING',
      createdAt: now.toISOString(),
      expiresAt,
      source: params.source || 'WEB_UI',
    };

    // If LIVE + CLOUD mode, persist to Firestore first
    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', `Firestore unavailable for command ${commandId}`, {
          command: commandType,
          error: msg,
        });
        throw new Error(`Firestore is unavailable. Cannot queue command in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        if (commandType === 'STOP' || commandType === 'EMERGENCY_STOP') {
          const pendingSnap = await db
            .collection('robotCommands')
            .where('robotId', '==', robotId)
            .where('status', '==', 'PENDING')
            .get();

          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            throw new Error('System mode switched away from LIVE + CLOUD');
          }

          const batch = db.batch();
          for (const doc of pendingSnap.docs) {
            const cmdData = doc.data() as RobotCommand;
            if (
              cmdData.command === 'FORWARD' ||
              cmdData.command === 'BACKWARD' ||
              cmdData.command === 'LEFT' ||
              cmdData.command === 'RIGHT'
            ) {
              batch.delete(doc.ref);
              const historyRef = db.collection('robotCommandHistory').doc(doc.id);
              batch.set(historyRef, {
                ...cmdData,
                status: 'CANCELLED',
                completedAt: now.toISOString(),
                ackDetails: {
                  executionStatus: 'FAILED',
                  executionTimestamp: now.toISOString(),
                  details: `Purged by high-priority ${commandType}`,
                },
              });
            }
          }
          await batch.commit();
        }

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          throw new Error('System mode switched away from LIVE + CLOUD');
        }

        await Promise.all([
          db.collection('robotCommands').doc(commandId).set(command),
          db.collection('robots').doc(robotId).set(
            {
              currentCommand: commandType,
              speed: command.speed,
              servoAngle: command.servo,
              updatedAt: now.toISOString(),
            },
            { merge: true }
          ),
        ]);

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          throw new Error('System mode switched away from LIVE + CLOUD');
        }

        this.isFirestoreConnected = true;
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          throw new Error('System mode switched away from LIVE + CLOUD');
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore write error';
        this.logAudit('SAFETY', 'ERROR', `Firestore write failed for command ${commandId}`, {
          command: commandType,
          error: msg,
        });
        throw new Error(`Firestore command write failed: ${msg}`);
      }
    }

    // In-memory updates (for DEMO/LOCAL mode or after successful Firestore write)
    if (commandType === 'STOP' || commandType === 'EMERGENCY_STOP') {
      for (const [id, cmd] of this.pendingCommands.entries()) {
        if (
          cmd.command === 'FORWARD' ||
          cmd.command === 'BACKWARD' ||
          cmd.command === 'LEFT' ||
          cmd.command === 'RIGHT'
        ) {
          cmd.status = 'CANCELLED';
          cmd.completedAt = now.toISOString();
          cmd.ackDetails = {
            executionStatus: 'FAILED',
            executionTimestamp: now.toISOString(),
            details: `Purged by high-priority ${commandType}`,
          };
          this.commandHistory.unshift(cmd);
          this.pendingCommands.delete(id);
        }
      }
      this.robot.currentCommand = commandType;
      this.logAudit('SAFETY', 'WARN', `${commandType} triggered — pending movements purged`, { commandId });
    }

    if (commandType === 'RESET_EMERGENCY_STOP') {
      this.robot.currentCommand = 'STOP';
      this.logAudit('SAFETY', 'INFO', 'Emergency stop cleared — robot ready for motion', { commandId });
    }

    if (commandType === 'SET_SPEED' && params.speed !== undefined) {
      this.robot.speed = Math.max(1, Math.min(5, params.speed));
    }
    if (commandType === 'SET_SERVO' && params.servo !== undefined) {
      this.robot.servoAngle = Math.max(0, Math.min(180, params.servo));
    }

    this.pendingCommands.set(commandId, command);
    this.robot.currentCommand = commandType;
    this.robot.updatedAt = now.toISOString();

    this.logAudit('COMMAND', 'INFO', `Command ${commandType} enqueued`, {
      commandId,
      speed: command.speed,
      servo: command.servo,
      source: command.source,
    });

    return command;
  }

  /**
   * Called by ESP32-CAM via GET /api/device/commands
   * In LIVE + CLOUD mode, fetches exclusively from 'robotCommands' collection.
   * If Firestore read or update fails, throws an error and does NOT return a command.
   */
  public async pollNextCommand(robotId: string = this.defaultRobotId): Promise<{
    hasCommand: boolean;
    command?: RobotCommand;
  }> {
    this.checkTimeouts();

    let candidate: RobotCommand | null = null;

    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during device poll', { robotId, error: msg });
        throw new Error(`Firestore is unavailable. Cannot poll commands in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        const querySnapshot = await db
          .collection('robotCommands')
          .where('robotId', '==', robotId)
          .where('status', '==', 'PENDING')
          .orderBy('createdAt', 'asc')
          .limit(5)
          .get();

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { hasCommand: false };
        }

        this.isFirestoreConnected = true;

        if (!querySnapshot.empty) {
          const docs = querySnapshot.docs.map((d) => d.data() as RobotCommand);
          candidate = docs.find((d) => d.command === 'EMERGENCY_STOP' || d.command === 'STOP') || docs[0];
        }
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { hasCommand: false };
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore read error';
        this.logAudit('SAFETY', 'ERROR', 'Firestore poll query failure', { robotId, error: msg });
        throw new Error(`Firestore read failed during device polling: ${msg}`);
      }

      if (!candidate) {
        return { hasCommand: false };
      }

      const now = new Date().toISOString();
      candidate.status = 'EXECUTING';
      candidate.executedAt = now;

      // Update candidate in Firestore
      try {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { hasCommand: false };
        }

        await Promise.all([
          db.collection('robotCommands').doc(candidate.commandId).set(
            { status: 'EXECUTING', executedAt: now },
            { merge: true }
          ),
          db.collection('robots').doc(robotId).set(
            { currentCommand: candidate.command, cloudStatus: 'POLLING', updatedAt: now },
            { merge: true }
          ),
        ]);

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { hasCommand: false };
        }

        this.isFirestoreConnected = true;
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return { hasCommand: false };
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore update error';
        this.logAudit('SAFETY', 'ERROR', 'Firestore poll mark-executing failure', {
          commandId: candidate.commandId,
          error: msg,
        });
        throw new Error(`Firestore update failed during device polling: ${msg}`);
      }

      if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
        return { hasCommand: false };
      }

      this.robot.currentCommand = candidate.command;
      this.robot.cloudStatus = 'POLLING';
      this.logAudit('COMMAND', 'INFO', `Device fetched command ${candidate.commandId} (${candidate.command})`);

      return {
        hasCommand: true,
        command: { ...candidate },
      };
    }

    // DEMO / LOCAL mode (In-memory only)
    for (const cmd of this.pendingCommands.values()) {
      if (cmd.robotId === robotId && cmd.status === 'PENDING') {
        if (cmd.command === 'EMERGENCY_STOP' || cmd.command === 'STOP') {
          candidate = cmd;
          break;
        }
        if (!candidate) candidate = cmd;
      }
    }

    if (!candidate) {
      return { hasCommand: false };
    }

    const now = new Date().toISOString();
    candidate.status = 'EXECUTING';
    candidate.executedAt = now;
    this.robot.currentCommand = candidate.command;
    this.robot.cloudStatus = 'POLLING';
    this.pendingCommands.set(candidate.commandId, candidate);

    this.logAudit('COMMAND', 'INFO', `Device fetched command ${candidate.commandId} (${candidate.command})`);

    return {
      hasCommand: true,
      command: { ...candidate },
    };
  }

  /**
   * Called by ESP32-CAM via POST /api/device/ack
   * In LIVE + CLOUD mode, persists ack to Firestore.
   */
  public async acknowledgeCommand(payload: DeviceAckPayload): Promise<RobotCommand | null> {
    const now = new Date().toISOString();

    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during acknowledgeCommand', { error: msg });
        throw new Error(`Firestore is unavailable. Cannot acknowledge command in LIVE + CLOUD mode: ${msg}`);
      }

      let command: RobotCommand | null = null;
      try {
        const docRef = db.collection('robotCommands').doc(payload.commandId);
        const docSnap = await docRef.get();

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return null;
        }

        this.isFirestoreConnected = true;

        if (docSnap.exists) {
          command = docSnap.data() as RobotCommand;
        }
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return null;
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore read error';
        this.logAudit('SAFETY', 'ERROR', `Firestore ack read failure for ${payload.commandId}`, { error: msg });
        throw new Error(`Firestore read failed during ack: ${msg}`);
      }

      // No in-memory fallback in LIVE + CLOUD mode

      if (command) {
        command.status = payload.executionStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
        command.completedAt = now;
        command.ackDetails = {
          executionStatus: payload.executionStatus,
          executionTimestamp: payload.executionTimestamp || now,
          details: payload.details,
        };

        try {
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return null;
          }

          await Promise.all([
            db.collection('robotCommands').doc(payload.commandId).delete(),
            db.collection('robotCommandHistory').doc(payload.commandId).set(command),
            db.collection('robots').doc(payload.robotId).set(
              {
                totalCommandsExecuted: (this.robot.totalCommandsExecuted || 0) + 1,
                currentCommand: null,
                updatedAt: now,
              },
              { merge: true }
            ),
          ]);

          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return null;
          }

          this.isFirestoreConnected = true;
        } catch (err: unknown) {
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return null;
          }
          this.isFirestoreConnected = false;
          const msg = err instanceof Error ? err.message : 'Firestore write error';
          this.logAudit('SAFETY', 'ERROR', `Firestore ack write failure for ${payload.commandId}`, { error: msg });
          throw new Error(`Firestore ack persistence failed: ${msg}`);
        }

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return null;
        }

        this.pendingCommands.delete(payload.commandId);
        this.commandHistory.unshift(command);
        if (this.commandHistory.length > 200) this.commandHistory.pop();
        this.robot.totalCommandsExecuted += 1;
        this.robot.updatedAt = now;
        if (this.robot.currentCommand === command.command) {
          this.robot.currentCommand = null;
        }

        return command;
      }

      return null;
    }

    // In-memory ack (DEMO / LOCAL mode)
    const command = this.pendingCommands.get(payload.commandId);
    if (command) {
      command.status = payload.executionStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
      command.completedAt = now;
      command.ackDetails = {
        executionStatus: payload.executionStatus,
        executionTimestamp: payload.executionTimestamp || now,
        details: payload.details,
      };

      this.pendingCommands.delete(payload.commandId);
      this.commandHistory.unshift(command);
      if (this.commandHistory.length > 200) this.commandHistory.pop();

      this.robot.totalCommandsExecuted += 1;
      this.robot.updatedAt = now;
      if (this.robot.currentCommand === command.command) {
        this.robot.currentCommand = null;
      }

      this.logAudit(
        'COMMAND',
        payload.executionStatus === 'COMPLETED' ? 'INFO' : 'ERROR',
        `Ack for ${command.commandId}: ${payload.executionStatus}`,
        { details: payload.details }
      );

      return command;
    }

    return null;
  }

  /**
   * Records a direct local dispatch command execution into commandHistory and telemetry
   * without enqueuing it into pendingCommands. Prevents LOCAL mode commands from polluting
   * the demo queue or appearing as expired/cancelled.
   */
  public recordLocalCommand(command: RobotCommand): void {
    const now = new Date().toISOString();
    this.commandHistory = [command, ...this.commandHistory.filter((c) => c.commandId !== command.commandId)].slice(0, 200);

    if (command.command === 'STOP' || command.command === 'EMERGENCY_STOP') {
      this.robot.currentCommand = command.command;
    } else if (['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT'].includes(command.command)) {
      this.robot.currentCommand = command.command;
    }

    if (command.speed !== undefined) {
      this.robot.speed = Math.max(1, Math.min(5, command.speed));
    }
    if (command.servo !== undefined) {
      this.robot.servoAngle = Math.max(0, Math.min(180, command.servo));
    }

    if (command.status === 'COMPLETED') {
      this.robot.totalCommandsExecuted += 1;
    }
    this.robot.updatedAt = now;

    this.logAudit(
      'COMMAND',
      command.status === 'COMPLETED' ? 'INFO' : 'WARN',
      `Local dispatch ${command.command}: ${command.status}`,
      {
        commandId: command.commandId,
        speed: command.speed,
        servo: command.servo,
        details: command.ackDetails?.details,
      }
    );
  }

  /**
   * Records a FastAPI backend command dispatch into commandHistory and telemetry
   */
  public recordFastApiCommand(command: RobotCommand): void {
    const now = new Date().toISOString();
    this.commandHistory = [command, ...this.commandHistory.filter((c) => c.commandId !== command.commandId)].slice(0, 200);

    this.robot.currentCommand = command.command === 'STOP' ? null : command.command;
    this.robot.online = true;
    this.robot.cloudStatus = 'CONNECTED';
    this.robot.lastSeen = now;

    if (command.speed !== undefined) {
      this.robot.speed = Math.max(1, Math.min(5, command.speed));
    }
    if (command.servo !== undefined) {
      this.robot.servoAngle = Math.max(0, Math.min(180, command.servo));
    }

    if (command.status === 'COMPLETED') {
      this.robot.totalCommandsExecuted += 1;
    }
    this.robot.updatedAt = now;

    this.logAudit(
      'COMMAND',
      'INFO',
      `FastAPI command executed: ${command.command}`,
      {
        commandId: command.commandId,
        speed: command.speed,
        servo: command.servo,
        source: command.source,
      }
    );
  }

  public async getPendingCommands(robotId: string = this.defaultRobotId): Promise<RobotCommand[]> {
    // In LOCAL mode, commands are dispatched directly without queuing.
    // Return empty array so stale demo queue commands do not show as expiring/cancelled.
    if (this.config.controlMode === 'LOCAL') {
      return [];
    }

    this.checkTimeouts();

    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during getPendingCommands', { robotId, error: msg });
        throw new Error(`Firestore is unavailable. Cannot fetch pending commands in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        const querySnapshot = await db
          .collection('robotCommands')
          .where('robotId', '==', robotId)
          .get();

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return Array.from(this.pendingCommands.values()).filter((c) => c.robotId === robotId);
        }

        this.isFirestoreConnected = true;
        return querySnapshot.docs.map((d) => d.data() as RobotCommand);
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return Array.from(this.pendingCommands.values()).filter((c) => c.robotId === robotId);
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore read error';
        this.logAudit('SAFETY', 'ERROR', 'Firestore getPendingCommands read failure', { robotId, error: msg });
        throw new Error(`Firestore read failed for pending commands: ${msg}`);
      }
    }

    return Array.from(this.pendingCommands.values()).filter((c) => c.robotId === robotId);
  }

  public async getCommandHistory(
    robotId: string = this.defaultRobotId,
    limit: number = 20
  ): Promise<RobotCommand[]> {
    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during getCommandHistory', { robotId, error: msg });
        throw new Error(`Firestore is unavailable. Cannot fetch command history in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        const querySnapshot = await db
          .collection('robotCommandHistory')
          .where('robotId', '==', robotId)
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return this.commandHistory.filter((c) => c.robotId === robotId).slice(0, limit);
        }

        this.isFirestoreConnected = true;
        return querySnapshot.docs.map((d) => d.data() as RobotCommand);
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return this.commandHistory.filter((c) => c.robotId === robotId).slice(0, limit);
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore read error';
        this.logAudit('SAFETY', 'ERROR', 'Firestore getCommandHistory read failure', { robotId, error: msg });
        throw new Error(`Firestore read failed for command history: ${msg}`);
      }
    }

    return this.commandHistory.filter((c) => c.robotId === robotId).slice(0, limit);
  }

  public async recordCameraImage(
    data: Omit<CameraImageRecord, 'imageId' | 'createdAt'>
  ): Promise<CameraImageRecord> {
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: CameraImageRecord = {
      imageId,
      createdAt: new Date().toISOString(),
      ...data,
    };

    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during recordCameraImage', { imageId, error: msg });
        throw new Error(`Firestore is unavailable. Cannot save camera frame in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        const isSvgOrSmall = record.url.length < 500000;
        const firestoreRecord = {
          ...record,
          url: isSvgOrSmall ? record.url : record.storagePath,
        };
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return record;
        }
        await db.collection('cameraImages').doc(imageId).set(firestoreRecord);
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return record;
        }
        this.isFirestoreConnected = true;
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return record;
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore write error';
        this.logAudit('SAFETY', 'ERROR', 'Firestore recordCameraImage write failure', { imageId, error: msg });
        throw new Error(`Firestore camera image write failed: ${msg}`);
      }
    }

    this.images.unshift(record);
    if (this.images.length > 50) this.images.pop();

    this.logAudit('CAMERA', 'INFO', `New camera frame stored: ${imageId}`, { size: data.size });
    return record;
  }

  public async getCameraImages(robotId: string = this.defaultRobotId): Promise<CameraImageRecord[]> {
    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during getCameraImages', { robotId, error: msg });
        throw new Error(`Firestore is unavailable. Cannot fetch camera images in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        const querySnapshot = await db
          .collection('cameraImages')
          .where('robotId', '==', robotId)
          .orderBy('createdAt', 'desc')
          .limit(30)
          .get();

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return this.images.filter((img) => img.robotId === robotId);
        }

        this.isFirestoreConnected = true;
        return querySnapshot.docs.map((d) => d.data() as CameraImageRecord);
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return this.images.filter((img) => img.robotId === robotId);
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore read error';
        this.logAudit('SAFETY', 'ERROR', 'Firestore getCameraImages read failure', { robotId, error: msg });
        throw new Error(`Firestore camera images read failed: ${msg}`);
      }
    }

    return this.images.filter((img) => img.robotId === robotId);
  }

  public async updateImageAiAnalysis(
    imageId: string,
    analysis: CameraImageRecord['aiAnalysis']
  ): Promise<CameraImageRecord | null> {
    const img = this.images.find((i) => i.imageId === imageId);
    if (img && analysis) {
      img.aiAnalysis = analysis;

      if (this.isFirestoreActive()) {
        const currentEpoch = this.modeEpoch;
        let db: Firestore;
        try {
          db = this.getFirestoreClient();
        } catch (err: unknown) {
          this.isFirestoreConnected = false;
          const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
          this.logAudit('SAFETY', 'ERROR', 'Firestore unavailable during updateImageAiAnalysis', { imageId, error: msg });
          throw new Error(`Firestore is unavailable. Cannot update AI analysis in LIVE + CLOUD mode: ${msg}`);
        }

        try {
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return img;
          }
          await db
            .collection('cameraImages')
            .doc(imageId)
            .set({ aiAnalysis: analysis }, { merge: true });
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return img;
          }
          this.isFirestoreConnected = true;
        } catch (err: unknown) {
          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return img;
          }
          this.isFirestoreConnected = false;
          const msg = err instanceof Error ? err.message : 'Firestore write error';
          this.logAudit('SAFETY', 'ERROR', 'Firestore updateImageAiAnalysis failure', { imageId, error: msg });
          throw new Error(`Firestore vision analysis update failed: ${msg}`);
        }
      }

      this.logAudit('AI', 'INFO', `AI Vision analysis attached to image ${imageId}`, {
        safe: analysis.isSafeToAdvance,
      });
      return img;
    }
    return null;
  }

  public async getAuditLogs(limit: number = 50): Promise<SystemAuditLog[]> {
    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore is unavailable';
        throw new Error(`Firestore is unavailable. Cannot fetch system logs in LIVE + CLOUD mode: ${msg}`);
      }

      try {
        const querySnapshot = await db
          .collection('systemLogs')
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return this.auditLogs.slice(0, limit);
        }

        this.isFirestoreConnected = true;
        return querySnapshot.docs.map((d) => d.data() as SystemAuditLog);
      } catch (err: unknown) {
        if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
          return this.auditLogs.slice(0, limit);
        }
        this.isFirestoreConnected = false;
        const msg = err instanceof Error ? err.message : 'Firestore read error';
        throw new Error(`Firestore system logs read failed: ${msg}`);
      }
    }

    return this.auditLogs.slice(0, limit);
  }

  public logAudit(
    category: SystemAuditLog['category'],
    level: SystemAuditLog['level'],
    message: string,
    details?: Record<string, unknown>
  ): void {
    const log: SystemAuditLog = {
      logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      category,
      level,
      message,
      details,
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 200) this.auditLogs.pop();

    if (this.isFirestoreActive()) {
      const currentEpoch = this.modeEpoch;
      let db: Firestore;
      try {
        db = this.getFirestoreClient();
      } catch (err: unknown) {
        this.isFirestoreConnected = false;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[Firestore Audit Error: Client Unavailable]', errMsg);
        return;
      }

      if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
        return;
      }

      db.collection('systemLogs')
        .doc(log.logId)
        .set(log)
        .then(() => {
          if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
            this.isFirestoreConnected = true;
          }
        })
        .catch((err: unknown) => {
          if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
            this.isFirestoreConnected = false;
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error('[Firestore Audit Write Error]', errMsg);
          }
        });
    }
  }

  private async syncRobotToFirestore(): Promise<void> {
    if (!this.isFirestoreActive()) return;

    const currentEpoch = this.modeEpoch;
    let db: Firestore;
    try {
      db = this.getFirestoreClient();
    } catch (err: unknown) {
      this.isFirestoreConnected = false;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Firestore Sync Error: Client Unavailable]', errMsg);
      throw new Error(`Firestore unavailable for robot sync: ${errMsg}`);
    }

    if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
      return;
    }

    try {
      await db.collection('robots').doc(this.defaultRobotId).set(this.robot, { merge: true });
      if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
        return;
      }
      this.isFirestoreConnected = true;
    } catch (err: unknown) {
      if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
        return;
      }
      this.isFirestoreConnected = false;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Firestore Sync Error]', errMsg);
      throw new Error(`Firestore robot sync failed: ${errMsg}`);
    }
  }

  private checkTimeouts(): void {
    const now = Date.now();

    // 1. Expired commands
    for (const [id, cmd] of this.pendingCommands.entries()) {
      const expiresAtMs = new Date(cmd.expiresAt).getTime();
      if (now > expiresAtMs) {
        cmd.status = 'EXPIRED';
        cmd.completedAt = new Date().toISOString();
        cmd.ackDetails = {
          executionStatus: 'FAILED',
          executionTimestamp: cmd.completedAt,
          details: 'Command expired in queue prior to device pickup',
        };
        this.commandHistory.unshift(cmd);
        this.pendingCommands.delete(id);
        this.logAudit('SAFETY', 'WARN', `Command ${cmd.commandId} (${cmd.command}) expired`, { id });

        if (this.isFirestoreActive()) {
          const currentEpoch = this.modeEpoch;
          let db: Firestore;
          try {
            db = this.getFirestoreClient();
          } catch (err: unknown) {
            this.isFirestoreConnected = false;
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Firestore Timeout Command Client Error for ${id}]:`, errMsg);
            continue;
          }

          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            continue;
          }

          db.collection('robotCommands')
            .doc(id)
            .delete()
            .then(() => {
              if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
                this.isFirestoreConnected = true;
              }
            })
            .catch((err: unknown) => {
              if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
                this.isFirestoreConnected = false;
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`[Firestore Timeout Delete Error for ${id}]:`, errMsg);
              }
            });

          db.collection('robotCommandHistory')
            .doc(id)
            .set(cmd)
            .then(() => {
              if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
                this.isFirestoreConnected = true;
              }
            })
            .catch((err: unknown) => {
              if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
                this.isFirestoreConnected = false;
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`[Firestore Timeout History Error for ${id}]:`, errMsg);
              }
            });
        }
      }
    }

    // 2. Heartbeat watchdog
    const lastSeenMs = new Date(this.robot.lastSeen).getTime();
    if (now - lastSeenMs > this.heartbeatTimeoutMs) {
      if (this.robot.online) {
        this.robot.online = false;
        this.robot.cloudStatus = 'DISCONNECTED';
        this.robot.wifiStatus = 'OFFLINE';
        this.logAudit('SAFETY', 'ERROR', `Robot ${this.robot.robotId} heartbeat lost! Marked OFFLINE`);

        if (this.isFirestoreActive()) {
          const currentEpoch = this.modeEpoch;
          let db: Firestore;
          try {
            db = this.getFirestoreClient();
          } catch (err: unknown) {
            this.isFirestoreConnected = false;
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Firestore Watchdog Client Error for ${this.robot.robotId}]:`, errMsg);
            return;
          }

          if (!this.isFirestoreActive() || this.modeEpoch !== currentEpoch) {
            return;
          }

          db.collection('robots')
            .doc(this.robot.robotId)
            .set(
              {
                online: false,
                cloudStatus: 'DISCONNECTED',
                wifiStatus: 'OFFLINE',
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            )
            .then(() => {
              if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
                this.isFirestoreConnected = true;
              }
            })
            .catch((err: unknown) => {
              if (this.isFirestoreActive() && this.modeEpoch === currentEpoch) {
                this.isFirestoreConnected = false;
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`[Firestore Watchdog Offline Error for ${this.robot.robotId}]:`, errMsg);
              }
            });
        }
      }
    }
  }

  private seedSampleImages(): void {
    const initialSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="floor" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#090d16"/>
        </linearGradient>
      </defs>
      <rect width="640" height="300" fill="url(#sky)"/>
      <rect y="300" width="640" height="180" fill="url(#floor)"/>
      <path d="M 0 300 L 640 300" stroke="#334155" stroke-width="2"/>
      <path d="M 220 300 L 160 480" stroke="#334155" stroke-width="1.5" stroke-dasharray="6,4"/>
      <path d="M 420 300 L 480 480" stroke="#334155" stroke-width="1.5" stroke-dasharray="6,4"/>
      <rect x="270" y="240" width="100" height="90" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5" rx="4"/>
      <circle cx="320" cy="285" r="14" fill="#f59e0b" fill-opacity="0.2" stroke="#f59e0b" stroke-width="2"/>
      <line x1="320" y1="210" x2="320" y2="350" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4,4"/>
      <line x1="250" y1="285" x2="390" y2="285" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="24" y="38" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">ESP32-CAM FEED // SMART RAKSHAK OV2640</text>
      <text x="24" y="58" fill="#94a3b8" font-family="monospace" font-size="11">VGA 640x480 · JPEG QUALITY: 12 · FPS: 15</text>
      <text x="460" y="38" fill="#22c55e" font-family="monospace" font-size="13">STATUS: NOMINAL</text>
      <text x="460" y="58" fill="#94a3b8" font-family="monospace" font-size="11">EXPOSURE: AUTO</text>
    </svg>`;

    const base64Data = `data:image/svg+xml;base64,${Buffer.from(initialSvg).toString('base64')}`;

    this.images.push({
      imageId: 'img_init_001',
      robotId: this.defaultRobotId,
      storagePath: `gs://smart-rakshak-captures/${this.defaultRobotId}/img_init_001.jpg`,
      url: base64Data,
      createdAt: new Date().toISOString(),
      captureSource: 'ESP32_CAM_AUTO',
      contentType: 'image/svg+xml',
      size: 14280,
      width: 640,
      height: 480,
      aiAnalysis: {
        summary: 'Clear forward corridor detected. Small target marker in focal grid at 1.8 meters. No hazardous drop-offs.',
        detectedObstacles: ['Calibrated ground marker (distance ~1.8m)'],
        isSafeToAdvance: true,
        analyzedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Helper Mode Assistance Events Storage
   */
  public async recordHelperEvent(
    event: Omit<HelperAssistanceEvent, 'eventId' | 'timestamp'>
  ): Promise<HelperAssistanceEvent> {
    const eventId = `helper_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullEvent: HelperAssistanceEvent = {
      eventId,
      timestamp: new Date().toISOString(),
      ...event,
      persistedToFirestore: false,
    };

    if (this.isFirestoreActive()) {
      try {
        const db = this.getFirestoreClient();
        await db.collection('helperEvents').doc(eventId).set(fullEvent);
        fullEvent.persistedToFirestore = true;
      } catch (err) {
        console.warn('Failed to persist helper event to Firestore:', err);
      }
    }

    this.helperEvents.unshift(fullEvent);
    if (this.helperEvents.length > 50) this.helperEvents.pop();

    this.logAudit('AI', 'INFO', `Helper Mode Event [${fullEvent.category}]: ${fullEvent.summary}`, {
      eventId,
      status: fullEvent.status,
    });

    return fullEvent;
  }

  public async getHelperEvents(limit: number = 25): Promise<{ events: HelperAssistanceEvent[]; firestoreConnected: boolean }> {
    if (this.isFirestoreActive()) {
      try {
        const db = this.getFirestoreClient();
        const snap = await db
          .collection('helperEvents')
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        if (!snap.empty) {
          const events = snap.docs.map((d) => d.data() as HelperAssistanceEvent);
          return { events, firestoreConnected: true };
        }
      } catch (err) {
        console.warn('Firestore helperEvents fetch failed, using in-memory:', err);
      }
    }

    return {
      events: this.helperEvents.slice(0, limit),
      firestoreConnected: this.isFirestoreConnected && this.isFirestoreActive(),
    };
  }

  /**
   * Guardian Mode Safety Events Storage
   */
  public async recordGuardianEvent(
    event: Omit<GuardianSafetyEvent, 'eventId' | 'timestamp'>
  ): Promise<GuardianSafetyEvent> {
    const eventId = `guardian_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullEvent: GuardianSafetyEvent = {
      eventId,
      timestamp: new Date().toISOString(),
      ...event,
      persistedToFirestore: false,
    };

    if (this.isFirestoreActive()) {
      try {
        const db = this.getFirestoreClient();
        await db.collection('guardianEvents').doc(eventId).set(fullEvent);
        fullEvent.persistedToFirestore = true;
      } catch (err) {
        console.warn('Failed to persist guardian event to Firestore:', err);
      }
    }

    this.guardianEvents.unshift(fullEvent);
    if (this.guardianEvents.length > 50) this.guardianEvents.pop();

    this.logAudit('AI', 'INFO', `Guardian Mode Event [${fullEvent.category}]: ${fullEvent.summary}`, {
      eventId,
      status: fullEvent.status,
    });

    return fullEvent;
  }

  public async getGuardianEvents(limit: number = 25): Promise<{ events: GuardianSafetyEvent[]; firestoreConnected: boolean }> {
    if (this.isFirestoreActive()) {
      try {
        const db = this.getFirestoreClient();
        const snap = await db
          .collection('guardianEvents')
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        if (!snap.empty) {
          const events = snap.docs.map((d) => d.data() as GuardianSafetyEvent);
          return { events, firestoreConnected: true };
        }
      } catch (err) {
        console.warn('Firestore guardianEvents fetch failed, using in-memory:', err);
      }
    }

    return {
      events: this.guardianEvents.slice(0, limit),
      firestoreConnected: this.isFirestoreConnected && this.isFirestoreActive(),
    };
  }

  /**
   * Protection Mode Safety Events Storage
   */
  public async recordProtectionEvent(
    event: Omit<ProtectionSafetyEvent, 'eventId' | 'timestamp'>
  ): Promise<ProtectionSafetyEvent> {
    const eventId = `protection_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullEvent: ProtectionSafetyEvent = {
      eventId,
      timestamp: new Date().toISOString(),
      ...event,
      persistedToFirestore: false,
    };

    if (this.isFirestoreActive()) {
      try {
        const db = this.getFirestoreClient();
        await db.collection('protectionEvents').doc(eventId).set(fullEvent);
        fullEvent.persistedToFirestore = true;
      } catch (err) {
        console.warn('Failed to persist protection event to Firestore:', err);
      }
    }

    this.protectionEvents.unshift(fullEvent);
    if (this.protectionEvents.length > 50) this.protectionEvents.pop();

    this.logAudit('AI', 'INFO', `Protection Mode Event [${fullEvent.assessmentCategory}]: ${fullEvent.shortSummary}`, {
      eventId,
      status: fullEvent.status,
    });

    return fullEvent;
  }

  public async getProtectionEvents(limit: number = 25): Promise<{ events: ProtectionSafetyEvent[]; firestoreConnected: boolean }> {
    if (this.isFirestoreActive()) {
      try {
        const db = this.getFirestoreClient();
        const snap = await db
          .collection('protectionEvents')
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        if (!snap.empty) {
          const events = snap.docs.map((d) => d.data() as ProtectionSafetyEvent);
          return { events, firestoreConnected: true };
        }
      } catch (err) {
        console.warn('Firestore protectionEvents fetch failed, using in-memory:', err);
      }
    }

    return {
      events: this.protectionEvents.slice(0, limit),
      firestoreConnected: this.isFirestoreConnected && this.isFirestoreActive(),
    };
  }
}

export const dataStore = new RobotDataStore();
