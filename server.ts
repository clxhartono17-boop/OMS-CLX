/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX Operation Management System (OMS) V8 - Full-Stack Server
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  INITIAL_USERS,
  INITIAL_SITES,
  INITIAL_TTS,
  INITIAL_TASKS,
  INITIAL_ACTIVITIES,
  INITIAL_MITRA_PERF,
  INITIAL_PM_CHECKLIST_TEMPLATE,
} from './src/data/seedData';
import {
  UserMaster,
  SiteMaster,
  TroubleTicket,
  WorkflowTask,
  TaskActivity,
  WorkEvidence,
  PMChecklistItem,
} from './src/types/oms';
import {
  newTTId,
  makeSiteKey,
  priorityFromIssue,
  categoryFromIssue,
  calculateCycle,
  validateTechnicianTransition,
} from './src/utils/omsLogic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// In-Memory Database representing 16 Google Spreadsheet tables
let users: UserMaster[] = [...INITIAL_USERS];
let sites: SiteMaster[] = [...INITIAL_SITES];
let troubleTickets: TroubleTicket[] = [...INITIAL_TTS];
let tasks: WorkflowTask[] = [...INITIAL_TASKS];
let activities: TaskActivity[] = [...INITIAL_ACTIVITIES];
let evidenceStore: WorkEvidence[] = [];
let pmChecklistStore: PMChecklistItem[] = [
  ...INITIAL_PM_CHECKLIST_TEMPLATE.map((t, idx) => ({
    id: `PMC-SEED-${idx}`,
    taskId: 'CLX-PM-20261023-071500-202',
    item: t.item,
    category: t.category,
    result: 'OK' as const,
    remarks: 'Kondisi normal terverifikasi',
  })),
];
let fcmTokens: Array<{ email: string; token: string; updatedAt: string }> = [];

// Session state (default to Admin)
let currentActiveEmail = 'admin@clx.co.id';

function getCurrentUser(): UserMaster {
  const found = users.find(
    (u) => u.email.toLowerCase() === currentActiveEmail.toLowerCase() && u.active
  );
  if (found) return found;
  return users[0];
}

function logActivity(
  taskId: string,
  user: UserMaster,
  action: string,
  fromStatus?: string,
  toStatus?: string,
  remarks?: string
) {
  const act: TaskActivity = {
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    taskId,
    actorEmail: user.email,
    actorRole: user.role,
    action,
    fromStatus,
    toStatus,
    remarks,
  };
  activities.unshift(act);
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// Context / Current User
app.get('/api/context', (req: Request, res: Response) => {
  const u = getCurrentUser();
  res.json({
    email: u.email,
    name: u.name,
    role: u.role,
    mitra: u.mitra || '',
    version: '8.0 WORKFLOW (Full-Stack Express)',
    availableUsers: users.filter((x) => x.active),
  });
});

// Switch / Login user by Email
app.post('/api/auth/switch', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

  const found = users.find(
    (u) => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.active
  );
  if (!found) {
    return res.status(404).json({ error: 'Akun tidak ditemukan atau tidak aktif di User Master' });
  }

  currentActiveEmail = found.email;
  res.json({ ok: true, user: found });
});

// Register technician
app.post('/api/users/technician', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Mitra', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Hanya Mitra Team Lead atau Admin yang dapat mendaftarkan teknisi' });
  }

  const { name, email, mitra } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Nama dan Email wajib diisi' });
  }

  const targetMitra = currentUser.role === 'Mitra' ? currentUser.mitra : mitra || currentUser.mitra;
  if (!targetMitra) {
    return res.status(400).json({ error: 'Mitra/Team wajib ditentukan' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(400).json({ error: 'Email sudah terdaftar di sistem' });
  }

  const newTech: UserMaster = {
    email: cleanEmail,
    name: String(name).trim(),
    role: 'Technician',
    mitra: targetMitra,
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.email,
  };

  users.push(newTech);
  res.json({ ok: true, user: newTech });
});

