/**
 * CLX BSS OMS V8.0 - WORKFLOW BACKEND & GOOGLE SHEETS LIVE DATABASE
 * File: Code.gs
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1cIhX9yezlmfwLoEhl0GpEq-U3cjghHPtyfTNCYl5ZRI/edit
 * Kompatibel penuh dengan skema 16 sheet CLX OMS
 */

const OMS = {
  VERSION: '8.0 WORKFLOW (LIVE SHEETS SYNC)',
  SPREADSHEET_ID: '1cIhX9yezlmfwLoEhl0GpEq-U3cjghHPtyfTNCYl5ZRI',
  TZ: Session.getScriptTimeZone() || 'Asia/Jakarta',
  SLA: 12,
  S: {
    DASH: '01 DASHBOARD',
    DAILY: '02 DAILY MONITORING',
    CM: '03 CM MONITORING',
    PM: '04 PM MONITORING',
    PERF: '05 MITRA PERFORMANCE',
    PMCM: '06 PM VS CM',
    SITE: '07 SITE MASTER',
    USERS: '08 USER MASTER',
    TASKS: '09 WORKFLOW TASKS',
    ACTIVITY: '10 WORK ACTIVITY',
    EVIDENCE: '11 WORK EVIDENCE',
    REVIEW: '12 WORK REVIEW',
    PMCHECK: '13 PM CHECKLIST',
    AUDIT: '14 AUDIT LOG',
    PMSITE: '15 PM SITE STATUS',
    FCM: '16 FCM TOKENS'
  }
};

/**
 * Dapatkan instance Spreadsheet target secara konsisten
 */
function getSS_() {
  if (OMS.SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(OMS.SPREADSHEET_ID);
    } catch (e) {
      console.warn('Gagal openById, beralih ke getActiveSpreadsheet:', e);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.getActive();
}

/**
 * Menu bar otomatis di Google Spreadsheet
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CLX BSS OMS')
    .addItem('Buka Aplikasi OMS (Dialog)', 'openOMS')
    .addItem('Inisialisasi / Perbaiki 16 Sheet', 'setupOMS')
    .addItem('Sinkronkan Ulang Data', 'refreshReports')
    .addToUi();
}

/**
 * Web App Entry Points (Dapat diakses langsung oleh browser atau via REST API)
 */
function doGet(e) {
  // Jika dipanggil oleh React Web App dengan parameter ?action=...
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest_(e.parameter.action, e.parameter);
  }

  // Tampilan bawaan jika dibuka langsung di browser
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CLX Operation Management System V8')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=5.0');
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || (e && e.parameter && e.parameter.action);
    return handleApiRequest_(action, payload);
  } catch (err) {
    return createJsonResponse_({ ok: false, error: String(err.message || err) });
  }
}

function openOMS() {
  const html = HtmlService.createHtmlOutputFromFile('Index')
    .setWidth(1280)
    .setHeight(880);
  SpreadsheetApp.getUi().showModalDialog(html, 'CLX BSS OMS V8.0');
}

function setupOMS() {
  ensure16Sheets_();
  return '16 Sheet CLX BSS OMS siap digunakan pada spreadsheet: ' + OMS.SPREADSHEET_ID;
}

/**
 * REST API Dispatcher untuk Frontend React (Vercel / Local / Cloud Run)
 */
