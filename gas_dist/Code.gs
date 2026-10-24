/**
 * CLX BSS OMS V8.0 - WORKFLOW BACKEND (GOOGLE APPS SCRIPT)
 * File: Code.gs
 * Kompatibel penuh dengan skema 16 sheet CLX OMS
 */

const OMS = {
  VERSION: '8.0 WORKFLOW (RBAC PROTECTED)',
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CLX BSS OMS')
    .addItem('Buka Aplikasi OMS', 'openOMS')
    .addItem('Setup / Perbaiki Struktur Sheet', 'setupOMS')
    .addItem('Refresh Laporan', 'refreshReports')
    .addToUi();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CLX MS — BSS OMS V8.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=5.0');
}

function openOMS() {
  const html = HtmlService.createHtmlOutputFromFile('Index')
    .setWidth(1280)
    .setHeight(880);
  SpreadsheetApp.getUi().showModalDialog(html, 'CLX BSS OMS V8.0');
}

function setupOMS() {
  ensure_();
  backfillActiveCMIds_();
  cleanupDailyMonitoring();
  refreshReports();
  return 'CLX BSS OMS V8.0 siap digunakan.';
}

function ensure_() {
  const defs = {
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
    [OMS.S.PMCHECK]: ['Task ID','Checklist Item','Result','Remarks','Evidence URL'],
    [OMS.S.AUDIT]: ['Timestamp','Actor Email','Role','Action','Entity Type','Entity ID','Details'],
    [OMS.S.PMSITE]: ['Site Key','Cabinet S/N','Site Name','Mitra/Team','Cycle Start','Cycle End','PM Status','Task ID','PM Report URL','Last Updated'],
    [OMS.S.FCM]: ['Email','Name','Role','Mitra/Team','FCM Token','Updated At','Platform']
  };

  const ss = SpreadsheetApp.getActive();
  Object.keys(defs).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, defs[name].length).setFontWeight('bold').setBackground('#0D213A').setFontColor('#FFFFFF');
    }
  });
}

/**
 * Autentikasi Pengguna & Role Master
 */
function currentUser_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(OMS.S.USERS);
  
  if (!sh || sh.getLastRow() < 2) {
    // Akun default bootstrap jika user master masih kosong
    return { email: email || 'admin@clx.co.id', name: 'Admin CLX', role: 'Admin', mitra: '' };
  }

  const v = sh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));
  const row = v.slice(1).find(r => {
    const active = String(r[h.Active] || '').trim().toUpperCase();
    return String(r[h.Email] || '').trim().toLowerCase() === email && ['TRUE','ACTIVE','YES','1','Y'].includes(active);
  });

  if (!row) {
    // Jika email belum terdaftar di User Master, berikan default role Technician atau lempar error ramah
    return { email, name: email.split('@')[0], role: 'Technician', mitra: '' };
  }

  const rawRole = clean_(row[h.Role]).toUpperCase();
  const roleMap = { 'ADMIN': 'Admin', 'COORDINATOR': 'Coordinator', 'MITRA': 'Mitra', 'TECHNICIAN': 'Technician' };
  const role = roleMap[rawRole] || 'Technician';
  return { email, name: clean_(row[h.Name]) || email, role, mitra: clean_(row[h['Mitra/Team']]) };
}

function getMyContext() {
  const u = currentUser_();
  return { email: u.email, name: u.name, role: u.role, mitra: u.mitra, version: OMS.VERSION };
}

function requireRole_(allowedRoles) {
  const u = currentUser_();
  if (!allowedRoles.includes(u.role)) {
    throw new Error('Akses ditolak: Fitur ini hanya dapat diakses oleh peran ' + allowedRoles.join(' atau ') + '. Akun Anda adalah: ' + u.role);
  }
  return u;
}

/**
 * UPLOAD CUSTOMER FILE (KHUSUS KOORDINATOR & ADMIN)
 */
