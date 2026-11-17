import {readFileSync} from 'node:fs';
import {createClient} from 'genlayer-stable';
import {studionet} from 'genlayer-stable/chains';
import {TransactionStatus} from 'genlayer-stable/types';

const isCanon=JSON.parse(readFileSync('package.json','utf8')).name==='canonatlas';
const path=isCanon?'contracts/canon_atlas.py':'contracts/liftwatch.py';
const expected=isCanon?['create_world','propose_entry','assess_entry','ratify_entry','decline_entry','get_world','get_entry','get_reference_bank','stats']:
 ['preregister','submit_results','assess_trial','authorize_rollout','close_trial','get_trial','get_reference_bank','stats'];
const source=readFileSync(path,'utf8');
if(!source.startsWith('# { "Depends": "py-genlayer:'))throw Error('Missing pinned GenLayer runtime');
const schema=await createClient({chain:studionet}).getContractSchemaForCode(source);
for(const method of expected)if(!Object.hasOwn(schema.methods||{},method))throw Error('ABI missing '+method);
console.log(JSON.stringify({ok:true,path,methods:expected,constructor:schema.ctor},null,2));

// V1.1 candidate is separate and has a deliberately explicit format-only retry.
const candidate='contracts/liftwatch_v11.py';
const v11=readFileSync(candidate,'utf8');
const schemaV11=await createClient({chain:studionet}).getContractSchemaForCode(v11);
for(const name of ['preregister','submit_results','assess_trial','retry_format_review',
                   'authorize_rollout','close_trial','get_trial','get_reference_bank','stats']){
  if(!Object.hasOwn(schemaV11.methods||{},name))throw Error('V1.1 ABI missing '+name);
}
console.log(JSON.stringify({ok:true,path:candidate,version:'1.1.0',
  methods:Object.keys(schemaV11.methods||{}),constructor:schemaV11.ctor},null,2));

// The pinned SDK (genlayer-js 1.1.8) must actually implement the finality API
// used by the browser. Newer SDK docs use waitForFinalization, but v1.1.8
// exposes waitForTransactionReceipt({hash,status: FINALIZED}) instead.
const readClient=createClient({chain:studionet});
if(typeof readClient.waitForTransactionReceipt!=='function'||
   typeof readClient.getTransaction!=='function'||
   TransactionStatus.FINALIZED!=='FINALIZED'){
  throw Error('Pinned GenLayerJS 1.1.8 cannot verify FINALIZED execution receipts');
}
console.log('SDK wallet lifecycle API: waitForTransactionReceipt / FINALIZED / getTransaction VERIFIED');
