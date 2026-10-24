const OMS={VERSION:'8.0 WORKFLOW' ,TZ:Session.getScriptTimeZone()||'Asia/Jakarta',SLA:12,
S:{DASH:'01 DASHBOARD',DAILY:'02 DAILY MONITORING',CM:'03 CM MONITORING',PM:'04 PM MONITORING',PERF:'05 MITRA PERFORMANCE',PMCM:'06 PM VS CM',SITE:'07 SITE MASTER',USERS:'08 USER MASTER',TASKS:'09 WORKFLOW TASKS',ACTIVITY:'10 WORK ACTIVITY',EVIDENCE:'11 WORK EVIDENCE',REVIEW:'12 WORK REVIEW',PMCHECK:'13 PM CHECKLIST',AUDIT:'14 AUDIT LOG'}};

function onOpen(){SpreadsheetApp.getUi().createMenu('CLX BSS OMS').addItem('Open OMS','openOMS').addItem('Setup / Repair','setupOMS').addItem('Refresh Reports','refreshReports').addToUi();}
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('CLX MS — BSS OMS V8.0').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
function openOMS(){
  const html = HtmlService
    .createHtmlOutputFromFile('Index')
    .setWidth(1200)
    .setHeight(850);
  SpreadsheetApp.getUi().showModalDialog(html, 'CLX BSS OMS V8.0');
}
function setupOMS(){ensure_();backfillActiveCMIds_();cleanupDailyMonitoring();refreshReports();return 'CLX BSS OMS V8.0 ready. Workbook-compatible: Team Lead=AJ; CM uses Status BSS/Serial Number/Station Name; TT only from customer Unavailable sheets; blank formatted rows ignored.';}
function ensure_(){
  const defs={
    [OMS.S.DAILY]:['Date','Site Key','Cabinet S/N','Station Code','Site Name','Mitra/Team','Connectivity','Customer TT','Operational','Faulted Reason','Station Block Status','Battery Count','Battery Type','Previous Day Status','Daily Transition','Auto Resolution','Source File','Import Batch','Remarks'],
    [OMS.S.CM]:['Date','Status BSS','Last Visit','Priorities','Serial Number','Station Name','Faulted Alarm','Status Charger','Status Battery','PIC','Assign Date','Scheduled/Wairing Part','Closed/Completed At','SLA','Category','RCA 1','RCA 2','PIC on Site','Remarks','Corrective Action / Progress','Problem Category','Note','Districk','Provinsi'],
    [OMS.S.PM]:['Date','Period Start','Period End','Mitra/Team','Total Site','Daily Target','Actual PM','Achievement %','Remarks'],
    [OMS.S.PERF]:['Period Start','Period End','Mitra/Team','Total Site','Customer TT','Visit','Solved','Auto Closed','Pending','Waiting Sparepart','Outstanding','SLA Met %','PM Achievement %','Performance Score'],
    [OMS.S.PMCM]:['Period Start','Period End','Mitra/Team','Total Site','PM Target','PM Actual','PM Achievement %','Customer TT','CM Visit','CM Rate %'],
    [OMS.S.SITE]:['Cabinet S/N','Cabinet type','Battery Count','Station Code','Location Name','Address','District','Province','MS','Lat Long','Firmware Version','Connectivity','Operational','Faulted Reason','Error Code','Slot Faulted Status','Fault Validation','BSS Type Validation','Station Block Status','Station Block Reason','Station Block Open Timestamp','Cabinet Block Status','Cabinet Block Reason','Cabinet Block Open Timestamp','Slot Blocked Status','Activation Date','Note','KPI','KPI wo Batt','Exclude','Degradated Active','Empty Available Slot Count','Slot Not Charging','Battery SOH 70%-80% Warning','Battery SOH<70% Breach','Team Lead','ID Pelanggan'],
    [OMS.S.USERS]:['Email','Name','Role','Mitra/Team','Active','Created At','Created By'],
    [OMS.S.TASKS]:['Task ID','Task Type','TT ID','Site Key','Cabinet S/N','Station Code','Site Name','Mitra/Team','Technician Email','Technician Name','Source','Cycle Start','Cycle End','Status','Assigned By','Assigned At','Accepted At','Check In At','Check In Location','Check In Evidence URL','Issue Detail','RCA 1','RCA 2','Corrective Action','Check Out At','Check Out Location','Check Out Evidence URL','Report Summary','Submitted At','Review Status','Reviewed By','Reviewed At','Review Remarks','Pending Reason','Last Updated','PM Report URL'],
    [OMS.S.ACTIVITY]:['Timestamp','Task ID','Actor Email','Actor Role','Action','From Status','To Status','Remarks'],
    [OMS.S.EVIDENCE]:['Timestamp','Task ID','Evidence Type','Evidence URL','Description','Uploaded By'],
    [OMS.S.REVIEW]:['Timestamp','Task ID','Decision','Reviewer Email','Remarks'],
    [OMS.S.PMCHECK]:['Task ID','Checklist Item','Result','Remarks','Evidence URL'],
    [OMS.S.AUDIT]:['Timestamp','Actor Email','Role','Action','Entity Type','Entity ID','Details'],
    ['15 PM SITE STATUS']:['Site Key','Cabinet S/N','Site Name','Mitra/Team','Cycle Start','Cycle End','PM Status','Task ID','PM Report URL','Last Updated'],
    ['16 FCM TOKENS']:['Email','Name','Role','Mitra/Team','FCM Token','Updated At','Platform']
  };
  const ss=SpreadsheetApp.getActive();
  Object.keys(defs).forEach(name=>{
    let sh=ss.getSheetByName(name);
    if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,defs[name].length).setValues([defs[name]]);sh.setFrozenRows(1);sh.getRange(1,1,1,defs[name].length).setFontWeight('bold').setBackground('#17365D').setFontColor('#FFFFFF');}
  });
  ensureCMInternalHeaders_();
  ensureSiteTrackingHeaders_();
  ensureWorkflowHeaders_();
}
function ensureCMInternalHeaders_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.CM),last=Math.max(sh.getLastColumn(),24),headers=sh.getRange(1,1,1,last).getValues()[0].map(clean);
  const needed=['TT ID','Site Key','Source','Import Batch','Last Update','Internal Remarks'];
  let next=headers.length;
  needed.forEach(name=>{
    if(headers.indexOf(name)>=0)return;
    let idx=headers.findIndex((v,i)=>i>=24&&!v);
    if(idx<0)idx=next++;
    sh.getRange(1,idx+1).setValue(name);headers[idx]=name;
  });
}
function ensureSiteTrackingHeaders_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.SITE),last=sh.getLastColumn(),headers=sh.getRange(1,1,1,last).getValues()[0].map(clean);
  ['OMS Mapping Status','OMS First Detected'].forEach(name=>{
    if(headers.indexOf(name)>=0)return;
    const idx=headers.findIndex((v,i)=>i>=37&&!v);
    const col=idx>=0?idx+1:sh.getLastColumn()+1;
    sh.getRange(1,col).setValue(name).setFontWeight('bold').setBackground('#17365D').setFontColor('#FFFFFF');
    while(headers.length<col)headers.push('');headers[col-1]=name;
  });
}
function uploadCustomerFile(p){
  requireRole_(['Coordinator','Admin']);
  if(!p||!p.name||!p.data)throw Error('File upload tidak valid.');
  if(!/\.(xlsx|xls)$/i.test(p.name))throw Error('Gunakan file XLSX/XLS.');
  const b=Utilities.newBlob(Utilities.base64Decode(p.data),p.mimeType||MimeType.MICROSOFT_EXCEL,p.name);
  const id=Drive.Files.create({name:'[CLX BSS TEMP] '+Date.now(),mimeType:MimeType.GOOGLE_SHEETS},b,{fields:'id'}).id;
  const src=SpreadsheetApp.openById(id);
  const site=findSite_(src);
  const withBat=src.getSheetByName('With Battery Unavalaible');
  const withoutBat=src.getSheetByName('Without Battery Unavalaible');
  if(!site)throw Error('Sheet SiteList dd/mm/yyyy tidak ditemukan.');
  if(!withBat||!withoutBat)throw Error('File harus memiliki sheet "With Battery Unavalaible" dan "Without Battery Unavalaible".');
  const vals=site.getDataRange().getValues();
  if(vals.length<2)throw Error('SiteList kosong.');
  GLOBAL_H=map(vals[0].map(clean));
  const batch='BSS-'+Utilities.formatDate(new Date(),OMS.TZ,'yyyyMMddHHmmss');
  const d=inferDate_(p.name)||new Date();
  PropertiesService.getUserProperties().setProperty('BSS6_'+batch,JSON.stringify({id:id,name:p.name,date:d.toISOString()}));
  return {
    batch,name:p.name,rows:vals.length-1,
    siteListSheet:site.getName(),
    withBatteryTT:countTTSourceRows_(withBat),
    withoutBatteryTT:countTTSourceRows_(withoutBat),
    date:Utilities.formatDate(d,OMS.TZ,'dd/MM/yyyy')
  };
}
function countTTSourceRows_(sheet){return countTTRows_(sheet.getDataRange().getValues());}
function countTTRows_(values){
  if(!values||values.length<2)return 0;const h=map(values[0].map(clean));
  const serial=h['Cabinet S/N'],station=h['Station Code'],name=h['Location Name'];let n=0;
  values.slice(1).forEach(r=>{if((serial!==undefined&&clean(r[serial]))||(station!==undefined&&clean(r[station]))||(name!==undefined&&clean(r[name])))n++;});
  return n;
}
function processBSSUpload(batch){
  requireRole_(['Coordinator','Admin']);
  const raw=PropertiesService.getUserProperties().getProperty('BSS6_'+batch);
  if(!raw)throw Error('Batch tidak ditemukan. Upload ulang file customer.');
  const meta=JSON.parse(raw),src=SpreadsheetApp.openById(meta.id);
  const siteSrc=findSite_(src),withSrc=src.getSheetByName('With Battery Unavalaible'),withoutSrc=src.getSheetByName('Without Battery Unavalaible');
  if(!siteSrc||!withSrc||!withoutSrc)throw Error('File harus memiliki SiteList dan dua sheet Unavailable.');
  const siteVals=siteSrc.getDataRange().getValues(),siteH=map(siteVals[0].map(clean));
  const withVals=withSrc.getDataRange().getValues(),withoutVals=withoutSrc.getDataRange().getValues();
  const ss=SpreadsheetApp.getActive(),siteSh=ss.getSheetByName(OMS.S.SITE),dailySh=ss.getSheetByName(OMS.S.DAILY),cmSh=ss.getSheetByName(OMS.S.CM);
  ensure_();
  const masterVals=siteSh.getDataRange().getValues(),mh=map(masterVals[0].map(clean));
  const cmVals=cmSh.getDataRange().getValues(),ch=map(cmVals[0].map(clean));
  const col=(h,names)=>{for(const n of names)if(h[n]!==undefined)return h[n];return undefined;};
  const srcVal=(r,h,names)=>{for(const n of names)if(h[n]!==undefined)return r[h[n]];return '';};
  const mSerial=col(mh,['Cabinet S/N']),mStation=col(mh,['Station Code']),mName=col(mh,['Location Name']),mTeam=col(mh,['Team Lead','Team']);
  const mOperational=col(mh,['Operational']),mMapStatus=col(mh,['OMS Mapping Status']),mFirst=col(mh,['OMS First Detected']);
  if(mSerial===undefined||mStation===undefined||mName===undefined||mTeam===undefined)throw Error('Header 07 SITE MASTER tidak sesuai. Pastikan Cabinet S/N, Station Code, Location Name dan Team Lead (AJ) tersedia.');
  const masterBySerial={},masterByStation={};
  masterVals.slice(1).forEach((r,i)=>{
    const serial=clean(r[mSerial]).toUpperCase(),station=clean(r[mStation]).toUpperCase(),name=clean(r[mName]);
    if(!serial&&!station&&!name)return;
    const obj={row:r,rowNo:i+2};if(serial)masterBySerial[serial]=obj;if(station)masterByStation[station]=obj;
  });
  const updateFields=['Cabinet S/N','Cabinet type','Battery Count','Station Code','Location Name','Address','District','Province','MS','Lat Long','Firmware Version','Connectivity','Operational','Faulted Reason','Error Code','Slot Faulted Status','Fault Validation','BSS Type Validation','Station Block Status','Station Block Reason','Station Block Open Timestamp','Cabinet Block Status','Cabinet Block Reason','Cabinet Block Open Timestamp','Slot Blocked Status','Activation Date','Note','KPI','KPI wo Batt','Exclude','Degradated Active','Empty Available Slot Count','Slot Not Charging','Battery SOH 70%-80% Warning','Battery SOH<70% Breach','ID Pelanggan'];
  const updates=[],adds=[],newSites=[],matchedSerials={};
  siteVals.slice(1).forEach(r=>{
    const serial=clean(srcVal(r,siteH,['Cabinet S/N'])).toUpperCase(),station=clean(srcVal(r,siteH,['Station Code'])).toUpperCase(),name=clean(srcVal(r,siteH,['Location Name']));
    if(!serial&&!station&&!name)return;
    let found=(serial&&masterBySerial[serial])||(station&&masterByStation[station]);
    if(found){
      const row=found.row.slice();
      updateFields.forEach(k=>{if(mh[k]!==undefined&&siteH[k]!==undefined)row[mh[k]]=r[siteH[k]];});
      // Team Lead (AJ) and OMS mapping fields are deliberately preserved.
      updates.push({rowNo:found.rowNo,row});
      const obj={row,rowNo:found.rowNo};if(serial)masterBySerial[serial]=obj;if(station)masterByStation[station]=obj;
      matchedSerials[serial||station]=true;
    }else{
      const row=new Array(masterVals[0].length).fill('');
      updateFields.forEach(k=>{if(mh[k]!==undefined&&siteH[k]!==undefined)row[mh[k]]=r[siteH[k]];});
      if(mTeam!==undefined)row[mTeam]='';
      if(mMapStatus!==undefined)row[mMapStatus]='NEW SITE — CONFIRM & MAP TEAM';
      if(mFirst!==undefined)row[mFirst]=new Date(meta.date);
      const rowNo=siteSh.getLastRow()+adds.length+1,obj={row,rowNo};
      if(serial)masterBySerial[serial]=obj;if(station)masterByStation[station]=obj;
      adds.push(row);newSites.push({siteKey:makeSiteKey_(serial,station,name),siteName:name,cabinet:serial,station:station,province:clean(srcVal(r,siteH,['Province']))});
    }
  });
  updates.forEach(x=>{masterVals[x.rowNo-1]=x.row;});
  if(updates.length&&masterVals.length>1){const width=masterVals[0].length,writeRows=fitRows_(masterVals.slice(1),width);if(writeRows.length)siteSh.getRange(2,1,writeRows.length,width).setValues(writeRows);}
  if(adds.length){const width=masterVals[0].length,writeRows=fitRows_(adds,width);if(writeRows.length)siteSh.getRange(siteSh.getLastRow()+1,1,writeRows.length,width).setValues(writeRows);}

  // Re-read the true workbook schema after site synchronization.
  const freshSite=siteSh.getDataRange().getValues(),fh=map(freshSite[0].map(clean)),bySerial={},byStation={};
  freshSite.slice(1).forEach(r=>{
    const serial=clean(r[fh['Cabinet S/N']]).toUpperCase(),station=clean(r[fh['Station Code']]).toUpperCase(),name=clean(r[fh['Location Name']]);
    if(!serial&&!station&&!name)return;
    const x={serial,station,name,team:clean(r[fh['Team Lead']]),operational:clean(r[fh['Operational']]),row:r};
    if(serial)bySerial[serial]=x;if(station)byStation[station]=x;
  });

  const date=new Date(meta.date),dateKey=day(date),dailyVals=dailySh.getDataRange().getValues(),dh=map(dailyVals[0].map(clean));
  const keepDaily=dailyVals.slice(1).filter(r=>day(r[dh['Date']])!==dateKey);
  if(dailySh.getLastRow()>1)dailySh.getRange(2,1,dailySh.getLastRow()-1,dailySh.getLastColumn()).clearContent();
  if(keepDaily.length){const width=dailyVals[0].length,writeRows=fitRows_(keepDaily,width);if(writeRows.length)dailySh.getRange(2,1,writeRows.length,width).setValues(writeRows);}

  const currentCM=cmSh.getDataRange().getValues(),cH=map(currentCM[0].map(clean));
  const cDate=col(cH,['Date']),cStatus=col(cH,['Status BSS']),cSerial=col(cH,['Serial Number']),cStationName=col(cH,['Station Name']),cIssue=col(cH,['Faulted Alarm']),cTTID=col(cH,['TT ID']),cSource=col(cH,['Source']),cSiteKey=col(cH,['Site Key']),cBatch=col(cH,['Import Batch']);
  const existing={};
  currentCM.slice(1).forEach(r=>{
    const serial=cSerial!==undefined?clean(r[cSerial]).toUpperCase():'';
    const stationName=cStationName!==undefined?clean(r[cStationName]).toUpperCase():'';
    const d=cDate!==undefined?day(r[cDate]):'';
    const srcName=cSource!==undefined?clean(r[cSource]).toUpperCase():'';
    if(serial&&d)existing[d+'|'+serial+'|'+stationName]=true;
    if(srcName==='CUSTOMER DAILY'&&cBatch!==undefined&&clean(r[cBatch])===batch)return;
  });
  const dailyByIdentity={},cmAdds=[];let rawTTCount=0;
  const collect=(values,kind)=>{
    if(values.length<2)return;
    const h=map(values[0].map(clean));
    values.slice(1).forEach(r=>{
      const serial=clean(srcVal(r,h,['Cabinet S/N'])).toUpperCase(),station=clean(srcVal(r,h,['Station Code'])).toUpperCase(),name=clean(srcVal(r,h,['Location Name']));
      if(!serial&&!station&&!name)return;
      rawTTCount++;
      const master=(serial&&bySerial[serial])||(station&&byStation[station])||{};
      const siteKey=makeSiteKey_(serial,station,name),identity=(serial||station||normalizeGroupKey_(name))+'|'+normalizeGroupKey_(name||master.name);
      const issues=[srcVal(r,h,['Faulted Reason']),srcVal(r,h,['Station Block Reason','Station Block Status']),srcVal(r,h,['Cabinet Block Reason']),srcVal(r,h,['Slot Faulted Status']),srcVal(r,h,['Error Code'])].map(clean).filter(Boolean);
      const issue=uniqueText_(issues).join('; ')||'BSS Non-Available';
      if(!dailyByIdentity[identity])dailyByIdentity[identity]={serial,station,name:name||master.name,master,siteKey,issues:[],kind};
      dailyByIdentity[identity].issues=uniqueText_(dailyByIdentity[identity].issues.concat(issues));
      const dupKey=dateKey+'|'+serial+'|'+normalizeGroupKey_(name||master.name);
      if(existing[dupKey])return;
      // Prevent duplicate creation on re-upload, while keeping a new daily TT distinct from older outstanding history.
      existing[dupKey]=true;
      const row=new Array(currentCM[0].length).fill('');
      const put=(names,value)=>{const idx=col(cH,Array.isArray(names)?names:[names]);if(idx!==undefined)row[idx]=value;};
      const ttId=newTT_(date);
      put(['Date'],date);put(['Status BSS'],'Pending');put(['Priorities'],priorityFromIssue_(issue));
      put(['Serial Number'],serial);put(['Station Name'],name||master.name);put(['Faulted Alarm'],issue);
      put(['Status Charger'],clean(srcVal(r,h,['Connectivity'])));put(['Status Battery'],Number(srcVal(r,h,['Battery Count'])||0)>0?'With Battery':'Without Battery');
      put(['PIC'],master.team||'');put(['Assign Date'],'');put(['Scheduled/Wairing Part'],'');put(['Closed/Completed At'],'');
      put(['SLA'],new Date(date.getTime()+12*3600000));put(['Category'],categoryFromIssue_(issue));
      put(['Districk','District'],clean(srcVal(r,h,['District'])));put(['Provinsi','Province'],clean(srcVal(r,h,['Province'])));
      put(['TT ID'],ttId);put(['Site Key'],siteKey);put(['Source'],'CUSTOMER DAILY');put(['Import Batch'],batch);put(['Last Update'],new Date());put(['Internal Remarks'],'Customer sheet: '+kind+' | '+meta.name);
      cmAdds.push(row);
    });
  };
  collect(withVals,'With Battery Unavalaible');collect(withoutVals,'Without Battery Unavalaible');

  const dailyRows=Object.keys(dailyByIdentity).map(k=>{
    const x=dailyByIdentity[k],r=new Array(dailyVals[0].length).fill(''),put=(name,v)=>{if(dh[name]!==undefined)r[dh[name]]=v;};
    const battery=x.master.row?x.master.row[fh['Battery Count']]:'',op=x.master.operational||'';
    put('Date',date);put('Site Key',x.siteKey);put('Cabinet S/N',x.serial);put('Station Code',x.station);put('Site Name',x.name);put('Mitra/Team',x.master.team||'');
    put('Connectivity',x.master.row?x.master.row[fh['Connectivity']]:'');put('Customer TT','YES');put('Operational',op);put('Faulted Reason',x.issues.join('; '));
    put('Station Block Status',x.master.row?x.master.row[fh['Station Block Status']]:'');put('Battery Count',battery);put('Battery Type',Number(battery||0)>0?'WITH BATTERY':'WITHOUT BATTERY');
    put('Source File',meta.name);put('Import Batch',batch);put('Remarks',x.master.team?'':'NEW SITE — CONFIRM & MAP TEAM');return r;
  });
  if(dailyRows.length){const width=dailyVals[0].length,writeRows=fitRows_(dailyRows,width);if(writeRows.length)dailySh.getRange(dailySh.getLastRow()+1,1,writeRows.length,width).setValues(writeRows);}
  if(cmAdds.length){const width=currentCM[0].length,writeRows=fitRows_(cmAdds,width);if(writeRows.length)cmSh.getRange(cmSh.getLastRow()+1,1,writeRows.length,width).setValues(writeRows);}
  backfillActiveCMIds_();
  refreshReports();
  try{Drive.Files.remove(meta.id);}catch(e){}
  PropertiesService.getUserProperties().deleteProperty('BSS6_'+batch);
  return {ok:true,date:Utilities.formatDate(date,OMS.TZ,'dd/MM/yyyy'),sourceRows:siteVals.length-1,siteListMatched:updates.length,newSites:newSites.length,unmappedSites:newSites,withBatteryTT:countTTRows_(withVals),withoutBatteryTT:countTTRows_(withoutVals),customerTT:rawTTCount,cmCreated:cmAdds.length,message:'Site Master diperbarui: '+updates.length+' update, '+newSites.length+' site baru. TT sumber customer: '+rawTTCount+' baris; CM baru: '+cmAdds.length+'.'};
}
function makeSiteKey_(serial,station,name){return 'BSS|'+(clean(serial)||clean(station)||normalizeGroupKey_(name));}
function uniqueText_(values){const out=[],seen={};values.forEach(v=>{const x=clean(v),k=normalizeGroupKey_(x);if(x&&!seen[k]){seen[k]=true;out.push(x);}});return out;}
function priorityFromIssue_(issue){return /offline|fault|block|unavailable|error|not charging/i.test(issue)?'Priority 1':'Priority 2';}
function categoryFromIssue_(issue){const x=String(issue).toLowerCase();if(/battery|soh|charging/.test(x))return 'Battery Issue';if(/power|pln|voltage/.test(x))return 'Power Issue';if(/slot/.test(x))return 'Slot Issue';if(/offline|connectivity|signal|network/.test(x))return 'Connectivity Issue';return 'Other';}
function valBy_(row,headers,key){
  const i=headers[key];
  return i===undefined?'':row[i];
}


