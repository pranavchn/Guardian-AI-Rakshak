/**
 * Smart Rakshak — Camera Image Lightbox & Inspection Modal
 */

import React from 'react';
import { X, Sparkles, Download, Layers, ShieldCheck, AlertTriangle, Calendar, HardDrive } from 'lucide-react';
import { CameraImageRecord } from '../types/robot.js';

interface CameraGalleryModalProps {
  image: CameraImageRecord | null;
  onClose: () => void;
  onTriggerAiAnalysis: (imageId: string) => Promise<void>;
  isAnalyzing: boolean;
}

export const CameraGalleryModal: React.FC<CameraGalleryModalProps> = ({
  image,
  onClose,
  onTriggerAiAnalysis,
  isAnalyzing,
}) => {
  if (!image) return null;

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Optical Frame Inspection · <span className="font-mono text-sky-400">{image.imageId}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Display */}
        <div className="relative bg-slate-950 flex items-center justify-center overflow-hidden aspect-[4/3] max-h-[50vh]">
          <img
            src={image.url}
            alt="ESP32-CAM captured frame"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Metadata & AI Vision Panel */}
        <div className="p-5 overflow-y-auto space-y-4 bg-slate-900">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Capture Timestamp</span>
              <span className="text-slate-200 tabular-nums">{formatDate(image.createdAt)}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Payload Size</span>
              <span className="text-slate-200 tabular-nums">{(image.size / 1024).toFixed(1)} KB</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Resolution</span>
              <span className="text-slate-200 tabular-nums">640 x 480 VGA</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Cloud Storage URI</span>
              <span className="text-slate-200 truncate block text-[11px]" title={image.storagePath}>
                {image.storagePath.split('/').pop()}
              </span>
            </div>
          </div>

          {/* AI Vision Section */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Gemini 3.8 Multimodal Vision Analysis
              </span>
              <button
                onClick={() => onTriggerAiAnalysis(image.imageId)}
                disabled={isAnalyzing}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing Frame...' : 'Run Vision Scan'}</span>
              </button>
            </div>

            {image.aiAnalysis ? (
              <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Clearance Status:</span>
                  {image.aiAnalysis.isSafeToAdvance ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Path Safe to Advance
                    </span>
                  ) : (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Obstacle Hazard Detected
                    </span>
                  )}
                </div>
                <p className="text-slate-300 leading-relaxed font-sans">
                  {image.aiAnalysis.summary}
                </p>
                {image.aiAnalysis.detectedObstacles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {image.aiAnalysis.detectedObstacles.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[11px]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 pt-1">
                No vision analysis performed on this frame yet. Click "Run Vision Scan" to evaluate obstacles and humans.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
