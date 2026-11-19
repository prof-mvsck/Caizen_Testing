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
  return new Promise((res) => {
    const input = value !== undefined;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const back = document.createElement('div');
    back.className = 'cs-dlg-back';
    back.innerHTML = `<div class="cs-dlg" role="dialog" aria-modal="true"><div class="cs-dlg-msg">${esc(message)}</div>` +
      (input ? `<input class="cs-dlg-in" type="${secret ? 'password' : 'text'}" spellcheck="false" autocomplete="off">` : '') +
      '<div class="cs-dlg-btns"><button type="button" class="cs-btn" data-x="cancel">Cancel</button><button type="button" class="cs-btn cs-primary" data-x="ok">OK</button></div></div>';
    const inp = back.querySelector('.cs-dlg-in'), ok = back.querySelector('[data-x="ok"]'), before = document.activeElement;
    let closed = false;
    const done = (yes) => { if (closed) return; closed = true; window.removeEventListener('keydown', onKeys, true); back.remove(); if (before && before.focus) before.focus(); res(input ? (yes ? inp.value : null) : yes); };
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
    if (inp) { inp.value = value == null ? '' : String(value); inp.focus(); inp.select(); } else ok.focus();
  });
}
const csAsk = (message, value, secret) => csDialog(message, value == null ? '' : value, secret);
const csConfirm = (message) => csDialog(message);

