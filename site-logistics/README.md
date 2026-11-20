# Site Logistics

Lay out a construction site logistics plan over a site plan (any PDF page or image) and export an
**11 x 17 in sheet** with the legend and a full title block. One self-contained HTML file; it works offline.

**Use it:** open `dist/site-logistics.html` in Chrome or Edge (double-click it). To view it in the Claude app's
browser pane, start the `site-logistics` entry in `Desktop\Git\.claude\launch.json` and go to
`http://localhost:8793/dist/site-logistics.html`.

## Layers (2026-11-19)
One view of the drawing, with every discipline as a **layer** in the legend on the right (they were tabs before):
**Site Mobilization**, **Site Safety**, **Material Logistics Plan**, **Traffic Control**, **Wayfinding** and **Notes**.
All layers show on the drawing together; the last in the list draws on top.

- Each layer's heading has an **eye** (show or hide it), its name with how many items it has on this page, and an
  **opacity** slider. Hidden layers are not drawn, cannot be selected or snapped to, and are left off the export;
  the opacity applies on screen and on the sheet. Both are kept with the plan.
- The **padlock** beside the eye locks a layer: it still shows and prints, but its markup cannot be selected, moved,
  edited, deleted or cleared, nothing new can be placed on it (its symbols, or Text and Dimension for a locked Notes),
  an undo from before the lock leaves it as it is, and an old tab's plan file will not replace it. Page turns still
  turn it with the drawing. Kept with the plan.
- Click a layer's name to **drop down its symbols and hatches**; pick one to place it on that layer. The layer being
  worked on (the tool in hand, or the selected item) is marked in blue. Picking a symbol of a hidden layer shows it.
- **Notes** holds the text labels, dimensions and shapes. **Text**, **Dimension**, **Box**, **Circle** and **Cloud**
  are in the toolbar for every layer and place their items on Notes (a text label is an editable text markup in
  Bluebeam). Notes is never listed in the exported legend: its items speak for themselves.