function uploadCustomerFile(p) {
  requireRole_(['Coordinator', 'Admin']);
  if (!p || !p.name || !p.data) throw new Error('File upload tidak valid.');
  const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mimeType || MimeType.MICROSOFT_EXCEL, p.name);
  const id = Drive.Files.create({ name: '[CLX BSS TEMP] ' + Date.now(), mimeType: MimeType.GOOGLE_SHEETS }, blob, { fields: 'id' }).id;
  const src = SpreadsheetApp.openById(id);
  const site = src.getSheets().find(s => /^sitelist/i.test(s.getName()));
  const withBat = src.getSheetByName('With Battery Unavalaible');
  const withoutBat = src.getSheetByName('Without Battery Unavalaible');
  if (!site || !withBat || !withoutBat) throw new Error('File customer wajib berisi SiteList dan dua sheet Unavailable.');

  const batch = 'BSS-' + Utilities.formatDate(new Date(), OMS.TZ, 'yyyyMMddHHmmss');
  PropertiesService.getUserProperties().setProperty('BSS6_' + batch, JSON.stringify({ id, name: p.name, date: new Date().toISOString() }));
  return { batch, name: p.name, rows: site.getLastRow() - 1 };
}

/**
 * BULK WHATSAPP GENERATOR (KHUSUS KOORDINATOR & ADMIN)
 */
function generateBulkWhatsApp(mitra) {
  requireRole_(['Coordinator', 'Admin']);
  const rows = getMitraWork(mitra);
  if (!rows || !rows.length) {
    return { ok: false, message: 'Tidak ada Trouble Ticket outstanding aktif untuk ' + mitra };
  }

  const lines = [
    '*CLX MS — BSS TROUBLE TICKET DISPATCH*',
    '',
    `*MITRA / TEAM : ${String(mitra).toUpperCase()}*`,
    `*TOTAL SITE / TT VALID : ${rows.length}*`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    ''
  ];

  rows.forEach((r, i) => {
    lines.push(
      `*TT. ID* = ${r.ttId}`,
      `*Site Name* = ${r.site || '-'}`,
      `*Cabinet S/N* = ${r.cabinet || '-'}`,
      `*Station Code* = ${r.station || '-'}`,
      `*Issue* = ${r.issue || '-'}`,
      `*Status* = ${r.status || 'Pending'}`,
      `*Priority Level* = ${r.priority || 'Priority 2'}`,
      '',
      'Mohon update: *ACCEPT / REJECT*'
    );
    if (i < rows.length - 1) lines.push('', '────────────────────────', '');
  });

  return { ok: true, total: rows.length, message: lines.join('\n') };
}

/**
 * TASK LIST SESUAI ROLE AKTIF
 */
function myTaskList() {
  const u = currentUser_();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(OMS.S.TASKS);
  if (!sh || sh.getLastRow() < 2) return [];

  const v = sh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));

  return v.slice(1)
    .filter(r => {
      const id = clean_(r[h['Task ID']]);
      if (!id) return false;
      if (u.role === 'Coordinator' || u.role === 'Admin') return true;
      if (u.role === 'Mitra') return clean_(r[h['Mitra/Team']]).toUpperCase() === clean_(u.mitra).toUpperCase();
      return clean_(r[h['Technician Email']]).toLowerCase() === u.email.toLowerCase();
    })
    .map(r => {
      const o = {};
      Object.keys(h).forEach(k => {
        const val = r[h[k]];
        o[k] = val instanceof Date ? Utilities.formatDate(val, OMS.TZ, 'yyyy-MM-dd HH:mm:ss') : val;
      });
      return o;
    });
}

/**
 * KOORDINATOR: TT QUEUE & ASSIGNMENT
 */
