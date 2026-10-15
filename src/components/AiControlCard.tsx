/**
 * Smart Rakshak — Gemini AI Natural Language & Safety Translation Card
 * Translates human intent into strictly validated hardware commands
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

export const AiControlCard: React.FC<AiControlCardProps> = ({ onExecuteCommand, robotId }) => {
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const samplePrompts = [
    'Move forward slowly',
    'Stop the robot now',
    'Take a picture',
    'Pan camera 45 degrees left',
    'Reverse at speed 2',
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
        handleTranslate(transcript);
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

  const handleTranslate = async (textToTranslate?: string) => {
    const text = (textToTranslate || inputPrompt).trim();
    if (!text) return;

    setIsTranslating(true);
    setResult(null);

    try {
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, robotId, executeImmediately: false }),
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setResult(data.translation);
      }
    } catch (err) {
      console.warn('AI translation notice:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExecute = () => {
    if (!result || !result.valid || !result.commandType) return;
    onExecuteCommand(result.commandType, {
      speed: result.speed,
      servo: result.servo,
      source: 'AI_NATURAL_LANGUAGE',
    });
    setResult(null);
    setInputPrompt('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-100">AI Natural Language Control</h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          POST /api/ai/command
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Translates voice or natural language instructions into safety-validated motor and camera commands.
      </p>

      {/* Input Field with Voice & Submit Button */}
      <div className="relative">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTranslate();
          }}
          placeholder="e.g., 'Move forward slowly' or 'Take a photo'"
          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg py-2.5 pl-3 pr-20 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
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
            onClick={() => handleTranslate()}
            disabled={isTranslating || !inputPrompt.trim()}
            className="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-semibold disabled:opacity-40 transition-colors"
            title="Translate & Validate"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {speechError && (
        <p className="text-[11px] text-amber-400">{speechError}</p>
      )}

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5">
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              setInputPrompt(p);
              handleTranslate(p);
            }}
            className="text-[11px] px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Translation & Safety Validation Review Box */}
      {result && (
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
              <span className="text-amber-400 font-bold">{result.commandType || 'NONE'}</span>
              {result.speed && <span className="text-slate-400 ml-2">Speed: {result.speed}</span>}
              {result.servo && <span className="text-slate-400 ml-2">Servo: {result.servo}°</span>}
            </div>
            <div className="text-[11px] text-slate-400">{result.intentSummary}</div>
            <div className="text-[10px] text-slate-400">
              Engine: {result.sourceEngine}
            </div>
          </div>

          {result.valid && result.safetyPassed && (
            <button
              onClick={handleExecute}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Dispatch Validated Command to Robot Queue</span>
            </button>
          )}
        </div>
      )}

      {/* Notice on safety boundary enforcement */}
      <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          Zero unvalidated motor execution: All AI natural language intents must pass through the deterministic boundary checker before reaching the hardware queue.
        </span>
      </div>
    </div>
  );
};
