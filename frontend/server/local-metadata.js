import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {keccak256,toUtf8Bytes} from 'ethers';

const LIMIT=16*1024;
const fields=['name','course','grade','date'];
class RequestError extends Error{constructor(status,message){super(message);this.status=status;}}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function validateOrigin(req){
  const host=req.headers.host;
  let url;try{url=new URL(`http://${host}`);}catch{throw new RequestError(403,'Invalid local host.');}
  const local=['127.0.0.1','localhost','[::1]'];
  const peer=req.socket.remoteAddress;
  if(!local.includes(url.hostname)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)||req.headers.origin!==url.origin)throw new RequestError(403,'Metadata can only be saved from this local app.');
}
function body(req){return new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  req.on('data',chunk=>{size+=chunk.length;if(size>LIMIT)reject(new RequestError(413,'Metadata is too large (maximum 16 KB).'));else chunks.push(chunk);});
  req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error',reject);
});}
function canonicalize(raw){
  let value;try{value=JSON.parse(raw);}catch{throw new RequestError(400,'Invalid JSON.');}
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length!==fields.length||fields.some(k=>typeof value[k]!=='string'||!value[k].trim()||value[k].length>500))throw new RequestError(400,'Provide only name, course, grade, and date as nonempty strings.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(Date.parse(value.date))||new Date(value.date).toISOString().slice(0,10)!==value.date)throw new RequestError(400,'Use a valid date in YYYY-MM-DD format.');
  return JSON.stringify(Object.fromEntries(fields.map(k=>[k,value[k].trim()])));
}
export function localMetadata({directory}){
  const root=path.resolve(directory);
  return {name:'local-certificate-metadata',apply:'serve',configureServer(server){
    server.middlewares.use((req,res,next)=>{
      const pathname=req.url?.split('?')[0];
      if(pathname?.startsWith('/metadata/generated/')){
        (async()=>{
          const match=pathname.match(/^\/metadata\/generated\/(0x[0-9a-f]{64}\.json)$/);
          if(!match)throw new RequestError(404,'Metadata file not found.');
          if(!['GET','HEAD'].includes(req.method))throw new RequestError(405,'Use GET to read metadata.');
          let text;try{text=await readFile(path.join(root,match[1]),'utf8');}catch(e){if(e.code==='ENOENT')throw new RequestError(404,'Metadata file not found.');throw e;}
          res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
          res.end(req.method==='HEAD'?undefined:text);
        })().catch(e=>{if(!res.headersSent)reply(res,e.status||500,{error:e.status?e.message:'Unable to read metadata.'});});
        return;
      }
      if(pathname!=='/api/metadata')return next();
      (async()=>{
        if(req.method!=='POST'){res.setHeader('Allow','POST');throw new RequestError(405,'Use POST to save metadata.');}
        validateOrigin(req);
        if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw new RequestError(415,'Use application/json.');
        const text=canonicalize(await body(req));
        const hash=keccak256(toUtf8Bytes(text));
        const filename=`${hash}.json`;
        await mkdir(root,{recursive:true});
        // The client cannot supply a path. Exclusive creation never overwrites an issued file.
        try{await writeFile(path.join(root,filename),text,{encoding:'utf8',flag:'wx'});}
        catch(e){if(e.code!=='EEXIST')throw e;if(await readFile(path.join(root,filename),'utf8')!==text)throw new RequestError(409,'The saved metadata file was modified. Restore it before reusing this data.');}
        reply(res,200,{path:`/metadata/generated/${filename}`,hash});
      })().catch(e=>{if(!res.headersSent)reply(res,e.status||500,{error:e.status?e.message:'Unable to save metadata in the project folder.'});});
    });
  }};
}