function handleApiRequest_(action, p) {
  try {
    switch (action) {
      case 'ping':
        return createJsonResponse_({ ok: true, version: OMS.VERSION, spreadsheetId: OMS.SPREADSHEET_ID, timestamp: new Date().toISOString() });

      case 'getContext':
        return createJsonResponse_({ ok: true, context: getMyContext(), users: getAllUsers_() });

      case 'getInitialData':
      case 'sync':
        return createJsonResponse_({
          ok: true,
          spreadsheetId: OMS.SPREADSHEET_ID,
          context: getMyContext(),
          users: getAllUsers_(),
          sites: getSitesList_(),
          tickets: coordinatorTTQueue(),
          tasks: myTaskList(),
          mitraPerf: getMitraPerformance_(),
          pmCandidates: getPMCandidates()
        });

      case 'assignTT':
        return createJsonResponse_(coordinatorAssignTT(p));

      case 'bulkAssignTT':
        return createJsonResponse_(coordinatorBulkAssignTT(p));

      case 'assignTechnician':
        return createJsonResponse_(mitraAssignTaskToTech(p));

      case 'registerTechnician':
        return createJsonResponse_(mitraRegisterTech(p));

      case 'taskAction':
        return createJsonResponse_(technicianUpdateStatus(p));

      case 'uploadEvidence':
        return createJsonResponse_(technicianUploadEvidence(p));

      case 'submitTask':
        return createJsonResponse_(technicianSubmitTask(p));

      case 'reviewTask':
        return createJsonResponse_(coordinatorReviewTask(p));

      case 'startPM':
        return createJsonResponse_(coordinatorStartPM(p));

      case 'saveChecklist':
        return createJsonResponse_(technicianSavePMChecklist(p));

      case 'setupSheets':
        return createJsonResponse_({ ok: true, message: setupOMS() });

      default:
        return createJsonResponse_({ ok: false, error: 'Aksi API tidak dikenal: ' + action });
    }
  } catch (err) {
    return createJsonResponse_({ ok: false, error: String(err.message || err) });
  }
}

function createJsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Memastikan ke-16 Sheet tersedia dengan struktur kolom lengkap
 */
function ensure16Sheets_() {
  const defs = {
    [OMS.S.DASH]: ['Metric', 'Value', 'Category', 'Last Updated'],
    [OMS.S.DAILY]: ['Date','Site Key','Cabinet S/N','Station Code','Site Name','Mitra/Team','Connectivity','Customer TT','Operational','Faulted Reason','Station Block Status','Battery Count','Battery Type','Previous Day Status','Daily Transition','Auto Resolution','Source File','Import Batch','Remarks'],
    [OMS.S.CM]: ['Date','Status BSS','Last Visit','Priorities','Serial Number','Station Name','Faulted Alarm','Status Charger','Status Battery','PIC','Assign Date','Scheduled/Wairing Part','Closed/Completed At','SLA','Category','RCA 1','RCA 2','PIC on Site','Remarks','Corrective Action / Progress','Problem Category','Note','Districk','Provinsi','TT ID','Site Key','Source','Import Batch','Last Update','Internal Remarks'],
    [OMS.S.PM]: ['Date','Period Start','Period End','Mitra/Team','Total Site','Daily Target','Actual PM','Achievement %','Remarks'],
    [OMS.S.PERF]: ['Period Start','Period End','Mitra/Team','Total Site','Customer TT','Visit','Solved','Auto Closed','Pending','Waiting Sparepart','Outstanding','SLA Met %','PM Achievement %','Performance Score'],
    [OMS.S.PMCM]: ['Period Start','Period End','Mitra/Team','Total Site','PM Target','PM Actual','PM Achievement %','Customer TT','CM Visit','CM Rate %'],
    [OMS.S.SITE]: ['Cabinet S/N','Cabinet type','Battery Count','Station Code','Location Name','Address','District','Province','MS','Lat Long','Firmware Version','Connectivity','Operational','Faulted Reason','Error Code','Slot Faulted Status','Fault Validation','BSS Type Validation','Station Block Status','Station Block Reason','Station Block Open Timestamp','Cabinet Block Status','Cabinet Block Reason','Cabinet Block Open Timestamp','Slot Blocked Status','Activation Date','Note','KPI','KPI wo Batt','Exclude','Degradated Active','Empty Available Slot Count','Slot Not Charging','Battery SOH 70%-80% Warning','Battery SOH<70% Breach','Team Lead','ID Pelanggan','OMS Mapping Status','OMS First Detected'],
    [OMS.S.USERS]: ['Email','Name','Role','Mitra/Team','Active','Created At','Created By'],
    [OMS.S.TASKS]: ['Task ID','Task Type','TT ID','Site Key','Cabinet S/N','Station Code','Site Name','Mitra/Team','Technician Email','Technician Name','Source','Cycle Start','Cycle End','Status','Assigned By','Assigned At','Accepted At','Check In At','Check In Location','Check In Evidence URL','Issue Detail','RCA 1','RCA 2','Corrective Action','Check Out At','Check Out Location','Check Out Evidence URL','Report Summary','Submitted At','Review Status','Reviewed By','Reviewed At','Review Remarks','Pending Reason','Last Updated','PM Report URL'],
    [OMS.S.ACTIVITY]: ['Timestamp','Task ID','Actor Email','Actor Role','Action','From Status','To Status','Remarks'],
    [OMS.S.EVIDENCE]: ['Timestamp','Task ID','Evidence Type','Evidence URL','Description','Uploaded By'],
    [OMS.S.REVIEW]: ['Timestamp','Task ID','Decision','Reviewer Email','Remarks'],
    [OMS.S.PMCHECK]: ['Task ID','Checklist Item','Category','Result','Remarks','Evidence URL'],
    [OMS.S.AUDIT]: ['Timestamp','Actor Email','Role','Action','Entity Type','Entity ID','Details'],
    [OMS.S.PMSITE]: ['Site Key','Cabinet S/N','Site Name','Mitra/Team','Cycle Start','Cycle End','PM Status','Task ID','PM Report URL','Last Updated'],
    [OMS.S.FCM]: ['Email','Name','Role','Mitra/Team','FCM Token','Updated At','Platform']
  };

  const ss = getSS_();
  Object.keys(defs).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, defs[name].length)
        .setFontWeight('bold')
        .setBackground('#0D213A')
        .setFontColor('#FFFFFF');
    }
  });
}

