/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Role-Based Sub Navigation Bar
 * Dynamically renders only authorized tabs per role.
 * Prohibits Mitra & Technician from accessing Upload Excel, Database Sheets, and Bulk WA.
 */

import React from 'react';
import { UserMaster } from '../types/oms';
import {
  LayoutDashboard,
  Ticket,
  ClipboardList,
  CheckSquare,
  MapPin,
  FileSpreadsheet,
  Users,
  HardHat,
  ShieldCheck,
} from 'lucide-react';

interface NavigationProps {
  currentUser: UserMaster;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  unassignedCount?: number;
  myTaskCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  unassignedCount = 0,
  myTaskCount = 0,
}) => {
  const isCoordinator = currentUser.role === 'Coordinator' || currentUser.role === 'Admin';
  const isMitra = currentUser.role === 'Mitra';
  const isTechnician = currentUser.role === 'Technician';

  // Define authorized tabs per role
  const getNavItems = () => {
    if (isCoordinator) {
      return [
        {
          id: 'coord_portal',
          label: 'Konsol Koordinator (TT & Upload)',
          icon: ShieldCheck,
          count: unassignedCount > 0 ? unassignedCount : undefined,
        },
        {
          id: 'dashboard',
          label: 'Monitoring & KPI Global',
          icon: LayoutDashboard,
        },
        {
          id: 'gis_map',
          label: 'Peta GIS BSS Indonesia',
          icon: MapPin,
        },
        {
          id: 'sheets_sync',
          label: 'Database 16 Sheets',
          icon: FileSpreadsheet,
        },
      ];
    }

    if (isMitra) {
      return [
        {
          id: 'mitra_portal',
          label: `Portal Mitra (${currentUser.mitra || 'Team Lead'})`,
          icon: Users,
          count: myTaskCount > 0 ? myTaskCount : undefined,
        },
        {
          id: 'gis_map',
          label: 'Peta GIS BSS Indonesia',
          icon: MapPin,
        },
      ];
    }

    if (isTechnician) {
      return [
        {
          id: 'tech_portal',
          label: 'Task Lapangan Saya',
          icon: HardHat,
          count: myTaskCount > 0 ? myTaskCount : undefined,
        },
        {
          id: 'pm_checklist',
          label: 'Form Checklist PM',
          icon: CheckSquare,
        },
        {
          id: 'gis_map',
          label: 'Peta GIS BSS Indonesia',
          icon: MapPin,
        },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  return (
    <div className="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#091a2e] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                      isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
