/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Header Component
 * Strict 3-Zone Top Bar Contract adhering to Universal Frontend Design Constitution
 * Navigation links dynamically filter according to active user role.
 */

import React from 'react';
import { UserMaster } from '../types/oms';
import { UserCheck, Shield, Users, HardHat, Wrench, Code2 } from 'lucide-react';

interface HeaderProps {
  currentUser: UserMaster;
  onOpenAuthModal: () => void;
  onOpenGASModal?: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuthModal,
  activeTab,
  onSelectTab,
}) => {
  const isCoordinator = currentUser.role === 'Coordinator' || currentUser.role === 'Admin';
  const isMitra = currentUser.role === 'Mitra';
  const isTechnician = currentUser.role === 'Technician';

  const getRoleIcon = () => {
    switch (currentUser.role) {
      case 'Admin':
      case 'Coordinator':
        return <Shield className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Mitra':
        return <Users className="w-3.5 h-3.5 text-sky-400" />;
      case 'Technician':
        return <HardHat className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <header className="bg-[#091a2e] text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single Text Element) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center font-black text-white text-base shadow-sm tracking-tighter">
            CLX
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
              CLX Operation Management System
            </span>
            <span className="text-[11px] text-slate-400 font-mono tracking-wide -mt-0.5">
              BSS V8.0 WORKFLOW
            </span>
          </div>
        </div>

        {/* Zone 2: Role-Restricted Navigation Links (Single line, subtle hover) */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-300">
          {isCoordinator && (
            <>
              <button
                onClick={() => onSelectTab('coord_portal')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'coord_portal'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Konsol Koordinator
              </button>
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'dashboard'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Monitoring Global
              </button>
              <button
                onClick={() => onSelectTab('gis_map')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'gis_map'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Peta GIS BSS
              </button>
              <button
                onClick={() => onSelectTab('sheets_sync')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'sheets_sync'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Database 16 Sheets
              </button>
            </>
          )}

          {isMitra && (
            <>
              <button
                onClick={() => onSelectTab('mitra_portal')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'mitra_portal'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Portal Mitra ({currentUser.mitra})
              </button>
              <button
                onClick={() => onSelectTab('gis_map')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'gis_map'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Peta GIS BSS
              </button>
            </>
          )}

          {isTechnician && (
            <>
              <button
                onClick={() => onSelectTab('tech_portal')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'tech_portal'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Task Lapangan Saya
              </button>
              <button
                onClick={() => onSelectTab('pm_checklist')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'pm_checklist'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Checklist PM
              </button>
              <button
                onClick={() => onSelectTab('gis_map')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  activeTab === 'gis_map'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'hover:text-white'
                }`}
              >
                Peta GIS BSS
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Actions (GAS Script & User Profile) */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenGASModal && (
            <button
              onClick={onOpenGASModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
              title="Salin Code.gs & Index.html untuk Google Spreadsheet Anda"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Skrip Apps Script</span>
              <span className="sm:hidden">Skrip GAS</span>
            </button>
          )}

          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shadow-xs"
            title="Klik untuk ganti akun atau role pengguna"
          >
            {getRoleIcon()}
            <div className="flex flex-col text-left">
              <span className="font-semibold text-white max-w-[120px] sm:max-w-[160px] truncate">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-emerald-400 -mt-0.5 font-mono">
                {currentUser.role} {currentUser.mitra ? `· ${currentUser.mitra}` : ''}
              </span>
            </div>
            <UserCheck className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>
        </div>
      </div>
    </header>
  );
};
