// Shadow-root stylesheet. Keep Roam/theme !important rules out of controls.
export const PANEL_CSS = String.raw`
:host { color-scheme:light; }
*, *::before, *::after { box-sizing:border-box; }
.rei-reader { width:100%; height:min(740px,calc(100dvh - 76px)); max-height:calc(100dvh - 76px); min-height:0; display:grid; grid-template-rows:auto auto auto auto minmax(0,1fr) auto; overflow:hidden; color:var(--mag-ink,#252735); background:var(--mag-paper,#fefcf6); border:1px solid var(--mag-border,#d8d2c3); border-radius:9px; box-shadow:0 8px 28px #0002; font:13px/1.5 var(--mag-body,system-ui,sans-serif); text-align:left; }
header { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:44px; padding:9px 12px; border-bottom:1px solid #ded9ca; }
header { cursor:move; touch-action:none; user-select:none; } header strong { font-size:14px; font-weight:650; } header button { flex:0 0 auto; cursor:pointer; touch-action:auto; }
button,input,select { font:inherit; color:inherit; letter-spacing:normal; text-transform:none; }
button { display:inline-flex; align-items:center; justify-content:center; position:static; min-height:28px; max-width:100%; margin:0; padding:4px 7px; border:1px solid #d8d3c4; border-radius:4px; background:#f5f2e9; line-height:1.35; cursor:pointer; white-space:normal; overflow-wrap:anywhere; }
button:hover { background:#ebe6d5; } button:disabled { opacity:.5; cursor:default; } button:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid var(--mag-gold,#b79a37); outline-offset:1px; }
.rei-reader-toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:6px; padding:8px 10px; }
select,input:not([type=checkbox]) { display:block; width:100%; min-width:0; max-width:100%; height:30px; margin:0; padding:4px 6px; border:1px solid #d8d3c4; border-radius:4px; background:var(--mag-paper,#fefcf6); }
select { appearance:none; -webkit-appearance:none; padding-right:30px; line-height:20px; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M3 5.5 8 10.5 13 5.5' fill='none' stroke='%236b6659' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; background-size:12px 12px; }
nav { display:flex; gap:3px; padding:0 10px 8px; border-bottom:1px solid #ded9ca; }
nav button { flex:1 1 auto; }
nav button { min-width:0; min-height:30px; padding:5px 2px; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
nav button[aria-selected=true] { background:#e9dfbc; border-color:#b49b4e; }
.rei-reader-status { display:block; min-height:0; max-height:62px; overflow:auto; padding:7px 12px; color:#726b59; font-size:11px; overflow-wrap:anywhere; }
.rei-reader-body { min-height:0; overflow:auto; overscroll-behavior:contain; padding:2px 12px 16px; }
.rei-scope-actions { display:flex; padding:9px 12px; border-top:1px solid #ded9ca; background:var(--mag-paper,#fefcf6); }.rei-scope-actions button { width:100%; }
.rei-reader-body>button,.rei-reader-body>input { margin:8px 0; }
.rei-reader-actions { display:flex; align-items:center; gap:5px; flex-wrap:wrap; padding:7px 0; }
.rei-reader-toggle,.rei-reader-scope { display:flex; align-items:flex-start; gap:7px; margin:8px 0; font-size:12px; font-weight:400; line-height:1.6; }
.rei-setting { display:block; margin:10px 0; }.rei-setting>span { display:block; margin-bottom:4px; }
input[type=checkbox] { flex:0 0 14px; width:14px; height:14px; margin:3px 0 0; accent-color:#9b843a; }
.rei-reader-links { grid-column:1/-1; display:flex; flex-wrap:wrap; gap:5px; }
.rei-chip { min-height:24px; padding:2px 9px; border-radius:999px; font-size:11.5px; background:transparent; }
.rei-chip:hover { background:#efe9d8; }
.rei-notes-entry { display:flex; gap:6px; align-items:center; margin:8px 0 10px; }
.rei-notes-entry .rei-primary { flex:1 1 auto; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rei-notes-day { border:1px solid #e4dccb; border-radius:8px; margin:6px 0; background:#fffdf7; }
.rei-notes-day>summary { cursor:pointer; padding:7px 10px; font-size:12.5px; font-weight:600; color:#3d3a33; }
.rei-notes-day[open]>summary { border-bottom:1px solid #eee6d4; }
.rei-note-draft { padding:7px 10px 2px; font-size:11px; letter-spacing:.04em; color:#8b773e; cursor:pointer; }
.rei-note-group { padding:4px 10px 2px; font-size:12px; font-weight:600; color:#5b5446; }
.rei-note-line { padding:3px 10px 3px calc(18px + var(--rd-depth, 0) * 12px); font-size:12.5px; line-height:1.55; color:#2f2c26; }
.rei-note-link { cursor:pointer; border-radius:5px; }
.rei-note-link:hover { background:#f4ecd4; }
.rei-shortcuts { margin:6px 0 8px; }
.rei-setting.rei-shortcut { display:flex; align-items:center; gap:6px; margin:4px 0; }
.rei-setting.rei-shortcut>span { flex:1 1 auto; margin:0; }
.rei-shortcut .rei-chip { min-width:64px; font-variant-numeric:tabular-nums; }
.rei-shortcut .rei-chip[data-recording] { background:#f4e7b8; }
.rei-last-read { display:flex; align-items:center; gap:10px; margin:10px 0 6px; padding:9px 10px; border:1px solid #e3dccb; border-left:3px solid var(--mag-gold,#b79a37); border-radius:6px; background:#fbf8ef; }
.rei-last-title { font-weight:600; overflow-wrap:anywhere; }
.rei-reader-chapter { display:grid; grid-template-columns:18px minmax(0,1fr) auto; column-gap:4px; align-items:start; padding:5px 4px 5px calc(4px + var(--rei-indent,0px)); border-bottom:1px solid #ece7db; border-radius:4px; }
.rei-catalog-toggle,.rei-catalog-slot { grid-column:1; width:18px; height:24px; min-height:24px; padding:0; margin:0; border:0; background:transparent; color:#8a826c; font-size:11px; line-height:24px; }
.rei-catalog-toggle:hover { background:#efe9d8; }
.rei-reader-chapter>.rei-reader-link { grid-column:2; min-height:24px; padding:2px 0; line-height:1.45; }
.rei-read-toggle { grid-column:3; width:20px; height:20px; min-height:20px; margin-top:2px; padding:0; border:1px solid #cfc7b2; border-radius:50%; background:transparent; color:#fff; font-size:11px; line-height:1; }
.rei-read-toggle:hover { border-color:var(--mag-gold,#b79a37); }
.rei-read-toggle[aria-pressed=true] { background:var(--mag-gold,#b79a37); border-color:var(--mag-gold,#b79a37); }
.rei-chapter-read>.rei-reader-link { color:#8f8875; }
.rei-row-meta { grid-column:2/-1; display:flex; flex-wrap:wrap; align-items:center; gap:2px 8px; color:#857648; font-size:11px; }
.rei-text-button { min-height:0; padding:0; border:0; background:transparent; color:#8b7a45; font-size:11px; text-decoration:underline; text-decoration-color:#d9cfb0; text-underline-offset:2px; }
.rei-text-button:hover { background:transparent; color:var(--mag-ink,#252735); }
.rei-annotation-text { white-space:pre-wrap; }
.rei-reader-chapter.rei-current-chapter { background:var(--mag-highlight,#f4e9bf); box-shadow:inset 3px 0 var(--mag-gold,#b79a37); border-radius:4px; }
.rei-current-chapter>.rei-reader-link { font-weight:650; color:var(--mag-ink,#252735); }
[hidden] { display:none !important; }
.rei-reader-link { display:block; width:100%; min-width:0; padding:3px 0; background:transparent; border:0; text-align:left; white-space:normal; overflow-wrap:anywhere; }
.rei-reader-annotation { display:flex; gap:8px; align-items:flex-start; padding:10px 0; border-bottom:1px solid #e6e1d5; }
.rei-grow { min-width:0; flex:1; }.rei-muted { color:#797366; font-size:11px; }.rei-error { color:#a82a2a; }.rei-primary { border-color:#b49b4e; background:#e9dfbc; }
.rei-reader-filters { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:6px 0; }.rei-reader-filters input { grid-column:1/-1; }
p { margin:8px 0; } h4 { font-size:13px; margin:14px 0 6px; } pre { font:11px/1.5 ui-monospace,monospace; white-space:pre-wrap; overflow-wrap:anywhere; max-height:260px; overflow:auto; background:#f1eee5; padding:8px; } summary { cursor:pointer; }
@media(max-width:480px) { .rei-reader { height:calc(100dvh - 72px); max-height:calc(100dvh - 72px); } }
`;
