/* Site Safety legend entries drawn by hand, added to the ones cropped from the Site Safety Plan PDF (symbols_safety.js).
 * Loaded after it. plans.js lists them for the Site Safety tab; "only" keeps them out of the others.
 * - Lunch Area: a lunchbox on a yellow square.      - Smoking Area: a cigarette on a grey square.
 * - Flammable Storage: a flame on an orange circle. - Camera Location: a camera sign.
 * - Temp Water: a water droplet.
 * Each is a fixed-size marker placed with one click, like the other symbols; none has a drawn region.
 * - Covered Walkway w/ Temp Lights: a line, drawn the way the Elevate toolbox draws it (Bluebeam's "Tracks" line
 *   style: two rails with cross ties). app.js draws it (STYLE 'ss-walk-lights'); only its legend swatch is here.
 * Colours are the Site Mobilization tab's (COL in app.js) plus the two AutoCAD ones already in use: dark grey #808080
 * and the traffic-control orange #f7941d. */
(() => {
  const YELLOW = '#fffb00', LGREY = '#cccccc', DGREY = '#808080', ORANGE = '#f7941d', LBLUE = '#66ccff', K = '#000';
  const S = 'stroke="#000" stroke-linejoin="round"';
  const tile = (fill) => `<rect x="1" y="1" width="34" height="34" rx="2.5" fill="${fill}" ${S} stroke-width="1.5"/>`;
  const items = [
    { id: 'ss-lunch', label: 'Lunch Area', inner: tile(YELLOW) + // a lunchbox: body, lid line, handle, latch
      `<path d="M13.5 13V10.8A2.3 2.3 0 0 1 15.8 8.5H20.2A2.3 2.3 0 0 1 22.5 10.8V13" fill="none" stroke="${K}" stroke-width="1.8"/>` +
      `<rect x="7" y="13" width="22" height="15" rx="2" fill="#fff" ${S} stroke-width="1.6"/>` +
      `<path d="M7 18.5H29" fill="none" stroke="${K}" stroke-width="1.4"/><rect x="16" y="16.6" width="4" height="3.8" rx="0.8" fill="${K}"/>` },
    { id: 'ss-smoking', label: 'Smoking Area', inner: tile(LGREY) + // a cigarette with smoke
      `<rect x="6" y="21" width="19" height="5" fill="#fff" ${S} stroke-width="1.3"/><rect x="25" y="21" width="5" height="5" fill="${DGREY}" ${S} stroke-width="1.3"/>` +
      `<path d="M27.5 17.5C27.5 14.5 23 15.5 23 12.5C23 10.5 25 9.8 25 8M21.5 17.5C21.5 15.8 19 15.8 19 13.5" fill="none" stroke="${K}" stroke-width="1.5" stroke-linecap="round"/>` },
    { id: 'ss-flammable', label: 'Flammable Storage', inner: // a flame on an orange circle
      `<circle cx="18" cy="18" r="16.6" fill="${ORANGE}" stroke="${K}" stroke-width="1.5"/>` +
      `<path d="M18.5 6C19.5 11 25.5 13.5 25.5 20.5A7.5 7.5 0 0 1 10.5 20.5C10.5 17.5 12 15.5 13.5 14C13.8 16 14.8 17 16 17.5C15.5 13 17 9 18.5 6Z" fill="${K}"/>` +
      `<path d="M18 19.5C19.3 21.5 21 22.3 21 24.5A3 3 0 0 1 15 24.5C15 22.5 17 21.8 18 19.5Z" fill="${ORANGE}"/>` },
    { id: 'ss-camera', label: 'Camera Location', inner: tile('#fff') + // a security camera on its bracket
      `<path d="M6 14.5L22.5 9.5L25.5 17L9 22Z" fill="${K}"/><path d="M22.5 9.5L26 8.5L29 16L25.5 17Z" fill="${DGREY}" ${S} stroke-width="1"/>` +
      `<path d="M14 20.5V27.5H7M7 24V31" fill="none" stroke="${K}" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="27.5" cy="12.5" r="1.1" fill="#fff"/>` },
    { id: 'ss-water', label: 'Temp Water', inner: // one water droplet
      `<path d="M18 3C24 11 29 15.5 29 22A11 11 0 0 1 7 22C7 15.5 12 11 18 3Z" fill="${LBLUE}" ${S} stroke-width="1.6"/>` +
      `<path d="M12.5 22.5A5.5 5.5 0 0 0 17 27.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>` },
  ];
  items.forEach((i) => Object.assign(i, { vb: '0 0 36 36', w: 36, h: 36 }));
  const ties = Array.from({ length: 9 }, (_, i) => `M${10 + i * 10} 3V19`).join('');
  items.push({ id: 'ss-walk-lights', label: 'Covered Walkway w/ Temp Lights', vb: '0 0 100 22', w: 100, h: 22,
    inner: `<path d="M2 5H98M2 17H98${ties}" fill="none" stroke="${DGREY}" stroke-width="2.4"/>` });
  window.__CS_SYMBOLS = (window.__CS_SYMBOLS || []).concat([{ title: 'LEGEND', only: 'safety', items }]);
})();
