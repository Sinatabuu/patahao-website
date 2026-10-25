const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../public/staff/index.html'),'utf8'),{url:'https://patahao.app/staff/',runScripts:'outside-only'});
const w=dom.window,d=w.document;
w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
let record={id:1,cohort_id:1,full_name:'<img src=x> Test',application_reference:'PH-APP-TEST',state:'enrolled',state_label:'In training',identity_checked:false,agreement_signed:false,updated_at:'2026-10-19T10:00:00Z',attendance:[{session_id:1,date:'2026-10-18',result:'pending'}],assessments:['ethics','authorization','app','media','viewings','payments','deals','safety'].map(module=>({module,label:module,result:'pending'})),readiness_issues:['Attendance and assessment incomplete'],history:[]};
const cohort={id:1,name:'Office group',reference:'PH-COHORT-TEST',trainer_name:'Trainer',location:'Office',enrolled:1,certified:0,sessions:[{id:1,date:'2026-10-18'}]};
let saved,decision;
w.fetch=async(url,options)=>{
 let result;
 if(url.endsWith('login/'))result={access:'test-token',expires_in:1200,staff:{name:'Supervisor',can_change:true}};
 else {
  assert.equal(options.headers.Authorization,'Bearer test-token');
  if(url.endsWith('training/dates/'))result={dates:[],defaults:{trainer_name:'',location:''}};
  else if(url.includes('applications/?'))result={count:0,next:null,previous:null,counts:{},statuses:[],results:[]};
  else if(url.includes('cohorts/?'))result={results:[cohort],next:null,previous:null,can_manage:true,can_certify:true};
  else if(url.endsWith('cohorts/1/'))result={...cohort,enrollments:[{id:1,full_name:record.full_name,state_label:record.state_label}]};
  else if(url.endsWith('decision/')){
   decision=JSON.parse(options.body);assert.equal(decision.expected_updated_at,record.updated_at);
   record={...record,state:'certified',state_label:'Training certified — activation pending',certified_at:'2026-10-19T12:00:00Z',certified_by:'Supervisor',updated_at:'2026-10-19T12:00:00Z'};result=record;
  } else if(options.method==='PATCH'){
   saved=JSON.parse(options.body);assert.equal(saved.expected_updated_at,record.updated_at);
   record={...record,...saved,attendance:saved.attendance.map(a=>({...a,date:'2026-10-18'})),assessments:saved.assessments.map(a=>({...a,label:a.module})),updated_at:'2026-10-19T11:00:00Z',readiness_issues:[]};result=record;
  } else if(url.endsWith('enrollments/1/'))result=record;
  else throw Error('Unexpected request '+url);
 }
 return {ok:true,status:200,json:async()=>result};
};
const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
const submit=id=>d.querySelector(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
 w.eval(fs.readFileSync(path.join(__dirname,'../public/assets/staff-portal.js'),'utf8'));
 d.querySelector('#staff-login').elements.username.value='supervisor';d.querySelector('#staff-login').elements.password.value='test';submit('#staff-login');await settle();
 d.querySelector('#training-tab').click();await settle();
 assert.equal(d.querySelector('#training-view').hidden,false);
 d.querySelector('#cohort-list button').click();await settle();d.querySelector('#cohort-roster button').click();await settle();
 assert.equal(d.querySelector('#trainee-name img'),null,'Names must remain text');
 assert.equal(d.querySelector('#certify-training').disabled,true);
 assert.equal(d.querySelectorAll('#training-assessments select').length,8);
 d.querySelector('#identity-checked').checked=true;d.querySelector('#agreement-signed').checked=true;
 d.querySelectorAll('#training-attendance select').forEach(s=>s.value='present');d.querySelectorAll('#training-assessments select').forEach(s=>s.value='pass');submit('#training-record-form');await settle();
 assert.equal(saved.assessments.length,8);assert.equal(saved.identity_checked,true);
 assert.equal(d.querySelector('#certify-training').disabled,false);
 assert.equal(d.querySelector('#certify-training').hidden,true);
 assert.match(d.querySelector('#training-save-message').textContent,/Progress saved/);
 d.querySelector('#sign-out').click();
 assert.equal(d.querySelector('#trainee-panel').hidden,true);assert.equal(d.querySelector('#trainee-name').textContent,'');assert.equal(d.querySelector('#training-assessments').children.length,0);
 assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
 console.log('PASS: training roster, safe names, attendance and eight assessments, optional records, save progress and logout clearing.');w.close();
})().catch(error=>{console.error(error);w.close();process.exitCode=1;});
