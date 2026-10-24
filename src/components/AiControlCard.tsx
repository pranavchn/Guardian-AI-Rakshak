/**
 * Guardian AI gemini-3.1-flash-lite — Free Local Zero-Cost Natural Language Engine & Voice Control Card
 * Translates human speech and text into validated robot commands with instant FastAPI dispatch
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  ShieldCheck,
  ShieldAlert,
  Mic,
  MicOff,
  Check,
  CornerDownRight,
  Info,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { RobotCommandType } from '../types/robot.js';

interface AiControlCardProps {
  onExecuteCommand: (command: RobotCommandType, options: { speed?: number; servo?: number; source: 'AI_NATURAL_LANGUAGE' }) => void;
  robotId: string;
}

interface TranslationResult {
  valid: boolean;
  commandType?: RobotCommandType;
  speed?: number;
  servo?: number;
  intentSummary: string;
  safetyPassed: boolean;
  safetyReason?: string;
  sourceEngine: string;
}

interface QuickAction {
  label: string;
  phrase: string;
}

export const AiControlCard: React.FC<AiControlCardProps> = ({ onExecuteCommand, robotId }) => {
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [instantDispatch, setInstantDispatch] = useState<boolean>(true);
  const [lastExecutedText, setLastExecutedText] = useState<string | null>(null);

  const quickActions: QuickAction[] = [
    { label: '▲ Forward', phrase: 'move forward' },
    { label: '▼ Reverse', phrase: 'move backward' },
    { label: '◀ Turn Left', phrase: 'turn left' },
    { label: '▶ Turn Right', phrase: 'turn right' },
    { label: '↺ Spin Left', phrase: 'spin counter-clockwise' },
    { label: '↻ Spin Right', phrase: 'spin clockwise' },
    { label: '🛑 Stop', phrase: 'stop robot now' },
    { label: '⚡ Speed 4', phrase: 'set speed 4' },
    { label: '🎯 Center Camera', phrase: 'center camera 90 degrees' },
    { label: '📸 Take Photo', phrase: 'take a picture' },
    { label: '🔔 Beep Horn', phrase: 'sound buzzer horn' },
  ];

  // Speech Recognition (Web Speech API)
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please type.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt(transcript);
        setIsListening(false);
        handleTranslateAndExecute(transcript, instantDispatch);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechError('Could not capture audio. Please type command.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleTranslateAndExecute = async (textToProcess?: string, shouldAutoExecute: boolean = instantDispatch) => {
    const text = (textToProcess || inputPrompt).trim();
    if (!text) return;

    setIsTranslating(true);
    setSpeechError(null);

    try {
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, robotId, executeImmediately: false }),
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        const translation: TranslationResult = data.translation;
        setResult(translation);

        if (shouldAutoExecute && translation && translation.valid && translation.commandType && translation.safetyPassed) {
          onExecuteCommand(translation.commandType, {
            speed: translation.speed,
            servo: translation.servo,
            source: 'AI_NATURAL_LANGUAGE',
          });
          setLastExecutedText(`${translation.commandType}${translation.speed ? ` (Speed: ${translation.speed})` : ''}${translation.servo !== undefined ? ` (Servo: ${translation.servo}°)` : ''}`);
          setInputPrompt('');
          // Clear notification after 4s
          setTimeout(() => {
            setLastExecutedText((curr) => (curr ? null : curr));
          }, 4000);
        }
      }
    } catch (err) {
      console.warn('AI translation notice:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleManualExecute = () => {
    if (!result || !result.valid || !result.commandType) return;
    onExecuteCommand(result.commandType, {
      speed: result.speed,
      servo: result.servo,
      source: 'AI_NATURAL_LANGUAGE',
    });
    setLastExecutedText(`${result.commandType}${result.speed ? ` (Speed: ${result.speed})` : ''}${result.servo !== undefined ? ` (Servo: ${result.servo}°)` : ''}`);
    setResult(null);
    setInputPrompt('');
    setTimeout(() => {
      setLastExecutedText((curr) => (curr ? null : curr));
    }, 4000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-100">AI Natural Language Control</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/80 text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
           gemini-3.1-flash-lite
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <p className="leading-relaxed">
          Operate the robot by typing or speaking natural instructions (e.g. <span className="text-slate-300">"move forward"</span>, <span className="text-slate-300">"turn left"</span>, <span className="text-slate-300">"stop"</span>).
        </p>

        {/* Instant Mode Toggle */}
        <button
          type="button"
          onClick={() => setInstantDispatch(!instantDispatch)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer shrink-0 ml-2 ${
            instantDispatch
              ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
              : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle instant execution without review step"
        >
          <Zap className={`w-3 h-3 ${instantDispatch ? 'text-emerald-400 fill-emerald-400' : 'text-slate-500'}`} />
          <span>{instantDispatch ? 'Instant Mode: ON' : 'Instant Mode: OFF'}</span>
        </button>
      </div>

      {/* Input Field with Voice & Submit Button */}
      <div className="relative">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTranslateAndExecute();
          }}
          placeholder="e.g., 'Move forward slowly', 'Turn right', or 'Stop robot'"
          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg py-2.5 pl-3 pr-20 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
        />
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`p-1.5 rounded transition-colors ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Speak command"
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => handleTranslateAndExecute()}
            disabled={isTranslating || !inputPrompt.trim()}
            className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded font-semibold disabled:opacity-40 transition-colors"
            title={instantDispatch ? 'Send & Drive Robot' : 'Translate Command'}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {speechError && (
        <p className="text-[11px] text-amber-400">{speechError}</p>
      )}

      {/* Last Executed Notification */}
      {lastExecutedText && (
        <div className="flex items-center gap-2 p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Dispatched command <span className="font-mono font-bold text-emerald-200">{lastExecutedText}</span> to robot via FastAPI!</span>
        </div>
      )}

      {/* Quick Action Chips */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-slate-400">Quick Voice / Click Actions:</div>
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputPrompt(action.phrase);
                handleTranslateAndExecute(action.phrase, instantDispatch);
              }}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Review Box (when Instant Mode is OFF or if command needs confirmation) */}
      {!instantDispatch && result && (
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5 text-sky-400" />
              Safety Validation Layer
            </span>
            {result.safetyPassed ? (
              <span className="text-emerald-400 font-semibold font-mono flex items-center gap-1 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" /> PASSED
              </span>
            ) : (
              <span className="text-rose-400 font-semibold font-mono flex items-center gap-1 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5" /> BLOCKED
              </span>
            )}
          </div>

          <div className="text-xs font-mono space-y-1">
            <div className="text-slate-300">
              Validated Action:{' '}
              <span className="text-emerald-400 font-bold">{result.commandType || 'NONE'}</span>
              {result.speed && <span className="text-slate-400 ml-2">Speed: {result.speed}</span>}
              {result.servo !== undefined && <span className="text-slate-400 ml-2">Servo: {result.servo}°</span>}
            </div>
            <div className="text-[11px] text-slate-400">{result.intentSummary}</div>
            <div className="text-[10px] text-slate-500">
              Engine: {result.sourceEngine}
            </div>
          </div>

          {result.valid && result.safetyPassed && (
            <button
              onClick={handleManualExecute}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Dispatch Validated Command to Robot via FastAPI</span>
            </button>
          )}
        </div>
      )}

      {/* Notice on safety boundary enforcement */}
      <div className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          Zero-cost &amp; ultra-low latency: Commands are parsed locally and transmitted directly to the ESP32 via your FastAPI service.
        </span>
      </div>
    </div>
  );
};
