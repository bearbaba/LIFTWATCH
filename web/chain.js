import {addressValid, normalizeRead} from './safety.js';
import {authorizeWallet} from './wallet-provider.js';

let connectedProvider=null;
let stopWalletListeners=null;

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
  const {provider,address}=await authorizeWallet(window);
  if(!addressValid(address))throw Error('The wallet did not return a valid account.');
  connectedProvider=provider;
  return address;
}
export function subscribeWalletChanges({onAccountsChanged,onChainChanged}){
  if(stopWalletListeners)stopWalletListeners();
  const provider=connectedProvider;
  if(!provider||typeof provider.on!=='function')return ()=>{};
  provider.on('accountsChanged',onAccountsChanged);
  provider.on('chainChanged',onChainChanged);
  const stop=()=>{
    if(typeof provider.removeListener==='function'){
      provider.removeListener('accountsChanged',onAccountsChanged);
      provider.removeListener('chainChanged',onChainChanged);
    }
  };
  stopWalletListeners=stop;
  return stop;
}
export async function read(address,method,args=[]){
  if(!addressValid(address))throw Error('Enter a verified 0x contract address.');
  const {createClient,studionet,TransactionHashVariant}=await sdk();
  const value=await createClient({chain:studionet}).readContract({address,functionName:method,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
  return normalizeRead(value);
}
export async function write(address,actor,method,args=[]){
  if(!addressValid(address)||!addressValid(actor))throw Error('Missing verified contract or signer.');
  if(!connectedProvider)throw Error('Connect an authorized browser wallet before signing.');
  const [current]=await connectedProvider.request({method:'eth_accounts'});
  if(current?.toLowerCase()!==actor.toLowerCase())throw Error('Wallet changed; reconnect before signing.');
  const chainId=Number.parseInt(await connectedProvider.request({method:'eth_chainId'}),16);
  if(chainId!==61999)throw Error('Wrong chain ID: expected 61999.');
  const {createClient,studionet}=await sdk();
  const hash=await createClient({chain:studionet,account:actor,provider:connectedProvider}).writeContract({address,functionName:method,args,value:0n});
  if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Transaction submission returned no valid hash.');
  return hash;
}
/** SDK v1.1.8 API: FINALIZED is more conservative than ACCEPTED.
 * A timeout does NOT mean the write was rejected: the returned hash is durable.
 */
export async function waitForFinalized(hash,onProgress){
  if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Invalid GenLayer transaction hash');
  const {createClient,studionet,TransactionStatus}=await sdk();
  const client=createClient({chain:studionet});
  const finality=client.waitForTransactionReceipt({
    hash,status:TransactionStatus.FINALIZED,interval:3500,retries:125,fullTransaction:true
  });
  if(typeof onProgress!=='function')return finality;
  let monitoring=true,canceledResolve;
  const canceled=new Promise(resolve=>{canceledResolve=resolve});
  const monitor=(async()=>{
    while(monitoring){
      try{
        const tx=await client.getTransaction({hash});
        if(!monitoring)break;
        onProgress(tx);
        const raw=tx?.statusName??tx?.status_name??tx?.status;
        if(raw===8||String(raw).toUpperCase()==='CANCELED'){canceledResolve(tx);break}
      }catch{
        if(monitoring)onProgress({statusName:'RPC_RETRYING'});
      }
      if(monitoring)await new Promise(resolve=>setTimeout(resolve,5500));
    }
  })();
  try{return await Promise.race([finality,canceled])}
  finally{monitoring=false;void monitor}
}
export async function getTransactionState(hash){
  if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Invalid GenLayer transaction hash');
  const {createClient,studionet}=await sdk();
  return createClient({chain:studionet}).getTransaction({hash});
}

/** Read the canonical RPC receipt by the original hash when Studio SDK fields are incomplete. */
export async function getConsensusReceipt(hash){
 if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Invalid GenLayer transaction hash');
 const {createClient,studionet}=await sdk();
 const raw=await createClient({chain:studionet}).request({
  method:'gen_getTransactionReceipt',params:[{txId:hash}]
 });
 const receipt=raw?.result&&typeof raw.result==='object'?raw.result:raw;
 if(!receipt||typeof receipt!=='object')throw Error('Consensus receipt unavailable');
 const receivedId=receipt.id??receipt.txId??receipt.hash;
 if(typeof receivedId!=='string'||receivedId.toLowerCase()!==hash.toLowerCase())
  throw Error('Consensus receipt hash does not match the requested transaction');
 return receipt;
}
export const explorer=hash=>'https://explorer-studio.genlayer.com/tx/'+encodeURIComponent(hash);
