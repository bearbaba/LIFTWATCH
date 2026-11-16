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
 trialVerification={id:t.id,status:t.status,owner:p.owner,analyst:p.analyst,plan_sha256:t.plan_sha256,checks};
}

console.log(JSON.stringify({
 verified:true,address,network:'GenLayer Studionet',chain_id:61999,
 source_sha256:createHash('sha256').update(deployed,'utf8').digest('hex'),
 source_match_after_line_endings:true,finality:'LATEST_FINAL',stats,trialVerification,no_write:true
},null,2));
