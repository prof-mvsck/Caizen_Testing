/* More hand-drawn legend entries. Loaded after symbols_extra.js.
 * Site Mobilization (they go into its existing sections, so that tab picks them up by itself):
 * - Slick Line: the concrete pump's pipe run, a grey line with pipe joints. A line; app.js draws it (STYLE 'slick-line').
 * - Forklift Staging: where forklifts park between lifts, an orange cross-hatched area (STYLE 'forklift-staging').
 * - Placing Boom: a fixed concrete placing boom, in EQUIPMENT after the pump truck. It has a reach circle like the cranes.
 * - Site Trailer: a black rectangle at its real size, typed in (STYLE 'site-trailer'), after Trade Partner Trailers Area.
 * Wayfinding tab ("only" keeps these off the other tabs; plans.js lists them):
 * - sign boards that say where things are, as the book's General Signage plan asks: blue for information, green for
 *   first aid and muster, red for no entry; four direction arrows; and a Wayfinding Route line (STYLE 'wf-route').
 * Colours are the Site Mobilization tab's (COL in app.js) plus the dark grey and orange already in use. */
(() => {
  const S = window.__CS_SYMBOLS || (window.__CS_SYMBOLS = []);
  const Y = '#fffb00', DGREY = '#808080', ORANGE = '#f7941d', BLUE = '#0b33ff', GREEN = '#00f900', RED = '#ff2500', K = '#000';

  const legend = S.find((s) => s.title === 'LEGEND' && !s.only);
  if (legend && !legend.items.some((i) => i.id === 'slick-line')) {
    const joints = [18, 34, 50, 66, 82].map((x) => `M${x} 2V14`).join('');
    legend.items.push(
      { id: 'slick-line', label: 'Slick Line (concrete pump pipe)', vb: '0 0 100 16', w: 100, h: 16,
        inner: `<path d="M2 8H98" fill="none" stroke="${DGREY}" stroke-width="4"/><path d="${joints}" fill="none" stroke="${DGREY}" stroke-width="2.4"/>` },
      { id: 'forklift-staging', label: 'Forklift Staging', vb: '0 0 112 26', w: 112, h: 26,
        inner: `<defs><pattern id="sw-fork-x" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M0 0L6 6M6 0L0 6" stroke="${ORANGE}" stroke-width="1" fill="none"/></pattern></defs>` +
          `<rect x="1.5" y="1.5" width="109" height="23" fill="url(#sw-fork-x)" stroke="${ORANGE}" stroke-width="2"/>` });
  }
  // Site Trailer (2026-11-19): a black rectangle drawn at its real size (STYLE 'site-trailer' in app.js), after the
  // Trade Partner Trailers Area
  if (legend && !legend.items.some((i) => i.id === 'site-trailer')) {
    const at = legend.items.findIndex((i) => i.id === 'trailers');
    legend.items.splice(at >= 0 ? at + 1 : legend.items.length, 0,
      { id: 'site-trailer', label: 'Site Trailer', vb: '0 0 112 26', w: 112, h: 26, inner: `<rect x="6" y="5" width="100" height="16" fill="${K}"/>` });
  }
  const eq = S.find((s) => s.title === 'EQUIPMENT');
  if (eq && !eq.items.some((i) => i.id === 'placing-boom')) {
    const at = eq.items.findIndex((i) => i.id === 'pump');
    eq.items.splice(at >= 0 ? at + 1 : eq.items.length, 0, {
      id: 'placing-boom', label: 'Placing Boom', vb: '0 0 36.2 36.2', w: 36.2, h: 36.2,
      inner: `<circle cx="18.1" cy="18.1" r="17" fill="${Y}" stroke="${Y}" stroke-width="0.2"/>` +
        '<rect x="9.2" y="27" width="9" height="2.6"/><rect x="12.4" y="12" width="2.6" height="15.4"/>' +          // base and mast
        '<path d="M13.7 12.6L22.6 7.2L29.4 12.4" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + // boom, two sections
        '<circle cx="13.7" cy="12.6" r="1.9"/><circle cx="22.6" cy="7.2" r="1.5"/>' +                              // slewing ring and elbow
        '<path d="M29.4 12.4V22.5" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>' +        // drop hose
        '<path d="M27.2 25.4C27.2 24 29.4 23.6 29.4 22.2C29.4 23.6 31.6 24 31.6 25.4A2.2 2.2 0 0 1 27.2 25.4Z"/>', // concrete
    });
  }

  // Wayfinding sign boards
  const board = (fill, ink, text) => {
    const size = Math.min(13, 52 / (0.78 * text.length)); // bold capitals run about 0.72 of their height wide
    return `<rect x="1" y="1" width="62" height="28" rx="3" fill="${fill}" stroke="${K}" stroke-width="1.2"/>` +
      `<text x="32" y="15" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${size.toFixed(1)}" fill="${ink}">${text}</text>`;
  };
  const arrow = (deg) => `<rect x="1" y="1" width="28" height="28" rx="3" fill="${BLUE}" stroke="${K}" stroke-width="1.2"/>` +
    `<path transform="rotate(${deg} 15 15)" d="M5 13H17V8.5L25.5 15L17 21.5V17H5Z" fill="#fff"/>`;
  const sign = (id, label, fill, ink, text) => ({ id, label, vb: '0 0 64 30', w: 64, h: 30, inner: board(fill, ink, text) });
  const arr = (id, label, deg) => ({ id, label, vb: '0 0 30 30', w: 30, h: 30, inner: arrow(deg) });
  S.push({ title: 'WAYFINDING', only: 'wayfinding', items: [
    { id: 'wf-route', label: 'Wayfinding Route', vb: '0 0 100 16', w: 100, h: 16,
      inner: `<path d="M2 8H84" fill="none" stroke="${BLUE}" stroke-width="3" stroke-dasharray="9 6"/><path d="M98 8L84 15V1Z" fill="${BLUE}"/>` },
    sign('wf-gate', 'Sign: Gate / Site Entrance', BLUE, '#fff', 'GATE'),
    sign('wf-office', 'Sign: Site Office / Check-In', BLUE, '#fff', 'OFFICE'),
    sign('wf-delivery', 'Sign: Deliveries', BLUE, '#fff', 'DELIVERIES'),
    sign('wf-parking', 'Sign: Parking', BLUE, '#fff', 'PARKING'),
    sign('wf-ppe', 'Sign: PPE Required', BLUE, '#fff', 'PPE REQUIRED'),
    sign('wf-hoist', 'Sign: Hoist', BLUE, '#fff', 'HOIST'),
    sign('wf-washroom', 'Sign: Washrooms', BLUE, '#fff', 'WASHROOMS'),
    sign('wf-lunch', 'Sign: Lunch Area', BLUE, '#fff', 'LUNCH AREA'),
    sign('wf-firstaid', 'Sign: First Aid', GREEN, K, 'FIRST AID'),
    sign('wf-muster', 'Sign: Muster Point', GREEN, K, 'MUSTER POINT'),
    sign('wf-noentry', 'Sign: No Entry', RED, '#fff', 'NO ENTRY'),
    arr('wf-right', 'Direction Arrow: right', 0), arr('wf-left', 'Direction Arrow: left', 180),
    arr('wf-up', 'Direction Arrow: up', -90), arr('wf-down', 'Direction Arrow: down', 90),
  ] });
})();
