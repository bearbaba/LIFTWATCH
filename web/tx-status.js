/** Strict, SDK v1.1.8-compatible GenLayer finality gate (no signing or network). */
const hashPattern=/^0x[a-fA-F0-9]{64}$/;
const addressPattern=/^0x[a-fA-F0-9]{40}$/;
export function validTxHash(value){return hashPattern.test(value||'')}
/* Normalize flat consensus receipts and SDK v1.1.8 Studio nested execution. */
const key=v=>String(v??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
const named=(kind,raw)=>{
 const k=key(raw);
 const opts={
  status:{'7':'FINALIZED','8':'CANCELED','FINALIZED':'FINALIZED','CANCELED':'CANCELED',
   '5':'ACCEPTED','ACCEPTED':'ACCEPTED'},
  execution:{'1':'FINISHED_WITH_RETURN','2':'FINISHED_WITH_ERROR',
   'FINISHEDWITHRETURN':'FINISHED_WITH_RETURN','RETURN':'FINISHED_WITH_RETURN',
   'SUCCESS':'FINISHED_WITH_RETURN','FINISHEDWITHERROR':'FINISHED_WITH_ERROR',
   'ERROR':'FINISHED_WITH_ERROR','0':'NOT_VOTED','NOTVOTED':'NOT_VOTED'},
  consensus:{'1':'MAJORITY_AGREE','6':'MAJORITY_AGREE','2':'MAJORITY_DISAGREE',
   '7':'MAJORITY_DISAGREE','AGREE':'MAJORITY_AGREE','MAJORITYAGREE':'MAJORITY_AGREE',
   'ACCEPTED':'MAJORITY_AGREE','DISAGREE':'MAJORITY_DISAGREE',
   'MAJORITYDISAGREE':'MAJORITY_DISAGREE','3':'TIMEOUT',
   'TIMEOUT':'TIMEOUT','4':'DETERMINISTIC_VIOLATION',
   'DETERMINISTICVIOLATION':'DETERMINISTIC_VIOLATION','5':'NO_MAJORITY',
   'NOMAJORITY':'NO_MAJORITY'}
 };
 return opts[kind][k]??(k?String(raw).toUpperCase():'UNKNOWN');
};
const isSuccess=(finalized,execution,consensus)=>finalized&&
 execution==='FINISHED_WITH_RETURN'&&consensus==='MAJORITY_AGREE';
export function finalReceipt(receipt){
 if(!receipt||typeof receipt!=='object')
  return {finalized:false,success:false,status:'UNKNOWN',execution:'UNKNOWN',consensus:'UNKNOWN'};
 const studio=receipt.consensus_data?.leader_receipt;
 const leader=Array.isArray(studio)?studio[studio.length-1]:studio;
 const status=named('status',receipt.statusName??receipt.status_name??receipt.status);
 const execution=named('execution',receipt.txExecutionResultName??receipt.tx_execution_result_name??
  receipt.executionResultName??receipt.txExecutionResult??leader?.execution_result);
 const consensus=named('consensus',receipt.resultName??receipt.result_name??
  receipt.consensusResult??receipt.consensus_result??receipt.result);
 const finalized=status==='FINALIZED';
 return {finalized,success:isSuccess(finalized,execution,consensus),status,execution,consensus};
}
/* Combine read-only receipts only after each source separately confirms FINALIZED.
   Conflicting explicit fields must never be treated as a success. */
export function combineFinalChecks(a,b){
 if(!a?.finalized||!b?.finalized)return a;
 const pick=k=>{
  if(a[k]!=='UNKNOWN'&&b[k]!=='UNKNOWN'&&a[k]!==b[k])
   throw Error('Conflicting '+k+' across on-chain receipt sources. No success claimed.');
  return a[k]==='UNKNOWN'?b[k]:a[k];
 };
 const execution=pick('execution'),consensus=pick('consensus');
 return {finalized:true,status:'FINALIZED',execution,consensus,
  success:isSuccess(true,execution,consensus)};
}
export function normalizePendingTx(value,address){
  if(!value||typeof value!=='object'||!addressPattern.test(address||'')||
    !validTxHash(value.hash)||typeof value.method!=='string'||
    !['preregister','submit_results','assess_trial','retry_format_review',
      'authorize_rollout','close_trial'].includes(value.method)||
    typeof value.contract!=='string'||value.contract.toLowerCase()!==address.toLowerCase())
    return null;
  const trialId=value.trialId;
  const signer=value.signer;
  if(trialId!=null&&(!Number.isSafeInteger(trialId)||trialId<=0))return null;
  if(typeof signer!=='string'||!addressPattern.test(signer))return null;
  return {hash:value.hash,method:value.method,contract:address,trialId:trialId??null,signer:signer.toLowerCase()};
}