function coordinatorTTQueue() {
  requireRole_(['Coordinator', 'Admin']);
  const ss = SpreadsheetApp.getActive();
  const cmSh = ss.getSheetByName(OMS.S.CM);
  if (!cmSh || cmSh.getLastRow() < 2) return [];

  const v = cmSh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));

  // Ambil task aktif agar TT yang sudah di-assign tidak muncul ganda
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const activeTTs = new Set();
  if (taskSh && taskSh.getLastRow() > 1) {
    const tv = taskSh.getDataRange().getValues();
    const th = map_(tv[0].map(clean_));
    tv.slice(1).forEach(r => {
      const status = clean_(r[th.Status]);
      if (!['CLOSED', 'CANCELLED'].includes(status)) {
        activeTTs.add(clean_(r[th['TT ID']]));
      }
    });
  }

  return v.slice(1)
    .filter(r => {
      const ttId = clean_(r[h['TT ID']]);
      const status = clean_(r[h['Status BSS']]);
      return ttId && status !== 'Closed' && !activeTTs.has(ttId);
    })
    .map(r => ({
      ttId: clean_(r[h['TT ID']]),
      site: clean_(r[h['Station Name']]),
      cabinet: clean_(r[h['Serial Number']]),
      issue: clean_(r[h['Faulted Alarm']]),
      priority: clean_(r[h.Priorities]) || 'Priority 2',
      mitra: clean_(r[h['Mitra/Team']]) || clean_(r[h.PIC]) || 'PT MITRA JAYA PERSADA',
      date: r[h.Date] instanceof Date ? Utilities.formatDate(r[h.Date], OMS.TZ, 'yyyy-MM-dd HH:mm') : String(r[h.Date] || '')
    }));
}

function getMitraOptions() {
  const ss = SpreadsheetApp.getActive();
  const userSh = ss.getSheetByName(OMS.S.USERS);
  const mitras = new Set();
  if (userSh && userSh.getLastRow() > 1) {
    const v = userSh.getDataRange().getValues();
    const h = map_(v[0].map(clean_));
    v.slice(1).forEach(r => {
      const m = clean_(r[h['Mitra/Team']]);
      if (m) mitras.add(m);
    });
  }
  if (!mitras.size) {
    mitras.add('PT MITRA JAYA PERSADA');
    mitras.add('PT KREASI FIELD SERVICE');
    mitras.add('PT ENERGI NUSANTARA TEKNIK');
  }
  return Array.from(mitras);
}

function coordinatorAssignTT(p) {
  const u = requireRole_(['Coordinator', 'Admin']);
  if (!p || !p.ttId || !p.mitra) throw new Error('TT ID dan Mitra penugasan wajib diisi.');

  const ss = SpreadsheetApp.getActive();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const taskId = 'CLX-TT-' + Utilities.formatDate(new Date(), OMS.TZ, 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900);
  const now = new Date();

  // Cari detail site dari CM
  const cmSh = ss.getSheetByName(OMS.S.CM);
  let siteName = 'Site BSS', cabinet = 'CAB-001', station = 'STN-001';
  if (cmSh && cmSh.getLastRow() > 1) {
    const v = cmSh.getDataRange().getValues();
    const h = map_(v[0].map(clean_));
    const r = v.slice(1).find(row => clean_(row[h['TT ID']]) === p.ttId);
    if (r) {
      siteName = clean_(r[h['Station Name']]) || siteName;
      cabinet = clean_(r[h['Serial Number']]) || cabinet;
    }
  }

  taskSh.appendRow([
    taskId, 'TT', p.ttId, cabinet + '|' + station + '|' + siteName, cabinet, station, siteName,
    p.mitra, '', '', 'COORDINATOR_ASSIGNMENT', '', '', 'ASSIGNED_TO_MITRA',
    u.email, now, '', '', '', '', '', '', '', '', '', '', '', '', '', 'NOT_SUBMITTED', '', '', '', '', now, ''
  ]);

  ss.getSheetByName(OMS.S.ACTIVITY).appendRow([now, taskId, u.email, u.role, 'ASSIGN_TT', 'CREATED', 'ASSIGNED_TO_MITRA', 'Mitra=' + p.mitra]);
  ss.getSheetByName(OMS.S.AUDIT).appendRow([now, u.email, u.role, 'ASSIGN_TT', 'TASK', taskId, 'Ditugaskan ke ' + p.mitra]);

  return { ok: true, taskId };
}