function issue_(r){const vals=[];['Faulted Reason','Connectivity','Station Block Status','Cabinet Block Reason','Slot Faulted Status','Error Code'].forEach(k=>{const i=GLOBAL_H[k];if(i!==undefined&&clean(r[i]))vals.push(clean(r[i]));});return vals.join(' | ')||'BSS Non-Available';}
let GLOBAL_H={};
function priority_(r){const x=issue_(r).toLowerCase();if(/fault|offline|block|unavailable|error|not charging/.test(x))return 'S2 High';return 'S3 Medium';}
function newTT_(date){
  const p=PropertiesService.getScriptProperties(),dd=Utilities.formatDate(date,OMS.TZ,'dd'),mm=Utilities.formatDate(date,OMS.TZ,'MM'),yy=Utilities.formatDate(date,OMS.TZ,'yy'),key='BSS6TT_'+dd+mm+yy;
  let n=Number(p.getProperty(key)||0);
  if(n===0){const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.CM),v=sh.getDataRange().getValues(),h=map(v[0].map(clean)),i=h['TT ID'];if(i!==undefined){const re=new RegExp('^CLX/BSS/'+dd+'/'+mm+'/'+yy+'/([0-9]{4})$');v.slice(1).forEach(r=>{const m=clean(r[i]).match(re);if(m)n=Math.max(n,Number(m[1]));});}}
  n++;p.setProperty(key,String(n));return 'CLX/BSS/'+dd+'/'+mm+'/'+yy+'/'+('0000'+n).slice(-4);
}
function backfillActiveCMIds_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.CM);if(!sh||sh.getLastRow()<2)return;
  ensureCMInternalHeaders_();const v=sh.getDataRange().getValues(),h=map(v[0].map(clean));
  const idCol=h['TT ID'],dateCol=h['Date'],statusCol=h['Status BSS'],serialCol=h['Serial Number'],nameCol=h['Station Name'];
  if(idCol===undefined||dateCol===undefined||statusCol===undefined)return;
  const props=PropertiesService.getScriptProperties(),counters={},changedRows=[];
  const keyFor=d=>'BSS6TT_'+Utilities.formatDate(d,OMS.TZ,'ddMMyy');
  // Read existing generated IDs once, so setup does not call PropertiesService for every row.
  const re=/^CLX\/BSS\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{4})$/;
  for(let i=1;i<v.length;i++){
    const id=clean(v[i][idCol]),match=id.match(re);if(!match)continue;
    const key='BSS6TT_'+match[1]+match[2]+match[3];counters[key]=Math.max(counters[key]||0,Number(match[4]));
  }
  for(let i=1;i<v.length;i++){
    const status=normalizeStatus_(v[i][statusCol]);
    if(!status||status==='CLOSED'||(!clean(v[i][serialCol])&&!clean(v[i][nameCol]))||clean(v[i][idCol]))continue;
    let d=v[i][dateCol] instanceof Date?v[i][dateCol]:new Date(v[i][dateCol]);if(isNaN(d.getTime()))d=new Date();
    const key=keyFor(d);if(counters[key]===undefined)counters[key]=Number(props.getProperty(key)||0);
    counters[key]++;
    v[i][idCol]='CLX/BSS/'+Utilities.formatDate(d,OMS.TZ,'dd/MM/yy')+'/'+('0000'+counters[key]).slice(-4);
    changedRows.push(i+1);
  }
  if(changedRows.length){
    // Write the TT ID column in one batch, preserving all other columns and formulas.
    sh.getRange(2,idCol+1,v.length-1,1).setValues(v.slice(1).map(r=>[r[idCol]]));
    Object.keys(counters).forEach(k=>props.setProperty(k,String(counters[k])));
  }
}
function getDashboard(){
  requireRole_(['Coordinator','Admin']);

  const d=read_(OMS.S.DAILY),c=read_(OMS.S.CM),s=read_(OMS.S.SITE),dh=map(d.headers),ch=map(c.headers),sh=map(s.headers),today=day(new Date()),dr=d.rows.filter(r=>day(r[dh['Date']])===today),st={};
  const statusCol=ch['Status BSS'];c.rows.forEach(r=>{const x=statusCol===undefined?'':normalizeStatus_(r[statusCol]);if(x)st[x]=(st[x]||0)+1;});
  return {today,totalSite:s.rows.filter(r=>clean(r[sh['Cabinet S/N']])||clean(r[sh['Station Code']])).length,todayRows:dr.length,todayTT:dr.filter(r=>clean(r[dh['Customer TT']]).toUpperCase()==='YES').length,status:st};
}
function getWorkQueue(){
  requireRole_(['Coordinator','Admin']);

  const t=read_(OMS.S.CM),h=map(t.headers),site=read_(OMS.S.SITE),sh=map(site.headers),bySerial={},byName={};
  site.rows.forEach(r=>{const serial=clean(r[sh['Cabinet S/N']]).toUpperCase(),name=normalizeGroupKey_(r[sh['Location Name']]),x={team:clean(r[sh['Team Lead']]),site:clean(r[sh['Location Name']]),cabinet:clean(r[sh['Cabinet S/N']])};if(serial)bySerial[serial]=x;if(name)byName[name]=x;});
  return t.rows.map(r=>{const serial=clean(r[h['Serial Number']]).toUpperCase(),name=clean(r[h['Station Name']]),master=bySerial[serial]||byName[normalizeGroupKey_(name)]||{};return {ttId:clean(r[h['TT ID']]),site:name||master.site,mitra:clean(r[h['PIC']])||master.team,issue:clean(r[h['Faulted Alarm']]),priority:clean(r[h['Priorities']]),status:clean(r[h['Status BSS']]),pending:clean(r[h['Scheduled/Wairing Part']]),source:clean(r[h['Source']])};}).filter(x=>x.ttId&&normalizeStatus_(x.status)!=='CLOSED'&&x.source!=='HISTORICAL').sort((a,b)=>rankPriority_(a.priority)-rankPriority_(b.priority));
}
function normalizeStatus_(v){return normalizeGroupKey_(v).replace(/\s+/g,' ');}
function rankPriority_(v){const x=normalizeGroupKey_(v);if(x==='PRIORITY 1'||x==='S1 CRITICAL')return 1;if(x==='PRIORITY 2'||x==='S2 HIGH')return 2;if(x==='PRIORITY 3'||x==='S3 MEDIUM')return 3;return 9;}

