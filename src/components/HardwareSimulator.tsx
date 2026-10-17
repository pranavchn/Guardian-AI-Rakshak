/**
 * Smart Rakshak — Hardware Simulator & Cloud Run Logs Drawer
 * Used in DEMO MODE to verify end-to-end device polling, heartbeats, and acks without hardware
 */

import React, { useState } from 'react';
import {
  Terminal,
  Play,
  RotateCw,
  Radio,
  Camera,
  Server,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SystemAuditLog, SystemModeConfig } from '../types/robot.js';

interface HardwareSimulatorProps {
  config: SystemModeConfig;
  onUpdateConfig: (cfg: Partial<SystemModeConfig>) => void;
  onSimulateCycle: () => void;
  onTriggerCapture: () => void;
  logs: SystemAuditLog[];
}

export const HardwareSimulator: React.FC<HardwareSimulatorProps> = ({
  config,
  onUpdateConfig,
  onSimulateCycle,
  onTriggerCapture,
  logs,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header bar / Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Hardware Simulator & Cloud Run Audit Logs
          </h3>
          <span className="text-xs text-amber-400/80 font-mono">
            {config.mode === 'DEMO' ? 'Active in Demo Mode' : 'Monitoring Live Link'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            {logs.length} audit records
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Simulation Controls (Only relevant in DEMO MODE) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                ESP32 Hardware Simulation Engine
              </span>

              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoSimulatePolling}
                    onChange={(e) => onUpdateConfig({ autoSimulatePolling: e.target.checked })}
                    className="accent-amber-500 rounded"
                  />
                  <span>Auto-simulate background ESP32 poller (250ms)</span>
                </label>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              When the physical robot is offline, you can trigger simulated device cycles to test command consumption, watchdog heartbeats, and camera frame generation.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={onSimulateCycle}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate 1 Polling & Ack Cycle</span>
              </button>

              <button
                onClick={onTriggerCapture}
                className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Queue Camera Capture</span>
              </button>
            </div>
          </div>

          {/* Cloud Run Audit Logs Stream */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                Cloud Run Backend System Logs
              </span>
              <span className="font-mono text-[11px]">Real-time stdout</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-48 overflow-y-auto font-mono text-[11px] divide-y divide-slate-900 scrollbar-thin">
              {logs.length > 0 ? (
                logs.map((l) => (
                  <div key={l.logId} className="py-1.5 flex items-start gap-2">
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      {new Date(l.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                        l.level === 'ERROR'
                          ? 'bg-rose-950 text-rose-300'
                          : l.level === 'WARN'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {l.category}
                    </span>
                    <span className="text-slate-300 leading-snug">{l.message}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-600 py-3 text-center">No logs recorded yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
