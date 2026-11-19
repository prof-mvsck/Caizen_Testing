/* The top tabs. Each is one instance of the app (createSitePlan in app.js): the same tool, with its own legend and its
 * own saved drawing and markup. To change a tab's symbols, edit its `sections` here: each is a legend heading and the ids
 * of the symbols under it, in order, picked from the libraries (symbols.js, symbols_tc.js, symbols_extra.js, symbols_safety.js, symbols_material.js, symbols_more.js).
 * No `sections` means every symbol, less the sections named in `omit`. The first heading always prints on the exported legend.
 *
 * Site Mobilization keeps the storage keys the tool had before the tabs, so work saved earlier is still there. */
(() => {
  'use strict';
  const PLANS = [
    {
      id: 'mobilization', label: 'Site Mobilization', sheetTitle: 'SITE LOGISTICS PLAN', slug: 'site-logistics',
      storeKey: 'siteLogistics.v1', fileKey: 'last',
      omit: ['TRAFFIC CONTROL'], // every library section but this one, which has its own tab
    },
    {
      id: 'safety', label: 'Site Safety', sheetTitle: 'SITE SAFETY PLAN', slug: 'site-safety',
      storeKey: 'siteLogistics.v1.safety', fileKey: 'last.safety',
      // The legend of the Site Safety Plan PDF (symbols_safety.js, written by tools/build_safety.py), in its order,
      // then Covered Walkways and Temporary Crosswalk. Recoloured to the Site Mobilization tab's colours.
      sections: [
        { title: 'LEGEND', ids: ['ss-muster', 'ss-hydrant', 'ss-office', 'ss-firstaid', 'ss-extinguisher', 'ss-airhorn', 'ss-washrooms', 'ss-gate', 'ss-fence', 'ss-stairs', 'ss-noparking', 'ss-power', 'ss-excavation', 'ss-tcp', 'ss-dep', 'ss-crane', 'ss-covered-walk', 'ss-walk-lights', 'ss-crosswalk',
          'ss-lunch', 'ss-smoking', 'ss-flammable', 'ss-camera', 'ss-water'] }, // the last five and the walkway with lights: symbols_safety_extra.js
      ],
    },
    {
      id: 'material', label: 'Material Logistics Plan', sheetTitle: 'MATERIAL LOGISTICS PLAN', slug: 'material-logistics',
      storeKey: 'siteLogistics.v1.material', fileKey: 'last.material',
      // Material storage (symbols_material.js): each is a symbol with an area drawn from it, like a muster point.
      sections: [
        { title: 'LEGEND', ids: ['ml-lumber', 'ml-plumbing', 'ml-mixing', 'ml-materials', 'ml-electrical', 'ml-equipment', 'ml-soil', 'ml-wash'] },
      ],
    },
    {
      id: 'traffic', label: 'Traffic Control', sheetTitle: 'TRAFFIC CONTROL PLAN', slug: 'traffic-control',
      storeKey: 'siteLogistics.v1.traffic', fileKey: 'last.traffic',
      // The traffic-control library (symbols_tc.js), which used to be the last section of Site Mobilization.
      sections: [
        { title: 'TRAFFIC CONTROL', ids: ['drum', 'tubular', 'cone', 'sign', 'truck-w', 'barricade', 'attenuator', 'flashlight', 'signal', 'fab', 'fab-caution', 'dms'] },
      ],
    },
    {
      id: 'wayfinding', label: 'Wayfinding', sheetTitle: 'WAYFINDING SIGNAGE PLAN', slug: 'wayfinding',
      storeKey: 'siteLogistics.v1.wayfinding', fileKey: 'last.wayfinding',
      // The book's General Signage plan: sign boards and routes that tell people where to go (symbols_more.js).
      sections: [
        { title: 'WAYFINDING', ids: ['wf-route', 'wf-gate', 'wf-office', 'wf-delivery', 'wf-parking', 'wf-ppe', 'wf-hoist', 'wf-washroom', 'wf-lunch', 'wf-firstaid', 'wf-muster', 'wf-noentry', 'wf-right', 'wf-left', 'wf-up', 'wf-down'] },
      ],
    },
  ];

  // The Overlay tab shows the other tabs' markup together on the drawing they share; it has no legend of its own.
  PLANS.push({
    id: 'overlay', label: 'Overlay', sheetTitle: 'OVERLAY PLAN', slug: 'overlay',
    storeKey: 'siteLogistics.v1.overlay', fileKey: 'last.overlay', sections: [],
    overlay: PLANS.map(({ id, label, storeKey, fileKey }) => ({ id, label, storeKey, fileKey })),
  });

  const TAB_KEY = 'siteLogistics.tab';
  const nav = document.querySelector('.cs-plans');
  const apps = {}; // id -> the running instance, started the first time its tab is shown
  const tabs = PLANS.map((cfg, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'cs-plan-' + cfg.id; b.textContent = cfg.label; b.dataset.plan = cfg.id;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'cs-root-' + cfg.id);
    nav.appendChild(b);
    const root = document.createElement('div');
    root.id = 'cs-root-' + cfg.id; root.className = 'cs-root cs-mode-pan'; root.dataset.tab = 'legend';
    root.setAttribute('role', 'tabpanel'); root.setAttribute('aria-labelledby', b.id);
    root.inert = true;
    document.body.appendChild(root);
    cfg.root = root;
    b.addEventListener('click', () => show(cfg.id));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      show(PLANS[(i + d + PLANS.length) % PLANS.length].id, true);
    });
    return b;
  });

  // A tab that is not showing stays laid out underneath (inert and invisible), so its drawing keeps its size and view.
  function show(id, focus) {
    const cfg = PLANS.find((p) => p.id === id) || PLANS[0];
    document.body.dataset.plan = cfg.id;
    PLANS.forEach((p, i) => {
      const on = p === cfg;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].tabIndex = on ? 0 : -1;
      if (on && focus) tabs[i].focus();
      p.root.inert = !on;
    });
    if (!apps[cfg.id]) apps[cfg.id] = createSitePlan(cfg);
    if (apps[cfg.id].activate) apps[cfg.id].activate();
    document.title = cfg.label + ' - Site Logistics';
    try { localStorage.setItem(TAB_KEY, cfg.id); } catch (e) { /* the tab just won't be remembered */ }
  }

  let first = PLANS[0].id;
  try { first = localStorage.getItem(TAB_KEY) || first; } catch (e) { /* storage blocked */ }
  show(first);
  window.__siteLogisticsPlans = apps;
  Object.defineProperty(window, '__siteLogistics', { get: () => apps[document.body.dataset.plan] }); // the tab showing
})();
