import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDIONET_NETWORK,discoverWallet,authorizeWallet,useStudionet,walletError}
 from '../web/wallet-provider.js';
const account='0x'+'a'.repeat(40);
function mockProvider({chain='0x1',unknown=false,approve=true,staysWrong=false}={}){
 const requests=[];let current=chain,added=false;
 const provider={requests,
  async request({method,params}){
   requests.push({method,params});
   if(method==='eth_requestAccounts'){
    if(!approve)throw Object.assign(new Error('User rejected the request.'),{code:4001});
    return [account];
   }
   if(method==='eth_chainId')return current;
   if(method==='wallet_switchEthereumChain'){
    if(unknown&&!added)throw Object.assign(new Error('Unknown chain'),{code:4902});
    if(!staysWrong)current=params[0].chainId;
    return null;
   }
   if(method==='wallet_addEthereumChain'){added=true;return null}
   throw Error('Unexpected wallet call '+method);
  }
 };
 return provider;
}
test('official Studionet chain identity and RPC cannot be substituted',()=>{
 assert.equal(STUDIONET_NETWORK.chainId,'0xf22f');
 assert.deepEqual(STUDIONET_NETWORK.rpcUrls,['https://studio.genlayer.com/api']);
 assert.equal(STUDIONET_NETWORK.nativeCurrency.symbol,'GEN');
});
test('already connected wallet requests accounts without an unnecessary network switch',async()=>{
 const provider=mockProvider({chain:'0xf22f'});
 const connected=await authorizeWallet({ethereum:provider});
 assert.equal(connected.address,account);
 assert.equal(connected.provider,provider);
 assert.deepEqual(provider.requests.map(r=>r.method),['eth_requestAccounts','eth_chainId']);
});
test('wrong-network wallet is invited to switch before being considered connected',async()=>{
 const provider=mockProvider({chain:'0x1'});
 await authorizeWallet({ethereum:provider});
 assert.deepEqual(provider.requests.map(r=>r.method),[
  'eth_requestAccounts','eth_chainId','wallet_switchEthereumChain','eth_chainId']);
 assert.equal(provider.requests[2].params[0].chainId,'0xf22f');
});
test('unknown GenLayer network is added and then selected, using official RPC',async()=>{
 const provider=mockProvider({chain:'0x1',unknown:true});
 const result=await authorizeWallet({ethereum:provider});
 assert.equal(result.address,account);
 const names=provider.requests.map(r=>r.method);
 assert.deepEqual(names,[
  'eth_requestAccounts','eth_chainId','wallet_switchEthereumChain',
  'wallet_addEthereumChain','wallet_switchEthereumChain','eth_chainId'
 ]);
 assert.deepEqual(provider.requests[3].params,[STUDIONET_NETWORK]);
});
test('user refusal surfaces a useful message without ever claiming connection',async()=>{
 const provider=mockProvider({approve:false});
 await assert.rejects(()=>authorizeWallet({ethereum:provider}),{code:4001});
 assert.match(walletError(Object.assign(new Error('Denied'),{code:4001})),/rejected/);
 assert.match(walletError({code:-32002}),/pending/);
});
test('wallet that stays on wrong chain is rejected',async()=>{
 const provider=mockProvider({staysWrong:true});
 await assert.rejects(()=>useStudionet(provider),/still on chain 1/);
});
test('selects a standard injected EIP-1193 provider when multiple extensions exist',async()=>{
 const one=mockProvider({chain:'0xf22f'}),meta=mockProvider({chain:'0xf22f'});
 meta.isMetaMask=true;
 const chosen=await discoverWallet({ethereum:{...one,providers:[one,meta]}});
 assert.equal(chosen,meta);
});
test('detects a provider announced using EIP-6963 when window.ethereum is unavailable',async()=>{
 const p=mockProvider({chain:'0xf22f'}),listeners=new Map();
 const win={
  Event:class {constructor(type){this.type=type}},
  addEventListener(type,cb){listeners.set(type,cb)},
  removeEventListener(type){listeners.delete(type)},
  dispatchEvent(event){
   if(event.type==='eip6963:requestProvider')
    listeners.get('eip6963:announceProvider')?.({detail:{provider:p}});
  }
 };
 assert.equal(await discoverWallet(win),p);
 assert.equal(listeners.has('eip6963:announceProvider'),false);
});
test('without a wallet extension, explains the browser requirement',async()=>{
 await assert.rejects(()=>discoverWallet({}),/browser wallet/i);
});