- **Shapes** (2026-11-19): **Box** (B), **Circle** (O) and **Cloud** (K) draw outlines in the same 9 colours as text
  (1 to 9, or the swatches in the toolbar while a shape tool is in hand or a shape is selected; shapes keep their own
  colour apart from the labels'). Click two opposite corners; hold Shift for a square or a true circle. A Cloud
  follows Polygon / Rect: two corners, or corner by corner with Enter to close. Only a shape's outline takes a click,
  so what it rings can still be picked. Dragging a corner of a Box or Circle resizes it (the opposite corner stays;
  it stays a box); a Cloud's corners reshape like an area's. In the PDF they are Revu's own Rectangle, Ellipse and
  Cloud markups (Square, Circle, and a Polygon with the cloudy border), editable there.
- **Site Trailer** (Site Mobilization legend, 2026-11-19): a black rectangle at its real size, so it needs the drawing
  scale. Click where its centre goes; it is placed at 40' x 10' to start, and after that at the size and angle last
  typed. Select it and press **Trailer size** (E), or double-click it, to type its length and width in metres
  (`12.2`, `12.2 m`, `12200 mm`) or feet and inches (`40'`, `40 ft`, `40'-6"`) and its angle (degrees anticlockwise).
  Its size is written above it while selected, and it keeps its real size if the drawing scale is changed.
- One title block, symbol size and drawing title for the whole sheet; the title is typed
  (SITE LOGISTICS PLAN to start).
- `src/plans.js` lists the layers and, per layer, the legend headings and symbol ids (picked from the symbol
  libraries). The Site Safety legend is the 16 entries of the Site Safety Plan legend; its Crane has a reach circle,
  drawn red; plus Covered Walkways (grey area) and Temporary Crosswalk (light blue with footprints), all in the Site
  Mobilization colours (`tools/build_safety.py`). The Material Logistics legend is eight storage symbols, each with an
  area drawn from it the way a muster point gets its muster area (select the placed symbol, "Draw ... area").
- **Work from the tabs carries over:** the first time a drawing is opened with layers, every tab's saved markup for it
  (and the Overlay tab's text labels and dimensions) is put together into one plan, each item on its tab's layer; the
  title block and settings are Site Mobilization's. The old tabs' storage is left as it was. A plan file saved from a
  tab replaces only that tab's layer when loaded.

## Screen layout (2026-11-19)
The drawing window always has the shape of the printed sheet's drawing area (the 11 x 17 sheet less its legend
column and title block), on any screen, so the dashed print outline fills it edge to edge, as on the export. Spare
width goes to the page-setup column on the left; spare height is left below the title block. The toolbar is the
top row of the screen (where the tabs were), so nothing covers the drawing. On a phone held upright the drawing takes the full width with the panel
below; on its side, the full height with the toolbar and panel beside it. `layoutSheet` in `app.js` sets the size;
`styles.css` arranges the panels.

## Page overlay (2026-11-19)
For a drawing with several pages (floors, levels), **PAGE OVERLAY** in the page-setup column lays up to four other
pages over the page showing (five with it), to see how they line up. **+ Add a page to lay over** takes the nearest
page not yet laid over; each row has an eye, the page (any page can be picked), an opacity slider (50% to start) and
x to take it off. A page laid over brings its drawing, multiplied over this one so its white paper drops out and its
lines darken, and its markup on the shown layers, at its opacity, view only (it cannot be selected or changed from
here: go to that page for that). Pages are laid by their top-left corners and turned with the page showing, so the
sheets of one set line up. The list is kept with the plan (and in plan files). **Exports and Print are the page
showing alone**; the preview says which pages were laid over on screen only.

## Keyboard shortcuts (2026-11-19)
Press **?** (or the **?** button at the end of the toolbar) for this list in the tool; each toolbar button's tooltip
names its key. A key does just what its button does, and only when the button is showing (the crane keys with a crane
selected, the text keys with the Text tool or a label selected, the colour keys with a shape tool or a shape too). Letter keys do nothing while you type in a field.
Ctrl is Cmd on a Mac.

| Tools | | Edit | | View | | File | |
|---|---|---|---|---|---|---|---|
| V | Select | Ctrl+Z | Undo | F | Fit | Ctrl+O | Open a drawing |
| H | Pan (or hold Space with any tool) | Ctrl+D | Duplicate | Z | Selected (zoom window) | Ctrl+S | Save plan file |
| P | Polygon | Delete | Delete the selected item | Ctrl+Shift+Minus / Plus | Rotate the page | Ctrl+E | Export image |
| R | Rect | Shift+Delete | Clear the page (asks) | S | Snap on / off | Ctrl+Shift+E | Export PDF |
| T | Text label | A | Draw the selected symbol's area | L | Crane setup checklist | Ctrl+P | Print |
| D | Dimension | C | Crane: pie or circle | | | ? | This list |
| B | Box (Notes) | E | Crane spec / Trailer size | | | | |
| O | Circle (Notes) | 1 to 9 | Text or shape colour | | | | |
| K | Cloud (Notes) | [ ], - = | Text: turn 15°, size | | | | |
| Enter | Finish a line or area | | | | | | |
| Esc | Stop / cancel | | | | | | |

## Workflow
1. **Open PDF or image...** (or drop a file on the window, or paste an image).
   **Rotate page** a quarter turn with **⟲ 90°** / **⟳ 90°** (Drawing panel, under Display), or **Ctrl+Shift+Minus** /
   **Ctrl+Shift+Plus** (Cmd on a Mac; the keys Bluebeam and Acrobat use). Every layer's markup turns with the page.
   **Display** in the Drawing panel holds the view and page controls (2026-11-19: moved there from the toolbar):
   *Fade the drawing*; *View*: **Fit** (F) and **Selected** (Z, the zoom window); *Rotate page*; and, for a drawing
   of several pages, *Export*: **All pages** or **This page**, what Export image and Export PDF save. F and Z work
   even while the Drawing panel is behind another tab on a narrow screen.
   The **Drawing panel** (left) shows titles and controls only: hover a title or a control for what it does
   (2026-11-19: the explanation paragraphs moved into tooltips).
2. **Drawing scale** (left panel): the scale the drawing was drawn at on its own full-size sheet. *Calibrate...* on
   two points a known distance apart, or *Enter 1:N...* for a PDF at its full original size: `1:200`, `200`,
   `1/8" = 1'-0"`, `1/8"` or `1" = 20'` (2026-11-20: imperial notation). **It only measures**: dimensions, crane reach,
   site trailers and the scale bar. It does not change what prints or how far the view zooms (2026-11-20). Set it once,
   to the drawing's own scale: a 1/8" drawing stays 1/8" even when its whole page is shown small on the 11 x 17.
   Changing it on a page that already has markup asks first, since every dimension there would read differently.
3. **Snap** (on to start; S or the Snap button turns it off): symbols, line points, area corners, text labels,
   dimension ends and Calibrate's points jump to the drawing's line ends, crossings and middles and to the points of
   the markup on shown layers (a locked layer's too); so do corners dragged to reshape and items moved. Shift keeps
   the next line or polygon edge level, plumb or at 45° (2026-11-19: areas, lines and symbols snap too).
   Pick a legend row on the right and draw: lines by clicking points, areas as Polygon or Rect, symbols by a click.
   Double-click or Enter finishes a line or polygon. Select mode moves, reshapes, duplicates (Ctrl+D) and deletes items.
   Cranes: drag the yellow handle for the reach, double-click to type it, *Crane: make pie* for a swing sector.
   **Crane placement notes** show only while a crane or boom is in hand (a Tower crane, Mobile crane or Placing Boom
   tool picked, or a placed one being moved): a yellow box in the Drawing panel with the full list for the site
   address, and a short yellow list beside the cursor (its checkbox turns that off). Otherwise both are hidden
   (2026-11-19).
   **Symbol size** (left panel, one setting per plan): *Small* or *Large*. Symbols print at a fixed size on the
   11 x 17 sheet at every drawing scale and framing: a standard symbol is 1/4 in tall at Small and 1/2 in at
   Large; smaller ones (cones, drums) keep their proportion, down to a floor so they still read. On screen they show
   at the size they will have against the drawing on the sheet. Lines, areas and crane reach are not affected.
4. Fill in the **title block** along the bottom (project, site address, drawing title, sheet, rev, drawn by,
   checked by, date). It prints exactly as laid out on screen.
5. **The sheet is what you frame** (2026-11-20: no sheet scale to pick, no standard numbers). What is inside the dashed
   outline prints, at any zoom: scroll (or pinch) in and out, drag to pan, **Fit** (F) for the whole page, **Selected**
   (Z) to make a dragged rectangle fill the outline. One rule keeps people from zooming out too far: **the sheet never
   shows blank space on more than two sides**. Zooming out stops at the whole page just inside the outline (where Fit
   puts it), with any blank space on two opposite sides, evenly; panning keeps to the same rule (the outline stays on
   the page, or the page stays centred where it is narrower than the outline). It works for a PDF page or image of any
   shape (portrait, landscape, a long panorama, a square, a tiny image), turned or not, with or without a drawing scale.
   Calibrate puts the view back after picking its two points. The sheet prints at whatever scale that framing gives, so
   the title block reads **As shown: see scale bar** and the four-part scale bar is exact (with no drawing scale: NTS,
   no bar).
6. **Export image / Export PDF / Print**: first a **preview** of the sheet exactly as it will be saved, with the
   layers on it, the hidden ones left off, the scale and the file name; nothing is written until **Save** (Esc or
   Cancel saves nothing; 2026-11-19). 11 x 17 in at 200 dpi, with the drawing as framed, a north arrow, a
   scale bar, a legend of only the symbols used (a heading per shown layer), and the title block. **Print at actual size (100%)**, not "fit to page", so
   the PDF's measuring scale holds (the scale bar holds either way). The border sits 1/4 in in from the paper edge so a 100% print does not clip it.

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
  markups (Subject = the layer and the legend label, e.g. "Site Safety - Fire Hydrant"): lines are PolyLines, areas Polygons, symbols Stamps, a crane's reach a Circle
  (a Polygon for a swing pie). Each carries a picture of itself as its appearance; when a line, area or circle is
  edited in Revu, Revu redraws it from its colour, width, dash and fill, so hatches, ticks and letter marks go plain.
  `test/bluebeam-check.pdf` is a sample.
  When the drawing has a scale, the PDF also carries the scale the sheet prints at as a measurement viewport, which
  Revu shows as its page scale, so its measuring tools read metres without calibrating.
- **PDF layers and line styles:** markups sit on one PDF layer per plan layer (Site Mobilization, Site Safety, ...,
  Notes; 2026-11-19), at the layer's opacity, so Revu and Acrobat can switch each discipline on and off; fence ticks and the
  covered walkway's rails use Bluebeam's own `/LineStyle`, so they survive an edit in Revu. On screen and in the
  sheet, the walkway's two rails stay parallel through every bend, rounded on the outside (2026-11-19). Letter marks (E, F),
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
| `src/app.js` | the app (`createSitePlan`: one view, its layers from `plans.js`) |
| `src/plans.js` | the layers: each layer's legend (headings and symbol ids), and where the old tabs kept their work |
| `src/styles.css` | the layout |
| `src/symbols.js` | legend symbols generated from Logistics_plan_legend_v21 (do not edit by hand) |
| `src/symbols_tc.js` | traffic-control symbols |
| `src/symbols_extra.js` | hand-added entries (Tower crane label, Mobile crane) |
| `src/symbols_material.js` | the Material Logistics legend, drawn by hand; each entry names its area colour (`zone`) |
| `src/symbols_safety.js` | the Site Safety legend, written by `tools/build_safety.py` from a Site Safety Plan PDF (do not edit by hand) |
| `src/symbols_more.js` | hand-drawn: Slick Line, Forklift Staging, Placing Boom (Site Mobilization) and the Wayfinding layer's signs |
| `src/symbols_safety_extra.js` | hand-drawn Site Safety entries: Lunch Area, Smoking Area, Flammable Storage, Camera Location, Temp Water, Covered Walkway w/ Temp Lights |
| `src/vendor/` | pdfjs-dist@5.4.624 legacy build, unmodified, plus its licences; `build.py` checks their SHA-256 |
| `test/make_test_pdf.py` | writes `test/test-site-1to200.pdf`, a 30 x 40 m lot drawn at 1:200, for checking export scale |

`build.py` makes three edits to the PDF.js worker so it runs as a classic script (needed when the HTML is opened
from disk): its two `import.meta.url` become `self.location.href`, and the closing `export` is removed. The result is
byte-identical to the worker in the original `logistics-sheet (1).html`.

## Changes from the reference (`logistics-sheet (1).html`, 2026-11)
- The export now carries a full title block; the reference dropped project info from the exported sheet.
- The export carries a true four-part scale bar, from the drawing scale, with an on-screen frame showing what prints.
  (The COSMOS extension's label was off by the screen size.) From 2026-11-19 to 11-20 it printed at standard scales
  picked in a Sheet scale list; since 2026-11-20 the sheet is what is framed and the title block says "As shown: see
  scale bar".
- 1/4 in sheet margin so printing at 100% keeps the border.
- Save / load plan files (.json), checked on load: unknown symbols and bad numbers are dropped and ids regenerated.
- Real source plus a build script; the reference was a built file with no source.
- Point symbols print at one of two fixed sizes on the sheet, Small (1/4 in) or Large (1/2 in), at every scale
  (2026-11-12; from 2026-11-10 to then they were drawn to scale).
- PDF / image backgrounds only, no COSMOS dependency. Its storage keys (`siteLogistics.v1`, IndexedDB `siteLogistics`)
  are separate from the reference's.
