/**
 * Smart Rakshak — Multi-Mission Robot Operating Modes
 *
 * Operational Control Center for:
 * 1. HELPER MODE (Elderly & Accessibility Functional Control Center)
 * 2. GUARDIAN MODE (Child-Friendly Companion & Safety Operational Workspace)
 * 3. PROTECTION MODE (Home Security & Hazard Detection Roadmap)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  HeartHandshake,
  Baby,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
  Eye,
  Camera,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Mic,
  MicOff,
  ArrowRight,
  Shield,
  Activity,
  PhoneCall,
  Zap,
  Play,
  RotateCcw,
  Check,
  ChevronRight,
  Copy,
  Clock,
  Upload,
  Image as ImageIcon,
  Send,
  Power,
  Wind,
  FileText,
  AlertOctagon,
  Info,
  ExternalLink,
  Battery,
  BatteryCharging,
  Wifi,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Square,
  Compass,
  Smile,
  HelpCircle,
  Radio,
  SlidersHorizontal,
  ShieldCheck,
  AlertCircle,
  Search,
} from 'lucide-react';
import {
  RobotCommandType,
  RobotStatus,
  SystemModeConfig,
  CameraImageRecord,
  HelperCategory,
  HelperAssistanceEvent,
  HelperAssistantResponse,
  HelperVisionAnalysisResponse,
  CaregiverDraftResponse,
  GuardianCategory,
  GuardianCompanionResponse,
  GuardianSafetyGuidanceResponse,
  GuardianVisionAnalysisResponse,
  GuardianAssistanceRequest,
  GuardianSafetyEvent,
  ProtectionAssessmentCategory,
  ProtectionHazardObservation,
  ProtectionAnalysisResponse,
  ProtectionFollowUpResponse,
  ProtectionSafetyEvent,
} from '../types/robot.js';

export type OperatingModeId = 'HELPER' | 'GUARDIAN' | 'PROTECTION';

interface RobotModesTabProps {
  status: RobotStatus | null;
  config: SystemModeConfig;
  onExecuteCommand?: (command: RobotCommandType, options?: { speed?: number; servo?: number; source?: any }) => void;
  onTriggerCapture?: () => void;
  images?: CameraImageRecord[];
}

interface SimulatedDevice {
  id: string;
  name: string;
  type: 'LIGHT' | 'FAN' | 'PLUG' | 'HEATER';
  location: string;
  isOn: boolean;
  powerWatts: number;
}

export const RobotModesTab: React.FC<RobotModesTabProps> = ({
  status,
  config,
  onExecuteCommand,
  onTriggerCapture,
  images = [],
}) => {
  const [selectedMode, setSelectedMode] = useState<OperatingModeId>('HELPER');

  // Shared Accessibility States
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [textSize, setTextSize] = useState<'normal' | 'large' | 'extralarge'>('large');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Hardware execution toast
  const [hardwareActionNotice, setHardwareActionNotice] = useState<string | null>(null);

  // ==========================================
  // 1. HELPER MODE STATES
  // ==========================================
  const [assistantPrompt, setAssistantPrompt] = useState<string>('');
  const [assistantLoading, setAssistantLoading] = useState<boolean>(false);
  const [assistantHistory, setAssistantHistory] = useState<Array<{
    role: 'user' | 'assistant';
    text: string;
    category?: HelperCategory;
    data?: HelperAssistantResponse;
  }>>([
    {
      role: 'assistant',
      text: 'Hello. I am your Smart Rakshak Helper. I am here to help you move safely, inspect your surroundings, adjust room lighting, or notify your caregiver. What can I assist you with today?',
      category: 'GENERAL_HELP',
    },
  ]);

  // Voice Input State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  // Smart-Home State
  const [smartDevices, setSmartDevices] = useState<SimulatedDevice[]>([
    { id: 'light_living', name: 'Living Room Overhead Light', type: 'LIGHT', location: 'Living Room', isOn: false, powerWatts: 0 },
    { id: 'lamp_bedside', name: 'Bedside Night Lamp', type: 'LIGHT', location: 'Bedroom', isOn: true, powerWatts: 8 },
    { id: 'fan_ceiling', name: 'Ceiling Circulation Fan', type: 'FAN', location: 'Living Room', isOn: false, powerWatts: 0 },
    { id: 'plug_heater', name: 'Bedroom Heater Smart Plug', type: 'PLUG', location: 'Bedroom', isOn: false, powerWatts: 0 },
  ]);
  const [deviceActionNotice, setDeviceActionNotice] = useState<string | null>(null);

  // Helper Visual Assistance State
  const [selectedImageSource, setSelectedImageSource] = useState<'upload' | 'camera'>('camera');
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [visualQuestion, setVisualQuestion] = useState<string>('Describe my surroundings and identify any obstacles or items of interest.');
  const [isAnalyzingVision, setIsAnalyzingVision] = useState<boolean>(false);
  const [visionResult, setVisionResult] = useState<HelperVisionAnalysisResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper Caregiver Assistance State
  const [caregiverReason, setCaregiverReason] = useState<string>('Feeling dizzy / Need assistance walking');
  const [caregiverNotes, setCaregiverNotes] = useState<string>('');
  const [caregiverLocation, setCaregiverLocation] = useState<string>('Living Room');
  const [isDraftingMessage, setIsDraftingMessage] = useState<boolean>(false);
  const [caregiverDraft, setCaregiverDraft] = useState<CaregiverDraftResponse | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  // Helper Assistance History State
  const [eventsList, setEventsList] = useState<HelperAssistanceEvent[]>([]);
  const [isFirestorePersisted, setIsFirestorePersisted] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // ==========================================
  // 2. GUARDIAN MODE STATES (Child Safety & Companion)
  // ==========================================
  // Capability 1: Child-Friendly AI Companion
  const [guardianPrompt, setGuardianPrompt] = useState<string>('');
  const [guardianLoading, setGuardianLoading] = useState<boolean>(false);
  const [guardianHistory, setGuardianHistory] = useState<Array<{
    role: 'child' | 'companion';
    text: string;
    category?: GuardianCategory;
    data?: GuardianCompanionResponse;
  }>>([
    {
      role: 'companion',
      text: 'Hi there! I am Smart Rakshak, your friendly robot companion. I love learning science facts, exploring new ideas, and helping you stay safe at home. What would you like to explore today?',
      category: 'GENERAL_COMPANION',
    },
  ]);

  // Capability 2: Child Safety Guidance
  const [selectedSituation, setSelectedSituation] = useState<string>('An unfamiliar person is at the door.');
  const [safetyGuidanceLoading, setSafetyGuidanceLoading] = useState<boolean>(false);
  const [guidanceResult, setGuidanceResult] = useState<GuardianSafetyGuidanceResponse | null>(null);

  // Capability 3: Obstacle Awareness Lab
  const [obstacleDistanceCm, setObstacleDistanceCm] = useState<number>(15);
  const [selectedObstacleScenario, setSelectedObstacleScenario] = useState<'toy' | 'open' | 'chair'>('toy');
  const [isObstacleAvoidanceActive, setIsObstacleAvoidanceActive] = useState<boolean>(true);

  // Capability 4: Camera-Based Safety Awareness
  const [guardianImageSource, setGuardianImageSource] = useState<'upload' | 'camera'>('camera');
  const [guardianSelectedImageId, setGuardianSelectedImageId] = useState<string>('');
  const [guardianUploadedBase64, setGuardianUploadedBase64] = useState<string | null>(null);
  const [guardianVisualQuestion, setGuardianVisualQuestion] = useState<string>('Check the room and walkway for toys, obstacles, or safety concerns.');
  const [isAnalyzingGuardianVision, setIsAnalyzingGuardianVision] = useState<boolean>(false);
  const [guardianVisionResult, setGuardianVisionResult] = useState<GuardianVisionAnalysisResponse | null>(null);
  const guardianFileInputRef = useRef<HTMLInputElement | null>(null);

  // Capability 5: Request Assistance Workflow
  const [childAssistanceReason, setChildAssistanceReason] = useState<string>('I need help.');
  const [childAssistanceNotes, setChildAssistanceNotes] = useState<string>('');
  const [childAssistanceLocation, setChildAssistanceLocation] = useState<string>('Playroom / Living Room');
  const [isDraftingGuardianAssistance, setIsDraftingGuardianAssistance] = useState<boolean>(false);
  const [guardianAssistanceDraft, setGuardianAssistanceDraft] = useState<GuardianAssistanceRequest | null>(null);
  const [guardianCopiedNotice, setGuardianCopiedNotice] = useState<boolean>(false);

  // Capability 6: Caregiver Support & Safety Events
  const [guardianEventsList, setGuardianEventsList] = useState<GuardianSafetyEvent[]>([]);
  const [guardianHistoryLoading, setGuardianHistoryLoading] = useState<boolean>(false);
  const [guardianFirestorePersisted, setGuardianFirestorePersisted] = useState<boolean>(false);

  // ==========================================
  // 3. PROTECTION MODE STATES (Home Safety Awareness & Hazard Detection)
  // ==========================================
  const [protectionImageSource, setProtectionImageSource] = useState<'upload' | 'camera'>('upload');
  const [protectionSelectedImageId, setProtectionSelectedImageId] = useState<string>('');
  const [protectionUploadedBase64, setProtectionUploadedBase64] = useState<string | null>(null);
  const [protectionUploadedFilename, setProtectionUploadedFilename] = useState<string | null>(null);
  const [protectionUserFocus, setProtectionUserFocus] = useState<string>('Analyze this image for potential hazards.');
  const [isAnalyzingProtection, setIsAnalyzingProtection] = useState<boolean>(false);
  const [protectionAnalysis, setProtectionAnalysis] = useState<ProtectionAnalysisResponse | null>(null);
  const [protectionError, setProtectionError] = useState<string | null>(null);

  // Protection Follow-Up Chat State
  const [protectionFollowUpQuestion, setProtectionFollowUpQuestion] = useState<string>('');
  const [isAskingProtectionFollowUp, setIsAskingProtectionFollowUp] = useState<boolean>(false);
  const [protectionFollowUpHistory, setProtectionFollowUpHistory] = useState<Array<{
    role: 'user' | 'assistant';
    text: string;
    safetyAdvice?: string;
  }>>([]);

  // Protection Safety Event History State
  const [protectionEventsList, setProtectionEventsList] = useState<ProtectionSafetyEvent[]>([]);
  const [protectionHistoryLoading, setProtectionHistoryLoading] = useState<boolean>(false);
  const [protectionFirestorePersisted, setProtectionFirestorePersisted] = useState<boolean>(false);
  const protectionFileInputRef = useRef<HTMLInputElement | null>(null);

  // Speech Recognition & Speech Synthesis detection
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRec));
  }, []);

  // Text to Speech Accessible Reader
  const speakText = (text: string, rate: number = 0.9) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchSmartDevices();
    fetchHistory();
    fetchGuardianHistory();
    fetchProtectionHistory();
  }, []);

  const fetchSmartDevices = async () => {
    try {
      const res = await fetch('/api/helper/smart-home/devices');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.devices) && data.devices.length > 0) {
          setSmartDevices(data.devices);
        }
      }
    } catch {
      // In-memory initial client list fallback
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/helper/events?limit=25');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setEventsList(data.events);
        }
        setIsFirestorePersisted(Boolean(data.firestoreConnected));
      }
    } catch {
      // Non-blocking
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchGuardianHistory = async () => {
    setGuardianHistoryLoading(true);
    try {
      const res = await fetch('/api/guardian/events?limit=25');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setGuardianEventsList(data.events);
        }
        setGuardianFirestorePersisted(Boolean(data.firestoreConnected));
      }
    } catch {
      // Non-blocking
    } finally {
      setGuardianHistoryLoading(false);
    }
  };

  const fetchProtectionHistory = async () => {
    setProtectionHistoryLoading(true);
    try {
      const res = await fetch('/api/protection/events?limit=25');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setProtectionEventsList(data.events);
        }
        setProtectionFirestorePersisted(Boolean(data.firestoreConnected));
      }
    } catch {
      // Non-blocking
    } finally {
      setProtectionHistoryLoading(false);
    }
  };

  // Toggle Smart Device
  const handleToggleDevice = async (deviceId: string, targetState?: boolean) => {
    try {
      const res = await fetch('/api/helper/smart-home/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, targetState }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? data.device : d))
        );
        setDeviceActionNotice(data.message);
        setTimeout(() => setDeviceActionNotice(null), 5000);
        fetchHistory();
      }
    } catch {
      setSmartDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? { ...d, isOn: !d.isOn, powerWatts: !d.isOn ? (d.type === 'LIGHT' ? 15 : 45) : 0 }
            : d
        )
      );
    }
  };

  // Submit request to Helper Mode Gemini AI
  const handleAskAssistant = async (textToSend?: string) => {
    const query = (textToSend || assistantPrompt).trim();
    if (!query) return;

    setAssistantLoading(true);
    setAssistantPrompt('');
    setAssistantHistory((prev) => [...prev, { role: 'user', text: query }]);

    try {
      const res = await fetch('/api/helper/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: query }),
      });

      if (res.ok) {
        const data: HelperAssistantResponse = await res.json();
        setAssistantHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.response,
            category: data.category,
            data,
          },
        ]);

        speakText(data.response);

        if (data.suggestedSmartHomeAction) {
          const match = smartDevices.find((d) =>
            d.name.toLowerCase().includes(data.suggestedSmartHomeAction!.device.toLowerCase()) ||
            data.suggestedSmartHomeAction!.device.toLowerCase().includes(d.type.toLowerCase())
          );
          if (match) {
            handleToggleDevice(match.id, data.suggestedSmartHomeAction.targetState);
          }
        }

        fetchHistory();
      } else {
        setAssistantHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'I apologize, but I had trouble reaching the AI assistance engine. Please try again or select one of the quick assistance buttons.',
            category: 'GENERAL_HELP',
          },
        ]);
      }
    } catch {
      setAssistantHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Network connection issue while contacting the assistant. Please check your internet connection.',
          category: 'GENERAL_HELP',
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  // Draft Caregiver Notification Message
  const handleDraftCaregiverMessage = async (customReason?: string) => {
    setIsDraftingMessage(true);
    setCaregiverDraft(null);
    const reasonToUse = customReason || caregiverReason;
    try {
      const res = await fetch('/api/helper/caregiver-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reasonToUse, userNotes: caregiverNotes, roomLocation: caregiverLocation }),
      });
      if (res.ok) {
        const data: CaregiverDraftResponse = await res.json();
        setCaregiverDraft(data);
        fetchHistory();
        speakText(`Caregiver message prepared: ${data.message}`);
      }
    } finally {
      setIsDraftingMessage(false);
    }
  };

  // Copy Caregiver Message
  const handleCopyMessage = () => {
    if (!caregiverDraft) return;
    navigator.clipboard.writeText(caregiverDraft.message);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 3000);
  };

  // ==========================================
  // GUARDIAN MODE HANDLERS
  // ==========================================

  // 1. Submit request to Guardian Child Companion
  const handleAskGuardianCompanion = async (textToSend?: string) => {
    const query = (textToSend || guardianPrompt).trim();
    if (!query) return;

    setGuardianLoading(true);
    setGuardianPrompt('');
    setGuardianHistory((prev) => [...prev, { role: 'child', text: query }]);

    try {
      const res = await fetch('/api/guardian/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: query }),
      });

      if (res.ok) {
        const data: GuardianCompanionResponse = await res.json();
        setGuardianHistory((prev) => [
          ...prev,
          {
            role: 'companion',
            text: data.response,
            category: data.category,
            data,
          },
        ]);
        speakText(data.response, 0.95);
        fetchGuardianHistory();
      } else {
        setGuardianHistory((prev) => [
          ...prev,
          {
            role: 'companion',
            text: 'I am here with you, but I had trouble reaching the Gemini service. If you need help with anything, asking a parent or teacher is always a great choice!',
            category: 'GENERAL_COMPANION',
          },
        ]);
      }
    } catch {
      setGuardianHistory((prev) => [
        ...prev,
        {
          role: 'companion',
          text: 'Could not connect to the companion service right now. Please check your network connection.',
          category: 'GENERAL_COMPANION',
        },
      ]);
    } finally {
      setGuardianLoading(false);
    }
  };

  // 2. Request Safety Guidance from Gemini
  const handleGetSafetyGuidance = async (situationText?: string) => {
    const sit = situationText || selectedSituation;
    setSafetyGuidanceLoading(true);
    setGuidanceResult(null);

    try {
      const res = await fetch('/api/guardian/safety-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation: sit }),
      });

      if (res.ok) {
        const data: GuardianSafetyGuidanceResponse = await res.json();
        setGuidanceResult(data);
        fetchGuardianHistory();
        speakText(`${data.reassurance} ${data.guidanceSteps.join('. ')}`);
      }
    } catch {
      // Fallback
    } finally {
      setSafetyGuidanceLoading(false);
    }
  };

  // 3. Obstacle Awareness Scenario Switcher
  const handleSelectObstacleScenario = (scenario: 'toy' | 'open' | 'chair') => {
    setSelectedObstacleScenario(scenario);
    if (scenario === 'toy') setObstacleDistanceCm(12);
    else if (scenario === 'open') setObstacleDistanceCm(85);
    else setObstacleDistanceCm(18);
  };

  // 4. Run Guardian Vision Analysis
  const handleAnalyzeGuardianVision = async () => {
    setIsAnalyzingGuardianVision(true);
    setGuardianVisionResult(null);

    let imageBase64: string | undefined = undefined;
    let imageId: string | undefined = undefined;

    if (guardianImageSource === 'upload' && guardianUploadedBase64) {
      imageBase64 = guardianUploadedBase64;
    } else if (guardianSelectedImageId) {
      imageId = guardianSelectedImageId;
    } else if (images.length > 0) {
      imageId = images[0].imageId;
    }

    try {
      const res = await fetch('/api/guardian/vision-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          imageId,
          question: guardianVisualQuestion,
        }),
      });

      if (res.ok) {
        const data: GuardianVisionAnalysisResponse = await res.json();
        setGuardianVisionResult(data);
        fetchGuardianHistory();
        speakText(`Room observation: ${data.sceneDescription}`);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsAnalyzingGuardianVision(false);
    }
  };

  // 5. Draft Guardian Assistance Request
  const handleDraftGuardianAssistance = async () => {
    setIsDraftingGuardianAssistance(true);
    setGuardianAssistanceDraft(null);

    try {
      const res = await fetch('/api/guardian/assistance-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: childAssistanceReason,
          notes: childAssistanceNotes,
          roomLocation: childAssistanceLocation,
        }),
      });

      if (res.ok) {
        const data: GuardianAssistanceRequest = await res.json();
        setGuardianAssistanceDraft(data);
        fetchGuardianHistory();
        speakText(`Message prepared for your caregiver: ${data.preparedAlertMessage}`);
      }
    } catch {
      // Fallback
    } finally {
      setIsDraftingGuardianAssistance(false);
    }
  };

  const handleCopyGuardianMessage = () => {
    if (!guardianAssistanceDraft) return;
    navigator.clipboard.writeText(guardianAssistanceDraft.preparedAlertMessage);
    setGuardianCopiedNotice(true);
    setTimeout(() => setGuardianCopiedNotice(false), 3000);
  };

  // ==========================================
  // PROTECTION MODE HANDLERS
  // ==========================================

  // 1. Protection Image Upload & Validation Handler
  const handleProtectionFileSelect = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProtectionError('Unsupported file type. Please upload a valid photographic image (JPEG, PNG, or WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setProtectionError('Image file exceeds 8 MB. Please select a smaller photo captured from the robot camera.');
      return;
    }

    setProtectionError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setProtectionUploadedBase64(reader.result as string);
      setProtectionUploadedFilename(file.name);
      setProtectionImageSource('upload');
      setProtectionAnalysis(null);
      setProtectionFollowUpHistory([]);
    };
    reader.onerror = () => {
      setProtectionError('Failed to read the image file from local storage.');
    };
    reader.readAsDataURL(file);
  };

  // 2. Run Protection AI Visual Safety Analysis with Gemini
  const handleRunProtectionAnalysis = async (focusToUse?: string) => {
    const focus = focusToUse || protectionUserFocus;
    let imageBase64: string | undefined = undefined;
    let imageId: string | undefined = undefined;

    if (protectionImageSource === 'upload' && protectionUploadedBase64) {
      imageBase64 = protectionUploadedBase64;
    } else if (protectionSelectedImageId) {
      imageId = protectionSelectedImageId;
    } else if (images.length > 0) {
      imageId = images[0].imageId;
    }

    if (!imageBase64 && !imageId) {
      setProtectionError('No photograph selected. Please upload a photo captured from the robot camera or select an existing frame.');
      return;
    }

    setIsAnalyzingProtection(true);
    setProtectionError(null);

    try {
      const res = await fetch('/api/protection/vision-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          imageId,
          userFocus: focus,
          robotId: status?.robotId || 'SR-01',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProtectionAnalysis(data.analysis);
        fetchProtectionHistory();
        speakText(`Visual safety assessment completed. Result: ${data.analysis.assessmentCategory}. ${data.analysis.categoryRationale}`);
      } else {
        const errData = await res.json().catch(() => null);
        setProtectionError(errData?.message || 'Gemini visual analysis failed to process this image. Please check image clarity and try again.');
      }
    } catch {
      setProtectionError('Network error while reaching the visual analysis engine. Please verify your connection.');
    } finally {
      setIsAnalyzingProtection(false);
    }
  };

  // 3. Ask Contextual Follow-Up Question about the Analyzed Image
  const handleAskProtectionFollowUp = async (questionToSend?: string) => {
    const query = (questionToSend || protectionFollowUpQuestion).trim();
    if (!query) return;

    let imageBase64: string | undefined = undefined;
    let imageId: string | undefined = undefined;

    if (protectionImageSource === 'upload' && protectionUploadedBase64) {
      imageBase64 = protectionUploadedBase64;
    } else if (protectionSelectedImageId) {
      imageId = protectionSelectedImageId;
    } else if (images.length > 0) {
      imageId = images[0].imageId;
    }

    if (!imageBase64 && !imageId) {
      setProtectionError('Image context is missing for follow-up questions.');
      return;
    }

    setIsAskingProtectionFollowUp(true);
    setProtectionFollowUpQuestion('');
    setProtectionFollowUpHistory((prev) => [...prev, { role: 'user', text: query }]);

    try {
      const res = await fetch('/api/protection/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          imageId,
          previousAnalysis: protectionAnalysis,
          question: query,
          robotId: status?.robotId || 'SR-01',
        }),
      });

      if (res.ok) {
        const data: ProtectionFollowUpResponse = await res.json();
        setProtectionFollowUpHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.answer,
            safetyAdvice: data.safetyAdvice,
          },
        ]);
        speakText(data.answer);
      } else {
        setProtectionFollowUpHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'Unable to process follow-up question with Gemini at this time. Please try again.',
          },
        ]);
      }
    } catch {
      setProtectionFollowUpHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Network issue while transmitting follow-up question.',
        },
      ]);
    } finally {
      setIsAskingProtectionFollowUp(false);
    }
  };

  // Safe Robot Command Dispatch (Speed 1 for Safety in Helper/Guardian)
  const handleSafeRobotExecution = (command: RobotCommandType, servoAngle: number = 90) => {
    if (!onExecuteCommand) return;
    onExecuteCommand(command, { speed: 1, servo: servoAngle, source: 'AI_NATURAL_LANGUAGE' });
    setHardwareActionNotice(`Safety Crawl (${command} @ Speed Level 1) dispatched to physical robot.`);
    setTimeout(() => setHardwareActionNotice(null), 4000);
  };

  // Browser Speech Recognition toggle
  const toggleSpeechRecognition = (isGuardian: boolean = false) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechNotice('Speech recognition is not supported in this browser. Please use keyboard text entry or click any prompt.');
      setTimeout(() => setSpeechNotice(null), 6000);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechNotice('Browser microphone listening... Speak clearly now.');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        setSpeechNotice(null);
        if (isGuardian) {
          handleAskGuardianCompanion(transcript);
        } else {
          handleAskAssistant(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechNotice('Microphone access was denied or audio could not be heard.');
        setTimeout(() => setSpeechNotice(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechNotice('Unable to initialize browser speech recognition.');
    }
  };

  // Helper text size CSS classes
  const getTextClass = () => {
    if (textSize === 'extralarge') return 'text-lg leading-relaxed';
    if (textSize === 'large') return 'text-sm sm:text-base leading-relaxed';
    return 'text-xs sm:text-sm leading-normal';
  };

  return (
    <div className={`space-y-6 ${highContrast ? 'contrast-125 brightness-110' : ''}`}>
      {/* Top Banner: Mode Identity & Navigation Toolbar */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold tracking-wide uppercase">
              <Shield className="w-4 h-4" />
              <span>Smart Rakshak — Operating Modes Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>{selectedMode === 'HELPER' ? 'Helper Mode' : selectedMode === 'GUARDIAN' ? 'Guardian Mode' : 'Protection Mode'}</span>
              <span className={`text-xs px-2.5 py-1 rounded-lg font-mono border ${
                selectedMode === 'HELPER'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : selectedMode === 'GUARDIAN'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                ACTIVE WORKSPACE
              </span>
            </h1>
            <p className="text-slate-300 max-w-2xl text-xs sm:text-sm leading-relaxed">
              {selectedMode === 'HELPER'
                ? 'Dedicated accessibility interface for elderly individuals and people with disabilities. Delivers conversational AI assistance, safe physical robot guidance, smart-home appliance control, and verified caregiver support.'
                : selectedMode === 'GUARDIAN'
                ? 'Designed for children. Provides a child-friendly AI companion, age-appropriate safety guidance, obstacle awareness, assistance requests, and caregiver support.'
                : 'Supports home safety awareness through camera photograph upload, Gemini-powered visual hazard analysis, walkway obstruction checks, and proportionate recommendations.'}
            </p>
          </div>

          {/* Quick Accessibility Controls & Voice Readout Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 shrink-0">
            {/* Speed Governor Status */}
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-800/80 text-[11px] text-emerald-300 flex items-center gap-1.5 font-mono">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Speed: <strong>Crawl (1)</strong></span>
            </div>

            {/* Read Aloud / Stop Audio */}
            {isSpeaking ? (
              <button
                onClick={stopSpeaking}
                className="cursor-pointer px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all animate-pulse"
                title="Stop Speech Output"
              >
                <VolumeX className="w-4 h-4" />
                <span>Stop Voice</span>
              </button>
            ) : (
              <button
                onClick={() =>
                  speakText(
                    selectedMode === 'PROTECTION'
                      ? 'Smart Rakshak Protection Mode is active. Upload a camera photo for Gemini-powered visual hazard analysis and home safety inspection.'
                      : selectedMode === 'GUARDIAN'
                      ? 'Smart Rakshak Guardian Mode is active. I am here to help you learn, explore safely, and stay connected with parents.'
                      : 'Smart Rakshak Helper Mode is active. Safe crawl speed level 1 is locked.'
                  )
                }
                className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Read Screen Summary Aloud"
              >
                <Volume2 className="w-4 h-4 text-sky-400" />
                <span>Read Aloud</span>
              </button>
            )}

            {/* High Contrast Toggle */}
            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                highContrast
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              High Contrast
            </button>

            {/* Text Size Switcher */}
            <button
              onClick={() => {
                if (textSize === 'normal') setTextSize('large');
                else if (textSize === 'large') setTextSize('extralarge');
                else setTextSize('normal');
              }}
              className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold"
            >
              Text Size: <strong className="text-amber-400">{textSize === 'extralarge' ? 'A++' : textSize === 'large' ? 'A+' : 'A'}</strong>
            </button>

            {/* Safety Halt Button */}
            <button
              onClick={() => handleSafeRobotExecution('STOP')}
              className="cursor-pointer px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Halt Robot</span>
            </button>
          </div>
        </div>

        {/* Operating Modes Switcher Tabs (3 Modes for the same physical robot) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-6 pt-5 border-t border-slate-800">
          <button
            onClick={() => setSelectedMode('HELPER')}
            className={`cursor-pointer p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
              selectedMode === 'HELPER'
                ? 'bg-emerald-950/50 border-emerald-500/60 ring-2 ring-emerald-500/30'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>1. Helper Mode</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">ACTIVE WORKSPACE</span>
                </div>
                <div className="text-[11px] text-slate-400">Elderly & Accessibility Assistant</div>
              </div>
            </div>
            {selectedMode === 'HELPER' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={() => setSelectedMode('GUARDIAN')}
            className={`cursor-pointer p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
              selectedMode === 'GUARDIAN'
                ? 'bg-sky-950/50 border-sky-500/60 ring-2 ring-sky-500/30'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center font-bold">
                <Baby className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>2. Guardian Mode</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">ACTIVE WORKSPACE</span>
                </div>
                <div className="text-[11px] text-slate-400">Child Safety & Companion</div>
              </div>
            </div>
            {selectedMode === 'GUARDIAN' ? <CheckCircle2 className="w-4 h-4 text-sky-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={() => setSelectedMode('PROTECTION')}
            className={`cursor-pointer p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
              selectedMode === 'PROTECTION'
                ? 'bg-amber-950/50 border-amber-500/60 ring-2 ring-amber-500/30'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>3. Protection Mode</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">ACTIVE WORKSPACE</span>
                </div>
                <div className="text-[11px] text-slate-400">Home Safety & Hazard Awareness</div>
              </div>
            </div>
            {selectedMode === 'PROTECTION' ? <CheckCircle2 className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Dispatched Notification Toasts */}
      {hardwareActionNotice && (
        <div className="p-3.5 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{hardwareActionNotice}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">SAFETY SPEED LOCK 1 ACTIVE</span>
        </div>
      )}

      {deviceActionNotice && (
        <div className="p-3.5 bg-sky-950/90 border border-sky-500/60 rounded-xl text-sky-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{deviceActionNotice}</span>
          </div>
          <span className="text-[10px] font-mono text-sky-400">SIMULATED ACTION</span>
        </div>
      )}

      {speechNotice && (
        <div className="p-3 bg-amber-950/90 border border-amber-500/60 rounded-xl text-amber-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{speechNotice}</span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. GUARDIAN MODE DETAILED FUNCTIONAL WORKSPACE (ACTIVE) */}
      {/* ========================================================= */}
      {selectedMode === 'GUARDIAN' && (
        <div className="space-y-6 animate-fadeIn">
          {/* SECTION 0: GUARDIAN ROBOT TELEMETRY & SAFE CONTROL CENTRAL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Baby className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Guardian Mode — Child Safety Companion</span>
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  </h2>
                  <p className="text-xs text-slate-400">
                    Child-safe speed governor active · Ultrasonic obstacle avoidance engaged
                  </p>
                </div>
              </div>

              {/* Hardware Telemetry Indicators */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  {status?.batteryLevel && status.batteryLevel < 30 ? (
                    <Battery className="w-4 h-4 text-rose-400" />
                  ) : (
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Battery: <strong>{status?.batteryLevel ?? 84}%</strong></span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  <Wifi className="w-4 h-4 text-sky-400" />
                  <span>Link: <strong>{config.controlMode} ({config.localIpAddress})</strong></span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Obstacle Avoidance: <strong>Working Locally</strong></span>
                </div>
              </div>
            </div>

            {/* Tactile Safe Movement Pad */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-7 space-y-3">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Safe Physical Navigation (Speed Level 1 Crawl):</span>
                  <span className="text-[11px] text-sky-400 font-mono">CHILD SAFETY GOVERNOR</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto sm:mx-0">
                  <div />
                  <button
                    onClick={() => handleSafeRobotExecution('FORWARD')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-sky-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Move forward safely"
                  >
                    <ArrowUp className="w-5 h-5 text-sky-400" />
                    <span className="text-xs">Forward</span>
                  </button>
                  <div />

                  <button
                    onClick={() => handleSafeRobotExecution('LEFT')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-sky-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Turn left gently"
                  >
                    <ArrowLeft className="w-5 h-5 text-sky-400" />
                    <span className="text-xs">Left</span>
                  </button>

                  <button
                    onClick={() => handleSafeRobotExecution('STOP')}
                    className="cursor-pointer p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-lg active:scale-95"
                    title="Halt motors immediately"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span className="text-xs">STOP</span>
                  </button>

                  <button
                    onClick={() => handleSafeRobotExecution('RIGHT')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-sky-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Turn right gently"
                  >
                    <ArrowRight className="w-5 h-5 text-sky-400" />
                    <span className="text-xs">Right</span>
                  </button>

                  <div />
                  <button
                    onClick={() => handleSafeRobotExecution('BACKWARD')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-sky-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Move backward safely"
                  >
                    <ArrowDown className="w-5 h-5 text-sky-400" />
                    <span className="text-xs">Reverse</span>
                  </button>
                  <div />
                </div>
              </div>

              {/* Camera Look Angles & Snapshot */}
              <div className="md:col-span-5 space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300">Look Around & Friendly Headlight:</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 45)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Look Left</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 90)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Look Front</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 135)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Look Right</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSafeRobotExecution('CAMERA_LED_ON')}
                    className="cursor-pointer flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Turn On Night Light</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('CAMERA_LED_OFF')}
                    className="cursor-pointer flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>Light Off</span>
                  </button>
                </div>

                {onTriggerCapture && (
                  <button
                    onClick={onTriggerCapture}
                    className="cursor-pointer w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Robot Camera Snapshot</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MAIN GUARDIAN 2-COLUMN WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): AI Companion & Child Safety Guidance */}
            <div className="lg:col-span-7 space-y-6">
              {/* CAPABILITY 1: CHILD-FRIENDLY AI COMPANION */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Smile className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                        <span>1. Child-Friendly AI Companion</span>
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Interactive Gemini companion answering questions in warm, child-friendly words
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                    GEMINI 3.8 FLASH
                  </span>
                </div>

                {/* Example Child Questions Chips */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>Try asking the companion (Click to ask):</span>
                    <span className="text-[10px] text-slate-500">Fun & Safe Questions</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Can you tell me an interesting science fact?',
                      'How can I stay safe at home?',
                      'What should I do if I cannot find my parents?',
                      'Something is blocking my way. What should I do?',
                      'I need help from an adult.',
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAskGuardianCompanion(chip)}
                        disabled={guardianLoading}
                        className="cursor-pointer text-xs px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all text-left flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />
                        <span>{chip}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Companion Chat Stream */}
                <div className="h-64 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
                  {guardianHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${item.role === 'child' ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                        <span>{item.role === 'child' ? 'You' : 'Smart Rakshak Companion'}</span>
                        {item.category && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-sky-400">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div
                        className={`p-3.5 rounded-xl max-w-xl leading-relaxed ${
                          item.role === 'child'
                            ? 'bg-sky-500/20 border border-sky-500/40 text-sky-100 rounded-tr-none'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                        } ${getTextClass()}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>{item.text}</div>
                          {item.role === 'companion' && (
                            <button
                              onClick={() => speakText(item.text, 0.95)}
                              className="cursor-pointer p-1 text-slate-400 hover:text-sky-400 transition-colors shrink-0"
                              title="Listen to this message"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Recommended Next Step */}
                        {item.data?.recommendedNextStep && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800 text-xs text-sky-300">
                            <strong>Friendly Tip: </strong>{item.data.recommendedNextStep}
                          </div>
                        )}

                        {/* Adult Contact Encouragement Banner */}
                        {item.data?.encourageAdultContact && (
                          <div className="mt-2.5 p-2.5 bg-amber-950/60 border border-amber-800/80 rounded-lg text-amber-200 text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>{item.data.adultContactReason || 'Checking with a parent or trusted adult is recommended.'}</span>
                            </div>
                            <button
                              onClick={() => {
                                setChildAssistanceReason(item.text);
                                handleDraftGuardianAssistance();
                              }}
                              className="cursor-pointer px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0"
                            >
                              Ask Adult
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {guardianLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic py-2">
                      <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
                      <span>Smart Rakshak is preparing a friendly answer with Gemini...</span>
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={guardianPrompt}
                      onChange={(e) => setGuardianPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskGuardianCompanion()}
                      placeholder="Ask anything (e.g. 'Tell me about dinosaurs', 'What should I do if I feel scared?')..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs sm:text-sm"
                    />

                    {/* Microphone Button */}
                    <button
                      onClick={() => toggleSpeechRecognition(true)}
                      title={speechSupported ? 'Speak via browser microphone' : 'Browser speech recognition not supported'}
                      className={`cursor-pointer p-2.5 rounded-xl border transition-all ${
                        isListening
                          ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-sky-400" />}
                    </button>

                    {/* Send Button */}
                    <button
                      onClick={() => handleAskGuardianCompanion()}
                      disabled={guardianLoading || !guardianPrompt.trim()}
                      className="cursor-pointer px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Ask</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${speechSupported ? 'bg-sky-400' : 'bg-slate-600'}`} />
                      {speechSupported ? 'Browser Web Speech API: Ready' : 'Speech Input: Keyboard entry active'}
                    </span>
                    <span>Safety Watchdog: Active</span>
                  </div>
                </div>
              </div>

              {/* CAPABILITY 2: CHILD SAFETY GUIDANCE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base">
                        2. Child Safety Guidance
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Calm, reassuring, age-appropriate guidance for common home situations
                      </p>
                    </div>
                  </div>
                </div>

                {/* Situation Selector Grid */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">
                    Select a Situation for Guidance:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'An unfamiliar person is at the door.',
                      'I cannot find my parent or caregiver.',
                      'I see something potentially dangerous.',
                      'Something is blocking my path.',
                      'I need help but do not know what to do.',
                      'I feel unsafe at home.',
                    ].map((sit, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => {
                          setSelectedSituation(sit);
                          handleGetSafetyGuidance(sit);
                        }}
                        className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-2 ${
                          selectedSituation === sit
                            ? 'bg-sky-950/60 border-sky-500/70 text-sky-100 font-semibold shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <HelpCircle className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                        <span>{sit}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {safetyGuidanceLoading && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2 text-xs text-slate-400 italic">
                    <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
                    <span>Gemini is generating calm, age-appropriate safety steps...</span>
                  </div>
                )}

                {/* Safety Guidance Result */}
                {guidanceResult && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-sky-900/60 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-sky-400" />
                        <span>Guidance for: "{guidanceResult.situation}"</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{guidanceResult.sourceEngine}</span>
                    </div>

                    <p className="text-xs text-slate-200 italic leading-relaxed">
                      "{guidanceResult.reassurance}"
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                        What to do right now:
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-slate-200 text-xs">
                        {guidanceResult.guidanceSteps.map((step, idx) => (
                          <li key={idx} className="leading-relaxed">{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs text-amber-200">
                      <strong>Important Safety Rule: </strong>{guidanceResult.cautionAdvice}
                    </div>

                    {guidanceResult.mustContactAdultImmediately && (
                      <div className="p-3 bg-amber-950/70 border border-amber-800 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-200">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Please tell your parent or trusted adult about this right away!</span>
                        </div>
                        <button
                          onClick={() => {
                            setChildAssistanceReason(guidanceResult.situation);
                            handleDraftGuardianAssistance();
                          }}
                          className="cursor-pointer px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0"
                        >
                          Notify Adult
                        </button>
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div className="text-[10px] text-slate-500 leading-relaxed pt-1">
                      Notice: Smart Rakshak is an assistant companion and does not replace parents, guardians, or 911 emergency services.
                    </div>
                  </div>
                )}
              </div>

              {/* CAPABILITY 3: OBSTACLE AWARENESS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base">
                        3. Robot Obstacle Awareness
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Frontal ultrasonic distance sensing and automatic avoidance
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[11px] font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Robot obstacle avoidance: Working locally.</span>
                  </div>
                </div>

                {/* Explanation of Local Avoidance */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5">
                  <p>
                    The physical robot features a hardware ultrasonic echo sensor that emits high-frequency sound pulses to measure forward distance (2 cm – 300 cm).
                    When an obstacle is detected within <strong>20 cm</strong>, the local firmware automatically halts the motors, sounds an alert tone, reverses 10 cm, and scans left/right to pivot toward a clear opening.
                  </p>
                </div>

                {/* Interactive Obstacle Scenarios */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>Demonstration Scenarios (Labelled Simulation Lab):</span>
                    <span className="text-[10px] text-slate-500">Test Robot Reaction</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSelectObstacleScenario('toy')}
                      className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                        selectedObstacleScenario === 'toy'
                          ? 'bg-amber-950/60 border-amber-500 text-amber-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <div className="font-bold">Toy in Pathway</div>
                      <div className="text-[10px] text-slate-400 font-mono">12 cm (Avoidance Triggered)</div>
                    </button>

                    <button
                      onClick={() => handleSelectObstacleScenario('open')}
                      className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                        selectedObstacleScenario === 'open'
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <div className="font-bold">Clear Playroom Hall</div>
                      <div className="text-[10px] text-slate-400 font-mono">85 cm (Path Clear)</div>
                    </button>

                    <button
                      onClick={() => handleSelectObstacleScenario('chair')}
                      className={`cursor-pointer p-3 rounded-xl border text-left text-xs transition-all ${
                        selectedObstacleScenario === 'chair'
                          ? 'bg-sky-950/60 border-sky-500 text-sky-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <div className="font-bold">Chair Leg at Door</div>
                      <div className="text-[10px] text-slate-400 font-mono">18 cm (Caution Pivot)</div>
                    </button>
                  </div>
                </div>

                {/* Distance Slider Demonstration */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                      <span>Forward Distance Reading:</span>
                    </span>
                    <span className={`font-mono font-bold text-sm ${
                      obstacleDistanceCm < 20 ? 'text-rose-400' : obstacleDistanceCm < 40 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {obstacleDistanceCm} cm
                    </span>
                  </div>

                  <input
                    type="range"
                    min="5"
                    max="120"
                    value={obstacleDistanceCm}
                    onChange={(e) => setObstacleDistanceCm(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />

                  {/* Reaction Status */}
                  <div className="p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all bg-slate-900 border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        obstacleDistanceCm < 20 ? 'bg-rose-500 animate-ping' : obstacleDistanceCm < 40 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <span className="text-slate-200">
                        {obstacleDistanceCm < 20
                          ? 'OBSTACLE DETECTED: Motors automatically stop, sound warning chime, and reverse 10cm.'
                          : obstacleDistanceCm < 40
                          ? 'CAUTION PROXIMITY: Slow crawl speed active; optical scan active.'
                          : 'CLEAR PATH: Safe to advance at gentle crawl speed.'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">DEMO LAB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Camera Safety, Request Assistance, Caregiver Support */}
            <div className="lg:col-span-5 space-y-6">
              {/* CAPABILITY 4: CAMERA-BASED SAFETY AWARENESS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base">
                        4. Camera Safety Inspection
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Gemini vision inspection for floor clutter, toys, and walkway clearance
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                    GEMINI VISION
                  </span>
                </div>

                {/* Image Source Selector */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGuardianImageSource('camera')}
                      className={`cursor-pointer flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                        guardianImageSource === 'camera'
                          ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Robot Camera Frame</span>
                    </button>

                    <button
                      onClick={() => {
                        setGuardianImageSource('upload');
                        guardianFileInputRef.current?.click();
                      }}
                      className={`cursor-pointer flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                        guardianImageSource === 'upload'
                          ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Local Photo</span>
                    </button>
                    <input
                      ref={guardianFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setGuardianUploadedBase64(reader.result as string);
                            setGuardianImageSource('upload');
                            setGuardianVisionResult(null);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* Preview Window */}
                  <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                    {guardianImageSource === 'upload' && guardianUploadedBase64 ? (
                      <img
                        src={guardianUploadedBase64}
                        alt="Uploaded for analysis"
                        className="w-full h-full object-contain"
                      />
                    ) : images.length > 0 ? (
                      <img
                        src={images.find((i) => i.imageId === guardianSelectedImageId)?.url || images[0].url}
                        alt="Robot camera capture"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-slate-500 text-xs p-4 space-y-1">
                        <ImageIcon className="w-6 h-6 mx-auto text-slate-600" />
                        <span>No image selected. Upload a photo or capture via robot camera.</span>
                      </div>
                    )}

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-300">
                      {guardianImageSource === 'upload' ? 'LOCAL UPLOAD' : 'STATIC CAMERA FRAME'}
                    </div>
                  </div>

                  {/* Preset Child Questions */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Safety Question for Gemini:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Check the room and walkway for toys, obstacles, or safety concerns.',
                        'Are there any tripping hazards or loose objects on the floor?',
                        'Is the walking path clear?',
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => setGuardianVisualQuestion(preset)}
                          className={`cursor-pointer text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                            guardianVisualQuestion === preset
                              ? 'bg-sky-500/20 text-sky-200 border-sky-500/40 font-semibold'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={guardianVisualQuestion}
                      onChange={(e) => setGuardianVisualQuestion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 mt-1"
                    />
                  </div>

                  {/* Analyze Button */}
                  <button
                    onClick={handleAnalyzeGuardianVision}
                    disabled={isAnalyzingGuardianVision}
                    className="cursor-pointer w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    {isAnalyzingGuardianVision ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Inspecting Image with Gemini Vision...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Inspect Image with Gemini Vision</span>
                      </>
                    )}
                  </button>

                  {/* Analysis Result Card */}
                  {guardianVisionResult && (
                    <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 text-xs animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="font-bold text-sky-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-sky-400" />
                          Observations & Clutter Check
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => speakText(guardianVisionResult.sceneDescription)}
                            className="p-1 text-slate-400 hover:text-sky-400"
                            title="Read aloud"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono text-slate-400">{guardianVisionResult.sourceEngine}</span>
                        </div>
                      </div>

                      <p className="text-slate-200 text-xs leading-relaxed">
                        {guardianVisionResult.sceneDescription}
                      </p>

                      {/* Visible Items */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Items Noticed:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {guardianVisionResult.visibleObservations.map((obs, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300"
                            >
                              {obs}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Potential Concerns */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Safety Items to Watch:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200">
                          {guardianVisionResult.potentialConcerns.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Recommended Steps */}
                      <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                        <span className="font-bold text-slate-200">Helpful Next Step: </span>
                        {guardianVisionResult.recommendedNextSteps}
                      </div>

                      {/* Limitations */}
                      <div className="p-2 bg-rose-950/30 border border-rose-900/50 rounded-lg text-[10px] text-rose-300 leading-relaxed">
                        <strong>Notice: </strong>{guardianVisionResult.analysisLimitations}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CAPABILITY 5: REQUEST ASSISTANCE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base">
                        5. Request Assistance
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Help children prepare clear, calm messages for parents or caregivers
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Selectable Request Buttons */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Select Request:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        'I need help.',
                        'I cannot find my caregiver.',
                        'Something is worrying me.',
                        'Please help me contact a trusted adult.',
                      ].map((req, rIdx) => (
                        <button
                          key={rIdx}
                          onClick={() => setChildAssistanceReason(req)}
                          className={`cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left border transition-all ${
                            childAssistanceReason === req
                              ? 'bg-rose-950 border-rose-500 text-rose-200'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {req}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Room Location & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">
                        Room Location:
                      </label>
                      <input
                        type="text"
                        value={childAssistanceLocation}
                        onChange={(e) => setChildAssistanceLocation(e.target.value)}
                        placeholder="e.g. Playroom, Bedroom"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">
                        Extra Note:
                      </label>
                      <input
                        type="text"
                        value={childAssistanceNotes}
                        onChange={(e) => setChildAssistanceNotes(e.target.value)}
                        placeholder="e.g. In living room"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Prepare Message Button */}
                  <button
                    onClick={handleDraftGuardianAssistance}
                    disabled={isDraftingGuardianAssistance}
                    className="cursor-pointer w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    {isDraftingGuardianAssistance ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Formulating Message with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Prepare Message for Adult</span>
                      </>
                    )}
                  </button>

                  {/* Prepared Assistance Card */}
                  {guardianAssistanceDraft && (
                    <div className="p-3.5 bg-slate-950 rounded-xl border border-rose-900/60 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-rose-400" />
                          Prepared Assistance Message
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          guardianAssistanceDraft.urgency === 'IMMEDIATE'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {guardianAssistanceDraft.urgency}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-slate-100 leading-relaxed select-all">
                        {guardianAssistanceDraft.preparedAlertMessage}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">Action for Parent: </span>
                        {guardianAssistanceDraft.recommendedAction}
                      </div>

                      {/* Copy & Share Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={handleCopyGuardianMessage}
                          className="cursor-pointer flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          {guardianCopiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{guardianCopiedNotice ? 'Copied to Clipboard!' : 'Copy Message'}</span>
                        </button>

                        <a
                          href={`mailto:?subject=${encodeURIComponent(`[Smart Rakshak Guardian] Child Assistance Request`)}&body=${encodeURIComponent(guardianAssistanceDraft.preparedAlertMessage)}`}
                          className="cursor-pointer py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </a>
                      </div>

                      {/* Delivery Status Indicator */}
                      <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-[10px] text-slate-400 space-y-1">
                        <div className="font-bold text-slate-300 uppercase tracking-wide">
                          Delivery Status:
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Message Formulated & Saved to History</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Info className="w-3 h-3 text-amber-400" />
                          <span>Cellular SMS gateway not connected — use Copy above to text message parent.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CAPABILITY 6: CAREGIVER SUPPORT & SAFETY EVENTS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-sky-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    6. Caregiver Support & Safety Events Log
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Audit log of child interactions, safety guidance questions, and assistance requests
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  guardianFirestorePersisted
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {guardianFirestorePersisted ? 'FIRESTORE CLOUD PERSISTED' : 'IN-MEMORY DEMO STORAGE'}
                </span>
                <button
                  onClick={fetchGuardianHistory}
                  disabled={guardianHistoryLoading}
                  className="cursor-pointer p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Refresh History"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${guardianHistoryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Events Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Event Summary</th>
                    <th className="py-2.5 px-3">Recommended Next Step</th>
                    <th className="py-2.5 px-3">Adult Alert</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {guardianEventsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                        No Guardian safety events recorded yet. Try asking the companion or requesting guidance above.
                      </td>
                    </tr>
                  ) : (
                    guardianEventsList.map((evt) => (
                      <tr key={evt.eventId} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-sky-300">
                            {evt.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-sans max-w-xs truncate">
                          {evt.summary}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans max-w-xs truncate">
                          {evt.recommendedAction}
                        </td>
                        <td className="py-2.5 px-3">
                          {evt.adultNotified ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Adult Advised</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            evt.status === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : evt.status === 'PREPARED_FOR_ADULT'
                              ? 'bg-sky-950 text-sky-400 border border-sky-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {evt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. HELPER MODE DETAILED FUNCTIONAL WORKSPACE (ACTIVE) */}
      {/* ========================================================= */}
      {selectedMode === 'HELPER' && (
        <div className="space-y-6">
          {/* SECTION 0: LIVE HARDWARE STATUS & ACCESSIBLE PILOT CONTROLS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Helper Robot Control Central</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </h2>
                  <p className="text-xs text-slate-400">
                    Physical robot direct link · Governed at safe crawl speed 1 for assisted mobility
                  </p>
                </div>
              </div>

              {/* Hardware Telemetry Pills */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  {status?.batteryLevel && status.batteryLevel < 30 ? (
                    <Battery className="w-4 h-4 text-rose-400" />
                  ) : (
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Battery: <strong>{status?.batteryLevel ?? 84}%</strong></span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  <Wifi className="w-4 h-4 text-sky-400" />
                  <span>Link: <strong>{config.controlMode} ({config.localIpAddress})</strong></span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Governor: <strong>Crawl (Level 1)</strong></span>
                </div>
              </div>
            </div>

            {/* Tactile Accessible Navigation Pad */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-7 space-y-3">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Accessible Movement Controls (Speed Level 1 Crawl):</span>
                  <span className="text-[11px] text-emerald-400 font-mono">GENTLE DRIVE</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto sm:mx-0">
                  <div />
                  <button
                    onClick={() => handleSafeRobotExecution('FORWARD')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Move forward at crawl speed 1"
                  >
                    <ArrowUp className="w-5 h-5 text-emerald-400 group-hover:text-white" />
                    <span className="text-xs">Forward</span>
                  </button>
                  <div />

                  <button
                    onClick={() => handleSafeRobotExecution('LEFT')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Turn left gently"
                  >
                    <ArrowLeft className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs">Left</span>
                  </button>

                  <button
                    onClick={() => handleSafeRobotExecution('STOP')}
                    className="cursor-pointer p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-lg active:scale-95"
                    title="Halt motors immediately"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span className="text-xs">STOP</span>
                  </button>

                  <button
                    onClick={() => handleSafeRobotExecution('RIGHT')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Turn right gently"
                  >
                    <ArrowRight className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs">Right</span>
                  </button>

                  <div />
                  <button
                    onClick={() => handleSafeRobotExecution('BACKWARD')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Move backward at crawl speed 1"
                  >
                    <ArrowDown className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs">Reverse</span>
                  </button>
                  <div />
                </div>
              </div>

              <div className="md:col-span-5 space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300">Camera Pan & Safety Headlight:</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 45)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Pan 45°</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 90)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Center 90°</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 135)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Pan 135°</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSafeRobotExecution('CAMERA_LED_ON')}
                    className="cursor-pointer flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Turn On Front LED</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('CAMERA_LED_OFF')}
                    className="cursor-pointer flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>LED Off</span>
                  </button>
                </div>

                {onTriggerCapture && (
                  <button
                    onClick={onTriggerCapture}
                    className="cursor-pointer w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Robot Camera Snapshot</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MAIN HELPER 2-COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-6">
              {/* CAPABILITY 1 & 2: AI Personal Assistant & Accessibility Shortcuts */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                        <span>1. AI Personal Assistant</span>
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Contextual conversational assistance with real Gemini intelligence
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                    GEMINI 3.8 FLASH
                  </span>
                </div>

                {/* Example Request Chips */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>Selectable Example Requests (1-Touch):</span>
                    <span className="text-[10px] text-slate-500">Accessible Prompt Library</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'I need some help.',
                      'I cannot reach the light switch.',
                      'Describe my surroundings.',
                      'I need to contact my caregiver.',
                      'Help me understand what is blocking my path.',
                      'Can you move forward slowly?',
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAskAssistant(chip)}
                        disabled={assistantLoading}
                        className="cursor-pointer text-xs px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all text-left flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{chip}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assistant Interactive Chat Stream */}
                <div className="h-64 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
                  {assistantHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                        <span>{item.role === 'user' ? 'You' : 'Rakshak Helper Assistant'}</span>
                        {item.category && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div
                        className={`p-3.5 rounded-xl max-w-xl leading-relaxed ${
                          item.role === 'user'
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-100 rounded-tr-none'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                        } ${getTextClass()}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>{item.text}</div>
                          {item.role === 'assistant' && (
                            <button
                              onClick={() => speakText(item.text)}
                              className="cursor-pointer p-1 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                              title="Listen to this message"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {item.data?.stepByStepGuidance && item.data.stepByStepGuidance.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                              Step-by-Step Guidance:
                            </div>
                            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-xs">
                              {item.data.stepByStepGuidance.map((step, sIdx) => (
                                <li key={sIdx}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {item.data?.caregiverAssistanceAppropriate && (
                          <div className="mt-2.5 p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-200 text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>Caregiver assistance recommended: {item.data.caregiverReason || 'Assistance requested'}</span>
                            </div>
                            <button
                              onClick={() => {
                                setCaregiverReason(item.text);
                                handleDraftCaregiverMessage();
                              }}
                              className="cursor-pointer px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0"
                            >
                              Draft Alert
                            </button>
                          </div>
                        )}

                        {item.data?.suggestedRobotCommand && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-400">Recommended Action: {item.data.suggestedRobotCommand}</span>
                            <button
                              onClick={() => handleSafeRobotExecution(item.data!.suggestedRobotCommand!)}
                              className="cursor-pointer px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Dispatch (Speed 1 Crawl)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {assistantLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic py-2">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                      <span>Gemini 3.8 Flash is preparing accessible guidance...</span>
                    </div>
                  )}
                </div>

                {/* Input & Voice Bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={assistantPrompt}
                      onChange={(e) => setAssistantPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAssistant()}
                      placeholder="Type any request (e.g. 'Turn on living room light', 'Move forward', 'Help me call caregiver')..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                    />

                    <button
                      onClick={() => toggleSpeechRecognition(false)}
                      title={speechSupported ? 'Speak via browser microphone' : 'Browser speech recognition not supported'}
                      className={`cursor-pointer p-2.5 rounded-xl border transition-all ${
                        isListening
                          ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    </button>

                    <button
                      onClick={() => handleAskAssistant()}
                      disabled={assistantLoading || !assistantPrompt.trim()}
                      className="cursor-pointer px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Ask</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${speechSupported ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {speechSupported ? 'Browser Web Speech API: Available' : 'Speech Input: Requires keyboard entry'}
                    </span>
                    <span>Safety Governor: Crawl 1 Locked</span>
                  </div>
                </div>
              </div>

              {/* SMART-HOME APPLIANCE ASSISTANCE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base">
                        Smart-Home Appliance Assistance
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Accessible control for room lights, cooling fans, and safety smart plugs
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 self-start sm:self-auto">
                    SIMULATED DEMONSTRATION
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <Info className="w-3.5 h-3.5 text-sky-400" />
                    <span>Integration Status Notice</span>
                  </div>
                  <p>
                    No physical smart home gateway (e.g. Matter / Home Assistant bridge) is connected.
                    All appliance actions below execute inside an interactive labelled simulated demonstration with live state tracking.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {smartDevices.map((dev) => (
                    <div
                      key={dev.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        dev.isOn
                          ? 'bg-sky-950/40 border-sky-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${dev.isOn ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                            {dev.type === 'LIGHT' && <Lightbulb className="w-4 h-4" />}
                            {dev.type === 'FAN' && <Wind className="w-4 h-4" />}
                            {dev.type === 'PLUG' && <Power className="w-4 h-4" />}
                            {dev.type === 'HEATER' && <Zap className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{dev.name}</div>
                            <div className="text-[10px] text-slate-400">{dev.location}</div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          dev.isOn ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-slate-900 text-slate-500'
                        }`}>
                          {dev.isOn ? 'ACTIVE' : 'OFF'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-slate-400">
                          {dev.isOn ? `${dev.powerWatts} Watts` : '0 Watts'}
                        </span>

                        <button
                          onClick={() => handleToggleDevice(dev.id)}
                          className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            dev.isOn
                              ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
                              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                          }`}
                        >
                          {dev.isOn ? 'Turn OFF' : 'Turn ON'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Visual Assistance & Caregiver Assistance */}
            <div className="lg:col-span-5 space-y-6">
              {/* HELPER VISUAL ASSISTANCE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base">
                        Visual Environment Assistance
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Multimodal Gemini vision analysis for surroundings & obstacles
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300">
                    GEMINI 3.8 FLASH
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedImageSource('camera')}
                      className={`cursor-pointer flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                        selectedImageSource === 'camera'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Robot Camera Frame</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedImageSource('upload');
                        fileInputRef.current?.click();
                      }}
                      className={`cursor-pointer flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                        selectedImageSource === 'upload'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Local Photo</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setUploadedImageBase64(reader.result as string);
                            setSelectedImageSource('upload');
                            setVisionResult(null);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </div>

                  <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                    {selectedImageSource === 'upload' && uploadedImageBase64 ? (
                      <img
                        src={uploadedImageBase64}
                        alt="Uploaded for analysis"
                        className="w-full h-full object-contain"
                      />
                    ) : images.length > 0 ? (
                      <img
                        src={images.find((i) => i.imageId === selectedImageId)?.url || images[0].url}
                        alt="Robot camera capture"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-slate-500 text-xs p-4 space-y-1">
                        <ImageIcon className="w-6 h-6 mx-auto text-slate-600" />
                        <span>No image selected. Upload a photo or capture via robot camera.</span>
                      </div>
                    )}

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-300">
                      {selectedImageSource === 'upload' ? 'LOCAL UPLOAD' : 'STATIC CAMERA FRAME'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Question for Gemini Vision:
                    </label>
                    <input
                      type="text"
                      value={visualQuestion}
                      onChange={(e) => setVisualQuestion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    onClick={async () => {
                      setIsAnalyzingVision(true);
                      setVisionResult(null);
                      let imageBase64: string | undefined = undefined;
                      let imageId: string | undefined = undefined;
                      if (selectedImageSource === 'upload' && uploadedImageBase64) imageBase64 = uploadedImageBase64;
                      else if (selectedImageId) imageId = selectedImageId;
                      else if (images.length > 0) imageId = images[0].imageId;

                      try {
                        const res = await fetch('/api/helper/vision-analyze', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ imageBase64, imageId, question: visualQuestion }),
                        });
                        if (res.ok) {
                          const data: HelperVisionAnalysisResponse = await res.json();
                          setVisionResult(data);
                          fetchHistory();
                          speakText(`Visual report: ${data.sceneDescription}`);
                        }
                      } finally {
                        setIsAnalyzingVision(false);
                      }
                    }}
                    disabled={isAnalyzingVision}
                    className="cursor-pointer w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    {isAnalyzingVision ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Analyzing with Gemini Vision...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Analyze Image with Gemini Vision</span>
                      </>
                    )}
                  </button>

                  {visionResult && (
                    <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 text-xs animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Scene Description
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => speakText(visionResult.sceneDescription)}
                            className="p-1 text-slate-400 hover:text-emerald-400"
                            title="Read scene description aloud"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono text-slate-400">{visionResult.sourceEngine}</span>
                        </div>
                      </div>

                      <p className="text-slate-200 text-xs leading-relaxed">
                        {visionResult.sceneDescription}
                      </p>

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Visible Objects:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {visionResult.visibleObjects.map((obj, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                              {obj}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Potential Obstacles / Hazards:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200">
                          {visionResult.potentialObstacles.map((obs, i) => (
                            <li key={i}>{obs}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                        <span className="font-bold text-slate-200">Recommendation: </span>
                        {visionResult.recommendedAction}
                      </div>

                      <div className="p-2 bg-rose-950/30 border border-rose-900/50 rounded-lg text-[10px] text-rose-300 leading-relaxed">
                        <strong>Safety Notice: </strong>{visionResult.limitations}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* HELPER CAREGIVER ASSISTANCE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base">
                        Caregiver Assistance & Alert
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Prepares structured notification messages for family or nurse
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Select Assistance Reason:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        'Fell / Cannot get up',
                        'Feel dizzy / unwell',
                        'Missed medication',
                        'Cannot reach item',
                      ].map((r, i) => (
                        <button
                          key={i}
                          onClick={() => setCaregiverReason(r)}
                          className={`cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left border transition-all ${
                            caregiverReason === r
                              ? 'bg-rose-950 border-rose-500 text-rose-200'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">
                        Room Location:
                      </label>
                      <input
                        type="text"
                        value={caregiverLocation}
                        onChange={(e) => setCaregiverLocation(e.target.value)}
                        placeholder="e.g. Living Room, Bedroom"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">
                        Additional Notes:
                      </label>
                      <input
                        type="text"
                        value={caregiverNotes}
                        onChange={(e) => setCaregiverNotes(e.target.value)}
                        placeholder="e.g. Need walking assistance"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleDraftCaregiverMessage()}
                    disabled={isDraftingMessage}
                    className="cursor-pointer w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    {isDraftingMessage ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Formulating with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Prepare Caregiver Notification Message</span>
                      </>
                    )}
                  </button>

                  {caregiverDraft && (
                    <div className="p-3.5 bg-slate-950 rounded-xl border border-rose-900/60 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-rose-400" />
                          Prepared Message
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          caregiverDraft.urgency === 'URGENT'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {caregiverDraft.urgency}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-slate-100 leading-relaxed select-all">
                        {caregiverDraft.message}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">Suggested Action: </span>
                        {caregiverDraft.suggestedAction}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={handleCopyMessage}
                          className="cursor-pointer flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedNotice ? 'Copied to Clipboard!' : 'Copy Message'}</span>
                        </button>

                        <a
                          href={`mailto:?subject=${encodeURIComponent(`[Smart Rakshak Alert] ${caregiverReason}`)}&body=${encodeURIComponent(caregiverDraft.message)}`}
                          className="cursor-pointer py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </a>
                      </div>

                      <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-[10px] text-slate-400 space-y-1">
                        <div className="font-bold text-slate-300 uppercase tracking-wide">
                          Delivery Status:
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Formulated & Saved in Assistance History</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Info className="w-3 h-3 text-amber-400" />
                          <span>External SMS gateway not connected — copy message to send via phone.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* HELPER ASSISTANCE HISTORY & AUDIT LOG */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Helper Assistance & Visual Inspection History
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Audit trail of recent conversational queries, smart appliance actions, and caregiver alerts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  isFirestorePersisted
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {isFirestorePersisted ? 'FIRESTORE CLOUD PERSISTED' : 'IN-MEMORY DEMO STORAGE'}
                </span>
                <button
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="cursor-pointer p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Refresh History"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Event Summary</th>
                    <th className="py-2.5 px-3">Caregiver Alert</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {eventsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                        No assistance events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    eventsList.map((evt) => (
                      <tr key={evt.eventId} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-emerald-300">
                            {evt.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-sans max-w-xs truncate">
                          {evt.summary}
                        </td>
                        <td className="py-2.5 px-3">
                          {evt.caregiverNotified ? (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Flagged</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            evt.status === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : evt.status === 'PREPARED_FOR_REVIEW'
                              ? 'bg-sky-950 text-sky-400 border border-sky-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {evt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. PROTECTION MODE WORKSPACE (ACTIVE) */}
      {/* ========================================================= */}
      {selectedMode === 'PROTECTION' && (
        <div className="space-y-6 animate-fadeIn">
          {/* SECTION 0: ROBOT PHYSICAL STATUS & LOCAL VS CLOUD SENSING */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Protection Mode — Home Safety & Hazard Awareness</span>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  </h2>
                  <p className="text-xs text-slate-400">
                    Physical robot local sensing link · Gemini 3.8 Flash multimodal visual safety inspection
                  </p>
                </div>
              </div>

              {/* Hardware Known Physical Capabilities */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Robot Movement: <strong className="text-emerald-300">Working locally</strong></span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Obstacle Avoidance: <strong className="text-emerald-300">Working locally</strong></span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Camera: <strong className="text-emerald-300">Working locally</strong></span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                  <Wifi className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cloud Link: <strong>{config.mode === 'LIVE' && config.controlMode === 'CLOUD' ? 'Connected (Firestore)' : 'Demonstration / Local Proxy'}</strong></span>
                </div>
              </div>
            </div>

            {/* Distinction between local sensing and cloud image analysis */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 text-xs text-slate-300 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Physical Sensing vs. Cloud-Based Visual Analysis</span>
              </div>
              <p className="text-slate-400">
                <strong className="text-slate-200">Local Robot Sensing:</strong> Onboard ultrasonic hardware senses forward distances (2–300 cm) and halts motors in under 20 ms when an obstacle is within 20 cm without relying on network latency.
                <br />
                <strong className="text-slate-200">Cloud AI Visual Analysis:</strong> Gemini 3.8 Flash inspects static photographs uploaded from the robot camera for non-geometric safety factors (such as liquid spills, floor clutter, blocked doorways, or tripping hazards). Uploaded photographs are analyzed individually and do not represent continuous live video streaming.
              </p>
            </div>

            {/* Tactile Safe Pilot Controls */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-7 space-y-3">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Safe Physical Navigation (Speed Level 1 Crawl):</span>
                  <span className="text-[11px] text-amber-400 font-mono">SAFETY GOVERNOR LOCKED</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto sm:mx-0">
                  <div />
                  <button
                    onClick={() => handleSafeRobotExecution('FORWARD')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-amber-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Move forward at crawl speed 1"
                  >
                    <ArrowUp className="w-5 h-5 text-amber-400" />
                    <span className="text-xs">Forward</span>
                  </button>
                  <div />

                  <button
                    onClick={() => handleSafeRobotExecution('LEFT')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-amber-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Turn left gently"
                  >
                    <ArrowLeft className="w-5 h-5 text-amber-400" />
                    <span className="text-xs">Left</span>
                  </button>

                  <button
                    onClick={() => handleSafeRobotExecution('STOP')}
                    className="cursor-pointer p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-lg active:scale-95"
                    title="Halt motors immediately"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span className="text-xs">STOP</span>
                  </button>

                  <button
                    onClick={() => handleSafeRobotExecution('RIGHT')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-amber-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Turn right gently"
                  >
                    <ArrowRight className="w-5 h-5 text-amber-400" />
                    <span className="text-xs">Right</span>
                  </button>

                  <div />
                  <button
                    onClick={() => handleSafeRobotExecution('BACKWARD')}
                    className="cursor-pointer p-3.5 rounded-xl bg-slate-800 hover:bg-amber-600 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 shadow-md active:scale-95"
                    title="Move backward at crawl speed 1"
                  >
                    <ArrowDown className="w-5 h-5 text-amber-400" />
                    <span className="text-xs">Reverse</span>
                  </button>
                  <div />
                </div>
              </div>

              {/* Camera Look Angles & Snapshot */}
              <div className="md:col-span-5 space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300">Camera Pan & Safety Headlight:</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 45)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pan 45°</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 90)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Center 90°</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('SET_SERVO', 135)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pan 135°</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSafeRobotExecution('CAMERA_LED_ON')}
                    className="cursor-pointer flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Turn On Front LED</span>
                  </button>
                  <button
                    onClick={() => handleSafeRobotExecution('CAMERA_LED_OFF')}
                    className="cursor-pointer flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>LED Off</span>
                  </button>
                </div>

                {onTriggerCapture && (
                  <button
                    onClick={onTriggerCapture}
                    className="cursor-pointer w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture New Camera Photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MAIN PROTECTION 2-COLUMN WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): Camera Image Upload & AI Visual Safety Analysis */}
            <div className="lg:col-span-7 space-y-6">
              {/* CAPABILITY 1 & 4: CAMERA IMAGE UPLOAD & SOURCE SELECTOR */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                        <span>1. Robot Camera Photograph Input</span>
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Upload a photograph captured by the robot camera for real Gemini visual safety inspection
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300">
                    GEMINI 3.8 FLASH
                  </span>
                </div>

                {/* Source Selection Buttons */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setProtectionImageSource('upload');
                        protectionFileInputRef.current?.click();
                      }}
                      className={`cursor-pointer flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                        protectionImageSource === 'upload' && protectionUploadedBase64
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>{protectionUploadedFilename ? `Photo: ${protectionUploadedFilename}` : 'Upload Camera Photograph'}</span>
                    </button>

                    <button
                      onClick={() => setProtectionImageSource('camera')}
                      className={`cursor-pointer flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                        protectionImageSource === 'camera'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      <span>Select Robot Capture ({images.length})</span>
                    </button>

                    <input
                      ref={protectionFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProtectionFileSelect(file);
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* Image Viewport & Metadata */}
                  <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center group">
                    {protectionImageSource === 'upload' && protectionUploadedBase64 ? (
                      <img
                        src={protectionUploadedBase64}
                        alt="Uploaded photograph for safety analysis"
                        className="w-full h-full object-contain"
                      />
                    ) : images.length > 0 ? (
                      <img
                        src={images.find((i) => i.imageId === protectionSelectedImageId)?.url || images[0].url}
                        alt="Robot camera capture"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-slate-500 text-xs p-5 space-y-2">
                        <ImageIcon className="w-8 h-8 mx-auto text-slate-600" />
                        <div>No camera photograph selected.</div>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          Click "Upload Camera Photograph" above to select a JPEG/PNG photo, or take a capture from the robot camera.
                        </p>
                      </div>
                    )}

                    <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>{protectionImageSource === 'upload' ? 'UPLOADED PHOTOGRAPH' : 'ROBOT CAMERA FRAME'}</span>
                    </div>

                    <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-md bg-slate-950/90 border border-slate-800 text-[9px] font-mono text-slate-400">
                      STATIC PHOTOGRAPH INSPECTION · NOT LIVE STREAM
                    </div>
                  </div>

                  {/* CAPABILITY 1: PRESET USER REQUESTS */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                      <span>Inspection Focus (Click any preset to analyze):</span>
                      <span className="text-[10px] text-slate-500">Visual Safety Prompts</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Analyze this image for potential hazards.',
                        'Describe the visible surroundings.',
                        'Identify objects that may obstruct movement.',
                        'Check for visible clutter near the entrance.',
                        'What should I inspect in this image?',
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => {
                            setProtectionUserFocus(preset);
                            handleRunProtectionAnalysis(preset);
                          }}
                          disabled={isAnalyzingProtection}
                          className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border transition-all text-left flex items-center gap-1.5 disabled:opacity-50 ${
                            protectionUserFocus === preset
                              ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 font-semibold shadow-sm'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                          }`}
                        >
                          <Search className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{preset}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom query input and inspect button */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={protectionUserFocus}
                        onChange={(e) => setProtectionUserFocus(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRunProtectionAnalysis()}
                        placeholder="Enter specific visual safety question (e.g. 'Is the doorway clear?', 'Check floor for liquid')..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs sm:text-sm"
                      />

                      <button
                        onClick={() => handleRunProtectionAnalysis()}
                        disabled={isAnalyzingProtection}
                        className="cursor-pointer px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
                      >
                        {isAnalyzingProtection ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            <span>Inspect Image with Gemini</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Error Notice */}
                    {protectionError && (
                      <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-start gap-2 animate-fadeIn">
                        <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        <div>
                          <strong>Error: </strong>
                          <span>{protectionError}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CAPABILITY 3: SAFETY ASSESSMENT SUMMARY */}
              {protectionAnalysis && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base">
                          2. Safety Assessment Summary
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Structured evaluation generated from the uploaded photograph
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => speakText(protectionAnalysis.overallSummary)}
                        className="cursor-pointer p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Read summary aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        {protectionAnalysis.sourceEngine}
                      </span>
                    </div>
                  </div>

                  {/* Prominent Category Assessment Card */}
                  <div className={`p-4 rounded-xl border space-y-2 ${
                    protectionAnalysis.assessmentCategory === 'Low Concern'
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : protectionAnalysis.assessmentCategory === 'Caution'
                      ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                      : protectionAnalysis.assessmentCategory === 'Potential Hazard'
                      ? 'bg-rose-950/50 border-rose-500/60 text-rose-200'
                      : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase font-mono ${
                          protectionAnalysis.assessmentCategory === 'Low Concern'
                            ? 'bg-emerald-500 text-slate-950'
                            : protectionAnalysis.assessmentCategory === 'Caution'
                            ? 'bg-amber-500 text-slate-950'
                            : protectionAnalysis.assessmentCategory === 'Potential Hazard'
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-slate-700 text-slate-200'
                        }`}>
                          {protectionAnalysis.assessmentCategory}
                        </span>
                        <span className="text-xs font-bold text-white">Assessment Category</span>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(protectionAnalysis.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-xs leading-relaxed text-slate-200">
                      <strong>Category Rationale: </strong>
                      {protectionAnalysis.categoryRationale}
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 italic">
                      Informational assessment generated from the uploaded image. Not a certified safety rating or guaranteed risk classification.
                    </div>
                  </div>

                  {/* Overall Observation Summary */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Surroundings & Environmental Summary:
                    </div>
                    <p className={`p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed ${getTextClass()}`}>
                      {protectionAnalysis.overallSummary}
                    </p>
                  </div>

                  {/* Visible Conditions or Objects of Interest */}
                  {protectionAnalysis.visibleConditions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Visible Objects & Conditions of Interest:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {protectionAnalysis.visibleConditions.map((cond, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300"
                          >
                            {cond}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Analysis Limitations Banner */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-[11px] space-y-1">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Analysis Limitations:</span>
                    </div>
                    <p>{protectionAnalysis.analysisLimitations}</p>
                  </div>
                </div>
              )}

              {/* CAPABILITY 2: POTENTIAL HAZARD IDENTIFICATION */}
              {protectionAnalysis && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                        <AlertOctagon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base">
                          3. Potential Hazard Identification & Observed Conditions
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Clear distinction between observed physical conditions and inferred safety risks
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      {protectionAnalysis.identifiedHazards.length} Observations
                    </span>
                  </div>

                  {protectionAnalysis.isInconclusive ? (
                    <div className="p-4 bg-slate-950 rounded-xl border border-amber-900/50 text-amber-200 text-xs space-y-2">
                      <div className="font-bold flex items-center gap-2 text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Analysis Inconclusive</span>
                      </div>
                      <p>
                        The image resolution, lighting, or framing is insufficient to reliably detect hazards.
                        Please capture another photograph from a different perspective with better room illumination.
                      </p>
                    </div>
                  ) : protectionAnalysis.identifiedHazards.length === 0 ? (
                    <div className="p-4 bg-slate-950 rounded-xl border border-emerald-900/50 text-emerald-200 text-xs flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold">No Obvious Hazards or Obstructions Identified</div>
                        <div className="text-[11px] text-slate-400">
                          The visible walkway appears clear based on this photograph. Always maintain reasonable caution when moving.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {protectionAnalysis.identifiedHazards.map((h, hIdx) => (
                        <div
                          key={h.id || hIdx}
                          className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                <span>{h.description}</span>
                              </div>
                              {h.approximateLocation && (
                                <div className="text-[11px] text-amber-400 font-mono">
                                  Location in Image: <strong>{h.approximateLocation}</strong>
                                </div>
                              )}
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              h.conditionType === 'OBSERVED_CONDITION'
                                ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {h.conditionType === 'OBSERVED_CONDITION' ? 'OBSERVED CONDITION' : 'POSSIBLE RISK'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-900">
                            <div className="space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                Reason for Attention:
                              </span>
                              <p className="text-slate-300 text-xs leading-relaxed">
                                {h.reasonForAttention}
                              </p>
                            </div>

                            <div className="space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-emerald-400">
                                Recommended Next Step:
                              </span>
                              <p className="text-slate-200 text-xs leading-relaxed">
                                {h.recommendedNextStep}
                              </p>
                            </div>
                          </div>

                          {h.uncertaintyOrLimitations && (
                            <div className="text-[10px] text-slate-500 italic pt-1">
                              <strong>Uncertainty / Note: </strong>{h.uncertaintyOrLimitations}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column (5 cols): Recommended Actions & Follow-up Q&A Assistant */}
            <div className="lg:col-span-5 space-y-6">
              {/* CAPABILITY 6: RECOMMENDED ACTIONS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-base">
                        4. Recommended Actions
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Proportionate safety guidance based on observed image evidence
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {protectionAnalysis?.recommendedActions && protectionAnalysis.recommendedActions.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {protectionAnalysis.recommendedActions.map((act, aIdx) => (
                        <li
                          key={aIdx}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-slate-200"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <span className="leading-relaxed">{act}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                      <div className="font-semibold text-slate-300">Awaiting Image Inspection</div>
                      <p>
                        Upload a photograph or select a robot camera capture on the left to generate actionable safety recommendations.
                      </p>
                    </div>
                  )}

                  {/* Safety Policy Constraint Box */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div className="font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Safety Execution Policy</span>
                    </div>
                    <p className="leading-relaxed">
                      Recommendations are purely advisory. The system does not automatically drive the physical robot or activate electrical appliances based on Gemini's visual analysis.
                    </p>
                  </div>
                </div>
              </div>

              {/* CAPABILITY 8: CONTEXTUAL FOLLOW-UP Q&A ON IMAGE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-base">
                        5. Follow-Up Safety Inquiries
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Ask specific questions about the uploaded image and prior analysis
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Follow-up Chips */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400">
                    Sample Inquiries (Click to ask):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Could any visible items cause someone to trip?',
                      'Is the walkway wide enough for safe passage?',
                      'Should I inspect this area in person?',
                    ].map((qChip, qIdx) => (
                      <button
                        key={qIdx}
                        onClick={() => {
                          setProtectionFollowUpQuestion(qChip);
                          handleAskProtectionFollowUp(qChip);
                        }}
                        disabled={isAskingProtectionFollowUp}
                        className="cursor-pointer text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-left transition-all disabled:opacity-50"
                      >
                        {qChip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Follow-up chat stream */}
                <div className="h-56 overflow-y-auto bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  {protectionFollowUpHistory.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-slate-500 text-xs p-4">
                      <span>No follow-up questions asked yet. Ask any question about items, floor conditions, or entrance clearance in the photograph.</span>
                    </div>
                  ) : (
                    protectionFollowUpHistory.map((item, fIdx) => (
                      <div
                        key={fIdx}
                        className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.role === 'user' ? 'You' : 'Protection Safety Advisor'}
                        </div>
                        <div
                          className={`p-3 rounded-xl max-w-sm text-xs leading-relaxed ${
                            item.role === 'user'
                              ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30 rounded-tr-none'
                              : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none'
                          }`}
                        >
                          <div>{item.text}</div>
                          {item.safetyAdvice && (
                            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[11px] text-amber-300">
                              <strong>Safety Tip: </strong>{item.safetyAdvice}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {isAskingProtectionFollowUp && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      <span>Gemini is evaluating your follow-up inquiry...</span>
                    </div>
                  )}
                </div>

                {/* Follow-up Question Input Bar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={protectionFollowUpQuestion}
                    onChange={(e) => setProtectionFollowUpQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskProtectionFollowUp()}
                    placeholder="Ask about this image (e.g. 'Is that item liquid or paper?')..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => handleAskProtectionFollowUp()}
                    disabled={isAskingProtectionFollowUp || !protectionFollowUpQuestion.trim()}
                    className="cursor-pointer px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CAPABILITY 7: SAFETY EVENT HISTORY */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    6. Protection Safety Event History
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Chronological audit log of visual safety inspections and assessment findings (newest first)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  protectionFirestorePersisted
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {protectionFirestorePersisted ? 'FIRESTORE CLOUD PERSISTED' : 'IN-MEMORY DEMO STORAGE'}
                </span>
                <button
                  onClick={fetchProtectionHistory}
                  disabled={protectionHistoryLoading}
                  className="cursor-pointer p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Refresh Protection History"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${protectionHistoryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Events Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Assessment Category</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Summary</th>
                    <th className="py-2.5 px-3">Identified Observations</th>
                    <th className="py-2.5 px-3">Recommended Actions</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {protectionEventsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                        No Protection safety events recorded yet. Upload a photograph above to inspect.
                      </td>
                    </tr>
                  ) : (
                    protectionEventsList.map((evt) => (
                      <tr key={evt.eventId} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            evt.assessmentCategory === 'Low Concern'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : evt.assessmentCategory === 'Caution'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : evt.assessmentCategory === 'Potential Hazard'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {evt.assessmentCategory}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[10px]">
                          {evt.source === 'UPLOADED_ROBOT_CAMERA_IMAGE' ? 'Uploaded Photo' : 'Camera Frame'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-sans max-w-xs truncate">
                          {evt.shortSummary}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans max-w-xs truncate">
                          {evt.identifiedObservations.length > 0
                            ? evt.identifiedObservations.join(', ')
                            : 'No obstructions observed'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans max-w-xs truncate">
                          {evt.recommendedActions.join(' · ')}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            evt.status === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : evt.status === 'INCONCLUSIVE'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {evt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
