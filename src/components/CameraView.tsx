/**
 * Smart Rakshak — Camera & Optical Telemetry View
 * ESP32-CAM OV2640 Optical Module
 */

import React, { useState } from 'react';
import {
  Camera,
  Sparkles,
  Maximize2,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { CameraImageRecord, RobotStatus } from '../types/robot.js';

interface CameraViewProps {
  status: RobotStatus | null;
  images: CameraImageRecord[];
  isCapturing: boolean;
  onCapture: () => void;
  onSelectImage: (image: CameraImageRecord) => void;
  onTriggerAiAnalysis: (imageId?: string) => Promise<void>;
  isAnalyzingVision: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  status,
  images,
  isCapturing,
  onCapture,
  onSelectImage,
  onTriggerAiAnalysis,
  isAnalyzingVision,
}) => {
  const [hudActive, setHudActive] = useState<boolean>(true);
  const latestImage = images[0] || null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header Bar */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-200">Robot Optical Feed</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setHudActive(!hudActive)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
              hudActive
                ? 'bg-sky-950 border-sky-800 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            HUD {hudActive ? 'ON' : 'OFF'}
          </button>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-400 text-[11px] tabular-nums">
            {latestImage ? formatDate(latestImage.createdAt) : 'Awaiting frame'}
          </span>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden group">
        {latestImage ? (
          <img
            src={latestImage.url}
            alt="ESP32-CAM frame from robot"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <Camera className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
            <p className="text-xs font-medium text-slate-400">No optical frame received yet</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Click Capture Image below to command the ESP32-CAM to upload a frame.
            </p>
          </div>
        )}

        {/* Optical HUD Overlay */}
        {hudActive && latestImage && (
          <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between font-mono text-[10px] text-sky-400 select-none">
            {/* Top HUD */}
            <div className="flex items-center justify-between bg-slate-950/70 p-1.5 rounded border border-sky-900/50 backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ESP32-CAM · OV2640</span>
                <span>·</span>
                <span>VGA 640x480</span>
              </div>
              <div className="flex items-center gap-2">
                <span>BAT: {status?.batteryLevel ?? 84}%</span>
                <span>·</span>
                <span>SERVO: {status?.servoAngle ?? 90}°</span>
              </div>
            </div>

            {/* Center Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-28 h-28 border border-sky-500/20 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full border border-sky-400/80 bg-sky-400/20" />
                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-sky-500/30 -translate-x-1/2" />
                <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-sky-500/30 -translate-y-1/2" />
              </div>
            </div>

            {/* Bottom HUD */}
            <div className="flex items-center justify-between bg-slate-950/70 p-1.5 rounded border border-sky-900/50 backdrop-blur-xs">
              <span>STORAGE: {latestImage.storagePath.split('/').pop()}</span>
              <span>SOURCE: {latestImage.captureSource}</span>
            </div>
          </div>
        )}

        {/* Floating Expand Button */}
        {latestImage && (
          <button
            onClick={() => onSelectImage(latestImage)}
            className="absolute bottom-3 right-3 p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
            title="Inspect full image in gallery lightbox"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Action Controls */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
        <button
          onClick={onCapture}
          disabled={isCapturing}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-100 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          <Camera className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
          <span>{isCapturing ? 'Dispatched Capture...' : 'Capture Image'}</span>
        </button>

        <button
          onClick={() => onTriggerAiAnalysis(latestImage?.imageId)}
          disabled={!latestImage || isAnalyzingVision}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-200 bg-amber-950/70 hover:bg-amber-900/80 active:bg-amber-900 border border-amber-600/40 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
          title="Run Gemini multimodal computer vision on this frame"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingVision ? 'animate-spin' : 'text-amber-400'}`} />
          <span>{isAnalyzingVision ? 'Scanning...' : 'AI Vision Scan'}</span>
        </button>
      </div>

      {/* AI Vision Analysis Output Card */}
      {latestImage?.aiAnalysis && (
        <div className="mx-3 my-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              Gemini Vision Assessment
            </span>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              {latestImage.aiAnalysis.isSafeToAdvance ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Path Clear
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Obstacle
                </span>
              )}
            </div>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {latestImage.aiAnalysis.summary}
          </p>
          {latestImage.aiAnalysis.detectedObstacles.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {latestImage.aiAnalysis.detectedObstacles.map((obs, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono"
                >
                  {obs}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Capture History Thumbnails Strip */}
      <div className="px-3 pb-3 mt-auto">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span className="flex items-center gap-1 text-[11px]">
            <Layers className="w-3 h-3 text-slate-500" />
            Recent Captures ({images.length})
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Click to view</span>
        </div>

        {images.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {images.slice(0, 6).map((img) => (
              <button
                key={img.imageId}
                onClick={() => onSelectImage(img)}
                className="shrink-0 w-14 h-11 rounded border border-slate-800 hover:border-sky-500 overflow-hidden relative group cursor-pointer"
              >
                <img
                  src={img.url}
                  alt="Thumbnail"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] font-mono text-slate-300 text-center truncate px-0.5">
                  {formatDate(img.createdAt)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-2 text-center text-[11px] text-slate-600">No images recorded</div>
        )}
      </div>
    </div>
  );
};
