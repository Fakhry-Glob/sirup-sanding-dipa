// ───────────────────────────────────────────────────────────────────── UI ──
const UI = (() => {
    const APP = 'Sanding DIPA ↔ RUP';
    const fmt = n => (n == null || isNaN(n)) ? '–' : Math.round(n).toLocaleString('id-ID');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const store = {
        get(k, def) { try { const v = localStorage.getItem('sdr:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
        set(k, v) { try { localStorage.setItem('sdr:' + k, JSON.stringify(v)); } catch (e) { /* storage penuh/diblokir */ } },
    };

    const S = {
        step: 0, ctx: null, dipa: null, dipaFile: '', overrides: {}, pkkr: null, ppk: [], pakets: null, swakelola: [],
        an: null, ren: null, sa: null, busy: false, stop: false,
        // keputusan kartu, cara menutup kekurangan, isian yang diubah, centang — disimpan per satker + tahun
        kep: {}, atur: {}, edit: {}, pilih: new Map(), lokasiSatker: null, lokRkk: null, antre: null, alasanUmkmList: null,
        cfg: Object.assign({
            plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6, metodeEO: 'Tender', cekSebagai: 'CEK', maxPaketPerRevisi: 15,
            ambangSelisih: 1e6, ambangKeputusan: 100e6, grupPaketBaru: 'sub', jeda: 500,
        }, store.get('cfg', {})),
    };
    const STEPS = ['1. Data & Login', '2. Struktur PKKR', '3. Sanding RUP', '4. Rekap & Eksekusi', '5. Struktur Anggaran'];
    let root, body, foot, stepsEl, ctxEl, actEl;

    // ── helpers DOM ──────────────────────────────────────────────────────
    function h(tag, attrs, ...kids) {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            if (v == null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'html') el.innerHTML = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
            else el.setAttribute(k, v === true ? '' : v);
        }
        for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
        return el;
    }
    let logBody, logLast, logCount, logN = 0;
    function log(msg, cls) {
        if (!logBody) return;
        const t = new Date().toTimeString().slice(0, 8);
        logBody.append(h('div', { class: cls || '' }, `[${t}] ${msg}`));
        logBody.scrollTop = logBody.scrollHeight;
        logLast.textContent = `[${t}] ${msg}`;
        logLast.className = 'last ' + (cls || '');
        logCount.textContent = `Log aktivitas (${++logN})`;
        if (cls === 'e') foot.classList.add('open');
    }
    function modal(title, content, buttons) {
        return new Promise(res => {
            const box = h('div', { class: 'sdr-modal sdr' });
            const close = v => { box.remove(); res(v); };
            box.append(h('div', {}, h('h3', {}, title), content,
                h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } },
                    ...(buttons || [['Batal', false, ''], ['Lanjutkan', true, 'pri']]).map(([l, v, c]) => h('button', { class: 'btn ' + c, onclick: () => close(v) }, l)))));
            document.body.append(box);
        });
    }
    const confirmBox = (title, html, ok = 'Ya, jalankan') => modal(title, h('div', { html }), [['Batal', false, ''], [ok, true, 'go']]);
    const pill = (txt, cls) => h('span', { class: 'pill ' + cls }, txt);
    const STATUS_PILL = {
        SESUAI: ['Sesuai', 'p-ok'], KURANG: ['Kurang', 'p-warn'], LEBIH: ['Lebih', 'p-bad'], NP: ['Non-pengadaan', 'p-np'],
        NP_TERUMUMKAN: ['NP terumumkan', 'p-bad'], CEK: ['Perlu cek', 'p-info'],
    };
    const progress = () => { const i = h('i'); const el = h('div', { class: 'prog' }, i); el.set = (a, b) => { i.style.width = (b ? Math.round(a / b * 100) : 0) + '%'; }; return el; };

    // ── kerangka jendela ─────────────────────────────────────────────────
    function open() {
        if (root) { root.style.display = 'flex'; return; }
        root = h('div', { class: 'sdr-ov sdr' });
        const win = h('div', { class: 'sdr-win' });
        ctxEl = h('div', { class: 'sdr-ctx' }, h('span', {}, 'memeriksa login…'));
        stepsEl = h('div', { class: 'sdr-steps' });
        body = h('div', { class: 'sdr-body' });
        logCount = h('b', {}, 'Log aktivitas (0)');
        logLast = h('span', { class: 'last' }, 'belum ada aktivitas');
        logBody = h('div', { class: 'sdr-log-body' });
        foot = h('div', { class: 'sdr-log' },
            h('div', { class: 'sdr-log-bar', onclick: () => foot.classList.toggle('open'), title: 'Klik untuk membuka/menutup log' }, logCount, logLast, h('span', {}, '▴▾')), logBody);
        win.append(h('div', { class: 'sdr-hd' }, h('h2', {}, APP), ctxEl,
            h('button', { class: 'btn sm', onclick: exportExcel, title: 'Unduh kertas kerja Excel' }, '⬇ Excel'),
            h('button', { class: 'btn sm', onclick: settings }, '⚙'),
            h('button', { class: 'sdr-x', title: 'Tutup', onclick: () => { root.style.display = 'none'; } }, '×')), stepsEl, body, actEl = h('div', { class: 'sdr-act' }), foot);
        root.append(win);
        document.body.append(root);
        Sirup.setLogger(log);
        renderSteps();
        go(0);
    }
    function renderSteps() {
        stepsEl.innerHTML = '';
        const done = [!!S.dipa && !!S.ctx && S.ctx.login, !!S.pkkr, !!S.an, false, false];
        STEPS.forEach((s, i) => stepsEl.append(h('button', { class: `sdr-step${i === S.step ? ' on' : ''}${done[i] ? ' done' : ''}`, onclick: () => go(i) },
            h('span', { class: 'no' }, done[i] && i !== S.step ? '✓' : String(i + 1)), s.replace(/^\d+\.\s*/, ''))));
    }
    let goNanti = null;
    function go(i) {
        // dipanggil dari dalam proses yang sedang berjalan (mis. "Baca ulang" lalu go) → langkah tujuan
        // memakai guard sendiri, jadi digambar setelah proses selesai (dulu halaman tertinggal kosong)
        if (S.busy) { goNanti = i; return; }
        S.step = i; renderSteps(); body.innerHTML = ''; if (actEl) actEl.innerHTML = '';
        [stepData, stepPkkr, stepSanding, stepRekap, stepStruktur][i]();
    }
    async function guard(fn) {
        if (S.busy) return;
        S.busy = true; S.stop = false;
        try { await fn(); } catch (e) { log('GAGAL: ' + e.message, 'e'); console.error(e); await modal('Terjadi kesalahan', h('div', { class: 'errbox' }, e.message), [['Tutup', false, 'pri']]); }
        finally { S.busy = false; renderSteps(); if (goNanti != null) { const i = goNanti; goNanti = null; go(i); } }
    }

    // ── 1. Data & login ─────────────────────────────────────────────────
    function stepData() {
        const ctxCard = h('div', { class: 'card' }, h('h3', {}, 'Akun SiRUP'), h('p', { class: 'note' }, 'Memeriksa sesi login…'));
        body.append(ctxCard);
        guard(async () => {
            S.ctx = await Sirup.context();
            ctxCard.innerHTML = '';
            ctxCard.append(h('h3', {}, 'Akun SiRUP'));
            if (!S.ctx.login) {
                ctxCard.append(h('div', { class: 'errbox' }, 'Anda belum login di SiRUP. Login dulu dengan akun KPA satker, lalu buka lagi panel ini.'));
                ctxEl.innerHTML = ''; ctxEl.append(h('span', {}, 'belum login'));
                return;
            }
            ctxEl.innerHTML = '';
            ctxEl.append(...[S.ctx.username, S.ctx.role, 'Satker ' + S.ctx.kodeSatker, 'TA ' + S.ctx.tahun].filter(Boolean).map(t => h('span', {}, t)));
            ctxCard.append(h('div', { class: 'kpis' },
                kpi(S.ctx.nama || '–', 'Nama pengguna'), kpi(S.ctx.role || '–', 'Role'), kpi(S.ctx.kodeSatker || '–', 'Kode satker'), kpi(String(S.ctx.tahun), 'Tahun anggaran')),
                h('div', {}, S.ctx.satkerNama),
                S.ctx.isKPA ? h('div', { class: 'okbox' }, 'Login sebagai KPA — fitur tambah PKKR, revisi, umumkan, dan struktur anggaran tersedia.')
                    : h('div', { class: 'warnbox' }, `Role "${S.ctx.role}" bukan KPA. Sanding tetap bisa dilihat, tetapi eksekusi (PKKR, revisi, umumkan) hanya bisa oleh akun KPA.`));
            const saved = store.get('ov:' + S.ctx.kodeSatker, null);
            if (saved) S.overrides = saved;
            muatKeadaan();
        });

        const input = h('input', { type: 'file', accept: '.pdf', multiple: true, style: { display: 'none' }, onchange: e => onFiles([...e.target.files]) });
        const dirInput = h('input', { type: 'file', webkitdirectory: true, style: { display: 'none' }, onchange: e => onFiles([...e.target.files]) });
        const drop = h('div', { class: 'drop', onclick: () => input.click() },
            h('div', { style: { fontSize: '15px', fontWeight: 600, color: '#1F497D' } }, 'Unggah PDF Rincian Kertas Kerja Satker (RKK) atau FA Detail 16 Segmen'),
            h('div', {}, 'Klik atau seret file ke sini. Boleh banyak file sekaligus — yang dipakai hanya milik satker yang sedang login.'));
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('hover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
        drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('hover'); onFiles([...e.dataTransfer.files]); });
        const info = h('div', {});
        body.append(h('div', { class: 'card' }, h('h3', {}, 'Data anggaran (DIPA terbaru)'),
            h('p', { class: 'note' }, 'Sejak integrasi SAKTI–SiRUP diputus (31 Juli 2026), RKA di SiRUP tidak ikut revisi DIPA. Tool ini membaca DIPA langsung dari PDF SAKTI.'),
            drop, input, dirInput, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => dirInput.click() }, '📁 Pilih folder'), h('span', { class: 'muted' }, 'FA Detail lebih disarankan: memuat Pagu Revisi terkini (termasuk revisi POK).')),
            info));
        if (S.dipa) showDipaInfo(info);

        async function onFiles(files) {
            files = files.filter(f => /\.pdf$/i.test(f.name));
            if (!files.length) return;
            await guard(async () => {
                const kode = S.ctx && S.ctx.kodeSatker;
                let cand = kode ? files.filter(f => f.name.includes(kode)) : files;
                if (!cand.length) cand = files.length <= 3 ? files : [];
                if (!cand.length) throw new Error(`Tidak ada file yang namanya memuat kode satker ${kode}. Pilih file satker ini saja.`);
                cand.sort((a, b) => (/FA_Detail/i.test(b.name) - /FA_Detail/i.test(a.name)) || b.lastModified - a.lastModified);
                const f = cand[0];
                if (cand.length > 1) log(`${cand.length} file cocok; dipakai ${f.name} (FA Detail diutamakan).`, 'w');
                info.innerHTML = ''; const pg = progress(); info.append(h('div', {}, 'Membaca ' + f.name), pg);
                if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js belum termuat. Muat ulang halaman.');
                pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
                const res = await DipaParser.parse(pdfjsLib, new Uint8Array(await f.arrayBuffer()), (a, b) => pg.set(a, b));
                if (kode && res.meta.satker && res.meta.satker !== kode) throw new Error(`PDF ini milik satker ${res.meta.satker}, sedangkan login Anda satker ${kode}.`);
                const thPdf = +(String(res.meta.periode || '').match(/(20\d\d)/) || [])[1];
                if (thPdf && S.ctx && S.ctx.tahun && thPdf !== S.ctx.tahun) throw new Error(`PDF ini DIPA tahun ${thPdf}, sedangkan tahun anggaran SiRUP ${S.ctx.tahun}. Ganti tahun di SiRUP atau unggah DIPA tahun yang sama.`);
                // RKK ikut diunggah? pakai untuk melengkapi nama node & lokasi KRO yang tidak ada di FA
                const pendamping = cand.find(x => x !== f && /FA_Detail/i.test(x.name) !== /FA_Detail/i.test(f.name));
                if (pendamping) {
                    const r2 = await DipaParser.parse(pdfjsLib, new Uint8Array(await pendamping.arrayBuffer()));
                    if (r2.meta.satker && res.meta.satker && r2.meta.satker !== res.meta.satker) throw new Error(`${pendamping.name} milik satker ${r2.meta.satker}, bukan ${res.meta.satker}.`);
                    const g = Analysis.gabungDipa(res, r2);
                    log(`${pendamping.name} dipakai untuk melengkapi ${g.node} nama node, lokasi KRO, sumber dana, serta volume & harga ${g.item} item.`, 'o');
                }
                S.dipa = res; S.dipaFile = f.name; S.an = null; S.ren = null;
                log(`DIPA terbaca: ${res.meta.jenis} ${res.meta.satker}, ${res.items.length} baris detail, total Rp${fmt(res.check.itemTotal)}.`, 'o');
                showDipaInfo(info);
            });
        }
    }
    function kpi(v, l) { return h('div', { class: 'kpi' }, h('b', {}, v), h('span', {}, l)); }
    function showDipaInfo(el) {
        const d = S.dipa; el.innerHTML = '';
        const byProg = [...d.nodes.values()].filter(n => n.level === 'prog');
        el.append(h('div', { class: 'kpis', style: { marginTop: '10px' } },
            kpi(d.meta.jenis === 'FA' ? 'FA Detail 16 Segmen' : 'Rincian Kertas Kerja', 'Jenis dokumen'),
            kpi(d.meta.satker + (d.meta.periode ? ' · ' + d.meta.periode : ''), 'Satker / periode'),
            kpi('Rp' + fmt(d.check.itemTotal), 'Total pagu (jumlah item)'),
            kpi(`${d.items.length} item · ${d.meta.halaman} hlm`, 'Baris detail')),
            d.check.ok && !d.check.mismatches.length ? h('div', { class: 'okbox' }, `Rekonsiliasi lolos: jumlah seluruh item = total alokasi${d.meta.total ? ' Rp' + fmt(d.meta.total) : ''}, dan setiap subtotal cocok.`)
                : h('div', { class: 'warnbox' }, `Ada ${d.check.mismatches.length} subtotal yang tidak cocok dengan jumlah itemnya (total dokumen Rp${fmt(d.meta.total)}, jumlah item Rp${fmt(d.check.itemTotal)}). Periksa PDF sumber sebelum eksekusi.`),
            h('div', { class: 'muted' }, 'Program: ' + byProg.map(p => `${p.kode} Rp${fmt(p.pagu)}`).join(' · ')),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn pri', onclick: () => go(1) }, 'Lanjut: cek struktur PKKR →')));
    }

    // ── 2. PKKR ─────────────────────────────────────────────────────────
    function needDipa() { if (!S.dipa || !S.ctx || !S.ctx.login) { body.append(h('div', { class: 'warnbox' }, 'Selesaikan langkah 1 (login + unggah PDF) terlebih dahulu.')); return true; } return false; }
    function stepPkkr() {
        if (needDipa()) return;
        const box = h('div', {});
        body.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => guard(async () => { await loadPkkr(true); go(1); }) }, '↻ Baca ulang PKKR SiRUP')), box);
        guard(async () => {
            await loadPkkr(false);
            ensureAnalysis();
            const diff = Analysis.diffPkkr(S.dipa.nodes, S.an.akun, S.pkkr);
            const lvName = { prog: 'Program', keg: 'Kegiatan', kro: 'KRO', ro: 'RO', komp: 'Komponen', sub: 'Sub Komponen' };
            box.append(h('div', { class: 'kpis', style: { marginTop: '10px' } },
                kpi(String(S.pkkr.size), 'Node PKKR di SiRUP'), kpi(String(diff.baru.length), 'Cabang DIPA belum ada di PKKR'),
                kpi(String(diff.baru.filter(n => n.pilih).length), '…yang memuat pagu pengadaan'), kpi(String(diff.beda.length), 'Pagu berbeda')));
            if (!diff.baru.length) box.append(h('div', { class: 'okbox' }, 'Semua cabang DIPA sudah ada di PKKR SiRUP.'));
            else {
                const ppkSel = h('select', {}, h('option', { value: '' }, '— tanpa delegasi PPK —'), ...S.ppk.map(p => h('option', { value: p.id }, p.nama)));
                diff.baru.sort((a, b) => a.key.localeCompare(b.key));
                const rows = diff.baru.map(n => {
                    const cb = h('input', { type: 'checkbox', checked: n.pilih });
                    cb.addEventListener('change', () => { n.pilih = cb.checked; });
                    const depth = n.key.split('.').length - 1;
                    return h('tr', {}, h('td', {}, cb), h('td', {}, lvName[n.level]),
                        h('td', { class: 'mono', style: { paddingLeft: 7 + depth * 12 + 'px' } }, n.key),
                        h('td', {}, (() => { const i = h('input', { type: 'text', value: n.nama || '', placeholder: 'nama tidak terbaca — isi sesuai DIPA', style: { width: '100%', minWidth: '260px', borderColor: n.nama ? '' : '#b91c1c' } }); i.addEventListener('input', () => { n.nama = i.value.trim(); }); return i; })()),
                        h('td', { class: 'n' }, fmt(n.pagu)), h('td', { class: 'n' }, n.pengadaan ? fmt(n.pengadaan) : pill('non-pengadaan', 'p-np')));
                });
                box.append(h('h3', {}, 'Cabang baru di DIPA'),
                    h('p', { class: 'note' }, 'Default: hanya cabang yang memuat belanja pengadaan yang dicentang (cabang gaji/non-pengadaan dilewati). SiRUP menolak cabang Manual di bawah node Integrasi, jadi cabang dibuat dalam rantai PKKR Manual paralel dari level Program (nama Program/Kegiatan diberi akhiran "(Manual)", kode tetap sama). Rincian node yang akan dibuat ditampilkan sebelum dijalankan.'),
                    h('div', { class: 'tbl' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Level'), h('th', {}, 'Kode'), h('th', {}, 'Uraian'), h('th', { class: 'n' }, 'Pagu DIPA'), h('th', { class: 'n' }, 'Pagu pengadaan'))), h('tbody', {}, rows))),
                    h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', {}, 'Delegasikan ke PPK:'), ppkSel,
                        h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(() => runPkkr(diff.baru, ppkSel.value)) }, 'Tambahkan cabang terpilih ke PKKR (rantai Manual)')));
            }
            if (diff.beda.length) box.append(h('details', { style: { marginTop: '12px' } }, h('summary', {}, `Pagu berbeda (${diff.beda.length}) — node integrasi terkunci, hanya informasi`),
                h('div', { class: 'tbl' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Kode'), h('th', {}, 'Uraian'), h('th', { class: 'n' }, 'DIPA'), h('th', { class: 'n' }, 'SiRUP'), h('th', {}, 'Jenis'))),
                    h('tbody', {}, diff.beda.map(b => h('tr', {}, h('td', { class: 'mono' }, b.key), h('td', {}, b.nama), h('td', { class: 'n' }, fmt(b.paguDipa)), h('td', { class: 'n' }, fmt(b.paguSirup)), h('td', {}, b.manual ? 'Manual' : 'Integrasi'))))))));
            if (diff.hilang.length) box.append(h('details', {}, h('summary', {}, `Ada di PKKR SiRUP tetapi tidak ada di DIPA (${diff.hilang.length})`),
                h('div', { class: 'tbl' }, h('table', { class: 't' }, h('tbody', {}, diff.hilang.map(b => h('tr', {}, h('td', { class: 'mono' }, b.key), h('td', {}, b.nama), h('td', { class: 'n' }, fmt(b.pagu)))))))));
            box.append(sekPenyesuaianPkkr());
            box.append(h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn pri', onclick: () => go(2) }, 'Lanjut: sanding RUP →')));
        });
    }
    async function loadPkkr(force) {
        if (S.pkkr && !force) return;
        log('Membaca pohon PKKR SiRUP…');
        S.pkkr = await Sirup.crawlPkkr(S.ctx.tahun);
        if (!S.ppk.length) S.ppk = await Sirup.daftarPpk(([...S.pkkr.values()].find(n => n.level === 'komp') || {}).id);
        log(`PKKR terbaca: ${S.pkkr.size} node.`, 'o');
        S.an = null;
    }
    // Cara BPPP Tegal: SiRUP menolak cabang Manual di bawah node Integrasi (pagu integrasi beku di
    // nilai lama). Cabang baru dibuat dalam rantai PKKR Manual paralel mulai dari Program, dengan kode
    // sama (MAK paket tetap identik) dan pagu tiap salinan = jumlah pagu cabang baru di bawahnya.
    function rencanaManual(nodes) {
        const pilih = nodes.filter(n => n.pilih);
        const keys = new Set(pilih.map(n => n.key));
        const LVN = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub'];
        const plan = new Map();
        // puncak cabang baru: node terpilih yang induknya tidak ikut dipilih
        const puncak = pilih.filter(n => !keys.has(n.parentKey));
        for (const top of puncak) {
            const parts = top.key.split('.');
            for (let i = 1; i < parts.length; i++) {
                const k = parts.slice(0, i).join('.');
                const ada = S.pkkr.get(k);
                const sudahManual = ada && (ada.manual || ada.manualTwin);
                if (sudahManual) continue;                       // rantai Manual sudah ada di level ini
                const d = S.dipa.nodes.get(k) || {};
                const x = plan.get(k) || { key: k, level: LVN[i - 1], kode: parts[i - 1], parentKey: parts.slice(0, i - 1).join('.'),
                    nama: ((ada && ada.nama) || d.uraian || '').replace(/\s*\(Manual\)$/, '') + (i <= 2 ? ' (Manual)' : ''), pagu: 0, salinan: true };
                x.pagu += top.pagu || 0;
                plan.set(k, x);
            }
        }
        for (const n of pilih) plan.set(n.key, { ...n, salinan: false });
        return [...plan.values()].sort((a, b) => a.key.split('.').length - b.key.split('.').length || a.key.localeCompare(b.key));
    }
    // id induk di rantai Manual (salinan terbaru), atau node Manual yang sudah ada
    function indukManual(key) {
        const n = key && S.pkkr.get(key);
        if (!n) return null;
        if (n.manual) return n;
        return n.manualTwin || null;
    }
    async function runPkkr(nodes, idPpk) {
        const rencana = rencanaManual(nodes);
        if (!rencana.length) return;
        const lv = { prog: 'Program', keg: 'Kegiatan', kro: 'KRO', ro: 'RO', komp: 'Komponen', sub: 'Sub Komponen' };
        const ok = await confirmBox('Tambah cabang PKKR (rantai Manual paralel)', `<p>SiRUP menolak cabang Manual di bawah node Integrasi, jadi cabang baru dibuat di <b>rantai PKKR Manual paralel</b> mulai dari Program (cara BPPP Tegal). Kode sama dengan DIPA, sehingga MAK paket tetap sama.</p>
            <div class="tbl"><table class="t"><tr><th>Level</th><th>Kode</th><th>Nama</th><th class="n">Pagu</th><th></th></tr>${rencana.map(n => `<tr><td>${lv[n.level]}</td><td class="mono">${esc(n.key)}</td><td>${esc(n.nama)}</td><td class="n">${fmt(n.pagu)}</td><td>${n.salinan ? '<span class="pill p-info">salinan induk</span>' : '<span class="pill p-ok">cabang baru</span>'}</td></tr>`).join('')}</table></div>
            <p class="note">${rencana.length} node akan dibuat. Tindakan ini mengubah data SiRUP; hapus manual lewat Kelola PKKR bila salah.</p>`);
        if (!ok) return;
        for (const n of rencana) {
            if (S.stop) break;
            const parent = n.level === 'prog' ? null : indukManual(n.parentKey);
            if (n.level !== 'prog' && !parent) throw new Error(`Induk Manual ${n.parentKey} belum ada — proses dihentikan.`);
            if (!n.nama) throw new Error(`Nama ${n.key} kosong — isi dulu di tabel.`);
            const rs = await Sirup.tambahPkkr(S.ctx, n, parent && parent.id, idPpk);
            const id = await Sirup.cariNodeBaru(S.ctx, n.level, parent && parent.id, n.kode);
            const lama = S.pkkr.get(n.key);
            if (!id || (lama && !lama.manual && lama.id === id) || (lama && lama.manualTwin && lama.manualTwin.id === id && n.salinan === false)) {
                const form = { prog: 'formprogram', keg: `formkegiatan?idProgram=${parent && parent.id}`, kro: `formoutput?idKegiatan=${parent && parent.id}`, ro: `formsuboutput?idOutput=${parent && parent.id}`, komp: `formkomponen?idSubOutput=${parent && parent.id}`, sub: `formsubkomponen?idKomponen=${parent && parent.id}` }[n.level];
                const flash = await Sirup.bacaFlash(`/sirup/programctr/${form}`);
                const isiHal = rs && !rs.redirected ? ' ' + (await rs.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200) : '';
                throw new Error(`SiRUP tidak menyimpan ${lv[n.level]} ${n.key}${parent ? ` di bawah ${parent.key} (id ${parent.id})` : ''}. ${flash ? 'Pesan SiRUP: ' + flash : 'SiRUP tidak memberi pesan.'}${isiHal}`);
            }
            const node = { id, level: n.level, kode: n.kode, nama: n.nama, pagu: n.pagu, key: n.key, manual: true, parentId: parent && parent.id };
            if (lama && !lama.manual) lama.manualTwin = node; else S.pkkr.set(n.key, node);
            log(`PKKR Manual + ${lv[n.level]} ${n.key} (id ${id})`, 'o');
            await Sirup.sleep(S.cfg.jeda);
        }
        log('Rantai PKKR Manual selesai. Membaca ulang PKKR…', 'o');
        await loadPkkr(true);
        S.an = null;
        go(1);
    }

    // ── 2b. Penyesuaian node PKKR Manual ────────────────────────────────
    // Node Integrasi terkunci; yang bisa diubah hanya node Manual (rencana dari PkkrPlan). Pemakaian node
    // dicek dari id komponen di detail paket penyedia dan jalur komponen paket swakelola.
    const LV_NAMA = { prog: 'Program', keg: 'Kegiatan', kro: 'KRO', ro: 'RO', komp: 'Komponen', sub: 'Sub Komponen' };
    const pkkrPilih = new Map();
    const kunciPkkr = x => `${x.aksi}:${x.key}:${x.id}`;
    const pkkrDipilih = x => pkkrPilih.has(kunciPkkr(x)) ? pkkrPilih.get(kunciPkkr(x)) : x.aksi === 'ubah' || x.bisa;
    const gantiPaguPkkr = x => Math.abs(x.paguBaru - x.pagu) > 1000;
    function rencanaPkkr() {
        const adj = PkkrPlan.susun({ dipaNodes: S.dipa.nodes, pkkr: S.pkkr, pakets: S.pakets || [], swakelola: S.swakelola || [] });
        const dalam = x => x.key.split('.').length;
        // pemakaian belum bisa dicek sebelum paket RUP dibaca → jangan dinonaktifkan dulu
        adj.non = adj.nonaktif.map(x => ({ ...x, aksi: 'nonaktif', bisa: x.bisa && !!S.pakets }));
        const ubah = adj.ubah.map(x => ({ ...x, aksi: 'ubah' }));
        const turun = ubah.filter(x => x.paguBaru < x.pagu - 1000).sort((a, b) => dalam(b) - dalam(a));
        const naik = ubah.filter(x => !(x.paguBaru < x.pagu - 1000)).sort((a, b) => dalam(a) - dalam(b));
        // urutan aman: nonaktifkan (anak dulu) → turunkan pagu (anak dulu) → naikkan pagu / ganti nama (induk dulu)
        adj.urut = [...adj.non.filter(x => x.bisa), ...turun, ...naik];
        adj.ubahTampil = ubah;
        return adj;
    }
    function sekPenyesuaianPkkr() {
        const adj = rencanaPkkr();
        const card = h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, 'Penyesuaian PKKR Manual'),
            h('p', { class: 'note' }, 'Node hasil integrasi SAKTI terkunci sejak 31 Juli 2026; yang bisa disesuaikan hanya node Manual. Pagu salinan induk (Program/Kegiatan "(Manual)" dst.) = jumlah cabang Manual di bawahnya, pagu cabang Manual = pagu DIPA, catatan "[..]" dari SAKTI dibuang dari nama, dan node Manual yang tidak ada lagi di DIPA dinonaktifkan bila tidak dipakai paket mana pun.'));
        if (!adj.manual) { card.append(h('div', { class: 'muted' }, 'Satker ini belum punya node PKKR Manual — tidak ada yang perlu disesuaikan.')); return card; }
        if (!adj.ubah.length && !adj.non.length) { card.append(h('div', { class: 'okbox' }, `${adj.manual} node Manual sudah sesuai DIPA.`)); return card; }
        const tombol = [];
        const segar = () => { const n = adj.urut.filter(pkkrDipilih).length; for (const [b, f] of tombol) { b.disabled = !S.ctx.isKPA || !n; if (f) b.textContent = f(n); } };
        const cb = x => { const c = chk(pkkrDipilih(x), v => { pkkrPilih.set(kunciPkkr(x), v); segar(); }); if (x.aksi === 'nonaktif' && !x.bisa) { c.checked = false; c.disabled = true; } return c; };
        const kecil = t => h('div', { class: 'muted', style: { fontSize: '12.5px' } }, t);
        if (adj.ubahTampil.length) card.append(h('h4', { style: { marginTop: '6px' } }, `Ubah pagu / nama (${adj.ubahTampil.length})`),
            h('div', { class: 'tbl', style: { maxHeight: '340px' } }, h('table', { class: 't' },
                h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Level'), h('th', {}, 'Kode'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Pagu sekarang'), h('th', { class: 'n' }, 'Pagu baru'), h('th', {}, 'Dasar'))),
                h('tbody', {}, adj.ubahTampil.map(x => h('tr', {}, h('td', {}, cb(x)), h('td', {}, LV_NAMA[x.level], x.salinan ? kecil('salinan induk') : null), h('td', { class: 'mono' }, x.key),
                    h('td', {}, x.namaBaru !== x.nama ? [h('del', {}, x.nama), h('div', {}, h('ins', {}, x.namaBaru))] : x.nama),
                    h('td', { class: 'n' }, fmt(x.pagu)), h('td', { class: 'n' }, gantiPaguPkkr(x) ? h('b', {}, fmt(x.paguBaru)) : h('span', { class: 'muted' }, 'tetap')),
                    h('td', {}, kecil(x.ket))))))));
        if (adj.non.length) card.append(h('h4', { style: { marginTop: '16px' } }, `Nonaktifkan — tidak ada lagi di DIPA (${adj.non.length})`),
            !S.pakets ? h('div', { class: 'infobox row' }, h('span', { style: { flex: 1 } }, 'Pemakaian node oleh paket RUP belum dicek, jadi belum ada node yang bisa dinonaktifkan.'),
                h('button', { class: 'btn sm', onclick: () => guard(async () => { await loadPakets(false); go(1); }) }, 'Cek pemakaian (baca paket RUP)')) : '',
            h('div', { class: 'tbl', style: { maxHeight: '340px' } }, h('table', { class: 't' },
                h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Level'), h('th', {}, 'Kode'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Pagu'), h('th', {}, 'Pemakaian'), h('th', {}, 'Alasan'))),
                h('tbody', {}, adj.non.map(x => h('tr', {}, h('td', {}, cb(x)), h('td', {}, LV_NAMA[x.level], x.salinan ? kecil('salinan induk') : null), h('td', { class: 'mono' }, x.key), h('td', {}, x.nama), h('td', { class: 'n' }, fmt(x.pagu)),
                    h('td', {}, !S.pakets ? pill('belum dicek', 'p-mut') : x.dipakai.length ? [pill('dipakai', 'p-bad'), kecil(x.dipakai.slice(0, 6).join(', ') + (x.dipakai.length > 6 ? ` +${x.dipakai.length - 6}` : ''))] : pill('tidak dipakai', 'p-ok')),
                    h('td', {}, kecil(x.alasan))))))));
        if (adj.swTakTerbaca) card.append(h('div', { class: 'warnbox', style: { marginTop: '10px' } }, `${adj.swTakTerbaca} paket swakelola aktif tidak menampilkan jalur komponennya, sehingga pemakaiannya tidak bisa dicek. Periksa dulu di SiRUP sebelum menonaktifkan node.`));
        if (adj.terkunci.length) card.append(kecil(`${adj.terkunci.length} node Integrasi berbeda dari DIPA atau tidak ada lagi di DIPA — terkunci, hanya informasi (lihat "Pagu berbeda" di atas).`));
        const b1 = h('button', { class: 'btn', onclick: () => guard(() => jalankanPkkr(true)) }, 'Jalankan 1 penyesuaian');
        const bN = h('button', { class: 'btn go', onclick: () => guard(() => jalankanPkkr(false)) });
        tombol.push([b1, null], [bN, n => n ? `Jalankan ${n} penyesuaian terpilih` : 'Tidak ada yang bisa dijalankan']);
        card.append(h('div', { class: 'row', style: { marginTop: '12px' } }, b1, bN,
            h('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'Belum pernah dijalankan di produksi — mulai dengan "Jalankan 1", lalu cek hasilnya di Kelola PKKR SiRUP.')));
        segar();
        return card;
    }
    async function jalankanPkkr(satu) {
        let adj = rencanaPkkr();
        if (adj.urut.some(x => x.aksi === 'nonaktif' && pkkrDipilih(x))) {
            // pemakaian bisa berubah sejak paket dibaca (mis. PPK membuat paket baru) → cek ulang sebelum menonaktifkan
            const sig = ps => ps.map(p => `${p.id}:${p.status}:${p.pagu}`).sort().join(',');
            const py = await Sirup.daftarPaket(S.ctx.tahun, 'penyedia');
            S.swakelola = await Sirup.daftarPaket(S.ctx.tahun, 'swakelola').catch(() => S.swakelola || []);
            if (sig(py) !== sig(S.pakets || [])) { log('Daftar paket berubah sejak dibaca — membaca ulang detail paket sebelum menonaktifkan node…', 'w'); await loadPakets(true); }
            adj = rencanaPkkr();
        }
        let daftar = adj.urut.filter(pkkrDipilih);
        if (satu) daftar = daftar.slice(0, 1);
        if (!daftar.length) { log('Tidak ada penyesuaian PKKR yang dipilih (atau node yang dipilih ternyata dipakai paket).', 'w'); go(1); return; }
        const ok = await confirmBox(satu ? 'Jalankan 1 penyesuaian PKKR' : `Jalankan ${daftar.length} penyesuaian PKKR`,
            `<p>Hanya node Manual yang diubah. Urutan: nonaktifkan (anak dulu) → turunkan pagu (anak dulu) → naikkan pagu / ganti nama (induk dulu).</p>
            <div class="tbl"><table class="t"><tr><th>#</th><th>Tindakan</th><th>Node</th><th>Perubahan</th></tr>${daftar.map((x, i) => `<tr><td>${i + 1}</td><td>${x.aksi === 'nonaktif' ? '<span class="pill p-bad">nonaktifkan</span>' : '<span class="pill p-info">ubah</span>'}</td><td><span class="mono">${esc(x.key)}</span><br><span class="muted">${LV_NAMA[x.level]} · ${esc(x.nama)}</span></td><td>${x.aksi === 'nonaktif' ? `pagu Rp${fmt(x.pagu)} · ${esc(x.alasan)}`
                : [gantiPaguPkkr(x) ? `pagu Rp${fmt(x.pagu)} → <b>Rp${fmt(x.paguBaru)}</b>` : '', x.namaBaru !== x.nama ? `nama → <b>${esc(x.namaBaru)}</b>` : ''].filter(Boolean).join('<br>')}</td></tr>`).join('')}</table></div>
            <p class="note">Tindakan ini mengubah PKKR SiRUP atas nama akun KPA. Node yang dinonaktifkan bisa diaktifkan lagi lewat Kelola PKKR SiRUP.</p>`);
        if (!ok) return;
        let n = 0;
        try {
            for (const x of daftar) {
                if (S.stop) { log('Dihentikan.', 'w'); break; }
                if (x.aksi === 'nonaktif') {
                    await Sirup.nonaktifkanPkkr(x);
                    log(`PKKR Manual: ${LV_NAMA[x.level]} ${x.key} dinonaktifkan`, 'o');
                } else {
                    const gp = gantiPaguPkkr(x), gn = x.namaBaru !== x.nama;
                    const r = await Sirup.ubahPkkr(x, { nama: gn ? x.namaBaru : null, pagu: gp ? x.paguBaru : null, alasan: 'Penyesuaian dengan DIPA revisi terakhir' });
                    log(`PKKR Manual: ${LV_NAMA[x.level]} ${x.key} → ${[gp ? 'pagu Rp' + fmt(r.pagu) : '', gn ? `nama "${r.nama}"` : ''].filter(Boolean).join(', ')}`, 'o');
                }
                n++;
                pkkrPilih.delete(kunciPkkr(x));
                await Sirup.sleep(S.cfg.jeda);
            }
        } finally {
            if (n) {
                log('Membaca ulang PKKR…');
                await loadPkkr(true);
                const masih = daftar.slice(0, n).filter(x => x.aksi === 'nonaktif').filter(x => { const p = S.pkkr.get(x.key); const m = p && (p.manual ? p : p.manualTwin); return m && String(m.id) === String(x.id); });
                if (masih.length) log(`PERHATIAN: ${masih.map(x => x.key).join(', ')} masih terbaca di PKKR setelah dinonaktifkan — cek di Kelola PKKR SiRUP.`, 'w');
                S.an = null; go(1);
            }
        }
    }

    // ── 3. Sanding ─────────────────────────────────────────────────────
    function ensureAnalysis() {
        if (S.an) return;
        const cekKeputusan = {};
        for (const [k, v] of Object.entries(S.kep || {})) if (k.startsWith('cek:') && v && v.opsi) cekKeputusan[k.slice(4)] = v.opsi;
        const { nodes, akun } = Analysis.buildDipa(S.dipa, S.overrides, { cekSebagai: S.cfg.cekSebagai, cekKeputusan });
        S.an = { nodes, akun, orphans: [] };
        if (S.pakets) {
            const r = Analysis.sanding(akun, S.pakets);
            S.an.orphans = r.orphans;
            for (const p of S.pakets) Object.assign(p, Analysis.verdictPaket(p, akun));
            susunRencana();
        }
    }
    async function loadPakets(force) {
        if (S.pakets && !force) return;
        const list = await Sirup.daftarPaket(S.ctx.tahun, 'penyedia');
        S.swakelola = await Sirup.daftarPaket(S.ctx.tahun, 'swakelola').catch(() => []);
        log(`Paket penyedia: ${list.length}, swakelola: ${S.swakelola.length}. Membaca detail…`);
        const pg = progress(); body.prepend(pg);
        let i = 0;
        for (const p of list) {
            if (S.stop) throw new Error('Dihentikan.');
            await Sirup.detailPaket(p, S.ctx.tahun);
            pg.set(++i, list.length);
        }
        pg.remove();
        // kode BA/eselon/satker/KLDI diambil dari data paket satker ini sendiri (bukan diasumsikan)
        const mode = xs => Object.entries(xs.filter(Boolean).reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).map(([v]) => v)[0] || '';
        const rows = list.flatMap(p => p.sumberDana || []);
        const kodePaket = mode(rows.map(r => r.kodeSatker));
        if (kodePaket && S.ctx.kodeSatker && kodePaket !== S.ctx.kodeSatker) throw new Error(`Paket RUP yang terbaca milik satker ${kodePaket}, sedangkan login terbaca satker ${S.ctx.kodeSatker}. Muat ulang halaman SiRUP lalu coba lagi.`);
        if (kodePaket && S.dipa && S.dipa.meta.satker && kodePaket !== S.dipa.meta.satker) throw new Error(`PDF DIPA milik satker ${S.dipa.meta.satker}, sedangkan paket RUP akun ini milik satker ${kodePaket}. Unggah DIPA satker yang sedang login.`);
        if (!S.ctx.kodeSatker && kodePaket) { S.ctx.kodeSatker = kodePaket; muatKeadaan(); log(`Kode satker ${kodePaket} diambil dari data paket.`, 'w'); }
        Object.assign(S.ctx, { kodeBA: mode(rows.map(r => r.kodeInstansi)) || S.ctx.kodeBA || '', kodeEselon: mode(rows.map(r => r.kodeEselon)) || S.ctx.kodeEselon || '', kodeKldi: mode(rows.map(r => r.asal)) || S.ctx.kodeKldi || '' });
        S.pakets = list; S.an = null;
        log('Detail paket selesai dibaca.', 'o');
    }
    function stepSanding() {
        if (needDipa()) return;
        const box = h('div', {});
        body.append(h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: () => guard(async () => { await loadPakets(true); go(2); }) }, '↻ Baca ulang paket RUP'),
            h('button', { class: 'btn', onclick: () => { S.overrides = {}; store.set('ov:' + S.ctx.kodeSatker, {}); S.an = null; go(2); } }, 'Reset klasifikasi manual')), box);
        guard(async () => {
            await loadPkkr(false);
            await loadPakets(false);
            ensureAnalysis();
            const A = [...S.an.akun.values()];
            const sum = f => A.reduce((s, a) => s + f(a), 0);
            const P = sum(a => a.P), NP = sum(a => a.NP), CEK = sum(a => a.CEK), U = sum(a => a.rupU);
            const orphU = S.an.orphans.filter(o => o.status === '3').reduce((s, o) => s + o.pagu, 0);
            box.append(h('div', { class: 'kpis', style: { marginTop: '10px' } },
                kpi('Rp' + fmt(P), 'Pagu pengadaan DIPA'), kpi('Rp' + fmt(NP), 'Non-pengadaan'), kpi('Rp' + fmt(CEK), 'Perlu dicek'),
                kpi('Rp' + fmt(U), 'RUP terumumkan pada MAK DIPA'), kpi('Rp' + fmt(orphU), 'RUP terumumkan ber-MAK di luar DIPA'),
                kpi(P ? (U / P * 100).toFixed(1).replace('.', ',') + '%' : '–', 'Terumumkan ÷ pagu pengadaan')));
            const flt = h('select', {}, ...[['', 'Semua status'], ['KURANG', 'Kurang'], ['LEBIH', 'Lebih'], ['NP_TERUMUMKAN', 'NP terumumkan'], ['CEK', 'Perlu cek'], ['SESUAI', 'Sesuai'], ['NP', 'Non-pengadaan']].map(([v, t]) => h('option', { value: v }, t)));
            const q = h('input', { type: 'text', placeholder: 'cari MAK / uraian…' });
            const tb = h('tbody', {});
            const draw = () => {
                tb.innerHTML = '';
                const fv = flt.value, qv = q.value.toLowerCase();
                for (const a of A.sort((x, y) => x.key.localeCompare(y.key))) {
                    if (fv && a.status !== fv) continue;
                    if (qv && !(a.key.toLowerCase().includes(qv) || a.nama.toLowerCase().includes(qv))) continue;
                    const [st, cls] = STATUS_PILL[a.status] || [a.status, 'p-mut'];
                    const tr = h('tr', { style: { cursor: 'pointer' } }, h('td', {}, h('div', { class: 'mono' }, a.key), h('div', { class: 'muted', style: { fontSize: '12.5px' } }, a.nama)), h('td', {}, pill(st, cls)),
                        h('td', { class: 'n' }, fmt(a.pagu)), h('td', { class: 'n' }, fmt(a.P)), h('td', { class: 'n' }, fmt(a.NP + a.CEK)),
                        h('td', { class: 'n' }, fmt(a.rupU)), h('td', { class: 'n' }, a.rupFD ? fmt(a.rupFD) : '–'), h('td', { class: 'n', style: { color: a.selisih > 1000 ? '#b45309' : a.selisih < -1000 ? '#b91c1c' : '' } }, fmt(a.selisih)));
                    const sub = h('tr', { class: 'sub', style: { display: 'none' } }, h('td', { colspan: 8 }, detailAkun(a)));
                    tr.addEventListener('click', () => { sub.style.display = sub.style.display === 'none' ? '' : 'none'; });
                    tb.append(tr, sub);
                }
            };
            flt.addEventListener('change', draw); q.addEventListener('input', draw);
            box.append(h('h3', {}, 'Sanding per akun (MAK 7 segmen)'),
                h('p', { class: 'note' }, 'Klik baris untuk melihat item DIPA dan paket RUP-nya. Klasifikasi item bisa diubah; rencana aksi dihitung ulang otomatis.'),
                h('div', { class: 'row' }, flt, q), h('div', { class: 'tbl', style: { marginTop: '6px' } }, h('table', { class: 't' },
                    h('thead', {}, h('tr', {}, ...['MAK / akun', 'Status', 'Pagu DIPA', 'Pengadaan', 'Non / cek', 'RUP terumumkan', 'RUP final draft', 'Selisih'].map((t, i) => h('th', { class: i >= 2 ? 'n' : '' }, t)))), tb)));
            draw();
            if (S.an.orphans.length) {
                const byPrefix = {};
                for (const o of S.an.orphans) { const k = o.mak.split('.').slice(0, 6).join('.'); byPrefix[k] = byPrefix[k] || { n: 0, pagu: 0 }; byPrefix[k].n++; if (o.status === '3') byPrefix[k].pagu += o.pagu; }
                box.append(h('details', { style: { marginTop: '10px' } }, h('summary', {}, `Baris MAK paket yang tidak ada di DIPA terbaru (${S.an.orphans.length})`),
                    h('table', { class: 't' }, h('tbody', {}, Object.entries(byPrefix).map(([k, v]) => h('tr', {}, h('td', { class: 'mono' }, k), h('td', {}, v.n + ' baris'), h('td', { class: 'n' }, 'terumumkan Rp' + fmt(v.pagu))))))));
            }
            box.append(h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn pri', onclick: () => go(3) }, 'Lanjut: rekap & eksekusi →')));
        });
    }
    function detailAkun(a) {
        const items = h('table', { class: 't' }, h('tbody', {}, a.items.map(it => {
            const sel = h('select', {}, ...['P', 'NP', 'CEK'].map(k => h('option', { value: k, selected: it.kelas === k }, { P: 'Pengadaan', NP: 'Non-pengadaan', CEK: 'Perlu cek' }[k])));
            sel.addEventListener('change', () => {
                S.overrides[it.iid] = sel.value; store.set('ov:' + S.ctx.kodeSatker, S.overrides);
                S.an = null; log(`Klasifikasi ${it.uraian.slice(0, 40)} → ${sel.value}`); go(2);
            });
            sel.addEventListener('click', e => e.stopPropagation());
            return h('tr', {}, h('td', {}, (it.grup ? it.grup + ' › ' : '') + it.uraian), h('td', { class: 'n' }, fmt(it.pagu)), h('td', {}, sel), h('td', { class: 'muted' }, it.alasan));
        })));
        const rup = a.rup.length ? h('table', { class: 't' }, h('tbody', {}, a.rup.map(r => h('tr', {}, h('td', { class: 'mono' }, r.paketId), h('td', {}, r.nama), h('td', {}, Analysis.ST[r.status] || r.status), h('td', { class: 'n' }, fmt(r.pagu))))))
            : h('div', { class: 'muted' }, 'Belum ada paket RUP pada MAK ini.');
        return h('div', { class: 'grid2' }, h('div', {}, h('b', {}, 'Item DIPA'), items), h('div', {}, h('b', {}, 'Paket RUP'), rup));
    }

    // ── 4. Rekap & eksekusi ────────────────────────────────────────────
    // Alur: (1) Putuskan kartu kebijakan → (2) periksa perubahan per paket → (3) paket baru →
    // (4) jalankan antrean. Keputusan, centang, dan isian disimpan per satker + tahun.
    const kunci = k => `${k}:${S.ctx.kodeSatker || 'x'}:${S.ctx.tahun}`;
    function muatKeadaan() {
        S.kep = store.get(kunci('kep'), {}); S.atur = store.get(kunci('atur'), {}); S.edit = store.get(kunci('edit'), {});
        S.pilih = new Map(Object.entries(store.get(kunci('pilih'), {})));
        S.lokasiSatker = store.get('lok:' + (S.ctx.kodeSatker || 'x'), null);
        S.antre = store.get(kunci('antre'), null);
    }
    function simpanKeadaan() { store.set(kunci('kep'), S.kep); store.set(kunci('atur'), S.atur); store.set(kunci('edit'), S.edit); store.set(kunci('pilih'), Object.fromEntries(S.pilih)); }
    const simpanAntre = () => store.set(kunci('antre'), S.antre);
    function komponenId(mak) {
        if (!S.pkkr) return null;
        const parts = mak.split('.');
        // sub-komponen ada di PKKR → komponen induknya (Integrasi atau rantai Manual)
        const sub = S.pkkr.get(parts.slice(0, 6).join('.'));
        if (sub && sub.parentId) return sub.parentId;
        const k = S.pkkr.get(parts.slice(0, 5).join('.'));
        return k ? ((k.manualTwin && k.manualTwin.id) || k.id) : null;
    }
    function susunRencana() {
        S.ren = Rencana.susun({ akunMap: S.an.akun, pakets: S.pakets, dipaNodes: S.an.nodes, cfg: S.cfg, tahun: S.ctx.tahun, hariIni: new Date(),
            keputusan: S.kep, atur: S.atur, lokasiSatker: S.lokasiSatker, lokasiRkk: S.lokRkk, komponenId, namaSatker: S.ctx.satkerNama || '' });
        terapkanEdit();
    }
    const FIELD_EDIT = ['nama', 'jenis', 'jenisList', 'metode', 'jadwal', 'lokasiRaw', 'uraian', 'spesifikasi', 'volume', 'praDipa', 'pdn', 'umkm', 'alasanUmkm', 'spp'];
    const salin = v => JSON.parse(JSON.stringify(v));
    function pkDariId(id) {
        if (!S.ren) return null;
        if (id.startsWith('b:')) return S.ren.paketBaru.find(b => b.id === id);
        const c = S.ren.perubahan.find(x => x.id === id);
        return c && c.pk;
    }
    function terapkanEdit() {
        for (const [id, e] of Object.entries(S.edit || {})) {
            const pk = pkDariId(id);
            if (!pk) continue;
            for (const k of FIELD_EDIT) if (e[k] !== undefined) pk[k] = salin(e[k]);
            if (e.anggaran && pk.baru) {
                if (e.anggaran.map(a => a.mak).join() === pk.anggaran.map(a => a.mak).join()) { pk.anggaran = salin(e.anggaran); pk.total = pk.anggaran.reduce((s, a) => s + (+a.pagu || 0), 0); }
                else delete e.anggaran; // kelompok paket berubah → isian pagu lama tidak berlaku
            }
        }
    }
    function catatEdit(id, pk, k) {
        S.edit[id] = S.edit[id] || {};
        S.edit[id][k] = salin(pk[k]);
        if (k === 'anggaran' && pk.baru) pk.total = pk.anggaran.reduce((s, a) => s + (+a.pagu || 0), 0);
        simpanKeadaan(); segarkanHeader();
    }
    const dipilih = x => S.pilih.has(x.id) ? S.pilih.get(x.id) : x.pilih !== false;
    function setPilih(id, v) { S.pilih.set(id, v); simpanKeadaan(); segarkanHeader(); }
    function hitungUlang() { const y = body.scrollTop; S.an = null; ensureAnalysis(); gambarRekap(); body.scrollTop = y; }
    function ubahKeputusan(id, patch) { S.kep[id] = Object.assign({}, S.kep[id] || {}, patch); simpanKeadaan(); hitungUlang(); }
    const fmtM = n => { const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' M' : a >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' jt' : fmt(n); };
    const namaNode = k => ((S.an && S.an.nodes.get(k)) || {}).uraian || '';

    // lokasi KRO di RKK ("KOTA JAKARTA PUSAT") → id provinsi/kabupaten SiRUP (disimpan di cache peramban)
    async function siapkanLokasi() {
        S.lokRkk = S.lokRkk || store.get('lokrkk', {});
        const teks = [...new Set([...S.dipa.nodes.values()].map(n => n.lokasi).filter(Boolean))].filter(t => !(t in S.lokRkk));
        if (!teks.length) return;
        const petunjuk = [S.lokasiSatker && S.lokasiSatker.id_provinsi, ...Object.entries((S.pakets || []).flatMap(p => (p.lokasiRaw || []).map(l => l.id_provinsi))
            .reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).map(([v]) => v)].filter(Boolean);
        for (const t of teks) {
            const r = await Sirup.cariKabupaten(t, petunjuk).catch(() => null);
            S.lokRkk[t] = r;
            log(r ? `Lokasi RKK "${t}" = ${r.kab}, ${r.prov}` : `Lokasi RKK "${t}" tidak ditemukan di daftar kabupaten SiRUP`, r ? 'o' : 'w');
        }
        store.set('lokrkk', S.lokRkk);
    }

    let rekapTab = 'putuskan', headEl = null;
    function stepRekap() {
        if (needDipa()) return;
        if (!S.pakets) { body.append(h('div', { class: 'warnbox' }, 'Jalankan langkah 3 (sanding RUP) dulu.')); return; }
        guard(async () => {
            await siapkanLokasi();
            if (!S.sa) S.sa = await Sirup.strukturAnggaran().catch(() => null);
            if (!S.alasanUmkmList) S.alasanUmkmList = await Sirup.alasanUmkm(S.ctx.tahun).catch(() => []);
            S.an = null; ensureAnalysis();
            gambarRekap();
        });
    }
    function gambarRekap() {
        if (S.step !== 3) return;
        body.innerHTML = ''; actEl.innerHTML = '';
        const r = S.ren;
        body.append(headerProyeksi());
        for (const w of r.peringatan) body.append(h('div', { class: 'warnbox' }, w));
        if (S.swakelola && S.swakelola.length) body.append(h('div', { class: 'infobox' }, `Satker ini punya ${S.swakelola.length} paket swakelola (Rp${fmt(S.swakelola.reduce((s, p) => s + p.pagu, 0))}) yang belum ikut disandingkan. Bila kekurangan sebuah akun sudah ditutup paket swakelola, pilih "abaikan" untuk akun itu di langkah 2.`));
        const belum = r.kartu.filter(k => !k.diputuskan).length;
        const nUbah = daftarPengajuan().length;
        const nAntre = S.antre ? S.antre.langkah.filter(x => x.status === 'menunggu').length : null;
        const TABS = [['putuskan', '1. Putuskan', belum ? `${belum} belum` : '✓'], ['ubah', '2. Pengajuan revisi', nUbah], ['baru', '3. Paket baru', r.paketBaru.length], ['jalankan', '4. Jalankan', nAntre == null ? '' : `${nAntre} antre`]];
        body.append(h('div', { class: 'seg' }, ...TABS.map(([k, l, n]) => h('button', { class: rekapTab === k ? 'on' : '', onclick: () => { rekapTab = k; gambarRekap(); body.scrollTop = 0; } }, l, n === '' ? null : h('span', { class: 'cnt' }, String(n))))));
        const el = h('div', {});
        body.append(el);
        ({ putuskan: tabPutuskan, ubah: tabPerubahan, baru: tabPaketBaru, jalankan: tabJalankan })[rekapTab](el);
    }
    function headerProyeksi() { headEl = h('div', { class: 'kpis proj' }); segarkanHeader(); return headEl; }
    function segarkanHeader() {
        if (!headEl || !S.ren) return;
        const p = Rencana.proyeksi(S.ren, S.pilih);
        const saTot = S.sa ? ['barjas', 'modal', 'sosial', 'hibah', 'lainnya'].reduce((s, k) => s + (S.sa[k] || 0), 0) : null;
        const dekat = Math.abs(p.setelah - p.target) <= Math.max(10 * (S.cfg.ambangSelisih || 1e6), 0.001 * p.target);
        const k = (v, l, cls, ket) => h('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, h('b', {}, v), h('span', {}, l), ket ? h('span', { class: 'ket' }, ket) : null);
        headEl.innerHTML = '';
        headEl.append(k('Rp' + fmtM(p.sekarang), 'RUP terumumkan sekarang'),
            k('Rp' + fmtM(p.setelah), 'Setelah rencana (yang dicentang)', dekat ? 'ok' : 'warn', `${p.setelah >= p.sekarang ? '+' : '−'}Rp${fmtM(Math.abs(p.setelah - p.sekarang))} dari sekarang`),
            k('Rp' + fmtM(p.target), 'Target: pagu pengadaan DIPA', '', dekat ? 'sudah sejalan' : `selisih ${p.setelah > p.target ? '+' : '−'}Rp${fmtM(Math.abs(p.setelah - p.target))}`),
            k(saTot == null ? '–' : 'Rp' + fmtM(saTot), 'Struktur anggaran di SiRUP', '', 'disamakan di langkah 5'));
    }
    const kosong = t => h('div', { class: 'empty' }, t);
    function barLanjut(label, tab) {
        return h('div', { class: 'actionbar' }, h('span', { class: 'sum' }, ringkasPilihan()), h('button', { class: 'btn pri', onclick: () => { rekapTab = tab; gambarRekap(); body.scrollTop = 0; } }, label));
    }
    function ringkasPilihan() {
        // dihitung per pengajuan yang benar-benar akan dikirim (sama dengan isi antrean)
        const pj = daftarPengajuan().filter(it => it.on && (it.jenis !== 'titip' || it.anak.some(dipilih)));
        const n = j => pj.filter(it => it.jenis === j).length;
        const baru = pj.filter(it => it.jenis === 'titip').reduce((s, it) => s + it.anak.filter(dipilih).length, 0);
        const fd = (pj.find(it => it.jenis === 'umumkan') || { daftar: [] }).daftar.filter(dipilih).length;
        const parts = [[n('ubah'), 'revisi 1→1'], [n('titip'), `revisi 1→N (${baru} paket baru)`], [fd, 'final draft diumumkan'], [n('batal'), 'pembatalan'], [n('batalFD'), 'kembali ke PPK']].filter(([x]) => x);
        const belum = S.ren.kartu.filter(k => !k.diputuskan).length;
        return (parts.length ? `Akan diajukan ${pj.length}: ` + parts.map(([x, l]) => `${x} ${l}`).join(' · ') : 'Belum ada pengajuan yang dipilih.') + (belum ? ` · ${belum} kartu belum diputuskan (tidak dijalankan)` : '');
    }

    // ── 4.1 Putuskan ────────────────────────────────────────────────────
    function tabPutuskan(el) {
        const r = S.ren;
        el.append(h('p', { class: 'note' }, 'Hanya hal yang butuh kebijakan Anda. Satu kartu mewakili satu kelompok paket. Kartu yang belum diputuskan tidak dijalankan, dan akun tujuannya tidak dibuatkan paket baru supaya tidak dobel.'));
        el.append(kartuLokasiSatker());
        const nilai = k => Math.abs(k.lebih || k.total || 0);
        const belum = r.kartu.filter(k => !k.diputuskan).sort((a, b) => nilai(b) - nilai(a));
        const manual = r.kartu.filter(k => k.diputuskan && !k.otomatis), oto = r.kartu.filter(k => k.otomatis);
        const kecil = belum.filter(k => k.jenis === 'PINDAH' && k.saran && Math.abs(k.lebih) < (S.cfg.ambangKeputusan || 100e6));
        if (kecil.length) el.append(h('div', { class: 'row', style: { marginBottom: '12px' } },
            h('button', { class: 'btn sm', onclick: () => { for (const k of kecil) S.kep[k.id] = { ...(S.kep[k.id] || {}), opsi: k.saran, target: k.target[0] }; simpanKeadaan(); hitungUlang(); } },
                `Pakai saran untuk ${kecil.length} kartu pindah MAK bernilai kecil`),
            h('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'tujuan hanya sama kegiatan — tetap periksa tujuannya')));
        if (belum.length) el.append(h('h3', {}, `Perlu keputusan (${belum.length})`), ...belum.map(kartuEl));
        if (manual.length) el.append(h('h3', { style: { marginTop: '20px' } }, `Sudah diputuskan (${manual.length})`), ...manual.map(kartuEl));
        if (oto.length) el.append(h('details', { style: { marginTop: '18px' } }, h('summary', {}, `Diputuskan otomatis sesuai aturan (${oto.length}) — klik untuk melihat atau mengubah`), ...oto.map(kartuEl)));
        if (!r.kartu.length) el.append(kosong('Tidak ada yang perlu diputuskan.'));
        actEl.append(barLanjut('Lanjut: periksa perubahan paket →', 'ubah'));
    }
    function kartuEl(k) {
        const badge = !k.diputuskan ? pill('Belum diputuskan', 'p-warn') : k.otomatis ? pill('Otomatis', 'p-mut') : pill('Diputuskan', 'p-ok');
        const box = h('div', { class: 'kartu' + (!k.diputuskan ? ' belum' : '') });
        box.append(h('div', { class: 'kartu-hd' }, h('div', {}, h('div', { class: 'item-title' }, k.judul), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '3px' } }, k.ringkas)), badge));
        if (k.jenis === 'PINDAH') { box.append(tabelBagian(k)); if (k.kandidatTujuan && k.kandidatTujuan.length > 1) box.append(pilihTujuan(k)); }
        if (k.jenis === 'LEBIH' || k.jenis === 'TANPA_PADANAN') box.append(tabelPaket(k.paket, k.ganda));
        if (k.jenis === 'NP') box.append(h('details', {}, h('summary', {}, `Lihat ${k.daftar.length} paket`), h('div', { class: 'tbl' }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Paket'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Non-pengadaan'), h('th', {}, 'Tindakan'), h('th', {}, 'Alasan'))),
            h('tbody', {}, k.daftar.map(x => h('tr', {}, h('td', { class: 'mono' }, x.paketId), h('td', {}, x.nama), h('td', { class: 'n' }, fmt(x.np)), h('td', {}, x.semua ? 'dibatalkan' : 'baris dikeluarkan'), h('td', { class: 'muted' }, x.alasan))))))));
        if (k.jenis === 'FD') { box.append(daftarFD(k)); return box; }
        const opsi = h('div', { class: 'opsi' });
        for (const o of k.opsi) {
            const on = k.pilihan === o.id;
            opsi.append(h('label', { class: 'op' + (on ? ' on' : '') },
                h('input', { type: 'radio', name: 'k-' + k.id, checked: on, onchange: () => ubahKeputusan(k.id, { opsi: o.id }) }),
                h('span', {}, h('b', {}, o.label), o.ket ? h('small', {}, o.ket) : null,
                    o.dampak ? h('small', { class: 'dampak' }, `Dampak ke RUP: ${o.dampak > 0 ? '+' : '−'}Rp${fmt(Math.abs(o.dampak))}`) : null)));
        }
        box.append(opsi);
        if (k.opsiFD) {
            const fd = h('div', { class: 'opsi fd' });
            for (const o of k.opsiFD) fd.append(h('label', { class: 'op' + (k.pilihanFD === o.id ? ' on' : '') },
                h('input', { type: 'radio', name: 'fd-' + k.id, checked: k.pilihanFD === o.id, onchange: () => ubahKeputusan(k.id, { fd: o.id }) }),
                h('span', {}, h('b', {}, o.label), h('small', {}, o.ket))));
            box.append(h('div', { class: 'sublabel' }, 'Final draft di kelompok ini'), fd);
        }
        if (k.jenis === 'PINDAH' && k.pilihan === 'susun' && k.susun) box.append(editorSusun(k));
        if (k.diputuskan && !k.otomatis) box.append(h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn sm ghost', onclick: () => { delete S.kep[k.id]; simpanKeadaan(); hitungUlang(); } }, 'Batalkan keputusan')));
        return box;
    }
    function tabelBagian(k) {
        const tb = h('tbody', {});
        for (const b of k.bucket) {
            const tr = h('tr', {}, h('td', {}, h('b', {}, b.label), b.jenis && b.jenis !== b.label ? h('div', { class: 'muted', style: { fontSize: '12px' } }, b.jenis) : null),
                h('td', { class: 'n' }, b.paket.length ? `${b.paket.length} paket` : h('span', { class: 'muted' }, 'belum ada paket')),
                h('td', { class: 'n' }, fmt(b.rup)), h('td', { class: 'n' }, b.fd ? fmt(b.fd) : '–'), h('td', { class: 'n' }, fmt(b.dipa)), h('td', { class: 'n' }, fmt(b.sisa)));
            tb.append(tr);
            if (b.paket.length) tb.append(h('tr', { class: 'sub' }, h('td', { colspan: 6 }, h('details', {}, h('summary', { style: { fontWeight: 400, fontSize: '12.5px' } }, 'daftar paket'),
                h('div', { class: 'muted', style: { fontSize: '12.5px' } }, ...b.paket.map(p => h('div', {}, `${p.paketId} · ${p.nama} · ${p.jenis} · ${p.metode || '-'} · Rp${fmt(p.diGrup)}${p.status === '2' ? ' · final draft' : ''}`)))))));
        }
        return h('div', { class: 'tbl', style: { maxHeight: 'none', margin: '8px 0' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Bagian (item DIPA)'), h('th', { class: 'n' }, 'Paket'), h('th', { class: 'n' }, 'RUP terumumkan'), h('th', { class: 'n' }, 'Final draft'), h('th', { class: 'n' }, 'DIPA 2026'), h('th', { class: 'n' }, 'Sisa DIPA'))), tb));
    }
    function pilihTujuan(k) {
        const sel = h('select', {}, ...k.kandidatTujuan.map(c => h('option', { value: c.mak, selected: c.mak === k.target[0] }, `${c.mak} · ${c.nama} · sisa Rp${fmt(c.sisa)}`)));
        sel.addEventListener('change', () => ubahKeputusan(k.id, { target: sel.value }));
        return h('div', { class: 'row', style: { margin: '4px 0 6px' } }, h('span', { class: k.lemah ? '' : 'muted' }, k.lemah ? 'Tujuan (periksa):' : 'Tujuan:'), sel);
    }
    function tabelPaket(list, ganda) {
        const g = new Set((ganda || []).flat());
        return h('div', { class: 'tbl', style: { maxHeight: 'none', margin: '8px 0' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Paket'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Di MAK ini'), h('th', { class: 'n' }, 'Pagu paket'), h('th', {}, ''))),
            h('tbody', {}, list.map(p => h('tr', {}, h('td', { class: 'mono' }, p.paketId), h('td', {}, p.nama), h('td', { class: 'n' }, fmt(p.diMak != null ? p.diMak : p.diGrup)), h('td', { class: 'n' }, fmt(p.pagu)),
                h('td', {}, g.has(p.paketId) ? pill('kemungkinan ganda', 'p-warn') : p.umum ? pill('paket umum', 'p-mut') : null))))));
    }
    function daftarFD(k) {
        return h('div', { class: 'tbl', style: { maxHeight: 'none', margin: '8px 0' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Final draft'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Pagu'), h('th', {}, 'Masalah'), h('th', {}, 'Tindakan'))),
            h('tbody', {}, k.daftar.map(x => {
                const sel = h('select', {}, ...k.opsi.map(o => h('option', { value: o.id, selected: x.pilihan === o.id }, o.label)));
                sel.addEventListener('change', () => { const d = S.kep.fd || {}; d.pilih = { ...(d.pilih || {}), [x.paketId]: sel.value }; S.kep.fd = d; simpanKeadaan(); hitungUlang(); });
                return h('tr', {}, h('td', { class: 'mono' }, x.paketId), h('td', {}, x.nama), h('td', { class: 'n' }, fmt(x.pagu)), h('td', { class: 'muted' }, x.masalah.join('; ')), h('td', {}, sel));
            }))));
    }
    function editorSusun(k) {
        const box = h('div', { class: 'fs', style: { marginTop: '10px' } }, h('h4', {}, 'Susun ulang per bagian'),
            h('p', { class: 'note', style: { marginBottom: '8px' } }, 'Centang paket yang dipertahankan dan isi pagunya. Paket lain di bagian itu dibatalkan (final draft mengikuti pilihan final draft di atas). Metode bisa diubah, mis. Penunjukan Langsung.'));
        const METODE_S = ['', ...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
        for (const b of k.bucket) {
            if (!b.paket.length) continue;
            const st = k.susun[b.id] || { simpan: [], pagu: {} };
            const simpanKep = patch => { const d = S.kep[k.id] || {}; d.susun = { ...(d.susun || {}), [b.id]: { ...st, ...patch } }; S.kep[k.id] = d; simpanKeadaan(); hitungUlang(); };
            const mt = h('select', {}, ...METODE_S.map(m => h('option', { value: m, selected: (st.metode || '') === m }, m || '— metode tetap —')));
            mt.addEventListener('change', () => simpanKep({ metode: mt.value }));
            const rows = b.paket.map(p => {
                const on = st.simpan.includes(p.paketId);
                const cb = chk(on, v => simpanKep({ simpan: v ? [...st.simpan, p.paketId] : st.simpan.filter(i => i !== p.paketId), pagu: {} }));
                const pg = h('input', { type: 'number', value: on ? Math.round(st.pagu[p.paketId] || 0) : '', disabled: !on, style: { width: '170px' } });
                pg.addEventListener('change', () => simpanKep({ pagu: { ...Object.fromEntries(st.simpan.map(i => [i, st.pagu[i]])), [p.paketId]: +pg.value || 0 } }));
                return h('tr', {}, h('td', {}, cb), h('td', { class: 'mono' }, p.paketId), h('td', {}, p.nama, p.status === '2' ? pill('final draft', 'p-info') : null), h('td', { class: 'n' }, fmt(p.diGrup)), h('td', {}, pg));
            });
            const tot = st.simpan.reduce((s, i) => s + (+st.pagu[i] || 0), 0);
            box.append(h('div', { style: { margin: '10px 0' } }, h('div', { class: 'row' }, h('b', {}, b.label), h('span', { class: 'muted' }, `DIPA Rp${fmt(b.dipa)} · dipertahankan Rp${fmt(tot)}`), h('span', { style: { flex: 1 } }), h('span', { class: 'muted' }, 'Metode:'), mt),
                h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Pertahankan'), h('th', {}, 'Paket'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Pagu di kelompok'), h('th', {}, 'Pagu baru (Rp)'))), h('tbody', {}, rows))));
        }
        return box;
    }
    function saranLokasiSatker() {
        const out = [], seen = new Set();
        const tambah = (l, ket) => { const k = `${l.id_provinsi}|${l.id_kabupaten}`; if (!l.id_kabupaten || seen.has(k)) return; seen.add(k); out.push({ ...l, ket }); };
        for (const [t, l] of Object.entries(S.lokRkk || {})) if (l) tambah({ ...l, detil: '' }, `lokasi KRO di RKK (${t})`);
        const c = {};
        for (const p of S.pakets || []) for (const l of p.lokasiRaw || []) { const k = `${l.id_provinsi}|${l.id_kabupaten}|${l.detil}`; c[k] = c[k] || { l, n: 0 }; c[k].n++; }
        for (const { l, n } of Object.values(c).sort((a, b) => b.n - a.n).slice(0, 4)) tambah(l, `${n} paket existing`);
        return out;
    }
    function kartuLokasiSatker() {
        const L = S.lokasiSatker;
        const box = h('div', { class: 'kartu' + (L ? '' : ' belum') });
        box.append(h('div', { class: 'kartu-hd' }, h('div', {}, h('div', { class: 'item-title' }, 'Lokasi satker'),
            h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '3px' } }, L ? `${L.kab}, ${L.prov} — ${L.detil}` : 'Dipakai untuk paket baru bila lokasi KRO di RKK dan paket satu komponen tidak tersedia. Diatur sekali per satker.')),
            L ? pill('Sudah diatur', 'p-ok') : pill('Belum diatur', 'p-warn')));
        const saran = saranLokasiSatker();
        const temp = { lokasiRaw: [L ? { ...L } : { id_provinsi: '', id_kabupaten: '', detil: '' }] };
        const ed = h('details', { open: !L }, h('summary', {}, L ? 'Ubah lokasi satker' : 'Atur lokasi satker'),
            saran.length ? h('div', { class: 'row', style: { margin: '6px 0 10px' } }, h('span', { class: 'muted' }, 'Saran:'),
                ...saran.map(s => h('button', { class: 'btn sm', onclick: () => { temp.lokasiRaw = [{ id_provinsi: s.id_provinsi, id_kabupaten: s.id_kabupaten, detil: s.detil || (L && L.detil) || S.ctx.satkerNama || '' }]; lokBox.innerHTML = ''; lokBox.append(lokasiEditor(temp, null, 1)); } },
                    `${s.kab || s.id_kabupaten}${s.detil ? ' – ' + s.detil.slice(0, 40) : ''} · ${s.ket}`))) : null);
        const lokBox = h('div', {}, lokasiEditor(temp, null, 1));
        ed.append(lokBox, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn pri sm', onclick: async () => {
            const l = temp.lokasiRaw[0];
            if (!l || !l.id_provinsi || !l.id_kabupaten || !String(l.detil || '').trim()) { log('Lengkapi provinsi, kabupaten/kota, dan detail lokasi satker.', 'w'); return; }
            const kab = (await Sirup.kabupaten(+l.id_provinsi)).find(x => +x.id === +l.id_kabupaten);
            S.lokasiSatker = { id_provinsi: +l.id_provinsi, id_kabupaten: +l.id_kabupaten, detil: l.detil.trim(), prov: Sirup.PROVINSI[+l.id_provinsi], kab: kab ? kab.nama : '' };
            store.set('lok:' + S.ctx.kodeSatker, S.lokasiSatker); log('Lokasi satker disimpan.', 'o'); hitungUlang();
        } }, 'Simpan lokasi satker')));
        box.append(ed);
        return box;
    }

    // ── 4.2 Pengajuan revisi ────────────────────────────────────────────
    // Satu baris = satu pengajuan ke SiRUP (revisi 1→1, revisi 1→N, umumkan, pembatalan, kembalikan final
    // draft). Klik baris → popup berisi isian pengajuan yang disusun seperti form revisi SiRUP.
    const JENIS_PJ = { ubah: ['Revisi 1→1', 'p-info'], titip: ['Revisi 1→N', 'p-np'], umumkan: ['Umumkan', 'p-ok'], batal: ['Pembatalan', 'p-bad'], batalFD: ['Kembalikan ke PPK', 'p-warn'] };
    const GRUP_PJ = { ubah: 'Revisi satu ke satu', titip: 'Revisi satu ke banyak (titipan paket baru)', umumkan: 'Umumkan final draft', batal: 'Pembatalan paket', batalFD: 'Final draft dikembalikan ke PPK' };
    const URUT_PJ = ['ubah', 'titip', 'umumkan', 'batal', 'batalFD'];
    let filterPj = 'semua';
    const alasanDari = (id, def) => (S.edit[id] && S.edit[id].alasan) || def;
    const kompDari = mak => String(mak || '').split('.').slice(0, 5).join('.');
    function daftarPengajuan() {
        const r = S.ren, out = [];
        if (!r) return out;
        const titipOn = new Set(r.titipan.filter(t => dipilih(t) && r.paketBaru.some(b => b.hostId === t.hostId && dipilih(b))).map(t => t.hostId));
        for (const c of r.perubahan) {
            if (c.jenis === 'ubah' && titipOn.has(c.paketId)) continue;   // menjadi draft #1 revisi satu ke banyak
            out.push({ id: c.id, jenis: c.jenis, paketId: c.paketId, nama: c.nama, sebelum: c.sebelum, sesudah: c.jenis === 'batal' ? 0 : c.sesudah, label: c.label.filter(l => l !== 'batalkan'),
                peringatan: c.peringatan, catatan: c.catatan, alasan: alasanDari(c.id, c.alasan), alasanAwal: c.alasan, c, umumkanDulu: c.umumkanDulu,
                on: dipilih(c), setOn: v => setPilih(c.id, v), komp: kompDari((c.rowsSebelum[0] || c.rowsSesudah[0] || {}).mak) });
        }
        for (const t of r.titipan) {
            const anak = r.paketBaru.filter(b => b.hostId === t.hostId);
            if (!anak.length) continue;
            const ch = r.perubahan.find(c => c.paketId === t.hostId && c.jenis === 'ubah');
            const chOn = !!ch && dipilih(ch), anakOn = anak.filter(dipilih);
            const awal = (chOn ? ch.alasan + '; ' : 'Revisi: ') + 'penambahan paket sesuai DIPA revisi terakhir';
            out.push({ id: t.id, jenis: 'titip', paketId: t.hostId, nama: t.nama, sebelum: t.pagu, sesudah: (chOn ? ch.sesudah : t.pagu) + anakOn.reduce((s, b) => s + b.total, 0),
                label: [`+${anakOn.length} paket baru`, ...(chOn ? ch.label : [])], peringatan: [...(chOn ? ch.peringatan : []), ...anak.flatMap(b => b.peringatan.map(x => `${b.nama.slice(0, 40)}: ${x}`))],
                catatan: chOn ? ch.catatan : [], alasan: alasanDari(t.id, awal), alasanAwal: awal, t, ch, chOn, anak,
                on: dipilih(t), setOn: v => setPilih(t.id, v), komp: kompDari(((chOn && ch.rowsSesudah[0]) || t.pk1.anggaran[0] || {}).mak) });
        }
        if (r.umumkan.length) {
            const on = r.umumkan.filter(dipilih);
            out.push({ id: 'umumkan', jenis: 'umumkan', paketId: '', nama: `${r.umumkan.length} final draft siap diumumkan`, sebelum: 0, sesudah: on.reduce((s, u) => s + u.pagu, 0),
                label: [], peringatan: [], catatan: [], daftar: r.umumkan, on: on.length > 0, setOn: v => { for (const u of r.umumkan) S.pilih.set(u.id, v); simpanKeadaan(); segarkanHeader(); }, komp: '' });
        }
        for (const f of r.batalFD) {
            const id = 'f:' + f.paketId, awal = 'Dikembalikan ke PPK: ' + f.alasan;
            out.push({ id, jenis: 'batalFD', paketId: f.paketId, nama: f.nama, sebelum: f.pagu, sesudah: 0, label: [], peringatan: [], catatan: [f.alasan], alasan: alasanDari(id, awal), alasanAwal: awal, f,
                on: S.pilih.has(id) ? S.pilih.get(id) : true, setOn: v => setPilih(id, v), komp: '' });
        }
        return out.sort((a, b) => URUT_PJ.indexOf(a.jenis) - URUT_PJ.indexOf(b.jenis) || a.komp.localeCompare(b.komp) || String(a.paketId).localeCompare(String(b.paketId)));
    }
    function tabPerubahan(el) {
        const pj = daftarPengajuan();
        el.append(h('p', { class: 'note' }, 'Satu baris = satu pengajuan ke SiRUP. Klik baris untuk melihat isiannya seperti di form revisi SiRUP (bagian yang berubah ditandai), mengubah isian atau alasan, dan mengajukannya sendiri. Baris yang dicentang ikut antrean di tab Jalankan.'));
        const nKurang = S.ren.kekurangan.filter(k => k.cara !== 'abaikan' || (S.atur[k.mak] || {}).cara === 'abaikan').length;
        el.append(h('details', { class: 'card', style: { padding: '12px 18px' } }, h('summary', {}, `Cara menutup kekurangan pagu (${nKurang} akun)`), sekKekurangan(true)));
        if (!pj.length) { el.append(kosong('Tidak ada pengajuan ke SiRUP yang perlu dibuat.')); actEl.append(barLanjut('Lanjut: paket baru →', 'baru')); return; }
        const n = j => pj.filter(it => j === 'semua' || it.jenis === j).length;
        if (filterPj !== 'semua' && !n(filterPj)) filterPj = 'semua';
        el.append(h('div', { class: 'chips' }, ...['semua', ...URUT_PJ].filter(j => n(j)).map(j => h('button', { class: 'chip' + (filterPj === j ? ' on' : ''), onclick: () => { filterPj = j; gambarRekap(); } },
            j === 'semua' ? 'Semua' : JENIS_PJ[j][0], h('span', { class: 'cnt' }, String(n(j)))))));
        const list = h('div', { class: 'pj-list' });
        for (const j of URUT_PJ) {
            const xs = pj.filter(it => it.jenis === j && (filterPj === 'semua' || filterPj === j));
            if (!xs.length) continue;
            const d = xs.filter(it => it.on).reduce((s, it) => s + (it.jenis === 'batalFD' ? 0 : it.sesudah - it.sebelum), 0);
            list.append(h('div', { class: 'pj-grp' }, h('span', {}, `${GRUP_PJ[j]} (${xs.length})`), d ? h('span', { class: 'delta ' + (d > 0 ? 'up' : 'down') }, `RUP terumumkan ${d > 0 ? '+' : '−'}Rp${fmtM(Math.abs(d))}`) : null));
            for (const it of xs) list.append(barisPengajuan(it));
        }
        el.append(list);
        actEl.append(barLanjut('Lanjut: paket baru →', 'baru'));
    }
    function chk(v, fn) { const c = h('input', { type: 'checkbox', checked: v }); c.addEventListener('change', () => fn(c.checked)); return c; }
    const LABEL_CLS = { 'tambah pagu': 'p-ok', 'pindah MAK': 'p-info', 'keluarkan non-pengadaan': 'p-np', 'potong kelebihan': 'p-warn', 'batalkan': 'p-bad', 'susun ulang': 'p-info', 'sumber dana': 'p-mut' };
    function barisPengajuan(it) {
        const [jl, jc] = JENIS_PJ[it.jenis];
        const L = S.antre && S.antre.langkah.find(x => x.id === it.id && x.status !== 'selesai');
        const delta = it.sesudah - it.sebelum;
        const row = h('div', { class: 'pj-row' + (it.on ? '' : ' off') + (it.peringatan.length ? ' warn' : ''), tabindex: '0', title: 'Klik untuk melihat isian pengajuan',
            onclick: () => popupPengajuan(it.id), onkeydown: e => { if (e.key === 'Enter') popupPengajuan(it.id); } });
        const cb = chk(it.on, v => { it.on = v; it.setOn(v); row.classList.toggle('off', !v); });
        cb.title = 'Ikut antrean';
        const sisi = it.jenis === 'umumkan' ? [h('b', {}, 'Rp' + fmt(it.sesudah)), h('span', { class: 'delta up' }, 'masuk RUP terumumkan')]
            : it.jenis === 'batalFD' ? [h('b', {}, 'Rp' + fmt(it.sebelum)), h('span', { class: 'delta' }, 'final draft · RUP terumumkan tetap')]
            : it.jenis === 'batal' ? [h('b', {}, 'dibatalkan'), h('span', { class: 'delta down' }, `−Rp${fmt(it.sebelum)}`)]
            : [h('b', {}, 'Rp' + fmt(it.sesudah)), delta === 0 ? h('span', { class: 'delta' }, 'pagu tetap') : h('span', { class: 'delta ' + (delta > 0 ? 'up' : 'down') }, `${delta > 0 ? '+' : '−'}Rp${fmt(Math.abs(delta))} (semula Rp${fmt(it.sebelum)})`)];
        const kode = it.jenis === 'umumkan' ? it.daftar.filter(dipilih).map(u => u.paketId) : [];
        row.append(h('label', { class: 'pj-cb', onclick: e => e.stopPropagation() }, cb), pill(jl, jc),
            h('div', { class: 'pj-main' }, h('div', { class: 'pj-title' }, it.nama),
                h('div', { class: 'pj-sub' }, h('span', { class: 'mono' }, it.jenis === 'umumkan' ? kode.slice(0, 8).join(', ') + (kode.length > 8 ? ' …' : '') : it.paketId),
                    ...it.label.map(l => pill(l, LABEL_CLS[l] || 'p-mut')), it.umumkanDulu ? pill('final draft: umumkan dulu', 'p-info') : null,
                    it.peringatan.length ? pill(`${it.peringatan.length} peringatan`, 'p-warn') : null,
                    L ? pill('antrean: ' + (ST_LANGKAH[L.status] || [L.status])[0], (ST_LANGKAH[L.status] || [0, 'p-mut'])[1]) : null)),
            h('div', { class: 'pj-side' }, ...sisi), h('span', { class: 'pj-go' }, '›'));
        return row;
    }
    function ringkasPj(it) {
        if (it.jenis === 'umumkan') { const on = it.daftar.filter(dipilih); return `${on.length} dari ${it.daftar.length} final draft dicentang · Rp${fmt(on.reduce((s, u) => s + u.pagu, 0))} masuk RUP terumumkan`; }
        if (it.jenis === 'batalFD') return `Final draft Rp${fmt(it.sebelum)} dikembalikan ke PPK · RUP terumumkan tidak berubah`;
        if (it.jenis === 'batal') return `Paket terumumkan Rp${fmt(it.sebelum)} dibatalkan`;
        const d = it.sesudah - it.sebelum;
        return `Pagu Rp${fmt(it.sebelum)} → Rp${fmt(it.sesudah)}${d ? ` (${d > 0 ? '+' : '−'}Rp${fmt(Math.abs(d))})` : ' (tetap)'}${it.jenis === 'titip' ? ` · ${it.anak.filter(dipilih).length} paket baru` : ''}${it.umumkanDulu ? ' · final draft diumumkan dulu' : ''}`;
    }
    // Isian paket sekarang dalam bentuk isian revisi; jadwal dibaca apa adanya (tanpa dirapikan) supaya perbedaannya jujur
    function pkLama(paketId) {
        const p = (S.pakets || []).find(x => x.id === paketId);
        if (!p) return null;
        const t = p.tanggal || {}, Y = Rencana.ym;
        const pk = Rencana.pkDari(p, (p.sumberDana || []).filter(r => +r.pagu > 0), S.cfg);
        pk.jadwal = { awalPengadaan: Y(t.awalPengadaan) || Y(p.pemilihan && p.pemilihan.mulai), akhirPengadaan: Y(t.akhirPengadaan) || Y(p.pemilihan && p.pemilihan.akhir),
            awalPekerjaan: Y(t.awalPekerjaan) || Y(p.pelaksanaan && p.pelaksanaan.mulai), akhirPekerjaan: Y(t.akhirPekerjaan) || Y(p.pelaksanaan && p.pelaksanaan.akhir),
            awalKebutuhan: Y(p.pemanfaatan && p.pemanfaatan.mulai), kebutuhan: Y(p.pemanfaatan && p.pemanfaatan.akhir) };
        return pk;
    }
    const DANA_NAMA = { A: 'RM', D: 'PNBP', F: 'BLU', T: 'SBSN', B: 'PLN' };
    const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const bln = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})/); return m ? `${BLN[+m[2] - 1]} ${m[1]}` : '–'; };
    function namaKab(l) {
        if (l.kab) return l.kab;
        const L = S.lokasiSatker;
        if (L && +L.id_kabupaten === +l.id_kabupaten) return L.kab;
        const r = Object.values(S.lokRkk || {}).find(x => x && +x.id_kabupaten === +l.id_kabupaten);
        return r ? r.kab : (l.id_kabupaten ? 'kab/kota id ' + l.id_kabupaten : '–');
    }
    function tampilan(pk) {
        if (!pk) return null;
        const ang = (pk.anggaran || []).filter(a => +a.pagu > 0);
        const total = ang.reduce((s, a) => s + (+a.pagu || 0), 0);
        const JN = Object.fromEntries(Object.entries(Sirup.JENIS_ID).map(([k, v]) => [String(v), k]));
        const j = pk.jadwal || {};
        const rapi = x => String(x || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
        const kecuali = /dikecualikan/i.test(pk.metode || '');
        return {
            nama: rapi(pk.nama),
            lokasi: (pk.lokasiRaw || []).map(l => ({ k: `${+l.id_provinsi || 0}|${+l.id_kabupaten || 0}|${rapi(l.detil)}`, prov: l.prov || Sirup.PROVINSI[+l.id_provinsi] || '–', kab: namaKab(l), detil: rapi(l.detil) })),
            volume: rapi(pk.volume), uraian: rapi(pk.uraian), spesifikasi: rapi(pk.spesifikasi),
            praDipa: pk.praDipa ? 'Ya' : 'Tidak',
            dana: ang.map(a => ({ mak: a.mak, pagu: Math.round(+a.pagu), dana: DANA_NAMA[a.danaApbn || 'A'] || a.danaApbn, komp: String(a.idKomponen || komponenId(a.mak) || '') })),
            total: Math.round(total),
            jenis: pk.jenisList && pk.jenisList.length ? pk.jenisList.map(x => [JN[String(x.jenisid)] || String(x.jenisid), Math.round(+x.pagu)]) : [[pk.jenis || '–', Math.round(total)]],
            pdn: pk.pdn ? 'Ya' : 'Tidak', umkm: pk.umkm ? 'Ya' : 'Tidak' + (pk.alasanUmkm ? ` — ${pk.alasanUmkm}` : ''),
            spp: ['ekonomi', 'sosial', 'lingkungan'].filter(k => (pk.spp || {})[k]).map(k => k[0].toUpperCase() + k.slice(1)).join(', ') || 'tidak ada',
            dikecualikan: kecuali ? 'Ya' : 'Tidak', metode: kecuali ? '–' : (pk.metode || '–'),
            jadwal: [['Pemanfaatan barang/jasa', j.awalKebutuhan, j.kebutuhan], ['Pelaksanaan kontrak', j.awalPekerjaan, j.akhirPekerjaan], ['Pemilihan penyedia', j.awalPengadaan, j.akhirPengadaan]].map(([l, a, b]) => [l, bln(a), bln(b)]),
        };
    }
    function labelKomponen(mak, id) {
        if (!id) return pill('belum ada di PKKR', 'p-bad');
        const k5 = kompDari(mak);
        const n = S.pkkr && S.pkkr.get(k5);
        const m = n && n.manualTwin && String(n.manualTwin.id) === String(id) ? n.manualTwin : n && n.manual ? n : null;
        return h('span', { title: 'id komponen PKKR ' + id }, `${k5.split('.').pop()} ${((m || n) || {}).nama || ''}`.trim(), m ? [' ', pill('Manual', 'p-mut')] : null);
    }
    const KUNCI_PJ = [['nama', 'nama paket'], ['lokasi', 'lokasi'], ['volume', 'volume'], ['uraian', 'uraian'], ['spesifikasi', 'spesifikasi'], ['praDipa', 'pra DIPA'], ['dana', 'sumber dana/MAK'],
        ['total', 'total pagu'], ['jenis', 'jenis pengadaan'], ['pdn', 'PDN'], ['umkm', 'usaha kecil'], ['spp', 'SPP'], ['dikecualikan', 'dikecualikan'], ['metode', 'metode'], ['jadwal', 'jadwal']];
    // Pratinjau isian pengajuan dengan urutan bagian form revisi SiRUP; lama → baru ditandai (polos = tanpa pembanding)
    function pratinjau(lama, baru, { polos } = {}) {
        const A = polos ? null : tampilan(lama), B = tampilan(baru || lama);
        const sig = (k, v) => k === 'lokasi' ? v.map(x => x.k).join(';') : k === 'jenis' ? v.map(x => x[0]).join(';') : JSON.stringify(v);
        const beda = k => !!A && sig(k, A[k]) !== sig(k, B[k]);
        const v1 = (k, f = x => x) => !beda(k) ? h('span', {}, f(B[k]) || '–') : h('span', {}, h('del', {}, f(A[k]) || '–'), ' → ', h('ins', {}, f(B[k]) || '–'));
        const br = (label, isi) => h('div', { class: 'frm-r' }, h('div', { class: 'frm-l' }, label), h('div', { class: 'frm-v' }, isi));
        const teks = k => !beda(k) ? h('div', { class: 'txt' }, B[k] || '–') : h('div', {}, h('div', { class: 'txt del' }, A[k] || '–'), h('div', { class: 'txt ins', style: { marginTop: '6px' } }, B[k] || '–'));
        const tabel = (kepala, rows) => h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...kepala.map(([t, n]) => h('th', { class: n ? 'n' : '' }, t)))), h('tbody', {}, rows));
        const out = h('div', { class: 'frm' });
        const bagian = (no, judul, kunci, ...isi) => {
            const ch = kunci.some(beda);
            out.append(h('section', { class: 'frm-s' + (ch ? ' ch' : A ? ' tetap' : '') }, h('div', { class: 'frm-t' }, h('span', { class: 'no' }, String(no)), judul,
                ch ? pill('berubah', 'p-warn') : A ? h('span', { class: 'muted', style: { fontWeight: 400, textTransform: 'none', letterSpacing: 0 } }, 'tetap') : null), ...isi));
        };
        bagian(1, 'Paket', ['nama'], br('Tahun anggaran', String(S.ctx.tahun)), br('Satuan kerja', S.ctx.satkerNama || S.ctx.kodeSatker || '–'), br('Nama paket', v1('nama')));
        {
            const lamaK = new Set(A ? A.lokasi.map(x => x.k) : []), baruK = new Set(B.lokasi.map(x => x.k));
            const rows = B.lokasi.map((l, i) => h('tr', { class: A && !lamaK.has(l.k) ? 'add' : '' }, h('td', {}, String(i + 1)), h('td', {}, l.prov), h('td', {}, l.kab), h('td', {}, l.detil || '–')));
            if (A) for (const l of A.lokasi.filter(x => !baruK.has(x.k))) rows.push(h('tr', { class: 'del' }, h('td', {}, '−'), h('td', {}, l.prov), h('td', {}, l.kab), h('td', {}, l.detil || '–')));
            bagian(2, 'Lokasi pekerjaan', ['lokasi'], tabel([['No'], ['Provinsi'], ['Kabupaten/Kota'], ['Detail lokasi']], rows));
        }
        bagian(3, 'Uraian pekerjaan', ['volume', 'uraian', 'spesifikasi'], br('Volume pekerjaan', v1('volume')), br('Uraian pekerjaan', teks('uraian')), br('Spesifikasi pekerjaan', teks('spesifikasi')));
        {
            const kode = [S.ctx.kodeBA, S.ctx.kodeEselon, S.ctx.kodeSatker].filter(Boolean).join('.');
            const sisaLama = new Map();
            for (const d of A ? A.dana : []) { if (!sisaLama.has(d.mak)) sisaLama.set(d.mak, []); sisaLama.get(d.mak).push(d); }
            const baris = (d, no, cls, lamaD) => h('tr', { class: cls }, h('td', {}, no), h('td', {}, 'APBN · ' + d.dana), h('td', {}, S.ctx.kodeKldi || '–'), h('td', { class: 'mono', style: { fontSize: '12px' } }, (kode ? kode + '.' : '') + d.mak),
                h('td', {}, labelKomponen(d.mak, d.komp)), h('td', { class: 'n' }, lamaD && lamaD.pagu !== d.pagu ? [h('del', {}, fmt(lamaD.pagu)), ' ', h('ins', {}, fmt(d.pagu))] : fmt(d.pagu)));
            const rows = B.dana.map((d, i) => { const q = sisaLama.get(d.mak), lamaD = q && q.length ? q.shift() : null; return baris(d, String(i + 1), A && !lamaD ? 'add' : '', lamaD); });
            if (A) for (const q of sisaLama.values()) for (const d of q) rows.push(baris(d, '−', 'del'));
            bagian(4, 'Sumber dana', ['praDipa', 'dana', 'total'], br('Pra DIPA/DPA', v1('praDipa')),
                tabel([['No'], ['Sumber dana'], ['Asal dana'], ['MAK'], ['Komponen PKKR'], ['Pagu (Rp)', 1]], rows), br('Total pagu', v1('total', x => 'Rp' + fmt(x))));
        }
        const barisJenis = (xs, cls, lama) => xs.map(([j, p], i) => { const o = lama && lama[i];
            return h('tr', { class: cls }, h('td', {}, j), h('td', { class: 'n' }, o && o[1] !== p ? [h('del', {}, fmt(o[1])), ' ', h('ins', {}, fmt(p))] : fmt(p))); });
        bagian(5, 'Jenis pengadaan', ['jenis'], tabel([['Jenis pengadaan'], ['Pagu (Rp)', 1]], beda('jenis') ? [...barisJenis(A.jenis, 'del'), ...barisJenis(B.jenis, 'add')] : barisJenis(B.jenis, '', A && A.jenis)));
        bagian(6, 'Produk dalam negeri & usaha kecil', ['pdn', 'umkm'], br('Produk dalam negeri', v1('pdn')), br('Usaha kecil/koperasi', v1('umkm')));
        bagian(7, 'Pengadaan berkelanjutan (SPP)', ['spp'], br('Aspek', v1('spp')));
        bagian(8, 'Pemilihan', ['dikecualikan', 'metode'], br('Pengadaan dikecualikan', v1('dikecualikan')), br('Rencana metode pemilihan', v1('metode')));
        bagian(9, 'Rencana jadwal', ['jadwal'], tabel([['Tahap'], ['Awal'], ['Akhir']], B.jadwal.map(([l, a, b], i) => {
            const o = A && A.jadwal[i];
            const sel = (x, y) => !o || x === y ? x : [h('del', {}, y), ' → ', h('ins', {}, x)];
            return h('tr', {}, h('td', {}, l), h('td', {}, sel(a, o && o[1])), h('td', {}, sel(b, o && o[2])));
        })));
        out.diubah = A ? KUNCI_PJ.filter(([k]) => beda(k)).map(([, l]) => l) : [];
        return out;
    }
    // Satu draft pengajuan: pratinjau (digambar ulang tiap isian berubah) + editor isian yang bisa dibuka
    function blokDraft({ judul, sub, lama, baru, idEdit, paketBaru = false, kepala, off }) {
        const prev = h('div', {}), ringkas = h('div', { class: 'ubah-list' });
        const segar = () => {
            const f = pratinjau(lama, baru, { polos: !baru || paketBaru });
            prev.innerHTML = ''; prev.append(f);
            ringkas.innerHTML = '';
            if (baru && !paketBaru && lama) ringkas.append(...(f.diubah.length ? [h('span', { class: 'muted' }, 'Berubah:'), ...f.diubah.map(x => pill(x, 'p-warn'))] : [h('span', { class: 'muted' }, 'Isian sama dengan paket sekarang')]));
        };
        const hd = h('div', { class: 'draft-hd' }, kepala || null, h('div', { style: { flex: 1, minWidth: '220px' } }, h('b', {}, judul), sub ? h('div', { class: 'muted', style: { fontSize: '12.5px' } }, sub) : null), ringkas);
        const el = h('div', { class: 'draft' + (off ? ' off' : '') }, hd);
        if (baru && idEdit) { const ed = editorIsian(idEdit, baru, paketBaru, () => segar()); hd.append(ed.tombol); el.append(ed.body); }
        el.append(prev);
        segar();
        return el;
    }
    function peringatanLokasi(id, pk, segar) {
        const L = S.lokasiSatker;
        if (!L || !pk || !(pk.lokasiRaw || []).length || !pk.lokasiRaw.every(l => +l.id_provinsi !== +L.id_provinsi)) return null;
        return h('div', { class: 'warnbox row', style: { margin: 0 } }, h('span', { style: { flex: 1 } }, `Lokasi paket (${pk.lokasiRaw.map(namaKab).join(', ')}) di luar provinsi satker (${L.prov}).`),
            h('button', { class: 'btn sm', onclick: () => { pk.lokasiRaw = [{ id: '', id_provinsi: L.id_provinsi, id_kabupaten: L.id_kabupaten, detil: L.detil, prov: L.prov, kab: L.kab }]; catatEdit(id, pk, 'lokasiRaw'); segar(); } }, 'Ganti ke lokasi satker'));
    }
    function kartuAlasan(it) {
        const ta = h('textarea', { style: { minHeight: '60px' } }, it.alasan || '');
        ta.addEventListener('change', () => {
            const v = ta.value.trim(), e = S.edit[it.id] = { ...(S.edit[it.id] || {}) };
            if (v && v !== it.alasanAwal) e.alasan = v; else { delete e.alasan; ta.value = it.alasanAwal || ''; }
            simpanKeadaan();
        });
        return h('div', { class: 'fs' }, h('h4', {}, it.jenis === 'batalFD' ? 'Alasan dikembalikan' : it.jenis === 'batal' ? 'Alasan pembatalan' : 'Alasan revisi'), ta,
            h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, 'Tercatat di riwayat paket SiRUP. Boleh diubah; kosongkan untuk kembali ke alasan bawaan.'));
    }
    function popupPengajuan(id) {
        const cari = () => daftarPengajuan().find(x => x.id === id);
        if (!cari()) return;
        const box = h('div', { class: 'sdr-modal sdr' }), panel = h('div', { class: 'pop' });
        box.append(panel);
        const onKey = e => { if (e.key === 'Escape' && document.querySelectorAll('.sdr-modal').length === 1) tutup(); };
        function tutup() { box.remove(); document.removeEventListener('keydown', onKey); const y = body.scrollTop; gambarRekap(); body.scrollTop = y; }
        document.addEventListener('keydown', onKey);
        box.addEventListener('mousedown', e => { if (e.target === box) tutup(); });
        const gambar = () => {
            const it = cari();
            panel.innerHTML = '';
            if (!it) { panel.append(h('div', { class: 'pop-body' }, kosong('Pengajuan ini tidak ada lagi di rencana.')), h('div', { class: 'pop-ft' }, h('span', { class: 'sp' }), h('button', { class: 'btn pri', onclick: tutup }, 'Tutup'))); return; }
            const [jl, jc] = JENIS_PJ[it.jenis];
            const isi = h('div', { class: 'pop-body' });
            panel.append(h('div', { class: 'pop-hd' },
                h('div', {}, h('div', { class: 'row', style: { gap: '6px' } }, pill(jl, jc), it.paketId ? h('span', { class: 'mono' }, 'Kode RUP ' + it.paketId) : null, ...it.label.map(l => pill(l, LABEL_CLS[l] || 'p-mut'))),
                    h('div', { class: 'pop-title' }, it.nama), h('div', { class: 'muted', style: { fontSize: '13px' } }, ringkasPj(it))),
                h('button', { class: 'sdr-x dark', title: 'Tutup (Esc)', onclick: tutup }, '×')), isi);
            if (it.jenis !== 'umumkan') isi.append(kartuAlasan(it));
            if ((it.catatan || []).length || it.peringatan.length) isi.append(h('div', { class: 'fs' }, h('h4', {}, 'Dasar perubahan'), ...(it.catatan || []).map(t => h('div', { style: { fontSize: '13px' } }, '• ' + t)),
                it.peringatan.length ? h('div', { class: 'warnbox', style: { margin: (it.catatan || []).length ? '10px 0 0' : 0 } }, ...it.peringatan.map(t => h('div', {}, t))) : null));
            if (it.jenis === 'ubah') isi.append(peringatanLokasi(it.c.id, it.c.pk, gambar) || '', blokDraft({ judul: 'Isian revisi satu ke satu', sub: `Hasilnya paket berkode RUP baru (Final Draft) yang langsung diumumkan; kode ${it.paketId} tidak dipakai lagi.`, lama: pkLama(it.paketId), baru: it.c.pk, idEdit: it.c.id }));
            if (it.jenis === 'titip') {
                isi.append(h('div', { class: 'infobox', style: { margin: 0 } }, `Revisi Satu ke Banyak atas paket ${it.paketId}: draft #1 = paket ini (${it.chOn ? 'sekalian dikoreksi' : 'tanpa perubahan'}), draft #2 dst. = paket baru. Semua hasilnya berkode RUP baru (Final Draft) lalu diumumkan; kode ${it.paketId} tidak dipakai lagi.`));
                const k1 = it.ch ? h('label', { class: 'row', style: { gap: '6px', fontSize: '13px' }, title: 'Koreksi paket ini (hasil keputusan) ikut dikirim sebagai draft #1' }, chk(it.chOn, v => { setPilih(it.ch.id, v); gambar(); }), 'koreksi') : null;
                if (it.chOn) { const w = peringatanLokasi(it.ch.id, it.ch.pk, gambar); if (w) isi.append(w); }
                isi.append(blokDraft({ judul: `Draft #1 — paket ${it.paketId}`, sub: it.chOn ? 'paket ini setelah dikoreksi' : 'paket ini tanpa perubahan', lama: pkLama(it.paketId), baru: it.chOn ? it.ch.pk : null, idEdit: it.chOn ? it.ch.id : null, kepala: k1 }));
                it.anak.forEach((b, i) => {
                    const on = dipilih(b), err = Rencana.periksa(b, { komponenId });
                    const kb = h('label', { class: 'row', style: { gap: '6px', fontSize: '13px' }, title: 'Ikut dibuat' }, chk(on, v => { setPilih(b.id, v); gambar(); }), 'buat');
                    isi.append(blokDraft({ judul: `Draft #${i + 2} — paket baru`, sub: `${b.nama} · Rp${fmt(b.total)} · ${b.jenis} · ${b.metode}${err.length ? ' · perlu diperbaiki: ' + err.join('; ') : ''}`, lama: null, baru: b, idEdit: b.id, paketBaru: true, kepala: kb, off: !on }));
                });
            }
            if (it.jenis === 'umumkan') {
                isi.append(h('div', { class: 'infobox', style: { margin: 0 } }, 'Final draft berikut lolos pemeriksaan (semua barisnya MAK pengadaan yang masih ada ruang di DIPA) dan diumumkan sekaligus lewat tombol Umumkan SiRUP.'));
                isi.append(h('div', { class: 'tbl', style: { maxHeight: 'none' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Kode RUP'), h('th', {}, 'Nama'), h('th', {}, 'MAK'), h('th', { class: 'n' }, 'Pagu'))),
                    h('tbody', {}, it.daftar.map(u => { const p = (S.pakets || []).find(x => x.id === u.paketId) || {};
                        return h('tr', {}, h('td', {}, chk(dipilih(u), v => { setPilih(u.id, v); gambar(); })), h('td', { class: 'mono' }, u.paketId), h('td', {}, u.nama), h('td', { class: 'mono', style: { fontSize: '12px' } }, (p.sumberDana || []).map(r => r.mak).join(', ')), h('td', { class: 'n' }, fmt(u.pagu))); })))));
            }
            if (it.jenis === 'batal' || it.jenis === 'batalFD') {
                isi.append(h('div', { class: it.jenis === 'batal' ? 'warnbox' : 'infobox', style: { margin: 0 } }, it.jenis === 'batal'
                    ? `Revisi → Pembatalan: paket menjadi Dibatalkan (tidak aktif) dan RUP terumumkan berkurang Rp${fmt(it.sebelum)}. Bila keliru, paket bisa diaktifkan kembali dari tab Jalankan (kode RUP tetap).`
                    : 'Batalkan Final Draft: paket kembali menjadi draft di akun PPK untuk diperbaiki. RUP terumumkan tidak berubah; KPA tidak bisa mengembalikannya sendiri.'));
                isi.append(blokDraft({ judul: 'Isian paket saat ini', lama: pkLama(it.paketId), baru: null }));
            }
            const kaki = h('div', { class: 'pop-ft' }, h('label', { class: 'row', style: { gap: '6px', cursor: 'pointer' } }, chk(it.on, v => { it.setOn(v); gambar(); }), h('span', {}, 'Ikut antrean (tab Jalankan)')), h('span', { class: 'sp' }));
            if (it.jenis === 'ubah' || it.jenis === 'titip') kaki.append(h('button', { class: 'btn', onclick: () => guard(() => lihatData(langkahDari(it))) }, 'Lihat data yang dikirim'));
            kaki.append(h('button', { class: 'btn go', disabled: !S.ctx.isKPA, title: S.ctx.isKPA ? 'Kirim pengajuan ini saja ke SiRUP sekarang' : 'Hanya akun KPA', onclick: () => { tutup(); guard(() => ajukanSatu(it.id)); } }, '▶ Ajukan sekarang'),
                h('button', { class: 'btn', onclick: tutup }, 'Tutup'));
            panel.append(kaki);
        };
        gambar();
        document.body.append(box);
    }
    function sekKekurangan(polos) {
        const r = S.ren;
        const aktif = r.kekurangan.filter(k => k.cara !== 'abaikan' || (S.atur[k.mak] || {}).cara === 'abaikan');
        const box = h('div', { class: polos ? '' : 'card' }, polos ? null : h('h3', {}, 'Cara menutup kekurangan pagu'),
            h('p', { class: 'note' }, `Default: bila MAK sudah punya paket umum (mis. "Belanja Bahan"), pagunya ditambah; bila belum atau paketnya spesifik, dibuat paket baru. Selisih ≤ Rp${fmt(S.cfg.ambangSelisih)} diabaikan.`));
        if (!aktif.length) box.append(h('div', { class: 'muted' }, 'Tidak ada kekurangan di atas ambang.'));
        else box.append(h('div', { class: 'tbl', style: { maxHeight: '340px' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'MAK'), h('th', { class: 'n' }, 'Kurang'), h('th', { class: 'n' }, 'Realisasi'), h('th', {}, 'Ditutup dengan'))),
            h('tbody', {}, aktif.map(k => {
                const sel = h('select', { style: { maxWidth: '460px' } },
                    ...k.kandidat.map(c => h('option', { value: 'tambah:' + c.paketId, selected: k.cara === 'tambah' && k.paketId === c.paketId }, `Tambah pagu ${c.paketId} · ${c.nama.slice(0, 50)}${c.umum ? '' : ' (spesifik)'}`)),
                    h('option', { value: 'baru', selected: k.cara === 'baru' }, 'Paket baru'), h('option', { value: 'abaikan', selected: k.cara === 'abaikan' }, 'Abaikan (mis. sudah swakelola)'));
                sel.addEventListener('change', () => { const [cara, pid] = sel.value.split(':'); S.atur[k.mak] = { cara, paketId: pid }; simpanKeadaan(); hitungUlang(); });
                return h('tr', {}, h('td', {}, h('div', { class: 'mono' }, k.mak), h('div', { class: 'muted', style: { fontSize: '12px' } }, k.nama)), h('td', { class: 'n' }, fmt(k.sisa)),
                    h('td', { class: 'n' }, k.realisasi ? Math.round(k.realisasi * 100) + '%' : '–'), h('td', {}, sel));
            })))));
        if (r.sisaKecil.length) box.append(h('details', { style: { marginTop: '8px' } }, h('summary', {}, `Selisih kecil diabaikan (${r.sisaKecil.length} akun, Rp${fmt(r.sisaKecil.reduce((s, x) => s + x.sisa, 0))})`),
            h('div', { class: 'muted', style: { fontSize: '12.5px' } }, ...r.sisaKecil.map(x => h('div', {}, `${x.mak} · Rp${fmt(x.sisa)} · ${x.alasan}`)))));
        if (r.tertahan.length) box.append(h('div', { class: 'infobox', style: { marginTop: '10px' } }, `${r.tertahan.length} akun (kurang Rp${fmt(r.tertahan.reduce((s, x) => s + x.sisa, 0))}) menunggu keputusan kartu di langkah 1: ${r.tertahan.map(x => x.mak).join(', ')}`));
        return box;
    }

    // ── 4.3 Paket baru ──────────────────────────────────────────────────
    function tabPaketBaru(el) {
        const r = S.ren;
        el.append(h('p', { class: 'note' }, 'KPA tidak bisa membuat paket dari nol, jadi paket baru "dititipkan" lewat Revisi → Satu ke Banyak atas paket terumumkan di komponen yang sama. Draft #1 = paket yang dititipi (tetap atau sekalian dikoreksi), draft #2 dst. = paket baru. Tiap isian menunjukkan asalnya.'));
        if (!r.paketBaru.length) { el.append(kosong('Tidak ada paket baru yang perlu dibuat.')); actEl.append(barLanjut('Lanjut: jalankan →', 'jalankan')); return; }
        el.append(bulkBaru());
        const tanpa = r.paketBaru.filter(b => !b.hostId);
        for (const t of r.titipan) {
            const anak = r.paketBaru.filter(b => b.hostId === t.hostId);
            const grp = h('div', { class: 'item' + (dipilih(t) ? '' : ' off'), style: { marginBottom: '14px' } });
            grp.append(h('div', { class: 'item-hd' }, chk(dipilih(t), v => { grp.classList.toggle('off', !v); setPilih(t.id, v); }),
                h('div', {}, h('div', { class: 'item-title' }, `Dititipkan ke ${t.hostId} · ${t.nama}`),
                    h('div', { class: 'item-sub' }, pill(t.draft1 === 'koreksi' ? 'draft #1 = paket ini setelah dikoreksi' : 'draft #1 = paket ini tanpa perubahan', 'p-mut'), h('span', {}, `kode RUP paket ini ikut berganti`))),
                h('div', { class: 'item-side' }, h('b', {}, `${anak.length} paket baru`), h('span', { class: 'muted', style: { fontSize: '12px' } }, 'Rp' + fmt(anak.reduce((s, b) => s + b.total, 0))))));
            grp.append(h('div', { class: 'sub-items' }, ...anak.map(kartuPaketBaru)));
            el.append(grp);
        }
        if (tanpa.length) el.append(h('div', { class: 'errbox' }, `${tanpa.length} paket baru tidak punya paket terumumkan yang bisa dititipi. Minta PPK membuat satu paket di komponen itu, umumkan, lalu baca ulang.`), ...tanpa.map(kartuPaketBaru));
        actEl.append(barLanjut('Lanjut: jalankan →', 'jalankan'));
    }
    function kartuPaketBaru(b) {
        const err = Rencana.periksa(b, { komponenId });
        const sel = h('input', { type: 'checkbox', class: 'sdr-bulk-sel', title: 'Pilih untuk isian massal' }); sel._pk = b; sel._id = b.id;
        sel.addEventListener('change', () => bulkHitung && bulkHitung());
        const on = chk(dipilih(b), v => { el.classList.toggle('off', !v); setPilih(b.id, v); });
        on.title = 'Ikut dijalankan';
        const nama = h('input', { type: 'text', value: b.nama, style: { width: '100%' } }); nama.addEventListener('change', () => { b.nama = nama.value; catatEdit(b.id, b, 'nama'); });
        const hostSel = b.kandidatHost && b.kandidatHost.length > 1 ? (() => {
            const s = h('select', { style: { maxWidth: '360px' } }, ...b.kandidatHost.map(c => h('option', { value: c.paketId, selected: c.paketId === b.hostId }, `${c.paketId} · ${c.nama.slice(0, 44)}`)));
            s.addEventListener('change', () => { S.atur[b.id] = { ...(S.atur[b.id] || {}), host: s.value }; simpanKeadaan(); hitungUlang(); });
            return s;
        })() : null;
        const ed = editorIsian(b.id, b, true);
        const el = h('div', { class: 'sub-item' + (dipilih(b) ? '' : ' off') },
            h('div', { class: 'item-hd' }, h('div', { class: 'cb2' }, h('label', {}, on, h('span', {}, 'jalankan')), h('label', {}, sel, h('span', {}, 'massal'))),
                h('div', {}, nama,
                    h('div', { class: 'item-sub' }, pill(b.jenis, 'p-info'), h('span', {}, b.metode), h('span', { class: 'mono' }, b.anggaran.map(a => a.mak.split('.').slice(-2).join('.')).join(', '))),
                    h('div', { class: 'sumber' }, `Lokasi: ${b.lokasiRaw.map(l => l.kab || l.id_kabupaten).join(', ') || '—'}${b.lokasiSumber ? ' (' + b.lokasiSumber + ')' : ''} · Jadwal: ${b.jadwal.awalPengadaan} s.d. ${b.jadwal.kebutuhan} (${b.jadwalSumber})${b.realisasi ? ` · realisasi ${Math.round(b.realisasi * 100)}%` : ''}`),
                    hostSel ? h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'muted', style: { fontSize: '12.5px' } }, `Dititipkan (${b.hostKet}):`), hostSel) : null,
                    b.peringatan.length ? h('div', { class: 'notes', style: { margin: '8px 0 0' } }, ...b.peringatan.map(t => h('div', {}, '• ' + t))) : null,
                    err.length ? h('div', { class: 'errbox', style: { margin: '8px 0 0', padding: '8px 12px' } }, 'Perlu diperbaiki: ' + err.join('; ')) : null),
                h('div', { class: 'item-side' }, h('b', {}, 'Rp' + fmt(b.total)), ed.tombol)), ed.body);
        return el;
    }
    let bulkHitung = null;
    function bulkBaru() {
        const JN = Object.keys(Sirup.JENIS_ID), MT = [...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
        const f = {};
        const js = h('select', {}, h('option', { value: '' }, '— tidak diubah —'), ...JN.map(j => h('option', {}, j)));
        const mt = h('select', {}, h('option', { value: '' }, '— tidak diubah —'), ...MT.map(j => h('option', {}, j)));
        const pd = h('select', {}, h('option', { value: '' }, '— tidak diubah —'), h('option', { value: '1' }, 'Ya'), h('option', { value: '0' }, 'Tidak'));
        const mon = k => { const i = h('input', { type: 'month' }); f[k] = i; return i; };
        const rng = (a, b) => h('div', { class: 'range' }, mon(a), h('span', {}, 's.d.'), mon(b));
        const field = (label, input) => h('div', { class: 'field' }, h('label', {}, label), input);
        const sel = () => [...document.querySelectorAll('.sdr-bulk-sel')].filter(c => c.checked).map(c => c._pk);
        const info = h('b', {}, '0 paket dipilih');
        bulkHitung = () => { info.textContent = `${sel().length} dari ${S.ren.paketBaru.length} paket baru dipilih`; };
        const apply = h('button', { class: 'btn pri' }, 'Terapkan ke paket terpilih');
        apply.addEventListener('click', () => {
            const ps = sel(); if (!ps.length) { log('Pilih paket dulu (kotak kecil kedua di kiri tiap paket).', 'w'); return; }
            for (const pk of ps) {
                if (js.value) { pk.jenis = js.value; pk.jenisList = null; catatEdit(pk.id, pk, 'jenis'); }
                if (mt.value) { pk.metode = mt.value; catatEdit(pk.id, pk, 'metode'); }
                if (pd.value) { pk.praDipa = pd.value === '1'; catatEdit(pk.id, pk, 'praDipa'); }
                let j = false; for (const [k, i] of Object.entries(f)) if (i.value) { pk.jadwal[k] = i.value; j = true; }
                if (j) catatEdit(pk.id, pk, 'jadwal');
            }
            log(`Isian massal diterapkan ke ${ps.length} paket.`, 'o'); hitungUlang();
        });
        const copyLok = h('button', { class: 'btn' }, 'Samakan lokasi');
        copyLok.addEventListener('click', () => {
            const ps = sel(); if (ps.length < 2) { log('Pilih minimal 2 paket; lokasi paket pertama disalin ke yang lain.', 'w'); return; }
            for (const pk of ps.slice(1)) { pk.lokasiRaw = ps[0].lokasiRaw.map(l => ({ ...l, id: '' })); catatEdit(pk.id, pk, 'lokasiRaw'); }
            log(`Lokasi disalin ke ${ps.length - 1} paket.`, 'o'); hitungUlang();
        });
        setTimeout(bulkHitung, 0);
        return h('details', { class: 'bulk' }, h('summary', {}, 'Isian massal untuk paket baru'),
            h('div', { class: 'formgrid' }, field('Jenis pengadaan', js), field('Metode pemilihan', mt), field('Pra-DIPA', pd)),
            h('div', { class: 'rangegrid' }, field('Pemilihan penyedia', rng('awalPengadaan', 'akhirPengadaan')), field('Pelaksanaan kontrak', rng('awalPekerjaan', 'akhirPekerjaan')), field('Pemanfaatan barang/jasa', rng('awalKebutuhan', 'kebutuhan'))),
            h('div', { class: 'row' }, info,
                h('button', { class: 'btn sm', onclick: () => { document.querySelectorAll('.sdr-bulk-sel').forEach(c => { c.checked = true; }); bulkHitung(); } }, 'Pilih semua'),
                h('button', { class: 'btn sm', onclick: () => { document.querySelectorAll('.sdr-bulk-sel').forEach(c => { c.checked = false; }); bulkHitung(); } }, 'Kosongkan'),
                h('span', { style: { flex: 1 } }), copyLok, apply));
    }

    // Editor isian satu paket (baru atau hasil revisi). Perubahan langsung dicatat per id rencana.
    const JENIS = Object.keys(Sirup.JENIS_ID);
    const METODE = [...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
    function editorIsian(id, pk, baru, onUbah) {
        const tombol = h('button', { class: 'btn sm' }, '✎ Ubah isian');
        const status = h('span', { class: 'muted', style: { fontSize: '12.5px' } });
        const bd = h('div', { class: 'editor', style: { display: 'none' } });
        let built = false;
        const ringkas = () => { status.textContent = `${pk.jenis} · ${pk.metode} · pemilihan ${(pk.jadwal || {}).awalPengadaan || '?'} · ${(pk.lokasiRaw || []).length} lokasi`; };
        ringkas();
        tombol.addEventListener('click', () => { if (!built) { isi(); built = true; } const s = bd.style.display === 'none'; bd.style.display = s ? '' : 'none'; tombol.textContent = s ? '▴ Tutup isian' : '✎ Ubah isian'; });
        return { tombol, status, body: bd };
        function isi() {
            const fs = (judul, ...x) => h('div', { class: 'fs' }, h('h4', {}, judul), ...x);
            const field = (label, input, hint) => h('div', { class: 'field' }, h('label', {}, label), input, hint ? h('div', { class: 'hint' }, hint) : null);
            const ubah = k => { catatEdit(id, pk, k); ringkas(); if (onUbah) onUbah(k); };
            if (!baru) { const t = h('input', { type: 'text', value: pk.nama, style: { width: '100%' } }); t.addEventListener('change', () => { pk.nama = t.value; ubah('nama'); }); bd.append(fs('Nama paket', t)); }
            // anggaran: paket baru → pagu per baris bisa diubah; paket existing → hasil keputusan (baca saja)
            const tb = h('tbody', {});
            pk.anggaran.forEach(a => {
                const pg = h('input', { type: 'number', value: Math.round(a.pagu), style: { width: '170px' }, disabled: !baru });
                pg.addEventListener('change', () => { a.pagu = +pg.value || 0; ubah('anggaran'); });
                const dana = h('select', { disabled: !baru }, ...[['A', 'RM'], ['D', 'PNBP'], ['F', 'BLU'], ['T', 'SBSN'], ['B', 'PLN']].map(([v, t]) => h('option', { value: v, selected: (a.danaApbn || 'A') === v }, t)));
                dana.addEventListener('change', () => { a.danaApbn = dana.value; ubah('anggaran'); });
                const kid = a.idKomponen || komponenId(a.mak);
                tb.append(h('tr', {}, h('td', { class: 'mono' }, a.mak), h('td', {}, dana), h('td', {}, pg), h('td', {}, kid ? pill('komponen PKKR ' + kid, 'p-mut') : pill('komponen belum ada di PKKR (langkah 2)', 'p-bad'))));
            });
            bd.append(fs('Anggaran', h('table', { class: 'mak-t' }, h('thead', {}, h('tr', {}, h('th', {}, 'MAK'), h('th', {}, 'Dana'), h('th', {}, 'Pagu (Rp)'), h('th', {}, 'PKKR'))), tb),
                baru ? null : h('div', { class: 'hint muted', style: { fontSize: '12px', marginTop: '6px' } }, 'Baris anggaran paket existing mengikuti keputusan di langkah 1–2.')));
            const js = h('select', {}, ...JENIS.map(j => h('option', { selected: j === pk.jenis }, j))); js.addEventListener('change', () => { pk.jenis = js.value; pk.jenisList = null; ubah('jenis'); ubah('jenisList'); });
            const mt = h('select', {}, ...METODE.map(m => h('option', { selected: m === pk.metode }, m))); mt.addEventListener('change', () => { pk.metode = mt.value; ubah('metode'); });
            const cbx = (label, k) => h('label', {}, chk(!!pk[k], v => { pk[k] = v; ubah(k); if (k === 'umkm') umkmBox.style.display = v ? 'none' : ''; }), label);
            const alasan = h('select', { style: { width: '100%' } }, h('option', { value: '' }, '— pilih alasan —'), ...(S.alasanUmkmList || []).map(a => h('option', { selected: a === pk.alasanUmkm }, a)));
            alasan.addEventListener('change', () => { pk.alasanUmkm = alasan.value; ubah('alasanUmkm'); });
            const umkmBox = h('div', { style: { display: pk.umkm ? 'none' : '' } }, field('Alasan bukan usaha kecil', alasan));
            pk.spp = pk.spp || { ekonomi: true, sosial: true, lingkungan: false };
            const spp = (label, k) => h('label', {}, chk(!!pk.spp[k], v => { pk.spp[k] = v; ubah('spp'); }), label);
            bd.append(fs('Pengadaan', h('div', { class: 'formgrid' },
                field('Jenis pengadaan', js), field('Metode pemilihan', mt, 'Paket meeting/penginapan hotel: Dikecualikan'),
                field('Penanda', h('div', { class: 'checks' }, cbx('Pra-DIPA', 'praDipa'), cbx('Produk dalam negeri', 'pdn'), cbx('Usaha kecil/koperasi', 'umkm'))),
                field('Pengadaan berkelanjutan (SPP)', h('div', { class: 'checks' }, spp('Ekonomi', 'ekonomi'), spp('Sosial', 'sosial'), spp('Lingkungan', 'lingkungan')))), umkmBox));
            pk.jadwal = pk.jadwal || {};
            const mon = k => { const i = h('input', { type: 'month', value: pk.jadwal[k] || '' }); i.addEventListener('change', () => { pk.jadwal[k] = i.value; ubah('jadwal'); }); return i; };
            const rng = (a, b) => h('div', { class: 'range' }, mon(a), h('span', {}, 's.d.'), mon(b));
            bd.append(fs('Jadwal', h('div', { class: 'rangegrid' },
                field('Pemilihan penyedia', rng('awalPengadaan', 'akhirPengadaan')),
                field('Pelaksanaan kontrak', rng('awalPekerjaan', 'akhirPekerjaan'), 'Awal kontrak tidak boleh sebelum akhir pemilihan'),
                field('Pemanfaatan barang/jasa', rng('awalKebutuhan', 'kebutuhan')))));
            bd.append(fs('Lokasi pekerjaan', lokasiEditor(pk, () => ubah('lokasiRaw'))));
            const ur = h('textarea', {}, pk.uraian || ''); ur.addEventListener('change', () => { pk.uraian = ur.value; ubah('uraian'); });
            const sp = h('textarea', { maxlength: 1000 }, pk.spesifikasi || ''); sp.addEventListener('change', () => { pk.spesifikasi = sp.value; ubah('spesifikasi'); });
            const vol = h('input', { type: 'text', value: pk.volume || '1 Paket' }); vol.addEventListener('change', () => { pk.volume = vol.value; ubah('volume'); });
            bd.append(fs('Uraian & spesifikasi', h('div', { class: 'formgrid', style: { gridTemplateColumns: '1fr' } }, field('Volume pekerjaan', vol)),
                h('div', { class: 'grid2', style: { marginTop: '12px' } }, field('Uraian pekerjaan', ur, baru ? 'Disusun dari item DIPA' : ''), field('Spesifikasi pekerjaan', sp, 'Maksimal 1.000 karakter (aturan SiRUP)'))));
        }
    }
    function lokasiEditor(pk, onChange, maks) {
        const box = h('div', {});
        const ubah = () => { if (onChange) onChange(); };
        const draw = () => {
            box.innerHTML = '';
            box.append(h('div', { class: 'lok', style: { marginBottom: '4px' } }, ...['Provinsi', 'Kabupaten/Kota', 'Detail lokasi', ''].map(t => h('span', { class: 'muted', style: { fontSize: '12px', fontWeight: 600 } }, t))));
            pk.lokasiRaw.forEach((l, j) => {
                const pv = h('select', {}, h('option', { value: '' }, '— pilih provinsi —'), ...Sirup.PROVINSI.map((n, i) => n ? h('option', { value: i, selected: +l.id_provinsi === i }, n) : null));
                const kb = h('select', {}, h('option', { value: '' }, '— pilih kab/kota —'));
                const fillKab = async () => {
                    kb.innerHTML = ''; kb.append(h('option', { value: '' }, '— pilih kab/kota —'));
                    if (!pv.value) return;
                    for (const k of await Sirup.kabupaten(+pv.value)) kb.append(h('option', { value: k.id, selected: +l.id_kabupaten === k.id }, k.nama));
                };
                pv.addEventListener('change', () => { l.id_provinsi = +pv.value; l.id_kabupaten = ''; l.prov = Sirup.PROVINSI[+pv.value]; fillKab(); ubah(); });
                kb.addEventListener('change', () => { l.id_kabupaten = +kb.value; l.kab = kb.options[kb.selectedIndex] ? kb.options[kb.selectedIndex].textContent : ''; ubah(); });
                const dt = h('input', { type: 'text', value: l.detil || '', placeholder: 'mis. nama kampus / alamat' }); dt.addEventListener('change', () => { l.detil = dt.value; ubah(); });
                fillKab();
                box.append(h('div', { class: 'lok' }, pv, kb, dt, pk.lokasiRaw.length > 1 ? h('button', { class: 'btn sm ghost', onclick: () => { pk.lokasiRaw.splice(j, 1); ubah(); draw(); } }, 'Hapus') : h('span', {})));
            });
            if (!maks || pk.lokasiRaw.length < maks) box.append(h('button', { class: 'btn sm', onclick: () => { pk.lokasiRaw.push({ id: '', id_provinsi: '', id_kabupaten: '', detil: '' }); ubah(); draw(); } }, '+ Tambah lokasi'));
        };
        draw();
        return box;
    }

    // ── 4.4 Jalankan ────────────────────────────────────────────────────
    function tahunDipa() { const m = String((S.dipa.meta || {}).periode || '').match(/(20\d\d)/); return m ? +m[1] : null; }
    function kesiapan() {
        const r = S.ren, out = [];
        const add = (ok, teks, fatal) => out.push({ ok, teks, fatal: !ok && fatal });
        add(S.ctx.isKPA, S.ctx.isKPA ? `Login KPA (${S.ctx.role})` : `Role "${S.ctx.role}" bukan KPA — eksekusi tidak tersedia`, true);
        add(!S.dipa.meta.satker || S.dipa.meta.satker === S.ctx.kodeSatker, `PDF DIPA milik satker ${S.dipa.meta.satker || '?'}, login satker ${S.ctx.kodeSatker || '?'}`, true);
        const th = tahunDipa();
        add(!th || th === S.ctx.tahun, th ? `Tahun DIPA ${th}, tahun SiRUP ${S.ctx.tahun}` : `Tahun DIPA tidak tertulis di PDF (RKK); tahun SiRUP ${S.ctx.tahun}`, true);
        add(!!(S.ctx.kodeBA && S.ctx.kodeEselon && S.ctx.kodeSatker), `Kode BA.eselon.satker: ${S.ctx.kodeBA || '?'}.${S.ctx.kodeEselon || '?'}.${S.ctx.kodeSatker || '?'}`, true);
        const pks = [...r.perubahan.filter(c => dipilih(c) && c.pk).map(c => [c.paketId, c.pk]), ...r.paketBaru.filter(b => dipilih(b) && b.hostId).map(b => [b.nama.slice(0, 50), b])];
        const salah = pks.map(([n, pk]) => [n, Rencana.periksa(pk, { komponenId })]).filter(([, e]) => e.length);
        const pkkr = salah.filter(([, e]) => e.some(x => /PKKR/.test(x)));
        add(!pkkr.length, pkkr.length ? `${pkkr.length} paket memakai komponen yang belum ada di PKKR — selesaikan langkah 2 dulu` : 'Semua komponen PKKR tersedia', false);
        add(!salah.length, salah.length ? `${salah.length} paket isiannya belum lengkap: ${salah.slice(0, 4).map(([n, e]) => `${n} (${e.join(', ')})`).join('; ')}` : 'Isian semua paket lengkap', false);
        const belum = r.kartu.filter(k => !k.diputuskan).length;
        add(true, belum ? `${belum} kartu belum diputuskan — tidak ikut dijalankan` : 'Semua kartu sudah diputuskan', false);
        return { out, salah };
    }
    function siapkanPk(pk) {
        const x = salin(pk);
        for (const a of x.anggaran || []) a.idKomponen = a.idKomponen || komponenId(a.mak);
        if (!x.pertahankan && !x.umkm && !x.alasanUmkm) {
            const L = S.alasanUmkmList || [];
            const tot = (x.anggaran || []).reduce((s, a) => s + (+a.pagu || 0), 0);
            x.alasanUmkm = (tot > 15e9 && L.find(a => /15/.test(a))) || L[0] || '';
        }
        delete x.items; delete x.kandidatHost; delete x.peringatan;
        return x;
    }
    // Satu pengajuan → satu langkah antrean (isian disalin saat itu juga)
    function langkahDari(it) {
        const snap = id => { const p = S.pakets.find(x => x.id === id); return p ? { status: p.status, pagu: +p.pagu } : null; };
        if (it.jenis === 'ubah') { const c = it.c; return { id: c.id, jenis: 'ubah', paketId: c.paketId, nama: c.nama, alasan: it.alasan, umumkanDulu: c.umumkanDulu, pk: siapkanPk(c.pk), snap: snap(c.paketId), sebelum: c.sebelum, sesudah: c.sesudah }; }
        if (it.jenis === 'titip') {
            const { t, ch, chOn } = it;
            return { id: t.id, jenis: 'titip', paketId: t.hostId, nama: t.nama, draft1: chOn ? 'koreksi' : 'tetap', snap: snap(t.hostId), alasan: it.alasan,
                pks: [chOn ? siapkanPk(ch.pk) : siapkanPk(t.pk1), ...it.anak.filter(dipilih).map(siapkanPk)], sebelum: t.pagu, sesudah: it.sesudah };
        }
        if (it.jenis === 'umumkan') {
            const us = it.daftar.filter(dipilih), ids = us.map(u => u.paketId);
            return { id: 'umumkan', jenis: 'umumkan', ids, nama: `${ids.length} final draft`, snap: Object.fromEntries(ids.map(i => [i, snap(i)])), sebelum: 0, sesudah: us.reduce((s, u) => s + u.pagu, 0) };
        }
        if (it.jenis === 'batal') { const c = it.c; return { id: c.id, jenis: 'batal', paketId: c.paketId, nama: c.nama, alasan: it.alasan, snap: snap(c.paketId), sebelum: c.sebelum, sesudah: 0 }; }
        return { id: it.id, jenis: 'batalFD', paketId: it.paketId, nama: it.nama, alasan: it.alasan, snap: snap(it.paketId) };
    }
    // Urutan aman: revisi 1→1 dan titipan 1→N lebih dulu, lalu umumkan final draft, pembatalan paling akhir.
    // Bila satu revisi gagal proses berhenti, sehingga paket yang akan digantikan belum terlanjur dibatalkan.
    function susunAntrean() {
        const pj = daftarPengajuan().filter(it => it.on && (it.jenis !== 'titip' || it.anak.some(dipilih)));
        const ubah = pj.filter(it => it.jenis === 'ubah');
        const urut = [...ubah.filter(it => !it.umumkanDulu), ...ubah.filter(it => it.umumkanDulu), ...['titip', 'umumkan', 'batal', 'batalFD'].flatMap(j => pj.filter(it => it.jenis === j))];
        const langkah = urut.map(langkahDari).filter(L => L.jenis !== 'umumkan' || L.ids.length);
        return { dibuat: new Date().toISOString(), satker: S.ctx.kodeSatker, tahun: S.ctx.tahun, langkah: langkah.map(x => ({ ...x, status: 'menunggu' })) };
    }
    const JENIS_LANGKAH = { batalFD: 'Kembalikan final draft ke PPK', batal: 'Batalkan paket', ubah: 'Revisi satu ke satu', titip: 'Revisi satu ke banyak', umumkan: 'Umumkan final draft' };
    const ST_LANGKAH = { menunggu: ['menunggu', 'p-mut'], berjalan: ['berjalan…', 'p-info'], selesai: ['selesai', 'p-ok'], gagal: ['gagal', 'p-bad'], dilewati: ['dilewati', 'p-warn'] };
    function uraianLangkah(L) {
        if (L.jenis === 'titip') return `${L.paketId} · draft #1 ${L.draft1 === 'koreksi' ? 'dikoreksi' : 'tetap'} + ${L.pks.length - 1} paket baru`;
        if (L.jenis === 'umumkan') return L.ids.join(', ');
        return `${L.paketId} · ${L.nama}${L.umumkanDulu ? ' (umumkan dulu)' : ''}`;
    }
    function tabJalankan(el) {
        const { out, salah } = kesiapan();
        const fatal = out.some(x => x.fatal);
        el.append(h('div', { class: 'card' }, h('h3', {}, 'Pemeriksaan sebelum menjalankan'),
            h('div', { class: 'cek' }, ...out.map(x => h('div', { class: x.ok ? 'ok' : x.fatal ? 'bad' : 'warn' }, (x.ok ? '✓ ' : x.fatal ? '✕ ' : '! ') + x.teks)))));
        const A = S.antre;
        if (!A || A.langkah.every(x => x.status !== 'menunggu' && x.status !== 'berjalan') && !A.langkah.some(x => x.status === 'gagal')) {
            if (A) el.append(laporanAntre(A));
            el.append(h('div', { class: 'card' }, h('h3', {}, 'Antrean eksekusi'),
                h('p', { class: 'note' }, 'Antrean disusun dari pilihan saat ini. Tiap langkah memeriksa ulang status dan pagu paket di SiRUP sebelum dikirim; bila berubah sejak dibaca, langkah itu dihentikan.'),
                h('button', { class: 'btn pri', disabled: fatal, onclick: () => { S.antre = susunAntrean(); simpanAntre(); log(`Antrean disusun: ${S.antre.langkah.length} langkah.`, 'o'); gambarRekap(); } }, A ? 'Susun antrean baru dari pilihan saat ini' : 'Susun antrean dari pilihan saat ini'),
                salah.length ? h('div', { class: 'muted', style: { marginTop: '8px', fontSize: '12.5px' } }, 'Paket yang isiannya belum lengkap tetap masuk antrean tetapi akan ditolak saat dijalankan — lengkapi dulu.') : null));
            actEl.append(h('div', { class: 'actionbar' }, h('span', { class: 'sum' }, ringkasPilihan())));
            return;
        }
        el.append(daftarAntre(A));
        const sisa = A.langkah.filter(x => x.status === 'menunggu').length;
        actEl.append(h('div', { class: 'actionbar' }, h('span', { class: 'sum' }, `${sisa} langkah menunggu · ${A.langkah.filter(x => x.status === 'selesai').length} selesai`),
            h('button', { class: 'btn danger', onclick: () => { S.stop = true; log('Permintaan berhenti diterima; proses berhenti setelah langkah berjalan selesai.', 'w'); } }, '■ Hentikan'),
            h('button', { class: 'btn', disabled: fatal || !sisa || !S.ctx.isKPA, onclick: () => guard(() => jalankanAntrean(true)) }, '▶ Jalankan 1 langkah'),
            h('button', { class: 'btn go', disabled: fatal || !sisa || !S.ctx.isKPA, onclick: () => guard(() => jalankanAntrean(false)) }, '▶▶ Jalankan semua')));
    }
    function daftarAntre(A) {
        const tb = h('tbody', {});
        A.langkah.forEach((L, i) => {
            const [st, cls] = ST_LANGKAH[L.status] || [L.status, 'p-mut'];
            const aksi = h('div', { class: 'row' });
            if (L.jenis === 'ubah' || L.jenis === 'titip') aksi.append(h('button', { class: 'btn sm ghost', onclick: () => lihatData(L) }, 'Lihat data'));
            if (L.status === 'gagal') aksi.append(h('button', { class: 'btn sm', onclick: () => { L.status = 'selesai'; L.pesan = (L.pesan || '') + ' · ditandai selesai manual'; simpanAntre(); gambarRekap(); } }, 'Tandai selesai'),
                h('button', { class: 'btn sm', onclick: () => { L.status = 'dilewati'; simpanAntre(); gambarRekap(); } }, 'Lewati'));
            if (L.jenis === 'batal' && L.status === 'selesai' && !L.diaktifkan) aksi.append(h('button', { class: 'btn sm', disabled: !S.ctx.isKPA, title: 'Batalkan pembatalan: paket diaktifkan kembali (kode RUP tetap) lalu diumumkan ulang', onclick: () => guard(() => aktifkanKembali(L)) }, '↶ Aktifkan kembali'));
            tb.append(h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, JENIS_LANGKAH[L.jenis]), h('td', {}, uraianLangkah(L)), h('td', { class: 'n' }, L.sebelum != null ? `${fmt(L.sebelum)} → ${fmt(L.sesudah)}` : ''),
                h('td', {}, pill(st, cls), L.diaktifkan ? [' ', pill('diaktifkan kembali', 'p-info')] : null, L.satuan ? [' ', pill('diajukan satuan', 'p-mut')] : null, L.hasil ? h('div', { class: 'muted', style: { fontSize: '12px' } }, L.hasil) : null, L.pesan ? h('div', { style: { fontSize: '12px', color: '#b91c1c' } }, L.pesan) : null), h('td', {}, aksi)));
        });
        return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Antrean eksekusi'), h('span', { class: 'muted' }, `disusun ${new Date(A.dibuat).toLocaleString('id-ID')}`), h('span', { style: { flex: 1 } }),
            h('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmBox('Hapus antrean', '<p>Antrean dihapus dari peramban ini. Langkah yang sudah selesai di SiRUP tidak dibatalkan.</p>', 'Hapus')) { S.antre = null; simpanAntre(); gambarRekap(); } } }, 'Hapus antrean')),
            h('div', { class: 'tbl', style: { marginTop: '10px' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Langkah'), h('th', {}, 'Paket'), h('th', { class: 'n' }, 'Pagu'), h('th', {}, 'Status'), h('th', {}, ''))), tb)));
    }
    function laporanAntre(A) {
        const selesai = A.langkah.filter(x => x.status === 'selesai');
        return h('div', { class: 'card' }, h('h3', {}, 'Hasil eksekusi terakhir'),
            h('p', { class: 'note' }, `${selesai.length} dari ${A.langkah.length} langkah selesai. Baca ulang RUP untuk memastikan rencana sudah tidak menyisakan perubahan, lalu samakan Struktur Anggaran.`),
            daftarAntre(A),
            h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => guard(async () => { await loadPakets(true); S.an = null; ensureAnalysis(); rekapTab = 'putuskan'; gambarRekap(); }) }, '↻ Baca ulang RUP'),
                h('button', { class: 'btn', onclick: exportExcel }, '⬇ Laporan Excel'), h('button', { class: 'btn pri', onclick: () => go(4) }, 'Lanjut: Struktur Anggaran →')));
    }
    async function lihatData(L) {
        const pay = L.jenis === 'ubah' ? await Sirup.revisiSatuKeSatu(S.ctx, { id: L.paketId }, L.pk, L.alasan, { dryRun: true })
            : await Sirup.revisiSatuKeBanyak(S.ctx, { id: L.paketId }, L.pks, L.alasan, { dryRun: true });
        await modal(`Data yang dikirim — ${JENIS_LANGKAH[L.jenis]} ${L.paketId} (belum dikirim)`, h('div', {},
            h('p', { class: 'note' }, 'Isian ini digabung dengan form revisi SiRUP saat dijalankan (id baris dan isian lain diambil dari form).'),
            ...pay.payloads.map((f, i) => h('details', { open: i === 0 }, h('summary', {}, `Draft #${i + 1}${L.jenis === 'titip' && i === 0 ? (L.draft1 === 'koreksi' ? ' (paket ini, dikoreksi)' : ' (paket ini, tanpa perubahan)') : ''}`),
                h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap' } }, [...f.entries()].map(([k, v]) => `${k} = ${v}`).join('\n'))))), [['Tutup', false, 'pri']]);
    }
    function salahIsiLangkah(L) {
        const pks = L.jenis === 'ubah' ? [L.pk] : L.jenis === 'titip' ? L.pks : [];
        for (const pk of pks) for (const a of pk.anggaran || []) a.idKomponen = a.idKomponen || komponenId(a.mak);
        return pks.map((pk, i) => [i, Rencana.periksa(pk, { komponenId })]).filter(([, e]) => e.length)
            .map(([i, e]) => `${L.jenis === 'titip' ? `draft #${i + 1}: ` : ''}${e.join(', ')}`);
    }
    async function daftarKini() { return new Map((await Sirup.daftarPaket(S.ctx.tahun)).map(p => [p.id, p])); }
    async function jalankanAntrean(satu) {
        const A = S.antre;
        const todo = A.langkah.filter(x => x.status === 'menunggu');
        if (!todo.length) return;
        if (!satu) {
            const salah = todo.map(L => [L, salahIsiLangkah(L)]).filter(([, e]) => e.length);
            if (salah.length) {
                const lewati = await modal('Ada langkah yang isiannya belum lengkap', h('div', {},
                    h('p', { class: 'note' }, `${salah.length} langkah tidak bisa dikirim ke SiRUP. Lengkapi dulu (mis. tambah cabang PKKR di langkah 2, atur lokasi satker), atau lewati langkah itu dan jalankan sisanya.`),
                    h('div', { class: 'errbox' }, ...salah.slice(0, 20).map(([L, e]) => h('div', {}, `${JENIS_LANGKAH[L.jenis]} ${uraianLangkah(L)}: ${e.join('; ')}`)))),
                    [['Batal', false, ''], ['Lewati yang belum lengkap', true, 'go']]);
                if (!lewati) return;
                for (const [L, e] of salah) { L.status = 'dilewati'; L.pesan = 'isian belum lengkap: ' + e.join('; '); }
                simpanAntre(); gambarRekap();
                return jalankanAntrean(false);
            }
        }
        const daftar = (satu ? [todo[0]] : todo);
        const ok = await confirmBox(satu ? 'Jalankan 1 langkah di SiRUP' : `Jalankan ${todo.length} langkah di SiRUP`,
            `<ol>${daftar.map(L => `<li><b>${JENIS_LANGKAH[L.jenis]}</b> — ${esc(uraianLangkah(L))}</li>`).join('')}</ol>
            <p class="note">Semua langkah mengubah data SiRUP atas nama akun KPA ini. Hasil revisi (Final Draft) langsung diumumkan. Bila satu langkah gagal, proses berhenti dan langkah berikutnya tidak dijalankan.</p>`);
        if (!ok) return;
        await eksekusi(daftar);
    }
    async function eksekusi(daftar) {
        let tersentuh = 0;
        try {
            for (const L of daftar) {
                if (S.stop) { log('Dihentikan.', 'w'); break; }
                L.status = 'berjalan'; L.pesan = ''; simpanAntre(); gambarRekap();
                log(`${JENIS_LANGKAH[L.jenis]}: ${uraianLangkah(L)}`);
                tersentuh++;
                try { await jalankanLangkah(L); L.status = 'selesai'; log(`  selesai${L.hasil ? ' — ' + L.hasil : ''}`, 'o'); }
                catch (e) { L.status = 'gagal'; L.pesan = e.message; simpanAntre(); gambarRekap(); throw e; }
                simpanAntre(); gambarRekap();
                await Sirup.sleep(S.cfg.jeda);
            }
        } finally {
            // SiRUP sudah berubah → data paket lama tidak boleh dipakai lagi (rencana, struktur anggaran, Excel)
            if (tersentuh) await segarkanSetelahEksekusi();
        }
    }
    async function segarkanSetelahEksekusi() {
        try {
            log('Membaca ulang paket RUP setelah eksekusi…');
            await loadPakets(true);
            S.an = null; ensureAnalysis();
            log('Paket RUP sudah dibaca ulang; rencana dihitung dari data terbaru.', 'o');
        } catch (e) { log(`Gagal membaca ulang paket setelah eksekusi (${e.message}). Klik "Baca ulang RUP" sebelum lanjut.`, 'e'); }
        gambarRekap();
    }
    // "Ajukan sekarang" dari popup: satu pengajuan langsung dikirim; dicatat di antrean supaya tampil di laporan
    async function ajukanSatu(id) {
        const it = daftarPengajuan().find(x => x.id === id);
        if (!it) throw new Error('Pengajuan ini tidak ada lagi di rencana terbaru. Periksa daftar pengajuan.');
        const fatal = kesiapan().out.filter(x => x.fatal);
        if (fatal.length) throw new Error('Belum bisa dijalankan: ' + fatal.map(x => x.teks).join('; '));
        const L0 = langkahDari(it);
        if (L0.jenis === 'umumkan' && !L0.ids.length) throw new Error('Tidak ada final draft yang dicentang.');
        if (L0.jenis === 'titip' && L0.pks.length < 2) throw new Error('Tidak ada paket baru yang dicentang untuk dititipkan.');
        const salah = salahIsiLangkah(L0);
        if (salah.length) throw new Error('Isian belum lengkap, tidak dikirim: ' + salah.join('; '));
        const ok = await confirmBox(`Ajukan ke SiRUP: ${JENIS_LANGKAH[L0.jenis]}`, `<p><b>${esc(uraianLangkah(L0))}</b></p>${L0.alasan ? `<p>Alasan: ${esc(L0.alasan)}</p>` : ''}
            <p class="note">Pengajuan ini langsung dikirim ke SiRUP atas nama akun KPA${L0.jenis === 'ubah' || L0.jenis === 'titip' ? '; hasil revisi (Final Draft) langsung diumumkan' : ''}. Pengajuan lain tidak ikut dijalankan.</p>`, 'Ajukan sekarang');
        if (!ok) return;
        if (!S.antre) S.antre = { dibuat: new Date().toISOString(), satker: S.ctx.kodeSatker, tahun: S.ctx.tahun, langkah: [] };
        let L = S.antre.langkah.find(x => x.id === L0.id && (x.status === 'menunggu' || x.status === 'gagal'));
        if (L) Object.assign(L, L0, { status: 'menunggu', pesan: '' });
        else { L = { ...L0, status: 'menunggu', satuan: true }; S.antre.langkah.push(L); }
        simpanAntre();
        await eksekusi([L]);
    }
    // Paket yang dibatalkan lewat tool bisa dikembalikan: revisi "Aktifkan" SiRUP (kode tetap, jadi Final Draft) lalu umumkan
    async function aktifkanKembali(L) {
        const ok = await confirmBox('Aktifkan kembali paket', `<p>Paket <b>${esc(L.paketId)}</b> · ${esc(L.nama)} diaktifkan kembali lewat revisi "Aktifkan" SiRUP (kode RUP tetap, status menjadi Final Draft), lalu langsung diumumkan ulang.</p>
            <p class="note">RUP terumumkan bertambah kembali Rp${fmt(L.sebelum)}.</p>`, 'Aktifkan & umumkan');
        if (!ok) return;
        const p0 = (await daftarKini()).get(L.paketId);
        if (!p0 || p0.status !== '51') throw new Error(`Paket ${L.paketId} tidak berstatus Dibatalkan (sekarang ${p0 ? Analysis.ST[p0.status] || p0.status : 'tidak ada di daftar'}).`);
        try {
            await Sirup.aktifkanPaket(L.paketId, 'Pembatalan dibatalkan; paket tetap diperlukan sesuai DIPA');
            let p = (await daftarKini()).get(L.paketId);
            if (!p || p.status !== '2') throw new Error(`Paket ${L.paketId} belum kembali menjadi Final Draft (sekarang ${p ? Analysis.ST[p.status] || p.status : 'tidak ada di daftar'}).`);
            await Sirup.umumkan([L.paketId]);
            p = (await daftarKini()).get(L.paketId);
            if (!p || p.status !== '3') throw new Error(`Paket ${L.paketId} sudah aktif sebagai Final Draft, tetapi belum terumumkan. Umumkan manual di SiRUP.`);
            L.diaktifkan = new Date().toISOString();
            L.hasil = (L.hasil ? L.hasil + ' · ' : '') + 'diaktifkan kembali & diumumkan';
            simpanAntre();
            log(`Paket ${L.paketId} diaktifkan kembali dan diumumkan.`, 'o');
        } finally { await segarkanSetelahEksekusi(); }
    }
    async function jalankanLangkah(L) {
        const salahIsi = salahIsiLangkah(L);
        if (salahIsi.length) throw new Error('Isian belum lengkap, tidak dikirim ke SiRUP: ' + salahIsi.join('; '));
        if (!Sirup.konteksLengkap(S.ctx)) throw new Error('Kode BA/eselon/satker belum terbaca — baca ulang paket (langkah 3).');
        const kini = await daftarKini();
        const cek = (id, s) => {
            const p = kini.get(id);
            if (!p || !s || p.status !== s.status || Math.abs(+p.pagu - s.pagu) > 1)
                throw new Error(`Paket ${id} berubah sejak dibaca (sekarang ${p ? `status ${Analysis.ST[p.status] || p.status}, pagu ${fmt(p.pagu)}` : 'tidak ada di daftar'}; semula ${s ? `status ${Analysis.ST[s.status] || s.status}, pagu ${fmt(s.pagu)}` : '-'}). Baca ulang paket di langkah 3, lalu susun antrean baru.`);
        };
        if (L.jenis === 'batalFD') {
            cek(L.paketId, L.snap);
            await Sirup.batalFinalDraft(L.paketId, L.alasan);
            const p = (await daftarKini()).get(L.paketId);
            if (p && p.status === '2') throw new Error('Status final draft tidak berubah.');
            L.hasil = p ? `status ${Analysis.ST[p.status] || p.status}` : 'tidak lagi di daftar';
            return;
        }
        if (L.jenis === 'batal') {
            cek(L.paketId, L.snap);
            await Sirup.batalkanPaket(L.paketId, L.alasan);
            const p = (await daftarKini()).get(L.paketId);
            if (p && p.status === '3' && p.aktif !== 'false') throw new Error('Paket masih berstatus Terumumkan setelah pembatalan.');
            L.hasil = p ? `status ${Analysis.ST[p.status] || p.status}` : 'dibatalkan';
            return;
        }
        if (L.jenis === 'umumkan') {
            for (const id of L.ids) cek(id, L.snap[id]);
            await Sirup.umumkan(L.ids);
            const k2 = await daftarKini();
            const belum = L.ids.filter(i => (k2.get(i) || {}).status !== '3');
            if (belum.length) throw new Error('Belum terumumkan: ' + belum.join(', '));
            L.hasil = 'terumumkan';
            return;
        }
        if (L.jenis === 'ubah') {
            cek(L.paketId, L.snap);
            if (L.umumkanDulu) {
                await Sirup.umumkan([L.paketId]);
                const p = (await daftarKini()).get(L.paketId);
                if (!p || p.status !== '3') throw new Error('Final draft gagal diumumkan sebelum direvisi.');
                log(`  ${L.paketId} diumumkan dulu`, 'o');
            }
            const res = await Sirup.revisiSatuKeSatu(S.ctx, { id: L.paketId }, L.pk, L.alasan);
            await umumkanHasil(L, res, 1);
            return;
        }
        if (L.jenis === 'titip') {
            cek(L.paketId, L.snap);
            const res = await Sirup.revisiSatuKeBanyak(S.ctx, { id: L.paketId }, L.pks, L.alasan, { onStep: (i, n) => log(`  simpan draft ${i}/${n}`) });
            await umumkanHasil(L, res, L.pks.length);
        }
    }
    async function umumkanHasil(L, res, harap) {
        L.kodeBaru = res.baru.map(p => p.id);
        if (!res.donorHilang) log(`  PERHATIAN: paket asal ${L.paketId} masih ada di daftar`, 'w');
        if (res.baru.length !== harap) log(`  PERHATIAN: diharapkan ${harap} paket hasil, terbaca ${res.baru.length}`, 'w');
        const fd = res.baru.filter(p => p.status === '2').map(p => p.id);
        if (fd.length) await Sirup.umumkan(fd);
        const k2 = await daftarKini();
        const belum = L.kodeBaru.filter(i => (k2.get(i) || {}).status !== '3');
        L.hasil = `${L.kodeBaru.length} paket hasil: ${L.kodeBaru.join(', ') || '-'}${belum.length ? ` · belum terumumkan: ${belum.join(', ')}` : ' (terumumkan)'}`;
        if (!L.kodeBaru.length) throw new Error('SiRUP tidak menghasilkan paket baru. Cek daftar paket sebelum mengulang.');
        if (belum.length) throw new Error(`Revisi tersimpan, tetapi ${belum.join(', ')} belum terumumkan. Umumkan manual di SiRUP, lalu klik "Tandai selesai".`);
    }

    // ── 5. Struktur anggaran ───────────────────────────────────────────
    // RUP terumumkan per jenis belanja dibaca langsung dari SiRUP, bukan dari data paket langkah 3
    // (data itu bisa usang setelah eksekusi; struktur anggaran 653526 pernah tersimpan dari data sebelum revisi).
    async function bacaRupSegar(onProgress) {
        const list = await Sirup.daftarPaket(S.ctx.tahun, 'penyedia');
        const sw = await Sirup.daftarPaket(S.ctx.tahun, 'swakelola').catch(() => []);
        const U = list.filter(p => p.status === '3' && p.aktif !== 'false');
        const per = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0, lain: 0 };
        let total = 0, tanpaBaris = 0, i = 0;
        for (const p of U) {
            const j = await Sirup.denorm(p.id, S.ctx.tahun).catch(() => null);
            const rows = (j && j.paket_anggaran_json) || [];
            if (!rows.length) { tanpaBaris++; per.lain += +p.pagu || 0; total += +p.pagu || 0; }
            for (const r of rows) {
                const g = Classify.jenisBelanja(String(r.mak || '').split('.').pop());
                per[g in per ? g : 'lain'] += +r.pagu || 0;
                total += +r.pagu || 0;
            }
            if (onProgress) onProgress(++i, U.length);
        }
        const swU = sw.filter(p => p.status === '3' && p.aktif !== 'false');
        return { per, total, paket: U.length, tanpaBaris, swakelola: { n: swU.length, pagu: swU.reduce((s2, p) => s2 + (+p.pagu || 0), 0) },
            waktu: new Date(), sig: U.map(p => `${p.id}:${p.pagu}`).sort().join(',') };
    }
    function stepStruktur() {
        if (needDipa()) return;
        guard(async () => {
            ensureAnalysis();
            const info = h('div', {}, h('div', { class: 'muted' }, 'Membaca RUP terumumkan dan struktur anggaran terkini dari SiRUP…'));
            const pg = progress(); info.append(pg); body.append(info);
            S.rupSegar = await bacaRupSegar((x, n) => pg.set(x, n));
            S.sa = await Sirup.strukturAnggaran();
            info.remove();
            gambarStruktur();
        });
    }
    function gambarStruktur() {
        if (S.step !== 4) return;
        body.innerHTML = ''; if (actEl) actEl.innerHTML = '';
        const R = S.rupSegar, rup = R.per;
        const dipa = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
        for (const a of S.an.akun.values()) { const g = Classify.jenisBelanja(a.akun); if (g in dipa) dipa[g] += a.P; }
        const rows = [['barjas', 'Barang/Jasa (52)'], ['modal', 'Modal (53)'], ['sosial', 'Bantuan Sosial (57)'], ['hibah', 'Hibah (56)'], ['lainnya', 'Lainnya (54,55,58)']];
        const tot = o => rows.reduce((s2, [k]) => s2 + (o[k] || 0), 0);
        const pct = (a, b) => b ? (a / b * 100).toFixed(2).replace('.', ',') + '%' : '–';
        const sama = Math.abs(tot(rup) - tot(dipa)) <= 1000;
        const target = Object.fromEntries(rows.map(([k]) => [k, rup[k]]));
        const mode = h('select', {}, h('option', { value: 'rup' }, 'Samakan dengan RUP terumumkan (target IKU 100%)'), h('option', { value: 'dipa' }, 'Samakan dengan pagu pengadaan DIPA'), h('option', { value: 'manual' }, 'Isi manual'));
        const tb = h('tbody', {});
        const draw = () => {
            tb.innerHTML = '';
            for (const [k, l] of rows) {
                if (mode.value !== 'manual') target[k] = mode.value === 'rup' ? rup[k] : dipa[k];
                const inp = h('input', { type: 'number', value: Math.round(target[k]), style: { width: '170px' }, disabled: mode.value !== 'manual' });
                inp.addEventListener('input', () => { target[k] = +inp.value || 0; });
                tb.append(h('tr', {}, h('td', {}, l), h('td', { class: 'n' }, fmt(S.sa[k])), h('td', { class: 'n' }, fmt(rup[k])), h('td', { class: 'n' }, fmt(dipa[k])), h('td', { class: 'n' }, inp),
                    h('td', {}, rup[k] > dipa[k] + 1000 ? pill('RUP > pagu pengadaan DIPA', 'p-warn') : Math.abs(S.sa[k] - rup[k]) <= 1000 ? pill('sudah sama', 'p-ok') : pill(`beda ${fmt(S.sa[k] - rup[k])}`, 'p-bad'))));
            }
            tb.append(h('tr', {}, h('td', {}, h('b', {}, 'Total belanja pengadaan')), h('td', { class: 'n' }, h('b', {}, fmt(tot(S.sa)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(rup)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(dipa)))),
                h('td', { class: 'n' }, h('b', {}, fmt(tot(target)))), h('td', {}, h('b', {}, `IKU sekarang ${pct(R.total, tot(S.sa))} → setelah disimpan ${pct(R.total, tot(target))}`))));
        };
        mode.addEventListener('change', draw);
        draw();
        const jam = R.waktu.toLocaleTimeString('id-ID');
        const pesan = [];
        const antre = S.antre ? S.antre.langkah.filter(x => x.status === 'menunggu' || x.status === 'berjalan').length : 0;
        if (antre) pesan.push(h('div', { class: 'warnbox' }, `Masih ada ${antre} langkah antrean yang belum dijalankan. Samakan Struktur Anggaran setelah antrean selesai, supaya angkanya tidak berubah lagi.`));
        if (R.swakelola.n) pesan.push(h('div', { class: 'warnbox' }, `Ada ${R.swakelola.n} paket swakelola terumumkan (Rp${fmt(R.swakelola.pagu)}) yang belum ikut dihitung per jenis belanja. Bila penilaian juga menghitung swakelola, tambahkan nilainya lewat "Isi manual".`));
        if (R.per.lain) pesan.push(h('div', { class: 'warnbox' }, `Rp${fmt(R.per.lain)} RUP terumumkan berada di akun di luar belanja barang/modal/bansos/hibah/lainnya${R.tanpaBaris ? ` (${R.tanpaBaris} paket tanpa baris anggaran)` : ''}. Nilai ini tidak masuk struktur anggaran, jadi IKU tidak bisa tepat 100% sebelum paketnya dikoreksi.`));
        if (S.pakets && S.pakets.length) {
            const lama = S.pakets.filter(p => p.status === '3' && p.aktif !== 'false').map(p => `${p.id}:${p.pagu}`).sort().join(',');
            if (lama !== R.sig) pesan.push(h('div', { class: 'infobox' }, 'Data paket di langkah 3–4 sudah berbeda dari SiRUP saat ini (ada paket yang berubah). Angka di bawah memakai data terbaru; baca ulang paket bila ingin rencana di langkah 4 ikut diperbarui.'));
        }
        if (sama) pesan.push(h('div', { class: 'okbox' }, `RUP terumumkan sudah sama dengan pagu pengadaan DIPA (Rp${fmt(tot(dipa))}). Kedua pilihan rekomendasi memberi angka yang sama.`));
        body.append(h('div', { class: 'card' }, h('h3', {}, 'Struktur Anggaran (penyebut IKU RUP terumumkan)'),
            h('p', { class: 'note' }, `RUP terumumkan dibaca langsung dari SiRUP pukul ${jam} (${R.paket} paket penyedia, Rp${fmt(R.total)}). Struktur anggaran terakhir diperbarui di SiRUP: ${S.sa.diperbarui || '–'}.`),
            ...pesan,
            h('div', { class: 'row' }, h('span', {}, 'Rekomendasi:'), mode),
            h('div', { class: 'tbl', style: { marginTop: '8px' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...['Jenis belanja', 'Saat ini di SiRUP', `RUP terumumkan (${jam})`, 'Pagu pengadaan DIPA', 'Akan disimpan', ''].map((t, i) => h('th', { class: i && i < 5 ? 'n' : '' }, t)))), tb)),
            h('div', { class: 'warnbox' }, 'Struktur anggaran seharusnya mencerminkan pagu belanja pengadaan DIPA. Bila RUP terumumkan melebihi DIPA (mis. paket tahun jamak dicatat nilai kontrak penuh), menyamakan dengan RUP akan membuat struktur anggaran lebih besar dari DIPA — pastikan ini sesuai arahan pembina.'),
            h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go(4) }, '↻ Baca ulang dari SiRUP'),
                h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(async () => {
                    // RUP bisa berubah sejak tabel ditampilkan (mis. PPK mengumumkan paket) → baca lagi sebelum menyimpan
                    const cek = await bacaRupSegar();
                    if (cek.sig !== R.sig) { S.rupSegar = cek; log('RUP terumumkan berubah sejak tabel ditampilkan. Angka sudah diperbarui; periksa lalu simpan lagi.', 'w'); gambarStruktur(); return; }
                    const ok = await confirmBox('Perbarui Struktur Anggaran', `<table class="t">${rows.map(([k, l]) => `<tr><td>${l}</td><td class="n">${fmt(S.sa[k])} → <b>${fmt(target[k])}</b></td></tr>`).join('')}</table>
                        <p class="note">IKU setelah disimpan: ${pct(R.total, tot(target))} (RUP terumumkan Rp${fmt(R.total)} dibaca pukul ${cek.waktu.toLocaleTimeString('id-ID')}).</p>`, 'Simpan ke SiRUP');
                    if (!ok) return;
                    S.sa = await Sirup.simpanStrukturAnggaran(S.sa, target, S.ctx.tahun);
                    log(`Struktur anggaran disimpan. IKU = ${pct(R.total, tot(S.sa))}.`, 'o');
                    gambarStruktur();
                }) }, 'Simpan ke Struktur Anggaran'))));
    }

    // ── pengaturan & ekspor ─────────────────────────────────────────────
    async function settings() {
        const c = S.cfg;
        const num = (k, l, hint) => { const i = h('input', { type: 'number', value: c[k] }); i.addEventListener('input', () => { c[k] = +i.value; }); return h('div', { class: 'field' }, h('label', {}, l), i, hint ? h('div', { class: 'hint' }, hint) : null); };
        const pilih = (k, l, opts) => { const sl = h('select', {}, ...opts.map(([v, t]) => h('option', { value: v, selected: c[k] === v }, t))); sl.addEventListener('change', () => { c[k] = sl.value; }); return h('div', { class: 'field' }, h('label', {}, l), sl); };
        await modal('Pengaturan', h('div', {},
            h('div', { class: 'formgrid' },
                num('ambangSelisih', 'Ambang selisih yang diabaikan (Rp)', 'Kekurangan/kelebihan sekecil ini tidak dibuatkan revisi'),
                num('ambangKeputusan', 'Ambang kartu keputusan (Rp)', 'Kelebihan di atas ini wajib diputuskan manual'),
                pilih('grupPaketBaru', 'Pengelompokan paket baru', [['sub', 'Per sub-komponen + jenis pengadaan'], ['komp', 'Per komponen + jenis pengadaan'], ['akun', 'Per akun (MAK)']]),
                num('maxPaketPerRevisi', 'Maks. paket baru per revisi satu ke banyak'),
                num('plBarjas', 'Batas PL barang/jasa lainnya (Rp)'), num('plKonstruksi', 'Batas PL konstruksi (Rp)'), num('plKonsultansi', 'Batas PL konsultansi (Rp)'),
                pilih('metodeEO', 'Metode paket EO di atas batas PL', [['Tender', 'Tender'], ['Seleksi', 'Seleksi'], ['Tender Cepat', 'Tender Cepat'], ['E-Purchasing', 'E-Purchasing']]),
                num('jeda', 'Jeda antar-permintaan (ms)')),
            h('p', { class: 'note', style: { marginTop: '12px' } }, `Lokasi satker: ${S.lokasiSatker ? `${S.lokasiSatker.kab}, ${S.lokasiSatker.prov} — ${S.lokasiSatker.detil}` : 'belum diatur'} (atur di langkah 4 → Putuskan).`)), [['Simpan', true, 'pri']]);
        store.set('cfg', c);
        S.an = null;
        if (S.step >= 2) go(S.step);
    }

    async function exportExcel() {
        if (!S.an && S.dipa) ensureAnalysis();
        if (!S.an) return;
        if (typeof ExcelJS === 'undefined') { log('ExcelJS belum termuat.', 'e'); return; }
        const wb = new ExcelJS.Workbook();
        const add = (name, cols, rows) => {
            const ws = wb.addWorksheet(name);
            ws.columns = cols.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } };
            ws.views = [{ state: 'frozen', ySplit: 1 }];
            rows.forEach(r => ws.addRow(r));
            ws.autoFilter = { from: 'A1', to: { row: 1, column: cols.length } };
        };
        const N = '#,##0';
        const A = [...S.an.akun.values()].sort((x, y) => x.key.localeCompare(y.key));
        add('Sanding Akun', [['MAK', 'key', 34], ['Akun', 'nama', 40], ['Pagu DIPA', 'pagu', 16, N], ['Pengadaan', 'P', 16, N], ['Non-pengadaan', 'NP', 16, N], ['Perlu cek', 'CEK', 14, N], ['RUP terumumkan', 'rupU', 16, N], ['RUP final draft', 'rupFD', 16, N], ['Selisih', 'selisih', 16, N], ['Status', 'status', 16], ['Paket', 'paket', 60]],
            A.map(a => ({ ...a, paket: a.rup.map(r => `${r.paketId} (${Analysis.ST[r.status] || r.status}) ${fmt(r.pagu)}`).join('; ') })));
        add('Item DIPA', [['MAK', 'key', 34], ['Grup', 'grup', 30], ['Uraian', 'uraian', 60], ['Volume', 'volume', 12], ['Pagu', 'pagu', 16, N], ['Kelas', 'kelas', 8], ['Alasan', 'alasan', 40]],
            A.flatMap(a => a.items.map(i => ({ key: a.key, ...i }))));
        if (S.pakets) add('Paket RUP', [['Kode RUP', 'id', 11], ['Nama', 'nama', 60], ['Status', 'st', 12], ['Pagu', 'pagu', 16, N], ['Metode', 'metode', 18], ['MAK', 'mak', 60], ['Verdict', 'verdict', 20]],
            S.pakets.map(p => ({ id: p.id, nama: p.nama, st: Analysis.ST[p.status] || p.status, pagu: p.pagu, metode: p.metode, mak: (p.sumberDana || []).map(s => `${s.mak}=${fmt(s.pagu)}`).join('; '), verdict: p.verdict })));
        if (S.ren) {
            add('Keputusan', [['Kartu', 'judul', 50], ['Jenis', 'jenis', 14], ['Ringkasan', 'ringkas', 90], ['Pilihan', 'pilihan', 16], ['Status', 'st', 16]],
                S.ren.kartu.map(k => ({ judul: k.judul, jenis: k.jenis, ringkas: k.ringkas, pilihan: k.pilihan || '', st: !k.diputuskan ? 'belum' : k.otomatis ? 'otomatis' : 'diputuskan' })));
            add('Perubahan Paket', [['Kode RUP', 'id', 11], ['Nama', 'nama', 50], ['Tindakan', 'label', 34], ['Pagu sebelum', 'a', 16, N], ['Pagu sesudah', 'b', 16, N], ['MAK sesudah', 'mak', 60], ['Catatan', 'ket', 70], ['Dipilih', 'pilih', 8]],
                S.ren.perubahan.map(c => ({ id: c.paketId, nama: c.nama, label: c.label.join(', '), a: c.sebelum, b: c.jenis === 'batal' ? 0 : c.sesudah, mak: c.rowsSesudah.map(x => `${x.mak}=${fmt(x.pagu)}`).join('; '), ket: [...c.catatan, ...c.peringatan].join(' | '), pilih: dipilih(c) ? 'ya' : 'tidak' })));
            add('Paket Baru', [['Nama', 'nama', 60], ['Jenis', 'jenis', 18], ['Metode', 'metode', 18], ['Pagu', 'total', 16, N], ['MAK', 'mak', 60], ['Dititipkan ke', 'host', 12], ['Lokasi', 'lok', 30], ['Jadwal', 'jd', 24], ['Peringatan', 'pr', 60], ['Dipilih', 'pilih', 8]],
                S.ren.paketBaru.map(b => ({ nama: b.nama, jenis: b.jenis, metode: b.metode, total: b.total, mak: b.anggaran.map(x => `${x.mak}=${fmt(x.pagu)}`).join('; '), host: b.hostId || '-', lok: b.lokasiRaw.map(l => l.kab || l.id_kabupaten).join(', '), jd: `${b.jadwal.awalPengadaan} s.d. ${b.jadwal.kebutuhan}`, pr: b.peringatan.join(' | '), pilih: dipilih(b) ? 'ya' : 'tidak' })));
        }
        if (S.antre) add('Hasil Eksekusi', [['#', 'no', 5], ['Langkah', 'jenis', 26], ['Paket', 'paket', 50], ['Status', 'status', 12], ['Kode RUP baru', 'baru', 40], ['Hasil / pesan', 'hasil', 80]],
            S.antre.langkah.map((L, i) => ({ no: i + 1, jenis: JENIS_LANGKAH[L.jenis], paket: uraianLangkah(L), status: L.status, baru: (L.kodeBaru || []).join(', '), hasil: [L.hasil, L.pesan].filter(Boolean).join(' · ') })));
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `Sanding_DIPA_RUP_${S.ctx.kodeSatker}_${new Date().toISOString().slice(0, 10)}.xlsx` });
        document.body.append(a); a.click(); a.remove();
        log('Kertas kerja Excel diunduh.', 'o');
    }

    function mount() {
        if (document.querySelector('.sdr-fab')) return;
        document.querySelectorAll('style[data-sdr]').forEach(e => e.remove()); // CSS versi lama (upgrade tanpa muat ulang)
        const style = document.createElement('style'); style.dataset.sdr = APP_VERSION; style.textContent = CSS; document.head.append(style);
        document.body.append(h('button', { class: 'sdr-fab', onclick: open, title: APP }, '⇄ ', APP));
    }
    return { mount, open, S };
})();
