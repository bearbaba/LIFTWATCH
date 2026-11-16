/** Read-only deployed source and latest-final policy check; no chain writes. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from 'genlayer-stable';
import {studionet} from 'genlayer-stable/chains';
import {TransactionHashVariant} from 'genlayer-stable/types';

const address=process.env.LIFTWATCH_CONTRACT_ADDRESS;
if(!/^0x[a-fA-F0-9]{40}$/.test(address||''))throw Error('Set a valid LIFTWATCH_CONTRACT_ADDRESS');
const source=readFileSync('contracts/liftwatch.py','utf8');
const client=createClient({chain:studionet});
const [deployed,rawStats]=await Promise.all([
  client.getContractCode(address),
  client.readContract({address,functionName:'stats',args:[],transactionHashVariant:TransactionHashVariant.LATEST_FINAL})
]);
const stats=typeof rawStats==='string'?JSON.parse(rawStats):rawStats;
const norm=s=>s.replace(/\r\n/g,'\n').replace(/\n+$/,'');
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const checks={
 source:typeof deployed==='string'&&norm(deployed)===norm(source),
 name:stats?.name==='LIFTWATCH',
 version:stats?.version==='1.0.0',
 citation_mode:stats?.citation_mode==='DETERMINISTIC_REFERENCE_IDS',
 significance:stats?.significance==='pooled_z_two_sided_95pct_approximation',
 rollout:stats?.rollout==='NON_EXECUTING_AUTHORIZATION',
 criteria:JSON.stringify(stats?.criteria)===JSON.stringify(['pre_registration','randomization','measurement']),
 trials:Number.isInteger(stats?.trials)&&stats.trials>=0
};
if(Object.values(checks).some(x=>x!==true))throw Error('Deployed policy or source mismatch: '+JSON.stringify({checks,stats}));
console.log(JSON.stringify({
 verified:true,network:'GenLayer Studionet',chain_id:61999,address,
 deployed_code_sha256:sha(deployed),source_match_after_line_ending_normalization:true,
 finality:'LATEST_FINAL',stats,no_write:true
},null,2));