function getUnmappedSites(){
  requireRole_(['Coordinator','Admin']);

  const s=read_(OMS.S.SITE),h=map(s.headers),statusCol=h['OMS Mapping Status'],teamCol=h['Team Lead'];
  return s.rows.map((r,i)=>({rowNo:i+2,siteKey:makeSiteKey_(r[h['Cabinet S/N']],r[h['Station Code']],r[h['Location Name']]),siteName:clean(r[h['Location Name']]),cabinet:clean(r[h['Cabinet S/N']]),station:clean(r[h['Station Code']]),province:clean(r[h['Province']]),mitra:clean(r[teamCol]),mappingStatus:statusCol===undefined?'':clean(r[statusCol])})).filter(x=>x.mappingStatus.indexOf('NEW SITE')===0||(!x.mitra&&x.mappingStatus==='NEEDS MAPPING'));
}
function assignSiteMitra(o){
  requireRole_(['Coordinator','Admin']);

  if(!o||!o.siteKey||!o.mitra)throw Error('Site dan Team Lead wajib dipilih.');
  const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.SITE),v=sh.getDataRange().getValues(),h=map(v[0].map(clean));let rowNo=-1;
  for(let i=1;i<v.length;i++){if(makeSiteKey_(v[i][h['Cabinet S/N']],v[i][h['Station Code']],v[i][h['Location Name']])===clean(o.siteKey)){rowNo=i+1;break;}}
  if(rowNo<0)throw Error('Site tidak ditemukan di 07 SITE MASTER.');
  sh.getRange(rowNo,h['Team Lead']+1).setValue(clean(o.mitra));if(h['OMS Mapping Status']!==undefined)sh.getRange(rowNo,h['OMS Mapping Status']+1).setValue('MAPPED');refreshReports();return {ok:true,siteKey:o.siteKey,mitra:o.mitra};
}
function getMitraOptions(){
  requireRole_(['Coordinator','Admin']);
const s=read_(OMS.S.SITE),h=map(s.headers),o={};s.rows.forEach(r=>{const m=clean(r[h['Team Lead']]);if(m)o[m]=1;});return Object.keys(o).sort();}


