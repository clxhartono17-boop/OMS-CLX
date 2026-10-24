/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Mitra / Team Leader View
 */

import React, { useState } from 'react';
import {
  WorkflowTask,
  UserMaster,
  SiteMaster,
} from '../types/oms';
import {
  Users,
  UserPlus,
  ClipboardCheck,
  CheckCircle,
  Clock,
  Send,
  AlertCircle,
} from 'lucide-react';

interface MitraViewProps {
  currentUser: UserMaster;
  tasks: WorkflowTask[];
  sites: SiteMaster[];
  technicians: UserMaster[];
  onRegisterTechnician: (name: string, email: string) => Promise<void>;
  onAssignTechnician: (taskId: string, technicianEmail: string) => Promise<void>;
  onStartSelfPM: (siteKey: string) => Promise<void>;
  onRefresh: () => void;
}

export const MitraView: React.FC<MitraViewProps> = ({
  currentUser,
  tasks,
  sites,
  technicians,
  onRegisterTechnician,
  onAssignTechnician,
  onStartSelfPM,
  onRefresh,
}) => {
  const [techName, setTechName] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [regStatus, setRegStatus] = useState('');
  const [selectedTechs, setSelectedTechs] = useState<Record<string, string>>({});

  // Filter tasks belonging to this Mitra
  const mitraTasks = tasks.filter(
    (t) => String(t.mitra).toUpperCase() === String(currentUser.mitra).toUpperCase()
  );

  // Available technicians belonging to this Mitra
  const myTechnicians = technicians.filter(
    (u) =>
      u.role === 'Technician' &&
      String(u.mitra).toUpperCase() === String(currentUser.mitra).toUpperCase() &&
      u.active
  );

  // Filter sites belonging to this Mitra
  const mySites = sites.filter(
    (s) => String(s.teamLead).toUpperCase() === String(currentUser.mitra).toUpperCase()
  );

  // Register technician handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techName.trim() || !techEmail.trim()) {
      setRegStatus('Nama dan Email teknisi wajib diisi');
      return;
    }

    try {
      await onRegisterTechnician(techName.trim(), techEmail.trim());
      setRegStatus(`Teknisi ${techName} berhasil didaftarkan untuk ${currentUser.mitra}`);
      setTechName('');
      setTechEmail('');
      setTimeout(() => setRegStatus(''), 4000);
    } catch (err: unknown) {
      setRegStatus(`Gagal: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTechSelectChange = (taskId: string, email: string) => {
    setSelectedTechs((prev) => ({ ...prev, [taskId]: email }));
  };

  const handleAssignClick = async (taskId: string) => {
    const techEmail = selectedTechs[taskId];
    if (!techEmail) {
      alert('Pilih teknisi terlebih dahulu pada menu dropdown');
      return;
    }
    await onAssignTechnician(taskId, techEmail);
  };

  // Metrics calculation
  const totalTasks = mitraTasks.length;
  const ttCount = mitraTasks.filter((t) => t.taskType === 'TT').length;
  const pmCount = mitraTasks.filter((t) => t.taskType === 'PM').length;
  const waitingReview = mitraTasks.filter(
    (t) => t.status === 'COMPLETED_WAITING_REVIEW'
  ).length;
  const solved = mitraTasks.filter((t) => t.status === 'CLOSED').length;
  const outstanding = mitraTasks.filter((t) => !['CLOSED', 'CANCELLED'].includes(t.status)).length;

  return (
    <div className="space-y-6">
      {/* 1. Mitra KPI Header Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              Dashboard Team Leader: {currentUser.mitra}
            </h3>
            <p className="text-xs text-slate-500">
              Monitoring alokasi teknisi, target SLA, dan pemeliharaan mandiri site
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Refresh Data ↻
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Task
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{totalTasks}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Trouble Ticket
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{ttCount}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Preventive Maint
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{pmCount}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Outstanding
            </span>
            <div className="text-xl font-bold font-mono text-amber-600 mt-0.5">{outstanding}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
              Waiting Review
            </span>
            <div className="text-xl font-bold font-mono text-sky-600 mt-0.5">{waitingReview}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Closed / Solved
            </span>
            <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">{solved}</div>
          </div>
        </div>
      </div>

      {/* 2. Register Technician Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-600" />
          Daftarkan Akun Teknisi Lapangan
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Teknisi otomatis terikat ke {currentUser.mitra}. Akun langsung aktif di 08 USER MASTER.
        </p>

        <form onSubmit={handleRegister} className="flex flex-col sm:flex-row items-stretch gap-3">
          <input
            type="text"
            placeholder="Nama Lengkap Teknisi (misal: Dimas Aditya)"
            value={techName}
            onChange={(e) => setTechName(e.target.value)}
            className="flex-1 text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="email"
            placeholder="Email Google Teknisi (dimas.tech@clx.co.id)"
            value={techEmail}
            onChange={(e) => setTechEmail(e.target.value)}
            className="flex-1 text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            Daftarkan Teknisi
          </button>
        </form>

        {regStatus && (
          <div className="mt-3 text-xs p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{regStatus}</span>
          </div>
        )}
      </div>

      {/* 3. Task Allocation Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-emerald-600" />
          Penugasan Teknisi untuk Task Mitra ({mitraTasks.length} Task)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Pilih teknisi pelaksana untuk tiket yang telah di-assign oleh Coordinator ke Mitra Anda.
        </p>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f233a] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Task ID</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Site Location</th>
                <th className="p-3">Status Saat Ini</th>
                <th className="p-3">Teknisi Bertugas</th>
                <th className="p-3">Alokasikan Teknisi</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mitraTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Belum ada task yang dialokasikan ke Mitra Anda.
                  </td>
                </tr>
              ) : (
                mitraTasks.map((t) => (
                  <tr key={t.taskId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">{t.taskId}</td>
                    <td className="p-3 font-semibold">{t.taskType}</td>
                    <td className="p-3 font-medium text-slate-900">{t.siteName}</td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-700">{t.status}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">
                      {t.technicianName ? (
                        <span className="text-emerald-700 font-semibold">{t.technicianName}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Belum ditugaskan</span>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={selectedTechs[t.taskId] || t.technicianEmail || ''}
                        onChange={(e) => handleTechSelectChange(t.taskId, e.target.value)}
                        className="text-xs border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 w-48"
                      >
                        <option value="">Pilih teknisi…</option>
                        {myTechnicians.map((tech) => (
                          <option key={tech.email} value={tech.email}>
                            {tech.name} ({tech.email})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleAssignClick(t.taskId)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                      >
                        Assign
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. PM Mandiri — Site Belum PM */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          PM Mandiri — Site Terpetakan ke Mitra Anda
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Team Leader Mitra dapat langsung menginisiasi PM mandiri untuk site binaannya tanpa menunggu tiket dari Coordinator.
        </p>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f233a] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Site Location</th>
                <th className="p-3">Kabinet S/N</th>
                <th className="p-3">Station Code</th>
                <th className="p-3">Operational</th>
                <th className="p-3 text-right">Aksi PM Mandiri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mySites.map((s) => (
                <tr key={s.siteKey} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-slate-900">{s.locationName}</td>
                  <td className="p-3 font-mono text-[11px]">{s.cabinetSN}</td>
                  <td className="p-3 font-mono text-[11px]">{s.stationCode}</td>
                  <td className="p-3">
                    <span
                      className={`text-[11px] font-bold ${
                        s.operational === 'AVAILABLE'
                          ? 'text-emerald-600'
                          : s.operational === 'UNAVAILABLE'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {s.operational}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onStartSelfPM(s.siteKey)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold"
                    >
                      Mulai PM Mandiri
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
