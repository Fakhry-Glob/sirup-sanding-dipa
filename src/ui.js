// ───────────────────────────────────────────────────────────────────── UI ──
const UI = (() => {
    const APP = 'Sanding DIPA ↔ RUP';
    const fmt = n => (n == null || isNaN(n)) ? '–' : Math.round(n).toLocaleString('id-ID');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nowYM = (d = 0) => { const t = new Date(); t.setMonth(t.getMonth() + d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
    const store = {
        get(k, def) { try { const v = localStorage.getItem('sdr:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
        set(k, v) { try { localStorage.setItem('sdr:' + k, JSON.stringify(v)); } catch (e) { /* storage penuh/diblokir */ } },
    };

    const S = {
        step: 0, ctx: null, dipa: null, dipaFile: '', overrides: {}, pkkr: null, ppk: [], pakets: null, swakelola: [],
        an: null, plan: null, sa: null, busy: false, stop: false,
        cfg: Object.assign({
            plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6, metodeEO: 'Tender', cekSebagai: 'CEK', minPaketBaru: 1000, maxPaketPerRevisi: 15,
            jadwalDefault: { awalPengadaan: nowYM(1), akhirPengadaan: nowYM(1), awalPekerjaan: nowYM(1), akhirPekerjaan: `${new Date().getFullYear()}-12`, awalKebutuhan: nowYM(1), kebutuhan: `${new Date().getFullYear()}-12` },
            jeda: 500,
        }, store.get('cfg', {})),
    };
    const STEPS = ['1. Data & Login', '2. Struktur PKKR', '3. Sanding RUP', '4. Rekap & Eksekusi', '5. Struktur Anggaran'];
    let root, body, foot, stepsEl, ctxEl;

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
    function log(msg, cls) {
        if (!foot) return;
        const t = new Date().toTimeString().slice(0, 8);
        foot.append(h('div', { class: cls || '' }, `[${t}] ${msg}`));
        foot.scrollTop = foot.scrollHeight;
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
        ctxEl = h('span', { class: 'sdr-ctx' }, 'memeriksa login…');
        stepsEl = h('div', { class: 'sdr-steps' });
        body = h('div', { class: 'sdr-body' });
        foot = h('div', { class: 'sdr-foot' });
        win.append(h('div', { class: 'sdr-hd' }, h('h2', {}, APP), ctxEl,
            h('button', { class: 'btn sm', onclick: exportExcel, title: 'Unduh kertas kerja Excel' }, '⬇ Excel'),
            h('button', { class: 'btn sm', onclick: settings }, '⚙'),
            h('button', { class: 'sdr-x', title: 'Tutup', onclick: () => { root.style.display = 'none'; } }, '×')), stepsEl, body, foot);
        root.append(win);
        document.body.append(root);
        Sirup.setLogger(log);
        renderSteps();
        go(0);
    }
    function renderSteps() {
        stepsEl.innerHTML = '';
        const done = [!!S.dipa && !!S.ctx && S.ctx.login, !!S.pkkr, !!S.an, false, false];
        STEPS.forEach((s, i) => stepsEl.append(h('button', { class: `sdr-step${i === S.step ? ' on' : ''}${done[i] ? ' done' : ''}`, onclick: () => go(i) }, s)));
    }
    function go(i) {
        S.step = i; renderSteps(); body.innerHTML = '';
        [stepData, stepPkkr, stepSanding, stepRekap, stepStruktur][i]();
    }
    async function guard(fn) {
        if (S.busy) return;
        S.busy = true; S.stop = false;
        try { await fn(); } catch (e) { log('GAGAL: ' + e.message, 'e'); console.error(e); await modal('Terjadi kesalahan', h('div', { class: 'errbox' }, e.message), [['Tutup', false, 'pri']]); }
        finally { S.busy = false; renderSteps(); }
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
                ctxEl.textContent = 'belum login';
                return;
            }
            ctxEl.textContent = `${S.ctx.username || ''} · ${S.ctx.role} · ${S.ctx.kodeSatker} · TA ${S.ctx.tahun}`;
            ctxCard.append(h('div', { class: 'kpis' },
                kpi(S.ctx.nama || '–', 'Nama pengguna'), kpi(S.ctx.role || '–', 'Role'), kpi(S.ctx.kodeSatker || '–', 'Kode satker'), kpi(String(S.ctx.tahun), 'Tahun anggaran')),
                h('div', {}, S.ctx.satkerNama),
                S.ctx.isKPA ? h('div', { class: 'okbox' }, 'Login sebagai KPA — fitur tambah PKKR, revisi, umumkan, dan struktur anggaran tersedia.')
                    : h('div', { class: 'warnbox' }, `Role "${S.ctx.role}" bukan KPA. Sanding tetap bisa dilihat, tetapi eksekusi (PKKR, revisi, umumkan) hanya bisa oleh akun KPA.`));
            const saved = store.get('ov:' + S.ctx.kodeSatker, null);
            if (saved) S.overrides = saved;
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
                // RKK ikut diunggah? pakai untuk melengkapi nama node & lokasi KRO yang tidak ada di FA
                const pendamping = cand.find(x => x !== f && /FA_Detail/i.test(x.name) !== /FA_Detail/i.test(f.name));
                if (pendamping) {
                    const r2 = await DipaParser.parse(pdfjsLib, new Uint8Array(await pendamping.arrayBuffer()));
                    let n = 0;
                    for (const [k, node] of res.nodes) {
                        const o = r2.nodes.get(k);
                        if (!o) continue;
                        if (!node.uraian && o.uraian) { node.uraian = o.uraian; n++; }
                        if (!node.lokasi && o.lokasi) node.lokasi = o.lokasi;
                        if ((!node.sd || !node.sd.length) && o.sd && o.sd.length) node.sd = o.sd;
                    }
                    log(`${pendamping.name} dipakai untuk melengkapi ${n} nama node dan lokasi KRO.`, 'o');
                }
                S.dipa = res; S.dipaFile = f.name; S.an = null; S.plan = null;
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
                    h('p', { class: 'note' }, 'Default: hanya cabang yang memuat belanja pengadaan yang dicentang (cabang gaji/non-pengadaan dilewati). Cabang ditambahkan sebagai PKKR Manual dari atas ke bawah.'),
                    h('div', { class: 'tbl' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Level'), h('th', {}, 'Kode'), h('th', {}, 'Uraian'), h('th', { class: 'n' }, 'Pagu DIPA'), h('th', { class: 'n' }, 'Pagu pengadaan'))), h('tbody', {}, rows))),
                    h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', {}, 'Delegasikan ke PPK:'), ppkSel,
                        h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(() => runPkkr(diff.baru.filter(n => n.pilih), ppkSel.value)) }, 'Tambahkan cabang terpilih ke PKKR')));
            }
            if (diff.beda.length) box.append(h('details', { style: { marginTop: '12px' } }, h('summary', {}, `Pagu berbeda (${diff.beda.length}) — node integrasi terkunci, hanya informasi`),
                h('div', { class: 'tbl' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Kode'), h('th', {}, 'Uraian'), h('th', { class: 'n' }, 'DIPA'), h('th', { class: 'n' }, 'SiRUP'), h('th', {}, 'Jenis'))),
                    h('tbody', {}, diff.beda.map(b => h('tr', {}, h('td', { class: 'mono' }, b.key), h('td', {}, b.nama), h('td', { class: 'n' }, fmt(b.paguDipa)), h('td', { class: 'n' }, fmt(b.paguSirup)), h('td', {}, b.manual ? 'Manual' : 'Integrasi'))))))));
            if (diff.hilang.length) box.append(h('details', {}, h('summary', {}, `Ada di PKKR SiRUP tetapi tidak ada di DIPA (${diff.hilang.length})`),
                h('div', { class: 'tbl' }, h('table', { class: 't' }, h('tbody', {}, diff.hilang.map(b => h('tr', {}, h('td', { class: 'mono' }, b.key), h('td', {}, b.nama), h('td', { class: 'n' }, fmt(b.pagu)))))))));
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
    async function runPkkr(nodes, idPpk) {
        if (!nodes.length) return;
        const ok = await confirmBox('Tambah cabang PKKR', `<p>${nodes.length} node akan ditambahkan sebagai PKKR <b>Manual</b>:</p><div class="tbl"><table class="t">${nodes.map(n => `<tr><td class="mono">${esc(n.key)}</td><td>${esc(n.nama)}</td><td class="n">${fmt(n.pagu)}</td></tr>`).join('')}</table></div><p class="note">Tindakan ini mengubah data SiRUP. Tidak ada tombol hapus otomatis — hapus manual lewat Kelola PKKR bila salah.</p>`);
        if (!ok) return;
        for (const n of nodes) {
            if (S.stop) break;
            const parent = n.parentKey ? S.pkkr.get(n.parentKey) : null;
            if (n.parentKey && !parent) { log(`Lewati ${n.key}: induk ${n.parentKey} belum ada.`, 'e'); continue; }
            if (!n.nama) { log(`Lewati ${n.key}: nama kosong.`, 'e'); continue; }
            const rs = await Sirup.tambahPkkr(S.ctx, n, parent && parent.id, idPpk);
            const id = await Sirup.cariNodeBaru(S.ctx, n.level, parent && parent.id, n.kode);
            if (!id) {
                const hal = { prog: 'index', keg: `indexKegiatan?idProgram=${parent && parent.id}`, kro: `indexOutput?idKegiatan=${parent && parent.id}`, ro: `indexSubOutput?idOutput=${parent && parent.id}`, komp: `indexKomponen?idSubOutput=${parent && parent.id}`, sub: `indexSubKomponen?idKomponen=${parent && parent.id}` }[n.level];
                const flash = await Sirup.bacaFlash(`/sirup/programctr/${hal}`);
                const isiHal = rs && !rs.redirected ? ' ' + (await rs.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200) : '';
                throw new Error(`SiRUP tidak menyimpan ${n.key}${parent && !parent.manual ? ' (induknya node Integrasi — SiRUP mungkin menolak cabang Manual di bawah node Integrasi)' : ''}. ${flash ? 'Pesan SiRUP: ' + flash : 'Tidak ada pesan dari SiRUP.'}${isiHal}`);
            }
            S.pkkr.set(n.key, { id, level: n.level, kode: n.kode, nama: n.nama, pagu: n.pagu, key: n.key, manual: true, parentId: parent && parent.id });
            log(`PKKR + ${n.key} (id ${id})`, 'o');
            await Sirup.sleep(S.cfg.jeda);
        }
        S.an = null;
        go(1);
    }

    // ── 3. Sanding ─────────────────────────────────────────────────────
    function ensureAnalysis() {
        if (S.an) return;
        const { nodes, akun } = Analysis.buildDipa(S.dipa, S.overrides, { cekSebagai: S.cfg.cekSebagai });
        S.an = { nodes, akun, orphans: [] };
        if (S.pakets) {
            const r = Analysis.sanding(akun, S.pakets);
            S.an.orphans = r.orphans;
            S.plan = Analysis.plan({ akunMap: akun, pakets: S.pakets, dipaNodes: nodes, pkkr: S.pkkr || new Map(), cfg: S.cfg });
            decoratePlan();
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
        const sd = list.find(p => p.sumberDana.length);
        if (sd) Object.assign(S.ctx, { kodeBA: sd.sumberDana[0].kodeInstansi || '032', kodeEselon: sd.sumberDana[0].kodeEselon || '', kodeKldi: sd.sumberDana[0].asal || 'K8' });
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
                    const tr = h('tr', { style: { cursor: 'pointer' } }, h('td', { class: 'mono' }, a.key), h('td', {}, a.nama), h('td', { class: 'n' }, fmt(a.pagu)),
                        h('td', { class: 'n' }, fmt(a.P)), h('td', { class: 'n' }, fmt(a.NP)), h('td', { class: 'n' }, a.CEK ? fmt(a.CEK) : ''),
                        h('td', { class: 'n' }, fmt(a.rupU)), h('td', { class: 'n' }, a.rupFD ? fmt(a.rupFD) : ''), h('td', { class: 'n' }, fmt(a.selisih)), h('td', {}, pill(st, cls)));
                    const sub = h('tr', { class: 'sub', style: { display: 'none' } }, h('td', { colspan: 10 }, detailAkun(a)));
                    tr.addEventListener('click', () => { sub.style.display = sub.style.display === 'none' ? '' : 'none'; });
                    tb.append(tr, sub);
                }
            };
            flt.addEventListener('change', draw); q.addEventListener('input', draw);
            box.append(h('h3', {}, 'Sanding per akun (MAK 7 segmen)'),
                h('p', { class: 'note' }, 'Klik baris untuk melihat item DIPA dan paket RUP-nya. Klasifikasi item bisa diubah; rencana aksi dihitung ulang otomatis.'),
                h('div', { class: 'row' }, flt, q), h('div', { class: 'tbl', style: { marginTop: '6px' } }, h('table', { class: 't' },
                    h('thead', {}, h('tr', {}, ...['MAK', 'Akun', 'Pagu', 'Pengadaan', 'Non', 'Cek', 'RUP umum', 'RUP FD', 'Selisih', 'Status'].map((t, i) => h('th', { class: i >= 2 && i <= 8 ? 'n' : '' }, t)))), tb)));
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
    // Lengkapi rencana: id komponen PKKR, lokasi default, data donor
    function decoratePlan() {
        const donorLok = (() => {
            const c = {};
            for (const p of S.pakets || []) for (const l of p.lokasiRaw || []) { const k = `${l.id_provinsi}|${l.id_kabupaten}|${l.detil}`; c[k] = (c[k] || 0) + 1; }
            const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
            if (!top) return [];
            const [pv, kb, dt] = top[0].split('|');
            return [{ id_provinsi: +pv, id_kabupaten: +kb, detil: dt }];
        })();
        for (const act of S.plan.actions) {
            if (act.type !== 'REVISI' && act.type !== 'TANPA_DONOR') continue;
            const donor = act.donorId ? S.pakets.find(p => p.id === act.donorId) : null;
            act.donor = donor;
            act.pakets.forEach((pk, i) => {
                pk.uid = pk.uid || `${act.donorId || 'x'}-${i}-${Math.random().toString(36).slice(2, 7)}`;
                if (!pk.baru && donor) {
                    pk.lokasiRaw = donor.lokasiRaw.map(l => ({ ...l }));
                    pk.jenisList = donor.jenisRaw.length === 1 ? null : donor.jenisRaw.map(j => ({ ...j }));
                    pk.jenis = Object.keys(Sirup.JENIS_ID).find(k => Sirup.JENIS_ID[k] === (donor.jenisRaw[0] || {}).jenisid) || pk.jenis;
                    pk.spp = donor.spp; pk.volume = donor.volume;
                    pk.uraian = donor.uraianRaw || pk.uraian; pk.spesifikasi = donor.spesifikasiRaw || pk.spesifikasi;
                    pk.jenisList = donor.jenisRaw.map(j => ({ ...j }));
                    pk.jadwal = { awalPengadaan: donor.tanggal.awalPengadaan, akhirPengadaan: donor.tanggal.akhirPengadaan, awalPekerjaan: donor.tanggal.awalPekerjaan, akhirPekerjaan: donor.tanggal.akhirPekerjaan,
                        awalKebutuhan: Analysis.ym(donor.pemanfaatan && donor.pemanfaatan.mulai) || donor.tanggal.awalPekerjaan, kebutuhan: Analysis.ym(donor.pemanfaatan && donor.pemanfaatan.akhir) || donor.tanggal.akhirPekerjaan };
                    const used = new Set();
                    for (const a of pk.anggaran) {
                        const old = donor.sumberDana.find(s => s.mak === a.mak && !used.has(s.id));
                        if (old && !a.dari) { a.idLama = old.id; used.add(old.id); a.sumber = old.sumber; a.danaApbn = a.danaApbn || old.danaApbn; }
                        else a.idLama = '';
                    }
                } else {
                    pk.lokasiRaw = pk.lokasiRaw || donorLok.map(l => ({ ...l }));
                    pk.jadwal = Object.assign({}, S.cfg.jadwalDefault, pk.jadwal || {});
                    pk.spp = pk.spp || { ekonomi: true, sosial: true, lingkungan: false };
                }
            });
        }
    }
    function komponenId(mak) {
        const k = mak.split('.').slice(0, 5).join('.');
        const n = S.pkkr && S.pkkr.get(k);
        return n ? n.id : null;
    }

    function stepRekap() {
        if (needDipa()) return;
        if (!S.pakets) { body.append(h('div', { class: 'warnbox' }, 'Jalankan langkah 3 (sanding RUP) dulu.')); return; }
        ensureAnalysis();
        const acts = S.plan.actions;
        const T = t => acts.filter(a => a.type === t);
        const revisi = T('REVISI');
        const nBaru = revisi.reduce((s, a) => s + a.pakets.filter(p => p.baru).length, 0);
        body.append(h('div', { class: 'kpis' },
            kpi(String(T('PKKR_ADD').reduce((s, a) => s + a.nodes.length, 0)), 'Cabang PKKR baru'), kpi(String((T('UMUMKAN')[0] || { ids: [] }).ids.length), 'Final draft siap diumumkan'),
            kpi(String(T('BATAL').length), 'Paket perlu dibatalkan'), kpi(String(revisi.filter(a => !a.pakets.some(p => p.baru)).length), 'Paket perlu direvisi'),
            kpi(String(nBaru), 'Paket baru (via revisi 1→N)'), kpi(String(T('BATAL_FD').length), 'Final draft bermasalah')));
        const danaRup = new Set((S.pakets || []).flatMap(p => (p.sumberDana || []).map(x => x.danaApbn)));
        if (S.dipa.meta.jenis === 'FA' && [...danaRup].some(d => d && d !== 'A')) body.append(h('div', { class: 'warnbox' }, `Satker ini memakai sumber dana selain RM (${[...danaRup].join(', ')}). FA Detail tidak memuat sumber dana per akun — unggah juga RKK agar paket baru mendapat sumber dana yang benar (default: RM).`));
        if (T('PKKR_ADD').length) body.append(h('div', { class: 'warnbox' }, 'Masih ada cabang DIPA yang belum ada di PKKR. Paket yang MAK-nya ke cabang itu baru bisa disimpan setelah cabangnya ditambah di langkah 2.'));

        // bulk editor
        const bulk = bulkBar();
        body.append(bulk);

        // A. umumkan FD
        for (const a of T('UMUMKAN')) {
            const list = a.ids.map(id => S.pakets.find(p => p.id === id));
            a.pilihIds = a.pilihIds || new Set(a.ids);
            body.append(section(`Umumkan final draft (${a.ids.length})`, 'Final draft yang MAK-nya sudah sesuai DIPA.',
                h('table', { class: 't' }, h('tbody', {}, list.map(p => h('tr', {}, h('td', {}, chk(a.pilihIds.has(p.id), v => v ? a.pilihIds.add(p.id) : a.pilihIds.delete(p.id))), h('td', { class: 'mono' }, p.id), h('td', {}, p.nama), h('td', { class: 'n' }, fmt(p.pagu))))))));
        }
        // B. batalkan
        if (T('BATAL').length) body.append(section(`Batalkan paket terumumkan (${T('BATAL').length})`, 'Seluruh MAK paket ini adalah belanja non-pengadaan (atau tidak lagi ada di DIPA).',
            h('table', { class: 't' }, h('tbody', {}, T('BATAL').map(a => {
                const al = h('input', { type: 'text', value: a.alasan, style: { width: '100%' } }); al.addEventListener('input', () => { a.alasan = al.value; });
                return h('tr', {}, h('td', {}, chk(a.pilih, v => { a.pilih = v; })), h('td', { class: 'mono' }, a.paketId), h('td', {}, a.nama), h('td', { class: 'n' }, fmt(a.pagu)), h('td', { style: { minWidth: '280px' } }, al));
            })))));
        // C. FD bermasalah
        if (T('BATAL_FD').length) body.append(section(`Final draft bermasalah (${T('BATAL_FD').length})`, 'Tidak diumumkan. Centang untuk mengembalikan ke PPK (batal final draft) agar diperbaiki.',
            h('table', { class: 't' }, h('tbody', {}, T('BATAL_FD').map(a => h('tr', {}, h('td', {}, chk(a.pilih, v => { a.pilih = v; })), h('td', { class: 'mono' }, a.paketId), h('td', {}, a.nama), h('td', { class: 'n' }, fmt(a.pagu)), h('td', { class: 'muted' }, a.alasan)))))));
        // D. revisi
        if (revisi.length) {
            const wrap = h('div', {});
            for (const a of revisi) wrap.append(revisiCard(a));
            body.append(section(`Revisi paket (${revisi.length} revisi, ${revisi.reduce((s, a) => s + a.pakets.length, 0)} paket hasil)`,
                'Koreksi satu paket memakai revisi Satu ke Satu; penambahan paket memakai Satu ke Banyak (paket #1 = paket existing). Keduanya menghasilkan paket berkode baru berstatus Final Draft, yang langsung diumumkan tool setelah revisi tersimpan. Paket dengan catatan "melebihi pagu DIPA" tidak dicentang — putuskan dulu nilainya.', wrap));
        }
        if (T('TANPA_DONOR').length) body.append(h('div', { class: 'errbox' }, `${T('TANPA_DONOR')[0].pakets.length} paket baru tidak punya paket donor (tidak ada paket terumumkan yang bersih). Minta PPK membuat satu paket, umumkan, lalu jalankan ulang.`));

        body.append(h('div', { class: 'row', style: { position: 'sticky', bottom: '-16px', background: '#fff', padding: '10px 0', borderTop: '1px solid #e2e8f0' } },
            h('button', { class: 'btn', onclick: previewPayload }, 'Pratinjau payload revisi'),
            h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(runRekap) }, '▶ Jalankan aksi terpilih'),
            h('button', { class: 'btn danger', onclick: () => { S.stop = true; log('Permintaan berhenti diterima; proses berhenti setelah langkah berjalan selesai.', 'w'); } }, '■ Hentikan')));
    }
    function chk(v, fn) { const c = h('input', { type: 'checkbox', checked: v }); c.addEventListener('change', () => fn(c.checked)); return c; }
    function section(title, note, content) { return h('div', { class: 'card' }, h('h3', {}, title), h('p', { class: 'note' }, note), content); }

    function revisiCard(a) {
        const donor = a.donor;
        const box = h('div', { class: 'pk', style: { borderColor: a.pilih ? '#94a3b8' : '#fcd34d' } });
        box.append(h('div', { class: 'pk-hd' }, chk(a.pilih, v => { a.pilih = v; box.style.borderColor = v ? '#94a3b8' : '#fcd34d'; }),
            pill(a.metodeRevisi === 'satukesatu' ? 'Revisi 1→1' : 'Revisi 1→N', a.metodeRevisi === 'satukesatu' ? 'p-info' : 'p-ok'),
            h('b', {}, `${a.metodeRevisi === 'satukesatu' ? 'Paket' : 'Donor'} ${a.donorId}`), h('span', {}, donor ? donor.nama : ''), pill(donor ? Analysis.ST[donor.status] : '', 'p-mut'), h('span', { class: 'muted' }, a.alasan),
            h('span', { style: { marginLeft: 'auto' } }, `${a.pakets.length} paket hasil · Rp${fmt(a.pakets.reduce((s, p) => s + p.anggaran.reduce((t, x) => t + x.pagu, 0), 0))}`)));
        if (a.catatan && a.catatan.length) box.append(h('div', { class: 'warnbox', style: { margin: '6px 10px' } }, ...a.catatan.map(c => h('div', {}, '• ' + c))));
        a.pakets.forEach((pk, i) => box.append(paketEditor(a, pk, i)));
        return box;
    }

    const JENIS = Object.keys(Sirup.JENIS_ID);
    const METODE = [...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
    function paketEditor(act, pk, idx) {
        const el = h('div', { style: { borderTop: '1px dashed #e2e8f0' } });
        const sel = h('input', { type: 'checkbox', class: 'sdr-bulk-sel' }); sel._pk = pk;
        const title = h('input', { type: 'text', value: pk.nama, style: { flex: 1, minWidth: '300px' } }); title.addEventListener('input', () => { pk.nama = title.value; });
        const total = h('b', {});
        const refreshTotal = () => { total.textContent = 'Rp' + fmt(pk.anggaran.reduce((s, x) => s + (+x.pagu || 0), 0)); };
        const hd = h('div', { class: 'pk-hd', style: { background: pk.baru ? '#f0fdfa' : '#f8fafc', borderRadius: 0 } }, sel,
            pill(act.metodeRevisi === 'satukesatu' ? 'Isi paket setelah revisi' : idx === 0 ? (pk.baru ? 'Paket #1' : 'Paket #1 (menggantikan donor)') : `Paket baru #${idx + 1}`, pk.baru ? 'p-ok' : 'p-info'), title, total);
        const ringkas = h('span', { class: 'muted', style: { fontSize: '12px' } });
        const upd = () => { ringkas.textContent = `${pk.jenis} · ${pk.metode} · pemilihan ${pk.jadwal.awalPengadaan || '?'} · ${pk.lokasiRaw.length} lokasi · ${pk.anggaran.length} MAK`; };
        upd();
        const tog = h('button', { class: 'btn sm' }, '▸ isian');
        if (pk.pertahankan) {
            title.disabled = true;
            hd.append(h('span', { class: 'muted', style: { fontSize: '12px' } }, 'paket existing — dikirim apa adanya dari form SiRUP, tidak diubah'));
            el.append(hd);
            return el;
        }
        hd.append(ringkas, tog);
        if (idx > 0) hd.append(h('button', { class: 'btn sm', title: 'Buang paket ini dari revisi', onclick: () => { act.pakets.splice(idx, 1); go(3); } }, '✕'));
        const bd = h('div', { class: 'pk-bd', style: { display: 'none' } });
        let built = false;
        tog.addEventListener('click', () => {
            if (!built) { buildBody(); built = true; }
            const show = bd.style.display === 'none';
            bd.style.display = show ? '' : 'none'; tog.textContent = show ? '▾ isian' : '▸ isian'; upd();
        });
        el.append(hd, bd);
        if (validatePaket(pk).length) { tog.style.borderColor = '#b91c1c'; tog.title = validatePaket(pk).join(', '); }
        return el;
        function buildBody() {
        // MAK
        const makBox = h('div', { class: 'wide' });
        const drawMak = () => {
            makBox.innerHTML = ''; makBox.append(h('label', {}, 'Sumber dana / MAK (Komponen PKKR + SubKomponen.Akun) dan pagu'));
            pk.anggaran.forEach((a, j) => {
                const opts = [...new Set([a.mak, ...(a.kandidat || []).map(k => k.key)])];
                const ms = h('select', { class: 'mono' }, ...opts.map(o => h('option', { value: o, selected: o === a.mak }, o)));
                const extra = h('input', { type: 'text', class: 'mono', placeholder: 'atau ketik MAK 7 segmen', style: { width: '220px' } });
                const pg = h('input', { type: 'number', value: Math.round(a.pagu), style: { width: '150px' } });
                const dana = h('select', { title: 'Sumber dana' }, ...[['A', 'RM'], ['D', 'PNBP'], ['F', 'BLU'], ['T', 'SBSN'], ['B', 'PLN']].map(([v, t]) => h('option', { value: v, selected: (a.danaApbn || 'A') === v }, t)));
                dana.addEventListener('change', () => { a.danaApbn = dana.value; });
                const kid = komponenId(a.mak);
                const warn = h('span', {}, kid ? pill('komponen ' + kid, 'p-mut') : pill('komponen belum ada di PKKR', 'p-bad'));
                const akun = S.an.akun.get(a.mak);
                const info = h('span', { class: 'muted' }, akun ? `DIPA pengadaan Rp${fmt(akun.P)} · RUP Rp${fmt(akun.rupU)}` : 'MAK tidak ada di DIPA');
                ms.addEventListener('change', () => { a.mak = ms.value; drawMak(); });
                extra.addEventListener('change', () => { if (/^[A-Z]{2}\.\d{4}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\.\d{3}\.[A-Z0-9]{1,2}\.\d{6}$/.test(extra.value.trim())) { a.mak = extra.value.trim(); drawMak(); } else extra.style.borderColor = 'red'; });
                pg.addEventListener('input', () => { a.pagu = +pg.value || 0; refreshTotal(); });
                makBox.append(h('div', { class: 'row', style: { marginBottom: '4px' } }, ms, extra, dana, pg, warn, info, a.lebih ? pill('melebihi DIPA Rp' + fmt(a.lebih), 'p-bad') : null,
                    pk.anggaran.length > 1 ? h('button', { class: 'btn sm', onclick: () => { pk.anggaran.splice(j, 1); drawMak(); refreshTotal(); } }, '✕') : null));
            });
            makBox.append(h('button', { class: 'btn sm', onclick: () => { pk.anggaran.push({ mak: pk.anggaran[0].mak, pagu: 0 }); drawMak(); } }, '+ baris MAK'));
            refreshTotal();
        };
        drawMak();
        bd.append(makBox);
        // jenis / metode / flags
        const js = h('select', {}, ...JENIS.map(j => h('option', { selected: j === pk.jenis }, j))); js.addEventListener('change', () => { pk.jenis = js.value; pk.jenisList = null; });
        const mt = h('select', {}, ...METODE.map(m => h('option', { selected: m === pk.metode }, m))); mt.addEventListener('change', () => { pk.metode = mt.value; });
        bd.append(h('div', {}, h('label', {}, 'Jenis pengadaan'), js), h('div', {}, h('label', {}, 'Metode pemilihan'), mt),
            h('div', {}, h('label', {}, 'Penanda'), h('div', { class: 'row' },
                h('label', { style: { display: 'inline' } }, chk(pk.praDipa, v => { pk.praDipa = v; }), ' Pra-DIPA'),
                h('label', { style: { display: 'inline' } }, chk(pk.pdn, v => { pk.pdn = v; }), ' PDN'),
                h('label', { style: { display: 'inline' } }, chk(pk.umkm, v => { pk.umkm = v; }), ' Usaha kecil'),
                h('label', { style: { display: 'inline' } }, chk(pk.spp.ekonomi, v => { pk.spp.ekonomi = v; }), ' SPP-eko'),
                h('label', { style: { display: 'inline' } }, chk(pk.spp.sosial, v => { pk.spp.sosial = v; }), ' SPP-sos'),
                h('label', { style: { display: 'inline' } }, chk(pk.spp.lingkungan, v => { pk.spp.lingkungan = v; }), ' SPP-ling'))));
        // jadwal
        const mon = (k) => { const i = h('input', { type: 'month', value: pk.jadwal[k] || '' }); i.addEventListener('change', () => { pk.jadwal[k] = i.value; }); return i; };
        bd.append(h('div', {}, h('label', {}, 'Pemilihan penyedia (awal – akhir)'), h('div', { class: 'row' }, mon('awalPengadaan'), '–', mon('akhirPengadaan'))),
            h('div', {}, h('label', {}, 'Pelaksanaan kontrak (awal – akhir)'), h('div', { class: 'row' }, mon('awalPekerjaan'), '–', mon('akhirPekerjaan'))),
            h('div', {}, h('label', {}, 'Pemanfaatan barang/jasa (awal – akhir)'), h('div', { class: 'row' }, mon('awalKebutuhan'), '–', mon('kebutuhan'))));
        // lokasi
        bd.append(lokasiEditor(pk));
        // uraian/spesifikasi
        const ur = h('textarea', {}, pk.uraian || ''); ur.addEventListener('input', () => { pk.uraian = ur.value; });
        const sp = h('textarea', {}, pk.spesifikasi || ''); sp.addEventListener('input', () => { pk.spesifikasi = sp.value; });
        const vol = h('input', { type: 'text', value: pk.volume || '1 Paket' }); vol.addEventListener('input', () => { pk.volume = vol.value; });
        bd.append(h('div', {}, h('label', {}, 'Volume'), vol), h('div', { class: 'wide grid2' }, h('div', {}, h('label', {}, 'Uraian pekerjaan (dari item DIPA)'), ur), h('div', {}, h('label', {}, 'Spesifikasi pekerjaan'), sp)));
        }
    }
    function lokasiEditor(pk) {
        const box = h('div', { class: 'wide' });
        const draw = () => {
            box.innerHTML = ''; box.append(h('label', {}, 'Lokasi pekerjaan (boleh lebih dari satu)'));
            pk.lokasiRaw.forEach((l, j) => {
                const pv = h('select', {}, h('option', { value: '' }, '— provinsi —'), ...Sirup.PROVINSI.map((n, i) => n ? h('option', { value: i, selected: +l.id_provinsi === i }, n) : null));
                const kb = h('select', {}, h('option', { value: '' }, '— kab/kota —'));
                const fillKab = async () => {
                    kb.innerHTML = ''; kb.append(h('option', { value: '' }, '— kab/kota —'));
                    if (!pv.value) return;
                    for (const k of await Sirup.kabupaten(+pv.value)) kb.append(h('option', { value: k.id, selected: +l.id_kabupaten === k.id }, k.nama));
                };
                pv.addEventListener('change', () => { l.id_provinsi = +pv.value; l.id_kabupaten = ''; fillKab(); });
                kb.addEventListener('change', () => { l.id_kabupaten = +kb.value; });
                const dt = h('input', { type: 'text', value: l.detil || '', placeholder: 'detail lokasi' }); dt.addEventListener('input', () => { l.detil = dt.value; });
                fillKab();
                box.append(h('div', { class: 'lok' }, pv, kb, dt, h('button', { class: 'btn sm', onclick: () => { pk.lokasiRaw.splice(j, 1); draw(); } }, '✕')));
            });
            box.append(h('button', { class: 'btn sm', onclick: () => { pk.lokasiRaw.push({ id_provinsi: '', id_kabupaten: '', detil: '' }); draw(); } }, '+ lokasi'));
        };
        draw();
        return box;
    }
    function bulkBar() {
        const f = {};
        const js = h('select', {}, h('option', { value: '' }, '(jenis)'), ...JENIS.map(j => h('option', {}, j)));
        const mt = h('select', {}, h('option', { value: '' }, '(metode)'), ...METODE.map(j => h('option', {}, j)));
        const pd = h('select', {}, h('option', { value: '' }, '(pra-DIPA)'), h('option', { value: '1' }, 'Pra-DIPA: ya'), h('option', { value: '0' }, 'Pra-DIPA: tidak'));
        const months = ['awalPengadaan', 'akhirPengadaan', 'awalPekerjaan', 'akhirPekerjaan', 'awalKebutuhan', 'kebutuhan'].map(k => { const i = h('input', { type: 'month', title: k }); f[k] = i; return i; });
        const copyLok = h('button', { class: 'btn sm', title: 'Salin lokasi paket terpilih pertama ke paket terpilih lain' }, 'Samakan lokasi');
        const apply = h('button', { class: 'btn sm pri' }, 'Terapkan ke paket terpilih');
        const all = h('button', { class: 'btn sm' }, 'Pilih semua paket baru');
        const selected = () => [...document.querySelectorAll('.sdr-bulk-sel')].filter(c => c.checked).map(c => c._pk);
        all.addEventListener('click', () => document.querySelectorAll('.sdr-bulk-sel').forEach(c => { if (c._pk.baru) c.checked = true; }));
        apply.addEventListener('click', () => {
            const ps = selected(); if (!ps.length) return;
            for (const pk of ps) {
                if (js.value) { pk.jenis = js.value; pk.jenisList = null; }
                if (mt.value) pk.metode = mt.value;
                if (pd.value) pk.praDipa = pd.value === '1';
                for (const [k, i] of Object.entries(f)) if (i.value) pk.jadwal[k] = i.value;
            }
            log(`Isian massal diterapkan ke ${ps.length} paket.`); go(3);
        });
        copyLok.addEventListener('click', () => {
            const ps = selected(); if (ps.length < 2) return;
            for (const pk of ps.slice(1)) pk.lokasiRaw = ps[0].lokasiRaw.map(l => ({ ...l, id: '' }));
            log(`Lokasi disalin ke ${ps.length - 1} paket.`); go(3);
        });
        return h('div', { class: 'bulk' }, h('div', { class: 'row' }, h('b', {}, 'Isian massal:'), js, mt, pd,
            h('span', { class: 'muted' }, 'pemilihan'), months[0], months[1], h('span', { class: 'muted' }, 'kontrak'), months[2], months[3], h('span', { class: 'muted' }, 'pemanfaatan'), months[4], months[5],
            apply, copyLok, all));
    }

    function validatePaket(pk) {
        const err = [];
        if (pk.pertahankan) { for (const a of pk.anggaran) a.idKomponen = a.idKomponen || komponenId(a.mak); return err; }
        if (!pk.nama || pk.nama.length < 5) err.push('nama paket terlalu pendek');
        const tot = pk.anggaran.reduce((s, a) => s + (+a.pagu || 0), 0);
        if (tot <= 0) err.push('pagu 0');
        for (const a of pk.anggaran) { a.idKomponen = komponenId(a.mak); if (!a.idKomponen) err.push(`komponen ${a.mak.split('.').slice(0, 5).join('.')} belum ada di PKKR`); }
        if (!pk.lokasiRaw.length || pk.lokasiRaw.some(l => !l.id_provinsi || !l.id_kabupaten)) err.push('lokasi belum lengkap');
        const j = pk.jadwal;
        for (const k of ['awalPengadaan', 'akhirPengadaan', 'awalPekerjaan', 'akhirPekerjaan', 'awalKebutuhan', 'kebutuhan']) if (!/^\d{4}-\d{2}$/.test(j[k] || '')) err.push('jadwal ' + k + ' kosong');
        if (j.akhirPengadaan < j.awalPengadaan || j.akhirPekerjaan < j.awalPekerjaan || j.kebutuhan < j.awalKebutuhan) err.push('jadwal akhir sebelum awal');
        if (pk.jenisList && Math.abs(pk.jenisList.reduce((s, x) => s + x.pagu, 0) - tot) > 1) pk.jenisList = null; // pagu berubah → satu jenis
        if (!pk.metode) err.push('metode kosong');
        return err;
    }
    async function previewPayload() {
        const a = S.plan.actions.find(x => x.type === 'REVISI' && x.pilih);
        if (!a) return;
        a.pakets.forEach(p => validatePaket(p));
        const pay = a.metodeRevisi === 'satukesatu' ? await Sirup.revisiSatuKeSatu(S.ctx, a.donor, a.pakets[0], a.alasan, { dryRun: true })
            : await Sirup.revisiSatuKeBanyak(S.ctx, a.donor, a.pakets, a.alasan, { dryRun: true });
        await modal(`Payload revisi donor ${a.donorId} (tidak dikirim)`, h('div', {}, ...pay.payloads.map((f, i) => h('details', { open: i === 0 }, h('summary', {}, `POST #${i + 1}`), h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap' } }, [...f.entries()].map(([k, v]) => `${k} = ${v}`).join('\n'))))), [['Tutup', false, 'pri']]);
    }

    async function runRekap() {
        const acts = S.plan.actions;
        const umum = acts.find(a => a.type === 'UMUMKAN');
        const umumIds = umum ? [...(umum.pilihIds || [])] : [];
        const batal = acts.filter(a => a.type === 'BATAL' && a.pilih);
        const batalFd = acts.filter(a => a.type === 'BATAL_FD' && a.pilih);
        const revisi = acts.filter(a => a.type === 'REVISI' && a.pilih);
        const problems = [];
        for (const a of revisi) a.pakets.forEach((p, i) => { const e = validatePaket(p); if (e.length) problems.push(`Donor ${a.donorId} paket #${i + 1}: ${e.join(', ')}`); });
        if (problems.length) { await modal('Isian belum lengkap', h('div', { class: 'errbox' }, ...problems.slice(0, 40).map(p => h('div', {}, p))), [['Perbaiki', false, 'pri']]); return; }
        const nPaket = revisi.reduce((s, a) => s + a.pakets.length, 0);
        const ok = await confirmBox('Jalankan aksi di SiRUP', `<ul>
            <li>Batalkan ${batal.length} paket terumumkan (non-pengadaan)</li>
            <li>Kembalikan ${batalFd.length} final draft ke PPK</li>
            <li>${revisi.filter(a => a.metodeRevisi === 'satukesatu').length} revisi satu-ke-satu → paket hasil (Final Draft) langsung diumumkan</li>
            <li>${revisi.filter(a => a.metodeRevisi !== 'satukesatu').length} revisi satu-ke-banyak → ${revisi.filter(a => a.metodeRevisi !== 'satukesatu').reduce((s, a) => s + a.pakets.length, 0)} paket hasil (Final Draft), langsung diumumkan</li>
            <li>Umumkan ${umumIds.length} final draft</li></ul>
            <p class="note">Semua langkah mengubah data SiRUP dan tercatat atas nama akun KPA ini. Proses berjalan berurutan; bila satu langkah gagal, proses berhenti dan rinciannya tampil di log.</p>`);
        if (!ok) return;
        for (const a of batalFd) { if (S.stop) break; await Sirup.batalFinalDraft(a.paketId, a.alasan); log(`Batal FD ${a.paketId}`, 'o'); await Sirup.sleep(S.cfg.jeda); }
        for (const a of batal) { if (S.stop) break; await Sirup.batalkanPaket(a.paketId, a.alasan); log(`Dibatalkan ${a.paketId} (${a.nama.slice(0, 50)})`, 'o'); await Sirup.sleep(S.cfg.jeda); }
        for (const a of revisi) {
            if (S.stop) break;
            const satu = a.metodeRevisi === 'satukesatu';
            log(satu ? `Revisi 1→1 paket ${a.donorId}…` : `Revisi 1→N paket ${a.donorId}: ${a.pakets.length} paket (paket #1 = paket existing)…`);
            const r = satu ? await Sirup.revisiSatuKeSatu(S.ctx, a.donor, a.pakets[0], a.alasan)
                : await Sirup.revisiSatuKeBanyak(S.ctx, a.donor, a.pakets, a.alasan, { onStep: (i, n) => log(`  simpan paket ${i}/${n}`) });
            log(`  ${r.baru.length} paket baru: ${r.baru.map(p => p.id).join(', ')}${r.donorHilang ? '' : ' — PERHATIAN: paket donor masih ada'}`, r.donorHilang ? 'o' : 'w');
            // hasil revisi (1→1 maupun 1→N) berstatus Final Draft → umumkan
            const fd = r.baru.filter(p => p.status === '2').map(p => p.id);
            if (fd.length) { await Sirup.umumkan(fd); log(`  diumumkan: ${fd.join(', ')}`, 'o'); }
            const aneh = r.baru.filter(p => !['2', '3'].includes(p.status));
            if (aneh.length) log(`  PERHATIAN: paket hasil berstatus tak terduga: ${aneh.map(p => `${p.id} (${Analysis.ST[p.status] || p.status})`).join(', ')}`, 'w');
            a.pilih = false; a.selesai = true;
            await Sirup.sleep(S.cfg.jeda);
        }
        if (umumIds.length && !S.stop) { await Sirup.umumkan(umumIds); log(`Diumumkan final draft: ${umumIds.join(', ')}`, 'o'); }
        log('Selesai. Membaca ulang paket RUP…', 'o');
        await loadPakets(true);
        S.an = null;
        go(4);
    }

    // ── 5. Struktur anggaran ───────────────────────────────────────────
    function stepStruktur() {
        if (needDipa()) return;
        if (!S.pakets) { body.append(h('div', { class: 'warnbox' }, 'Jalankan langkah 3 dulu.')); return; }
        guard(async () => {
            ensureAnalysis();
            S.sa = await Sirup.strukturAnggaran();
            const rup = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
            for (const p of S.pakets) if (p.status === '3' && p.aktif !== 'false') for (const s of p.sumberDana) { const g = Classify.jenisBelanja(s.mak.split('.').pop()); if (g in rup) rup[g] += s.pagu; }
            const dipa = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
            for (const a of S.an.akun.values()) { const g = Classify.jenisBelanja(a.akun); if (g in dipa) dipa[g] += a.P; }
            const rows = [['barjas', 'Barang/Jasa (52)'], ['modal', 'Modal (53)'], ['sosial', 'Bantuan Sosial (57)'], ['hibah', 'Hibah (56)'], ['lainnya', 'Lainnya (54,55,58)']];
            const target = { ...rup };
            const inputs = {};
            const mode = h('select', {}, h('option', { value: 'rup' }, 'Samakan dengan RUP terumumkan (target IKU 100%)'), h('option', { value: 'dipa' }, 'Samakan dengan pagu pengadaan DIPA'), h('option', { value: 'manual' }, 'Isi manual'));
            const tb = h('tbody', {});
            const draw = () => {
                tb.innerHTML = '';
                for (const [k, l] of rows) {
                    if (mode.value !== 'manual') target[k] = mode.value === 'rup' ? rup[k] : dipa[k];
                    const inp = h('input', { type: 'number', value: Math.round(target[k]), style: { width: '170px' }, disabled: mode.value !== 'manual' });
                    inp.addEventListener('input', () => { target[k] = +inp.value || 0; });
                    inputs[k] = inp;
                    tb.append(h('tr', {}, h('td', {}, l), h('td', { class: 'n' }, fmt(S.sa[k])), h('td', { class: 'n' }, fmt(rup[k])), h('td', { class: 'n' }, fmt(dipa[k])), h('td', { class: 'n' }, inp),
                        h('td', {}, rup[k] > dipa[k] + 1000 ? pill('RUP > pagu pengadaan DIPA', 'p-warn') : Math.abs(S.sa[k] - rup[k]) <= 1000 ? pill('sudah sama', 'p-ok') : pill('beda', 'p-bad'))));
                }
                const tot = o => rows.reduce((s, [k]) => s + (o[k] || 0), 0);
                tb.append(h('tr', {}, h('td', {}, h('b', {}, 'Total belanja pengadaan')), h('td', { class: 'n' }, h('b', {}, fmt(tot(S.sa)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(rup)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(dipa)))), h('td', {}), h('td', {},
                    h('b', {}, tot(S.sa) ? `IKU saat ini ${(tot(rup) / tot(S.sa) * 100).toFixed(1).replace('.', ',')}%` : ''))));
            };
            mode.addEventListener('change', draw);
            draw();
            body.append(h('div', { class: 'card' }, h('h3', {}, 'Struktur Anggaran (penyebut IKU RUP terumumkan)'),
                h('p', { class: 'note' }, `Terakhir diperbarui di SiRUP: ${S.sa.diperbarui || '–'}. Nilai RUP diambil dari paket berstatus Terumumkan saat ini (baca ulang di langkah 3 setelah eksekusi).`),
                h('div', { class: 'row' }, h('span', {}, 'Rekomendasi:'), mode),
                h('div', { class: 'tbl', style: { marginTop: '8px' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...['Jenis belanja', 'Saat ini di SiRUP', 'RUP terumumkan', 'Pagu pengadaan DIPA', 'Akan disimpan', ''].map((t, i) => h('th', { class: i && i < 5 ? 'n' : '' }, t)))), tb)),
                h('div', { class: 'warnbox' }, 'Struktur anggaran seharusnya mencerminkan pagu belanja pengadaan DIPA. Bila RUP terumumkan melebihi DIPA (mis. paket tahun jamak dicatat nilai kontrak penuh), menyamakan dengan RUP akan membuat struktur anggaran lebih besar dari DIPA — pastikan ini sesuai arahan pembina.'),
                h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => guard(async () => { await loadPakets(true); S.an = null; go(4); }) }, '↻ Baca ulang RUP'),
                    h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(async () => {
                        const ok = await confirmBox('Perbarui Struktur Anggaran', `<table class="t">${rows.map(([k, l]) => `<tr><td>${l}</td><td class="n">${fmt(S.sa[k])} → <b>${fmt(target[k])}</b></td></tr>`).join('')}</table>`, 'Simpan ke SiRUP');
                        if (!ok) return;
                        await Sirup.simpanStrukturAnggaran(S.sa, target, S.ctx.tahun);
                        log('Struktur anggaran disimpan.', 'o');
                        go(4);
                    }) }, 'Simpan ke Struktur Anggaran'))));
        });
    }

    // ── pengaturan & ekspor ─────────────────────────────────────────────
    async function settings() {
        const c = S.cfg;
        const num = (k, l) => { const i = h('input', { type: 'number', value: c[k] }); i.addEventListener('input', () => { c[k] = +i.value; }); return h('div', {}, h('label', {}, l), i); };
        const mon = (k, l) => { const i = h('input', { type: 'month', value: c.jadwalDefault[k] }); i.addEventListener('change', () => { c.jadwalDefault[k] = i.value; }); return h('div', {}, h('label', {}, l), i); };
        await modal('Pengaturan', h('div', { class: 'grid2' },
            num('plBarjas', 'Batas PL barang/jasa lainnya (Rp)'), num('plKonstruksi', 'Batas PL konstruksi (Rp)'), num('plKonsultansi', 'Batas PL konsultansi (Rp)'),
            (() => { const sl = h('select', {}, ...['Tender', 'Seleksi', 'Tender Cepat', 'E-Purchasing'].map(m => h('option', { selected: c.metodeEO === m }, m))); sl.addEventListener('change', () => { c.metodeEO = sl.value; }); return h('div', {}, h('label', {}, 'Metode paket EO di atas batas PL'), sl); })(),
            (() => { const sl = h('select', {}, h('option', { value: 'CEK', selected: c.cekSebagai !== 'P' }, 'Tidak dihitung (hanya ditandai)'), h('option', { value: 'P', selected: c.cekSebagai === 'P' }, 'Dihitung sebagai pengadaan')); sl.addEventListener('change', () => { c.cekSebagai = sl.value; }); return h('div', {}, h('label', {}, "Item 'Perlu cek' (mis. makan/seragam taruna via katering)"), sl); })(),
            num('minPaketBaru', 'Selisih minimum untuk usul paket baru (Rp)'), num('maxPaketPerRevisi', 'Maks. paket baru per revisi'), num('jeda', 'Jeda antar-permintaan (ms)'),
            mon('awalPengadaan', 'Default awal pemilihan'), mon('akhirPengadaan', 'Default akhir pemilihan'), mon('awalPekerjaan', 'Default awal kontrak'), mon('akhirPekerjaan', 'Default akhir kontrak'),
            mon('awalKebutuhan', 'Default awal pemanfaatan'), mon('kebutuhan', 'Default akhir pemanfaatan')), [['Simpan', true, 'pri']]);
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
        if (S.plan) add('Rencana Aksi', [['Aksi', 'type', 12], ['Paket/donor', 'id', 12], ['Nama', 'nama', 60], ['Pagu', 'pagu', 16, N], ['MAK', 'mak', 60], ['Keterangan', 'ket', 60], ['Dipilih', 'pilih', 8]],
            S.plan.actions.flatMap(a => a.type === 'REVISI' ? a.pakets.map((p, i) => ({ type: 'REVISI', id: a.donorId, nama: `#${i + 1} ${p.nama}`, pagu: p.anggaran.reduce((s, x) => s + x.pagu, 0), mak: p.anggaran.map(x => x.mak).join('; '), ket: i === 0 ? (a.catatan || []).join(' | ') : 'paket baru', pilih: a.pilih ? 'ya' : 'tidak' }))
                : a.type === 'PKKR_ADD' ? a.nodes.map(n => ({ type: 'PKKR', id: '', nama: n.nama, pagu: n.pagu, mak: n.key, ket: n.level, pilih: n.pilih ? 'ya' : 'tidak' }))
                    : a.type === 'UMUMKAN' ? a.ids.map(id => ({ type: 'UMUMKAN', id, nama: (S.pakets.find(p => p.id === id) || {}).nama, pilih: 'ya' }))
                        : [{ type: a.type, id: a.paketId, nama: a.nama, pagu: a.pagu, ket: a.alasan, pilih: a.pilih ? 'ya' : 'tidak' }]));
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `Sanding_DIPA_RUP_${S.ctx.kodeSatker}_${new Date().toISOString().slice(0, 10)}.xlsx` });
        document.body.append(a); a.click(); a.remove();
        log('Kertas kerja Excel diunduh.', 'o');
    }

    function mount() {
        if (document.querySelector('.sdr-fab')) return;
        const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
        document.body.append(h('button', { class: 'sdr-fab', onclick: open, title: APP }, '⇄ ', APP));
    }
    return { mount, open, S };
})();
