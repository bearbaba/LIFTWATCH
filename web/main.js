import {connectWallet,read,write,explorer} from './chain.js';
import {addressValid,actionGates,metrics} from './safety.js';
const $=id=>document.getElementById(id);
const previewPlan={min_arm:500,min_lift_bps:150,max_error_increase_bps:100};
let actor='',address=localStorage.getItem('liftwatch_contract')||'',trial=null,busy=false;
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
function render(){const live=!!trial;
 $('mode').textContent=live?'LATEST_FINAL · LIVE':'EXAMPLE DATA · NO CHAIN PROOF';
 $('trialStatus').textContent=live?trial.status:'PREVIEW';
 $('aiKpi').textContent=live?trial.assessment?.verdict||'—':'—';
 $('aiDecision').textContent=live?trial.status:'NOT ASSESSED';
 $('aiExplanation').textContent=live&&trial.assessment?.checks?.length?
  trial.assessment.checks.map(c=>c.criterion+':'+c.result).join(' | '):
  'Illustrative metric math is not GenLayer validator consensus; an accepted live trial must be read back at LATEST_FINAL.';
 $('connect').textContent=actor?short(actor)+' ✓':'Connect wallet ↗';
 const gates=actionGates(trial,actor);
 for(const key of ['preregister','report','assess','authorize','close']){
  const lookup={preregister:'register',report:'report',assess:'assess',authorize:'authorize',close:'close'}[key];
  $(key).disabled=busy||!address||!actor||!gates[lookup];
 }
 $('load').disabled=busy||!address;
 preview();
}
async function latest(){address=$('contract').value.trim();if(!addressValid(address))throw Error('Provide your deployed LIFTWATCH contract address.');
 const st=await read(address,'stats');
 if(st.name!=='LIFTWATCH'||st.version!=='1.0.0'||st.citation_mode!=='DETERMINISTIC_REFERENCE_IDS'||st.rollout!=='NON_EXECUTING_AUTHORIZATION')
  throw Error('Unexpected deployed contract name, version, or policy. Signing is disabled.');
 const id=number('trialId');
 if(!Number.isSafeInteger(id)||id<=0)throw Error('Use a positive trial ID.');
 if(id>st.trials){trial=null;setMsg('Verified LIFTWATCH contract. Trial #'+id+' not yet created; connect the owner wallet and preregister.');return}
 const value=await read(address,'get_trial',[id]);
 if(value.id!==id||!addressValid(value.plan?.owner)||!addressValid(value.plan?.analyst)||value.plan.owner.toLowerCase()===value.plan.analyst.toLowerCase())throw Error('Invalid trial ownership or identity in readback.');
 trial=value;
 setMsg('LATEST_FINAL VERIFIED\nTrial #'+id+' · '+trial.status+'\nPreregistration commitment: '+trial.plan_sha256+'\nReport commitment: '+(trial.report_sha256||'NOT YET SUBMITTED')+'\nAssessment: '+(trial.assessment?.verdict||'NOT ASSESSED')+'\nOnly accepted consensus and persisted state count.');
}
async function guard(fn){if(busy)return;busy=true;render();try{await fn()}catch(e){setMsg('ACTION BLOCKED / '+String(e.message||e))}finally{busy=false;render()}}
async function sign(method,args){if(!addressValid(address)||!actor)throw Error('Connect wallet and verified contract first.');
 const gates=actionGates(trial,actor),key={preregister:'register',submit_results:'report',assess_trial:'assess',authorize_rollout:'authorize',close_trial:'close'}[method];
 if(method!=='preregister'&&!gates[key])throw Error('Your wallet or current finalized state does not authorize '+method);
 setMsg('Confirm '+method+' in your wallet. A successful GenVM leader return is not proof of validator acceptance.');
 const hash=await write(address,actor,method,args);
 $('txBox').hidden=false;$('txLink').href=explorer(hash);
 setMsg('TX SUBMITTED · NOT YET FINALIZED\n'+hash+'\nCheck validator consensus on Explorer, then select Read LATEST_FINAL. Do not claim ELIGIBLE/AUTHORIZED until committed.');
}
$('connect').addEventListener('click',()=>guard(async()=>{actor=await connectWallet();setMsg('Wallet '+actor+' on Studionet. Verify deployed contract before writing.');}));
$('contract').addEventListener('change',()=>{address=$('contract').value.trim();if(addressValid(address))localStorage.setItem('liftwatch_contract',address);trial=null;render()});
$('load').addEventListener('click',()=>guard(latest));
$('preregister').addEventListener('click',()=>guard(async()=>{if(!addressValid(address))throw Error('Deploy the contract in Studio first');
 const p=planInputs();if(!addressValid(p.analyst)||p.analyst.toLowerCase()===actor.toLowerCase())throw Error('Assign a different authorized analyst wallet.');
 await sign('preregister',[p.title,p.hypothesis,p.metric_definition,p.population,p.randomization,p.analyst,p.min_arm,p.min_lift_bps,p.max_error_increase_bps]);
}));
$('report').addEventListener('click',()=>guard(async()=>{if(!trial)throw Error('Read the preregistered trial first');
 const r=localReport(),note=$('note').value;
 if(note.length<80||note.length>900)throw Error('Methods note requires 80–900 characters');
 const digest=await sha256(note);
 await sign('submit_results',[trial.id,r.control_users,r.control_success,r.treatment_users,r.treatment_success,r.control_errors,r.treatment_errors,note,digest]);
}));
$('assess').addEventListener('click',()=>guard(()=>sign('assess_trial',[trial.id])));
$('authorize').addEventListener('click',()=>guard(()=>sign('authorize_rollout',[trial.id])));
$('close').addEventListener('click',()=>guard(async()=>{const reason=window.prompt('Explain why this trial should close (12–300 characters):');
 if(reason===null)return;if(reason.length<12||reason.length>300)throw Error('Explanation must be 12–300 characters');
 await sign('close_trial',[trial.id,reason]);
}));
async function updateNoteHash(){const text=$('note').value;$('noteHash').textContent=await sha256(text)}
for(const id of ['cUsers','cWins','tUsers','tWins','cErrors','tErrors','minArm','minLift','maxErr'])
 $(id).addEventListener('input',()=>preview());
$('note').addEventListener('input',()=>updateNoteHash().catch(e=>setMsg(e.message)));
render();updateNoteHash().catch(e=>setMsg(e.message));
