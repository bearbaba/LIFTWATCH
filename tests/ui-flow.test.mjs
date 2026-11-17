import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {finalReceipt,normalizePendingTx} from '../web/tx-status.js';
import {addressValid,actionGates,metrics} from '../web/safety.js';

const OWNER='0x'+'a'.repeat(40),ANALYST='0x'+'b'.repeat(40);
const CONTRACT='0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106';
const HASH='0x'+'f'.repeat(64);
const policy={name:'LIFTWATCH',version:'1.1.0',rollout:'NON_EXECUTING_AUTHORIZATION',
  citation_mode:'CONTRACT_ASSIGNED_LITERAL_REFERENCES',retry_policy:'FORMAT_REVIEW_ONLY',
  max_assessment_runs:3,trials:1};
const plan={owner:OWNER,analyst:ANALYST,min_arm:500,min_lift_bps:150,max_error_increase_bps:100};
const data={control_users:2500,control_success:300,treatment_users:2500,treatment_success:400,
  control_errors:22,treatment_errors:24};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function element(){
 return {value:'',textContent:'',innerHTML:'',disabled:false,hidden:true,
  className:'',style:{},classList:{add(){},remove(){},toggle(){}},
  title:'',href:'',handlers:{},children:[],
  addEventListener(name,fn){this.handlers[name]=fn},
  replaceChildren(...nodes){this.children=nodes},
  append(...nodes){this.children.push(...nodes)},
 };
}
function harness({actor=ANALYST,status='REVIEW',formatFallback=true,timeout=false}={}){
 const nodes=new Map(),events={},storage=new Map(),writes=[];
 const initial={title:'Checkout A/B protection',hypothesis:'A'.repeat(50),metricDef:'A'.repeat(50),
  population:'New and returning users in one period.',randomization:'Stable user ID 50/50 split.',
  analyst:ANALYST,trialId:'1',cUsers:'2500',cWins:'300',tUsers:'2500',tWins:'400',
  cErrors:'22',tErrors:'24',minArm:'500',minLift:'150',maxErr:'100',
  note:'Experiment assignment used a persistent user-ID hash with a frozen 50/50 split. All eligible visitors were counted once during the same two-week window; the primary event was completed checkout. Errors were tracked consistently in both arms and no eligibility rule was changed after preregistration.'};
 const $=id=>{if(!nodes.has(id)){const n=element();n.value=initial[id]||'';nodes.set(id,n)}return nodes.get(id)};
 let trial={id:1,status,plan,report:{...data},assessment:{
  verdict:status==='ELIGIBLE'?'PASS':'REVIEW',format_fallback:formatFallback,
  checks:formatFallback?[]:[{criterion:'measurement',result:'REVIEW'}]
 },metrics:{deterministic_gate:true},assessment_runs:1};
 let shouldTimeout=timeout;
 const deps={
  connectWallet:async()=>actor,
  read:async(_address,method)=>method==='stats'?policy:structuredClone(trial),
  write:async(_address,_actor,method,args)=>{writes.push({method,args});
   const newStatus={
    retry_format_review:'ELIGIBLE',authorize_rollout:'AUTHORIZED',
    submit_results:'EVIDENCE_LOCKED',assess_trial:'ELIGIBLE',preregister:'REGISTERED'
   }[method];if(newStatus)trial={...trial,status:newStatus,
    assessment:newStatus==='ELIGIBLE'?{verdict:'PASS',format_fallback:false,checks:[{}]}:trial.assessment};
   return HASH},
  waitForFinalized:async()=>{if(shouldTimeout)throw Error('temporary RPC timeout');
   return {statusName:'FINALIZED',resultName:'MAJORITY_AGREE',txExecutionResultName:'FINISHED_WITH_RETURN'}},
  getTransactionState:async()=>({statusName:'FINALIZED',resultName:'MAJORITY_AGREE',
   txExecutionResultName:'FINISHED_WITH_RETURN'}),
  explorer:hash=>'https://explorer-studio.genlayer.com/tx/'+hash
 };
 const source=readFileSync(new URL('../web/main.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'');
 const prelude=`const {connectWallet,read,write,waitForFinalized,getTransactionState,explorer}=globalThis.deps;
const {finalReceipt,normalizePendingTx}=globalThis.txstatus;
const {addressValid,actionGates,metrics}=globalThis.safety;`;
 runInNewContext(prelude+source,{
  deps,txstatus:{finalReceipt,normalizePendingTx},safety:{addressValid,actionGates,metrics},
  document:{getElementById:$,createElement:element},window:{ethereum:{on:(name,cb)=>events[name]=cb}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
    removeItem:k=>storage.delete(k)},
  crypto:webcrypto,TextEncoder,Number,console
 });
 return {nodes,storage,writes,events,$,get trial(){return trial},
   set timeout(v){shouldTimeout=v},
   async click(id){const fn=$(id).handlers.click;assert.ok(fn,'missing '+id+' click handler');
     fn();await flush();await flush();await flush()}
 };
}

test('FINALIZED and executed with accepted consensus is an actual success',()=>{
 assert.equal(finalReceipt({statusName:'FINALIZED',resultName:'MAJORITY_AGREE',
  txExecutionResultName:'FINISHED_WITH_RETURN'}).success,true);
 assert.equal(finalReceipt({statusName:'FINALIZED',resultName:'MAJORITY_AGREE',
  txExecutionResultName:'FINISHED_WITH_ERROR'}).success,false);
 assert.equal(finalReceipt({statusName:'FINALIZED',resultName:'MAJORITY_DISAGREE',
  txExecutionResultName:'FINISHED_WITH_RETURN'}).success,false);
 assert.equal(finalReceipt({statusName:'ACCEPTED',resultName:'MAJORITY_AGREE',
  txExecutionResultName:'FINISHED_WITH_RETURN'}).success,false);
 assert.equal(finalReceipt({statusName:'FINALIZED',txExecutionResultName:'FINISHED_WITH_RETURN'}).success,false);
});
test('pending transactions must bind to the correct contract, method, and valid hash',()=>{
 const row={hash:HASH,method:'assess_trial',contract:CONTRACT,trialId:1,signer:ANALYST};
 assert.equal(normalizePendingTx(row,CONTRACT)?.hash,HASH);
 assert.equal(normalizePendingTx({...row,contract:OWNER},CONTRACT),null);
 assert.equal(normalizePendingTx({...row,method:'fake_method'},CONTRACT),null);
 assert.equal(normalizePendingTx({...row,hash:'abc'},CONTRACT),null);
 assert.equal(normalizePendingTx({...row,trialId:0},CONTRACT),null);
 assert.equal(normalizePendingTx({...row,signer:null},CONTRACT),null);
});
test('real retry control calls V1.1 method with Analyst and confirms finalized readback',async()=>{
 const h=harness();
 await flush();await h.click('connect');
 assert.equal(h.$('retry').disabled,false);
 await h.click('retry');
 assert.deepEqual(h.writes.map(x=>x.method),['retry_format_review']);
 assert.equal(h.trial.status,'ELIGIBLE');
 assert.equal(h.$('trialStatus').textContent,'ELIGIBLE');
 assert.match(h.$('log').textContent,/VERIFIED · FINALIZED/);
 assert.equal(h.$('resume').disabled,true);
});
test('substantive REVIEW or wrong signer cannot use retry',async()=>{
 const h=harness({status:'REVIEW',formatFallback:false,actor:ANALYST});
 await flush();await h.click('connect');
 assert.equal(h.$('retry').disabled,true);
 const owner=harness({status:'REVIEW',formatFallback:true,actor:OWNER});
 await flush();await owner.click('connect');
 assert.equal(owner.$('retry').disabled,true);
});
test('owner authorizes only eligible trial, finalizes and refreshes on-chain state',async()=>{
 const h=harness({status:'ELIGIBLE',formatFallback:false,actor:OWNER});
 await flush();await h.click('connect');
 assert.equal(h.$('authorize').disabled,false);
 await h.click('authorize');
 assert.equal(h.trial.status,'AUTHORIZED');
 assert.deepEqual(h.writes.map(x=>x.method),['authorize_rollout']);
 assert.equal(h.$('trialStatus').textContent,'AUTHORIZED');
 assert.equal(h.$('resume').disabled,true);
});
test('timeout keeps transaction hash and blocks duplicate signing until verified',async()=>{
 const h=harness({status:'ELIGIBLE',formatFallback:false,actor:OWNER,timeout:true});
 await flush();await h.click('connect');await h.click('authorize');
 assert.equal(h.storage.size,1);
 assert.equal(h.$('authorize').disabled,true);
 assert.equal(h.$('resume').disabled,false);
 assert.match(h.$('log').textContent,/TRANSACTION HASH PRESERVED/);
 assert.equal(h.writes.length,1);
 h.timeout=false;await h.click('resume');
 assert.equal(h.writes.length,1,'must never sign again when resuming');
 assert.equal(h.storage.size,0);
 assert.equal(h.$('trialStatus').textContent,'AUTHORIZED');
});
test('wallet account change revokes signing capabilities in dashboard',async()=>{
 const h=harness({status:'ELIGIBLE',actor:OWNER});
 await flush();await h.click('connect');
 assert.equal(h.$('authorize').disabled,false);
 h.events.accountsChanged(['0x'+'c'.repeat(40)]);
 assert.equal(h.$('authorize').disabled,true);
 assert.match(h.$('log').textContent,/Wallet account changed/);
});

test('accepted AI evidence inspector renders real literal citations as text, not HTML',async()=>{
 const h=harness({status:'ELIGIBLE',formatFallback:false,actor:OWNER});
 await flush();
 h.trial.assessment.checks=[{
   criterion:'measurement',result:'PASS',reason:'The locked conversion endpoint matches the registered metric.',
   references:[{ref_id:'measurement:1',field:'measurement',quote:'Unique completed checkouts per eligible visitor. <script>alert(1)</script>'}]
 }];
 await h.click('load');
 const blocks=h.$('evidenceInspector').children;
 assert.equal(blocks.length,1);
 assert.match(blocks[0].children[0].textContent,/measurement · PASS/);
 assert.match(blocks[0].children[1].textContent,/locked conversion endpoint/);
 const ref=blocks[0].children[2];
 assert.match(ref.children[0].textContent,/measurement:1/);
 assert.match(ref.children[1].textContent,/<script>alert\(1\)<\/script>/);
 assert.equal(ref.children[1].innerHTML,'','must not create script markup from untrusted evidence');
});
