'use strict';
const api = 'https://patahaoapp-production.up.railway.app/api/staff/onboarding/';
const $ = selector => document.querySelector(selector);
let token = null, staff = null, selected = null, page = 1, statuses = [], expiryTimer, idleTimer, listSequence = 0, detailSequence = 0;
const kenyanDate = value => value ? new Date(value).toLocaleString('en-KE', {timeZone:'Africa/Nairobi', dateStyle:'medium', timeStyle:'short'}) + ' (Kenya)' : 'Not arranged';
function message(selector, text, error = false) { const el=$(selector); el.textContent=text; el.className=error?'error':'success'; if(text) el.focus(); }
function signOut(reason='Signed out.') {
  token=null; staff=null; selected=null; listSequence++; detailSequence++;
  clearTimeout(expiryTimer); clearTimeout(idleTimer);
  $('#workspace').hidden=true; $('#staff-session').hidden=true; $('#login-panel').hidden=false;
  $('#application-list').replaceChildren(); $('#screening-history').replaceChildren();
  $('#applicant-facts').replaceChildren(); $('#applicant-name').textContent=''; $('#applicant-reference').textContent='';
  $('#detail-content').hidden=true; $('#empty-detail').hidden=false; $('#screening-form').reset();
  $('#staff-name').textContent=''; $('#application-search').value=''; $('#status-filter').value='';
  resetReports();
  $('#staff-login').reset(); message('#login-message',reason); $('#staff-login').elements.username.focus();
}
function renewIdle() { if(token) { clearTimeout(idleTimer); idleTimer=setTimeout(()=>signOut('Signed out after 15 minutes of inactivity. Please sign in again.'),15*60*1000); } }
for(const event of ['click','keydown','touchstart']) document.addEventListener(event,renewIdle,{passive:true});
async function request(path, options={}) {
  const {responseType='json',...fetchOptions}=options;
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),30000);
  const activeToken=token;
  try {
    const response=await fetch(api+path,{...fetchOptions,credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json',...(activeToken?{Authorization:'Bearer '+activeToken}:{}),...fetchOptions.headers},signal:controller.signal});
    if(response.ok && responseType==='blob') {
      if(activeToken && token!==activeToken) throw new Error('Session changed. Please sign in again.');
      return await response.blob();
    }
    let data; try { data=await response.json(); } catch (_) { throw new Error('The server returned an unreadable response. Please try again.'); }
    if(!response.ok) {
      if([401,403].includes(response.status) && activeToken && token===activeToken) signOut('Your session ended or access changed. Please sign in again.');
      const error=new Error(Object.entries(data).map(([key,value])=>(key==='detail'?'':key.replaceAll('_',' ')+': ')+(Array.isArray(value)?value.join(' '):value)).join('\n'));
      error.status=response.status; throw error;
    }
    if(activeToken && token!==activeToken) throw new Error('Session changed. Please sign in again.');
    return data;
  } catch(error) {
    if(error.name==='AbortError'||error instanceof TypeError) throw new Error('Connection interrupted. Refresh the applicant before repeating a save; the server may have already recorded it.');
    throw error;
  } finally { clearTimeout(timeout); }
}
$('#staff-login').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button'); button.disabled=true;
  message('#login-message','Signing in…');
  const fields=Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result=await request('login/',{method:'POST',body:JSON.stringify(fields)});
    token=result.access; staff=result.staff;
    $('#staff-login').reset(); $('#login-panel').hidden=true; $('#workspace').hidden=false; $('#staff-session').hidden=false;
    $('#staff-name').textContent=staff.name; page=1;
    clearTimeout(expiryTimer); expiryTimer=setTimeout(()=>signOut('Your session expired. Please sign in again.'),result.expires_in*1000); renewIdle();
    await loadList();
  } catch(error) { message('#login-message',error.message,true); }
  finally { button.disabled=false; }
});
$('#sign-out').addEventListener('click',()=>signOut());
function fillStatuses(select, all=false) {
  const previous=select.value; select.replaceChildren();
  if(all) select.add(new Option('All statuses',''));
  statuses.forEach(s=>select.add(new Option(s.label,s.value)));
  if([...select.options].some(o=>o.value===previous)) select.value=previous;
}
async function loadList() {
  const sequence=++listSequence; message('#workspace-message','Loading applications…');
  const query=new URLSearchParams({page:String(page),search:$('#application-search').value.trim(),status:$('#status-filter').value});
  try {
    const data=await request('applications/?'+query);
    if(sequence!==listSequence || !token) return;
    statuses=data.statuses; fillStatuses($('#status-filter'),true);
    const counts=data.counts;
    $('#count-all').textContent=Object.values(counts).reduce((a,b)=>a+b,0);
    for(const key of ['submitted','screening','invited']) $('#count-'+key).textContent=counts[key]||0;
    $('#list-summary').textContent=data.count+' matching application'+(data.count===1?'':'s');
    $('#page-label').textContent='Page '+page; $('#previous-page').disabled=!data.previous; $('#next-page').disabled=!data.next;
    const list=$('#application-list'); list.replaceChildren();
    if(!data.results.length) { const empty=document.createElement('p');empty.textContent='No applications match these filters.';list.append(empty); }
    data.results.forEach(a=>{
      const row=document.createElement('button');row.type='button';row.className='app-row';row.setAttribute('aria-pressed',String(selected?.id===a.id));row.dataset.id=a.id;
      const name=document.createElement('strong');name.textContent=a.full_name;
      const meta=document.createElement('span');meta.className='row-meta';
      const area=document.createElement('span');area.textContent=a.operating_area+', '+a.county;
      const state=document.createElement('span');state.className='status-pill';state.textContent=a.status_label;meta.append(area,state);
      const appointment=document.createElement('small');appointment.textContent=a.office_appointment?'Office: '+kenyanDate(a.office_appointment):'Applied '+kenyanDate(a.created_at);
      row.append(name,meta,appointment);row.addEventListener('click',()=>openDetail(a.id));list.append(row);
    });
    message('#workspace-message','');
  } catch(error) { if(sequence===listSequence && token) message('#workspace-message',error.message,true); }
}
$('#search-form').addEventListener('submit',event=>{event.preventDefault();page=1;loadList();});
$('#status-filter').addEventListener('change',()=>{page=1;loadList();});
$('#refresh-list').addEventListener('click',()=>loadList());
$('#previous-page').addEventListener('click',()=>{if(page>1){page--;loadList();}});
$('#next-page').addEventListener('click',()=>{page++;loadList();});
function kenyaInput(value) { if(!value)return '';return new Date(new Date(value).getTime()+3*60*60*1000).toISOString().slice(0,16); }
function showDetail(a) {
  selected=a; $('#empty-detail').hidden=true; $('#detail-content').hidden=false;
  $('#applicant-name').textContent=a.full_name; $('#applicant-reference').textContent=a.reference;
  const facts=$('#applicant-facts'); facts.replaceChildren();
  for(const [label,value] of [['Phone',a.phone_number],['Email',a.email||'Not provided'],['County',a.county],['Operating area',a.operating_area],['Partner type',a.partner_type_label],['Experience',a.experience_label],['Training availability',a.availability_label],['Current status',a.status_label]]) {
    const block=document.createElement('div');block.className='fact';const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value;block.append(dt,dd);facts.append(block);
  }
  fillStatuses($('#edit-status')); $('#edit-status').value=a.status; $('#edit-appointment').value=kenyaInput(a.office_appointment); $('#edit-action').value='screening';
  $('#save-screening').disabled=!staff.can_change;
  for(const id of ['#edit-status','#edit-appointment','#edit-action']) $(id).disabled=!staff.can_change;
  $('#readonly-notice').hidden=staff.can_change;
  const history=$('#screening-history');history.replaceChildren();
  if(!a.history.length){const item=document.createElement('li');item.textContent='No staff portal changes recorded yet.';history.append(item);}
  a.history.forEach(event=>{
    const li=document.createElement('li');const title=document.createElement('strong');title.textContent=event.action+' · '+event.actor;
    const detail=document.createElement('small');detail.textContent=kenyanDate(event.created_at)+' · '+event.previous_status+' → '+event.new_status;
    li.append(title,detail);
    if(event.new_appointment || event.previous_appointment){const appt=document.createElement('small');appt.textContent=event.new_appointment?'Office: '+kenyanDate(event.new_appointment):'Office appointment cleared';li.append(appt);}
    history.append(li);
  });
  document.querySelectorAll('.app-row').forEach(row=>row.setAttribute('aria-pressed',String(Number(row.dataset.id)===a.id)));
}
async function openDetail(id) {
  const sequence=++detailSequence; message('#workspace-message','Loading applicant…');
  try {const a=await request('applications/'+id+'/');if(sequence!==detailSequence||!token)return;showDetail(a);message('#save-message','');message('#workspace-message','');if(matchMedia('(max-width:950px)').matches)$('#applicant-detail').scrollIntoView({block:'start'});}
  catch(error){if(sequence===detailSequence&&token)message('#workspace-message',error.message,true);}
}
$('#reload-detail').addEventListener('click',()=>{if(selected)openDetail(selected.id);});
$('#screening-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!selected||!staff?.can_change)return;
  const id=selected.id;const button=$('#save-screening');button.disabled=true;message('#save-message','Saving…');
  const appointment=$('#edit-appointment').value;
  const payload={status:$('#edit-status').value,office_appointment:appointment?(appointment.length===16?appointment+':00+03:00':appointment+'+03:00'):null,expected_updated_at:selected.updated_at,action:$('#edit-action').value};
  try {
    const result=await request('applications/'+id+'/',{method:'PATCH',body:JSON.stringify(payload)});
    if(selected?.id===id){showDetail(result);message('#save-message','Saved. Applicant progress is updated. Contact the applicant directly; no notification was sent.');}
    await loadList();
  } catch(error){if(selected?.id===id)message('#save-message',error.message,true);}
  finally{if(token)button.disabled=!staff?.can_change;}
});

