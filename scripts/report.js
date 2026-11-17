const fs=require('fs');
const render=require('./report-layout');
const content=JSON.parse(fs.readFileSync(process.argv[2]||'docs/report-content.json','utf8'));
render(content,process.argv[3]||'docs/report.pdf');
