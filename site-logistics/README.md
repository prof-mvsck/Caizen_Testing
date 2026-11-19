# Site Logistics

Lay out a construction site logistics plan over a site plan (any PDF page or image) and export an
**11 x 17 in sheet** with the legend and a full title block. One self-contained HTML file; it works offline.

**Use it:** open `dist/site-logistics.html` in Chrome or Edge (double-click it). To view it in the Claude app's
browser pane, start the `site-logistics` entry in `Desktop\Git\.claude\launch.json` and go to
`http://localhost:8793/dist/site-logistics.html`.

## Tabs
Four tabs across the top: **Site Mobilization**, **Site Safety**, **Material Logistics Plan** and **Traffic Control**
(the traffic-control symbols, moved off Site Mobilization on 2026-11-12). Each is the same
tool with its own legend, markup, sheet scale, symbol size and title block. **The drawing is shared:** a PDF or image
opened on any tab shows on every tab, on the same page, with the same drawing scale and north arrow (2026-11-12). `src/plans.js` lists the tabs and, per tab, the legend headings and symbol ids
(picked from the symbol libraries). The Site Safety legend is the 16 entries of the Site Safety Plan legend (2026-11-12); its Crane has a reach circle,
drawn red; plus Covered Walkways (grey area) and Temporary Crosswalk (light blue with footprints). Every colour on it
is one of the Site Mobilization tab's: the PDF's reds and blues are recoloured by `tools/build_safety.py`. The Material Logistics legend (2026-11-12) is eight storage symbols, each with
an area drawn from it the way a muster point gets its muster area (select the placed symbol, "Draw ... area"): Lumber,
Plumbing, Concrete Mixing, Concrete Materials, Electrical & Specialty, Equipment Storage, Soil & Backfill Mound, Wash Area.

A fifth tab, **Overlay**, shows the other tabs' markup together on the drawing they share: it takes the drawing most
tabs have open (by file name and size) and lays each tab's markup for it on top as one see-through layer, 40% to
start, with a tick box per tab and one opacity slider. It is a viewer (no drawing tools) and refreshes each time it
is shown. Its export has one legend heading per tab; its PDF carries every tab's markup as
Bluebeam annotations at the overlay opacity, each Subject starting with its tab (for example "Site Safety - Fire Hydrant").

**Wayfinding** (2026-11-13) is a sixth plan tab: sign boards, direction arrows and a route line. **Overlay** has two
tools of its own, Text and Dimension; their items belong to the Overlay tab and export with it (a text label is an
editable text markup in Bluebeam).

## Workflow
1. **Open PDF or image...** (or drop a file on the window, or paste an image).
   **Rotate page** a quarter turn with **⟲ 90°** / **⟳ 90°** in the toolbar, *Rotate page* in the Drawing panel, or
   **Ctrl+Shift+Minus** / **Ctrl+Shift+Plus** (Cmd on a Mac; the keys Bluebeam and Acrobat use). The turn is shared by
   every tab and the markup turns with it (2026-11-19: toolbar buttons and keys added).
2. **Drawing scale** (left panel): *Calibrate...* on two points a known distance apart, or *Enter 1:N...* for a PDF
   drawn to scale at full size. The sheet scale, scale bar and crane reach in metres need it.
3. Pick a legend row on the right and draw: lines by clicking points, areas as Polygon or Rect, symbols by a click.
   Double-click or Enter finishes a line or polygon. Select mode moves, reshapes, duplicates (Ctrl+D) and deletes items.
   Cranes: drag the yellow handle for the reach, double-click to type it, *Crane: make pie* for a swing sector.
   **Symbol size** (left panel, one setting per plan): *Small* or *Large*. Symbols print at a fixed size on the
   11 x 17 sheet at every drawing scale and sheet scale: a standard symbol is 1/4 in tall at Small and 1/2 in at
   Large; smaller ones (cones, drums) keep their proportion, down to a floor so they still read. On screen they show
   at the size they will have against the drawing on the sheet. Lines, areas and crane reach are not affected.
4. Fill in the **title block** along the bottom (project, site address, drawing title, sheet, rev, drawn by,
   checked by, date). It prints exactly as laid out on screen.