function coordinatorBulkAssignTT(p) {
  requireRole_(['Coordinator', 'Admin']);
  if (!p || !Array.isArray(p.items)) throw new Error('Item bulk assign tidak valid.');
  const results = p.items.map(item => coordinatorAssignTT(item));
  return { ok: true, count: results.length };
}

function coordinatorReviewTask(p) {
  const u = requireRole_(['Coordinator', 'Admin']);
  if (!p || !p.taskId || !p.decision) throw new Error('Task ID dan keputusan review wajib diisi.');

  const ss = SpreadsheetApp.getActive();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const v = taskSh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h['Task ID']]) === p.taskId);
  if (rowIdx < 0) throw new Error('Task tidak ditemukan: ' + p.taskId);

  const newStatus = p.decision === 'APPROVE' ? 'CLOSED' : 'REWORK';
  const now = new Date();

  taskSh.getRange(rowIdx + 1, h.Status + 1).setValue(newStatus);
  taskSh.getRange(rowIdx + 1, h['Review Status'] + 1).setValue(p.decision);
  taskSh.getRange(rowIdx + 1, h['Reviewed By'] + 1).setValue(u.email);
  taskSh.getRange(rowIdx + 1, h['Reviewed At'] + 1).setValue(now);
  taskSh.getRange(rowIdx + 1, h['Review Remarks'] + 1).setValue(p.remarks || '');
  taskSh.getRange(rowIdx + 1, h['Last Updated'] + 1).setValue(now);

  ss.getSheetByName(OMS.S.REVIEW).appendRow([now, p.taskId, p.decision, u.email, p.remarks || '']);
  ss.getSheetByName(OMS.S.ACTIVITY).appendRow([now, p.taskId, u.email, u.role, 'REVIEW_' + p.decision, 'WAITING_REVIEW', newStatus, p.remarks || '']);

  return { ok: true, status: newStatus };
}

/**
 * MITRA: ALOKASI TEKNISI & REGISTER
 */
function mitraAssignTaskToTech(p) {
  const u = requireRole_(['Mitra', 'Coordinator', 'Admin']);
  const techEmail = p.techEmail || p.technicianEmail;
  if (!p || !p.taskId || !techEmail) throw new Error('Task ID dan email teknisi wajib dipilih.');

  const ss = SpreadsheetApp.getActive();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const v = taskSh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h['Task ID']]) === p.taskId);
  if (rowIdx < 0) throw new Error('Task tidak ditemukan.');

  const now = new Date();
  taskSh.getRange(rowIdx + 1, h['Technician Email'] + 1).setValue(techEmail);
  taskSh.getRange(rowIdx + 1, h['Technician Name'] + 1).setValue(techEmail.split('@')[0]);
  taskSh.getRange(rowIdx + 1, h.Status + 1).setValue('ASSIGNED_TO_TECHNICIAN');
  taskSh.getRange(rowIdx + 1, h['Last Updated'] + 1).setValue(now);

  ss.getSheetByName(OMS.S.ACTIVITY).appendRow([now, p.taskId, u.email, u.role, 'ASSIGN_TECHNICIAN', 'ASSIGNED_TO_MITRA', 'ASSIGNED_TO_TECHNICIAN', 'Teknisi=' + techEmail]);
  return { ok: true };
}

function assignTaskTechnician(p) { return mitraAssignTaskToTech(p); }

function mitraRegisterTech(p) {
  const u = requireRole_(['Mitra', 'Admin']);
  if (!p || !p.email || !p.name) throw new Error('Nama dan email teknisi wajib diisi.');

  const ss = SpreadsheetApp.getActive();
  const userSh = ss.getSheetByName(OMS.S.USERS);
  const mitra = u.role === 'Mitra' ? u.mitra : (p.mitra || 'PT MITRA JAYA PERSADA');
  userSh.appendRow([p.email.toLowerCase().trim(), p.name.trim(), 'Technician', mitra, 'ACTIVE', new Date(), u.email]);
  return { ok: true };
}