let reportPage=1, reportSequence=0, reportFilters=new URLSearchParams(), exportsAllowed=false;
function selectWorkspace(section) {
  $('#applications-view').hidden=section!=='applications'; $('#reports-view').hidden=section!=='reports';
  $('#applications-tab').setAttribute('aria-pressed',String(section==='applications'));
  $('#reports-tab').setAttribute('aria-pressed',String(section==='reports'));
}
function resetReports() {
  reportSequence++; reportPage=1; reportFilters=new URLSearchParams(); exportsAllowed=false;
  $('#report-filters').reset();
  for(const id of ['#pipeline-breakdown','#county-breakdown','#report-appointments']) $(id).replaceChildren();
  for(const id of ['#pipeline-total','#appointment-totals','#reports-message','#report-generated','#report-page']) $(id).textContent='';
  $('#export-pipeline').disabled=true; $('#export-appointments').disabled=true;
  selectWorkspace('applications');
}
$('#applications-tab').addEventListener('click',()=>selectWorkspace('applications'));
$('#reports-tab').addEventListener('click',()=>{selectWorkspace('reports');reportPage=1;loadReports();});
function readReportFilters() {
  return new URLSearchParams({date_from:$('#report-from').value,date_to:$('#report-to').value,county:$('#report-county').value.trim(),appointment_scope:$('#report-scope').value});
}
$('#report-filters').addEventListener('submit',event=>{event.preventDefault();reportPage=1;reportFilters=readReportFilters();loadReports();});
$('#clear-report-filters').addEventListener('click',()=>{$('#report-filters').reset();reportPage=1;reportFilters=readReportFilters();loadReports();});
$('#report-previous').addEventListener('click',()=>{if(reportPage>1){reportPage--;loadReports();}});
$('#report-next').addEventListener('click',()=>{reportPage++;loadReports();});
async function loadReports() {
  const sequence=++reportSequence; message('#reports-message','Loading reports…');
  $('#report-results').hidden=true; $('#report-generated').textContent='';
  $('#export-pipeline').disabled=true; $('#export-appointments').disabled=true;
  const query=new URLSearchParams(reportFilters);query.set('page',String(reportPage));
  try {
    const data=await request('reports/?'+query);
    if(sequence!==reportSequence||!token)return;
    $('#report-generated').textContent='Generated '+kenyanDate(data.generated_at);
    $('#pipeline-total').textContent=data.pipeline.total+' applications in the selected application period.';
    const breakdown=$('#pipeline-breakdown');breakdown.replaceChildren();
    data.pipeline.statuses.forEach(item=>{
      const row=document.createElement('div');row.className='pipeline-row';
      const label=document.createElement('div');label.className='pipeline-label';
      const name=document.createElement('span');name.textContent=item.label;const value=document.createElement('strong');value.textContent=item.count;label.append(name,value);
      const bar=document.createElement('div');bar.className='pipeline-bar';bar.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.style.width=(data.pipeline.total?100*item.count/data.pipeline.total:0)+'%';bar.append(fill);row.append(label,bar);breakdown.append(row);
    });
    const counties=$('#county-breakdown');counties.replaceChildren();
    if(!data.pipeline.counties.length)counties.textContent='No applications match these filters.';
    data.pipeline.counties.forEach(item=>{const row=document.createElement('div');row.className='county-row';const name=document.createElement('span');name.textContent=item.county||'Not recorded';const count=document.createElement('strong');count.textContent=item.count;row.append(name,count);counties.append(row);});
    const appointments=data.appointments;
    $('#appointment-totals').textContent=appointments.upcoming_count+' upcoming · '+appointments.past_count+' past appointments in the selected appointment period.';
    $('#report-page').textContent='Page '+reportPage+' · '+appointments.count+' appointments';
    $('#report-previous').disabled=!appointments.previous;$('#report-next').disabled=!appointments.next;
    const list=$('#report-appointments');list.replaceChildren();
    if(!appointments.results.length)list.textContent='No appointments match this view.';
    appointments.results.forEach(a=>{const row=document.createElement('button');row.className='app-row';row.type='button';const name=document.createElement('strong');name.textContent=a.full_name;const time=document.createElement('div');time.textContent=kenyanDate(a.office_appointment);const detail=document.createElement('small');detail.textContent=a.operating_area+', '+a.county+' · '+a.status_label;row.append(name,time,detail);row.addEventListener('click',()=>{selectWorkspace('applications');openDetail(a.id);});list.append(row);});
    $('#report-results').hidden=false;
    exportsAllowed=data.can_export;$('#export-pipeline').disabled=!exportsAllowed;$('#export-appointments').disabled=!exportsAllowed;
    message('#reports-message','');
  } catch(error){if(sequence===reportSequence&&token)message('#reports-message',error.message,true);}
}
async function exportReport(report) {
  if(!exportsAllowed||!token)return;
  const button=$(report==='pipeline'?'#export-pipeline':'#export-appointments');button.disabled=true;
  const query=new URLSearchParams(reportFilters);query.set('report',report);
  try {
    const blob=await request('reports/export/?'+query,{responseType:'blob'});
    if(!token)return;
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='patahao-'+report+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('#reports-message','CSV downloaded. Keep staff reports secure and share only with authorized colleagues.');
  } catch(error){if(token)message('#reports-message',error.message,true);}
  finally{if(token)button.disabled=!exportsAllowed;}
}
$('#export-pipeline').addEventListener('click',()=>exportReport('pipeline'));
$('#export-appointments').addEventListener('click',()=>exportReport('appointments'));
