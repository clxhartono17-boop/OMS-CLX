/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Google Sheets 16-Table Integration & Google Apps Script Exporter
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle,
  Copy,
  Code2,
  FileCode,
  ExternalLink,
  Table,
} from 'lucide-react';

export const SheetsSyncModal: React.FC = () => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState<'code' | 'index'>('code');
  const [codeGsText, setCodeGsText] = useState<string>('Memuat Code.gs…');
  const [indexHtmlText, setIndexHtmlText] = useState<string>('Memuat Index.html…');
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gas/code')
      .then((res) => res.text())
      .then((text) => setCodeGsText(text))
      .catch(() => setCodeGsText('// Gagal memuat Code.gs'));

    fetch('/api/gas/index')
      .then((res) => res.text())
      .then((text) => setIndexHtmlText(text))
      .catch(() => setIndexHtmlText('<!-- Gagal memuat Index.html -->'));
  }, []);

  const sheetsList = [
    { name: '01 DASHBOARD', purpose: 'Agregasi KPI harian, total site, dan kondisi BSS hari ini' },
    { name: '02 DAILY MONITORING', purpose: 'Riwayat data import harian dan transisi status harian' },
    { name: '03 CM MONITORING', purpose: 'Trouble Ticket aktif, riwayat perbaikan korektif & SLA' },
    { name: '04 PM MONITORING', purpose: 'Target harian dan realisasi Preventive Maintenance 15-15' },
    { name: '05 MITRA PERFORMANCE', purpose: 'Evaluasi kinerja mitra, persentase SLA & skor performa' },
    { name: '06 PM VS CM', purpose: 'Analisis perbandingan frekuensi PM terhadap laju timbulnya TT' },
    { name: '07 SITE MASTER', purpose: 'Master data stasiun, kabinet, koordinat GPS & mapping Mitra' },
    { name: '08 USER MASTER', purpose: 'Daftar akun berwenang, role (Admin/Coord/Mitra/Tech) & status' },
    { name: '09 WORKFLOW TASKS', purpose: 'Pusat status workflow pekerjaan, timestamp, dan penugasan' },
    { name: '10 WORK ACTIVITY', purpose: 'Log histori tahapan aksi teknisi per task ID' },
    { name: '11 WORK EVIDENCE', purpose: 'Penyimpanan bukti foto berstempel GPS & timestamp' },
    { name: '12 WORK REVIEW', purpose: 'Keputusan review Koordinator (Approve / Rework)' },
    { name: '13 PM CHECKLIST', purpose: 'Item audit checklist fisik & kelistrikan BSS (OK/NG/NA)' },
    { name: '14 AUDIT LOG', purpose: 'Jejak audit keamanan sistem terhadap seluruh manipulasi data' },
    { name: '15 PM SITE STATUS', purpose: 'Status pencapaian PM per site pada siklus periode aktif' },
    { name: '16 FCM TOKENS', purpose: 'Penyimpanan token push notification FCM Android teknisi' },
  ];

  const handleDownloadExport = () => {
    setDownloading(true);
    setDownloadSuccess(false);

    fetch('/api/export-sheets')
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CLX_OMS_V8_16_Sheets_Export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setDownloading(false);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 4000);
      })
      .catch((err) => {
        console.error('Export failed', err);
        setDownloading(false);
      });
  };

  const handleCopyScript = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(label);
    setTimeout(() => setCopiedScript(null), 3000);
  };

  const handleDownloadSingleFile = (content: string, filename: string) => {
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
    <div className="space-y-6">
      {/* 1. Salin & Download Skrip Google Apps Script */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-600" />
              Skrip Google Apps Script untuk Google Spreadsheet Anda
            </h3>
            <p className="text-xs text-slate-500">
              Salin atau download file skrip ini langsung ke Google Sheets Anda (menu <b>Ekstensi &gt; Apps Script</b>).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() =>
                handleCopyScript(
                  activeScriptTab === 'code' ? codeGsText : indexHtmlText,
                  activeScriptTab === 'code' ? 'Code.gs' : 'Index.html'
                )
              }
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedScript === (activeScriptTab === 'code' ? 'Code.gs' : 'Index.html')
                ? 'Tersalin ke Clipboard!'
                : `Salin ${activeScriptTab === 'code' ? 'Code.gs' : 'Index.html'}`}
            </button>

            <button
              onClick={() =>
                handleDownloadSingleFile(
                  activeScriptTab === 'code' ? codeGsText : indexHtmlText,
                  activeScriptTab === 'code' ? 'Code.gs' : 'Index.html'
                )
              }
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download File
            </button>
          </div>
        </div>

        {/* Tab Selector Code.gs vs Index.html */}
        <div className="flex gap-2 border-b border-slate-200 pb-2 mb-3">
          <button
            onClick={() => setActiveScriptTab('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeScriptTab === 'code'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            Code.gs (Backend Logika &amp; Role Security)
          </button>
          <button
            onClick={() => setActiveScriptTab('index')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeScriptTab === 'index'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            Index.html (Tampilan UI Khusus Role)
          </button>
        </div>

        {/* Code Preview Box */}
        <div className="relative">
          <textarea
            readOnly
            value={activeScriptTab === 'code' ? codeGsText : indexHtmlText}
            rows={12}
            className="w-full text-xs font-mono p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-none"
          />
        </div>

        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
          <b>Panduan Cepat Pemasangan di Google Spreadsheet:</b>
          <ol className="list-decimal list-inside space-y-0.5 mt-1 text-[11px] text-slate-700">
            <li>Buka spreadsheet Google Sheets Anda $\rightarrow$ Klik menu <b>Ekstensi</b> $\rightarrow$ <b>Apps Script</b>.</li>
            <li>Klik tombol <b>"Salin Code.gs"</b> di atas, lalu paste ke file <code className="bg-slate-200 px-1 py-0.5 rounded">Code.gs</code> di Apps Script.</li>
            <li>Pilih tab <b>Index.html</b> di atas, klik <b>"Salin Index.html"</b>, lalu paste ke file <code className="bg-slate-200 px-1 py-0.5 rounded">Index.html</code>.</li>
            <li>Di pojok kanan atas Apps Script, klik <b>Deploy $\rightarrow$ New Deployment $\rightarrow$ Web App</b>.</li>
          </ol>
        </div>
      </div>

      {/* 2. 16 Tabel Skema Google Spreadsheet */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              16 Tabel Skema Google Spreadsheet (Kompatibilitas Penuh)
            </h3>
            <p className="text-xs text-slate-500">
              Struktur data aplikasi ini mencerminkan 100% skema workbook Google Spreadsheet resmi BSS OMS V8.0.
            </p>
          </div>

          <button
            onClick={handleDownloadExport}
            disabled={downloading}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-2 self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Mengekspor Database…' : 'Ekspor 16 Sheet (JSON / Backup)'}
          </button>
        </div>

        {downloadSuccess && (
          <div className="mb-4 text-xs p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Ekspor 16 tabel berhasil diunduh ke komputer Anda.</span>
          </div>
        )}

        {/* 16 Sheets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {sheetsList.map((sheet, idx) => (
            <div
              key={sheet.name}
              className="p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200 transition-all hover:shadow-xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  {sheet.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{sheet.purpose}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
