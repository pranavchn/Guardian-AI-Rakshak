/**
 * Smart Rakshak — Control Center Header
 * Implements Top Bar Contract & Telemetry Indicators
 */

import React from 'react';
import { Shield, Radio, Wifi, Camera, AlertOctagon, Terminal } from 'lucide-react';
import { RobotStatus, SystemModeConfig } from '../types/robot.js';

interface HeaderProps {
  status: RobotStatus | null;
  config: SystemModeConfig;
  onEmergencyStop: () => void;
  onToggleDemoMode: () => void;
  onToggleControlMode: () => void;
  onOpenDocs: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  config,
  onEmergencyStop,
  onToggleDemoMode,
  onToggleControlMode,
  onOpenDocs,
}) => {
  const isOnline = status?.online ?? false;
  const cloudConnected = status?.cloudStatus === 'CONNECTED' || status?.cloudStatus === 'POLLING';
  const cameraAvailable = status?.cameraAvailable ?? false;

  const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return 'No signal';
    const diff = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                SMART RAKSHAK
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                ACEBOTT QD001
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Cloud Robot Control Center</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{status?.robotId || 'QD001'}</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Real-time Telemetry & Mode Toggles */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400">Status:</span>
            <span className={isOnline ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <span className="text-slate-700 hidden md:inline" aria-hidden="true">·</span>

          {/* Cloud Indicator */}
          <div className="flex items-center gap-1.5 whitespace-nowrap hidden sm:flex">
            <Radio className={`w-3.5 h-3.5 ${cloudConnected ? 'text-sky-400' : 'text-slate-500'}`} />
            <span className="text-slate-400">Cloud:</span>
            <span className={cloudConnected ? 'text-sky-400 font-semibold' : 'text-slate-500'}>
              {cloudConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <span className="text-slate-700 hidden md:inline" aria-hidden="true">·</span>

          {/* Camera Indicator */}
          <div className="flex items-center gap-1.5 whitespace-nowrap hidden md:flex">
            <Camera className={`w-3.5 h-3.5 ${cameraAvailable ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-slate-400">Camera:</span>
            <span className={cameraAvailable ? 'text-emerald-400' : 'text-slate-500'}>
              {cameraAvailable ? 'AVAILABLE' : 'OFFLINE'}
            </span>
          </div>

          <span className="text-slate-700 hidden lg:inline" aria-hidden="true">·</span>

          {/* Last Seen */}
          <div className="flex items-center gap-1 whitespace-nowrap text-slate-400 hidden lg:flex font-mono tabular-nums">
            <span>Last Seen:</span>
            <span className="text-slate-200">{formatLastSeen(status?.lastSeen)}</span>
          </div>

          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>

          {/* Interactive Mode Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDemoMode}
              title="Toggle between Live Hardware Mode and Browser Development Simulation Mode"
              className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                config.mode === 'DEMO'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
              }`}
            >
              {config.mode === 'DEMO' ? 'DEMO MODE' : 'LIVE ROBOT MODE'}
            </button>

            <button
              onClick={onToggleControlMode}
              title="Toggle between Cloud Run polling and Local ESP32 Wi-Fi direct network"
              className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors hidden sm:inline-block ${
                config.controlMode === 'CLOUD'
                  ? 'bg-sky-950/60 border-sky-500/50 text-sky-300 hover:bg-sky-900/60'
                  : 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/60'
              }`}
            >
              {config.controlMode === 'CLOUD' ? 'CLOUD POLLING' : 'LOCAL NETWORK'}
            </button>
          </div>
        </div>

        {/* Zone 3: Primary Action (EMERGENCY STOP & Documentation) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenDocs}
            className="p-2 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors"
            title="View Architecture, Firestore Schema & ESP32-CAM Firmware Guide"
          >
            <Terminal className="w-4 h-4" />
          </button>

          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-lg border border-rose-500 shadow-lg shadow-rose-950/50 transition-all shrink-0 cursor-pointer"
          >
            <AlertOctagon className="w-4 h-4 animate-pulse" />
            <span>Emergency Stop</span>
          </button>
        </div>
      </div>
    </header>
  );
};