function registerTechnician(p) { return mitraRegisterTech(p); }

/**
 * TEKNISI: STATUS UPDATE, EVIDENCE & SUBMIT
 */
function technicianUpdateStatus(p) {
  const u = requireRole_(['Technician', 'Coordinator', 'Admin']);
  const ss = SpreadsheetApp.getActive();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const v = taskSh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h['Task ID']]) === p.taskId);
  if (rowIdx < 0) throw new Error('Task tidak ditemukan.');

  const toStatus = p.action === 'ACCEPT' ? 'ACCEPTED' : p.action === 'ON_THE_WAY' ? 'ON_THE_WAY' : p.action;
  const now = new Date();
  taskSh.getRange(rowIdx + 1, h.Status + 1).setValue(toStatus);
  taskSh.getRange(rowIdx + 1, h['Last Updated'] + 1).setValue(now);
  if (p.action === 'ACCEPT') {
    taskSh.getRange(rowIdx + 1, h['Accepted At'] + 1).setValue(now);
  }

  ss.getSheetByName(OMS.S.ACTIVITY).appendRow([now, p.taskId, u.email, u.role, p.action, '', toStatus, '']);
  return { ok: true, status: toStatus };
}

function technicianUploadEvidence(p) {
  const u = currentUser_();
  const ss = SpreadsheetApp.getActive();
  const evSh = ss.getSheetByName(OMS.S.EVIDENCE);
  const now = new Date();

  // Simpan foto base64 ke Google Drive folder jika tersedia, atau catat URL
  let fileUrl = 'https://drive.google.com/thumbnail?id=demo&lat=' + (p.lat || '') + '&lon=' + (p.lon || '');
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(p.data), 'image/jpeg', p.taskId + '_' + p.type + '_' + Date.now() + '.jpg');
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    fileUrl = file.getUrl();
  } catch (err) {
    console.warn('Simpan file Drive fallback: ' + err);
  }

  evSh.appendRow([now, p.taskId, p.type, fileUrl, 'GPS: ' + p.lat + ',' + p.lon, u.email]);

  // Update check in/out URL di tasks
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const v = taskSh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h['Task ID']]) === p.taskId);
  if (rowIdx > 0) {
    if (p.type === 'CLOCK_IN') {
      taskSh.getRange(rowIdx + 1, h['Check In At'] + 1).setValue(now);
      taskSh.getRange(rowIdx + 1, h['Check In Location'] + 1).setValue(p.lat + ', ' + p.lon);
      taskSh.getRange(rowIdx + 1, h['Check In Evidence URL'] + 1).setValue(fileUrl);
      taskSh.getRange(rowIdx + 1, h.Status + 1).setValue('IN_PROGRESS');
    } else if (p.type === 'CLOCK_OUT') {
      taskSh.getRange(rowIdx + 1, h['Check Out At'] + 1).setValue(now);
      taskSh.getRange(rowIdx + 1, h['Check Out Location'] + 1).setValue(p.lat + ', ' + p.lon);
      taskSh.getRange(rowIdx + 1, h['Check Out Evidence URL'] + 1).setValue(fileUrl);
      taskSh.getRange(rowIdx + 1, h.Status + 1).setValue('READY_TO_SUBMIT');
    }
  }

  return { ok: true, url: fileUrl };
}

