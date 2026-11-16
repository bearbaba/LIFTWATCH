/** Independent read-only Studionet V1.1 deployment attestation. No transaction signing. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from 'genlayer-stable';
import {studionet} from 'genlayer-stable/chains';
import {TransactionHashVariant} from 'genlayer-stable/types';

const address=process.env.LIFTWATCH_V11_ADDRESS;
if(!/^0x[a-fA-F0-9]{40}$/.test(address||''))throw Error('Invalid LIFTWATCH_V11_ADDRESS');
const client=createClient({chain:studionet});
const [deployed,raw]=await Promise.all([
 client.getContractCode(address),
 client.readContract({address,functionName:'stats',args:[],
  transactionHashVariant:TransactionHashVariant.LATEST_FINAL})
]);
const stats=typeof raw==='string'?JSON.parse(raw):raw;
const source=readFileSync('contracts/liftwatch_v11.py','utf8');
const normalize=x=>x.replace(/\r\n/g,'\n').replace(/\n+$/,'');
const checks={
 source:typeof deployed==='string'&&normalize(deployed)===normalize(source),
 name:stats?.name==='LIFTWATCH',
 version:stats?.version==='1.1.0',
 trial_count:Number.isInteger(stats?.trials)&&stats.trials>=0,
 citation_mode:stats?.citation_mode==='CONTRACT_ASSIGNED_LITERAL_REFERENCES',
 retry:stats?.retry_policy==='FORMAT_REVIEW_ONLY'&&stats?.max_assessment_runs===3,
 rollout:stats?.rollout==='NON_EXECUTING_AUTHORIZATION',
 math:stats?.significance==='pooled_z_two_sided_95pct_approximation',
 criteria:JSON.stringify(stats?.criteria)===JSON.stringify(['pre_registration','randomization','measurement'])
};
if(Object.values(checks).some(v=>v!==true))throw Error('On-chain V1.1 policy/source mismatch '+JSON.stringify({checks,stats}));

const parse=x=>typeof x==='string'?JSON.parse(x):x;
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
  Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):x;
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
let trialVerification=null;
if(stats.trials>0){
 const t=parse(await client.readContract({address,functionName:'get_trial',args:[1],
   transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));
 const p=t.plan;
 const checks={
  trial_id:t.id===1,
  exact_owner:p?.owner==='0x4c7cb73ac8f8999af21cfc9ff4cf2333a9508dcb',
  exact_analyst:p?.analyst==='0xd6b8a3a5eb329410d9504784812b8569afa8c2af',
  distinct_roles:p?.owner!==p?.analyst,
  title:p?.title==='Checkout A/B protection',
  metrics:p?.min_arm===500&&p?.min_lift_bps===150&&p?.max_error_increase_bps===100,
  plan_commitment:t.plan_sha256===sha(JSON.stringify(stable(p))),
  status_is_valid:['REGISTERED','EVIDENCE_LOCKED','ELIGIBLE','REVIEW','HOLD','AUTHORIZED','CLOSED'].includes(t.status)
 };
 if(Object.values(checks).some(v=>v!==true))throw Error('Unexpected LATEST_FINAL trial data '+JSON.stringify({checks,status:t.status}));
 const r=t.report||{},m=t.metrics||{};
 let reportVerification=null;
 if(t.status!=='REGISTERED'){
  const expected={control_users:2500,control_success:300,treatment_users:2500,treatment_success:400,control_errors:22,treatment_errors:24};
  const expectedNote='Experiment assignment used a persistent user-ID hash with a frozen 50/50 split. All eligible visitors were counted once during the same two-week window; the primary event was completed checkout. Errors were tracked consistently in both arms and no eligibility rule was changed after preregistration.';
  const reportChecks={
   exact_counts:Object.entries(expected).every(([k,v])=>r[k]===v),
   exact_note:r.methods_note===expectedNote,
   method_sha:r.methods_sha256===sha(r.methods_note),
   report_sha:t.report_sha256===sha(JSON.stringify(stable(r))),
   normal_approx_valid:m.normal_approx_valid===true,
   sample_floor_pass:m.sample_floor_pass===true,
   uplift_floor_pass:m.uplift_floor_pass===true,
   significance_95:m.approx_95pct_z_test_pass===true,
   error_guardrail:m.error_guardrail_pass===true,
   deterministic_gate:m.deterministic_gate===true,
   exact_rates:m.control_bps===1200&&m.treatment_bps===1600&&m.absolute_lift_bps===400&&
      m.control_errors_bps===88&&m.treatment_errors_bps===96
  };
  if(Object.values(reportChecks).some(v=>v!==true))throw Error('Committed LIFTWATCH report mismatch '+JSON.stringify({reportChecks,report:r,metrics:m}));
  reportVerification={report_sha256:t.report_sha256,methods_sha256:r.methods_sha256,metrics:m,checks:reportChecks};
 }
 let assessmentVerification=null;
 if(['ELIGIBLE','AUTHORIZED','HOLD','REVIEW','CLOSED'].includes(t.status) && t.assessment?.verdict){
  const a=t.assessment;
  const fields={hypothesis:p.hypothesis,randomization:p.randomization,
    measurement:p.metric_definition,notes:r.methods_note,population:p.population,
    math:JSON.stringify(stable(m))};
  const referenceBank={};
  for(const [field,value] of Object.entries(fields)){
   const parts=value.match(/[\\s\\S]{1,220}/g)||[];
   if(parts.length>1&&parts[parts.length-1].length<8)parts[parts.length-2]+=parts.pop();
   parts.slice(0,6).forEach((quote,i)=>{if(quote.length>=8&&quote.length<=240)referenceBank[field+':'+(i+1)]={field,quote}});
  }
  const seen=new Set(),required={
   pre_registration:'hypothesis',randomization:'randomization',measurement:'measurement'};
  const consistentChecks=Array.isArray(a.checks)&&a.checks.length===3&&a.checks.every(c=>{
   if(!Object.hasOwn(required,c.criterion)||seen.has(c.criterion)||c.result!=='PASS'||typeof c.reason!=='string'||c.reason.length<12)return false;
   seen.add(c.criterion);
   const refs=c.references;
   if(!Array.isArray(refs)||refs.length<2||refs.length>4)return false;
   const ids=new Set(),categories=new Set();
   for(const item of refs){
    const original=referenceBank[item.ref_id];
    if(!original||original.field!==item.field||original.quote!==item.quote||ids.has(item.ref_id))return false;
    ids.add(item.ref_id);categories.add(item.field);
   }
   return categories.has('notes')&&categories.has(required[c.criterion]);
  });
  const history=Array.isArray(t.assessment_history)?t.assessment_history:[];
  const assessmentChecks={
   consensus_pass:a.verdict==='PASS'&&a.format_fallback===false,
   three_criteria_exact_citations:consistentChecks,
   assessment_runs:t.assessment_runs===1&&history.length===1,
   accepted_pass_history:history[0]?.verdict==='PASS'&&history[0]?.decision==='ELIGIBLE'&&
      history[0]?.format_fallback===false,
   history_sha256:history[0]?.assessment_sha256===sha(JSON.stringify(stable(a))),
   current_state:['ELIGIBLE','AUTHORIZED'].includes(t.status)
  };
  if(Object.values(assessmentChecks).some(v=>v!==true))throw Error('Independent AI assessment verification failed '+JSON.stringify({assessmentChecks,verdict:a.verdict,status:t.status}));
  assessmentVerification={verdict:a.verdict,status:t.status,assessment_runs:t.assessment_runs,
    criteria:a.checks.map(x=>x.criterion+':'+x.result),checks:assessmentChecks};
 }
 trialVerification={id:t.id,status:t.status,owner:p.owner,analyst:p.analyst,plan_sha256:t.plan_sha256,checks,reportVerification,assessmentVerification};
}

console.log(JSON.stringify({
 verified:true,address,network:'GenLayer Studionet',chain_id:61999,
 source_sha256:createHash('sha256').update(deployed,'utf8').digest('hex'),
 source_match_after_line_endings:true,finality:'LATEST_FINAL',stats,trialVerification,no_write:true
},null,2));
