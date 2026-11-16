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

/** Check finalized trial evidence without inventing or publishing any transaction proof. */
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
  Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):x;
const canonical=x=>JSON.stringify(stable(x));
const parse=x=>typeof x==='string'?JSON.parse(x):x;
let trialVerification=null;
if(stats.trials>=1){
  const trial=parse(await client.readContract({address,functionName:'get_trial',args:[1],
    transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));
  const plan=trial.plan,report=trial.report;
  const trialChecks={
    trial_id:trial.id===1,
    owner:/^0x[a-f0-9]{40}$/.test(plan?.owner||''),
    analyst:/^0x[a-f0-9]{40}$/.test(plan?.analyst||'')&&plan.owner!==plan.analyst,
    plan_commitment:trial.plan_sha256===sha(canonical(plan)),
    legitimate_state:['REGISTERED','EVIDENCE_LOCKED','ELIGIBLE','HOLD','REVIEW','AUTHORIZED','CLOSED'].includes(trial.status)
  };
  let math=null;
  if(trial.status!=='REGISTERED'){
    const fields=['control_users','control_success','treatment_users','treatment_success','control_errors','treatment_errors'];
    const c=report.control_users,t=report.treatment_users,cc=report.control_success,tc=report.treatment_success,ce=report.control_errors,te=report.treatment_errors;
    trialChecks.report_counts=fields.every(k=>Number.isSafeInteger(report[k]))&&
      c>0&&t>0&&cc>=0&&cc<=c&&tc>=0&&tc<=t&&ce>=0&&ce<=c&&te>=0&&te<=t;
    trialChecks.note_commitment=typeof report.methods_note==='string'&&
      sha(report.methods_note)===report.methods_sha256;
    trialChecks.report_commitment=sha(canonical(report))===trial.report_sha256;
    if(trialChecks.report_counts){
      const C=BigInt(c),T=BigInt(t),CC=BigInt(cc),TC=BigInt(tc),CE=BigInt(ce),TE=BigInt(te);
      const n=C+T,success=CC+TC,delta=TC*C-CC*T;
      const normal=success>0n&&success<n&&
        success*C>=5n*n&&success*T>=5n*n&&
        (n-success)*C>=5n*n&&(n-success)*T>=5n*n;
      math={
        control_bps:Number(CC*10000n/C),treatment_bps:Number(TC*10000n/T),
        absolute_lift_bps:Number(TC*10000n/T)-Number(CC*10000n/C),
        control_errors_bps:Number(CE*10000n/C),treatment_errors_bps:Number(TE*10000n/T),
        sample_floor_pass:c>=plan.min_arm&&t>=plan.min_arm,
        uplift_floor_pass:delta>0n&&delta*10000n>=BigInt(plan.min_lift_bps)*C*T,
        normal_approx_valid:normal,
        approx_95pct_z_test_pass:normal&&delta>0n&&
          delta*delta*n*10000n>=38416n*C*T*success*(n-success),
        error_guardrail_pass:(TE*C-CE*T)*10000n<=BigInt(plan.max_error_increase_bps)*C*T,
        statistical_method:'pooled_two_proportion_z_approximation_two_sided_95pct'
      };
      math.deterministic_gate=math.sample_floor_pass&&math.uplift_floor_pass&&
        math.approx_95pct_z_test_pass&&math.error_guardrail_pass;
      trialChecks.deterministic_math=Object.entries(math).every(([key,value])=>trial.metrics?.[key]===value);
    }
  }
  if(trial.status==='REVIEW'){
    const assessment=trial.assessment||{};
    trialChecks.fail_closed_review=assessment.verdict==='REVIEW'&&
      Array.isArray(assessment.checks)&&assessment.checks.length===0&&
      assessment.reason==='Methodology verdict format or citation IDs could not be verified.';
  }
  if(Object.values(trialChecks).some(v=>v!==true))throw Error('LATEST_FINAL trial verification failure: '+JSON.stringify({trialChecks,status:trial.status}));
  trialVerification={id:trial.id,status:trial.status,owner:plan.owner,analyst:plan.analyst,
    plan_sha256:trial.plan_sha256,report_sha256:trial.report_sha256||null,
    methods_sha256:report?.methods_sha256||null,
    assessment:trial.assessment||null,metrics:math,checks:trialChecks};
}

console.log(JSON.stringify({
 verified:true,network:'GenLayer Studionet',chain_id:61999,address,
 deployed_code_sha256:sha(deployed),source_match_after_line_ending_normalization:true,
 finality:'LATEST_FINAL',stats,trialVerification,no_write:true
},null,2));