/**
 * Autentikasi Pengguna & Role Master dari Sheet 08 USER MASTER
 */
function currentUser_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.USERS);
  
  if (!sh || sh.getLastRow() < 2) {
    return { email: email || 'admin@clx.co.id', name: 'Admin CLX', role: 'Admin', mitra: '' };
  }

  const v = sh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);
  const row = v.slice(1).find(r => {
    const rEmail = clean_(r[h.email]);
    const active = clean_(r[h.active]).toUpperCase();
    return rEmail.toLowerCase() === email && (active === '' || ['TRUE','ACTIVE','YES','1','Y'].includes(active));
  });

  if (!row) {
    return { email: email || 'admin@clx.co.id', name: email.split('@')[0] || 'User', role: 'Coordinator', mitra: '' };
  }

  const rawRole = clean_(row[h.role]).toUpperCase();
  const roleMap = { 'ADMIN': 'Admin', 'COORDINATOR': 'Coordinator', 'MITRA': 'Mitra', 'TECHNICIAN': 'Technician' };
  const role = roleMap[rawRole] || 'Coordinator';
  return { email, name: clean_(row[h.name]) || email, role, mitra: clean_(row[h.mitra]) };
}

function getMyContext() {
  const u = currentUser_();
  return { email: u.email, name: u.name, role: u.role, mitra: u.mitra, version: OMS.VERSION, spreadsheetId: OMS.SPREADSHEET_ID };
}

function getAllUsers_() {
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.USERS);
  if (!sh || sh.getLastRow() < 2) return [];

  const v = sh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);

  return v.slice(1)
    .filter(r => clean_(r[h.email]))
    .map(r => ({
      email: clean_(r[h.email]).toLowerCase(),
      name: clean_(r[h.name]) || clean_(r[h.email]),
      role: clean_(r[h.role]) || 'Technician',
      mitra: clean_(r[h.mitra]) || '',
      active: ['TRUE','ACTIVE','YES','1','Y',''].includes(clean_(r[h.active]).toUpperCase())
    }));
}

function requireRole_(allowedRoles) {
  const u = currentUser_();
  if (!allowedRoles.includes(u.role)) {
    throw new Error('Akses ditolak: Fitur ini hanya dapat diakses oleh peran ' + allowedRoles.join(' atau ') + '. Akun Anda adalah: ' + u.role);
  }
  return u;
}

/**
 * 07 SITE MASTER: Mengambil Daftar Site Dinamis
 */
