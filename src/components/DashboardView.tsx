/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Dashboard View
 */

import React from 'react';
import {
  DashboardSummary,
  MitraPerformance,
  SiteMaster,
  TaskActivity,
} from '../types/oms';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  sites: SiteMaster[];
  mitraPerformance: MitraPerformance[];
  recentActivities: TaskActivity[];
  onNavigateToTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  sites,
  mitraPerformance,
  recentActivities,
  onNavigateToTab,
}) => {
  return (
    <div className="space-y-6">
      {/* SLA Breach Alert Banner if any */}
      {summary && summary.slaBreachCount > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Peringatan SLA Terdeteksi ({summary.slaBreachCount} Tiket Melebihi Batas 12 Jam)
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Segera tindak lanjuti Trouble Ticket yang belum terselesaikan untuk mencegah downtime BSS berlarut.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('tt_queue')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-xs"
          >
            Lihat Tiket
          </button>
        </div>
      )}

      {/* Top Operational KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total BSS Site
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono tabular-nums">
            {summary?.totalSites ?? sites.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Master Aktif
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Available
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono tabular-nums">
            {summary?.availableSites ?? sites.filter((s) => s.operational === 'AVAILABLE').length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Siap Swap Baterai
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" />
            Unavailable
          </span>
          <div className="text-2xl font-black text-red-600 mt-1 font-mono tabular-nums">
            {summary?.unavailableSites ?? sites.filter((s) => s.operational === 'UNAVAILABLE').length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Offline / Power Cut
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            Faulted Slot
          </span>
          <div className="text-2xl font-black text-amber-600 mt-1 font-mono tabular-nums">
            {summary?.faultedSites ?? sites.filter((s) => s.operational === 'FAULTED').length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Degradasi Sebagian
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            TT Outstanding
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono tabular-nums">
            {summary?.unassignedTTCount ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Belum Di-assign
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Siklus PM 15-15
          </span>
          <div className="text-xs font-bold text-slate-800 mt-2 font-mono">
            {summary?.activeCycle.start.slice(5)} s/d {summary?.activeCycle.end.slice(5)}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
            Periode Berjalan
          </span>
        </div>
      </div>

      {/* Main Content Split: Mitra Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mitra Performance Leaderboard */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Performa Mitra Lapangan (SLA & PM)</h3>
              <p className="text-xs text-slate-500">
                Pencapaian SLA 12 Jam, Task Solved, dan Realisasi PM Siklus Berjalan
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('tt_queue')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Kelola Penugasan →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="pb-2.5">Mitra / Tim</th>
                  <th className="pb-2.5 text-center">Total Site</th>
                  <th className="pb-2.5 text-center">Solved</th>
                  <th className="pb-2.5 text-center">Outstanding</th>
                  <th className="pb-2.5 text-center">SLA Met %</th>
                  <th className="pb-2.5 text-center">PM Achievement %</th>
                  <th className="pb-2.5 text-right">Skor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mitraPerformance.map((m) => (
                  <tr key={m.mitra} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-bold text-slate-900">{m.mitra}</td>
                    <td className="py-3 text-center font-mono">{m.totalSites}</td>
                    <td className="py-3 text-center font-mono text-emerald-600 font-semibold">
                      {m.solved}
                    </td>
                    <td className="py-3 text-center font-mono text-amber-600 font-semibold">
                      {m.outstanding}
                    </td>
                    <td className="py-3 text-center font-mono tabular-nums">
                      <span className="font-semibold text-slate-800">{m.slaMetPercent}%</span>
                    </td>
                    <td className="py-3 text-center font-mono tabular-nums">
                      <span className="font-semibold text-slate-800">
                        {m.pmAchievementPercent}%
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-black text-emerald-600 text-sm">
                      {m.performanceScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Audit Log Feed */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Aktivitas Lapangan Terbaru
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">14 AUDIT LOG</span>
          </div>

          <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
            {recentActivities.slice(0, 7).map((act) => (
              <div key={act.id} className="text-xs border-b border-slate-100 pb-3 last:border-none">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700">{act.action}</span>
                  <span className="text-[10px] font-mono">
                    {new Date(act.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-slate-800 font-mono text-[11px] truncate">
                  Task: {act.taskId}
                </div>
                {act.remarks && (
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{act.remarks}</p>
                )}
                <div className="text-[10px] text-slate-400 mt-1">Oleh: {act.actorEmail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
