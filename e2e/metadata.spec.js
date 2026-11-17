const {test,expect}=require('@playwright/test');
const {ethers}=require('ethers');
const fs=require('fs/promises');
const path=require('path');
const origin='http://127.0.0.1:5173';
const headers={Origin:origin,'Content-Type':'application/json'};
function sample(){return {name:`Storage test ${Date.now()}-${Math.random()}`,course:'Blockchain',grade:'A',date:'2026-11-17'};}
test('saves exact JSON, fills a content-addressed path, reuses identical bytes and never overwrites modified files',async({request})=>{
  const value=sample(),raw=JSON.stringify(value),hash=ethers.keccak256(ethers.toUtf8Bytes(raw));
  const response=await request.post('/api/metadata',{headers,data:raw});expect(response.status()).toBe(200);
  const saved=await response.json();expect(saved).toEqual({path:`/metadata/generated/${hash}.json`,hash});
  const file=path.resolve('frontend/public',`.${saved.path}`);
  expect(await fs.readFile(file,'utf8')).toBe(raw);
  expect(await (await request.get(saved.path)).text()).toBe(raw);
  const again=await request.post('/api/metadata',{headers,data:raw});expect(await again.json()).toEqual(saved);
  const changed=await request.post('/api/metadata',{headers,data:{...value,grade:'B'}});expect((await changed.json()).path).not.toBe(saved.path);
  expect(await fs.readFile(file,'utf8')).toBe(raw);
  try{
    await fs.writeFile(file,'{"modified":true}');
    const conflict=await request.post('/api/metadata',{headers,data:raw});expect(conflict.status()).toBe(409);
    expect(await fs.readFile(file,'utf8')).toBe('{"modified":true}');
  }finally{await fs.writeFile(file,raw);}
});
test('rejects foreign origins, arbitrary filenames, invalid dates and oversized bodies',async({request})=>{
  expect((await request.post('/api/metadata',{headers:{...headers,Origin:'https://example.com'},data:sample()})).status()).toBe(403);
  expect((await request.post('/api/metadata',{data:sample()})).status()).toBe(403);
  expect((await request.post('/api/metadata',{headers,data:{...sample(),filename:'../../outside.json'}})).status()).toBe(400);
  expect((await request.post('/api/metadata',{headers,data:{...sample(),date:'2026-02-30'}})).status()).toBe(400);
  expect((await request.post('/api/metadata',{headers,data:'{broken'})).status()).toBe(400);
  expect((await request.post('/api/metadata',{headers,data:{...sample(),name:'x'.repeat(20000)}})).status()).toBe(413);
  expect((await request.get('/api/metadata')).status()).toBe(405);
});
