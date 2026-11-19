/* The Material Logistics Plan tab's legend, drawn by hand. Loaded after the other symbol libraries.
 * Each entry is a symbol with a storage area: place the symbol, select it, then "Draw ... area" draws its region
 * (the same way an Emergency Muster Point gets its muster area). `zone` is the region's colour; app.js turns it into
 * the area style and shows it behind the symbol in the legend.
 * Colours are the Site Mobilization tab's (COL in app.js) wherever it has one: green, light blue (6' fencing), light grey
 * (Restroom Area), yellow, blue, red, magenta. Two it does not have are AutoCAD's: dark grey (colour 8, #808080) and the
 * brown of the lumber and soil pictures (colour 32, #a55200). "only" keeps these out of the other tabs. */
(() => {
  const GREEN = '#00f900', LBLUE = '#66ccff', DGREY = '#808080', LGREY = '#cccccc', YELLOW = '#fffb00', BLUE = '#0b33ff',
    RED = '#ff2500', MAGENTA = '#ff41fe', BROWN = '#a55200', K = '#000';
  const S = 'stroke="#000" stroke-linejoin="round"';
  const hex = (r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 3 * i + Math.PI / 6; return (18 + r * Math.cos(a)).toFixed(2) + ',' + (18 + r * Math.sin(a)).toFixed(2); }).join(' ');
  const drop = (x, y, k) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 -9C3.4 -4 6 -1.2 6 2.6A6 6 0 0 1 -6 2.6C-6 -1.2 -3.4 -4 0 -9Z" fill="${LBLUE}" ${S} stroke-width="${(1.1 / k).toFixed(2)}"/>`;

  const items = [
    { id: 'ml-lumber', label: 'Lumber', zone: GREEN, inner: // a 2x4 crossing over a 2x2, in a circle
      `<circle cx="18" cy="18" r="16.6" fill="#fff" stroke="${K}" stroke-width="1.5"/>` +
      `<rect x="5.5" y="16" width="25" height="4" transform="rotate(-45 18 18)" fill="${BROWN}" ${S} stroke-width="1"/>` +
      `<rect x="5.5" y="14" width="25" height="8" transform="rotate(45 18 18)" fill="${BROWN}" ${S} stroke-width="1"/>` +
      `<path d="M9 18H27" transform="rotate(45 18 18)" fill="none" stroke="${K}" stroke-width="0.6" stroke-opacity=".55"/>` },
    { id: 'ml-plumbing', label: 'Plumbing', zone: LBLUE, inner: // a straight pipe with a collar at each end
      `<rect x="6" y="13" width="24" height="10" fill="${LBLUE}" ${S} stroke-width="1.2"/>` +
      `<rect x="2.5" y="10" width="5" height="16" rx="1" fill="${DGREY}" ${S} stroke-width="1.2"/>` +
      `<rect x="28.5" y="10" width="5" height="16" rx="1" fill="${DGREY}" ${S} stroke-width="1.2"/>` +
      `<path d="M9.5 16H26.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>` },
    { id: 'ml-mixing', label: 'Concrete Mixing', zone: DGREY, inner: // the small tilting-drum mixer on its stand
      `<path d="M13 23L8 32.5M21 23L26 32.5M5 32.5H30" fill="none" stroke="${K}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<circle cx="27" cy="30.5" r="3.2" fill="${K}"/><circle cx="27" cy="30.5" r="1.2" fill="#fff"/>` +
      `<g transform="rotate(-28 17 15)"><path d="M8 8H24L28 15L24 22H8L5.5 15Z" fill="${DGREY}" ${S} stroke-width="1.3"/>` +
      `<path d="M12 8V22M19 8V22" fill="none" stroke="${K}" stroke-width="0.8"/><ellipse cx="27.6" cy="15" rx="1.8" ry="4.2" fill="${K}"/></g>` },
    { id: 'ml-materials', label: 'Concrete Materials', zone: LGREY, inner: // a pile of grey rock
      `<path d="M2 31L7 23L13 24L15 31Z" fill="${DGREY}" ${S} stroke-width="1.1"/>` +
      `<path d="M13 31L14 23.5L21 22L24 31Z" fill="${LGREY}" ${S} stroke-width="1.1"/>` +
      `<path d="M23 31L22 24L29 22.5L34 31Z" fill="${DGREY}" ${S} stroke-width="1.1"/>` +
      `<path d="M8 23L11 15.5L17 15L19 22.5L13 24Z" fill="${LGREY}" ${S} stroke-width="1.1"/>` +
      `<path d="M19 22.5L18 15.5L25 14L29 22.5L22 24Z" fill="${DGREY}" ${S} stroke-width="1.1"/>` +
      `<path d="M12.5 15.5L15 8L21 7L24.5 14L18 15.5Z" fill="${LGREY}" ${S} stroke-width="1.1"/>` },
    { id: 'ml-electrical', label: 'Electrical & Specialty', zone: YELLOW, inner: // a lightning bolt in a triangle
      `<path d="M18 3L34 32H2Z" fill="${YELLOW}" ${S} stroke-width="1.8"/>` +
      `<path d="M20.5 11.5L13 22.5H17.6L15.4 30L23.4 18.5H18.6Z" fill="${K}"/>` },
    { id: 'ml-equipment', label: 'Equipment Storage', zone: BLUE, inner: // a hammer crossed over a wrench
      `<g transform="rotate(-45 18 18)"><path d="M16.3 10H19.7V31.5A1.7 1.7 0 0 1 16.3 31.5Z" fill="${DGREY}" ${S} stroke-width="1"/>` +
      `<path d="M12.5 2.5V8A5.5 5.5 0 0 0 23.5 8V2.5H20.4V7.6H15.6V2.5Z" fill="${DGREY}" ${S} stroke-width="1"/></g>` +
      `<g transform="rotate(45 18 18)"><rect x="16.3" y="9" width="3.4" height="24" rx="1.2" fill="${BROWN}" ${S} stroke-width="1"/>` +
      `<path d="M10 3.5H24.5V9.5H13L10 7.5Z" fill="${K}"/></g>` },
    { id: 'ml-soil', label: 'Soil & Backfill Mound', zone: RED, inner: // three brown hexagons, one inside the next
      `<polygon points="${hex(16)}" fill="none" stroke="${BROWN}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<polygon points="${hex(10.5)}" fill="none" stroke="${BROWN}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<polygon points="${hex(5)}" fill="${BROWN}" stroke="${BROWN}" stroke-width="1" stroke-linejoin="round"/>` },
    { id: 'ml-wash', label: 'Wash Area', zone: MAGENTA, inner: drop(18, 12, 1.05) + drop(9.5, 25, 0.9) + drop(26.5, 25, 0.9) }, // three droplets
  ];
  items.forEach((i) => {
    Object.assign(i, { vb: '0 0 36 36', w: 36, h: 36 });
    // the legend row: the symbol on a block of its area's colour, drawn as the area is on the plan
    i.leg = { vb: '0 0 112 26', inner: `<rect x="1.5" y="1.5" width="109" height="23" fill="${i.zone}" fill-opacity=".4" stroke="${i.zone}" stroke-width="2.2" stroke-dasharray="9 5"/>` +
      `<svg x="44.5" y="1.5" width="23" height="23" viewBox="0 0 36 36">${i.inner}</svg>` };
  });
  window.__CS_SYMBOLS = (window.__CS_SYMBOLS || []).concat([{ title: 'LEGEND', only: 'material', items }]);
})();
