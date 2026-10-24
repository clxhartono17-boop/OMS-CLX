/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Interactive PM Checklist Component
 * Modern 3-state toggle (OK / NG / NA) with remarks & instant validation.
 */

import React, { useState, useEffect } from 'react';
import { PMChecklistItem, WorkflowTask } from '../types/oms';
import {
  CheckSquare,
  Check,
  X,
  Minus,
  Save,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';

interface InteractivePMChecklistProps {
  tasks: WorkflowTask[];
  onSaveChecklist: (taskId: string, items: PMChecklistItem[]) => Promise<void>;
  preselectedTaskId?: string;
}

export const InteractivePMChecklist: React.FC<InteractivePMChecklistProps> = ({
  tasks,
  onSaveChecklist,
  preselectedTaskId,
}) => {
  // Only PM tasks
  const pmTasks = tasks.filter((t) => t.taskType === 'PM');
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    preselectedTaskId || pmTasks[0]?.taskId || ''
  );
  const [checklistItems, setChecklistItems] = useState<PMChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Fetch checklist items for selected task
  useEffect(() => {
    if (!selectedTaskId) return;

    setLoading(true);
    fetch(`/api/pm/checklist/${selectedTaskId}`)
      .then((res) => res.json())
      .then((data: PMChecklistItem[]) => {
        setChecklistItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load checklist', err);
        setLoading(false);
      });
  }, [selectedTaskId]);

  const handleToggle = (id: string, result: 'OK' | 'NG' | 'NA') => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, result } : item))
    );
  };

  const handleRemarkChange = (id: string, remarks: string) => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, remarks } : item))
    );
  };

  const handleSave = async () => {
    if (!selectedTaskId) return;
    setLoading(true);
    setSaveStatus(null);
    try {
      await onSaveChecklist(selectedTaskId, checklistItems);
      setSaveStatus('Checklist PM berhasil disimpan ke database 13 PM CHECKLIST');
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: unknown) {
      setSaveStatus(`Gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Group items by category
  const categories = Array.from(new Set(checklistItems.map((c) => c.category || 'General')));

  // Counts
  const okCount = checklistItems.filter((c) => c.result === 'OK').length;
  const ngCount = checklistItems.filter((c) => c.result === 'NG').length;
  const naCount = checklistItems.filter((c) => c.result === 'NA').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              Interactive PM Inspection Checklist (13 PM CHECKLIST)
            </h3>
            <p className="text-xs text-slate-500">
              Formulir inspeksi preventif periodik dengan status OK / NG / NA dan bukti per item
            </p>
          </div>

          {/* Select PM Task */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Pilih Task PM:</span>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
            >
              {pmTasks.map((t) => (
                <option key={t.taskId} value={t.taskId}>
                  {t.taskId} · {t.siteName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inspection Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Item</span>
            <span className="text-base font-black font-mono text-slate-800">{checklistItems.length}</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">OK (Normal)</span>
            <span className="text-base font-black font-mono text-emerald-700">{okCount}</span>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
            <span className="text-[10px] uppercase font-bold text-red-600 block">NG (Not Good)</span>
            <span className="text-base font-black font-mono text-red-700">{ngCount}</span>
          </div>
          <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">NA (Not Applicable)</span>
            <span className="text-base font-black font-mono text-slate-700">{naCount}</span>
          </div>
        </div>

        {saveStatus && (
          <div className="mb-4 text-xs p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* Checklist Item Cards by Category */}
        <div className="space-y-6">
          {categories.map((cat) => {
            const itemsInCat = checklistItems.filter((c) => (c.category || 'General') === cat);
            return (
              <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-[#091a2e] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>{cat}</span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    {itemsInCat.length} Item
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {itemsInCat.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-slate-900 block">
                          {idx + 1}. {item.item}
                        </span>
                        <input
                          type="text"
                          placeholder="Catatan / temuan (opsional)…"
                          value={item.remarks || ''}
                          onChange={(e) => handleRemarkChange(item.id, e.target.value)}
                          className="mt-1.5 w-full text-[11px] border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* 3-State Toggle Button Group */}
                      <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id, 'OK')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                            item.result === 'OK'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          OK
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(item.id, 'NG')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                            item.result === 'NG'
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          NG
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(item.id, 'NA')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                            item.result === 'NA'
                              ? 'bg-slate-700 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                          NA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Simpan Hasil Checklist PM
          </button>
        </div>
      </div>
    </div>
  );
};
