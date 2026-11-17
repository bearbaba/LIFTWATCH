import {addressValid, normalizeRead} from './safety.js';

let sdkPromise;
async function sdk(){
  if(!sdkPromise){
    sdkPromise=Promise.all([
      import('genlayer-stable'),
      import('genlayer-stable/chains'),
      import('genlayer-stable/types'),
    ]).then(([client,chains,types])=>({
      createClient:client.createClient,studionet:chains.studionet,
      TransactionHashVariant:types.TransactionHashVariant,
      TransactionStatus:types.TransactionStatus,
    }));
  }
  try{return await sdkPromise}
  catch(e){sdkPromise=null;throw Error('GenLayer SDK not bundled. Run npm install, then npm run dev or build to enable live contract calls. '+String(e.message||e));}
}
export async function connectWallet(){
  if(!window.ethereum) throw Error('Install a browser wallet to sign GenLayer Studionet transactions.');
  const [actor] = await window.ethereum.request({method:'eth_requestAccounts'});
  if(!addressValid(actor)) throw Error('The wallet did not return a valid account.');
  const hex = await window.ethereum.request({method:'eth_chainId'});
  if(Number.parseInt(hex,16)!==61999) throw Error('Select GenLayer Studionet, chain ID 61999, in your wallet.');
  return actor.toLowerCase();
}
export async function read(address,method,args=[]){
  if(!addressValid(address))throw Error('Enter a verified 0x contract address.');
  const {createClient,studionet,TransactionHashVariant}=await sdk();
  const value=await createClient({chain:studionet}).readContract({address,functionName:method,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
  return normalizeRead(value);
}
export async function write(address,actor,method,args=[]){
  if(!addressValid(address)||!addressValid(actor))throw Error('Missing verified contract or signer.');
  const [current]=await window.ethereum.request({method:'eth_accounts'});
  if(current?.toLowerCase()!==actor.toLowerCase())throw Error('Wallet changed; reconnect before signing.');
  const chainId=Number.parseInt(await window.ethereum.request({method:'eth_chainId'}),16);
  if(chainId!==61999)throw Error('Wrong chain ID: expected 61999.');
  const {createClient,studionet}=await sdk();
  const hash=await createClient({chain:studionet,account:actor,provider:window.ethereum}).writeContract({address,functionName:method,args,value:0n});
  if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Transaction submission returned no valid hash.');
  return hash;
}
/** SDK v1.1.8 API: FINALIZED is more conservative than ACCEPTED.
 * A timeout does NOT mean the write was rejected: the returned hash is durable.
 */
export async function waitForFinalized(hash){
  if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Invalid GenLayer transaction hash');
  const {createClient,studionet,TransactionStatus}=await sdk();
  return createClient({chain:studionet}).waitForTransactionReceipt({
    hash,status:TransactionStatus.FINALIZED,interval:3500,retries:125,fullTransaction:false
  });
}
export async function getTransactionState(hash){
  if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Invalid GenLayer transaction hash');
  const {createClient,studionet}=await sdk();
  return createClient({chain:studionet}).getTransaction({hash});
}

export const explorer=hash=>'https://explorer-studio.genlayer.com/tx/'+encodeURIComponent(hash);
