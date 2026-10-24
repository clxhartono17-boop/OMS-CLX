/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Coordinator & Admin View
 */

import React, { useState } from 'react';
import {
  TroubleTicket,
  WorkflowTask,
  SiteMaster,
  UserMaster,
} from '../types/oms';
import {
  calculateSlaRemaining,
  generateBulkWhatsAppText,
  generateWhatsAppDeepLink,
} from '../utils/omsLogic';
import {
  Upload,
  Send,
  MessageSquare,
  CheckCircle,
  RotateCcw,
  ExternalLink,
  Copy,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface CoordinatorViewProps {
  currentUser: UserMaster;
  tickets: TroubleTicket[];
  tasks: WorkflowTask[];
  sites: SiteMaster[];
  onRefresh: () => void;
  onAssignTT: (ttId: string, mitra: string) => Promise<void>;
  onBulkAssignTT: (items: Array<{ ttId: string; mitra: string }>) => Promise<void>;
  onReviewTask: (taskId: string, decision: 'APPROVE' | 'REWORK', remarks?: string) => Promise<void>;
  onAssignPM: (siteKey: string, mitra: string) => Promise<void>;
  onUploadExcelSimulation: (fileName: string) => Promise<void>;
}

export const CoordinatorView: React.FC<CoordinatorViewProps> = ({
  currentUser,
  tickets,
  tasks,
  sites,
  onRefresh,
  onAssignTT,
  onBulkAssignTT,
  onReviewTask,
  onAssignPM,
  onUploadExcelSimulation,
}) => {
  const [selectedTTs, setSelectedTTs] = useState<string[]>([]);
  const [waMitra, setWaMitra] = useState<string>('PT MITRA JAYA PERSADA');
  const [waText, setWaText] = useState<string>('');
  const [waCopied, setWaCopied] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [reviewModal, setReviewModal] = useState<{
    taskId: string;
    decision: 'APPROVE' | 'REWORK';
  } | null>(null);
  const [reworkRemarks, setReworkRemarks] = useState<string>('Mohon lengkapi foto bukti checklist PM dan pengetesan swap baterai.');

  // Extract distinct Mitra list from Site Master
  const mitraOptions = Array.from(new Set(sites.map((s) => s.teamLead).filter(Boolean))).sort();

  // Filter unassigned TTs
  const unassignedTTs = tickets.filter((t) => t.statusBSS !== 'Closed' && !t.hasActiveTask);

  // Filter tasks waiting review
  const reviewTasks = tasks.filter((t) => t.status === 'COMPLETED_WAITING_REVIEW');

  // Toggle select all
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTTs(unassignedTTs.map((t) => t.ttId));
    } else {
      setSelectedTTs([]);
    }
  };

  const handleToggleOne = (ttId: string) => {
    setSelectedTTs((prev) =>
      prev.includes(ttId) ? prev.filter((id) => id !== ttId) : [...prev, ttId]
    );
  };

  // Bulk Assign
  const handleBulkAssign = async () => {
    if (!selectedTTs.length) {
      alert('Pilih minimal satu Trouble Ticket untuk Bulk Assign');
      return;
    }

    const items = selectedTTs.map((id) => {
      const t = tickets.find((x) => x.ttId === id);
      return { ttId: id, mitra: t?.pic || mitraOptions[0] || 'PT MITRA JAYA PERSADA' };
    });

    if (
      !window.confirm(
        `Konfirmasi penugasan ${items.length} Trouble Ticket ke Mitra rekanan sesuai mapping Site Master?`
      )
    ) {
      return;
    }

    await onBulkAssignTT(items);
    setSelectedTTs([]);
  };

  // Generate WhatsApp text
  const handleGenerateWA = () => {
    const mitraTTs = tickets
      .filter((t) => t.pic === waMitra && t.statusBSS !== 'Closed')
      .map((t) => ({
        ttId: t.ttId,
        site: t.stationName,
        cabinet: t.serialNumber,
        station: t.stationCode,
        issue: t.faultedAlarm,
        status: t.statusBSS,
        pending: t.date.split('T')[0],
        priority: t.priorities,
      }));

    const text = generateBulkWhatsAppText(waMitra, mitraTTs);
    setWaText(text);
    setWaCopied(false);
  };

  const handleCopyWA = () => {
    if (!waText) return;
    navigator.clipboard.writeText(waText);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 2500);
  };

  // Direct WA Deep link
  const waLink = generateWhatsAppDeepLink('', waText);

  // File Upload simulation
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(`Mengunggah ${file.name} dan merekonsiliasi SiteList…`);

    try {
      await onUploadExcelSimulation(file.name);
      setUploadStatus(`Rekonsiliasi selesai: 1 Site baru terdeteksi, Trouble Ticket baru otomatis dibuat.`);
    } catch (err: unknown) {
      setUploadStatus(`Gagal upload: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Upload File Customer & Reconciliation */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-600" />
          1. Upload File Excel Customer &amp; Rekonsiliasi Otomatis
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Unggah file laporan harian customer (`.xlsx` atau `.xls`). Sistem otomatis memproses SiteList,
          mendeteksi stasiun baru, dan menerbitkan Trouble Ticket untuk sheet With/Without Battery Unavailable.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            disabled={uploading}
            className="text-xs border border-slate-300 rounded-lg p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => onUploadExcelSimulation('Customer_BSS_Daily_Reconcile.xlsx')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          >
            {uploading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Simulasi Upload &amp; Reconcile File BSS
          </button>
        </div>

        {uploadStatus && (
          <div className="mt-3 text-xs p-2.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
            {uploadStatus}
          </div>
        )}
      </div>

      {/* 2. TT Outstanding Queue */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              2. Antrean Trouble Ticket Outstanding ({unassignedTTs.length} Belum Di-assign)
            </h3>
            <p className="text-xs text-slate-500">
              Pilih satu atau beberapa tiket untuk penugasan massal ke Mitra rekanan
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkAssign}
              disabled={!selectedTTs.length}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Bulk Assign ({selectedTTs.length})
            </button>
            <button
              onClick={onRefresh}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Refresh ↻
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f233a] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      unassignedTTs.length > 0 && selectedTTs.length === unassignedTTs.length
                    }
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="p-3">TT ID</th>
                <th className="p-3">Lokasi Site</th>
                <th className="p-3">Kabinet / Station</th>
                <th className="p-3">Issue Alarm</th>
                <th className="p-3">Prioritas</th>
                <th className="p-3">Target SLA 12 Jam</th>
                <th className="p-3">Mitra Terpetakan</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unassignedTTs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400">
                    Tidak ada Trouble Ticket yang belum di-assign. Seluruh tiket telah aktif ditangani.
                  </td>
                </tr>
              ) : (
                unassignedTTs.map((tt) => {
                  const slaInfo = calculateSlaRemaining(tt.sla);
                  return (
                    <tr
                      key={tt.ttId}
                      className={`hover:bg-slate-50 transition-colors ${
                        selectedTTs.includes(tt.ttId) ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedTTs.includes(tt.ttId)}
                          onChange={() => handleToggleOne(tt.ttId)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{tt.ttId}</td>
                      <td className="p-3 font-medium text-slate-900">{tt.stationName}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {tt.serialNumber} <span className="text-slate-300">/</span> {tt.stationCode}
                      </td>
                      <td className="p-3 text-slate-700 max-w-xs truncate" title={tt.faultedAlarm}>
                        {tt.faultedAlarm}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            tt.priorities === 'Priority 1'
                              ? 'text-red-600'
                              : tt.priorities === 'Priority 2'
                              ? 'text-amber-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {tt.priorities}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <span
                          className={`text-[11px] font-semibold ${
                            slaInfo.isBreached ? 'text-red-600 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {slaInfo.label}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {tt.pic || 'Belum ada mapping'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onAssignTT(tt.ttId, tt.pic || mitraOptions[0])}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Bulk WhatsApp Manual per Mitra */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          3. Bulk WhatsApp Dispatch per Mitra (Direct WA Link)
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Hasilkan draf pesan broadcast penugasan tiket terformat standar CLX untuk dikirimkan ke Team Lead Mitra via WhatsApp.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <select
            value={waMitra}
            onChange={(e) => setWaMitra(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {mitraOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerateWA}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
          >
            Generate Template WA
          </button>

          {waText && (
            <>
              <button
                onClick={handleCopyWA}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {waCopied ? 'Tersalin!' : 'Copy Teks'}
              </button>

              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka di WhatsApp Web / App
              </a>
            </>
          )}
        </div>

        <textarea
          value={waText}
          onChange={(e) => setWaText(e.target.value)}
          placeholder="Klik tombol 'Generate Template WA' untuk melihat format pesan broadcast tiket per mitra…"
          rows={5}
          className="w-full text-xs font-mono border border-slate-200 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* 4. Review Laporan TT / PM */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          4. Verifikasi &amp; Review Laporan Task (Menunggu Approval)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Laporan pekerjaan teknisi yang telah di-submit beserta bukti foto GPS Clock In/Out.
        </p>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f233a] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Task ID</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Site</th>
                <th className="p-3">Mitra / Teknisi</th>
                <th className="p-3">Status</th>
                <th className="p-3">Laporan &amp; Bukti Foto</th>
                <th className="p-3 text-right">Aksi Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviewTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Tidak ada task yang sedang menunggu review saat ini.
                  </td>
                </tr>
              ) : (
                reviewTasks.map((t) => (
                  <tr key={t.taskId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">{t.taskId}</td>
                    <td className="p-3 font-semibold">{t.taskType}</td>
                    <td className="p-3 font-medium text-slate-900">{t.siteName}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{t.mitra}</div>
                      <div className="text-slate-500 text-[11px]">{t.technicianName}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 max-w-sm">
                      <p className="line-clamp-2">{t.reportSummary || t.correctiveAction}</p>
                      <div className="flex gap-2 text-[10px] font-semibold text-emerald-600 mt-1">
                        {t.checkInEvidenceUrl && (
                          <a
                            href={t.checkInEvidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline flex items-center gap-0.5"
                          >
                            Clock In Evidence <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {t.checkOutEvidenceUrl && (
                          <a
                            href={t.checkOutEvidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline flex items-center gap-0.5"
                          >
                            Clock Out Evidence <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => onReviewTask(t.taskId, 'APPROVE')}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                      >
                        Approve / Close
                      </button>
                      <button
                        onClick={() =>
                          setReviewModal({ taskId: t.taskId, decision: 'REWORK' })
                        }
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold"
                      >
                        Rework
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. PM Site Candidates (Assign PM to Mitra) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          5. Penugasan Preventive Maintenance (PM) Siklus 15-15
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Daftar stasiun BSS yang belum memiliki jadwal PM pada siklus tanggal 15 s/d 15 berjalan.
        </p>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f233a] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Site Location</th>
                <th className="p-3">Cabinet S/N</th>
                <th className="p-3">Station Code</th>
                <th className="p-3">Mitra Terpetakan</th>
                <th className="p-3">Status Operasional</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.map((s) => (
                <tr key={s.siteKey} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-slate-900">{s.locationName}</td>
                  <td className="p-3 font-mono text-[11px]">{s.cabinetSN}</td>
                  <td className="p-3 font-mono text-[11px]">{s.stationCode}</td>
                  <td className="p-3 font-medium">{s.teamLead}</td>
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
                      onClick={() => onAssignPM(s.siteKey, s.teamLead)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold"
                    >
                      Tugaskan PM
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rework Modal Dialog */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h4 className="font-bold text-sm text-slate-900 mb-2">Instruksi Rework (Perbaikan Laporan)</h4>
            <p className="text-xs text-slate-500 mb-3">
              Jelaskan hal-hal yang perlu dilengkapi atau diperbaiki oleh teknisi sebelum task {reviewModal.taskId} dapat disetujui.
            </p>
            <textarea
              value={reworkRemarks}
              onChange={(e) => setReworkRemarks(e.target.value)}
              rows={3}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 mb-4 focus:ring-2 focus:ring-emerald-500"
              placeholder="Contoh: Bukti foto slot 3 belum jelas, mohon upload ulang foto voltmeter."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewModal(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  await onReviewTask(reviewModal.taskId, 'REWORK', reworkRemarks);
                  setReviewModal(null);
                }}
                className="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
              >
                Kirim Rework ke Teknisi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
