/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX Operation Management System (OMS) V8 - Data Types
 * Aligned with 16 Google Spreadsheet schemas & workflow models
 */

export type UserRole = 'Admin' | 'Coordinator' | 'Mitra' | 'Technician';

export interface UserMaster {
  email: string;
  name: string;
  role: UserRole;
  mitra?: string;
  active: boolean;
  createdAt?: string;
  createdBy?: string;
}

export type OperationalStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'FAULTED';
export type PriorityLevel = 'Priority 1' | 'Priority 2' | 'Priority 3';

export interface SiteMaster {
  siteKey: string;
  cabinetSN: string;
  stationCode: string;
  locationName: string;
  address?: string;
  district: string;
  province: string;
  latLong: string; // e.g. "-6.2088,106.8456"
  lat: number;
  lng: number;
  connectivity: string;
  operational: OperationalStatus;
  faultedReason?: string;
  batteryCount: number;
  batteryType?: string;
  emptySlots: number;
  teamLead: string; // Mitra name
  mappingStatus?: string;
  lastUpdated?: string;
}

export interface TroubleTicket {
  ttId: string;
  date: string;
  statusBSS: string; // Pending, Scheduled/Waiting Part, Solved, Closed
  priorities: PriorityLevel;
  serialNumber: string;
  stationName: string;
  stationCode?: string;
  faultedAlarm: string;
  statusCharger?: string;
  statusBattery?: string;
  pic: string; // Mitra
  assignDate?: string;
  sla: string; // Target SLA ISO
  category: string;
  district?: string;
  province?: string;
  siteKey: string;
  source: string;
  hasActiveTask?: boolean;
}

export type TaskType = 'TT' | 'PM';

export type TaskStatus =
  | 'ASSIGNED_TO_MITRA'
  | 'ASSIGNED_TO_TECHNICIAN'
  | 'ACCEPTED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS'
  | 'READY_TO_SUBMIT'
  | 'COMPLETED_WAITING_REVIEW'
  | 'CLOSED'
  | 'REWORK';

export interface WorkflowTask {
  taskId: string;
  taskType: TaskType;
  ttId?: string;
  siteKey: string;
  cabinetSN: string;
  stationCode?: string;
  siteName: string;
  mitra: string;
  technicianEmail?: string;
  technicianName?: string;
  source: string;
  cycleStart?: string;
  cycleEnd?: string;
  status: TaskStatus;
  assignedBy?: string;
  assignedAt?: string;
  acceptedAt?: string;
  checkInAt?: string;
  checkInLocation?: string;
  checkInEvidenceUrl?: string;
  issueDetail?: string;
  rca1?: string;
  rca2?: string;
  correctiveAction?: string;
  checkOutAt?: string;
  checkOutLocation?: string;
  checkOutEvidenceUrl?: string;
  reportSummary?: string;
  submittedAt?: string;
  reviewStatus?: 'NOT_SUBMITTED' | 'WAITING_REVIEW' | 'APPROVE' | 'REWORK';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  pendingReason?: string;
  lastUpdated: string;
  pmReportUrl?: string;
  progressPhotosCount?: number;
}

export interface TaskActivity {
  id: string;
  timestamp: string;
  taskId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  remarks?: string;
}

export interface WorkEvidence {
  id: string;
  timestamp: string;
  taskId: string;
  evidenceType: 'CLOCK_IN' | 'CLOCK_OUT' | 'CM_PROGRESS' | 'PM_EVIDENCE';
  evidenceUrl: string; // Base64 data URI or hosted URL
  description?: string;
  uploadedBy: string;
  geo?: {
    lat: number;
    lon: number;
    accuracy: number;
    timestamp: string;
  };
}

export interface PMChecklistItem {
  id: string;
  taskId: string;
  item: string;
  category: string;
  result: 'OK' | 'NG' | 'NA';
  remarks?: string;
  evidenceUrl?: string;
}

export interface DashboardSummary {
  today: string;
  totalSites: number;
  availableSites: number;
  unavailableSites: number;
  faultedSites: number;
  activeTTCount: number;
  unassignedTTCount: number;
  slaBreachCount: number;
  statusCounts: Record<string, number>;
  activeCycle: {
    start: string;
    end: string;
  };
}

export interface MitraPerformance {
  mitra: string;
  totalSites: number;
  totalTasks: number;
  solved: number;
  waitingReview: number;
  outstanding: number;
  slaMetPercent: number;
  pmAchievementPercent: number;
  performanceScore: number;
}
