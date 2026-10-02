"""Anomali lintas satker BPPSDMKP: DIPA (PDF SAKTI, diklasifikasi tool) x RUP publik SiRUP x detail MAK x Moner TW I.
Input : test/survey/dipa_all.json (survey_dipa.js), test/data/kkp_pub_2026.json, denorm_bp.json, moner_tw1.json
Output: test/survey/anomali.json + ringkasan di stdout
"""
import json, re, sys, collections, subprocess, os
sys.stdout.reconfigure(encoding='utf-8')
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data') + '/'
HERE = os.path.dirname(__file__)
dipa = json.load(open(os.path.join(HERE, 'survey', 'dipa_all.json'), encoding='utf-8'))
pub = json.load(open(SP + 'kkp_pub_2026.json', encoding='utf-8'))
dn = json.load(open(SP + 'denorm_bp.json', encoding='utf-8'))
moner = json.load(open(SP + 'moner_tw1.json', encoding='utf-8'))

# klasifikasi per item memakai modul JS yang sama dengan userscript
cls_js = r"""
global.Classify=require('%s/src/classify.js');
const d=require('%s/survey/dipa_all.json'); const out={};
for(const [k,v] of Object.entries(d)){ const x=v.FA&&!v.FA.err?v.FA:(v.RKK&&!v.RKK.err?v.RKK:null); if(!x) continue;
  const akun={}; for(const it of x.itemsSample){ const a=it.key.split('.').pop(); const c=Classify.item(a,'',it.uraian,it.grup);
    const o=akun[it.key]=akun[it.key]||{P:0,NP:0,CEK:0,pagu:0,sd:new Set()}; o[c.kelas]+=it.pagu; o.pagu+=it.pagu; if(it.sd) o.sd.add(it.sd);}
  for(const o of Object.values(akun)) o.sd=[...o.sd];
  out[k]={jenis:v.FA&&!v.FA.err?'FA':'RKK', total:x.total, akun}; }
process.stdout.write(JSON.stringify(out));
""" % (os.path.dirname(HERE).replace('\\', '/'), HERE.replace('\\', '/'))
res = subprocess.run(['node', '-e', cls_js], capture_output=True, text=True, encoding='utf-8')
akunmap = json.loads(res.stdout)

# idSatker -> kode satker via kode_satker di baris anggaran paket
id2kode = {}
for pid, j in dn.items():
    for a in (j.get('paket_anggaran_json') or []):
        if a.get('kode_satker'):
            id2kode.setdefault(str(a['asal_dana_satker']), a['kode_satker'])
pub_by = collections.defaultdict(list)
for p in pub['P']:
    pub_by[str(p['idSatker'])].append(p)

f = lambda n: f"{n/1e6:,.0f}".replace(',', '.')
rows, anomali = [], collections.defaultdict(list)
for sid, pk in pub_by.items():
    kode = id2kode.get(sid)
    if not kode or kode not in akunmap:
        continue
    A = akunmap[kode]['akun']
    P = sum(a['P'] for a in A.values())
    rupU = sum(p['pagu'] for p in pk)
    orph = np_ann = cek_ann = 0
    danas, programs = collections.Counter(), set()
    mak_bad = 0
    for p in pk:
        j = dn.get(str(p['id'])) or {}
        if j.get('nama_program'):
            programs.add(j['nama_program'])
        for a in (j.get('paket_anggaran_json') or []):
            danas[(a.get('sumber_dana'), a.get('id_dana_apbn'))] += a['pagu'] or 0
            mak = a.get('mak') or ''
            if len(mak.split('.')) != 7:
                mak_bad += 1
            x = A.get(mak)
            if x is None:
                orph += a['pagu'] or 0
            elif x['P'] == 0 and x['NP'] > 0:
                np_ann += a['pagu'] or 0
            elif x['P'] == 0 and x['CEK'] > 0:
                cek_ann += a['pagu'] or 0
    m = moner.get(kode, {})
    sd_dipa = sorted({s for a in A.values() for s in a['sd']})
    r = dict(kode=kode, idSatker=sid, nama=pk[0]['satuanKerja'], dipaP=P, rupU=rupU, monerTW1=m.get('pagu'), rupTW1=m.get('rup'),
             orphan=orph, npAnn=np_ann, cekAnn=cek_ann, makBad=mak_bad, dana={f'{k[0]}/{k[1]}': v for k, v in danas.items()},
             sdDipa=sd_dipa, manual=any('Manual' in x for x in programs), nPaket=len(pk))
    rows.append(r)
    if orph > 1e6: anomali['MAK paket tidak ada di DIPA terbaru'].append(kode)
    if np_ann > 1e6: anomali['Paket terumumkan pada akun non-pengadaan'].append(kode)
    if abs(rupU - P) > max(1e6, 0.05 * P): anomali['RUP terumumkan menyimpang >5% dari pagu pengadaan DIPA'].append(kode)
    if mak_bad: anomali['Format MAK paket tidak 7 segmen'].append(kode)
    if len(sd_dipa) > 1 and len(danas) == 1: anomali['DIPA multi sumber dana (PNP/BLU/SBSN) tapi RUP satu jenis dana'].append(kode)
    if r['manual']: anomali['PKKR Manual sudah dipakai'].append(kode)

rows.sort(key=lambda r: r['kode'])
print('kode   | pagu P DIPA | RUP umum  | Moner TW1 | orphan   | NP-umum | dana RUP               | SD DIPA        | nama')
for r in rows:
    print(r['kode'], '|', f(r['dipaP']).rjust(10), '|', f(r['rupU']).rjust(9), '|', (f(r['monerTW1']) if r['monerTW1'] else '-').rjust(9), '|',
          f(r['orphan']).rjust(8), '|', f(r['npAnn']).rjust(7), '|', ' '.join(r['dana']).ljust(22), '|', '/'.join(r['sdDipa']).ljust(14), '|', r['nama'][:40])
print()
for k, v in anomali.items():
    print(f'{k}: {len(v)} satker → {", ".join(v)}')
json.dump(dict(rows=rows, anomali=anomali), open(os.path.join(HERE, 'survey', 'anomali.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
