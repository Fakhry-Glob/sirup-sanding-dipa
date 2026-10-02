global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js'); const fs = require('fs');
const SP = require('path').join(__dirname, 'data') + '/'; // data uji lokal (tidak ikut git)
const dipa = JSON.parse(fs.readFileSync(SP + 'fa_js_626402.json', 'utf8'));
const pakets = JSON.parse(fs.readFileSync(SP + 'rup_detail_626402.json', 'utf8'));
const { nodes, akun } = A.buildDipa(dipa, {}); A.sanding(akun, pakets);
const f = n => Math.round(n).toLocaleString('id-ID');
for (const p of pakets) Object.assign(p, A.verdictPaket(p, akun));
// a) keputusan LEBIH dikelompokkan per akun (bukan per paket)
const lebihAkun = [...akun.values()].filter(a => a.status === 'LEBIH');
const besar = lebihAkun.filter(a => -a.selisih >= 100e6);
console.log(`a) Akun RUP > DIPA: ${lebihAkun.length} akun (${besar.length} di antaranya selisih ≥ Rp100 jt). Selisih terbesar:`);
lebihAkun.sort((x, y) => x.selisih - y.selisih).slice(0, 5).forEach(a => console.log(`   ${a.key} ${a.nama.slice(0, 28)}: DIPA pengadaan Rp${f(a.P)} vs RUP Rp${f(a.rupU)} (lebih Rp${f(-a.selisih)}) di ${new Set(a.rup.filter(r => r.status === '3').map(r => r.paketId)).size} paket`));
// orphan per prefix (MAK hilang) → kelompok keputusan
const orph = {}; for (const p of pakets.filter(p => p.status === '3')) for (const r of p.rows || []) if (r.v === 'MAK_HILANG') { const k = r.mak.split('.').slice(0, 6).join('.') + ' .' + r.mak.split('.')[6]; orph[k] = orph[k] || { n: new Set(), pagu: 0 }; orph[k].n.add(p.id); orph[k].pagu += r.pagu; }
console.log(`   MAK lama (tidak ada di DIPA): ${Object.keys(orph).length} kelompok MAK, contoh:`, Object.entries(orph).sort((a, b) => b[1].pagu - a[1].pagu).slice(0, 4).map(([k, v]) => `${k} (${v.n.size} paket, Rp${f(v.pagu)})`).join(' | '));
// b) kekurangan: MAK dgn paket existing vs tanpa paket
const kurang = [...akun.values()].filter(a => a.status === 'KURANG');
const adaPaket = kurang.filter(a => a.rup.some(r => r.status === '3'));
const generik = adaPaket.filter(a => { const ids = new Set(a.rup.filter(r => r.status === '3').map(r => r.paketId)); return [...ids].some(id => { const p = pakets.find(x => x.id === id); return p && (/^belanja /i.test(p.nama) || new Set(p.sumberDana.map(s => s.mak)).size === 1); }); });
console.log(`b) Akun kurang: ${kurang.length}. Punya paket terumumkan: ${adaPaket.length} (paket generik "Belanja …"/1-MAK: ${generik.length}). Tanpa paket: ${kurang.length - adaPaket.length}.`);
// c) jumlah paket baru bila dikelompokkan
const tanpa = kurang.filter(a => !a.rup.some(r => r.status === '3'));
const byAkun = tanpa.length;
const bySub = new Set(tanpa.map(a => a.key.split('.').slice(0, 6).join('.') + '|' + Classify.saranJenis(a.akun, ''))).size;
const byKomp = new Set(tanpa.map(a => a.key.split('.').slice(0, 5).join('.') + '|' + Classify.saranJenis(a.akun, ''))).size;
console.log(`c) Paket baru bila hanya untuk MAK tanpa paket: per akun ${byAkun} · per sub-komponen+jenis ${bySub} · per komponen+jenis ${byKomp}`);
tanpa.sort((x, y) => y.selisih - x.selisih).slice(0, 8).forEach(a => console.log(`   ${a.key} ${a.nama.slice(0, 26)} kurang Rp${f(a.selisih)}`));
// d) paket host sekomponen tersedia?
const hostOk = tanpa.filter(a => { const k = a.key.split('.').slice(0, 5).join('.'); return pakets.some(p => p.status === '3' && p.verdict === 'OK' && (p.sumberDana || []).some(s => s.mak.startsWith(k + '.'))); });
console.log(`d) MAK tanpa paket yang punya paket "bersih" di komponen yang sama (calon titipan): ${hostOk.length}/${tanpa.length}`);
// e) realisasi pada akun kurang
const real = kurang.filter(a => a.items.some(i => i.kelas === 'P' && i.realisasi > 0));
console.log(`e) Akun kurang yang item pengadaannya SUDAH terealisasi sebagian: ${real.length}/${kurang.length}`);
// f) baris anggaran per paket (struktur yang harus dijaga pada 1→1)
const multi = pakets.filter(p => (p.sumberDana || []).length > 1); const sameMak = pakets.filter(p => { const m = (p.sumberDana || []).map(s => s.mak); return m.length > new Set(m).size; });
console.log(`f) Paket dgn >1 baris anggaran: ${multi.length}; dgn baris MAK kembar (dirinci per item oleh PPK): ${sameMak.length}`);
// g) lokasi paket existing: sebaran provinsi
const prov = {}; for (const p of pakets) for (const l of p.lokasi || []) prov[l.prov + ' / ' + l.kab] = (prov[l.prov + ' / ' + l.kab] || 0) + 1;
console.log('g) Lokasi paket existing (top):', Object.entries(prov).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(' | '));
