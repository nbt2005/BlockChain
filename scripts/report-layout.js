const PDFDocument=require('pdfkit');
const fs=require('fs');
const W=507,L=44,R=L+W;
module.exports=function render(content,output){
 const doc=new PDFDocument({size:'A4',margin:L,bufferPages:true,autoFirstPage:false,info:{Title:content.title,Author:'Team 4'}});
 doc.pipe(fs.createWriteStream(output));
 const fonts=process.platform==='win32'?['C:/Windows/Fonts/arial.ttf','C:/Windows/Fonts/arialbd.ttf']:['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'];
 doc.registerFont('Body',fonts[0]);doc.registerFont('Bold',fonts[1]);
 function text(s,size=10,gap=3){doc.font('Body').fontSize(size).fillColor('#172d27').text(s,L,doc.y,{width:W,lineGap:gap});doc.moveDown(.55);}
 function small(s){text(s,8.3,2);}
 function heading(s){doc.font('Bold').fontSize(12).fillColor('#000000').text(s,L,doc.y,{width:W});doc.moveDown(.55);}
 function page(title){if(doc.page&&doc.y>789)throw Error('Page overflow before '+title);doc.addPage();doc.font('Bold').fontSize(8).fillColor('#536d62').text('TEAM 4  /  PROJECT 3  /  ACADEMIC CERTIFICATES',L,36,{width:W});doc.y=59;doc.font('Bold').fontSize(20).fillColor('#000000').text(title,L,doc.y,{width:W});doc.moveDown(.65);}
 function table(headers,rows,widths,fontSize=8.6){
  let y=doc.y;
  for(const [index,row]of [headers,...rows].entries()){
   const heights=row.map((v,k)=>{doc.font(index?'Body':'Bold').fontSize(fontSize);return doc.heightOfString(v,{width:widths[k]-14,lineGap:2});});
   const h=Math.max(...heights)+14;let x=L;
   row.forEach((v,k)=>{doc.rect(x,y,widths[k],h).fillAndStroke(index===0?'#244c3e':index%2?'#f0f4ef':'#ffffff','#d9d9d9');doc.font(index?'Body':'Bold').fontSize(fontSize).fillColor(index?'#19342b':'#ffffff').text(v,x+7,y+7,{width:widths[k]-14,lineGap:2});x+=widths[k];});
   y+=h;
  }doc.y=y+10;doc.x=L;
 }
 function figure(file,caption,height,crop=false){
  if(!fs.existsSync(file))throw Error('Missing evidence: '+file);
  const y=doc.y,im=doc.openImage(file);const actual=crop?height:Math.min(height,W*im.height/im.width);
  if(crop){doc.save().rect(L,y,W,actual).clip();doc.image(file,L,y,{width:W});doc.restore();}
  else doc.image(file,L,y,{fit:[W,actual],align:'left'});
  doc.rect(L,y,W,actual).lineWidth(.4).strokeColor('#d9d9d9').stroke();doc.y=y+actual+6;small(caption);
 }
 function box(x,y,w,h,label,size=10){doc.roundedRect(x,y,w,h,4).fillAndStroke('#eef3ed','#bfcec2');doc.font('Bold').fontSize(size).fillColor('#17392c').text(label,x+7,y+10,{width:w-14,align:'center'});}
 function arrow(x1,y1,x2,y2){doc.moveTo(x1,y1).lineTo(x2,y2).strokeColor('#5a7869').lineWidth(.8).stroke();const a=Math.atan2(y2-y1,x2-x1),n=5;doc.moveTo(x2,y2).lineTo(x2-n*Math.cos(a-.5),y2-n*Math.sin(a-.5)).moveTo(x2,y2).lineTo(x2-n*Math.cos(a+.5),y2-n*Math.sin(a+.5)).stroke();}
 page(content.sections[0]);heading(content.title);small('Nguyen Ba Thien — 29211164940  |  Nguyen Dang Thinh — 29210258195');
 text(content.intro);text(content.scope);small(content.tech);figure('docs/ui-overview.png',content.overviewCaption,220);text(content.team,9.5);
 page(content.sections[1]);text(content.designIntro);
 table(content.roleHeaders,content.roles,[88,419],9);
 heading(content.storageTitle);text(content.storage,9.5);
 table(content.apiHeaders,content.apis,[205,302],8.7);
 text(content.metadata,9.5);
 page(content.sections[2]);text(content.diagramIntro,9.5);
 let y=doc.y;box(L,y,225,35,'ERC721');box(326,y,225,35,'AccessControl');arrow(156,y+35,297,y+65);arrow(438,y+35,297,y+65);
 box(150,y+65,295,86,'AcademicCertificate\nCertificate + immutable URI + student index\nissue / revoke / get / verify',10);doc.y=y+160;small(content.classCaption);
 y=doc.y+2;box(L,y,135,43,'Not issued');box(230,y,135,43,'Active');box(416,y,135,43,'Revoked');arrow(179,y+21,230,y+21);arrow(365,y+21,416,y+21);doc.font('Body').fontSize(7).fillColor('#193b2c').text('issue',181,y+5,{width:46,align:'center'}).text('revoke',368,y+5,{width:45,align:'center'});doc.y=y+53;small(content.stateCaption);
 y=doc.y+3;const xs=[90,238,386,530],labels=['Issuer / verifier','Web + JSON','MetaMask','Contract / RPC'];
 xs.forEach((x,i)=>{doc.font('Bold').fontSize(8.4).fillColor('#193b2c').text(labels[i],x-44,y,{width:88,align:'center'});doc.moveTo(x,y+24).lineTo(x,y+242).dash(3,{space:3}).strokeColor('#b8c7bf').stroke().undash();});
 const flows=[[0,1,'1. Input student, URI and metadata'],[1,1,'2. Fetch exact UTF-8; keccak256'],[1,2,'3. Request issueCertificate signature'],[2,3,'4. Signed transaction; enforce role; mint'],[3,1,'5. Receipt + CertificateIssued tokenId'],[0,1,'6. Look up token / select comparison JSON'],[1,3,'7. eth_call getCertificate / verify'],[3,1,'8. Return revoked + hash comparison']];
 flows.forEach(([a,b,label],i)=>{const yy=y+42+i*25;if(a!==b)arrow(xs[a],yy,xs[b],yy);else{doc.circle(xs[a],yy,3).fill('#5a7869');}doc.font('Body').fontSize(8).fillColor('#142e24').text(label,L+8,yy-12,{width:W-16,align:'center'});});doc.y=y+253;small(content.sequenceCaption);
 page(content.sections[3]);text(content.securityIntro,9.5);
 table(content.securityHeaders,content.securityRows,[110,397],8.4);
 figure('docs/evidence/certificate-valid.png',content.validCaption,132,true);
 figure('docs/evidence/certificate-tampered.png',content.tamperedCaption,132,true);
 page(content.sections[4]);text(content.testIntro,9.5);
 table(content.testHeaders,content.testGroups,[347,60,100],8.6);
 const hardhat=fs.readFileSync('docs/test-hardhat.txt','utf8').match(/\d+ passing[^\r\n]*/)?.[0];
 const ganache=fs.readFileSync('docs/test-results.txt','utf8').match(/\d+ passing[^\r\n]*/)?.[0];
 small(`Hardhat: ${hardhat}  |  Ganache: ${ganache}  |  Browser: ${fs.readFileSync('docs/ui-results.txt','utf8').match(/1 passed[^\r\n]*/)?.[0]}`);
 const manifest=JSON.parse(fs.readFileSync('docs/evidence/manifest.json','utf8'));
 small(`Evidence: ${manifest.capturedAt} | EVM ${manifest.evmVersion} | chain ${manifest.chainId}\nContract: ${manifest.contract}`);
 figure('docs/evidence/test-log.png',content.testLogCaption,118);
 figure('docs/evidence/certificate-revoked.png',content.revokedCaption,130,true);
 text(content.manual,9.1);
 page(content.sections[5]);text(content.gasMethod,9.4);
 const off=JSON.parse(fs.readFileSync('docs/gas-unoptimized.json')),on=JSON.parse(fs.readFileSync('docs/gas-optimized.json'));
 table(content.gasHeaders,on.map(r=>{const b=off.find(x=>x.operation===r.operation);return [r.operation,Number(b.gasUsed).toLocaleString('en-US'),Number(r.gasUsed).toLocaleString('en-US'),((Number(b.gasUsed)-Number(r.gasUsed))/Number(b.gasUsed)*100).toFixed(2)+'%'];}),[153,118,118,118],8.8);
 figure('docs/evidence/gas-deploy.png',content.gasCaption,75);
 text(content.gasAnalysis,9.1);small(content.gasBoundary);
 heading(content.sections[6]);text(content.conclusion,9.2);
 heading(content.sections[7]);for(const [label,url]of content.references){doc.font('Body').fontSize(7.6).fillColor('#213e31').text(label,L,doc.y,{width:W,link:url});doc.moveDown(.3);}
 const pages=doc.bufferedPageRange();if(pages.count!==6||doc.y>782)throw Error(`Report layout overflow: ${pages.count} pages, final y ${doc.y}`);
 for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.font('Body').fontSize(8).fillColor('#6c7c73').text(`Academic certificates  /  Team 4                                                          ${i+1} / 6`,L,804,{lineBreak:false});}
 doc.end();console.log('Generated',output,'— 6 pages, 8 sections');
};
