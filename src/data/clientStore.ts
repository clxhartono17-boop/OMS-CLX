/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - Resilient Client-Side Offline / Standalone Store
 * Allows the app to run seamlessly on static hosts (like Vercel static)
 * without requiring an active Express backend.
 */

import {
  UserMaster,
  SiteMaster,
  TroubleTicket,
  WorkflowTask,
  TaskActivity,
  PMChecklistItem,
  DashboardSummary,
  MitraPerformance,
} from '../types/oms';
import {
  INITIAL_USERS,
  INITIAL_SITES,
  INITIAL_TTS,
  INITIAL_TASKS,
  INITIAL_ACTIVITIES,
  INITIAL_MITRA_PERF,
  INITIAL_PM_CHECKLIST_TEMPLATE,
} from './seedData';
import { calculateCycle, newTTId } from '../utils/omsLogic';

const STORAGE_KEY_PREFIX = 'clx_oms_v8_';

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorage quota or access warning:', e);
  }
}

export interface ClientStoreState {
  users: UserMaster[];
  sites: SiteMaster[];
  tickets: TroubleTicket[];
  tasks: WorkflowTask[];
  activities: TaskActivity[];
  mitraPerf: MitraPerformance[];
  checklists: PMChecklistItem[];
  currentEmail: string;
}

export function getClientState(): ClientStoreState {
  const users = getStored<UserMaster[]>('users', INITIAL_USERS);
  const sites = getStored<SiteMaster[]>('sites', INITIAL_SITES);
  const tickets = getStored<TroubleTicket[]>('tickets', INITIAL_TTS);
  const tasks = getStored<WorkflowTask[]>('tasks', INITIAL_TASKS);
  const activities = getStored<TaskActivity[]>('activities', INITIAL_ACTIVITIES);
  const mitraPerf = getStored<MitraPerformance[]>('mitraPerf', INITIAL_MITRA_PERF);
  const checklists = getStored<PMChecklistItem[]>('checklists', [
    ...INITIAL_PM_CHECKLIST_TEMPLATE.map((t, idx) => ({
      id: `PMC-SEED-${idx}`,
      taskId: 'CLX-PM-20261023-071500-202',
      item: t.item,
      category: t.category,
      result: 'OK' as const,
      remarks: 'Kondisi normal terverifikasi',
    })),
  ]);
  const currentEmail = getStored<string>('currentEmail', 'admin@clx.co.id');

  return {
    users,
    sites,
    tickets,
    tasks,
    activities,
    mitraPerf,
    checklists,
    currentEmail,
  };
}

export function saveClientState(partial: Partial<ClientStoreState>): void {
  if (partial.users) setStored('users', partial.users);
  if (partial.sites) setStored('sites', partial.sites);
  if (partial.tickets) setStored('tickets', partial.tickets);
  if (partial.tasks) setStored('tasks', partial.tasks);
  if (partial.activities) setStored('activities', partial.activities);
  if (partial.mitraPerf) setStored('mitraPerf', partial.mitraPerf);
  if (partial.checklists) setStored('checklists', partial.checklists);
  if (partial.currentEmail) setStored('currentEmail', partial.currentEmail);
}

export function computeDashboardSummary(
  sites: SiteMaster[],
  tickets: TroubleTicket[]
): DashboardSummary {
  const availableSites = sites.filter((s) => s.operational === 'AVAILABLE').length;
  const unavailableSites = sites.filter((s) => s.operational === 'UNAVAILABLE').length;
  const faultedSites = sites.filter((s) => s.operational === 'FAULTED').length;

  const activeTT = tickets.filter((tt) => tt.statusBSS !== 'Closed');
  const unassignedTT = activeTT.filter((tt) => !tt.hasActiveTask);

  const now = new Date();
  const breachedTT = activeTT.filter((tt) => new Date(tt.sla).getTime() < now.getTime());

  const statusCounts: Record<string, number> = {};
  tickets.forEach((tt) => {
    statusCounts[tt.statusBSS] = (statusCounts[tt.statusBSS] || 0) + 1;
  });

  const cy = calculateCycle(now);

  return {
    today: now.toISOString().split('T')[0],
    totalSites: sites.length,
    availableSites,
    unavailableSites,
    faultedSites,
    activeTTCount: activeTT.length,
    unassignedTTCount: unassignedTT.length,
    slaBreachCount: breachedTT.length,
    statusCounts,
    activeCycle: {
      start: cy.startStr,
      end: cy.endStr,
    },
  };
}
