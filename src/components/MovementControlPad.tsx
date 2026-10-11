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
  Square,
  AlertOctagon,
  Gauge,
  Compass,
  Zap,
  ShieldAlert,
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
  onEmergencyStop: () => void;
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
  onEmergencyStop,
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
        case ' ': // Spacebar
          e.preventDefault();
          onEmergencyStop();
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [holdToRun, onPress, onRelease, onEmergencyStop]);

  // Helper to attach pointer events for tactile press/release
  const makePressHandlers = (command: RobotCommandType) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onPress(command);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onRelease(command);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      e.preventDefault();
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
            QD001 Drive Teleoperation
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
          {/* Row 1: Forward Button (Center) */}
          <div />
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
            <span className="text-xs">FORWARD</span>
          </button>
          <div />

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
            <span className="text-xs">LEFT</span>
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
            <span className="text-xs">STOP</span>
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
            <span className="text-xs">RIGHT</span>
          </button>

          {/* Row 3: Backward Button (Center) */}
          <div />
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
            <span className="text-xs">BACKWARD</span>
          </button>
          <div />
        </div>

        {/* Keyboard hints */}
        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-3">
          <span>Keys: <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">W</kbd> <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">A</kbd> <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">S</kbd> <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">D</kbd></span>
          <span>·</span>
          <span>Space: <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-rose-300 font-mono">E-Stop</kbd></span>
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

      {/* Prominent High-Priority Emergency Stop Bar */}
      <div className="pt-2 space-y-2">
        <button
          onClick={onEmergencyStop}
          className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl border border-rose-500 shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <AlertOctagon className="w-5 h-5 fill-rose-950 text-white animate-pulse" />
          <span>PRIMARY EMERGENCY STOP</span>
          <span className="text-xs font-normal normal-case text-rose-100 opacity-90 hidden sm:inline">
            (Purges Queue & Halts All Hardware)
          </span>
        </button>

        {status?.currentCommand === 'EMERGENCY_STOP' && (
          <button
            onClick={() => onPress('RESET_EMERGENCY_STOP')}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-emerald-400 shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all animate-bounce"
          >
            <ShieldAlert className="w-4 h-4 text-emerald-100" />
            <span>SAFE RECOVERY: RESET EMERGENCY STOP LOCKOUT</span>
          </button>
        )}
      </div>
    </div>
  );
};
