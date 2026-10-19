'use strict';
const endpoint = 'https://patahaoapp-production.up.railway.app/api/partner-applications/';
const form = document.querySelector('#application-form');
const statusForm = document.querySelector('#status-form');
// Retain only the random request key, never applicant details, for safe retries.
let submissionKey;
try { submissionKey = sessionStorage.getItem('partnerSubmissionKey'); } catch (_) {}
if (!submissionKey) submissionKey = crypto.randomUUID();
try { sessionStorage.setItem('partnerSubmissionKey', submissionKey); } catch (_) {}
async function send(url, data, method='POST') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {method, headers:method==='POST'?{'Content-Type':'application/json'}:{}, credentials:'omit', cache:'no-store', body:method==='POST'?JSON.stringify(data):undefined, signal:controller.signal});
    let result;
    try { result = await response.json(); } catch (_) { throw new Error('We could not read the server response. Your details remain in the form. Please try again or contact support@patahao.app.'); }
    if (!response.ok) {
      if (response.status >= 500) throw new Error('Applications are temporarily unavailable. Your details remain in the form. Please try again later or contact support@patahao.app.');
      const error=new Error(Object.entries(result).map(([field,value]) => `${field === 'detail' || field === 'non_field_errors' ? '' : field.replaceAll('_',' ') + ': '}${Array.isArray(value) ? value.join(' ') : value}`).join('\n'));error.status=response.status;throw error;
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('We could not confirm your request. Check your connection and try again. Your details remain in the form; a retry will not create another application.');
    throw error;
  } finally { clearTimeout(timer); }
}
function showMessage(element, text, error = false) { element.textContent = text; element.classList.toggle('error', error); element.focus(); }
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button[type=submit]');
  const message = document.querySelector('#application-message');
  button.disabled = true; button.textContent = 'Submitting…';
  const data = Object.fromEntries(new FormData(form));
  data.submission_key = submissionKey; data.consent = form.elements.consent.checked; data.office_training = form.elements.office_training.checked;
  try {
    const result = await send(endpoint+'reserve/', data);
    document.querySelector('#application-reference').textContent = result.reference;
    statusForm.elements.reference.value = result.reference;
    document.querySelector('#confirmed-training').textContent='Training place reserved\nDate: '+result.training.date+'\nTime: '+result.training.time+' (Kenya)\nOffice: '+result.training.location;
    form.hidden = true;
    const confirmation = document.querySelector('#confirmation'); confirmation.hidden = false; confirmation.focus();
    // Keep the key so a reload followed by a retry still finds this application.
  } catch (error) { showMessage(message, error.message, true);if(error.status===409)await loadTrainingSessions(); }
  finally { button.disabled = !form.elements.training_session.options.length || form.elements.training_session.disabled; button.textContent = 'Submit application →'; }
});
statusForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = statusForm.querySelector('button'); button.disabled = true;
  const message = document.querySelector('#status-message');
  const data = Object.fromEntries(new FormData(statusForm)); data.reference = data.reference.trim().toUpperCase();
  try {
    const result = await send(endpoint + 'status/', data);
    const appointment = result.office_appointment ? '\nOffice appointment: ' + new Date(result.office_appointment).toLocaleString('en-KE', {timeZone:'Africa/Nairobi'}) + ' (Kenya time)' : '';
    const training = result.training ? '\nTraining cohort: ' + result.training.cohort + '\nTime (Kenya): ' + (result.training.time || 'Confirm with our team') + '\nLocation: ' + result.training.location + '\nTraining dates (Kenya): ' + result.training.dates.join(', ') + '\nAttendance completed: ' + result.training.attendance_completed + '/' + result.training.sessions_required + '\nPractical modules competent: ' + result.training.competent_modules + '/' + result.training.modules_required : '';
    showMessage(message, result.status + appointment + training + '\n' + result.message);
  } catch (error) { showMessage(message, error.message, true); }
  finally { button.disabled = false; }
});

document.querySelector('#new-application').addEventListener('click', () => {
  submissionKey = crypto.randomUUID();
  try { sessionStorage.setItem('partnerSubmissionKey', submissionKey); } catch (_) {}
  form.reset(); form.hidden = false;
  document.querySelector('#confirmation').hidden = true;
  document.querySelector('#application-message').textContent = '';
  loadTrainingSessions();form.elements.full_name.focus();
});

let availabilitySequence=0;
async function loadTrainingSessions() {
  const sequence=++availabilitySequence;
  const select=form.elements.training_session,previous=select.value;
  const submit=form.querySelector('button[type=submit]'),refresh=document.querySelector('#refresh-training-sessions');
  select.disabled=true;submit.disabled=true;refresh.disabled=true;
  const message=document.querySelector('#training-sessions-message');
  message.textContent='Loading available training sessions…';
  try {
    const result=await send(endpoint+'sessions/',null,'GET');if(sequence!==availabilitySequence)return;
    select.replaceChildren();select.add(new Option(result.sessions.length?'Choose a date and time':'No training sessions are currently available',''));
    result.sessions.forEach(s=>select.add(new Option(s.date+' · '+s.time+' · '+s.remaining+' places · '+s.location,String(s.id))));
    if([...select.options].some(option=>option.value===previous))select.value=previous;
    select.disabled=!result.sessions.length;submit.disabled=!result.sessions.length;
    message.textContent=result.sessions.length?'Choose the session you can attend. All times are Kenya time.':'Our team needs to open more training dates. Check again later or contact support@patahao.app.';
  } catch(error){if(sequence===availabilitySequence){select.replaceChildren(new Option('Sessions could not be loaded',''));message.textContent=error.message;}}
  finally{if(sequence===availabilitySequence)refresh.disabled=false;}
}
document.querySelector('#refresh-training-sessions').addEventListener('click',loadTrainingSessions);
loadTrainingSessions();
