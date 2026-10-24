/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Field Technician View
 * Mobile-First Android touch ergonomics with offline draft auto-save and GPS camera watermarking.
 */

import React, { useState, useEffect } from 'react';
import {
  WorkflowTask,
  UserMaster,
  WorkEvidence,
} from '../types/oms';
import { GpsCameraWatermark } from './GpsCameraWatermark';
import {
  HardHat,
  CheckCircle,
  Navigation,
  MapPin,
  Save,
  Send,
  Camera,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface TechnicianViewProps {
  currentUser: UserMaster;
  tasks: WorkflowTask[];
  onTaskAction: (data: {
    taskId: string;
    action: string;
    location?: string;
    evidenceUrl?: string;
    issueDetail?: string;
    rca1?: string;
    rca2?: string;
    correctiveAction?: string;
    reportSummary?: string;
    cmStatus?: string;
    note?: string;
  }) => Promise<void>;
  onUploadEvidence: (data: {
    taskId: string;
    evidenceType: 'CLOCK_IN' | 'CLOCK_OUT' | 'CM_PROGRESS';
    data: string;
    description?: string;
    geo?: {
      lat: number;
      lon: number;
      accuracy: number;
      timestamp: string;
    };
  }) => Promise<void>;
  onRefresh: () => void;
  onOpenPMChecklist: (taskId: string) => void;
}

export const TechnicianView: React.FC<TechnicianViewProps> = ({
  currentUser,
  tasks,
  onTaskAction,
  onUploadEvidence,
  onRefresh,
  onOpenPMChecklist,
}) => {
  // My tasks
  const myTasks = tasks.filter(
    (t) =>
      t.technicianEmail &&
      t.technicianEmail.toLowerCase() === currentUser.email.toLowerCase()
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    myTasks[0]?.taskId || ''
  );

  // Form fields
  const [issueDetail, setIssueDetail] = useState('');
  const [rca1, setRca1] = useState('');
  const [rca2, setRca2] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [cmStatus, setCmStatus] = useState('');
  const [cmNote, setCmNote] = useState('');

  // Clock evidence states
  const [clockInLocation, setClockInLocation] = useState('');
  const [clockInEvidenceUrl, setClockInEvidenceUrl] = useState('');
  const [clockOutLocation, setClockOutLocation] = useState('');
  const [clockOutEvidenceUrl, setClockOutEvidenceUrl] = useState('');

  // Progress photos
  const [progressPhotos, setProgressPhotos] = useState<string[]>([]);

  // Action status message
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const currentTask = tasks.find((t) => t.taskId === selectedTaskId);

  // Restore task data & offline draft when task selection changes
  useEffect(() => {
    if (!selectedTaskId) return;

    // Load from active task properties
    if (currentTask) {
      setIssueDetail(currentTask.issueDetail || '');
      setRca1(currentTask.rca1 || '');
      setRca2(currentTask.rca2 || '');
      setCorrectiveAction(currentTask.correctiveAction || '');
      setReportSummary(currentTask.reportSummary || '');
      setClockInLocation(currentTask.checkInLocation || '');
      setClockInEvidenceUrl(currentTask.checkInEvidenceUrl || '');
      setClockOutLocation(currentTask.checkOutLocation || '');
      setClockOutEvidenceUrl(currentTask.checkOutEvidenceUrl || '');
    }

    // Check localStorage offline draft
    try {
      const saved = localStorage.getItem(`clx_draft_${selectedTaskId}`);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.issueDetail) setIssueDetail(draft.issueDetail);
        if (draft.rca1) setRca1(draft.rca1);
        if (draft.rca2) setRca2(draft.rca2);
        if (draft.correctiveAction) setCorrectiveAction(draft.correctiveAction);
        if (draft.reportSummary) setReportSummary(draft.reportSummary);
        if (draft.cmStatus) setCmStatus(draft.cmStatus);
        if (draft.cmNote) setCmNote(draft.cmNote);
        setDraftSavedAt(draft.savedAt || 'Tersimpan lokal');
      }
    } catch (e) {
      console.warn('Could not read draft from localStorage', e);
    }
  }, [selectedTaskId]);

  // Auto-save draft to LocalStorage
  const saveOfflineDraft = () => {
    if (!selectedTaskId) return;
    try {
      const draft = {
        issueDetail,
        rca1,
        rca2,
        correctiveAction,
        reportSummary,
        cmStatus,
        cmNote,
        savedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      localStorage.setItem(`clx_draft_${selectedTaskId}`, JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  };

  const handleAction = async (action: string) => {
    if (!selectedTaskId) {
      alert('Pilih task terlebih dahulu');
      return;
    }

    setSubmitting(true);
    setActionMsg(null);

    try {
      const payload: Record<string, string | undefined> = {
        taskId: selectedTaskId,
        action,
        issueDetail,
        rca1,
        rca2,
        correctiveAction,
        reportSummary,
        cmStatus,
        note: cmNote,
      };

      if (action === 'CHECK_IN') {
        if (!clockInLocation || !clockInEvidenceUrl) {
          throw new Error('Ambil foto Clock In menggunakan kamera berstempel GPS terlebih dahulu');
        }
        payload.location = clockInLocation;
        payload.evidenceUrl = clockInEvidenceUrl;
      } else if (action === 'CHECK_OUT') {
        if (!clockOutLocation || !clockOutEvidenceUrl) {
          throw new Error('Ambil foto Clock Out menggunakan kamera berstempel GPS terlebih dahulu');
        }
        payload.location = clockOutLocation;
        payload.evidenceUrl = clockOutEvidenceUrl;
      } else if (action === 'SUBMIT') {
        if (!issueDetail.trim() || !rca1.trim() || !rca2.trim() || !correctiveAction.trim()) {
          throw new Error('Detail Issue, RCA 1, RCA 2, dan Corrective Action wajib diisi lengkap');
        }
        if (!clockInEvidenceUrl) {
          throw new Error('Foto Clock In bertimestamp & GPS wajib diambil');
        }
        if (!clockOutEvidenceUrl) {
          throw new Error('Foto Clock Out bertimestamp & GPS wajib diambil');
        }
      }

      await onTaskAction(payload as any);
      saveOfflineDraft();
      setActionMsg({ type: 'success', text: `Aksi ${action} berhasil diproses!` });
    } catch (err: unknown) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Clock In capture handler
  const handleClockInCapture = async (result: {
    dataUrl: string;
    location: string;
    geo: { lat: number; lon: number; accuracy: number; timestamp: string };
  }) => {
    setClockInLocation(result.location);
    setClockInEvidenceUrl(result.dataUrl);

    try {
      await onUploadEvidence({
        taskId: selectedTaskId,
        evidenceType: 'CLOCK_IN',
        data: result.dataUrl,
        description: `Clock In GPS: ${result.location}`,
        geo: result.geo,
      });
    } catch (e) {
      console.warn('Clock in evidence background upload', e);
    }
  };

  // Clock Out capture handler
  const handleClockOutCapture = async (result: {
    dataUrl: string;
    location: string;
    geo: { lat: number; lon: number; accuracy: number; timestamp: string };
  }) => {
    setClockOutLocation(result.location);
    setClockOutEvidenceUrl(result.dataUrl);

    try {
      await onUploadEvidence({
        taskId: selectedTaskId,
        evidenceType: 'CLOCK_OUT',
        data: result.dataUrl,
        description: `Clock Out GPS: ${result.location}`,
        geo: result.geo,
      });
    } catch (e) {
      console.warn('Clock out evidence background upload', e);
    }
  };

  // Progress photo capture handler (Max 6)
  const handleProgressCapture = async (result: {
    dataUrl: string;
    location: string;
    geo: { lat: number; lon: number; accuracy: number; timestamp: string };
  }) => {
    if (progressPhotos.length >= 6) {
      alert('Maksimal 6 foto progress CM per task.');
      return;
    }

    const updated = [...progressPhotos, result.dataUrl];
    setProgressPhotos(updated);

    try {
      await onUploadEvidence({
        taskId: selectedTaskId,
        evidenceType: 'CM_PROGRESS',
        data: result.dataUrl,
        description: `Progress Foto #${updated.length} GPS: ${result.location}`,
        geo: result.geo,
      });
      setActionMsg({
        type: 'success',
        text: `Foto progress #${updated.length}/6 berhasil diunggah dengan stempel GPS.`,
      });
    } catch (err: unknown) {
      setActionMsg({
        type: 'error',
        text: `Gagal upload foto progress: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Task Selection Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <HardHat className="w-4 h-4 text-amber-500" />
              Task Saya — {currentUser.name} ({myTasks.length} Task Ditugaskan)
            </h3>
            <p className="text-xs text-slate-500">
              Pilih tiket pekerjaan untuk melihat panduan alur dan memulai eksekusi di lapangan
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 self-start sm:self-auto"
          >
            Refresh Task ↻
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {myTasks.length === 0 ? (
            <div className="col-span-full p-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
              Belum ada task yang ditugaskan ke akun Teknisi Anda. Minta Team Leader Mitra Anda
              menugaskan task.
            </div>
          ) : (
            myTasks.map((t) => {
              const isSelected = t.taskId === selectedTaskId;
              return (
                <button
                  key={t.taskId}
                  onClick={() => setSelectedTaskId(t.taskId)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-xs text-slate-900">{t.taskId}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                      {t.taskType}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate">{t.siteName}</div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px]">
                    <span className="font-bold text-emerald-700">{t.status}</span>
                    <span className="text-slate-400 font-mono">{t.cabinetSN}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {currentTask && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
          {/* Active Task Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black text-slate-900">
                  {currentTask.taskId}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Status: {currentTask.status}
                </span>
                {currentTask.taskType === 'PM' && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                    Preventive Maintenance
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">{currentTask.siteName}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Cabinet: {currentTask.cabinetSN} · Station: {currentTask.stationCode || '-'} · Mitra: {currentTask.mitra}
              </p>
            </div>

            {currentTask.taskType === 'PM' && (
              <button
                type="button"
                onClick={() => onOpenPMChecklist(currentTask.taskId)}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start"
              >
                <CheckCircle className="w-4 h-4" />
                Buka Form Checklist PM (10 Item)
              </button>
            )}
          </div>

          {/* Action Alert Message */}
          {actionMsg && (
            <div
              className={`p-3 text-xs rounded-lg flex items-center gap-2 ${
                actionMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {actionMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{actionMsg.text}</span>
            </div>
          )}

          {/* Step 1 & 2: Accept and On The Way */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Langkah 1: Respon Penugasan Lapangan
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={submitting || currentTask.status !== 'ASSIGNED_TO_TECHNICIAN'}
                onClick={() => handleAction('ACCEPT')}
                className="min-h-[48px] px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                1. ACCEPT TASK
              </button>

              <button
                type="button"
                disabled={submitting || currentTask.status !== 'ACCEPTED'}
                onClick={() => handleAction('ON_THE_WAY')}
                className="min-h-[48px] px-4 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                2. ON THE WAY (Menuju Site)
              </button>
            </div>
          </div>

          {/* Step 3: Clock In with Camera */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Langkah 2: Tiba di Site &amp; Clock In GPS
            </span>
            <div className="space-y-3">
              <GpsCameraWatermark
                label="Foto Bukti Kehadiran Site (Clock In)"
                evidenceType="CLOCK_IN"
                onCapture={handleClockInCapture}
                disabled={currentTask.status !== 'ON_THE_WAY' && currentTask.status !== 'IN_PROGRESS'}
              />

              <button
                type="button"
                disabled={submitting || currentTask.status !== 'ON_THE_WAY' || !clockInEvidenceUrl}
                onClick={() => handleAction('CHECK_IN')}
                className="w-full min-h-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4 text-emerald-400" />
                Konfirmasi CLOCK IN (Mulai Pekerjaan)
              </button>
            </div>
          </div>

          {/* Step 4: Progress Photos CM (Max 6) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Langkah 3: Foto Bukti Progress CM (Maks. 6 Foto)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Terkumpul: {progressPhotos.length}/6
              </span>
            </div>

            <GpsCameraWatermark
              label="Ambil Foto Kerusakan / Penggantian Part"
              evidenceType="CM_PROGRESS"
              onCapture={handleProgressCapture}
              disabled={currentTask.status !== 'IN_PROGRESS'}
            />

            {progressPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                {progressPhotos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded">
                      #{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 5: Root Cause Analysis & Corrective Actions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Langkah 4: Laporan Diagnostik &amp; RCA
              </span>
              {draftSavedAt && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Save className="w-3 h-3 text-emerald-600" />
                  Draft otomatis: {draftSavedAt}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detail Issue (Wajib)
                </label>
                <input
                  type="text"
                  placeholder="Misal: BSS offline, modem mati"
                  value={issueDetail}
                  onChange={(e) => {
                    setIssueDetail(e.target.value);
                    saveOfflineDraft();
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RCA 1 (Penyebab Dasar - Wajib)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Adaptor modem 12V putus"
                  value={rca1}
                  onChange={(e) => {
                    setRca1(e.target.value);
                    saveOfflineDraft();
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RCA 2 (Kategori Teknis - Wajib)
                </label>
                <input
                  type="text"
                  placeholder="Misal: HARDWARE_FAILURE"
                  value={rca2}
                  onChange={(e) => {
                    setRca2(e.target.value);
                    saveOfflineDraft();
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Corrective Action (Tindakan Perbaikan - Wajib)
              </label>
              <textarea
                rows={2}
                placeholder="Jelaskan langkah perbaikan yang telah dilakukan di lapangan…"
                value={correctiveAction}
                onChange={(e) => {
                  setCorrectiveAction(e.target.value);
                  saveOfflineDraft();
                }}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status CM (Opsional)
                </label>
                <select
                  value={cmStatus}
                  onChange={(e) => {
                    setCmStatus(e.target.value);
                    saveOfflineDraft();
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Status Normal (Selesai)</option>
                  <option value="Pending">Pending</option>
                  <option value="Need Replacement Part">Need Replacement Part</option>
                  <option value="Need Replacement Material">Need Replacement Material</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Catatan untuk Koordinator/Team Lead…"
                  value={cmNote}
                  onChange={(e) => {
                    setCmNote(e.target.value);
                    saveOfflineDraft();
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ringkasan Laporan Hasil Pekerjaan
              </label>
              <input
                type="text"
                placeholder="Ringkasan singkat hasil uji fungsi BSS…"
                value={reportSummary}
                onChange={(e) => {
                  setReportSummary(e.target.value);
                  saveOfflineDraft();
                }}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Step 6: Clock Out with Camera */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Langkah 5: Clock Out Selesai Pekerjaan
            </span>
            <div className="space-y-3">
              <GpsCameraWatermark
                label="Foto Bukti Clock Out (Kamera HP + GPS)"
                evidenceType="CLOCK_OUT"
                onCapture={handleClockOutCapture}
                disabled={currentTask.status !== 'IN_PROGRESS'}
              />

              <button
                type="button"
                disabled={submitting || currentTask.status !== 'IN_PROGRESS' || !clockOutEvidenceUrl}
                onClick={() => handleAction('CHECK_OUT')}
                className="w-full min-h-[48px] px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                CLOCK OUT (Pekerjaan Selesai di Lokasi)
              </button>
            </div>
          </div>

          {/* Step 7: Final Submission */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAction('SAVE_PROGRESS')}
              className="min-h-[48px] px-5 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4 text-slate-500" />
              Simpan Draft Progress
            </button>

            <button
              type="button"
              disabled={submitting || currentTask.status !== 'READY_TO_SUBMIT'}
              onClick={() => handleAction('SUBMIT')}
              className="min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              SUBMIT UNTUK REVIEW KOORDINATOR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
