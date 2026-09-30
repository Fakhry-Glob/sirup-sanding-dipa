// ─────────────────────────────────────────────────────────────── API SiRUP ──
// Semua akses ke SiRUP lewat sesi login pengguna (same-origin). Pembacaan
// memakai endpoint DataTables/selfservice; penulisan meniru persis payload
// form yang direkam dari UI SiRUP (lihat rekaman Dual-Control 2026-09-30).
const Sirup = (() => {
    const BASE = '/sirup';
    const JENIS_ID = { 'Barang': 1, 'Pekerjaan Konstruksi': 2, 'Jasa Konsultansi': 3, 'Jasa Lainnya': 4 };
    const METODE_ID = { 'E-Purchasing': 9, 'Pengadaan Langsung': 8, 'Penunjukan Langsung': 7, 'Seleksi': 15, 'Tender': 13, 'Tender Cepat': 14 };
    // id provinsi SiRUP (urutan lama LPSE); nama diverifikasi dari data paket
    const PROVINSI = ['', 'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Jambi', 'Sumatera Selatan', 'Bengkulu', 'Lampung',
        'Kepulauan Bangka Belitung', 'Kepulauan Riau', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten',
        'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur',
        'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat', 'Maluku', 'Maluku Utara',
        'Papua Barat', 'Papua', 'Kalimantan Utara', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya'];

    let log = () => { };
    const setLogger = fn => { log = fn; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function get(url) {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) throw new Error(`GET ${url} → HTTP ${r.status}`);
        return r;
    }
    const getText = async url => (await get(url)).text();
    // SiRUP membalas simpan/umumkan dengan 302 ke "http://…" (bukan https). fetch() yang mengikuti
    // redirect itu diblokir browser sebagai mixed content → "Failed to fetch", padahal server sudah
    // memproses. Karena itu POST non-JSON memakai redirect:'manual' dan hasilnya diverifikasi terpisah.
    async function post(url, body, { json = false } = {}) {
        let r;
        try {
            r = await fetch(url, {
                method: 'POST', credentials: 'same-origin', redirect: json ? 'follow' : 'manual',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', ...(json ? { 'X-Requested-With': 'XMLHttpRequest' } : {}) },
                body: body instanceof URLSearchParams ? body.toString() : body,
            });
        } catch (e) { throw new Error(`POST ${url.replace(BASE, '')} gagal di jaringan/browser (${e.message}). Cek apakah sesi SiRUP masih login.`); }
        if (json) {
            if (!r.ok) throw new Error(`POST ${url} → HTTP ${r.status}`);
            return r.json();
        }
        if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) return { redirected: true, status: 302, text: async () => '' };
        if (!r.ok) throw new Error(`POST ${url.replace(BASE, '')} → HTTP ${r.status}`);
        return { redirected: false, status: r.status, text: () => r.text() };
    }
    // GET yang tidak mengikuti redirect (mis. kajiulangpaket → 302 ke form di http://)
    async function getManual(url) {
        try { return await fetch(url, { credentials: 'same-origin', redirect: 'manual' }); }
        catch (e) { throw new Error(`GET ${url.replace(BASE, '')} gagal (${e.message}).`); }
    }
    // pesan flash SiRUP (kotak alert) pada halaman berikutnya — dipakai untuk membaca alasan penolakan
    async function bacaFlash(url) {
        try {
            const h = await getText(url);
            const d = new DOMParser().parseFromString(h, 'text/html');
            // modal "Syarat dan Ketentuan" ada di setiap halaman → bukan pesan error
            return [...d.querySelectorAll('#alert, .alert-danger, .alert-warning, .alert-success, .alert-info, label.error, span.error, .help-block')]
                .filter(e => !e.closest('#popup, #overlay, .modal'))
                .map(e => e.textContent.replace(/\s+/g, ' ').replace(/^×\s*/, '').trim())
                .filter(t => t && !/Syarat dan Ketentuan|Kebijakan Privasi|Geser Ke Bawah/i.test(t)).join(' | ');
        } catch (e) { return ''; }
    }

    async function dt(url, extra = '') {
        const sep = url.includes('?') ? '&' : '?';
        const t = await getText(`${url}${sep}sEcho=1&iColumns=12&iDisplayStart=0&iDisplayLength=2000&sSearch=${extra}`);
        return JSON.parse(t).aaData;
    }
    const isLoginPage = html => /name="txtUsername"/.test(html) && !/id="user-logout"/.test(html);

    // ── konteks login ────────────────────────────────────────────────────
    async function context() {
        const html = document.documentElement.outerHTML;
        const ctx = { login: /id="user-logout"/.test(html) };
        if (!ctx.login) return ctx;
        const dd = [...document.querySelectorAll('#modalPengguna dt')].reduce((o, dt) => {
            o[dt.textContent.replace(/:\s*$/, '').trim()] = (dt.nextElementSibling ? dt.nextElementSibling.textContent : '').replace(/ /g, ' ').trim();
            return o;
        }, {});
        ctx.nama = dd['Nama Lengkap'] || '';
        ctx.role = dd['Role User'] || '';
        ctx.satkerNama = dd['Satker'] || '';
        const userLink = [...document.querySelectorAll('a.dropdown-toggle')].map(a => a.textContent.trim()).filter(Boolean);
        ctx.username = (document.querySelector('#user-logout') ? userLink.find(t => !/^\d{4}$/.test(t) && !/Rekap|RUP|Cari|Kelola|Unduh|Moner|FAQ|Berita|Dashboard|Ketentuan|Kontak/.test(t)) : '') || '';
        const tahun = (document.querySelector('a[href="#"] .fa-calendar') || {}).parentElement;
        ctx.tahun = +(html.match(/tahunAnggaran\s*[:=]\s*(20\d\d)/) || [])[1] || +(userLink.find(t => /^20\d\d$/.test(t)) || new Date().getFullYear());
        // id internal & kode satker dari form Program (hidden input) dan halaman integrasi
        const fp = await getText(`${BASE}/programctr/formprogram`);
        ctx.idSatker = (fp.match(/name="program\.id_satker" value="(\d+)"/) || [])[1] || '';
        const ta = (fp.match(/name="program\.tahun_anggaran"[^>]*value="(\d{4})"/) || [])[1];
        if (ta) ctx.tahun = +ta;
        const ig = await getText(`${BASE}/integrasimonsaktictr/index`);
        ctx.kodeSatker = (ig.match(/name="satker\.id_satker"[^>]*value="(\d{6})"/) || [])[1] || '';
        ctx.isKPA = /^(PAKPA|KPA|KPAD)$/i.test(ctx.role);
        return ctx;
    }

    // ── PKKR ─────────────────────────────────────────────────────────────
    const PKKR_LV = [
        ['prog', 'datatablelistprogram', null],
        ['keg', 'datatablelistkegiatan', 'idProgram'],
        ['kro', 'datatablelistoutput', 'idKegiatan'],
        ['ro', 'datatablelistsuboutput', 'idOutput'],
        ['komp', 'datatablelistkomponen', 'idSubOutput'],
        ['sub', 'datatablelistsubkomponen', 'idKomponen'],
    ];
    // Kolom pagu & PPK berbeda per level; baris manual ditandai kolom id_client 'N/A'
    function rowToNode(row, lvl, parentKey) {
        const kode = String(row[2]).trim();
        const pagu = +(lvl === 'prog' ? row[4] : lvl === 'keg' ? row[3] : row[4]) || 0;
        const idClient = row[row.length - 1];
        return { id: String(row[0]), level: lvl, kode, nama: row[1], pagu, key: parentKey ? `${parentKey}.${kode}` : kode, manual: !idClient || idClient === 'N/A' };
    }
    async function crawlPkkr(tahun, onProgress) {
        const map = new Map();
        let n = 0;
        async function walk(depth, parent) {
            const [lvl, ep, param] = PKKR_LV[depth];
            const url = param ? `${BASE}/datatablectr/${ep}?tahun=${tahun}&${param}=${parent.id}` : `${BASE}/datatablectr/${ep}`;
            const rows = await dt(url);
            for (const r of rows) {
                const node = rowToNode(r, lvl, parent && parent.key);
                node.parentId = parent ? parent.id : null;
                // Rantai PKKR Manual paralel (cara BPPP Tegal) memakai kode yang sama dengan node
                // Integrasi. Map menyimpan node Integrasi sebagai utama dan salinan Manual di .manualTwin.
                const ada = map.get(node.key);
                if (!ada) map.set(node.key, node);
                else if (ada.manual && !node.manual) { node.manualTwin = ada; map.set(node.key, node); }
                else if (!ada.manualTwin) ada.manualTwin = node;
                if (onProgress) onProgress(++n, node.key);
                if (depth + 1 < PKKR_LV.length) await walk(depth + 1, node);
            }
        }
        await walk(0, null);
        return map;
    }

    // Simpan node PKKR baru. parentId = id node induk di SiRUP.
    async function tambahPkkr(ctx, node, parentId, idPpk) {
        const T = ctx.tahun, S = ctx.idSatker;
        const f = new URLSearchParams();
        const add = (k, v) => f.append(k, v == null ? '' : v);
        switch (node.level) {
            case 'prog':
                add('program.id', ''); add('program.tahun_anggaran', T); add('program.id_satker', S);
                add('program.id', ''); add('program.nama', node.nama); add('program.kode_programs', node.kode); add('program.pagu', node.pagu); add('isEdit', '');
                return post(`${BASE}/programctr/simpanprogram`, f);
            case 'keg':
                add('kegiatan.tahun_anggaran', T); add('isEdit', ''); add('kegiatan.id_satker', S); add('kegiatan.id_program', parentId); add('kegiatan.id', '');
                add('kegiatan.nama', node.nama); add('kegiatan.kode_kegiatans', node.kode); add('kegiatan.pagu', node.pagu); add('kegiatan.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpankegiatan`, f);
            case 'kro':
                add('output.id', ''); add('output.tahun_anggaran', T); add('output.id_kegiatan', parentId); add('isEdit', ''); add('output.id_satker', S);
                add('output.nama', node.nama); add('output.kode_output_string', node.kode); add('output.pagu', node.pagu); add('output.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpanoutput`, f);
            case 'ro':
                add('suboutput.id', ''); add('suboutput.tahun_anggaran', T); add('suboutput.id_output', parentId); add('isEdit', ''); add('suboutput.id_satker', S);
                add('suboutput.nama', node.nama); add('suboutput.kode_suboutput_string', node.kode); add('suboutput.pagu', node.pagu); add('suboutput.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpansuboutput`, f);
            case 'komp':
                add('komponen.id', ''); add('komponen.tahun_anggaran', T); add('komponen.id_suboutput', parentId); add('komponen.satkerID', S);
                add('komponen.nama', node.nama); add('komponen.kode_komponen_string', node.kode); add('komponen.pagu', node.pagu); add('komponen.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpankomponen`, f);
            case 'sub':
                add('subkomponen.id', ''); add('subkomponen.tahun_anggaran', T); add('subkomponen.id_komponen', parentId); add('subkomponen.satkerID', S);
                add('subkomponen.nama', node.nama); add('subkomponen.kode_subkomponen_string', node.kode); add('subkomponen.pagu', node.pagu); add('subkomponen.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpansubkomponen`, f);
        }
        throw new Error('Level PKKR tidak dikenal: ' + node.level);
    }
    // cari id node yang baru dibuat (berdasarkan kode di bawah induk)
    async function cariNodeBaru(ctx, level, parentId, kode) {
        const i = PKKR_LV.findIndex(l => l[0] === level);
        const [, ep, param] = PKKR_LV[i];
        const url = param ? `${BASE}/datatablectr/${ep}?tahun=${ctx.tahun}&${param}=${parentId}` : `${BASE}/datatablectr/${ep}`;
        const rows = (await dt(url)).filter(x => String(x[2]).trim() === kode);
        if (!rows.length) return null;
        const manual = rows.filter(x => { const c = x[x.length - 1]; return !c || c === 'N/A'; });
        const pick = (manual.length ? manual : rows).sort((a, b) => Number(b[0]) - Number(a[0]))[0];
        return String(pick[0]);
    }
    // daftar PPK diambil dari form sub komponen; idKomponen harus id nyata (0 → HTTP 500)
    async function daftarPpk(idKomponen) {
        if (!idKomponen) return [];
        const h = await getText(`${BASE}/programctr/formsubkomponen?idKomponen=${idKomponen}`).catch(() => '');
        return [...h.matchAll(/<option value="(\d+)"\s*>([^<]+)<\/option>/g)].map(m => ({ id: m[1], nama: m[2].trim() }));
    }

    // ── RUP ──────────────────────────────────────────────────────────────
    async function daftarPaket(tahun, jenis = 'penyedia') {
        const ep = jenis === 'penyedia' ? 'dataruppenyedia2018' : 'datarupswakelola2018';
        const rows = await dt(`${BASE}/datatablectr/${ep}?tahun=${tahun}`, '&status=');
        return rows.map(r => ({ id: String(r[0]), jenisPaket: jenis, kegiatan: r[1] === 'N/A' ? r[11] : r[1], nama: r[2], pagu: +r[3] || 0, waktu: r[4],
            sumber: r[5], aktif: r[6], fd: r[7], umumkan: r[8], status: String(r[9]), idClient: r[13], manual: r[13] === 'N/A' }));
    }
    async function denorm(id, tahun) {
        return post(`${BASE}/selfservice/paketpenyediadenormalisasibyid`, `id=${id}&tahunAnggaran=${tahun}`, { json: true });
    }
    // Detail HTML (PDN, UKM, pra-DIPA, metode, nama lokasi) — tidak ada di JSON
    async function detailHtml(id) {
        const html = await getText(`${BASE}/penyedia/${id}`);
        const d = new DOMParser().parseFromString(html, 'text/html');
        const txt = el => (el ? el.textContent : '').replace(/[ \t\r]+/g, ' ').replace(/\n\s*/g, '\n').trim();
        const o = {};
        for (const td of d.querySelectorAll('#detil td.label-left')) {
            const v = td.nextElementSibling; if (!v) continue;
            const t = v.querySelector('table');
            o[txt(td)] = t ? [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(txt)) : txt(v);
        }
        return o;
    }
    const rows = (t, n) => (Array.isArray(t) ? t : []).filter(x => x.length === n && /^\d+\.$/.test(x[0]));
    async function detailPaket(p, tahun) {
        const [j, h] = await Promise.all([denorm(p.id, tahun), detailHtml(p.id)]);
        const lokNama = rows(h['Lokasi Pekerjaan'], 4);
        const jd = k => { const t = h[k]; return Array.isArray(t) && t[1] ? { mulai: t[1][0], akhir: t[1][1] } : null; };
        return Object.assign(p, {
            nama: j.nama || p.nama,
            uraianRaw: j.keterangan || '', spesifikasiRaw: j.spesifikasi || '',
            uraian: (j.keterangan || '').replace(/\t+/g, ' ').replace(/ {2,}/g, ' ').trim(),
            spesifikasi: (j.spesifikasi || '').replace(/\t+/g, ' ').replace(/ {2,}/g, ' ').trim(),
            volume: j.volume || '1 Paket',
            sumberDana: (j.paket_anggaran_json || []).map(a => ({ id: a.id, mak: a.mak, pagu: a.pagu, idKomponen: a.id_komponen, sumber: a.sumber_dana, danaApbn: a.id_dana_apbn, asal: a.asal_dana, asalSatker: a.asal_dana_satker, ta: a.tahun_anggaran_dana, kodeInstansi: a.kode_instansi, kodeEselon: a.kode_esselon, kodeSatker: a.kode_satker })),
            lokasiRaw: (j.paket_lokasi_json || []).map((l, i) => ({ id: l.id, id_provinsi: l.id_provinsi, id_kabupaten: l.id_kabupaten, detil: l.detil_lokasi, prov: lokNama[i] ? lokNama[i][1] : '', kab: lokNama[i] ? lokNama[i][2] : '' })),
            lokasi: lokNama.map(x => ({ prov: x[1], kab: x[2], detail: x[3] })),
            jenisRaw: (j.paket_jenis_json || []).map(x => ({ id: x.id, jenisid: x.jenisid, pagu: x.jumlah_pagu })),
            jenisPengadaan: rows(h['Jenis Pengadaan'], 3).map(x => ({ jenis: x[1], pagu: +x[2] })),
            tanggal: { awalPengadaan: (j.tanggal_awal_pengadaan || '').slice(0, 7), akhirPengadaan: (j.tanggal_akhir_pengadaan || '').slice(0, 7), awalPekerjaan: (j.tanggal_awal_pekerjaan || '').slice(0, 7), akhirPekerjaan: (j.tanggal_akhir_pekerjaan || '').slice(0, 7) },
            pemanfaatan: jd('Pemanfaatan Barang/Jasa'), pelaksanaan: jd('Jadwal Pelaksanaan Kontrak'), pemilihan: jd('Jadwal Pemilihan Penyedia'),
            metode: h['Metode Pemilihan'] || '', pradipa: h['Pra DIPA / DPA'] || '', pdn: h['Produk Dalam Negeri'] || '', ukm: h['Usaha Kecil/Koperasi'] || '',
            spp: (() => { const t = h['Pengadaan Berkelanjutan atau Sustainable Public Procurement (SPP)']; const g = k => Array.isArray(t) && (t.find(r => r[0] === k) || [])[1] === 'Ya'; return { ekonomi: g('Aspek Ekonomi'), sosial: g('Aspek Sosial'), lingkungan: g('Aspek Lingkungan') }; })(),
            tglUmumkan: h['Tanggal Umumkan Paket'] || '',
        });
    }

    const kabCache = new Map();
    async function kabupaten(idProv) {
        // simpan promise-nya supaya puluhan editor tidak memicu request yang sama berkali-kali
        if (!kabCache.has(idProv)) kabCache.set(idProv, post(`${BASE}/selfservice/daftarkabupaten`, `id_provinsi=${idProv}`, { json: true }).then(a => a.map(k => ({ id: k.kbp_id, nama: k.kbp_nama }))).catch(() => []));
        return kabCache.get(idProv);
    }
    async function alasanUmkm(tahun) {
        return post(`${BASE}/selfservice/daftaralasanumkm`, `tahunAnggaran=${tahun}`, { json: true }).then(a => a.map(x => x.alasan_umkm)).catch(() => []);
    }

    // ── Struktur anggaran ───────────────────────────────────────────────
    async function strukturAnggaran() {
        const h = await getText(`${BASE}/strukturanggaranctr/strukturanggarannew`);
        const v = n => +((h.match(new RegExp(`name="strukturAnggaranPusat\\.${n}"[\\s\\S]*?value="(\\d*)"`)) || [])[1] || 0);
        return {
            id: (h.match(/name="strukturAnggaranPusat\.id" value="(\d+)"/) || [])[1] || '',
            idSatker: (h.match(/name="strukturAnggaranPusat\.id_satker"\s*value="(\d+)"/) || [])[1] || '',
            barjas: v('belanja_barjas'), modal: v('belanja_modal'), sosial: v('belanja_pengadaan_sosial'), hibah: v('belanja_pengadaan_hibah'), lainnya: v('belanja_pengadaan_lainnya'),
            diperbarui: (h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/diperbarui pada tanggal\s*([\d-]+\s*[\d:]*)/i) || [])[1] || '',
        };
    }
    async function simpanStrukturAnggaran(sa, val, tahun) {
        const f = new URLSearchParams();
        f.append('strukturAnggaranPusat.id', sa.id);
        f.append('strukturAnggaranPusat.id_satker', sa.idSatker);
        f.append('strukturAnggaranPusat.tahun_anggaran', tahun);
        f.append('strukturAnggaranPusat.belanja_barjas', Math.round(val.barjas));
        f.append('strukturAnggaranPusat.belanja_modal', Math.round(val.modal));
        f.append('strukturAnggaranPusat.belanja_pengadaan_sosial', Math.round(val.sosial));
        f.append('strukturAnggaranPusat.belanja_pengadaan_hibah', Math.round(val.hibah));
        f.append('strukturAnggaranPusat.belanja_pengadaan_lainnya', Math.round(val.lainnya));
        const r = await post(`${BASE}/strukturanggaranctr/simpanstrukturanggaranpusat`, f);
        if (!r.redirected) throw new Error('Struktur anggaran ditolak: ' + (await pesanError(r)));
        const cek = await strukturAnggaran();
        const beda = ['barjas', 'modal', 'sosial', 'hibah', 'lainnya'].filter(k => Math.abs(cek[k] - Math.round(val[k])) > 1);
        if (beda.length) throw new Error('Struktur anggaran tidak berubah sesuai isian (' + beda.join(', ') + '). ' + (await bacaFlash(`${BASE}/strukturanggaranctr/strukturanggarannew`)));
        return cek;
    }

    // ── Umumkan / batal ─────────────────────────────────────────────────
    async function umumkan(ids, jenis = 'penyedia') {
        const f = new URLSearchParams();
        f.append('sData', ids.map(id => `${id}=on`).join('&'));
        f.append('penyediaAtauSwakelola', jenis);
        const r = await post(`${BASE}/rup/umumkan`, f);
        if (!r.redirected) throw new Error('SiRUP tidak menerima permintaan umumkan: ' + (await pesanError(r)));
        return r;
    }
    async function batalFinalDraft(id, alasan, jenis = 'penyedia') {
        const f = new URLSearchParams({ alasan, idPaket: id, penyediaAtauSwakelola: jenis });
        const r = await post(`${BASE}/rup/submitbatalkanfinaldraft`, f);
        if (!r.redirected) throw new Error(`Batal final draft ${id} ditolak: ` + (await pesanError(r)));
        return r;
    }
    async function batalkanPaket(id, alasan, jenis = 'penyedia') {
        await getManual(`${BASE}/rup/kajiulangpaket?id=${id}&penyediaAtauSwakelola=${jenis}&jenisMtl=&jenis=batal`);
        const form = await getText(`${BASE}/rup/formkajiulangbatal?penyediaAtauSwakelola=${jenis}&id=${id}`);
        if (!/simpanrevisi/i.test(form)) throw new Error(`Form pembatalan paket ${id} tidak terbuka (paket mungkin bukan status Terumumkan).`);
        const f = new URLSearchParams({ alasan, id, penyediaAtauSwakelola: jenis });
        const r = await post(`${BASE}/revisictr/simpanrevisi${jenis}batal`, f);
        if (!r.redirected) throw new Error(`Pembatalan paket ${id} ditolak: ` + (await pesanError(r)));
        return r;
    }
    async function pesanError(r) {
        const body = await r.text();
        const d = new DOMParser().parseFromString(body, 'text/html');
        const t = [...d.querySelectorAll('.alert, .error, label.error')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
        return t || `HTTP ${r.status}, halaman tanpa pesan`;
    }

    // ── Revisi satu ke banyak ───────────────────────────────────────────
    // Satu POST per paket hasil revisi; paket terakhir isSelesai=true. Paket
    // asal hilang dari daftar dan semua paket hasil lahir sebagai Final Draft.
    function payloadPaket(ctx, donor, pk, count, isSelesai, alasan) {
        const f = new URLSearchParams();
        const add = (k, v) => f.append(k, v == null ? '' : String(v));
        add('jenis', 1); add('is_edit', ''); add('paket.id_swakelola', ''); add('idTerkaji', donor.id);
        add('paket.kode_kldi', ctx.kodeKldi || 'K8'); add('paket.id_swakelola', '');
        // K/L: dikecualikan=true → form SiRUP menyembunyikan metode dan mengisi metode_dikecualikan=-1
        add('metode_dikecualikan', pk.metode === 'Dikecualikan' ? '-1' : '');
        add('idAwal', donor.id); add('count', count); add('alasan', alasan || 'Penyesuaian dengan DIPA'); add('paket.id_swakelola', '');
        add('paket.tahun_anggaran', ctx.tahun); add('paket.id_satker', ctx.idSatker); add('paket.nama', pk.nama);
        pk.lokasiRaw.forEach((l, i) => {
            add(`paketLokasi[${i}].id`, pk.baru ? '' : (l.id || '')); add(`paketLokasi[${i}].id_provinsi`, l.id_provinsi);
            add(`paketLokasi[${i}].id_kabupaten`, l.id_kabupaten); add(`paketLokasi[${i}].detil_lokasi`, l.detil || '');
        });
        add('paket.volume', pk.volume || '1 Paket'); add('paket.keterangan', pk.uraian); add('paket.spesifikasi', pk.spesifikasi);
        if (pk.praDipa) { add('isPraDipa', 'on'); add('paket.no_renja', ''); } // no_renja hanya ada di form bila Pra-DIPA dicentang
        let total = 0;
        pk.anggaran.forEach((a, i) => {
            const parts = a.mak.split('.');
            add(`paketAnggaran[${i}].id`, pk.baru ? '' : (a.idLama || ''));
            add(`paketAnggaran[${i}].tahun_anggaran_dana`, ctx.tahun); add(`paketAnggaran[${i}].sumber_dana`, a.sumber || 2);
            add(`paketAnggaran[${i}].asal_dana`, ctx.kodeKldi || 'K8'); add(`paketAnggaran[${i}].asal_dana_satker`, ctx.idSatker);
            add(`paketAnggaran[${i}].id_dana_apbn`, a.danaApbn || 'A');
            add(`paketAnggaran[${i}].mak1`, `${ctx.kodeBA}.${ctx.kodeEselon}.${ctx.kodeSatker}`);
            add(`paketAnggaran[${i}].mak`, parts.slice(5).join('.'));          // SUB.AKUN
            add(`paketAnggaran[${i}].id_komponen`, a.idKomponen);               // id Komponen PKKR
            add(`paketAnggaran[${i}].pagu`, Math.round(a.pagu));
            total += Math.round(a.pagu);
        });
        add('totalPaguBersih', total);
        let jenis = pk.jenisList && pk.jenisList.length ? pk.jenisList : [{ jenisid: JENIS_ID[pk.jenis] || 1, pagu: total }];
        if (jenis.length === 1) jenis = [{ ...jenis[0], jenisid: JENIS_ID[pk.jenis] || jenis[0].jenisid, pagu: total }];
        jenis.forEach((j, i) => { add(`paketJenis[${i}].id`, pk.baru ? '' : (j.id || '')); add(`paketJenis[${i}].jenisid`, j.jenisid); add(`paketJenis[${i}].jumlah_pagu`, Math.round(j.pagu)); });
        add('isTKDN', pk.pdn ? 'true' : 'false');
        add('isUMKM', pk.umkm ? 'true' : 'false');
        if (!pk.umkm) add('alasan_umkm', pk.alasanUmkm || (total > 15e9 ? 'Paket pengadaan Barang/Pekerjaan Konstuksi/Jasa Lainnya memiliki nilai Pagu Anggaran > Rp. 15 miliar.' : 'Kompetensi tidak sesuai dengan usaha kecil'));
        if (pk.spp && pk.spp.ekonomi) add('sppEkonomi', 'on');
        if (pk.spp && pk.spp.sosial) add('sppSosial', 'on');
        if (pk.spp && pk.spp.lingkungan) add('sppLingkungan', 'on');
        add('paket.dikecualikan', pk.metode === 'Dikecualikan' ? 'true' : 'false');
        add('paket.metode_pengadaan', pk.metode === 'Dikecualikan' ? '' : (METODE_ID[pk.metode] || ''));
        const t = pk.jadwal;
        add('tanggalKebutuhan', t.kebutuhan); add('tanggalAwalKebutuhan', t.awalKebutuhan);
        add('tanggalAkhirPekerjaan', t.akhirPekerjaan); add('tanggalAwalPekerjaan', t.awalPekerjaan);
        add('tanggalAkhirPengadaan', t.akhirPengadaan); add('tanggalAwalPengadaan', t.awalPengadaan);
        add('isSelesai', isSelesai ? 'true' : 'false');
        return f;
    }

    // Serialisasi form revisi SiRUP persis seperti browser mengirimnya (field bernama, tidak disabled,
    // checkbox/radio hanya yang tercentang, select = opsi terpilih). Form ini sudah terisi otomatis
    // dengan data paket existing, sehingga bisa dipakai apa adanya ("dibiarkan saja") atau sebagai template.
    function serializeForm(html) {
        const d = new DOMParser().parseFromString(html, 'text/html');
        const form = [...d.querySelectorAll('form')].find(f => /simpankajiulang/i.test(f.getAttribute('action') || ''));
        if (!form) return null;
        const entries = [];
        for (const el of form.querySelectorAll('input, select, textarea')) {
            const name = el.getAttribute('name');
            if (!name || el.hasAttribute('disabled')) continue;
            const tag = el.tagName.toLowerCase(), type = (el.getAttribute('type') || 'text').toLowerCase();
            if (tag === 'input' && ['submit', 'button', 'file', 'image', 'reset'].includes(type)) continue;
            if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
                if (el.hasAttribute('checked')) entries.push([name, el.getAttribute('value') ?? 'on']);
                continue;
            }
            if (tag === 'select') {
                const opts = [...el.querySelectorAll('option')];
                const sel = el.hasAttribute('multiple') ? opts.filter(o => o.hasAttribute('selected')) : [opts.find(o => o.hasAttribute('selected')) || opts[0]].filter(Boolean);
                for (const o of sel) entries.push([name, o.getAttribute('value') ?? o.textContent.trim()]);
                continue;
            }
            entries.push([name, tag === 'textarea' ? el.textContent : (el.getAttribute('value') ?? '')]);
        }
        return { action: form.getAttribute('action'), entries };
    }
    const ARRAY_FIELD = /^(paketLokasi|paketAnggaran|paketJenis|paketKbki)\[\d+\]/;
    const KONTROL = ['count', 'isSelesai', 'alasan', 'idTerkaji', 'idAwal'];

    // Gabungkan template form dengan payload kita.
    //  - pk.pertahankan (paket #1 = paket existing): kirim isi form apa adanya, hanya kontrol alur yang diisi.
    //  - paket baru: pakai payload kita, lalu tambahkan field template yang tidak kita kenal (bukan larik).
    function gabungPayload(tpl, ours, pk) {
        const f = new URLSearchParams();
        const kita = new Map();
        for (const [k, v] of ours) if (!kita.has(k)) kita.set(k, v);
        if (pk.pertahankan && tpl) {
            const adaAnggaran = tpl.entries.some(([k]) => /^paketAnggaran\[0\]\.mak$/.test(k));
            // buang baris larik "cetakan" yang seluruh nilainya kosong (baris tambah lokasi/dana di form)
            const grup = {};
            for (const [k, v] of tpl.entries) { const m = k.match(ARRAY_FIELD); if (m) { grup[m[0]] = grup[m[0]] || []; if (!/\.id$/.test(k)) grup[m[0]].push(v); } }
            const kosong = new Set(Object.entries(grup).filter(([, vs]) => vs.every(v => !String(v).trim())).map(([g]) => g));
            for (const [k, v] of tpl.entries) {
                const m = k.match(ARRAY_FIELD);
                if (m && kosong.has(m[0])) continue;
                if (KONTROL.includes(k)) continue;
                if (!adaAnggaran && ARRAY_FIELD.test(k)) continue;
                f.append(k, v);
            }
            if (!adaAnggaran) for (const [k, v] of ours) if (ARRAY_FIELD.test(k)) f.append(k, v); // larik diisi JS di browser → pakai data paket existing
            for (const k of KONTROL) f.set(k, kita.get(k) ?? '');
            return f;
        }
        const tplMap = new Map(tpl ? tpl.entries : []);
        for (const [k, v] of ours) f.append(k, !v && /^(paketLokasi|paketAnggaran|paketJenis)\[\d+\]\.id$/.test(k) && tplMap.get(k) ? tplMap.get(k) : v);
        if (tpl) for (const [k, v] of tpl.entries) if (!kita.has(k) && !ARRAY_FIELD.test(k) && !KONTROL.includes(k)) f.append(k, v);
        return f;
    }

    // Trik KPA membuat paket tanpa akun PPK: revisi satu-ke-banyak atas paket existing.
    // Paket #1 = paket existing dibiarkan apa adanya; paket #2 dst. = paket baru.
    async function revisiSatuKeBanyak(ctx, donor, pakets, alasan, { onStep, dryRun } = {}) {
        const ours = pakets.map((pk, i) => payloadPaket(ctx, donor, pk, i + 1, i === pakets.length - 1, alasan));
        if (dryRun) return { payloads: ours.map((o, i) => gabungPayload(null, o, pakets[i])) };
        const before = new Set((await daftarPaket(ctx.tahun)).map(p => p.id));
        const formUrl = n => `${BASE}/revisictr/formkajiulangsatukebanyak?count=${n}&penyediaAtauSwakelola=penyedia&id=${donor.id}&ispecah=false`;
        await getManual(`${BASE}/rup/kajiulangpaket?id=${donor.id}&penyediaAtauSwakelola=penyedia&jenisMtl=&jenis=satukebanyak`);
        const h0 = await getText(formUrl(1));
        let tpl = serializeForm(h0);
        if (!tpl) throw new Error(`Form revisi satu ke banyak paket ${donor.id} tidak terbuka (paket mungkin bukan status Terumumkan).`);
        const terkirim = [];
        for (let i = 0; i < ours.length; i++) {
            const body = gabungPayload(tpl, ours[i], pakets[i]);
            terkirim.push(body);
            const r = await post(`${BASE}/revisictr/simpankajiulangonetomanypenyedia`, body);
            if (!r.redirected) throw new Error(`Paket #${i + 1} ditolak SiRUP: ${await pesanError(r)}. Paket #1–#${i} sudah tersimpan; cek daftar paket sebelum mengulang.`);
            if (i < ours.length - 1) {
                const h = await getText(formUrl(i + 2));
                tpl = serializeForm(h) || tpl; // form berikutnya (count+1) jadi template
            }
            if (onStep) onStep(i + 1, ours.length);
            await sleep(400);
        }
        const after = await daftarPaket(ctx.tahun);
        const baru = after.filter(p => !before.has(p.id));
        return { baru, donorHilang: !after.some(p => p.id === donor.id), terkirim };
    }

    // Revisi satu ke satu: satu POST ke simpankajiulangonetoonepenyedia (payload = 1→N tanpa count/isSelesai).
    // Paket asal digantikan paket berkode baru berstatus Final Draft; KPA harus mengumumkannya lagi.
    async function revisiSatuKeSatu(ctx, paketAsal, pk, alasan, { dryRun } = {}) {
        const ours = payloadPaket(ctx, paketAsal, pk, 1, true, alasan);
        ours.delete('count'); ours.delete('isSelesai');
        if (dryRun) return { payloads: [gabungPayload(null, ours, pk)] };
        const before = new Set((await daftarPaket(ctx.tahun)).map(p => p.id));
        await getManual(`${BASE}/rup/kajiulangpaket?id=${paketAsal.id}&penyediaAtauSwakelola=penyedia&jenisMtl=&jenis=satukesatu`);
        const tpl = serializeForm(await getText(`${BASE}/revisictr/formkajiulangsatukesatu?penyediaAtauSwakelola=penyedia&id=${paketAsal.id}`));
        if (!tpl) throw new Error(`Form revisi satu ke satu paket ${paketAsal.id} tidak terbuka (paket mungkin bukan status Terumumkan).`);
        const body = gabungPayload(tpl, ours, pk);
        body.delete('count'); body.delete('isSelesai');
        const r = await post(`${BASE}/revisictr/simpankajiulangonetoonepenyedia`, body);
        if (!r.redirected) throw new Error(`Revisi 1→1 paket ${paketAsal.id} ditolak SiRUP: ${await pesanError(r)}`);
        const after = await daftarPaket(ctx.tahun);
        const baru = after.filter(p => !before.has(p.id));
        return { baru, donorHilang: !after.some(p => p.id === paketAsal.id), terkirim: [body] };
    }

    return {
        context, crawlPkkr, tambahPkkr, cariNodeBaru, daftarPpk, daftarPaket, detailPaket, denorm, kabupaten, alasanUmkm,
        strukturAnggaran, simpanStrukturAnggaran, umumkan, batalFinalDraft, batalkanPaket, revisiSatuKeBanyak, revisiSatuKeSatu, payloadPaket, serializeForm, gabungPayload,
        bacaFlash, getManual, setLogger, JENIS_ID, METODE_ID, PROVINSI, isLoginPage, sleep,
    };
})();
