/**
 * Smart Rakshak — Tactile Movement & Motor Control Pad
 * Implements physical press/release safety behavior, speed control, servo control, and Emergency Stop
 */

import React, { useEffect } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  RotateCcw,
  RotateCw,
  Square,
  Gauge,
  Compass,
  Zap,
  Volume2,
  Lightbulb,
  Navigation,
  Eye,
  Footprints,
  Activity,
} from 'lucide-react';
import { RobotCommandType, RobotStatus } from '../types/robot.js';

interface MovementControlPadProps {
  status: RobotStatus | null;
  speed: number;
  servoAngle: number;
  activePressedCommand: RobotCommandType | null;
  holdToRun: boolean;
  onSetHoldToRun: (enabled: boolean) => void;
  onPress: (command: RobotCommandType) => void;
  onRelease: (command: RobotCommandType) => void;
  onSpeedChange: (speed: number) => void;
  onServoChange: (angle: number) => void;
  lastActionStatus: string;
}

export const MovementControlPad: React.FC<MovementControlPadProps> = ({
  status,
  speed,
  servoAngle,
  activePressedCommand,
  holdToRun,
  onSetHoldToRun,
  onPress,
  onRelease,
  onSpeedChange,
  onServoChange,
  lastActionStatus,
}) => {
  // Bind keyboard hotkeys (WASD / Arrows for driving, Space for Emergency Stop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.repeat) return; // Prevent key repeat storm

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          onPress('FORWARD');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          onPress('BACKWARD');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          onPress('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          onPress('RIGHT');
          break;
        case 'q':
        case 'Q':
          e.preventDefault();
          onPress('LEFT_UP');
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          onPress('RIGHT_UP');
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          onPress('LEFT_DOWN');
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          onPress('RIGHT_DOWN');
          break;
        case '[':
          e.preventDefault();
          onPress('ROTATE_LEFT');
          break;
        case ']':
          e.preventDefault();
          onPress('ROTATE_RIGHT');
          break;
        case ' ': // Spacebar
          e.preventDefault();
          onPress('STOP');
          break;
        case 'Escape':
          e.preventDefault();
          onPress('STOP');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (!holdToRun) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          onRelease('FORWARD');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          onRelease('BACKWARD');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          onRelease('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          onRelease('RIGHT');
          break;
        case 'q':
        case 'Q':
          onRelease('LEFT_UP');
          break;
        case 'e':
        case 'E':
          onRelease('RIGHT_UP');
          break;
        case 'z':
        case 'Z':
          onRelease('LEFT_DOWN');
          break;
        case 'c':
        case 'C':
          onRelease('RIGHT_DOWN');
          break;
        case '[':
          onRelease('ROTATE_LEFT');
          break;
        case ']':
          onRelease('ROTATE_RIGHT');
          break;
      }
    };

    const handleWindowBlur = () => {
      if (holdToRun) {
        onRelease('STOP');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleWindowBlur);
    };
  }, [holdToRun, onPress, onRelease]);

  // Helper to attach pointer events for tactile press/release
  const makePressHandlers = (command: RobotCommandType) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Fallback if browser doesn't support pointer capture
      }
      onPress(command);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Fallback
      }
      onRelease(command);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Fallback
      }
      onRelease(command);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      // If pointer is captured, do not prematurely stop on element boundary shrink
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        return;
      }
      onRelease(command);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between h-full space-y-5">
      {/* Control Header & Mode Switch */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Motor Drive Teleoperation
          </h2>
          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
            <span>Hardware Motor Packet</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400 font-semibold">{lastActionStatus}</span>
          </div>
        </div>

        {/* Safety Mode Toggle: Hold-to-Run vs Step Mode */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onSetHoldToRun(true)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              holdToRun
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Auto-sends STOP when button or key is released (High Safety)"
          >
            Hold-to-Run
          </button>
          <button
            onClick={() => onSetHoldToRun(false)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              !holdToRun
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Single tap sends movement command until Stop is pressed"
          >
            Step Mode
          </button>
        </div>
      </div>

      {/* Large Robot Movement Pad (Cross Layout) */}
      <div className="flex flex-col items-center justify-center my-auto py-2">
        <div className="grid grid-cols-3 gap-3 w-64 max-w-full">
          {/* Row 1: Diagonal and Forward */}
          <button
            {...makePressHandlers('LEFT_UP')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'LEFT_UP'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Diagonal Left Forward"
          >
            <ArrowUpLeft className="w-7 h-7 mb-1" />
            <span className="text-[10px]">L-UP</span>
          </button>

          <button
            {...makePressHandlers('FORWARD')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'FORWARD'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Drive Forward"
          >
            <ArrowUp className="w-7 h-7 mb-1" />
            <span className="text-[10px]">FORWARD</span>
          </button>

          <button
            {...makePressHandlers('RIGHT_UP')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'RIGHT_UP'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Diagonal Right Forward"
          >
            <ArrowUpRight className="w-7 h-7 mb-1" />
            <span className="text-[10px]">R-UP</span>
          </button>

          {/* Row 2: Left, Stop, Right Buttons */}
          <button
            {...makePressHandlers('LEFT')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'LEFT'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Steer Left"
          >
            <ArrowLeft className="w-7 h-7 mb-1" />
            <span className="text-[10px]">LEFT</span>
          </button>

          {/* STOP Button (Center) */}
          <button
            onClick={() => onPress('STOP')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              status?.currentCommand === 'STOP' || activePressedCommand === 'STOP'
                ? 'bg-rose-700 text-white border-rose-500 scale-95 shadow-rose-900/50'
                : 'bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 active:scale-95'
            }`}
            aria-label="Stop Motors"
          >
            <Square className="w-6 h-6 mb-1 fill-current" />
            <span className="text-[10px]">STOP</span>
          </button>

          <button
            {...makePressHandlers('RIGHT')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'RIGHT'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Steer Right"
          >
            <ArrowRight className="w-7 h-7 mb-1" />
            <span className="text-[10px]">RIGHT</span>
          </button>

          {/* Row 3: Diagonal and Backward */}
          <button
            {...makePressHandlers('LEFT_DOWN')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'LEFT_DOWN'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Diagonal Left Backward"
          >
            <ArrowDownLeft className="w-7 h-7 mb-1" />
            <span className="text-[10px]">L-DN</span>
          </button>

          <button
            {...makePressHandlers('BACKWARD')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'BACKWARD'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Drive Backward"
          >
            <ArrowDown className="w-7 h-7 mb-1" />
            <span className="text-[10px]">BACKWARD</span>
          </button>

          <button
            {...makePressHandlers('RIGHT_DOWN')}
            className={`touch-control-button h-20 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'RIGHT_DOWN'
                ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            aria-label="Diagonal Right Backward"
          >
            <ArrowDownRight className="w-7 h-7 mb-1" />
            <span className="text-[10px]">R-DN</span>
          </button>
        </div>

        {/* Rotation Controls */}
        <div className="flex items-center gap-3 mt-4">
          <button
            {...makePressHandlers('ROTATE_LEFT')}
            className={`touch-control-button h-16 w-30 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'ROTATE_LEFT'
                ? 'bg-sky-500 text-slate-950 scale-95 shadow-sky-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
          >
            <RotateCcw className="w-6 h-6 mb-1" />
            <span className="text-[10px]">ROTATE L</span>
          </button>
          <button
            {...makePressHandlers('ROTATE_RIGHT')}
            className={`touch-control-button h-16 w-30 rounded-xl flex flex-col items-center justify-center font-bold tracking-wider transition-all select-none shadow-md ${
              activePressedCommand === 'ROTATE_RIGHT'
                ? 'bg-sky-500 text-slate-950 scale-95 shadow-sky-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
          >
            <RotateCw className="w-6 h-6 mb-1" />
            <span className="text-[10px]">ROTATE R</span>
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="mt-3 text-[11px] text-slate-500 flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <span>WASD / Arrows: Move</span>
            <span>·</span>
            <span>QEZC: Diagonal</span>
            <span>·</span>
            <span>[]: Rotate</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Space / Esc: <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-300 font-mono text-[9px]">Stop Motors</kbd></span>
          </div>
        </div>
      </div>

      {/* Auxiliary Controls (Buzzer, LED, Modes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-t border-slate-800">
        {/* Buzzer Control */}
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-300">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            Buzzer Alerts
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(num => (
              <button
                key={num}
                onClick={() => onPress(`BUZZER_${num}` as any)}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded border border-slate-700 active:scale-95 transition-all"
              >
                Tone {num}
              </button>
            ))}
          </div>
        </div>

        {/* Camera LED Control */}
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-300">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
            Camera LED (Flash)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPress('CAMERA_LED_ON')}
              className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold rounded shadow-md active:scale-95 transition-all"
            >
              LED ON
            </button>
            <button
              onClick={() => onPress('CAMERA_LED_OFF')}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold rounded border border-slate-700 active:scale-95 transition-all"
            >
              LED OFF
            </button>
          </div>
        </div>

        {/* Specialized Modes */}
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-300">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Hardware Modes
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onPress('MODE_TRACKING')}
              className="py-1.5 px-1 flex items-center gap-1.5 justify-center bg-slate-800 hover:bg-emerald-900/40 hover:text-emerald-300 text-slate-300 text-[9px] rounded border border-slate-700 transition-all"
            >
              <Navigation className="w-2.5 h-2.5" />
              Tracking
            </button>
            <button
              onClick={() => onPress('MODE_AVOIDANCE')}
              className="py-1.5 px-1 flex items-center gap-1.5 justify-center bg-slate-800 hover:bg-emerald-900/40 hover:text-emerald-300 text-slate-300 text-[9px] rounded border border-slate-700 transition-all"
            >
              <Eye className="w-2.5 h-2.5" />
              Avoidance
            </button>
            <button
              onClick={() => onPress('MODE_FOLLOW')}
              className="py-1.5 px-1 flex items-center gap-1.5 justify-center bg-slate-800 hover:bg-emerald-900/40 hover:text-emerald-300 text-slate-300 text-[9px] rounded border border-slate-700 transition-all"
            >
              <Footprints className="w-2.5 h-2.5" />
              Follow
            </button>
            <button
              onClick={() => onPress('MODE_STANDBY')}
              className="py-1.5 px-1 flex items-center gap-1.5 justify-center bg-slate-900 hover:bg-slate-800 text-slate-500 text-[9px] rounded border border-slate-800 transition-all"
            >
              Standby
            </button>
          </div>
        </div>
      </div>

      {/* Speed Slider & Servo Control Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
        {/* Speed Slider (1 to 5) */}
        <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              Motor Cruising Speed
            </span>
            <span className="font-mono text-amber-400 font-bold tabular-nums">
              Level {speed} / 5
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={speed}
            onChange={(e) => onSpeedChange(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1 (Crawl)</span>
            <span>3 (Cruise)</span>
            <span>5 (Turbo)</span>
          </div>
        </div>

        {/* Servo Slider (0° to 180°) */}
        <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              Camera Pan Servo
            </span>
            <span className="font-mono text-sky-400 font-bold tabular-nums">
              {servoAngle}°
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="180"
            step="5"
            value={servoAngle}
            onChange={(e) => onServoChange(parseInt(e.target.value, 10))}
            className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <button
              onClick={() => onServoChange(45)}
              className="hover:text-sky-300 transition-colors"
            >
              45° Left
            </button>
            <button
              onClick={() => onServoChange(90)}
              className="hover:text-sky-300 font-bold text-slate-300 transition-colors"
            >
              90° Center
            </button>
            <button
              onClick={() => onServoChange(135)}
              className="hover:text-sky-300 transition-colors"
            >
              135° Right
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
