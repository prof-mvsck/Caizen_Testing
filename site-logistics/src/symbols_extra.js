/* Legend entries added by hand, not taken from the legend PDF. Loaded after symbols.js and symbols_tc.js.
 * Edit this file rather than symbols.js, which is generated from the legend PDF.
 * - "Crane w/ radius" (id crane) is shown as "Tower crane".
 * - "Mobile crane" (id mobile-crane) follows it in EQUIPMENT and works the same way: a reach circle in metres
 *   (30 m to start), which can be turned into a swing pie. Drawn in the style of the other equipment symbols. */
(() => {
  const S = window.__CS_SYMBOLS || (window.__CS_SYMBOLS = []);
  const eq = S.find((s) => s.title === 'EQUIPMENT');
  if (!eq) return;
  const at = eq.items.findIndex((i) => i.id === 'crane');
  if (at >= 0) eq.items[at] = Object.assign({}, eq.items[at], { label: 'Tower crane' });
  if (eq.items.some((i) => i.id === 'mobile-crane')) return;
  const Y = '#fffb00'; // the legend's equipment yellow
  const wheel = (x) => `<circle cx="${x}" cy="23.3" r="2.35"/><circle cx="${x}" cy="23.3" r="1.25" fill="${Y}"/><circle cx="${x}" cy="23.3" r="0.6"/>`;
  eq.items.splice(at + 1, 0, {
    id: 'mobile-crane', label: 'Mobile crane', vb: '0 0 36.2 36.2', w: 36.2, h: 36.2,
    inner: `<circle cx="18.1" cy="18.1" r="17" fill="${Y}" stroke="${Y}" stroke-width="0.2"/>` +
      '<g transform="translate(0 1.1)">' +
      '<path d="M11.6 15.9L27.3 7.2L28.6 9.4L13.3 18.4Z"/>' +                // boom
      '<path d="M27.3 7.2L29.2 7.9L29.2 9.6L28.2 9.6Z"/>' +                  // boom head
      '<path d="M15.2 19.4L19.1 13.9L20.4 14.8L16.9 19.4Z"/>' +              // luffing ram
      '<path d="M28.6 9.6V12.1" fill="none" stroke="#000" stroke-width="0.6"/>' + // hoist line
      '<path d="M28.6 12.1V13.3a1.3 1.3 0 1 1-1.3 1.3" fill="none" stroke="#000" stroke-width="0.95" stroke-linecap="round"/>' + // hook
      '<path d="M7.3 15.4H14.2L15.6 17.1V19.4H7.3Z"/>' +                     // operator house
      '<rect x="5.6" y="19.2" width="19.4" height="2.6"/>' +                 // carrier deck
      '<path d="M24.6 21.8V15.3H28.6L30.9 18.4V21.8Z"/>' +                   // truck cab
      `<path d="M25.6 16.3H28.1L29.5 18.3H25.6Z" fill="${Y}"/>` +            // cab window
      wheel(9.4) + wheel(14.5) + wheel(27.6) +
      '</g>',
  });
})();