function getMitraWork(m){
  const actor=requireRole_(['Coordinator','Mitra','Admin']);if(actor.role==='Mitra'&&normalizeGroupKey_(actor.mitra)!==normalizeGroupKey_(m))throw Error('Akses data mitra lain ditolak.');

  const cm=read_(OMS.S.CM),h=map(cm.headers),site=read_(OMS.S.SITE),sh=map(site.headers);
  const bySerial={},byStation={},byName={};
  site.rows.forEach(r=>{const x={serial:clean(r[sh['Cabinet S/N']]),station:clean(r[sh['Station Code']]),site:clean(r[sh['Location Name']]),team:clean(r[sh['Team Lead']]),operational:clean(r[sh['Operational']])};if(x.serial)bySerial[x.serial.toUpperCase()]=x;if(x.station)byStation[x.station.toUpperCase()]=x;if(x.site)byName[normalizeGroupKey_(x.site)]=x;});
  const col=(names)=>{for(const n of names)if(h[n]!==undefined)return h[n];return undefined;};
  const cDate=(col(['Date'])!==undefined?col(['Date']):0),cClosed=col(['Closed/Completed At']),cStatus=col(['Status BSS']),cSerial=col(['Serial Number']),cName=col(['Station Name']),cIssue=col(['Faulted Alarm']),cPriority=col(['Priorities']),cPIC=col(['PIC']),cPending=col(['Scheduled/Wairing Part']),cId=col(['TT ID']),cSource=col(['Source']),cSiteKey=col(['Site Key']),cBatch=col(['Import Batch']),cRca2=col(['RCA 2']);
  const groups={};
  cm.rows.forEach((r,index)=>{
    const status=normalizeStatus_(cStatus===undefined?'':r[cStatus]);if(!status)return;
    const serial=cSerial===undefined?'':clean(r[cSerial]),name=cName===undefined?'':clean(r[cName]);
    const master=(serial&&bySerial[serial.toUpperCase()])||(name&&byName[normalizeGroupKey_(name)])||{};
    const station=master.station||'',team=(cPIC===undefined?'':clean(r[cPIC]))||master.team;
    if(normalizeGroupKey_(team)!==normalizeGroupKey_(m))return;
    const source=cSource===undefined?'':normalizeStatus_(r[cSource]);if(source==='HISTORICAL')return;
    const identity=(serial?'SER:'+normalizeGroupKey_(serial):(station?'STA:'+normalizeGroupKey_(station):'SITE:'+normalizeGroupKey_(name)))+'|NAME:'+normalizeGroupKey_(name||master.site);
    const rawDate=cDate===undefined?'':r[cDate],rawClosed=cClosed===undefined?'':r[cClosed],dateObj=parseOMSDate_(rawDate),closedObj=parseOMSDate_(rawClosed),effectiveDate=status==='CLOSED'&&closedObj?closedObj:dateObj,timestamp=effectiveDate?effectiveDate.getTime():0;
    if(!groups[identity])groups[identity]={site:name||master.site,cabinet:serial||master.serial,station,siteKey:cSiteKey===undefined?makeSiteKey_(serial,station,name):clean(r[cSiteKey]),master,records:[]};
    groups[identity].records.push({index,rowNo:index+2,status,ttId:cId===undefined?'':clean(r[cId]),issue:cIssue===undefined?'':clean(r[cIssue]),priority:cPriority===undefined?'':clean(r[cPriority]),pending:cPending===undefined?'':clean(r[cPending]),date:rawDate,timestamp,source,batch:cBatch===undefined?'':clean(r[cBatch]),rca2:cRca2===undefined?'':clean(r[cRca2])});
  });
  const result=[];
  Object.keys(groups).forEach(key=>{
    const g=groups[key];g.records.sort((a,b)=>a.timestamp-b.timestamp||a.index-b.index);
    // TT lifecycle is tracked per TT ID: the latest row for an ID determines
    // whether that ticket is still open. Historical rows remain in the sheet.
    // A latest CLOSED event for the whole site also retires older daily rows;
    // only records created after that closure can become outstanding again.
    const byTicket={},withoutId=[];
    g.records.forEach(r=>{
      const id=normalizeGroupKey_(r.ttId);
      if(!id){withoutId.push(r);return;}
      if(!byTicket[id]||r.timestamp>byTicket[id].timestamp||(r.timestamp===byTicket[id].timestamp&&r.index>byTicket[id].index))byTicket[id]=r;
    });
    const latestPerTicket=Object.keys(byTicket).map(k=>byTicket[k]).concat(withoutId)
      .sort((a,b)=>a.timestamp-b.timestamp||a.index-b.index);
    const latestSiteRecord=g.records[g.records.length-1];
    const latestSiteClosed=latestSiteRecord&&latestSiteRecord.status==='CLOSED' ? latestSiteRecord.timestamp : -1;
    const excludedRca2={
      'SEALED':true,
      'KWH DISMANTEL':true,
      'STOLEN':true,
      'KWH NY INSTALL':true
    };
    const valid=latestPerTicket.filter(r=>{
      if(r.status==='CLOSED')return false;
      if(latestSiteClosed>=0 && r.timestamp<=latestSiteClosed)return false;
      if(excludedRca2[normalizeGroupKey_(r.rca2)])return false;
      return true;
    });
    if(!valid.length)return;

    const latest=valid[valid.length-1],issues=[];
    valid.forEach(r=>{
      if(!r.issue)return;
      const parts=String(r.issue).split(/[;|]+/).map(clean).filter(Boolean);
      parts.forEach(part=>{if(!issues.some(x=>normalizeGroupKey_(x)===normalizeGroupKey_(part)))issues.push(part);});
    });
    // Both Status date and Pending date must refer to the oldest still-outstanding TT.
    // Do not use Scheduled/Wairing Part here: that field may contain a newer visit/part date.
    const datedRecords=valid.map(r=>({record:r,parsed:parseOMSDate_(r.date)})).filter(x=>x.parsed);
    datedRecords.sort((a,b)=>a.parsed.getTime()-b.parsed.getTime()||a.record.index-b.record.index);
    const oldest=datedRecords.length?datedRecords[0].parsed:null;
    const oldestDateLabel=oldest?Utilities.formatDate(oldest,OMS.TZ,'dd/MMM/yyyy'):'Tanggal tidak tersedia';
    const statusDateLabel=Utilities.formatDate(new Date(),OMS.TZ,'dd/MMM/yyyy');
    const pending=oldestDateLabel;
    const hasHistory=valid.length>1;
    const statusLabel='OUTSTANDING '+valid.length+' Trouble ticket ('+statusDateLabel+')';
    let ttId=latest.ttId||valid.find(r=>r.ttId)?.ttId||'';if(!ttId){ttId=newTT_(latest.date instanceof Date?latest.date:new Date());const cmSheet=SpreadsheetApp.getActive().getSheetByName(OMS.S.CM),cmHeader=map(cmSheet.getRange(1,1,1,cmSheet.getLastColumn()).getValues()[0].map(clean));if(cmHeader['TT ID']!==undefined)cmSheet.getRange(latest.rowNo,cmHeader['TT ID']+1).setValue(ttId);}
    const masterPriority=priorityFromOperational_(g.master.operational);
    const finalPriority=masterPriority || (hasHistory?'Priority 1':(latest.priority||'Priority 2'));
    result.push({ttId,site:g.site,cabinet:g.cabinet,station:g.station,siteKey:g.siteKey,issue:issues.join('; ')||'BSS Non-Available',priority:finalPriority,status:statusLabel,pending,receivedDate:oldest,recordCount:valid.length,outstanding:hasHistory});
  });
  return result.sort((a,b)=>rankPriority_(a.priority)-rankPriority_(b.priority)||String(a.site||'').localeCompare(String(b.site||'')));
}
function priorityFromOperational_(operational){
  const x=normalizeGroupKey_(operational);
  if(x==='UNAVAILABLE')return 'Priority 1';
  if(x==='FAULTED')return 'Priority 2';
  if(x==='AVAILABLE')return 'Priority 3';
  return '';
}

function parseOMSDate_(value){
  if(value===null||value===undefined||value==='')return null;
  if(value instanceof Date)return isNaN(value.getTime())?null:value;
  if(typeof value==='number'){
    // Google Sheets date serial (days since 30 Dec 1899).
    if(value>20000&&value<100000)return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
    const d=new Date(value);return isNaN(d.getTime())?null:d;
  }
  const s=String(value).trim();if(!s)return null;
  // Explicitly handle dates such as 9/Oct/26, 09/Oct/2026, and 09/10/2026.
  let m=s.match(/^(\d{1,2})[\/-]([A-Za-z]{3,})[\/-](\d{2,4})/);
  if(m){const months={JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};const mon=months[m[2].slice(0,3).toUpperCase()];let y=Number(m[3]);if(y<100)y+=y>=70?1900:2000;if(mon!==undefined){const d=new Date(y,mon,Number(m[1]));return isNaN(d.getTime())?null:d;}}
  m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if(m){let y=Number(m[3]);if(y<100)y+=y>=70?1900:2000;const a=Number(m[1]),b=Number(m[2]);let d;if(a>12)d=new Date(y,b-1,a);else if(b>12)d=new Date(y,a-1,b);else d=new Date(y,b-1,a);return isNaN(d.getTime())?null:d;}
  const d=new Date(s);return isNaN(d.getTime())?null:d;
}

function normalizeGroupKey_(value){
  return clean(value).toUpperCase().replace(/\s+/g,' ').trim();
}

function generateBulkWhatsApp(m){
  requireRole_(['Coordinator','Admin']);

  const rows=getMitraWork(m);if(!rows.length)return {ok:false,message:'Tidak ada TT outstanding valid untuk '+m+' berdasarkan 03 CM MONITORING.'};
  const lines=['*CLX MS — BSS TROUBLE TICKET*','','*MITRA / TEAM : '+String(m).toUpperCase()+'*','*TOTAL SITE / TT VALID : '+rows.length+'*','','━━━━━━━━━━━━━━━━━━━━━━━━',''];
  rows.forEach((r,i)=>{lines.push('*TT. ID* = '+r.ttId,'*Site Name* = '+(r.site||'-'),'*Cabinet S/N* = '+(r.cabinet||'-'),'*Station Code* = '+(r.station||'-'),'*Issue* = '+(r.issue||'-'),'*Status* = '+(r.status||'Pending'),'*Pending From Date* = '+(r.pending||'-'),'*Priority Level* = '+(r.priority||'Priority 2'),'','Mohon update: *ACCEPT / REJECT*');if(i<rows.length-1)lines.push('','────────────────────────','');});
  return {ok:true,total:rows.length,rawTotal:rows.reduce((n,r)=>n+r.recordCount,0),groupedOutstanding:rows.filter(r=>r.outstanding).length,message:lines.join('\n')};
}

