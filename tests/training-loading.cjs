const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
async function scenario(mode){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../public/staff/index.html'),'utf8'),{url:'https://patahao.app/staff/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 if(mode==='legacy')d.querySelector('#reload-cohorts').remove();
 w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
 let calls=0,applicationCalls=0;
 const cohorts=Array.from({length:5},(_,i)=>({id:i+1,name:'Class '+(i+1),enrolled:0,certified:0}));
 w.fetch=async(url,options)=>{
  let data,status=200;
  if(url.endsWith('login/'))data={access:'private-test-token',expires_in:1200,staff:{name:'Staff',can_change:true}};
  else if(url.includes('applications/?')){applicationCalls++;data={count:0,results:[],counts:{},statuses:[]};}
  else if(url.endsWith('training/dates/'))data={dates:[],defaults:{trainer_name:'Staff',location:'Nairobi'}};
  else if(url.includes('cohorts/?')){
   calls++;assert.equal(options.method,undefined,'Only reads are retried');
   if(mode==='network'&&calls===1)throw new w.TypeError('Failed to fetch');
   if(mode==='bodytimeout'&&calls===1)return {ok:true,status:200,json:async()=>{throw new w.DOMException('Timed out','AbortError');}};
   if(mode==='timeout'&&calls===1)throw new w.DOMException('Timed out','AbortError');
   if(mode==='outage'&&calls<=2){status=503;data={detail:'Service temporarily unavailable'};}
   else if(mode==='badrequest'){status=400;data={detail:'Invalid page'};}
   else if(mode==='unauthorized'){status=401;data={detail:'Token expired'};}
   else data={count:5,results:cohorts,can_manage:true,can_certify:false};
  }else throw Error('Unexpected '+url);
  return {ok:status<400,status,json:async()=>data};
 };
 const settle=()=>new Promise(r=>setTimeout(r,30));
 w.eval(fs.readFileSync(path.join(__dirname,'../public/assets/staff-portal.js'),'utf8'));
 d.querySelector('#staff-login').elements.username.value='staff';d.querySelector('#staff-login').elements.password.value='test';d.querySelector('#staff-login').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 d.querySelector('#training-tab').click();await settle();
 if(mode==='outage'){
  assert.equal(calls,2);assert.match(d.querySelector('#training-message').textContent,/HTTP 503.*Reload training classes/);
  assert.equal(d.querySelector('#reload-cohorts').disabled,false);d.querySelector('#reload-cohorts').click();await settle();assert.equal(calls,3);
 }else if(mode==='badrequest'){
  assert.equal(calls,1);assert.match(d.querySelector('#training-message').textContent,/HTTP 400/);w.close();return;
 }else if(mode==='unauthorized'){
  assert.equal(calls,1);assert.equal(d.querySelector('#workspace').hidden,true);assert.equal(d.querySelector('#cohort-list').children.length,0);w.close();return;
 }else assert.equal(calls,['normal','legacy'].includes(mode)?1:2);
 assert.equal(d.querySelectorAll('#cohort-list button').length,5);assert.match(d.querySelector('#training-message').textContent,/5 training classes found/);assert.equal(d.querySelector('#cohort-list').getAttribute('aria-busy'),'false');
 const before=calls;d.querySelector('#refresh-list').click();await settle();assert.equal(calls,before+1);assert.equal(applicationCalls,1,'Workspace refresh reloads Training rather than Applications');
 d.querySelector('#sign-out').click();assert.equal(d.querySelector('#cohort-list').children.length,0);assert.doesNotMatch(d.querySelector('#training-message').textContent,/private-test-token/);w.close();
}
(async()=>{for(const mode of ['normal','legacy','network','timeout','bodytimeout','outage','badrequest','unauthorized'])await scenario(mode);console.log('PASS: five-class rendering, one safe read retry, timeout recovery, visible HTTP errors, manual reload, active-workspace refresh, and expired-session clearing.');})().catch(error=>{console.error(error);process.exitCode=1;});
