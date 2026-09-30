// ──────────────────────────────────────────────────────── KLASIFIKASI BELANJA ──
// Memutuskan tiap baris detail DIPA termasuk pengadaan (P), non-pengadaan (NP)
// atau perlu dicek (CEK). Aturan disusun dari akun + kata kunci uraian item.
// Keputusan pengguna: PJLP = pengadaan; honor PPNPN beserta iuran BPJS = non.
const Classify = (() => {
    const has = (re, ...s) => s.some(x => re.test(x || ''));

    const RE = {
        pjlp: /\bpjlp\b|jasa lainnya perorangan|penyedia jasa (lainnya )?perorangan|cleaning ?service|tenaga (kebersihan|keamanan|satpam|pramubakti|pengemudi|teknisi)|\bsatpam\b|satuan pengaman|pramubakti|outsourc/i,
        bpjs: /\bbpjs\b|iuran jaminan|jaminan (kesehatan|kecelakaan|kematian|hari tua|pensiun|sosial)|\bjkk\b|\bjkm\b|\bjht\b/i,
        ppnpn: /ppnpn|pegawai pemerintah non pegawai negeri|pegawai non asn|tenaga honorer/i,
        honor: /honor|insentif|narasumber|narsum|pembahas|moderator|rohaniawan|\btunjangan\b|uang lembur|\blembur\b/i,
        uang: /uang (saku|harian|representasi|transport|makan (pns|pppk|lembur))|transport(asi)? lokal|lumpsum|lump sum|biaya transport(asi)? (peserta|narasumber)/i,
        pungutan: /\bpajak\b|\bpbb\b|\bstnk\b|retribusi|bea (materai|meterai)|biaya tol|\btol\b|e-?toll|\bparkir\b|biaya administrasi bank/i,
        natura: /makan (taruna|siswa|peserta didik|mahasiswa|kadet)|konsumsi (taruna|siswa|peserta didik)|ransum|(seragam|pakaian( dinas)?|perlengkapan) (taruna|siswa|peserta didik)/i,
        bantuan: /beasiswa|biaya pendidikan|\bspp\b|uang kuliah|tugas belajar|izin belajar|bantuan (pemerintah|biaya|uang|dana|sosial|langsung)|\bbanpem\b|hadiah (uang|lomba)/i,
        // paket meeting luar/dalam kota: penginapan hotel & ruang rapat direalisasikan sebagai pengadaan (metode Dikecualikan)
        meeting: /paket meeting|full ?board|full ?day|half ?day|fullboard|fullday|halfday|sewa (ruang|gedung|hall|aula)|ruang (rapat|pertemuan)|akomodasi|penginapan|hotel|kamar|paket (kegiatan|pertemuan)/i,
        // komponen khas EO: bila ada di RAB, paket diperlakukan sebagai jasa EO (bukan dikecualikan)
        eo: /hiburan|mc|master of ceremony|pembawa acara|dekorasi|sound ?system|dokumentasi|event organi[sz]er|eo|panggung|lighting|backdrop/i,
        konsultan: /konsultan|pengawas(an)?\b|perencana(an)?\b|manajemen konstruksi|\bded\b|desain|kajian teknis|supervisi/i,
        pengelolaan: /pengelolaan kegiatan|manajemen proyek|biaya umum/i,
    };

    // akun → kelompok jenis belanja pada Struktur Anggaran SiRUP
    function jenisBelanja(akun) {
        const p2 = akun.slice(0, 2);
        if (p2 === '52') return 'barjas';
        if (p2 === '53') return 'modal';
        if (p2 === '57') return 'sosial';
        if (p2 === '56') return 'hibah';
        if (['54', '55', '58'].includes(p2)) return 'lainnya';
        return 'pegawai';
    }

    function saranJenis(akun, uraian) {
        if (/^53[34]/.test(akun)) return has(RE.konsultan, uraian) ? 'Jasa Konsultansi' : 'Pekerjaan Konstruksi';
        if (/^53/.test(akun)) return 'Barang';
        if (akun === '522131' || has(RE.konsultan, uraian) && /^52/.test(akun) && !/^5211/.test(akun)) return 'Jasa Konsultansi';
        if (akun === '523111' || akun === '523112') return 'Pekerjaan Konstruksi';
        if (/^52(2|3)/.test(akun) || /^5241/.test(akun) || has(RE.pjlp, uraian)) return 'Jasa Lainnya';
        return 'Barang';
    }

    // Satu baris detail → {kelas, alasan}
    function item(akun, akunNama, uraian, grup) {
        const u = `${grup || ''} ${uraian || ''}`;
        const A = akun || '';
        if (/^51/.test(A)) return { kelas: 'NP', alasan: 'Belanja pegawai (gaji/tunjangan)' };
        if (has(RE.bpjs, u)) return { kelas: 'NP', alasan: 'Iuran BPJS / jaminan sosial' };
        if (has(RE.ppnpn, u)) return { kelas: 'NP', alasan: 'Honor PPNPN' };
        if (has(RE.pjlp, u)) return { kelas: 'P', alasan: 'PJLP / jasa lainnya perorangan (pengadaan)' };
        if (/^5241/.test(A)) {
            if (/^52411[49]$/.test(A) && has(RE.meeting, u)) return { kelas: 'P', alasan: 'Paket meeting / penginapan hotel (pengadaan, metode Dikecualikan)' };
            if (/^52411[49]$/.test(A) && has(RE.eo, u)) return { kelas: 'P', alasan: 'Komponen EO pada paket meeting' };
            return { kelas: 'NP', alasan: 'Perjalanan dinas' };
        }
        if (['521115', '521213', '521214'].includes(A)) return { kelas: 'NP', alasan: 'Honorarium' };
        if (has(RE.honor, u)) return { kelas: 'NP', alasan: 'Honor / insentif' };
        if (has(RE.uang, u)) return { kelas: 'NP', alasan: 'Uang saku / uang harian / transport' };
        if (has(RE.pungutan, u)) return { kelas: 'NP', alasan: 'Pajak / retribusi / tol' };
        // "Bantuan uang makan/seragam taruna" di poltek sering direalisasikan lewat kontrak katering/seragam
        if (has(RE.natura, u)) return { kelas: 'CEK', alasan: 'Bantuan natura taruna/peserta (makan/seragam) — pengadaan bila lewat kontrak katering/penyedia' };
        if (has(RE.bantuan, u)) return { kelas: 'NP', alasan: 'Bantuan / beasiswa / biaya pendidikan' };
        if (A === '522151') return { kelas: 'CEK', alasan: 'Jasa profesi selain honor — cek apakah dikontrakkan' };
        if (/^526/.test(A)) return { kelas: 'CEK', alasan: 'Belanja barang untuk diserahkan — pengadaan bila berupa barang' };
        if (/^5[678]/.test(A) || /^5[45]/.test(A)) return { kelas: 'CEK', alasan: 'Bansos/hibah/lainnya — pengadaan hanya bila berupa barang/jasa' };
        if (/^53/.test(A) && has(RE.pengelolaan, u)) return { kelas: 'CEK', alasan: 'Biaya pengelolaan kegiatan pada belanja modal (umumnya honor/perjalanan)' };
        if (/^5[23]/.test(A)) return { kelas: 'P', alasan: /^53/.test(A) ? 'Belanja modal' : 'Belanja barang/jasa' };
        return { kelas: 'CEK', alasan: 'Akun tidak dikenali' };
    }

    // Saran metode pemilihan (ambang Perpres 46/2025; bisa diubah di Pengaturan)
    function saranMetode(jenis, pagu, akun, uraian, cfg) {
        const t = cfg || { plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6 };
        // Paket meeting: hanya kamar/ruang rapat → Dikecualikan. Ada hiburan/MC/dekorasi → EO
        // (jasa lainnya: PL s.d. batas PL, di atasnya metode EO dari pengaturan; default Tender).
        if (/^52411[49]$/.test(akun || '')) return has(RE.eo, uraian) ? (pagu <= t.plBarjas ? 'Pengadaan Langsung' : (t.metodeEO || 'Tender')) : 'Dikecualikan';
        if (jenis === 'Jasa Konsultansi') return pagu <= t.plKonsultansi ? 'Pengadaan Langsung' : 'Seleksi';
        if (jenis === 'Pekerjaan Konstruksi') return pagu <= t.plKonstruksi ? 'Pengadaan Langsung' : 'Tender';
        return pagu <= t.plBarjas ? 'Pengadaan Langsung' : 'Tender';
    }

    return { item, jenisBelanja, saranJenis, saranMetode, RE };
})();

if (typeof module !== 'undefined') module.exports = Classify;
