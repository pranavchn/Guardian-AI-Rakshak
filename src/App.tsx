/**
 * Smart Rakshak — Cloud Robot Control Center
 * Multi-Mission Physical AI Robot Platform
 */

import React, { useState } from 'react';
import { useRobotControl } from './hooks/useRobotControl.js';
import { Header } from './components/Header.js';
import { CameraView } from './components/CameraView.js';
import { MovementControlPad } from './components/MovementControlPad.js';
import { RobotStatusCard } from './components/RobotStatusCard.js';
import { AiControlCard } from './components/AiControlCard.js';
import { CommandHistoryTable } from './components/CommandHistoryTable.js';
import { CameraGalleryModal } from './components/CameraGalleryModal.js';
import { ArchitectureDocs } from './components/ArchitectureDocs.js';
import { HardwareSimulator } from './components/HardwareSimulator.js';
import { RobotModesTab } from './components/RobotModesTab.js';
import { LayoutDashboard, Bot } from 'lucide-react';
import { CameraImageRecord, RobotCommandType } from './types/robot.js';

export default function App() {
  const {
    robotId,
    status,
    config,
    firestoreInfo,
    pendingCommands,
    commandHistory,
    images,
    logs,
    isLoading,
    isCapturing,
    activePressedCommand,
    holdToRun,
    setHoldToRun,
    speed,
    servoAngle,
    lastActionStatus,
    sendCommand,
    sendEmergencyStop,
    handleMovementPress,
    handleMovementRelease,
    handleSpeedChange,
    handleServoChange,
    triggerCameraCapture,
    updateModeConfig,
    simulateCycle,
    refreshData,
  } = useRobotControl('SR-01');

  const [selectedImage, setSelectedImage] = useState<CameraImageRecord | null>(null);
  const [isArchitectureDocsOpen, setIsArchitectureDocsOpen] = useState<boolean>(false);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState<boolean>(false);
  const [activeMainTab, setActiveMainTab] = useState<'control' | 'modes'>('control');

  // Trigger Gemini Vision Analysis
  const handleTriggerAiAnalysis = async (imageId?: string) => {
    setIsAnalyzingVision(true);
    try {
      const res = await fetch('/api/ai/vision-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, robotId }),
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (selectedImage && selectedImage.imageId === data.imageId) {
          setSelectedImage(data.updatedImage);
        }
        refreshData();
      }
    } catch (err) {
      console.warn('Vision analysis notice:', err);
    } finally {
      setIsAnalyzingVision(false);
    }
  };

  // Toggle DEMO vs LIVE mode
  const handleToggleDemoMode = () => {
    const nextMode = config.mode === 'DEMO' ? 'LIVE' : 'DEMO';
    updateModeConfig({ mode: nextMode });
  };

  // Toggle CLOUD vs LOCAL mode
  const handleToggleControlMode = () => {
    const nextControl = config.controlMode === 'CLOUD' ? 'LOCAL' : 'CLOUD';
    updateModeConfig({ controlMode: nextControl });
  };

  const lastCommand = commandHistory[0] || pendingCommands[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <Header
        status={status}
        config={config}
        onEmergencyStop={sendEmergencyStop}
        onToggleDemoMode={handleToggleDemoMode}
        onToggleControlMode={handleToggleControlMode}
        onOpenDocs={() => setIsArchitectureDocsOpen(true)}
      />

      {/* Primary Navigation Tabs */}
      <nav aria-label="Application Tabs" className="border-b border-slate-800 bg-slate-950/80 backdrop-blur px-4 sm:px-6 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveMainTab('control')}
              className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                activeMainTab === 'control'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Control Center</span>
            </button>

            <button
              onClick={() => setActiveMainTab('modes')}
              className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all relative ${
                activeMainTab === 'modes'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Robot Modes </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold uppercase ${
                activeMainTab === 'modes'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                3 Personas
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {activeMainTab === 'control'
                ? 'Standard Pilot & Telemetry View'
                : '1 Robot · Helper, Guardian & Protection Modes'}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Command Dashboard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeMainTab === 'control' ? (
          <>
            {/* Top 3-Column Responsive Control Grid: Camera (Left), Drive Pad (Center), Diagnostics (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Optical Feed & Camera HUD (4 cols on desktop) */}
              <section className="lg:col-span-4 flex flex-col">
                <CameraView
                  status={status}
                  images={images}
                  isCapturing={isCapturing}
                  onCapture={triggerCameraCapture}
                  onSelectImage={(img) => setSelectedImage(img)}
                  onTriggerAiAnalysis={handleTriggerAiAnalysis}
                  isAnalyzingVision={isAnalyzingVision}
                />
              </section>

              {/* Center Column: Tactile Movement Pad & Motors (4 cols on desktop) */}
              <section className="lg:col-span-4 flex flex-col">
                <MovementControlPad
                  status={status}
                  speed={speed}
                  servoAngle={servoAngle}
                  activePressedCommand={activePressedCommand}
                  holdToRun={holdToRun}
                  onSetHoldToRun={setHoldToRun}
                  onPress={handleMovementPress}
                  onRelease={handleMovementRelease}
                  onSpeedChange={handleSpeedChange}
                  onServoChange={handleServoChange}
                  onEmergencyStop={sendEmergencyStop}
                  lastActionStatus={lastActionStatus}
                />
              </section>

              {/* Right Column: Status & Natural Language AI (4 cols on desktop) */}
              <section className="lg:col-span-4 flex flex-col space-y-6">
                <RobotStatusCard
                  status={status}
                  config={config}
                  firestoreInfo={firestoreInfo}
                  pendingCommands={pendingCommands}
                  lastCommand={lastCommand}
                />

                <AiControlCard
                  robotId={robotId}
                  onExecuteCommand={(cmd, opts) => {
                    sendCommand(cmd, {
                      speedOverride: opts.speed,
                      servoOverride: opts.servo,
                      source: 'AI_NATURAL_LANGUAGE',
                    });
                  }}
                />
              </section>
            </div>

            {/* Bottom Section: Command Queue & Hardware History */}
            <section>
              <CommandHistoryTable
                pendingCommands={pendingCommands}
                commandHistory={commandHistory}
                onRefresh={refreshData}
              />
            </section>

            {/* Bottom Section: Hardware Simulator & Cloud Run stdout */}
            <section>
              <HardwareSimulator
                config={config}
                onUpdateConfig={updateModeConfig}
                onSimulateCycle={simulateCycle}
                onTriggerCapture={triggerCameraCapture}
                logs={logs}
              />
            </section>
          </>
        ) : (
          <RobotModesTab
            status={status}
            config={config}
            onExecuteCommand={(cmd, opts) => {
              sendCommand(cmd, {
                speedOverride: opts?.speed,
                servoOverride: opts?.servo,
                source: opts?.source || 'AI_NATURAL_LANGUAGE',
              });
            }}
            onTriggerCapture={triggerCameraCapture}
            images={images}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Smart Rakshak</span>
            <span>·</span>
            <span>Cloud Robot Control Center</span>
            <span>·</span>
            <span>Multi-Mission Physical AI Robot</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsArchitectureDocsOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              View System Architecture & Firmware Blueprint
            </button>
            <span>·</span>
            <span>Google Cloud Run</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CameraGalleryModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
        onTriggerAiAnalysis={handleTriggerAiAnalysis}
        isAnalyzing={isAnalyzingVision}
      />

      <ArchitectureDocs
        isOpen={isArchitectureDocsOpen}
        onClose={() => setIsArchitectureDocsOpen(false)}
      />
    </div>
  );
}
