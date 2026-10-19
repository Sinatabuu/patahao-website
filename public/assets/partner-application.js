'use strict';
const endpoint = 'https://patahaoapp-production.up.railway.app/api/partner-applications/';
const form = document.querySelector('#application-form');
const statusForm = document.querySelector('#status-form');
// Retain only the random request key, never applicant details, for safe retries.
let submissionKey;
try { submissionKey = sessionStorage.getItem('partnerSubmissionKey'); } catch (_) {}
if (!submissionKey) submissionKey = crypto.randomUUID();
try { sessionStorage.setItem('partnerSubmissionKey', submissionKey); } catch (_) {}
async function send(url, data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit', body:JSON.stringify(data), signal:controller.signal});
    let result;
    try { result = await response.json(); } catch (_) { throw new Error('We could not read the server response. Your details remain in the form. Please try again or contact support@patahao.app.'); }
    if (!response.ok) {
      if (response.status >= 500) throw new Error('Applications are temporarily unavailable. Your details remain in the form. Please try again later or contact support@patahao.app.');
      throw new Error(Object.entries(result).map(([field,value]) => `${field === 'detail' || field === 'non_field_errors' ? '' : field.replaceAll('_',' ') + ': '}${Array.isArray(value) ? value.join(' ') : value}`).join('\n'));
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
  const button = form.querySelector('button');
  const message = document.querySelector('#application-message');
  button.disabled = true; button.textContent = 'Submitting…';
  const data = Object.fromEntries(new FormData(form));
  data.submission_key = submissionKey; data.consent = form.elements.consent.checked; data.office_training = form.elements.office_training.checked;
  try {
    const result = await send(endpoint, data);
    document.querySelector('#application-reference').textContent = result.reference;
    statusForm.elements.reference.value = result.reference;
    form.hidden = true;
    const confirmation = document.querySelector('#confirmation'); confirmation.hidden = false; confirmation.focus();
    // Keep the key so a reload followed by a retry still finds this application.
  } catch (error) { showMessage(message, error.message, true); }
  finally { button.disabled = false; button.textContent = 'Submit application →'; }
});
statusForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = statusForm.querySelector('button'); button.disabled = true;
  const message = document.querySelector('#status-message');
  const data = Object.fromEntries(new FormData(statusForm)); data.reference = data.reference.trim().toUpperCase();
  try {
    const result = await send(endpoint + 'status/', data);
    const appointment = result.office_appointment ? '\nOffice appointment: ' + new Date(result.office_appointment).toLocaleString('en-KE', {timeZone:'Africa/Nairobi'}) + ' (Kenya time)' : '';
    showMessage(message, result.status + appointment + '\n' + result.message);
  } catch (error) { showMessage(message, error.message, true); }
  finally { button.disabled = false; }
});

document.querySelector('#new-application').addEventListener('click', () => {
  submissionKey = crypto.randomUUID();
  try { sessionStorage.setItem('partnerSubmissionKey', submissionKey); } catch (_) {}
  form.reset(); form.hidden = false;
  document.querySelector('#confirmation').hidden = true;
  document.querySelector('#application-message').textContent = '';
  form.elements.full_name.focus();
});