// Dashboard KPI metrics
app.get('/api/dashboard', (req: Request, res: Response) => {
  const availableSites = sites.filter((s) => s.operational === 'AVAILABLE').length;
  const unavailableSites = sites.filter((s) => s.operational === 'UNAVAILABLE').length;
  const faultedSites = sites.filter((s) => s.operational === 'FAULTED').length;

  const activeTT = troubleTickets.filter((tt) => tt.statusBSS !== 'Closed');
  const unassignedTT = activeTT.filter((tt) => !tt.hasActiveTask);

  const now = new Date();
  const breachedTT = activeTT.filter((tt) => new Date(tt.sla).getTime() < now.getTime());

  const statusCounts: Record<string, number> = {};
  troubleTickets.forEach((tt) => {
    statusCounts[tt.statusBSS] = (statusCounts[tt.statusBSS] || 0) + 1;
  });

  const cy = calculateCycle(now);

  res.json({
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
  });
});

// Sites list
app.get('/api/sites', (req: Request, res: Response) => {
  res.json(sites);
});

// Trouble Tickets queue
app.get('/api/tt/queue', (req: Request, res: Response) => {
  const activeTaskTTIds = new Set(
    tasks
      .filter((t) => !['CLOSED', 'REWORK'].includes(t.status) && t.ttId)
      .map((t) => t.ttId)
  );

  const enriched = troubleTickets.map((tt) => ({
    ...tt,
    hasActiveTask: activeTaskTTIds.has(tt.ttId),
  }));

  res.json(enriched);
});

// Assign single TT
app.post('/api/tt/assign', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Coordinator', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Hanya Coordinator atau Admin yang dapat menugaskan TT' });
  }

  const { ttId, mitra } = req.body;
  if (!ttId || !mitra) {
    return res.status(400).json({ error: 'TT ID dan Mitra wajib diisi' });
  }

  const tt = troubleTickets.find((t) => t.ttId === ttId);
  if (!tt) return res.status(404).json({ error: 'Trouble Ticket tidak ditemukan' });

  const existingTask = tasks.find((t) => t.ttId === ttId && t.status !== 'CLOSED');
  if (existingTask) {
    return res.status(400).json({ error: 'TT ini sudah memiliki task aktif' });
  }

  const taskId = `CLX-TT-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();

  const newTask: WorkflowTask = {
    taskId,
    taskType: 'TT',
    ttId,
    siteKey: tt.siteKey,
    cabinetSN: tt.serialNumber,
    stationCode: tt.stationCode,
    siteName: tt.stationName,
    mitra,
    source: 'COORDINATOR_ASSIGNMENT',
    status: 'ASSIGNED_TO_MITRA',
    assignedBy: currentUser.email,
    assignedAt: now,
    lastUpdated: now,
    reviewStatus: 'NOT_SUBMITTED',
  };

  tasks.unshift(newTask);
  tt.hasActiveTask = true;
  tt.pic = mitra;

  logActivity(taskId, currentUser, 'ASSIGN_TT', 'CREATED', 'ASSIGNED_TO_MITRA', `Mitra: ${mitra}`);
  res.json({ ok: true, taskId, task: newTask });
});

// Bulk assign TTs
app.post('/api/tt/bulk-assign', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Coordinator', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Hanya Coordinator atau Admin yang dapat menugaskan TT' });
  }

  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Pilih minimal satu TT' });
  }

  const results: Array<{ ok: boolean; ttId: string; taskId?: string; error?: string }> = [];

  items.forEach((item) => {
    const { ttId, mitra } = item;
    const tt = troubleTickets.find((t) => t.ttId === ttId);
    if (!tt) {
      results.push({ ok: false, ttId, error: 'TT tidak ditemukan' });
      return;
    }

    const existingTask = tasks.find((t) => t.ttId === ttId && t.status !== 'CLOSED');
    if (existingTask) {
      results.push({ ok: false, ttId, error: 'Sudah memiliki task aktif' });
      return;
    }

    const taskId = `CLX-TT-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const newTask: WorkflowTask = {
      taskId,
      taskType: 'TT',
      ttId,
      siteKey: tt.siteKey,
      cabinetSN: tt.serialNumber,
      stationCode: tt.stationCode,
      siteName: tt.stationName,
      mitra: mitra || tt.pic,
      source: 'COORDINATOR_BULK_ASSIGNMENT',
      status: 'ASSIGNED_TO_MITRA',
      assignedBy: currentUser.email,
      assignedAt: now,
      lastUpdated: now,
      reviewStatus: 'NOT_SUBMITTED',
    };

    tasks.unshift(newTask);
    tt.hasActiveTask = true;
    logActivity(taskId, currentUser, 'BULK_ASSIGN_TT', 'CREATED', 'ASSIGNED_TO_MITRA', `Mitra: ${mitra || tt.pic}`);
    results.push({ ok: true, ttId, taskId });
  });

  res.json({
    ok: results.every((r) => r.ok),
    results,
    total: results.length,
    success: results.filter((r) => r.ok).length,
  });
});

