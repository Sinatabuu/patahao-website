const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../public/become-a-partner/index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../public/assets/partner-application.js'),'utf8');
async function scenario(mode){
 const dom=new JSDOM(html,{url:'https://patahao.app/become-a-partner/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let availabilityCalls=0,submitted;
 w.fetch=async(url,options)=>{
  if(url.endsWith('sessions/')){availabilityCalls++;return {ok:true,status:200,json:async()=>({sessions:mode==='empty'?[]:[{id:7,date:'2026-10-21',time:'9 a.m.–noon',remaining:1,location:'Roysambu office'}]})};}
  submitted=JSON.parse(options.body);
  if(mode==='full')return {ok:false,status:409,json:async()=>({detail:'That class has filled. Choose another time.'})};
  return {ok:true,status:201,json:async()=>({reference:'PH-APP-TEST',training:{date:'2026-10-21',time:'9 a.m.–noon',location:'Roysambu office'}})};
 };
 w.eval(script);await new Promise(r=>setTimeout(r,20));
 const form=d.querySelector('#application-form'),submit=form.querySelector('button[type=submit]');
 if(mode==='empty'){
  assert.equal(submit.disabled,true);assert.equal(form.elements.training_session.disabled,true);
  assert.match(d.querySelector('#training-sessions-message').textContent,/open more training dates/);
 }else{
  assert.equal(submit.disabled,false);assert.match(form.elements.training_session.options[1].textContent,/2026-10-21.*1 places/);
  form.elements.full_name.value='Applicant Test';form.elements.phone_number.value='0712345678';form.elements.training_session.value='7';form.elements.consent.checked=true;form.elements.office_training.checked=true;
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
  assert.equal(submitted.training_session,'7');assert.equal(submitted.consent,true);
  if(mode==='full'){
   assert.equal(form.hidden,false);assert.equal(form.elements.full_name.value,'Applicant Test');assert.equal(availabilityCalls,2);assert.match(d.querySelector('#application-message').textContent,/filled/);
  }else{
   assert.equal(form.hidden,true);assert.equal(d.querySelector('#application-reference').textContent,'PH-APP-TEST');assert.match(d.querySelector('#confirmed-training').textContent,/2026-10-21.*\nTime: 9 a.m.–noon \(Kenya\).*\nOffice: Roysambu office/);
   assert.equal(w.sessionStorage.length,1);assert.equal(w.sessionStorage.getItem('partnerSubmissionKey'),submitted.submission_key);
   d.querySelector('#new-application').click();await new Promise(r=>setTimeout(r,20));assert.equal(form.hidden,false);assert.notEqual(w.sessionStorage.getItem('partnerSubmissionKey'),submitted.submission_key);
  }
 }
 w.close();
}
(async()=>{for(const mode of ['success','full','empty'])await scenario(mode);console.log('PASS: session choices, atomic booking confirmation, full-class refresh with retained details, no-session handling, and no stored applicant details.');})().catch(error=>{console.error(error);process.exitCode=1;});
