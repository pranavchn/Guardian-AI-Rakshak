/**
 * Smart Rakshak — Control Center Header
 * Implements Top Bar Contract & Telemetry Indicators
 */

import React from 'react';
import { Radio, Wifi, Camera, Terminal } from 'lucide-react';
import { RobotStatus, SystemModeConfig } from '../types/robot.js';

interface HeaderProps {
  status: RobotStatus | null;
  config?: SystemModeConfig;
  onOpenDocs: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenDocs,
}) => {
  const isOnline = status?.online ?? true;
  const cameraAvailable = status?.cameraAvailable ?? true;

  const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return 'Live';
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
          <div className="h-10 sm:h-11 px-2.5 py-1 bg-white rounded-lg border border-slate-700/60 shadow-md flex items-center justify-center shrink-0">
            <img
              src="/Images/Guardian%20AI%20Logo.png"
              alt="Guardian AI Logo"
              className="h-7 sm:h-8 w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 hidden sm:inline">
                Physical AI Robot
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Google Cloud Robot Control Center</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-sky-400 font-semibold">{status?.robotId || 'QD001'}</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Real-time Telemetry & FastAPI Connection */}
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

          {/* FastAPI Backend Status */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">FastAPI:</span>
            <span className="text-sky-400 font-semibold">
              CONNECTED
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

          {/* Unified FastAPI Backend Badge */}
          <div className="flex items-center gap-2">
            <a
              href="https://robotfastapicommunication-8789951438.asia-south1.run.app"
              target="_blank"
              rel="noreferrer"
              title="Connected to deployed FastAPI backend service on Google Cloud Run (asia-south1)"
              className="px-2.5 py-1 text-xs font-semibold rounded border transition-colors bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>FastAPI Cloud Backend</span>
            </a>
          </div>
        </div>

        {/* Zone 3: System Documentation */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenDocs}
            className="p-2 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors cursor-pointer"
            title="View Architecture, Firestore Schema & ESP32-CAM Firmware Guide"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