function updateCMStatus(o){
  requireRole_(['Coordinator','Admin']);

  const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.CM),v=sh.getDataRange().getValues(),h=map(v[0].map(clean));
  const idCol=h['TT ID'],serialCol=h['Serial Number'],nameCol=h['Station Name'];let idx=-1;
  for(let i=1;i<v.length;i++){if((idCol!==undefined&&clean(v[i][idCol])===clean(o.ttId))||(idCol===undefined&&clean(v[i][serialCol])===clean(o.serialNumber)&&clean(v[i][nameCol])===clean(o.siteName))){idx=i;break;}}
  if(idx<1)throw Error('TT tidak ditemukan.');
  const status=normalizeStatus_(o.status)==='SOLVED'?'Closed':clean(o.status);
  if(h['Status BSS']!==undefined)sh.getRange(idx+1,h['Status BSS']+1).setValue(status);
  if(h['Scheduled/Wairing Part']!==undefined)sh.getRange(idx+1,h['Scheduled/Wairing Part']+1).setValue(o.pending||'');
  if(h['Remarks']!==undefined)sh.getRange(idx+1,h['Remarks']+1).setValue(o.remarks||'');
  if(status==='Closed'&&h['Closed/Completed At']!==undefined)sh.getRange(idx+1,h['Closed/Completed At']+1).setValue(new Date());
  if(h['Last Update']!==undefined)sh.getRange(idx+1,h['Last Update']+1).setValue(new Date());refreshReports();return {ok:true};
}
function getPMMonitoring(mitra){
  const actor=requireRole_(['Coordinator','Mitra','Admin']);if(actor.role==='Mitra'&&normalizeGroupKey_(actor.mitra)!==normalizeGroupKey_(mitra))throw Error('Akses PM mitra lain ditolak.');

 const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.PM),v=sh.getDataRange().getValues(),h=map(v[0].map(clean)),m=clean(mitra).toUpperCase();
 return v.slice(1).filter(r=>clean(r[h['Mitra/Team']]).toUpperCase()===m).map((r,i)=>({row:i+2,date:formatDateOnly_(r[h['Date']]),target:Number(r[h['Daily Target']]||0),actual:r[h['Actual PM']]||'',achievement:r[h['Achievement %']]||'',remarks:r[h['Remarks']]||''}));
}
function updatePMActual(o){
  const actor=requireRole_(['Coordinator','Admin']);

 const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.PM),v=sh.getDataRange().getValues(),h=map(v[0].map(clean));
 const targetDay=clean(o.date),mitra=clean(o.mitra).toUpperCase();
 let rowNo=-1;
 for(let i=1;i<v.length;i++){if(clean(formatDateOnly_(v[i][h['Date']]))===targetDay&&clean(v[i][h['Mitra/Team']]).toUpperCase()===mitra){rowNo=i+1;break;}}
 if(rowNo<0)throw Error('Baris PM tidak ditemukan untuk '+o.mitra+' pada '+o.date+'.');
 const actual=Number(o.actual);if(isNaN(actual)||actual<0)throw Error('Actual PM harus berupa angka >= 0.');
 sh.getRange(rowNo,h['Actual PM']+1).setValue(actual);
 const target=Number(sh.getRange(rowNo,h['Daily Target']+1).getValue()||0);
 sh.getRange(rowNo,h['Achievement %']+1).setValue(target?actual/target:0);
 sh.getRange(rowNo,h['Remarks']+1).setValue(o.remarks||'');
 return {ok:true,row:rowNo,actual:actual,achievement:target?actual/target:0};
}
function formatDateOnly_(v){if(!v)return '';const d=v instanceof Date?v:new Date(v);return isNaN(d)?clean(v):Utilities.formatDate(d,OMS.TZ,'yyyy-MM-dd');}
function cleanupDailyMonitoring(){
 const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.DAILY),v=sh.getDataRange().getValues();if(v.length<2)return;
 const h=map(v[0].map(clean)),kept=v.slice(1).filter(r=>clean(r[h['Customer TT']]).toUpperCase()==='YES');
 if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).clearContent();
 if(kept.length){const width=v[0].length,writeRows=fitRows_(kept,width);if(writeRows.length)sh.getRange(2,1,writeRows.length,width).setValues(writeRows);}
}
function refreshReports(){
  ensure_();const ss=SpreadsheetApp.getActive(),s=read_(OMS.S.SITE),h=map(s.headers),teamCol=h['Team Lead'],mit={};
  s.rows.forEach(r=>{const team=teamCol===undefined?'':clean(r[teamCol]),serial=clean(r[h['Cabinet S/N']]),station=clean(r[h['Station Code']]);if(team&&(serial||station))mit[team]=(mit[team]||0)+1;});
  const pm=ss.getSheetByName(OMS.S.PM),now=new Date(),cy=cycle_(now),days=Math.max(1,Math.round((cy.end-cy.start)/86400000)),old=pm.getDataRange().getValues(),ph=map(old[0].map(clean)),preserve={};
  old.slice(1).forEach(r=>{const key=formatDateOnly_(r[ph['Date']])+'|'+clean(r[ph['Mitra/Team']]).toUpperCase();preserve[key]={actual:r[ph['Actual PM']],remarks:r[ph['Remarks']]};});
  if(pm.getLastRow()>1)pm.getRange(2,1,pm.getLastRow()-1,pm.getLastColumn()).clearContent();
  const rows=[];Object.keys(mit).sort().forEach(team=>{for(let i=0;i<days;i++){const d=new Date(cy.start.getTime()+i*86400000),key=formatDateOnly_(d)+'|'+team.toUpperCase(),oldv=preserve[key]||{};rows.push([d,cy.start,cy.end,team,mit[team],mit[team]/days,oldv.actual===undefined?'':oldv.actual,oldv.actual===undefined||oldv.actual===''?'':(mit[team]?Number(oldv.actual)/(mit[team]/days):0),oldv.remarks||'']);}});
  if(rows.length)pm.getRange(2,1,rows.length,rows[0].length).setValues(rows);
  const pv=pm.getDataRange().getValues(),ph2=map(pv[0].map(clean));for(let i=1;i<pv.length;i++){const target=Number(pv[i][ph2['Daily Target']]||0),actual=pv[i][ph2['Actual PM']];pm.getRange(i+1,ph2['Achievement %']+1).setValue(actual===''?'':(target?Number(actual)/target:0));}
}
function cycle_(d){const x=new Date(d);x.setHours(0,0,0,0);return x.getDate()>=15?{start:new Date(x.getFullYear(),x.getMonth(),15),end:new Date(x.getFullYear(),x.getMonth()+1,15)}:{start:new Date(x.getFullYear(),x.getMonth()-1,15),end:new Date(x.getFullYear(),x.getMonth(),15)};}
function findSite_(ss){return ss.getSheets().find(s=>/^sitelist/i.test(s.getName()))||null;}
function inferDate_(n){const m=String(n).match(/(\d{2})(\d{2})(\d{4})/);return m?new Date(+m[3],+m[2]-1,+m[1]):new Date();}
function read_(n){const s=SpreadsheetApp.getActive().getSheetByName(n);if(!s)throw Error('Sheet tidak ditemukan: '+n);const v=s.getDataRange().getValues();return {headers:(v[0]||[]).map(clean),rows:v.slice(1)};}
function map(a){const o={};a.forEach((x,i)=>o[x]=i);return o;}
function fitRows_(rows,width){if(!Array.isArray(rows)||!rows.length||!width)return [];return rows.filter(r=>Array.isArray(r)).map(r=>{const out=r.slice(0,width);while(out.length<width)out.push('');return out;});}
function clean(v){return v==null?'':String(v).trim();}
function day(v){if(!v)return '';const d=v instanceof Date?v:new Date(v);return isNaN(d)?'':Utilities.formatDate(d,OMS.TZ,'yyyy-MM-dd');}
function rank(x){return {'S1 Critical':1,'S2 High':2,'S3 Medium':3,'S4 Low':4}[x]||9;}


