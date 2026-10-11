/**
 * Smart Rakshak — Command Queue & History Table
 * Displays pending queue documents and archived command history
 */

import React, { useState } from 'react';
import {
  ListFilter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { CommandStatus, RobotCommand } from '../types/robot.js';

interface CommandHistoryTableProps {
  pendingCommands: RobotCommand[];
  commandHistory: RobotCommand[];
  onRefresh: () => void;
}

export const CommandHistoryTable: React.FC<CommandHistoryTableProps> = ({
  pendingCommands,
  commandHistory,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'FAILED_OR_EXPIRED'>('ALL');

  const allItems = [...pendingCommands, ...commandHistory];

  const filteredItems = allItems.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return item.status === 'PENDING' || item.status === 'EXECUTING';
    if (filter === 'COMPLETED') return item.status === 'COMPLETED';
    if (filter === 'FAILED_OR_EXPIRED') {
      return item.status === 'FAILED' || item.status === 'EXPIRED' || item.status === 'CANCELLED';
    }
    return true;
  });

  const getStatusIcon = (status: CommandStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case 'EXECUTING':
        return <Play className="w-3.5 h-3.5 text-sky-400 animate-spin" />;
      case 'COMPLETED':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'FAILED':
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'EXPIRED':
        return <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />;
      case 'CANCELLED':
        return <XCircle className="w-3.5 h-3.5 text-rose-300" />;
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Hardware Command Pipeline
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            ({pendingCommands.length} in queue, {commandHistory.length} archived)
          </span>
        </div>

        {/* Filters and Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === 'PENDING'
                  ? 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending ({pendingCommands.length})
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === 'COMPLETED'
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('FAILED_OR_EXPIRED')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === 'FAILED_OR_EXPIRED'
                  ? 'bg-rose-950/70 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Failed / Expired
            </button>
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh history"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-[11px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Command</th>
              <th className="py-2.5 px-3">Command ID</th>
              <th className="py-2.5 px-3">Params</th>
              <th className="py-2.5 px-3">Source</th>
              <th className="py-2.5 px-3">Created</th>
              <th className="py-2.5 px-3">Execution Ack</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredItems.length > 0 ? (
              filteredItems.map((cmd) => (
                <tr key={cmd.commandId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                      {getStatusIcon(cmd.status)}
                      <span
                        className={
                          cmd.status === 'COMPLETED'
                            ? 'text-emerald-400'
                            : cmd.status === 'PENDING'
                            ? 'text-amber-400'
                            : cmd.status === 'EXECUTING'
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }
                      >
                        {cmd.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`font-bold ${
                        cmd.command === 'EMERGENCY_STOP'
                          ? 'text-rose-400'
                          : cmd.command === 'STOP'
                          ? 'text-amber-400'
                          : 'text-slate-100'
                      }`}
                    >
                      {cmd.command}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                    {cmd.commandId}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                    {cmd.speed !== undefined && <span>spd:{cmd.speed} </span>}
                    {cmd.servo !== undefined && <span>pan:{cmd.servo}°</span>}
                    {cmd.speed === undefined && cmd.servo === undefined && <span>—</span>}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                    {cmd.source}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px] tabular-nums">
                    {formatTime(cmd.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 text-[11px] max-w-xs truncate">
                    {cmd.ackDetails?.details ||
                      (cmd.status === 'PENDING' ? 'Waiting for ESP32 polling...' : '—')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500 font-sans text-xs">
                  No commands match the current filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
