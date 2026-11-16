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
console.log(JSON.stringify({
 verified:true,address,network:'GenLayer Studionet',chain_id:61999,
 source_sha256:createHash('sha256').update(deployed,'utf8').digest('hex'),
 source_match_after_line_endings:true,finality:'LATEST_FINAL',stats,no_write:true
},null,2));
