/**
 * Smart Rakshak — Cloud Robot Control Center
 * ACEBOTT QD001 Physical Robot Platform
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
  } = useRobotControl('QD001');

  const [selectedImage, setSelectedImage] = useState<CameraImageRecord | null>(null);
  const [isArchitectureDocsOpen, setIsArchitectureDocsOpen] = useState<boolean>(false);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState<boolean>(false);

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
      console.error('Vision analysis error:', err);
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

      {/* Main Command Dashboard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Smart Rakshak</span>
            <span>·</span>
            <span>Cloud Robot Control Center</span>
            <span>·</span>
            <span>Target: ACEBOTT QD001 ESP32-CAM</span>
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