// One drawing for all the tabs. A file opened on any tab becomes the shared drawing: every other tab opens it too the
// next time it is shown, on the same page, with the same drawing scale and each page turned the same way (those belong
// to the drawing, not to a plan). Only the markup, sheet scale, symbol size and title block stay each tab's own. The drawing itself is
// kept in IndexedDB under 'shared'; which page it is on and its scales are in localStorage.
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
  // This tab's legend: CFG.sections is [{ title, ids }] picking from the libraries; without it, every symbol.
  const SECTIONS = CFG.sections
    ? CFG.sections.map((s) => ({ title: s.title, items: s.ids.map((id) => SYM[id]).filter(Boolean) })).filter((s) => s.items.length)
    : ALL_SECTIONS.filter((s) => !s.only && !(CFG.omit || []).includes(s.title)); // `only`: a section that belongs to one tab's legend; `omit`: sections moved to another tab

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
    // the Overlay tab's own dimension line (its text label, '_text', is a point and has no style)
    _dim:               { kind: 'line', dim: true, color: '#111', width: 1.5, halo: '#fff' },
    'ss-walk-lights':  { kind: 'line', color: '#808080', width: 2, tracks: true }, // Covered Walkway w/ Temp Lights, as the Elevate toolbox draws it
    'ss-covered-walk': { kind: 'area', fill: COL.gray },                 // like the Laydown Area, in grey
    'ss-crosswalk':    { kind: 'area', fill: '#66ccff', feet: '#fff' },  // like the Pedestrian path, in the 6' fencing's light blue
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
  const NOTE_NAMES = { _text: 'Text label', _dim: 'Dimension' }; // the Overlay tab's own items
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
  const scaleName = (n) => { const f = FIXED_SCALES.find((s) => s[0] === n && /"/.test(s[1])); return f ? f[1] : '1:' + n.toLocaleString(); };

  // ---------- saved state ----------
  // localStorage: one plan per drawing (keyed by file name and size); IndexedDB: the last drawing itself, so it reopens.
  const store = (() => {
    try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return { plans: j.plans || {}, last: j.last || null, by: j.by || '', checked: j.checked || '', fmt: j.fmt || 'png', scope: j.scope || 'all', pkind: j.pkind === 'image' ? 'image' : 'pdf', checksOpen: !!j.checksOpen }; }
    catch (e) { return { plans: {}, last: null, by: '', checked: '' }; }
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
    if (OV && !offPlan()) overlayRefresh({ adopt: true }); // the Overlay's own notes changed: read the tabs again too
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
    if (sc && !OV && JSON.stringify(scaledOf(sc)) !== JSON.stringify(scaledOf(PLAN.pages))) { takeSharedScale(true); updateSide(); dirty(); } // kept with the plan at its next save
    if (sharedRot(D.page) === D.rot) return false;
    showPage(D.page, true); return true;
  }
  function newPlan(name) {
    return {
      name, items: [], pages: {}, fade: 0, page: 1, sheetScale: 'auto', symSize: DEFAULT_SYM_SIZE, used: Date.now(),
      info: { project: '', address: '', title: CFG.sheetTitle, sheet: '', rev: '', by: store.by || '', checked: store.checked || '', date: today() },
      ...(CFG.overlay ? { infoOwn: {} } : {}), // the Overlay: no field typed here yet (an Overlay plan without it is older)
    };
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
  const items = () => (PLAN && D.ready ? PLAN.items.filter((i) => i.pg === D.page) : []);
  const find = (id) => (PLAN ? PLAN.items.find((i) => i.id === id) : null);
  function pageCfg() { // the drawing scale, per page
    if (!PLAN) return {};
    const k = String(D.page);
    return PLAN.pages[k] || (PLAN.pages[k] = { mpu: null });
  }
  // ---------- turning a page ----------
  // A page can be shown turned by quarter turns (Rotate, in the Drawing panel), so a plan drawn sideways can be worked
  // on and printed the right way up. The turn belongs to the drawing: every tab shows the page the same way
  // (csShared.rots). Markup is stored in the coordinates of the page as it is shown, so when a page is turned the
  // markup on it is turned with it: each plan notes which way its items for a page currently face (plan.rot), and is
  // brought round to the page's turn the next time that page is shown, exported or overlaid.
  const sharedRot = (n) => { const m = csShared.rots[D.key]; return ((m && +m[String(n)]) || 0) & 3; };
  const pdfVp = (page, scale) => page.getViewport({ scale, rotation: (page.rotate + 90 * D.rot) % 360 });
  function alignPage(plan, n, target, w0, h0) { // true if anything moved
    const k = String(n), cur = ((plan.rot && +plan.rot[k]) || 0) & 3, steps = (target - cur + 4) % 4;
    if (!steps) return false;
    let c = cur;
    for (let s = 0; s < steps; s++, c = (c + 1) % 4) {
      const h = c % 2 ? w0 : h0; // the page's height as it faces now; one turn to the right sends (x, y) to (h - y, x)
      for (const it of plan.items) {
        if (it.pg !== n) continue;
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
    if (!plan.rot) plan.rot = {};
    if (target) plan.rot[k] = target; else delete plan.rot[k];
    if (plan.views) delete plan.views[k]; // the view it was left in no longer fits: show it whole
    return true;
  }
  function alignHere() { // this page's markup, in every plan in play, round to the way the page is shown
    if (!D.w0 || !D.h0) return;
    if (PLAN && alignPage(PLAN, D.page, D.rot, D.w0, D.h0)) { R.undo = []; save(); } // an undo would bring back points from before the turn
    if (OV) OV.tabs.forEach((t) => { if (t.plan) alignPage(t.plan, D.page, D.rot, D.w0, D.h0); });
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
    showPage(D.page, true).then(() => { if (OV) overlayPanel(); });
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
        R.tbInset = Math.max(0, Math.min(V.h * 0.4, a.bottom - b.top + 6));
      }
    }
    return R.tbInset || 0;
  }
  const midY = (v) => v.h / 2 + (v === V ? tbInset() / 2 : 0); // where the view's centre is on screen; the export's is its middle
  function sheetFrame() {
    const pf = printFrame(), vw = pf.w / V.z, vh = pf.h / V.z, zFit = vw && vh ? Math.min(MAP_IN.w / vw, MAP_IN.h / vh) : 1;
    const m = mpu(), fixed = PLAN && PLAN.sheetScale !== 'auto' ? +PLAN.sheetScale : 0;
    if (!m) return { z: zFit, cx: V.cx, cy: V.cy, N: null, auto: !fixed };
    let N = fixed;
    if (!N) {
      const nFit = m / (zFit * UNIT_M);
      N = STD_SCALES.find((s) => s >= nFit * (1 - 1e-6)) || Math.ceil(nFit / 5000) * 5000;
    }
    return { z: m / (N * UNIT_M), cx: V.cx, cy: V.cy, N, auto: !fixed };
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
    V.z = fitZ(); V.cx = D.w / 2; V.cy = D.h / 2; snapToPrint(); dirty();
  }
  // Each page keeps the view it was left in (its centre, and how much of the drawing the window showed across), per
  // tab: flipping back to a page shows it as it was left, and "all pages" exports print each page that way. A page
  // never visited shows, and prints, whole.
  function keepView() {
    if (!D.ready || !PLAN || R.batch || R.needFit || !V.w || !V.z) return;
    // the print outline's width in drawing units (marked 'pf'; older views hold the window's), with the turn it was seen at:
    // a window of another shape then shows, and prints, the same area
    (PLAN.views || (PLAN.views = {}))[String(D.page)] = [V.cx, V.cy, printFrame().w / V.z, D.rot || 0, 'pf'];
  }
  function restoreView() {
    const v = PLAN && PLAN.views && PLAN.views[String(D.page)];
    if (!v || !(v[2] > 0) || !V.w || !V.h || (v.length > 3 && v[3] !== (D.rot || 0))) { fitView(); return; } // a view from before a turn: the page whole
    V.z = clampZ((v[4] === 'pf' ? printFrame().w : V.w) / v[2]); V.cx = v[0]; V.cy = v[1]; dirty();
  }
  // Zoom window (the Selected button): the rectangle between screen points a and b fills the print outline, so it is
  // what prints (Auto then rounds the scale up, so all of it does). The mode ends with it; the tool in use carries on.
  function zoomWindow(p, q) { // p, q: the corners, in drawing units
    const rw = Math.abs(q[0] - p[0]), rh = Math.abs(q[1] - p[1]), pf = printFrame();
    R.zwin = null;
    if (rw > 0 && rh > 0) {
      V.cx = (p[0] + q[0]) / 2; V.cy = (p[1] + q[1]) / 2;
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
    const m = toMap(px, py);
    V.z = clampZ(V.z * f); V.cx = m[0] - (px - V.w / 2) / V.z; V.cy = m[1] - (py - midY(V)) / V.z; dirty();
  }
  // With a drawing scale set, the view is held at the print scale: the dashed outline is always the sheet's whole print
  // area (printFrame), and the drawing pans under it but does not zoom (user, 2026-11-19: "when set, the dashed
  // rectangle stays locked to the template size, and the page can only pan, not zoom"). The scale then changes only
  // with Sheet scale, or on Auto with Fit and Selected, which pick the largest standard scale that shows the page or the
  // rectangle. Calibrate lets go while its two points are picked, so they can be zoomed in on, and puts the view back
  // after (setMode). Without a drawing scale, zoom is free as before.
  const zoomLocked = () => !!mpu() && R.mode !== 'cal';
  function holdScale() { // the zoom at which the print outline fills the print frame, at the scale that prints
    if (!D.ready || !zoomLocked() || !V.w || !V.h) return;
    const z = (printFrame().w * sheetFrame().z) / MAP_IN.w;
    // the same ceiling as a free zoom, for a fixed scale far larger than the drawing's: the outline is then bigger than
    // the window, and says so ("Prints more than the window")
    if (Number.isFinite(z) && z > 0) V.z = Math.min(z, Math.max(fitZ() * 64, D.kind === 'img' ? 16 : 40));
  }
  function lockedNote() { // once a session per tab: why the wheel or a pinch moves the drawing instead of zooming it
    if (R.lockTold) return;
    R.lockTold = true;
    const fr = sheetFrame();
    toast(`Zoom is held at the print scale (${scaleName(fr.N)}), so the dashed outline is exactly what prints. ${COARSE ? 'Drag' : 'Drag or scroll'} to move the drawing; change the scale with Sheet scale${fr.auto ? ', Fit or Selected' : ''}.`);
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
      const w = st.width;
      const side = (k) => P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - ((b[1] - a[1]) / l) * k, p[1] + ((b[0] - a[0]) / l) * k]; });
      let ties = '';
      for (let dist = 4 * w; dist < total; dist += 8 * w) { const [x, y, a] = pointAt(P, L, dist), nx = -Math.sin(a) * 4 * w, ny = Math.cos(a) * 4 * w; ties += `M${fmt(x - nx)} ${fmt(y - ny)}L${fmt(x + nx)} ${fmt(y + ny)}`; }
      s += `<path d="${pathD(side(3 * w))}${pathD(side(-3 * w))}${ties}" fill="none" stroke="${st.color}" stroke-width="${w}" stroke-linejoin="round"${preview ? ' stroke-dasharray="6 4"' : ''}/>`;
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
  function drawText(it, P, sel) {
    if (!P || isNaN(P[0])) return '';
    const size = labelSize(it), text = String(it.text || ''), rot = labelRot(it), w = textW(text, size, LABEL_FAMILY);
    return `<g class="cs-pt" data-id="${it.id}" transform="translate(${fmt(P[0])} ${fmt(P[1])})${rot ? ` rotate(${-rot})` : ''}">` +
      `<text text-anchor="middle" dominant-baseline="central" font-family="${LABEL_FAMILY}" font-weight="700" font-size="${fmt(size)}" fill="${labelColor(it)}" stroke="#fff" stroke-width="${fmt(size * 0.3)}" paint-order="stroke" stroke-linejoin="round">${esc(text)}</text>` +
      (sel ? `<rect class="cs-selring" x="${fmt(-w / 2 - 5)}" y="${fmt(-size * 0.8)}" width="${fmt(w + 10)}" height="${fmt(size * 1.6)}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-dasharray="5 4"/>` : '') + '</g>';
  }
  function drawItem(it, exp) {
    const st = STYLE[it.sym];
    const P = it.pts.map((p) => toScreen(p[0], p[1]));
    const sel = !exp && it.id === R.sel;
    if (it.sym === '_text') return drawText(it, P[0], sel);
    if (!st) return drawPoint(it, P[0], sel, exp);
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
    const closed = st.kind === 'area', n = P.length;
    let s = '';
    if (st.dim) { // a dimension: its two measured points, and a square on its line to slide the line in or out
      const [a, b] = dimEnds(P, (it.off || 0) * V.z);
      s += `<rect class="cs-vo" x="${fmt((a[0] + b[0]) / 2 - 5 * HR)}" y="${fmt((a[1] + b[1]) / 2 - 5 * HR)}" width="${10 * HR}" height="${10 * HR}" fill="#fffb00" stroke="#1a73e8" stroke-width="2"/>`;
    } else for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = P[i], b = P[(i + 1) % n];
      s += `<circle class="cs-vm" data-i="${i}" cx="${fmt((a[0] + b[0]) / 2)}" cy="${fmt((a[1] + b[1]) / 2)}" r="${4 * HR}" fill="#1a73e8" fill-opacity=".45" stroke="#fff" stroke-width="1"/>`;
    }
    P.forEach((q, i) => { s += `<circle class="cs-vh" data-i="${i}" cx="${fmt(q[0])}" cy="${fmt(q[1])}" r="${5.5 * HR}" fill="#fff" stroke="#1a73e8" stroke-width="2"/>`; });
    return s;
  }

  function drawDraft() {
    const d = R.draft;
    if (!d || !d.pts.length) return '';
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
    if (st.kind === 'area' && R.shape === 'rect') pts = R.cursor ? rectPts(d.pts[0], R.cursor) : [];
    else if (st.dim && pts.length === 2) off = R.cursor ? dimOff(pts, R.cursor) * V.z : 0; // both ends set: the cursor carries the line
    else if (R.cursor) pts.push(R.cursor);
    const P = pts.map((p) => toScreen(p[0], p[1]));
    let s = '';
    if (st.kind === 'line') s += drawLine('__draft', st, P, false, true, false, off);
    else if (P.length >= 3) s += drawArea('__draft', st, P, false, true);
    else if (P.length === 2) s += `<path d="${pathD(P)}" stroke="#1a73e8" stroke-width="1.5" stroke-dasharray="5 4" fill="none"/>`;
    d.pts.forEach((p) => { const q = toScreen(p[0], p[1]); s += `<circle cx="${fmt(q[0])}" cy="${fmt(q[1])}" r="${3.5 * HR}" fill="#fff" stroke="#1a73e8" stroke-width="1.5"/>`; });
    return s;
  }

  // The part of the view the sheet will print, outlined with the rest shaded, and its scale. Screen only, never exported.
  function extentMarkup(fr) {
    if (R.exporting) return '';
    const w = (MAP_IN.w / fr.z) * V.z, h = (MAP_IN.h / fr.z) * V.z, x = V.w / 2 - w / 2, y = midY(V) - h / 2;
    if (x <= 1 && y <= tbInset() + 1) // larger than the window both ways (a fixed scale): all of the view prints, and more
      return `<text x="${fmt(V.w - 8)}" y="${fmt(V.h - 8)}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="11.5" fill="#1a73e8" stroke="#fff" stroke-width="4" paint-order="stroke">Prints more than the window at ${esc(scaleName(fr.N))}</text>`;
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
    if (R.hintLock !== zoomLocked()) { R.hintLock = zoomLocked(); R.hintEl.textContent = hintText(); } // "scroll to zoom" or not
    const [tx, ty] = toScreen(0, 0);
    R.page.style.transform = `translate(${tx}px, ${ty}px) scale(${V.z})`;
    const fs = R.frame.style;
    fs.left = tx + 'px'; fs.top = ty + 'px'; fs.width = D.w * V.z + 'px'; fs.height = D.h * V.z + 'px';
    R.fade.style.opacity = PLAN.fade || 0;
    const fr = sheetFrame();
    R.frz = fr.z;
    let out = '';
    if (OV) out += overlayMarkup(false); else for (const it of items()) out += drawItem(it, false);
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
  const aims = () => isDimTool() || isTextTool() || R.mode === 'cal'; // the tools whose clicks are aimed (snap, lock)
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
    let s = null;
    if (isTextTool()) s = snapText(m);
    else if ((isDimTool() && n < 2) || (R.mode === 'cal' && n < 2)) s = snapPoint(m);
    else return { p: m, s: null };
    if (R.shift && n === 1 && !isTextTool()) s = withLock(d.pts[0], s, m);
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
      PLAN = store.plans[D.key] || (store.plans[D.key] = newPlan(name));
      PLAN.info = Object.assign(newPlan(name).info, PLAN.info || {});
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
  function undo() { const j = R.undo.pop(); if (!j || !PLAN) return; PLAN.items = JSON.parse(j); R.sel = null; syncCraneReach(); save(); dirty(); } // a crane's reach follows its jib again
  function delSel() { if (!R.sel) return; pushUndo(); PLAN.items = PLAN.items.filter((i) => i.id !== R.sel); R.sel = null; save(); dirty(); }
  function dupSel() {
    const it = R.sel && find(R.sel); if (!it) return;
    pushUndo(); const off = 24 / V.z;
    const c = JSON.parse(JSON.stringify(it)); c.id = uid(); c.pts = it.pts.map((p) => [p[0] + off, p[1] + off]);
    PLAN.items.push(c); R.sel = c.id; save(); dirty();
  }
  async function clearAll() {
    if (!items().length) return;
    if (!(await csConfirm('Remove everything you have placed on this page?'))) return;
    pushUndo(); PLAN.items = PLAN.items.filter((i) => i.pg !== D.page); R.sel = null; R.draft = null; save(); dirty(); updateUi();
  }
  function addItem(sym, pts, extra) {
    pushUndo(); const it = Object.assign({ id: uid(), sym, pg: D.page, pts }, extra); PLAN.items.push(it); R.sel = null; save(); dirty();
    if (ZONE_SYM[sym]) { setMode('select'); R.sel = it.id; dirty(); updateUi(); } // back to select so the new zone can be reshaped
    return it;
  }
  function finishDraft() {
    const st = STYLE[R.tool], d = R.draft;
    if (!st || !d) return;
    if (st.kind === 'area' && R.shape === 'poly' && d.pts.length && d.pts.length < 3) { toast('An area needs at least 3 corners: click the next corner.', 'err'); dirty(); return; } // kept, not thrown away
    if (st.kind === 'line' && !st.dim && d.pts.length === 1) { toast('A line needs at least 2 points: click the next point.', 'err'); dirty(); return; }
    if (st.kind === 'line' && d.pts.length >= 2) addItem(R.tool, d.pts);
    else if (st.kind === 'area' && R.shape === 'poly' && d.pts.length >= 3) addItem(R.tool, d.pts);
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
  function setTextStyle(ch, live) {
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
  async function editCraneRadius(it) {
    const m = mpu();
    if (!m) { toast('Set the drawing scale first (Drawing panel, Scale) to type the reach in metres.', 'err'); return; }
    const v = await csAsk('Crane radius in metres', Math.round(it.r * m * 10) / 10);
    const n = parseFloat(v);
    if (n > 0) { pushUndo(); it.r = n / m; if (it.spec) it.spec.jib = n; save(); dirty(); updateUi(); } // the reach is the jib length
  }

  function onMapClick(px, py) {
    const raw = toMap(px, py), m = aims() ? aim(raw).p : raw; // Calibrate, Text and Dimension clicks are aimed (snap, Shift lock)
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
    if (!R.draft) R.draft = { pts: [] };
    // R.pushed: whether this click added a point (onDoubleTap takes back only one that did). A rectangle's second
    // corner within a tap's reach of its first (8 px, 24 px by touch) is the same spot clicked again, not a flat
    // rectangle; a line or area point is skipped only on the very spot of the last one (2 px), so narrow strips and
    // short jogs can be drawn at any zoom (review, 2026-11-17).
    const tol = R.tapTouch ? 24 : 8, near = (q, t) => !!q && Math.hypot(m[0] - q[0], m[1] - q[1]) * V.z < (t || tol);
    R.pushed = false;
    if (st.kind === 'area' && R.shape === 'rect') {
      if (!R.draft.pts.length) { R.draft.pts.push(m); R.pushed = true; }
      else if (!near(R.draft.pts[0])) { addItem(R.tool, rectPts(R.draft.pts[0], m)); R.draft = null; }
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
    if (R.mode === 'select') { const it = d.item && find(d.item); if (it && isCrane(it.sym)) openSpec(it); else if (it && it.sym === '_text') editText(it); return; }
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
    const panOnly = e.button === 1 || R.mode === 'pan';
    const vh = !panOnly && R.mode === 'select' && R.sel ? e.target.closest('.cs-vh,.cs-vm,.cs-vr,.cs-va,.cs-vo') : null;
    if (vh) { R.drag = dragVertex(e, vh); if (R.drag) Object.assign(R.drag, { id: e.pointerId, x: p[0], y: p[1], touch: e.pointerType === 'touch' }); return; }
    const hit = !panOnly && R.mode === 'select' ? e.target.closest('[data-id]') : null;
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
    const it = R.drag && R.drag.item && R.drag.moved ? find(R.drag.item) : null;
    const kind = craneKind(R.mode === 'draw' ? R.tool : it ? it.sym : null);
    const fill = (k) => { const key = k + '|' + cnScope(); if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = craneNotesHtml(k); } };
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
    return `<h3>CRANE PLACEMENT NOTES</h3>
          <div class="cs-note">What to keep in mind when placing a crane. Reminders from public sources, in plain words: they do not judge where a crane stands, and the rules themselves govern. The list follows the site address (Project panel).</div>
          <label class="cs-chk"><input type="checkbox" id="cs-cn-on"> Show the short list beside the cursor while placing a crane</label>
          <div id="cs-cn-box"></div>`;
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
  // One layout per drawing pass (a screen frame, an image export, a PDF page). On the Overlay tab it spans every shown tab
  // and the Overlay's own notes, so cranes from different tabs keep clear of each other and of the text labels and
  // dimensions. Every symbol, every text label and every dimension's figure is marked as taken first; then the cranes
  // are taken in order and each one's figures go below its symbol, or else to the first of above / right / left that is
  // on the sheet and clear of everything taken so far. The layout is kept until the view, the page or a plan changes
  // (dirty() counts changes; a fingerprint of the items backs it). Result: plan -> (item id -> { dir }).
  const withPlan = (p, fn) => { const o = PLAN; PLAN = p; try { return fn(); } finally { PLAN = o; } };
  function labelLayout() {
    // the plans drawn together: the Overlay's shown tabs and its own notes (R.ovOwn, set where the Overlay draws), else this plan
    const own = OV ? (R.ovOwn || PLAN) : PLAN;
    const plans = OV ? OV.tabs.filter((t) => t.plan && !OV.off[t.id]).map((t) => t.plan).concat(own ? [own] : []) : [PLAN];
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
  const CK = CFG.id === 'mobilization' ? window.__CS_CRANE_CHECKS || null : null;
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
        if (!it) { R.drag = null; R.map.classList.remove('cs-grabbing'); return; } // deleted or undone mid-drag
        it.pts = d.orig.map((q) => [q[0] + dx / V.z, q[1] + dy / V.z]);
        if (it.sym === '_text') { R.snap = snapText(it.pts[0], it.id); if (R.snap) it.pts[0] = R.snap.p.slice(); } // a dragged label snaps like a new one
      }
      else { V.cx = d.cx - dx / V.z; V.cy = d.cy - dy / V.z; }
      dirty();
    } else if (!d && aims() && e.pointerType !== 'touch' && R.map.contains(e.target)) {
      // Dimension, Text and Calibrate: the marker shows where the click will land
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
    R.drag = null; R.map.classList.remove('cs-grabbing');
    if (R.snap && d.item) { R.snap = null; dirty(); }
    if (d.up) { d.up(e); return; }
    if (e.type === 'pointercancel') { if (d.moved && d.item) save(); return; }
    if (d.moved) { if (d.item) save(); return; }
    if (d.pan) return;
    const [x, y] = local(e), now = performance.now(), lt = R.lastTap;
    const dbl = !!lt && now - lt.t < 400 && Math.hypot(x - lt.x, y - lt.y) < (d.touch ? 24 : 8);
    // The second click of a double-click places nothing with a symbol, the Dimension tool or a rectangle area (it
    // stacked a second symbol, started a stray dimension or made a flat rectangle: review, 2026-11-17), and further
    // quick clicks on the spot are skipped too, so a triple-click places one symbol
    const st = R.mode === 'draw' && R.tool ? STYLE[R.tool] : null;
    const once = R.mode === 'draw' && !!R.tool && R.tool !== '_text' && (!st || isDimTool() || (st.kind === 'area' && R.shape === 'rect'));
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
    if (d && d.item && d.moved) save(); // the item stays wherever it got to
    R.drag = null; R.map.classList.remove('cs-grabbing');
    if (d && d.up) d.up({ pinch: true }); // a handle being dragged ends where it got to (saved, snap marker cleared)
    if (R.snap) { R.snap = null; dirty(); }
    const [a, b] = [...R.ptrs.values()];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    R.pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), z0: V.z, m: toMap(mid[0], mid[1]) };
    if (zoomLocked()) lockedNote();
  }
  function movePinch() {
    const [a, b] = [...R.ptrs.values()];
    if (!a || !b) return;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dist = Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1]));
    V.z = zoomLocked() ? R.pinch.z0 : clampZ(R.pinch.z0 * dist / R.pinch.d0); // held at the print scale: two fingers pan
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
    if (vh.classList.contains('cs-vm')) {
      pushUndo(); const a = it.pts[i], b = it.pts[(i + 1) % it.pts.length];
      it.pts.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); i += 1; save(); dirty();
    } else if (e.shiftKey) { removeVertex(it, st, i); return null; }
    const isNew = vh.classList.contains('cs-vm');
    let moved = false;
    return {
      move(ev) {
        if (!moved) { moved = true; if (!isNew) pushUndo(); }
        it.pts[i] = toMap(...local(ev)); dirty();
      },
      up(ev) {
        if (ev && (ev.pinch || ev.type === 'pointercancel')) { R.lastVTap = null; if (moved) save(); return; } // not a tap
        if (!moved && !isNew) { // double-tap a corner to remove it
          const now = performance.now(), lv = R.lastVTap;
          if (lv && lv.id === it.id && lv.i === i && now - lv.t < 400) { R.lastVTap = null; removeVertex(it, st, i); return; }
          R.lastVTap = { id: it.id, i, t: now };
        }
        save();
      },
    };
  }
  function removeVertex(it, st, i) {
    const min = st.kind === 'area' ? 3 : 2;
    if (it.pts.length > min) { pushUndo(); it.pts.splice(i, 1); save(); dirty(); }
    else toast(st.kind === 'area' ? 'An area needs at least 3 corners.' : 'A line needs at least 2 points.');
  }
  function onWheel(e) {
    if (!D.ready || e.target.closest('.cs-ui')) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    if (zoomLocked()) { // held at the print scale: the wheel pans (Shift+wheel sideways); a trackpad pinch (Ctrl) does nothing
      if (!e.ctrlKey) {
        let dx = e.deltaX * k, dy = e.deltaY * k;
        if (e.shiftKey && !dx) { dx = dy; dy = 0; }
        V.cx += dx / V.z; V.cy += dy / V.z; dirty();
      }
      lockedNote();
      return;
    }
    const f = Math.exp(-Math.max(-1, Math.min(1, e.deltaY * k * (e.ctrlKey ? 0.01 : 0.003))));
    zoomAt(...local(e), f);
  }
  // The top tabs show one plan at a time; an instance sits idle while another tab is showing.
  function offPlan() { return document.body.dataset.plan !== CFG.id; }
  const ROT_KEYS = { Minus: -1, NumpadSubtract: -1, Equal: 1, NumpadAdd: 1 }; // with Ctrl (Cmd) + Shift: a quarter turn
  function onKey(e) {
    if (R.exporting) return; // nothing changes while an export runs
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (!D.ready || offPlan()) return;
    if (e.key === 'Escape' && R.zwin) { R.zwin = null; dirty(); updateUi(); e.preventDefault(); return; } // the zoom window first
    if (e.key === 'Escape') {
      if (R.draft && R.mode === 'draw') R.draft = null;
      else if (R.mode === 'draw' || R.mode === 'cal') setMode('pan');
      else if (R.sel) R.sel = null;
      else return;
      dirty(); updateUi(); e.preventDefault();
    } else if (e.key === 'Enter' && R.draft && R.mode === 'draw') { finishDraft(); updateUi(); e.preventDefault(); }
    else if (e.key === 'Backspace' && R.draft && R.mode === 'draw') { R.draft.pts.pop(); if (!R.draft.pts.length) R.draft = null; dirty(); updateUi(); e.preventDefault(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && R.sel) { delSel(); updateUi(); e.preventDefault(); }
    // Rotate the page, with Bluebeam's and Acrobat's keys: Ctrl+Shift+Minus left, Ctrl+Shift+Plus right (Cmd on a Mac).
    // By physical key (e.code), so Shift turning = into + or - into _ does not matter; the number pad's - and + work too.
    // preventDefault keeps the browser from zooming the whole page on the same keys.
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && ROT_KEYS[e.code]) { rotatePage(ROT_KEYS[e.code]); e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { dupSel(); updateUi(); e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); updateUi(); e.preventDefault(); }
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
    if (!PLAN || !D.key || OV) return;
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

  // ---------- the Overlay tab: every other tab's markup on one drawing, to see how the plans sit together ----------
  // It draws nothing of its own. Each time it is shown it reads the other tabs' saved work, takes the drawing most of
  // them have open, opens that drawing here, and lays each tab's markup for it on top as one see-through layer
  // (40% to start). A tab on a different drawing, or with none, is listed and left out.
  const OV = CFG.overlay ? { tabs: [], key: null, opacity: 0.4, off: {} } : null;
  function overlayMarkup(exp) { // each tab's items on this page, drawn with that tab's own scale and symbol size; then this tab's own notes
    let out = '';
    const own = PLAN;
    R.ovOwn = own; // the label layout spans every shown tab and these notes
    for (const t of OV.tabs) {
      if (!t.plan || OV.off[t.id]) continue;
      PLAN = t.plan;
      try { const s = items().map((it) => drawItem(it, true)).join(''); if (s) out += `<g opacity="${OV.opacity}">${s}</g>`; }
      finally { PLAN = own; }
    }
    return out + items().map((it) => drawItem(it, exp)).join(''); // text labels and dimensions, at full strength
  }
  function overlayLegend() { // one heading per tab, with the symbols it has on this page
    const secs = OV.tabs.filter((t) => t.plan && !OV.off[t.id]).map((t) => {
      const on = t.plan.items.filter((i) => i.pg === D.page), used = new Set(on.map((i) => ZONE_SYM[i.sym] || i.sym));
      return withTailRow([{ title: t.label.toUpperCase(), rows: Object.keys(SYM).filter((id) => used.has(id)).map((id) => SYM[id]) }], withPlan(t.plan, () => mpu()) ? on : [])[0];
    }).filter((s) => s.rows.length);
    return secs.length ? secs : [{ title: 'LEGEND', rows: [] }];
  }
  function overlayPanel() {
    const n = (t) => (t.plan ? t.plan.items.filter((i) => i.pg === D.page).length : 0);
    const shown = OV.tabs.filter((t) => t.plan), left = OV.tabs.filter((t) => !t.plan);
    const head = !OV.key ? 'No drawing is open yet. Open one on any tab; every tab then shows it, and their markup shows together here.'
      : left.length ? `Showing the ${shown.length} tab${shown.length === 1 ? '' : 's'} with markup on ${D.name || 'this drawing'}.`
        : `All ${shown.length} tabs are on ${D.name || 'this drawing'}.`;
    R.legend.innerHTML = `<div class="cs-sec">OVERLAY</div><div class="cs-ov-note">${esc(head)}</div>` +
      OV.tabs.map((t) => `<label class="cs-ov-row${t.plan ? '' : ' cs-ov-out'}"><input type="checkbox" data-ov="${t.id}"${t.plan && !OV.off[t.id] ? ' checked' : ''}${t.plan ? '' : ' disabled'}>` +
        `<span><b>${esc(t.label)}</b><small>${esc(t.plan ? `${n(t)} item${n(t) === 1 ? '' : 's'} on this page` : t.other ? `on a different drawing: ${t.other}` : OV.key ? 'no markup on this drawing' : 'no drawing open')}</small></span></label>`).join('') +
      `<label class="cs-rng cs-ov-op"><span>Opacity of each tab's markup</span><input type="range" data-ov-op min="0.1" max="1" step="0.05" value="${OV.opacity}"><b>${Math.round(OV.opacity * 100)}%</b></label>` +
      '<div class="cs-ov-note">This tab shows the other tabs\' work; change that on its own tab. Text and Dimension, in the toolbar, add notes that belong to this tab. It refreshes each time you come back.</div>' +
      '<div class="cs-line cs-ov-btn"><button class="cs-btn" data-ov-refresh>Refresh</button></div>';
  }
  const ovFilled = (v) => !!String(v || '').trim();
  const ovFromTabs = (k) => { const t = OV.tabs.find((x) => x.plan && x.plan.info && ovFilled(x.plan.info[k])); return t ? t.plan.info[k] : null; };
  function migrateInfoOwn() { // an Overlay plan from before typed fields were kept: what differs from the tabs was typed here
    if (!OV || !PLAN || PLAN.infoOwn) return;
    const first = OV.tabs.find((t) => t.plan), fi = (first && first.plan.info) || {};
    PLAN.infoOwn = {};
    Object.keys(PLAN.info || {}).forEach((k) => { const v = PLAN.info[k]; if (ovFilled(v) && (k === 'title' ? v !== CFG.sheetTitle : v !== fi[k] && v !== ovFromTabs(k))) PLAN.infoOwn[k] = 1; });
  }
  async function overlayRefresh(opts) { // opts.adopt: after taking another window's save, which this does not write back
    const adopt = !!(opts && opts.adopt === true);
    if (R.exporting) { R.activatePending = true; return; } // during its own export: refreshed after it (sheets stay alike)
    await sharedLoad();
    const read = (c) => { try { const j = JSON.parse(localStorage.getItem(c.storeKey) || '{}'); return { cfg: c, plans: j.plans || {} }; } catch (e) { return { cfg: c, plans: {} }; } };
    const src = CFG.overlay.map(read), rec = csShared.rec, key = rec ? rec.key : null; // the drawing all the tabs share
    OV.key = key;
    OV.tabs = src.map((x) => ({ id: x.cfg.id, label: x.cfg.label, plan: englishPlan((key && x.plans[key]) || null), other: null }));
    if (!key) { if (D.ready) closeDoc(); updateSide(); fillInfo(); overlayPanel(); dirty(); return; }
    if (D.key !== key) await openFile({ name: rec.name, type: rec.type, data: rec.data, key: rec.key }, true);
    if (!D.ready || D.key !== key) { overlayPanel(); return; }
    const pg = Math.min(D.pages, Math.max(1, csShared.page));
    if (D.page !== pg || D.rot !== sharedRot(pg)) await showPage(pg, true);
    alignHere(); // the tabs' markup was just read afresh: round to this page's turn
    if (PLAN) { // the drawing scale and title block come from the tabs: the first one that has each
      const was = workOf(PLAN);
      // the drawing's scale is the shared one (a tab's stored copy can be older: it re-saves only when next shown);
      // a page it lacks takes the first tab's that has one. Each tab's cranes are sized by it, as on their own tabs.
      const pages = {}, sc = csShared.scales[key] || {};
      const set = (k) => sc[k] && (sc[k].mpu > 0 || sc[k].cleared); // a scale set or cleared there (a page only looked at is neither)
      Object.keys(sc).forEach((k) => { if (set(k)) pages[k] = { mpu: sc[k].mpu > 0 ? sc[k].mpu : null }; });
      OV.tabs.forEach((t) => t.plan && Object.keys(t.plan.pages || {}).forEach((k) => {
        if (set(k)) return;
        const c = t.plan.pages[k] || {};
        if (!pages[k]) pages[k] = { mpu: c.mpu || null }; else if (!pages[k].mpu && c.mpu) pages[k].mpu = c.mpu;
      }));
      PLAN.pages = pages;
      OV.tabs.forEach((t) => {
        if (!t.plan) return;
        t.plan.pages = JSON.parse(JSON.stringify(pages));
        (t.plan.items || []).forEach((it) => { const m = (pages[it.pg] || {}).mpu; if (m > 0 && it.spec && it.spec.jib > 0) it.r = it.spec.jib / m; });
      });
      // title block: a field typed on the Overlay stays (PLAN.infoOwn); each other field comes from the first tab that
      // has it filled in, and the sheet title is the Overlay's own
      const blank = newPlan(D.name).info, info = {};
      migrateInfoOwn();
      Object.keys(blank).forEach((k) => {
        if (PLAN.infoOwn[k] && ovFilled(PLAN.info[k])) info[k] = PLAN.info[k];
        else if (k === 'title') info[k] = CFG.sheetTitle;
        else { const v = ovFromTabs(k); info[k] = v != null ? v : k === 'by' || k === 'checked' ? '' : blank[k]; } // a field no tab has any more is emptied here too (names: not this window's remembered ones)
      });
      PLAN.info = info;
      if (!adopt && workOf(PLAN) !== was) save(); // unchanged: no write (two windows on the Overlay echoed each keystroke back)
    }
    fillInfo(); updateSide(); overlayPanel(); dirty();
  }

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
  function legendModel() { // only the symbols and hatches used on this page: a page with none prints the LEGEND heading alone
    if (OV) return overlayLegend();
    const used = new Set(items().map((i) => ZONE_SYM[i.sym] || i.sym)); // an area counts as its symbol
    const secs = SECTIONS.map((s) => ({ title: s.title, rows: s.items.filter((r) => used.has(r.id)) }))
      .filter((s, i) => i === 0 || s.rows.length);
    // symbols on the page that this tab's legend no longer lists (placed before they moved to another tab) still get a row
    const listed = new Set(SECTIONS.flatMap((s) => s.items.map((i) => i.id)));
    const other = [...used].filter((id) => SYM[id] && !listed.has(id)).map((id) => SYM[id]);
    if (other.length) secs.push({ title: 'OTHER', rows: other });
    return withTailRow(secs, mpu() ? items() : []); // no scale: no tail line is drawn, so no row
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
    const svg = noMarkup ? '' : withView(vv, () => (OV ? overlayMarkup(true) : items().map((it) => drawItem(it, true)).join('')));
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
    const data = { app: 'site-logistics', tab: CFG.id, version: 1, saved: new Date().toISOString(), drawing: { name: D.name, pages: D.pages }, plan: PLAN };
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
    const c = { id: uid(), sym: it.sym, pg: Math.max(1, Math.round(num(it.pg)) || 1), pts };
    if (it.sym === '_text') {
      c.text = cleanText(it.text, 120); if (!c.text) return null;
      if (/^#[0-9a-f]{6}$/i.test(String(it.color || '')) && it.color.toLowerCase() !== LABEL_INK) c.color = it.color.toLowerCase(); // its colour
      const rot = labelRot(it); if (rot) c.rot = rot; // its angle, whole degrees anticlockwise
      if (labelH(it) !== LABEL_H0) c.size = labelH(it); // its height, one of the standard ones
    }
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
    const otherTab = (j.tab || 'mobilization') !== CFG.id; // files saved before the tabs existed are Site Mobilization plans
    if (!(await csConfirm((otherTab ? `This plan file was saved from a different tab, not ${CFG.label}. ` : '') + (other ? `This plan was made on ${j.drawing.name}, and ${D.name} is open. ` : '') +
      'Replace the markup, scales and title block on this drawing with the ones in the file?'))) return;
    const fresh = newPlan(D.name), pages = {};
    Object.keys(p.pages || {}).filter((k) => /^[1-9]\d*$/.test(k)).forEach((k) => { const c = p.pages[k] || {}; pages[k] = num(c.mpu) > 0 ? { mpu: num(c.mpu) } : c.cleared ? { mpu: null, cleared: 1 } : { mpu: null }; }); // cleared in the file: cleared here too
    const rot = {}; // which way the file's items face, page by page: they are brought round to this drawing's pages below
    Object.keys(p.rot || {}).filter((k) => /^[1-9]\d*$/.test(k)).forEach((k) => { const r = Math.round(num(p.rot[k])); if (r >= 1 && r <= 3) rot[k] = r; });
    Object.assign(PLAN, {
      items: p.items.map(cleanItem).filter(Boolean), pages, rot, views: {}, fade: Math.min(0.85, Math.max(0, num(p.fade) || 0)),
      sheetScale: FIXED_SCALES.some((s) => s[0] === +p.sheetScale) ? +p.sheetScale : 'auto',
      symSize: SYM_SIZES.some((x) => x[0] === p.symSize) ? p.symSize : DEFAULT_SYM_SIZE,
      info: Object.keys(fresh.info).reduce((o, k) => ((o[k] = typeof (p.info || {})[k] === 'string' ? cleanText(p.info[k], 200) : fresh.info[k]), o), {}),
      checks: Object.keys(p.checks && typeof p.checks === 'object' ? p.checks : {}).filter((k) => p.checks[k] && /^[a-z0-9_-]{1,40}\.[a-z0-9]{1,13}$/i.test(k)).slice(0, 2000)
        .reduce((o, k) => ((o[k] = 1), o), {}), // the checklist ticks saved with the plan replace this drawing's
    });
    // On the Overlay, the file's filled-in title block fields are kept over the tabs'. Its sheet title is kept only when
    // it was typed on an Overlay (saved as such in the file); otherwise the Overlay's own title shows at once.
    if (OV) {
      const fileOwn = !otherTab && p.infoOwn && typeof p.infoOwn === 'object' ? p.infoOwn : null;
      if (!(fileOwn ? fileOwn.title : !otherTab && PLAN.info.title && PLAN.info.title !== CFG.sheetTitle)) PLAN.info.title = CFG.sheetTitle;
      // an Overlay file says which fields were typed on it (the rest follow the tabs, as then); from any other file,
      // every filled-in field is the file's
      if (!otherTab && !fileOwn) delete PLAN.infoOwn; // an Overlay file from before typed fields were kept: overlayRefresh works out which were
      else PLAN.infoOwn = Object.keys(PLAN.info).filter((k) => ovFilled(PLAN.info[k]) && (k === 'title' ? PLAN.info.title !== CFG.sheetTitle
        : !fileOwn || fileOwn[k] || PLAN.info[k] !== ovFromTabs(k))) // and what the tabs here do not say (a file handed to another computer)
        .reduce((o, k) => ((o[k] = 1), o), {});
    } else delete PLAN.infoOwn;
    alignHere(); syncCraneReach();
    R.undo = []; R.sel = null; save(); shareScale(); takeSharedScale(); fillInfo(); updateSide(); updateUi(); renderChecks(); dirty(); // a page the file has no scale for takes the drawing's at once
    if (OV && !offPlan()) overlayRefresh(); // the fields the file leaves blank come from the tabs
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
    const parts = withView(vv, () => {
      if (!OV) return items().flatMap((it) => annotParts(it, vv).map((a) => Object.assign(a, { id: it.id })));
      // the Overlay tab: every shown tab's items, each named for its tab and written at the overlay's opacity
      const own = PLAN, all = [];
      R.ovOwn = own; // the label layout spans every shown tab and these notes
      for (const t of OV.tabs) {
        if (!t.plan || OV.off[t.id]) continue;
        PLAN = t.plan;
        try { items().forEach((it) => annotParts(it, vv).forEach((a) => all.push(Object.assign(a, { id: it.id, subj: t.label + ' - ' + a.subj, layer: t.label, op: OV.opacity })))); }
        finally { PLAN = own; }
      }
      items().forEach((it) => annotParts(it, vv).forEach((a) => all.push(Object.assign(a, { id: it.id, layer: 'Notes and dimensions' })))); // this tab's own
      return all;
    });
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
      // see-through (Overlay): the picture carries it, and /CA and /FillOpacity tell Revu, which uses them when it redraws
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
    // PDF layers (optional content groups), as the Elevate template has them: Linear Markups, Equipment/Symbols, Crane
    // Radius, Building Outline; on the Overlay tab, one per tab. Revu and Acrobat can switch each on and off.
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
    const cur = D.page, keep = [V.cx, V.cy, V.z], pages = [], files = [], used = new Set();
    let failed = null;
    R.batch = true;
    try {
      for (let n = 1; n <= D.pages; n++) {
        busy(`Exporting ${kind.toUpperCase()}: ${D.set ? 'image' : 'page'} ${n} of ${D.pages}…`);
        await breathe(); // let the count show
        await loadPage(n, ++D.pageGen, false);
        D.page = n; alignHere();
        const v = PLAN.views && PLAN.views[String(n)];
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
    D.page = cur; V.cx = keep[0]; V.cy = keep[1]; V.z = keep[2];
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

  async function exportSheet(kind, all) {
    if (!D.ready) { toast('Open a drawing first.', 'err'); return; }
    if (R.exporting) return;
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
    const nav = zoomLocked() ? `Drag${COARSE ? '' : ' or scroll'} to pan; zoom is held at the print scale (the dashed outline).`
      : `Drag to pan; ${COARSE ? 'pinch' : 'scroll'} to zoom.`;
    if (R.mode === 'pan' && OV) return `${nav} Tick the tabs to show, and set their opacity, on the right.`;
    if (R.mode === 'pan') return `${nav} Pick a legend item to start placing.`;
    if (R.mode === 'select') return `${TAP} an item to select it. Drag it to move; drag a white corner to reshape; drag a blue dot to add a corner; ${COARSE ? 'double-tap' : 'Shift+click'} a corner to remove it. ${COARSE ? 'Delete removes the item, Duplicate copies it' : 'Delete removes the item, Ctrl+D copies it'}. Drag a crane's yellow handle to set the reach (double-${tap} the crane to type a value).`;
    const st = STYLE[R.tool], name = itemName(R.tool);
    let how;
    if (R.tool === '_text') how = `${TAP} where the label goes, then type it. Its colour, angle and height are set in the toolbar (select a label to change its own). ${snapNote(true)}`;
    else if (!st) how = `${TAP} the drawing to place it.`;
    else if (st.dim) {
      const n = R.draft ? R.draft.pts.length : 0;
      how = n === 2 ? `Now ${tap} where the dimension line should sit (on the measured line keeps it there).`
        : `${TAP} one end, then the other, then where the dimension line should sit. ${snapNote()}${COARSE ? '' : ' Hold Shift for a level, plumb or 45° dimension.'}`;
    }
    else if (st.kind === 'line') how = `${TAP} points along the route; double-${tap} or ${COARSE ? 'Finish' : 'Enter'} to finish${COARSE ? '' : ', Backspace removes a point'}.`;
    else how = R.shape === 'rect' ? `${TAP} two opposite corners.` : `${TAP} each corner; double-${tap} or ${COARSE ? 'Finish' : 'Enter'} to close.`;
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
  function arm(id) {
    if (!D.ready) { toast('Open a drawing first.', 'err'); return; }
    R.root.classList.remove('cs-mode-pan', 'cs-mode-select', 'cs-mode-cal'); R.root.classList.add('cs-mode-draw');
    R.mode = 'draw'; R.tool = id; R.draft = null; R.sel = null; R.lastTap = null; R.snap = null; R.hover = null; R.zwin = null; dirty(); updateUi(); // a tool picked: Selected ends
    if (aims() && snapOn()) ensureSnap();
  }
  function updateUi() {
    if (!R.root) return;
    if (COARSE || !(R.mode === 'draw' && craneKind(R.tool)) && !R.drag) craneNotesAt(null);
    const cn = R.root.querySelector('#cs-cn-on'); if (cn) cn.checked = !csNotes.off;
    const on = (el, f) => el.classList.toggle('cs-on', f);
    on(R.btn.pan, R.mode === 'pan'); on(R.btn.select, R.mode === 'select');
    on(R.btn.rect, R.shape === 'rect'); on(R.btn.poly, R.shape === 'poly'); on(R.btn.zwin, !!R.zwin);
    R.root.classList.toggle('cs-zwin', !!R.zwin);
    on(R.btn.text, R.mode === 'draw' && R.tool === '_text'); on(R.btn.dim, R.mode === 'draw' && R.tool === '_dim');
    on(R.calBtn, R.mode === 'cal'); on(R.btn.snap, snapOn());
    R.root.querySelectorAll('.cs-row').forEach((r) => r.classList.toggle('cs-active', R.mode === 'draw' && r.dataset.sym === R.tool));
    R.hintEl.textContent = hintText();
    const sel = R.mode === 'select' && R.sel && find(R.sel);
    const cr = sel && isCrane(sel.sym) ? sel : null;
    R.btn.pie.style.display = cr ? '' : 'none';
    R.btn.spec.style.display = cr ? '' : 'none'; R.btn.spec.classList.toggle('cs-on', !!(cr && R.specId === cr.id));
    syncSpec(cr);
    if (cr) R.btn.pie.textContent = cr.sweep && cr.sweep < 360 ? 'Crane: make circle' : 'Crane: make pie';
    // a text label's colour and angle: shown with the Text tool (for the next labels) or a label selected (for it)
    const lab = textTarget(), showT = !!lab || (R.mode === 'draw' && R.tool === '_text');
    R.btn.tstyle.style.display = showT ? '' : 'none';
    if (showT) {
      const col = lab ? labelColor(lab) : R.tcol || LABEL_INK, rot = lab ? labelRot(lab) : labelRot({ rot: R.trot });
      R.btn.tcol.querySelectorAll('[data-col]').forEach((sw) => sw.classList.toggle('cs-on', sw.dataset.col === col));
      const h = String(lab ? labelH(lab) : labelH({ size: R.tsize }));
      if (R.btn.tsize.value !== h) R.btn.tsize.value = h;
      if (document.activeElement !== R.btn.trot && R.btn.trot.value !== String(rot)) R.btn.trot.value = String(rot); // not while it is being typed in
    }
    const zone = sel && ZONE_OF[sel.sym];
    R.btn.mz.style.display = zone ? '' : 'none';
    if (zone) R.btn.mz.textContent = 'Draw ' + ZONE_NAME[zone].toLowerCase();
    const st = R.mode === 'draw' && STYLE[R.tool], n = R.draft ? R.draft.pts.length : 0;
    R.btn.finish.style.display = st && ((st.kind === 'line' && !st.dim && n >= 2) || (st.kind === 'area' && R.shape === 'poly' && n >= 3)) ? '' : 'none';
  }
  function updateSide() {
    if (!R.root) return;
    const has = D.ready;
    R.fname.textContent = has ? D.name : 'No drawing open.';
    R.fmeta.textContent = !has ? '' : D.kind === 'pdf' ? `PDF, ${D.pages} page${D.pages > 1 ? 's' : ''}` : D.set ? `${D.pages} image${D.pages > 1 ? 's' : ''}. This one: ${pageName(D.page)}, ${D.w} × ${D.h} px` : `Image, ${D.w} × ${D.h} px`;
    R.pagebox.style.display = has && D.pages > 1 ? '' : 'none';
    R.btn.scope.style.display = has && D.pages > 1 ? '' : 'none';
    if (has && D.pages > 1) {
      const listKey = D.key + '|' + D.pages; // the page list: numbers for a PDF, the image names for a set
      if (R.pageSel.dataset.k !== listKey) { R.pageSel.dataset.k = listKey; R.pageSel.innerHTML = Array.from({ length: D.pages }, (_, i) => `<option value="${i + 1}">${i + 1} of ${D.pages}${D.set ? ': ' + esc(pageName(i + 1)) : ''}</option>`).join(''); }
      R.pageSel.value = String(D.page);
      R.prevBtn.disabled = D.page <= 1; R.nextBtn.disabled = D.page >= D.pages;
    }
    R.scaleInfo.textContent = !has ? 'Open a drawing first.' : mpu() ? scaleText() : 'Not set. The scale bar, the legend scale and crane reach in metres need it.';
    R.calBtn.disabled = !has;
    R.ratioBtn.style.display = !has || D.kind === 'pdf' ? '' : 'none'; R.ratioBtn.disabled = !has;
    R.noScaleBtn.style.display = has && mpu() ? '' : 'none';
    R.fadeIn.disabled = R.rotL.disabled = R.rotR.disabled = R.btn.rotl.disabled = R.btn.rotr.disabled = R.savePlanBtn.disabled = R.loadPlanBtn.disabled = !has;
    R.rotV.textContent = !has || !D.rot ? 'as opened' : D.rot === 2 ? 'upside down' : D.rot === 1 ? 'a quarter turn right' : 'a quarter turn left';
    // The sheet scale is the scale the export prints at. It means nothing until the drawing itself has a scale (Drawing
    // Scale, above), so until then it is switched off and its note says what to do, rather than looking set.
    R.sheetSel.disabled = !has || !mpu();
    const sheetNote = R.sheetSel.nextElementSibling;
    if (!R.sheetNoteText) R.sheetNoteText = sheetNote.textContent;
    sheetNote.textContent = has && !mpu() ? 'Set the Drawing Scale above first (Calibrate, or Enter 1:N). That tells the tool how big the drawing really is; the sheet scale, the scale bar and crane reach in metres all need it. Until then the export is not to scale.' : R.sheetNoteText;
    sheetNote.classList.toggle('cs-warn', has && !mpu());
    R.sheetSel.value = has ? String(PLAN.sheetScale || 'auto') : 'auto';
    R.symSel.disabled = !has;
    R.symSel.value = symSize()[0];
    setSymNote(has ? sheetFrame() : null);
    const fade = has ? PLAN.fade || 0 : 0;
    R.fadeIn.value = fade; R.fadeV.textContent = Math.round(fade * 100) + '%';
  }
  // The Symbol size note: the ground height of a 36-unit symbol (0.36 in on paper at 1:S), and what it prints at on the
  // sheet scale in use (Auto's follows the view, so render() keeps it current).
  function setSymNote(fr) {
    if (!R.symNote) return;
    const z = symSize(), inch = z[2] / 100;
    const t = !fr || !PLAN ? 'Open a drawing first.'
      : `Symbols print ${inch} in (${Math.round(inch * 25.4)} mm) tall on the 11 x 17 sheet at every scale; smaller ones such as cones keep their proportion, down to ${(SYM_MIN * z[2] / 3600).toFixed(2)} in. On screen they show at the size they will have against the drawing on the sheet. Lines, areas and crane reach are not affected.`;
    if (R.symNote.textContent !== t) R.symNote.textContent = t;
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
    if (!on && R.activatePending) { R.activatePending = false; if (!offPlan()) (OV ? overlayRefresh : syncShared)(); }
  }
  function busy(msg) { if (!R.busy) return; R.busy.textContent = msg || ''; R.busy.style.display = msg ? 'block' : 'none'; }

  // The panel's legend rows for one section: a row per symbol to place, and after the cranes the Tail swing barricade
  // row, which is not placed by hand (it is drawn from a crane's spec), so clicking it explains instead of arming a tool
  const legendRows = (list) => {
    const last = list.reduce((k, i, n) => (isCrane(i.id) ? n : k), -1);
    return list.map((i, n) => `<div class="cs-row" data-sym="${i.id}"><div class="cs-sw">${swatch(i)}</div><div class="cs-lb">${esc(i.label)}</div></div>` +
      (n === last ? `<div class="cs-row cs-row-info" data-info="tail" title="Drawn from a crane's specification, not placed by hand"><div class="cs-sw">${swatch(TAIL_ROW)}</div><div class="cs-lb">${esc(TAIL_ROW.label)}<small>from the crane spec</small></div></div>` : '')).join('');
  };
  const swatch = (s) => `<svg viewBox="${(s.leg || s).vb}" preserveAspectRatio="xMidYMid meet">${(s.leg || s).inner}</svg>`; // `leg`: a legend row drawn differently from the placed symbol
  function build() {
    const root = CFG.root;
    root.innerHTML = `
      <div class="cs-grid">
        <div class="cs-map">
          <div class="cs-frame"></div>
          <div class="cs-page"><div class="cs-fade"></div></div>
          <svg class="cs-svg"><g id="cs-layer"></g></svg>
          <div class="cs-empty">
            <div class="cs-empty-t">Open a PDF or image of the site</div>
            <button class="cs-ui" data-open>Open PDF, images or .zip…</button>
            <button class="cs-ui" data-open-dir>Open a folder of images…</button>
            <div class="cs-empty-s">${COARSE ? '' : 'You can also drop a file or a folder here, or paste an image. '}The drawing shows on every tab; markup is kept in this browser, separately for each drawing and tab.</div>
          </div>
          <div class="cs-ui cs-tb">
            <div class="cs-btns">
              <button id="cs-b-pan" title="Pan and zoom the drawing">Pan</button>
              <button id="cs-b-select" title="Select and move items">Select</button>
              <span class="cs-sep"></span>
              <button id="cs-b-poly" title="Draw areas as polygons">Polygon</button>
              <button id="cs-b-rect" title="Draw areas as rectangles">Rect</button>
              <button id="cs-b-text" title="Place a text label: click where it goes, then type it. Double-click a label in Select mode to change it.">Text</button>
              <button id="cs-b-dim" title="Dimension: click the two ends, then where the dimension line should sit; the real length is written along it. Hold Shift for a level, plumb or 45° dimension.">Dimension</button>
              <button id="cs-b-check" style="display:none" title="Crane setup checklist: open or close the side bar of checks for every site and for the city in the site address">Checklist</button>
              <button id="cs-b-snap" title="Snap: Calibrate, Text and Dimension clicks jump to the drawing's line ends, crossings and middles. Click to turn it off or on.">Snap</button>
              <button id="cs-b-finish" class="cs-go" style="display:none" title="Finish the line or area (Enter)">Finish</button>
              <span class="cs-sep"></span>
              <button id="cs-b-undo" title="Undo (Ctrl+Z)">Undo</button>
              <button id="cs-b-dup" title="Copy the selected item (Ctrl+D)">Duplicate</button>
              <button id="cs-b-pie" style="display:none" title="Switch the selected crane between a full circle and a swing pie"></button>
              <button id="cs-b-spec" style="display:none" title="Crane specification: type the supplier's figures for the selected crane (jib, counter-jib, height, load chart). Double-clicking the crane opens it too.">Crane spec</button>
              <button id="cs-b-mz" style="display:none" title="Draw the area that goes with the selected symbol (rectangle or polygon, per the Polygon/Rect setting)">Draw area</button>
              <span id="cs-b-tstyle" class="cs-tstyle" style="display:none">
                <span id="cs-b-tcol" class="cs-acis" title="Text colour, AutoCAD's 9 standard colours: for the selected label, or the next labels placed with the Text tool">${LABEL_ACI.map(([n, hex, name]) => `<button type="button" class="cs-aci" data-col="${hex}" style="background:${hex}" title="${n} ${name}">${n}</button>`).join('')}</span>
                <button id="cs-b-trl" title="Turn the text 15° anticlockwise">⟲</button>
                <label title="Text angle in degrees, anticlockwise (0 = level). For the selected label, or the next labels placed with the Text tool."><input type="number" id="cs-b-trot" min="-180" max="180" step="1" value="0">°</label>
                <button id="cs-b-trr" title="Turn the text 15° clockwise">⟳</button>
                <select id="cs-b-tsize" title="Text height on the printed sheet (the height of the capitals, as in CAD): for the selected label, or the next labels placed with the Text tool">${LABEL_HEIGHTS.map(([h, name]) => `<option value="${h}">${name}</option>`).join('')}</select>
              </span>
              <button id="cs-b-del" title="Delete the selected item">Delete</button>
              <button id="cs-b-clear" title="Remove everything on this page">Clear</button>
              <span class="cs-sep"></span>
              <button id="cs-b-fit" title="Fit the whole page inside the print outline">Fit</button>
              <button id="cs-b-zwin" title="Zoom window, as in AutoCAD: drag a rectangle, or click two corners, and that area fills the print outline. Esc cancels.">Selected</button>
              <button id="cs-b-rotl" title="Rotate the page a quarter turn left (anticlockwise), on every tab; the markup turns with it. Ctrl+Shift+Minus (Cmd+Shift+Minus on a Mac), as in Bluebeam and Acrobat.">⟲ 90°</button>
              <button id="cs-b-rotr" title="Rotate the page a quarter turn right (clockwise), on every tab; the markup turns with it. Ctrl+Shift+Plus (Cmd+Shift+Plus on a Mac), as in Bluebeam and Acrobat.">⟳ 90°</button>
              <select id="cs-b-scope" style="display:none" title="What the two Export buttons save: every page of the drawing (a PDF with a page each, or a folder of images), or only the page showing. Each page prints the view it was left in; a page never opened prints whole.">
                <option value="all">All pages</option><option value="one">This page</option></select>
              <button id="cs-b-export" title="Save an 11 x 17 in sheet, with the legend and title block, as an image (200 dpi) in the format picked beside it. With All pages: one image per page, in a folder (or a .zip where the browser cannot write a folder).">Export image</button>
              <select id="cs-b-fmt" title="Image format for Export image">${IMG_FORMATS.map((f) => `<option value="${f[0]}">${f[1]}</option>`).join('')}</select>
              <button id="cs-b-pdf" title="Save an 11 x 17 in sheet as PDF (200 dpi). Each markup is a PDF annotation, so it can be selected and edited in Bluebeam Revu. With All pages: one PDF with a sheet for every page.">Export PDF</button>
              <span class="cs-group"><button id="cs-b-print" title="Save this page (only the page showing, whatever All pages says) as an 11 x 17 in sheet: the PDF, as Export PDF makes it, or the image, in the format picked beside Export image.">Print</button><select id="cs-b-pkind" title="What Print saves: the PDF sheet or the image of it"><option value="pdf">PDF</option><option value="image">Image</option></select></span>
            </div>
            <div class="cs-hint"></div>
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
        <div class="cs-legend">${SECTIONS.map((sec) => `<div class="cs-sec">${esc(sec.title)}</div>` + legendRows(sec.items)).join('')}</div>
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
          <h3>DRAWING SCALE</h3>
          <div class="cs-note cs-strong" id="cs-scaleinfo"></div>
          <div class="cs-line">
            <button class="cs-btn" id="cs-cal">Calibrate…</button>
            <button class="cs-btn" id="cs-ratio">Enter 1:N…</button>
            <button class="cs-btn" id="cs-noscale">Clear</button>
          </div>
          <div class="cs-note">Calibrate: pick two points a known distance apart, then type the distance (metres, or add ft). Enter 1:N works for a PDF drawn at full size, e.g. 1:200; 1/8" = 1'-0" is 1:96.</div>
          <h3>SHEET SCALE</h3>
          <select id="cs-sheetscale" title="Scale of the exported 11 x 17 sheet">
            <option value="auto">Auto: standard scale picked by Fit or Selected</option>
            ${FIXED_SCALES.map(([n, t]) => `<option value="${n}">${esc(t)}</option>`).join('')}
          </select>
          <div class="cs-note">The export prints at this scale, shown in the title block and on the scale bar. It prints what is inside the dashed outline on the drawing (the sheet's shape); outside it is shaded. The view is held at this scale, so the outline always fills the window: drag or scroll to move the drawing under it. On Auto, Fit picks the largest standard scale that shows the whole page, and Selected the one for a rectangle you drag.</div>
          <h3>SYMBOL SIZE</h3>
          <select id="cs-symsize" title="How tall symbols print on the sheet. It does not change with the drawing scale or the sheet scale.">
            ${SYM_SIZES.map(([n, t]) => `<option value="${n}">${esc(t)}</option>`).join('')}
          </select>
          <div class="cs-note" id="cs-symnote"></div>
          <h3>DISPLAY</h3>
          <label class="cs-rng"><span>Fade the drawing</span><input type="range" id="cs-fade" min="0" max="0.85" step="0.05" value="0"><b id="cs-fadev">0%</b></label>
          <div class="cs-line"><span>Rotate page</span>
            <button class="cs-btn" id="cs-rotl" title="Turn this page a quarter turn to the left. The markup on it turns with it, on every tab. Also in the toolbar (⟲ 90°), or Ctrl+Shift+Minus.">⟲ Left</button>
            <button class="cs-btn" id="cs-rotr" title="Turn this page a quarter turn to the right. The markup on it turns with it, on every tab. Also in the toolbar (⟳ 90°), or Ctrl+Shift+Plus.">⟳ Right</button></div>
          <div class="cs-note">This page is shown <b id="cs-rotv">as opened</b>. Turn it so the drawing reads the right way up; it prints the way it is shown.</div>
          ${craneNotesPanel()}
          <h3>SAVING</h3>
          <div class="cs-note">Markup saves automatically in this browser, separately for each drawing (by file name and size), and the last drawing reopens next time. Clearing the browser's data loses it, so save a plan file to keep or hand over the work.</div>
          <div class="cs-line">
            <button class="cs-btn" id="cs-saveplan" title="Save the markup, scales and title block of this drawing as a .json file">Save plan file</button>
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
    if (OV) { // the Overlay tab: no drawing tools; the right column lists the tabs instead of a legend
      root.classList.add('cs-overlay');
      let hide = false; // the left panel keeps the drawing, its scale, the sheet scale and the display settings
      [...root.querySelector('.cs-side').children].forEach((el) => {
        if (el.tagName === 'H3') hide = /^(SYMBOL SIZE|SAVING)$/.test(el.textContent.trim());
        if (hide || (el.classList.contains('cs-note') && /^Calibrate:/.test(el.textContent))) el.classList.add('cs-ov-hide');
      });
      root.querySelector('.cs-empty-t').textContent = 'Overlay of the other tabs';
      root.querySelector('.cs-empty-s').textContent = 'Open a PDF or image on any other tab. Every tab then shows it, and their markup shows here together, on that drawing.';
      R.legend.addEventListener('change', (e) => { const id = e.target.dataset.ov; if (id) { OV.off[id] = !e.target.checked; dirty(); } });
      R.legend.addEventListener('input', (e) => { if (e.target.dataset.ovOp === undefined) return; OV.opacity = +e.target.value; e.target.nextElementSibling.textContent = Math.round(OV.opacity * 100) + '%'; dirty(); });
      R.legend.addEventListener('click', (e) => { if (e.target.closest('[data-ov-refresh]')) overlayRefresh(); });
      overlayPanel();
    }
    const q = (s) => root.querySelector(s);
    R.map = q('.cs-map'); R.page = q('.cs-page'); R.frame = q('.cs-frame'); R.fade = q('.cs-fade');
    R.layer = q('#cs-layer'); R.hintEl = q('.cs-hint'); R.toast = q('.cs-toast'); R.busy = q('.cs-busy'); R.cnotes = q('.cs-cnotes'); R.checks = q('.cs-checks'); R.spec = q('.cs-spec'); R.ready = q('.cs-ready');
    R.sb = q('.cs-sb'); R.sbBar = q('.cs-sb .cs-bar'); R.sbLabel = q('.cs-sblabel'); R.scaleEl = q('#cs-scale');
    R.fname = q('#cs-fname'); R.fmeta = q('#cs-fmeta'); R.pagebox = q('#cs-pagebox'); R.pageSel = q('#cs-page'); R.prevBtn = q('#cs-prev'); R.nextBtn = q('#cs-next');
    R.scaleInfo = q('#cs-scaleinfo'); R.calBtn = q('#cs-cal'); R.ratioBtn = q('#cs-ratio'); R.noScaleBtn = q('#cs-noscale');
    R.fadeIn = q('#cs-fade'); R.fadeV = q('#cs-fadev'); R.rotL = q('#cs-rotl'); R.rotR = q('#cs-rotr'); R.rotV = q('#cs-rotv'); R.fileIn = q('#cs-file');
    R.notesEl = q('#cs-notes'); R.sheetSel = q('#cs-sheetscale'); R.planIn = q('#cs-planfile');
    R.symSel = q('#cs-symsize'); R.symNote = q('#cs-symnote');
    R.savePlanBtn = q('#cs-saveplan'); R.loadPlanBtn = q('#cs-loadplan');
    R.btn = {};
    ['pan', 'select', 'poly', 'rect', 'text', 'dim', 'check', 'snap', 'finish', 'undo', 'dup', 'pie', 'spec', 'mz', 'tstyle', 'tcol', 'trot', 'trl', 'trr', 'tsize','del', 'clear', 'fit', 'zwin', 'rotl', 'rotr', 'scope', 'export', 'fmt', 'pdf', 'print', 'pkind'].forEach((k) => (R.btn[k] = q('#cs-b-' + k)));

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
        if (OV) { // on the Overlay, a field typed here stays; emptied, it follows the tabs again
          migrateInfoOwn(); // an older Overlay plan: work out first which fields were typed before
          PLAN.infoOwn = Object.assign({}, PLAN.infoOwn);
          if (en.trim()) PLAN.infoOwn[inp.dataset.k] = 1; else delete PLAN.infoOwn[inp.dataset.k];
        }
        if (inp.dataset.k === 'address') { renderCraneNotes(); renderChecks(); }
        if (inp.dataset.k === 'by') store.by = inp.value;
        if (inp.dataset.k === 'checked') store.checked = inp.value;
        save();
      };
      inp.addEventListener('input', onInfo);
      if (OV) inp.addEventListener('change', () => { if (PLAN && !inp.value.trim() && !offPlan()) overlayRefresh(); }); // emptied: the tabs' value at once
      inp.addEventListener('compositionend', () => onInfo(null));
    });
    R.sheetSel.onchange = () => { if (!PLAN) return; PLAN.sheetScale = R.sheetSel.value === 'auto' ? 'auto' : +R.sheetSel.value; save(); dirty(); };
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
    B.text.onclick = () => (R.mode === 'draw' && R.tool === '_text' ? setMode('pan') : arm('_text'));
    B.dim.onclick = () => (R.mode === 'draw' && R.tool === '_dim' ? setMode('pan') : arm('_dim'));
    if (CK) {
      B.check.style.display = '';
      B.check.onclick = () => { store.checksOpen = !store.checksOpen; save(); renderChecks(); };
      R.checks.addEventListener('change', onCheckChange);
      R.checks.addEventListener('click', (e) => { if (e.target.closest('[data-ck-close]')) { store.checksOpen = false; save(); renderChecks(); } });
      ['wheel', 'pointerdown'].forEach((t) => R.checks.addEventListener(t, (e) => e.stopPropagation())); // scrolling the list is not zooming the drawing
    }
    B.snap.onclick = () => { csSnap.off = !csSnap.off; try { localStorage.setItem('siteLogistics.snapOff', csSnap.off ? '1' : ''); } catch (e) {} R.snap = null; if (snapOn() && aims()) ensureSnap(); dirty(); updateUi(); };
    B.finish.onclick = () => { finishDraft(); updateUi(); };
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
    B.mz.onclick = () => { const it = R.sel && find(R.sel), zone = it && ZONE_OF[it.sym]; if (zone) arm(zone); };
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
    root.querySelectorAll('.cs-row[data-sym]').forEach((row) => { row.onclick = () => (R.mode === 'draw' && R.tool === row.dataset.sym ? setMode('pan') : arm(row.dataset.sym)); });
    root.querySelectorAll('.cs-row[data-info="tail"]').forEach((row) => { row.onclick = () => toast('Tail swing barricade: drawn round a self-erecting crane, mobile crane or placing boom once its Crane spec has a tail radius. Select the crane and press Crane spec.'); });

    R.calBtn.onclick = () => { if (!D.ready) return; if (R.mode === 'cal') setMode('pan'); else { setMode('cal'); toast(`${TAP} the first point.`); } };
    R.ratioBtn.onclick = askRatio;
    R.noScaleBtn.onclick = async () => { if (!(await csConfirm('Clear the scale for this page?'))) return; pageCfg().mpu = null; pageCfg().cleared = 1; save(); shareScale(String(D.page)); updateSide(); dirty(); }; // cleared, as against never set
    R.pageSel.onchange = () => showPage(+R.pageSel.value, true).then(() => OV && overlayPanel());
    R.prevBtn.onclick = () => showPage(D.page - 1, true).then(() => OV && overlayPanel());
    R.nextBtn.onclick = () => showPage(D.page + 1, true).then(() => OV && overlayPanel());
    R.fadeIn.oninput = () => { if (!PLAN) return; PLAN.fade = +R.fadeIn.value; R.fadeV.textContent = Math.round(PLAN.fade * 100) + '%'; save(); dirty(); };
    const cnOn = q('#cs-cn-on');
    if (cnOn) {
      cnOn.checked = !csNotes.off;
      cnOn.onchange = () => { csNotes.off = !cnOn.checked; try { localStorage.setItem('siteLogistics.craneNotesOff', csNotes.off ? '1' : ''); } catch (e) {} craneNotesAt(null); };
    }
    R.rotL.onclick = R.btn.rotl.onclick = () => rotatePage(-1);
    R.rotR.onclick = R.btn.rotr.onclick = () => rotatePage(1);

    R.map.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    R.map.addEventListener('wheel', onWheel, { passive: false });
    R.map.addEventListener('contextmenu', (e) => { if (D.ready) e.preventDefault(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onShift); window.addEventListener('keyup', onShift);
    document.addEventListener('gesturestart', (e) => e.preventDefault()); // Safari: no page zoom while pinching the drawing

    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    window.addEventListener('dragover', (e) => { if (hasFiles(e) && !offPlan() && !OV) { e.preventDefault(); root.classList.add('cs-drop'); } });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) root.classList.remove('cs-drop'); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e) || offPlan() || OV) return;
      e.preventDefault(); root.classList.remove('cs-drop');
      const ens = [...(e.dataTransfer.items || [])].map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
      const fs = [...e.dataTransfer.files];
      if (ens.some((en) => en.isDirectory)) dropList(ens).then((r) => openFiles(r.list, r.folder), () => toast('Could not read that folder.', 'err'));
      else if (fs.length) openFiles(fs.map((file) => ({ file, path: file.name })), '');
    });
    window.addEventListener('paste', (e) => {
      const t = e.target; if (offPlan() || OV || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
      const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => /^image\/|\/pdf$/.test(x.type));
      if (f) { e.preventDefault(); openFile(f); }
    });

    const onResize = () => {
      const w = R.map.clientWidth, h = R.map.clientHeight;
      if (w === V.w && h === V.h) return;
      const held = D.ready && zoomLocked() && V.w && V.h && !R.exporting ? sheetFrame() : null; // the scale printing now
      V.w = w; V.h = h;
      R.tbInset = null; // the toolbar may wrap differently at the new width: measured again
      if (held) V.z = (printFrame().w * held.z) / MAP_IN.w; // the same scale in the new window (Auto would round afresh)
      if (R.needFit && D.ready && w && h) { R.needFit = false; restoreView(); }
      dirty();
    };
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
    activate: () => { if (R.zwin) { R.zwin = null; updateUi(); } return OV ? overlayRefresh() : syncShared(); }, // called each time the tab is shown
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