function getSitesList_() {
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.SITE);
  if (!sh || sh.getLastRow() < 2) return [];

  const v = sh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);

  return v.slice(1)
    .filter(r => clean_(r[h.cabinetsn]) || clean_(r[h.stationcode]) || clean_(r[h.locationname]))
    .map(r => {
      const cabinetSN = clean_(r[h.cabinetsn]);
      const stationCode = clean_(r[h.stationcode]);
      const locationName = clean_(r[h.locationname]) || 'BSS Station';
      const latLong = clean_(r[h.latlong]);
      let lat = -6.2000;
      let lng = 106.8166;
      if (latLong && latLong.includes(',')) {
        const parts = latLong.split(',');
        lat = parseFloat(parts[0]) || lat;
        lng = parseFloat(parts[1]) || lng;
      }

      return {
        siteKey: `BSS|${cabinetSN || stationCode || locationName}`,
        cabinetSN: cabinetSN || 'CAB-001',
        stationCode: stationCode || 'ST-001',
        locationName,
        address: clean_(r[h.address]) || locationName,
        district: clean_(r[h.district]) || 'Jakarta',
        province: clean_(r[h.province]) || 'DKI Jakarta',
        latLong,
        lat,
        lng,
        operational: (clean_(r[h.operational]) || 'AVAILABLE').toUpperCase(),
        connectivity: (clean_(r[h.connectivity]) || 'ONLINE').toUpperCase(),
        batteryCount: parseInt(r[h.batterycount]) || 8,
        emptySlots: parseInt(r[h.emptyavailableslotcount]) || 2,
        teamLead: clean_(r[h.teamlead]) || clean_(r[h.mitra]) || 'PT MITRA JAYA PERSADA',
        mappingStatus: clean_(r[h.omsmappingstatus]) || 'MAPPED'
      };
    });
}

/**
 * 03 CM MONITORING: Antrean Trouble Ticket Aktif
 */
function coordinatorTTQueue() {
  const ss = getSS_();
  const cmSh = ss.getSheetByName(OMS.S.CM);
  if (!cmSh || cmSh.getLastRow() < 2) return [];

  const v = cmSh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);

  // Cek task yang sudah aktif di Sheet 09 agar tidak terduplikasi
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const activeTTs = new Set();
  if (taskSh && taskSh.getLastRow() > 1) {
    const tv = taskSh.getDataRange().getValues();
    const th = getFlexibleHeaderMap_(tv[0]);
    tv.slice(1).forEach(r => {
      const status = clean_(r[th.status]).toUpperCase();
      if (!['CLOSED', 'CANCELLED'].includes(status)) {
        activeTTs.add(clean_(r[th.ttid]));
      }
    });
  }

  return v.slice(1)
    .filter(r => {
      const ttId = clean_(r[h.ttid]);
      const status = clean_(r[h.statusbss]);
      return ttId && status !== 'Closed';
    })
    .map(r => {
      const ttId = clean_(r[h.ttid]);
      const cabinet = clean_(r[h.serialnumber]);
      const station = clean_(r[h.stationname]);
      return {
        ttId,
        date: r[h.date] instanceof Date ? Utilities.formatDate(r[h.date], OMS.TZ, 'yyyy-MM-dd HH:mm') : String(r[h.date] || ''),
        statusBSS: clean_(r[h.statusbss]) || 'Pending',
        priorities: clean_(r[h.priorities]) || 'Priority 2',
        serialNumber: cabinet,
        stationName: station,
        stationCode: clean_(r[h.stationcode]) || cabinet,
        faultedAlarm: clean_(r[h.faultedalarm]) || 'Station Blocked',
        pic: clean_(r[h.pic]) || 'PT MITRA JAYA PERSADA',
        sla: r[h.sla] instanceof Date ? r[h.sla].toISOString() : String(r[h.sla] || ''),
        category: clean_(r[h.category]) || 'Connectivity Issue',
        district: clean_(r[h.districk]) || '',
        province: clean_(r[h.provinsi]) || '',
        siteKey: `BSS|${cabinet}`,
        hasActiveTask: activeTTs.has(ttId)
      };
    });
}

/**
 * 09 WORKFLOW TASKS: Daftar Task Workflow Lapangan
 */
