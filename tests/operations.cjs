const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
async function scenario(mode){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../public/staff/index.html'),'utf8'),{url:'https://patahao.app/staff/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
 let patches=0,scans=0,revision=1;
 const issue={id:1,category:'onboarding',rule:'application_unscheduled',reference:'PH-APP-TEST',title:'<img src=x onerror=alert(1)>',reason:'Needs training',next_action:'Contact applicant',state:'open',owner:null,follow_up_at:null,source:{type:'application',id:1,status:'submitted'},history:[{action:'detected',actor:'Operations watchdog',created_at:'2026-10-30T10:00:00Z'}]};
 w.fetch=async(url,options)=>{
   let data,status=200;
   if(url.endsWith('login/'))data={access:'private-token',expires_in:1200,staff:{name:'Staff',can_change:true,can_view_operations:mode!=='noaccess'}};
   else if(url.includes('applications/?'))data={count:0,results:[],counts:{},statuses:[]};
   else if(url.endsWith('operations/scan/')){scans++;data={detail:'checked'};}
   else if(url.includes('operations/?'))data={count:1,results:[issue],counts:{open:1},can_manage:mode!=='reader',last_scan_at:'2026-10-30T10:00:00Z',stale:false,previous:null,next:null};
   else if(url.endsWith('operations/1/')){
     if(options.method==='PATCH'){patches++;const body=JSON.parse(options.body);assert.equal(body.revision,revision);assert.equal(body.action,'claim');if(mode==='conflict'){status=409;data={detail:'This follow-up changed.'};}else{revision++;data={...issue,revision};}}
     else data={...issue,revision};
   }else throw Error('Unexpected request '+url);
   return {ok:status<400,status,json:async()=>data};
 };
 const settle=()=>new Promise(r=>setTimeout(r,30));
 w.eval(fs.readFileSync(path.join(__dirname,'../public/assets/staff-portal.js'),'utf8'));
 d.querySelector('#staff-login').elements.username.value='staff';d.querySelector('#staff-login').elements.password.value='test';d.querySelector('#staff-login').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 if(mode==='noaccess'){assert.equal(d.querySelector('#operations-tab').hidden,true);assert.equal(scans,0);w.close();return;}
 assert.equal(d.querySelector('#operations-view').hidden,false);assert.equal(scans,mode==='reader'?0:1);
 assert.equal(d.querySelectorAll('#operations-list img').length,0,'Untrusted text is not HTML');
 d.querySelector('#operations-list button').click();await settle();
 assert.match(d.querySelector('#operations-detail').textContent,/Needs training/);
 assert.equal(d.querySelectorAll('#operations-detail img').length,0);
 const claim=[...d.querySelectorAll('#operations-detail button')].find(b=>b.textContent==='I will follow up');
 if(mode==='reader'){assert.equal(claim,undefined);assert.equal(d.querySelector('#operations-scan').hidden,true);}
 else{claim.click();claim.click();await settle();assert.equal(patches,1,'Double click cannot repeat a write');if(mode==='conflict')assert.match(d.querySelector('#operations-message').textContent,/Reload/);}
 d.querySelector('#sign-out').click();assert.equal(d.querySelector('#operations-list').children.length,0);assert.equal(d.querySelector('#operations-detail').children.length,0);assert.equal(d.querySelector('#operations-tab').hidden,true);w.close();
}
(async()=>{for(const mode of ['manager','reader','conflict','noaccess'])await scenario(mode);console.log('PASS: operations landing, scoped read-only controls, escaped source text, double-submit guard, stale edit error and sign-out clearing.');})().catch(e=>{console.error(e);process.exitCode=1;});
