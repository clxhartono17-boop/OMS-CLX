/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Google Apps Script Deployment & Code Exporter Modal
 * Provides direct 1-click copy & download for Code.gs and Index.html
 * with step-by-step guidance to fix version deployment mismatch.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle,
  FileCode,
  Layers,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';

interface GASDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GASDeploymentModal: React.FC<GASDeploymentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'index' | 'code' | 'guide'>('index');
  const [indexHtmlCode, setIndexHtmlCode] = useState<string>('Memuat Index.html…');
  const [codeGsCode, setCodeGsCode] = useState<string>('Memuat Code.gs…');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/gas/index')
        .then((res) => res.text())
        .then((text) => setIndexHtmlCode(text))
        .catch(() => setIndexHtmlCode('<!-- Gagal memuat Index.html -->'));

      fetch('/api/gas/code')
        .then((res) => res.text())
        .then((text) => setCodeGsCode(text))
        .catch(() => setCodeGsCode('// Gagal memuat Code.gs'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(label);
    setTimeout(() => setCopiedType(null), 3000);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#091a2e] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base tracking-tight text-white">
                Panduan &amp; Salin Skrip Google Apps Script (CLX V8.0)
              </h2>
              <p className="text-xs text-slate-400">
                Solusi agar tampilan Web App di Google Spreadsheet 100% identik dengan Preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnosis Alert Banner */}
        <div className="p-3.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <b>Mengapa hasil deploy Anda masih berformat lama?</b>
            <div className="mt-0.5 text-amber-800">
              Di Google Apps Script ada <b>2 file terpisah</b>: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">Code.gs</code> dan <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">Index.html</code>. Di screenshot Anda, file <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">Index.html</code> masih berupa template awal lama. Selain itu, saat deploy Anda wajib memilih opsi <b>"Versi Baru" (New Version)</b>.
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 border-b border-slate-200 bg-slate-50">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('index')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'index'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-600" />
              1. File: Index.html (Tampilan UI Modern)
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'code'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-sky-600" />
              2. File: Code.gs (Backend &amp; RBAC)
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'guide'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-slate-500" />
              3. Langkah Deploy 4 Menit
            </button>
          </div>

          {activeTab !== 'guide' && (
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={() =>
                  handleCopy(
                    activeTab === 'index' ? indexHtmlCode : codeGsCode,
                    activeTab === 'index' ? 'Index.html' : 'Code.gs'
                  )
                }
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedType === (activeTab === 'index' ? 'Index.html' : 'Code.gs')
                  ? 'Tersalin ke Clipboard!'
                  : `Salin Seluruh ${activeTab === 'index' ? 'Index.html' : 'Code.gs'}`}
              </button>

              <button
                onClick={() =>
                  handleDownload(
                    activeTab === 'index' ? indexHtmlCode : codeGsCode,
                    activeTab === 'index' ? 'Index.html' : 'Code.gs'
                  )
                }
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {activeTab === 'index' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                <div>
                  <b>File ini yang mengatur Tampilan Modern, Tab Role, dan Peta GIS!</b>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Pastikan Anda membuat atau mengganti file <b>Index.html</b> di Apps Script dengan kode di bawah ini.
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(indexHtmlCode, 'Index.html')}
                  className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 whitespace-nowrap"
                >
                  {copiedType === 'Index.html' ? '✓ Tersalin!' : 'Salin Index.html'}
                </button>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={indexHtmlCode}
                  className="w-full h-80 sm:h-96 text-[11px] font-mono p-3 bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:outline-hidden resize-none selection:bg-emerald-700"
                />
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-center justify-between">
                <div>
                  <b>File ini adalah Backend Server (Code.gs)</b>
                  <div className="text-[11px] text-sky-700 mt-0.5">
                    Mengatur hak akses RBAC (Mitra &amp; Teknisi dilarang upload Excel/Database/Bulk WA) dan operasi 16 Sheets.
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(codeGsCode, 'Code.gs')}
                  className="px-3 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 whitespace-nowrap"
                >
                  {copiedType === 'Code.gs' ? '✓ Tersalin!' : 'Salin Code.gs'}
                </button>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={codeGsCode}
                  className="w-full h-80 sm:h-96 text-[11px] font-mono p-3 bg-slate-900 text-sky-300 rounded-xl border border-slate-800 focus:outline-hidden resize-none selection:bg-sky-700"
                />
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  4 Langkah Pasti Berhasil Deploy di Google Spreadsheet Anda:
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <span className="font-black text-emerald-700 text-[11px] uppercase tracking-wider block">
                      Langkah 1: Buka Editor Apps Script
                    </span>
                    <p className="text-slate-600 leading-relaxed">
                      Buka Google Spreadsheet CLX Anda, klik menu atas: <b>Ekstensi &gt; Apps Script</b>.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <span className="font-black text-emerald-700 text-[11px] uppercase tracking-wider block">
                      Langkah 2: Ganti Isi Code.gs
                    </span>
                    <p className="text-slate-600 leading-relaxed">
                      Klik file <b>Code.gs</b> di sebelah kiri, hapus seluruh isi lama (Ctrl+A lalu Del), paste kode dari tab <b>2. File: Code.gs</b>, lalu tekan <b>Ctrl + S</b> (Simpan).
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <span className="font-black text-emerald-700 text-[11px] uppercase tracking-wider block">
                      Langkah 3: Ganti Isi Index.html
                    </span>
                    <p className="text-slate-600 leading-relaxed">
                      Klik file <b>Index.html</b> di sebelah kiri (jika belum ada, klik tombol <b>+</b> &gt; <b>HTML</b> beri nama <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">Index</code>). Hapus seluruh isi lama, paste kode dari tab <b>1. File: Index.html</b>, lalu tekan <b>Ctrl + S</b> (Simpan).
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/60 space-y-1.5">
                    <span className="font-black text-emerald-800 text-[11px] uppercase tracking-wider block">
                      Langkah 4 (KUNCI): Deploy Versi Baru
                    </span>
                    <p className="text-emerald-950 leading-relaxed">
                      Klik tombol biru kanan atas <b>Terapkan (Deploy) &gt; Kelola deployment (Manage deployments)</b>.
                      <br />
                      Klik ikon <b>Pensil (Edit)</b> &gt; Pada dropdown Versi pilih <b>"Versi Baru" (New version)</b> &gt; Klik <b>Terapkan (Deploy)</b>. Buka URL Web App yang baru!
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 rounded-lg text-[11px] text-slate-600">
                  💡 <b>Catatan Penting:</b> Jika Anda tidak memilih <i>"Versi Baru" (New Version)</i> saat mengelola deployment, Google Apps Script akan terus menampilkan kode versi lama yang tersimpan di cache Google.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            CLX Operation Management System · Versi 8.0 (RBAC Protected)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
