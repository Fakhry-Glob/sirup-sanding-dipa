const C=require('../src/classify.js'); const fs=require('fs');
const SP='C:/Users/user/AppData/Local/Temp/claude/C--Users-user--claude/589e9048-9827-43f0-9bf8-5984b0c2c222/scratchpad/';
const d=JSON.parse(fs.readFileSync(SP+(process.argv[2]||'fa_js_626402.json'),'utf8'));
const nodes=new Map(d.nodes.map(n=>[n.key,n]));
const tot={P:0,NP:0,CEK:0}, byReason={};
for(const it of d.items){const akun=it.key.split('.').pop(); const c=C.item(akun,(nodes.get(it.key)||{}).uraian,it.uraian,it.grup);
 tot[c.kelas]+=it.pagu; const k=c.kelas+' | '+c.alasan; byReason[k]=(byReason[k]||0)+it.pagu;
 if(c.kelas==='CEK'||process.argv[3]==='v') console.log(c.kelas.padEnd(4),akun,String(it.pagu).padStart(14),it.uraian.slice(0,70),'|',c.alasan);}
console.log(tot); console.log(Object.entries(byReason).sort().map(([k,v])=>k.padEnd(70)+v.toLocaleString('id')).join('\n'));