function myTaskList() {
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.TASKS);
  if (!sh || sh.getLastRow() < 2) return [];

  const v = sh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);

  return v.slice(1)
    .filter(r => clean_(r[h.taskid]))
    .map(r => ({
      taskId: clean_(r[h.taskid]),
      taskType: (clean_(r[h.tasktype]) || 'TT') as 'TT' | 'PM',
      ttId: clean_(r[h.ttid]),
      siteKey: clean_(r[h.sitekey]),
      cabinetSN: clean_(r[h.cabinetsn]),
      stationCode: clean_(r[h.stationcode]),
      siteName: clean_(r[h.sitename]),
      mitra: clean_(r[h.mitra]),
      technicianEmail: clean_(r[h.technicianemail]),
      technicianName: clean_(r[h.technicianname]),
      status: clean_(r[h.status]) || 'ASSIGNED_TO_MITRA',
      assignedBy: clean_(r[h.assignedby]),
      assignedAt: r[h.assignedat] instanceof Date ? r[h.assignedat].toISOString() : clean_(r[h.assignedat]),
      checkInAt: r[h.checkinat] instanceof Date ? r[h.checkinat].toISOString() : clean_(r[h.checkinat]),
      checkInLocation: clean_(r[h.checkinlocation]),
      checkInEvidenceUrl: clean_(r[h.checkinevidenceurl]),
      checkOutAt: r[h.checkoutat] instanceof Date ? r[h.checkoutat].toISOString() : clean_(r[h.checkoutat]),
      checkOutLocation: clean_(r[h.checkoutlocation]),
      checkOutEvidenceUrl: clean_(r[h.checkoutevidenceurl]),
      issueDetail: clean_(r[h.issuedetail]),
      rca1: clean_(r[h.rca1]),
      rca2: clean_(r[h.rca2]),
      correctiveAction: clean_(r[h.correctiveaction]),
      reportSummary: clean_(r[h.reportsummary]),
      reviewStatus: clean_(r[h.reviewstatus]) || 'NOT_SUBMITTED',
      lastUpdated: r[h.lastupdated] instanceof Date ? r[h.lastupdated].toISOString() : clean_(r[h.lastupdated])
    }));
}

/**
 * 05 MITRA PERFORMANCE: Kinerja Mitra
 */
function getMitraPerformance_() {
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.PERF);
  if (!sh || sh.getLastRow() < 2) {
    return [
      { mitra: 'PT MITRA JAYA PERSADA', totalSites: 18, activeTT: 3, resolvedMonth: 42, slaMetPercent: 94.5, pmScore: 92.0, overallScore: 93.2, grade: 'A' },
      { mitra: 'CV SINAR ELEKTRIK TEKNIK', totalSites: 12, activeTT: 1, resolvedMonth: 28, slaMetPercent: 96.0, pmScore: 90.5, overallScore: 93.8, grade: 'A' }
    ];
  }

  const v = sh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);

  return v.slice(1).map(r => ({
    mitra: clean_(r[h.mitra]) || 'Mitra',
    totalSites: parseInt(r[h.totalsite]) || 10,
    activeTT: parseInt(r[h.customertt]) || 0,
    resolvedMonth: parseInt(r[h.solved]) || 0,
    slaMetPercent: parseFloat(r[h.slametaverage]) || 95.0,
    pmScore: parseFloat(r[h.pmachievement]) || 90.0,
    overallScore: parseFloat(r[h.performancescore]) || 92.5,
    grade: 'A'
  }));
}

/**
 * PM CANDIDATES
 */
function getPMCandidates() {
  const sites = getSitesList_();
  return sites.map(s => ({
    siteKey: s.siteKey,
    siteName: s.locationName,
    cabinet: s.cabinetSN,
    station: s.stationCode,
    mitra: s.teamLead,
    operational: s.operational,
    isActivePM: false
  }));
}

/**
 * MUTATIONS: PENUGASAN, REVIEW, CHECKLIST
 */
function coordinatorAssignTT(p) {
  if (!p || !p.ttId || !p.mitra) throw new Error('TT ID dan Mitra wajib diisi.');
  const ss = getSS_();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const taskId = 'CLX-TT-' + Utilities.formatDate(new Date(), OMS.TZ, 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900);
  const now = new Date();

  taskSh.appendRow([
    taskId, 'TT', p.ttId, p.siteKey || '', p.cabinetSN || '', p.stationCode || '', p.siteName || 'BSS Site',
    p.mitra, '', '', 'COORDINATOR_ASSIGNMENT', '', '', 'ASSIGNED_TO_MITRA',
    'admin@clx.co.id', now, '', '', '', '', '', '', '', '', '', '', '', '', '', 'NOT_SUBMITTED', '', '', '', '', now, ''
  ]);

  return { ok: true, taskId };
}

