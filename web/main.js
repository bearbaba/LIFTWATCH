import {connectWallet,subscribeWalletChanges,read,write,waitForFinalized,getTransactionState,getConsensusReceipt,explorer} from './chain.js';
import {finalReceipt,combineFinalChecks,normalizePendingTx} from './tx-status.js';
import {addressValid,actionGates,metrics} from './safety.js';
const $=id=>document.getElementById(id);
const previewPlan={min_arm:500,min_lift_bps:150,max_error_increase_bps:100};
let actor='',address=localStorage.getItem('liftwatch_contract')||'0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106',trial=null,policy=null,busy=false,txWriteAttempted=false;
const pendingKey=addr=>'liftwatch_pending_'+addr.toLowerCase();
function loadPending(addr){
  try{return normalizePendingTx(JSON.parse(localStorage.getItem(pendingKey(addr))),addr)}
  catch{return null}
}
let pendingTx=loadPending(address);
function savePending(value){
  pendingTx=value;
  if(value)localStorage.setItem(pendingKey(address),JSON.stringify(value));
  else localStorage.removeItem(pendingKey(address));
}
function showPending(){
 $('txBox').hidden=!pendingTx;
 if(pendingTx){$('txLink').href=explorer(pendingTx.hash);}
 $('txTrackerResume').disabled=busy||!pendingTx;
}
$('contract').value=address;
const short=v=>v?v.slice(0,7)+'…'+v.slice(-5):'—';
const number=id=>Number($(id).value);
const localReport=()=>({control_users:number('cUsers'),control_success:number('cWins'),
 treatment_users:number('tUsers'),treatment_success:number('tWins'),
 control_errors:number('cErrors'),treatment_errors:number('tErrors')});
const planInputs=()=>({title:$('title').value.trim(),hypothesis:$('hypothesis').value.trim(),
 metric_definition:$('metricDef').value.trim(),population:$('population').value.trim(),
 randomization:$('randomization').value.trim(),analyst:$('analyst').value.trim(),
 min_arm:number('minArm'),min_lift_bps:number('minLift'),max_error_increase_bps:number('maxErr')});