// Tasks list (Filtered by role)
app.get('/api/tasks', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();

  let filtered = [...tasks];
  if (currentUser.role === 'Mitra') {
    filtered = filtered.filter(
      (t) => String(t.mitra).toUpperCase() === String(currentUser.mitra).toUpperCase()
    );
  } else if (currentUser.role === 'Technician') {
    filtered = filtered.filter(
      (t) =>
        t.technicianEmail &&
        t.technicianEmail.toLowerCase() === currentUser.email.toLowerCase()
    );
  }

  res.json(filtered);
});

// Assign technician to Task
app.post('/api/tasks/assign-technician', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Mitra', 'Coordinator', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  const { taskId, technicianEmail } = req.body;
  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  if (
    currentUser.role === 'Mitra' &&
    String(currentUser.mitra).toUpperCase() !== String(task.mitra).toUpperCase()
  ) {
    return res.status(403).json({ error: 'Task bukan milik Mitra Anda' });
  }

  const tech = users.find(
    (u) =>
      u.email.toLowerCase() === String(technicianEmail).trim().toLowerCase() &&
      u.role === 'Technician' &&
      u.active
  );
  if (!tech) return res.status(400).json({ error: 'Teknisi tidak ditemukan atau tidak aktif' });

  const from = task.status;
  task.technicianEmail = tech.email;
  task.technicianName = tech.name;
  task.status = 'ASSIGNED_TO_TECHNICIAN';
  task.lastUpdated = new Date().toISOString();

  logActivity(taskId, currentUser, 'ASSIGN_TECHNICIAN', from, 'ASSIGNED_TO_TECHNICIAN', tech.name);
  res.json({ ok: true, task });
});

