/* Site Logistics. Items are stored in drawing coordinates (PDF points or image pixels, y down),
 * so they stay put when the drawing is panned or zoomed. Point symbols print at the plan's symbol size (Small 1/4 in,
 * Large 1/2 in) on the sheet at every scale, like line weights and hatches; only a crane's reach is to scale.
 * Started from the standalone "Logistics Sheet" (logistics-sheet (1).html). Changes from it:
 * - the export carries a full title block (project, address, drawing title, sheet, rev, drawn, checked, date, scale);
 * - the export is at a true, standard scale: the largest standard scale that fits the print outline, or one you pick,
 *   printed in the title block and on a scale bar; on screen, a shaded frame shows what a picked scale will print;
 * - the sheet border sits 1/4 in from the paper edge, so printing at actual size (100%) does not clip it;
 * - plans can be saved to and loaded from a .json file, so work is not only in this browser's storage. */
/* One instance of this app runs per top tab (plans.js lists them: Site Mobilization, Site Safety, Material Logistics
 * Plan). They are the same tool; a tab differs in CFG: its legend (which symbols, under which headings), its default
 * drawing title, and where it keeps its work, so each tab has its own drawing and markup. */
// Questions to the user are asked in a dialog of the tool's own, not with the browser's prompt() and confirm(): some
// places the file runs (an embedded browser pane, for one) do not allow those, and there the scale could not be set.
// csAsk resolves to the text typed, or null if cancelled; csConfirm to true or false.
function csDialog(message, value, secret) { // secret: the text typed is hidden (a password)
  // value: the field's starting text; or a list of [label, text], one field each (it resolves to their texts, in order)
  return new Promise((res) => {
    const input = value !== undefined, many = Array.isArray(value);
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const back = document.createElement('div');
    back.className = 'cs-dlg-back';
    back.innerHTML = `<div class="cs-dlg" role="dialog" aria-modal="true"><div class="cs-dlg-msg">${esc(message)}</div>` +
      (!input ? '' : many ? value.map(([label]) => `<label class="cs-dlg-f"><span>${esc(label)}</span><input class="cs-dlg-in" type="text" spellcheck="false" autocomplete="off"></label>`).join('')
        : `<input class="cs-dlg-in" type="${secret ? 'password' : 'text'}" spellcheck="false" autocomplete="off">`) +
      '<div class="cs-dlg-btns"><button type="button" class="cs-btn" data-x="cancel">Cancel</button><button type="button" class="cs-btn cs-primary" data-x="ok">OK</button></div></div>';
    const ins = [...back.querySelectorAll('.cs-dlg-in')], inp = ins[0], ok = back.querySelector('[data-x="ok"]'), before = document.activeElement;
    let closed = false;
    const done = (yes) => { if (closed) return; closed = true; window.removeEventListener('keydown', onKeys, true); back.remove(); if (before && before.focus) before.focus(); res(input ? (yes ? (many ? ins.map((i) => i.value) : inp.value) : null) : yes); };
    back.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) done(b.dataset.x === 'ok'); });
    // Every key goes to the dialog while it is open, wherever the focus is: caught on the window before anything else, so
    // a key pressed after clicking the dialog's text or the dimmed page never reaches the drawing behind it (Backspace
    // there deleted the selected label). Enter on a focused button is that button (Cancel cancels); otherwise Enter is OK.
    // Tab stays inside the dialog. (Both found by review, 2026-11-17.)
    function onKeys(e) {
      e.stopPropagation();
      const t = e.target, inDlg = t && t.closest && t.closest('.cs-dlg');
      if (e.key === 'Escape') { e.preventDefault(); done(false); return; }
      if (e.key === 'Enter') { e.preventDefault(); const b = inDlg && t.closest('[data-x]'); done(b ? b.dataset.x === 'ok' : true); return; }
      if (e.key === 'Tab') { // round the dialog's own fields and buttons
        const f = [...back.querySelectorAll('input, button')]; const i = f.indexOf(t);
        e.preventDefault(); f[(i < 0 ? 0 : i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); return;
      }
      if (!inDlg) { e.preventDefault(); (inp || ok).focus(); } // typing outside the dialog's field goes nowhere; the field gets the focus back
    }
    window.addEventListener('keydown', onKeys, true);
    ['pointerdown', 'pointerup', 'wheel', 'paste'].forEach((t) => back.addEventListener(t, (e) => e.stopPropagation()));
    document.body.appendChild(back);
    if (many) ins.forEach((el, i) => { el.value = value[i][1] == null ? '' : String(value[i][1]); });
    else if (inp) inp.value = value == null ? '' : String(value);
    if (inp) { inp.focus(); inp.select(); } else ok.focus();
  });
}
const csAsk = (message, value, secret) => csDialog(message, value == null ? '' : value, secret);
const csConfirm = (message) => csDialog(message);
// A window of information with a Close button (the keyboard shortcuts). html is the app's own, not outside text.
function csInfo(title, html) {
  return new Promise((res) => {
    const back = document.createElement('div');
    back.className = 'cs-dlg-back';
    back.innerHTML = `<div class="cs-dlg cs-info-dlg" role="dialog" aria-modal="true" aria-label="${title}"><div class="cs-pv-head"><b>${title}</b></div>` +
      `<div class="cs-info-body">${html}</div><div class="cs-dlg-btns"><button type="button" class="cs-btn cs-primary" data-x="ok">Close</button></div></div>`;
    const ok = back.querySelector('[data-x="ok"]'), before = document.activeElement;
    let closed = false;
    const done = () => { if (closed) return; closed = true; window.removeEventListener('keydown', onKeys, true); back.remove(); if (before && before.focus) before.focus(); res(); };
    back.addEventListener('click', (e) => { if (e.target.closest('[data-x]') || e.target === back) done(); });
    function onKeys(e) { e.stopPropagation(); if (e.key !== 'Tab') e.preventDefault(); if (e.key === 'Escape' || e.key === 'Enter' || e.key === '?') done(); }
    window.addEventListener('keydown', onKeys, true);
    ['pointerdown', 'pointerup', 'wheel', 'paste'].forEach((t) => back.addEventListener(t, (e) => e.stopPropagation()));
    document.body.appendChild(back);
    ok.focus();
  });
}
// Export and Print show the sheet first, exactly as it will be saved, with what is on it, and save only on Save (user,
// 2026-11-19: "clicking export/print should trigger a preview pane so we know what is visible as on screen, but as a
// safety measure to avoid too many copies"). o: { url (the picture), title, sub, lines, ok (the Save button's words) }.
// Keys as in csDialog: Enter saves, Esc cancels, and no key reaches the drawing behind it.
function csPreview(o) {
  return new Promise((res) => {
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const back = document.createElement('div');
    back.className = 'cs-dlg-back';
    back.innerHTML = '<div class="cs-dlg cs-pv" role="dialog" aria-modal="true" aria-label="Preview before saving">' +
      `<div class="cs-pv-head"><b>${esc(o.title)}</b><span>${esc(o.sub || '')}</span></div>` +
      `<div class="cs-pv-img"><img alt="The sheet as it will be saved" src="${o.url}"></div>` +
      (o.lines || []).map((l) => `<div class="cs-pv-line">${esc(l)}</div>`).join('') +
      `<div class="cs-dlg-btns"><button type="button" class="cs-btn" data-x="cancel">Cancel</button><button type="button" class="cs-btn cs-primary" data-x="ok">${esc(o.ok)}</button></div></div>`;
    const ok = back.querySelector('[data-x="ok"]'), before = document.activeElement;
    let closed = false;
    const done = (yes) => { if (closed) return; closed = true; window.removeEventListener('keydown', onKeys, true); back.remove(); if (before && before.focus) before.focus(); res(yes); };
    back.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) done(b.dataset.x === 'ok'); });
    function onKeys(e) {
      e.stopPropagation();
      const t = e.target;
      if (e.key === 'Escape') { e.preventDefault(); done(false); return; }
      if (e.key === 'Enter') { e.preventDefault(); const b = t && t.closest && t.closest('[data-x]'); done(b ? b.dataset.x === 'ok' : true); return; }
      if (e.key === 'Tab') { const f = [...back.querySelectorAll('button')], i = f.indexOf(t); e.preventDefault(); f[(i < 0 ? 0 : i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); return; }
      e.preventDefault(); // nothing else: no key reaches the drawing behind
    }
    window.addEventListener('keydown', onKeys, true);
    ['pointerdown', 'pointerup', 'wheel', 'paste'].forEach((t) => back.addEventListener(t, (e) => e.stopPropagation()));
    document.body.appendChild(back);
    ok.focus();
  });
}

// The drawing open, kept with this browser: reopened next time on the same page, with the same drawing scale and each
// page turned the same way (those belong to the drawing; other windows of the tool follow them too). Every layer is
// markup on that one drawing. The drawing itself is kept in IndexedDB under 'shared'; its page, scales and turns in
// localStorage (from when each tab was a view of its own, which is why it is called shared).
const csShared = { rec: null, page: 1, scales: {}, rots: {}, loaded: null }; // rots: per drawing, the quarter turns each page is shown at
// Snap on or off: one setting for every tab, kept in this browser.
// The crane notes beside the cursor, on or off: one setting for every tab.
const csNotes = { off: (() => { try { return localStorage.getItem('siteLogistics.craneNotesOff') === '1'; } catch (e) { return false; } })() };
const csSnap = { off: (() => { try { return localStorage.getItem('siteLogistics.snapOff') === '1'; } catch (e) { return false; } })() };
function csSharedSave(which) { // which: 'scale' or 'rot', what this window just changed for the open drawing; else the page
  try {
    // Another window may have stored scales and turns since this one read them: as stored, except the one thing this
    // window just changed (a page change wrote back a stale scale over another window's calibration: review, 2026-11-17)
    let disk = {};
    try { disk = JSON.parse(localStorage.getItem('siteLogistics.shared') || '{}') || {}; } catch (e) { disk = {}; }
    const key = csShared.rec ? csShared.rec.key : null;
    const merge = (theirs, mine, mineWins) => {
      const o = Object.assign({}, theirs && typeof theirs === 'object' ? theirs : {});
      if (key && mine[key] && (mineWins || !o[key])) o[key] = mine[key]; else if (key && mineWins && !mine[key]) delete o[key];
      const ks = Object.keys(o); while (ks.length > 40) delete o[ks.splice(ks.findIndex((k) => k !== key), 1)[0]]; // 40 drawings
      return o;
    };
    csShared.scales = merge(disk.scales, csShared.scales, which === 'scale'); csShared.rots = merge(disk.rots, csShared.rots, which === 'rot');
    localStorage.setItem('siteLogistics.shared', JSON.stringify({ key, page: csShared.page, scales: csShared.scales, rots: csShared.rots }));
  }
  catch (e) { /* not kept: the tabs still share it until the page is closed */ }
}
// Another window stored scales or turns: take them, so this window shows each page the same way and never writes back
// an older value (the drawing and page are taken when a tab is next shown). Registered before any tab's listener.
function csSharedRead(raw) {
  try {
    const j = JSON.parse(raw || '{}') || {};
    if (j.scales && typeof j.scales === 'object') csShared.scales = j.scales;
    if (j.rots && typeof j.rots === 'object') csShared.rots = j.rots;
  } catch (err) { /* left as it was */ }
}
window.addEventListener('storage', (e) => { if (e.key === 'siteLogistics.shared') csSharedRead(e.newValue); });
// Text labels' lettering (user, 2026-11-17: "the architectural bold one", then picked this one from a specimen sheet):
// Flux Architect Bold by orange modern (2004; its own copyright field reads "FREEWARE", dafont lists it 100% Free, and
// its embedding flag allows embedding; note in the licences block), embedded in this file so it looks the same on every
// computer, on screen, in the image and PDF exports and in print. All capitals (lowercase is drawn as capitals); the
// characters it lacks (< > [ ] _ ° ± × ½ Ø and a few more) fall back to Arial. Only the Bold file is embedded, declared
// weight 700, so labels (always bold) use it as drawn, not emboldened. An SVG drawn as a picture cannot see this
// page's fonts, so `css` is put inside every exported picture that uses it. When the face has loaded, `cs-font` tells
// every tab to measure and draw its labels again.
const LABEL_FAMILY = "'Flux Architect', Arial, Helvetica, sans-serif";
const csLabelFont = (() => {
  const el = document.getElementById('font-label'), b64 = el ? el.textContent.replace(/\s+/g, '') : '';
  const f = { ready: false, css: b64 ? `@font-face{font-family:'Flux Architect';font-weight:700;src:url(data:font/ttf;base64,${b64}) format('truetype');}` : '' };
  if (b64 && window.FontFace && document.fonts) {
    try {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const face = new FontFace('Flux Architect', u.buffer, { weight: '700' });
      document.fonts.add(face);
      face.load().then(() => { f.ready = true; window.dispatchEvent(new Event('cs-font')); }, () => { /* labels fall back to Arial */ });
    } catch (e) { /* labels fall back to Arial */ }
  }
  return f;
})();

function createSitePlan(CFG) {
  'use strict';

  const ALL_SECTIONS = window.__CS_SYMBOLS || [];
  const SYM = {}; // every symbol in the libraries, so an item always draws
  ALL_SECTIONS.forEach((s) => s.items.forEach((i) => (SYM[i.id] = i)));
  // The layers (plans.js), each with its legend: `sections` is [{ title, ids }] picking from the libraries; without it,
  // every symbol (less `omit`). The notes layer lists the Text and Dimension tools instead of library symbols.
  const sectionsOf = (c) => (c.sections
    ? c.sections.map((s) => ({ title: s.title, items: s.ids.map((id) => SYM[id]).filter(Boolean) })).filter((s) => s.items.length)
    : ALL_SECTIONS.filter((s) => !s.only && !(c.omit || []).includes(s.title))); // `only`: a section that belongs to one layer's legend; `omit`: sections moved to another layer
  const NOTE_ROWS = [ // the notes layer's "symbols": the Text, Dimension, Box, Circle and Cloud tools, drawn as legend rows
    { id: '_text', label: 'Text label', vb: '0 0 60 20', inner: '<text x="30" y="15" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="14" fill="#111">Aa</text>' },
    { id: '_dim', label: 'Dimension', vb: '0 0 60 20', inner: '<path d="M6 14H54M6 9V18M54 9V18" fill="none" stroke="#111" stroke-width="1.5"/><text x="30" y="10" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="8" fill="#111">5.0 m</text>' },
    // the shapes (user, 2026-11-19): outlines in the text colours, on this layer; they speak for themselves on the sheet
    { id: '_box', label: 'Box', vb: '0 0 60 20', inner: '<rect x="8" y="3" width="44" height="14" fill="none" stroke="#111" stroke-width="1.8"/>' },
    { id: '_ellipse', label: 'Circle', vb: '0 0 60 20', inner: '<ellipse cx="30" cy="10" rx="21" ry="7.5" fill="none" stroke="#111" stroke-width="1.8"/>' },
    { id: '_cloud', label: 'Cloud', vb: '0 0 60 20', inner: '<path d="M10 4a4 4 0 0 1 8 0a4 4 0 0 1 8 0a4 4 0 0 1 8 0a4 4 0 0 1 8 0a4 4 0 0 1 8 0a3 3 0 0 1 0 6a3 3 0 0 1 0 6a4 4 0 0 1 -8 0a4 4 0 0 1 -8 0a4 4 0 0 1 -8 0a4 4 0 0 1 -8 0a4 4 0 0 1 -8 0a3 3 0 0 1 0 -6a3 3 0 0 1 0 -6Z" fill="none" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>' },
  ];
  const LAYERS = (CFG.layers || [{ id: CFG.id, label: CFG.label, sheetTitle: CFG.sheetTitle, sections: CFG.sections, omit: CFG.omit }])
    .map((c) => ({ id: c.id, label: c.label, notes: !!c.notes, sections: c.notes ? [{ title: c.label.toUpperCase(), items: NOTE_ROWS }] : sectionsOf(c) }));
  const LAYER = {}; LAYERS.forEach((l) => (LAYER[l.id] = l));
  const NOTES = (LAYERS.find((l) => l.notes) || LAYERS[LAYERS.length - 1]).id; // where text labels, dimensions and shapes go
  const NOTE_IDS = NOTE_ROWS.map((r) => r.id);
  const SECTIONS = LAYERS.filter((l) => !l.notes).flatMap((l) => l.sections); // every symbol any layer lists
  // the layer a symbol belongs to when an item does not say (markup from before the layers, a plan file from a tab)
  const homeLayer = (sym) => {
    if (NOTE_IDS.includes(sym)) return NOTES;
    const s = ZONE_SYM[sym] || sym, l = LAYERS.find((x) => !x.notes && x.sections.some((sec) => sec.items.some((i) => i.id === s)));
    return (l || LAYERS[0]).id;
  };

  const KEY = CFG.storeKey;
  const FILL_OPACITY = 0.65; // solid area fills let the drawing show through
  const COL = { cyan: '#00fdff', magenta: '#ff41fe', blue: '#0b33ff', green: '#00f900', gray: '#cccccc', red: '#ff2500', yellow: '#fffb00', black: '#000' };

  // How each non-point legend entry is drawn (colours and patterns taken from the legend PDF).
  const STYLE = {
    traffic:      { kind: 'line', color: COL.black, width: 3, arrow: true, halo: '#fff' },
    'equip-path': { kind: 'line', color: COL.black, width: 3, arrow: true, mark: 'E', markColor: COL.black, halo: '#fff' },
    'heavy-path': { kind: 'line', color: COL.green, width: 3, arrow: true, halo: '#000' },
    'fire-lane':  { kind: 'line', color: COL.red, width: 3, arrow: true, mark: 'F', markColor: COL.red, halo: '#fff' },
    barricade:    { kind: 'line', width: 9, stripes: true }, // orange/white striped barricade, drawn as a line
    fence10:      { kind: 'line', color: COL.yellow, width: 3, ticks: true, halo: '#000' },
    fence6:       { kind: 'line', color: '#66ccff', width: 3, ticks: true, halo: '#000' },
    laydown:      { kind: 'area', fill: COL.cyan },
    trailers:     { kind: 'area', stroke: COL.magenta, hatch: 'diag', hatchColor: COL.magenta },
    'ppe-free':   { kind: 'area', fill: COL.blue },
    'crane-pads': { kind: 'area', fill: COL.green },
    'restroom-area': { kind: 'area', fill: COL.gray },
    'bldg-outline':  { kind: 'area', stroke: '#000', strokeWidth: 2, dash: '8 5' },
    'ped-path':   { kind: 'area', fill: COL.magenta, feet: '#fff' },
    'muster-zone': { kind: 'area', fill: COL.green, fillOpacity: 0.28, stroke: COL.green, strokeWidth: 2.2, dash: '9 5' }, // drawn from a muster point; not a legend row
    loading:      { kind: 'area', fill: COL.yellow },
    'swing-stage': { kind: 'area', stroke: COL.cyan, strokeWidth: 2, hatch: 'hlines', hatchColor: COL.yellow },
    hoist:        { kind: 'area', fill: COL.green, stroke: COL.green, hatch: 'cross', hatchColor: COL.blue },
    washout:      { kind: 'area', fill: COL.red, hatch: 'hlines', hatchColor: '#000' },
    'contractor-parking': { kind: 'area', stroke: COL.magenta, hatch: 'grid', hatchColor: COL.magenta },
    security:     { kind: 'area', stroke: COL.blue, strokeWidth: 2, hatch: 'S', hatchColor: COL.green },
    // Site Safety legend (symbols_safety.js): the two entries that are lines, in the colours of that legend
    // and the two areas added to it. All in this tab's colours (COL), like the pictures (tools/build_safety.py).
    'ss-fence':      { kind: 'line', color: COL.red, width: 3, halo: '#fff' },
    'ss-excavation': { kind: 'line', color: COL.blue, width: 3, halo: '#fff', dash: '9 6' },
    // Site Mobilization additions (symbols_more.js)
    'slick-line':       { kind: 'line', color: '#808080', width: 4, ticks: true, halo: '#000' },                 // the concrete pump's pipe run, with its joints
    'forklift-staging': { kind: 'area', stroke: '#f7941d', strokeWidth: 2, hatch: 'cross', hatchColor: '#f7941d' },
    // Wayfinding tab
    'wf-route':         { kind: 'line', color: COL.blue, width: 3, arrow: true, dash: '9 6', halo: '#fff' },
    // the notes layer's dimension line (its text label, '_text', is a point and has no style)
    _dim:               { kind: 'line', dim: true, color: '#111', width: 1.5, halo: '#fff' },
    'ss-walk-lights':  { kind: 'line', color: '#808080', width: 2, tracks: true }, // Covered Walkway w/ Temp Lights, as the Elevate toolbox draws it
    'ss-covered-walk': { kind: 'area', fill: COL.gray },                 // like the Laydown Area, in grey
    'ss-crosswalk':    { kind: 'area', fill: '#66ccff', feet: '#fff' },  // like the Pedestrian path, in the 6' fencing's light blue
    // the notes layer's shapes (user, 2026-11-19: "annotating shapes, basic ones like rectangles, circles and clouds, in the
    // same colours as text, that stay in the notes layer"): an outline in the item's colour (it.color, one of the text
    // colours; none: black), drawn by two opposite corners. Box and Circle are always a box of 4 corners (the circle is
    // the ellipse inside it); a Cloud is any polygon, by two corners (Rect) or corner by corner (Polygon).
    _box:     { kind: 'area', shape: 'box', note: true },
    _ellipse: { kind: 'area', shape: 'ellipse', note: true },
    _cloud:   { kind: 'area', shape: 'cloud', note: true },
    // Site Mobilization: a site trailer (user, 2026-11-19), a black rectangle at its real size: placed by a click at the
    // size last typed (40' x 10' to start), then sized by typing its length, width (metric or imperial) and angle.
    // it.dims = { l, w } in metres (ft: typed in feet), so it keeps its real size if the drawing scale is changed.
    'site-trailer': { kind: 'area', fill: '#000', fillOpacity: 1, stroke: '#000', strokeWidth: 1, trailer: true },
  };
  // A symbol with a region: select the placed symbol and "Draw ... area" draws it, as an area item of its own
  // (`<symbol>-zone`). The muster point has one; so does every symbol that names a `zone` colour (the Material
  // Logistics legend), drawn like the muster area but a little stronger. Zones are not legend rows.
  const ZONE_OF = { muster: 'muster-zone' }, ZONE_NAME = { 'muster-zone': 'Muster area' }, ZONE_SYM = { 'muster-zone': 'muster' };
  Object.keys(SYM).forEach((id) => {
    const c = SYM[id].zone;
    if (!c) return;
    STYLE[id + '-zone'] = { kind: 'area', fill: c, fillOpacity: 0.4, stroke: c, strokeWidth: 2.2, dash: '9 5' };
    ZONE_OF[id] = id + '-zone'; ZONE_NAME[id + '-zone'] = SYM[id].label.replace(/\s+area$/i, '') + ' area'; ZONE_SYM[id + '-zone'] = id; // 'Wash Area' gives 'Wash area'
  });
  const NOTE_NAMES = { _text: 'Text label', _dim: 'Dimension', _box: 'Box', _ellipse: 'Circle', _cloud: 'Cloud' }; // the notes layer's items
  const itemName = (sym) => ZONE_NAME[sym] || NOTE_NAMES[sym] || (SYM[sym] || {}).label || sym;
  const POINT_H = { 'ss-gate': 24, 'ss-dep': 26, dumpster: 28, barricade: 12, drum: 14, tubular: 14, cone: 10, sign: 10, workarea: 20, attenuator: 20, flashlight: 24, signal: 32, fab: 24, 'fab-caution': 24, dms: 30, 'truck-w': 22, 'truck-s': 22, 'truck-s1': 22, 'truck-s2': 22, 'truck-b': 22, 'truck-p': 22, 'truck-e': 22, 'truck-c': 22 }; // everything else is 36: design height in 1/100 in (see below)
  // Symbol size, one setting per plan: Small or Large. A symbol prints at a fixed size on the 11 x 17 sheet, whatever
  // the drawing scale or the sheet scale: a standard symbol (design height 36) is 1/4 in tall at Small and 1/2 in at
  // Large, and the rest keep their proportion to it (POINT_H), but none goes below SYM_MIN, so the little ones (a cone)
  // still read. The third number is a standard symbol's height in sheet units (1/100 in).
  const SYM_SIZES = [['S', 'Small: 1/4 in on the sheet', 25], ['L', 'Large: 1/2 in on the sheet', 50]];
  const DEFAULT_SYM_SIZE = 'S', SYM_MIN = 20;
  const DEFAULT_CRANE_RADIUS_M = 30;
  const CRANES = new Set(['crane', 'mobile-crane', 'ss-crane', 'placing-boom']); // tower and mobile cranes: reach circle or swing pie
  // How the reach is drawn: dashed black on a yellow tint, except the Site Safety crane, a plain red circle as on that plan.
  const CRANE_RING = { 'ss-crane': `fill="none" stroke="${COL.red}" stroke-width="2"` };
  const craneRing = (sym) => CRANE_RING[sym] || 'fill="rgba(255,251,0,.14)" stroke="#000" stroke-width="1.3" stroke-dasharray="9 5"';
  const isCrane = (sym) => CRANES.has(sym);
  const PT_M = 0.0254 / 72;     // metres in one PDF point, i.e. one page unit of a PDF printed at full size
  const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches; // touch screen: bigger targets, tap wording
  const HIT = COARSE ? 26 : 14;  // width of the invisible line you grab
  const HR = COARSE ? 1.6 : 1;   // handle size
  const SHEET = { w: 1700, h: 1100, k: 2 }; // export: 17 x 11 in, laid out in 1/100 in units, written at 200 dpi
  const UNIT_M = 0.0254 / 100;              // metres in one sheet unit (1/100 in) on the printed sheet
  // Sheet layout, in sheet units: a 1/4 in margin, the map window, the legend column on its right, the title block below.
  const LAY = (() => {
    const m = 25, tb = 110, lg = 300;
    const F = { x: m, y: m, w: SHEET.w - 2 * m, h: SHEET.h - 2 * m };
    const map = { x: F.x, y: F.y, w: F.w - lg, h: F.h - tb };
    return { F, map, leg: { x: map.x + map.w, y: F.y, w: lg, h: map.h }, tb: { x: F.x, y: map.y + map.h, w: F.w, h: tb } };
  })();
  const MAP_IN = { w: LAY.map.w - 2, h: LAY.map.h - 2 }; // the drawing's window inside the 2-unit frame line
  // Auto picks the largest of these that shows everything in view. The fixed list adds the engineering-inch scales.
  const STD_SCALES = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];
  const FIXED_SCALES = [100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500].map((n) => [n, '1:' + n.toLocaleString()])
    .concat([[120, 10], [240, 20], [360, 30], [480, 40], [600, 50], [1200, 100]].map(([n, ft]) => [n, `1" = ${ft}' (1:${n.toLocaleString()})`]))
    .concat([[48, '1/4" = 1\'-0" (1:48)'], [96, '1/8" = 1\'-0" (1:96)']]); // the two symbol-size scales, so a sheet can print them at full size
  // The Drawing panel shows titles and controls only; what each does is in its tooltip (hover a title or a control).
  const TIPS = {
    ovl: 'Lay up to four other pages (floors, levels) over this one, each with its own markup, to see how they line up. On screen only: the export prints this page alone.',
    cal: 'How big the drawing really is. The sheet scale, the scale bar, the legend scale and crane reach in metres all need it.',
    calBtn: 'Pick two points a known distance apart, then type the distance (metres, or add ft).',
    ratio: 'For a PDF drawn at full size, e.g. 1:200; 1/8" = 1\'-0" is 1:96.',
    sheet: 'The export prints at this scale, shown in the title block and on the scale bar. It prints what is inside the dashed outline (the sheet\'s shape); outside it is shaded. ' +
      'Zoomed out as far as it goes, the outline fills the window: that is the whole sheet. Scroll to zoom in for a closer look and back out to it; zooming does not change the scale. ' +
      'Drag at the whole sheet to move what prints. On Auto, Fit picks the largest standard scale that shows the whole page, and Selected the one for a rectangle you drag.',
    sym: 'How tall symbols print on the sheet, at every scale. Lines, areas and crane reach are not affected.',
    saving: 'Markup saves automatically in this browser, separately for each drawing (by file name and size), and the last drawing reopens next time. ' +
      'Clearing the browser\'s data loses it, so save a plan file to keep or hand over the work.',
    crane: 'What to keep in mind when placing a crane or boom. Reminders from public sources, in plain words: they do not judge where a crane stands, and the rules themselves govern. ' +
      'The list follows the site address (Project panel). Shows while a crane or boom is being placed or moved.',
  };
  const scaleName = (n) => { const f = FIXED_SCALES.find((s) => s[0] === n && /"/.test(s[1])); return f ? f[1] : '1:' + n.toLocaleString(); };

  // ---------- saved state ----------
  // localStorage: one plan per drawing (keyed by file name and size); IndexedDB: the last drawing itself, so it reopens.
  const store = (() => {
    try {
      // the first time with layers, the settings kept with the first tab (names for the title block, export choices)
      const own = localStorage.getItem(KEY), first = CFG.legacy && Object.values(CFG.legacy)[0];
      const j = JSON.parse(own || (first && localStorage.getItem(first)) || '{}');
      return { plans: own ? j.plans || {} : {}, last: own ? j.last || null : null, by: j.by || '', checked: j.checked || '', fmt: j.fmt || 'png', scope: j.scope || 'all', pkind: j.pkind === 'image' ? 'image' : 'pdf', checksOpen: !!j.checksOpen, open: (own && j.open) || {} }; // open: which layers' lists are dropped down
    }
    catch (e) { return { plans: {}, last: null, by: '', checked: '', open: {} }; }
  })();
  let saveWarned = false;
  // Two windows of the tool share this browser's storage (every copy opened from disk does, in Chrome and Edge). Each
  // save therefore reads what is stored first and writes back only this window's open drawing (PLAN) and its settings,
  // keeping every other drawing as stored, so an older window cannot put back stale plans over another's work (found by
  // review, 2026-11-17: a pan in an older window wiped the other window's work).
  const diskStore = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } };
  function syncPlans() { // this window's list of drawings brought up to date with what is stored, its open one kept
    const disk = diskStore(), plans = Object.assign({}, disk.plans || {});
    if (PLAN && D.key && store.plans[D.key] === PLAN) plans[D.key] = PLAN;
    store.plans = plans;
  }
  function save() {
    // another window changed this drawing during an export here: nothing is written until the export ends and that
    // version is taken (else the export's own page restore wrote this window's older copy over it: review, 2026-11-17)
    if (R.exporting && R.syncPending) return;
    try {
      syncPlans(); prunePlans();
      localStorage.setItem(KEY, JSON.stringify(store));
    }
    catch (e) { if (!saveWarned) { saveWarned = true; toast('This browser will not save the plan (storage full or blocked). Export to keep your work.', 'err'); } }
  }
  // The work in a plan, leaving out how each window happens to be looking at it (its view and page, when last used):
  // windows differ in those, and taking them from each other set two windows saving back and forth for ever
  // Pages are compared by their scales only: a page looked at but never scaled holds { mpu: null }, which one window
  // has and another not (review, 2026-11-17: that set each edit wiping the editing window's undo)
  const scaledOf = (pages) => Object.keys(pages || {}).filter((k) => pages[k] && pages[k].mpu > 0).sort().reduce((o, k) => ((o[k] = pages[k].mpu), o), {});
  const workOf = (p) => JSON.stringify(Object.assign({}, p, { views: null, page: null, used: null, pages: scaledOf(p.pages) }));
  // Another window saved: take its drawings; if it changed the work on the one open here, show its version (the last
  // change wins), in this window's own view and turned to this window's page
  function takeStored() {
    R.syncPending = false;
    const disk = diskStore(), theirs = D.key && disk.plans && disk.plans[D.key];
    const mine = PLAN && D.key && store.plans[D.key] === PLAN ? PLAN : null;
    store.plans = Object.assign({}, disk.plans || {});
    if (!mine) return;
    store.plans[D.key] = mine;
    if (!theirs || workOf(theirs) === workOf(mine)) { takeShared(); return; } // a turn or scale set there during an export
    // Only a change to the markup clears this window's undo (an undo step is the markup) and says so; a title block,
    // scale or turn taken from there is taken quietly. Nothing done here in consequence saves: a window writes only
    // what its own user changed, so two windows never echo each other (review, 2026-11-17).
    const markup = JSON.stringify(theirs.items) !== JSON.stringify(mine.items);
    const views = mine.views, page = mine.page;
    Object.keys(mine).forEach((k) => delete mine[k]); Object.assign(mine, JSON.parse(JSON.stringify(theirs)), { views, page }); // same object: the views keep it
    if (markup) {
      R.undo = []; R.sel = null; R.draft = null; R.drag = null; R.snap = null;
      toast('This drawing was changed in another window of the tool: showing that version.');
    }
    if (!takeShared() && D.ready && !offPlan()) alignHere(); // turned there: turned here too; a hidden tab is turned when shown
    updateSide(); fillInfo(); updateUi(); renderChecks(); dirty();
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { if (R.exporting) R.syncPending = true; else takeStored(); return; }
    if (e.key === 'siteLogistics.shared') { if (R.exporting) R.syncPending = true; else takeShared(); }
  });
  // Another window turned a page or set a scale of the drawing open here (the shared values were already read by the
  // listener at the top): the same here. A hidden tab catches up when it is next shown. True when the page is redrawn.
  function takeShared() {
    if (!D.ready || offPlan() || !PLAN || !csShared.rec || csShared.rec.key !== D.key) return false;
    try { csSharedRead(localStorage.getItem('siteLogistics.shared')); } catch (e) { /* as last read */ } // a plan event comes before the shared one
    const sc = csShared.scales[D.key];
    if (sc && JSON.stringify(scaledOf(sc)) !== JSON.stringify(scaledOf(PLAN.pages))) { takeSharedScale(true); updateSide(); dirty(); } // kept with the plan at its next save
    if (sharedRot(D.page) === D.rot) return false;
    showPage(D.page, true); return true;
  }
  function newPlan(name) {
    return {
      name, items: [], pages: {}, fade: 0, page: 1, sheetScale: 'auto', symSize: DEFAULT_SYM_SIZE, used: Date.now(),
      info: { project: '', address: '', title: CFG.sheetTitle, sheet: '', rev: '', by: store.by || '', checked: store.checked || '', date: today() },
      layers: {}, // per layer, what differs from shown at full strength: { off: 1 } hidden, { op: 0.5 } its opacity
    };
  }
  // Work from before the layers: each tab kept its own plan per drawing (CFG.legacy names where), and the Overlay tab
  // its text labels and dimensions. A drawing opened for the first time since gets one plan made of all of them, each
  // item marked with its layer; the title block, scales and settings are the first tab's that had the drawing. Each
  // tab turned its own items when it was shown, so items can face different ways on a turned page: those are marked
  // with the way they face (_r) and brought round when the page is next shown (alignPage). The old plans stay stored.
  function legacyPlan(name, key) {
    if (!CFG.legacy) return null;
    const read = (k) => { try { const j = JSON.parse(localStorage.getItem(k) || '{}'); return j && j.plans && j.plans[key]; } catch (e) { return null; } };
    const found = Object.keys(CFG.legacy).filter((id) => LAYER[id]).map((id) => ({ id, p: read(CFG.legacy[id]) })).filter((x) => x.p && Array.isArray(x.p.items));
    if (!found.length) return null;
    const base = (found.find((x) => x.id !== NOTES) || found[0]).p;
    const plan = Object.assign(newPlan(name), JSON.parse(JSON.stringify(base)), { items: [], layers: {}, views: {} });
    delete plan.infoOwn;
    if (base === (found.find((x) => x.id === NOTES) || {}).p) plan.info.title = CFG.sheetTitle; // only Overlay notes: its title was the Overlay's
    const facing = (p, pg) => ((p.rot && +p.rot[pg]) || 0) & 3, ids = new Set();
    found.forEach(({ id, p }) => p.items.forEach((it) => {
      if (!it || !Array.isArray(it.pts)) return;
      const c = JSON.parse(JSON.stringify(it));
      c.layer = id;
      if (ids.has(c.id)) c.id = uid(); ids.add(c.id);
      if (facing(p, c.pg) !== facing(plan, c.pg)) c._r = facing(p, c.pg);
      plan.items.push(c);
    }));
    return plan;
  }
  function prunePlans() { // keep the 40 most recently used drawings
    const keys = Object.keys(store.plans).sort((a, b) => (store.plans[b].used || 0) - (store.plans[a].used || 0));
    keys.slice(40).forEach((k) => delete store.plans[k]);
  }

  const D = { // the open drawing
    kind: null, name: '', key: null, ready: false, pdf: null, pages: 1, page: 1, pageObj: null, w: 0, h: 0, set: null,
    rot: 0, w0: 0, h0: 0, src: null, // the page's quarter turns to the right, its size before turning, a lone image as it was opened
    img: null, url: null, base: null, rb: 1, detail: null, baseTask: null, detailTask: null, docGen: 0, pageGen: 0, closing: null,
  };
  let PLAN = null;
  const V = { z: 1, cx: 0, cy: 0, w: 0, h: 0 }; // screen px per drawing unit, drawing point at the window centre, window size
  let CV = V; // the view the drawing functions use; export swaps in the sheet's view
  const R = {
    mode: 'pan', tool: null, shape: 'poly', sel: null, draft: null, cursor: null, undo: [], raf: 0, pushT: new WeakMap(), // pushT: when each draft point was clicked
    ptrs: new Map(), drag: null, pinch: null, lastTap: null, lastVTap: null, needFit: false, exporting: false, detailTimer: 0,
  };

  const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Characters an SVG picture cannot hold: control characters, U+FFFE/FFFF and half of an emoji. One in a name used to
  // make the whole export fail ("URI malformed" / "could not draw the markup").
  // No lookbehind (older iPad Safari would refuse the whole script): a matched emoji PAIR is put back, anything else dropped.
  const BAD_CHARS = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF\uD800-\uDFFF]/g;
  const stripBad = (s) => String(s).replace(BAD_CHARS, (m) => (m.length === 2 ? m : ''));
  // Outside text (a file, the saved list, typing) as one clean line, cut to n CHARACTERS (never inside an emoji).
  // The tool is English-only (user, 2026-11-17): typed text keeps English letters, digits, punctuation and the drafting
  // symbols below; an accented letter loses its accent (Café -> Cafe); anything else (other scripts, emoji) is dropped.
  // drafting and measurement symbols are not "another language": kept, or written in plain ASCII so the meaning stays
  const EN_EXTRA = '°±×÷²³½¼¾⅛⅜⅝⅞⅓⅔–—‘’“”•·µ⌀Øø§€£©®™';
  const EN_MAP = { '′': "'", '″': '"', '−': '-', '‐': '-', '‑': '-', '‒': '-', '≤': '<=', '≥': '>=', '→': '->', '←': '<-', '⁄': '/', '…': '...' };
  const EN_SPELL = { 'ß': 'ss', 'ẞ': 'SS', 'Ł': 'L', 'ł': 'l', 'Æ': 'AE', 'æ': 'ae', 'Œ': 'OE', 'œ': 'oe', 'Đ': 'D', 'đ': 'd', 'Ð': 'D', 'ð': 'd', 'Þ': 'Th', 'þ': 'th', 'ı': 'i' }; // letters with no accent to take off
  const englishOnly = (s) => Array.from(String(s == null ? '' : s)).map((c) => {
    if ((c >= ' ' && c <= '~') || c === '\t' || c === '\n' || EN_EXTRA.includes(c)) return c;
    if (EN_MAP[c]) return EN_MAP[c];
    if (EN_SPELL[c]) return EN_SPELL[c];
    const b = c.normalize('NFKD').replace(/\p{M}/gu, ''); // accents off; ligatures such as "ﬁ" spelt out
    return /^[ -~]+$/.test(b) ? b : '';
  }).join('');
  const cleanText = (s, n) => Array.from(englishOnly(stripBad(s == null ? '' : s)).replace(/\s+/g, ' ').trim()).slice(0, n).join('');
  let MCTX = null;
  const textW = (t, size, family) => { // the drawn width of bold text, measured, not guessed (capitals and CJK run wide)
    if (!MCTX) MCTX = document.createElement('canvas').getContext('2d');
    MCTX.font = `700 ${size}px ${family || 'Arial, Helvetica, sans-serif'}`;
    return MCTX.measureText(String(t)).width;
  };
  const fmt = (n) => n.toFixed(1);
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // ---------- layers ----------
  // Every item belongs to a layer (it.layer; older ones to their symbol's). A hidden layer is neither drawn, nor
  // selected, snapped to, cleared or exported; a layer's opacity applies on screen and on the sheet alike.
  const layerOf = (it) => (it.layer && LAYER[it.layer] ? it.layer : homeLayer(it.sym));
  const layerSet = (id) => (PLAN && PLAN.layers && PLAN.layers[id]) || {};
  const layerOn = (id) => !layerSet(id).off;
  const layerOp = (id) => { const o = +layerSet(id).op; return o > 0 && o < 1 ? o : 1; };
  // A locked layer shows and exports as usual, but its items cannot be selected, moved, edited, deleted or cleared, and
  // nothing new goes on it (user, 2026-11-19: "can you give a lock layer toggle as well?"). Page turns still turn them.
  const layerLocked = (id) => !!layerSet(id).lock;
  // this page's items on the layers that show (everything drawn, snapped to, cleared or exported goes through here)
  const items = () => (PLAN && D.ready ? PLAN.items.filter((i) => i.pg === D.page && layerOn(layerOf(i))) : []);
  function layerMarkup(exp) { // the shown layers' items on this page, in layer order (the last on top), each at its opacity
    const its = items(); let out = '';
    for (const l of LAYERS) {
      const s = its.filter((it) => layerOf(it) === l.id).map((it) => drawItem(it, exp)).join('');
      const op = layerOp(l.id), lock = layerLocked(l.id) && !exp; // locked: drawn, but clicks go through (styles.css)
      if (s) out += op < 1 || lock ? `<g${lock ? ' class="cs-locked"' : ''}${op < 1 ? ` opacity="${op}"` : ''}>${s}</g>` : s;
    }
    return out;
  }
  const find = (id) => (PLAN ? PLAN.items.find((i) => i.id === id) : null);
  function pageCfg() { // the drawing scale, per page
    if (!PLAN) return {};
    const k = String(D.page);
    return PLAN.pages[k] || (PLAN.pages[k] = { mpu: null });
  }
  // ---------- turning a page ----------
  // A page can be shown turned by quarter turns (Rotate, in the Drawing panel), so a plan drawn sideways can be worked
  // on and printed the right way up. The turn belongs to the drawing (csShared.rots, kept with the drawing across
  // windows). Markup is stored in the coordinates of the page as it is shown, so when a page is turned the markup on it,
  // on every layer, is turned with it: the plan notes which way its items for a page currently face (plan.rot), and is
  // brought round to the page's turn the next time that page is shown or exported.
  const sharedRot = (n) => { const m = csShared.rots[D.key]; return ((m && +m[String(n)]) || 0) & 3; };
  const pdfVp = (page, scale) => page.getViewport({ scale, rotation: (page.rotate + 90 * D.rot) % 360 });
  function alignPage(plan, n, target, w0, h0) { // true if anything moved
    const k = String(n), cur = ((plan.rot && +plan.rot[k]) || 0) & 3, steps = (target - cur + 4) % 4;
    // items that came facing their own way (merged from the tabs, or a tab's plan file: _r) are first brought round to
    // the way the plan's items face
    let moved = false;
    plan.items.filter((it) => it.pg === n && it._r != null).forEach((it) => {
      const r = (+it._r || 0) & 3; delete it._r;
      if (r !== cur) { turnItems([it], r, (cur - r + 4) % 4, w0, h0); moved = true; }
    });
    if (!steps) return moved;
    turnItems(plan.items.filter((it) => it.pg === n), cur, steps, w0, h0);
    if (!plan.rot) plan.rot = {};
    if (target) plan.rot[k] = target; else delete plan.rot[k];
    if (plan.views) delete plan.views[k]; // the view it was left in no longer fits: show it whole
    return true;
  }
  function turnItems(list, from, steps, w0, h0) { // items of one page facing `from` quarter turns, turned `steps` more to the right
    let c = from;
    for (let s = 0; s < steps; s++, c = (c + 1) % 4) {
      const h = c % 2 ? w0 : h0; // the page's height as it faces now; one turn to the right sends (x, y) to (h - y, x)
      for (const it of list) {
        it.pts = it.pts.map((p) => [h - p[1], p[0]]);
        if (Number.isFinite(it.a0)) it.a0 = (it.a0 + 90) % 360; // a crane's swing turns with the page
        // a turned text label turns with the page too (it runs along something drawn), a quarter turn right being -90 to
        // its anticlockwise angle, then read the right way up (kept within -90..90, still along the same line); a level
        // label stays level, to read across the sheet
        if (it.sym === '_text' && it.rot) {
          let r = labelRot({ rot: it.rot - 90 });
          if (r > 90) r -= 180; else if (r < -90) r += 180;
          if (r) it.rot = r; else delete it.rot;
        }
      }
    }
  }
  function alignHere() { // this page's markup round to the way the page is shown
    if (!D.w0 || !D.h0) return;
    if (PLAN && alignPage(PLAN, D.page, D.rot, D.w0, D.h0)) { R.undo = []; save(); } // an undo would bring back points from before the turn
  }
  function turned(img, r) { // the image a number of quarter turns to the right, as a canvas
    const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas');
    cv.width = r % 2 ? h : w; cv.height = r % 2 ? w : h;
    const g = cv.getContext('2d');
    if (!g || !cv.width) throw new Error('too large');
    g.translate(r === 1 ? h : r === 2 ? w : 0, r === 1 ? 0 : r === 2 ? h : w);
    g.rotate((r * Math.PI) / 2);
    g.drawImage(img, 0, 0);
    return cv;
  }
  function dropImg() { if (D.img) { D.img.remove(); if (D.img.tagName === 'CANVAS') D.img.width = D.img.height = 0; D.img = null; } }
  function putImage(img, show) { // an image page: turned if the page is, then on screen
    D.w0 = img.naturalWidth; D.h0 = img.naturalHeight;
    let el = img;
    if (D.rot) {
      try { el = turned(img, D.rot); }
      catch (e) { D.rot = 0; if (show) toast('This image is too large to turn; it is shown as it is.', 'err'); }
    }
    dropImg();
    D.img = el; D.w = D.rot % 2 ? D.h0 : D.w0; D.h = D.rot % 2 ? D.w0 : D.h0;
    if (show) R.page.insertBefore(el, R.fade);
  }
  function rotatePage(dir) { // a quarter turn left (-1) or right (1), for every tab: the toolbar, the Drawing panel or the keys
    if (!D.ready || R.exporting || R.batch) return;
    R.zwin = null; // a zoom window's corners were picked on the page as it faced before
    const m = csShared.rots[D.key] || (csShared.rots[D.key] = {}), k = String(D.page), r = (sharedRot(D.page) + dir + 4) % 4;
    if (r) m[k] = r; else delete m[k];
    const keys = Object.keys(csShared.rots); if (keys.length > 40) delete csShared.rots[keys.find((x) => x !== D.key)];
    csSharedSave('rot');
    showPage(D.page, true).then(() => renderLegend());
  }
  const mpu = () => (PLAN && pageCfg().mpu) || null; // metres per drawing unit, once the scale is set
  const symSize = () => (PLAN && SYM_SIZES.find((x) => x[0] === PLAN.symSize)) || SYM_SIZES[0];
  // A point symbol's height in px of the view being drawn (CV). Its height on the sheet is fixed (sheet units); here
  // it is shown at the size it will have against the drawing on that sheet: sheet height x this view's zoom / the
  // sheet's zoom (R.frz, kept up to date by whatever is drawing). On the export the two zooms are the same.
  function symHeight(sym) {
    const hd = (Math.max(SYM_MIN, POINT_H[sym] || 36) * symSize()[2]) / 36;
    return R.frz ? (hd * CV.z) / R.frz : hd;
  }

  // What the export prints: sheet units per drawing unit (z), centred on the view, and the scale N for 1:N.
  // The print area is the largest sheet-shaped rectangle that fits in the window (printFrame), outlined on screen with
  // the rest shaded: the window is seldom the sheet's shape, and fitting the whole window to the sheet printed the
  // drawing smaller than it was set up (user, 2026-11-18: "why are the page shrunk"). Without a drawing scale that
  // rectangle fills the sheet, not to scale (N null). With one, Auto rounds its scale up to the next standard scale
  // (so all of the rectangle still prints; the outline then shows the slightly larger area), or a fixed scale is used.
  function printFrame() { // that rectangle's size on screen, px, in the part of the window below the toolbar
    const r = MAP_IN.w / MAP_IN.h, w = Math.min(V.w, (V.h - tbInset()) * r);
    return { w, h: w / r };
  }
  // The toolbar floats over the top of the map window. The print outline is fitted into the part below it, and the
  // view's centre (V.cx, V.cy) sits in the middle of that part (midY), so everything that prints is in sight, not under
  // the toolbar (user, 2026-11-19: "when the scale is set, make it look like what the export will look like"). Measured
  // when the window changes size or a drawing opens, not as buttons come and go, so the outline does not jump about.
  function tbInset() {
    if (R.tbInset == null && D.ready && R.root && R.map) {
      R.root.classList.add('cs-has-doc'); // the toolbar shows with a drawing (render sets this too)
      const tb = R.root.querySelector('.cs-tb');
      if (tb && tb.offsetParent) {
        const a = tb.getBoundingClientRect(), b = R.map.getBoundingClientRect();
        // on the drawing at all (beyond the 2 px border a neighbouring panel shares with it)
        const over = a.right > b.left + 4 && a.left < b.right - 4 && a.bottom > b.top + 4 && a.top < b.bottom - 4;
        R.tbInset = over ? Math.max(0, Math.min(V.h * 0.4, a.bottom - b.top + 6)) : 0;
      }
    }
    return R.tbInset || 0;
  }
  const midY = (v) => v.h / 2 + (v === V ? tbInset() / 2 : 0); // where the view's centre is on screen; the export's is its middle
  // (The toolbar now has a row of its own above the drawing window (layoutSheet), so the inset is 0 there; it stays
  // in case a layout puts the toolbar over the drawing again.)

  // ---------- the drawing window's shape ----------
  // The drawing window has the shape of the printed sheet's drawing area (MAP_IN) on any screen, so the print outline
  // fills it edge to edge, as the export fills its window. The page-setup column takes any spare width, and the row
  // above the sheet (the toolbar's) any spare height (user, 2026-11-19: "no matter what screen type I open the app on,
  // the page that will export should be in a locked 11x17 ratio. The tab bar and page setup column can stretch as much
  // as needed"). The size goes to the grid as --mw and --mh; styles.css arranges the panels for desktop, a phone
  // upright (the panel below) and a phone on its side (the panel beside).
  function layoutSheet() {
    const g = R.grid, tb = R.tbEl;
    if (!g || !tb) return;
    const W = g.clientWidth, H = g.clientHeight, r = MAP_IN.w / MAP_IN.h, B = 4; // B: the map's 2 px border, both sides
    if (!W || !H) return;
    const side = window.matchMedia && matchMedia('(max-height: 520px) and (min-width: 560px)').matches; // phone on its side
    const upright = !side && window.matchMedia && matchMedia('(max-width: 820px)').matches;
    // The toolbar keeps the height it has with every button that comes and goes showing (Finish, the crane's, the
    // text style, All pages...): those wrapped it onto another row and back, which resized the drawing window and
    // moved the drawing under the cursor just as a tool was picked (found by a test, 2026-11-19).
    tb.style.minHeight = '';
    tb.classList.add('cs-tb-measure');
    const full = tb.offsetHeight;
    tb.classList.remove('cs-tb-measure');
    if (tb.style.minHeight !== full + 'px') tb.style.minHeight = full + 'px';
    const th = full + 6; // the toolbar and the gap under it
    let ch;
    if (upright) { // the full width; the panel below keeps at least 160 px
      const tabs = (R.root.querySelector('.cs-tabs') || {}).offsetHeight || 0;
      ch = Math.min((W - B) / r, H - th - tabs - 160 - B);
    } else if (side) ch = Math.min(H - B, (W - 290 - B) / r); // the full height; the toolbar and panel beside keep at least 290 px
    else ch = Math.min(H - th - 112 - B, (W - 250 - 300 - B) / r); // page setup at least 250, the legend 300, the title block 112
    ch = Math.max(60, Math.floor(ch));
    const cw = Math.floor(ch * r); // never wider than the shape, so the outline fills the width and the height to within 1 px
    const mw = cw + B + 'px', mh = ch + B + 'px';
    if (g.style.getPropertyValue('--mw') !== mw) g.style.setProperty('--mw', mw);
    if (g.style.getPropertyValue('--mh') !== mh) g.style.setProperty('--mh', mh);
  }
  function sheetFrame() {
    const pf = printFrame(), vw = pf.w / V.z, vh = pf.h / V.z, zFit = vw && vh ? Math.min(MAP_IN.w / vw, MAP_IN.h / vh) : 1;
    const m = mpu(), fixed = PLAN && PLAN.sheetScale !== 'auto' ? +PLAN.sheetScale : 0;
    if (!m) return { z: zFit, cx: V.cx, cy: V.cy, N: null, auto: !fixed };
    const c = (zoomLocked() && R.home) || V; // zoomed in: the print area stays where the whole sheet was (zoomAt)
    let N = fixed;
    if (!N && R.autoN && zoomLocked()) N = R.autoN; // Auto's scale, held while zooming in (holdScale): a closer look, not a bigger print
    if (!N) {
      const nFit = m / (zFit * UNIT_M);
      N = STD_SCALES.find((s) => s >= nFit * (1 - 1e-6)) || Math.ceil(nFit / 5000) * 5000;
    }
    return { z: m / (N * UNIT_M), cx: c.cx, cy: c.cy, N, auto: !fixed };
  }

  // ---------- drawing <-> screen ----------
  function toScreen(x, y) { return [(x - CV.cx) * CV.z + CV.w / 2, (y - CV.cy) * CV.z + midY(CV)]; }
  function toMap(px, py) { return [(px - V.w / 2) / V.z + V.cx, (py - midY(V)) / V.z + V.cy]; }
  function withView(view, fn) { const prev = CV; CV = view; try { return fn(); } finally { CV = prev; } }
  const fitZ = () => { const pf = printFrame(); return Math.min(pf.w / D.w, pf.h / D.h) * 0.94; }; // the page whole inside the print outline
  function clampZ(z) { const f = fitZ(); return Math.max(f * 0.25, Math.min(z, Math.max(f * 64, D.kind === 'img' ? 16 : 40))); }
  function fitView() {
    if (!D.ready) return;
    if (!V.w || !V.h) { R.needFit = true; return; }
    R.autoN = null; R.snapSheet = true; R.home = null; // Auto picks its scale afresh for the whole page, shown as the whole sheet
    V.z = fitZ(); V.cx = D.w / 2; V.cy = D.h / 2; snapToPrint(); dirty();
  }
  // Each page keeps the view it was left in (its centre, and how much of the drawing the window showed across), per
  // tab: flipping back to a page shows it as it was left, and "all pages" exports print each page that way. A page
  // never visited shows, and prints, whole.
  function keepView() {
    if (!D.ready || !PLAN || R.batch || R.needFit || !V.w || !V.z) return;
    // the print outline's width in drawing units (marked 'pf'; older views hold the window's), with the turn it was seen at:
    // a window of another shape then shows, and prints, the same area
    // and Auto's scale while it is held (zoomed in, it is not the one the zoom would pick)
    const h = zoomLocked() && R.home; // and, zoomed in, where the print area is
    (PLAN.views || (PLAN.views = {}))[String(D.page)] = [V.cx, V.cy, printFrame().w / V.z, D.rot || 0, 'pf', (zoomLocked() && R.autoN) || 0, h ? h.cx : null, h ? h.cy : null];
  }
  function restoreView() {
    const v = PLAN && PLAN.views && PLAN.views[String(D.page)];
    if (!v || !(v[2] > 0) || !V.w || !V.h || (v.length > 3 && v[3] !== (D.rot || 0))) { fitView(); return; } // a view from before a turn: the page whole
    V.z = clampZ((v[4] === 'pf' ? printFrame().w : V.w) / v[2]); V.cx = v[0]; V.cy = v[1];
    R.autoN = v[5] > 0 ? v[5] : null; R.autoFor = mpu(); // the page's Auto scale as it was left (none: taken from the view)
    R.home = v[6] != null && v[7] != null ? { cx: v[6], cy: v[7] } : null; // and its print area, if it was left zoomed in
    dirty();
  }
  // Zoom window (the Selected button): the rectangle between screen points a and b fills the print outline, so it is
  // what prints (Auto then rounds the scale up, so all of it does). The mode ends with it; the tool in use carries on.
  function zoomWindow(p, q) { // p, q: the corners, in drawing units
    const rw = Math.abs(q[0] - p[0]), rh = Math.abs(q[1] - p[1]), pf = printFrame();
    R.zwin = null;
    if (rw > 0 && rh > 0) {
      V.cx = (p[0] + q[0]) / 2; V.cy = (p[1] + q[1]) / 2;
      R.autoN = null; R.snapSheet = true; R.home = null; // Auto: the scale for the rectangle, shown as the whole sheet
      const fr = sheetFrame(), fixed = fr.N && !fr.auto;
      if (fixed) { // a fixed sheet scale decides what prints: show all of that, centred on the rectangle
        V.z = clampZ(Math.min(pf.w / (MAP_IN.w / fr.z), pf.h / (MAP_IN.h / fr.z)));
        toast(`Sheet scale is fixed at ${scaleName(fr.N)}: the outline shows what prints. Set Sheet scale to Auto to print the area you picked.`);
      } else { V.z = clampZ(Math.min(pf.w / rw, pf.h / rh) * 0.97); snapToPrint(); }
    }
    updateUi(); dirty();
  }
  // Auto rounds the scale up to a standard one, so the sheet holds more than the outline did: after Fit or Selected the
  // view is set to exactly what prints, so what the screen shows is the sheet (a wheel zoom keeps the outline instead).
  function snapToPrint() {
    const fr = sheetFrame();
    if (fr.N && fr.auto) V.z = clampZ(printFrame().w * fr.z / MAP_IN.w);
  }
  function drawZoomWin() {
    const z = R.zwin;
    if (!z || !z.a || !z.b) return '';
    const A = toScreen(...z.a), B = toScreen(...z.b);
    const x = Math.min(A[0], B[0]), y = Math.min(A[1], B[1]), w = Math.abs(B[0] - A[0]), h = Math.abs(B[1] - A[1]);
    return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="#1a73e8" fill-opacity=".08" stroke="#1a73e8" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  }
  function zoomAt(px, py, f) {
    const m = toMap(px, py), floor = zoomFloor(), z = clampZ(V.z * f);
    if (floor && z <= floor * 1.0001) { atSheet(); if (f < 1) lockedNote(); return; } // no further out than the whole sheet, as it was
    if (floor && !R.home) R.home = { cx: V.cx, cy: V.cy }; // going in from the whole sheet: the print area stays there
    V.z = z; V.cx = m[0] - (px - V.w / 2) / V.z; V.cy = m[1] - (py - midY(V)) / V.z; dirty();
  }
  function atSheet(quiet) { // the whole sheet again: the floor zoom, centred where the print area is (quiet: from render)
    V.z = zoomFloor() || V.z;
    if (R.home) { V.cx = R.home.cx; V.cy = R.home.cy; R.home = null; }
    if (!quiet) dirty();
  }
  // With a drawing scale set, the whole sheet at the print scale is as far out as the view goes: there the dashed
  // outline fills the window (printFrame) and is what prints (user, 2026-11-19: "the dashed rectangle stays locked to
  // the template size"). Scrolling or pinching zooms in from there for a closer look, and back out to it, no further
  // (user, 2026-11-19: "zoom in closer and then back to full scale sheet ... not further away"). Zooming does not change
  // the print scale: Auto's is picked once (R.autoN) and held, until Fit or Selected (which pick the largest standard
  // scale that shows the page or the rectangle), the Sheet scale list or a new drawing scale pick it again, and the view
  // is then the whole sheet. Zoomed in, the sheet prints the outline's area round the centre of the view, as ever.
  // Calibrate lets go while its two points are picked and puts the view back after (setMode). Without a drawing
  // scale, zoom is free as before.
  const zoomLocked = () => !!mpu() && R.mode !== 'cal';
  function zoomFloor() { // the zoom at which the outline fills the window: the furthest out (0: no floor)
    if (!D.ready || !zoomLocked() || !V.w || !V.h) return 0;
    const z = (printFrame().w * sheetFrame().z) / MAP_IN.w;
    // the same ceiling as a free zoom, for a fixed scale far larger than the drawing's: the outline is then bigger than
    // the window even at the floor, and says so
    return Number.isFinite(z) && z > 0 ? Math.min(z, Math.max(fitZ() * 64, D.kind === 'img' ? 16 : 40)) : 0;
  }
  function holdScale() { // Auto's scale picked once and held; the view no further out than the whole sheet
    if (!D.ready || !zoomLocked() || !V.w || !V.h) return;
    const m = mpu();
    if (R.autoFor !== m) { R.autoFor = m; R.autoN = null; } // a new drawing scale: Auto picks again
    let snap = R.snapSheet; R.snapSheet = false;
    if (snap) R.home = null; // a scale or area just picked: the print area is the view's
    const fr = sheetFrame();
    if (fr.auto && !R.autoN) { R.autoN = fr.N; snap = true; R.home = null; } // just picked: shown as the whole sheet
    if (!fr.auto) R.autoN = null;
    const floor = zoomFloor();
    if (!floor) return;
    if (snap || (R.home && V.z <= floor * 1.0001)) atSheet(true); // render goes on with it: no frame asked for (or it would loop)
    else if (V.z < floor) V.z = floor;
  }
  function lockedNote() { // once a session: zooming out stops here
    if (R.lockTold) return;
    R.lockTold = true;
    const fr = sheetFrame();
    toast(`This is the whole sheet at the print scale (${scaleName(fr.N)}): zooming out stops here, and the dashed outline is what prints. Zoom in for a closer look; the sheet prints the same.${fr.auto ? ' Fit or Selected pick another scale.' : ''}`);
  }

  // ---------- polyline helpers (screen space) ----------
  const pathD = (P, close) => 'M' + P.map((p) => fmt(p[0]) + ' ' + fmt(p[1])).join('L') + (close ? 'Z' : '');
  function lengths(P) { const L = []; let t = 0; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(d); t += d; } return { L, total: t }; }
  function pointAt(P, L, dist) {
    for (let i = 0; i < L.length; i++) {
      if (dist <= L[i] || i === L.length - 1) {
        const t = L[i] ? Math.min(1, dist / L[i]) : 0, a = P[i], b = P[i + 1];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
      }
      dist -= L[i];
    }
    return [P[0][0], P[0][1], 0];
  }
  const rectPts = (a, c) => [[a[0], a[1]], [c[0], a[1]], [c[0], c[1]], [a[0], c[1]]];

  // ---------- markup drawing (SVG, screen px) ----------
  // A dimension's line sits `off` away from the two points it measures (to the left of a -> b when off is positive),
  // as in CAD: the points stay on the drawing and the line is pulled clear of it. Returns the line's two ends.
  function dimEnds(P, off) {
    const a = P[0], b = P[P.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, o = off || 0;
    return [[a[0] + nx * o, a[1] + ny * o], [b[0] + nx * o, b[1] + ny * o]];
  }
  function dimOff(pts, m) { // the offset that puts the dimension line through m (same units as the points)
    const a = pts[0], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return l ? ((m[0] - a[0]) * -(b[1] - a[1]) + (m[1] - a[1]) * (b[0] - a[0])) / l : 0;
  }
  function drawLine(id, st, P, sel, preview, exp, off) {
    if (P.length < 2 || P.some((p) => isNaN(p[0]))) return '';
    const d = st.dim ? pathD(dimEnds(P, off)) : pathD(P); // a dimension is grabbed and ringed on its own line
    const { L, total } = lengths(P);
    let s = '';
    if (!preview && !exp) s += `<path class="cs-hit cs-hit-l" data-id="${id}" d="${d}" fill="none" stroke="transparent" stroke-width="${HIT}"/>`;
    if (st.stripes) { // barricade: black outline, white bar, orange diagonal stripes clipped to the bar
      const mid = `cs-bm-${CFG.id}-${id}`, w = st.width; let b = '';
      for (let dist = 4; dist < total; dist += 14) {
        const [x, y, a] = pointAt(P, L, Math.min(dist, total)), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, r = w;
        b += `<path d="M${fmt(x - nx * r - ux * r)} ${fmt(y - ny * r - uy * r)}L${fmt(x + nx * r + ux * r)} ${fmt(y + ny * r + uy * r)}" stroke="#f7941d" stroke-width="4.2"/>`;
      }
      s += `<defs><mask id="${mid}" maskUnits="userSpaceOnUse" x="-50000" y="-50000" width="100000" height="100000"><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}"/></mask></defs>`;
      s += `<path d="${d}" fill="none" stroke="#000" stroke-width="${w + 2.4}" stroke-linejoin="miter"/>`;
      s += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linejoin="miter"/>`;
      s += `<g mask="url(#${mid})">${b}</g>`;
      if (sel) s += `<path class="cs-selring" d="${d}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>`;
      return s;
    }
    if (st.dim) { // a dimension: the line between its two ends, an end tick each, and the real length written along it
      const p0 = P[0], p1 = P[P.length - 1], [a, b] = dimEnds(P, off), o = off || 0, away = Math.abs(o) > 0.5;
      const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), ux = Math.cos(ang), uy = Math.sin(ang);
      // on the measured line: a square tick at each end. Pulled clear of it: an oblique tick, and an extension line
      // from each measured point (starting a little off it) to just past the dimension line.
      const nx = away ? (ux - uy) * 4.5 : -uy * 6, ny = away ? (uy + ux) * 4.5 : ux * 6;
      const tick = (q) => `M${fmt(q[0] - nx)} ${fmt(q[1] - ny)}L${fmt(q[0] + nx)} ${fmt(q[1] + ny)}`;
      const sg = o < 0 ? -1 : 1, ex = -uy * sg, ey = ux * sg, gap = Math.min(3, Math.abs(o) / 2);
      const ext = (q, e) => (away ? `M${fmt(q[0] + ex * gap)} ${fmt(q[1] + ey * gap)}L${fmt(e[0] + ex * 5)} ${fmt(e[1] + ey * 5)}` : '');
      const dd = `M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}${tick(a)}${tick(b)}${ext(p0, a)}${ext(p1, b)}`;
      s += `<path d="${dd}" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4.5"/><path d="${dd}" fill="none" stroke="#111" stroke-width="1.5"${preview ? ' stroke-dasharray="6 4"' : ''}/>`;
      let deg = (ang * 180) / Math.PI; if (deg > 90 || deg < -90) deg += 180; // never upside down
      s += `<text transform="translate(${fmt((a[0] + b[0]) / 2)} ${fmt((a[1] + b[1]) / 2)}) rotate(${fmt(deg)})" y="-5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="10" fill="#111" stroke="#fff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">${esc(dimText(total / CV.z))}</text>`;
      if (sel) s += `<path class="cs-selring" d="${d}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>`;
      return s;
    }
    if (st.tracks) { // two rails with cross ties (Bluebeam's "Tracks" line style), all sized from the line width
      // The rails are the band between 2.5 and 3.5 line widths from the route: a wide stroke less a narrower one (a
      // mask), so they keep their distance from it through every bend, rounded on the outside. Each rail used to be the
      // route's points pushed sideways along the average of their neighbours, which skewed it at a bend (user,
      // 2026-11-19: "when bending, the lines are skewed; they should remain parallel at all times"). Ties are left out
      // where they would cross a bend.
      const w = st.width, mid = `cs-tm-${CFG.id}-${id}`, dash = preview ? ' stroke-dasharray="6 4"' : '';
      const bends = []; L.slice(0, -1).reduce((at, l) => (bends.push(at + l), at + l), 0); // the route's length at each bend
      let ties = '';
      for (let dist = 4 * w; dist < total; dist += 8 * w) {
        if (bends.some((b) => Math.abs(dist - b) < 4.5 * w)) continue;
        const [x, y, a] = pointAt(P, L, dist), nx = -Math.sin(a) * 4 * w, ny = Math.cos(a) * 4 * w;
        ties += `M${fmt(x - nx)} ${fmt(y - ny)}L${fmt(x + nx)} ${fmt(y + ny)}`;
      }
      s += `<defs><mask id="${mid}" maskUnits="userSpaceOnUse" x="-50000" y="-50000" width="100000" height="100000">` +
        `<path d="${d}" fill="none" stroke="#fff" stroke-width="${7 * w}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#000" stroke-width="${5 * w}" stroke-linejoin="round"/></mask></defs>`;
      s += `<path d="${d}" fill="none" stroke="${st.color}" stroke-width="${7 * w}" stroke-linejoin="round" mask="url(#${mid})"${dash}/>`;
      if (ties) s += `<path d="${ties}" fill="none" stroke="${st.color}" stroke-width="${w}"${dash}/>`;
      if (sel) s += `<path class="cs-selring" d="${d}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>`;
      return s;
    }
    s += `<path d="${d}" fill="none" stroke="${st.halo}" stroke-opacity=".45" stroke-width="${st.width + 3}" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<path d="${d}" fill="none" stroke="${st.color}" stroke-width="${st.width}" stroke-linejoin="round"${preview ? ' stroke-dasharray="6 4"' : st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
    if (st.arrow) {
      const e = P[P.length - 1], ang = Math.atan2(e[1] - P[P.length - 2][1], e[0] - P[P.length - 2][0]);
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, bx = e[0] - 14 * ux, by = e[1] - 14 * uy;
      s += `<polygon points="${fmt(e[0] + 4 * ux)},${fmt(e[1] + 4 * uy)} ${fmt(bx + 7 * nx)},${fmt(by + 7 * ny)} ${fmt(bx - 7 * nx)},${fmt(by - 7 * ny)}" fill="${st.color}"/>`;
    }
    if (st.mark) {
      for (let dist = 30; dist < total - 26; dist += 60) {
        const [x, y] = pointAt(P, L, dist);
        s += `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="16" fill="${st.markColor}" stroke="#fff" stroke-width="7" paint-order="stroke" stroke-linejoin="round">${st.mark}</text>`;
      }
    }
    if (st.ticks) {
      for (let dist = 20; dist < total; dist += 40) {
        const [x, y, a] = pointAt(P, L, dist), nx = -Math.sin(a) * 7, ny = Math.cos(a) * 7;
        s += `<path d="M${fmt(x - nx)} ${fmt(y - ny)}L${fmt(x + nx)} ${fmt(y + ny)}" stroke="${st.halo}" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>`;
        s += `<path d="M${fmt(x - nx)} ${fmt(y - ny)}L${fmt(x + nx)} ${fmt(y + ny)}" stroke="${st.color}" stroke-width="2.4"/>`;
      }
    }
    if (st.zig) {
      const n = Math.max(2, Math.floor(total / 24));
      s += `<defs><path id="cs-tp-${id}" d="${d}"/></defs>`;
      s += `<text font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="26" fill="${st.color}" stroke="#000" stroke-opacity=".45" stroke-width=".8" dy="9"><textPath href="#cs-tp-${id}" xlink:href="#cs-tp-${id}">${'W'.repeat(n)}</textPath></text>`;
    }
    if (sel) s += `<path class="cs-selring" d="${d}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>`;
    return s;
  }

  // Pedestrian path: one trail of footprints, left and right in turn, walking down the middle of the area along its
  // longest edge from end to end. Not a hatch: a single line of steps, sized to the area's width (between the legend
  // swatch's size and five times it) and cut off at the area's outline.
  const FOOT = (x, y, c) => `<g transform="translate(${x} ${y})" fill="${c}"><ellipse cx="3" rx="3.7" ry="2.3"/><ellipse cx="-3.8" rx="1.8" ry="1.5"/></g>`;
  function feetTrail(id, P, c, d) {
    let best = -1, rot = 0;
    P.forEach((a, i) => { const b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > best) { best = l; rot = Math.atan2(b[1] - a[1], b[0] - a[0]); } });
    const ux = Math.cos(rot), uy = Math.sin(rot);
    const along = P.map((p) => p[0] * ux + p[1] * uy), across = P.map((p) => -p[0] * uy + p[1] * ux);
    const a0 = Math.min(...along), a1 = Math.max(...along), n0 = Math.min(...across), n1 = Math.max(...across);
    const k = Math.max(1, Math.min(5, (n1 - n0) * 0.5 / 13)); // a step is about 11 long and the trail 13 wide at size 1
    const step = 13 * k, n = Math.max(2, Math.floor((a1 - a0 - 8 * k) / step)); // one foot every 13: a pair every 26
    const mn = (n0 + n1) / 2, start = (a0 + a1) / 2 - ((n - 1) * step) / 2;
    let feet = '';
    for (let i = 0; i < n; i++) feet += FOOT(fmt((start + i * step) / k), fmt(mn / k + (i % 2 ? 3.4 : -3.4)), c);
    const cid = `cs-feet-${CFG.id}-${id}`;
    return `<defs><clipPath id="${cid}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${cid})"><g transform="rotate(${fmt(rot * 180 / Math.PI)}) scale(${k.toFixed(2)})">${feet}</g></g>`;
  }

  function patternMarkup(id, st, origin) {
    const c = st.hatchColor;
    const tf = (rot) => `translate(${fmt(origin[0])} ${fmt(origin[1])})${rot ? ' rotate(' + rot + ')' : ''}`;
    const open = (w, h, rot) => `<pattern id="cs-pat-${CFG.id}-${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}" patternTransform="${tf(rot)}">`;
    switch (st.hatch) {
      case 'diag':  return open(7, 7, 45) + `<line x1="0" y1="0" x2="0" y2="7" stroke="${c}" stroke-width="1.1"/></pattern>`;
      case 'hlines': return open(10, 7) + `<line x1="0" y1="3.5" x2="10" y2="3.5" stroke="${c}" stroke-width="1.6"/></pattern>`;
      case 'cross': return open(6, 6) + `<path d="M0 0L6 6M6 0L0 6" stroke="${c}" stroke-width="1" fill="none"/></pattern>`;
      case 'grid':  return open(12, 9) + `<path d="M0 0V9M0 0H12" stroke="${c}" stroke-width="1" fill="none"/></pattern>`;
      case 'S':     return open(26, 22) + `<text x="13" y="16" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="15" fill="${c}" stroke="#000" stroke-opacity=".4" stroke-width=".6">S</text></pattern>`;
    }
    return '';
  }

  function drawArea(id, st, P, sel, preview, exp) {
    if (P.length < 3 || P.some((p) => isNaN(p[0]))) return '';
    const d = pathD(P, true);
    let s = '';
    if (!preview && !exp) s += `<path class="cs-hit cs-hit-a" data-id="${id}" d="${d}" fill="transparent" stroke="none"/>`;
    if (st.fill) s += `<path d="${d}" fill="${st.fill}" fill-opacity="${st.fillOpacity || FILL_OPACITY}" stroke="none"/>`;
    if (st.hatch) s += `<defs>${patternMarkup(id, st, P[0])}</defs><path d="${d}" fill="url(#cs-pat-${CFG.id}-${id})" stroke="none"/>`;
    if (st.feet) s += feetTrail(id, P, st.feet, d);
    const stroke = st.stroke || st.fill;
    s += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${st.strokeWidth || 1.4}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}${preview ? ' stroke-opacity=".8"' : ''} stroke-linejoin="round"/>`;
    if (sel) s += `<path class="cs-selring" d="${d}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>`;
    return s;
  }

  // A notes shape (Box, Circle, Cloud): its outline in its colour over a light halo, as the dimensions are drawn. Only
  // the outline takes a click, so what it rings can still be picked through it. Line weight: SHAPE_W, as a line's.
  const SHAPE_W = 2;
  const byCorners = (st) => !!st && st.kind === 'area' && !st.trailer && (st.shape === 'box' || st.shape === 'ellipse' || R.shape === 'rect'); // drawn by two opposite corners
  const boxy = (st) => !!st && (st.shape === 'box' || st.shape === 'ellipse'); // always a box of 4 corners
  const squareTo = (a, p) => { const dx = p[0] - a[0], dy = p[1] - a[1], k = Math.max(Math.abs(dx), Math.abs(dy)); return [a[0] + (dx < 0 ? -k : k), a[1] + (dy < 0 ? -k : k)]; };
  // A revision cloud along a closed outline: each edge in equal arcs about 0.14 in long on the sheet (larger in the
  // view as it is zoomed in, so it looks the same), bulging outwards whichever way round the corners were clicked.
  function cloudD(P) {
    const n = P.length, k = R.frz ? CV.z / R.frz : 1, arc = 14 * k;
    let area = 0;
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sweep = area > 0 ? 1 : 0; // screen y is down: a positive area runs clockwise, and its outside is to the left
    let d = `M${fmt(P[0][0])} ${fmt(P[0][1])}`;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.01) continue;
      const m = Math.max(1, Math.round(L / arc)), r = (L / m) * 0.62;
      for (let j = 1; j <= m; j++) d += ` A${fmt(r)} ${fmt(r)} 0 0 ${sweep} ${fmt(a[0] + ((b[0] - a[0]) * j) / m)} ${fmt(a[1] + ((b[1] - a[1]) * j) / m)}`;
    }
    return d + 'Z';
  }
  function shapeD(st, P) {
    if (st.shape === 'cloud') return cloudD(P);
    if (st.shape === 'ellipse') { // the ellipse inside the box of its corners
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
      return `M${fmt(x0)} ${fmt(cy)}A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(x1)} ${fmt(cy)}A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(x0)} ${fmt(cy)}Z`;
    }
    return pathD(P, true);
  }
  function drawShape(id, st, P, color, sel, preview, exp) {
    if (P.length < 3 || P.some((p) => isNaN(p[0]))) return '';
    const d = shapeD(st, P), col = /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : LABEL_INK;
    let s = '';
    if (!preview && !exp) s += `<path class="cs-hit cs-hit-l" data-id="${id}" d="${d}" fill="none" stroke="transparent" stroke-width="${HIT}"/>`;
    s += `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="${SHAPE_W + 3}" stroke-linejoin="round"/>`;
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${SHAPE_W}" stroke-linejoin="round"${preview ? ' stroke-dasharray="6 4"' : ''}/>`;
    if (sel) s += `<path class="cs-selring" d="${d}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>`;
    return s;
  }

  const edgePt = (c, r, deg) => [c[0] + r * Math.cos(deg * Math.PI / 180), c[1] + r * Math.sin(deg * Math.PI / 180)];
  // An arc as SVG path commands from angle a0 sweeping clockwise: two halves, so a sweep near 360 (ends that round to the
  // same point, which SVG would drop) still draws. Starts with M unless `on` (the pen is already at its start).
  function arcPath(c, r, a0, sweep, on) {
    const e0 = edgePt(c, r, a0), em = edgePt(c, r, a0 + sweep / 2), e1 = edgePt(c, r, a0 + sweep), h = sweep / 2 > 180 ? 1 : 0;
    return `${on ? `L${fmt(e0[0])} ${fmt(e0[1])}` : `M${fmt(e0[0])} ${fmt(e0[1])}`} A${fmt(r)} ${fmt(r)} 0 ${h} 1 ${fmt(em[0])} ${fmt(em[1])} A${fmt(r)} ${fmt(r)} 0 ${h} 1 ${fmt(e1[0])} ${fmt(e1[1])}`;
  }
  // A crane's reach in drawing units: its jib length at this page's scale once both are set (so a page not opened since
  // its scale changed still prints the right circle), else the radius as drawn.
  function reachOf(it) { const m = mpu(); return it.spec && it.spec.jib > 0 && m ? it.spec.jib / m : (it.r || 0); }
  // part: 'ring' or 'sym' draws only a crane's reach or only the symbol; 'ringBare' is the reach without a ground-level
  // tail swing and without the figures (the PDF export writes each of those as its own markup, so they survive Revu edits)
  function drawPoint(it, P, sel, exp, part) {
    const sym = SYM[it.sym];
    if (!sym || !P || isNaN(P[0])) return '';
    // Drawn at the plan's symbol size (symHeight): a fixed size on the printed sheet, like the hatches and line widths.
    // Only a crane's reach is to scale.
    const h = symHeight(it.sym), w = (h * sym.w) / sym.h;
    let s = '';
    if (isCrane(it.sym) && part !== 'sym') {
      const r = reachOf(it) * CV.z;
      if (it.sweep && it.sweep < 360) { // swing pie: from a0, sweeping clockwise on screen
        s += `<path d="M${fmt(P[0])} ${fmt(P[1])} ${arcPath(P, r, it.a0, it.sweep, true)} Z" ${craneRing(it.sym)} stroke-linejoin="round"/>`;
      } else s += `<circle cx="${fmt(P[0])}" cy="${fmt(P[1])}" r="${fmt(r)}" ${craneRing(it.sym)}/>`;
      s += craneSpecMarkup(it, P, h, part !== 'ringBare', part !== 'ringBare'); // its specification, if one was typed in: counter-jib or tail circle, figures
    }
    // A symbol drawn small (zoomed out, or 1/4" on a large site) stays easy to grab: an invisible circle as wide as a
    // line's grab width sits under it. Larger symbols are grabbed by their own drawing. Not on the export.
    if (!exp && Math.max(w, h) < HIT * 1.6) s += `<circle class="cs-hit cs-hit-p" data-id="${it.id}" cx="${fmt(P[0])}" cy="${fmt(P[1])}" r="${fmt(HIT * 0.8)}" fill="transparent" stroke="none"/>`;
    if (part === 'ring' || part === 'ringBare') return s;
    s += `<g class="cs-pt" data-id="${it.id}" transform="translate(${fmt(P[0])} ${fmt(P[1])})"><svg x="${fmt(-w / 2)}" y="${fmt(-h / 2)}" width="${fmt(w)}" height="${fmt(h)}" viewBox="${sym.vb}" overflow="visible">${sym.inner}</svg></g>`;
    if (sel) s += `<circle class="cs-selring" cx="${fmt(P[0])}" cy="${fmt(P[1])}" r="${fmt(Math.max(Math.max(w, h) * 0.62, 9))}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>`;
    return s;
  }

  // A length in drawing units as text: metres and feet-inches, once the drawing has a scale.
  function dimText(len) {
    const m = mpu();
    if (!m) return 'set the drawing scale';
    const metres = len * m, ft = metres / 0.3048;
    let f = Math.floor(ft), inch = Math.round((ft - f) * 12);
    if (inch === 12) { f += 1; inch = 0; }
    return `${metres.toFixed(2)} m (${f}'-${inch}")`;
  }
  // A text label: Flux Architect Bold (LABEL_FAMILY), in its colour, with a white halo, at its height on the sheet
  // at every scale, centred on its point and turned by its angle. it.color: '#rrggbb' (none: black); it.rot: degrees
  // anticlockwise, as in CAD (none: level). User, 2026-11-17: text can change colour, the architectural bold font, rotation;
  // the colours offered are AutoCAD's 9 standard index colours (ACI 1-9). ACI 7 is white on AutoCAD's dark screen and
  // black on paper, so on this white sheet it is black, and it is the default.
  const LABEL_ACI = [[1, '#ff0000', 'Red'], [2, '#ffff00', 'Yellow'], [3, '#00ff00', 'Green'], [4, '#00ffff', 'Cyan'], [5, '#0000ff', 'Blue'],
    [6, '#ff00ff', 'Magenta'], [7, '#000000', 'White/Black (black on paper)'], [8, '#808080', 'Dark grey'], [9, '#c0c0c0', 'Light grey']];
  const LABEL_INK = '#000000'; // ACI 7
  const labelColor = (it) => (/^#[0-9a-f]{6}$/i.test(String(it.color || '')) ? it.color.toLowerCase() : LABEL_INK);
  const labelRot = (it) => { const r = Math.round(+it.rot); return Number.isFinite(r) ? ((((r + 180) % 360) + 360) % 360) - 180 : 0; }; // -180..179
  // Text height (user, 2026-11-17: "add a size option for the text"), as in CAD: the height of the CAPITALS on the printed
  // sheet, in the standard drafting heights. it.size: inches (none: LABEL_H0, 3/32 in, close to the 0.10 in labels had
  // before sizes existed). Flux Architect's capitals are 0.855 of its font size (capHeight 1752 / 2048 units per em).
  const LABEL_HEIGHTS = [[0.09375, '3/32 in (2.4 mm)'], [0.125, '1/8 in (3.2 mm)'], [0.1875, '3/16 in (4.8 mm)'], [0.25, '1/4 in (6.4 mm)'], [0.375, '3/8 in (9.5 mm)'], [0.5, '1/2 in (12.7 mm)']];
  const LABEL_H0 = 0.09375, LABEL_CAP = 1752 / 2048;
  const labelH = (it) => { const h = +(it && it.size); return LABEL_HEIGHTS.some((x) => x[0] === h) ? h : LABEL_H0; };
  const labelFont = (it) => (labelH(it) * 100) / LABEL_CAP; // font size in sheet units (1/100 in), at the sheet's own scale
  const labelSize = (it) => labelFont(it) * (R.frz ? CV.z / R.frz : 1); // ... in the view being drawn
  // the label's box (as for the layout: text width plus a little, 1.44 x the size tall) as four corners, turned, in the
  // view; and the upright box around them
  function labelBounds(it, P, size) {
    const t = String(it.text || ''), hw = textW(t, size, LABEL_FAMILY) / 2 + size * 0.25, hh = size * 0.72;
    const a = (-labelRot(it) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); // screen y is down: anticlockwise is negative
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [P[0] + x * c - y * s, P[1] + x * s + y * c]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function drawText(it, P, sel, hit) { // hit: on screen, a clear box over the whole label takes the click
    if (!P || isNaN(P[0])) return '';
    const size = labelSize(it), text = String(it.text || ''), rot = labelRot(it), w = textW(text, size, LABEL_FAMILY);
    // Only the letters took a click before, so a small label was picked only on a stroke and missed between its
    // letters (found by a test, 2026-11-19): the box is the label's, at least as big as a small symbol's target.
    const hw = Math.max(w / 2 + 4, HIT / 2), hh = Math.max(size * 0.8, HIT * 0.45);
    return `<g class="cs-pt" data-id="${it.id}" transform="translate(${fmt(P[0])} ${fmt(P[1])})${rot ? ` rotate(${-rot})` : ''}">` +
      (hit ? `<rect class="cs-hit" x="${fmt(-hw)}" y="${fmt(-hh)}" width="${fmt(hw * 2)}" height="${fmt(hh * 2)}" fill="transparent"/>` : '') +
      `<text text-anchor="middle" dominant-baseline="central" font-family="${LABEL_FAMILY}" font-weight="700" font-size="${fmt(size)}" fill="${labelColor(it)}" stroke="#fff" stroke-width="${fmt(size * 0.3)}" paint-order="stroke" stroke-linejoin="round">${esc(text)}</text>` +
      (sel ? `<rect class="cs-selring" x="${fmt(-w / 2 - 5)}" y="${fmt(-size * 0.8)}" width="${fmt(w + 10)}" height="${fmt(size * 1.6)}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>` : '') + '</g>';
  }
  function drawItem(it, exp) {
    const st = STYLE[it.sym];
    const P = it.pts.map((p) => toScreen(p[0], p[1]));
    const sel = !exp && it.id === R.sel;
    if (it.sym === '_text') return drawText(it, P[0], sel, !exp);
    if (!st) return drawPoint(it, P[0], sel, exp);
    if (st.shape) return drawShape(it.id, st, P, it.color, sel, false, exp);
    return st.kind === 'line' ? drawLine(it.id, st, P, sel, false, exp, st.dim ? (it.off || 0) * CV.z : 0) : drawArea(it.id, st, P, sel, false, exp);
  }

  // Handles for the selected item: drag a white dot to move that corner, drag a small blue dot (midpoint of an edge)
  // to add a corner, Shift+click or double-tap a corner to remove it. Cranes get a reach handle (and pie edges).
  function drawHandles() {
    const it = R.mode === 'select' && R.sel && find(R.sel);
    if (!it || it.pg !== D.page) return '';
    if (isCrane(it.sym)) {
      const c = toScreen(it.pts[0][0], it.pts[0][1]), r = reachOf(it) * V.z; // the handles sit on the circle as drawn
      if (isNaN(c[0])) return '';
      const pie = it.sweep && it.sweep < 360;
      const mid = pie ? it.a0 + it.sweep / 2 : 0;
      let hx = c[0] + r, hy = c[1]; // put the handle on the circle where it is visible inside the window
      // ...and not under the toolbar, which takes the clicks there (its box grown by the margin, and by the label above)
      const tbEl = R.root.querySelector('.cs-tb');
      let tb = null;
      if (tbEl && tbEl.offsetParent) {
        const a = tbEl.getBoundingClientRect(), b = R.map.getBoundingClientRect();
        tb = [a.left - b.left - 14, a.top - b.top - 14, a.right - b.left + 14, a.bottom - b.top + 14 + 16 * HR];
      }
      for (const d of (pie ? [mid] : []).concat([0, -34, 34, -69, 69, 180, -143, 143, -90, 90])) {
        const e = edgePt(c, r, d);
        const underTb = tb && e[0] > tb[0] && e[0] < tb[2] && e[1] > tb[1] && e[1] < tb[3];
        if (e[0] > 14 && e[0] < V.w - 14 && e[1] > 14 && e[1] < V.h - 14 && !underTb) { hx = e[0]; hy = e[1]; break; }
      }
      const m = mpu();
      const label = (m ? Math.round(reachOf(it) * m) + ' m' : 'reach (set the Drawing Scale, left panel, for metres)') + (pie ? ' · ' + Math.round(it.sweep) + '°' : '');
      let out = '';
      if (pie) [it.a0, it.a0 + it.sweep].forEach((d, k) => { const e = edgePt(c, r, d); out += `<circle class="cs-va" data-e="${k}" cx="${fmt(e[0])}" cy="${fmt(e[1])}" r="${6 * HR}" fill="#fff" stroke="#1a73e8" stroke-width="2"/>`; });
      return out + `<circle class="cs-vr" cx="${fmt(hx)}" cy="${fmt(hy)}" r="${7 * HR}" fill="#fffb00" stroke="#1a73e8" stroke-width="2"/>` +
        `<text x="${fmt(hx)}" y="${fmt(hy - 12 * HR)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#111" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(label)}</text>`;
    }
    const st = STYLE[it.sym];
    if (!st) return '';
    const P = it.pts.map((p) => toScreen(p[0], p[1]));
    if (P.some((p) => isNaN(p[0]))) return '';
    if (st.trailer) return trailerTag(it, P);
    const closed = st.kind === 'area', n = P.length;
    let s = '';
    if (st.dim) { // a dimension: its two measured points, and a square on its line to slide the line in or out
      const [a, b] = dimEnds(P, (it.off || 0) * V.z);
      s += `<rect class="cs-vo" x="${fmt((a[0] + b[0]) / 2 - 5 * HR)}" y="${fmt((a[1] + b[1]) / 2 - 5 * HR)}" width="${10 * HR}" height="${10 * HR}" fill="#fffb00" stroke="#1a73e8" stroke-width="2"/>`;
    } else if (!boxy(st)) for (let i = 0; i < (closed ? n : n - 1); i++) { // a box or circle keeps its 4 corners: no corner is added
      const a = P[i], b = P[(i + 1) % n];
      s += `<circle class="cs-vm" data-i="${i}" cx="${fmt((a[0] + b[0]) / 2)}" cy="${fmt((a[1] + b[1]) / 2)}" r="${4 * HR}" fill="#1a73e8" fill-opacity=".45" stroke="#fff" stroke-width="1"/>`;
    }
    P.forEach((q, i) => { s += `<circle class="cs-vh" data-i="${i}" cx="${fmt(q[0])}" cy="${fmt(q[1])}" r="${5.5 * HR}" fill="#fff" stroke="#1a73e8" stroke-width="2"/>`; });
    return s;
  }

  function drawDraft() {
    const d = R.draft;
    if (!d || !d.pts.length) return trailerGhost();
    if (R.mode === 'cal') { // calibration line, with its length when a scale is already set
      const pts = d.pts.slice(); if (pts.length === 1 && R.cursor) pts.push(R.cursor);
      const P = pts.map((p) => toScreen(p[0], p[1]));
      let s = P.length === 2 ? `<path d="${pathD(P)}" stroke="#fff" stroke-width="5" stroke-opacity=".7" fill="none"/><path d="${pathD(P)}" stroke="#1a73e8" stroke-width="2" stroke-dasharray="6 4" fill="none"/>` : '';
      P.forEach((q) => { s += `<circle cx="${fmt(q[0])}" cy="${fmt(q[1])}" r="4.5" fill="#fff" stroke="#1a73e8" stroke-width="2"/>`; });
      const m = mpu();
      if (m && pts.length === 2) {
        const len = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * m;
        s += `<text x="${fmt((P[0][0] + P[1][0]) / 2)}" y="${fmt((P[0][1] + P[1][1]) / 2 - 10)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#1a73e8" stroke="#fff" stroke-width="4" paint-order="stroke">${len.toFixed(2)} m</text>`;
      }
      return s;
    }
    const st = STYLE[R.tool];
    if (!st) return '';
    let pts = d.pts.slice(), off = 0;
    if (byCorners(st)) pts = R.cursor ? rectPts(d.pts[0], R.cursor) : [];
    else if (st.dim && pts.length === 2) off = R.cursor ? dimOff(pts, R.cursor) * V.z : 0; // both ends set: the cursor carries the line
    else if (R.cursor) pts.push(R.cursor);
    const P = pts.map((p) => toScreen(p[0], p[1]));
    let s = '';
    if (st.kind === 'line') s += drawLine('__draft', st, P, false, true, false, off);
    else if (P.length >= 3) s += st.shape ? drawShape('__draft', st, P, shapeColNow(), false, true) : drawArea('__draft', st, P, false, true);
    else if (P.length === 2) s += `<path d="${pathD(P)}" stroke="#1a73e8" stroke-width="1.5" stroke-dasharray="5 4" fill="none"/>`;
    d.pts.forEach((p) => { const q = toScreen(p[0], p[1]); s += `<circle cx="${fmt(q[0])}" cy="${fmt(q[1])}" r="${3.5 * HR}" fill="#fff" stroke="#1a73e8" stroke-width="1.5"/>`; });
    return s;
  }

  // The part of the view the sheet will print, outlined with the rest shaded, and its scale. Screen only, never exported.
  function extentMarkup(fr) {
    if (R.exporting) return '';
    const c = toScreen(fr.cx, fr.cy), w = (MAP_IN.w / fr.z) * V.z, h = (MAP_IN.h / fr.z) * V.z, x = c[0] - w / 2, y = c[1] - h / 2;
    // larger than the window both ways (a fixed scale at the zoom ceiling): all of the view prints, and more. The outline
    // fills the window exactly as a rule now (holdScale, layoutSheet), so only clearly past its edges counts.
    if (x < -2 && y < tbInset() - 2 && x + w > V.w + 2 && y + h > V.h + 2)
      return `<text x="${fmt(V.w - 8)}" y="${fmt(V.h - 8)}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="11.5" fill="#1a73e8" stroke="#fff" stroke-width="4" paint-order="stroke">${zoomLocked() && V.z > zoomFloor() * 1.001 ? `Zoomed in: the sheet prints more than the window, at ${esc(scaleName(fr.N))}` : `Prints more than the window${fr.N ? ' at ' + esc(scaleName(fr.N)) : ''}`}</text>`;
    const r = `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}Z`;
    return `<path d="M-10 -10H${V.w + 10}V${V.h + 10}H-10Z${r}" fill="#1b2433" fill-opacity=".14" fill-rule="evenodd"/>` +
      `<path d="${r}" fill="none" stroke="#1a73e8" stroke-width="1.5" stroke-dasharray="7 4"/>` +
      `<text x="${fmt(Math.min(V.w - 8, x + w - 8))}" y="${fmt(Math.min(V.h - 8, y + h - 8))}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="11.5" fill="#1a73e8" stroke="#fff" stroke-width="4" paint-order="stroke">${fr.N ? 'Prints at ' + esc(scaleName(fr.N)) : 'Prints this area (not to scale)'}</text>`;
  }
  // The title block's notes: how to print it, and which drawing it sits on.
  function notesText(fr) {
    const base = D.ready ? `Base drawing: ${D.name}${D.set ? `, ${pageName(D.page)} (${D.page} of ${D.pages})` : D.pages > 1 ? `, page ${D.page} of ${D.pages}` : ''}` : 'No base drawing open';
    const how = fr.N ? 'Print at actual size (100%) on 11 x 17 in paper for the scale to hold.' : 'Not to scale: set the drawing scale to print one.';
    return [how, base];
  }

  const niceLen = (mpp, maxPx) => { let len = NICE[0]; for (const n of NICE) if (n / mpp <= maxPx) len = n; return len; };
  const lenLabel = (len) => (len >= 1000 ? len / 1000 + ' km' : len + ' m');

  function render() {
    R.raf = 0;
    if (R.batch) return; // an all-pages export is walking the pages: the screen waits
    R.root.classList.toggle('cs-has-doc', D.ready);
    if (!D.ready) { R.layer.innerHTML = ''; R.scaleEl.textContent = '-'; R.notesEl.textContent = notesText({}).join('\n'); return; }
    if (!R.exporting) holdScale(); // a scale set, Fit, Selected, a resize, a page shown: back to the print scale
    if (R.hintLock !== zoomLocked()) { R.hintLock = zoomLocked(); R.hintEl.textContent = R.hintEl.title = hintText(); } // "scroll to zoom" or not
    const [tx, ty] = toScreen(0, 0);
    R.page.style.transform = `translate(${tx}px, ${ty}px) scale(${V.z})`;
    const fs = R.frame.style;
    fs.left = tx + 'px'; fs.top = ty + 'px'; fs.width = D.w * V.z + 'px'; fs.height = D.h * V.z + 'px';
    R.fade.style.opacity = PLAN.fade || 0;
    const fr = sheetFrame();
    R.frz = fr.z;
    let out = '';
    out += ovlMarkup() + layerMarkup(false); // the pages laid over first, this page's markup on top
    out += extentMarkup(fr) + drawHandles() + drawDraft() + drawSnap() + drawZoomWin();
    R.layer.innerHTML = out;
    const m = mpu();
    if (m) {
      const mpp = m / V.z, len = niceLen(mpp, 150);
      R.sbBar.style.width = Math.max(10, len / mpp) + 'px'; R.sbLabel.textContent = lenLabel(len); R.sb.style.visibility = '';
    } else R.sb.style.visibility = 'hidden';
    R.scaleEl.textContent = fr.N ? scaleName(fr.N) + (fr.auto ? ' (auto)' : '') : 'NTS: set the drawing scale';
    R.notesEl.textContent = notesText(fr).join('\n');
    setSymNote(fr);
    scheduleDetail();
    clearTimeout(R.viewTimer); // the view settles: remember it for this page
    R.viewTimer = setTimeout(() => { const v = PLAN && PLAN.views && PLAN.views[String(D.page)]; keepView(); const w = PLAN && PLAN.views && PLAN.views[String(D.page)]; if (w && (!v || v[0] !== w[0] || v[1] !== w[1] || v[2] !== w[2] || v[3] !== w[3] || v[4] !== w[4])) save(); }, 700);
  }
  function dirty() { R.layRev = (R.layRev || 0) + 1; if (!R.raf && R.root && !R.batch) R.raf = requestAnimationFrame(render); } // layRev: the label layout is redone

  // ---------- snapping (the Dimension tool) ----------
  // A PDF made from CAD carries its lines as coordinates. They are read once per page, the first time the Dimension
  // tool is used on it, and kept in a grid so the lines near the cursor are found without looking at all of them.
  // The cursor then jumps to the nearest line end, crossing or midpoint within SNAP_PX on screen, or failing those
  // to the nearest point on a line. A scan or an image has no lines: there only the items placed here are snapped to.
  // The same snapping serves Calibrate (its two points) and the Text tool (a label's centre: line ends, crossings and
  // middles, or failing those lined up with another label). Holding Shift locks the second point of a dimension or a
  // calibration to the nearest 45 degrees from the first: the point snapped to is carried across onto that line, so
  // a level or plumb distance to a corner can be measured. The Snap button turns the snapping off; Shift still locks.
  const SNAP_PX = COARSE ? 20 : 11, SNAP_MAX_SEGS = 1500000;
  const SNAP_NAMES = { end: 'End', int: 'Crossing', mid: 'Middle', on: 'On line', pt: 'Point', align: 'Lined up', free: '' };
  const isDimTool = () => R.mode === 'draw' && !!(STYLE[R.tool] && STYLE[R.tool].dim);
  const isTextTool = () => R.mode === 'draw' && R.tool === '_text';
  // the tools whose clicks are aimed (snap, Shift lock): Calibrate and every drawing tool, symbols, lines and areas
  // included (user, 2026-11-19: "add snapping for areas, lines, and symbols"; before, only Text, Dimension and Calibrate)
  const aims = () => R.mode === 'cal' || (R.mode === 'draw' && !!R.tool);
  const snapOn = () => !csSnap.off;
  function ensureSnap() {
    if (D.kind !== 'pdf' || !D.pageObj || D.snapGen === D.pageGen) return;
    const gen = D.snapGen = D.pageGen, t0 = performance.now();
    D.snap = null; D.snapBusy = true; updateUi();
    buildSnap(D.pageObj).then((s) => { if (gen === D.pageGen) { s.ms = Math.round(performance.now() - t0); D.snap = s; } }, () => {})
      .then(() => { if (gen === D.pageGen) { D.snapBusy = false; updateUi(); } });
  }
  async function buildSnap(page) {
    const lib = await loadPdfjs(), O = lib.OPS || {};
    const ol = await page.getOperatorList();
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    let ctm = pdfVp(page, 1).transform.slice(); // PDF units to drawing units, as the page is shown (turned, if it is)
    const stack = [], W = D.w, H = D.h;
    let segs = new Float32Array(4 * 4096), bend = new Uint8Array(4096), n = 0, skip = 0, full = false;
    const add = (x1, y1, x2, y2, piece) => { // one line (or, with both ends the same, one point), in PDF units; piece: a bit of a curve
      const ax = ctm[0] * x1 + ctm[2] * y1 + ctm[4], ay = ctm[1] * x1 + ctm[3] * y1 + ctm[5];
      const bx = ctm[0] * x2 + ctm[2] * y2 + ctm[4], by = ctm[1] * x2 + ctm[3] * y2 + ctm[5];
      if (!(Math.max(ax, bx) >= 0 && Math.min(ax, bx) <= W && Math.max(ay, by) >= 0 && Math.min(ay, by) <= H)) return; // off the page, or not a number
      if (n >= SNAP_MAX_SEGS) { full = true; return; }
      if (4 * n === segs.length) { const g = new Float32Array(segs.length * 2); g.set(segs); segs = g; const h = new Uint8Array(bend.length * 2); h.set(bend); bend = h; }
      segs[4 * n] = ax; segs[4 * n + 1] = ay; segs[4 * n + 2] = bx; segs[4 * n + 3] = by; bend[n] = piece ? 1 : 0; n++;
    };
    // A curve (four control points; a three-point one is raised to four first) becomes short straight pieces, more of
    // them the bigger it is on the page: the cursor can ride along it and find where it crosses a line. Its pieces'
    // own ends and middles mean nothing and are never snapped to; the curve's two real ends are.
    const curve = (x0, y0, x1, y1, x2, y2, x3, y3) => {
      // how far the curve bows off its chord (its control points' distance from it), in drawing units: enough pieces
      // to stay within about 0.05 of a unit of the true curve, 48 at most
      const k = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) || 1, cx = x3 - x0, cy = y3 - y0, cl = Math.hypot(cx, cy);
      const off = (x, y) => (cl > 1e-9 ? Math.abs((x - x0) * cy - (y - y0) * cx) / cl : Math.hypot(x - x0, y - y0));
      const bow = Math.max(off(x1, y1), off(x2, y2)) * k;
      const pieces = Math.max(1, Math.min(48, Math.ceil(Math.sqrt(bow / 0.05))));
      add(x0, y0, x0, y0); add(x3, y3, x3, y3);
      let px = x0, py = y0;
      for (let s = 1; s <= pieces; s++) {
        const t = s / pieces, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        const qx = a * x0 + b * x1 + c * x2 + d * x3, qy = a * y0 + b * y1 + c * y2 + d * y3;
        add(px, py, qx, qy, true); px = qx; py = qy;
      }
    };
    const fn = ol.fnArray, args = ol.argsArray;
    for (let k = 0; k < fn.length && !full; k++) {
      const f = fn[k], a = args[k];
      if (f === O.save || f === O.beginGroup) stack.push(ctm);
      else if (f === O.paintFormXObjectBegin) { stack.push(ctm); if (a && a[0]) ctm = mul(ctm, a[0]); }
      else if (f === O.restore || f === O.endGroup || f === O.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
      else if (f === O.transform) ctm = mul(ctm, a);
      else if (f === O.beginAnnotation) skip++; // comments and markups already on the PDF are not the drawing
      else if (f === O.endAnnotation) skip = Math.max(0, skip - 1);
      else if (f === O.constructPath && !skip && a && a[0] !== O.endPath) { // endPath: a clipping outline, never drawn
        const d = a[1] && a[1][0];
        if (!d || typeof d.length !== 'number') continue;
        let i = 0, x = 0, y = 0, sx = 0, sy = 0, nx, ny;
        while (i < d.length) {
          const op = d[i++];
          if (op === 0) { x = sx = d[i++]; y = sy = d[i++]; }                              // move to
          else if (op === 1) { nx = d[i++]; ny = d[i++]; add(x, y, nx, ny); x = nx; y = ny; } // line to
          else if (op === 2) { curve(x, y, d[i], d[i + 1], d[i + 2], d[i + 3], nx = d[i + 4], ny = d[i + 5]); i += 6; x = nx; y = ny; }
          else if (op === 3) {
            const qx = d[i], qy = d[i + 1]; nx = d[i + 2]; ny = d[i + 3]; i += 4;
            curve(x, y, x + (2 * (qx - x)) / 3, y + (2 * (qy - y)) / 3, nx + (2 * (qx - nx)) / 3, ny + (2 * (qy - ny)) / 3, nx, ny); x = nx; y = ny;
          } else if (op === 4) { if (x !== sx || y !== sy) add(x, y, sx, sy); x = sx; y = sy; } // close the outline
          else break;
        }
      }
    }
    // PDF.js keeps the list it handed over, for a second caller that never comes: on a heavy sheet that is a few
    // hundred megabytes. Let it go (the page's own drawing list is a different one and stays).
    try { for (const [key, st] of page._intentStates) if (st && st.operatorList === ol) page._intentStates.delete(key); } catch (e) {}
    // the grid: each line is listed in every cell it passes through (counted first, then filled: two flat arrays)
    const c = Math.max(W, H) / 256 || 1, gx = Math.ceil(W / c) + 1, gy = Math.ceil(H / c) + 1;
    const walk = (i, visit) => {
      const x1 = segs[4 * i], y1 = segs[4 * i + 1], dx = segs[4 * i + 2] - x1, dy = segs[4 * i + 3] - y1;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (c * 0.5)));
      let last = -1;
      for (let s = 0; s <= steps; s++) {
        const cx = Math.min(gx - 1, Math.max(0, Math.floor((x1 + (dx * s) / steps) / c))), cy = Math.min(gy - 1, Math.max(0, Math.floor((y1 + (dy * s) / steps) / c)));
        const cell = cx + gx * cy;
        if (cell !== last) { visit(cell); last = cell; }
      }
    };
    const start = new Uint32Array(gx * gy + 1);
    for (let i = 0; i < n; i++) walk(i, (cell) => { start[cell + 1]++; });
    for (let k = 0; k < gx * gy; k++) start[k + 1] += start[k];
    const fill = start.slice(0, gx * gy), list = new Uint32Array(start[gx * gy]);
    for (let i = 0; i < n; i++) walk(i, (cell) => { list[fill[cell]++] = i; });
    return { segs, bend, n, c, gx, gy, start, list, seen: new Uint32Array(n), stamp: 0, full, ops: fn.length };
  }
  // The snap point for a cursor at m (drawing units), or null: { p, kind }. skipId: the item being moved or reshaped;
  // noOn: line ends, crossings and middles only, never just "somewhere on a line" (a text label would stick everywhere).
  function snapPoint(m, skipId, noOn) {
    if (!snapOn()) return null;
    ensureSnap();
    const r = SNAP_PX / V.z, r2 = r * r;
    let best = null, bd = r2, on = null, od = r2;
    const take = (x, y, kind) => { const d = (x - m[0]) * (x - m[0]) + (y - m[1]) * (y - m[1]); if (d < bd) { bd = d; best = { p: [x, y], kind }; } };
    for (const it of items()) if (it.id !== skipId && it.sym !== '_text') for (const p of it.pts) take(p[0], p[1], 'pt'); // a label's centre is no corner
    const S = D.snap;
    if (S && S.n) {
      const { segs, bend, c, gx, gy, start, list, seen } = S, stamp = ++S.stamp, near = [];
      const ccx = Math.floor(m[0] / c), ccy = Math.floor(m[1] / c), k = Math.min(8, Math.ceil(r / c));
      for (let cy = Math.max(0, ccy - k); cy <= Math.min(gy - 1, ccy + k); cy++) {
        for (let cx = Math.max(0, ccx - k); cx <= Math.min(gx - 1, ccx + k); cx++) {
          for (let q = start[cx + gx * cy], e = start[cx + gx * cy + 1]; q < e; q++) {
            const i = list[q];
            if (seen[i] === stamp) continue;
            seen[i] = stamp;
            const x1 = segs[4 * i], y1 = segs[4 * i + 1], x2 = segs[4 * i + 2], y2 = segs[4 * i + 3], dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
            const t = l2 ? Math.max(0, Math.min(1, ((m[0] - x1) * dx + (m[1] - y1) * dy) / l2)) : 0;
            const px = x1 + dx * t, py = y1 + dy * t, d = (px - m[0]) * (px - m[0]) + (py - m[1]) * (py - m[1]);
            if (d > r2) continue;
            if (!bend[i]) { take(x1, y1, 'end'); if (l2) take(x2, y2, 'end'); }
            if (l2) { near.push([d, i]); if (d < od) { od = d; on = { p: [px, py], kind: 'on' }; } }
          }
        }
      }
      near.sort((a, b) => a[0] - b[0]);
      const N = Math.min(near.length, 48); // crossings and middles of the closest lines only
      for (let a = 0; a < N; a++) {
        const i = near[a][1], ax = segs[4 * i], ay = segs[4 * i + 1], rx = segs[4 * i + 2] - ax, ry = segs[4 * i + 3] - ay;
        for (let b = a + 1; b < N; b++) {
          const j = near[b][1], bx = segs[4 * j], by = segs[4 * j + 1], qx = segs[4 * j + 2] - bx, qy = segs[4 * j + 3] - by;
          const den = rx * qy - ry * qx;
          if (Math.abs(den) < 1e-9) continue; // parallel
          const t = ((bx - ax) * qy - (by - ay) * qx) / den, u = ((bx - ax) * ry - (by - ay) * rx) / den;
          if (!(t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6)) continue;
          if (bend[i] && bend[j] && (t < 1e-3 || t > 1 - 1e-3) && (u < 1e-3 || u > 1 - 1e-3)) continue; // two pieces of one curve meeting end to end: no crossing
          take(ax + rx * t, ay + ry * t, 'int');
        }
      }
      for (let a = 0; a < N; a++) { // a middle only where the line is long enough on screen to have one worth aiming at
        const i = near[a][1], dx = segs[4 * i + 2] - segs[4 * i], dy = segs[4 * i + 3] - segs[4 * i + 1];
        if (!bend[i] && Math.hypot(dx, dy) * V.z >= 4 * SNAP_PX) take(segs[4 * i] + dx / 2, segs[4 * i + 1] + dy / 2, 'mid');
      }
    }
    return best || (noOn ? null : on);
  }
  // A text label's centre at m: a line end, crossing or middle if one is near; otherwise level with, or straight above
  // or below, another label on this page (`guides`: a line from that label, to show what it lined up with).
  function snapText(m, skipId) {
    const g = snapPoint(m, skipId, true);
    if (g || !snapOn()) return g;
    const r = SNAP_PX / V.z, p = [m[0], m[1]], guides = [];
    let bx = r, by = r, gx = null, gy = null;
    for (const it of items()) {
      if (it.sym !== '_text' || it.id === skipId) continue;
      const q = it.pts[0], dx = Math.abs(q[0] - m[0]), dy = Math.abs(q[1] - m[1]);
      if (dx < bx) { bx = dx; gx = q; }
      if (dy < by) { by = dy; gy = q; }
    }
    if (gx) p[0] = gx[0];
    if (gy) p[1] = gy[1];
    if (gx) guides.push([gx, p]);
    if (gy) guides.push([gy, p]);
    return guides.length ? { p, kind: 'align', guides } : null;
  }
  function lockTo(a, p) { // p carried onto the nearest 45-degree line through a
    const ang = Math.round(Math.atan2(p[1] - a[1], p[0] - a[0]) / (Math.PI / 4)) * (Math.PI / 4), ux = Math.cos(ang), uy = Math.sin(ang);
    const t = (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
    return [a[0] + ux * t, a[1] + uy * t];
  }
  function withLock(a, s, m) { // Shift held: the snapped point (or the bare cursor) locked to the first point a
    const from = s ? s.p : m, p = lockTo(a, from);
    return { p, kind: s ? s.kind : 'free', lock: a, from: s ? from : null };
  }
  // Where a click at m lands for the tool in hand: { p, s } with s the marker to show (or null).
  function aim(m) {
    const d = R.draft, n = d ? d.pts.length : 0;
    let s = null, from = null; // from: the point a Shift lock runs from
    if (isTextTool()) s = snapText(m);
    else if (isDimTool() || R.mode === 'cal') { // its two ends (a dimension's third click, where its line sits, is free)
      if (n >= 2) return { p: m, s: null };
      s = snapPoint(m); if (n === 1) from = d.pts[0];
    } else if (R.mode === 'draw' && R.tool) { // a symbol, a line's points, an area's corners
      s = snapPoint(m);
      const st = STYLE[R.tool];
      if (st && n && !byCorners(st)) from = d.pts[n - 1]; // Shift: the next edge level, plumb or 45 degrees
      else if (R.shift && n === 1 && boxy(st)) { const a = d.pts[0], q = s ? s.p : m; return { p: squareTo(a, q), s: { p: squareTo(a, q), kind: s ? s.kind : 'free', lock: a, from: s ? q : null } }; } // Shift: a square, a true circle
    } else return { p: m, s: null };
    if (R.shift && from) s = withLock(from, s, m);
    return { p: s ? s.p : m, s };
  }
  function drawSnap() { // the marker on the point the next click will take: a shape per kind, and its name
    const s = R.snap;
    if (!s) return '';
    const [x, y] = toScreen(s.p[0], s.p[1]), k = 6 * HR;
    const dash = (a, b, w) => { const A = toScreen(a[0], a[1]), B = toScreen(b[0], b[1]); return `<path d="M${fmt(A[0])} ${fmt(A[1])}L${fmt(B[0])} ${fmt(B[1])}" fill="none" stroke="#0a8f3c" stroke-width="${w}" stroke-dasharray="5 4"/>`; };
    let pre = '';
    if (s.lock) pre += dash(s.lock, s.p, 1.6) + (s.from ? dash(s.from, s.p, 1) : ''); // the locked line, and the point it was carried from
    if (s.guides) s.guides.forEach((g) => { pre += dash(g[0], g[1], 1.2); });
    const name = SNAP_NAMES[s.kind] + (s.lock ? (SNAP_NAMES[s.kind] ? ', locked' : 'Locked') : '');
    if (s.kind === 'free' || s.kind === 'align') {
      return `<g pointer-events="none">${pre}<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${k * 0.7}" fill="none" stroke="#fff" stroke-width="4.5"/><circle cx="${fmt(x)}" cy="${fmt(y)}" r="${k * 0.7}" fill="none" stroke="#0a8f3c" stroke-width="2"/>` +
        `<text x="${fmt(x + k + 5)}" y="${fmt(y + k + 12)}" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="11" fill="#0a8f3c" stroke="#fff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">${name}</text></g>`;
    }
    const shape = s.kind === 'end' || s.kind === 'pt' ? `M${fmt(x - k)} ${fmt(y - k)}h${2 * k}v${2 * k}h${-2 * k}Z`
      : s.kind === 'mid' ? `M${fmt(x)} ${fmt(y - k)}L${fmt(x + k)} ${fmt(y + k)}H${fmt(x - k)}Z`
      : s.kind === 'int' ? `M${fmt(x - k)} ${fmt(y - k)}l${2 * k} ${2 * k}M${fmt(x + k)} ${fmt(y - k)}l${-2 * k} ${2 * k}`
      : `M${fmt(x - k)} ${fmt(y - k)}h${2 * k}l${-2 * k} ${2 * k}h${2 * k}Z`;
    return `<g pointer-events="none">${pre}<path d="${shape}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round"/><path d="${shape}" fill="none" stroke="#0a8f3c" stroke-width="2" stroke-linejoin="round"/>` +
      `<text x="${fmt(x + k + 5)}" y="${fmt(y + k + 12)}" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="11" fill="#0a8f3c" stroke="#fff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">${name}</text></g>`;
  }

  // ---------- opening PDFs and images ----------
  function b64bytes(id) {
    const s = document.getElementById(id).textContent.replace(/\s+/g, '');
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  const blobUrl = (id) => URL.createObjectURL(new Blob([b64bytes(id)], { type: 'text/javascript' }));
  // PDF.js asks for its JPEG 2000 and JBIG2 decoders by file name; hand them over from this file.
  class EmbeddedWasm {
    async fetch({ filename }) {
      const id = { 'openjpeg.wasm': 'wasm-openjpeg', 'jbig2.wasm': 'wasm-jbig2' }[filename];
      if (!id || !document.getElementById(id)) throw new Error('No embedded ' + filename);
      return b64bytes(id);
    }
  }
  // PDF.js does its parsing in a background worker (a classic script, so it also starts when this file is opened
  // from disk). If the worker cannot start, the same script runs in the page instead: slower, but it works.
  function startWorker(url) {
    return new Promise((res) => {
      let w;
      try { w = new Worker(url); } catch (e) { res(null); return; }
      const done = (ok) => { clearTimeout(timer); w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); if (!ok) w.terminate(); res(ok ? w : null); };
      const onMsg = (m) => done(!!(m.data && m.data.action === 'ready'));
      const onErr = (e) => { e.preventDefault(); done(false); };
      const timer = setTimeout(() => done(false), 8000);
      w.addEventListener('message', onMsg); w.addEventListener('error', onErr);
    });
  }
  function runWorkerInPage(url) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = url; s.onload = () => (window.pdfjsWorker ? res() : rej(new Error('PDF support did not load')));
      s.onerror = () => rej(new Error('PDF support did not load'));
      document.head.appendChild(s);
    });
  }
  function loadPdfjs() { // one copy of PDF.js for all the tabs
    if (!document.getElementById('pdfjs-lib')) return Promise.reject(new Error('PDF support is missing from this copy of the file'));
    return window.__csPdfjsP || (window.__csPdfjsP = (async () => {
      const lib = await import(blobUrl('pdfjs-lib'));
      const workerUrl = blobUrl('pdfjs-worker');
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      const worker = await startWorker(workerUrl);
      if (worker) lib.GlobalWorkerOptions.workerPort = worker;
      else await runWorkerInPage(workerUrl); // PDF.js finds window.pdfjsWorker and uses it directly
      return lib;
    })().catch((e) => { window.__csPdfjsP = null; throw e; }));
  }

  // ---------- images the browser cannot read: TIFF, JPEG XL and HEIC, decoded by the embedded libraries ----------
  // Each library is started the first time a file needs it and shared by all the tabs. The result is a PNG, which
  // then opens like any other image.
  function runScript(id) { // an embedded classic script, run in the page
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = blobUrl(id); s.onload = res; s.onerror = () => rej(new Error('an embedded decoder did not load'));
      document.head.appendChild(s);
    });
  }
  const once = (key, start) => window[key] || (window[key] = start().catch((e) => { window[key] = null; throw e; }));
  function sniff(buf) { // the kind of file, from its first bytes
    const u = new Uint8Array(buf, 0, Math.min(32, buf.byteLength)), str = (a, b) => String.fromCharCode(...u.slice(a, b));
    if ((u[0] === 73 && u[1] === 73 && u[2] === 42 && u[3] === 0) || (u[0] === 77 && u[1] === 77 && u[2] === 0 && u[3] === 42)) return 'tiff';
    if ((u[0] === 255 && u[1] === 10) || (u[3] === 12 && str(4, 8) === 'JXL ')) return 'jxl';
    if (str(4, 8) === 'ftyp' && /^(hei[cxms]|hev[cmsx]|mif1|msf1)$/.test(str(8, 12))) return 'heic';
    return null;
  }
  function rgbaPng(rgba, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (!g) throw new Error('the image is too large for this browser');
    g.putImageData(new ImageData(rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), w, h), 0, 0);
    return toBlob(cv, 'image/png').finally(() => { cv.width = cv.height = 0; });
  }
  const DECODERS = {
    async tiff(buf) {
      await once('__csUtif', async () => { await runScript('dec-pako'); await runScript('dec-utif'); return true; });
      const U = window.UTIF, ifds = U.decode(buf).filter((d) => d.t256 && d.t257); // the pages; a file's first full image is used
      if (!ifds.length) throw new Error('the TIFF has no image in it');
      const page = ifds.reduce((a, b) => (b.t256[0] * b.t257[0] > a.t256[0] * a.t257[0] ? b : a));
      U.decodeImage(buf, page, ifds);
      if (!page.width || !page.height || !page.data) throw new Error('this kind of TIFF is not supported');
      return rgbaPng(U.toRGBA8(page), page.width, page.height);
    },
    async jxl(buf) {
      const m = await once('__csJxl', async () => { const mod = await import(blobUrl('dec-jxl-js')); await mod.default({ module_or_path: b64bytes('dec-jxl-wasm') }); return mod; });
      const im = new m.JxlImage();
      try {
        im.feedBytes(new Uint8Array(buf));
        if (!im.tryInit()) throw new Error('the JPEG XL file is incomplete');
        return new Blob([im.render().encodeToPng()], { type: 'image/png' }); // encodeToPng uses up the render result: freeing it again fails
      } finally { try { im.free(); } catch (e) { /* already released */ } }
    },
    async heic(buf) {
      const lib = await once('__csHeif', async () => {
        await runScript('dec-heif-js');
        return new Promise((res, rej) => { // the library may report ready before its call has returned
          let L = null, up = false;
          L = window.libheif({ wasmBinary: b64bytes('dec-heif-wasm'), onRuntimeInitialized: () => { up = true; if (L) res(L); }, onAbort: () => rej(new Error('the HEIC decoder did not start')) });
          if (up) res(L);
        });
      });
      const imgs = new lib.HeifDecoder().decode(new Uint8Array(buf));
      if (!imgs || !imgs.length) throw new Error('the HEIC file has no image in it');
      const im = imgs[0], w = im.get_width(), h = im.get_height();
      const data = await new Promise((res, rej) => im.display({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }, (d) => (d ? res(d) : rej(new Error('the HEIC image could not be decoded')))));
      imgs.forEach((x) => x.free && x.free());
      return rgbaPng(data.data, w, h);
    },
  };

  function idb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('IndexedDB unavailable')); return; }
      const r = indexedDB.open('siteLogistics', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function rememberFile(rec, fileKey) {
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(rec, fileKey || CFG.fileKey);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
      });
      db.close();
    } catch (e) { /* not kept: the drawing just won't reopen by itself next time */ }
  }
  async function recallFile(fileKey) { // this tab's last drawing, or another tab's by its key
    try {
      const db = await idb();
      const rec = await new Promise((res, rej) => {
        const q = db.transaction('files').objectStore('files').get(fileKey || CFG.fileKey);
        q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
      });
      db.close();
      return rec || null;
    } catch (e) { return null; }
  }

  function dropCanvas(cv) { if (cv) { cv.remove(); cv.width = cv.height = 0; } }
  function dropDetail() { if (D.detail) { dropCanvas(D.detail.cv); D.detail = null; } }
  function cancelRenders() {
    clearTimeout(R.detailTimer);
    [D.baseTask, D.detailTask].forEach((t) => { try { if (t) t.cancel(); } catch (e) {} });
    D.baseTask = D.detailTask = null;
  }
  function closeDoc() {
    D.docGen++; D.pageGen++;
    cancelRenders(); dropDetail(); dropCanvas(D.base); D.base = null;
    keepView(); if (PLAN) save();
    dropImg();
    if (D.url) { URL.revokeObjectURL(D.url); D.url = null; }
    D.src = null; D.rot = 0; D.w0 = D.h0 = 0; R.specId = null;
    if (D.pdf) { const p = D.pdf; D.pdf = null; D.closing = p.destroy().catch(() => {}); } // the next PDF waits for this
    D.pageObj = null; D.kind = null; D.ready = false; D.pages = 1; D.page = 1; D.set = null; PLAN = null;
    D.snap = null; D.snapBusy = false; R.snap = null;
    R.sel = null; R.draft = null; R.undo = [];
    R.ovlGen = (R.ovlGen || 0) + 1; if (D.ovl) { D.ovl.pics.forEach((x) => dropCanvas(x.cv)); D.ovl = null; } if (R.ovls) R.ovls.textContent = ''; // the page overlay goes with it
    setMode('pan'); fillInfo(); updateSide();
  }

  const isPdfBytes = (buf) => { const u = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength)); for (let i = 0; i + 4 < u.length; i++) if (u[i] === 37 && u[i + 1] === 80 && u[i + 2] === 68 && u[i + 3] === 70 && u[i + 4] === 45) return true; return false; };

  // ---------- a set of images: a .zip, a folder, or several files picked together ----------
  // A set opens like a PDF: one image per page, in name order, flipped through with the page buttons. Whatever way it
  // came in, it is held as one .zip (a folder or a multiple pick is packed into one here, uncompressed), so it is
  // remembered, shared between the tabs and reopened exactly like a single file. Each image is read out of the .zip
  // only when its page is shown.
  const IMG_EXT = /\.(png|jpe?g|jfif|gif|webp|bmp|avif|svg|ico|tiff?|jxl|heic|heif)$/i;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon' };
  const SET_MAX_BYTES = 1.5e9; // one buffer holds the set, and a browser will not give out much more than this
  const baseName = (p) => String(p).replace(/^.*[\\/]/, '');
  const extOf = (p) => ((/\.([a-z0-9]+)$/i.exec(p) || [])[1] || '').toLowerCase();
  const hiddenPath = (p) => /(^|[\\/])(__MACOSX|\.[^\\/]*)([\\/]|$)/.test(p); // Mac resource forks, dot files and dot folders
  const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); // page 2 before page 10
  const pageName = (n) => (D.set && D.set.entries[n - 1] ? baseName(D.set.entries[n - 1].name) : 'page ' + n);
  const isZipBytes = (buf) => { if (buf.byteLength < 4) return false; const u = new Uint8Array(buf, 0, 4); return u[0] === 0x50 && u[1] === 0x4b && (u[2] === 3 || u[2] === 5) && (u[3] === 4 || u[3] === 6); };
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipEntries(buf) { // the images in a .zip, in name order; `other` files and password-`locked` images are counted and left
    const dv = new DataView(buf), n = buf.byteLength;
    let e = -1;
    for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('it is not a .zip this tool can read (damaged, or cut short)');
    const count = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    if (count === 0xffff || p === 0xffffffff) throw new Error('the .zip is too large for this tool (over 4 GB, or more than 65,534 files)');
    const dec = new TextDecoder(), entries = [];
    let other = 0, locked = 0;
    for (let k = 0; k < count && p + 46 <= n && dv.getUint32(p, true) === 0x02014b50; k++) {
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nl));
      p += 46 + nl + xl + cl;
      if (name.endsWith('/') || hiddenPath(name)) continue;
      if (!IMG_EXT.test(name) || (method !== 0 && method !== 8) || csize === 0xffffffff || off === 0xffffffff) { other++; continue; }
      if (flags & 1) { locked++; continue; }
      entries.push({ name, method, csize, usize, off });
    }
    entries.sort((a, b) => byName(a.name, b.name));
    return { entries, other, locked };
  }
  async function zipRead(buf, en) { // one file's bytes out of the .zip
    const dv = new DataView(buf);
    if (en.off + 30 > buf.byteLength || dv.getUint32(en.off, true) !== 0x04034b50) throw new Error('the .zip is damaged');
    const start = en.off + 30 + dv.getUint16(en.off + 26, true) + dv.getUint16(en.off + 28, true);
    if (start + en.csize > buf.byteLength) throw new Error('the .zip is cut short');
    const raw = new Uint8Array(buf, start, en.csize);
    if (en.method === 0) return raw.slice().buffer;
    if (!window.DecompressionStream) throw new Error('this browser cannot unpack a compressed .zip');
    return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  }
  // A .zip, uncompressed, as the parts of a Blob: files = [{ name, data (Uint8Array or Blob), size, crc }].
  function zipParts(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const head = (sig, f, name, extra) => {
      const b = new Uint8Array((sig === 0x04034b50 ? 30 : 46) + name.length), dv = new DataView(b.buffer);
      let i = 0;
      dv.setUint32(i, sig, true); i += 4;
      if (extra != null) { dv.setUint16(i, 20, true); i += 2; }                     // made by
      dv.setUint16(i, 20, true); dv.setUint16(i + 2, 0x0800, true); dv.setUint16(i + 4, 0, true); i += 6; // needs 2.0, UTF-8 names, stored
      dv.setUint16(i, 0, true); dv.setUint16(i + 2, 0x21, true); i += 4;            // time, date (1980-01-01)
      dv.setUint32(i, f.crc, true); dv.setUint32(i + 4, f.size, true); dv.setUint32(i + 8, f.size, true); i += 12;
      dv.setUint16(i, name.length, true); i += 4;                                    // name length, no extra field
      if (extra != null) { i += 10; dv.setUint32(i, extra, true); i += 4; }         // comment, disk, attributes; then where the file starts
      b.set(name, i);
      return b;
    };
    for (const f of files) {
      const name = enc.encode(f.name);
      if (f.size > 0xfffffffe || off > 0xfffffffe) throw new Error('that is more than a .zip made here can hold (4 GB)');
      const h = head(0x04034b50, f, name, null);
      central.push(head(0x02014b50, f, name, off));
      parts.push(h, f.data); off += h.length + f.size;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0), end = new Uint8Array(22), dv = new DataView(end.buffer);
    if (files.length > 0xfffe || off + cdSize > 0xfffffffe) throw new Error('that is more than a .zip made here can hold (4 GB, 65,534 files)');
    dv.setUint32(0, 0x06054b50, true); dv.setUint16(8, files.length, true); dv.setUint16(10, files.length, true);
    dv.setUint32(12, cdSize, true); dv.setUint32(16, off, true);
    return parts.concat(central, [end]);
  }
  // Several files (a folder, a multiple pick, a dropped folder) as one drawing: list = [{ file, path }].
  async function openFiles(list, folder) {
    if (R.exporting) return;
    if (list.length === 1 && !folder) { openFile(list[0].file); return; }
    const imgs = list.filter((x) => IMG_EXT.test(x.path) && !hiddenPath(x.path)).sort((a, b) => byName(a.path, b.path));
    if (!imgs.length) {
      const one = list.find((x) => /\.(pdf|zip)$/i.test(x.path));
      if (one) { openFile(one.file); return; }
      toast(folder ? 'There are no images in that folder.' : 'None of those files is an image.', 'err'); return;
    }
    const total = imgs.reduce((a, x) => a + x.file.size, 0);
    if (total > SET_MAX_BYTES) { toast(`Those ${imgs.length} images come to ${(total / 1e9).toFixed(1)} GB; this tool holds up to ${(SET_MAX_BYTES / 1e9).toFixed(1)} GB in one set. Open fewer at a time.`, 'err'); return; }
    busy(`Reading ${imgs.length} images…`);
    try {
      const files = [];
      for (const x of imgs) { const u8 = new Uint8Array(await x.file.arrayBuffer()); files.push({ name: x.path, data: u8, size: u8.length, crc: crc32(u8) }); }
      const buf = await new Blob(zipParts(files)).arrayBuffer();
      busy(null);
      await openFile({ name: (folder || `${imgs.length} images`) + '.zip', type: 'application/zip', data: buf });
      const skipped = list.length - imgs.length;
      if (D.set && skipped) toast(`Opened ${imgs.length} images; ${skipped} other file${skipped === 1 ? ' was' : 's were'} left out.`);
    } catch (e) { busy(null); toast('Could not read those images: ' + ((e && e.message) || e), 'err'); }
  }
  // A dropped folder, walked to its files (a drop hands over folder entries, not files).
  async function dropList(entries) {
    const out = [];
    const walk = async (en, path) => {
      if (en.isFile) { const file = await new Promise((res, rej) => en.file(res, rej)); out.push({ file, path: path + file.name }); return; }
      const rd = en.createReader();
      for (;;) { const batch = await new Promise((res, rej) => rd.readEntries(res, rej)); if (!batch.length) break; for (const c of batch) await walk(c, path + en.name + '/'); }
    };
    const dirs = entries.filter((en) => en.isDirectory);
    for (const en of entries) {
      if (en.isFile) await walk(en, '');
      else { const rd = en.createReader(); for (;;) { const batch = await new Promise((res, rej) => rd.readEntries(res, rej)); if (!batch.length) break; for (const c of batch) await walk(c, dirs.length > 1 ? en.name + '/' : ''); } }
    }
    return { list: out, folder: dirs.length === 1 ? dirs[0].name : dirs.length ? `${dirs.length} folders` : '' };
  }
  // One image, from its bytes: what the browser decodes itself, or TIFF, JPEG XL and HEIC through the embedded decoders.
  async function loadImage(buf, type, name, gen) {
    let url = URL.createObjectURL(new Blob([buf], { type: type || MIME[extOf(name)] || 'image/png' }));
    const img = new Image();
    img.alt = ''; img.draggable = false; img.src = url;
    let read = await img.decode().then(() => true, () => false);
    const kind = !read && sniff(buf); // the browser cannot read it: TIFF, JPEG XL and HEIC have their own decoders here
    if (kind) {
      URL.revokeObjectURL(url);
      if (gen === D.docGen) busy('Decoding ' + name + '…');
      let png;
      try { png = await DECODERS[kind](buf); }
      catch (e) { throw new Error('could not decode it as ' + { tiff: 'TIFF', jxl: 'JPEG XL', heic: 'HEIC' }[kind] + ' (' + ((e && e.message) || e) + ')'); }
      url = URL.createObjectURL(png); img.src = url;
      read = await img.decode().then(() => true, () => false);
    }
    if (!read) {
      URL.revokeObjectURL(url);
      const ext = extOf(name);
      // a kind every browser reads, yet it would not decode: the file itself is the problem
      if (/^(png|jpe?g|gif|webp|bmp|svg|avif|ico|tiff?|jxl|heic|heif)$/i.test(ext)) throw new Error(`the file is damaged, or is not really a .${ext} image`);
      throw new Error(/^image\//.test(type) || /^(jp2|j2k|psd|raw|dng)$/i.test(ext)
        ? `this browser cannot read ${ext ? '.' + ext : 'that kind of'} images; save it as PNG, JPEG or PDF and open that`
        : 'it is not a PDF or an image');
    }
    if (!img.naturalWidth || !img.naturalHeight) { URL.revokeObjectURL(url); throw new Error('the image has no size'); }
    return { img, url };
  }
  async function blankImage(text) { // stands in for an image of a set that would not open, so the set still flips and exports
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800;
    const g = cv.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 1200, 800); g.strokeStyle = '#999'; g.lineWidth = 4; g.strokeRect(2, 2, 1196, 796);
    g.fillStyle = '#555'; g.font = '700 28px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.fillText(text, 600, 400, 1100);
    const url = URL.createObjectURL(await toBlob(cv, 'image/png'));
    const img = new Image(); img.alt = ''; img.draggable = false; img.src = url;
    await img.decode();
    return { img, url };
  }

  async function openFile(file, restoring) {
    if (R.exporting) { toast('Wait for the export to finish.', 'err'); return; }
    const name = file.name || 'drawing';
    let buf;
    try { buf = file.data || await file.arrayBuffer(); }
    catch (e) { toast('Could not read ' + name + '.', 'err'); return; }
    const type = file.type || '';
    const isPdf = !isZipBytes(buf) && (type === 'application/pdf' || /\.pdf$/i.test(name) || isPdfBytes(buf));
    // Anything else is tried as an image: whatever this browser can decode opens (PNG, JPEG, WebP, GIF, BMP, AVIF, SVG,
    // ICO), and TIFF, JPEG XL and HEIC go through the embedded decoders where the browser does not read them itself.
    closeDoc();
    const gen = D.docGen;
    busy('Opening ' + name + '…');
    try {
      if (isPdf) {
        const lib = await loadPdfjs();
        await D.closing; // PDF.js cannot start a document while the previous one is still closing on the shared worker
        if (gen !== D.docGen) return;
        const task = lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false, WasmFactory: EmbeddedWasm, useWorkerFetch: false });
        task.onPassword = async (give, reason) => {
          const p = await csAsk(reason === 2 ? 'Wrong password. Try again:' : name + ' is protected. Password:', '', true);
          if (p == null) task.destroy(); else give(p);
        };
        const pdf = await task.promise;
        if (gen !== D.docGen) { pdf.destroy(); return; }
        D.kind = 'pdf'; D.pdf = pdf; D.pages = pdf.numPages;
      } else if (isZipBytes(buf)) {
        const z = zipEntries(buf);
        if (!z.entries.length) throw new Error(z.locked ? 'its images are password-protected' : 'there are no images in it');
        D.kind = 'img'; D.set = { buf, entries: z.entries, other: z.other, locked: z.locked, bad: {} }; D.pages = z.entries.length; D.w = D.h = 1;
      } else {
        const im = await loadImage(buf, type, name, gen);
        if (gen !== D.docGen) { URL.revokeObjectURL(im.url); return; }
        D.kind = 'img'; D.src = im.img; D.url = im.url; D.w = im.img.naturalWidth; D.h = im.img.naturalHeight; D.pages = 1; // showPage puts it on screen
      }
      D.name = D.set ? name.replace(/\.zip$/i, '') : name; D.key = file.key || name + '|' + buf.byteLength;
      syncPlans(); // its plan as last stored, by this window or another
      PLAN = store.plans[D.key] || (store.plans[D.key] = legacyPlan(name, D.key) || newPlan(name)); // first time with layers: the tabs' work, together
      PLAN.info = Object.assign(newPlan(name).info, PLAN.info || {});
      if (!PLAN.layers || typeof PLAN.layers !== 'object') PLAN.layers = {};
      englishPlan(PLAN); // text saved here before the tool went English-only
      if (!PLAN.sheetScale) PLAN.sheetScale = 'auto';
      PLAN.symSize = SYM_SIZES.some((x) => x[0] === PLAN.symSize) ? PLAN.symSize : DEFAULT_SYM_SIZE; // as loadPlanFile does
      PLAN.used = Date.now(); store.last = D.key; prunePlans(); save();
      if (!restoring) { // opened by hand: it is now the drawing every tab shows
        csShared.rec = { key: D.key, name, type, data: buf };
        csShared.page = PLAN.page || 1;
        rememberFile(csShared.rec, 'shared'); csSharedSave();
      }
      takeSharedScale();
      fillInfo();
      busy(null);
      await showPage((csShared.rec && csShared.rec.key === D.key ? csShared.page : PLAN.page) || 1, true);
      if (PLAN.items.length && !restoring) toast('Reopened your markup for ' + D.name + '.');
      else if (D.set && !restoring && (D.set.other || D.set.locked)) toast(`Opened ${D.pages} images from ${D.name}; ${D.set.other + D.set.locked} other or locked file${D.set.other + D.set.locked === 1 ? ' was' : 's were'} left out.`);
      else if (R.toast && R.toast.classList.contains('cs-err')) R.toast.style.display = 'none'; // an earlier file's error no longer applies
    } catch (err) {
      if (gen !== D.docGen) return; // a newer file is already opening: its messages stand
      closeDoc(); busy(null); // closeDoc moves the count on, so the line below would leave "Opening…" up for good
      toast('Could not open ' + name + ': ' + ((err && err.message) || err), 'err');
    } finally { if (gen === D.docGen) busy(null); }
  }

  // The page's drawing itself: a PDF page, or the nth image of a set. show: put the image on screen (an export only reads it).
  async function loadPage(n, gen, show) {
    if (D.kind === 'pdf') {
      const page = await D.pdf.getPage(n);
      if (gen !== D.pageGen) return false;
      D.rot = 0; const v0 = pdfVp(page, 1);
      D.rot = sharedRot(n); const vp = pdfVp(page, 1);
      D.pageObj = page; D.w0 = v0.width; D.h0 = v0.height; D.w = vp.width; D.h = vp.height;
    } else if (!D.set) { // a lone image
      D.rot = sharedRot(n); putImage(D.src, show);
    } else {
      const en = D.set.entries[n - 1], nm = baseName(en.name);
      let im;
      try { im = await loadImage(await zipRead(D.set.buf, en), '', nm, D.docGen); }
      catch (e) {
        const why = (e && e.message) || String(e);
        D.set.bad[n] = why; im = await blankImage(nm + ' could not be opened');
        if (show) toast('Could not open ' + nm + ': ' + why, 'err');
      }
      if (gen !== D.pageGen || !D.set) { URL.revokeObjectURL(im.url); return false; }
      dropImg();
      if (D.url) URL.revokeObjectURL(D.url);
      D.url = im.url; D.rot = sharedRot(n); putImage(im.img, show);
    }
    return true;
  }
  // restore: the export putting back the page that was showing. Any other page change waits for the export: a page
  // change during a single-page export put that page's markup, legend and notes over the first page's picture.
  async function showPage(n, fit, restore) {
    if (R.batch) return;
    if (R.exporting && !restore) { toast('Wait for the export to finish.', 'err'); if (R.pageSel) R.pageSel.value = String(D.page); return; }
    n = Math.max(1, Math.min(D.pages, Math.round(n) || 1));
    keepView(); // how the page being left looked
    const gen = ++D.pageGen;
    D.snap = null; D.snapBusy = false; R.snap = null; // another page: its lines are read when the Dimension tool next needs them
    if (D.kind === 'pdf') { cancelRenders(); dropDetail(); dropCanvas(D.base); D.base = null; }
    if (D.set) busy('Opening ' + pageName(n) + '…');
    const ok = await loadPage(n, gen, true);
    if (D.set && gen === D.pageGen) busy(null);
    if (!ok) return;
    D.page = n; PLAN.page = n; alignHere(); syncCraneReach(); save();
    if (csShared.rec && csShared.rec.key === D.key && csShared.page !== n) { csShared.page = n; csSharedSave(); } // the other tabs follow
    R.page.style.width = D.w + 'px'; R.page.style.height = D.h + 'px';
    D.ready = true; R.sel = null; R.draft = null;
    if (R.mode === 'draw' || R.mode === 'cal') setMode('pan');
    if (fit) restoreView(); // as this page was left; whole, the first time
    updateSide(); updateUi(); dirty();
    renderOverlays(); // the other pages laid over this one (another page, or this one turned)
    if (D.kind === 'pdf') await renderBase(gen);
  }

  // The whole page once, at a size the device can hold; zoomed-in views get a sharper copy of just the visible part.
  async function renderBase(gen) {
    const page = D.pageObj;
    const maxA = COARSE ? 5e6 : 1.2e7, maxS = COARSE ? 4096 : 8192;
    const rb = Math.min(maxS / Math.max(D.w, D.h), Math.sqrt(maxA / (D.w * D.h)), 6);
    const cv = document.createElement('canvas');
    cv.className = 'cs-base'; cv.width = Math.max(1, Math.round(D.w * rb)); cv.height = Math.max(1, Math.round(D.h * rb));
    const task = page.render({ canvas: cv, viewport: pdfVp(page, rb) });
    D.baseTask = task;
    busy('Drawing page ' + D.page + '…');
    try { await task.promise; }
    catch (e) {
      dropCanvas(cv);
      if (gen === D.pageGen && !(e && e.name === 'RenderingCancelledException')) toast('Could not draw this page: ' + ((e && e.message) || e), 'err');
      return;
    } finally { if (gen === D.pageGen) busy(null); }
    if (gen !== D.pageGen) { dropCanvas(cv); return; }
    D.baseTask = null;
    dropCanvas(D.base); D.base = cv; D.rb = rb;
    R.page.insertBefore(cv, R.page.firstChild);
    scheduleDetail();
  }
  function scheduleDetail() {
    if (D.kind !== 'pdf' || !D.base) return;
    clearTimeout(R.detailTimer);
    R.detailTimer = setTimeout(renderDetail, 180);
  }
  async function renderDetail() {
    if (D.kind !== 'pdf' || !D.pageObj || !D.base || !V.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let rd = V.z * dpr;
    if (rd <= D.rb * 1.05) { dropDetail(); return; } // the whole-page copy is sharp enough
    const a = toMap(-64, -64), b = toMap(V.w + 64, V.h + 64);
    const x0 = Math.max(0, a[0]), y0 = Math.max(0, a[1]), x1 = Math.min(D.w, b[0]), y1 = Math.min(D.h, b[1]);
    if (x1 <= x0 || y1 <= y0) return;
    const maxA = COARSE ? 5e6 : 9e6, area = (x1 - x0) * (y1 - y0) * rd * rd;
    if (area > maxA) rd *= Math.sqrt(maxA / area);
    if (rd <= D.rb * 1.05) return;
    const d = D.detail;
    if (d && d.rd >= rd * 0.98 && d.rd <= rd * 1.6 && d.x0 <= x0 + 0.5 && d.y0 <= y0 + 0.5 && d.x1 >= x1 - 0.5 && d.y1 >= y1 - 0.5) return;
    if (D.detailTask) { try { D.detailTask.cancel(); } catch (e) {} D.detailTask = null; }
    const gen = D.pageGen;
    const cv = document.createElement('canvas');
    cv.className = 'cs-detail'; cv.width = Math.max(1, Math.ceil((x1 - x0) * rd)); cv.height = Math.max(1, Math.ceil((y1 - y0) * rd));
    const task = D.pageObj.render({ canvas: cv, viewport: pdfVp(D.pageObj, rd), transform: [1, 0, 0, 1, -x0 * rd, -y0 * rd] });
    D.detailTask = task;
    try { await task.promise; } catch (e) { dropCanvas(cv); return; }
    if (D.detailTask !== task || gen !== D.pageGen) { dropCanvas(cv); return; }
    D.detailTask = null;
    const cs = cv.style;
    cs.left = x0 + 'px'; cs.top = y0 + 'px'; cs.width = cv.width / rd + 'px'; cs.height = cv.height / rd + 'px';
    dropDetail();
    R.page.insertBefore(cv, R.fade);
    D.detail = { cv, rd, x0, y0, x1, y1 };
  }

  // ---------- scale ----------
  function parseDistance(v) {
    if (v == null) return null;
    const m = /^\s*([0-9]*[.,]?[0-9]+)\s*(m|metres?|meters?|ft|feet|foot|'|’)?\s*$/i.exec(String(v));
    if (!m) return null;
    const n = parseFloat(m[1].replace(',', '.'));
    if (!(n > 0)) return null;
    return /^(ft|feet|foot|'|’)$/i.test(m[2] || '') ? n * 0.3048 : n;
  }
  function calClick(m) {
    if (!R.draft) { R.draft = { pts: [m] }; R.cursor = m; dirty(); updateUi(); return; }
    const a = R.draft.pts[0], dist = Math.hypot(m[0] - a[0], m[1] - a[1]);
    if (dist * V.z < (R.tapTouch ? 24 : 8)) { // the same spot again (a double-click or -tap): the first point stays, pick the second
      if (!(R.tapGap < 450)) toast('Too close to the first point: zoom in, or pick a point further away.', 'err');
      R.cursor = m; dirty(); return;
    }
    R.draft = { pts: [a, m] }; R.cursor = null; dirty();
    setTimeout(async () => { // let the line show before the question
      const v = await csAsk('Real distance between the two points, in metres (add ft for feet, e.g. 40 ft):', '');
      const metres = parseDistance(v);
      if (metres) { pageCfg().mpu = metres / dist; delete pageCfg().cleared; save(); shareScale(String(D.page)); syncCraneReach(); toast('Scale set: ' + scaleText() + '.'); }
      else if (v != null) toast('Could not read "' + v + '". Try again, e.g. 25 or 80 ft.', 'err');
      R.draft = null; setMode('pan'); updateSide(); dirty();
    }, 60);
  }
  async function askRatio() {
    if (D.kind !== 'pdf') return;
    const cur = mpu() ? Math.round(mpu() / PT_M) : '';
    const v = await csAsk('Drawing scale at full page size. Enter N for 1:N (e.g. 200 for 1:200; 1/8" = 1\'-0" is 96):', cur);
    if (v == null) return;
    const n = parseFloat(String(v).replace(/^\s*1\s*:\s*/, ''));
    if (!(n > 0)) { toast('Enter a number, e.g. 200 for 1:200.', 'err'); return; }
    pageCfg().mpu = n * PT_M; delete pageCfg().cleared; save(); shareScale(String(D.page)); syncCraneReach(); updateSide(); dirty();
    toast('Scale set: ' + scaleText() + '.');
  }
  function scaleText() {
    const m = mpu();
    if (!m) return 'not set';
    if (D.kind === 'pdf') return '1:' + Math.round(m / PT_M).toLocaleString() + ' at full page size';
    const ppm = 1 / m;
    return (ppm >= 10 ? Math.round(ppm) : ppm.toFixed(2)) + ' image pixels per metre';
  }

  // ---------- editing ----------
  function pushUndo() { R.undo.push(JSON.stringify(PLAN.items)); if (R.undo.length > 60) R.undo.shift(); }
  function undo() { // a locked layer's items stay as they are now: an undo from before it was locked does not reach them
    const j = R.undo.pop(); if (!j || !PLAN) return;
    const was = JSON.parse(j), lockedNow = PLAN.items.filter((i) => layerLocked(layerOf(i)));
    PLAN.items = was.filter((i) => !layerLocked(layerOf(i))).concat(lockedNow);
    R.sel = null; syncCraneReach(); save(); dirty(); // a crane's reach follows its jib again
  }
  const selLocked = () => { const it = R.sel && find(R.sel); return !!(it && layerLocked(layerOf(it))); };
  function delSel() { if (!R.sel || selLocked()) return; pushUndo(); PLAN.items = PLAN.items.filter((i) => i.id !== R.sel); R.sel = null; save(); dirty(); }
  function dupSel() {
    const it = R.sel && find(R.sel); if (!it || selLocked()) return;
    pushUndo(); const off = 24 / V.z;
    const c = JSON.parse(JSON.stringify(it)); c.id = uid(); c.pts = it.pts.map((p) => [p[0] + off, p[1] + off]);
    PLAN.items.push(c); R.sel = c.id; save(); dirty();
  }
  async function clearAll() {
    // the shown, unlocked layers only: a hidden layer's markup cannot be seen, so it is not cleared unseen, and a
    // locked one's is kept as it is
    const open = (id) => layerOn(id) && !layerLocked(id), here = (id) => PLAN.items.some((i) => i.pg === D.page && layerOf(i) === id);
    const on = LAYERS.filter((l) => open(l.id) && here(l.id)).map((l) => l.label);
    const hid = LAYERS.filter((l) => !layerOn(l.id) && here(l.id)).map((l) => l.label), lck = LAYERS.filter((l) => layerOn(l.id) && layerLocked(l.id) && here(l.id)).map((l) => l.label);
    if (!on.length) { if (items().length) toast(`Nothing to clear: ${lck.join(', ')} ${lck.length === 1 ? 'is' : 'are'} locked.`, 'err'); return; }
    if (!(await csConfirm(`Remove everything on this page on ${on.length === 1 ? 'the ' + on[0] + ' layer' : 'these layers: ' + on.join(', ')}?` +
      (hid.length ? ` Hidden layers (${hid.join(', ')}) keep theirs.` : '') + (lck.length ? ` Locked layers (${lck.join(', ')}) keep theirs.` : '')))) return;
    pushUndo(); PLAN.items = PLAN.items.filter((i) => i.pg !== D.page || !open(layerOf(i))); R.sel = null; R.draft = null; save(); dirty(); updateUi();
  }
  function addItem(sym, pts, extra) {
    const layer = R.lyr && LAYER[R.lyr] ? R.lyr : homeLayer(sym); // the layer of the legend row picked (arm)
    pushUndo(); const it = Object.assign({ id: uid(), sym, pg: D.page, pts, layer }, extra); PLAN.items.push(it); R.sel = null; save(); dirty();
    if (ZONE_SYM[sym]) { setMode('select'); R.sel = it.id; dirty(); updateUi(); } // back to select so the new zone can be reshaped
    return it;
  }
  function finishDraft() {
    const st = STYLE[R.tool], d = R.draft;
    if (!st || !d) return;
    if (st.kind === 'area' && !byCorners(st) && d.pts.length && d.pts.length < 3) { toast('An area needs at least 3 corners: click the next corner.', 'err'); dirty(); return; } // kept, not thrown away
    if (st.kind === 'line' && !st.dim && d.pts.length === 1) { toast('A line needs at least 2 points: click the next point.', 'err'); dirty(); return; }
    if (st.kind === 'line' && d.pts.length >= 2) addItem(R.tool, d.pts);
    else if (st.kind === 'area' && !byCorners(st) && d.pts.length >= 3) addItem(R.tool, d.pts, st.note ? newShapeStyle() : null);
    R.draft = null; dirty();
  }
  async function editText(it) {
    const v = await csAsk('Label text:', it.text || '');
    if (v == null) return;
    const t = cleanText(v, 120);
    if (t) { pushUndo(); it.text = t; save(); dirty(); }
  }
  // A text label's colour, angle and height, from the toolbar: the selected label's; with none selected, what the next
  // labels placed with the Text tool get (R.tcol, R.trot, R.tsize, kept while the tool is open). live: still being dragged or typed, so
  // one undo covers the whole change (R.tUndo) until the control is let go.
  const textTarget = () => { const it = R.mode === 'select' && R.sel && find(R.sel); return it && it.sym === '_text' ? it : null; };
  const textRotNow = () => { const it = textTarget(); return it ? labelRot(it) : labelRot({ rot: R.trot }); };
  // A shape's colour (Box, Circle, Cloud), from the same 9 colours: the selected shape's, or the next shapes' (R.scol,
  // kept apart from the labels' so a red cloud does not turn the next label red)
  const shapeTarget = () => { const it = R.mode === 'select' && R.sel && find(R.sel); return it && (STYLE[it.sym] || {}).note ? it : null; };
  const shapeTool = () => R.mode === 'draw' && !!(STYLE[R.tool] || {}).note;
  const shapeColNow = () => R.scol || LABEL_INK;
  const newShapeStyle = () => (R.scol && R.scol !== LABEL_INK ? { color: R.scol } : null);
  function setTextStyle(ch, live) {
    const sh = shapeTarget();
    if ('color' in ch && (sh || shapeTool())) {
      R.scol = /^#[0-9a-f]{6}$/i.test(ch.color) ? ch.color.toLowerCase() : LABEL_INK;
      if (sh && labelColor(sh) !== R.scol) { pushUndo(); if (R.scol === LABEL_INK) delete sh.color; else sh.color = R.scol; save(); }
      dirty(); updateUi(); return;
    }
    if ('color' in ch) R.tcol = /^#[0-9a-f]{6}$/i.test(ch.color) ? ch.color.toLowerCase() : LABEL_INK;
    if ('rot' in ch) R.trot = labelRot({ rot: ch.rot });
    if ('size' in ch) R.tsize = labelH({ size: ch.size });
    const it = textTarget();
    if (it) {
      if (!R.tUndo) { pushUndo(); R.tUndo = true; }
      if ('color' in ch) { if (R.tcol === LABEL_INK) delete it.color; else it.color = R.tcol; }
      if ('rot' in ch) { if (R.trot) it.rot = R.trot; else delete it.rot; }
      if ('size' in ch) { if (R.tsize === LABEL_H0) delete it.size; else it.size = R.tsize; }
      save(); dirty();
    }
    if (!live) R.tUndo = false;
    if (!live || !('rot' in ch)) updateUi(); // the angle box is left alone while it is typed in
  }
  const newLabelStyle = () => Object.assign({}, R.tcol && R.tcol !== LABEL_INK ? { color: R.tcol } : {}, labelRot({ rot: R.trot }) ? { rot: labelRot({ rot: R.trot }) } : {},
    labelH({ size: R.tsize }) !== LABEL_H0 ? { size: labelH({ size: R.tsize }) } : {});
  // A length typed in metres or in feet and inches: "12.2", "12.2 m", "12200 mm", "40'", "40 ft", "40'-6\"", "40' 6",
  // "486 in". A bare number is metres. null if it is not a length.
  function parseLength(v) {
    const t = String(v == null ? '' : v).trim().toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"').replace(/,/g, '.');
    let m = /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*-?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/.exec(t);
    if (m) { const n = +m[1] * 0.3048 + (m[2] ? +m[2] * 0.0254 : 0); return n > 0 ? n : null; }
    m = /^(\d*\.?\d+)\s*(mm|cm|m|metres?|meters?|"|in|inch|inches)?$/.exec(t);
    if (!m) return null;
    const n = +m[1] * ({ mm: 0.001, cm: 0.01, '"': 0.0254, in: 0.0254, inch: 0.0254, inches: 0.0254 }[m[2]] || 1);
    return n > 0 ? n : null;
  }
  const ftIn = (metres) => { const ft = metres / 0.3048; let f = Math.floor(ft), inch = Math.round((ft - f) * 12); if (inch === 12) { f += 1; inch = 0; } return `${f}'-${inch}"`; };
  const TRAILER0 = { l: 40 * 0.3048, w: 10 * 0.3048, a: 0, ft: 1 }; // 40' x 10', level, until a size is typed
  // a trailer's corners about its centre c: its length along the angle (degrees anticlockwise as seen; screen y is
  // down), its width across. All in drawing units.
  function trailerPts(c, l, w, deg) {
    const r = (deg * Math.PI) / 180, ux = Math.cos(r), uy = -Math.sin(r), vx = -uy, vy = ux;
    return [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]].map(([x, y]) => [c[0] + x * ux + y * vx, c[1] + x * uy + y * vy]);
  }
  // a placed trailer as { c, l, w, a, ft }: its centre (drawing units), length and width in metres (as drawn at this
  // page's scale), angle in degrees anticlockwise (-180 to 180), and whether its size was typed in feet
  function trailerOf(it, m) {
    m = m || mpu();
    const P = it.pts; if (!P || P.length !== 4 || !m) return null;
    const c = [(P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2];
    const a = (Math.atan2(-(P[1][1] - P[0][1]), P[1][0] - P[0][0]) * 180) / Math.PI;
    return { c, l: Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]) * m, w: Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]) * m, a: Math.round(a * 100) / 100, ft: !!(it.dims && it.dims.ft) };
  }
  const trailerText = (t) => (t.ft ? `${ftIn(t.l)} × ${ftIn(t.w)} (${t.l.toFixed(2)} × ${t.w.toFixed(2)} m)` : `${t.l.toFixed(2)} × ${t.w.toFixed(2)} m (${ftIn(t.l)} × ${ftIn(t.w)})`) +
    (Math.abs(t.a) > 0.005 ? `, ${+t.a.toFixed(1)}°` : '');
  function trailerTag(it, P) { // the selected trailer's size, written above it
    const t = trailerOf(it);
    if (!t) return '';
    const x = (P[0][0] + P[2][0]) / 2, y = Math.min(...P.map((p) => p[1])) - 9 * HR;
    return `<text pointer-events="none" x="${fmt(x)}" y="${fmt(y)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#111" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(trailerText(t))}</text>`;
  }
  function trailerGhost() { // the Site Trailer tool in hand: its outline at the cursor, at the size it will be placed
    const st = R.mode === 'draw' && STYLE[R.tool], m = mpu();
    if (!st || !st.trailer || !R.hover || !m) return '';
    const c = R.snap ? R.snap.p : toMap(...R.hover), t = R.tlast || TRAILER0, P = trailerPts(c, t.l / m, t.w / m, t.a).map((p) => toScreen(p[0], p[1]));
    return `<path pointer-events="none" d="${pathD(P, true)}" fill="#000" fill-opacity=".3" stroke="#000" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  }
  async function editTrailer(it) {
    if (!mpu()) { toast('Set the drawing scale first (Drawing panel, Calibrate or Enter 1:N) to size the trailer in metres or feet.', 'err'); return; }
    if (selLocked()) return;
    const t = trailerOf(it), show = (x) => (t.ft ? ftIn(x) : `${+x.toFixed(2)} m`);
    const v = await csAsk('Site trailer: length and width in metres (12.2) or feet and inches (40\' or 40\'-6"); angle in degrees, anticlockwise (0 = level).',
      [['Length', show(t.l)], ['Width', show(t.w)], ['Angle (°)', String(+t.a.toFixed(1))]]);
    if (!v) return;
    const l = parseLength(v[0]), w = parseLength(v[1]), a = parseFloat(String(v[2]).replace(',', '.'));
    if (!l || !w || l > 300 || w > 300) { toast('Type the length and width in metres (12.2) or in feet and inches (40\'-6"), each up to 300 m.', 'err'); return; }
    if (!Number.isFinite(a)) { toast('Type the angle in degrees, anticlockwise (0 = level).', 'err'); return; }
    const m = mpu(), now = find(it.id) && trailerOf(it, m); // as it is now (the page may have been turned while typing)
    if (!now) return;
    const ft = /['"]|ft|feet|foot|in\b|inch/i.test(v[0] + ' ' + v[1]), ang = ((((a + 180) % 360) + 360) % 360) - 180;
    pushUndo();
    it.dims = Object.assign({ l, w }, ft ? { ft: 1 } : {});
    it.pts = trailerPts(now.c, l / m, w / m, ang);
    R.tlast = { l, w, a: ang, ft }; // the next trailers placed take this size and angle
    save(); dirty(); updateUi();
    toast(`Site trailer: ${trailerText(trailerOf(it))}. The next trailers placed take this size.`);
  }
  async function editCraneRadius(it) {
    const m = mpu();
    if (!m) { toast('Set the drawing scale first (Drawing panel, Scale) to type the reach in metres.', 'err'); return; }
    const v = await csAsk('Crane radius in metres', Math.round(it.r * m * 10) / 10);
    const n = parseFloat(v);
    if (n > 0) { pushUndo(); it.r = n / m; if (it.spec) it.spec.jib = n; save(); dirty(); updateUi(); } // the reach is the jib length
  }

  function onMapClick(px, py) {
    const raw = toMap(px, py), m = aims() ? aim(raw).p : raw; // Calibrate's and every drawing tool's clicks are aimed (snap, Shift lock)
    if (aims()) R.snap = null;
    if (R.mode === 'cal') { calClick(m); return; }
    if (R.mode === 'select') { R.sel = null; dirty(); updateUi(); return; }
    if (R.mode !== 'draw' || !R.tool) return;
    if (R.tool === '_text') { // a text label: ask for the words, then place it
      const rot0 = D.rot, pg0 = D.page;
      csAsk('Label text:', '').then((v) => {
        v = cleanText(v, 120);
        if (v && (D.rot !== rot0 || D.page !== pg0)) { toast('The page was turned or changed while the label was typed: click where it goes again.', 'err'); return; }
        if (v) addItem('_text', [m], Object.assign({ text: v }, newLabelStyle())); updateUi();
      });
      return;
    }
    const st = STYLE[R.tool];
    if (!st) { addItem(R.tool, [m], isCrane(R.tool) ? { r: mpu() ? DEFAULT_CRANE_RADIUS_M / mpu() : 120 / V.z } : null); return; }
    if (st.trailer) { // a site trailer: at its real size, centred on the click, at the size and angle last typed
      const mm = mpu();
      if (!mm) { toast('Set the drawing scale first (Drawing panel, Calibrate or Enter 1:N): a site trailer is drawn at its real size.', 'err'); return; }
      const t = R.tlast || TRAILER0;
      addItem(R.tool, trailerPts(m, t.l / mm, t.w / mm, t.a), { dims: Object.assign({ l: t.l, w: t.w }, t.ft ? { ft: 1 } : {}) });
      R.cursor = m; dirty(); updateUi(); return;
    }
    if (!R.draft) R.draft = { pts: [] };
    // R.pushed: whether this click added a point (onDoubleTap takes back only one that did). A rectangle's second
    // corner within a tap's reach of its first (8 px, 24 px by touch) is the same spot clicked again, not a flat
    // rectangle; a line or area point is skipped only on the very spot of the last one (2 px), so narrow strips and
    // short jogs can be drawn at any zoom (review, 2026-11-17).
    const tol = R.tapTouch ? 24 : 8, near = (q, t) => !!q && Math.hypot(m[0] - q[0], m[1] - q[1]) * V.z < (t || tol);
    R.pushed = false;
    if (byCorners(st)) {
      if (!R.draft.pts.length) { R.draft.pts.push(m); R.pushed = true; }
      else if (!near(R.draft.pts[0])) { addItem(R.tool, rectPts(R.draft.pts[0], m), st.note ? newShapeStyle() : null); R.draft = null; }
      else if (!(R.tapGap < 450)) toast('Too close to the first corner: zoom in, or pick the opposite corner further away.', 'err'); // a quick repeat: wait quietly
    } else if (st.dim) { // a dimension: its two ends, each snapped, then a third click for where its line goes
      const d = R.draft.pts;
      if (d.length < 2) {
        if (!d.length || Math.hypot(m[0] - d[0][0], m[1] - d[0][1]) * V.z >= 3) d.push(m); // not the same spot twice
        R.cursor = m; dirty(); updateUi();
        return;
      }
      let off = dimOff(d, raw);
      if (Math.abs(off) * V.z < 4) off = 0; // clicked on the measured line itself: the dimension stays on it
      addItem(R.tool, d, off ? { off } : null); R.draft = null;
    } else {
      const d = R.draft.pts;
      if (!near(d[d.length - 1], 2)) { const q = [m[0], m[1]]; d.push(q); R.pushed = true; R.pushT.set(q, performance.now()); }
    }
    R.cursor = m; dirty(); updateUi();
  }
  function onDoubleTap(d) {
    if (R.mode === 'select') { const it = d.item && find(d.item); if (it && isCrane(it.sym)) openSpec(it); else if (it && it.sym === '_text') editText(it); else if (it && (STYLE[it.sym] || {}).trailer) editTrailer(it); return; }
    if (isDimTool()) return; // a dimension takes single clicks only
    if (R.mode === 'draw' && R.draft) {
      const p = R.draft.pts, st = STYLE[R.tool] || {}, min = st.kind === 'area' ? 3 : 2;
      if (R.pushed) p.pop(); // the 2nd tap's point
      // the 1st tap's point too, when this double-click placed it on the last point (after a pause, so it was not
      // taken as a repeat): else a stub turned a line's arrowhead or made a sliver corner. Never a point placed
      // before the double-click, and never below a line's 2 points or an area's 3.
      // Within a tap's reach (24 px touch, 8 px mouse), as everywhere else 'the same spot' is judged: a last leg
      // shorter than that can't be told from a near miss, so draw it zoomed in, or finish with Enter or Finish.
      const t = (d.touch ? 24 : 8) / V.z, a = p[p.length - 1], b = p[p.length - 2], at = a && R.pushT.get(a);
      if (a && b && p.length > min && at && performance.now() - at < 450 && Math.hypot(a[0] - b[0], a[1] - b[1]) < t) p.pop();
      finishDraft(); updateUi();
    }
  }

  // ---------- pointer input: mouse, pen and touch (two fingers pinch and pan in every mode) ----------
  function local(e) {
    const r = R.map.getBoundingClientRect();
    return [e.clientX - r.left - R.map.clientLeft, e.clientY - r.top - R.map.clientTop];
  }
  function onPointerDown(e) {
    if (!D.ready || R.exporting || e.target.closest('.cs-ui')) return;
    if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.button !== 0 && e.button !== 1) return; // a pen's barrel or eraser button is not a click
    const p = local(e);
    R.ptrs.set(e.pointerId, p);
    try { R.map.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.blur) ae.blur(); // put the phone keyboard away
    if (R.ptrs.size === 2) { if (R.zwin) R.zwin.a = R.zwin.b = R.zwin.id = null; startPinch(); return; }
    if (R.ptrs.size > 2 || R.pinch) return;
    if (R.zwin && e.button !== 1) { const m = toMap(...p); if (!R.zwin.a) R.zwin.a = m; R.zwin.b = m; R.zwin.id = e.pointerId; dirty(); return; } // a corner of the zoom window, in drawing units (a zoom or pan between the two clicks keeps it)
    const panOnly = e.button === 1 || R.mode === 'pan' || R.space; // Space held: pan, whatever the tool
    const vh = !panOnly && R.mode === 'select' && R.sel ? e.target.closest('.cs-vh,.cs-vm,.cs-vr,.cs-va,.cs-vo') : null;
    if (vh) { R.drag = dragVertex(e, vh); if (R.drag) Object.assign(R.drag, { id: e.pointerId, x: p[0], y: p[1], touch: e.pointerType === 'touch' }); return; }
    const hitEl = !panOnly && R.mode === 'select' ? e.target.closest('[data-id]') : null, hitIt = hitEl && find(hitEl.dataset.id);
    const hit = hitIt && !layerLocked(layerOf(hitIt)) ? hitEl : null; // a locked layer's item is not picked up
    const drag = { id: e.pointerId, x: p[0], y: p[1], moved: false, cx: V.cx, cy: V.cy, item: hit ? hit.dataset.id : null, orig: null, pan: panOnly, touch: e.pointerType === 'touch' };
    if (drag.item) { const it = find(drag.item); if (it) { R.sel = drag.item; drag.orig = it.pts.map((q) => q.slice()); dirty(); updateUi(); } else drag.item = null; }
    R.drag = drag;
    if (!drag.item) R.map.classList.add('cs-grabbing');
  }
  // ---------- crane placement notes (crane_notes.js) ----------
  // While a crane is being placed, or one already placed is being dragged, the short list for that kind of crane
  // rides beside the cursor; the full list is in the Drawing panel. They are reminders: nothing here judges the spot.
  // The list follows the site address in the title block: the BC-wide rules always, plus the rules of the city the
  // address names when that city's are loaded.
  const CN = window.__CS_CRANE_NOTES || null;
  const craneKind = (sym) => (CN && CN.kinds[sym]) || null;
  // Which place the site address names: { key, city } for a city whose rules are loaded, { other } for a place that
  // is recognised but has none, { unsure } for a name two municipalities share (Langley), {} for an address naming
  // no place known here, null for no address.
  let cnSeen = { a: null, w: null };
  function craneWhere() {
    const a = String((PLAN && PLAN.info && PLAN.info.address) || '').toLowerCase().trim();
    if (a === cnSeen.a) return cnSeen.w;
    let w = null;
    if (a) {
      const has = (name) => new RegExp('(^|[^a-z])' + name.toLowerCase().replace(/ /g, '\\s+') + '([^a-z]|$)').test(a);
      // longest names first, so "Port Coquitlam" is not taken for Coquitlam, nor "North Vancouver" for Vancouver
      const all = Object.keys(CN.cities).flatMap((key) => CN.cities[key].match.map((m) => ({ m, key })))
        .concat(CN.known.map((m) => ({ m, other: m })), (CN.unsure || []).map((u) => ({ m: u.match, unsure: u })));
      all.sort((x, y) => y.m.length - x.m.length);
      const hit = all.find((x) => has(x.m));
      w = !hit ? {} : hit.key ? { key: hit.key, city: CN.cities[hit.key] } : hit.unsure ? { unsure: hit.unsure } : { other: hit.other };
    }
    cnSeen = { a, w };
    return w;
  }
  const cnScope = () => { const w = craneWhere(); return !w ? 'none' : w.key ? w.key : w.other ? 'other:' + w.other : w.unsure ? 'unsure:' + w.unsure.match : 'unknown'; };
  const cnLi = (lines) => lines.map((t) => `<li>${esc(t)}</li>`).join('');
  function craneNotesHtml(kind) {
    const w = craneWhere(), c = w && w.city, cityShort = (c && c[kind] && c[kind].short) || [];
    const foot = c ? `BC and ${c.name} rules, as of ${c.asOf}.${c.caution ? ' ' + c.name + ' figures are not confirmed.' : ''}`
      : w && w.other ? `${w.other}'s own rules are not loaded: BC-wide rules only, as of ${CN.bc.asOf}.`
        : w && w.unsure ? `${w.unsure.short} BC-wide rules only, as of ${CN.bc.asOf}.`
        : w ? `No city recognised in the site address: BC-wide rules only, as of ${CN.bc.asOf}.`
          : `No site address yet (Project panel): BC-wide rules only, as of ${CN.bc.asOf}.`;
    return `<b>${esc(CN.titles[kind])}: keep in mind</b><ul>${cnLi(CN.bc[kind].short)}</ul>` +
      (cityShort.length ? `<b>In ${esc(c.name)}</b><ul>${cnLi(cityShort)}</ul>` : '') + `<i>${esc(foot)} Full list: Drawing panel.</i>`;
  }
  function craneNotesAt(e) {
    const el = R.cnotes;
    if (!el || !CN) return;
    cranePanelAt();
    const it = R.drag && R.drag.item && R.drag.moved ? find(R.drag.item) : null;
    const kind = craneKind(R.mode === 'draw' ? R.tool : it ? it.sym : null);
    const fill =(k) => { const key = k + '|' + cnScope(); if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = craneNotesHtml(k); } };
    if (COARSE) { // no cursor on a touch screen: the list sits in the corner while a crane is armed
      const k = R.mode === 'draw' ? craneKind(R.tool) : null, show = !!k && !csNotes.off;
      if (show) fill(k);
      el.classList.toggle('cs-docked', show); el.style.display = show ? 'block' : 'none';
      return;
    }
    if (!kind || csNotes.off || !e || !R.map.contains(e.target) || (e.target.closest && e.target.closest('.cs-ui'))) { el.style.display = 'none'; return; }
    fill(kind);
    el.style.display = 'block';
    const [x, y] = local(e), w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = (x + 22 + w > V.w ? Math.max(4, x - 22 - w) : x + 22) + 'px'; // flips to the left of the cursor near the right edge
    el.style.top = Math.max(4, Math.min(V.h - h - 4, y + 18)) + 'px';
  }
  function craneNotesPanel() { // the Drawing panel's section; renderCraneNotes fills the box for the address in hand
    if (!CN) return '';
    return `<div class="cs-cnpanel" id="cs-cnpanel" hidden>
          <h3 title="${esc(TIPS.crane)}">CRANE PLACEMENT NOTES</h3>
          <label class="cs-chk"><input type="checkbox" id="cs-cn-on"> Short list beside the cursor</label>
          <div id="cs-cn-box"></div></div>`;
  }
  // The yellow Crane placement notes box shows only while a crane or boom is in hand (its tool picked, or one being
  // moved), and scrolls into view in the Drawing panel when it appears.
  function cranePanelAt() {
    const el = R.cnPanel;
    if (!el || !CN) return;
    const it = R.drag && R.drag.item && R.drag.moved ? find(R.drag.item) : null;
    const show = !!(PLAN && craneKind(R.mode === 'draw' ? R.tool : it ? it.sym : null));
    if (el.hidden === !show) return;
    el.hidden = !show;
    const side = el.closest('.cs-side');
    if (!show || !side || !side.offsetParent || side.scrollHeight <= side.clientHeight) return;
    const sb = side.getBoundingClientRect(), eb = el.getBoundingClientRect();
    if (eb.top < sb.top || eb.top > sb.bottom - 120) side.scrollTop += eb.top - sb.top - 8;
  }
  function renderCraneNotes() {
    const box = R.root && R.root.querySelector('#cs-cn-box');
    if (!box || !CN) return;
    const w = craneWhere(), c = w && w.city, key = cnScope();
    if (box.dataset.k === key) return;
    const wasOpen = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.t));
    const sec = (rows) => rows.map(([h, lines]) => `<div class="cs-cn-h">${esc(h)}</div><ul>${cnLi(lines)}</ul>`).join('');
    const boxOf = (t, title, body, open) => `<details class="cs-cn" data-t="${t}"${open || wasOpen.has(t) ? ' open' : ''}><summary>${esc(title)}</summary>${body}</details>`;
    const kindBody = (k) => `<ul>${cnLi(CN.bc[k].short)}</ul>` + (c && c[k] && c[k].short ? `<div class="cs-cn-h">In ${esc(c.name)}</div><ul>${cnLi(c[k].short)}</ul>` : '') + sec(CN.bc[k].full) + (c && c[k] && c[k].full ? sec(c[k].full) : '');
    const loaded = Object.keys(CN.cities).map((k) => CN.cities[k].name).join(', ');
    const status = c ? `<b>${esc(c.name)}</b> is named in the site address: the BC-wide rules and ${esc(c.name)}'s own are shown (as of ${esc(c.asOf)}). ${esc(c.summary || '')}`
      : w && w.unsure ? `${esc(w.unsure.say)} Only the BC-wide rules are shown (as of ${esc(CN.bc.asOf)}).`
      : w && w.other ? `<b>${esc(w.other)}</b> is named in the site address, but its own rules are not loaded. Only the BC-wide rules are shown (as of ${esc(CN.bc.asOf)}): check ${esc(w.other)}'s street permits, working hours and tree rules yourself.`
        : w ? `No city is recognised in the site address. Only the BC-wide rules are shown (as of ${esc(CN.bc.asOf)}). Add the city's name to the address to see its rules. Loaded: ${esc(loaded)}.`
          : `No site address yet. Only the BC-wide rules are shown (as of ${esc(CN.bc.asOf)}). Enter the address in the Project panel to add the city's rules. Loaded: ${esc(loaded)}.`;
    box.dataset.k = key;
    box.innerHTML = `<div class="cs-note cs-cn-status${c ? '' : ' cs-warn'}">${status}</div>` +
      (c && c.caution ? `<div class="cs-note cs-cn-status cs-warn">${esc(c.caution)}</div>` : '') +
      (c ? boxOf('city', 'In ' + c.name, sec(c.site), true) : '') +
      boxOf('tower', CN.titles.tower, kindBody('tower')) + boxOf('mobile', CN.titles.mobile, kindBody('mobile')) +
      boxOf('site', 'Any crane, anywhere in BC', sec(CN.bc.site)) +
      boxOf('confirm', 'Still to confirm', `<ul>${cnLi((c ? c.confirm : []).concat(CN.bc.confirm))}</ul>`);
  }

  // ---------- crane specification: the supplier's figures for a placed crane, typed in ----------
  // Select a crane and press Crane spec (or double-click it). The figures are typed from the supplier's data sheet;
  // the tool cannot read a data sheet itself. They are kept on the crane (`it.spec`), so they travel with the plan:
  //   jib (m): the jib or boom length. With a drawing scale set it IS the reach circle, both ways: typing it resizes
  //            the circle, and dragging the circle's yellow handle rewrites it.
  //   cj (m):  the counter-jib or tail radius, drawn as a second, dashed circle (it swings over neighbours too).
  //   height (m), maxLoad (t), and a load chart of [radius m, capacity t] rows, typed or pasted from a spreadsheet.
  // The capacity "at the tip" is read from the chart conservatively: the row at the jib length, or the next longer one.
  // A specification can be saved to a list kept in this browser ("my cranes") or to a small file, and used again.
  const SPEC_TYPES = [['tower', 'Tower crane: hammerhead or flat-top'], ['luffing', 'Tower crane: luffing jib'], ['self', 'Self-erecting crane'], ['mobile', 'Mobile crane'], ['boom', 'Placing boom']];
  const SPEC_DEFAULT_TYPE = { crane: 'tower', 'ss-crane': 'tower', 'mobile-crane': 'mobile', 'placing-boom': 'boom' };
  const SPEC_LIB_KEY = 'siteLogistics.cranes';
  // one decimal, halves rounded up as written: toFixed works on the binary value, so 60.05 gave 60 and a 4.85 m tail
  // swing 4.8 (an under-stated barricade); the tiny nudge puts a written .x5 back on its half
  const nf1 = (v) => { const n = +v; if (!isFinite(n)) return String(n); const r = Math.round(Math.abs(n) * 10 + 1e-9) / 10; return String(n < 0 ? -r : r); };
  const nf3 = (v) => String(+(+v).toFixed(3)); // figures written back into a box that is read again: rounding there would change them
  function cleanSpec(o) { // outside data (a plan file, a spec file, the saved list): known fields, sane numbers only
    if (!o || typeof o !== 'object') return null;
    const numIn = (v, max) => { const n = +v; return Number.isFinite(n) && n > 0 && n <= max ? n : 0; };
    const c = { model: typeof o.model === 'string' ? cleanText(o.model, 60) : '', type: SPEC_TYPES.some((t) => t[0] === o.type) ? o.type : 'tower',
      jib: numIn(o.jib, 500), cj: numIn(o.cj, 200), height: numIn(o.height, 1000), maxLoad: numIn(o.maxLoad, 5000), label: o.label !== false, chart: [] };
    if (Array.isArray(o.chart)) o.chart.slice(0, 80).forEach((r) => { const a = Array.isArray(r) ? numIn(r[0], 500) : 0, b = Array.isArray(r) ? numIn(r[1], 5000) : 0; if (a && b) c.chart.push([a, b]); });
    c.chart.sort((a, b) => a[0] - b[0]);
    return c;
  }
  // A plan kept in this browser from before the tool went English-only: its words cleaned in place (title block, text
  // labels, crane model). Text that is already clean is left exactly as it is. Load rings, taken out of the tool on
  // 2026-11-17 (the reach circle and the figures already say it), are dropped from old plans here.
  function englishPlan(plan) {
    if (!plan || typeof plan !== 'object') return plan;
    if (plan.info && typeof plan.info === 'object') for (const k of Object.keys(plan.info)) if (typeof plan.info[k] === 'string') { const v = englishOnly(plan.info[k]).replace(/[\t\n]/g, ' '); if (v !== plan.info[k]) plan.info[k] = v; }
    if (Array.isArray(plan.items)) plan.items.forEach((it) => {
      if (!it) return;
      if (it.sym === '_text' && typeof it.text === 'string') { const v = cleanText(it.text, 120); if (v !== it.text) it.text = v || '-'; }
      if (it.spec && typeof it.spec === 'object') {
        if (typeof it.spec.model === 'string') { const v = cleanText(it.spec.model, 60); if (v !== it.spec.model) it.spec.model = v; }
        delete it.spec.rings;
      }
    });
    return plan;
  }
  // A text line's box [x0, y0, x1, y1] centred on (x, y), from its measured width plus the white halo
  const textBox = (t, x, y, size, w) => { const hw = (w == null ? textW(t, size) : w) / 2 + size * 0.25, hh = size * 0.72; return [x - hw, y - hh, x + hw, y + hh]; };
  const crossBox = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  // The figures written beside a crane's symbol (craneSpecMarkup draws them at these places), with their boxes. They go
  // below the symbol unless the page's label layout moved them above, right or left of it, clear of a neighbour.
  const SPEC_DIRS = ['below', 'above', 'right', 'left'];
  // The outer radius of a crane's ground-level barricade ring in the view being drawn (its tail swing plus half the line),
  // or 0 when it has none (overhead counter-jib, no tail, or no scale)
  // The half width and air (2 sheet units) scale with the view like the text (k), so the crane's own figures always start
  // just outside its own ring at any zoom: with a fixed +2 they cut into the ring's band once the screen was zoomed past
  // about 1.5x the sheet, and the screen moved them to another side than the sheet prints.
  const ringK = () => (R.frz ? CV.z / R.frz : 1);
  function tailBand(it) {
    const sp = it.spec, m = mpu();
    if (!sp || !(sp.cj > 0) || !m || !groundTail(sp)) return 0;
    return (sp.cj / m) * CV.z + 2 * ringK(); // the line's half width and a little air
  }
  function specTextMarks(it, P, h, size, dir) {
    const lines = craneSpecLines(it), n = lines.length, L = size * 1.15;
    if (!n) return [];
    dir = dir || specDir(it);
    const sym = SYM[it.sym], ws = lines.map((t) => textW(t, size)), wide = Math.max(...ws);
    // the figures start outside the symbol, or outside the crane's own barricade ring when it has one
    const tr = tailBand(it), hh = Math.max(h / 2, tr), hw = Math.max(sym ? (h * sym.w) / sym.h / 2 : h / 2, tr);
    return lines.map((t, i) => {
      let x = P[0], y;
      if (dir === 'above') y = P[1] - hh - size * 0.45 - (n - 1 - i) * L;
      else if (dir === 'right' || dir === 'left') { x = P[0] + (dir === 'right' ? 1 : -1) * (hw + size * 0.5 + wide / 2); y = P[1] + size * 0.35 - ((n - 1) * L) / 2 + i * L; }
      else y = P[1] + hh + size * 1.15 + i * L;
      return { t, x, y, box: textBox(t, x, y - size * 0.35, size, ws[i]) };
    });
  }
  // Where a crane's figures go in the view being drawn: from the page's label layout (labelLayout), so every crane's
  // figures keep clear of every other crane's, the same on screen, in the image and in the PDF
  const layoutOf = (it) => { const byPlan = labelLayout().get(PLAN); return (byPlan && byPlan.get(it.id)) || null; };
  const specDir = (it) => { const e = layoutOf(it); return (e && e.dir) || 'below'; };
  // ---------- the cranes' figures, laid out for the whole page at once ----------
  // One layout per drawing pass (a screen frame, an image export, a PDF page). It spans every shown layer, so cranes on
  // different layers keep clear of each other and of the text labels and dimensions. Every symbol, every text label and every dimension's figure is marked as taken first; then the cranes
  // are taken in order and each one's figures go below its symbol, or else to the first of above / right / left that is
  // on the sheet and clear of everything taken so far. The layout is kept until the view, the page or a plan changes
  // (dirty() counts changes; a fingerprint of the items backs it). Result: plan -> (item id -> { dir }).
  const withPlan = (p, fn) => { const o = PLAN; PLAN = p; try { return fn(); } finally { PLAN = o; } };
  function labelLayout() {
    // the plan drawn (one, with its layers: items() gives the shown layers' items, so a layer turned off frees its room)
    const plans = [PLAN];
    let sig = 0;
    for (const p of plans) withPlan(p, () => {
      sig = (sig * 31 + 1 + (mpu() || 0) * 1e4 + (SYM_SIZES.findIndex((x) => x[0] === p.symSize) + 2) * 29) % 1e9;
      for (const it of items()) {
        const q = it.pts && it.pts[0];
        if (!q) continue;
        sig = (sig * 31 + q[0] * 7 + q[1] * 13 + (it.r || 0) * 3 + (it.sweep || 0) * 5 + (it.a0 || 0) * 11 + (it.off || 0) * 37 + (it.text ? it.text.length : 0) + (+it.rot || 0) * 53 + (+it.size || 0) * 61 +
          (it.pts[1] ? it.pts[1][0] * 41 + it.pts[1][1] * 43 : 0) + (it.spec ? (it.spec.jib || 0) * 17 + (it.spec.label === false ? 23 : 0) : 0)) % 1e9;
      }
    });
    const key = [D.page, CV.z, CV.cx, CV.cy, CV.w, CV.h, R.frz, sig, R.layRev || 0].join('|');
    const c = R.labelLay;
    if (c && c.key === key && c.plans.length === plans.length && c.plans.every((p, i) => p === plans[i])) return c.byPlan;
    const byPlan = new Map();
    R.labelLay = { plans, key, byPlan };
    const size = 9 * (R.frz ? CV.z / R.frz : 1), W = CV.w || 1e6, H = CV.h || 1e6, G = 96, grid = new Map();
    // "on the sheet" means inside the printed map window, in the view being drawn: on export that is the whole view; on
    // screen it is the dashed sheet frame (centred on the view), so the screen shows the sides the sheet will print
    const fk = R.frz ? CV.z / R.frz : 0, F = fk && CV.w ? [CV.w / 2 - (MAP_IN.w * fk) / 2, midY(CV) - (MAP_IN.h * fk) / 2, CV.w / 2 + (MAP_IN.w * fk) / 2, midY(CV) + (MAP_IN.h * fk) / 2] : [0, 0, W, H];
    const onSheet = (b) => Math.max(0, Math.min(b[2], F[2]) - Math.max(b[0], F[0])) * Math.max(0, Math.min(b[3], F[3]) - Math.max(b[1], F[1])) / Math.max(1e-9, (b[2] - b[0]) * (b[3] - b[1]));
    // what is taken, in a grid of G-unit cells; a box well off the view neither takes room nor is looked for
    const near = (b) => b[2] > -W && b[0] < 2 * W && b[3] > -H && b[1] < 2 * H;
    const cells = (b, f) => { for (let gx = Math.floor(Math.max(b[0], -W) / G); gx <= Math.floor(Math.min(b[2], 2 * W) / G); gx++) for (let gy = Math.floor(Math.max(b[1], -H) / G); gy <= Math.floor(Math.min(b[3], 2 * H) / G); gy++) if (f(gx + ',' + gy)) return true; return false; };
    const take = (b) => { if (near(b)) cells(b, (k) => { const a = grid.get(k); if (a) a.push(b); else grid.set(k, [b]); }); };
    // A barricade ring is taken as its line only (t.ring = [cx, cy, inner, outer]): figures may sit inside another
    // crane's ring or outside it, never across it. Box b meets the line when its nearest point is within the outer
    // radius and its farthest corner beyond the inner one.
    const ringHit = (t, b) => {
      const [cx, cy, r0, r1] = t.ring;
      const nx = Math.max(b[0], Math.min(cx, b[2])) - cx, ny = Math.max(b[1], Math.min(cy, b[3])) - cy;
      const fx = Math.max(Math.abs(b[0] - cx), Math.abs(b[2] - cx)), fy = Math.max(Math.abs(b[1] - cy), Math.abs(b[3] - cy));
      return nx * nx + ny * ny <= r1 * r1 && fx * fx + fy * fy >= r0 * r0;
    };
    const hit = (t, b) => (t.ring ? ringHit(t, b) : crossBox(t, b));
    const free = (b) => !near(b) || !cells(b, (k) => { const a = grid.get(k); return !!a && a.some((t) => hit(t, b)); });
    const covered = (b) => { // how much of box b lies on what is taken (each taken box counted once)
      if (!near(b)) return 0;
      const seen = new Set(); let s = 0;
      cells(b, (k) => { (grid.get(k) || []).forEach((t) => {
        if (seen.has(t)) return;
        seen.add(t);
        // a ring the box crosses counts as its line through the box: the band's width along the box's diagonal
        if (t.ring) { if (ringHit(t, b)) s += (t.ring[3] - t.ring[2]) * Math.hypot(b[2] - b[0], b[3] - b[1]); return; }
        s += Math.max(0, Math.min(b[2], t[2]) - Math.max(b[0], t[0])) * Math.max(0, Math.min(b[3], t[3]) - Math.max(b[1], t[1]));
      }); return false; });
      return s;
    };
    for (const p of plans) withPlan(p, () => {
      for (const it of items()) {
        const P = it.pts && it.pts[0] && toScreen(it.pts[0][0], it.pts[0][1]);
        if (!P || isNaN(P[0])) continue;
        if (it.sym === '_text') { take(labelBounds(it, P, labelSize(it))); continue; } // turned labels take their upright bounds
        const st = STYLE[it.sym];
        if (st && st.dim && it.pts.length >= 2) { // a dimension's figure, written along its line at 10 units
          const Q = it.pts.map((q) => toScreen(q[0], q[1])), [a, b] = dimEnds(Q, (it.off || 0) * CV.z), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hw = textW(dimText(Math.hypot(Q[Q.length - 1][0] - Q[0][0], Q[Q.length - 1][1] - Q[0][1]) / CV.z), 10) / 2 + 3, hh = 10;
          const ex = Math.abs(Math.cos(ang)) * hw + Math.abs(Math.sin(ang)) * hh, ey = Math.abs(Math.sin(ang)) * hw + Math.abs(Math.cos(ang)) * hh;
          take([mid[0] - ex, mid[1] - ey, mid[0] + ex, mid[1] + ey]);
          continue;
        }
        const sym = SYM[it.sym];
        if (!sym) continue;
        const h = symHeight(it.sym), w = (h * sym.w) / sym.h;
        take([P[0] - w / 2, P[1] - h / 2, P[0] + w / 2, P[1] + h / 2]); // the symbol as drawn (its own figures start just outside it)
        const tb = isCrane(it.sym) ? tailBand(it) : 0; // a barricade ring: its line, so no other crane's figures cross it
        // the band is 2 sheet units either side of the line, scaled like the text (k), so the screen picks the sides the
        // sheet prints at any zoom
        const k = ringK(), rc = tb - 2 * k; // rc: the ring's line
        if (tb) take(Object.assign([P[0] - rc - 2 * k, P[1] - rc - 2 * k, P[0] + rc + 2 * k, P[1] + rc + 2 * k], { ring: [P[0], P[1], Math.max(0, rc - 2 * k), rc + 2 * k] }));
      }
    });
    // the same crane on two tabs (same place, same figures) shares its spot rather than pushing its twin aside
    const same = new Map();
    for (const p of plans) withPlan(p, () => {
      const map = new Map();
      byPlan.set(p, map);
      for (const it of items()) {
        if (!isCrane(it.sym) || !it.spec || !it.pts || !it.pts[0]) continue;
        const P = toScreen(it.pts[0][0], it.pts[0][1]);
        if (isNaN(P[0])) continue;
        const e = { dir: 'below' };
        map.set(it.id, e);
        // the figures: below the symbol, or else the first of above / right / left wholly on the sheet and clear of the rest
        const h = symHeight(it.sym), lines = craneSpecLines(it);
        if (!lines.length) continue;
        const twin = `${fmt(P[0])},${fmt(P[1])}|${fmt(h)}|spec|${lines.join('\n')}`, had = same.get(twin);
        const boxes = (d) => specTextMarks(it, P, h, size, d).map((k) => k.box);
        if (had) e.dir = had;
        else {
          const fits = (d) => boxes(d).every((b) => free(b) && onSheet(b) > 0.999);
          // nowhere wholly clear (cranes almost on top of each other): the side most on the sheet, then covering least
          const score = (d) => boxes(d).reduce((s, b) => s + (1 - onSheet(b)) * 1e9 + covered(b), 0);
          e.dir = SPEC_DIRS.find(fits) || SPEC_DIRS.map((d) => [d, score(d)]).sort((a, b) => a[1] - b[1])[0][0];
          same.set(twin, e.dir);
        }
        boxes(e.dir).forEach((b) => take(b));
      }
    });
    return byPlan;
  }
  function parseChart(text) { // "radius, capacity" per line; commas, tabs, semicolons or spaces between; unit words ignored
    const rows = [], bad = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const nums = (line.replace(/(\d),(?=\d{3}(?!\d))/g, '$1').match(/-?\d+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(',', '.')));
      if (nums.length >= 2 && nums[0] > 0 && nums[1] > 0) rows.push([nums[0], nums[1]]); else if (/\d/.test(line)) bad.push(i + 1);
    });
    rows.sort((a, b) => a[0] - b[0]);
    return { rows: rows.slice(0, 80), bad };
  }
  function tipLoad(sp) { // { r, t, exact } for the capacity at the jib length, read from the chart; null if the chart does not reach it
    if (!sp || !sp.chart || !sp.chart.length) return null;
    if (!(sp.jib > 0)) { const last = sp.chart[sp.chart.length - 1]; return { r: last[0], t: last[1], exact: true }; }
    const row = sp.chart.find((r) => r[0] >= sp.jib - 0.05);
    return row ? { r: row[0], t: row[1], exact: Math.abs(row[0] - sp.jib) < 0.05 } : null;
  }
  // Where a crane's counterweight swings: overhead on a top-slewing tower crane or luffer (the counter-jib, which oversails
  // like the jib), at ground level on a self-erecting crane, a mobile crane or a truck-mounted boom (the tail swing, a crush
  // zone to barricade). The ground ones are drawn as a red dashed line, written "tail swing ... (barricade)" and listed in
  // the sheet's legend as "Tail swing barricade" (user, 2026-11-17: red dashed, not the striped Barricade bar).
  const groundTail = (sp) => !!sp && (sp.type === 'self' || sp.type === 'mobile' || sp.type === 'boom');
  const TAIL_LINE = `fill="none" stroke="${COL.red}" stroke-width="2" stroke-dasharray="8 5"`;
  const TAIL_ROW = { id: '_tailswing', label: 'Tail swing barricade', vb: '0 0 136 30', inner: `<path d="M6 15H130" ${TAIL_LINE}/>` };
  // a page with a crane whose counterweight swings at ground level (its legend gets the Tail swing barricade row)
  const hasGroundTail = (list) => list.some((i) => isCrane(i.sym) && i.spec && i.spec.cj > 0 && groundTail(i.spec));
  function withTailRow(secs, list) { // the row goes after the crane symbols in the first section listing one, else at the end
    if (!hasGroundTail(list)) return secs;
    const s = secs.find((x) => x.rows.some((r) => isCrane(r.id))) || secs[secs.length - 1];
    if (!s) return secs;
    const at = s.rows.reduce((k, r, i) => (isCrane(r.id) ? i + 1 : k), s.rows.length && s.rows.some((r) => isCrane(r.id)) ? 0 : s.rows.length);
    s.rows = s.rows.slice(0, at).concat([TAIL_ROW], s.rows.slice(at));
    return secs;
  }
  function craneSpecLines(it) { // what is written beside the crane
    const sp = it.spec;
    if (!sp || sp.label === false) return [];
    const L = [], arm = sp.type === 'mobile' || sp.type === 'boom' ? 'boom' : 'jib', a = [];
    if (sp.model) L.push(sp.model);
    if (sp.jib > 0) a.push(`${arm} ${nf1(sp.jib)} m`);
    if (sp.cj > 0 && !groundTail(sp)) a.push(`counter-jib ${nf1(sp.cj)} m`); // overhead: it oversails like the jib
    if (a.length) L.push(a.join(', '));
    if (sp.cj > 0 && groundTail(sp)) L.push(`tail swing ${nf1(sp.cj)} m (barricade)`); // at ground level: a crush zone
    const tip = tipLoad(sp);
    if (tip) L.push(`${nf1(tip.t)} t at ${nf1(tip.r)} m`); else if (sp.maxLoad > 0) L.push(`max ${nf1(sp.maxLoad)} t`);
    if (sp.height > 0) L.push(`${nf1(sp.height)} m high`);
    return L;
  }
  // The figures as SVG text (bold, white halo) at their places in the view being drawn
  const specTextSvg = (marks, size) => marks.map((k) => `<text x="${fmt(k.x)}" y="${fmt(k.y)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${fmt(size)}" fill="#111" stroke="#fff" stroke-width="${fmt(size * 0.3)}" paint-order="stroke" stroke-linejoin="round">${esc(k.t)}</text>`).join('');
  // tail / figs false: leave the ground-level tail circle / the figures out (the PDF export writes each as its own markup)
  function craneSpecMarkup(it, P, h, tail = true, figs = true) { // the counter-jib or tail circle and the figures, in the view being drawn
    const sp = it.spec;
    if (!sp) return '';
    let s = '';
    const m = mpu();
    if (sp.cj > 0 && m) {
      const cr = (sp.cj / m) * CV.z;
      if (groundTail(sp)) { if (tail) s += `<circle cx="${fmt(P[0])}" cy="${fmt(P[1])}" r="${fmt(cr)}" ${TAIL_LINE}/>`; } // ground-level tail swing: the red dashed barricade line
      else s += `<circle cx="${fmt(P[0])}" cy="${fmt(P[1])}" r="${fmt(cr)}" fill="none" stroke="#000" stroke-width="1.1" stroke-dasharray="3 3"/>`;
    }
    if (figs) { const size = 9 * (R.frz ? CV.z / R.frz : 1); s += specTextSvg(specTextMarks(it, P, h, size), size); }
    return s;
  }
  const specLib = () => { try { const j = JSON.parse(localStorage.getItem(SPEC_LIB_KEY) || '[]'); return Array.isArray(j) ? j.map(cleanSpec).filter((x) => x && x.model) : []; } catch (e) { return []; } };
  // The crane catalogue (crane_models.js, written by tools/build_crane_models.py from research_notes\Crane model catalogue\):
  // real models offered by BC suppliers, with figures read from the makers' data sheets. Picking one fills the fields;
  // a spec whose model name matches a catalogue entry shows that entry's source and notes.
  const CAT = (window.__CS_CRANE_MODELS && Array.isArray(window.__CS_CRANE_MODELS.models)) ? window.__CS_CRANE_MODELS.models : [];
  const catFind = (name) => { const n = String(name || '').trim().toLowerCase(); return n ? CAT.find((c) => c.name.toLowerCase() === n) || null : null; };
  // The height field is the HIGHEST point; data sheets give hook height (tower height for luffers), which is lower, so a
  // catalogue pick leaves that field for the user and shows the sheet's figure as a note.
  const catSpec = (c, label) => cleanSpec({ model: c.name, type: c.type, jib: c.jib, cj: c.cj, maxLoad: c.maxLoad, chart: c.chart || [], label });
  // The catalogue lists only the models that fit the symbol: a tower crane symbol the tower, luffing and self-erecting
  // cranes, a mobile crane symbol the mobile cranes, a placing boom the placing booms.
  const CAT_TYPES = { crane: ['tower', 'luffing', 'self'], 'ss-crane': ['tower', 'luffing', 'self'], 'mobile-crane': ['mobile'], 'placing-boom': ['boom'] };
  function catSelect(it) {
    const types = CAT_TYPES[it.sym] || SPEC_TYPES.map((t) => t[0]);
    if (!CAT.some((c) => types.includes(c.type))) return '';
    const groups = SPEC_TYPES.filter(([t]) => types.includes(t)).map(([t, title]) => {
      const list = CAT.filter((c) => c.type === t);
      return list.length ? `<optgroup label="${esc(title)}">${list.map((c) => `<option value="${CAT.indexOf(c)}">${esc(c.name)}${c.jib ? ` · ${nf1(c.jib)} m` : ''}${c.maxLoad ? `, ${nf1(c.maxLoad)} t` : ''}${c.verified === 'DS' ? '' : ' (unverified)'}</option>`).join('')}</optgroup>` : '';
    }).join('');
    const what = it.sym === 'placing-boom' ? 'Placing boom catalogue' : it.sym === 'mobile-crane' ? 'Mobile crane catalogue' : 'Crane catalogue';
    return `<label class="cs-sp-f"><span>${what}</span><select data-sp-cat><option value="">Choose a model…</option>${groups}</select></label>`;
  }
  // A crane with a typed jib length keeps that length when the drawing scale changes or a plan file brings it in:
  // its reach circle is redrawn to the jib length at the scale now set (this page's cranes; each page has its scale).
  function syncCraneReach(quiet) { // quiet: after a scale taken from another window: kept, written at the next save
    const m = PLAN && D.ready ? mpu() : null;
    if (!m) return;
    let changed = false;
    for (const it of PLAN.items) {
      if (it.pg !== D.page || !it.spec || !(it.spec.jib > 0) || Math.abs(it.r - it.spec.jib / m) < 1e-6) continue;
      it.r = it.spec.jib / m; changed = true;
    }
    for (const it of PLAN.items) { // a trailer keeps its real size (typed in metres or feet), about its centre and angle
      if (it.pg !== D.page || !it.dims || !(STYLE[it.sym] || {}).trailer || it.pts.length !== 4) continue;
      const t = trailerOf(it, m);
      if (Math.abs(t.l - it.dims.l) < 1e-6 && Math.abs(t.w - it.dims.w) < 1e-6) continue;
      it.pts = trailerPts(t.c, it.dims.l / m, it.dims.w / m, t.a); changed = true;
    }
    if (changed) { if (!quiet) save(); dirty(); }
  }
  function openSpec(it) {
    if (!it || !isCrane(it.sym)) return;
    R.specId = it.id; R.specUndo = false;
    renderSpec();
  }
  function closeSpec() { R.specId = null; renderSpec(); }
  function syncSpec(cr) { // the selection moved: follow it to another crane, or close
    if (!R.specId) return;
    if (cr && cr.id !== R.specId) openSpec(cr); else if (!cr) closeSpec();
  }
  function specNotes(sp) { // what the figures mean, under the fields
    const m = mpu(), out = [];
    if (!m) out.push('Set the drawing scale (Drawing panel) and the jib length will size the reach circle.');
    const p = parseChart(R.spec.querySelector('[data-sp="chart"]').value);
    if (p.rows.length || p.bad.length) {
      const tip = tipLoad(sp);
      out.push(`Load chart: ${p.rows.length} row${p.rows.length === 1 ? '' : 's'} read${p.bad.length ? `; line${p.bad.length === 1 ? '' : 's'} ${p.bad.join(', ')} not read` : ''}.` +
        (tip ? ` At the tip: ${nf1(tip.t)} t${tip.exact ? '' : ` (the chart row at ${nf1(tip.r)} m, the next radius past the jib length)`}.`
          : sp.jib > 0 && p.rows.length && (sp.type === 'mobile' || sp.type === 'boom') ? ` Furthest radius on the chart: ${nf1(p.rows[p.rows.length - 1][0])} m, ${nf1(p.rows[p.rows.length - 1][1])} t (a boom never works out at its full length).`
          : sp.jib > 0 && p.rows.length ? ' The chart stops short of the jib length, so no tip capacity is shown.' : ''));
    }
    if (sp.cj > 0) out.push(groundTail(sp)
      ? 'The tail swing is drawn as a barricade line: on this crane the counterweight swings at ground level, so nothing may stand inside that circle (people, stored material, fences, the building face) and it is barricaded.' +
        (sp.type === 'mobile' || sp.type === 'boom' ? ' It reaches past the outrigger pads: measure the clear distance and the road closure from this circle, not from the pads.' : '')
      : 'The counter-jib circle is drawn dashed. It is overhead and swings over neighbours as the jib does.');
    if (sp.height > 60) out.push('Over 60 m above ground: see Height and aircraft in the crane placement notes.');
    const c = catFind(sp.model);
    if (c) {
      const tower = c.type !== 'mobile' && c.type !== 'boom';
      if (c.verified !== 'DS') out.push('Catalogue: these figures come from a supplier listing, not the maker\'s data sheet. Confirm them before relying on them.');
      if (c.chartNote) out.push('Catalogue load chart: ' + c.chartNote + '.');
      if (tower && c.chart && c.chart.length && sp.jib > 0 && c.jib > 0 && sp.jib < c.jib - 0.05) out.push(`The catalogue chart is for the longest jib (${nf1(c.jib)} m). A shorter jib usually lifts a little more and may come with a shorter counter-jib: check the data sheet for ${nf1(sp.jib)} m.`);
      if (c.jibs && c.jibs.length > 1 && tower) out.push('Jib lengths offered: ' + c.jibs.map(nf1).join(', ') + ' m.');
      if (c.extra) out.push(c.extra);
      if (c.height > 0) out.push(tower
        ? `Data sheet height: ${nf1(c.height)} m ${c.type === 'luffing' ? 'tower height' : 'free-standing hook height'} at most${c.heightNote ? ` (${c.heightNote})` : ''}. The highest point is above that (${c.type === 'luffing' ? 'the raised boom' : 'the tower head or jib'}): type it in the height field from the drawing for your configuration.`
        : `Data sheet height: ${nf1(c.height)} m${c.heightNote ? ` (${c.heightNote})` : ''}. Type the highest point for your lift in the height field.`);
      out.push('Check every figure against the data sheet for the unit you hire: configurations and editions differ.');
    }
    const src = c && /^https:\/\/[^\s"'<>]+$/.test(c.source || '') ? `<div>Source: <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${esc(c.verified === 'DS' ? 'maker\'s data sheet' : 'supplier listing')}${c.edition ? ', ' + esc(c.edition) : ''}</a></div>` : '';
    return out.map((t) => `<div>${esc(t)}</div>`).join('') + src;
  }
  function renderSpec() {
    const el = R.spec;
    if (!el) return;
    const it = R.specId && find(R.specId);
    if (!it) { R.specId = null; el.style.display = 'none'; el.innerHTML = ''; R.root.classList.toggle('cs-checks-open', !!(CK && store.checksOpen)); return; }
    const sp = it.spec || cleanSpec({ type: SPEC_DEFAULT_TYPE[it.sym] || 'tower', jib: mpu() ? Math.round(it.r * mpu() * 2) / 2 : 0 });
    // the boxes are read back on every edit, so they show the figure as stored (3 decimals): at 1 decimal a 60.05 m boom
    // became 60.1 m and a 233.15 t maximum 233.2 t as soon as any other box was touched
    const lib = specLib(), v = (x) => (x > 0 ? nf3(x) : '');
    el.innerHTML = `<div class="cs-ck-top"><b>Crane specification</b><button class="cs-btn" data-sp-act="close" title="Close">Close</button></div>` +
      `<div class="cs-note">For the selected ${esc(itemName(it.sym).toLowerCase())}. Pick a model from the catalogue, or type the figures from the supplier's data sheet; they are kept with this crane.</div>` +
      catSelect(it) +
      (lib.length ? `<label class="cs-sp-f"><span>Use a saved crane</span><select data-sp-lib><option value="">Choose…</option>${lib.map((c, i) => `<option value="${i}">${esc(c.model)}</option>`).join('')}</select></label>` : '') +
      `<label class="cs-sp-f"><span>Model</span><input type="text" data-sp="model" maxlength="60" value="${esc(sp.model)}" placeholder="e.g. Liebherr 172 EC-B"></label>` +
      `<label class="cs-sp-f"><span>Type</span><select data-sp="type">${SPEC_TYPES.map((t) => `<option value="${t[0]}"${t[0] === sp.type ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}</select></label>` +
      `<label class="cs-sp-f"><span>Jib or boom length, m</span><input type="number" min="0" step="0.5" data-sp="jib" value="${v(sp.jib)}"></label>` +
      `<label class="cs-sp-f"><span>Counter-jib or tail radius, m</span><input type="number" min="0" step="0.1" data-sp="cj" value="${v(sp.cj)}"></label>` +
      `<label class="cs-sp-f"><span>Highest point above ground, m</span><input type="number" min="0" step="0.5" data-sp="height" value="${v(sp.height)}"></label>` +
      `<label class="cs-sp-f"><span>Maximum load, t</span><input type="number" min="0" step="0.1" data-sp="maxLoad" value="${v(sp.maxLoad)}"></label>` +
      `<label class="cs-sp-f cs-sp-col"><span>Load chart: one row per line, radius in m then capacity in t. Paste from a spreadsheet or type.</span>` +
      `<textarea data-sp="chart" rows="6" spellcheck="false" placeholder="20, 8&#10;40, 4.2&#10;60, 2.5">${esc(sp.chart.map((r) => nf3(r[0]) + ', ' + nf3(r[1])).join('\n'))}</textarea></label>` +
      `<label class="cs-chk"><input type="checkbox" data-sp="label"${sp.label !== false ? ' checked' : ''}> Write the figures beside the crane</label>` +
      `<div class="cs-note cs-sp-notes"></div>` +
      `<div class="cs-line"><button class="cs-btn" data-sp-act="keep" title="Add this crane to a list kept in this browser, to use on other drawings">Save to my cranes</button>` +
      `<button class="cs-btn" data-sp-act="file" title="Save this specification as a small file, to share or keep">Save as file</button>` +
      `<button class="cs-btn" data-sp-act="load" title="Fill the fields from a specification file">Load file…</button></div>` +
      `<div class="cs-line"><button class="cs-btn" data-sp-act="clear" title="Remove the specification from this crane">Remove specification</button></div>`;
    el.style.display = 'block';
    R.root.classList.add('cs-checks-open');
    el.querySelector('.cs-sp-notes').innerHTML = specNotes(sp);
  }
  function readSpecFields() { // the panel's fields as a specification
    const g = (k) => R.spec.querySelector(`[data-sp="${k}"]`);
    return cleanSpec({ model: g('model').value, type: g('type').value, jib: g('jib').value, cj: g('cj').value, height: g('height').value, maxLoad: g('maxLoad').value,
      label: g('label').checked, chart: parseChart(g('chart').value).rows });
  }
  function applySpec(it, sp, fromPanel) {
    if (!R.specUndo) { pushUndo(); R.specUndo = true; } // one undo step for a sitting at the panel
    it.spec = sp;
    const m = mpu();
    if (sp.jib > 0 && m) it.r = sp.jib / m; // the jib length is the reach
    save(); dirty();
    if (fromPanel) R.spec.querySelector('.cs-sp-notes').innerHTML = specNotes(sp); else renderSpec();
  }
  function onSpecInput(e) {
    const it = R.specId && find(R.specId);
    if (!it || !e.target.closest('[data-sp]')) return;
    applySpec(it, readSpecFields(), true);
  }
  function onSpecClick(e) {
    const b = e.target.closest('[data-sp-act]'), it = R.specId && find(R.specId);
    if (!b || !it) return;
    const act = b.dataset.spAct, sp = readSpecFields();
    if (act === 'close') closeSpec();
    else if (act === 'clear') { pushUndo(); delete it.spec; save(); dirty(); R.specUndo = false; renderSpec(); }
    else if (act === 'keep') {
      if (!sp.model) { toast('Give the crane a model name first: that is how it is listed.', 'err'); return; }
      const lib = specLib().filter((c) => c.model.toLowerCase() !== sp.model.toLowerCase());
      lib.push(sp); lib.sort((a, c) => a.model.localeCompare(c.model));
      try { localStorage.setItem(SPEC_LIB_KEY, JSON.stringify(lib.slice(0, 60))); toast(`Saved ${sp.model} to my cranes.`); } catch (err) { toast('This browser would not save it. Use Save as file.', 'err'); }
      applySpec(it, sp); // redraw, so the list shows it
    } else if (act === 'file') {
      const data = { app: 'site-logistics', kind: 'crane-spec', version: 1, saved: new Date().toISOString(), spec: sp };
      download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'crane-' + (slugify(sp.model) || 'spec') + '.json');
    } else if (act === 'load') R.specIn.click();
  }
  async function loadSpecFile(file) {
    const it = R.specId && find(R.specId);
    if (!it) return;
    let j;
    try { j = JSON.parse(await file.text()); } catch (e) { toast(file.name + ' is not a crane specification file.', 'err'); return; }
    const sp = j && j.app === 'site-logistics' && j.kind === 'crane-spec' ? cleanSpec(j.spec) : null;
    if (!sp) { toast(file.name + ' is not a crane specification file.', 'err'); return; }
    applySpec(it, sp);
    toast('Loaded ' + (sp.model || 'the specification') + '.');
  }

  // ---------- crane setup checklist (crane_checklist.js): an optional side bar on the Site Mobilization tab ----------
  // The Checklist button opens it over the right edge of the drawing. It lists the checks for every site, then the
  // ones for the city named in the site address. Ticks are kept with the plan (PLAN.checks), so each drawing has its
  // own, and they travel in a saved plan file.
  const CK = window.__CS_CRANE_CHECKS || null; // the crane setup checklist (was Site Mobilization's alone; the layers share one view)
  const ckKey = (scope, text) => { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0; return scope + '.' + h.toString(36); };
  function renderChecks() {
    const el = R.checks;
    if (!el || !CK) return;
    const open = !!store.checksOpen;
    R.root.classList.toggle('cs-checks-open', open);
    el.style.display = open ? 'block' : 'none';
    if (R.btn && R.btn.check) R.btn.check.classList.toggle('cs-on', open);
    if (!open) return;
    const w = CN ? craneWhere() : null, key = w && w.key, city = key && CK.cities[key], cname = key && CN.cities[key].name;
    const done = (PLAN && PLAN.checks) || {};
    let total = 0, ticked = 0;
    const item = (scope, t) => { const k = ckKey(scope, t), on = !!done[k]; total++; if (on) ticked++; return `<label class="cs-ck${on ? ' cs-ck-on' : ''}"><input type="checkbox" data-ck="${k}"${on ? ' checked' : ''}${PLAN ? '' : ' disabled'}><span>${esc(t)}</span></label>`; };
    const every = CK.every.map(([h, items]) => `<div class="cs-cn-h">${esc(h)}</div>${items.map((t) => item('bc', t)).join('')}`).join('');
    const cityHtml = city ? `<h4>${esc(cname)}</h4><div class="cs-note">${esc(city.lead)}</div>${city.items.map((t) => item(key, t)).join('')}`
      : `<h4>City</h4><div class="cs-note cs-cn-status cs-warn">${esc(w && w.unsure ? w.unsure.short : w && w.other ? w.other + ' has no checklist loaded: only the every-site list applies here.' : w ? 'No city is recognised in the site address. Add the city\'s name to see its list.' : 'Enter the site address in the Project panel to add the city\'s list.')}</div>`;
    el.innerHTML = `<div class="cs-ck-top"><b>Crane setup checklist</b><button class="cs-btn" data-ck-close title="Close the checklist">Close</button></div>` +
      `<div class="cs-note">${PLAN ? `<b data-ck-count></b> Ticks are kept with this drawing.` : 'Open a drawing to keep ticks with it.'} As of ${esc(CK.asOf)}. "Unconfirmed" items were not settled: call before relying on them.</div>` +
      cityHtml + `<h4>Every site</h4>` + every;
    const cnt = el.querySelector('[data-ck-count]');
    if (cnt) cnt.textContent = `${ticked} of ${total} ticked.`;
  }
  function onCheckChange(e) {
    const inp = e.target.closest && e.target.closest('[data-ck]');
    if (!inp || !PLAN) return;
    if (!PLAN.checks) PLAN.checks = {};
    if (inp.checked) PLAN.checks[inp.dataset.ck] = 1; else delete PLAN.checks[inp.dataset.ck];
    save();
    inp.parentNode.classList.toggle('cs-ck-on', inp.checked);
    const all = R.checks.querySelectorAll('[data-ck]'), cnt = R.checks.querySelector('[data-ck-count]');
    if (cnt) cnt.textContent = `${[...all].filter((x) => x.checked).length} of ${all.length} ticked.`;
  }

  function onPointerMove(e) {
    craneNotesAt(e);
    if (R.ptrs.has(e.pointerId)) R.ptrs.set(e.pointerId, local(e));
    if (R.pinch) { movePinch(); return; }
    if (R.zwin && R.zwin.a && !offPlan() && (R.zwin.id === e.pointerId || (R.zwin.id == null && !R.ptrs.size))) { R.zwin.b = toMap(...local(e)); dirty(); return; } // dragged, or after a first click
    const d = R.drag;
    if (d && d.id === e.pointerId) {
      const [x, y] = local(e), dx = x - d.x, dy = y - d.y;
      if (d.move) { // a handle moves only once the pointer has really moved: a tap leaves it where it was
        if (!d.started && Math.hypot(dx, dy) <= (d.touch ? 8 : 4)) return;
        d.started = true; d.move(e); return;
      }
      if (!d.moved && Math.hypot(dx, dy) > (d.touch ? 8 : 4)) { d.moved = true; if (d.item) pushUndo(); }
      if (!d.moved) return;
      if (d.item) {
        const it = find(d.item);
        if (!it) { R.drag = null; R.map.classList.remove('cs-grabbing'); cranePanelAt(); return; } // deleted or undone mid-drag
        it.pts = d.orig.map((q) => [q[0] + dx / V.z, q[1] + dy / V.z]);
        if (it.sym === '_text') { R.snap = snapText(it.pts[0], it.id); if (R.snap) it.pts[0] = R.snap.p.slice(); } // a dragged label snaps like a new one
        else { // a symbol snaps by its point; an area or a line by its point nearest where it was taken hold of, the rest moving with it
          if (d.anchor == null) { const g = toMap(d.x, d.y); d.anchor = d.orig.reduce((b, q, k) => (Math.hypot(q[0] - g[0], q[1] - g[1]) < Math.hypot(d.orig[b][0] - g[0], d.orig[b][1] - g[1]) ? k : b), 0); }
          const sn = snapPoint(it.pts[d.anchor], it.id);
          R.snap = sn;
          if (sn) { const ox = sn.p[0] - it.pts[d.anchor][0], oy = sn.p[1] - it.pts[d.anchor][1]; it.pts = it.pts.map((q) => [q[0] + ox, q[1] + oy]); }
        }
      }
      else { V.cx = d.cx - dx / V.z; V.cy = d.cy - dy / V.z; }
      dirty();
    } else if (!d && aims() && e.pointerType !== 'touch' && R.map.contains(e.target)) {
      // Calibrate and the drawing tools: the marker shows where the click will land
      R.shift = e.shiftKey; R.hover = e.target.closest('.cs-ui') ? null : local(e);
      reaim(toMap(...local(e)));
    } else if (!d && R.draft && (R.mode === 'draw' || R.mode === 'cal') && e.pointerType !== 'touch' && R.map.contains(e.target)) {
      R.cursor = toMap(...local(e)); dirty();
    }
  }
  function reaim(m) { // the marker and the draft's loose end, for a cursor at m (a mouse move, or Shift going down or up)
    const a = R.hover ? aim(m) : { p: m, s: null };
    R.snap = a.s;
    if (R.draft) R.cursor = a.p;
    dirty();
  }
  function onShift(e) { // Shift pressed or let go with the mouse still: the lock shows at once
    if (e.key !== 'Shift' || !D.ready || offPlan() || R.shift === e.shiftKey) return;
    R.shift = e.shiftKey;
    if (aims() && R.hover && !R.drag) reaim(toMap(...R.hover));
  }
  function onPointerUp(e) {
    if (!R.ptrs.has(e.pointerId)) return;
    R.shift = e.shiftKey;
    R.ptrs.delete(e.pointerId);
    if (R.pinch) {
      if (R.ptrs.size < 2) { // carry on panning with the finger that is still down
        R.pinch = null;
        const [id, p] = [...R.ptrs.entries()][0] || [];
        R.drag = id == null ? null : { id, x: p[0], y: p[1], moved: true, cx: V.cx, cy: V.cy, item: null, pan: true, touch: true };
      }
      return;
    }
    if (R.zwin && R.zwin.id === e.pointerId) {
      const z = R.zwin; z.id = null;
      if (e.type === 'pointercancel' || !z.a) { z.a = z.b = null; dirty(); return; }
      z.b = toMap(...local(e));
      const sa = toScreen(...z.a), sb = toScreen(...z.b);
      if (Math.abs(sb[0] - sa[0]) > 6 && Math.abs(sb[1] - sa[1]) > 6) zoomWindow(z.a, z.b); // else a click: the first corner, waiting for the other
      dirty(); return;
    }
    const d = R.drag;
    if (!d || d.id !== e.pointerId) return;
    R.drag = null; R.map.classList.remove('cs-grabbing'); cranePanelAt();
    if (R.snap && d.item) { R.snap = null; dirty(); }
    if (d.up) { d.up(e); return; }
    if (e.type === 'pointercancel') { if (d.moved && d.item) save(); return; }
    if (d.moved) { if (d.item) { save(); R.snap = null; dirty(); } return; } // the snap marker of a moved item goes
    if (d.pan) return;
    const [x, y] = local(e), now = performance.now(), lt = R.lastTap;
    const dbl = !!lt && now - lt.t < 400 && Math.hypot(x - lt.x, y - lt.y) < (d.touch ? 24 : 8);
    // The second click of a double-click places nothing with a symbol, the Dimension tool or a rectangle area (it
    // stacked a second symbol, started a stray dimension or made a flat rectangle: review, 2026-11-17), and further
    // quick clicks on the spot are skipped too, so a triple-click places one symbol
    const st = R.mode === 'draw' && R.tool ? STYLE[R.tool] : null;
    const once = R.mode === 'draw' && !!R.tool && R.tool !== '_text' && (!st || isDimTool() || byCorners(st) || !!st.trailer);
    R.tapGap = R.lastTapT ? now - R.lastTapT : Infinity; R.lastTapT = now; // since the tap before (any): a quick one is a repeat
    const fin = R.finished; R.finished = null;
    // the 3rd click of a triple-click on the spot where a double-click just finished a line or area: not a new start
    if (!dbl && fin && R.mode === 'draw' && now - fin.t < 450 && Math.hypot(x - fin.x, y - fin.y) < (d.touch ? 24 : 8)) { R.lastTap = null; return; }
    R.lastTap = dbl && !once ? null : { t: now, x, y };
    if (dbl && once) return;
    R.tapTouch = !!d.touch;
    if (!d.item) onMapClick(x, y);
    if (dbl) { const had = R.mode === 'draw' && !!R.draft; onDoubleTap(d); if (had && !R.draft) R.finished = { t: now, x, y }; }
  }
  function startPinch() {
    const d = R.drag;
    if (d && d.item && d.moved) { save(); R.snap = null; dirty(); } // the item stays wherever it got to
    R.drag = null; R.map.classList.remove('cs-grabbing'); cranePanelAt();
    if (d && d.up) d.up({ pinch: true }); // a handle being dragged ends where it got to (saved, snap marker cleared)
    if (R.snap) { R.snap = null; dirty(); }
    const [a, b] = [...R.ptrs.values()];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    R.pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), z0: V.z, m: toMap(mid[0], mid[1]), home: { cx: V.cx, cy: V.cy } };
  }
  function movePinch() {
    const [a, b] = [...R.ptrs.values()];
    if (!a || !b) return;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dist = Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1]));
    const z = clampZ(R.pinch.z0 * dist / R.pinch.d0), floor = zoomFloor();
    if (floor && z <= floor * 1.0001) { if (R.home) { atSheet(); return; } V.z = floor; } // out to the whole sheet: as it was; at it, two fingers pan it
    else { if (floor && !R.home && R.pinch.z0 <= floor * 1.0001) R.home = R.pinch.home; V.z = z; } // in from the whole sheet: the print area stays
    V.cx = R.pinch.m[0] - (mid[0] - V.w / 2) / V.z; V.cy = R.pinch.m[1] - (mid[1] - midY(V)) / V.z;
    dirty();
  }
  // corners, edge midpoints, crane reach and crane pie edges
  function dragVertex(e, vh) {
    const it = find(R.sel); if (!it) return null;
    if (vh.classList.contains('cs-va')) { // drag a pie edge to set the swing angle (snaps to 5 degrees)
      const c = toScreen(it.pts[0][0], it.pts[0][1]), edge = +vh.dataset.e; let moved = false;
      const norm = (x) => ((x % 360) + 360) % 360;
      return {
        move(ev) {
          if (!moved) { moved = true; pushUndo(); }
          const p = local(ev), ang = Math.round(Math.atan2(p[1] - c[1], p[0] - c[0]) * 180 / Math.PI / 5) * 5;
          if (edge === 0) { const end = it.a0 + it.sweep; it.a0 = ang; it.sweep = norm(end - ang); } else it.sweep = norm(ang - it.a0);
          it.sweep = Math.min(355, Math.max(5, it.sweep)); dirty();
        },
        up() { save(); updateUi(); },
      };
    }
    if (vh.classList.contains('cs-vr')) { // drag the yellow handle to set the crane's reach (0.5 m steps once scaled)
      const c = toScreen(it.pts[0][0], it.pts[0][1]); let moved = false;
      return {
        move(ev) {
          if (!moved) { moved = true; pushUndo(); }
          const p = local(ev), m = mpu();
          let r = Math.hypot(p[0] - c[0], p[1] - c[1]) / V.z;
          r = m ? Math.max(2, Math.round(r * m * 2) / 2) / m : Math.max(6 / V.z, r);
          it.r = r; if (it.spec && m) it.spec.jib = Math.round(r * m * 2) / 2; // the reach is the jib length
          dirty();
        },
        up() { save(); if (R.specId === it.id) renderSpec(); },
      };
    }
    if (vh.classList.contains('cs-vo')) { // drag the yellow square to slide a dimension's line in or out
      let moved = false;
      return {
        move(ev) {
          if (!moved) { moved = true; pushUndo(); }
          let off = dimOff(it.pts, toMap(...local(ev)));
          if (Math.abs(off) * V.z < 4) off = 0;
          if (off) it.off = off; else delete it.off;
          dirty();
        },
        up() { save(); },
      };
    }
    let i = +vh.dataset.i;
    const st = STYLE[it.sym];
    if (st.dim) { // an end of a dimension snaps as it did when it was placed, and Shift locks it to the other end
      let moved = false;
      const other = it.pts[i ? 0 : it.pts.length - 1].slice();
      return {
        move(ev) {
          if (!moved) { moved = true; pushUndo(); }
          const m = toMap(...local(ev));
          let s = snapPoint(m, it.id);
          if (ev.shiftKey) s = withLock(other, s, m);
          R.snap = s; it.pts[i] = s ? s.p.slice() : m; dirty();
        },
        up() { R.snap = null; save(); dirty(); },
      };
    }
    if (boxy(st) && it.pts.length === 4) { // a box or circle: the opposite corner stays put and it stays a box; Shift: square
      if (e.shiftKey) { removeVertex(it, st, i); return null; }
      const o = it.pts[(i + 2) % 4].slice(), nx = it.pts[(i + 1) % 4], cur = it.pts[i];
      const sameX = Math.abs(nx[0] - cur[0]) <= Math.abs(nx[1] - cur[1]); // the next corner is straight above or below this one
      let moved = false;
      return {
        move(ev) {
          if (!moved) { moved = true; pushUndo(); }
          const m = toMap(...local(ev)), sn = snapPoint(m, it.id);
          let q = sn ? sn.p : m;
          if (ev.shiftKey) q = squareTo(o, q);
          R.snap = sn && !ev.shiftKey ? sn : null;
          it.pts[i] = [q[0], q[1]];
          it.pts[(i + 1) % 4] = sameX ? [q[0], o[1]] : [o[0], q[1]];
          it.pts[(i + 3) % 4] = sameX ? [o[0], q[1]] : [q[0], o[1]];
          dirty();
        },
        up() { R.snap = null; save(); dirty(); },
      };
    }
    if (vh.classList.contains('cs-vm')) {
      pushUndo(); const a = it.pts[i], b = it.pts[(i + 1) % it.pts.length];
      it.pts.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); i += 1; save(); dirty();
    } else if (e.shiftKey) { removeVertex(it, st, i); return null; }
    const isNew = vh.classList.contains('cs-vm');
    let moved = false;
    return {
      move(ev) { // the corner or point snaps as it is dragged, as when it was drawn
        if (!moved) { moved = true; if (!isNew) pushUndo(); }
        const m = toMap(...local(ev)), sn = snapPoint(m, it.id);
        R.snap = sn; it.pts[i] = sn ? sn.p.slice() : m; dirty();
      },
      up(ev) {
        if (ev && (ev.pinch || ev.type === 'pointercancel')) { R.lastVTap = null; if (moved) save(); return; } // not a tap
        if (!moved && !isNew) { // double-tap a corner to remove it
          const now = performance.now(), lv = R.lastVTap;
          if (lv && lv.id === it.id && lv.i === i && now - lv.t < 400) { R.lastVTap = null; removeVertex(it, st, i); return; }
          R.lastVTap = { id: it.id, i, t: now };
        }
        R.snap = null; save(); dirty();
      },
    };
  }
  function removeVertex(it, st, i) {
    if (boxy(st)) { toast(`A ${itemName(it.sym).toLowerCase()} keeps its 4 corners: drag one to resize it.`); return; }
    const min = st.kind === 'area' ? 3 : 2;
    if (it.pts.length > min) { pushUndo(); it.pts.splice(i, 1); save(); dirty(); }
    else toast(st.kind === 'area' ? 'An area needs at least 3 corners.' : 'A line needs at least 2 points.');
  }
  function onWheel(e) {
    if (!D.ready || e.target.closest('.cs-ui')) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const f = Math.exp(-Math.max(-1, Math.min(1, e.deltaY * k * (e.ctrlKey ? 0.01 : 0.003))));
    zoomAt(...local(e), f);
  }
  // The top tabs show one plan at a time; an instance sits idle while another tab is showing.
  function offPlan() { return document.body.dataset.plan !== CFG.id; }
  const ROT_KEYS = { Minus: -1, NumpadSubtract: -1, Equal: 1, NumpadAdd: 1 }; // with Ctrl (Cmd) + Shift: a quarter turn
  // ---------- keyboard shortcuts ----------
  // A key for every toolbar tool (user, 2026-11-19: "keyboard shortcuts for all the toolbar tools"), mostly the letters
  // Bluebeam, AutoCAD and drawing programs use. Each presses its toolbar button, so it does just what the button does,
  // and only when the button is there to press (the crane's with a crane selected, the text style's with the Text tool
  // or a label). Plain keys work only when no field has the typing; Ctrl is Cmd on a Mac. "?" (or the ? button) lists
  // them all; the buttons' tooltips name theirs. Hold Space to pan with any tool, as in Bluebeam and Acrobat.
  const KEY_TOOLS = { v: 'select', h: 'pan', p: 'poly', r: 'rect', t: 'text', d: 'dim', b: 'box', o: 'ell', k: 'cloud', l: 'check', s: 'snap', f: 'fit', z: 'zwin', a: 'mz', c: 'pie', e: ['spec', 'tsz'], '[': 'trl', ']': 'trr' }; // E: whichever of the two is showing
  const KEY_LIST = [
    ['Tools', [['V', 'Select'], ['H', 'Pan (or hold Space with any tool)'], ['P', 'Polygon: areas by their corners'], ['R', 'Rect: areas by two corners'], ['T', 'Text label'], ['D', 'Dimension'], ['B', 'Box (Notes layer)'], ['O', 'Circle (Notes layer)'], ['K', 'Cloud (Notes layer)'], ['Enter', 'Finish the line or area'], ['Esc', 'Stop the tool / cancel']]],
    ['Edit', [['Ctrl+Z', 'Undo'], ['Ctrl+D', 'Duplicate the selected item'], ['Delete', 'Delete the selected item'], ['Shift+Delete', 'Clear the page (asks first)'], ['A', 'Draw the area of the selected symbol'], ['C', 'Crane: swing pie or full circle'], ['E', 'Crane spec / Trailer size'], ['1 to 9', 'Text colour (Text tool, or a label selected)'], ['[ and ]', 'Turn the text 15°'], ['- and =', 'Text smaller / larger']]],
    ['View', [['F', 'Fit the page'], ['Z', 'Selected: zoom window'], ['Ctrl+Shift+Minus / Plus', 'Rotate the page left / right'], ['S', 'Snap on / off'], ['L', 'Crane setup checklist']]],
    ['File', [['Ctrl+O', 'Open a drawing'], ['Ctrl+S', 'Save plan file'], ['Ctrl+E', 'Export image (preview first)'], ['Ctrl+Shift+E', 'Export PDF (preview first)'], ['Ctrl+P', 'Print (preview first)'], ['?', 'This list']]],
  ];
  function showKeys() {
    csInfo('Keyboard shortcuts', KEY_LIST.map(([g, rows]) => `<h4>${esc(g)}</h4><table>${rows.map(([k, w]) => `<tr><td>${k.split(' / ').map((x) => x.split(' and ').map((y) => `<kbd>${esc(y)}</kbd>`).join(' and ')).join(' / ')}</td><td>${esc(w)}</td></tr>`).join('')}</table>`).join('') +
      '<p>Ctrl is Cmd (⌘) on a Mac. Letter keys do nothing while you are typing in a field.</p>');
  }
  const press = (b) => { if (!b || b.disabled || !b.getClientRects().length) return false; b.click(); return true; }; // only a button that is showing
  function fileKey(e) { // Ctrl+O, S, E, P and ?: before a drawing is open too
    const mod = (e.ctrlKey || e.metaKey) && !e.altKey, k = (e.key || '').toLowerCase();
    if (!mod && !e.altKey && e.key === '?') { e.preventDefault(); showKeys(); return true; }
    if (!mod) return false;
    if (k === 'o' && !e.shiftKey) { e.preventDefault(); R.fileIn.click(); return true; }
    const b = k === 's' && !e.shiftKey ? R.savePlanBtn : k === 'e' ? (e.shiftKey ? R.btn.pdf : R.btn.export) : k === 'p' && !e.shiftKey ? R.btn.print : null;
    if (!b) return false;
    e.preventDefault(); // not the browser's own Save page, address bar search or Print
    if (!D.ready) toast('Open a drawing first.', 'err'); else if (!e.repeat) press(b);
    return true;
  }
  function toolKey(e) { // plain keys for the tools; true when one was used
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = (e.key || '').length === 1 ? e.key.toLowerCase() : '';
    if (!k) return false;
    if (/^[1-9]$/.test(k)) { if (!e.repeat && press(R.btn.tcol.querySelectorAll('[data-col]')[+k - 1])) { e.preventDefault(); return true; } return false; } // AutoCAD colours 1 to 9
    if ('-_=+'.includes(k)) { // text size, one step
      const sel = R.btn.tsize;
      if (!sel.getClientRects().length) return false;
      const i = sel.selectedIndex + ('-_'.includes(k) ? -1 : 1);
      if (i >= 0 && i < sel.options.length) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); }
      e.preventDefault(); return true;
    }
    const ids = KEY_TOOLS[k];
    if (!ids || (e.shiftKey && /[a-z]/.test(k))) return false;
    if (e.repeat) { e.preventDefault(); return true; } // held down: once
    const always = (id) => (id === 'fit' || id === 'zwin') && D.ready && !R.btn[id].disabled && (R.btn[id].click(), true); // Fit and Selected: also with the Drawing panel behind a tab
    if ([].concat(ids).some((id) => always(id) || press(R.btn[id]))) { e.preventDefault(); return true; }
    return false;
  }
  function onSpace(e) { // Space held: any drag pans, whatever the tool (onPointerDown)
    if (e.code !== 'Space' && e.key !== ' ') return;
    const t = e.target, down = e.type === 'keydown';
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (down && (!D.ready || offPlan() || R.exporting)) return;
    if (down && t && t.tagName === 'BUTTON' && t.blur) t.blur(); // or Space would press the button last clicked
    e.preventDefault();
    if (R.space !== down) { R.space = down; R.root.classList.toggle('cs-spacepan', down); }
  }
  function onKey(e) {
    if (R.exporting) return; // nothing changes while an export runs
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (offPlan() || fileKey(e)) return;
    if (!D.ready) return;
    if (e.key === 'Escape' && R.zwin) { R.zwin = null; dirty(); updateUi(); e.preventDefault(); return; } // the zoom window first
    if (e.key === 'Escape') {
      if (R.draft && R.mode === 'draw') R.draft = null;
      else if (R.mode === 'draw' || R.mode === 'cal') setMode('pan');
      else if (R.sel) R.sel = null;
      else return;
      dirty(); updateUi(); e.preventDefault();
    } else if (e.key === 'Enter' && R.draft && R.mode === 'draw') { finishDraft(); updateUi(); e.preventDefault(); }
    else if (e.key === 'Backspace' && R.draft && R.mode === 'draw') { R.draft.pts.pop(); if (!R.draft.pts.length) R.draft = null; dirty(); updateUi(); e.preventDefault(); }
    else if (e.key === 'Delete' && e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (!e.repeat) press(R.btn.clear); } // Clear, which asks first
    else if ((e.key === 'Delete' || e.key === 'Backspace') && R.sel) { delSel(); updateUi(); e.preventDefault(); }
    // Rotate the page, with Bluebeam's and Acrobat's keys: Ctrl+Shift+Minus left, Ctrl+Shift+Plus right (Cmd on a Mac).
    // By physical key (e.code), so Shift turning = into + or - into _ does not matter; the number pad's - and + work too.
    // preventDefault keeps the browser from zooming the whole page on the same keys.
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && ROT_KEYS[e.code]) { rotatePage(ROT_KEYS[e.code]); e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { dupSel(); updateUi(); e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); updateUi(); e.preventDefault(); }
    else toolKey(e);
  }

  // ---------- the shared drawing (csShared, above) ----------
  function sharedLoad() { // once per page load: what was shared last time
    if (!csShared.loaded) csShared.loaded = (async () => {
      let j = {};
      try { j = JSON.parse(localStorage.getItem('siteLogistics.shared') || '{}') || {}; } catch (e) { /* start clean */ }
      csShared.page = +j.page || 1; csShared.scales = (j.scales && typeof j.scales === 'object') ? j.scales : {};
      csShared.rots = (j.rots && typeof j.rots === 'object') ? j.rots : {};
      const rec = (await recallFile('shared')) || (await recallFile('last')); // 'last': Site Mobilization's drawing from before the tabs shared one
      if (rec && rec.data && !csShared.rec) csShared.rec = rec;
    })();
    return csShared.loaded;
  }
  function shareScale(page) { // this tab changed the drawing's scale (of one page, or all of them): it is every tab's now
    if (!PLAN || !D.key) return;
    if (page) { // only that page's: another window may have set the others since (review, 2026-11-17)
      const m = Object.assign({}, csShared.scales[D.key] || {}), c = (PLAN.pages || {})[page];
      if (c) m[page] = JSON.parse(JSON.stringify(c)); else delete m[page];
      csShared.scales[D.key] = m;
    } else { // every page this tab has a scale for, or cleared; a page only looked at ({ mpu: null }) is not a clearing
      const m = Object.assign({}, csShared.scales[D.key] || {});
      Object.keys(PLAN.pages || {}).forEach((k) => { const c = PLAN.pages[k]; if (c && (c.mpu > 0 || c.cleared)) m[k] = JSON.parse(JSON.stringify(c)); });
      csShared.scales[D.key] = m;
    }
    const keys = Object.keys(csShared.scales); if (keys.length > 40) delete csShared.scales[keys[0]];
    csSharedSave('scale');
  }
  function takeSharedScale(quiet) { // quiet: taken from another window, not written back from here
    if (!PLAN || !D.key) return;
    const sc = csShared.scales[D.key];
    if (sc) { // the shared scale of each page; a page it has none for (not cleared) keeps this tab's own, which is shared now
      const pages = {}, mine = PLAN.pages || {}, own = [];
      new Set([...Object.keys(sc), ...Object.keys(mine)]).forEach((k) => {
        const s = sc[k] || {}, m = mine[k] || {};
        if (s.mpu > 0) pages[k] = { mpu: s.mpu };
        else if (s.cleared) pages[k] = { mpu: null, cleared: 1 };
        else if (m.mpu > 0) { pages[k] = { mpu: m.mpu }; own.push(k); }
        else pages[k] = { mpu: null };
      });
      PLAN.pages = pages; if (!quiet) { save(); own.forEach((k) => shareScale(k)); } syncCraneReach(quiet);
    }
    else if (Object.keys(PLAN.pages || {}).some((k) => PLAN.pages[k] && PLAN.pages[k].mpu)) shareScale(); // set here before scales were shared
  }
  async function syncShared() { // called each time this tab is shown: catch up with the shared drawing and page
    if (R.exporting) { R.activatePending = true; return; } // shown again during its own export: caught up after it
    await sharedLoad();
    const rec = csShared.rec;
    if (!rec) return;
    if (D.key !== rec.key) await openFile({ name: rec.name, type: rec.type, data: rec.data, key: rec.key }, true);
    if (!D.ready || D.key !== rec.key) return;
    takeSharedScale();
    const pg = Math.min(D.pages, Math.max(1, csShared.page));
    if (D.page !== pg || D.rot !== sharedRot(pg)) await showPage(pg, true); // another page, or this one was turned on another tab
    updateSide(); dirty();
  }

  // ---------- the legend: the layers ----------
  // Each layer (plans.js) is a heading in the legend: an eye to show or hide it, its name and how many items it has on
  // this page, and its opacity; under it, dropped down or not, its symbols and hatches, and picking one places it on
  // that layer (user, 2026-11-19: "the tabs are going to the legend to work like layers, with a drop-down of options
  // for symbols and hatches ... visibility toggle and opacity can be changed for each discipline"). The layer being
  // worked on (the tool in hand, or the item selected) is marked. Shown or hidden and the opacity are kept with the plan
  // (they decide what the export prints); which lists are dropped down is kept with this browser (store.open).
  const EYE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.6-4.4 6-6.6 10-6.6s7.4 2.2 10 6.6c-2.6 4.4-6 6.6-10 6.6S4.6 16.4 2 12Z" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
  const LOCK_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="5" y="10.5" width="14" height="10" rx="1.6" fill="currentColor"/></svg>';
  const LOCK_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10.5V7.8a4 4 0 0 1 7.7-1.6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5.8" y="11.3" width="12.4" height="8.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.6-4.4 6-6.6 10-6.6s7.4 2.2 10 6.6c-2.6 4.4-6 6.6-10 6.6S4.6 16.4 2 12Z" fill="none" stroke="currentColor" stroke-width="1.9" opacity=".45"/><path d="M4 20 20 4" stroke="currentColor" stroke-width="2.1"/></svg>';
  function legendHtml() {
    return LAYERS.map((l) => `<div class="cs-lyr" data-layer="${l.id}">` +
      '<div class="cs-lyr-head">' +
      `<button type="button" class="cs-lyr-eye" data-eye aria-pressed="true" title="Show or hide the ${esc(l.label)} layer, on screen and on the sheet">${EYE_ON}</button>` +
      `<button type="button" class="cs-lyr-lock" data-lock aria-pressed="false" title="Lock or unlock the ${esc(l.label)} layer: locked, it shows and prints but its markup cannot be selected, moved, deleted or added to">${LOCK_OFF}</button>` +
      `<button type="button" class="cs-lyr-name" data-fold aria-expanded="false" title="Show or hide the ${esc(l.label)} symbols"><span class="cs-lyr-car" aria-hidden="true"></span><b>${esc(l.label)}</b><small class="cs-lyr-n"></small></button>` +
      `<label class="cs-lyr-op" title="Opacity of the ${esc(l.label)} layer, on screen and on the sheet"><input type="range" data-op min="0.1" max="1" step="0.05" value="1" aria-label="${esc(l.label)} opacity"><span>100%</span></label>` +
      '</div>' +
      // a layer of one section needs no second heading; Site Mobilization's several keep theirs
      `<div class="cs-lyr-body">${l.sections.map((sec) => (l.sections.length > 1 ? `<div class="cs-sec">${esc(sec.title)}</div>` : '') + legendRows(sec.items, l.id)).join('')}` +
      (l.notes ? '<div class="cs-lyr-note">Text, Dimension, Box, Circle and Cloud in the toolbar place them here too. Not listed in the exported legend.</div>' : '') + '</div>' +
      '</div>').join('');
  }
  const activeLayer = () => (R.mode === 'draw' && R.tool && R.lyr) || (R.sel && find(R.sel) ? layerOf(find(R.sel)) : null);
  function renderLegend() {
    if (!R.legend) return;
    if (!store.open || typeof store.open !== 'object') store.open = {};
    if (!Object.keys(store.open).length) store.open[LAYERS[0].id] = 1; // the first time: the first layer's symbols showing
    const here = PLAN && D.ready ? PLAN.items.filter((i) => i.pg === D.page) : [], act = activeLayer();
    R.legend.querySelectorAll('.cs-lyr').forEach((el) => {
      const id = el.dataset.layer, on = layerOn(id), op = layerOp(id), n = here.filter((i) => layerOf(i) === id).length, open = !!store.open[id];
      el.classList.toggle('cs-lyr-off', !on); el.classList.toggle('cs-lyr-open', open); el.classList.toggle('cs-lyr-act', id === act);
      const eye = el.querySelector('[data-eye]');
      if (eye.getAttribute('aria-pressed') !== String(on)) { eye.setAttribute('aria-pressed', String(on)); eye.innerHTML = on ? EYE_ON : EYE_OFF; }
      eye.disabled = !PLAN;
      const lk = el.querySelector('[data-lock]'), locked = layerLocked(id);
      el.classList.toggle('cs-lyr-locked', locked);
      if (lk.getAttribute('aria-pressed') !== String(locked)) { lk.setAttribute('aria-pressed', String(locked)); lk.innerHTML = locked ? LOCK_ON : LOCK_OFF; }
      lk.disabled = !PLAN;
      el.querySelector('[data-fold]').setAttribute('aria-expanded', String(open));
      el.querySelector('.cs-lyr-n').textContent = n ? `${n} on this page` : '';
      const r = el.querySelector('[data-op]');
      r.disabled = !PLAN;
      if (document.activeElement !== r && +r.value !== op) r.value = op;
      r.nextElementSibling.textContent = Math.round(op * 100) + '%';
    });
  }
  function setLayer(id, ch, noSave) { // ch: { off }, { op } and/or { lock }; noSave: a slider still moving (saved on its change)
    if (!PLAN || !LAYER[id]) return;
    const cur = Object.assign({}, layerSet(id), ch);
    if (!cur.off) delete cur.off;
    if (!cur.lock) delete cur.lock;
    if (!(cur.op > 0 && cur.op < 1)) delete cur.op;
    PLAN.layers = Object.assign({}, PLAN.layers);
    if (Object.keys(cur).length) PLAN.layers[id] = cur; else delete PLAN.layers[id];
    if (cur.off || cur.lock) { // hidden or locked: nothing on it stays selected or in hand
      const s = R.sel && find(R.sel);
      if (s && layerOf(s) === id) { R.sel = null; if (R.specId === s.id) closeSpec(); }
      if (R.mode === 'draw' && R.lyr === id) setMode('pan');
    }
    if (!noSave) save();
    renderLegend(); updateUi(); dirty();
  }

  // ---------- page overlay ----------
  // Up to four other pages laid over the page showing, five with it, to see how floors and levels line up (user,
  // 2026-11-19: "up to 5 pages can be overlaid with each other. Each with their own drawings/annotations ... during
  // printing, it will only be one page"). Each has an eye and an opacity in the page-setup column, kept with the plan
  // (PLAN.ovl: [{ pg, off, op }]). Its drawing is multiplied over this one (its white paper drops out, its lines
  // darken), and its markup on the shown layers goes above, view only. Pages are laid by their top-left corners and
  // turned with the page showing (their markup turned for the screen only), so the sheets of one set line up.
  // Exports print the page showing alone.
  const OVL_MAX = 4, OVL_OP = 0.5;
  const ovlList = () => (PLAN && Array.isArray(PLAN.ovl) ? PLAN.ovl : []);
  const ovlOp = (o) => (o.op > 0 && o.op <= 1 ? o.op : OVL_OP);
  function ovlShown() { // the pages laid over now: shown, not the page showing, each once
    if (!D.ready || D.pages < 2) return [];
    const seen = new Set();
    return ovlList().filter((o) => o.pg !== D.page && o.pg >= 1 && o.pg <= D.pages && !o.off && !seen.has(o.pg) && seen.add(o.pg));
  }
  async function ovlPicture(n, rot) { // page n's drawing turned `rot` quarter turns: a canvas, its size in drawing units, and unturned
    if (D.kind === 'pdf') {
      const page = await D.pdf.getPage(n);
      const vp = (k, r) => page.getViewport({ scale: k, rotation: (page.rotate + 90 * r) % 360 });
      const v0 = vp(1, 0), v = vp(1, rot);
      const k = Math.min(4096 / Math.max(v.width, v.height), Math.sqrt((COARSE ? 2.5e6 : 5e6) / (v.width * v.height)), 3);
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(v.width * k)); cv.height = Math.max(1, Math.round(v.height * k));
      await page.render({ canvas: cv, viewport: vp(k, rot) }).promise;
      return { cv, w: v.width, h: v.height, w0: v0.width, h0: v0.height };
    }
    if (D.set && D.set.entries[n - 1]) { // an image of a set
      const en = D.set.entries[n - 1], im = await loadImage(await zipRead(D.set.buf, en), '', baseName(en.name), D.docGen);
      try {
        const img = im.img, w0 = img.naturalWidth, h0 = img.naturalHeight;
        let cv = rot ? turned(img, rot) : null;
        if (!cv) { cv = document.createElement('canvas'); cv.width = w0; cv.height = h0; cv.getContext('2d').drawImage(img, 0, 0); }
        return { cv, w: rot % 2 ? h0 : w0, h: rot % 2 ? w0 : h0, w0, h0 };
      } finally { URL.revokeObjectURL(im.url); }
    }
    return null;
  }
  async function renderOverlays() { // the overlaid pages' drawings, drawn once per page and turn, then kept while listed
    if (!R.ovls) return;
    const gen = R.ovlGen = (R.ovlGen || 0) + 1, doc = D.docGen, rot = D.rot;
    if (!D.ovl || D.ovl.doc !== doc) D.ovl = { doc, pics: new Map() };
    const want = ovlShown(), key = (pg) => pg + '|' + rot;
    for (const o of want) {
      if (D.ovl.pics.has(key(o.pg))) continue;
      let pic = null;
      try { pic = await ovlPicture(o.pg, rot); }
      catch (e) { if (gen === R.ovlGen) toast(`Could not draw ${D.set ? pageName(o.pg) : 'page ' + o.pg} for the overlay: ${(e && e.message) || e}`, 'err'); }
      if (gen !== R.ovlGen || doc !== D.docGen) { if (pic) dropCanvas(pic.cv); return; } // a newer call, or another drawing
      if (pic) D.ovl.pics.set(key(o.pg), pic);
    }
    while (R.ovls.firstChild) R.ovls.removeChild(R.ovls.firstChild);
    want.forEach((o) => {
      const pic = D.ovl.pics.get(key(o.pg));
      if (!pic) return;
      pic.cv.className = 'cs-ovl-pic'; pic.cv.dataset.pg = o.pg;
      Object.assign(pic.cv.style, { width: pic.w + 'px', height: pic.h + 'px', opacity: String(ovlOp(o)) });
      R.ovls.appendChild(pic.cv);
    });
    const keep = new Set(ovlList().map((o) => key(o.pg))); // hidden but listed: kept, to show again at once
    for (const [k, pic] of D.ovl.pics) if (!keep.has(k)) { dropCanvas(pic.cv); D.ovl.pics.delete(k); }
    dirty();
  }
  function ovlMarkup() { // the overlaid pages' markup on the shown layers, at each page's opacity, under this page's; view only
    let out = '';
    for (const o of ovlShown()) {
      const pic = D.ovl && D.ovl.pics.get(o.pg + '|' + D.rot);
      if (!pic) continue; // drawn once its picture is ready (its size turns the markup)
      const was = ((PLAN.rot && +PLAN.rot[o.pg]) || 0) & 3;
      const its = PLAN.items.filter((i) => i.pg === o.pg && layerOn(layerOf(i))).map((i) => {
        const f = i._r != null ? (+i._r & 3) : was;
        if (f === D.rot) return i;
        const c = JSON.parse(JSON.stringify(i)); delete c._r; // turned for the screen, not saved
        turnItems([c], f, (D.rot - f + 4) % 4, pic.w0, pic.h0);
        return c;
      });
      let s = '';
      for (const l of LAYERS) {
        const t = its.filter((it) => layerOf(it) === l.id).map((it) => drawItem(it, false)).join('');
        if (t) s += layerOp(l.id) < 1 ? `<g opacity="${layerOp(l.id)}">${t}</g>` : t;
      }
      if (s) out += `<g class="cs-locked" opacity="${ovlOp(o)}">${s}</g>`;
    }
    return out;
  }
  function renderOvlPanel() {
    if (!R.ovlBox) return;
    const has = D.ready && D.pages > 1;
    R.ovlBox.style.display = has ? '' : 'none';
    if (!has) return;
    const list = ovlList(), name = (n) => (D.set ? pageName(n) : 'Page ' + n);
    const opts = (sel) => Array.from({ length: D.pages }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>${esc(name(i + 1))}${i + 1 === D.page ? ' (showing)' : ''}</option>`).join('');
    R.ovlRows.innerHTML = list.map((o, i) => {
      const on = !o.off, here = o.pg === D.page;
      return `<div class="cs-ovl-row${on ? '' : ' cs-ovl-off'}${here ? ' cs-ovl-here' : ''}" data-i="${i}">` +
        `<button type="button" class="cs-lyr-eye" data-ovl-eye aria-pressed="${on}" title="Show or hide this page over the one showing">${on ? EYE_ON : EYE_OFF}</button>` +
        `<select data-ovl-pg title="The page laid over this one">${opts(o.pg)}</select>` +
        `<label class="cs-lyr-op" title="Its opacity, drawing and markup"><input type="range" data-ovl-op min="0.1" max="1" step="0.05" value="${ovlOp(o)}" aria-label="Opacity of ${esc(name(o.pg))}"><span>${Math.round(ovlOp(o) * 100)}%</span></label>` +
        '<button type="button" class="cs-btn cs-ovl-x" data-ovl-del title="Take this page off the overlay">×</button></div>' +
        (here ? '<div class="cs-note cs-ovl-hint">That is the page showing, so it is not laid over itself.</div>' : '');
    }).join('');
    R.ovlAdd.disabled = list.length >= OVL_MAX;
    R.ovlAdd.textContent = list.length >= OVL_MAX ? `${OVL_MAX} pages laid over (the most)` : '+ Add a page to lay over';
  }
  function setOvl(list) {
    if (!PLAN) return;
    PLAN.ovl = list.slice(0, OVL_MAX).map((o) => Object.assign({ pg: o.pg, op: ovlOp(o) }, o.off ? { off: 1 } : {}));
    save(); renderOvlPanel(); renderOverlays(); dirty();
  }
  const cleanOvl = (v) => (Array.isArray(v) ? v : []).map((o) => o && Math.round(num(o.pg))).map((pg, i) => (pg >= 1 ? Object.assign({ pg, op: Math.min(1, Math.max(0.1, num(v[i].op) || OVL_OP)) }, v[i].off ? { off: 1 } : {}) : null)).filter(Boolean).slice(0, OVL_MAX);

  // ---------- export: a 17 x 11 in sheet with the visible drawing, the markup and a legend of what was used ----------
  function svgImage(inner, viewBox, w, h) {
    // BAD_CHARS: a last guard, so no character anywhere in the markup can stop the export. A picture cannot see this
    // page's fonts: one with a text label carries the labels' lettering itself.
    const font = csLabelFont.css && inner.includes('Flux Architect') ? `<defs><style>${csLabelFont.css}</style></defs>` : '';
    const s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${font}${inner}</svg>`;
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('could not draw the markup'));
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(stripBad(s));
    });
  }
  const toBlob = (cv, type, q) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('the browser could not make the image (too large?)'))), type, q));
  // The exported legend: for each shown layer with something on this page, its name as a heading and the symbols and
  // hatches used, in its legend's order (text labels and dimensions speak for themselves). Nothing used: the LEGEND
  // heading alone.
  function legendModel() {
    const its = items(), secs = [];
    for (const l of LAYERS) {
      if (l.notes) continue;
      const on = its.filter((i) => layerOf(i) === l.id);
      if (!on.length) continue;
      const used = new Set(on.map((i) => ZONE_SYM[i.sym] || i.sym)), rows = []; // an area counts as its symbol
      l.sections.forEach((sec) => sec.items.forEach((r) => { if (used.has(r.id) && !rows.includes(r)) rows.push(r); }));
      [...used].filter((id) => SYM[id] && !rows.includes(SYM[id])).forEach((id) => rows.push(SYM[id])); // one this layer does not list (a plan file put it here)
      if (rows.length) secs.push(withTailRow([{ title: l.label.toUpperCase(), rows }], mpu() ? on : [])[0]);
    }
    return secs.length ? secs : [{ title: 'LEGEND', rows: [] }];
  }
  function wrapText(g, text, maxW) {
    const words = text.split(/\s+/), lines = [];
    let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (line && g.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  }
  function haloText(g, text, x, y) { g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(text, x, y); g.fillStyle = '#111'; g.fillText(text, x, y); }

  // The sheet, in 1/100 in units (u canvas px each): the map window at the sheet scale, the legend, the title block.
  // noMarkup: the PDF export puts the markup on top as annotations instead. frame: the sheet frame worked out ONCE for
  // this page by the caller, who uses the same one for the annotations and the scale written into the PDF: on Auto the
  // frame follows the window size, so working it out again after an await (the window resized, the pane dragged, a
  // tablet turned, a tab brought to the front) drew the circles at one scale and labelled the page with another.
  async function composeSheet(noMarkup, frame) {
    const { w: BW, h: BH, k: u } = SHEET, W = BW * u, H = BH * u;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const fr = frame || sheetFrame();
    R.frz = fr.z;
    const mx = LAY.map.x + 1, my = LAY.map.y + 1;
    const ix = mx * u, iy = my * u, iw = MAP_IN.w * u, ih = MAP_IN.h * u;
    const ze = fr.z * u; // export px per drawing unit
    const x0 = fr.cx - iw / 2 / ze, y0 = fr.cy - ih / 2 / ze;
    g.save();
    g.beginPath(); g.rect(ix, iy, iw, ih); g.clip(); g.translate(ix, iy);
    if (D.kind === 'pdf') {
      const t = document.createElement('canvas'); t.width = Math.ceil(iw); t.height = Math.ceil(ih);
      await D.pageObj.render({ canvas: t, viewport: pdfVp(D.pageObj, ze), transform: [1, 0, 0, 1, -x0 * ze, -y0 * ze] }).promise;
      g.drawImage(t, 0, 0); t.width = t.height = 0;
    } else g.drawImage(D.img, -x0 * ze, -y0 * ze, D.w * ze, D.h * ze);
    if (PLAN.fade) { g.fillStyle = `rgba(255,255,255,${PLAN.fade})`; g.fillRect(0, 0, iw, ih); }
    // markup, drawn as on screen, with 1 screen px = 1 sheet unit (1/100 in)
    const vv = { z: fr.z, cx: fr.cx, cy: fr.cy, w: MAP_IN.w, h: MAP_IN.h };
    R.frz = fr.z; // again: a screen redraw during the awaits above sets it to the screen's frame
    const svg = noMarkup ? '' : withView(vv, () => layerMarkup(true));
    if (svg) g.drawImage(await svgImage(svg, `0 0 ${vv.w} ${vv.h}`, iw, ih), 0, 0, iw, ih);
    g.scale(u, u);
    const m = mpu();
    if (m) drawScaleBar(g, vv, m / vv.z, fr.N);
    g.restore();
    await drawLegend(g, LAY.leg, u, null);
    drawTitleBlock(g, u, fr);
    g.save(); g.scale(u, u); g.strokeStyle = '#111';
    g.lineWidth = 2; g.strokeRect(LAY.map.x, LAY.map.y, LAY.map.w, LAY.map.h);
    g.lineWidth = 3; g.strokeRect(LAY.F.x, LAY.F.y, LAY.F.w, LAY.F.h);
    g.restore();
    return cv;
  }
  // Four-part bar, at most 2.5 in long, on a white card in the map's bottom-left corner, with the scale written above.
  function drawScaleBar(g, vv, mpp, N) {
    const len = niceLen(mpp, 250), bw = len / mpp, seg = bw / 4, x = 18, y = vv.h - 26;
    g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(x - 10, y - 38, bw + 46, 60);
    g.lineWidth = 1; g.strokeStyle = '#111';
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(x + i * seg, y, seg, 6); }
    g.strokeRect(x, y, bw, 6);
    g.fillStyle = '#111'; g.font = '10px Arial, Helvetica, sans-serif'; g.textBaseline = 'top'; g.textAlign = 'center';
    [[0, '0'], [bw / 2, String(len / 2)], [bw, lenLabel(len)]].forEach(([dx, t]) => g.fillText(t, x + dx, y + 9));
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '700 11px Arial, Helvetica, sans-serif';
    g.fillText('SCALE ' + (N ? scaleName(N) : ''), x, y - 8);
  }
  // Fit one line of text into maxW by shrinking the font (down to minPx), then cutting it with an ellipsis.
  function fitText(g, text, maxW, px, minPx, weight) {
    let s = px;
    const setF = () => (g.font = `${weight || 400} ${s}px Arial, Helvetica, sans-serif`);
    setF();
    while (s > minPx && g.measureText(text).width > maxW) { s -= 0.5; setF(); }
    let t = text;
    if (g.measureText(t).width > maxW) { while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); t += '…'; }
    return t;
  }
  // Title block cells, in sheet units. The on-screen panel uses the same cells and widths, so it reads like the print.
  const TB_ROWS = [
    { h: 62, cells: [['project', 'PROJECT', 560, 19], ['address', 'SITE ADDRESS', 440, 15], ['title', 'DRAWING TITLE', 410, 15], ['sheet', 'SHEET', 120, 19], ['rev', 'REV', 120, 19]] },
    { h: 48, cells: [['notes', 'NOTES', 560, 9.5], ['by', 'DRAWN BY', 220, 13], ['checked', 'CHECKED BY', 220, 13], ['date', 'DATE', 210, 13], ['scale', 'SCALE', 440, 15]] },
  ];
  function drawTitleBlock(g, u, fr) {
    const T = LAY.tb, info = PLAN.info;
    g.save(); g.scale(u, u);
    g.fillStyle = '#fff'; g.fillRect(T.x, T.y, T.w, T.h);
    g.strokeStyle = '#111';
    let y = T.y;
    TB_ROWS.forEach((row, ri) => {
      let x = T.x;
      if (ri) { g.lineWidth = 1; g.beginPath(); g.moveTo(T.x, y); g.lineTo(T.x + T.w, y); g.stroke(); }
      row.cells.forEach(([k, label, w, px], ci) => {
        if (ci) { g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + row.h); g.stroke(); }
        g.fillStyle = '#555'; g.font = '700 8.5px Arial, Helvetica, sans-serif'; g.textBaseline = 'top';
        g.fillText(label, x + 6, y + 5);
        g.fillStyle = '#111'; g.textBaseline = 'alphabetic';
        if (k === 'notes') {
          notesText(fr).forEach((t, i) => g.fillText(fitText(g, t, w - 12, px, 7), x + 6, y + 27 + i * 12));
        } else {
          const v = k === 'scale' ? (fr.N ? scaleName(fr.N) + ' at 11 x 17 in' : 'NTS') : String(info[k] || '').trim();
          g.fillText(fitText(g, v, w - 12, px, 8, 700), x + 6, y + row.h - 9);
        }
        x += w;
      });
      y += row.h;
    });
    g.lineWidth = 2; g.beginPath(); g.moveTo(T.x, T.y); g.lineTo(T.x + T.w, T.y); g.stroke();
    g.restore();
  }
  async function drawLegend(g, L, u, title) {
    const secs = legendModel();
    if (title) secs[0] = Object.assign({}, secs[0], { title });
    const inner = { x: L.x + 2, y: L.y + 2, w: L.w - 4, h: L.h - 4 };
    const plan = legendFlow(secs, inner.h);
    const { ncol, rh, SEC_H } = plan, colW = inner.w / ncol;
    const symW = ncol === 1 ? 136 : Math.floor(colW * 0.42), div = symW + 11, tx = symW + 20; // symbol, divider, label
    const rf = Math.min(11.5, rh * 0.36), hf = Math.min(12, SEC_H * 0.4);
    const imgs = await Promise.all(secs.flatMap((s) => s.rows).map((sym) => svgImage((sym.leg || sym).inner, (sym.leg || sym).vb, symW * u, (rh - 4) * u)));
    g.save(); g.scale(u, u);
    g.fillStyle = '#fff'; g.fillRect(L.x, L.y, L.w, L.h);
    g.lineWidth = 2; g.strokeStyle = '#111'; g.strokeRect(L.x + 1, L.y + 1, L.w - 2, L.h - 2);
    g.beginPath(); g.rect(inner.x, inner.y, inner.w, inner.h); g.clip();
    for (let c = 1; c < ncol; c++) { g.fillStyle = '#111'; g.fillRect(inner.x + c * colW - 0.75, inner.y, 1.5, inner.h); } // column rules
    let k = 0;
    for (const e of plan.place) {
      const x = inner.x + e.col * colW, w = colW, y = inner.y + e.y;
      if (e.head) {
        g.fillStyle = '#111'; g.textBaseline = 'alphabetic';
        g.fillText(fitText(g, e.title + (e.cont ? ' (CONT.)' : ''), w - 12, hf, Math.min(hf, 7), 700), x + 8, y + SEC_H * 0.66);
        g.fillRect(x, y + SEC_H - 1.5, w, 1.5);
        continue;
      }
      g.drawImage(imgs[k++], x + 6, y + 2, symW, rh - 4);
      g.fillStyle = '#ccc'; g.fillRect(x + div, y, 1, rh); g.fillRect(x, y + rh - 1, w, 1);
      g.fillStyle = '#111'; g.textBaseline = 'middle';
      let f = rf, lines;
      for (;;) { // a label that wraps past its row's height gets smaller lettering
        g.font = `${f}px Arial, Helvetica, sans-serif`; lines = wrapText(g, e.sym.label, w - tx - 6);
        if ((lines.length * f * 1.2 <= rh - 2 && lines.every((t) => g.measureText(t).width <= w - tx - 6)) || f <= 4) break; // and no word wider than its cell
        f = Math.max(4, f - 0.25);
      }
      const lh = f * 1.2, top = y + rh / 2 - (lines.length - 1) * lh / 2;
      lines.forEach((t, i) => g.fillText(t, x + tx, top + i * lh));
    }
    g.restore();
  }
  // How the legend's rows go in its box: one column with rows 14-34 tall if they fit, else 2, 3 or 4 columns, else rows
  // shorter still. Nothing is left off: a section that runs on into the next column repeats its heading there.
  function legendFlow(secs, H) {
    const flow = (ncol, rh, SEC_H) => {
      const place = []; let col = 0, y = 0;
      const next = () => { col++; y = 0; return col < ncol; };
      for (const s of secs) {
        if (y > 0 && y + SEC_H + (s.rows.length ? rh : 0) > H && !next()) return null; // no heading alone at a column's foot
        place.push({ head: true, title: s.title, col, y }); y += SEC_H;
        for (const sym of s.rows) {
          if (y + rh > H) { if (!next()) return null; place.push({ head: true, title: s.title, cont: true, col, y }); y += SEC_H; }
          place.push({ sym, col, y }); y += rh;
        }
      }
      return { ncol, rh, SEC_H, place };
    };
    for (let ncol = 1; ncol <= 4; ncol++) for (let rh = 34; rh >= 14; rh--) { const f = flow(ncol, rh, 30); if (f) return f; }
    for (let rh = 13; rh >= 6; rh--) { const f = flow(4, rh, Math.max(10, rh + 4)); if (f) return f; }
    for (let ncol = 5; ; ncol++) { const f = flow(ncol, 6, 10); if (f) return f; } // past any real page: a column per ~90 rows
  }
  function download(blob, file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  // Phones and tablets only let a download or share sheet start from a tap, and the export takes a moment,
  // so there the finished sheet waits on a card with its own Save and Share buttons.
  function offerFile(blob, file) {
    const shareable = (() => {
      try { return !!(navigator.canShare && navigator.canShare({ files: [new File([blob], file, { type: blob.type })] })); }
      catch (e) { return false; }
    })();
    R.ready.innerHTML = `<div class="cs-ready-t">Sheet ready</div><div class="cs-ready-f">${esc(file)}</div>` +
      `<div class="cs-ready-b"><button class="cs-btn cs-primary" data-a="save">Save</button>` +
      (shareable ? '<button class="cs-btn" data-a="share">Share…</button>' : '') + '<button class="cs-btn" data-a="close">Close</button></div>';
    R.ready.style.display = 'block';
    R.ready.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'save') download(blob, file);
      else if (a.dataset.a === 'share') navigator.share({ files: [new File([blob], file, { type: blob.type })], title: file }).catch(() => {});
      R.ready.style.display = 'none'; R.ready.innerHTML = '';
    };
  }
  const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function fileBase(all) { // e.g. L-1_rev-B_site-logistics_13450-104-ave_2026-11-09; all: every page, so no page number
    const i = PLAN.info, site = slugify(i.address || i.project || (D.set ? D.name : D.name.replace(/\.[^.]+$/, ''))) || 'site';
    return [slugify(i.sheet), i.rev ? 'rev-' + slugify(i.rev) : '', CFG.slug, site, D.pages > 1 && !all ? 'p' + D.page : '', today()].filter(Boolean).join('_');
  }

  // ---------- plan files: the markup, scales and title block as .json, so the work is not only in this browser ----------
  function savePlanFile() {
    if (!PLAN) { toast('Open a drawing first.', 'err'); return; }
    const data = { app: 'site-logistics', tab: CFG.id, version: 2, saved: new Date().toISOString(), drawing: { name: D.name, pages: D.pages }, plan: PLAN };
    download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), fileBase() + '.json');
    toast('Saved the plan file. Open the same drawing and use Load plan to bring it back.');
  }
  const num = (v) => (Number.isFinite(+v) ? +v : NaN);
  const MAX_PLAN_ITEMS = 10000; // far past any real plan; more than this would only stall the browser
  function cleanItem(it) { // a file is outside data: keep known symbols and numbers only, and give each item a fresh id
    if (!it || (!SYM[it.sym] && !STYLE[it.sym] && it.sym !== '_text') || !Array.isArray(it.pts) || !it.pts.length) return null;
    if (it.sym === '_text' && (typeof it.text !== 'string' || !it.text.trim())) return null;
    const pts = it.pts.map((p) => [num(p && p[0]), num(p && p[1])]);
    if (pts.some((p) => isNaN(p[0]) || isNaN(p[1]) || Math.abs(p[0]) > 1e7 || Math.abs(p[1]) > 1e7)) return null; // not a number, or nowhere near a drawing
    const kind = (STYLE[it.sym] || {}).kind;
    if ((kind === 'line' && pts.length < 2) || (kind === 'area' && pts.length < 3)) return null; // too few points to draw
    if ((boxy(STYLE[it.sym]) || (STYLE[it.sym] || {}).trailer) && pts.length !== 4) return null; // a box, circle or trailer is 4 corners
    const c = { id: uid(), sym: it.sym, pg: Math.max(1, Math.round(num(it.pg)) || 1), pts, layer: LAYER[it.layer] ? it.layer : homeLayer(it.sym) };
    if ([0, 1, 2, 3].includes(it._r)) c._r = it._r; // still facing the way it came (not yet shown since the layers came)
    if (it.sym === '_text') {
      c.text = cleanText(it.text, 120); if (!c.text) return null;
      if (/^#[0-9a-f]{6}$/i.test(String(it.color || '')) && it.color.toLowerCase() !== LABEL_INK) c.color = it.color.toLowerCase(); // its colour
      const rot = labelRot(it); if (rot) c.rot = rot; // its angle, whole degrees anticlockwise
      if (labelH(it) !== LABEL_H0) c.size = labelH(it); // its height, one of the standard ones
    }
    if ((STYLE[it.sym] || {}).note && /^#[0-9a-f]{6}$/i.test(String(it.color || '')) && it.color.toLowerCase() !== LABEL_INK) c.color = it.color.toLowerCase(); // a shape's colour
    if ((STYLE[it.sym] || {}).trailer && it.dims) { const l = num(it.dims.l), w = num(it.dims.w); if (l > 0 && w > 0 && l <= 300 && w <= 300) c.dims = Object.assign({ l, w }, it.dims.ft ? { ft: 1 } : {}); } // a trailer's real size
    if (Number.isFinite(+it.r) && +it.r > 0) c.r = +it.r; // a reach is a positive length
    if (isCrane(it.sym) && it.spec) { const sp = cleanSpec(it.spec); if (sp) c.spec = sp; } // a crane's typed specification
    if ((STYLE[it.sym] || {}).dim && Number.isFinite(+it.off) && +it.off && Math.abs(+it.off) < 1e7) c.off = +it.off; // how far a dimension's line sits from its points
    if (Number.isFinite(+it.sweep) && +it.sweep > 0 && +it.sweep < 360 && Number.isFinite(+it.a0)) { c.sweep = +it.sweep; c.a0 = +it.a0; } // a swing pie needs both
    return c;
  }
  async function loadPlanFile(file) {
    if (!PLAN) { toast('Open the drawing first, then load its plan file.', 'err'); return; }
    let j;
    try { j = JSON.parse(await file.text()); } catch (e) { toast(file.name + ' is not a plan file.', 'err'); return; }
    const p = j && j.app === 'site-logistics' && j.plan;
    if (!p || !Array.isArray(p.items)) { toast(file.name + ' is not a Site Logistics plan file.', 'err'); return; }
    if (p.items.length > MAX_PLAN_ITEMS) { toast(`${file.name} has ${p.items.length.toLocaleString()} items; a plan file can hold ${MAX_PLAN_ITEMS.toLocaleString()} at most.`, 'err'); return; }
    const other = j.drawing && j.drawing.name && j.drawing.name !== D.name;
    // A file from one of the tabs, from before the layers (files from before the tabs are Site Mobilization's; the
    // Overlay's held its text labels and dimensions): it replaces that layer's markup only.
    const tab = j.tab || 'mobilization', one = tab === CFG.id ? null : tab === 'overlay' ? NOTES : LAYER[tab] ? tab : LAYERS[0].id;
    if (one && layerLocked(one)) { toast(`The ${LAYER[one].label} layer is locked. Unlock it first to load this file onto it.`, 'err'); return; }
    if (!(await csConfirm((other ? `This plan was made on ${j.drawing.name}, and ${D.name} is open. ` : '') + (one
      ? `This plan file is from the ${LAYER[one].label} tab, from before the layers. Replace the ${LAYER[one].label} layer's markup on this drawing with the file's? The other layers, the scales and the title block stay as they are.`
      : 'Replace the markup on every layer, the scales and the title block on this drawing with the ones in the file?')))) return;
    const fresh = newPlan(D.name), pages = {};
    Object.keys(p.pages || {}).filter((k) => /^[1-9]\d*$/.test(k)).forEach((k) => { const c = p.pages[k] || {}; pages[k] = num(c.mpu) > 0 ? { mpu: num(c.mpu) } : c.cleared ? { mpu: null, cleared: 1 } : { mpu: null }; }); // cleared in the file: cleared here too
    const rot = {}; // which way the file's items face, page by page: they are brought round to this drawing's pages below
    Object.keys(p.rot || {}).filter((k) => /^[1-9]\d*$/.test(k)).forEach((k) => { const r = Math.round(num(p.rot[k])); if (r >= 1 && r <= 3) rot[k] = r; });
    const got = p.items.map(cleanItem).filter(Boolean);
    if (one) {
      got.forEach((it) => { // on that layer, each still facing the way the file's page did
        it.layer = one;
        if (it._r == null && (rot[it.pg] || 0) !== (((PLAN.rot && +PLAN.rot[it.pg]) || 0) & 3)) it._r = rot[it.pg] || 0;
      });
      PLAN.items = PLAN.items.filter((i) => layerOf(i) !== one).concat(got);
      alignHere(); syncCraneReach();
      R.undo = []; R.sel = null; save(); updateUi(); renderChecks(); dirty();
      toast(`Loaded ${got.length} item${got.length === 1 ? '' : 's'} from ${file.name} onto the ${LAYER[one].label} layer.`);
      return;
    }
    const layers = {}; // shown or hidden, and the opacity, of each layer the file names
    Object.keys(p.layers && typeof p.layers === 'object' ? p.layers : {}).filter((id) => LAYER[id]).forEach((id) => {
      const x = p.layers[id] || {}, c = {}, op = num(x.op);
      if (x.off) c.off = 1;
      if (x.lock) c.lock = 1;
      if (op > 0 && op < 1) c.op = Math.max(0.1, op);
      if (Object.keys(c).length) layers[id] = c;
    });
    Object.assign(PLAN, {
      items: got, pages, rot, views: {}, layers, ovl: cleanOvl(p.ovl), fade: Math.min(0.85, Math.max(0, num(p.fade) || 0)),
      sheetScale: FIXED_SCALES.some((s) => s[0] === +p.sheetScale) ? +p.sheetScale : 'auto',
      symSize: SYM_SIZES.some((x) => x[0] === p.symSize) ? p.symSize : DEFAULT_SYM_SIZE,
      info: Object.keys(fresh.info).reduce((o, k) => ((o[k] = typeof (p.info || {})[k] === 'string' ? cleanText(p.info[k], 200) : fresh.info[k]), o), {}),
      checks: Object.keys(p.checks && typeof p.checks === 'object' ? p.checks : {}).filter((k) => p.checks[k] && /^[a-z0-9_-]{1,40}\.[a-z0-9]{1,13}$/i.test(k)).slice(0, 2000)
        .reduce((o, k) => ((o[k] = 1), o), {}), // the checklist ticks saved with the plan replace this drawing's
    });
    delete PLAN.infoOwn;
    alignHere(); syncCraneReach();
    R.undo = []; R.sel = null; save(); shareScale(); takeSharedScale(); fillInfo(); updateSide(); updateUi(); renderChecks(); renderOverlays(); dirty(); // a page the file has no scale for takes the drawing's at once
    toast(`Loaded ${PLAN.items.length} item${PLAN.items.length === 1 ? '' : 's'} from ${file.name}.`);
  }

  // ---------- image files the browser cannot write itself ----------
  async function deflate(u8) { // zlib stream, as PDF's FlateDecode and TIFF's Deflate both take
    return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  }
  function rgbOf(cv) { // the canvas as RGB bytes, top row first (the sheet is opaque)
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = cv.width * cv.height, out = new Uint8Array(n * 3);
    for (let i = 0, j = 0; i < n; i++) { out[j++] = d[i * 4]; out[j++] = d[i * 4 + 1]; out[j++] = d[i * 4 + 2]; }
    return out;
  }
  function bmpBlob(cv) { // 24-bit, uncompressed, with the print size (200 dpi)
    const w = cv.width, h = cv.height, row = (w * 3 + 3) & ~3, size = 54 + row * h, rgb = rgbOf(cv);
    const out = new Uint8Array(size), v = new DataView(out.buffer), ppm = Math.round(SHEET.k * 100 / 0.0254);
    out[0] = 66; out[1] = 77; v.setUint32(2, size, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true);
    v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 24, true);
    v.setUint32(34, row * h, true); v.setInt32(38, ppm, true); v.setInt32(42, ppm, true);
    for (let y = 0; y < h; y++) {
      let o = 54 + (h - 1 - y) * row, i = y * w * 3;
      for (let x = 0; x < w; x++, i += 3) { out[o++] = rgb[i + 2]; out[o++] = rgb[i + 1]; out[o++] = rgb[i]; }
    }
    return new Blob([out], { type: 'image/bmp' });
  }
  async function tiffBlob(cv) { // 8-bit RGB, one strip, Deflate-compressed, with the print size (200 dpi)
    const w = cv.width, h = cv.height, data = await deflate(rgbOf(cv)), dpi = SHEET.k * 100;
    const tags = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 3, 0], [259, 3, 1, 8], [262, 3, 1, 2], [273, 4, 1, 0], [277, 3, 1, 3],
      [278, 4, 1, h], [279, 4, 1, data.length], [282, 5, 1, 0], [283, 5, 1, 0], [284, 3, 1, 1], [296, 3, 1, 2]];
    const ifd = 8, extra = ifd + 2 + tags.length * 12 + 4, bits = extra, xres = extra + 6, yres = xres + 8, strip = yres + 8;
    const out = new Uint8Array(strip + data.length), v = new DataView(out.buffer);
    out[0] = out[1] = 73; v.setUint16(2, 42, true); v.setUint32(4, ifd, true); v.setUint16(ifd, tags.length, true);
    tags.forEach(([tag, type, count, val], i) => {
      const o = ifd + 2 + i * 12;
      v.setUint16(o, tag, true); v.setUint16(o + 2, type, true); v.setUint32(o + 4, count, true);
      if (tag === 258) v.setUint32(o + 8, bits, true); else if (tag === 273) v.setUint32(o + 8, strip, true);
      else if (tag === 282) v.setUint32(o + 8, xres, true); else if (tag === 283) v.setUint32(o + 8, yres, true);
      else if (type === 3) v.setUint16(o + 8, val, true); else v.setUint32(o + 8, val, true);
    });
    [8, 8, 8].forEach((b, i) => v.setUint16(bits + i * 2, b, true));
    [xres, yres].forEach((o) => { v.setUint32(o, dpi, true); v.setUint32(o + 4, 1, true); });
    out.set(data, strip);
    return new Blob([out], { type: 'image/tiff' });
  }
  // Image formats for the export. PNG, JPEG and WebP are the browser's own; TIFF and BMP are written here.
  const IMG_FORMATS = [
    ['png', 'PNG', (cv) => toBlob(cv, 'image/png')],
    ['jpg', 'JPEG', (cv) => toBlob(cv, 'image/jpeg', 0.92)],
    ['webp', 'WebP', async (cv) => { const b = await toBlob(cv, 'image/webp', 0.92); if (b.type !== 'image/webp') throw new Error('this browser cannot write WebP'); return b; }],
    ['tif', 'TIFF', tiffBlob],
    ['bmp', 'BMP', async (cv) => bmpBlob(cv)],
  ];

  // ---------- PDF: the sheet as a picture, with each markup on top as a PDF annotation ----------
  // Bluebeam Revu (and Acrobat) list annotations as markups, so each item can be selected, moved, reshaped, recoloured
  // or deleted there. A line is a PolyLine, an area a Polygon, a symbol a Stamp, a crane's reach a Circle (a Polygon for
  // a swing pie). Each carries a picture of itself as its appearance, so the sheet looks as it does here; once a line,
  // area or circle is edited in Revu, Revu redraws it its own way, from the colour, width, dash and fill written here.
  // Revu knows six dash patterns by their exact numbers and reads any other as a solid line, so every dashed item
  // is written with its 4-4 pattern ("dashed3"); the picture each item carries still shows its own dash.
  const REVU_DASH = ' /S /D /D [4 4]';
  const PT = 0.72, PAGE_H = SHEET.h * PT; // PDF points per sheet unit; the page is 1224 x 792 pt
  const hexRgb = (c) => { let x = String(c || '#000').replace('#', ''); if (x.length === 3) x = x.replace(/./g, '$&$&'); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); };
  const pn = (n) => String(Math.round(n * 100) / 100);
  const pdfCol = (c) => '[' + hexRgb(c).map((v) => String(Math.round(v * 1e4) / 1e4)).join(' ') + ']'; // fine enough to read back as the same hex colour
  function pdfStr(s) {
    s = String(s);
    if (/^[\x20-\x7e]*$/.test(s)) return '(' + s.replace(/[\\()]/g, '\\$&') + ')';
    let x = 'FEFF';
    for (let i = 0; i < s.length; i++) x += s.charCodeAt(i).toString(16).padStart(4, '0');
    return '<' + x.toUpperCase() + '>';
  }
  function pdfDate() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `(D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())})`; }

  // One markup item as one or two annotations: { sub, rect (sheet units in the map window), extra (PDF keys), svg, subj }.
  function annotParts(it, vv) {
    const st = STYLE[it.sym], P = it.pts.map((p) => toScreen(p[0], p[1]));
    if (P.some((p) => isNaN(p[0]))) return [];
    const box = (pts, pad) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; };
    const verts = (pts) => '/Vertices [' + pts.map((p) => { const q = sheetPt(p); return pn(q[0]) + ' ' + pn(q[1]); }).join(' ') + ']';
    const label = itemName(it.sym);
    if (it.sym === '_text') { // Revu edits the words directly
      // the box, as drawn at its height (fs: font size in sheet units; it was 12 before heights, with these same margins)
      const fs = labelFont(it), c = P[0], text = String(it.text || ''), half = Math.max(fs, textW(text, fs, LABEL_FAMILY) / 2 + fs * 0.3) + (fs * 5) / 12; // measured: wide capitals fit
      const box = [c[0] - half, c[1] - (fs * 11) / 12, c[0] + half, c[1] + (fs * 11) / 12], col = labelColor(it), rot = labelRot(it), fpt = pn(fs * PT);
      // the style twice, as Acrobat and Revu write it: /DS (default style) and /RC (rich text), so a redraw in Revu after an
      // edit keeps the colour and the bold Flux Architect (where that font is installed; elsewhere Revu substitutes)
      const css = `font-family:'Flux Architect',Arial,sans-serif;font-size:${fpt}pt;font-weight:bold;text-align:center;color:${col}`;
      const rc = `<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:APIVersion="Acrobat:11.0.0" xfa:spec="2.0.2" style="${css}"><p>${esc(text)}</p></body>`;
      const extra = `/DA (/Helv ${fpt} Tf ${hexRgb(col).map((v) => pn(v)).join(' ')} rg) /DS ${pdfStr(css)} /RC ${pdfStr(rc)} /Q 1 /BS << /W 0 /S /S /Type /Border >>`;
      if (!rot) return [{ sub: 'FreeText', subj: label, contents: text, layer: 'Linear Markups', rect: box, svg: drawText(it, c, false), extra }];
      // Turned: as Revu writes a turned text box (read from the Elevate template): /Rotation is the angle CLOCKWISE in whole
      // degrees, the picture is the upright box (`box`, its /BBox) turned about its centre by its /Matrix, and /Rect bounds
      // the turned box. The picture is drawn upright (rot 0) and turned by the matrix.
      const a = (-rot * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
      const pts = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(([x, y]) => [c[0] + (x - c[0]) * cs - (y - c[1]) * sn, c[1] + (x - c[0]) * sn + (y - c[1]) * cs]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return [{ sub: 'FreeText', subj: label, contents: text, layer: 'Linear Markups', rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        upright: box, rot, svg: drawText(Object.assign({}, it, { rot: 0 }), c, false), extra: extra + ` /Rotation ${(360 - rot) % 360}` }];
    }
    if (st && st.shape) { // a notes shape: a Square, a Circle or a Polygon with Revu's cloud border, in its colour
      if (P.length < 3) return [];
      const col = labelColor(it), pad = st.shape === 'cloud' ? 10 : 4, rd = pn((pad - SHAPE_W / 2) * PT);
      const brd = `/C ${pdfCol(col)} /BS << /W ${pn(SHAPE_W * PT)} /S /S /Type /Border >>`, svg = drawShape(it.id, st, P, it.color, false, false, true);
      if (st.shape === 'cloud') return [{ sub: 'Polygon', subj: label, layer: 'Linear Markups', rect: box(P, pad), svg, extra: `${verts(P)} ${brd} /BE << /S /C /I 1 >> /IT /PolygonCloud` }];
      return [{ sub: st.shape === 'ellipse' ? 'Circle' : 'Square', subj: label, layer: 'Linear Markups', rect: box(P, pad), svg, extra: `${brd} /RD [${rd} ${rd} ${rd} ${rd}]` }];
    }
    if (st && st.kind === 'line') {
      if (P.length < 2) return [];
      const col = st.color || '#f7941d'; // the barricade has no single colour: its orange
      // Revu's own line styles, so the decoration survives an edit there: numbers are in line widths; a line is
      // [offset, dash (+) or space (-) or a little drawing [left right scale fill, then 0 = start / 1 = line to, x, y ...]].
      const style = st.tracks ? ' /LineStyle [true [-3] [0 -4 [0 0 1 false 0 0 -4 1 0 4] -4] [3]] /LineStyleName (Tracks)'
        : st.ticks ? ` /LineStyle [true [0 ${pn(20 / st.width)} [0 0 1 false 0 0 ${pn(-7 / st.width)} 1 0 ${pn(7 / st.width)}] ${pn(20 / st.width)}]] /LineStyleName (Fence ticks)` : '';
      const off = st.dim ? (it.off || 0) * vv.z : 0, V2 = off ? dimEnds(P, off) : P; // a dimension is written as its own line, clear of the points
      return [{ sub: 'PolyLine', subj: label, contents: st.dim ? dimText(Math.hypot(P[P.length - 1][0] - P[0][0], P[P.length - 1][1] - P[0][1]) / vv.z) : undefined, layer: it.sym === 'bldg-outline' ? 'Building Outline' : 'Linear Markups', rect: box(off ? P.concat(V2) : P, st.width / 2 + 22), svg: drawLine(it.id, st, P, false, false, true, off),
        extra: `${verts(V2)} /C ${pdfCol(col)} /BS << /W ${pn(st.width * PT)}${st.dash ? REVU_DASH : ' /S /S'} /Type /Border >>${st.arrow ? ` /LE [/None /ClosedArrow] /IC ${pdfCol(col)}` : ''}${style}` }];
    }
    if (st) {
      if (P.length < 3) return [];
      const sw = st.strokeWidth || 1.4;
      return [{ sub: 'Polygon', subj: label, layer: it.sym === 'bldg-outline' ? 'Building Outline' : 'Linear Markups', rect: box(P, sw / 2 + 2), svg: drawArea(it.id, st, P, false, false, true),
        extra: `${verts(P)} /C ${pdfCol(st.stroke || st.fill)} /BS << /W ${pn(sw * PT)}${st.dash ? REVU_DASH : ' /S /S'} /Type /Border >>` +
          // Revu keeps the fill's opacity apart from the line's (/FillOpacity), so the outline stays solid. A hatched area has
          // no fill here; it gets a light one in its hatch colour, so it is still told apart once Revu redraws it plain.
          (st.fill ? ` /IC ${pdfCol(st.fill)} /FillOpacity ${pn(st.fillOpacity || FILL_OPACITY)}` : st.hatch ? ` /IC ${pdfCol(st.hatchColor)} /FillOpacity 0.25` : '') }];
    }
    const sym = SYM[it.sym];
    if (!sym) return [];
    const c = P[0], h = symHeight(it.sym), w = (h * sym.w) / sym.h, out = [];
    const m0 = mpu(), cjr = isCrane(it.sym) && it.spec && it.spec.cj > 0 && m0 ? (it.spec.cj / m0) * vv.z : 0; // counter-jib or tail radius
    const tailOwn = cjr > 0 && groundTail(it.spec), hasReach = isCrane(it.sym) && reachOf(it) > 0;
    if (hasReach) {
      const r = reachOf(it) * vv.z, red = it.sym in CRANE_RING, ring = red ? `/C ${pdfCol(COL.red)} /BS << /W ${pn(2 * PT)} /S /S /Type /Border >>` : `/C [0 0 0] /BS << /W ${pn(1.3 * PT)}${REVU_DASH} /Type /Border >> /IC ${pdfCol(COL.yellow)} /FillOpacity 0.14`;
      const svg = drawPoint(it, c, false, true, 'ringBare');
      // The picture also holds an overhead counter-jib circle, which can stick out of the reach; it is taken only as far as
      // it is on the sheet, so the box never grows over paper the picture does not cover. A ground-level tail swing and the
      // figures are not in it: each is written below as its own markup, so editing the reach in Revu leaves them be.
      const cjIn = cjr > 0 && !tailOwn ? cjr : 0; // cjIn: a counter-jib drawn in the picture
      const extras = cjIn > r - 7 ? [[c[0] - cjIn - 7, c[1] - cjIn - 7, c[0] + cjIn + 7, c[1] + cjIn + 7]] : []; // 7: room for the line's width
      const grow = (rc) => extras.reduce((q, b) => {
        const k = [Math.max(b[0] - 1, 0), Math.max(b[1] - 1, 0), Math.min(b[2] + 1, vv.w), Math.min(b[3] + 1, vv.h)];
        return k[2] > k[0] && k[3] > k[1] ? [Math.min(q[0], k[0]), Math.min(q[1], k[1]), Math.max(q[2], k[2]), Math.max(q[3], k[3])] : q;
      }, rc);
      if (it.sweep && it.sweep < 360) {
        const arc = [c]; for (let a = 0; a <= it.sweep; a += Math.min(5, it.sweep)) arc.push(edgePt(c, r, it.a0 + a));
        if ((it.sweep % 5) !== 0) arc.push(edgePt(c, r, it.a0 + it.sweep));
        out.push({ sub: 'Polygon', subj: label + ' swing', layer: 'Crane Radius', rect: grow(box(cjIn ? arc.concat([[c[0] - cjIn - 6, c[1] - cjIn - 6], [c[0] + cjIn + 6, c[1] + cjIn + 6]]) : arc, 3)), svg, extra: `${verts(arc)} ${ring}` }); // 6 + 3: the counter-jib circle and its line width, all round
      } else {
        // A Circle's /Rect is its outline: when the labels grow the box, /RD keeps the true circle. Revu (and MuPDF) read /RD
        // in rectangle order, left, BOTTOM, right, TOP, whatever the spec's wording; checked in Revu 21 with a box grown more
        // at the bottom (2026-11-17). Here y runs down the sheet, so the bottom is the larger y.
        const own = [c[0] - r - 1, c[1] - r - 1, c[0] + r + 1, c[1] + r + 1], g = grow(own), d = [own[0] - g[0], g[3] - own[3], g[2] - own[2], own[1] - g[1]];
        out.push({ sub: 'Circle', subj: label + ' reach', layer: 'Crane Radius', rect: g, svg, extra: ring + (d.some((x) => x > 0.01) ? ` /RD [${d.map((x) => pn(x * PT)).join(' ')}]` : '') });
      }
    }
    // A ground-level tail swing as its own Circle: red, dashed in a pattern Revu knows ([4 4], its "dashed3"), so when it
    // (or the reach) is edited in Revu, Revu redraws it as the same red dashed circle. /Rect is the circle plus 1, as for
    // the reach; the picture gets 1.5 more all round for the line's width, kept out of the circle by /RD. Written whether
    // or not the crane has a reach (a spec with a tail but no jib yet), as the screen draws it. An overhead counter-jib
    // normally rides in the reach picture; with no reach it gets its own black dashed Circle ([3 3], Revu's "dashed2").
    const ownCircle = (subj, svgLine, extra) => {
      const t = [c[0] - cjr - 1, c[1] - cjr - 1, c[0] + cjr + 1, c[1] + cjr + 1], pad = 1.5;
      out.push({ sub: 'Circle', subj: label + ' ' + subj, layer: 'Crane Radius', rect: [t[0] - pad, t[1] - pad, t[2] + pad, t[3] + pad],
        svg: `<circle cx="${fmt(c[0])}" cy="${fmt(c[1])}" r="${fmt(cjr)}" ${svgLine}/>`, extra: `${extra} /RD [${[pad, pad, pad, pad].map((x) => pn(x * PT)).join(' ')}]` });
    };
    if (tailOwn) ownCircle('tail swing', TAIL_LINE, `/C ${pdfCol(COL.red)} /BS << /W ${pn(2 * PT)}${REVU_DASH} /Type /Border >>`);
    else if (cjr > 0 && !hasReach) ownCircle('counter-jib', 'fill="none" stroke="#000" stroke-width="1.1" stroke-dasharray="3 3"', `/C [0 0 0] /BS << /W ${pn(1.1 * PT)} /S /D /D [3 3] /Type /Border >>`);
    out.push({ sub: 'Stamp', subj: label, layer: 'Equipment/Symbols', rect: [c[0] - w / 2, c[1] - h / 2, c[0] + w / 2, c[1] + h / 2], svg: drawPoint(it, c, false, true, 'sym'), extra: '/Name /SiteLogistics' });
    // A crane's figures as a Revu text box (FreeText), on top: Revu keeps the words through any edit and lets them be edited.
    // The picture is the bold text with its white halo, as on screen; Revu's own redraw is centred bold Helvetica (/DS) at
    // the same size. The box is a little wider than the words, so Revu's font metrics do not wrap a line.
    if (isCrane(it.sym) && it.spec) {
      const size = 9 * (R.frz ? vv.z / R.frz : 1), marks = specTextMarks(it, c, h, size);
      if (marks.length) {
        const b = marks.reduce((q, k) => [Math.min(q[0], k.box[0]), Math.min(q[1], k.box[1]), Math.max(q[2], k.box[2]), Math.max(q[3], k.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);
        const px = (b[2] - b[0]) * 0.12 + 2, fpt = pn(size * PT);
        // the style twice, as Acrobat writes it: /DS (default style) and /RC (rich text: the lines as bold paragraphs), so
        // Revu's redraw after an edit stays bold, centred and the same size
        const css = `font-family:Helvetica,Arial,sans-serif;font-size:${fpt}pt;font-weight:bold;text-align:center;color:#111111`;
        const rc = `<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:APIVersion="Acrobat:11.0.0" xfa:spec="2.0.2" style="${css}">` +
          marks.map((k) => `<p>${esc(k.t)}</p>`).join('') + '</body>';
        out.push({ sub: 'FreeText', subj: label + ' figures', contents: marks.map((k) => k.t).join('\r'), layer: 'Crane Radius',
          rect: [b[0] - px, b[1] - 2, b[2] + px, b[3] + 2], svg: specTextSvg(marks, size),
          extra: `/DA (/Helv ${fpt} Tf 0.067 0.067 0.067 rg) /DS ${pdfStr(css)} /RC ${pdfStr(rc)} /Q 1 /BS << /W 0 /S /S /Type /Border >>` });
      }
    }
    return out;
  }
  const MAP0 = [LAY.map.x + 1, LAY.map.y + 1]; // the map window's corner on the sheet
  const sheetPt = (p) => [(MAP0[0] + p[0]) * PT, PAGE_H - (MAP0[1] + p[1]) * PT];

  // The annotations for the page in view, each with its picture (RGB and transparency, both deflated).
  async function sheetAnnots(fr) {
    R.frz = fr.z;
    const vv = { z: fr.z, cx: fr.cx, cy: fr.cy, w: MAP_IN.w, h: MAP_IN.h };
    // every shown layer's items, in layer order (the last on top, as on screen): each named for its layer ("Site Safety -
    // Fire Hydrant"), on a PDF layer of its own, and at the layer's opacity
    const rank = (it) => LAYERS.findIndex((l) => l.id === layerOf(it));
    const parts = withView(vv, () => items().map((it, i) => [it, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).flatMap(([it]) => {
      const l = LAYER[layerOf(it)], op = layerOp(l.id);
      return annotParts(it, vv).map((a) => Object.assign(a, { id: it.id, subj: l.label + ' - ' + a.subj, layer: l.label }, op < 1 ? { op } : {}));
    }));
    const out = [];
    for (const a of parts) {
      if (a.upright) { // a turned text label: its upright picture, turned by the annotation's matrix (see annotParts)
        const u = a.upright;
        if (a.rect[2] <= 0 || a.rect[3] <= 0 || a.rect[0] >= vv.w || a.rect[1] >= vv.h) continue; // wholly off the sheet
        const inside = a.rect[0] >= 0 && a.rect[1] >= 0 && a.rect[2] <= vv.w && a.rect[3] <= vv.h;
        const k = SHEET.k, pw = Math.max(1, Math.round((u[2] - u[0]) * k)), ph = Math.max(1, Math.round((u[3] - u[1]) * k));
        const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
        const g = cv.getContext('2d');
        g.drawImage(await svgImage(a.svg, `${u[0]} ${u[1]} ${u[2] - u[0]} ${u[3] - u[1]}`, pw, ph), 0, 0, pw, ph);
        const d = g.getImageData(0, 0, pw, ph).data, rgb = new Uint8Array(pw * ph * 3), al = new Uint8Array(pw * ph);
        for (let i = 0, j = 0; i < pw * ph; i++) { rgb[j++] = d[i * 4]; rgb[j++] = d[i * 4 + 1]; rgb[j++] = d[i * 4 + 2]; al[i] = Math.round(d[i * 4 + 3] * (a.op || 1)); }
        cv.width = cv.height = 0;
        const b0 = sheetPt([u[0], u[3]]), b1 = sheetPt([u[2], u[1]]), r0 = sheetPt([a.rect[0], a.rect[3]]), r1 = sheetPt([a.rect[2], a.rect[1]]);
        const t = (a.rot * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), pcx = (b0[0] + b1[0]) / 2, pcy = (b0[1] + b1[1]) / 2; // PDF y is up: anticlockwise is positive
        const extra = a.op ? a.extra + ' /CA ' + pn(a.op) : a.extra;
        // reaching past the map window: cut at it, as every other markup is. The window's corners are taken into the
        // picture's own (upright) space, the inverse of its matrix, and used there as a clipping path.
        const clip = inside ? null : [[0, 0], [vv.w, 0], [vv.w, vv.h], [0, vv.h]].map((p) => sheetPt(p))
          .map(([x, y]) => [c * (x - pcx) + s * (y - pcy) + pcx, -s * (x - pcx) + c * (y - pcy) + pcy]);
        out.push({ sub: a.sub, subj: a.subj, contents: a.contents, id: a.id, layer: a.layer, extra, rect: [r0[0], r0[1], r1[0], r1[1]],
          bbox: [b0[0], b0[1], b1[0], b1[1]], matrix: [c, s, -s, c, pcx - (c * pcx - s * pcy), pcy - (s * pcx + c * pcy)], clip,
          img: [b0[0], b0[1], b1[0] - b0[0], b1[1] - b0[1]], pw, ph, rgb: await deflate(rgb), alpha: await deflate(al) });
        continue;
      }
      // the picture covers the part of the item inside the map window, as on the image exports
      const x0 = Math.max(0, Math.floor(a.rect[0])), y0 = Math.max(0, Math.floor(a.rect[1]));
      const x1 = Math.min(vv.w, Math.ceil(a.rect[2])), y1 = Math.min(vv.h, Math.ceil(a.rect[3]));
      if (x1 - x0 < 1 || y1 - y0 < 1) continue; // wholly outside the window: not on the sheet
      let k = SHEET.k; while (k > 0.5 && (x1 - x0) * (y1 - y0) * k * k > 9e6) k /= 2;
      if (a.sub === 'Stamp') k = Math.max(k, Math.min(16, 256 / Math.max(x1 - x0, y1 - y0))); // a symbol stays sharp when enlarged in Revu
      const pw = Math.max(1, Math.round((x1 - x0) * k)), ph = Math.max(1, Math.round((y1 - y0) * k));
      const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
      const g = cv.getContext('2d');
      g.drawImage(await svgImage(a.svg, `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, pw, ph), 0, 0, pw, ph);
      const d = g.getImageData(0, 0, pw, ph).data, rgb = new Uint8Array(pw * ph * 3), al = new Uint8Array(pw * ph);
      for (let i = 0, j = 0; i < pw * ph; i++) { rgb[j++] = d[i * 4]; rgb[j++] = d[i * 4 + 1]; rgb[j++] = d[i * 4 + 2]; al[i] = Math.round(d[i * 4 + 3] * (a.op || 1)); }
      cv.width = cv.height = 0;
      // see-through (a layer's opacity): the picture carries it, and /CA and /FillOpacity tell Revu, which uses them when it redraws
      const extra = a.op ? a.extra.replace(/\/FillOpacity ([\d.]+)/, (m, v) => '/FillOpacity ' + pn(v * a.op)) + ' /CA ' + pn(a.op) : a.extra;
      const a0 = sheetPt([a.rect[0], a.rect[3]]), a1 = sheetPt([a.rect[2], a.rect[1]]), i0 = sheetPt([x0, y1]), i1 = sheetPt([x1, y0]);
      out.push({ sub: a.sub, subj: a.subj, contents: a.contents, id: a.id, layer: a.layer, extra, rect: [a0[0], a0[1], a1[0], a1[1]], img: [i0[0], i0[1], i1[0] - i0[0], i1[1] - i0[1]],
        pw, ph, rgb: await deflate(rgb), alpha: await deflate(al) });
    }
    return out;
  }
  // The PDF: one 11 x 17 in page per sheet. pages = [{ jpeg, w, h, annots, N }]; N: that sheet's scale 1:N, when its drawing has one.
  function pdfSheet(pages, author) {
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0, next = 3;
    const add = (x) => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
    const obj = (n, body) => { offs[n] = len; add(`${n} 0 obj\n`); body(); add('\nendobj\n'); };
    const stream = (n, dict, data) => obj(n, () => { add(`<< ${dict} /Length ${data.length} >>\nstream\n`); add(data); add('\nendstream'); });
    const pw = SHEET.w * PT, ph = PAGE_H;
    const content = `q ${pn(pw)} 0 0 ${pn(ph)} 0 0 cm /Im0 Do Q`;
    // The sheet scale, written as a PDF measurement viewport, so a viewer's measuring tools read real metres without
    // being calibrated by hand. It covers the whole page and is worded "1 mm = ... m": that is the form Revu takes
    // up as its page scale (a viewport over the map window alone it ignores). 1 pt on the sheet is N x 0.0254 / 72 m on site.
    const nf = (u, c) => `<< /Type /NumberFormat /U (${u}) /C ${c} /D 100 >>`;
    const vpOf = (N) => (N ? ` /VP [<< /Type /Viewport /Name (Plan 1:${N}) /BBox [0 0 ${pn(SHEET.w * PT)} ${pn(PAGE_H)}] ` +
      `/Measure << /Type /Measure /Subtype /RL /R (1 mm = ${+(N / 1000).toFixed(4)} m) /X [${nf('m', (N * 0.0254 / 72).toPrecision(8))}] /D [${nf('m', 1)}] /A [${nf('sq m', 1)}] >> >>]` : '');
    const date = pdfDate();
    const nums = pages.map((p) => ({ page: next++, img: next++, content: next++, ids: p.annots.map(() => { const n = next; next += 4; return n; }) }));
    // PDF layers (optional content groups): one per layer of the plan (Site Mobilization, Site Safety, ...), named as
    // in the legend. Revu and Acrobat can switch each on and off.
    const layerIds = {};
    pages.forEach((p) => p.annots.forEach((a) => { if (a.layer && !layerIds[a.layer]) layerIds[a.layer] = next++; }));
    const lrefs = Object.values(layerIds).map((n) => n + ' 0 R').join(' ');
    const ocp = lrefs ? ` /OCProperties << /OCGs [${lrefs}] /D << /Order [${lrefs}] /ON [${lrefs}] >> >>` : '';
    add('%PDF-1.6\n%âãÏÓ\n');
    obj(1, () => add(`<< /Type /Catalog /Pages 2 0 R${ocp} >>`));
    obj(2, () => add(`<< /Type /Pages /Kids [${nums.map((o) => o.page + ' 0 R').join(' ')}] /Count ${pages.length} >>`));
    pages.forEach((p, k) => {
      const o = nums[k];
      obj(o.page, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pn(pw)} ${pn(ph)}] /Resources << /XObject << /Im0 ${o.img} 0 R >> >> /Contents ${o.content} 0 R /Annots [${o.ids.map((n) => n + ' 0 R').join(' ')}]${vpOf(p.N)} >>`));
      stream(o.img, `/Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, p.jpeg);
      stream(o.content, '', enc.encode(content));
      // A markup's name is its Subject. Only a text label, a dimension and a crane's figures carry /Contents (a text box's
      // words): Edge's PDF viewer puts a comment icon on every annotation that has one, which cluttered the sheet.
      p.annots.forEach((a, i) => {
        const n = o.ids[i], rect = '[' + a.rect.map(pn).join(' ') + ']';
        obj(n, () => add(`<< /Type /Annot /Subtype /${a.sub} /Rect ${rect} /P ${o.page} 0 R /F 4 /NM ${pdfStr(a.id + '-' + (pages.length > 1 ? (k + 1) + '-' : '') + i)} /T ${pdfStr(author)} /Subj ${pdfStr(a.subj)}${a.contents ? ` /Contents ${pdfStr(a.contents)}` : ''} /M ${date} /CreationDate ${date} ${a.extra}${a.layer ? ` /OC ${layerIds[a.layer]} 0 R` : ''} /AP << /N ${n + 1} 0 R >> >>`));
        // a turned text label: its picture's box is the upright box, turned by /Matrix (as Revu writes one)
        const form = a.bbox ? `/BBox [${a.bbox.map(pn).join(' ')}] /Matrix [${a.matrix.map((v) => String(Math.round(v * 1e6) / 1e6)).join(' ')}]` : `/BBox ${rect}`;
        const cut = a.clip ? a.clip.map((p, i) => `${pn(p[0])} ${pn(p[1])} ${i ? 'l' : 'm'}`).join(' ') + ' h W n ' : ''; // cut at the map window
        stream(n + 1, `/Type /XObject /Subtype /Form ${form} /Resources << /XObject << /I ${n + 2} 0 R >> >>`, enc.encode(`q ${cut}${pn(a.img[2])} 0 0 ${pn(a.img[3])} ${pn(a.img[0])} ${pn(a.img[1])} cm /I Do Q`));
        stream(n + 2, `/Type /XObject /Subtype /Image /Width ${a.pw} /Height ${a.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${n + 3} 0 R`, a.rgb);
        stream(n + 3, `/Type /XObject /Subtype /Image /Width ${a.pw} /Height ${a.ph} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, a.alpha);
      });
    });
    Object.keys(layerIds).forEach((name) => obj(layerIds[name], () => add(`<< /Type /OCG /Name ${pdfStr(name)} >>`)));
    const xref = len;
    add(`xref\n0 ${next}\n0000000000 65535 f \n` + Array.from({ length: next - 1 }, (_, i) => String(offs[i + 1]).padStart(10, '0') + ' 00000 n \n').join(''));
    add(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  // Every page of the drawing (or every image of the set), each as its own sheet, in the view that page was left in.
  // PDF: one file with a page per sheet, markups as annotations. An image format: one image per sheet, named after
  // its page, written into a folder where the browser can do that (`dir`), and otherwise packed into one .zip.
  // A pause that lets the screen catch up, without a timer: a browser slows timers to one a second in a window that
  // is not in front, which made a 20-page export take 20 seconds longer there.
  const breathe = () => new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = () => { ch.port1.close(); res(); }; ch.port2.postMessage(0); });
  async function exportAll(kind, dir) {
    const live = kind === 'pdf' && !!window.CompressionStream;
    const f = IMG_FORMATS.find((x) => x[0] === kind) || IMG_FORMATS[0], base = fileBase(true), pad = String(D.pages).length;
    keepView();
    const cur = D.page, keep = [V.cx, V.cy, V.z, R.autoN, R.autoFor, R.home], pages = [], files = [], used = new Set();
    let failed = null;
    R.batch = true;
    try {
      for (let n = 1; n <= D.pages; n++) {
        busy(`Exporting ${kind.toUpperCase()}: ${D.set ? 'image' : 'page'} ${n} of ${D.pages}…`);
        await breathe(); // let the count show
        await loadPage(n, ++D.pageGen, false);
        D.page = n; alignHere();
        const v = PLAN.views && PLAN.views[String(n)];
        R.autoN = v && v[5] > 0 ? v[5] : null; // that page's Auto scale as it was left (none: from its view)
        R.home = v && v[6] != null && v[7] != null ? { cx: v[6], cy: v[7] } : null; // and its print area, left zoomed in
        if (v && v[2] > 0 && (v.length < 4 || v[3] === (D.rot || 0))) { V.z = clampZ((v[4] === 'pf' ? printFrame().w : V.w) / v[2]); V.cx = v[0]; V.cy = v[1]; } else { V.z = fitZ(); V.cx = D.w / 2; V.cy = D.h / 2; snapToPrint(); }
        const fr = sheetFrame(); // once per page: the picture, the annotations and the written scale all use it
        const cv = await composeSheet(live, fr);
        if (kind === 'pdf') {
          const jpg = await toBlob(cv, 'image/jpeg', 0.92);
          pages.push({ jpeg: new Uint8Array(await jpg.arrayBuffer()), w: cv.width, h: cv.height, annots: live ? await sheetAnnots(fr) : [], N: fr.N });
        } else {
          const blob = await f[2](cv);
          let nm = D.set ? baseName(D.set.entries[n - 1].name).replace(/\.[^.]+$/, '') : 'page-' + String(n).padStart(pad, '0');
          if (used.has(nm.toLowerCase())) nm += '_' + String(n).padStart(pad, '0'); // the same name in two sub-folders
          used.add(nm.toLowerCase());
          nm += '.' + f[0];
          if (dir) { const w = await (await dir.getFileHandle(nm, { create: true })).createWritable(); await w.write(blob); await w.close(); }
          else files.push({ name: base + '/' + nm, data: blob, size: blob.size, crc: crc32(new Uint8Array(await blob.arrayBuffer())) });
        }
        cv.width = cv.height = 0;
        if (D.kind === 'pdf' && n !== cur) { try { D.pageObj.cleanup(); } catch (e) { /* still drawing: it is freed with the document */ } }
      }
    } catch (e) { failed = e; }
    // back to the page that was showing, as it was
    D.page = cur; V.cx = keep[0]; V.cy = keep[1]; V.z = keep[2]; R.autoN = keep[3]; R.autoFor = keep[4]; R.home = keep[5];
    R.batch = false;
    await showPage(cur, false, true);
    if (failed) throw failed;
    if (kind === 'pdf') return { blob: pdfSheet(pages, (PLAN.info.by || '').trim() || 'Site Logistics'), file: base + '.pdf', count: pages.length };
    if (dir) return { folder: dir.name, count: D.pages };
    return { blob: new Blob(zipParts(files), { type: 'application/zip' }), file: base + '.zip', count: files.length };
  }
  // Where the images of an all-pages export go: a new folder inside one the user picks, where the browser offers that
  // (desktop Chrome and Edge). null: no such thing here, or it was refused, so the images are packed into a .zip.
  async function pickFolder(name) {
    if (!window.showDirectoryPicker || COARSE) return null;
    try {
      const top = await window.showDirectoryPicker({ mode: 'readwrite', id: 'cs-export' });
      return await top.getDirectoryHandle(name, { create: true });
    } catch (e) { if (e && e.name === 'AbortError') throw e; return null; }
  }

  // The preview before any export (csPreview): this page's sheet, drawn as it will be saved, with the shown layers, the
  // hidden ones, the scale and the file. The drawing is held (exporting) while it is open, so the sheet saved is the one
  // seen. True: save.
  async function previewExport(kind, many) {
    let cv = null, url = null;
    setExporting(true); busy('Preparing the preview…');
    try {
      const fr = sheetFrame();
      cv = await composeSheet(false, fr);
      url = URL.createObjectURL(await toBlob(cv, 'image/jpeg', 0.9));
      cv.width = cv.height = 0;
      busy(null);
      const lyr = (l) => l.label + (layerOp(l.id) < 1 ? ` (${Math.round(layerOp(l.id) * 100)}%)` : '');
      // the layers with markup on the sheet (on any page, for every page's sheet), and those hidden that have some
      const has = (id) => PLAN.items.some((i) => (many || i.pg === D.page) && layerOf(i) === id);
      const shown = LAYERS.filter((l) => layerOn(l.id) && has(l.id)), hidden = LAYERS.filter((l) => !layerOn(l.id) && has(l.id));
      const what = kind === 'pdf' ? 'PDF' : (IMG_FORMATS.find((x) => x[0] === kind) || IMG_FORMATS[0])[1];
      const file = many ? (kind === 'pdf' ? fileBase(true) + '.pdf' : fileBase(true) + ' (a folder or .zip of images)') : fileBase() + '.' + (kind === 'pdf' ? 'pdf' : (IMG_FORMATS.find((x) => x[0] === kind) || IMG_FORMATS[0])[0]);
      return await csPreview({
        url, title: many ? `Save ${D.pages} sheets as ${what}?` : `Save this sheet as ${what}?`,
        sub: `${fr.N ? scaleName(fr.N) : 'Not to scale'}, 11 x 17 in`,
        lines: [
          many ? `One sheet for each ${D.set ? 'image' : 'page'}, each as it was left; shown here: ${D.set ? pageName(D.page) : 'page ' + D.page} of ${D.pages}.` : '',
          `On the sheet: ${shown.length ? shown.map(lyr).join(', ') : 'no markup (the drawing and title block only)'}.`,
          hidden.length ? `Hidden, so not on the sheet: ${hidden.map((l) => l.label).join(', ')}.` : '',
          ovlShown().length ? `Pages laid over (${ovlShown().map((o) => (D.set ? pageName(o.pg) : o.pg)).join(', ')}) show on screen only: ${many ? 'each sheet is its own page' : 'the sheet is this page'} alone.` : '',
          `File: ${file}`,
        ].filter(Boolean),
        ok: many ? `Save ${D.pages} sheets` : `Save ${kind === 'pdf' ? 'PDF' : kind.toUpperCase()}`,
      });
    } finally {
      if (cv) cv.width = cv.height = 0;
      if (url) URL.revokeObjectURL(url);
      setExporting(false); busy(null);
    }
  }
  async function exportSheet(kind, all) {
    if (!D.ready) { toast('Open a drawing first.', 'err'); return; }
    if (R.exporting) return;
    let go = false;
    try { go = await previewExport(kind, all && D.pages > 1); }
    catch (err) { toast('Export failed: ' + ((err && err.message) || err), 'err'); return; }
    if (!go) { toast('Nothing saved.'); return; }
    if (all && D.pages > 1) {
      setExporting(true);
      try {
        const dir = kind === 'pdf' ? null : await pickFolder(fileBase(true));
        const r = await exportAll(kind, dir);
        if (r.folder) toast(`Saved ${r.count} sheets in the folder ${r.folder}.`);
        else if (COARSE) offerFile(r.blob, r.file);
        else { download(r.blob, r.file); toast(`Saved ${r.file} (${r.count} sheets).`); }
      } catch (err) { if (err && err.name === 'AbortError') toast('Export cancelled.'); else toast('Export failed: ' + ((err && err.message) || err), 'err'); }
      finally { setExporting(false); busy(null); }
      return;
    }
    setExporting(true); busy('Exporting ' + kind.toUpperCase() + '…');
    try {
      const live = kind === 'pdf' && !!window.CompressionStream; // without it the markup is flattened into the picture
      const fr = sheetFrame(); // once: the picture, the annotations and the written scale all use it
      const cv = await composeSheet(live, fr);
      const name = fileBase();
      let blob, file;
      if (kind === 'pdf') {
        const jpg = await toBlob(cv, 'image/jpeg', 0.92);
        const annots = live ? await sheetAnnots(fr) : [];
        blob = pdfSheet([{ jpeg: new Uint8Array(await jpg.arrayBuffer()), w: cv.width, h: cv.height, annots, N: fr.N }], (PLAN.info.by || '').trim() || 'Site Logistics');
        file = name + '.pdf';
      } else {
        const f = IMG_FORMATS.find((x) => x[0] === kind) || IMG_FORMATS[0];
        blob = await f[2](cv); file = name + '.' + f[0];
      }
      cv.width = cv.height = 0;
      if (COARSE) offerFile(blob, file);
      else { download(blob, file); toast('Saved ' + file); }
    } catch (err) { toast('Export failed: ' + ((err && err.message) || err), 'err'); }
    finally { setExporting(false); busy(null); }
  }

  // Print (user, 2026-11-17: "print is just supposed to export a pdf/image. Not actually print"): saves the page
  // showing, and only that page whatever All pages says, as the PDF sheet (what Export PDF makes) or as the image in the
  // format picked beside Export image.
  function printSheet(kind) { return exportSheet(kind === 'image' ? (R.btn.fmt.value || 'png') : 'pdf', false); }

  // ---------- UI ----------
  const TAP = COARSE ? 'Tap' : 'Click', tap = COARSE ? 'tap' : 'click';
  function hintText() {
    if (!D.ready) return '';
    const stop = COARSE ? 'Tap Pan to stop.' : 'Esc to stop.';
    if (R.mode === 'cal') return `Calibrate: ${tap} two points a known distance apart (a dimension or grid line), then type the real distance. ${snapNote()}${COARSE ? '' : ' Hold Shift to lock the second point level or plumb.'} ${stop}`;
    const nav = zoomLocked() ? `Drag to pan; ${COARSE ? 'pinch' : 'scroll'} to zoom in, and out as far as the whole sheet (the dashed outline).`
      : `Drag to pan; ${COARSE ? 'pinch' : 'scroll'} to zoom.`;
    if (R.mode === 'pan') return `${nav} Pick a legend item to start placing.`;
    if (R.mode === 'select') return `${TAP} an item to select it. Drag it to move; drag a white corner to reshape; drag a blue dot to add a corner; ${COARSE ? 'double-tap' : 'Shift+click'} a corner to remove it. ${COARSE ? 'Delete removes the item, Duplicate copies it' : 'Delete removes the item, Ctrl+D copies it'}. Drag a crane's yellow handle to set the reach (double-${tap} the crane to type a value).`;
    const st = STYLE[R.tool], name = itemName(R.tool);
    let how;
    if (R.tool === '_text') how = `${TAP} where the label goes, then type it. Its colour, angle and height are set in the toolbar (select a label to change its own). ${snapNote(true)}`;
    else if (!st) how = `${TAP} the drawing to place it. ${snapNote()}`;
    else if (st.dim) {
      const n = R.draft ? R.draft.pts.length : 0;
      how = n === 2 ? `Now ${tap} where the dimension line should sit (on the measured line keeps it there).`
        : `${TAP} one end, then the other, then where the dimension line should sit. ${snapNote()}${COARSE ? '' : ' Hold Shift for a level, plumb or 45° dimension.'}`;
    }
    else if (st.trailer) {
      const t = R.tlast || TRAILER0;
      how = !mpu() ? 'set the drawing scale first (Drawing panel): a trailer is drawn at its real size.'
        : `${TAP} where its centre goes: it is placed at ${trailerText(t)}. Select it and press Trailer size (or double-${tap} it) to type its length, width and angle. ${snapNote()}`;
    }
    else if (boxy(st)) how = `${TAP} two opposite corners${COARSE ? '' : '; hold Shift for a ' + (st.shape === 'box' ? 'square' : 'true circle')}. Its colour is set in the toolbar (1 to 9). ${snapNote()}`;
    else if (st.kind === 'line') how = `${TAP} points along the route; double-${tap} or ${COARSE ? 'Finish' : 'Enter'} to finish${COARSE ? '' : ', Backspace removes a point'}. ${snapNote()}${COARSE ? '' : ' Hold Shift for a level, plumb or 45° segment.'}`;
    else how = byCorners(st) ? `${TAP} two opposite corners${st.note ? ' (Polygon: corner by corner)' : ''}. ${snapNote()}` : `${TAP} each corner; double-${tap} or ${COARSE ? 'Finish' : 'Enter'} to close. ${snapNote()}${COARSE ? '' : ' Hold Shift for a level, plumb or 45° edge.'}`;
    return `${name}: ${how} ${stop}`;
  }
  function snapNote(text) { // what the cursor will snap to, for the hint line
    if (!snapOn()) return 'Snap is off.';
    if (D.snapBusy) return 'Reading the drawing\'s lines for snapping…';
    const full = D.snap && D.snap.full ? ' This page has more lines than the tool keeps, so some will not snap.' : '';
    if (D.snap && D.snap.n) return (text ? 'It snaps to line ends, crossings and middles, or lines up with another label.' : 'The cursor snaps to line ends, crossings and middles; zoom in to pick between close ones.') + full;
    return (text ? 'It lines up with other labels. ' : '') + 'This drawing has no lines to snap to (a scan or an image).';
  }
  function setMode(m) {
    const prev = R.mode;
    // Calibrate may zoom in on its two points even while the view is held at the print scale (zoomLocked): the view
    // from before is kept, and put back when Calibrate ends if there is a scale to hold (the new one, or the old)
    if (m === 'cal' && prev !== 'cal') R.calView = { z: V.z, cx: V.cx, cy: V.cy };
    else if (prev === 'cal' && m !== 'cal' && R.calView) {
      if (mpu()) { V.z = R.calView.z; V.cx = R.calView.cx; V.cy = R.calView.cy; dirty(); }
      R.calView = null;
    }
    R.mode = m; R.lastTap = null; R.snap = null; R.hover = null; R.zwin = null; // a tap before a mode change never pairs with one after it
    if (m !== 'draw') R.tool = null;
    if (m !== prev || (m !== 'draw' && m !== 'cal')) R.draft = null; // Calibrate took over a half-drawn line's points (review)
    if (m !== 'select') R.sel = null;
    if (!R.root) return;
    R.root.classList.remove('cs-mode-pan', 'cs-mode-select', 'cs-mode-draw', 'cs-mode-cal');
    R.root.classList.add('cs-mode-' + m);
    dirty(); updateUi();
  }
  function arm(id, layer) { // a tool in hand: a symbol of a layer (the legend row picked), or Text or Dimension (notes)
    if (!D.ready) { toast('Open a drawing first.', 'err'); return; }
    const lyr = layer && LAYER[layer] ? layer : homeLayer(id);
    if (layerLocked(lyr)) { toast(`The ${LAYER[lyr].label} layer is locked. Unlock it (the padlock in the legend) to place on it.`, 'err'); return; }
    R.lyr = lyr;
    if (!layerOn(R.lyr)) { setLayer(R.lyr, { off: 0 }); toast(`The ${LAYER[R.lyr].label} layer was hidden; it shows again, so what you place can be seen.`); }
    R.root.classList.remove('cs-mode-pan', 'cs-mode-select', 'cs-mode-cal'); R.root.classList.add('cs-mode-draw');
    R.mode = 'draw'; R.tool = id; R.draft = null; R.sel = null; R.lastTap = null; R.snap = null; R.hover = null; R.zwin = null; dirty(); updateUi(); // a tool picked: Selected ends
    if (aims() && snapOn()) ensureSnap();
  }
  function updateUi() {
    if (!R.root) return;
    if (COARSE || !(R.mode === 'draw' && craneKind(R.tool)) && !R.drag) craneNotesAt(null);
    cranePanelAt();
    const cn = R.root.querySelector('#cs-cn-on'); if (cn) cn.checked = !csNotes.off;
    const on = (el, f) => el.classList.toggle('cs-on', f);
    on(R.btn.pan, R.mode === 'pan'); on(R.btn.select, R.mode === 'select');
    on(R.btn.rect, R.shape === 'rect'); on(R.btn.poly, R.shape === 'poly'); on(R.btn.zwin, !!R.zwin);
    R.root.classList.toggle('cs-zwin', !!R.zwin);
    on(R.btn.text, R.mode === 'draw' && R.tool === '_text'); on(R.btn.dim, R.mode === 'draw' && R.tool === '_dim');
    on(R.btn.box, R.mode === 'draw' && R.tool === '_box'); on(R.btn.ell, R.mode === 'draw' && R.tool === '_ellipse'); on(R.btn.cloud, R.mode === 'draw' && R.tool === '_cloud');
    on(R.calBtn, R.mode === 'cal'); on(R.btn.snap, snapOn());
    R.root.querySelectorAll('.cs-row').forEach((r) => r.classList.toggle('cs-active', R.mode === 'draw' && r.dataset.sym === R.tool && r.dataset.layer === R.lyr));
    renderLegend();
    R.hintEl.textContent = R.hintEl.title = hintText(); // one line on a desktop: the whole of it as its tooltip
    const sel = R.mode === 'select' && R.sel && find(R.sel);
    const cr = sel && isCrane(sel.sym) ? sel : null;
    R.btn.pie.style.display = cr ? '' : 'none';
    R.btn.spec.style.display = cr ? '' : 'none'; R.btn.spec.classList.toggle('cs-on', !!(cr && R.specId === cr.id));
    syncSpec(cr);
    if (cr) R.btn.pie.textContent = cr.sweep && cr.sweep < 360 ? 'Crane: make circle' : 'Crane: make pie';
    R.btn.tsz.style.display = sel && (STYLE[sel.sym] || {}).trailer ? '' : 'none';
    // a text label's colour and angle: shown with the Text tool (for the next labels) or a label selected (for it); a
    // shape's colour alone with the Box, Circle or Cloud tool, or a shape selected
    const lab = textTarget(), shp = shapeTarget(), shapes = !!shp || shapeTool(), showT = !!lab || (R.mode === 'draw' && R.tool === '_text') || shapes;
    R.btn.tstyle.style.display = showT ? '' : 'none';
    [R.btn.trl, R.btn.trr, R.btn.tsize, R.btn.trot.closest('label')].forEach((el) => { el.style.display = shapes ? 'none' : ''; });
    if (showT) {
      const col = shapes ? (shp ? labelColor(shp) : shapeColNow()) : lab ? labelColor(lab) : R.tcol || LABEL_INK, rot = lab ? labelRot(lab) : labelRot({ rot: R.trot });
      R.btn.tcol.querySelectorAll('[data-col]').forEach((sw) => sw.classList.toggle('cs-on', sw.dataset.col === col));
      const h = String(lab ? labelH(lab) : labelH({ size: R.tsize }));
      if (R.btn.tsize.value !== h) R.btn.tsize.value = h;
      if (document.activeElement !== R.btn.trot && R.btn.trot.value !== String(rot)) R.btn.trot.value = String(rot); // not while it is being typed in
    }
    const zone = sel && ZONE_OF[sel.sym];
    R.btn.mz.style.display = zone ? '' : 'none';
    if (zone) R.btn.mz.textContent = 'Draw ' + ZONE_NAME[zone].toLowerCase();
    const st = R.mode === 'draw' && STYLE[R.tool], n = R.draft ? R.draft.pts.length : 0;
    R.btn.finish.style.display = st && ((st.kind === 'line' && !st.dim && n >= 2) || (st.kind === 'area' && !byCorners(st) && !st.trailer && n >= 3)) ? '' : 'none';
  }
  function updateSide() {
    if (!R.root) return;
    const has = D.ready;
    R.fname.textContent = has ? D.name : 'No drawing open.';
    R.fmeta.textContent = !has ? '' : D.kind === 'pdf' ? `PDF, ${D.pages} page${D.pages > 1 ? 's' : ''}` : D.set ? `${D.pages} image${D.pages > 1 ? 's' : ''}. This one: ${pageName(D.page)}, ${D.w} × ${D.h} px` : `Image, ${D.w} × ${D.h} px`;
    R.pagebox.style.display = has && D.pages > 1 ? '' : 'none';
    R.scopeBox.style.display = has && D.pages > 1 ? '' : 'none'; // All pages / This page: for a drawing of several pages
    if (has && D.pages > 1) {
      const listKey = D.key + '|' + D.pages; // the page list: numbers for a PDF, the image names for a set
      if (R.pageSel.dataset.k !== listKey) { R.pageSel.dataset.k = listKey; R.pageSel.innerHTML = Array.from({ length: D.pages }, (_, i) => `<option value="${i + 1}">${i + 1} of ${D.pages}${D.set ? ': ' + esc(pageName(i + 1)) : ''}</option>`).join(''); }
      R.pageSel.value = String(D.page);
      R.prevBtn.disabled = D.page <= 1; R.nextBtn.disabled = D.page >= D.pages;
    }
    R.scaleInfo.textContent = !has ? 'Open a drawing first.' : mpu() ? scaleText() : 'Not set.';
    R.calBtn.disabled = !has;
    R.ratioBtn.style.display = !has || D.kind === 'pdf' ? '' : 'none'; R.ratioBtn.disabled = !has;
    R.noScaleBtn.style.display = has && mpu() ? '' : 'none';
    R.fadeIn.disabled = R.btn.rotl.disabled = R.btn.rotr.disabled = R.savePlanBtn.disabled = R.loadPlanBtn.disabled = !has;
    // The sheet scale is the scale the export prints at. It means nothing until the drawing itself has a scale (Drawing
    // Scale, above), so until then it is switched off and a one-line warning says what to do, rather than looking set.
    R.sheetSel.disabled = !has || !mpu();
    R.sheetWarn.hidden = !(has && !mpu());
    R.sheetSel.value = has ? String(PLAN.sheetScale || 'auto') : 'auto';
    R.symSel.disabled = !has;
    R.symSel.value = symSize()[0];
    setSymNote(has ? sheetFrame() : null);
    const fade = has ? PLAN.fade || 0 : 0;
    R.fadeIn.value = fade; R.fadeV.textContent = Math.round(fade * 100) + '%';
    renderOvlPanel();
  }
  // The Symbol size tooltip: the ground height of a 36-unit symbol (0.36 in on paper at 1:S), and what it prints at on
  // the sheet scale in use (Auto's follows the view, so render() keeps it current).
  function setSymNote(fr) {
    if (!R.symSel) return;
    const z = symSize(), inch = z[2] / 100;
    const t = !fr || !PLAN ? TIPS.sym
      : `Symbols print ${inch} in (${Math.round(inch * 25.4)} mm) tall on the 11 x 17 sheet at every scale; smaller ones such as cones keep their proportion, down to ${(SYM_MIN * z[2] / 3600).toFixed(2)} in. On screen they show at the size they will have against the drawing on the sheet. Lines, areas and crane reach are not affected.`;
    if (R.symSel.title !== t) R.symSel.title = t;
  }
  function fillInfo() {
    if (!R.root) return;
    R.root.querySelectorAll('[data-k]').forEach((inp) => { inp.disabled = !PLAN; inp.value = PLAN ? PLAN.info[inp.dataset.k] || '' : ''; });
    renderCraneNotes(); // the site address may name another city now
    renderChecks();
  }
  let toastTimer = 0;
  function toast(msg, kind) {
    if (!R.toast) return;
    clearTimeout(toastTimer);
    R.toast.textContent = msg; R.toast.classList.toggle('cs-err', kind === 'err'); R.toast.style.display = 'block';
    toastTimer = setTimeout(() => { R.toast.style.display = 'none'; }, kind === 'err' ? 7000 : 3500);
  }
  // While an export runs (R.exporting) the drawing, toolbar and side panels take no clicks and the keys do nothing: an
  // all-pages export moves through the pages behind the screen, so an edit then landed on the page being exported, not
  // the one on screen (found by review, 2026-11-17). Page changes already wait (showPage).
  // Everything in the tab but the progress card, the toast and the Sheet ready card is made inert (no clicks, no
  // keyboard focus): the title block and a focused button took input during an export (review, 2026-11-17). Not the
  // tab itself: plans.js makes a tab that is not showing inert, and the CSS hides it. A change another window made
  // meanwhile is taken once the export ends.
  function setExporting(on) {
    R.exporting = on;
    if (R.root) {
      R.root.classList.toggle('cs-exporting', on);
      const grid = R.root.querySelector('.cs-grid'), map = R.map;
      const parts = grid ? [...grid.children].filter((el) => el !== map) : [];
      if (map) parts.push(...[...map.children].filter((el) => !/cs-(busy|toast|ready)/.test(el.className)));
      parts.forEach((el) => { el.inert = on; });
    }
    if (!on && R.syncPending) takeStored();
    if (!on && R.activatePending) { R.activatePending = false; if (!offPlan()) syncShared(); }
  }
  function busy(msg) { if (!R.busy) return; R.busy.textContent = msg || ''; R.busy.style.display = msg ? 'block' : 'none'; }

  // The panel's legend rows for one section: a row per symbol to place, and after the cranes the Tail swing barricade
  // row, which is not placed by hand (it is drawn from a crane's spec), so clicking it explains instead of arming a tool
  const legendRows = (list, layer) => {
    const last = list.reduce((k, i, n) => (isCrane(i.id) ? n : k), -1);
    return list.map((i, n) => `<div class="cs-row" data-sym="${i.id}" data-layer="${layer || ''}"><div class="cs-sw">${swatch(i)}</div><div class="cs-lb">${esc(i.label)}</div></div>` +
      (n === last ? `<div class="cs-row cs-row-info" data-info="tail" title="Drawn from a crane's specification, not placed by hand"><div class="cs-sw">${swatch(TAIL_ROW)}</div><div class="cs-lb">${esc(TAIL_ROW.label)}<small>from the crane spec</small></div></div>` : '')).join('');
  };
  const swatch = (s) => `<svg viewBox="${(s.leg || s).vb}" preserveAspectRatio="xMidYMid meet">${(s.leg || s).inner}</svg>`; // `leg`: a legend row drawn differently from the placed symbol
  function build() {
    const root = CFG.root;
    root.innerHTML = `
      <div class="cs-grid">
        <div class="cs-ui cs-tb">
          <div class="cs-btns">
            <button id="cs-b-pan" title="Pan and zoom the drawing (H, or hold Space with any tool)">Pan</button>
            <button id="cs-b-select" title="Select and move items (V)">Select</button>
            <span class="cs-sep"></span>
            <button id="cs-b-poly" title="Draw areas as polygons (P)">Polygon</button>
            <button id="cs-b-rect" title="Draw areas as rectangles (R)">Rect</button>
            <button id="cs-b-text" title="Place a text label: click where it goes, then type it. Double-click a label in Select mode to change it (T).">Text</button>
            <button id="cs-b-dim" title="Dimension: click the two ends, then where the dimension line should sit; the real length is written along it. Hold Shift for a level, plumb or 45° dimension (D).">Dimension</button>
            <button id="cs-b-box" title="Box: a rectangle outline on the Notes layer, in the colour picked (1 to 9). ${COARSE ? 'Tap' : 'Click'} two opposite corners; hold Shift for a square. Drag a corner to resize it (B).">Box</button>
            <button id="cs-b-ell" title="Circle: an ellipse in the box of two opposite corners, on the Notes layer, in the colour picked (1 to 9); hold Shift for a true circle. Drag a corner to resize it (O).">Circle</button>
            <button id="cs-b-cloud" title="Cloud: a revision cloud on the Notes layer, in the colour picked (1 to 9): two opposite corners with Rect, or each corner with Polygon (Enter closes it) (K).">Cloud</button>
            <button id="cs-b-check" style="display:none" title="Crane setup checklist: open or close the side bar of checks for every site and for the city in the site address (L)">Checklist</button>
            <button id="cs-b-snap" title="Snap: clicks jump to the drawing's line ends, crossings and middles, and to the points of the markup on shown layers: placing symbols, drawing lines and areas (and reshaping or moving them), Text, Dimension and Calibrate. Click to turn it off or on (S).">Snap</button>
            <button id="cs-b-finish" class="cs-go" style="display:none" title="Finish the line or area (Enter)">Finish</button>
            <span class="cs-sep"></span>
            <button id="cs-b-undo" title="Undo (Ctrl+Z)">Undo</button>
            <button id="cs-b-dup" title="Copy the selected item (Ctrl+D)">Duplicate</button>
            <button id="cs-b-pie" style="display:none" title="Switch the selected crane between a full circle and a swing pie (C)"></button>
            <button id="cs-b-spec" style="display:none" title="Crane specification: type the supplier's figures for the selected crane (jib, counter-jib, height, load chart). Double-clicking the crane opens it too (E).">Crane spec</button>
            <button id="cs-b-tsz" style="display:none" title="Trailer size: type the selected site trailer's length and width (metres, or feet and inches) and its angle. Double-clicking the trailer opens it too (E).">Trailer size</button>
            <button id="cs-b-mz" style="display:none" title="Draw the area that goes with the selected symbol (rectangle or polygon, per the Polygon/Rect setting) (A)">Draw area</button>
            <span id="cs-b-tstyle" class="cs-tstyle" style="display:none">
              <span id="cs-b-tcol" class="cs-acis" title="Colour, AutoCAD's 9 standard colours: for the selected label or shape, or the next ones placed with the Text, Box, Circle or Cloud tool (1 to 9)">${LABEL_ACI.map(([n, hex, name]) => `<button type="button" class="cs-aci" data-col="${hex}" style="background:${hex}" title="${n} ${name}">${n}</button>`).join('')}</span>
              <button id="cs-b-trl" title="Turn the text 15° anticlockwise ([)">⟲</button>
              <label title="Text angle in degrees, anticlockwise (0 = level). For the selected label, or the next labels placed with the Text tool."><input type="number" id="cs-b-trot" min="-180" max="180" step="1" value="0">°</label>
              <button id="cs-b-trr" title="Turn the text 15° clockwise (])">⟳</button>
              <select id="cs-b-tsize" title="Text height on the printed sheet (the height of the capitals, as in CAD): for the selected label, or the next labels placed with the Text tool (- and =)">${LABEL_HEIGHTS.map(([h, name]) => `<option value="${h}">${name}</option>`).join('')}</select>
            </span>
            <button id="cs-b-del" title="Delete the selected item (Delete)">Delete</button>
            <button id="cs-b-clear" title="Remove the markup on this page on the shown, unlocked layers; it asks first (Shift+Delete)">Clear</button>
            <span class="cs-sep"></span>
            <button id="cs-b-export" title="Save an 11 x 17 in sheet, with the legend and title block, as an image (200 dpi) in the format picked beside it. With All pages: one image per page, in a folder (or a .zip where the browser cannot write a folder) (Ctrl+E).">Export image</button>
            <select id="cs-b-fmt" title="Image format for Export image">${IMG_FORMATS.map((f) => `<option value="${f[0]}">${f[1]}</option>`).join('')}</select>
            <button id="cs-b-pdf" title="Save an 11 x 17 in sheet as PDF (200 dpi). Each markup is a PDF annotation, so it can be selected and edited in Bluebeam Revu. With All pages: one PDF with a sheet for every page (Ctrl+Shift+E).">Export PDF</button>
            <span class="cs-group"><button id="cs-b-print" title="Save this page (only the page showing, whatever All pages says) as an 11 x 17 in sheet: the PDF, as Export PDF makes it, or the image, in the format picked beside Export image (Ctrl+P).">Print</button><select id="cs-b-pkind" title="What Print saves: the PDF sheet or the image of it"><option value="pdf">PDF</option><option value="image">Image</option></select></span>
            <button id="cs-b-keys" title="Keyboard shortcuts (?)">?</button>
          </div>
          <div class="cs-hint"></div>
        </div>
        <div class="cs-map">
          <div class="cs-frame"></div>
          <div class="cs-page"><div class="cs-ovls"></div><div class="cs-fade"></div></div>
          <svg class="cs-svg"><g id="cs-layer"></g></svg>
          <div class="cs-empty">
            <div class="cs-empty-t">Open a PDF or image of the site</div>
            <button class="cs-ui" data-open>Open PDF, images or .zip…</button>
            <button class="cs-ui" data-open-dir>Open a folder of images…</button>
            <div class="cs-empty-s">${COARSE ? '' : 'You can also drop a file or a folder here, or paste an image. '}Every layer's markup is kept in this browser, for each drawing; Save plan file keeps a copy.</div>
          </div>
          <div class="cs-sb"><div class="cs-sblabel">0</div><div class="cs-bar"></div></div>
          <div class="cs-cnotes"></div>
          <div class="cs-ui cs-checks"></div>
          <div class="cs-ui cs-checks cs-spec"></div>
          <div class="cs-busy"></div>
          <div class="cs-toast"></div>
          <div class="cs-ui cs-ready"></div>
        </div>
        <div class="cs-tabs">
          <button data-tab="legend">Legend</button><button data-tab="drawing">Drawing</button><button data-tab="info">Project</button>
        </div>
        <div class="cs-legend">${legendHtml()}</div>
        <div class="cs-side">
          <h3>DRAWING</h3>
          <button class="cs-btn cs-primary" data-open>Open PDF, images or .zip…</button>
          <button class="cs-btn" data-open-dir>Open a folder of images…</button>
          <div class="cs-note cs-strong" id="cs-fname"></div>
          <div class="cs-note" id="cs-fmeta"></div>
          <div class="cs-line" id="cs-pagebox" style="display:none">
            <span>Page</span>
            <button class="cs-btn" id="cs-prev" title="Previous page">‹</button>
            <select id="cs-page"></select>
            <button class="cs-btn" id="cs-next" title="Next page">›</button>
          </div>
          <div id="cs-ovlbox" style="display:none">
            <h3 title="${esc(TIPS.ovl)}">PAGE OVERLAY</h3>
            <div id="cs-ovl"></div>
            <button class="cs-btn" id="cs-ovl-add" title="Lay another page of this drawing over the page showing">+ Add a page to lay over</button>
          </div>
          <h3 title="${esc(TIPS.cal)}">DRAWING SCALE</h3>
          <div class="cs-note cs-strong" id="cs-scaleinfo"></div>
          <div class="cs-line">
            <button class="cs-btn" id="cs-cal" title="${esc(TIPS.calBtn)}">Calibrate…</button>
            <button class="cs-btn" id="cs-ratio" title="${esc(TIPS.ratio)}">Enter 1:N…</button>
            <button class="cs-btn" id="cs-noscale" title="Forget this drawing's scale">Clear</button>
          </div>
          <h3 title="${esc(TIPS.sheet)}">SHEET SCALE</h3>
          <select id="cs-sheetscale" title="${esc(TIPS.sheet)}">
            <option value="auto">Auto: standard scale picked by Fit or Selected</option>
            ${FIXED_SCALES.map(([n, t]) => `<option value="${n}">${esc(t)}</option>`).join('')}
          </select>
          <div class="cs-note cs-warn" id="cs-sheetwarn" hidden>Set the drawing scale first.</div>
          <h3 title="${esc(TIPS.sym)}">SYMBOL SIZE</h3>
          <select id="cs-symsize" title="${esc(TIPS.sym)}">
            ${SYM_SIZES.map(([n, t]) => `<option value="${n}">${esc(t)}</option>`).join('')}
          </select>
          <h3>DISPLAY</h3>
          <label class="cs-rng"><span>Fade the drawing</span><input type="range" id="cs-fade" min="0" max="0.85" step="0.05" value="0"><b id="cs-fadev">0%</b></label>
          <!-- the view, the page's turn and what Export saves (user, 2026-11-19: moved here from the toolbar) -->
          <div class="cs-line"><span class="cs-lbl">View</span><button class="cs-btn" id="cs-b-fit" title="Fit the whole page inside the print outline (F)">Fit</button><button class="cs-btn" id="cs-b-zwin" title="Zoom window, as in AutoCAD: drag a rectangle, or click two corners, and that area fills the print outline. Esc cancels (Z).">Selected</button></div>
          <div class="cs-line"><span class="cs-lbl">Rotate page</span><button class="cs-btn" id="cs-b-rotl" title="Rotate the page a quarter turn left (anticlockwise); the markup on every layer turns with it. Ctrl+Shift+Minus (Cmd+Shift+Minus on a Mac), as in Bluebeam and Acrobat.">⟲ 90°</button><button class="cs-btn" id="cs-b-rotr" title="Rotate the page a quarter turn right (clockwise); the markup on every layer turns with it. Ctrl+Shift+Plus (Cmd+Shift+Plus on a Mac), as in Bluebeam and Acrobat.">⟳ 90°</button></div>
          <div class="cs-line" id="cs-scopebox" style="display:none"><span class="cs-lbl">Export</span><select id="cs-b-scope" title="What the two Export buttons save: every page of the drawing (a PDF with a page each, or a folder of images), or only the page showing. Each page prints the view it was left in; a page never opened prints whole."><option value="all">All pages</option><option value="one">This page</option></select></div>
          ${craneNotesPanel()}
          <h3 title="${esc(TIPS.saving)}">SAVING</h3>
          <div class="cs-line">
            <button class="cs-btn" id="cs-saveplan" title="Save the markup, scales and title block of this drawing as a .json file (Ctrl+S)">Save plan file</button>
            <button class="cs-btn" id="cs-loadplan" title="Load a saved plan file onto the open drawing">Load plan file…</button>
          </div>
        </div>
        <div class="cs-info">${TB_ROWS.map((row) => `<div class="cs-tbrow">${row.cells.map(([k, label, w]) => `<div class="cs-cell" style="flex:${w} 1 0"><span>${label}</span>${
          k === 'notes' ? '<div class="cs-auto" id="cs-notes"></div>'
          : k === 'scale' ? '<div class="cs-auto cs-scaleval" id="cs-scale">-</div>'
          : `<input data-k="${k}" spellcheck="false" autocomplete="off"${k === 'address' ? ' placeholder="e.g. 13450 104 Ave"' : k === 'sheet' ? ' placeholder="L-1"' : k === 'rev' ? ' placeholder="A"' : ''}>`
        }</div>`).join('')}</div>`).join('')}</div>
      </div>
      <input type="file" id="cs-file" accept="application/pdf,.pdf,image/*,.jxl,.heic,.heif,.avif,.tif,.tiff,.bmp,.webp,.svg,.zip,application/zip,application/x-zip-compressed" multiple hidden>
      <input type="file" id="cs-dir" webkitdirectory hidden>
      <input type="file" id="cs-planfile" accept="application/json,.json" hidden>
      <input type="file" id="cs-specfile" accept="application/json,.json" hidden>`;
    R.root = root;
    R.legend = root.querySelector('.cs-legend');
    // the layers' eyes, lists and opacities (renderLegend shows their state)
    R.legend.addEventListener('click', (e) => {
      const el = e.target.closest('.cs-lyr'), id = el && el.dataset.layer;
      if (!id) return;
      if (e.target.closest('[data-eye]')) setLayer(id, { off: layerOn(id) ? 1 : 0 });
      else if (e.target.closest('[data-lock]')) setLayer(id, { lock: layerLocked(id) ? 0 : 1 });
      else if (e.target.closest('[data-fold]')) {
        store.open = Object.assign({}, store.open);
        if (store.open[id]) delete store.open[id]; else store.open[id] = 1;
        if (!Object.keys(store.open).length) store.open._ = 1; // all folded up: stays so (not the first-time default)
        save(); renderLegend();
      }
    });
    R.legend.addEventListener('input', (e) => { const r = e.target.closest('[data-op]'); if (r) setLayer(r.closest('.cs-lyr').dataset.layer, { op: +r.value }, true); });
    R.legend.addEventListener('change', (e) => { if (e.target.closest('[data-op]')) save(); }); // saved once the slider is let go
    const q = (s) => root.querySelector(s);
    R.map = q('.cs-map'); R.page = q('.cs-page'); R.frame = q('.cs-frame'); R.fade = q('.cs-fade');
    R.layer = q('#cs-layer'); R.hintEl = q('.cs-hint'); R.toast = q('.cs-toast'); R.busy = q('.cs-busy'); R.cnotes = q('.cs-cnotes'); R.checks = q('.cs-checks'); R.spec = q('.cs-spec'); R.ready = q('.cs-ready');
    R.sb = q('.cs-sb'); R.sbBar = q('.cs-sb .cs-bar'); R.sbLabel = q('.cs-sblabel'); R.scaleEl = q('#cs-scale');
    R.fname = q('#cs-fname'); R.fmeta = q('#cs-fmeta'); R.pagebox = q('#cs-pagebox'); R.pageSel = q('#cs-page'); R.prevBtn = q('#cs-prev'); R.nextBtn = q('#cs-next');
    R.scaleInfo = q('#cs-scaleinfo'); R.calBtn = q('#cs-cal'); R.ratioBtn = q('#cs-ratio'); R.noScaleBtn = q('#cs-noscale');
    R.fadeIn = q('#cs-fade'); R.fadeV = q('#cs-fadev'); R.fileIn = q('#cs-file');
    R.notesEl = q('#cs-notes'); R.sheetSel = q('#cs-sheetscale'); R.planIn = q('#cs-planfile');
    R.symSel = q('#cs-symsize'); R.scopeBox = q('#cs-scopebox'); R.sheetWarn = q('#cs-sheetwarn'); R.cnPanel = q('#cs-cnpanel');
    R.savePlanBtn = q('#cs-saveplan'); R.loadPlanBtn = q('#cs-loadplan');
    R.ovls = q('.cs-ovls'); R.ovlBox = q('#cs-ovlbox'); R.ovlRows = q('#cs-ovl'); R.ovlAdd = q('#cs-ovl-add');
    R.ovlAdd.onclick = () => { // the nearest page not showing and not laid over yet
      const list = ovlList().slice(), used = new Set(list.map((o) => o.pg).concat(D.page));
      if (!D.ready || list.length >= OVL_MAX) return;
      let pg = 0;
      for (let k = 1; k < D.pages && !pg; k++) for (const c of [D.page + k, D.page - k]) if (!pg && c >= 1 && c <= D.pages && !used.has(c)) pg = c;
      if (!pg) { toast('Every other page is laid over already.'); return; }
      list.push({ pg, op: OVL_OP }); setOvl(list);
    };
    R.ovlRows.addEventListener('click', (e) => {
      const row = e.target.closest('.cs-ovl-row'); if (!row) return;
      const list = ovlList().map((o) => Object.assign({}, o)), i = +row.dataset.i;
      if (e.target.closest('[data-ovl-eye]')) { list[i].off = list[i].off ? 0 : 1; setOvl(list); }
      else if (e.target.closest('[data-ovl-del]')) { list.splice(i, 1); setOvl(list); }
    });
    R.ovlRows.addEventListener('change', (e) => {
      const row = e.target.closest('.cs-ovl-row'); if (!row) return;
      if (e.target.matches('[data-ovl-pg]')) { const list = ovlList().map((o) => Object.assign({}, o)); list[+row.dataset.i].pg = +e.target.value; setOvl(list); }
      else if (e.target.matches('[data-ovl-op]')) save(); // the opacity, once the slider is let go
    });
    R.ovlRows.addEventListener('input', (e) => { // the opacity while the slider moves: the picture and the markup, no redraw of the page
      if (!e.target.matches('[data-ovl-op]')) return;
      const o = ovlList()[+e.target.closest('.cs-ovl-row').dataset.i]; if (!o) return;
      o.op = +e.target.value; e.target.nextElementSibling.textContent = Math.round(o.op * 100) + '%';
      const cv = R.ovls.querySelector(`[data-pg="${o.pg}"]`); if (cv) cv.style.opacity = String(o.op);
      dirty();
    });
    R.btn = {};
    ['pan', 'select', 'poly', 'rect', 'text', 'dim', 'box', 'ell', 'cloud', 'check', 'snap', 'finish', 'undo', 'dup', 'pie', 'spec', 'tsz', 'mz', 'tstyle', 'tcol', 'trot', 'trl', 'trr', 'tsize','del', 'clear', 'fit', 'zwin', 'rotl', 'rotr', 'scope', 'export', 'fmt', 'pdf', 'print', 'pkind', 'keys'].forEach((k) => (R.btn[k] = q('#cs-b-' + k)));

    root.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => R.fileIn.click()));
    R.fileIn.onchange = () => { const fs = [...(R.fileIn.files || [])]; R.fileIn.value = ''; if (fs.length) openFiles(fs.map((file) => ({ file, path: file.name })), ''); };
    R.dirIn = q('#cs-dir');
    root.querySelectorAll('[data-open-dir]').forEach((b) => (b.onclick = () => R.dirIn.click()));
    R.dirIn.onchange = () => { // a folder: its images, sub-folders included, under the folder's name
      const fs = [...(R.dirIn.files || [])]; R.dirIn.value = '';
      if (!fs.length) { toast('That folder is empty.', 'err'); return; }
      const rel = (f) => f.webkitRelativePath || f.name, folder = rel(fs[0]).split('/')[0] || 'folder';
      openFiles(fs.map((file) => ({ file, path: rel(file).split('/').slice(1).join('/') || file.name })), folder);
    };
    root.querySelectorAll('[data-k]').forEach((inp) => {
      const onInfo = (e) => {
        if (!PLAN || (e && e.isComposing)) return; // an accent or IME still being composed: wait for compositionend
        const en1 = (s) => englishOnly(s).replace(/[\t\n]/g, ' '), en = en1(inp.value); // English only
        if (en !== inp.value) { // the caret stays where it was, counted in the cleaned text before it
          const at = en1(inp.value.slice(0, inp.selectionStart == null ? inp.value.length : inp.selectionStart)).length;
          inp.value = en;
          try { inp.setSelectionRange(at, at); } catch (err) { /* not a text field */ }
        }
        PLAN.info[inp.dataset.k] = en;
        if (inp.dataset.k === 'address') { renderCraneNotes(); renderChecks(); }
        if (inp.dataset.k === 'by') store.by = inp.value;
        if (inp.dataset.k === 'checked') store.checked = inp.value;
        save();
      };
      inp.addEventListener('input', onInfo);
      inp.addEventListener('compositionend', () => onInfo(null));
    });
    R.sheetSel.onchange = () => { if (!PLAN) return; PLAN.sheetScale = R.sheetSel.value === 'auto' ? 'auto' : +R.sheetSel.value; R.autoN = null; R.snapSheet = true; R.home = null; save(); dirty(); }; // shown as the whole sheet
    R.symSel.onchange = () => { if (!PLAN) return; PLAN.symSize = R.symSel.value; save(); updateSide(); dirty(); };
    R.savePlanBtn.onclick = savePlanFile;
    R.loadPlanBtn.onclick = () => R.planIn.click();
    R.planIn.onchange = () => { const f = R.planIn.files && R.planIn.files[0]; R.planIn.value = ''; if (f) loadPlanFile(f); };
    root.querySelectorAll('.cs-tabs button').forEach((b) => (b.onclick = () => { root.dataset.tab = b.dataset.tab; syncTabs(); }));
    syncTabs();
    const B = R.btn;
    B.pan.onclick = () => setMode('pan');
    B.select.onclick = () => setMode('select');
    B.rect.onclick = () => { R.shape = 'rect'; if (R.mode === 'draw') R.draft = null; dirty(); updateUi(); };
    B.poly.onclick = () => { R.shape = 'poly'; if (R.mode === 'draw') R.draft = null; dirty(); updateUi(); };
    B.text.onclick = () => (R.mode === 'draw' && R.tool === '_text' ? setMode('pan') : arm('_text', NOTES));
    B.dim.onclick = () => (R.mode === 'draw' && R.tool === '_dim' ? setMode('pan') : arm('_dim', NOTES));
    [['box', '_box'], ['ell', '_ellipse'], ['cloud', '_cloud']].forEach(([b, id]) => { B[b].onclick = () => (R.mode === 'draw' && R.tool === id ? setMode('pan') : arm(id, NOTES)); });
    B.tsz.onclick = () => { const it = R.sel && find(R.sel); if (it && (STYLE[it.sym] || {}).trailer) editTrailer(it); };
    if (CK) {
      B.check.style.display = '';
      B.check.onclick = () => { store.checksOpen = !store.checksOpen; save(); renderChecks(); };
      R.checks.addEventListener('change', onCheckChange);
      R.checks.addEventListener('click', (e) => { if (e.target.closest('[data-ck-close]')) { store.checksOpen = false; save(); renderChecks(); } });
      ['wheel', 'pointerdown'].forEach((t) => R.checks.addEventListener(t, (e) => e.stopPropagation())); // scrolling the list is not zooming the drawing
    }
    B.snap.onclick = () => { csSnap.off = !csSnap.off; try { localStorage.setItem('siteLogistics.snapOff', csSnap.off ? '1' : ''); } catch (e) {} R.snap = null; if (snapOn() && aims()) ensureSnap(); dirty(); updateUi(); };
    B.finish.onclick = () => { finishDraft(); updateUi(); };
    B.keys.onclick = showKeys;
    B.undo.onclick = () => { undo(); updateUi(); };
    B.spec.onclick = () => { const it = R.sel && find(R.sel); if (!it || !isCrane(it.sym)) return; if (R.specId === it.id) closeSpec(); else openSpec(it); updateUi(); };
    R.spec.addEventListener('input', onSpecInput);
    R.spec.addEventListener('change', (e) => {
      const pick = e.target.closest('[data-sp-lib]'), cat = e.target.closest('[data-sp-cat]'), it = R.specId && find(R.specId);
      if (pick && it && pick.value !== '') { const c = specLib()[+pick.value]; if (c) applySpec(it, Object.assign(c, { label: true })); }
      else if (cat && it && cat.value !== '') { const c = CAT[+cat.value]; if (c) applySpec(it, catSpec(c, !it.spec || it.spec.label !== false)); }
      else if (!pick && !cat) onSpecInput(e);
    });
    R.spec.addEventListener('click', onSpecClick);
    ['wheel', 'pointerdown', 'keydown'].forEach((t) => R.spec.addEventListener(t, (e) => e.stopPropagation())); // typing here is not a drawing shortcut
    R.specIn = q('#cs-specfile');
    R.specIn.onchange = () => { const f = R.specIn.files && R.specIn.files[0]; R.specIn.value = ''; if (f) loadSpecFile(f); };
    B.pie.onclick = () => {
      const it = R.sel && find(R.sel); if (!it || !isCrane(it.sym)) return;
      pushUndo(); if (it.sweep && it.sweep < 360) { delete it.sweep; delete it.a0; } else { it.sweep = 90; it.a0 = -135; }
      save(); dirty(); updateUi();
    };
    B.mz.onclick = () => { const it = R.sel && find(R.sel), zone = it && ZONE_OF[it.sym]; if (zone) arm(zone, layerOf(it)); }; // on its symbol's layer
    B.dup.onclick = () => { dupSel(); updateUi(); };
    B.del.onclick = () => { delSel(); updateUi(); };
    B.clear.onclick = () => { clearAll(); updateUi(); };
    B.fit.onclick = fitView;
    B.zwin.onclick = () => {
      if (!D.ready) return;
      R.zwin = R.zwin ? null : { a: null, b: null, id: null };
      if (R.zwin) toast(`${TAP === 'Tap' ? 'Drag across' : 'Drag a rectangle, or click two corners,'} to zoom to that area. Esc cancels.`);
      updateUi(); dirty();
    };
    B.fmt.value = IMG_FORMATS.some((f) => f[0] === store.fmt) ? store.fmt : 'png';
    B.fmt.onchange = () => { store.fmt = B.fmt.value; save(); };
    B.scope.value = store.scope === 'one' ? 'one' : 'all';
    B.scope.onchange = () => { store.scope = B.scope.value; save(); };
    B.export.onclick = () => exportSheet(B.fmt.value, B.scope.value === 'all');
    B.pdf.onclick = () => exportSheet('pdf', B.scope.value === 'all');
    B.pkind.value = store.pkind === 'image' ? 'image' : 'pdf';
    B.pkind.onchange = () => { store.pkind = B.pkind.value; save(); };
    B.print.onclick = () => printSheet(B.pkind.value);
    // a text label's colour and angle: the selected label's, or the next labels' (R.tcol, R.trot)
    B.tcol.addEventListener('click', (e) => { const sw = e.target.closest('[data-col]'); if (sw) setTextStyle({ color: sw.dataset.col }); });
    B.tsize.addEventListener('change', () => setTextStyle({ size: +B.tsize.value }));
    B.trot.addEventListener('input', () => { const v = parseFloat(B.trot.value); if (Number.isFinite(v)) setTextStyle({ rot: v }, true); });
    B.trot.addEventListener('change', () => { R.tUndo = false; updateUi(); });
    B.trl.onclick = () => setTextStyle({ rot: textRotNow() + 15 });
    B.trr.onclick = () => setTextStyle({ rot: textRotNow() - 15 }); // keys typed in the boxes are left alone by onKey already
    root.querySelectorAll('.cs-row[data-sym]').forEach((row) => { row.onclick = () => (R.mode === 'draw' && R.tool === row.dataset.sym && R.lyr === row.dataset.layer ? setMode('pan') : arm(row.dataset.sym, row.dataset.layer)); });
    root.querySelectorAll('.cs-row[data-info="tail"]').forEach((row) => { row.onclick = () => toast('Tail swing barricade: drawn round a self-erecting crane, mobile crane or placing boom once its Crane spec has a tail radius. Select the crane and press Crane spec.'); });

    R.calBtn.onclick = () => { if (!D.ready) return; if (R.mode === 'cal') setMode('pan'); else { setMode('cal'); toast(`${TAP} the first point.`); } };
    R.ratioBtn.onclick = askRatio;
    R.noScaleBtn.onclick = async () => { if (!(await csConfirm('Clear the scale for this page?'))) return; pageCfg().mpu = null; pageCfg().cleared = 1; save(); shareScale(String(D.page)); updateSide(); dirty(); }; // cleared, as against never set
    R.pageSel.onchange = () => showPage(+R.pageSel.value, true).then(() => renderLegend());
    R.prevBtn.onclick = () => showPage(D.page - 1, true).then(() => renderLegend());
    R.nextBtn.onclick = () => showPage(D.page + 1, true).then(() => renderLegend());
    R.fadeIn.oninput = () => { if (!PLAN) return; PLAN.fade = +R.fadeIn.value; R.fadeV.textContent = Math.round(PLAN.fade * 100) + '%'; save(); dirty(); };
    const cnOn = q('#cs-cn-on');
    if (cnOn) {
      cnOn.checked = !csNotes.off;
      cnOn.onchange = () => { csNotes.off = !cnOn.checked; try { localStorage.setItem('siteLogistics.craneNotesOff', csNotes.off ? '1' : ''); } catch (e) {} craneNotesAt(null); };
    }
    R.btn.rotl.onclick = () => rotatePage(-1);
    R.btn.rotr.onclick = () => rotatePage(1);

    R.map.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    R.map.addEventListener('wheel', onWheel, { passive: false });
    R.map.addEventListener('contextmenu', (e) => { if (D.ready) e.preventDefault(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onSpace); window.addEventListener('keyup', onSpace);
    window.addEventListener('blur', () => { if (R.space) { R.space = false; R.root.classList.remove('cs-spacepan'); } }); // let go elsewhere
    window.addEventListener('keydown', onShift); window.addEventListener('keyup', onShift);
    document.addEventListener('gesturestart', (e) => e.preventDefault()); // Safari: no page zoom while pinching the drawing

    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    window.addEventListener('dragover', (e) => { if (hasFiles(e) && !offPlan()) { e.preventDefault(); root.classList.add('cs-drop'); } });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) root.classList.remove('cs-drop'); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e) || offPlan()) return;
      e.preventDefault(); root.classList.remove('cs-drop');
      const ens = [...(e.dataTransfer.items || [])].map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
      const fs = [...e.dataTransfer.files];
      if (ens.some((en) => en.isDirectory)) dropList(ens).then((r) => openFiles(r.list, r.folder), () => toast('Could not read that folder.', 'err'));
      else if (fs.length) openFiles(fs.map((file) => ({ file, path: file.name })), '');
    });
    window.addEventListener('paste', (e) => {
      const t = e.target; if (offPlan() || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
      const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => /^image\/|\/pdf$/.test(x.type));
      if (f) { e.preventDefault(); openFile(f); }
    });

    const onResize = () => {
      const w = R.map.clientWidth, h = R.map.clientHeight;
      if (w === V.w && h === V.h) return;
      const held = D.ready && zoomLocked() && V.w && V.h && !R.exporting ? sheetFrame() : null; // the scale printing now
      const inBy = held ? V.z / ((printFrame().w * held.z) / MAP_IN.w) : 1; // how far in from the whole sheet
      V.w = w; V.h = h;
      R.tbInset = null; // the toolbar may wrap differently at the new width: measured again
      if (held) V.z = ((printFrame().w * held.z) / MAP_IN.w) * Math.max(1, inBy); // the same scale, and as far in, in the new window
      if (R.needFit && D.ready && w && h) { R.needFit = false; restoreView(); }
      dirty();
    };
    // the drawing window's size follows the space for the sheet (the grid) and the toolbar's height, not the reverse
    R.grid = R.root.querySelector('.cs-grid'); R.tbEl = R.root.querySelector('.cs-tb');
    if (window.ResizeObserver) { const ro = new ResizeObserver(layoutSheet); ro.observe(R.grid); ro.observe(R.tbEl); }
    window.addEventListener('resize', layoutSheet);
    layoutSheet();
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(R.map);
    window.addEventListener('resize', onResize);
    onResize();
  }
  function syncTabs() { R.root.querySelectorAll('.cs-tabs button').forEach((b) => b.classList.toggle('cs-on', b.dataset.tab === R.root.dataset.tab)); }

  build();
  setMode('pan'); updateSide(); fillInfo(); dirty();
  window.addEventListener('cs-font', () => dirty()); // the labels' lettering has loaded: measure and draw them with it
  // The export hooks below take the same guard as the Export buttons: one export at a time. Two at once share the page
  // and view state, and one wrote another page's scale onto its sheets (found by a test harness, 2026-11-17).
  const guarded = async (fn) => {
    if (R.exporting) throw new Error('An export is already running.');
    setExporting(true);
    try { return await fn(); } finally { setExporting(false); busy(null); }
  };
  return {
    activate: () => { if (R.zwin) { R.zwin = null; updateUi(); } return syncShared(); }, // called once the view is set up
    open: openFile, loadPlan: loadPlanFile, compose: composeSheet,
    // the files the export buttons write, as blobs (for checking them without a download)
    image: (kind) => guarded(async () => { const cv = await composeSheet(); return (IMG_FORMATS.find((x) => x[0] === kind) || IMG_FORMATS[0])[2](cv); }),
    pdf: () => guarded(async () => { const fr = sheetFrame(), cv = await composeSheet(true, fr), jpg = await toBlob(cv, 'image/jpeg', 0.92); return pdfSheet([{ jpeg: new Uint8Array(await jpg.arrayBuffer()), w: cv.width, h: cv.height, annots: await sheetAnnots(fr), N: fr.N }], 'Site Logistics'); }), sheet: () => sheetFrame(),
    // every page: exportAll('pdf') or an image kind; dir: a folder handle to write the images into instead of a .zip
    // refuses a second export while one runs, as the Export buttons do: two at once share the page and view state, and
    // one wrote another page's scale onto its sheets (found by a test harness, 2026-11-17)
    exportAll: (kind, dir) => guarded(() => exportAll(kind, dir || null)), openFiles,
    // for tests: what was read for snapping on this page, and the snap point for a drawing point at the current zoom
    snap: () => ({ busy: !!D.snapBusy, ready: !!D.snap, n: D.snap ? D.snap.n : 0, full: !!(D.snap && D.snap.full), ms: D.snap ? D.snap.ms : null, ops: D.snap ? D.snap.ops : 0, cells: D.snap ? D.snap.list.length : 0 }),
    snapAt: (x, y, text) => (text ? snapText([x, y]) : snapPoint([x, y])), readLines: ensureSnap,
    rotate: rotatePage,
    legend: () => legendModel().map((x) => ({ title: x.title, ids: x.rows.map((r) => r.id) })), // what the export's legend will list for this page
    state: () => ({ plan: PLAN, view: Object.assign({}, V), doc: { kind: D.kind, name: D.name, page: D.page, pages: D.pages, w: D.w, h: D.h, rot: D.rot, rb: D.rb, detail: !!D.detail } }),
  };
}