/* ================= CLX BSS OMS V8 WORKFLOW LAYER ================= */
function ensureWorkflowHeaders_(){
  const ss=SpreadsheetApp.getActive();
  const defs={
    [OMS.S.USERS]:['Email','Name','Role','Mitra/Team','Active','Created At','Created By'],
    [OMS.S.TASKS]:['Task ID','Task Type','TT ID','Site Key','Cabinet S/N','Station Code','Site Name','Mitra/Team','Technician Email','Technician Name','Source','Cycle Start','Cycle End','Status','Assigned By','Assigned At','Accepted At','Check In At','Check In Location','Check In Evidence URL','Issue Detail','RCA 1','RCA 2','Corrective Action','Check Out At','Check Out Location','Check Out Evidence URL','Report Summary','Submitted At','Review Status','Reviewed By','Reviewed At','Review Remarks','Pending Reason','Last Updated','PM Report URL'],
    [OMS.S.ACTIVITY]:['Timestamp','Task ID','Actor Email','Actor Role','Action','From Status','To Status','Remarks'],
    [OMS.S.EVIDENCE]:['Timestamp','Task ID','Evidence Type','Evidence URL','Description','Uploaded By'],
    [OMS.S.REVIEW]:['Timestamp','Task ID','Decision','Reviewer Email','Remarks'],
    [OMS.S.PMCHECK]:['Task ID','Checklist Item','Result','Remarks','Evidence URL'],
    [OMS.S.AUDIT]:['Timestamp','Actor Email','Role','Action','Entity Type','Entity ID','Details'],
    ['15 PM SITE STATUS']:['Site Key','Cabinet S/N','Site Name','Mitra/Team','Cycle Start','Cycle End','PM Status','Task ID','PM Report URL','Last Updated']
  };
  Object.keys(defs).forEach(n=>{
    let sh=ss.getSheetByName(n);if(!sh)sh=ss.insertSheet(n);
    const width=Math.max(sh.getLastColumn(),defs[n].length,1);
    const first=sh.getRange(1,1,1,width).getValues()[0].map(clean);
    const isEmpty=first.every(x=>!x);
    if(isEmpty){
      sh.getRange(1,1,1,defs[n].length).setValues([defs[n]]);
      sh.setFrozenRows(1);
      sh.getRange(1,1,1,defs[n].length).setFontWeight('bold').setBackground('#17365D').setFontColor('#FFFFFF');
      sh.autoResizeColumns(1,defs[n].length);
    } else {
      defs[n].forEach(header=>{
        if(first.indexOf(header)>=0)return;
        // Use the first genuinely blank header cell, not getLastColumn(), because
        // legacy sheets often have formatting extending far beyond their schema.
        let idx=first.findIndex((v,i)=>i>=1&&!v);
        if(idx<0){idx=first.length;first.push('');}
        sh.getRange(1,idx+1).setValue(header).setFontWeight('bold').setBackground('#17365D').setFontColor('#FFFFFF');
        first[idx]=header;
      });
      sh.setFrozenRows(1);
    }
  });
}
function currentUser_(){
  ensureWorkflowHeaders_();
  const email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  if(!email)throw Error('Email akun tidak dapat dibaca. Deploy Web App sebagai user yang mengakses, lalu login dengan akun yang terdaftar di 08 USER MASTER.');
  const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.USERS),v=sh.getDataRange().getValues(),h=map(v[0].map(clean));
  const row=v.slice(1).find(r=>{
    const active=String(r[h.Active]||'').trim().toUpperCase();
    return String(r[h.Email]||'').trim().toLowerCase()===email && ['TRUE','ACTIVE','YES','1','Y'].includes(active);
  });
  if(!row)throw Error('Akun '+email+' belum terdaftar/aktif di 08 USER MASTER. Minta Admin menambahkan akun.');
  const rawRole=clean(row[h.Role]).toUpperCase();
  const roleMap={'ADMIN':'Admin','COORDINATOR':'Coordinator','MITRA':'Mitra','TECHNICIAN':'Technician'};
  const role=roleMap[rawRole];
  if(!role)throw Error('Role tidak valid pada 08 USER MASTER: '+rawRole);
  return {email,name:clean(row[h.Name])||email,role,mitra:clean(row[h['Mitra/Team']])};
}
function getMyContext(){const u=currentUser_();return {email:u.email,name:u.name,role:u.role,mitra:u.mitra,version:OMS.VERSION};}
function requireRole_(roles){const u=currentUser_();if(roles.indexOf(u.role)<0)throw Error('Akses ditolak. Role '+u.role+' tidak berwenang melakukan aksi ini.');return u;}
function workflowLog_(u,taskId,action,from,to,remarks){const ss=SpreadsheetApp.getActive(),now=new Date();ss.getSheetByName(OMS.S.ACTIVITY).appendRow([now,taskId,u.email,u.role,action,from||'',to||'',remarks||'']);ss.getSheetByName(OMS.S.AUDIT).appendRow([now,u.email,u.role,action,'TASK',taskId,remarks||'']);}
function taskSheet_(){ensureWorkflowHeaders_();return SpreadsheetApp.getActive().getSheetByName(OMS.S.TASKS);}
function taskData_(){const sh=taskSheet_(),v=sh.getDataRange().getValues();return {sh,v,h:map(v[0].map(clean))};}
function findTask_(id){const d=taskData_(),c=d.h['Task ID'];for(let i=1;i<d.v.length;i++)if(clean(d.v[i][c])===clean(id))return {sh:d.sh,v:d.v,h:d.h,row:d.v[i],rowNo:i+1};throw Error('Task tidak ditemukan: '+id);}
function newTaskId_(type){return 'CLX-'+(type==='PM'?'PM':'TT')+'-'+Utilities.formatDate(new Date(),OMS.TZ,'yyyyMMdd-HHmmss')+'-'+Math.floor(100+Math.random()*900);}
function taskObject_(row,h){const o={};Object.keys(h).forEach(k=>{const v=row[h[k]];o[k]=v instanceof Date?Utilities.formatDate(v,OMS.TZ,'yyyy-MM-dd HH:mm:ss'):v;});return o;}
function listTechniciansForMitra(mitra){const u=currentUser_();if(!['Coordinator','Mitra','Admin'].includes(u.role))throw Error('Akses ditolak.');const wanted=u.role==='Mitra'?u.mitra:clean(mitra);const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.USERS),v=sh.getDataRange().getValues(),h=map(v[0].map(clean));return v.slice(1).filter(r=>clean(r[h.Role]).toUpperCase()==='TECHNICIAN'&&['TRUE','ACTIVE','YES','1','Y'].includes(clean(r[h.Active]).toUpperCase())&&(!wanted||normalizeGroupKey_(r[h['Mitra/Team']])===normalizeGroupKey_(wanted))).map(r=>({email:clean(r[h.Email]),name:clean(r[h.Name]),mitra:clean(r[h['Mitra/Team']])}));}
function registerTechnician(o){const u=requireRole_(['Mitra','Admin']);if(!o||!o.email||!o.name)throw Error('Email dan nama teknisi wajib diisi.');const mitra=u.role==='Mitra'?u.mitra:clean(o.mitra);if(!mitra)throw Error('Mitra/Team wajib diisi.');const sh=SpreadsheetApp.getActive().getSheetByName(OMS.S.USERS),v=sh.getDataRange().getValues(),h=map(v[0].map(clean)),email=clean(o.email).toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))throw Error('Format email tidak valid.');for(let i=1;i<v.length;i++)if(clean(v[i][h.Email]).toLowerCase()===email){if(clean(v[i][h['Mitra/Team']])!==mitra&&u.role!=='Admin')throw Error('Email sudah terdaftar pada Mitra lain.');throw Error('Email sudah terdaftar.');}const values={'Email':email,'Name':clean(o.name),'Role':'Technician','Mitra/Team':mitra,'Active':true,'Created At':new Date(),'Created By':u.email};
 const row=new Array(sh.getLastColumn()).fill('');Object.keys(values).forEach(k=>{if(h[k]!==undefined)row[h[k]]=values[k];});
 sh.appendRow(row);workflowLog_(u,'USER:'+email,'REGISTER_TECHNICIAN','','ACTIVE','Mitra='+mitra);return {ok:true,email,mitra};}
