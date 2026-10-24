/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX Operation Management System (OMS) V8 - Pure Domain Logic
 * Decoupled for fast-feedback unit testing
 */

import { PriorityLevel, TaskStatus } from '../types/oms';

/**
 * Format TT ID matching CLX standard: CLX/BSS/dd/MM/yy/0001
 */
export function newTTId(date: Date, counter: number): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yy = String(date.getFullYear()).slice(-2);
  const seq = pad(counter, 4);
  return `CLX/BSS/${dd}/${mm}/${yy}/${seq}`;
}

/**
 * Normalizes string keys for consistent comparisons
 */
export function normalizeKey(value: unknown): string {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Generates unique Site Key
 */
export function makeSiteKey(serial?: string, station?: string, name?: string): string {
  const s = String(serial || '').trim();
  const st = String(station || '').trim();
  const n = normalizeKey(name);
  const core = s || st || n || 'UNKNOWN';
  return `BSS|${core}`;
}

/**
 * Computes 15-to-15 monthly Preventive Maintenance Cycle
 */
export function calculateCycle(dateInput: Date | string | number): {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
} {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let start: Date;
  let end: Date;

  if (day >= 15) {
    start = new Date(year, month, 15, 0, 0, 0, 0);
    end = new Date(year, month + 1, 15, 0, 0, 0, 0);
  } else {
    start = new Date(year, month - 1, 15, 0, 0, 0, 0);
    end = new Date(year, month, 15, 0, 0, 0, 0);
  }

  const fmt = (dt: Date) => dt.toISOString().split('T')[0];
  return {
    start,
    end,
    startStr: fmt(start),
    endStr: fmt(end),
  };
}

/**
 * Priority determination from Operational status and issue alarms
 */
export function priorityFromIssue(issue = '', operational = ''): PriorityLevel {
  const op = normalizeKey(operational);
  if (op === 'UNAVAILABLE') return 'Priority 1';
  if (op === 'FAULTED') return 'Priority 2';
  if (op === 'AVAILABLE') return 'Priority 3';

  const text = String(issue).toLowerCase();
  if (/fault|offline|block|unavailable|error|not charging|soh<70/i.test(text)) {
    return 'Priority 1';
  }
  if (/battery|warning|warning soh|charging/i.test(text)) {
    return 'Priority 2';
  }
  return 'Priority 3';
}

/**
 * Issue category classifier
 */
export function categoryFromIssue(issue = ''): string {
  const text = String(issue).toLowerCase();
  if (/battery|soh|cell|pack|charging/.test(text)) return 'Battery Issue';
  if (/power|pln|voltage|mcb|phase|ups/.test(text)) return 'Power Issue';
  if (/slot|lock|door|mechanical|cabinet/.test(text)) return 'Slot/Hardware Issue';
  if (/offline|connectivity|signal|network|modem|sim/.test(text)) return 'Connectivity Issue';
  return 'Other';
}

/**
 * Field Technician State Machine Validation
 */
export const ALLOWED_TECH_TRANSITIONS: Record<
  string,
  { allowedFrom: TaskStatus; next: TaskStatus }
> = {
  ACCEPT: { allowedFrom: 'ASSIGNED_TO_TECHNICIAN', next: 'ACCEPTED' },
  ON_THE_WAY: { allowedFrom: 'ACCEPTED', next: 'ON_THE_WAY' },
  CHECK_IN: { allowedFrom: 'ON_THE_WAY', next: 'IN_PROGRESS' },
  SAVE_PROGRESS: { allowedFrom: 'IN_PROGRESS', next: 'IN_PROGRESS' },
  CHECK_OUT: { allowedFrom: 'IN_PROGRESS', next: 'READY_TO_SUBMIT' },
  SUBMIT: { allowedFrom: 'READY_TO_SUBMIT', next: 'COMPLETED_WAITING_REVIEW' },
};

export function validateTechnicianTransition(
  currentStatus: TaskStatus,
  action: string
): { valid: boolean; nextStatus?: TaskStatus; error?: string } {
  const upperAction = String(action || '').toUpperCase();
  const rule = ALLOWED_TECH_TRANSITIONS[upperAction];

  if (!rule) {
    return { valid: false, error: `Aksi tidak dikenal: ${action}` };
  }

  if (currentStatus !== rule.allowedFrom) {
    return {
      valid: false,
      error: `Aksi ${upperAction} tidak dapat dilakukan pada status "${currentStatus}". Status harus "${rule.allowedFrom}".`,
    };
  }

  return { valid: true, nextStatus: rule.next };
}

/**
 * Calculates SLA remaining time (12h SLA baseline)
 */
export function calculateSlaRemaining(
  slaDateInput: string | Date,
  nowInput: Date = new Date()
): {
  hours: number;
  minutes: number;
  isBreached: boolean;
  label: string;
} {
  const slaDate = new Date(slaDateInput);
  const now = new Date(nowInput);
  const diffMs = slaDate.getTime() - now.getTime();

  if (isNaN(diffMs)) {
    return { hours: 0, minutes: 0, isBreached: false, label: 'SLA Valid' };
  }

  const isBreached = diffMs <= 0;
  const absDiff = Math.abs(diffMs);
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

  if (isBreached) {
    return {
      hours,
      minutes,
      isBreached: true,
      label: `SLA Lewat +${hours}j ${minutes}m`,
    };
  }

  return {
    hours,
    minutes,
    isBreached: false,
    label: `Sisa ${hours}j ${minutes}m`,
  };
}

/**
 * Generates formatted WhatsApp text message for Mitra
 */
export function generateBulkWhatsAppText(
  mitra: string,
  tickets: Array<{
    ttId: string;
    site: string;
    cabinet?: string;
    station?: string;
    issue: string;
    status: string;
    pending?: string;
    priority: string;
  }>
): string {
  if (!tickets || !tickets.length) {
    return `Tidak ada Trouble Ticket outstanding aktif untuk Mitra: ${mitra}`;
  }

  const lines: string[] = [
    '*CLX MS — BSS TROUBLE TICKET DISPATCH*',
    '',
    `*MITRA / TEAM : ${String(mitra).toUpperCase()}*`,
    `*TOTAL SITE / TT VALID : ${tickets.length}*`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  tickets.forEach((t, i) => {
    lines.push(
      `*TT. ID* = ${t.ttId}`,
      `*Site Name* = ${t.site || '-'}`,
      `*Cabinet S/N* = ${t.cabinet || '-'}`,
      `*Station Code* = ${t.station || '-'}`,
      `*Issue* = ${t.issue || '-'}`,
      `*Status* = ${t.status || 'Pending'}`,
      `*Pending From Date* = ${t.pending || '-'}`,
      `*Priority Level* = ${t.priority || 'Priority 2'}`,
      '',
      'Mohon update: *ACCEPT / REJECT*'
    );

    if (i < tickets.length - 1) {
      lines.push('', '────────────────────────', '');
    }
  });

  return lines.join('\n');
}

/**
 * Creates WhatsApp deep-link
 */
export function generateWhatsAppDeepLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
