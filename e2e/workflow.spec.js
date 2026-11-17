const {test,expect}=require('@playwright/test');
const {ethers}=require('ethers');
const fs=require('fs');
const path=require('path');
test('public lookup, role management, mint, tamper, revoke and wallet changes',async({page})=>{
  fs.mkdirSync('docs/evidence',{recursive:true});
  async function capture(name){
    await page.setViewportSize({width:860,height:1100});
    await page.locator('#results').screenshot({path:`docs/evidence/${name}.png`});
    await page.setViewportSize({width:1280,height:720});
  }
  const provider=new ethers.JsonRpcProvider('http://127.0.0.1:7545');
  const signers=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
  const addresses=await Promise.all(signers.map(s=>s.getAddress()));
  const artifact=JSON.parse(fs.readFileSync('artifacts/contracts/AcademicCertificate.sol/AcademicCertificate.json'));
  const c=await new ethers.ContractFactory(artifact.abi,artifact.bytecode,signers[0]).deploy();await c.waitForDeployment();
  const deployment={address:await c.getAddress(),chainId:1337,rpcUrl:'http://127.0.0.1:7545',abi:artifact.abi};
  await page.route('**/src/deployment.json*',route=>route.fulfill({contentType:'application/javascript',body:`export default ${JSON.stringify(deployment)}`}));
  // Test-only EIP-1193 provider uses unlocked local accounts; no wallet keys in web source.
  await page.addInitScript(({addresses})=>{
    let current=addresses[0],chain='0x539',reject=false;
    const events={};
    window.testWallet={account(i){current=addresses[i];events.accountsChanged?.([current]);},chain(id){chain=id;events.chainChanged?.(id);},rejectNext(){reject=true;}};
    window.ethereum={on(name,fn){events[name]=fn;},async request({method,params=[]}){
      if(method==='eth_accounts'||method==='eth_requestAccounts')return [current];
      if(method==='eth_chainId')return chain;
      if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;events.chainChanged?.(chain);return null;}
      if(method==='eth_sendTransaction'&&reject){reject=false;throw Object.assign(Error('User rejected'),{code:4001});}
      const res=await fetch('http://127.0.0.1:7545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
      const data=await res.json();if(data.error)throw Object.assign(Error(data.error.message),data.error);return data.result;
    }};
  },{addresses});
  await page.goto('/');await expect(page.locator('#network')).toContainText('Connected');
  await page.locator('#tokenId').fill('99');await page.getByRole('button',{name:'Look up token',exact:true}).click();await expect(page.locator('#results')).toContainText('does not exist');
  await page.locator('#searchStudent').fill(addresses[2]);await page.getByRole('button',{name:'Look up wallet',exact:true}).click();await expect(page.locator('#results')).toContainText('Found 0');
  await page.locator('#issuer').fill(addresses[1]);await page.locator('#grant').click();await expect(page.locator('#notice')).toContainText('Granted issuer role');
  await page.locator('#admin').screenshot({path:'docs/evidence/issuer-role.png'});
  await page.evaluate(()=>window.testWallet.account(1));await expect(page.locator('#mint')).toBeEnabled();
  await page.locator('#student').fill(addresses[2]);
  const downloading=page.waitForEvent('download');await page.locator('#download').click();await downloading;
  await expect(page.locator('#uri')).toHaveValue(/\/metadata\/generated\/0x[0-9a-f]{64}\.json$/);
  const issuedUri=await page.locator('#uri').inputValue();
  const savedFile=path.resolve('frontend/public',`.${new URL(issuedUri).pathname}`);
  const originalMetadata=fs.readFileSync(savedFile,'utf8');
  expect(JSON.parse(originalMetadata).grade).toBe('A');
  await page.locator('#mint').click();await expect(page.locator('#results')).toContainText('Valid · Not revoked · Hash match');
  expect(await c.tokenURI(1)).toBe(issuedUri);
  expect((await c.getCertificate(1)).metadataHash).toBe(ethers.keccak256(ethers.toUtf8Bytes(originalMetadata)));
  await capture('certificate-valid');
  await page.locator('#searchStudent').fill(addresses[2]);await page.getByRole('button',{name:'Look up wallet',exact:true}).click();await expect(page.locator('#results')).toContainText('Found 1');
  await capture('wallet-lookup');
  await page.locator('#verifyFile').setInputFiles('frontend/public/metadata/cert-tampered.json');await page.locator('#tokenId').fill('1');await page.getByRole('button',{name:'Look up token',exact:true}).click();await expect(page.locator('#results')).toContainText('Hash mismatch');
  await capture('certificate-tampered');
  await page.locator('#verifyFile').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.getByRole('button',{name:'Look up token',exact:true}).click();await expect(page.locator('#results')).toContainText('Integrity not verified');
  await capture('metadata-invalid');
  await page.locator('#verifyFile').setInputFiles([]);
  await page.route(issuedUri,route=>route.fulfill({status:404,body:'not found'}));
  await page.getByRole('button',{name:'Look up token',exact:true}).click();await expect(page.locator('#results')).toContainText('Integrity not verified');
  await page.unroute(issuedUri);
  await page.locator('#revokeId').fill('1');await page.locator('#revoke').click();await expect(page.locator('#results')).toContainText('Revoked');expect(await c.ownerOf(1)).toBe(addresses[2]);
  await capture('certificate-revoked');
  await page.evaluate(()=>window.testWallet.account(3));await expect(page.locator('#mint')).toBeDisabled();
  await page.evaluate(()=>window.testWallet.chain('0x1'));await expect(page.locator('#notice')).toContainText('Wrong network');await expect(page.locator('#grant')).toBeDisabled();
  await page.locator('#notice').screenshot({path:'docs/evidence/wrong-network.png'});
  await page.evaluate(()=>{window.testWallet.chain('0x539');});await page.evaluate(()=>window.testWallet.account(0));await expect(page.locator('#grant')).toBeEnabled();
  await page.locator('#issuer').fill(addresses[3]);await page.evaluate(()=>window.testWallet.rejectNext());await page.locator('#grant').click();await expect(page.locator('#notice')).toContainText('rejected');await expect(page.locator('#grant')).toBeEnabled();
  await page.locator('#connect').click();await expect(page.locator('#notice')).toContainText('Wallet connected');
  // A second certificate can be issued directly, without saving/downloading first.
  await page.evaluate(()=>window.testWallet.account(1));await expect(page.locator('#mint')).toBeEnabled();
  await page.locator('#course').fill('Automatic local metadata storage');await expect(page.locator('#uri')).toHaveValue('');
  await page.locator('#mint').click();await expect(page.locator('#results')).toContainText('Certificate #2');
  await expect(page.locator('#results')).toContainText('Valid · Not revoked · Hash match');
  const secondUri=await c.tokenURI(2);expect(secondUri).not.toBe(issuedUri);
  expect(fs.readFileSync(savedFile,'utf8')).toBe(originalMetadata);
  await page.locator('#tokenId').fill('1');await page.getByRole('button',{name:'Look up token',exact:true}).click();await expect(page.locator('#results')).toContainText('Revoked');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'docs/ui-overview.png'});
  await page.screenshot({path:'docs/ui-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/ui-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const events=[...await c.queryFilter(c.filters.RoleGranted()),...await c.queryFilter(c.filters.CertificateIssued()),...await c.queryFilter(c.filters.CertificateRevoked())];
  const receipts=[];
  for(const event of events){const r=await provider.getTransactionReceipt(event.transactionHash);receipts.push({event:event.fragment.name,hash:r.hash,block:r.blockNumber,status:r.status,gasUsed:r.gasUsed.toString()});}
  const debugFile='artifacts/contracts/AcademicCertificate.sol/AcademicCertificate.dbg.json';
  const debug=JSON.parse(fs.readFileSync(debugFile));
  const build=JSON.parse(fs.readFileSync(path.resolve(path.dirname(debugFile),debug.buildInfo)));
  fs.writeFileSync('docs/evidence/manifest.json',JSON.stringify({capturedAt:new Date().toISOString(),rpcUrl:deployment.rpcUrl,chainId:1337,client:await provider.send('web3_clientVersion',[]),evmVersion:build.input.settings.evmVersion,contract:deployment.address,accounts:addresses,tokenId:1,ownerAfterRevocation:await c.ownerOf(1),receipts,wallet:'Simulated EIP-1193 provider; real local Ganache transactions'},null,2));
});