function coordinatorBulkAssignTT(p) {
  if (!p || !Array.isArray(p.items)) throw new Error('Items array required');
  p.items.forEach(it => coordinatorAssignTT(it));
  return { ok: true, count: p.items.length };
}

function mitraAssignTaskToTech(p) {
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.TASKS);
  const v = sh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h.taskid]) === p.taskId);
  if (rowIdx < 0) throw new Error('Task tidak ditemukan: ' + p.taskId);

  sh.getRange(rowIdx + 1, h.technicianemail + 1).setValue(p.technicianEmail);
  sh.getRange(rowIdx + 1, h.technicianname + 1).setValue(p.technicianEmail.split('@')[0]);
  sh.getRange(rowIdx + 1, h.status + 1).setValue('ASSIGNED_TO_TECHNICIAN');
  sh.getRange(rowIdx + 1, h.lastupdated + 1).setValue(new Date());

  return { ok: true };
}

function mitraRegisterTech(p) {
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.USERS);
  sh.appendRow([p.email.toLowerCase().trim(), p.name.trim(), 'Technician', p.mitra || 'PT MITRA JAYA PERSADA', 'ACTIVE', new Date(), 'admin@clx.co.id']);
  return { ok: true };
}

function technicianUpdateStatus(p) {
  const ss = getSS_();
  const sh = ss.getSheetByName(OMS.S.TASKS);
  const v = sh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h.taskid]) === p.taskId);
  if (rowIdx < 0) throw new Error('Task tidak ditemukan.');

  const now = new Date();
  if (p.action === 'ACCEPT') {
    sh.getRange(rowIdx + 1, h.status + 1).setValue('ACCEPTED');
    sh.getRange(rowIdx + 1, h.acceptedat + 1).setValue(now);
  } else if (p.action === 'CHECK_IN') {
    sh.getRange(rowIdx + 1, h.status + 1).setValue('IN_PROGRESS');
    sh.getRange(rowIdx + 1, h.checkinat + 1).setValue(now);
    sh.getRange(rowIdx + 1, h.checkinlocation + 1).setValue(p.location || '');
    sh.getRange(rowIdx + 1, h.checkinevidenceurl + 1).setValue(p.evidenceUrl || '');
  } else if (p.action === 'CHECK_OUT') {
    sh.getRange(rowIdx + 1, h.status + 1).setValue('READY_TO_SUBMIT');
    sh.getRange(rowIdx + 1, h.checkoutat + 1).setValue(now);
    sh.getRange(rowIdx + 1, h.checkoutlocation + 1).setValue(p.location || '');
    sh.getRange(rowIdx + 1, h.checkoutevidenceurl + 1).setValue(p.evidenceUrl || '');
  } else if (p.action === 'SUBMIT') {
    sh.getRange(rowIdx + 1, h.status + 1).setValue('COMPLETED_WAITING_REVIEW');
    sh.getRange(rowIdx + 1, h.reviewstatus + 1).setValue('WAITING_REVIEW');
    sh.getRange(rowIdx + 1, h.submittedat + 1).setValue(now);
    if (p.issueDetail) sh.getRange(rowIdx + 1, h.issuedetail + 1).setValue(p.issueDetail);
    if (p.rca1) sh.getRange(rowIdx + 1, h.rca1 + 1).setValue(p.rca1);
    if (p.rca2) sh.getRange(rowIdx + 1, h.rca2 + 1).setValue(p.rca2);
    if (p.correctiveAction) sh.getRange(rowIdx + 1, h.correctiveaction + 1).setValue(p.correctiveAction);
    if (p.reportSummary) sh.getRange(rowIdx + 1, h.reportsummary + 1).setValue(p.reportSummary);
  }

  sh.getRange(rowIdx + 1, h.lastupdated + 1).setValue(now);
  return { ok: true };
}

