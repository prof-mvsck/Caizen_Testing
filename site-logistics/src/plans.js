/* The layers. The tool is one view of the drawing (createSitePlan in app.js); each discipline is a layer of it, listed
 * in the legend with its own symbols, a visibility toggle and an opacity, and every layer shows at once on the drawing
 * (user, 2026-11-19: "the tabs are going to the legend to work like layers ... Overlay is not a separate tab, but rather
 * a constant state"). Before that, each was a tab of its own with its own saved work: `legacy` names where each tab
 * kept it, so a drawing opened for the first time since is put together from all of them (app.js, legacyPlan).
 *
 * To change a layer's symbols, edit its `sections` here: each is a legend heading and the ids of the symbols under it,
 * in order, picked from the libraries (symbols.js, symbols_tc.js, symbols_extra.js, symbols_safety.js,
 * symbols_material.js, symbols_more.js). No `sections` means every symbol, less the sections named in `omit`.
 * Layers draw in this order, the last on top. `notes` holds the text labels and dimensions. */
(() => {
  'use strict';
  const LAYERS = [
    {
      id: 'mobilization', label: 'Site Mobilization', sheetTitle: 'SITE LOGISTICS PLAN',
      omit: ['TRAFFIC CONTROL'], // every library section but this one, which is a layer of its own
    },
    {
      id: 'safety', label: 'Site Safety', sheetTitle: 'SITE SAFETY PLAN',
      // The legend of the Site Safety Plan PDF (symbols_safety.js, written by tools/build_safety.py), in its order,
      // then Covered Walkways and Temporary Crosswalk. Recoloured to the Site Mobilization layer's colours.
      sections: [
        { title: 'LEGEND', ids: ['ss-muster', 'ss-hydrant', 'ss-office', 'ss-firstaid', 'ss-extinguisher', 'ss-airhorn', 'ss-washrooms', 'ss-gate', 'ss-fence', 'ss-stairs', 'ss-noparking', 'ss-power', 'ss-excavation', 'ss-tcp', 'ss-dep', 'ss-crane', 'ss-covered-walk', 'ss-walk-lights', 'ss-crosswalk',
          'ss-lunch', 'ss-smoking', 'ss-flammable', 'ss-camera', 'ss-water'] }, // the last five and the walkway with lights: symbols_safety_extra.js
      ],
    },
    {
      id: 'material', label: 'Material Logistics Plan', sheetTitle: 'MATERIAL LOGISTICS PLAN',
      // Material storage (symbols_material.js): each is a symbol with an area drawn from it, like a muster point.
      sections: [
        { title: 'LEGEND', ids: ['ml-lumber', 'ml-plumbing', 'ml-mixing', 'ml-materials', 'ml-electrical', 'ml-equipment', 'ml-soil', 'ml-wash'] },
      ],
    },
    {
      id: 'traffic', label: 'Traffic Control', sheetTitle: 'TRAFFIC CONTROL PLAN',
      // The traffic-control library (symbols_tc.js), which used to be the last section of Site Mobilization.
      sections: [
        { title: 'TRAFFIC CONTROL', ids: ['drum', 'tubular', 'cone', 'sign', 'truck-w', 'barricade', 'attenuator', 'flashlight', 'signal', 'fab', 'fab-caution', 'dms'] },
      ],
    },
    {
      id: 'wayfinding', label: 'Wayfinding', sheetTitle: 'WAYFINDING SIGNAGE PLAN',
      // The book's General Signage plan: sign boards and routes that tell people where to go (symbols_more.js).
      sections: [
        { title: 'WAYFINDING', ids: ['wf-route', 'wf-gate', 'wf-office', 'wf-delivery', 'wf-parking', 'wf-ppe', 'wf-hoist', 'wf-washroom', 'wf-lunch', 'wf-firstaid', 'wf-muster', 'wf-noentry', 'wf-right', 'wf-left', 'wf-up', 'wf-down'] },
      ],
    },
    // Text labels and dimensions (the Text and Dimension tools), which the Overlay tab used to hold
    { id: 'notes', label: 'Notes', notes: true },
  ];

  const cfg = {
    id: 'site', label: 'Site Logistics', sheetTitle: 'SITE LOGISTICS PLAN', slug: 'site-logistics',
    storeKey: 'siteLogistics.v2', fileKey: 'last', layers: LAYERS,
    // where each tab kept its work before the layers (and the Overlay tab its text labels and dimensions)
    legacy: { mobilization: 'siteLogistics.v1', safety: 'siteLogistics.v1.safety', material: 'siteLogistics.v1.material',
      traffic: 'siteLogistics.v1.traffic', wayfinding: 'siteLogistics.v1.wayfinding', notes: 'siteLogistics.v1.overlay' },
  };
  const root = document.createElement('div');
  root.id = 'cs-root-site'; root.className = 'cs-root cs-mode-pan'; root.dataset.tab = 'legend';
  document.body.appendChild(root);
  cfg.root = root;
  document.body.dataset.plan = cfg.id; // the one view showing (offPlan in app.js)
  const app = createSitePlan(cfg);
  window.__siteLogisticsPlans = { site: app };
  window.__siteLogistics = app;
  if (app.activate) app.activate();
})();
