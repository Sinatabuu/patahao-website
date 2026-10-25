const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
async function scenario(mode){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../public/staff/index.html'),'utf8'),{url:'https://patahao.app/staff/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
 let record={id:1,cohort_id:1,full_name:'Test applicant',application_reference:'PH-APP-TEST',state:'enrolled',state_label:'In training',identity_checked:false,agreement_signed:false,updated_at:'2026-10-19T12:00:00Z',attendance:[],assessments:[],readiness_issues:[],history:[],certified_at:'2026-10-19T11:00:00Z',certified_by:'Supervisor',activation:null};
 const cohort={id:1,name:'Test class',reference:'COHORT',trainer_name:'Trainer',location:'Nairobi',enrolled:1,certified:1,sessions:[]};
 let posted,activationReads=0;
 w.fetch=async(url,options)=>{
  let data;
  if(url.endsWith('login/'))data={access:'token',expires_in:1200,staff:{name:'Staff',can_change:true}};
  else if(url.includes('applications/?'))data={count:0,results:[],counts:{},statuses:[]};
  else if(url.endsWith('training/dates/'))data={dates:[],defaults:{trainer_name:'Staff',location:'Nairobi'}};
  else if(url.includes('cohorts/?'))data={results:[cohort],can_manage:true,can_certify:true,can_activate:mode!=='readonly'};
  else if(url.endsWith('cohorts/1/'))data={...cohort,enrollments:[{id:1,full_name:record.full_name,reference:record.application_reference,state_label:record.state_label}]};
  else if(url.endsWith('activation/')){
   if(options.method==='POST'){
    posted=JSON.parse(options.body);record={...record,updated_at:'2026-10-19T13:00:00Z',state_label:'Partner activated',activation:{partner_code:'PHA-TEST',activated_at:'2026-10-19T13:00:00Z'}};
    data={activation:record.activation,detail:'Partner activated. Sign out and sign in again in the app.'};
   }else{activationReads++;data={activation:record.activation?{...record.activation,username:'applicant',is_active:true}:null,account:mode==='missing'?null:{id:7,username:'applicant',full_name:'Test applicant',phone_number:'0712345678'},issues:mode==='missing'?['Ask the applicant to register in the app using the same number.']:[]};}
  }else if(url.endsWith('enrollments/1/'))data=record;
  else throw Error('Unexpected '+url);
  return {ok:true,status:200,json:async()=>data};
 };
 const settle=()=>new Promise(r=>setTimeout(r,30));
 const submit=id=>d.querySelector(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 w.eval(fs.readFileSync(path.join(__dirname,'../public/assets/staff-portal.js'),'utf8'));
 d.querySelector('#staff-login').elements.username.value='staff';d.querySelector('#staff-login').elements.password.value='test';submit('#staff-login');await settle();
 d.querySelector('#training-tab').click();await settle();d.querySelector('#cohort-list button').click();await settle();d.querySelector('#cohort-roster button').click();await settle();
 if(mode==='readonly'){assert.equal(d.querySelector('#activation-panel').hidden,true);assert.equal(activationReads,0);}
 else if(mode==='missing'){assert.equal(d.querySelector('#activation-panel').hidden,false);assert.equal(d.querySelector('#activation-form').hidden,true);assert.match(d.querySelector('#activation-issues').textContent,/register in the app/);}
 else{
  assert.equal(d.querySelector('#activation-form').hidden,false);assert.match(d.querySelector('#activation-account').textContent,/applicant.*0712345678/);
  assert.equal(d.querySelector('#certify-training').hidden,true);
  d.querySelector('#identity-checked').checked=true;d.querySelector('#agreement-signed').checked=true;d.querySelector('#activation-training-confirmed').checked=true;
  d.querySelector('#activation-account-confirmed').checked=true;d.querySelector('#activation-no-cash').checked=true;submit('#activation-form');await settle();
  assert.deepEqual(posted,{user_id:7,expected_updated_at:'2026-10-19T12:00:00Z',account_confirmed:true,no_cash_confirmed:true,approve_training:true,identity_checked:true,agreement_signed:true,training_confirmed:true});
  assert.equal(d.querySelector('#activation-form').hidden,true);assert.match(d.querySelector('#activation-account').textContent,/Partner activated: PHA-TEST/);
  assert.equal(d.querySelector('#reopen-training').hidden,true);assert.equal(d.querySelector('#withdraw-training').hidden,true);
 }
 d.querySelector('#sign-out').click();assert.equal(d.querySelector('#activation-panel').hidden,true);assert.equal(d.querySelector('#activation-account').textContent,'');assert.equal(d.querySelector('#activation-account-confirmed').checked,false);w.close();
}
(async()=>{for(const mode of ['success','missing','readonly'])await scenario(mode);console.log('PASS: matched-account activation, required office confirmations, protected active record, missing-account guidance, permission visibility and logout clearing.');})().catch(error=>{console.error(error);process.exitCode=1;});
