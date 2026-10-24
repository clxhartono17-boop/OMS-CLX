/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Authentication & User Master Switcher Modal
 */

import React, { useState } from 'react';
import { UserMaster } from '../types/oms';
import { Shield, Users, HardHat, Check, X, Mail } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserMaster;
  availableUsers: UserMaster[];
  onSelectUserEmail: (email: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableUsers,
  onSelectUserEmail,
}) => {
  const [customEmail, setCustomEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSwitch = async (email: string) => {
    setError('');
    setLoading(true);
    try {
      await onSelectUserEmail(email);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal berganti akun');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setError('Masukkan email yang terdaftar di User Master');
      return;
    }
    handleSwitch(customEmail.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#091a2e] px-6 py-5 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Identitas & Akses Pengguna</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilih akun atau masukkan email Google terdaftar di 08 USER MASTER
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Preset Roles for Quick Evaluation */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">
              Preset Peran & Akun Uji:
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              {availableUsers.map((u) => {
                const isSelected = u.email.toLowerCase() === currentUser.email.toLowerCase();
                return (
                  <button
                    key={u.email}
                    onClick={() => handleSwitch(u.email)}
                    disabled={loading}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          u.role === 'Admin' || u.role === 'Coordinator'
                            ? 'bg-slate-900 text-emerald-400'
                            : u.role === 'Mitra'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {u.role === 'Admin' || u.role === 'Coordinator' ? (
                          <Shield className="w-4 h-4" />
                        ) : u.role === 'Mitra' ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          <HardHat className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{u.name}</span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {u.role}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {u.email} {u.mitra ? `· ${u.mitra}` : ''}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Email Input */}
          <form onSubmit={handleCustomSubmit} className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Atau Masukkan Email Akun Lain:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  placeholder="teknisi@clx.co.id"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
              >
                Ganti Akun
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