function technicianSubmitTask(p) {
  const u = requireRole_(['Technician', 'Coordinator', 'Admin']);
  const ss = SpreadsheetApp.getActive();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const v = taskSh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));
  const rowIdx = v.findIndex((r, i) => i > 0 && clean_(r[h['Task ID']]) === p.taskId);
  if (rowIdx < 0) throw new Error('Task tidak ditemukan.');

  const now = new Date();
  taskSh.getRange(rowIdx + 1, h['Issue Detail'] + 1).setValue(p.issue || '');
  taskSh.getRange(rowIdx + 1, h['RCA 1'] + 1).setValue(p.rca1 || '');
  taskSh.getRange(rowIdx + 1, h['RCA 2'] + 1).setValue(p.rca2 || '');
  taskSh.getRange(rowIdx + 1, h['Corrective Action'] + 1).setValue(p.corrective || '');
  taskSh.getRange(rowIdx + 1, h['Report Summary'] + 1).setValue(p.report || '');
  taskSh.getRange(rowIdx + 1, h['Submitted At'] + 1).setValue(now);
  taskSh.getRange(rowIdx + 1, h['Review Status'] + 1).setValue('WAITING_REVIEW');
  taskSh.getRange(rowIdx + 1, h.Status + 1).setValue('COMPLETED_WAITING_REVIEW');
  taskSh.getRange(rowIdx + 1, h['Last Updated'] + 1).setValue(now);

  ss.getSheetByName(OMS.S.ACTIVITY).appendRow([now, p.taskId, u.email, u.role, 'SUBMIT', 'READY_TO_SUBMIT', 'COMPLETED_WAITING_REVIEW', p.report || '']);
  return { ok: true, status: 'COMPLETED_WAITING_REVIEW' };
}

/**
 * PREVENTIVE MAINTENANCE (PM)
 */
function getPMCandidates() {
  const ss = SpreadsheetApp.getActive();
  const siteSh = ss.getSheetByName(OMS.S.SITE);
  if (!siteSh || siteSh.getLastRow() < 2) return [];

  const v = siteSh.getDataRange().getValues();
  const h = map_(v[0].map(clean_));

  return v.slice(1, 20).map(r => ({
    siteKey: clean_(r[h['Cabinet S/N']]) + '|' + clean_(r[h['Station Code']]),
    siteName: clean_(r[h['Location Name']]) || 'BSS Site',
    cabinet: clean_(r[h['Cabinet S/N']]) || 'CAB-001',
    stationCode: clean_(r[h['Station Code']]) || 'STN-001',
    mitra: clean_(r[h['Team Lead']]) || 'PT MITRA JAYA PERSADA',
    hasActivePM: false
  }));
}

function coordinatorStartPM(p) {
  const u = requireRole_(['Coordinator', 'Mitra', 'Admin']);
  const ss = SpreadsheetApp.getActive();
  const taskSh = ss.getSheetByName(OMS.S.TASKS);
  const taskId = 'CLX-PM-' + Utilities.formatDate(new Date(), OMS.TZ, 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900);
  const now = new Date();

  taskSh.appendRow([
    taskId, 'PM', '', p.siteKey, 'CAB-PM', 'STN-PM', 'Site Preventive Maintenance',
    u.role === 'Mitra' ? u.mitra : 'PT MITRA JAYA PERSADA', '', '', 'PM_SCHEDULE_CYCLE',
    '2026-10-15', '2026-11-15', 'ASSIGNED_TO_MITRA', u.email, now, '', '', '', '', '', '', '', '', '', '', '', '', '', 'NOT_SUBMITTED', '', '', '', '', now, ''
  ]);

  return { ok: true, taskId };
}

function technicianSavePMChecklist(p) {
  const u = currentUser_();
  const ss = SpreadsheetApp.getActive();
  const pmSh = ss.getSheetByName(OMS.S.PMCHECK);
  if (!p || !p.taskId || !Array.isArray(p.items)) throw new Error('Data checklist PM tidak valid.');

  p.items.forEach(item => {
    pmSh.appendRow([p.taskId, item.item, item.result, item.remarks || '', '']);
  });

  return { ok: true, count: p.items.length };
}

/**
 * HELPER UTILITIES
 */
function clean_(v) { return v == null ? '' : String(v).trim(); }
function map_(arr) { const o = {}; arr.forEach((x, i) => o[x] = i); return o; }

