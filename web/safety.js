export const addressValid=x=>typeof x==='string'&&/^0x[a-fA-F0-9]{40}$/.test(x);
export function normalizeRead(x){
  if(typeof x==='string'){try{return JSON.parse(x)}catch{throw Error('Unexpected non-JSON contract read')}}
  if(x&&typeof x==='object')return x;
  throw Error('Unsupported contract read response');
}
export function metrics(plan,report){
  const {control_users:c,treatment_users:t,control_success:cc,treatment_success:tc,control_errors:ce,treatment_errors:te}=report;
  if(![c,t,cc,tc,ce,te].every(Number.isSafeInteger)||c<=0||t<=0||Math.max(c,t)>1000000||Math.min(cc,tc,ce,te)<0||cc>c||tc>t||ce>c||te>t)throw Error('Invalid experiment counts.');
  // BigInt preserves the exact integer comparisons in the Python contract.
  const C=BigInt(c),T=BigInt(t),CC=BigInt(cc),TC=BigInt(tc),CE=BigInt(ce),TE=BigInt(te);
  const diff=TC*C-CC*T;
  const total=CC+TC,N=C+T;
  const normalValid=total>0n&&total<N&&total*C>=5n*N&&total*T>=5n*N&&
    (N-total)*C>=5n*N&&(N-total)*T>=5n*N;
  const zPass=normalValid&&diff>0n&&diff*diff*N*10000n>=38416n*C*T*total*(N-total);
  const liftPass=diff>0n&&diff*10000n>=BigInt(plan.min_lift_bps)*C*T;
  const guardPass=(TE*C-CE*T)*10000n<=BigInt(plan.max_error_increase_bps)*C*T;
  const samplePass=c>=plan.min_arm&&t>=plan.min_arm;
  return {control_bps:Number(CC*10000n/C),treatment_bps:Number(TC*10000n/T),
    absolute_lift_bps:Number(TC*10000n/T-CC*10000n/C),
    control_errors_bps:Number(CE*10000n/C),treatment_errors_bps:Number(TE*10000n/T),
    sample_floor_pass:samplePass,uplift_floor_pass:liftPass,
    normal_approx_valid:normalValid,approx_95pct_z_test_pass:zPass,error_guardrail_pass:guardPass,
    deterministic_gate:samplePass&&liftPass&&zPass&&guardPass};
}
export function actionGates(trial,actor,policy=null){
  const s=actor?.toLowerCase(),p=trial?.plan||{};
  return {
    register:addressValid(actor),
    report:trial?.status==='REGISTERED'&&s===p.analyst?.toLowerCase(),
    assess:trial?.status==='EVIDENCE_LOCKED'&&s===p.analyst?.toLowerCase(),
    retry:policy?.version==='1.1.0'&&trial?.status==='REVIEW'&&
      trial?.assessment?.format_fallback===true&&trial?.metrics?.deterministic_gate===true&&
      Number.isInteger(trial?.assessment_runs)&&trial.assessment_runs>0&&
      trial.assessment_runs<policy.max_assessment_runs&&s===p.analyst?.toLowerCase(),
    authorize:trial?.status==='ELIGIBLE'&&trial?.assessment?.verdict==='PASS'&&trial?.metrics?.deterministic_gate===true&&s===p.owner?.toLowerCase(),
    close:['ELIGIBLE','HOLD','REVIEW'].includes(trial?.status)&&s===p.owner?.toLowerCase()
  };
}
export function classifyTransaction(tx){
  const status=String(tx?.status||tx?.state||'').toUpperCase();
  const consensus=String(tx?.consensus_result||tx?.consensusResult||tx?.consensus||'').toUpperCase();
  const final=status==='FINALIZED',agreed=['ACCEPTED','MAJORITYAGREE'].includes(consensus);
  return {status,consensus,accepted:final&&agreed,final};
}