// Technician Actions (State Machine transitions)
app.post('/api/tasks/action', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (currentUser.role !== 'Technician') {
    return res.status(403).json({ error: 'Aksi ini hanya dapat dilakukan oleh Teknisi Lapangan' });
  }

  const {
    taskId,
    action,
    location,
    evidenceUrl,
    issueDetail,
    rca1,
    rca2,
    correctiveAction,
    reportSummary,
    cmStatus,
    note,
    pmChecklist,
  } = req.body;

  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  if (task.technicianEmail?.toLowerCase() !== currentUser.email.toLowerCase()) {
    return res.status(403).json({ error: 'Task ini tidak ditugaskan ke akun Anda' });
  }

  const validation = validateTechnicianTransition(task.status, action);
  if (!validation.valid || !validation.nextStatus) {
    return res.status(400).json({ error: validation.error });
  }

  const from = task.status;
  const to = validation.nextStatus;
  const now = new Date().toISOString();

  if (action === 'ACCEPT') {
    task.acceptedAt = now;
  } else if (action === 'CHECK_IN') {
    if (!location || !evidenceUrl) {
      return res.status(400).json({ error: 'Clock In wajib menyertakan koordinat GPS dan bukti foto' });
    }
    task.checkInAt = now;
    task.checkInLocation = location;
    task.checkInEvidenceUrl = evidenceUrl;
  } else if (action === 'CHECK_OUT') {
    if (!location || !evidenceUrl) {
      return res.status(400).json({ error: 'Clock Out wajib menyertakan koordinat GPS dan bukti foto' });
    }
    task.checkOutAt = now;
    task.checkOutLocation = location;
    task.checkOutEvidenceUrl = evidenceUrl;
  }

  if (action === 'SAVE_PROGRESS' || action === 'SUBMIT') {
    if (issueDetail) task.issueDetail = issueDetail;
    if (rca1) task.rca1 = rca1;
    if (rca2) task.rca2 = rca2;
    if (correctiveAction) task.correctiveAction = correctiveAction;
    if (reportSummary) task.reportSummary = reportSummary;
    if (cmStatus || note) {
      task.pendingReason = [cmStatus, note].filter(Boolean).join(' | ');
    }
  }

  if (action === 'SUBMIT') {
    if (!task.checkInEvidenceUrl) {
      return res.status(400).json({ error: 'Clock In dan foto GPS wajib diselesaikan' });
    }
    if (!task.checkOutEvidenceUrl) {
      return res.status(400).json({ error: 'Clock Out dan foto GPS wajib diselesaikan' });
    }
    if (!task.issueDetail?.trim() || !task.rca1?.trim() || !task.rca2?.trim() || !task.correctiveAction?.trim()) {
      return res.status(400).json({ error: 'Detail Issue, RCA 1, RCA 2, dan Corrective Action wajib diisi lengkap' });
    }
    task.submittedAt = now;
    task.reviewStatus = 'WAITING_REVIEW';
  }

  task.status = to;
  task.lastUpdated = now;

  logActivity(taskId, currentUser, action, from, to, reportSummary || cmStatus || '');
  res.json({ ok: true, task });
});

// Coordinator Review Task (APPROVE or REWORK)
app.post('/api/tasks/review', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Coordinator', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Hanya Coordinator atau Admin yang dapat mereview laporan' });
  }

  const { taskId, decision, remarks } = req.body;
  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  if (task.status !== 'COMPLETED_WAITING_REVIEW') {
    return res.status(400).json({ error: 'Task belum menunggu review' });
  }

  const dec = String(decision).toUpperCase();
  if (dec !== 'APPROVE' && dec !== 'REWORK') {
    return res.status(400).json({ error: 'Keputusan harus APPROVE atau REWORK' });
  }

  if (dec === 'REWORK' && !remarks?.trim()) {
    return res.status(400).json({ error: 'Alasan perbaikan (rework) wajib diisi' });
  }

  const from = task.status;
  const to = dec === 'APPROVE' ? 'CLOSED' : 'REWORK';
  const now = new Date().toISOString();

  task.status = to;
  task.reviewStatus = dec;
  task.reviewedBy = currentUser.email;
  task.reviewedAt = now;
  task.reviewRemarks = remarks || '';
  task.lastUpdated = now;

  // If approved and has TT, update TT to Closed and site to AVAILABLE
  if (to === 'CLOSED' && task.ttId) {
    const tt = troubleTickets.find((t) => t.ttId === task.ttId);
    if (tt) {
      tt.statusBSS = 'Closed';
    }
    const site = sites.find((s) => s.siteKey === task.siteKey);
    if (site) {
      site.operational = 'AVAILABLE';
      site.faultedReason = '';
      site.lastUpdated = now;
    }
  }

  logActivity(taskId, currentUser, `REVIEW_${dec}`, from, to, remarks);
  res.json({ ok: true, task });
});

