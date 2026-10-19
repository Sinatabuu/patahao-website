const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../public/staff/index.html'),'utf8'),{url:'https://patahao.app/staff/',runScripts:'outside-only'});
const w=dom.window,d=w.document;
w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
let applicant={id:1,full_name:'Applicant Test',reference:'PH-APP-TEST',phone_number:'254712345678',county:'Nairobi',operating_area:'Roysambu',status:'submitted',status_label:'Received',office_appointment:null,created_at:'2026-10-19T10:00:00Z',updated_at:'2026-10-19T10:00:00Z',history:[],training:null};
let opened,scheduling;
w.fetch=async(url,options)=>{
 let data;
 if(url.endsWith('login/'))data={access:'token',expires_in:1200,staff:{name:'Staff',can_change:true}};
 else {
  assert.equal(options.headers.Authorization,'Bearer token');
  if(url.endsWith('training/dates/')) {
   if(options.method==='POST'){opened=JSON.parse(options.body);data={detail:'Opened'};}
   else data={dates:[{date:'2026-10-21',remaining:0},{date:'2026-10-22',remaining:24}],defaults:{trainer_name:'Sammy',location:'Roysambu office'}};
  } else if(url.includes('cohorts/?'))data={count:0,results:[],next:null,previous:null,can_manage:true,can_certify:false};
  else if(url.endsWith('schedule/')){
   scheduling=JSON.parse(options.body);
   applicant={...applicant,training:{id:7,class_name:'2026-10-22 · Morning',location:'Roysambu office'},status:'invited',updated_at:'2026-10-19T11:00:00Z'};
   data={overflow:true,class:{scheduled_date:'2026-10-22',time_label:'9 a.m.–noon',location:'Roysambu office'}};
  } else if(url.includes('applications/?'))data={count:1,results:[applicant],counts:{submitted:1},statuses:[{value:'submitted',label:'Received'},{value:'invited',label:'Invited'}]};
  else if(url.endsWith('applications/1/'))data=applicant;
  else throw Error('Unexpected request '+url);
 }
 return {ok:true,status:200,json:async()=>data};
};
const settle=()=>new Promise(r=>setTimeout(r,30));
const submit=id=>d.querySelector(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
 w.eval(fs.readFileSync(path.join(__dirname,'../public/assets/staff-portal.js'),'utf8'));
 d.querySelector('#staff-login').elements.username.value='staff';d.querySelector('#staff-login').elements.password.value='test';submit('#staff-login');await settle();
 d.querySelector('#training-tab').click();await settle();
 assert.equal(d.querySelector('#cohort-trainer').value,'Sammy');assert.equal(d.querySelector('#cohort-location').value,'Roysambu office');assert.equal(d.querySelector('#training-defaults').open,false);
 d.querySelector('#training-date').value='2026-10-23';submit('#cohort-create');await settle();
 assert.deepEqual(opened,{date:'2026-10-23',trainer_name:'Sammy',location:'Roysambu office'});
 assert.equal(d.querySelector('#enroll-reference'),null,'Manual reference copying removed');
 d.querySelector('#applications-tab').click();d.querySelector('.app-row').click();await settle();
 assert.equal(d.querySelector('#schedule-training-form').hidden,false);
 d.querySelector('#schedule-date').value='2026-10-21';submit('#schedule-training-form');await settle();
 assert.deepEqual(scheduling,{date:'2026-10-21',expected_updated_at:'2026-10-19T10:00:00Z'});
 assert.match(d.querySelector('#schedule-message').textContent,/Selected date full.*2026-10-22/);
 assert.equal(d.querySelector('#schedule-training-form').hidden,true);
 assert.match(d.querySelector('#assigned-training').textContent,/2026-10-22/);
 d.querySelector('#sign-out').click();assert.equal(d.querySelector('#schedule-date').children.length,0);assert.equal(d.querySelector('#assigned-training').textContent,'');
 console.log('PASS: reused office details, one-date opening, automatic applicant allocation, explicit overflow, no copied references, duplicate UI prevention and logout clearing.');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
