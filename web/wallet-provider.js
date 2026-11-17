/**
 * Wallet connection helpers, isolated from GenLayer contract writes.
 * Studionet network metadata is sourced from the GenLayer network reference.
 */
export const STUDIONET_NETWORK=Object.freeze({
  chainId:'0x'+(61999).toString(16),
  chainName:'GenLayer Studionet',
  rpcUrls:['https://studio.genlayer.com/api'],
  nativeCurrency:{name:'GEN',symbol:'GEN',decimals:18},
  blockExplorerUrls:['https://explorer-studio.genlayer.com'],
});
const validProvider=x=>!!x&&typeof x.request==='function';
const chainOf=x=>typeof x==='string'?Number.parseInt(x,16):typeof x==='number'?x:NaN;
const errCode=error=>error?.code??error?.data?.originalError?.code;
export function walletError(error){
  const code=errCode(error),detail=String(error?.message||'Wallet request failed.');
  if(code===4001)return 'Wallet request rejected. Approve the connection or network change in your wallet.';
  if(code===-32002)return 'A wallet request is already pending. Open your wallet extension and complete it.';
  if(code===4100)return 'Wallet access is not authorized. Unlock your wallet and approve this site.';
  if(code===4902)return 'GenLayer Studionet is not in this wallet. Add network 61999 using https://studio.genlayer.com/api.';
  return detail;
}
/** Prefer active injected provider. If not injected, discover standard EIP-6963 wallets. */
export async function discoverWallet(win=window){
  const injected=win.ethereum;
  if(validProvider(injected)){
    if(Array.isArray(injected.providers)&&injected.providers.length){
      const list=injected.providers.filter(validProvider);
      return list.find(p=>p.isMetaMask)||list[0]||injected;
    }
    return injected;
  }
  if(typeof win.addEventListener!=='function'||typeof win.dispatchEvent!=='function')
    throw Error('No injected browser wallet was detected. Install/unlock MetaMask or a compatible wallet extension, then reload this page.');
  const discovered=await new Promise(resolve=>{
    let timer;
    const onFound=event=>{
      const provider=event?.detail?.provider;
      if(!validProvider(provider))return;
      clearTimeout(timer);
      win.removeEventListener?.('eip6963:announceProvider',onFound);
      resolve(provider);
    };
    win.addEventListener('eip6963:announceProvider',onFound);
    timer=setTimeout(()=>{
      win.removeEventListener?.('eip6963:announceProvider',onFound);
      resolve(null);
    },350);
    const EventCtor=win.Event||globalThis.Event;
    if(typeof EventCtor==='function')win.dispatchEvent(new EventCtor('eip6963:requestProvider'));
  });
  if(validProvider(discovered))return discovered;
  throw Error('No browser wallet was detected. Install/unlock MetaMask (or another EIP-1193 wallet), enable it for this site, and refresh. Studio accounts do not automatically connect to external websites.');
}
export async function useStudionet(provider){
  if(!validProvider(provider))throw Error('Wallet provider is unavailable.');
  const raw=await provider.request({method:'eth_chainId'});
  if(chainOf(raw)===61999)return;
  try{
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:STUDIONET_NETWORK.chainId}]});
  }catch(error){
    if(errCode(error)!==4902)throw Error(walletError(error));
    await provider.request({method:'wallet_addEthereumChain',params:[STUDIONET_NETWORK]});
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:STUDIONET_NETWORK.chainId}]});
  }
  const updated=await provider.request({method:'eth_chainId'});
  if(chainOf(updated)!==61999)
    throw Error('Wallet is still on chain '+String(chainOf(updated))+'. Select GenLayer Studionet (61999) before signing.');
}
export async function authorizeWallet(win=window){
  const provider=await discoverWallet(win);
  const accounts=await provider.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||typeof accounts[0]!=='string'||!/^0x[a-fA-F0-9]{40}$/.test(accounts[0]))
    throw Error('Wallet did not provide a valid account. Unlock and approve an address.');
  await useStudionet(provider);
  return {provider,address:accounts[0].toLowerCase()};
}
