/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX Operation Management System (OMS) V8 - Main Application
 * Strict Role-Based View Rendering & Navigation Enforcement
 */

import React, { useState, useEffect } from 'react';
import {
  UserMaster,
  SiteMaster,
  TroubleTicket,
  WorkflowTask,
  DashboardSummary,
  MitraPerformance,
  TaskActivity,
  PMChecklistItem,
} from './types/oms';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { CoordinatorView } from './components/CoordinatorView';
import { MitraView } from './components/MitraView';
import { TechnicianView } from './components/TechnicianView';
import { InteractivePMChecklist } from './components/InteractivePMChecklist';
import { GisBssMap } from './components/GisBssMap';
import { SheetsSyncModal } from './components/SheetsSyncModal';
import { GASDeploymentModal } from './components/GASDeploymentModal';
import {
  getClientState,
  saveClientState,
  computeDashboardSummary,
} from './data/clientStore';
import {
  newTTId,
  validateTechnicianTransition,
} from './utils/omsLogic';
import {
  Shield,
  Users,
  HardHat,
  Lock,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserMaster | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserMaster[]>([]);
  const [activeTab, setActiveTab] = useState<string>('coord_portal');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isGASModalOpen, setIsGASModalOpen] = useState<boolean>(false);

  // App Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [tickets, setTickets] = useState<TroubleTicket[]>([]);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [mitraPerf, setMitraPerf] = useState<MitraPerformance[]>([]);
  const [recentActivities, setRecentActivities] = useState<TaskActivity[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [targetPMTaskId, setTargetPMTaskId] = useState<string | undefined>(undefined);
  const [isStandaloneMode, setIsStandaloneMode] = useState<boolean>(false);

  // Helper: Get default landing tab per role
  const getDefaultTabForRole = (role: string): string => {
    if (role === 'Technician') return 'tech_portal';
    if (role === 'Mitra') return 'mitra_portal';
    return 'coord_portal';
  };

  // Fetch initial context and datasets (with graceful client fallback for Vercel static)
  const loadAppData = async (shouldAutoSwitchTab = false) => {
    setLoading(true);
    setErrorMsg(null);
    let apiSuccess = false;

    try {
      const ctxRes = await fetch('/api/context');
      const contentType = ctxRes.headers.get('content-type') || '';

      if (ctxRes.ok && contentType.includes('application/json')) {
        const ctxData = await ctxRes.json();
        const user: UserMaster = {
          email: ctxData.email,
          name: ctxData.name,
          role: ctxData.role,
          mitra: ctxData.mitra,
          active: true,
        };
        setCurrentUser(user);
        setAvailableUsers(ctxData.availableUsers || []);

        if (shouldAutoSwitchTab) {
          setActiveTab(getDefaultTabForRole(user.role));
        }

        const [dashRes, sitesRes, ttRes, tasksRes, perfRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/sites'),
          fetch('/api/tt/queue'),
          fetch('/api/tasks'),
          fetch('/api/mitra/performance'),
        ]);

        const [dashData, sitesData, ttData, tasksData, perfData] = await Promise.all([
          dashRes.json(),
          sitesRes.json(),
          ttRes.json(),
          tasksRes.json(),
          perfRes.json(),
        ]);

        setSummary(dashData);
        setSites(sitesData);
        setTickets(ttData);
        setTasks(tasksData);
        setMitraPerf(perfData);

        if (tasksData.length > 0) {
          const actRes = await fetch(`/api/activity/${tasksData[0].taskId}`);
          if (actRes.ok && (actRes.headers.get('content-type') || '').includes('application/json')) {
            const actData = await actRes.json();
            setRecentActivities(actData);
          }
        }

        apiSuccess = true;
        setIsStandaloneMode(false);
      }
    } catch {
      apiSuccess = false;
    }

    if (!apiSuccess) {
      // Resilient Client Standalone / Offline Mode (e.g. Vercel Static Deploy)
      const client = getClientState();
      const user =
        client.users.find(
          (u) => u.email.toLowerCase() === client.currentEmail.toLowerCase() && u.active
        ) || client.users[0];

      setCurrentUser(user);
      setAvailableUsers(client.users);
      setSites(client.sites);
      setTickets(client.tickets);
      setTasks(client.tasks);
      setMitraPerf(client.mitraPerf);
      setRecentActivities(client.activities);
      setSummary(computeDashboardSummary(client.sites, client.tickets));
      setIsStandaloneMode(true);

      if (shouldAutoSwitchTab) {
        setActiveTab(getDefaultTabForRole(user.role));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAppData(true);
  }, []);

  // Switch active user & immediately update active tab to that role's portal
  const handleSelectUserEmail = async (email: string) => {
    try {
      const res = await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const resJson = await res.json();
        const switchedUser: UserMaster = resJson.user;
        setActiveTab(getDefaultTabForRole(switchedUser.role));
        await loadAppData(false);
        return;
      }
    } catch {
      // fallback to client store
    }

    const client = getClientState();
    const found = client.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (found) {
      saveClientState({ currentEmail: found.email });
      setCurrentUser(found);
      setActiveTab(getDefaultTabForRole(found.role));
      await loadAppData(false);
    }
  };

  // TT Actions
  const handleAssignTT = async (ttId: string, mitra: string) => {
    try {
      const res = await fetch('/api/tt/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttId, mitra }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const tt = client.tickets.find((t) => t.ttId === ttId);
    if (!tt) return;
    const now = new Date().toISOString();
    const taskId = `CLX-TT-${now.replace(/[-:T]/g, '').slice(0, 15)}-${Math.floor(100 + Math.random() * 900)}`;
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
      assignedBy: currentUser?.email || 'admin@clx.co.id',
      assignedAt: now,
      lastUpdated: now,
      reviewStatus: 'NOT_SUBMITTED',
    };
    tt.hasActiveTask = true;
    tt.pic = mitra;
    const updatedTasks = [newTask, ...client.tasks];
    const updatedActivities: TaskActivity[] = [
      {
        id: `ACT-${Date.now()}`,
        timestamp: now,
        taskId,
        actorEmail: currentUser?.email || 'admin@clx.co.id',
        actorRole: currentUser?.role || 'Coordinator',
        action: 'ASSIGN_TT',
        fromStatus: 'CREATED',
        toStatus: 'ASSIGNED_TO_MITRA',
        remarks: `Mitra: ${mitra}`,
      },
      ...client.activities,
    ];
    saveClientState({
      tickets: [...client.tickets],
      tasks: updatedTasks,
      activities: updatedActivities,
    });
    await loadAppData();
  };

  const handleBulkAssignTT = async (items: Array<{ ttId: string; mitra: string }>) => {
    try {
      const res = await fetch('/api/tt/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const now = new Date().toISOString();
    const newTasks = [...client.tasks];
    const newActivities = [...client.activities];

    items.forEach((item) => {
      const tt = client.tickets.find((t) => t.ttId === item.ttId);
      if (!tt) return;
      const taskId = `CLX-TT-${now.replace(/[-:T]/g, '').slice(0, 15)}-${Math.floor(100 + Math.random() * 900)}`;
      newTasks.unshift({
        taskId,
        taskType: 'TT',
        ttId: tt.ttId,
        siteKey: tt.siteKey,
        cabinetSN: tt.serialNumber,
        stationCode: tt.stationCode,
        siteName: tt.stationName,
        mitra: item.mitra || tt.pic,
        source: 'COORDINATOR_BULK_ASSIGNMENT',
        status: 'ASSIGNED_TO_MITRA',
        assignedBy: currentUser?.email || 'admin@clx.co.id',
        assignedAt: now,
        lastUpdated: now,
        reviewStatus: 'NOT_SUBMITTED',
      });
      tt.hasActiveTask = true;
      newActivities.unshift({
        id: `ACT-${Date.now()}-${Math.random()}`,
        timestamp: now,
        taskId,
        actorEmail: currentUser?.email || 'admin@clx.co.id',
        actorRole: currentUser?.role || 'Coordinator',
        action: 'BULK_ASSIGN_TT',
        fromStatus: 'CREATED',
        toStatus: 'ASSIGNED_TO_MITRA',
        remarks: `Mitra: ${item.mitra || tt.pic}`,
      });
    });

    saveClientState({
      tickets: [...client.tickets],
      tasks: newTasks,
      activities: newActivities,
    });
    await loadAppData();
  };

  // Register technician by Mitra
  const handleRegisterTechnician = async (name: string, email: string) => {
    try {
      const res = await fetch('/api/users/technician', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const newTech: UserMaster = {
      email: String(email).trim().toLowerCase(),
      name: String(name).trim(),
      role: 'Technician',
      mitra: currentUser?.mitra || 'PT MITRA JAYA PERSADA',
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.email,
    };
    saveClientState({ users: [...client.users, newTech] });
    await loadAppData();
  };

  // Assign technician to task by Mitra
  const handleAssignTechnician = async (taskId: string, technicianEmail: string) => {
    try {
      const res = await fetch('/api/tasks/assign-technician', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, technicianEmail }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const task = client.tasks.find((t) => t.taskId === taskId);
    const tech = client.users.find((u) => u.email.toLowerCase() === technicianEmail.toLowerCase());
    if (task && tech) {
      const from = task.status;
      task.technicianEmail = tech.email;
      task.technicianName = tech.name;
      task.status = 'ASSIGNED_TO_TECHNICIAN';
      task.lastUpdated = new Date().toISOString();
      const updatedActs: TaskActivity[] = [
        {
          id: `ACT-${Date.now()}`,
          timestamp: new Date().toISOString(),
          taskId,
          actorEmail: currentUser?.email || 'admin@clx.co.id',
          actorRole: currentUser?.role || 'Mitra',
          action: 'ASSIGN_TECHNICIAN',
          fromStatus: from,
          toStatus: 'ASSIGNED_TO_TECHNICIAN',
          remarks: tech.name,
        },
        ...client.activities,
      ];
      saveClientState({ tasks: [...client.tasks], activities: updatedActs });
      await loadAppData();
    }
  };

  // Technician Task Action
  const handleTaskAction = async (data: {
    taskId: string;
    action: string;
    location?: string;
    evidenceUrl?: string;
    issueDetail?: string;
    rca1?: string;
    rca2?: string;
    correctiveAction?: string;
    reportSummary?: string;
    cmStatus?: string;
    note?: string;
  }) => {
    try {
      const res = await fetch('/api/tasks/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const task = client.tasks.find((t) => t.taskId === data.taskId);
    if (!task) return;

    const validation = validateTechnicianTransition(task.status, data.action);
    if (!validation.valid || !validation.nextStatus) {
      throw new Error(validation.error || 'Aksi teknisi tidak valid');
    }

    const from = task.status;
    const to = validation.nextStatus;
    const now = new Date().toISOString();

    if (data.action === 'ACCEPT') task.acceptedAt = now;
    if (data.action === 'CHECK_IN') {
      task.checkInAt = now;
      task.checkInLocation = data.location;
      task.checkInEvidenceUrl = data.evidenceUrl;
    }
    if (data.action === 'CHECK_OUT') {
      task.checkOutAt = now;
      task.checkOutLocation = data.location;
      task.checkOutEvidenceUrl = data.evidenceUrl;
    }
    if (data.action === 'SAVE_PROGRESS' || data.action === 'SUBMIT') {
      if (data.issueDetail) task.issueDetail = data.issueDetail;
      if (data.rca1) task.rca1 = data.rca1;
      if (data.rca2) task.rca2 = data.rca2;
      if (data.correctiveAction) task.correctiveAction = data.correctiveAction;
      if (data.reportSummary) task.reportSummary = data.reportSummary;
      if (data.cmStatus || data.note) {
        task.pendingReason = [data.cmStatus, data.note].filter(Boolean).join(' | ');
      }
    }
    if (data.action === 'SUBMIT') {
      task.submittedAt = now;
      task.reviewStatus = 'WAITING_REVIEW';
    }

    task.status = to;
    task.lastUpdated = now;

    const updatedActs: TaskActivity[] = [
      {
        id: `ACT-${Date.now()}`,
        timestamp: now,
        taskId: data.taskId,
        actorEmail: currentUser?.email || 'budi.tech@clx.co.id',
        actorRole: 'Technician',
        action: data.action,
        fromStatus: from,
        toStatus: to,
        remarks: data.reportSummary || data.cmStatus || '',
      },
      ...client.activities,
    ];

    saveClientState({ tasks: [...client.tasks], activities: updatedActs });
    await loadAppData();
  };

  // Upload Evidence
  const handleUploadEvidence = async (data: {
    taskId: string;
    evidenceType: 'CLOCK_IN' | 'CLOCK_OUT' | 'CM_PROGRESS';
    data: string;
    description?: string;
    geo?: {
      lat: number;
      lon: number;
      accuracy: number;
      timestamp: string;
    };
  }) => {
    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return;
      }
    } catch {
      // fallback
    }
  };

  // Review Task by Coordinator
  const handleReviewTask = async (
    taskId: string,
    decision: 'APPROVE' | 'REWORK',
    remarks?: string
  ) => {
    try {
      const res = await fetch('/api/tasks/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, decision, remarks }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const task = client.tasks.find((t) => t.taskId === taskId);
    if (!task) return;

    const from = task.status;
    const to = decision === 'APPROVE' ? 'CLOSED' : 'REWORK';
    const now = new Date().toISOString();

    task.status = to;
    task.reviewStatus = decision;
    task.reviewedBy = currentUser?.email;
    task.reviewedAt = now;
    task.reviewRemarks = remarks || '';
    task.lastUpdated = now;

    if (to === 'CLOSED' && task.ttId) {
      const tt = client.tickets.find((t) => t.ttId === task.ttId);
      if (tt) tt.statusBSS = 'Closed';
      const site = client.sites.find((s) => s.siteKey === task.siteKey);
      if (site) {
        site.operational = 'AVAILABLE';
        site.faultedReason = '';
      }
    }

    const updatedActs: TaskActivity[] = [
      {
        id: `ACT-${Date.now()}`,
        timestamp: now,
        taskId,
        actorEmail: currentUser?.email || 'coordinator@clx.co.id',
        actorRole: currentUser?.role || 'Coordinator',
        action: `REVIEW_${decision}`,
        fromStatus: from,
        toStatus: to,
        remarks: remarks || '',
      },
      ...client.activities,
    ];

    saveClientState({
      tasks: [...client.tasks],
      tickets: [...client.tickets],
      sites: [...client.sites],
      activities: updatedActs,
    });
    await loadAppData();
  };

  // Start PM
  const handleStartPM = async (siteKey: string, mitra?: string) => {
    try {
      const res = await fetch('/api/pm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteKey, mitra }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const site = client.sites.find((s) => s.siteKey === siteKey);
    if (!site) return;
    const now = new Date().toISOString();
    const taskId = `CLX-PM-${now.replace(/[-:T]/g, '').slice(0, 15)}-${Math.floor(100 + Math.random() * 900)}`;
    const newTask: WorkflowTask = {
      taskId,
      taskType: 'PM',
      siteKey,
      cabinetSN: site.cabinetSN,
      stationCode: site.stationCode,
      siteName: site.locationName,
      mitra: mitra || site.teamLead,
      source: currentUser?.role === 'Mitra' ? 'MITRA_SELF_INITIATED' : 'COORDINATOR_ASSIGNMENT',
      status: 'ASSIGNED_TO_MITRA',
      assignedBy: currentUser?.email || 'coordinator@clx.co.id',
      assignedAt: now,
      lastUpdated: now,
      reviewStatus: 'NOT_SUBMITTED',
    };
    saveClientState({
      tasks: [newTask, ...client.tasks],
      activities: [
        {
          id: `ACT-${Date.now()}`,
          timestamp: now,
          taskId,
          actorEmail: currentUser?.email || 'coordinator@clx.co.id',
          actorRole: currentUser?.role || 'Coordinator',
          action: 'START_PM',
          fromStatus: 'DUE',
          toStatus: 'ASSIGNED_TO_MITRA',
          remarks: `Site: ${site.locationName}`,
        },
        ...client.activities,
      ],
    });
    await loadAppData();
  };

  // Save PM Checklist
  const handleSavePMChecklist = async (taskId: string, items: PMChecklistItem[]) => {
    try {
      const res = await fetch(`/api/pm/checklist/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const existingOther = client.checklists.filter((c) => c.taskId !== taskId);
    saveClientState({ checklists: [...existingOther, ...items] });
  };

  // Upload Excel simulation
  const handleUploadExcelSimulation = async (fileName: string) => {
    try {
      const res = await fetch('/api/upload-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        await loadAppData();
        return;
      }
    } catch {
      // fallback
    }

    const client = getClientState();
    const now = new Date();
    const newTTSeq = client.tickets.length + 1;
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
    saveClientState({
      tickets: [newTicket, ...client.tickets],
    });
    await loadAppData();
  };


  const handleOpenPMChecklist = (taskId: string) => {
    setTargetPMTaskId(taskId);
    setActiveTab('pm_checklist');
  };

  const isCoordinator = currentUser?.role === 'Coordinator' || currentUser?.role === 'Admin';
  const isMitra = currentUser?.role === 'Mitra';
  const isTechnician = currentUser?.role === 'Technician';

  const unassignedCount = tickets.filter((t) => t.statusBSS !== 'Closed' && !t.hasActiveTask).length;
  const myTaskCount = isTechnician
    ? tasks.filter((t) => t.technicianEmail?.toLowerCase() === currentUser?.email.toLowerCase()).length
    : isMitra
    ? tasks.filter((t) => String(t.mitra).toUpperCase() === String(currentUser?.mitra).toUpperCase()).length
    : tasks.length;

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-[#f4f7fb] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg mb-4 animate-bounce">
          CLX
        </div>
        <div className="text-sm font-bold text-slate-800">Menghubungkan ke CLX OMS V8 Core…</div>
        <p className="text-xs text-slate-500 mt-1 font-mono">Memuat hak akses & database stasiun BSS</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] flex flex-col font-sans">
      {/* 3-Zone Top Bar */}
      {currentUser && (
        <Header
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenGASModal={() => setIsGASModalOpen(true)}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />
      )}

      {/* Role-Restricted Sub Navigation */}
      {currentUser && (
        <Navigation
          currentUser={currentUser}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          unassignedCount={unassignedCount}
          myTaskCount={myTaskCount}
        />
      )}

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Prominent Active Role & Identity Banner (matching original GAS #who & #roleLine) */}
        {currentUser && (
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
              isCoordinator
                ? 'bg-slate-900 border-slate-800 text-white'
                : isMitra
                ? 'bg-sky-950 border-sky-900 text-white'
                : 'bg-amber-950 border-amber-900 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isCoordinator
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isMitra
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {isCoordinator ? (
                  <Shield className="w-5 h-5" />
                ) : isMitra ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <HardHat className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight">{currentUser.name}</span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono ${
                      isCoordinator
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isMitra
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    ROLE: {currentUser.role}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5 font-mono">
                  {currentUser.email} {currentUser.mitra ? `· Mitra: ${currentUser.mitra}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="hidden md:inline-block text-[11px] text-slate-300 font-mono">
                {isCoordinator
                  ? 'Akses: Upload Customer, TT Queue, Bulk WA, Review, Sheets'
                  : isMitra
                  ? 'Akses: Dashboard Mitra, Alokasi Teknisi, PM Mandiri'
                  : 'Akses: Task Saya, GPS Clock In/Out, Progress CM, Checklist PM'}
              </span>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                Ganti Peran / Switch Role
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ----------------- COORDINATOR & ADMIN EXCLUSIVE VIEWS ----------------- */}
        {isCoordinator && activeTab === 'coord_portal' && currentUser && (
          <CoordinatorView
            currentUser={currentUser}
            tickets={tickets}
            tasks={tasks}
            sites={sites}
            onRefresh={loadAppData}
            onAssignTT={handleAssignTT}
            onBulkAssignTT={handleBulkAssignTT}
            onReviewTask={handleReviewTask}
            onAssignPM={(siteKey, mitra) => handleStartPM(siteKey, mitra)}
            onUploadExcelSimulation={handleUploadExcelSimulation}
          />
        )}

        {isCoordinator && activeTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            sites={sites}
            mitraPerformance={mitraPerf}
            recentActivities={recentActivities}
            onNavigateToTab={setActiveTab}
          />
        )}

        {isCoordinator && activeTab === 'sheets_sync' && <SheetsSyncModal />}

        {/* ----------------- MITRA EXCLUSIVE PORTAL ----------------- */}
        {isMitra && activeTab === 'mitra_portal' && currentUser && (
          <MitraView
            currentUser={currentUser}
            tasks={tasks}
            sites={sites}
            technicians={availableUsers}
            onRegisterTechnician={handleRegisterTechnician}
            onAssignTechnician={handleAssignTechnician}
            onStartSelfPM={(siteKey) => handleStartPM(siteKey, currentUser.mitra)}
            onRefresh={loadAppData}
          />
        )}

        {/* ----------------- TECHNICIAN EXCLUSIVE PORTAL ----------------- */}
        {isTechnician && activeTab === 'tech_portal' && currentUser && (
          <TechnicianView
            currentUser={currentUser}
            tasks={tasks}
            onTaskAction={handleTaskAction}
            onUploadEvidence={handleUploadEvidence}
            onRefresh={loadAppData}
            onOpenPMChecklist={handleOpenPMChecklist}
          />
        )}

        {isTechnician && activeTab === 'pm_checklist' && (
          <InteractivePMChecklist
            tasks={tasks}
            onSaveChecklist={handleSavePMChecklist}
            preselectedTaskId={targetPMTaskId}
          />
        )}

        {/* ----------------- SHARED MAP (AVAILABLE TO ALL AUTHORIZED ROLES) ----------------- */}
        {activeTab === 'gis_map' && <GisBssMap sites={sites} />}

        {/* ----------------- ACCESS DENIED FALLBACK (IF USER TRICKED URL OR TAB) ----------------- */}
        {!isCoordinator && (activeTab === 'coord_portal' || activeTab === 'sheets_sync') && (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Akses Ditolak: Fitur Khusus Koordinator</h3>
              <p className="text-xs text-slate-500 mt-1">
                Role Anda adalah <b>{currentUser?.role}</b>. Fitur Upload Excel Customer, Antrean TT, Bulk WhatsApp, Review Task, dan Database Sheets hanya dapat diakses oleh akun Koordinator atau Admin.
              </p>
            </div>
            <button
              onClick={() => setActiveTab(getDefaultTabForRole(currentUser?.role || ''))}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
            >
              Kembali ke Portal {currentUser?.role}
            </button>
          </div>
        )}
      </main>

      {/* User Login & Role Switcher Modal */}
      {currentUser && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          availableUsers={availableUsers}
          onSelectUserEmail={handleSelectUserEmail}
        />
      )}

      {/* Google Apps Script Deployment Helper & Code Exporter Modal */}
      <GASDeploymentModal
        isOpen={isGASModalOpen}
        onClose={() => setIsGASModalOpen(false)}
      />
    </div>
  );
}
