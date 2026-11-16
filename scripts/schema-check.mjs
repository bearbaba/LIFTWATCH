import {readFileSync} from 'node:fs';
import {createClient} from 'genlayer-stable';
import {studionet} from 'genlayer-stable/chains';
const isCanon=JSON.parse(readFileSync('package.json','utf8')).name==='canonatlas';
const path=isCanon?'contracts/canon_atlas.py':'contracts/liftwatch.py';
const expected=isCanon?['create_world','propose_entry','assess_entry','ratify_entry','decline_entry','get_world','get_entry','get_reference_bank','stats']:
 ['preregister','submit_results','assess_trial','authorize_rollout','close_trial','get_trial','get_reference_bank','stats'];
const source=readFileSync(path,'utf8');
if(!source.startsWith('# { "Depends": "py-genlayer:'))throw Error('Missing pinned GenLayer runtime');
const schema=await createClient({chain:studionet}).getContractSchemaForCode(source);
for(const method of expected)if(!Object.hasOwn(schema.methods||{},method))throw Error('ABI missing '+method);
console.log(JSON.stringify({ok:true,path,methods:expected,constructor:schema.ctor},null,2));