async function sha256(text){const data=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',data);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
function setMsg(m){$('log').textContent=m}
const txTitles={
 signing:['AWAITING SIGNATURE','Confirm the request in your wallet'],
 submitted:['SUBMITTED','Transaction hash received'],
 consensus:['PROCESSING','GenLayer consensus in progress'],
 finality:['WAITING FINALITY','Consensus decision is provisional'],
 readback:['VERIFYING','Finality recorded — verifying contract result'],
 success:['SUCCESS','Transaction successful and independently verified'],
 failure:['FAILED','Transaction did not complete successfully'],
 unverified:['UNVERIFIED','Transaction outcome not yet confirmed']
};
function trackTransaction(phase,{method='',hash='',detail=''}={}){
 const root=$('txTracker'),info=txTitles[phase]||txTitles.unverified;
 root.hidden=false;root.className='tx-tracker is-'+phase;
 $('txTrackerTitle').textContent=info[1]+(method?' · '+method.replaceAll('_',' '):'');
 $('txTrackerLabel').textContent=info[0];
 $('txTrackerDetail').textContent=detail||'Only a verified on-chain result can establish success.';
 $('txTrackerSpinner').hidden=!['signing','submitted','consensus','finality','readback'].includes(phase);
 $('txTrackerHash').hidden=!hash;$('txTrackerHash').textContent=hash;
 $('txTrackerLink').hidden=!hash;if(hash)$('txTrackerLink').href=explorer(hash);
 const status=['txStepSign','txStepSubmit','txStepConsensus','txStepVerify'];
 const active={signing:0,submitted:1,consensus:2,finality:2,readback:3,
   success:4,failure:hash?3:0,unverified:hash?2:0}[phase]??0;
 status.forEach((name,i)=>{
  const el=$(name);
  el.className=(phase==='success'||i<active)?'is-complete':
    (i===active?(['failure'].includes(phase)?'is-failed':phase==='unverified'?'':'is-active'):'');
 });
 if(phase==='failure')$(hash?'txStepVerify':'txStepSign').className='is-failed';
 $('txTrackerResume').hidden=!pendingTx||!['unverified'].includes(phase);
}
function followChainStatus(state,record){
 const raw=state?.statusName??state?.status_name??state?.status??'UNKNOWN';
 const status=raw===7||String(raw)==='7'?'FINALIZED':
   raw===8||String(raw)==='8'?'CANCELED':String(raw).toUpperCase();
 const hash=record.hash,method=record.method;
 if(status==='FINALIZED'){
  trackTransaction('readback',{hash,method,detail:'FINALIZED reported. Checking execution result and latest-final contract state.'});
 }else if(status==='ACCEPTED'||status==='UNDETERMINED'||status==='LEADER_TIMEOUT'||status==='VALIDATORS_TIMEOUT'){
  trackTransaction('finality',{hash,method,detail:'GenLayer status: '+status+'. Finality is not yet recorded. Do not resubmit.'});
 }else if(status==='CANCELED'){
  trackTransaction('failure',{hash,method,detail:'GenLayer reports CANCELED. Confirming terminal status before releasing the pending transaction.'});
 }else{
  trackTransaction('consensus',{hash,method,detail:status==='RPC_RETRYING'?
    'Temporarily unable to read network status; continuing verification without resubmitting.':
    'Current GenLayer status: '+status+'. Waiting for finalized execution.'});
 }
}
function walletFeedback(message,tone='warning'){
 const node=$('walletAlert');
 node.hidden=false;
 node.className='wallet-alert is-'+tone;
 node.textContent=message;
}
function condition(name,pass,foot){const row=document.createElement('div');row.className='gate-line';
 const title=document.createElement('span'),status=document.createElement('strong');
 title.textContent=name;status.textContent=pass?'PASS':'BLOCK';status.className=pass?'':'fail';
 if(foot)title.title=foot;row.append(title,status);$('gates').append(row);}
function preview(){let m;try{m=metrics(trial?.plan||previewPlan,trial?.report?.control_users?trial.report:localReport())}
 catch(e){$('gateKpi').textContent='INVALID';setMsg('Local counts invalid: '+e.message);return}
 const report=trial?.report?.control_users?trial.report:localReport();
 $('controlPct').textContent=(m.control_bps/100).toFixed(2)+'%';$('treatmentPct').textContent=(m.treatment_bps/100).toFixed(2)+'%';
 $('controlBar').style.width=Math.min(100,m.control_bps/25)+'%';
 $('treatmentBar').style.width=Math.min(100,m.treatment_bps/25)+'%';
 $('controlCount').textContent=report.control_success.toLocaleString()+' / '+report.control_users.toLocaleString();
 $('treatmentCount').textContent=report.treatment_success.toLocaleString()+' / '+report.treatment_users.toLocaleString();
 const val=m.absolute_lift_bps/100,txt=(val>0?'+':'')+val.toFixed(2)+' pp';
 $('absoluteLift').textContent=txt;$('liftKpi').textContent=txt;
 $('errorRates').textContent=(m.control_errors_bps/100).toFixed(2)+'% → '+(m.treatment_errors_bps/100).toFixed(2)+'%';
 const results=[['Sufficient arm sizes',m.sample_floor_pass],['Minimum absolute uplift',m.uplift_floor_pass],
  ['Approx. 95% two-sided z-test',m.approx_95pct_z_test_pass],['Error-rate safety guardrail',m.error_guardrail_pass]];
 $('gates').replaceChildren();for(const [key,pass] of results)condition(key,pass);
 $('gateKpi').textContent=results.filter(x=>x[1]).length+' / 4';
}
function renderEvidence(){
 const root=$('evidenceInspector');root.replaceChildren();
 const checks=trial?.assessment?.checks;
 if(!Array.isArray(checks)||checks.length===0){
  const empty=document.createElement('p');
  empty.textContent=trial?.status==='REVIEW'?
    'No usable AI citations are attached to this REVIEW. Rollout remains blocked.':
    'Three methodology assessments and their frozen references appear after an accepted GenLayer consensus.';
  root.append(empty);return;
 }
 for(const check of checks){
  const block=document.createElement('article');block.className='citation-block';
  const heading=document.createElement('strong');
  heading.textContent=String(check.criterion||'unknown').replaceAll('_',' ')+' · '+String(check.result||'UNASSESSED');
  const reason=document.createElement('p');reason.textContent=String(check.reason||'No explanation provided.');
  block.append(heading,reason);
  for(const ref of Array.isArray(check.references)?check.references:[]){
    const citation=document.createElement('div');citation.className='literal-citation';
    const name=document.createElement('span');name.textContent=String(ref.ref_id||'unknown')+' / '+String(ref.field||'');
    const quote=document.createElement('p');quote.textContent=String(ref.quote||'');
    citation.append(name,quote);block.append(citation);
  }
  root.append(block);
 }
}

function render(){const live=!!trial;
 $('mode').textContent=live?'LATEST_FINAL · LIVE':'EXAMPLE DATA · NO CHAIN PROOF';
 $('trialStatus').textContent=live?trial.status:'PREVIEW';
 $('aiKpi').textContent=live?trial.assessment?.verdict||'—':'—';
 $('aiDecision').textContent=live?trial.status:'NOT ASSESSED';
 renderEvidence();
 $('aiExplanation').textContent=live&&trial.assessment?.checks?.length?
  trial.assessment.checks.map(c=>c.criterion+':'+c.result).join(' | '):
  (live&&trial.assessment?.format_fallback===true?
    'Technical schema REVIEW. Only the original analyst may retry on V1.1, within the bounded limit.':
    'Illustrative metric math is not GenLayer validator consensus; an accepted live trial must be read back at LATEST_FINAL.');
 $('connect').textContent=actor?short(actor)+' ✓':'Connect wallet ↗';
 $('connect').disabled=busy;
 const gates=actionGates(trial,actor,policy);
 for(const key of ['preregister','report','assess','retry','authorize','close']){
  const lookup={preregister:'register',report:'report',assess:'assess',retry:'retry',authorize:'authorize',close:'close'}[key];
  $(key).disabled=busy||!!pendingTx||!address||!actor||!gates[lookup];
 }
 $('load').disabled=busy||!address;
 $('contract').disabled=busy||!!pendingTx;
 $('trialId').disabled=busy||!!pendingTx;
 $('resume').disabled=busy||!pendingTx;
 showPending();
 preview();
}
async function latest(){address=$('contract').value.trim();if(!addressValid(address))throw Error('Provide your deployed LIFTWATCH contract address.');
 const st=await read(address,'stats');
 if(st.name!=='LIFTWATCH'||!['1.0.0','1.1.0'].includes(st.version)||
    st.rollout!=='NON_EXECUTING_AUTHORIZATION'||
    (st.version==='1.0.0'&&st.citation_mode!=='DETERMINISTIC_REFERENCE_IDS')||
    (st.version==='1.1.0'&&(st.citation_mode!=='CONTRACT_ASSIGNED_LITERAL_REFERENCES'||
      st.retry_policy!=='FORMAT_REVIEW_ONLY'||st.max_assessment_runs!==3)))
  throw Error('Unexpected deployed contract name, version, or policy. Signing is disabled.');
 policy=st;
 const id=number('trialId');
 if(!Number.isSafeInteger(id)||id<=0)throw Error('Use a positive trial ID.');
 if(id>st.trials){trial=null;setMsg('Verified LIFTWATCH contract. Trial #'+id+' not yet created; connect the owner wallet and preregister.');return}
 const value=await read(address,'get_trial',[id]);
 if(value.id!==id||!addressValid(value.plan?.owner)||!addressValid(value.plan?.analyst)||value.plan.owner.toLowerCase()===value.plan.analyst.toLowerCase())throw Error('Invalid trial ownership or identity in readback.');
 trial=value;
 setMsg('LATEST_FINAL VERIFIED\nTrial #'+id+' · '+trial.status+'\nPreregistration commitment: '+trial.plan_sha256+'\nReport commitment: '+(trial.report_sha256||'NOT YET SUBMITTED')+'\nAssessment: '+(trial.assessment?.verdict||'NOT ASSESSED')+'\nOnly accepted consensus and persisted state count.');
}
async function guard(fn,{wallet=false,transaction=false}={}){
 if(busy){if(wallet)walletFeedback('The app is loading on-chain data. Try Connect wallet again after the current read finishes.','warning');return;}
 if(transaction)txWriteAttempted=false;
 busy=true;render();
 try{await fn()}catch(e){
  const message=String(e.message||e);
  setMsg('ACTION BLOCKED / '+message);
  if(wallet)walletFeedback(message+'\nIf you use a wallet inside GenLayer Studio, connect the same address through a browser extension on this website.','error');
  if(transaction&&!pendingTx){
   const rejected=e?.code===4001||/rejected|denied by user|user denied/i.test(message);
   if(txWriteAttempted&&!rejected)trackTransaction('unverified',{
    detail:'NO TRANSACTION HASH RETURNED. Submission is uncertain: '+message+'. Check wallet activity before attempting another write.'});
   else trackTransaction('failure',{detail:rejected?
    'WALLET REJECTED · NOT SUBMITTED. '+message:
    'ACTION BLOCKED BEFORE SUBMISSION. '+message});
  }
 }finally{busy=false;render()}
}
async function sign(method,args){if(!addressValid(address)||!actor)throw Error('Connect wallet and verified contract first.');
 const gates=actionGates(trial,actor,policy),key={preregister:'register',submit_results:'report',assess_trial:'assess',retry_format_review:'retry',authorize_rollout:'authorize',close_trial:'close'}[method];
 if(pendingTx)throw Error('A previously submitted transaction must be verified before signing again. Use Resume verification; never resubmit blindly.');
 if(method!=='preregister'&&!gates[key])throw Error('Your wallet or current finalized state does not authorize '+method);
 trackTransaction('signing',{method,detail:'Preparing the transaction. Review and approve it in the browser wallet; no success is claimed yet.'});
 setMsg('Confirm '+method+' in your wallet. A successful GenVM leader return is not proof of validator acceptance.');
 txWriteAttempted=true;
 const hash=await write(address,actor,method,args);
 txWriteAttempted=false;
 savePending({hash,method,contract:address,signer:actor,trialId:method==='preregister'?null:trial?.id??null});showPending();
 trackTransaction('submitted',{method,hash,detail:'Signed transaction hash saved locally. Waiting for GenLayer execution and consensus.'});
 setMsg('TX SUBMITTED · tracking actual GenLayer consensus and finality\n'+hash+
   '\nDo not sign another write while this transaction is unresolved.');
 await verifyPending();
}
/** Never submit again after a timeout: the hash is persisted until independently verified. */
async function verifyPending(){
 if(!pendingTx)throw Error('No pending transaction to verify.');
 const record=pendingTx;
 showPending();
 trackTransaction('consensus',{method:record.method,hash:record.hash,detail:'Following on-chain progress; this may take several minutes.'});
 setMsg('VERIFYING FINALITY · '+record.method+'\n'+record.hash+
   '\nWaiting for consensus, execution and the durable final state.');
 try{
   let receipt=await waitForFinalized(record.hash,state=>followChainStatus(state,record));
   let check=finalReceipt(receipt);
   if(check.finalized&&(check.execution==='UNKNOWN'||check.consensus==='UNKNOWN')){
     // Studio receipts may expose SUCCESS only in consensus_data.leader_receipt.
     // Fill missing consensus/exec fields via read-only, same-hash RPC sources.
     for(const reader of [getTransactionState,getConsensusReceipt]){
       if(check.execution!=='UNKNOWN'&&check.consensus!=='UNKNOWN')break;
       try{check=combineFinalChecks(check,finalReceipt(await reader(record.hash)));}
       catch(e){
         if(String(e.message||e).startsWith('Conflicting '))throw e;
         // Continue to the next source; never resubmit or claim a false failure.
       }
     }
   }
   if(check.status==='CANCELED'){
     savePending(null);showPending();
     trackTransaction('failure',{method:record.method,hash:record.hash,detail:'GenLayer reported CANCELED. No contract execution success is claimed.'});
     setMsg('CANCELED · TRANSACTION DID NOT COMPLETE\n'+record.hash+'\nInspect Explorer before deciding whether a new action is appropriate.');
     return;
   }
   if(!check.finalized)throw Error('Consensus is not FINALIZED. Check the explorer.');
   trackTransaction('readback',{method:record.method,hash:record.hash,detail:'FINALIZED reached. Verifying execution and the actual LATEST_FINAL contract state.'});
   if(!check.success){
     if(check.execution==='UNKNOWN'||check.consensus==='UNKNOWN')
       throw Error('Final receipt is incomplete. Check Explorer and resume; do not resubmit.');
     savePending(null);showPending();
     trackTransaction('failure',{method:record.method,hash:record.hash,
       detail:'FINALIZED but execution/consensus was not successful: '+check.execution+' / '+check.consensus});
     setMsg('FINALIZED BUT NOT SUCCESSFUL · '+check.execution+' / '+check.consensus+
       '\n'+record.hash+'\nNo success is claimed. Review in Explorer before any new write.');
     return;
   }
   if(record.method==='preregister'){
     const st=await read(address,'stats');
     if(Number.isSafeInteger(st.trials)&&st.trials>0)$('trialId').value=String(st.trials);
   }
   await latest();
   if(record.trialId!=null&&trial.id!==record.trialId)
     throw Error('Loaded trial ID does not match the submitted transaction. No success claimed.');
   if(record.method==='preregister'&&trial.plan?.owner?.toLowerCase()!==record.signer)
     throw Error('The new trial was not owned by the wallet that submitted preregistration.');
   const expected={
     preregister:['REGISTERED','EVIDENCE_LOCKED','REVIEW','HOLD','ELIGIBLE','AUTHORIZED'],
     submit_results:['EVIDENCE_LOCKED','REVIEW','HOLD','ELIGIBLE','AUTHORIZED'],
     assess_trial:['REVIEW','HOLD','ELIGIBLE','AUTHORIZED'],
     retry_format_review:['REVIEW','HOLD','ELIGIBLE','AUTHORIZED'],
     authorize_rollout:['AUTHORIZED'],
     close_trial:['CLOSED']
   };
   if(!trial||!expected[record.method]?.includes(trial.status))
     throw Error('Finalized transaction but current trial state is not the expected result. Read the correct trial ID and retry verification.');
   savePending(null);showPending();
   trackTransaction('success',{method:record.method,hash:record.hash,
     detail:'FINALIZED + FINISHED_WITH_RETURN + '+check.consensus+'. Trial #'+trial.id+' is '+trial.status+' at LATEST_FINAL.'});
   setMsg('VERIFIED · FINALIZED / FINISHED_WITH_RETURN / '+check.consensus+
     '\nTrial #'+trial.id+' · '+trial.status+' (LATEST_FINAL)'+
     '\nTransaction '+record.hash+'\nNo duplicate signature was submitted.');
 }catch(error){
   trackTransaction('unverified',{method:record.method,hash:record.hash,
     detail:'Outcome unverified: '+String(error.message||error)+'. Hash preserved. Use Resume verification; never sign the same write blindly.'});
   setMsg('TRANSACTION HASH PRESERVED · '+record.hash+
     '\nFinality or readback could not be verified yet: '+String(error.message||error)+
     '\nUse Resume verification, or inspect Explorer. Do not blindly resubmit.');
 }
}

$('connect').addEventListener('click',()=>guard(async()=>{
 walletFeedback('Requesting wallet approval… Check the browser extension window.','warning');
 actor=await connectWallet();
 subscribeWalletChanges({
  onAccountsChanged:()=>{
    actor='';
    walletFeedback('Wallet account changed. Reconnect before signing.','warning');
    setMsg('Wallet account changed; signing is locked until reconnection.');render();
  },
  onChainChanged:()=>{
    actor='';
    walletFeedback('Wallet network changed. Reconnect and approve Studionet (61999).','warning');
    setMsg('Network changed; signing is locked until reconnection.');render();
  }
 });
 walletFeedback('Wallet connected: '+short(actor)+' · GenLayer Studionet (61999).','success');
 setMsg('Wallet '+actor+' on Studionet. Verify deployed contract before writing.');
},{wallet:true}));
$('contract').addEventListener('change',()=>{address=$('contract').value.trim();if(addressValid(address))localStorage.setItem('liftwatch_contract',address);trial=null;policy=null;pendingTx=loadPending(address);render()});
$('load').addEventListener('click',()=>guard(latest));
$('resume').addEventListener('click',()=>guard(verifyPending));
$('txTrackerResume').addEventListener('click',()=>guard(verifyPending));
$('preregister').addEventListener('click',()=>guard(async()=>{if(!addressValid(address))throw Error('Deploy the contract in Studio first');
 const p=planInputs();if(!addressValid(p.analyst)||p.analyst.toLowerCase()===actor.toLowerCase())throw Error('Assign a different authorized analyst wallet.');
 await sign('preregister',[p.title,p.hypothesis,p.metric_definition,p.population,p.randomization,p.analyst,p.min_arm,p.min_lift_bps,p.max_error_increase_bps]);
},{transaction:true}));
$('report').addEventListener('click',()=>guard(async()=>{if(!trial)throw Error('Read the preregistered trial first');
 const r=localReport(),note=$('note').value;
 if(note.length<80||note.length>900)throw Error('Methods note requires 80–900 characters');
 const digest=await sha256(note);
 await sign('submit_results',[trial.id,r.control_users,r.control_success,r.treatment_users,r.treatment_success,r.control_errors,r.treatment_errors,note,digest]);
},{transaction:true}));
$('assess').addEventListener('click',()=>guard(()=>sign('assess_trial',[trial.id]),{transaction:true}));
$('retry').addEventListener('click',()=>guard(()=>sign('retry_format_review',[trial.id]),{transaction:true}));
$('authorize').addEventListener('click',()=>guard(()=>sign('authorize_rollout',[trial.id]),{transaction:true}));
$('close').addEventListener('click',()=>guard(async()=>{const reason=window.prompt('Explain why this trial should close (12–300 characters):');
 if(reason===null)return;if(reason.length<12||reason.length>300)throw Error('Explanation must be 12–300 characters');
 await sign('close_trial',[trial.id,reason]);
},{transaction:true}));
async function updateNoteHash(){const text=$('note').value;$('noteHash').textContent=await sha256(text)}
for(const id of ['cUsers','cWins','tUsers','tWins','cErrors','tErrors','minArm','minLift','maxErr'])
 $(id).addEventListener('input',()=>preview());
$('note').addEventListener('input',()=>updateNoteHash().catch(e=>setMsg(e.message)));
render();updateNoteHash().catch(e=>setMsg(e.message));
// Read actual persisted on-chain state on initial load. Never show demo numbers as a live result until verified.
showPending();
if(pendingTx){
 trackTransaction('consensus',{method:pendingTx.method,hash:pendingTx.hash,
  detail:'Unresolved transaction restored from this browser. Resuming read-only confirmation automatically.'});
 guard(verifyPending);
}else{
 guard(latest);
}

