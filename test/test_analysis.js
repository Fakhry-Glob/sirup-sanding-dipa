global.Classify=require('../src/classify.js'); const A=require('../src/analysis.js'); const fs=require('fs');
const SP='C:/Users/user/AppData/Local/Temp/claude/C--Users-user--claude/589e9048-9827-43f0-9bf8-5984b0c2c222/scratchpad/';
const dipa=JSON.parse(fs.readFileSync(SP+'fa_js_626402.json','utf8'));
const tree=JSON.parse(fs.readFileSync(SP+'pkkr_626402.json','utf8'));
const pakets=JSON.parse(fs.readFileSync(SP+'rup_detail_626402.json','utf8'));
const pkkr=new Map(); const LV=['prog','keg','kro','ro','komp','sub'];
(function walk(ns,pk,d){for(const n of ns){const key=pk?pk+'.'+n.kode:n.kode; pkkr.set(key,{id:n.id,level:LV[d],kode:n.kode,nama:n.nama,pagu:+n.pagu||0,manual:false}); if(n.children) walk(n.children,key,d+1);}})(tree,'',0);
const {nodes,akun}=A.buildDipa(dipa,{});
const {orphans}=A.sanding(akun,pakets);
const cfg={minPaketBaru:1000,jadwalDefault:{awalPengadaan:'2026-10',akhirPengadaan:'2026-10',awalPekerjaan:'2026-10',akhirPekerjaan:'2026-12',awalKebutuhan:'2026-10',kebutuhan:'2026-12'},plBarjas:200e6,plKonstruksi:400e6,plKonsultansi:100e6};
const r=A.plan({akunMap:akun,pakets,dipaNodes:nodes,pkkr,cfg});
const f=n=>Math.round(n).toLocaleString('id-ID');
const st={}; for(const a of akun.values()){st[a.status]=st[a.status]||{n:0,P:0,U:0}; st[a.status].n++; st[a.status].P+=a.P; st[a.status].U+=a.rupU;}
console.log('Akun status:',Object.entries(st).map(([k,v])=>`${k}: ${v.n} akun, P ${f(v.P)}, RUP-U ${f(v.U)}`).join('\n  '));
console.log('Orphan MAK rows:',orphans.length, f(orphans.reduce((s,o)=>s+o.pagu,0)), [...new Set(orphans.map(o=>o.mak.split('.').slice(0,6).join('.')))]);
const V={}; for(const p of pakets){V[p.verdict]=(V[p.verdict]||0)+1;} console.log('Verdict paket:',V);
for(const a of r.actions){
 if(a.type==='PKKR_ADD') console.log('PKKR_ADD',a.nodes.map(n=>n.key+' '+f(n.pagu)).join(', '));
 else if(a.type==='REVISI') console.log('REVISI donor',a.donorId,a.alasan,'→',a.pakets.length,'paket; contoh:',a.pakets.slice(0,3).map(p=>p.nama.slice(0,40)+' '+p.anggaran.map(x=>x.mak+'='+f(x.pagu)+(x.dari?' (dari '+x.dari+')':'')).join('+')).join(' | '));
 else console.log(a.type, a.paketId||'', a.nama? a.nama.slice(0,60):'', a.pagu? f(a.pagu):'', a.alasan||'', a.ids?a.ids.join(','):'');
}
const revs=r.actions.filter(a=>a.type==='REVISI'); console.log('Total paket baru:',revs.reduce((s,a)=>s+a.pakets.filter(p=>p.baru).length,0), 'pagu', f(revs.reduce((s,a)=>s+a.pakets.filter(p=>p.baru).reduce((t,p)=>t+p.anggaran[0].pagu,0),0)));
const totP=[...akun.values()].reduce((s,a)=>s+a.P,0), totU=[...akun.values()].reduce((s,a)=>s+a.rupU,0)+orphans.filter(o=>o.status==='3').reduce((s,o)=>s+o.pagu,0);
console.log('Pagu pengadaan DIPA',f(totP),' RUP terumumkan (semua)',f(totU));
fs.writeFileSync(SP+'plan_626402.json',JSON.stringify(r.actions,null,1));