// PM Site Candidates
app.get('/api/pm/candidates', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  const cy = calculateCycle(new Date());

  const activePMKeys = new Set(
    tasks
      .filter((t) => t.taskType === 'PM' && !['CLOSED', 'CANCELLED'].includes(t.status))
      .map((t) => t.siteKey)
  );

  let candidates = sites.map((s) => ({
    siteKey: s.siteKey,
    siteName: s.locationName,
    cabinet: s.cabinetSN,
    station: s.stationCode,
    mitra: s.teamLead,
    operational: s.operational,
    cycleStart: cy.startStr,
    cycleEnd: cy.endStr,
    isActivePM: activePMKeys.has(s.siteKey),
  }));

  if (currentUser.role === 'Mitra') {
    candidates = candidates.filter(
      (c) => String(c.mitra).toUpperCase() === String(currentUser.mitra).toUpperCase()
    );
  }

  res.json(candidates);
});

// Start PM Task (Coordinator or Mitra Self-Initiate)
app.post('/api/pm/start', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Mitra', 'Coordinator', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  const { siteKey, mitra } = req.body;
  const site = sites.find((s) => s.siteKey === siteKey);
  if (!site) return res.status(404).json({ error: 'Site tidak ditemukan' });

  const targetMitra = currentUser.role === 'Mitra' ? currentUser.mitra : mitra || site.teamLead;
  if (!targetMitra) return res.status(400).json({ error: 'Mitra belum dipetakan untuk site ini' });

  const cy = calculateCycle(new Date());
  const taskId = `CLX-PM-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();

  const newTask: WorkflowTask = {
    taskId,
    taskType: 'PM',
    siteKey,
    cabinetSN: site.cabinetSN,
    stationCode: site.stationCode,
    siteName: site.locationName,
    mitra: targetMitra,
    source: currentUser.role === 'Mitra' ? 'MITRA_SELF_INITIATED' : 'COORDINATOR_ASSIGNMENT',
    cycleStart: cy.startStr,
    cycleEnd: cy.endStr,
    status: 'ASSIGNED_TO_MITRA',
    assignedBy: currentUser.email,
    assignedAt: now,
    lastUpdated: now,
    reviewStatus: 'NOT_SUBMITTED',
  };

  tasks.unshift(newTask);

  // Generate initial PM checklist items
  INITIAL_PM_CHECKLIST_TEMPLATE.forEach((tmpl, i) => {
    pmChecklistStore.push({
      id: `PMC-${taskId}-${i}`,
      taskId,
      item: tmpl.item,
      category: tmpl.category,
      result: 'OK',
    });
  });

  logActivity(taskId, currentUser, 'START_PM', 'DUE', 'ASSIGNED_TO_MITRA', `Site: ${site.locationName}`);
  res.json({ ok: true, taskId, task: newTask });
});

// PM Checklist items
app.get('/api/pm/checklist/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const items = pmChecklistStore.filter((p) => p.taskId === taskId);
  res.json(items);
});

app.post('/api/pm/checklist/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array required' });
  }

  // Update existing or add new
  pmChecklistStore = pmChecklistStore.filter((p) => p.taskId !== taskId);
  items.forEach((it: PMChecklistItem) => {
    pmChecklistStore.push({
      id: it.id || `PMC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      taskId,
      item: it.item,
      category: it.category || 'General',
      result: it.result || 'OK',
      remarks: it.remarks || '',
      evidenceUrl: it.evidenceUrl || '',
    });
  });

  res.json({ ok: true, count: items.length });
});

