/** Strict, SDK v1.1.8-compatible GenLayer finality gate (no signing or network). */
const hashPattern=/^0x[a-fA-F0-9]{64}$/;
const addressPattern=/^0x[a-fA-F0-9]{40}$/;
export function validTxHash(value){return hashPattern.test(value||'')}
export function finalReceipt(receipt){
  if(!receipt||typeof receipt!=='object')
    return {finalized:false,success:false,status:'UNKNOWN',execution:'UNKNOWN',consensus:'UNKNOWN'};
  const rawStatus=receipt.statusName??receipt.status_name??receipt.status;
  const status=rawStatus===7||String(rawStatus)==='7'?'FINALIZED':String(rawStatus||'UNKNOWN').toUpperCase();
  const rawExec=receipt.txExecutionResultName??receipt.tx_execution_result_name??
    receipt.executionResultName??receipt.txExecutionResult;
  const execution=rawExec===1||String(rawExec)==='1'?'FINISHED_WITH_RETURN':
    rawExec===2||String(rawExec)==='2'?'FINISHED_WITH_ERROR':
    String(rawExec||'UNKNOWN').toUpperCase();
  const rawConsensus=receipt.resultName??receipt.consensusResult??receipt.consensus_result??receipt.result;
  const consensus=rawConsensus===6||String(rawConsensus)==='6'?'MAJORITY_AGREE':
    rawConsensus===7||String(rawConsensus)==='7'?'MAJORITY_DISAGREE':
    String(rawConsensus??'UNKNOWN').toUpperCase();
  const finalized=status==='FINALIZED';
  const success=finalized&&execution==='FINISHED_WITH_RETURN'&&
    (consensus==='MAJORITY_AGREE'||consensus==='ACCEPTED'||consensus==='AGREE');
  return {finalized,success,status,execution,consensus};
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
