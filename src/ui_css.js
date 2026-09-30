// ─────────────────────────────────────────────────────────────────── STYLE ──
const CSS = `
.sdr, .sdr *, .sdr *::before, .sdr *::after { box-sizing: border-box; }
.sdr { --b:#1F497D; --b2:#2E6DA4; --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --bg:#f8fafc; --ok:#15803d; --warn:#b45309; --bad:#b91c1c; --np:#7c3aed;
  font: 13px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--ink); }
.sdr-fab { position: fixed; right: 24px; bottom: 84px; z-index: 99990; display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 18px; border: 0; border-radius: 999px; cursor: pointer; font: 600 13.5px/1 "Segoe UI", system-ui, sans-serif; color: #fff;
  background: linear-gradient(135deg, #0f766e 0%, #0e9f8e 100%); box-shadow: 0 6px 18px rgba(15,118,110,.35); }
.sdr-fab:hover { transform: translateY(-2px); }
.sdr-ov { position: fixed; inset: 0; z-index: 99991; background: rgba(15,23,42,.55); display: flex; align-items: stretch; justify-content: center; padding: 18px; }
.sdr-win { background: #fff; border-radius: 12px; width: min(1480px, 100%); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.3); }
.sdr-hd { display: flex; align-items: center; gap: 12px; padding: 12px 18px; background: var(--b); color: #fff; }
.sdr-hd h2 { font-size: 16px; margin: 0; font-weight: 650; flex: 1; }
.sdr-hd .sdr-ctx { font-size: 12px; opacity: .9; }
.sdr-x { background: transparent; border: 0; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; }
.sdr-steps { display: flex; gap: 0; border-bottom: 1px solid var(--line); background: var(--bg); overflow-x: auto; }
.sdr-step { padding: 10px 16px; cursor: pointer; border: 0; background: transparent; font: inherit; color: var(--mut); border-bottom: 3px solid transparent; white-space: nowrap; }
.sdr-step.on { color: var(--b); border-bottom-color: var(--b); font-weight: 650; background: #fff; }
.sdr-step.done::after { content: " ✓"; color: var(--ok); }
.sdr-body { flex: 1; overflow: auto; padding: 16px 18px; }
.sdr-foot { border-top: 1px solid var(--line); padding: 8px 18px; max-height: 150px; overflow: auto; background: #0b1220; color: #cbd5e1; font: 12px/1.5 Consolas, monospace; }
.sdr-foot .e { color: #fca5a5; } .sdr-foot .o { color: #86efac; } .sdr-foot .w { color: #fcd34d; }
.sdr h3 { font-size: 14.5px; margin: 14px 0 8px; } .sdr h3:first-child { margin-top: 0; }
.sdr p.note { color: var(--mut); margin: 4px 0 10px; }
.sdr .card { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; background: #fff; }
.sdr .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
.sdr .kpi { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.sdr .kpi b { display: block; font-size: 16px; font-variant-numeric: tabular-nums; } .sdr .kpi span { color: var(--mut); font-size: 12px; }
.sdr .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 8px; border: 1px solid var(--line); background: #fff; cursor: pointer; font: inherit; color: var(--ink); }
.sdr .btn:hover { border-color: var(--b2); } .sdr .btn[disabled] { opacity: .5; cursor: not-allowed; }
.sdr .btn.pri { background: var(--b); color: #fff; border-color: var(--b); } .sdr .btn.go { background: var(--ok); color: #fff; border-color: var(--ok); }
.sdr .btn.danger { background: var(--bad); color: #fff; border-color: var(--bad); } .sdr .btn.sm { padding: 3px 8px; font-size: 12px; }
.sdr .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sdr .drop { border: 2px dashed #94a3b8; border-radius: 12px; padding: 22px; text-align: center; color: var(--mut); cursor: pointer; }
.sdr .drop.hover { border-color: var(--b2); background: #eff6ff; }
.sdr table.t { border-collapse: collapse; width: 100%; font-size: 12.5px; }
.sdr table.t th, .sdr table.t td { border-bottom: 1px solid var(--line); padding: 5px 7px; text-align: left; vertical-align: top; }
.sdr table.t th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; font-weight: 650; white-space: nowrap; }
.sdr table.t td.n, .sdr table.t th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sdr table.t tr.sub td { background: #fafafa; }
.sdr .tbl { max-height: 60vh; overflow: auto; border: 1px solid var(--line); border-radius: 8px; }
.sdr .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.sdr .p-ok { background: #dcfce7; color: var(--ok); } .sdr .p-warn { background: #fef3c7; color: var(--warn); } .sdr .p-bad { background: #fee2e2; color: var(--bad); }
.sdr .p-np { background: #ede9fe; color: var(--np); } .sdr .p-mut { background: #f1f5f9; color: var(--mut); } .sdr .p-info { background: #dbeafe; color: #1d4ed8; }
.sdr input[type=text], .sdr input[type=number], .sdr input[type=month], .sdr select, .sdr textarea { font: inherit; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: var(--ink); max-width: 100%; }
.sdr textarea { width: 100%; min-height: 54px; resize: vertical; font-size: 12px; }
.sdr .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sdr .muted { color: var(--mut); } .sdr .mono { font-family: Consolas, monospace; font-size: 12px; }
.sdr details > summary { cursor: pointer; }
.sdr .pk { border: 1px solid var(--line); border-radius: 10px; margin: 8px 0; }
.sdr .pk-hd { display: flex; gap: 8px; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 10px 10px 0 0; flex-wrap: wrap; }
.sdr .pk-bd { padding: 8px 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px 14px; }
.sdr .pk-bd label { display: block; font-size: 11.5px; color: var(--mut); margin-bottom: 2px; }
.sdr .pk-bd .wide { grid-column: 1 / -1; }
.sdr .bulk { position: sticky; top: -16px; z-index: 3; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; }
.sdr .lok { display: grid; grid-template-columns: 1fr 1fr 1.4fr auto; gap: 4px; margin-bottom: 4px; }
.sdr .warnbox { border-left: 4px solid var(--warn); background: #fffbeb; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
.sdr .errbox { border-left: 4px solid var(--bad); background: #fef2f2; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
.sdr .okbox { border-left: 4px solid var(--ok); background: #f0fdf4; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
.sdr-modal { position: fixed; inset: 0; z-index: 99995; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sdr-modal > div { background: #fff; border-radius: 12px; max-width: 900px; width: 100%; max-height: 85vh; overflow: auto; padding: 16px 18px; }
.sdr .prog { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin: 6px 0; } .sdr .prog > i { display: block; height: 100%; background: var(--b2); width: 0; transition: width .2s; }
`;