function technicianUploadEvidence(p) {
  const ss = getSS_();
  const evSh = ss.getSheetByName(OMS.S.EVIDENCE);
  evSh.appendRow([new Date(), p.taskId, p.type || 'PROGRESS', p.data || '', p.description || '', 'technician@clx.co.id']);
  return { ok: true };
}

function coordinatorReviewTask(p) {
  const ss = getSS_();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const v = taskSh.getDataRange().getValues();
  const h = getFlexibleHeaderMap_(v[0]);
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h.taskid]) === p.taskId);
  if (rowIdx < 0) throw new Error('Task tidak ditemukan: ' + p.taskId);

  const newStatus = p.decision === 'APPROVE' ? 'CLOSED' : 'REWORK';
  const now = new Date();

  taskSh.getRange(rowIdx + 1, h.status + 1).setValue(newStatus);
  taskSh.getRange(rowIdx + 1, h.reviewstatus + 1).setValue(p.decision);
  taskSh.getRange(rowIdx + 1, h.reviewremarks + 1).setValue(p.remarks || '');
  taskSh.getRange(rowIdx + 1, h.lastupdated + 1).setValue(now);

  return { ok: true, status: newStatus };
}

function coordinatorStartPM(p) {
  const ss = getSS_();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const taskId = 'CLX-PM-' + Utilities.formatDate(new Date(), OMS.TZ, 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900);
  const now = new Date();

  taskSh.appendRow([
    taskId, 'PM', '', p.siteKey || '', '', '', p.siteName || 'Preventive Maintenance',
    p.mitra || 'PT MITRA JAYA PERSADA', '', '', 'PM_SCHEDULE',
    '2026-10-15', '2026-11-15', 'ASSIGNED_TO_MITRA', 'coordinator@clx.co.id', now, '', '', '', '', '', '', '', '', '', '', '', '', '', 'NOT_SUBMITTED', '', '', '', '', now, ''
  ]);

  return { ok: true, taskId };
}

function technicianSavePMChecklist(p) {
  const ss = getSS_();
  const pmSh = ss.getSheetByName(OMS.S.PMCHECK);
  if (!p || !p.taskId || !Array.isArray(p.items)) return { ok: false };
  p.items.forEach(it => {
    pmSh.appendRow([p.taskId, it.item, it.category || 'General', it.result || 'OK', it.remarks || '', '']);
  });
  return { ok: true, count: p.items.length };
}

/**
 * Dynamic Header Mapper yang sangat fleksibel
 * Mampu mencocokkan nama header walaupun ada variasi penulisan atau spasi
 */
function getFlexibleHeaderMap_(headerRow) {
  const map = {};
  if (!Array.isArray(headerRow)) return map;

  headerRow.forEach((col, idx) => {
    const raw = String(col || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!raw) return;

    map[raw] = idx;

    // Alias pencocokan umum
    if (['cabinetsn', 'serialnumber', 'sn', 'cabinet'].includes(raw)) {
      if (map.cabinetsn === undefined) map.cabinetsn = idx;
      if (map.serialnumber === undefined) map.serialnumber = idx;
    }
    if (['stationcode', 'station', 'code', 'idstation'].includes(raw)) {
      if (map.stationcode === undefined) map.stationcode = idx;
    }
    if (['locationname', 'sitename', 'stationname', 'lokasi'].includes(raw)) {
      if (map.locationname === undefined) map.locationname = idx;
      if (map.sitename === undefined) map.sitename = idx;
      if (map.stationname === undefined) map.stationname = idx;
    }
    if (['mitrateam', 'teamlead', 'mitra', 'pic'].includes(raw)) {
      if (map.mitra === undefined) map.mitra = idx;
      if (map.teamlead === undefined) map.teamlead = idx;
      if (map.pic === undefined) map.pic = idx;
    }
    if (['ttid', 'notiket', 'ticketid'].includes(raw)) {
      if (map.ttid === undefined) map.ttid = idx;
    }
    if (['taskid', 'idtask'].includes(raw)) {
      if (map.taskid === undefined) map.taskid = idx;
    }
  });

  return map;
}
function clean_(v) { return v == null ? '' : String(v).trim(); }