function coordinatorAssignTT(o){const u=requireRole_(['Coordinator','Admin']);if(!o||!o.ttId||!o.mitra)throw Error('TT ID dan Mitra wajib diisi.');const cm=read_(OMS.S.CM),h=map(cm.headers),r=cm.rows.find(x=>clean(x[h['TT ID']])===clean(o.ttId));if(!r)throw Error('TT ID tidak ditemukan di 03 CM MONITORING.');const serial=clean(r[h['Serial Number']]),siteName=clean(r[h['Station Name']]),site=read_(OMS.S.SITE),sh=map(site.headers),master=site.rows.find(x=>(serial&&clean(x[sh['Cabinet S/N']]).toUpperCase()===serial.toUpperCase())||(!serial&&normalizeGroupKey_(x[sh['Location Name']])===normalizeGroupKey_(siteName)));if(!master)throw Error('Site tidak ditemukan di 07 SITE MASTER.');const team=clean(master[sh['Team Lead']]);if(normalizeGroupKey_(team)!==normalizeGroupKey_(o.mitra))throw Error('Mitra yang dipilih tidak sama dengan mapping Team Lead pada 07 SITE MASTER. Perbarui mapping terlebih dahulu.');const existing=taskData_(),th=existing.h;if(existing.v.slice(1).some(x=>clean(x[th['TT ID']])===clean(o.ttId)&&!['CLOSED','CANCELLED'].includes(normalizeStatus_(x[th.Status]))))throw Error('TT ini sudah memiliki task aktif.');const taskId=newTaskId_('TT'),now=new Date(),taskRow=[];const values={'Task ID':taskId,'Task Type':'TT','TT ID':clean(o.ttId),'Site Key':makeSiteKey_(serial,clean(master[sh['Station Code']]),siteName),'Cabinet S/N':serial,'Station Code':clean(master[sh['Station Code']]),'Site Name':siteName,'Mitra/Team':team,'Source':'COORDINATOR_ASSIGNMENT','Status':'ASSIGNED_TO_MITRA','Assigned By':u.email,'Assigned At':now,'Last Updated':now,'Review Status':'NOT_SUBMITTED'};existing.v[0].forEach((x,i)=>taskRow[i]=values[clean(x)]!==undefined?values[clean(x)]:'');existing.sh.appendRow(taskRow);workflowLog_(u,taskId,'ASSIGN_TT','CREATED','ASSIGNED_TO_MITRA','TT='+o.ttId+'; Mitra='+team);try{notifyMitraAssignment_(team,{taskId,ttId:clean(o.ttId),siteName,serial});}catch(pushErr){console.warn('FCM mitra notification failed: '+pushErr);}return {ok:true,taskId,status:'ASSIGNED_TO_MITRA'};}
function coordinatorBulkAssignTT(o){
  const u=requireRole_(['Coordinator','Admin']);
  if(!o||!Array.isArray(o.items)||!o.items.length)throw Error('Pilih minimal satu TT untuk Bulk Assign.');
  if(o.items.length>100)throw Error('Maksimal 100 TT per proses Bulk Assign.');
  const seen={},results=[];
  o.items.forEach(item=>{
    const ttId=clean(item&&item.ttId),mitra=clean(item&&item.mitra);
    if(!ttId||!mitra){results.push({ok:false,ttId:ttId||'(kosong)',error:'TT ID atau Mitra kosong.'});return;}
    if(seen[ttId]){results.push({ok:false,ttId,error:'TT duplikat dalam pilihan.'});return;}
    seen[ttId]=true;
    try{const result=coordinatorAssignTT({ttId,mitra});results.push({ok:true,ttId,taskId:result.taskId,mitra,status:result.status});}
    catch(e){results.push({ok:false,ttId,mitra,error:e&&e.message?e.message:String(e)});}
  });
  return {ok:results.every(x=>x.ok),total:results.length,success:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results};
}
function assignTaskTechnician(o){const u=requireRole_(['Mitra','Coordinator','Admin']);if(!o||!o.taskId||!o.technicianEmail)throw Error('Task dan teknisi wajib dipilih.');const t=findTask_(o.taskId),th=t.h,team=clean(t.row[th['Mitra/Team']]);if(u.role==='Mitra'&&normalizeGroupKey_(u.mitra)!==normalizeGroupKey_(team))throw Error('Task bukan milik Mitra Anda.');const users=listTechniciansForMitra(team),tech=users.find(x=>x.email.toLowerCase()===clean(o.technicianEmail).toLowerCase());if(!tech)throw Error('Teknisi tidak aktif atau bukan anggota Mitra '+team+'.');const from=clean(t.row[th.Status]);t.sh.getRange(t.rowNo,th['Technician Email']+1).setValue(tech.email);t.sh.getRange(t.rowNo,th['Technician Name']+1).setValue(tech.name);t.sh.getRange(t.rowNo,th.Status+1).setValue('ASSIGNED_TO_TECHNICIAN');t.sh.getRange(t.rowNo,th['Last Updated']+1).setValue(new Date());workflowLog_(u,o.taskId,'ASSIGN_TECHNICIAN',from,'ASSIGNED_TO_TECHNICIAN',tech.email);try{sendFcmToEmail_(tech.email,'CLX OMS — Task Baru','Anda ditugaskan untuk task '+o.taskId+'.',{taskId:String(o.taskId),event:'ASSIGNED_TO_TECHNICIAN'});}catch(pushErr){console.warn('FCM technician notification failed: '+pushErr);}return {ok:true,taskId:o.taskId,technician:tech.name};}
function coordinatorTaskList(){const u=requireRole_(['Coordinator','Admin']);const d=taskData_(),h=d.h;return d.v.slice(1).filter(r=>clean(r[h['Task ID']])).map(r=>taskObject_(r,h)).sort((a,b)=>new Date(b['Assigned At']||0)-new Date(a['Assigned At']||0));}
function myTaskList(){const u=currentUser_(),d=taskData_(),h=d.h;return d.v.slice(1).filter(r=>{if(!clean(r[h['Task ID']]))return false;if(u.role==='Coordinator'||u.role==='Admin')return true;if(u.role==='Mitra')return normalizeGroupKey_(r[h['Mitra/Team']])===normalizeGroupKey_(u.mitra);return clean(r[h['Technician Email']]).toLowerCase()===u.email;}).map(r=>taskObject_(r,h)).sort((a,b)=>new Date(b['Assigned At']||0)-new Date(a['Assigned At']||0));}
function technicianUpdateTask(o){
 const u=requireRole_(['Technician']);
 if(!o||!o.taskId||!o.action)throw Error('Task dan aksi wajib diisi.');
 const t=findTask_(o.taskId),h=t.h;
 if(clean(t.row[h['Technician Email']]).toLowerCase()!==u.email)throw Error('Task ini tidak ditugaskan kepada akun Anda.');
 const from=clean(t.row[h.Status]),a=clean(o.action).toUpperCase(),now=new Date();
 const allowed={ACCEPT:['ASSIGNED_TO_TECHNICIAN','ACCEPTED'],ON_THE_WAY:['ACCEPTED','ON_THE_WAY'],CHECK_IN:['ON_THE_WAY','IN_PROGRESS'],SAVE_PROGRESS:['IN_PROGRESS','IN_PROGRESS'],CHECK_OUT:['IN_PROGRESS','READY_TO_SUBMIT'],SUBMIT:['READY_TO_SUBMIT','COMPLETED_WAITING_REVIEW']};
 if(!allowed[a])throw Error('Aksi tidak dikenal.');
 if(from!==allowed[a][0])throw Error('Aksi '+a+' tidak valid saat status '+from+'.');
 const to=allowed[a][1],set=(k,v)=>{if(h[k]!==undefined)t.sh.getRange(t.rowNo,h[k]+1).setValue(v);};
 if(a==='CHECK_IN'||a==='CHECK_OUT'){
   if(!clean(o.location)||!clean(o.evidenceUrl))throw Error((a==='CHECK_IN'?'Clock In':'Clock Out')+' wajib memiliki GPS dan evidence foto.');
   if(a==='CHECK_IN'){set('Check In At',now);set('Check In Location',clean(o.location));set('Check In Evidence URL',clean(o.evidenceUrl));}
   else {set('Check Out At',now);set('Check Out Location',clean(o.location));set('Check Out Evidence URL',clean(o.evidenceUrl));}
 }
 if(a==='SAVE_PROGRESS'||a==='SUBMIT'){
   set('Issue Detail',clean(o.issueDetail));set('RCA 1',clean(o.rca1));set('RCA 2',clean(o.rca2));set('Corrective Action',clean(o.correctiveAction));set('Report Summary',clean(o.reportSummary));
   // Status CM is optional. Store status and note in existing Pending Reason field to preserve current sheet schema.
   const cmStatus=clean(o.cmStatus),note=clean(o.note);
   set('Pending Reason',[cmStatus,note].filter(Boolean).join(' | '));
 }
 if(a==='SUBMIT'){
   if(!clean(t.row[h['Check In Evidence URL']]))throw Error('Clock In/evidence wajib dilakukan sebelum Submit CM.');
   if(!clean(t.row[h['Check Out Evidence URL']]))throw Error('Clock Out/evidence wajib dilakukan sebelum Submit CM.');
   if(!clean(o.issueDetail)||!clean(o.rca1)||!clean(o.rca2)||!clean(o.correctiveAction))throw Error('Detail Issue, RCA 1, RCA 2, dan Corrective Action wajib diisi sebelum Submit CM.');
   const evidenceSh=SpreadsheetApp.getActive().getSheetByName(OMS.S.EVIDENCE),ev=evidenceSh.getDataRange().getValues();
   const count=ev.slice(1).filter(r=>clean(r[1])===clean(o.taskId)&&/CM_PROGRESS/.test(clean(r[2]))).length;
   if(count>6)throw Error('Maksimal 6 foto progress CM per task.');
   set('Submitted At',now);set('Review Status','WAITING_REVIEW');
   if(clean(t.row[h['Task Type']])==='PM'){const pmsh=SpreadsheetApp.getActive().getSheetByName(OMS.S.PMCHECK);String(o.pmChecklist||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const p=line.split('|').map(x=>x.trim());pmsh.appendRow([o.taskId,p[0]||'',p[1]||'',p.slice(2).join(' | '),clean(o.evidenceUrl)]);});}
 }
 set('Status',to);set('Last Updated',now);if(a==='ACCEPT')set('Accepted At',now);
 workflowLog_(u,o.taskId,a,from,to,[clean(o.cmStatus),clean(o.note)].filter(Boolean).join(' | ')||clean(o.remarks)||'');
 return {ok:true,status:to,taskId:o.taskId};
}
function coordinatorReviewTask(o){const u=requireRole_(['Coordinator','Admin']);if(!o||!o.taskId||!o.decision)throw Error('Task dan keputusan wajib diisi.');const t=findTask_(o.taskId),h=t.h,from=clean(t.row[h.Status]);if(from!=='COMPLETED_WAITING_REVIEW')throw Error('Task belum disubmit atau status bukan menunggu review.');const dec=clean(o.decision).toUpperCase(),to=dec==='APPROVE'?'CLOSED':dec==='REWORK'?'REWORK':'';if(!to)throw Error('Keputusan harus APPROVE atau REWORK.');if(dec==='REWORK'&&!clean(o.remarks))throw Error('Alasan rework wajib diisi.');t.sh.getRange(t.rowNo,h.Status+1).setValue(to);t.sh.getRange(t.rowNo,h['Review Status']+1).setValue(dec);t.sh.getRange(t.rowNo,h['Reviewed By']+1).setValue(u.email);t.sh.getRange(t.rowNo,h['Reviewed At']+1).setValue(new Date());t.sh.getRange(t.rowNo,h['Review Remarks']+1).setValue(clean(o.remarks));t.sh.getRange(t.rowNo,h['Last Updated']+1).setValue(new Date());if(to==='CLOSED'&&clean(t.row[h['Task Type']])==='TT')updateCMStatus({ttId:clean(t.row[h['TT ID']]),status:'Closed',remarks:'Coordinator approved Task '+o.taskId});if(clean(t.row[h['Task Type']])==='PM')upsertPMSiteStatus_(t.row,h,to==='CLOSED'?'APPROVED':'REWORK');SpreadsheetApp.getActive().getSheetByName(OMS.S.REVIEW).appendRow([new Date(),o.taskId,dec,u.email,clean(o.remarks)]);workflowLog_(u,o.taskId,'REVIEW_'+dec,from,to,o.remarks);return {ok:true,status:to};}
function pmSiteCandidates(){const u=currentUser_();if(!['Mitra','Coordinator','Admin'].includes(u.role))throw Error('Akses ditolak.');const s=read_(OMS.S.SITE),h=map(s.headers),cy=cycle_(new Date()),tasks=taskData_(),th=tasks.h,done={},active={};tasks.v.slice(1).forEach(r=>{if(clean(r[th['Task Type']])!=='PM')return;const key=clean(r[th['Site Key']])+'|'+formatDateOnly_(r[th['Cycle Start']])+'|'+formatDateOnly_(r[th['Cycle End']]);const st=normalizeStatus_(r[th.Status]);if(st==='CLOSED'||st==='APPROVED')done[key]=true;else if(!['CANCELLED'].includes(st))active[key]=true;});return s.rows.map(r=>{const site=clean(r[h['Location Name']]),serial=clean(r[h['Cabinet S/N']]),station=clean(r[h['Station Code']]),team=clean(r[h['Team Lead']]),key=makeSiteKey_(serial,station,site),cycleKey=key+'|'+formatDateOnly_(cy.start)+'|'+formatDateOnly_(cy.end);return {siteKey:key,siteName:site,cabinet:serial,station,mitra:team,operational:clean(r[h['Operational']]),lastPM:'',cycleStart:formatDateOnly_(cy.start),cycleEnd:formatDateOnly_(cy.end),alreadyDone:!!done[cycleKey],active:!!active[cycleKey]};}).filter(x=>(x.cabinet||x.station)&&(!u.mitra||normalizeGroupKey_(x.mitra)===normalizeGroupKey_(u.mitra))&&!x.alreadyDone&&!x.active);}
function startSelfPM(o){const u=requireRole_(['Mitra']);if(!o||!o.siteKey)throw Error('Pilih site.');const candidate=pmSiteCandidates().find(x=>x.siteKey===o.siteKey);if(!candidate)throw Error('Site tidak tersedia untuk PM mandiri: mungkin bukan milik Mitra Anda atau sudah selesai/aktif pada periode ini.');const d=taskData_(),h=d.h,id=newTaskId_('PM'),now=new Date(),vals={'Task ID':id,'Task Type':'PM','Site Key':candidate.siteKey,'Cabinet S/N':candidate.cabinet,'Station Code':candidate.station,'Site Name':candidate.siteName,'Mitra/Team':u.mitra,'Source':'MITRA_SELF_INITIATED','Cycle Start':parseOMSDate_(candidate.cycleStart),'Cycle End':parseOMSDate_(candidate.cycleEnd),'Status':'ASSIGNED_TO_MITRA','Assigned By':u.email,'Assigned At':now,'Last Updated':now,'Review Status':'NOT_SUBMITTED'};d.v[0].forEach((x,i)=>vals[clean(x)]!==undefined?null:null);const row=d.v[0].map(x=>vals[clean(x)]!==undefined?vals[clean(x)]:'');d.sh.appendRow(row);workflowLog_(u,id,'SELF_INITIATE_PM','DUE','ASSIGNED_TO_MITRA',candidate.siteName+'; cycle='+candidate.cycleStart+'..'+candidate.cycleEnd);return {ok:true,taskId:id,site:candidate.siteName};}
function upsertPMSiteStatus_(taskRow,h,status){const ss=SpreadsheetApp.getActive(),name='15 PM SITE STATUS';let sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);sh.appendRow(['Site Key','Cabinet S/N','Site Name','Mitra/Team','Cycle Start','Cycle End','PM Status','Task ID','PM Report URL','Last Updated']);}const key=clean(taskRow[h['Site Key']]),cycleStart=taskRow[h['Cycle Start']],cycleEnd=taskRow[h['Cycle End']],taskId=clean(taskRow[h['Task ID']]);const vals=sh.getDataRange().getValues(),head=map(vals[0].map(clean));let rowNo=0;for(let i=1;i<vals.length;i++){if(clean(vals[i][head['Task ID']])===taskId){rowNo=i+1;break;}}const row=[key,clean(taskRow[h['Cabinet S/N']]),clean(taskRow[h['Site Name']]),clean(taskRow[h['Mitra/Team']]),cycleStart,cycleEnd,status,taskId,clean(taskRow[h['PM Report URL']]),new Date()];if(rowNo)sh.getRange(rowNo,1,1,row.length).setValues([row]);else sh.appendRow(row);}
function coordinatorAssignPM(o){const u=requireRole_(['Coordinator','Admin']);if(!o||!o.siteKey||!o.mitra)throw Error('Site dan Mitra wajib diisi.');const s=read_(OMS.S.SITE),h=map(s.headers),r=s.rows.find(x=>makeSiteKey_(x[h['Cabinet S/N']],x[h['Station Code']],x[h['Location Name']])===clean(o.siteKey));if(!r)throw Error('Site tidak ditemukan.');if(normalizeGroupKey_(r[h['Team Lead']])!==normalizeGroupKey_(o.mitra))throw Error('Mitra tidak sesuai mapping Site Master.');const cy=cycle_(new Date()),id=newTaskId_('PM'),d=taskData_(),vals={'Task ID':id,'Task Type':'PM','Site Key':clean(o.siteKey),'Cabinet S/N':clean(r[h['Cabinet S/N']]),'Station Code':clean(r[h['Station Code']]),'Site Name':clean(r[h['Location Name']]),'Mitra/Team':clean(o.mitra),'Source':'COORDINATOR_ASSIGNMENT','Cycle Start':cy.start,'Cycle End':cy.end,'Status':'ASSIGNED_TO_MITRA','Assigned By':u.email,'Assigned At':new Date(),'Last Updated':new Date(),'Review Status':'NOT_SUBMITTED'};d.sh.appendRow(d.v[0].map(x=>vals[clean(x)]!==undefined?vals[clean(x)]:''));workflowLog_(u,id,'ASSIGN_PM','DUE','ASSIGNED_TO_MITRA',clean(r[h['Location Name']]));return {ok:true,taskId:id};}
function getWorkflowSummary(){const u=currentUser_(),a=myTaskList();return {user:u,taskCount:a.length,assigned:a.filter(x=>/ASSIGNED/.test(clean(x.Status))).length,inProgress:a.filter(x=>['ACCEPTED','ON_THE_WAY','IN_PROGRESS','READY_TO_SUBMIT'].includes(clean(x.Status))).length,waitingReview:a.filter(x=>clean(x.Status)==='COMPLETED_WAITING_REVIEW').length,closed:a.filter(x=>['CLOSED','APPROVED'].includes(clean(x.Status))).length};}
function getPMFormLaunchUrl(taskId){const u=requireRole_(['Technician']);const t=findTask_(taskId),h=t.h;if(clean(t.row[h['Task Type']])!=='PM')throw Error('Task ini bukan PM.');if(clean(t.row[h['Technician Email']]).toLowerCase()!==u.email)throw Error('Task PM tidak ditugaskan ke akun Anda.');const base=PropertiesService.getScriptProperties().getProperty('PM_FORM_WEBAPP_URL');if(!base)throw Error('Script Property PM_FORM_WEBAPP_URL belum diisi dengan URL deployment Form PM BSS.');return {url:base+(base.indexOf('?')>=0?'&':'?')+'taskId='+encodeURIComponent(taskId)};}
function coordinatorTTQueue(){requireRole_(['Coordinator','Admin']);const rows=getWorkQueue(),d=taskData_(),h=d.h,active={};d.v.slice(1).forEach(r=>{const id=clean(r[h['TT ID']]);if(id&&!['CLOSED','CANCELLED'].includes(normalizeStatus_(r[h.Status])))active[id]=true;});return rows.filter(x=>x.ttId&&!active[x.ttId]);}
function getMitraDashboard(){const u=currentUser_();if(!['Mitra','Coordinator','Admin'].includes(u.role))throw Error('Akses ditolak.');const rows=myTaskList();return {total:rows.length,tt:rows.filter(x=>x['Task Type']==='TT').length,pm:rows.filter(x=>x['Task Type']==='PM').length,outstanding:rows.filter(x=>!['CLOSED','APPROVED','CANCELLED'].includes(normalizeStatus_(x.Status))).length,waitingReview:rows.filter(x=>x.Status==='COMPLETED_WAITING_REVIEW').length};}
function uploadTaskEvidence(o){const u=requireRole_(['Technician']);if(!o||!o.taskId||!o.data||!o.name)throw Error('Task dan file evidence wajib diisi.');const t=findTask_(o.taskId),h=t.h;if(clean(t.row[h['Technician Email']]).toLowerCase()!==u.email)throw Error('Anda bukan teknisi yang ditugaskan pada task ini.');if(clean(o.evidenceType)==='CM_PROGRESS'){const es=SpreadsheetApp.getActive().getSheetByName(OMS.S.EVIDENCE),ev=es.getDataRange().getValues(),n=ev.slice(1).filter(r=>clean(r[1])===clean(o.taskId)&&clean(r[2])==='CM_PROGRESS').length;if(n>=6)throw Error('Maksimal 6 foto progress CM per task.');}const bytes=Utilities.base64Decode(o.data),blob=Utilities.newBlob(bytes,o.mimeType||'application/octet-stream',o.name),folderName='CLX BSS OMS Evidence';const it=DriveApp.getFoldersByName(folderName),folder=it.hasNext()?it.next():DriveApp.createFolder(folderName),file=folder.createFile(blob);const url=file.getUrl();SpreadsheetApp.getActive().getSheetByName(OMS.S.EVIDENCE).appendRow([new Date(),o.taskId,clean(o.evidenceType)||'WORK_EVIDENCE',url,clean(o.description),u.email]);workflowLog_(u,o.taskId,'UPLOAD_EVIDENCE','','',o.name);return {ok:true,url,name:o.name};}