// Evidence upload
app.post('/api/evidence', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  const { taskId, evidenceType, data, description, geo } = req.body;

  if (!taskId || !data) {
    return res.status(400).json({ error: 'Task ID dan data foto wajib diisi' });
  }

  const existingCount = evidenceStore.filter(
    (e) => e.taskId === taskId && e.evidenceType === 'CM_PROGRESS'
  ).length;

  if (evidenceType === 'CM_PROGRESS' && existingCount >= 6) {
    return res.status(400).json({ error: 'Maksimal 6 foto progress CM per task' });
  }

  const newEvidence: WorkEvidence = {
    id: `EVI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    taskId,
    evidenceType: evidenceType || 'CM_PROGRESS',
    evidenceUrl: data, // Base64 data URL
    description: description || '',
    uploadedBy: currentUser.email,
    geo,
  };

  evidenceStore.unshift(newEvidence);

  // Update task progress photo count
  const task = tasks.find((t) => t.taskId === taskId);
  if (task && evidenceType === 'CM_PROGRESS') {
    task.progressPhotosCount = existingCount + 1;
  }

  res.json({ ok: true, evidence: newEvidence });
});

app.get('/api/evidence/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const list = evidenceStore.filter((e) => e.taskId === taskId);
  res.json(list);
});

// Activity log for Task
app.get('/api/activity/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const list = activities.filter((a) => a.taskId === taskId);
  res.json(list);
});

// Mitra Performance
app.get('/api/mitra/performance', (req: Request, res: Response) => {
  res.json(INITIAL_MITRA_PERF);
});

// Google Sheets 16-Table Data Export
app.get('/api/export-sheets', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Coordinator', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Koordinator dan Admin yang dapat mengakses database Sheets' });
  }

  const sheetsPayload = {
    exportTimestamp: new Date().toISOString(),
    version: 'CLX OMS V8.0 WORKFLOW',
    sheets: {
      '01 DASHBOARD': {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Sites', sites.length],
          ['Available Sites', sites.filter((s) => s.operational === 'AVAILABLE').length],
          ['Unavailable Sites', sites.filter((s) => s.operational === 'UNAVAILABLE').length],
          ['Active TTs', troubleTickets.filter((t) => t.statusBSS !== 'Closed').length],
        ],
      },
      '03 CM MONITORING': {
        headers: [
          'TT ID',
          'Date',
          'Status BSS',
          'Priorities',
          'Serial Number',
          'Station Name',
          'Faulted Alarm',
          'PIC',
          'SLA',
          'Category',
        ],
        rows: troubleTickets.map((t) => [
          t.ttId,
          t.date,
          t.statusBSS,
          t.priorities,
          t.serialNumber,
          t.stationName,
          t.faultedAlarm,
          t.pic,
          t.sla,
          t.category,
        ]),
      },
      '07 SITE MASTER': {
        headers: [
          'Cabinet S/N',
          'Station Code',
          'Location Name',
          'District',
          'Province',
          'Operational',
          'Battery Count',
          'Team Lead',
          'Lat Long',
        ],
        rows: sites.map((s) => [
          s.cabinetSN,
          s.stationCode,
          s.locationName,
          s.district,
          s.province,
          s.operational,
          s.batteryCount,
          s.teamLead,
          s.latLong,
        ]),
      },
      '08 USER MASTER': {
        headers: ['Email', 'Name', 'Role', 'Mitra/Team', 'Active'],
        rows: users.map((u) => [u.email, u.name, u.role, u.mitra || '', u.active ? 'TRUE' : 'FALSE']),
      },
      '09 WORKFLOW TASKS': {
        headers: [
          'Task ID',
          'Task Type',
          'TT ID',
          'Site Name',
          'Mitra/Team',
          'Technician Name',
          'Status',
          'Assigned At',
          'Check In At',
          'Check Out At',
        ],
        rows: tasks.map((t) => [
          t.taskId,
          t.taskType,
          t.ttId || '',
          t.siteName,
          t.mitra,
          t.technicianName || '',
          t.status,
          t.assignedAt || '',
          t.checkInAt || '',
          t.checkOutAt || '',
        ]),
      },
      '13 PM CHECKLIST': {
        headers: ['Task ID', 'Checklist Item', 'Category', 'Result', 'Remarks'],
        rows: pmChecklistStore.map((p) => [p.taskId, p.item, p.category, p.result, p.remarks || '']),
      },
      '14 AUDIT LOG': {
        headers: ['Timestamp', 'Task ID', 'Actor', 'Action', 'From Status', 'To Status'],
        rows: activities.map((a) => [a.timestamp, a.taskId, a.actorEmail, a.action, a.fromStatus || '', a.toStatus || '']),
      },
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="CLX_OMS_V8_Sheets_Export.json"');
  res.json(sheetsPayload);
});

// Simulate Excel Reconcile Upload
app.post('/api/upload-excel', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  if (!['Coordinator', 'Admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  const { fileName } = req.body;
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];

  // Simulates discovering an unavailable site from the customer sheet
  const newTTSeq = troubleTickets.length + 1;
  const newTTNumber = newTTId(now, newTTSeq);

  const newTicket: TroubleTicket = {
    ttId: newTTNumber,
    date: now.toISOString(),
    statusBSS: 'Pending',
    priorities: 'Priority 1',
    serialNumber: 'CAB-JKT-099',
    stationName: 'SPBU Palmerah Barat Baru',
    stationCode: 'ST-JKT-PALMERAH',
    faultedAlarm: 'Station Blocked: Connection Timeout; BSS Non-Available',
    statusCharger: 'Offline',
    statusBattery: 'With Battery',
    pic: 'PT MITRA JAYA PERSADA',
    sla: new Date(now.getTime() + 12 * 3600000).toISOString(),
    category: 'Connectivity Issue',
    district: 'Jakarta Barat',
    province: 'DKI Jakarta',
    siteKey: 'BSS|CAB-JKT-099',
    source: 'CUSTOMER DAILY UPLOAD',
    hasActiveTask: false,
  };

  troubleTickets.unshift(newTicket);

  // Check if site already in Site Master
  if (!sites.some((s) => s.cabinetSN === 'CAB-JKT-099')) {
    sites.push({
      siteKey: 'BSS|CAB-JKT-099',
      cabinetSN: 'CAB-JKT-099',
      stationCode: 'ST-JKT-PALMERAH',
      locationName: 'SPBU Palmerah Barat Baru',
      address: 'Jl. Palmerah Barat No. 12',
      district: 'Jakarta Barat',
      province: 'DKI Jakarta',
      latLong: '-6.2081,106.7925',
      lat: -6.2081,
      lng: 106.7925,
      connectivity: 'OFFLINE',
      operational: 'UNAVAILABLE',
      faultedReason: 'BSS Non-Available from customer upload',
      batteryCount: 8,
      emptySlots: 2,
      teamLead: 'PT MITRA JAYA PERSADA',
      mappingStatus: 'NEW SITE — RECONCILED',
      lastUpdated: now.toISOString(),
    });
  }

  res.json({
    ok: true,
    batch: `BSS-${now.toISOString().replace(/\D/g, '').slice(0, 14)}`,
    fileName: fileName || 'Customer_BSS_Daily.xlsx',
    siteListMatched: sites.length,
    newSites: 1,
    withBatteryTT: 1,
    withoutBatteryTT: 0,
    customerTT: 1,
    cmCreated: 1,
    newTicket,
  });
});

// Serve Google Apps Script raw files for direct copy & download
app.get('/api/gas/code', (req: Request, res: Response) => {
  const codePath = path.resolve(__dirname, 'gas_dist', 'Code.gs');
  res.sendFile(codePath);
});

app.get('/api/gas/index', (req: Request, res: Response) => {
  const indexPath = path.resolve(__dirname, 'gas_dist', 'Index.html');
  res.sendFile(indexPath);
});

// Register FCM token
app.post('/api/fcm/register', (req: Request, res: Response) => {
  const currentUser = getCurrentUser();
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  fcmTokens = fcmTokens.filter((f) => f.token !== token);
  fcmTokens.push({
    email: currentUser.email,
    token,
    updatedAt: new Date().toISOString(),
  });

  res.json({ ok: true, registered: true });
});

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CLX OMS V8 Server running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start CLX OMS Server:', err);
  });
}

export default app;
