// ─────────────────────────────────────────────────────────────────── STYLE ──
const CSS = `
.sdr, .sdr *, .sdr *::before, .sdr *::after { box-sizing: border-box; }
.sdr { --b:#1F497D; --b2:#2E6DA4; --b-soft:#eaf1fa; --ink:#0f172a; --ink2:#334155; --mut:#64748b; --line:#e2e8f0; --bg:#f4f6fa;
  --ok:#15803d; --ok-soft:#ecfdf3; --warn:#b45309; --warn-soft:#fffbeb; --bad:#b91c1c; --bad-soft:#fef2f2; --np:#7c3aed; --teal:#0f766e;
  font: 14px/1.55 "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--ink); }
.sdr-fab { position: fixed; right: 24px; bottom: 84px; z-index: 99990; display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 20px; border: 0; border-radius: 999px; cursor: pointer; font: 600 14px/1 "Segoe UI", system-ui, sans-serif; color: #fff;
  background: linear-gradient(135deg, #0f766e 0%, #0e9f8e 100%); box-shadow: 0 6px 18px rgba(15,118,110,.35); }
.sdr-fab:hover { transform: translateY(-2px); }

/* jendela */
.sdr-ov { position: fixed; inset: 0; z-index: 99991; background: rgba(15,23,42,.55); display: flex; justify-content: center; padding: 20px; }
.sdr-win { background: var(--bg); border-radius: 14px; width: min(1320px, 100%); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.3); }
.sdr-hd { display: flex; align-items: center; gap: 12px; padding: 14px 22px; background: var(--b); color: #fff; }
.sdr-hd h2 { font-size: 17px; margin: 0; font-weight: 650; }
.sdr-hd .sdr-ctx { flex: 1; font-size: 12.5px; opacity: .92; display: flex; gap: 6px; flex-wrap: wrap; }
.sdr-hd .sdr-ctx span { background: rgba(255,255,255,.14); padding: 3px 10px; border-radius: 999px; }
.sdr-hd .btn { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.3); }
.sdr-x { background: transparent; border: 0; color: #fff; font-size: 24px; cursor: pointer; line-height: 1; padding: 0 4px; }

/* stepper */
.sdr-steps { display: flex; gap: 4px; padding: 10px 18px; background: #fff; border-bottom: 1px solid var(--line); overflow-x: auto; }
.sdr-step { display: flex; align-items: center; gap: 8px; padding: 8px 14px; cursor: pointer; border: 0; background: transparent; font: inherit; color: var(--mut); border-radius: 10px; white-space: nowrap; }
.sdr-step .no { width: 24px; height: 24px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 12px; font-weight: 700; background: #e2e8f0; color: var(--ink2); }
.sdr-step.on { background: var(--b-soft); color: var(--b); font-weight: 650; }
.sdr-step.on .no { background: var(--b); color: #fff; }
.sdr-step.done .no { background: var(--ok); color: #fff; }
.sdr-body { flex: 1; overflow: auto; padding: 22px 26px 0; }

/* laci log */
.sdr-log { border-top: 1px solid #1e293b; background: #0b1220; color: #cbd5e1; font: 12.5px/1.55 Consolas, monospace; }
.sdr-log-bar { display: flex; align-items: center; gap: 10px; padding: 7px 18px; cursor: pointer; user-select: none; }
.sdr-log-bar b { color: #e2e8f0; font-family: "Segoe UI", system-ui, sans-serif; font-weight: 600; }
.sdr-log-bar .last { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; opacity: .85; }
.sdr-log-body { max-height: 0; overflow: auto; padding: 0 18px; transition: max-height .2s; }
.sdr-log.open .sdr-log-body { max-height: 240px; padding-bottom: 10px; }
.sdr-log .e { color: #fca5a5; } .sdr-log .o { color: #86efac; } .sdr-log .w { color: #fcd34d; }

/* tipografi & kartu */
.sdr h3 { font-size: 16px; margin: 0 0 6px; font-weight: 650; }
.sdr h4 { font-size: 13px; margin: 0 0 10px; font-weight: 700; color: var(--ink2); text-transform: uppercase; letter-spacing: .04em; }
.sdr p.note { color: var(--mut); margin: 0 0 14px; max-width: 900px; }
.sdr .card { border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px; margin-bottom: 18px; background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.sdr .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
.sdr .kpi { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: #fff; }
.sdr .kpi b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; margin-bottom: 2px; }
.sdr .kpi span { color: var(--mut); font-size: 12.5px; }
.sdr .kpi.link { cursor: pointer; } .sdr .kpi.link:hover { border-color: var(--b2); box-shadow: 0 2px 8px rgba(46,109,164,.12); }

/* tombol & input */
.sdr .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font: inherit; color: var(--ink); white-space: nowrap; }
.sdr .btn:hover { border-color: var(--b2); } .sdr .btn[disabled] { opacity: .5; cursor: not-allowed; }
.sdr .btn.pri { background: var(--b); color: #fff; border-color: var(--b); } .sdr .btn.go { background: var(--ok); color: #fff; border-color: var(--ok); font-weight: 600; }
.sdr .btn.danger { background: #fff; color: var(--bad); border-color: #fca5a5; } .sdr .btn.sm { padding: 5px 11px; font-size: 13px; border-radius: 8px; }
.sdr .btn.ghost { border-color: transparent; background: transparent; color: var(--b2); }
.sdr .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.sdr input[type=text], .sdr input[type=number], .sdr input[type=month], .sdr select, .sdr textarea { font: inherit; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: var(--ink); max-width: 100%; min-height: 38px; }
.sdr input:focus, .sdr select:focus, .sdr textarea:focus { outline: 2px solid #bfdbfe; border-color: var(--b2); }
.sdr textarea { width: 100%; min-height: 96px; resize: vertical; font-size: 13px; line-height: 1.5; }
.sdr input[type=checkbox] { width: 17px; height: 17px; accent-color: var(--b); cursor: pointer; }
.sdr .drop { border: 2px dashed #94a3b8; border-radius: 14px; padding: 32px; text-align: center; color: var(--mut); cursor: pointer; background: #fff; }
.sdr .drop.hover { border-color: var(--b2); background: #eff6ff; }

/* tabel */
.sdr table.t { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.sdr table.t th, .sdr table.t td { border-bottom: 1px solid var(--line); padding: 9px 12px; text-align: left; vertical-align: top; }
.sdr table.t th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; font-weight: 650; white-space: nowrap; color: var(--ink2); }
.sdr table.t tbody tr:hover td { background: #f8fafc; }
.sdr table.t td.n, .sdr table.t th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sdr table.t tr.sub td { background: #fafbfd; }
.sdr .tbl { max-height: 62vh; overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.sdr .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.sdr .p-ok { background: #dcfce7; color: var(--ok); } .sdr .p-warn { background: #fef3c7; color: var(--warn); } .sdr .p-bad { background: #fee2e2; color: var(--bad); }
.sdr .p-np { background: #ede9fe; color: var(--np); } .sdr .p-mut { background: #f1f5f9; color: var(--mut); } .sdr .p-info { background: #dbeafe; color: #1d4ed8; }
.sdr .muted { color: var(--mut); } .sdr .mono { font-family: Consolas, monospace; font-size: 13px; }
.sdr .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sdr details > summary { cursor: pointer; padding: 6px 0; font-weight: 600; color: var(--ink2); }
.sdr .warnbox, .sdr .errbox, .sdr .okbox, .sdr .infobox { padding: 12px 16px; border-radius: 10px; margin: 0 0 14px; }
.sdr .warnbox { border-left: 4px solid var(--warn); background: var(--warn-soft); }
.sdr .errbox { border-left: 4px solid var(--bad); background: var(--bad-soft); }
.sdr .okbox { border-left: 4px solid var(--ok); background: var(--ok-soft); }
.sdr .infobox { border-left: 4px solid var(--b2); background: var(--b-soft); }
.sdr .prog { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin: 8px 0; } .sdr .prog > i { display: block; height: 100%; background: var(--b2); width: 0; transition: width .2s; }

/* langkah 4: tab segmen, daftar baris, editor */
.sdr .seg { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; padding: 6px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
.sdr .seg button { border: 0; background: transparent; padding: 9px 14px; border-radius: 9px; font: inherit; color: var(--ink2); cursor: pointer; display: inline-flex; gap: 8px; align-items: center; }
.sdr .seg button .cnt { background: #e2e8f0; color: var(--ink2); border-radius: 999px; padding: 1px 8px; font-size: 12px; font-weight: 700; }
.sdr .seg button.on { background: var(--b); color: #fff; } .sdr .seg button.on .cnt { background: rgba(255,255,255,.25); color: #fff; }
.sdr .flow { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 6px 0 4px; }
.sdr .flow > div { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
.sdr .flow .no { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--b-soft); color: var(--b); font-weight: 700; margin-bottom: 6px; }
.sdr .list { display: flex; flex-direction: column; gap: 10px; }
.sdr .item { background: #fff; border: 1px solid var(--line); border-radius: 12px; }
.sdr .item.off { opacity: .72; border-style: dashed; }
.sdr .item.warn { border-color: #fcd34d; }
.sdr .item-hd { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: start; padding: 14px 16px; }
.sdr .item-title { font-weight: 600; line-height: 1.4; }
.sdr .item-sub { color: var(--mut); font-size: 12.5px; margin-top: 3px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sdr .item-side { text-align: right; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.sdr .item-side b { font-variant-numeric: tabular-nums; font-size: 15px; }
.sdr .notes { margin: 0 16px 12px 47px; padding: 10px 14px; background: var(--warn-soft); border-radius: 8px; font-size: 13px; color: #78350f; }
.sdr .notes div + div { margin-top: 3px; }
.sdr .sub-items { border-top: 1px solid var(--line); padding: 8px 16px 12px 47px; display: flex; flex-direction: column; gap: 8px; }
.sdr .sub-item { border: 1px solid var(--line); border-radius: 10px; background: #fcfdff; }
.sdr .sub-item .item-hd { padding: 10px 12px; }
.sdr .editor { border-top: 1px solid var(--line); padding: 18px 20px; background: #fbfcfe; border-radius: 0 0 12px 12px; display: flex; flex-direction: column; gap: 18px; }
.sdr .fs { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.sdr .formgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px 18px; }
.sdr .field label { display: block; font-size: 12.5px; color: var(--ink2); font-weight: 600; margin-bottom: 5px; }
.sdr .field .hint { font-size: 12px; color: var(--mut); margin-top: 4px; }
.sdr .range { display: flex; align-items: center; gap: 8px; } .sdr .range span { color: var(--mut); } .sdr .range input { flex: 1; min-width: 140px; }
.sdr .rangegrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px 18px; margin-bottom: 12px; }
.sdr .checks { display: flex; flex-wrap: wrap; gap: 8px 18px; } .sdr .checks label { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; cursor: pointer; }
.sdr .mak-t { width: 100%; border-collapse: collapse; } .sdr .mak-t th { font-size: 12px; color: var(--mut); text-align: left; padding: 0 8px 6px 0; font-weight: 600; }
.sdr .mak-t td { padding: 4px 8px 4px 0; vertical-align: middle; }
.sdr .lok { display: grid; grid-template-columns: 1fr 1fr 1.5fr auto; gap: 8px; margin-bottom: 8px; }
.sdr .bulk { background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 12px; padding: 16px 18px; margin-bottom: 16px; }
.sdr .bulk .formgrid { margin: 10px 0 12px; }
.sdr-body::after { content: ""; display: block; height: 22px; }
.sdr .actionbar { padding: 14px 26px; background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 14px rgba(15,23,42,.06); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.sdr .actionbar .sum { flex: 1; color: var(--ink2); font-size: 13.5px; }
.sdr .empty { text-align: center; color: var(--mut); padding: 34px; background: #fff; border: 1px dashed var(--line); border-radius: 12px; }

/* langkah 4 v1.3: proyeksi, kartu keputusan, perubahan, antrean */
.sdr .proj .kpi b { font-size: 21px; } .sdr .proj .kpi .ket { display: block; margin-top: 3px; font-size: 12px; color: var(--mut); }
.sdr .proj .kpi.ok { border-color: #86efac; background: var(--ok-soft); } .sdr .proj .kpi.ok b { color: var(--ok); }
.sdr .proj .kpi.warn { border-color: #fcd34d; background: var(--warn-soft); } .sdr .proj .kpi.warn b { color: var(--warn); }
.sdr .kartu { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin-bottom: 12px; }
.sdr .kartu.belum { border-color: #fcd34d; box-shadow: inset 4px 0 0 #f59e0b; }
.sdr .kartu-hd { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 8px; }
.sdr .opsi { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 8px; margin-top: 10px; }
.sdr .op { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; background: #fff; }
.sdr .op:hover { border-color: var(--b2); } .sdr .op.on { border-color: var(--b2); background: var(--b-soft); }
.sdr .op input { margin-top: 4px; accent-color: var(--b); } .sdr .op b { font-weight: 600; }
.sdr .op small { display: block; color: var(--mut); font-size: 12.5px; margin-top: 2px; line-height: 1.45; } .sdr .op small.dampak { color: var(--ink2); font-weight: 600; }
.sdr .sublabel { margin-top: 12px; font-size: 12.5px; font-weight: 700; color: var(--ink2); text-transform: uppercase; letter-spacing: .04em; }
.sdr .grp-hd { display: flex; gap: 10px; align-items: baseline; margin: 18px 0 8px; color: var(--ink2); font-weight: 600; }
.sdr .delta { font-size: 12.5px; font-variant-numeric: tabular-nums; } .sdr .delta.up { color: var(--ok); } .sdr .delta.down { color: var(--bad); }
.sdr .sumber { margin-top: 6px; font-size: 12.5px; color: var(--mut); }
.sdr .cek div { padding: 3px 0; } .sdr .cek .ok { color: var(--ok); } .sdr .cek .warn { color: var(--warn); } .sdr .cek .bad { color: var(--bad); font-weight: 600; }
.sdr details.bulk > summary { font-weight: 650; color: var(--ink); }
.sdr .cb2 { display: flex; flex-direction: column; gap: 6px; } .sdr .cb2 label { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--mut); cursor: pointer; }

.sdr-modal { position: fixed; inset: 0; z-index: 99995; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sdr-modal > div { background: #fff; border-radius: 14px; max-width: 940px; width: 100%; max-height: 86vh; overflow: auto; padding: 22px 24px; }
`;