5. **Sheet scale** (left panel): *Auto* uses the largest standard scale (1:100, 1:125, 1:150, 1:200, 1:250, ...) at
   which everything in view still fits. A fixed scale (metric, 1" = 20' style, or 1/4" = 1'-0" and 1/8" = 1'-0") prints the area inside the dashed frame on screen.
6. **Export PNG / Export PDF**: 11 x 17 in at 200 dpi, with the drawing at the sheet scale, a north arrow, a scale bar,
   a legend of only the symbols used, and the title block. **Print at actual size (100%)**, not "fit to page", or the
   scale will be wrong. The border sits 1/4 in in from the paper edge so a 100% print does not clip it.

Markup saves automatically in the browser, per drawing (by file name and size), and the last drawing reopens next
time. Browser storage is per browser and per address (a file opened from disk and the localhost copy don't share
it) and is lost if the browser's data is cleared, so use **Save plan file** to keep or hand over the work, and
**Load plan file...** to put it back on the same drawing.

## Files in and out (2026-11-12)
- **Open:** a PDF, or any image: PNG, JPEG, WebP, GIF, BMP, AVIF and SVG through the browser, and TIFF, JPEG XL and
  HEIC through decoders embedded in the file (`src/vendor`: UTIF.js + pako, jxl-oxide-wasm, libheif-js; pinned by
  SHA-256 in `build.py`, started only when such a file is opened). libheif-js is LGPL-3.0; the others are MIT.
  A multi-page TIFF opens its largest page. `test/formats/` has one small file of each kind.
- **Export image:** PNG, JPEG, WebP (the browser's encoders), TIFF (Deflate) and BMP (written in `app.js`), all 200 dpi.
- **Export PDF:** the sheet as a picture with each markup on top as a PDF annotation, so Bluebeam Revu lists them as
  markups (Subject = the legend label): lines are PolyLines, areas Polygons, symbols Stamps, a crane's reach a Circle
  (a Polygon for a swing pie). Each carries a picture of itself as its appearance; when a line, area or circle is
  edited in Revu, Revu redraws it from its colour, width, dash and fill, so hatches, ticks and letter marks go plain.
  `test/bluebeam-check.pdf` is a sample.
  When the drawing has a scale, the PDF also carries the sheet scale as a measurement viewport, which Revu shows as
  its page scale, so its measuring tools read metres without calibrating.
- **PDF layers and line styles (2026-11-13):** markups sit on PDF layers as in the Elevate template (Linear Markups,
  Equipment/Symbols, Crane Radius, Building Outline; one layer per tab from the Overlay), and fence ticks and the
  covered walkway's rails use Bluebeam's own `/LineStyle`, so they survive an edit in Revu. Letter marks (E, F),
  hatches, stripes and footprints still do not.
- **Questions** (scale entry, calibration distance, crane radius, confirmations) use the tool's own dialog, never the
  browser's `prompt()`/`confirm()`, which embedded browser panes block.

## Build
Edit the files in `src/`, then run:

    python build.py

It writes `dist/site-logistics.html`. `src/index.html` is the template; `build.py` inlines the styles, symbol
libraries and `app.js`, and embeds PDF.js as base64.

| File | What it is |
|---|---|
| `src/app.js` | the app (`createSitePlan`, one instance per tab) |
| `src/plans.js` | the tabs: each tab's legend (headings and symbol ids), title and storage keys |
| `src/styles.css` | the layout |
| `src/symbols.js` | legend symbols generated from Logistics_plan_legend_v21 (do not edit by hand) |
| `src/symbols_tc.js` | traffic-control symbols |
| `src/symbols_extra.js` | hand-added entries (Tower crane label, Mobile crane) |
| `src/symbols_material.js` | the Material Logistics legend, drawn by hand; each entry names its area colour (`zone`) |
| `src/symbols_safety.js` | the Site Safety legend, written by `tools/build_safety.py` from a Site Safety Plan PDF (do not edit by hand) |
| `src/symbols_more.js` | hand-drawn: Slick Line, Forklift Staging, Placing Boom (Site Mobilization) and the Wayfinding tab's signs |
| `src/symbols_safety_extra.js` | hand-drawn Site Safety entries: Lunch Area, Smoking Area, Flammable Storage, Camera Location, Temp Water, Covered Walkway w/ Temp Lights |
| `src/vendor/` | pdfjs-dist@5.4.624 legacy build, unmodified, plus its licences; `build.py` checks their SHA-256 |
| `test/make_test_pdf.py` | writes `test/test-site-1to200.pdf`, a 30 x 40 m lot drawn at 1:200, for checking export scale |

`build.py` makes three edits to the PDF.js worker so it runs as a classic script (needed when the HTML is opened
from disk): its two `import.meta.url` become `self.location.href`, and the closing `export` is removed. The result is
byte-identical to the worker in the original `logistics-sheet (1).html`.

## Changes from the reference (`logistics-sheet (1).html`, 2026-11)
- The export now carries a full title block; the reference dropped project info from the exported sheet.
- The export prints at a true, standard scale, stated in the title block and on a four-part scale bar; a fixed scale
  can be picked, with an on-screen frame showing what it prints. (The COSMOS extension's label was off by the screen
  size; the reference's scale was true but not a round number.)
- 1/4 in sheet margin so printing at 100% keeps the border.
- Save / load plan files (.json), checked on load: unknown symbols and bad numbers are dropped and ids regenerated.
- Real source plus a build script; the reference was a built file with no source.
- Point symbols print at one of two fixed sizes on the sheet, Small (1/4 in) or Large (1/2 in), at every scale
  (2026-11-12; from 2026-11-10 to then they were drawn to scale).
- PDF / image backgrounds only, no COSMOS dependency. Its storage keys (`siteLogistics.v1`, IndexedDB `siteLogistics`)
  are separate from the reference's.