function testFcmAuth() {
  const rawKey = PropertiesService
    .getScriptProperties()
    .getProperty('SERVICE_ACCOUNT_KEY');

  if (!rawKey) {
    throw new Error('SERVICE_ACCOUNT_KEY tidak ditemukan.');
  }

  const key = JSON.parse(rawKey);

  if (key.project_id !== 'clx-oms') {
    throw new Error('Project ID service account tidak sesuai.');
  }

  const service = OAuth2.createService('FCMServiceAccount')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setIssuer(key.client_email)
    .setPrivateKey(key.private_key)
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('https://www.googleapis.com/auth/firebase.messaging');

  if (!service.hasAccess()) {
    throw new Error('Autentikasi gagal: ' + service.getLastError());
  }

  console.log('FCM AUTH OK');
}

/* ================= CLX OMS FCM PUSH NOTIFICATIONS =================
 * Token is associated only with currentUser_() on the server.
 * Never accept an email identity from the client.
 */
function registerFcmToken(token) {
  const u = currentUser_();
  token = clean(token);
  if (!token || token.length < 40 || token.length > 4096) {
    throw Error('FCM token tidak valid.');
  }
  const ss = SpreadsheetApp.getActive();
  const name = '16 FCM TOKENS';
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(['Email','Name','Role','Mitra/Team','FCM Token','Updated At','Platform']);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,7).setFontWeight('bold').setBackground('#17365D').setFontColor('#FFFFFF');
  }
  const data = sh.getDataRange().getValues();
  const emailCol = 0, tokenCol = 4;
  let rowNo = 0;
  for (let i = 1; i < data.length; i++) {
    if (clean(data[i][emailCol]).toLowerCase() === u.email &&
        clean(data[i][tokenCol]) === token) {
      rowNo = i + 1;
      break;
    }
  }
  const row = [u.email,u.name,u.role,u.mitra,token,new Date(),'Android'];
  if (rowNo) sh.getRange(rowNo,1,1,row.length).setValues([row]);
  else sh.appendRow(row);
  return {ok:true, registered:true};
}

function fcmService_() {
  const rawKey = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_KEY');
  if (!rawKey) throw Error('SERVICE_ACCOUNT_KEY tidak ditemukan di Script Properties.');
  const key = JSON.parse(rawKey);
  if (key.project_id !== 'clx-oms') throw Error('Project ID service account tidak sesuai.');
  const service = OAuth2.createService('FCMServiceAccount')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setIssuer(key.client_email)
    .setPrivateKey(key.private_key)
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('https://www.googleapis.com/auth/firebase.messaging');
  if (!service.hasAccess()) throw Error('FCM auth gagal: ' + service.getLastError());
  return service;
}

function sendFcmToToken_(token, title, body, data) {
  const service = fcmService_();
  const payload = {message:{
    token:token,
    notification:{title:title,body:body},
    data:data || {},
    android:{priority:'HIGH'}
  }};
  const response = UrlFetchApp.fetch(
    'https://fcm.googleapis.com/v1/projects/clx-oms/messages:send',
    {method:'post',contentType:'application/json',
     headers:{Authorization:'Bearer '+service.getAccessToken()},
     payload:JSON.stringify(payload),muteHttpExceptions:true}
  );
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw Error('FCM HTTP '+code+': '+response.getContentText().slice(0,500));
  }
  return JSON.parse(response.getContentText());
}

function sendFcmToEmail_(email, title, body, data) {
  email = clean(email).toLowerCase();
  if (!email) return {sent:0};
  const sh = SpreadsheetApp.getActive().getSheetByName('16 FCM TOKENS');
  if (!sh || sh.getLastRow() < 2) return {sent:0};
  const rows = sh.getDataRange().getValues();
  let sent = 0;
  const errors = [];
  rows.slice(1).forEach((r, i) => {
    if (clean(r[0]).toLowerCase() !== email || !clean(r[4])) return;
    try {
      sendFcmToToken_(clean(r[4]),title,body,data);
      sent++;
    } catch (e) {
      errors.push(String(e));
      if (/HTTP 404|UNREGISTERED|registration-token-not-registered/i.test(String(e))) {
        sh.getRange(i+2,5).clearContent();
      }
    }
  });
  return {sent:sent,errors:errors};
}

function notifyMitraAssignment_(mitra, task) {
  const sh = SpreadsheetApp.getActive().getSheetByName('08 USER MASTER');
  if (!sh || sh.getLastRow() < 2) return {sent:0};
  const values = sh.getDataRange().getValues();
  const h = map(values[0].map(clean));
  let total = 0;
  values.slice(1).forEach(r => {
    const role = clean(r[h.Role]).toUpperCase();
    const active = ['TRUE','ACTIVE','YES','1','Y'].includes(clean(r[h.Active]).toUpperCase());
    const userMitra = clean(r[h['Mitra/Team']]);
    const email = clean(r[h.Email]).toLowerCase();
    if (active && role === 'MITRA' &&
        normalizeGroupKey_(userMitra) === normalizeGroupKey_(mitra) && email) {
      try {
        const result = sendFcmToEmail_(email,'CLX OMS — TT Baru Ditugaskan',
          'TT '+task.ttId+' ditugaskan kepada '+mitra+'. Site: '+task.siteName+'.',
          {taskId:String(task.taskId),ttId:String(task.ttId),event:'ASSIGNED_TO_MITRA'});
        total += result.sent || 0;
      } catch (e) {
        console.warn('FCM mitra '+email+': '+e);
      }
    }
  });
  return {sent:total};
}

function testFcmSendToSelf() {
  const u = currentUser_();
  const result = sendFcmToEmail_(u.email,'CLX OMS Test Notification',
    'Notifikasi uji coba dari CLX OMS berhasil dikirim.',
    {event:'TEST',user:u.email});
  console.log(JSON.stringify({email:u.email,sent:result.sent,errors:result.errors||[]}));
  return result;
}
