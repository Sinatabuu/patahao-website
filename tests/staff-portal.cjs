const fs = require('node:fs');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const html=fs.readFileSync(require('node:path').join(__dirname,'../public/staff/index.html'),'utf8');
const js=fs.readFileSync(require('node:path').join(__dirname,'../public/assets/staff-portal.js'),'utf8');
const dom=new JSDOM(html,{url:'https://patahao.app/staff/',runScripts:'outside-only'});
const w=dom.window,d=w.document;
w.matchMedia=()=>({matches:false});
w.HTMLElement.prototype.scrollIntoView=()=>{};
let lastPatch, failFirstLogin=true;
let applicant={id:1,full_name:'<img src=x onerror=alert(1)>',reference:'PH-APP-TEST',phone_number:'254712345678',email:'test@example.test',county:'Nairobi',operating_area:'Roysambu',partner_type_label:'Agent',experience_label:'New',availability_label:'Weekdays',status:'submitted',status_label:'Application received',office_appointment:'2026-10-21T06:00:00Z',created_at:'2026-10-19T10:00:00Z',updated_at:'2026-10-19T10:00:00Z',history:[]};
w.fetch=async(url,options)=>{
 let result;
 if(url.endsWith('login/')&&failFirstLogin){failFirstLogin=false;throw new w.TypeError('Failed to fetch');}
 if(url.endsWith('login/')) result={access:'test-only-token',expires_in:1200,staff:{name:'Reviewer',can_change:true}};
 else if(url.endsWith('training/dates/')) result={dates:[],defaults:{trainer_name:'',location:''}};
 else if(url.includes('reports/?')) result={generated_at:'2026-10-19T12:00:00Z',pipeline:{total:3,statuses:[{status:'submitted',label:'Application received',count:2},{status:'invited',label:'Invited to office',count:1}],counties:[{county:'Nairobi',count:3}]},appointments:{upcoming_count:1,past_count:0,count:1,next:null,previous:null,results:[applicant]},can_export:true};
 else {
  assert.equal(options.headers.Authorization,'Bearer test-only-token');
  if(options.method==='PATCH') {lastPatch=JSON.parse(options.body);applicant={...applicant,...lastPatch,status_label:'Invited to office',updated_at:'2026-10-19T12:00:00Z'};result=applicant;}
  else if(url.includes('applications/?')) result={count:1,previous:null,next:null,counts:{submitted:1},statuses:[{value:'submitted',label:'Application received'},{value:'screening',label:'Staff screening'},{value:'invited',label:'Invited to office'}],results:[applicant]};
  else result=applicant;
 }
 return {ok:true,status:200,json:async()=>result};
};
const settle=()=>new Promise(r=>setTimeout(r,20));
const submit=id=>d.querySelector(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
 w.eval(js);
 d.querySelector('#staff-login').elements.username.value='reviewer';d.querySelector('#staff-login').elements.password.value='test';submit('#staff-login');await settle();
 assert.match(d.querySelector('#login-message').textContent,/Could not connect to staff sign-in/);
 assert.doesNotMatch(d.querySelector('#login-message').textContent,/applicant|save/);
 submit('#staff-login');await settle();
 assert.equal(d.querySelector('#workspace').hidden,false);
 assert.equal(d.querySelectorAll('.app-row').length,1);
 assert.equal(d.querySelector('.app-row img'),null,'Applicant names must not become HTML');
 d.querySelector('.app-row').click();await settle();
 assert.equal(d.querySelector('#edit-appointment').value,'2026-10-21T09:00');
 d.querySelector('#edit-status').value='invited';d.querySelector('#edit-action').value='appointment';submit('#screening-form');await settle();
 assert.equal(lastPatch.office_appointment,'2026-10-21T09:00:00+03:00');
 assert.equal(lastPatch.expected_updated_at,'2026-10-19T10:00:00Z');
 assert.match(d.querySelector('#save-message').textContent,/Saved/);
 d.querySelector('#reports-tab').click();await settle();
 assert.equal(d.querySelector('#reports-view').hidden,false);
 assert.equal(d.querySelector('#applications-view').hidden,true);
 assert.match(d.querySelector('#pipeline-total').textContent,/3 applications/);
 assert.equal(d.querySelectorAll('#pipeline-breakdown .pipeline-row').length,2);
 assert.equal(d.querySelectorAll('#report-appointments button').length,1);
 assert.equal(d.querySelector('#report-appointments img'),null);
 assert.equal(d.querySelector('#export-pipeline').disabled,false);
 d.querySelector('#report-appointments button').click();await settle();
 assert.equal(d.querySelector('#applications-view').hidden,false);
 assert.equal(d.querySelector('#applicant-name').textContent,applicant.full_name);
 d.querySelector('#application-search').value='254712345678';d.querySelector('#sign-out').click();
 assert.equal(d.querySelector('#workspace').hidden,true);
 assert.equal(d.querySelector('#applicant-facts').children.length,0);
 assert.equal(d.querySelector('#application-search').value,'');
 assert.equal(d.querySelector('#report-appointments').children.length,0);
 assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
 console.log('PASS: portal login, applicant safety, Kenya appointment save, reports rendering, appointment drill-down, logout clearing, and no persistent tokens.');
 w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
