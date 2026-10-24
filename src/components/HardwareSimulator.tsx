/**
 * Guardian AI — FastAPI Diagnostics & System Audit Logs Drawer
 * Displays real-time communication logs and live FastAPI Cloud Run health telemetry
 */

import React, { useState } from 'react';
import {
  Terminal,
  Activity,
  Server,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import { SystemAuditLog, SystemModeConfig } from '../types/robot.js';

interface HardwareSimulatorProps {
  config?: SystemModeConfig;
  onUpdateConfig?: (cfg: Partial<SystemModeConfig>) => void;
  onSimulateCycle?: () => void;
  onTriggerCapture?: () => void;
  logs: SystemAuditLog[];
}

export const HardwareSimulator: React.FC<HardwareSimulatorProps> = ({
  onTriggerCapture,
  logs,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  const testFastApiPing = async () => {
    setIsPinging(true);
    setPingStatus('Testing connection to FastAPI Cloud Run...');
    const start = Date.now();
    try {
      const res = await fetch('/api/fastapi/health');
      const data = await res.json().catch(() => null);
      const latency = Date.now() - start;
      if (res.ok && data?.connected) {
        setPingStatus(`FastAPI Online: 200 OK (${latency}ms round-trip)`);
      } else {
        setPingStatus(`FastAPI returned status: ${res.status}`);
      }
    } catch (err) {
      setPingStatus(`Connection failed: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header bar / Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            FastAPI Diagnostics & System Audit Logs
          </h3>
          <span className="text-xs text-emerald-400/90 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            FastAPI Cloud Link Active
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
          {/* FastAPI Link Summary */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                FastAPI Google Cloud Run Communication Service
              </span>

              <a
                href="https://robotfastapicommunication-8789951438.asia-south1.run.app"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
              >
                <span>robotfastapicommunication</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-slate-400">
              Direct connection to the robot backend. All front-end movement, speed, servo, buzzer, LED, and safety commands are dispatched instantly to FastAPI, where robot QD001 continuously polls and executes them via the Serial2 motor bus.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={testFastApiPing}
                disabled={isPinging}
                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{isPinging ? 'Pinging...' : 'Ping FastAPI Health'}</span>
              </button>

              {onTriggerCapture && (
                <button
                  onClick={onTriggerCapture}
                  className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Request Camera Frame</span>
                </button>
              )}

              {pingStatus && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {pingStatus}
                </span>
              )}
            </div>
          </div>

          {/* Cloud Run Audit Logs Stream */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                Cloud Backend System Audit Stream
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
